/**
 * Factory for creating session storage instances
 */

import { Config } from '../types';
import { SessionStorage } from './storage';
import { DynamoDBSessionStorage } from './dynamodb-storage';

/**
 * Create session storage instance based on configuration
 */
export function createSessionStorage(config: Config): SessionStorage {
  if (config.storage.type !== 'dynamodb') {
    throw new Error(`Unsupported storage type: ${config.storage.type}`);
  }

  if (!config.storage.tableName) {
    throw new Error('Table name is required for DynamoDB storage');
  }

  // Use APP_AWS_REGION environment variable (set by CloudFormation)
  const region = process.env.APP_AWS_REGION || process.env.AWS_REGION || 'ap-northeast-1';

  return new DynamoDBSessionStorage(
    config.storage.tableName,
    region
  );
}