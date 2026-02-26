/**
 * Factory for creating image processors based on configuration
 */

import { Config } from '../types';
import { ImageProcessor } from './processor';
import { S3ImageProcessor } from './s3-processor';

export function createImageProcessor(config: Config): ImageProcessor {
  if (config.imageStorage.type !== 's3') {
    throw new Error(`Unsupported image storage type: ${config.imageStorage.type}`);
  }

  if (!config.imageStorage.bucketName) {
    throw new Error('S3 bucket name is required for S3 image storage');
  }

  // Use APP_AWS_REGION environment variable (set by CloudFormation)
  const region = process.env.APP_AWS_REGION || process.env.AWS_REGION || config.imageStorage.region || 'ap-northeast-1';

  return new S3ImageProcessor(
    config.imageStorage.bucketName,
    region
  );
}