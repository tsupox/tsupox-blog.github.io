/**
 * AWS Lambda handler for LINE Bot
 * Supports both API Gateway v1 and v2 event formats
 */

import { getConfig } from './config';
import { WebhookHandler } from './webhook/handler';
import { APIGatewayEvent } from './types';

// API Gateway v2 event type
interface APIGatewayV2Event {
  version?: string;
  routeKey?: string;
  rawPath?: string;
  rawQueryString?: string;
  headers: Record<string, string>;
  requestContext?: {
    http?: {
      method: string;
      path: string;
    };
  };
  body?: string;
  isBase64Encoded?: boolean;
}

// API Gateway v1 event type
interface APIGatewayV1Event {
  httpMethod: string;
  path: string;
  headers: Record<string, string>;
  body?: string;
  queryStringParameters?: Record<string, string> | null;
}

type LambdaEvent = APIGatewayV1Event | APIGatewayV2Event;

interface LambdaResponse {
  statusCode: number;
  headers?: Record<string, string>;
  body: string;
}

// Initialize components (reused across Lambda invocations)
let webhookHandler: WebhookHandler | null = null;

function initializeHandler(): WebhookHandler {
  if (webhookHandler) {
    return webhookHandler;
  }

  const config = getConfig();
  webhookHandler = new WebhookHandler(config);

  return webhookHandler;
}

/**
 * Check if event is API Gateway v2 format
 */
function isV2Event(event: LambdaEvent): event is APIGatewayV2Event {
  return 'version' in event && event.version === '2.0';
}

/**
 * Normalize event to common format
 */
function normalizeEvent(event: LambdaEvent): { method: string; path: string; headers: Record<string, string>; body: string } {
  if (isV2Event(event)) {
    // API Gateway v2 format
    return {
      method: event.requestContext?.http?.method || 'GET',
      path: event.rawPath || '/',
      headers: event.headers,
      body: event.body || '',
    };
  } else {
    // API Gateway v1 format
    return {
      method: event.httpMethod,
      path: event.path,
      headers: event.headers,
      body: event.body || '',
    };
  }
}

/**
 * Lambda handler function
 */
export async function handler(event: LambdaEvent): Promise<LambdaResponse> {
  const normalized = normalizeEvent(event);

  console.log('Lambda invoked:', {
    path: normalized.path,
    method: normalized.method,
    headers: normalized.headers,
  });

  // Health check endpoint
  if (normalized.path === '/health' && normalized.method === 'GET') {
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        status: 'ok',
        timestamp: new Date().toISOString(),
        message: 'LINE Bot Blog Publisher is running',
      }),
    };
  }

  // Webhook endpoint
  if (normalized.path === '/webhook' && normalized.method === 'POST') {
    try {
      const handler = initializeHandler();

      // Convert to APIGatewayEvent
      const apiGatewayEvent: APIGatewayEvent = {
        httpMethod: normalized.method,
        headers: normalized.headers,
        body: normalized.body,
        path: normalized.path,
        queryStringParameters: null,
      };

      // Handle webhook
      const response = await handler.handleRequest(apiGatewayEvent);

      return {
        statusCode: response.statusCode,
        headers: response.headers,
        body: response.body,
      };
    } catch (error) {
      console.error('Webhook handling error:', error);
      return {
        statusCode: 500,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          error: 'Internal server error',
          message: error instanceof Error ? error.message : 'Unknown error',
        }),
      };
    }
  }

  // Unknown endpoint
  return {
    statusCode: 404,
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      error: 'Not found',
      path: normalized.path,
      method: normalized.method,
    }),
  };
}
