/**
 * Factory for creating session storage instances
 */

import { Config } from '../types';
import { SessionStorage } from './storage';
import { VercelKVSessionStorage } from './vercel-kv-storage';
import { DynamoDBSessionStorage } from './dynamodb-storage';

/**
 * Create session storage instance based on configuration
 */
export function createSessionStorage(config: Config): SessionStorage {
  switch (config.storage.type) {
    case 'vercel-kv':
      if (!config.storage.kvUrl && !process.env.KV_URL) {
        throw new Error('KV_URL is required for Vercel KV storage');
      }
      return new VercelKVSessionStorage(config.storage.kvUrl);

    case 'dynamodb':
      if (!config.storage.tableName) {
        throw new Error('Table name is required for DynamoDB storage');
      }
      return new DynamoDBSessionStorage(config.storage.tableName);

    default:
      throw new Error(`Unsupported storage type: ${config.storage.type}`);
  }
}