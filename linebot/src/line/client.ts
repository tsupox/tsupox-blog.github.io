/**
 * LINE Messaging API Client
 * Handles communication with LINE Messaging API
 */

import { Config, ExternalServiceError } from '../types';

export interface LineReplyMessage {
  type: 'text' | 'image';
  text?: string;
  originalContentUrl?: string;
  previewImageUrl?: string;
}

export interface LineQuickReply {
  items: LineQuickReplyItem[];
}

export interface LineQuickReplyItem {
  type: 'action';
  action: {
    type: 'message';
    label: string;
    text: string;
  };
}

export class LineApiClient {
  private readonly baseUrl = 'https://api.line.me/v2/bot';
  private readonly accessToken: string;

  constructor(config: Config) {
    this.accessToken = config.line.channelAccessToken;
  }

  /**
   * Send reply message to user
   */
  async replyMessage(replyToken: string, messages: LineReplyMessage[]): Promise<void> {
    if (!replyToken) {
      throw new ExternalServiceError('Reply token is required', 'LINE_API');
    }

    if (!messages || messages.length === 0) {
      throw new ExternalServiceError('At least one message is required', 'LINE_API');
    }

    if (messages.length > 5) {
      throw new ExternalServiceError('Maximum 5 messages allowed per reply', 'LINE_API');
    }

    try {
      const response = await fetch(`${this.baseUrl}/message/reply`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.accessToken}`,
        },
        body: JSON.stringify({
          replyToken,
          messages,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('LINE API reply error:', {
          status: response.status,
          statusText: response.statusText,
          body: errorText,
        });

        throw new ExternalServiceError(
          `LINE API reply failed: ${response.status} ${response.statusText}`,
          'LINE_API',
          'メッセージの送信に失敗しました。しばらく時間をおいて再度お試しください。'
        );
      }

      console.log('Reply message sent successfully');
    } catch (error) {
      if (error instanceof ExternalServiceError) {
        throw error;
      }

      console.error('LINE API client error:', error);
      throw new ExternalServiceError(
        `Failed to send reply message: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'LINE_API',
        'メッセージの送信に失敗しました。しばらく時間をおいて再度お試しください。'
      );
    }
  }

  /**
   * Send text message
   */
  async sendTextMessage(replyToken: string, text: string, quickReply?: LineQuickReply): Promise<void> {
    const message: LineReplyMessage & { quickReply?: LineQuickReply } = {
      type: 'text',
      text,
    };

    if (quickReply) {
      message.quickReply = quickReply;
    }

    await this.replyMessage(replyToken, [message]);
  }

  /**
   * Send multiple text messages
   */
  async sendTextMessages(replyToken: string, texts: string[]): Promise<void> {
    if (texts.length > 5) {
      // Send first 5 messages, then send remaining in separate calls
      await this.replyMessage(replyToken, texts.slice(0, 5).map(text => ({ type: 'text', text })));

      // For remaining messages, we would need push messages (not reply)
      // For now, just log a warning
      console.warn(`Attempted to send ${texts.length} messages, only first 5 sent via reply`);
      return;
    }

    const messages: LineReplyMessage[] = texts.map(text => ({
      type: 'text',
      text,
    }));

    await this.replyMessage(replyToken, messages);
  }

  /**
   * Download image content from LINE
   */
  async downloadImage(messageId: string): Promise<Buffer> {
    if (!messageId) {
      throw new ExternalServiceError('Message ID is required', 'LINE_API');
    }

    try {
      const response = await fetch(`${this.baseUrl}/message/${messageId}/content`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('LINE API download error:', {
          status: response.status,
          statusText: response.statusText,
          body: errorText,
        });

        throw new ExternalServiceError(
          `LINE API download failed: ${response.status} ${response.statusText}`,
          'LINE_API',
          '画像のダウンロードに失敗しました。'
        );
      }

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      console.log(`Downloaded image: ${buffer.length} bytes`);
      return buffer;
    } catch (error) {
      if (error instanceof ExternalServiceError) {
        throw error;
      }

      console.error('LINE API download error:', error);
      throw new ExternalServiceError(
        `Failed to download image: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'LINE_API',
        '画像のダウンロードに失敗しました。'
      );
    }
  }

  /**
   * Get user profile information
   */
  async getUserProfile(userId: string): Promise<{ displayName: string; pictureUrl?: string }> {
    if (!userId) {
      throw new ExternalServiceError('User ID is required', 'LINE_API');
    }

    try {
      const response = await fetch(`${this.baseUrl}/profile/${userId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('LINE API profile error:', {
          status: response.status,
          statusText: response.statusText,
          body: errorText,
        });

        throw new ExternalServiceError(
          `LINE API profile failed: ${response.status} ${response.statusText}`,
          'LINE_API'
        );
      }

      const profile = await response.json() as { displayName: string; pictureUrl?: string };
      return {
        displayName: profile.displayName,
        pictureUrl: profile.pictureUrl,
      };
    } catch (error) {
      if (error instanceof ExternalServiceError) {
        throw error;
      }

      console.error('LINE API profile error:', error);
      throw new ExternalServiceError(
        `Failed to get user profile: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'LINE_API'
      );
    }
  }

  /**
   * Create quick reply for tag selection
   */
  createTagSelectionQuickReply(tags: string[]): LineQuickReply {
    // LINE quick reply supports maximum 13 items
    const maxTags = Math.min(tags.length, 12); // Reserve 1 for "新しいタグ"

    const items: LineQuickReplyItem[] = tags.slice(0, maxTags).map(tag => ({
      type: 'action',
      action: {
        type: 'message',
        label: tag,
        text: tag,
      },
    }));

    // Add option for new tag
    items.push({
      type: 'action',
      action: {
        type: 'message',
        label: '新しいタグ',
        text: '新しいタグを作成',
      },
    });

    return { items };
  }

  /**
   * Create quick reply for confirmation
   */
  createConfirmationQuickReply(): LineQuickReply {
    return {
      items: [
        {
          type: 'action',
          action: {
            type: 'message',
            label: '公開する',
            text: '公開する',
          },
        },
        {
          type: 'action',
          action: {
            type: 'message',
            label: 'キャンセル',
            text: 'キャンセル',
          },
        },
      ],
    };
  }

  /**
   * Create quick reply for post creation start
   */
  createStartQuickReply(): LineQuickReply {
    return {
      items: [
        {
          type: 'action',
          action: {
            type: 'message',
            label: '投稿作成',
            text: '投稿作成',
          },
        },
        {
          type: 'action',
          action: {
            type: 'message',
            label: 'ヘルプ',
            text: 'ヘルプ',
          },
        },
      ],
    };
  }
}