/**
 * Integration tests for session management system
 */

import { ConversationManager } from './conversation/manager';
import { VercelKVSessionStorage } from './session/vercel-kv-storage';
import { LineApiClient } from './line/client';
import { ConversationStep, Config, LineMessage } from './types';

// Mock @vercel/kv
jest.mock('@vercel/kv', () => ({
  kv: {
    get: jest.fn(),
    setex: jest.fn(),
    del: jest.fn(),
    keys: jest.fn(),
  }
}));

import { kv } from '@vercel/kv';

// Mock LINE API client
jest.mock('./line/client');

describe('Session Management Integration', () => {
  let conversationManager: ConversationManager;
  let sessionStorage: VercelKVSessionStorage;
  let mockLineClient: jest.Mocked<LineApiClient>;
  let mockConfig: Config;
  const mockKv = kv as jest.Mocked<typeof kv>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockConfig = {
      line: {
        channelSecret: 'test-secret',
        channelAccessToken: 'test-token'
      },
      blog: {
        baseUrl: 'https://test-blog.com',
        availableTags: ['タグ1', 'タグ2', 'タグ3'],
        imageBasePath: '/images',
        categories: ['日記']
      },
      storage: {
        type: 'vercel-kv',
        kvUrl: 'redis://localhost:6379'
      },
      imageStorage: {
        type: 'vercel-blob'
      }
    } as Config;

    sessionStorage = new VercelKVSessionStorage();
    mockLineClient = new LineApiClient(mockConfig) as jest.Mocked<LineApiClient>;
    conversationManager = new ConversationManager(sessionStorage, mockLineClient, mockConfig);

    // Mock LINE client methods
    mockLineClient.replyMessage = jest.fn().mockResolvedValue(undefined);
  });

  describe('Basic conversation flow', () => {
    it('should start a new conversation', async () => {
      const userId = 'test-user-123';
      const replyToken = 'reply-token-123';

      // Mock no existing session
      mockKv.get.mockResolvedValue(null);
      mockKv.setex.mockResolvedValue('OK');

      const startMessage: LineMessage = { type: 'text', text: '投稿作成' };
      await conversationManager.processMessage(userId, startMessage, replyToken);

      // Should create new session and transition to WAITING_TITLE
      expect(mockKv.setex).toHaveBeenCalledWith(
        'linebot:session:test-user-123',
        24 * 60 * 60,
        expect.objectContaining({
          step: ConversationStep.WAITING_TITLE
        })
      );

      expect(mockLineClient.replyMessage).toHaveBeenCalledWith(replyToken, [
        expect.objectContaining({
          text: expect.stringContaining('新しいブログ投稿を作成しましょう')
        })
      ]);
    });

    it('should handle title input', async () => {
      const userId = 'test-user-456';
      const replyToken = 'reply-token-456';

      // Mock existing session in WAITING_TITLE state
      mockKv.get.mockResolvedValue({
        step: ConversationStep.WAITING_TITLE,
        data: { tags: [] },
        createdAt: new Date(),
        updatedAt: new Date()
      });
      mockKv.setex.mockResolvedValue('OK');

      const titleMessage: LineMessage = { type: 'text', text: 'テストタイトル' };
      await conversationManager.processMessage(userId, titleMessage, replyToken);

      // Should update session with title and transition to WAITING_CONTENT
      expect(mockKv.setex).toHaveBeenCalledWith(
        'linebot:session:test-user-456',
        24 * 60 * 60,
        expect.objectContaining({
          step: ConversationStep.WAITING_CONTENT,
          data: expect.objectContaining({
            title: 'テストタイトル'
          })
        })
      );

      expect(mockLineClient.replyMessage).toHaveBeenCalledWith(replyToken, [
        expect.objectContaining({
          text: expect.stringContaining('次に、投稿の本文を入力してください')
        })
      ]);
    });

    it('should handle conversation cancellation', async () => {
      const userId = 'test-user-789';
      const replyToken = 'reply-token-789';

      // Mock session with ongoing conversation
      mockKv.get.mockResolvedValue({
        step: ConversationStep.WAITING_CONTENT,
        data: { title: 'テストタイトル', tags: [] },
        createdAt: new Date(),
        updatedAt: new Date()
      });
      mockKv.setex.mockResolvedValue('OK');

      const cancelMessage: LineMessage = { type: 'text', text: 'キャンセル' };
      await conversationManager.processMessage(userId, cancelMessage, replyToken);

      // Should reset session to IDLE
      expect(mockKv.setex).toHaveBeenCalledWith(
        'linebot:session:test-user-789',
        24 * 60 * 60,
        expect.objectContaining({
          step: ConversationStep.IDLE
        })
      );

      expect(mockLineClient.replyMessage).toHaveBeenCalledWith(replyToken, [
        expect.objectContaining({
          text: expect.stringContaining('投稿作成をキャンセルしました')
        })
      ]);
    });
  });

  describe('User lifecycle events', () => {
    it('should handle user follow event', async () => {
      const userId = 'new-user-999';
      const replyToken = 'reply-token-999';

      mockKv.get.mockResolvedValue(null);
      mockKv.setex.mockResolvedValue('OK');

      await conversationManager.handleUserFollow(userId, replyToken);

      expect(mockLineClient.replyMessage).toHaveBeenCalledWith(replyToken, [
        expect.objectContaining({
          text: expect.stringContaining('つぽブログへようこそ')
        })
      ]);

      // Should initialize session (called by getCurrentState)
      expect(mockKv.get).toHaveBeenCalledWith('linebot:session:new-user-999');
    });

    it('should handle user unfollow event', async () => {
      const userId = 'leaving-user-111';

      mockKv.del.mockResolvedValue(1);

      await conversationManager.handleUserUnfollow(userId);

      expect(mockKv.del).toHaveBeenCalledWith('linebot:session:leaving-user-111');
    });
  });

  describe('Session storage integration', () => {
    it('should use correct TTL for session storage', async () => {
      const userId = 'ttl-user';

      mockKv.setex.mockResolvedValue('OK');

      await sessionStorage.set(userId, {
        step: ConversationStep.WAITING_TITLE,
        data: { tags: [] },
        createdAt: new Date(),
        updatedAt: new Date()
      });

      expect(mockKv.setex).toHaveBeenCalledWith(
        'linebot:session:ttl-user',
        24 * 60 * 60, // 24 hours in seconds
        expect.any(Object)
      );
    });

    it('should handle session retrieval', async () => {
      const userId = 'retrieve-user';
      const mockSession = {
        step: ConversationStep.WAITING_CONTENT,
        data: { title: 'Test', tags: [] },
        createdAt: new Date('2024-01-01T10:00:00Z'),
        updatedAt: new Date('2024-01-01T10:30:00Z')
      };

      mockKv.get.mockResolvedValue(mockSession);

      const result = await sessionStorage.get(userId);

      expect(mockKv.get).toHaveBeenCalledWith('linebot:session:retrieve-user');
      expect(result).toEqual(expect.objectContaining({
        step: ConversationStep.WAITING_CONTENT,
        data: expect.objectContaining({
          title: 'Test'
        })
      }));
    });

    it('should handle session deletion', async () => {
      const userId = 'delete-user';

      mockKv.del.mockResolvedValue(1);

      await sessionStorage.delete(userId);

      expect(mockKv.del).toHaveBeenCalledWith('linebot:session:delete-user');
    });
  });

  describe('Error handling', () => {
    it('should handle invalid message types gracefully', async () => {
      const userId = 'invalid-user';
      const replyToken = 'reply-token';

      mockKv.get.mockResolvedValue({
        step: ConversationStep.IDLE,
        data: { tags: [] },
        createdAt: new Date(),
        updatedAt: new Date()
      });

      const invalidMessage: LineMessage = { type: 'unknown' as any };

      await conversationManager.processMessage(userId, invalidMessage, replyToken);

      expect(mockLineClient.replyMessage).toHaveBeenCalledWith(replyToken, [
        expect.objectContaining({
          text: expect.stringContaining('そのメッセージタイプには対応していません')
        })
      ]);
    });

    it('should handle storage errors in session operations', async () => {
      const userId = 'error-user';

      mockKv.get.mockRejectedValue(new Error('Storage connection failed'));

      await expect(sessionStorage.get(userId)).rejects.toThrow('Failed to get session for user error-user');
    });
  });
});