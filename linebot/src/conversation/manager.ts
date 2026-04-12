/**
 * Conversation manager - orchestrates the conversation flow
 */

import { LineMessage, ConversationState, ConversationStep, Config } from '../types';
import { SessionStorage } from '../session/storage';
import { ConversationFlow } from './flow';
import { MessageProcessor } from './processor';
import { LineApiClient, LineReplyMessage } from '../line/client';
import { getUserMessage, logError } from '../errors';

export class ConversationManager {
  private flow: ConversationFlow;
  private processor: MessageProcessor;

  constructor(
    private sessionStorage: SessionStorage,
    private lineClient: LineApiClient,
    config: Config
  ) {
    this.flow = new ConversationFlow();
    this.processor = new MessageProcessor(config);
  }

  /**
   * Process incoming message and manage conversation flow
   */
  async processMessage(
    userId: string,
    message: LineMessage,
    replyToken: string
  ): Promise<void> {
    let currentStep: string | undefined;
    try {
      console.log(`Processing message for user ${userId}:`, message);

      // Get current conversation state
      let currentState = await this.getCurrentState(userId);
      currentStep = currentState.step;

      // Process the message based on current state
      const { nextState, responseMessage } = await this.processor.processMessage(
        message,
        currentState,
        userId
      );

      // Update state if changed
      if (nextState) {
        await this.updateState(userId, nextState);
        currentState = nextState;
      }

      // Send response to user
      if (responseMessage) {
        await this.lineClient.replyMessage(replyToken, this.createTextMessages(responseMessage));
      }

      console.log(`Message processed successfully for user ${userId}, new state: ${currentState.step}`);
    } catch (error) {
      // Structured error logging with classification
      logError(error, userId, { step: currentStep, messageType: message.type });

      // Send user-friendly error message
      const errorMessage = getUserMessage(error);
      try {
        await this.lineClient.replyMessage(replyToken, this.createTextMessages(errorMessage));
      } catch (replyError) {
        logError(replyError, userId, { context: 'failed_to_send_error_reply' });
      }

      throw error;
    }
  }

  /**
   * Get current conversation state for user
   */
  async getCurrentState(userId: string): Promise<ConversationState> {
    try {
      const state = await this.sessionStorage.get(userId);

      if (!state) {
        // Create new IDLE state for new users
        const newState = this.flow.createInitialState();
        await this.sessionStorage.set(userId, newState);
        return newState;
      }

      return state;
    } catch (error) {
      console.error(`Error getting state for user ${userId}:`, error);
      throw new Error(`Failed to get conversation state: ${error}`);
    }
  }

  /**
   * Update conversation state for user
   */
  async updateState(userId: string, newState: ConversationState): Promise<void> {
    try {
      await this.sessionStorage.set(userId, newState);
      console.log(`State updated for user ${userId}: ${newState.step}`);
    } catch (error) {
      console.error(`Error updating state for user ${userId}:`, error);
      throw new Error(`Failed to update conversation state: ${error}`);
    }
  }

  /**
   * Reset user session to IDLE state
   */
  async resetSession(userId: string): Promise<void> {
    try {
      await this.sessionStorage.resetToIdle(userId);
      console.log(`Session reset to IDLE for user ${userId}`);
    } catch (error) {
      console.error(`Error resetting session for user ${userId}:`, error);
      throw new Error(`Failed to reset session: ${error}`);
    }
  }

  /**
   * Cancel current conversation and reset to IDLE
   */
  async cancelConversation(userId: string, replyToken: string): Promise<void> {
    try {
      await this.resetSession(userId);

      const cancelMessage = '投稿作成をキャンセルしました。\n\n' +
        '新しい投稿を作成するには「投稿作成」と送信してください。';

      await this.lineClient.replyMessage(replyToken, this.createTextMessages(cancelMessage));

      console.log(`Conversation cancelled for user ${userId}`);
    } catch (error) {
      console.error(`Error cancelling conversation for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Handle user follow event
   */
  async handleUserFollow(userId: string, replyToken: string): Promise<void> {
    try {
      const welcomeMessage = 'つぽブログへようこそ！🎨\n\n' +
        'このボットを使って簡単にブログ投稿を作成できます。\n\n' +
        '投稿を作成するには「投稿作成」と送信してください。\n' +
        'ヘルプが必要な場合は「ヘルプ」と送信してください。';

      await this.lineClient.replyMessage(replyToken, this.createTextMessages(welcomeMessage));

      // Initialize user session
      await this.getCurrentState(userId);

      console.log(`New user followed: ${userId}`);
    } catch (error) {
      console.error(`Error handling user follow for ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Handle user unfollow event
   */
  async handleUserUnfollow(userId: string): Promise<void> {
    try {
      // Clean up user session
      await this.sessionStorage.delete(userId);

      console.log(`User unfollowed and session cleaned: ${userId}`);
    } catch (error) {
      console.error(`Error handling user unfollow for ${userId}:`, error);
      // Don't throw error for unfollow cleanup failures
    }
  }

  /**
   * Get conversation statistics
   */
  async getConversationStats(): Promise<{
    totalUsers: number;
    activeConversations: number;
    stepDistribution: Record<string, number>;
  }> {
    try {
      // This would use the session storage stats if available
      if ('getStats' in this.sessionStorage && typeof this.sessionStorage.getStats === 'function') {
        const stats = await (this.sessionStorage as any).getStats();

        const activeConversations = Object.values(stats.activeSteps as Record<string, number>)
          .reduce((sum: number, count: number) => sum + count, 0) -
          ((stats.activeSteps as Record<string, number>)[ConversationStep.IDLE] || 0);

        return {
          totalUsers: stats.totalSessions,
          activeConversations,
          stepDistribution: stats.activeSteps
        };
      }

      return {
        totalUsers: 0,
        activeConversations: 0,
        stepDistribution: {}
      };
    } catch (error) {
      console.error('Error getting conversation stats:', error);
      return {
        totalUsers: 0,
        activeConversations: 0,
        stepDistribution: {}
      };
    }
  }

  /**
   * Convert text string to LineReplyMessage array
   */
  private createTextMessages(text: string): LineReplyMessage[] {
    return [{ type: 'text', text }];
  }
}