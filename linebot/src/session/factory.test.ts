/**
 * Unit tests for session storage factory
 */

import { createSessionStorage } from './factory';
import { VercelKVSessionStorage } from './vercel-kv-storage';
import { DynamoDBSessionStorage } from './dynamodb-storage';
import { Config } from '../types';

describe('createSessionStorage', () => {
  describe('Vercel KV configuration', () => {
    it('should create VercelKVSessionStorage when type is vercel-kv', () => {
      const config: Config = {
        storage: {
          type: 'vercel-kv',
          kvUrl: 'redis://localhost:6379'
        }
      } as Config;

      const storage = createSessionStorage(config);

      expect(storage).toBeInstanceOf(VercelKVSessionStorage);
    });

    it('should create VercelKVSessionStorage with environment variable', () => {
      const originalEnv = process.env.KV_URL;
      process.env.KV_URL = 'redis://localhost:6379';

      try {
        const config: Config = {
          storage: {
            type: 'vercel-kv'
          }
        } as Config;

        const storage = createSessionStorage(config);

        expect(storage).toBeInstanceOf(VercelKVSessionStorage);
      } finally {
        if (originalEnv !== undefined) {
          process.env.KV_URL = originalEnv;
        } else {
          delete process.env.KV_URL;
        }
      }
    });

    it('should throw error when KV_URL is missing', () => {
      const originalEnv = process.env.KV_URL;
      delete process.env.KV_URL;

      try {
        const config: Config = {
          storage: {
            type: 'vercel-kv'
          }
        } as Config;

        expect(() => createSessionStorage(config)).toThrow('KV_URL is required for Vercel KV storage');
      } finally {
        if (originalEnv !== undefined) {
          process.env.KV_URL = originalEnv;
        }
      }
    });
  });

  describe('DynamoDB configuration', () => {
    it('should create DynamoDBSessionStorage when type is dynamodb', () => {
      const config: Config = {
        storage: {
          type: 'dynamodb',
          tableName: 'linebot-sessions'
        }
      } as Config;

      const storage = createSessionStorage(config);

      expect(storage).toBeInstanceOf(DynamoDBSessionStorage);
    });

    it('should throw error when table name is missing', () => {
      const config: Config = {
        storage: {
          type: 'dynamodb'
        }
      } as Config;

      expect(() => createSessionStorage(config)).toThrow('Table name is required for DynamoDB storage');
    });
  });

  describe('Invalid configuration', () => {
    it('should throw error for unsupported storage type', () => {
      const config: Config = {
        storage: {
          type: 'invalid-type' as any
        }
      } as Config;

      expect(() => createSessionStorage(config)).toThrow('Unsupported storage type: invalid-type');
    });
  });
});