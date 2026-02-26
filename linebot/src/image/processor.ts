/**
 * Image processing and validation module
 * Handles image download, validation, and temporary storage
 *
 * Note: Image resizing has been removed to avoid native dependencies in Lambda.
 * Images are uploaded as-is from LINE to GitHub.
 */

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
  size: number;
  format: string;
}

/**
 * Base image processor with common functionality
 */
export abstract class BaseImageProcessor implements ImageProcessor {
  protected readonly maxFileSize = 10 * 1024 * 1024; // 10MB
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
   * Validate image format and properties using basic checks
   */
  async validateImage(imageBuffer: Buffer): Promise<ImageValidationResult> {
    try {
      // Check file size
      const size = imageBuffer.length;
      if (size > this.maxFileSize) {
        throw new ValidationError(
          `Image file too large: ${size} bytes`,
          `画像ファイルが大きすぎます。最大${Math.round(this.maxFileSize / 1024 / 1024)}MBまでです。`
        );
      }

      // Detect image format from magic bytes
      const format = this.detectImageFormat(imageBuffer);

      if (!format) {
        throw new ValidationError(
          'Unable to detect image format',
          '画像の形式を読み取れませんでした。'
        );
      }

      const isValidFormat = this.supportedFormats.includes(format);
      if (!isValidFormat) {
        throw new ValidationError(
          `Unsupported image format: ${format}`,
          `サポートされていない画像形式です: ${format.toUpperCase()}`
        );
      }

      return {
        isValid: true,
        mimeType: `image/${format === 'jpg' ? 'jpeg' : format}`,
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
   * Detect image format from magic bytes (file signature)
   */
  private detectImageFormat(buffer: Buffer): string | null {
    // Check magic bytes for common image formats
    if (buffer.length < 4) {
      return null;
    }

    // JPEG: FF D8 FF
    if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
      return 'jpeg';
    }

    // PNG: 89 50 4E 47
    if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
      return 'png';
    }

    // GIF: 47 49 46 38
    if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x38) {
      return 'gif';
    }

    // WebP: 52 49 46 46 ... 57 45 42 50
    if (buffer.length >= 12 &&
        buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
        buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50) {
      return 'webp';
    }

    return null;
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
   * Process image: validate and prepare for storage
   * Note: Resizing has been removed to avoid native dependencies
   */
  async processImage(imageBuffer: Buffer): Promise<ProcessedImage> {
    try {
      // Validate image
      const validation = await this.validateImage(imageBuffer);

      // Generate filename and paths
      const filename = this.generateFilename(validation.format);
      const relativePath = this.generateImagePath(filename);

      // Upload to temporary storage
      const tempStorageKey = await this.uploadToTempStorage(imageBuffer, filename);

      return {
        buffer: imageBuffer,
        filename,
        relativePath,
        tempStorageKey,
        mimeType: validation.mimeType,
        size: validation.size
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