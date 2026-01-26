/**
 * Image processing and validation module
 * Handles image download, validation, resizing, and temporary storage
 */

import sharp from 'sharp';
import { ProcessedImage, ProcessingError, ValidationError } from '../types';

export interface ImageProcessor {
  downloadImage(messageId: string): Promise<Buffer>;
  uploadToTempStorage(imageBuffer: Buffer, filename: string): Promise<string>;
  downloadFromTempStorage(key: string): Promise<Buffer>;
  processImage(imageBuffer: Buffer): Promise<ProcessedImage>;
  generateImagePath(originalName?: string): string;
  cleanupTempStorage(key: string): Promise<void>;
}

export interface ImageValidationResult {
  isValid: boolean;
  mimeType: string;
  width: number;
  height: number;
  size: number;
  format: string;
}

/**
 * Base image processor with common functionality
 */
export abstract class BaseImageProcessor implements ImageProcessor {
  protected readonly maxFileSize = 10 * 1024 * 1024; // 10MB
  protected readonly maxWidth = 2048;
  protected readonly maxHeight = 2048;
  protected readonly supportedFormats = ['jpeg', 'jpg', 'png', 'webp', 'gif'];

  abstract uploadToTempStorage(imageBuffer: Buffer, filename: string): Promise<string>;
  abstract downloadFromTempStorage(key: string): Promise<Buffer>;
  abstract cleanupTempStorage(key: string): Promise<void>;

  /**
   * Download image from LINE API (delegated to LINE client)
   */
  async downloadImage(_messageId: string): Promise<Buffer> {
    // This will be called by LINE client, so we don't implement it here
    throw new Error('downloadImage should be called through LINE client');
  }

  /**
   * Validate image format and properties
   */
  async validateImage(imageBuffer: Buffer): Promise<ImageValidationResult> {
    try {
      const metadata = await sharp(imageBuffer).metadata();

      if (!metadata.format || !metadata.width || !metadata.height) {
        throw new ValidationError(
          'Invalid image metadata',
          '画像の形式を読み取れませんでした。'
        );
      }

      const format = metadata.format.toLowerCase();
      const isValidFormat = this.supportedFormats.includes(format);

      if (!isValidFormat) {
        throw new ValidationError(
          `Unsupported image format: ${format}`,
          `サポートされていない画像形式です: ${format.toUpperCase()}`
        );
      }

      const size = imageBuffer.length;
      if (size > this.maxFileSize) {
        throw new ValidationError(
          `Image file too large: ${size} bytes`,
          `画像ファイルが大きすぎます。最大${Math.round(this.maxFileSize / 1024 / 1024)}MBまでです。`
        );
      }

      return {
        isValid: true,
        mimeType: `image/${format === 'jpg' ? 'jpeg' : format}`,
        width: metadata.width,
        height: metadata.height,
        size,
        format
      };
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }

      console.error('Image validation error:', error);
      throw new ValidationError(
        `Image validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        '画像の検証に失敗しました。'
      );
    }
  }

  /**
   * Resize image if it exceeds maximum dimensions
   */
  async resizeImageIfNeeded(imageBuffer: Buffer, validation: ImageValidationResult): Promise<Buffer> {
    if (validation.width <= this.maxWidth && validation.height <= this.maxHeight) {
      return imageBuffer;
    }

    try {
      console.log(`Resizing image from ${validation.width}x${validation.height} to fit ${this.maxWidth}x${this.maxHeight}`);

      const resizedBuffer = await sharp(imageBuffer)
        .resize(this.maxWidth, this.maxHeight, {
          fit: 'inside',
          withoutEnlargement: true
        })
        .jpeg({ quality: 85 }) // Convert to JPEG for better compression
        .toBuffer();

      console.log(`Image resized: ${imageBuffer.length} -> ${resizedBuffer.length} bytes`);
      return resizedBuffer;
    } catch (error) {
      console.error('Image resize error:', error);
      throw new ProcessingError(
        `Image resize failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        '画像のリサイズに失敗しました。'
      );
    }
  }

  /**
   * Generate unique filename for image
   */
  generateFilename(originalFormat?: string): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const randomSuffix = Math.random().toString(36).substring(2, 8);
    const extension = originalFormat === 'jpg' ? 'jpeg' : (originalFormat || 'jpeg');

    return `${timestamp}-${randomSuffix}.${extension}`;
  }

  /**
   * Generate image path for GitHub repository
   */
  generateImagePath(originalName?: string): string {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const filename = originalName || this.generateFilename();

    return `source/images/${year}/${month}/${filename}`;
  }

  /**
   * Process image: validate, resize if needed, and prepare for storage
   */
  async processImage(imageBuffer: Buffer): Promise<ProcessedImage> {
    try {
      // Validate image
      const validation = await this.validateImage(imageBuffer);

      // Resize if needed
      const processedBuffer = await this.resizeImageIfNeeded(imageBuffer, validation);

      // Generate filename and paths
      const filename = this.generateFilename(validation.format);
      const relativePath = this.generateImagePath(filename);

      // Upload to temporary storage
      const tempStorageKey = await this.uploadToTempStorage(processedBuffer, filename);

      // Update validation info if image was resized
      const finalValidation = processedBuffer !== imageBuffer
        ? await this.validateImage(processedBuffer)
        : validation;

      return {
        buffer: processedBuffer,
        filename,
        relativePath,
        tempStorageKey,
        mimeType: finalValidation.mimeType,
        size: finalValidation.size
      };
    } catch (error) {
      if (error instanceof ValidationError || error instanceof ProcessingError) {
        throw error;
      }

      console.error('Image processing error:', error);
      throw new ProcessingError(
        `Image processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        '画像の処理に失敗しました。'
      );
    }
  }
}