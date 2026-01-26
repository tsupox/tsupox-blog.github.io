/**
 * Tests for image processor factory
 */

import { createImageProcessor } from './factory';
import { VercelBlobImageProcessor } from './vercel-blob-processor';
import { Config } from '../types';

// Mock S3ImageProcessor to avoid AWS SDK dependency in tests
jest.mock('./s3-processor', () => ({
  S3ImageProcessor: jest.fn().mockImplementation(() => ({
    uploadToTempStorage: jest.fn(),
    downloadFromTempStorage: jest.fn(),
    cleanupTempStorage: jest.fn(),
    processImage: jest.fn(),
  }))
}));

import { S3ImageProcessor } from './s3-processor';

describe('createImageProcessor', () => {
  it('should create VercelBlobImageProcessor for vercel-blob type', () => {
    const config: Config = {
      line: {
        channelSecret: 'test-secret',
        channelAccessToken: 'test-token',
      },
      github: {
        token: 'test-github-token',
        owner: 'test-owner',
        repo: 'test-repo',
      },
      blog: {
        baseUrl: 'https://test-blog.com',
        imageBasePath: '/images',
        categories: ['test'],
        availableTags: ['tag1', 'tag2'],
      },
      storage: {
        type: 'vercel-kv',
      },
      imageStorage: {
        type: 'vercel-blob',
      },
    };

    const processor = createImageProcessor(config);
    expect(processor).toBeInstanceOf(VercelBlobImageProcessor);
  });

  it('should create S3ImageProcessor for s3 type', () => {
    const config: Config = {
      line: {
        channelSecret: 'test-secret',
        channelAccessToken: 'test-token',
      },
      github: {
        token: 'test-github-token',
        owner: 'test-owner',
        repo: 'test-repo',
      },
      blog: {
        baseUrl: 'https://test-blog.com',
        imageBasePath: '/images',
        categories: ['test'],
        availableTags: ['tag1', 'tag2'],
      },
      storage: {
        type: 'dynamodb',
        tableName: 'test-table',
      },
      imageStorage: {
        type: 's3',
        bucketName: 'test-bucket',
        region: 'us-east-1',
      },
    };

    createImageProcessor(config);
    expect(S3ImageProcessor).toHaveBeenCalledWith('test-bucket', 'us-east-1');
  });

  it('should throw error for missing S3 bucket name', () => {
    const config: Config = {
      line: {
        channelSecret: 'test-secret',
        channelAccessToken: 'test-token',
      },
      github: {
        token: 'test-github-token',
        owner: 'test-owner',
        repo: 'test-repo',
      },
      blog: {
        baseUrl: 'https://test-blog.com',
        imageBasePath: '/images',
        categories: ['test'],
        availableTags: ['tag1', 'tag2'],
      },
      storage: {
        type: 'dynamodb',
        tableName: 'test-table',
      },
      imageStorage: {
        type: 's3',
        // bucketName is missing
        region: 'us-east-1',
      },
    };

    expect(() => createImageProcessor(config))
      .toThrow('S3 bucket name is required for S3 image storage');
  });

  it('should throw error for unsupported storage type', () => {
    const config: Config = {
      line: {
        channelSecret: 'test-secret',
        channelAccessToken: 'test-token',
      },
      github: {
        token: 'test-github-token',
        owner: 'test-owner',
        repo: 'test-repo',
      },
      blog: {
        baseUrl: 'https://test-blog.com',
        imageBasePath: '/images',
        categories: ['test'],
        availableTags: ['tag1', 'tag2'],
      },
      storage: {
        type: 'dynamodb',
        tableName: 'test-table',
      },
      imageStorage: {
        type: 'unsupported' as any,
      },
    };

    expect(() => createImageProcessor(config))
      .toThrow('Unsupported image storage type: unsupported');
  });
});