/**
 * Unit tests for LineApiClient
 */

import { LineApiClient } from './client';
import { Config } from '../types';

// Mock fetch globally
global.fetch = jest.fn();

const mockConfig: Config = {
  line: {
    channelSecret: 'test-channel-secret',
    channelAccessToken: 'test-access-token',
  },
  github: {
    token: 'test-github-token',
    owner: 'test-owner',
    repo: 'test-repo',
  },
  blog: {
    baseUrl: 'https://test-blog.com',
    imageBasePath: '/images',
    categories: ['日記', '2024年'],
    availableTags: ['テスト'],
  },
  storage: {
    type: 'dynamodb',
    tableName: 'test-table',
  },
  imageStorage: {
    type: 's3',
    bucketName: 'test-bucket',
    region: 'us-east-1',
  },
};

describe('LineApiClient', () => {
  let client: LineApiClient;
  let mockFetch: jest.MockedFunction<typeof fetch>;

  beforeEach(() => {
    client = new LineApiClient(mockConfig);
    mockFetch = fetch as jest.MockedFunction<typeof fetch>;
    mockFetch.mockClear();
  });

  describe('replyMessage', () => {
    it('should send reply message successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
      } as Response);

      const messages = [{ type: 'text' as const, text: 'Hello' }];
      await client.replyMessage('test-reply-token', messages);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.line.me/v2/bot/message/reply',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer test-access-token',
          },
          body: JSON.stringify({
            replyToken: 'test-reply-token',
            messages,
          }),
        }
      );
    });

    it('should throw error for empty reply token', async () => {
      const messages = [{ type: 'text' as const, text: 'Hello' }];

      await expect(client.replyMessage('', messages)).rejects.toThrow('Reply token is required');
    });

    it('should throw error for empty messages', async () => {
      await expect(client.replyMessage('test-reply-token', [])).rejects.toThrow(
        'At least one message is required'
      );
    });

    it('should throw error for too many messages', async () => {
      const messages = Array(6).fill({ type: 'text', text: 'Hello' });

      await expect(client.replyMessage('test-reply-token', messages)).rejects.toThrow(
        'Maximum 5 messages allowed per reply'
      );
    });

    it('should handle API error response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        text: async () => 'Invalid request',
      } as Response);

      const messages = [{ type: 'text' as const, text: 'Hello' }];

      await expect(client.replyMessage('test-reply-token', messages)).rejects.toThrow(
        'LINE API reply failed: 400 Bad Request'
      );
    });

    it('should handle network error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const messages = [{ type: 'text' as const, text: 'Hello' }];

      await expect(client.replyMessage('test-reply-token', messages)).rejects.toThrow(
        'Failed to send reply message: Network error'
      );
    });
  });

  describe('sendTextMessage', () => {
    it('should send text message successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
      } as Response);

      await client.sendTextMessage('test-reply-token', 'Hello World');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.line.me/v2/bot/message/reply',
        expect.objectContaining({
          body: JSON.stringify({
            replyToken: 'test-reply-token',
            messages: [{ type: 'text', text: 'Hello World' }],
          }),
        })
      );
    });

    it('should send text message with quick reply', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
      } as Response);

      const quickReply = {
        items: [
          {
            type: 'action' as const,
            action: {
              type: 'message' as const,
              label: 'Yes',
              text: 'Yes',
            },
          },
        ],
      };

      await client.sendTextMessage('test-reply-token', 'Hello World', quickReply);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.line.me/v2/bot/message/reply',
        expect.objectContaining({
          body: JSON.stringify({
            replyToken: 'test-reply-token',
            messages: [{ type: 'text', text: 'Hello World', quickReply }],
          }),
        })
      );
    });
  });

  describe('downloadImage', () => {
    it('should download image successfully', async () => {
      const mockImageData = 'fake-image-data';
      const mockArrayBuffer = new TextEncoder().encode(mockImageData).buffer;

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        arrayBuffer: async () => mockArrayBuffer,
      } as Response);

      const result = await client.downloadImage('test-message-id');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.line.me/v2/bot/message/test-message-id/content',
        {
          method: 'GET',
          headers: {
            'Authorization': 'Bearer test-access-token',
          },
        }
      );

      expect(result).toBeInstanceOf(Buffer);
      expect(result.toString()).toBe(mockImageData);
    });

    it('should throw error for empty message ID', async () => {
      await expect(client.downloadImage('')).rejects.toThrow('Message ID is required');
    });

    it('should handle download error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        text: async () => 'Message not found',
      } as Response);

      await expect(client.downloadImage('test-message-id')).rejects.toThrow(
        'LINE API download failed: 404 Not Found'
      );
    });
  });

  describe('getUserProfile', () => {
    it('should get user profile successfully', async () => {
      const mockProfile = {
        displayName: 'Test User',
        pictureUrl: 'https://example.com/picture.jpg',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockProfile,
      } as Response);

      const result = await client.getUserProfile('test-user-id');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.line.me/v2/bot/profile/test-user-id',
        {
          method: 'GET',
          headers: {
            'Authorization': 'Bearer test-access-token',
          },
        }
      );

      expect(result).toEqual(mockProfile);
    });

    it('should throw error for empty user ID', async () => {
      await expect(client.getUserProfile('')).rejects.toThrow('User ID is required');
    });
  });

  describe('createTagSelectionQuickReply', () => {
    it('should create quick reply for tag selection', () => {
      const tags = ['タグ1', 'タグ2', 'タグ3'];
      const quickReply = client.createTagSelectionQuickReply(tags);

      expect(quickReply.items).toHaveLength(4); // 3 tags + "新しいタグ"
      expect(quickReply.items[0]).toEqual({
        type: 'action',
        action: {
          type: 'message',
          label: 'タグ1',
          text: 'タグ1',
        },
      });
      expect(quickReply.items[3]).toEqual({
        type: 'action',
        action: {
          type: 'message',
          label: '新しいタグ',
          text: '新しいタグを作成',
        },
      });
    });

    it('should limit tags to maximum 12', () => {
      const tags = Array(20).fill(0).map((_, i) => `タグ${i + 1}`);
      const quickReply = client.createTagSelectionQuickReply(tags);

      expect(quickReply.items).toHaveLength(13); // 12 tags + "新しいタグ"
    });
  });

  describe('createConfirmationQuickReply', () => {
    it('should create confirmation quick reply', () => {
      const quickReply = client.createConfirmationQuickReply();

      expect(quickReply.items).toHaveLength(2);
      expect(quickReply.items[0].action.text).toBe('公開する');
      expect(quickReply.items[1].action.text).toBe('キャンセル');
    });
  });

  describe('createStartQuickReply', () => {
    it('should create start quick reply', () => {
      const quickReply = client.createStartQuickReply();

      expect(quickReply.items).toHaveLength(2);
      expect(quickReply.items[0].action.text).toBe('投稿作成');
      expect(quickReply.items[1].action.text).toBe('ヘルプ');
    });
  });
});