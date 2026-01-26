/**
 * Integration tests for LINE Bot components
 */

import crypto from 'crypto';
import { WebhookHandler } from './webhook/handler';
import { LineApiClient } from './line/client';
import { APIGatewayEvent, Config } from './types';

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

describe('Integration Tests', () => {
  let webhookHandler: WebhookHandler;
  let lineClient: LineApiClient;
  let mockFetch: jest.MockedFunction<typeof fetch>;

  beforeEach(() => {
    webhookHandler = new WebhookHandler(mockConfig);
    lineClient = new LineApiClient(mockConfig);
    mockFetch = fetch as jest.MockedFunction<typeof fetch>;
    mockFetch.mockClear();
  });

  describe('Webhook Handler + LINE API Client', () => {
    const createValidWebhookEvent = (payload: any): APIGatewayEvent => {
      const body = JSON.stringify(payload);
      const signature = crypto
        .createHmac('sha256', mockConfig.line.channelSecret)
        .update(body, 'utf8')
        .digest('base64');

      return {
        httpMethod: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-line-signature': signature,
        },
        body,
        path: '/webhook',
        queryStringParameters: null,
      };
    };

    it('should handle text message webhook successfully', async () => {
      const payload = {
        events: [
          {
            type: 'message',
            replyToken: 'test-reply-token',
            source: {
              userId: 'test-user-id',
              type: 'user',
            },
            message: {
              type: 'text',
              text: 'Hello Bot',
              id: 'test-message-id',
            },
          },
        ],
      };

      const event = createValidWebhookEvent(payload);
      const response = await webhookHandler.handleRequest(event);

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body)).toEqual({ message: 'OK' });
    });

    it('should handle image message webhook successfully', async () => {
      const payload = {
        events: [
          {
            type: 'message',
            replyToken: 'test-reply-token',
            source: {
              userId: 'test-user-id',
              type: 'user',
            },
            message: {
              type: 'image',
              id: 'test-image-id',
            },
          },
        ],
      };

      const event = createValidWebhookEvent(payload);
      const response = await webhookHandler.handleRequest(event);

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body)).toEqual({ message: 'OK' });
    });

    it('should handle follow event webhook successfully', async () => {
      const payload = {
        events: [
          {
            type: 'follow',
            replyToken: 'test-reply-token',
            source: {
              userId: 'test-user-id',
              type: 'user',
            },
          },
        ],
      };

      const event = createValidWebhookEvent(payload);
      const response = await webhookHandler.handleRequest(event);

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body)).toEqual({ message: 'OK' });
    });

    it('should handle multiple events in single webhook', async () => {
      const payload = {
        events: [
          {
            type: 'message',
            replyToken: 'test-reply-token-1',
            source: {
              userId: 'test-user-id-1',
              type: 'user',
            },
            message: {
              type: 'text',
              text: 'First message',
              id: 'test-message-id-1',
            },
          },
          {
            type: 'follow',
            replyToken: 'test-reply-token-2',
            source: {
              userId: 'test-user-id-2',
              type: 'user',
            },
          },
        ],
      };

      const event = createValidWebhookEvent(payload);
      const response = await webhookHandler.handleRequest(event);

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body)).toEqual({ message: 'OK' });
    });

    it('should reject webhook with invalid signature', async () => {
      const payload = {
        events: [
          {
            type: 'message',
            replyToken: 'test-reply-token',
            source: {
              userId: 'test-user-id',
              type: 'user',
            },
            message: {
              type: 'text',
              text: 'Hello Bot',
              id: 'test-message-id',
            },
          },
        ],
      };

      const event: APIGatewayEvent = {
        httpMethod: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-line-signature': 'invalid-signature',
        },
        body: JSON.stringify(payload),
        path: '/webhook',
        queryStringParameters: null,
      };

      const response = await webhookHandler.handleRequest(event);

      expect(response.statusCode).toBe(401);
      expect(JSON.parse(response.body).error).toBe('Invalid signature');
    });
  });

  describe('LINE API Client Integration', () => {
    it('should create proper quick reply structures', () => {
      const tags = ['タグ1', 'タグ2', 'タグ3'];
      const tagQuickReply = lineClient.createTagSelectionQuickReply(tags);

      expect(tagQuickReply.items).toHaveLength(4); // 3 tags + "新しいタグ"
      expect(tagQuickReply.items[0].action.text).toBe('タグ1');
      expect(tagQuickReply.items[3].action.text).toBe('新しいタグを作成');

      const confirmQuickReply = lineClient.createConfirmationQuickReply();
      expect(confirmQuickReply.items).toHaveLength(2);
      expect(confirmQuickReply.items[0].action.text).toBe('公開する');
      expect(confirmQuickReply.items[1].action.text).toBe('キャンセル');

      const startQuickReply = lineClient.createStartQuickReply();
      expect(startQuickReply.items).toHaveLength(2);
      expect(startQuickReply.items[0].action.text).toBe('投稿作成');
      expect(startQuickReply.items[1].action.text).toBe('ヘルプ');
    });
  });
});