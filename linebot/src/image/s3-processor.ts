/**
 * AWS S3 implementation for image processing
 * Note: This requires AWS SDK to be installed separately
 */

import { BaseImageProcessor } from './processor';
import { ProcessingError } from '../types';

export class S3ImageProcessor extends BaseImageProcessor {
  private s3Client?: any; // Use any to avoid AWS SDK dependency
  private bucketName: string;
  private region: string;

  constructor(bucketName: string, region: string = 'us-east-1') {
    super();
    this.bucketName = bucketName;
    this.region = region;
  }

  /**
   * Initialize S3 client (lazy loading)
   */
  private async getS3Client(): Promise<any> {
    if (this.s3Client) {
      return this.s3Client;
    }

    try {
      // Dynamic import to avoid requiring AWS SDK if not used
      // Use type assertion to bypass TypeScript checking
      const awsModule = await (import('@aws-sdk/client-s3') as any);
      const { S3Client } = awsModule;

      this.s3Client = new S3Client({
        region: this.region,
        // Credentials will be loaded from environment or IAM role
      });

      return this.s3Client;
    } catch (error) {
      throw new ProcessingError(
        'AWS SDK not available. Install @aws-sdk/client-s3 to use S3 storage.',
        'S3ストレージが利用できません。'
      );
    }
  }

  /**
   * Upload image to S3 with lifecycle policy for automatic cleanup
   */
  async uploadToTempStorage(imageBuffer: Buffer, filename: string): Promise<string> {
    try {
      const s3Client = await this.getS3Client();
      const awsModule = await (import('@aws-sdk/client-s3') as any);
      const { PutObjectCommand } = awsModule;

      const key = `temp-images/${Date.now()}-${filename}`;

      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: imageBuffer,
        ContentType: this.getMimeType(filename),
        // Tags for lifecycle policy (24h expiration)
        Tagging: 'temporary=true&expires=24h',
      });

      await s3Client.send(command);

      console.log(`Uploaded image to S3: s3://${this.bucketName}/${key}`);
      return key;
    } catch (error) {
      console.error('S3 upload error:', error);
      throw new ProcessingError(
        `Failed to upload image to S3: ${error instanceof Error ? error.message : 'Unknown error'}`,
        '画像の一時保存に失敗しました。'
      );
    }
  }

  /**
   * Download image from S3
   */
  async downloadFromTempStorage(key: string): Promise<Buffer> {
    try {
      const s3Client = await this.getS3Client();
      const awsModule = await (import('@aws-sdk/client-s3') as any);
      const { GetObjectCommand } = awsModule;

      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      const response = await s3Client.send(command);

      if (!response.Body) {
        throw new ProcessingError(
          'Empty response from S3',
          '一時保存された画像の取得に失敗しました。'
        );
      }

      // Convert stream to buffer
      const chunks: Uint8Array[] = [];
      const reader = response.Body.getReader();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }

      return Buffer.concat(chunks);
    } catch (error) {
      if (error instanceof ProcessingError) {
        throw error;
      }

      console.error('S3 download error:', error);
      throw new ProcessingError(
        `Failed to download from S3: ${error instanceof Error ? error.message : 'Unknown error'}`,
        '一時保存された画像の取得に失敗しました。'
      );
    }
  }

  /**
   * Clean up temporary image from S3
   */
  async cleanupTempStorage(key: string): Promise<void> {
    try {
      const s3Client = await this.getS3Client();
      const awsModule = await (import('@aws-sdk/client-s3') as any);
      const { DeleteObjectCommand } = awsModule;

      const command = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      await s3Client.send(command);
      console.log(`Cleaned up temporary image: s3://${this.bucketName}/${key}`);
    } catch (error) {
      // Log error but don't throw - cleanup failures shouldn't break the flow
      console.warn('Failed to cleanup temporary image:', error);
    }
  }

  /**
   * Check if image exists in S3
   */
  async imageExists(key: string): Promise<boolean> {
    try {
      const s3Client = await this.getS3Client();
      const awsModule = await (import('@aws-sdk/client-s3') as any);
      const { HeadObjectCommand } = awsModule;

      const command = new HeadObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      await s3Client.send(command);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get MIME type from filename
   */
  private getMimeType(filename: string): string {
    const extension = filename.split('.').pop()?.toLowerCase();

    switch (extension) {
      case 'jpg':
      case 'jpeg':
        return 'image/jpeg';
      case 'png':
        return 'image/png';
      case 'webp':
        return 'image/webp';
      case 'gif':
        return 'image/gif';
      default:
        return 'application/octet-stream';
    }
  }
}