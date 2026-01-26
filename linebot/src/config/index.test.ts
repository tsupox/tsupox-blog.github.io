/**
 * Configuration tests
 */

import { loadConfig, validateConfig, getImageFolderOptions, generateImagePath } from './index';
import { Config } from '../types';

describe('Configuration', () => {
  describe('loadConfig', () => {
    it('should load configuration from environment variables', () => {
      const config = loadConfig();

      expect(config.line.channelSecret).toBe('test_channel_secret');
      expect(config.line.channelAccessToken).toBe('test_channel_access_token');
      expect(config.github.token).toBe('test_github_token');
      expect(config.github.owner).toBe('test_owner');
      expect(config.github.repo).toBe('test_repo');
      expect(config.blog.baseUrl).toBe('https://test-blog.com');
    });

    it('should throw error for missing required environment variables', () => {
      const originalEnv = process.env.LINE_CHANNEL_SECRET;
      delete process.env.LINE_CHANNEL_SECRET;

      expect(() => loadConfig()).toThrow('Missing required environment variables');

      process.env.LINE_CHANNEL_SECRET = originalEnv;
    });

    it('should set default values for optional configuration', () => {
      const config = loadConfig();

      expect(config.blog.imageBasePath).toBe('/images');
      expect(config.blog.categories).toContain('日記');
      expect(config.blog.availableTags).toContain('お絵かき');
    });
  });

  describe('validateConfig', () => {
    it('should validate valid configuration', () => {
      const validConfig: Config = {
        line: {
          channelSecret: 'secret',
          channelAccessToken: 'token',
        },
        github: {
          token: 'github_token',
          owner: 'owner',
          repo: 'repo',
        },
        blog: {
          baseUrl: 'https://example.com',
          imageBasePath: '/images',
          categories: ['日記'],
          availableTags: ['tag1'],
        },
        storage: {
          type: 'dynamodb',
          tableName: 'sessions',
        },
        imageStorage: {
          type: 's3',
          bucketName: 'images',
          region: 'us-east-1',
        },
      };

      expect(() => validateConfig(validConfig)).not.toThrow();
    });

    it('should throw error for invalid blog URL', () => {
      const invalidConfig: Config = {
        line: {
          channelSecret: 'secret',
          channelAccessToken: 'token',
        },
        github: {
          token: 'github_token',
          owner: 'owner',
          repo: 'repo',
        },
        blog: {
          baseUrl: 'invalid-url',
          imageBasePath: '/images',
          categories: ['日記'],
          availableTags: ['tag1'],
        },
        storage: {
          type: 'dynamodb',
          tableName: 'sessions',
        },
        imageStorage: {
          type: 's3',
          bucketName: 'images',
          region: 'us-east-1',
        },
      };

      expect(() => validateConfig(invalidConfig)).toThrow('Blog base URL must be a valid URL');
    });
  });

  describe('getImageFolderOptions', () => {
    it('should return current year folder options', () => {
      const options = getImageFolderOptions();
      const currentYear = new Date().getFullYear();

      expect(options).toContain(`${currentYear}-rakugaki`);
      expect(options).toContain(`${currentYear}-works`);
    });
  });

  describe('generateImagePath', () => {
    it('should generate correct image path', () => {
      const path = generateImagePath('2024-rakugaki', 'test.jpg');
      expect(path).toBe('/images/2024-rakugaki/test.jpg');
    });
  });
});