/**
 * Main entry point for LINE Bot Blog Publisher
 */

import { APIGatewayEvent, APIGatewayResponse, VercelRequest, VercelResponse } from './types';
import { getConfig } from './config';
import { WebhookHandler } from './webhook/handler';

// Initialize configuration and webhook handler
const config = getConfig();
const webhookHandler = new WebhookHandler(config);

/**
 * AWS Lambda handler
 */
export async function lambdaHandler(event: APIGatewayEvent): Promise<APIGatewayResponse> {
  try {
    console.log('Received Lambda event:', JSON.stringify(event, null, 2));

    return await webhookHandler.handleRequest(event);
  } catch (error) {
    console.error('Lambda handler error:', error);

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

/**
 * Vercel Function handler
 */
export default async function vercelHandler(req: VercelRequest, res: VercelResponse): Promise<void> {
  try {
    console.log('Received Vercel request:', {
      method: req.method,
      url: req.url,
      headers: req.headers,
    });

    // Convert Vercel request to Lambda-compatible format
    const event: APIGatewayEvent = {
      body: req.body,
      headers: req.headers,
      httpMethod: req.method,
      path: req.url,
      queryStringParameters: req.query,
    };

    const response = await webhookHandler.handleRequest(event);

    // Convert Lambda response to Vercel response
    res.status(response.statusCode);

    if (response.headers) {
      Object.entries(response.headers).forEach(([key, value]) => {
        res.setHeader(key, String(value));
      });
    }

    res.send(response.body);
  } catch (error) {
    console.error('Vercel handler error:', error);

    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Health check endpoint
 */
export async function healthCheck(): Promise<{ status: string; timestamp: string }> {
  return {
    status: 'healthy',
    timestamp: new Date().toISOString(),
  };
}

/**
 * Graceful error handling for unhandled promises
 */
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});