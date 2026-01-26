/**
 * Factory for creating image processors based on configuration
 */

import { Config } from '../types';
import { ImageProcessor } from './processor';
import { VercelBlobImageProcessor } from './vercel-blob-processor';
import { S3ImageProcessor } from './s3-processor';

export function createImageProcessor(config: Config): ImageProcessor {
  switch (config.imageStorage.type) {
    case 'vercel-blob':
      return new VercelBlobImageProcessor();

    case 's3':
      if (!config.imageStorage.bucketName) {
        throw new Error('S3 bucket name is required for S3 image storage');
      }
      return new S3ImageProcessor(
        config.imageStorage.bucketName,
        config.imageStorage.region
      );

    default:
      throw new Error(`Unsupported image storage type: ${config.imageStorage.type}`);
  }
}