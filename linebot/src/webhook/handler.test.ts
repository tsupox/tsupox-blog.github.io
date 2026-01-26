/**
 * Unit tests for WebhookHandler
 */

import crypto from 'crypto';
import { WebhookHandler } from './handler';
import { APIGatewayEvent, Config } from '../types';

// Mock configuration
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

describe('WebhookHandler', () => {
  let handler: WebhookHandler;

  beforeEach(() => {
    handler = new WebhookHandler(mockConfig);
  });

  describe('validateSignature', () => {
    it('should validate correct signature', () => {
      const body = '{"test": "data"}';
      const signature = crypto
        .createHmac('sha256', mockConfig.line.channelSecret)
        .update(body, 'utf8')
        .digest('base64');

      expect(handler.validateSignature(body, signature)).toBe(true);
    });

    it('should reject incorrect signature', () => {
      const body = '{"test": "data"}';
      const wrongSignature = 'wrong-signature';

      expect(handler.validateSignature(body, wrongSignature)).toBe(false);
    });

    it('should handle signature validation errors gracefully', () => {
      const body = '{"test": "data"}';
      const invalidSignature = '';

      expect(handler.validateSignature(body, invalidSignature)).toBe(false);
    });
  });

  describe('parseLineEvents', () => {
    it('should parse valid LINE webhook payload', () => {
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
              text: 'Hello',
              id: 'test-message-id',
            },
          },
        ],
      };

      const events = handler.parseLineEvents(JSON.stringify(payload));

      expect(events).toHaveLength(1);
      expect(events[0]).toEqual({
        type: 'message',
        replyToken: 'test-reply-token',
        source: {
          userId: 'test-user-id',
          type: 'user',
        },
        message: {
          type: 'text',
          text: 'Hello',
          id: 'test-message-id',
        },
      });
    });

    it('should handle follow events', () => {
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

      const events = handler.parseLineEvents(JSON.stringify(payload));

      expect(events).toHaveLength(1);
      expect(events[0]).toEqual({
        type: 'follow',
        replyToken: 'test-reply-token',
        source: {
          userId: 'test-user-id',
          type: 'user',
        },
      });
    });

    it('should handle image messages', () => {
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

      const events = handler.parseLineEvents(JSON.stringify(payload));

      expect(events).toHaveLength(1);
      expect(events[0].message).toEqual({
        type: 'image',
        text: undefined,
        id: 'test-image-id',
      });
    });

    it('should throw error for invalid JSON', () => {
      const invalidJson = '{"invalid": json}';

      expect(() => handler.parseLineEvents(invalidJson)).toThrow('Invalid JSON in request body');
    });

    it('should throw error for missing events array', () => {
      const payload = { notEvents: [] };

      expect(() => handler.parseLineEvents(JSON.stringify(payload))).toThrow(
        'Invalid webhook payload: missing events array'
      );
    });

    it('should throw error for missing event type', () => {
      const payload = {
        events: [
          {
            replyToken: 'test-reply-token',
            source: {
              userId: 'test-user-id',
            },
          },
        ],
      };

      expect(() => handler.parseLineEvents(JSON.stringify(payload))).toThrow('Event type is required');
    });

    it('should throw error for missing source userId', () => {
      const payload = {
        events: [
          {
            type: 'message',
            replyToken: 'test-reply-token',
            source: {},
          },
        ],
      };

      expect(() => handler.parseLineEvents(JSON.stringify(payload))).toThrow('Event source userId is required');
    });
  });

  describe('handleRequest', () => {
    const createValidEvent = (body: string): APIGatewayEvent => {
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

    it('should handle valid webhook request', async () => {
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
              text: 'Hello',
              id: 'test-message-id',
            },
          },
        ],
      };

      const event = createValidEvent(JSON.stringify(payload));
      const response = await handler.handleRequest(event);

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body)).toEqual({ message: 'OK' });
    });

    it('should reject non-POST requests', async () => {
      const event: APIGatewayEvent = {
        httpMethod: 'GET',
        headers: {},
        body: '',
        path: '/webhook',
        queryStringParameters: null,
      };

      const response = await handler.handleRequest(event);

      expect(response.statusCode).toBe(405);
      expect(JSON.parse(response.body).error).toBe('Method not allowed');
    });

    it('should reject requests without content-type', async () => {
      const event: APIGatewayEvent = {
        httpMethod: 'POST',
        headers: {},
        body: '{}',
        path: '/webhook',
        queryStringParameters: null,
      };

      const response = await handler.handleRequest(event);

      expect(response.statusCode).toBe(400);
      expect(JSON.parse(response.body).error).toBe('Invalid content type');
    });

    it('should reject requests without body', async () => {
      const event: APIGatewayEvent = {
        httpMethod: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: '',
        path: '/webhook',
        queryStringParameters: null,
      };

      const response = await handler.handleRequest(event);

      expect(response.statusCode).toBe(400);
      expect(JSON.parse(response.body).error).toBe('Request body is required');
    });

    it('should reject requests without LINE signature', async () => {
      const event: APIGatewayEvent = {
        httpMethod: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: '{"events": []}',
        path: '/webhook',
        queryStringParameters: null,
      };

      const response = await handler.handleRequest(event);

      expect(response.statusCode).toBe(400);
      expect(JSON.parse(response.body).error).toBe('Missing LINE signature');
    });

    it('should reject requests with invalid signature', async () => {
      const event: APIGatewayEvent = {
        httpMethod: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-line-signature': 'invalid-signature',
        },
        body: '{"events": []}',
        path: '/webhook',
        queryStringParameters: null,
      };

      const response = await handler.handleRequest(event);

      expect(response.statusCode).toBe(401);
      expect(JSON.parse(response.body).error).toBe('Invalid signature');
    });

    it('should handle empty events array', async () => {
      const payload = { events: [] };
      const event = createValidEvent(JSON.stringify(payload));

      const response = await handler.handleRequest(event);

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body)).toEqual({ message: 'OK' });
    });
  });
});