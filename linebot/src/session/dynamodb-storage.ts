/**
 * DynamoDB implementation of session storage
 */

import { ConversationState } from '../types';
import { SessionStorage } from './storage';

// Note: AWS SDK imports would be added here when implementing for AWS
// For now, this is a placeholder implementation that throws errors
// to indicate DynamoDB is not configured in this environment

export class DynamoDBSessionStorage implements SessionStorage {
  constructor(tableName: string) {
    console.warn(`DynamoDB storage is not implemented in this version. Table: ${tableName}. Use Vercel KV instead.`);
  }

  async get(_userId: string): Promise<ConversationState | null> {
    throw new Error('DynamoDB storage is not implemented. Please use Vercel KV storage.');
  }

  async set(_userId: string, _state: ConversationState): Promise<void> {
    throw new Error('DynamoDB storage is not implemented. Please use Vercel KV storage.');
  }

  async resetToIdle(_userId: string): Promise<void> {
    throw new Error('DynamoDB storage is not implemented. Please use Vercel KV storage.');
  }

  async delete(_userId: string): Promise<void> {
    throw new Error('DynamoDB storage is not implemented. Please use Vercel KV storage.');
  }

  async cleanup(): Promise<void> {
    throw new Error('DynamoDB storage is not implemented. Please use Vercel KV storage.');
  }
}

// TODO: Implement full DynamoDB support when needed
// This would include:
// - AWS SDK v3 DynamoDB client
// - Table creation/validation
// - TTL configuration
// - Proper error handling
// - Batch operations for cleanup