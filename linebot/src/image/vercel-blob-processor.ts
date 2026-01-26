/**
 * Vercel Blob Storage implementation for image processing
 */

import { put, del, head } from '@vercel/blob';
import { BaseImageProcessor } from './processor';
import { ProcessingError } from '../types';

export class VercelBlobImageProcessor extends BaseImageProcessor {
  /**
   * Upload image to Vercel Blob storage with TTL
   */
  async uploadToTempStorage(imageBuffer: Buffer, filename: string): Promise<string> {
    try {
      const blob = await put(`temp-images/${filename}`, imageBuffer, {
        access: 'public',
        // Vercel Blob doesn't support TTL directly, but we can implement cleanup
        addRandomSuffix: false,
      });

      console.log(`Uploaded image to Vercel Blob: ${blob.url}`);
      return blob.url;
    } catch (error) {
      console.error('Vercel Blob upload error:', error);
      throw new ProcessingError(
        `Failed to upload image to Vercel Blob: ${error instanceof Error ? error.message : 'Unknown error'}`,
        '画像の一時保存に失敗しました。'
      );
    }
  }

  /**
   * Download image from Vercel Blob storage
   */
  async downloadFromTempStorage(url: string): Promise<Buffer> {
    try {
      const response = await fetch(url);

      if (!response.ok) {
        throw new ProcessingError(
          `Failed to download from Vercel Blob: ${response.status} ${response.statusText}`,
          '一時保存された画像の取得に失敗しました。'
        );
      }

      const arrayBuffer = await response.arrayBuffer();
      return Buffer.from(arrayBuffer);
    } catch (error) {
      if (error instanceof ProcessingError) {
        throw error;
      }

      console.error('Vercel Blob download error:', error);
      throw new ProcessingError(
        `Failed to download from Vercel Blob: ${error instanceof Error ? error.message : 'Unknown error'}`,
        '一時保存された画像の取得に失敗しました。'
      );
    }
  }

  /**
   * Clean up temporary image from Vercel Blob storage
   */
  async cleanupTempStorage(url: string): Promise<void> {
    try {
      await del(url);
      console.log(`Cleaned up temporary image: ${url}`);
    } catch (error) {
      // Log error but don't throw - cleanup failures shouldn't break the flow
      console.warn('Failed to cleanup temporary image:', error);
    }
  }

  /**
   * Check if image exists in Vercel Blob storage
   */
  async imageExists(url: string): Promise<boolean> {
    try {
      await head(url);
      return true;
    } catch (error) {
      return false;
    }
  }
}