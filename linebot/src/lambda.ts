/**
 * AWS Lambda handler for LINE Bot
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getConfig } from './config';
import { WebhookHandler } from './webhook/handler';
import { APIGatewayEvent } from './types';

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
 * Lambda handler function
 */
export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  console.log('Lambda invoked:', {
    path: event.path,
    method: event.httpMethod,
    headers: event.headers,
  });

  // Health check endpoint
  if (event.path === '/health' && event.httpMethod === 'GET') {
    return {
      statusCode: 200,
      body: JSON.stringify({
        status: 'ok',
        timestamp: new Date().toISOString(),
      }),
    };
  }

  // Webhook endpoint
  if (event.path === '/webhook' && event.httpMethod === 'POST') {
    try {
      const handler = initializeHandler();
      
      // Convert APIGatewayProxyEvent to APIGatewayEvent
      const apiGatewayEvent: APIGatewayEvent = {
        httpMethod: event.httpMethod,
        headers: event.headers as Record<string, string>,
        body: event.body || '',
        path: event.path,
        queryStringParameters: event.queryStringParameters as Record<string, string> | null,
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
    body: JSON.stringify({ error: 'Not found' }),
  };
}
