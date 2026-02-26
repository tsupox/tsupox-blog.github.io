/**
 * Main entry point for LINE Bot Blog Publisher
 */

import { APIGatewayEvent, APIGatewayResponse } from './types';
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