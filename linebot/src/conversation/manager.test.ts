/**
 * Unit tests for conversation manager
 */

import { ConversationManager } from './manager';
import { SessionStorage, createIdleState } from '../session/storage';
import { LineApiClient } from '../line/client';
import { ConversationStep, Config, LineMessage } from '../types';

// Mock dependencies
jest.mock('../line/client');

describe('ConversationManager', () => {
  let manager: ConversationManager;
  let mockSessionStorage: jest.Mocked<SessionStorage>;
  let mockLineClient: jest.Mocked<LineApiClient>;
  let mockConfig: Config;

  beforeEach(() => {
    mockSessionStorage = {
      get: jest.fn(),
      set: jest.fn(),
      resetToIdle: jest.fn(),
      delete: jest.fn(),
      cleanup: jest.fn(),
    };

    mockLineClient = {
      replyMessage: jest.fn(),
      downloadImage: jest.fn(),
    } as any;

    mockConfig = {
      blog: {
        baseUrl: 'https://test-blog.com',
        availableTags: ['タグ1', 'タグ2'],
        imageBasePath: '/images',
        categories: ['日記']
      }
    } as Config;

    manager = new ConversationManager(mockSessionStorage, mockLineClient, mockConfig);
  });

  describe('processMessage', () => {
    it('should process message successfully', async () => {
      const message: LineMessage = { type: 'text', text: '投稿作成' };
      const initialState = createIdleState();

      mockSessionStorage.get.mockResolvedValue(initialState);
      mockSessionStorage.set.mockResolvedValue();
      mockLineClient.replyMessage.mockResolvedValue();

      await manager.processMessage('user123', message, 'reply123');

      expect(mockSessionStorage.get).toHaveBeenCalledWith('user123');
      expect(mockSessionStorage.set).toHaveBeenCalled();
      expect(mockLineClient.replyMessage).toHaveBeenCalledWith('reply123', [
        expect.objectContaining({ text: expect.stringContaining('新しいブログ投稿') })
      ]);
    });

    it('should handle processing errors gracefully', async () => {
      const message: LineMessage = { type: 'text', text: '投稿作成' };

      mockSessionStorage.get.mockRejectedValue(new Error('Storage error'));
      mockLineClient.replyMessage.mockResolvedValue();

      await expect(manager.processMessage('user123', message, 'reply123')).rejects.toThrow();
      expect(mockLineClient.replyMessage).toHaveBeenCalledWith('reply123', [
        expect.objectContaining({ text: expect.stringContaining('エラーが発生しました') })
      ]);
    });

    it('should handle reply errors gracefully', async () => {
      const message: LineMessage = { type: 'text', text: '投稿作成' };

      mockSessionStorage.get.mockRejectedValue(new Error('Storage error'));
      mockLineClient.replyMessage.mockRejectedValue(new Error('Reply error'));

      await expect(manager.processMessage('user123', message, 'reply123')).rejects.toThrow();
    });
  });

  describe('getCurrentState', () => {
    it('should return existing state', async () => {
      const existingState = createIdleState();
      existingState.step = ConversationStep.WAITING_TITLE;

      mockSessionStorage.get.mockResolvedValue(existingState);

      const result = await manager.getCurrentState('user123');

      expect(result).toEqual(existingState);
      expect(mockSessionStorage.get).toHaveBeenCalledWith('user123');
    });

    it('should create new state for new user', async () => {
      mockSessionStorage.get.mockResolvedValue(null);
      mockSessionStorage.set.mockResolvedValue();

      const result = await manager.getCurrentState('user123');

      expect(result.step).toBe(ConversationStep.IDLE);
      expect(mockSessionStorage.set).toHaveBeenCalledWith('user123', expect.objectContaining({
        step: ConversationStep.IDLE
      }));
    });

    it('should handle storage errors', async () => {
      mockSessionStorage.get.mockRejectedValue(new Error('Storage error'));

      await expect(manager.getCurrentState('user123')).rejects.toThrow('Failed to get conversation state');
    });
  });

  describe('updateState', () => {
    it('should update state successfully', async () => {
      const newState = createIdleState();
      newState.step = ConversationStep.WAITING_TITLE;

      mockSessionStorage.set.mockResolvedValue();

      await manager.updateState('user123', newState);

      expect(mockSessionStorage.set).toHaveBeenCalledWith('user123', newState);
    });

    it('should handle update errors', async () => {
      const newState = createIdleState();
      mockSessionStorage.set.mockRejectedValue(new Error('Update error'));

      await expect(manager.updateState('user123', newState)).rejects.toThrow('Failed to update conversation state');
    });
  });

  describe('resetSession', () => {
    it('should reset session to IDLE', async () => {
      mockSessionStorage.resetToIdle.mockResolvedValue();

      await manager.resetSession('user123');

      expect(mockSessionStorage.resetToIdle).toHaveBeenCalledWith('user123');
    });

    it('should handle reset errors', async () => {
      mockSessionStorage.resetToIdle.mockRejectedValue(new Error('Reset error'));

      await expect(manager.resetSession('user123')).rejects.toThrow('Failed to reset session');
    });
  });

  describe('cancelConversation', () => {
    it('should cancel conversation and send message', async () => {
      mockSessionStorage.resetToIdle.mockResolvedValue();
      mockLineClient.replyMessage.mockResolvedValue();

      await manager.cancelConversation('user123', 'reply123');

      expect(mockSessionStorage.resetToIdle).toHaveBeenCalledWith('user123');
      expect(mockLineClient.replyMessage).toHaveBeenCalledWith('reply123', [
        expect.objectContaining({ text: expect.stringContaining('キャンセルしました') })
      ]);
    });

    it('should handle cancellation errors', async () => {
      mockSessionStorage.resetToIdle.mockRejectedValue(new Error('Reset error'));

      await expect(manager.cancelConversation('user123', 'reply123')).rejects.toThrow();
    });
  });

  describe('handleUserFollow', () => {
    it('should send welcome message and initialize session', async () => {
      mockLineClient.replyMessage.mockResolvedValue();
      mockSessionStorage.get.mockResolvedValue(null);
      mockSessionStorage.set.mockResolvedValue();

      await manager.handleUserFollow('user123', 'reply123');

      expect(mockLineClient.replyMessage).toHaveBeenCalledWith('reply123', [
        expect.objectContaining({ text: expect.stringContaining('つぽブログへようこそ') })
      ]);
      expect(mockSessionStorage.get).toHaveBeenCalledWith('user123');
    });

    it('should handle follow errors', async () => {
      mockLineClient.replyMessage.mockRejectedValue(new Error('Reply error'));

      await expect(manager.handleUserFollow('user123', 'reply123')).rejects.toThrow();
    });
  });

  describe('handleUserUnfollow', () => {
    it('should clean up user session', async () => {
      mockSessionStorage.delete.mockResolvedValue();

      await manager.handleUserUnfollow('user123');

      expect(mockSessionStorage.delete).toHaveBeenCalledWith('user123');
    });

    it('should not throw on cleanup errors', async () => {
      mockSessionStorage.delete.mockRejectedValue(new Error('Delete error'));

      await expect(manager.handleUserUnfollow('user123')).resolves.not.toThrow();
    });
  });

  describe('getConversationStats', () => {
    it('should return stats when storage supports it', async () => {
      const mockStats = {
        totalSessions: 5,
        activeSteps: {
          [ConversationStep.IDLE]: 2,
          [ConversationStep.WAITING_TITLE]: 1,
          [ConversationStep.WAITING_CONTENT]: 2
        }
      };

      // Add getStats method to mock
      (mockSessionStorage as any).getStats = jest.fn().mockResolvedValue(mockStats);

      const result = await manager.getConversationStats();

      expect(result.totalUsers).toBe(5);
      expect(result.activeConversations).toBe(3); // Total - IDLE
      expect(result.stepDistribution).toEqual(mockStats.activeSteps);
    });

    it('should return default stats when storage does not support it', async () => {
      const result = await manager.getConversationStats();

      expect(result.totalUsers).toBe(0);
      expect(result.activeConversations).toBe(0);
      expect(result.stepDistribution).toEqual({});
    });

    it('should handle stats errors gracefully', async () => {
      (mockSessionStorage as any).getStats = jest.fn().mockRejectedValue(new Error('Stats error'));

      const result = await manager.getConversationStats();

      expect(result.totalUsers).toBe(0);
      expect(result.activeConversations).toBe(0);
      expect(result.stepDistribution).toEqual({});
    });
  });

  describe('error message generation', () => {
    it('should generate appropriate error messages for different error types', async () => {
      const message: LineMessage = { type: 'text', text: '投稿作成' };

      // Test validation error
      mockSessionStorage.get.mockRejectedValue(new Error('validation failed'));
      mockLineClient.replyMessage.mockResolvedValue();

      await expect(manager.processMessage('user123', message, 'reply123')).rejects.toThrow();
      expect(mockLineClient.replyMessage).toHaveBeenCalledWith('reply123', [
        expect.objectContaining({ text: expect.stringContaining('入力内容に問題があります') })
      ]);
    });

    it('should generate network error messages', async () => {
      const message: LineMessage = { type: 'text', text: '投稿作成' };

      mockSessionStorage.get.mockRejectedValue(new Error('network timeout'));
      mockLineClient.replyMessage.mockResolvedValue();

      await expect(manager.processMessage('user123', message, 'reply123')).rejects.toThrow();
      expect(mockLineClient.replyMessage).toHaveBeenCalledWith('reply123', [
        expect.objectContaining({ text: expect.stringContaining('ネットワークエラー') })
      ]);
    });

    it('should generate session error messages', async () => {
      const message: LineMessage = { type: 'text', text: '投稿作成' };

      mockSessionStorage.get.mockRejectedValue(new Error('session storage failed'));
      mockLineClient.replyMessage.mockResolvedValue();

      await expect(manager.processMessage('user123', message, 'reply123')).rejects.toThrow();
      expect(mockLineClient.replyMessage).toHaveBeenCalledWith('reply123', [
        expect.objectContaining({ text: expect.stringContaining('セッション管理でエラー') })
      ]);
    });

    it('should generate generic error messages for unknown errors', async () => {
      const message: LineMessage = { type: 'text', text: '投稿作成' };

      mockSessionStorage.get.mockRejectedValue(new Error('unknown error'));
      mockLineClient.replyMessage.mockResolvedValue();

      await expect(manager.processMessage('user123', message, 'reply123')).rejects.toThrow();
      expect(mockLineClient.replyMessage).toHaveBeenCalledWith('reply123', [
        expect.objectContaining({ text: expect.stringContaining('エラーが発生しました') })
      ]);
    });
  });
});