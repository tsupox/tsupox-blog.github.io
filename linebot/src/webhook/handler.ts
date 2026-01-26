/**
 * LINE Webhook Handler
 * Handles incoming webhook requests from LINE Messaging API
 */

import crypto from 'crypto';
import { APIGatewayEvent, APIGatewayResponse, LineEvent, Config, LineBotError, ValidationError } from '../types';
import { ConversationManager } from '../conversation/manager';
import { LineApiClient } from '../line/client';
import { createSessionStorage } from '../session/factory';

export class WebhookHandler {
  private conversationManager: ConversationManager;
  private lineClient: LineApiClient;

  constructor(private readonly config: Config) {
    // Initialize LINE API client
    this.lineClient = new LineApiClient(config);

    // Initialize session storage
    const sessionStorage = createSessionStorage(config);

    // Initialize conversation manager
    this.conversationManager = new ConversationManager(
      sessionStorage,
      this.lineClient,
      config
    );
  }

  /**
   * Handle incoming webhook request
   */
  async handleRequest(event: APIGatewayEvent): Promise<APIGatewayResponse> {
    try {
      // Validate HTTP method
      if (event.httpMethod !== 'POST') {
        return this.createErrorResponse(405, 'Method not allowed');
      }

      // Validate content type
      const contentType = event.headers['content-type'] || event.headers['Content-Type'];
      if (!contentType || !contentType.includes('application/json')) {
        return this.createErrorResponse(400, 'Invalid content type');
      }

      // Get request body
      const body = event.body;
      if (!body) {
        return this.createErrorResponse(400, 'Request body is required');
      }

      // Validate signature
      const signature = event.headers['x-line-signature'] || event.headers['X-Line-Signature'];
      if (!signature) {
        return this.createErrorResponse(400, 'Missing LINE signature');
      }

      if (!this.validateSignature(body, signature)) {
        console.error('Invalid LINE signature');
        return this.createErrorResponse(401, 'Invalid signature');
      }

      // Parse LINE events
      const lineEvents = this.parseLineEvents(body);

      // Process each event
      for (const lineEvent of lineEvents) {
        await this.processLineEvent(lineEvent);
      }

      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: 'OK' }),
      };

    } catch (error) {
      console.error('Webhook handler error:', error);

      if (error instanceof LineBotError) {
        return this.createErrorResponse(400, error.message);
      }

      return this.createErrorResponse(500, 'Internal server error');
    }
  }

  /**
   * Validate LINE webhook signature
   */
  validateSignature(body: string, signature: string): boolean {
    try {
      const channelSecret = this.config.line.channelSecret;
      const hash = crypto
        .createHmac('sha256', channelSecret)
        .update(body, 'utf8')
        .digest('base64');

      return signature === hash;
    } catch (error) {
      console.error('Signature validation error:', error);
      return false;
    }
  }

  /**
   * Parse LINE webhook events from request body
   */
  parseLineEvents(body: string): LineEvent[] {
    try {
      const parsed = JSON.parse(body);

      if (!parsed.events || !Array.isArray(parsed.events)) {
        throw new ValidationError('Invalid webhook payload: missing events array');
      }

      return parsed.events.map((event: any) => this.validateLineEvent(event));
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new ValidationError('Invalid JSON in request body');
      }
      throw error;
    }
  }

  /**
   * Validate and normalize LINE event structure
   */
  private validateLineEvent(event: any): LineEvent {
    // Validate required fields
    if (!event.type) {
      throw new ValidationError('Event type is required');
    }

    if (!event.source || !event.source.userId) {
      throw new ValidationError('Event source userId is required');
    }

    // Handle different event types
    const lineEvent: LineEvent = {
      type: event.type,
      replyToken: event.replyToken || '',
      source: {
        userId: event.source.userId,
        type: event.source.type || 'user',
      },
    };

    // Add message data for message events
    if (event.type === 'message' && event.message) {
      lineEvent.message = {
        type: event.message.type,
        text: event.message.text,
        id: event.message.id,
      };
    }

    return lineEvent;
  }

  /**
   * Process individual LINE event
   */
  private async processLineEvent(event: LineEvent): Promise<void> {
    console.log('Processing LINE event:', {
      type: event.type,
      userId: event.source.userId,
      messageType: event.message?.type,
    });

    try {
      switch (event.type) {
        case 'message':
          await this.handleMessageEvent(event);
          break;

        case 'follow':
          await this.handleFollowEvent(event);
          break;

        case 'unfollow':
          await this.handleUnfollowEvent(event);
          break;

        default:
          console.log(`Unhandled event type: ${event.type}`);
      }
    } catch (error) {
      console.error(`Error processing ${event.type} event:`, error);
      // Don't throw here to avoid failing the entire webhook
      // Individual event failures should be logged but not break the webhook
    }
  }

  /**
   * Handle message events (text, image, etc.)
   */
  private async handleMessageEvent(event: LineEvent): Promise<void> {
    if (!event.message) {
      console.warn('Message event without message data');
      return;
    }

    if (!event.replyToken) {
      console.warn('Message event without reply token');
      return;
    }

    const { userId } = event.source;
    const { type: messageType } = event.message;

    console.log(`Handling ${messageType} message from user ${userId}`);

    // Use conversation manager to process all message types
    await this.conversationManager.processMessage(
      userId,
      event.message,
      event.replyToken
    );
  }

  /**
   * Handle follow events (user adds bot as friend)
   */
  private async handleFollowEvent(event: LineEvent): Promise<void> {
    const { userId } = event.source;
    console.log(`User ${userId} followed the bot`);

    if (!event.replyToken) {
      console.warn('Follow event without reply token');
      return;
    }

    // Use conversation manager to handle user follow
    await this.conversationManager.handleUserFollow(userId, event.replyToken);
  }

  /**
   * Handle unfollow events (user removes bot as friend)
   */
  private async handleUnfollowEvent(event: LineEvent): Promise<void> {
    const { userId } = event.source;
    console.log(`User ${userId} unfollowed the bot`);

    // Use conversation manager to clean up user session
    await this.conversationManager.handleUserUnfollow(userId);
  }

  /**
   * Create error response
   */
  private createErrorResponse(statusCode: number, message: string): APIGatewayResponse {
    return {
      statusCode,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        error: message,
        timestamp: new Date().toISOString(),
      }),
    };
  }
}