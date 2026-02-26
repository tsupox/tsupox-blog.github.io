/**
 * Unit tests for session storage factory
 */

import { createSessionStorage } from './factory';
import { DynamoDBSessionStorage } from './dynamodb-storage';
import { Config } from '../types';

describe('createSessionStorage', () => {
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

    it('should use AWS_REGION from environment', () => {
      const originalRegion = process.env.AWS_REGION;
      process.env.AWS_REGION = 'ap-northeast-1';

      try {
        const config: Config = {
          storage: {
            type: 'dynamodb',
            tableName: 'linebot-sessions'
          }
        } as Config;

        const storage = createSessionStorage(config);

        expect(storage).toBeInstanceOf(DynamoDBSessionStorage);
      } finally {
        if (originalRegion !== undefined) {
          process.env.AWS_REGION = originalRegion;
        } else {
          delete process.env.AWS_REGION;
        }
      }
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