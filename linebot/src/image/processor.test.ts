/**
 * Tests for image processing functionality
 */

import { BaseImageProcessor, ImageValidationResult } from './processor';
import { ValidationError } from '../types';
import sharp from 'sharp';

// Mock implementation for testing
class TestImageProcessor extends BaseImageProcessor {
  private tempStorage = new Map<string, Buffer>();

  async uploadToTempStorage(imageBuffer: Buffer, filename: string): Promise<string> {
    const key = `test-${Date.now()}-${filename}`;
    this.tempStorage.set(key, imageBuffer);
    return key;
  }

  async downloadFromTempStorage(key: string): Promise<Buffer> {
    const buffer = this.tempStorage.get(key);
    if (!buffer) {
      throw new Error(`Image not found: ${key}`);
    }
    return buffer;
  }

  async cleanupTempStorage(key: string): Promise<void> {
    this.tempStorage.delete(key);
  }

  // Expose protected methods for testing
  public async testValidateImage(imageBuffer: Buffer): Promise<ImageValidationResult> {
    return this.validateImage(imageBuffer);
  }

  public async testResizeImageIfNeeded(imageBuffer: Buffer, validation: ImageValidationResult): Promise<Buffer> {
    return this.resizeImageIfNeeded(imageBuffer, validation);
  }

  public testGenerateFilename(originalFormat?: string): string {
    return this.generateFilename(originalFormat);
  }
}

describe('BaseImageProcessor', () => {
  let processor: TestImageProcessor;

  beforeEach(() => {
    processor = new TestImageProcessor();
  });

  describe('validateImage', () => {
    it('should validate a valid JPEG image', async () => {
      // Create a small test image
      const imageBuffer = await sharp({
        create: {
          width: 100,
          height: 100,
          channels: 3,
          background: { r: 255, g: 0, b: 0 }
        }
      })
      .jpeg()
      .toBuffer();

      const result = await processor.testValidateImage(imageBuffer);

      expect(result.isValid).toBe(true);
      expect(result.mimeType).toBe('image/jpeg');
      expect(result.width).toBe(100);
      expect(result.height).toBe(100);
      expect(result.format).toBe('jpeg');
      expect(result.size).toBeGreaterThan(0);
    });

    it('should validate a valid PNG image', async () => {
      const imageBuffer = await sharp({
        create: {
          width: 200,
          height: 150,
          channels: 4,
          background: { r: 0, g: 255, b: 0, alpha: 1 }
        }
      })
      .png()
      .toBuffer();

      const result = await processor.testValidateImage(imageBuffer);

      expect(result.isValid).toBe(true);
      expect(result.mimeType).toBe('image/png');
      expect(result.width).toBe(200);
      expect(result.height).toBe(150);
      expect(result.format).toBe('png');
    });

    it('should reject invalid image data', async () => {
      const invalidBuffer = Buffer.from('not an image');

      await expect(processor.testValidateImage(invalidBuffer))
        .rejects.toThrow(ValidationError);
    });

    it('should reject oversized images', async () => {
      // Mock a large image by creating a buffer larger than maxFileSize
      const largeBuffer = Buffer.alloc(11 * 1024 * 1024); // 11MB

      await expect(processor.testValidateImage(largeBuffer))
        .rejects.toThrow(ValidationError);
    });
  });

  describe('resizeImageIfNeeded', () => {
    it('should not resize image within limits', async () => {
      const imageBuffer = await sharp({
        create: {
          width: 500,
          height: 400,
          channels: 3,
          background: { r: 255, g: 255, b: 255 }
        }
      })
      .jpeg()
      .toBuffer();

      const validation: ImageValidationResult = {
        isValid: true,
        mimeType: 'image/jpeg',
        width: 500,
        height: 400,
        size: imageBuffer.length,
        format: 'jpeg'
      };

      const result = await processor.testResizeImageIfNeeded(imageBuffer, validation);
      expect(result).toBe(imageBuffer); // Should return the same buffer
    });

    it('should resize oversized image', async () => {
      const largeImageBuffer = await sharp({
        create: {
          width: 3000,
          height: 2500,
          channels: 3,
          background: { r: 255, g: 255, b: 255 }
        }
      })
      .jpeg()
      .toBuffer();

      const validation: ImageValidationResult = {
        isValid: true,
        mimeType: 'image/jpeg',
        width: 3000,
        height: 2500,
        size: largeImageBuffer.length,
        format: 'jpeg'
      };

      const result = await processor.testResizeImageIfNeeded(largeImageBuffer, validation);

      expect(result).not.toBe(largeImageBuffer); // Should be a different buffer
      expect(result.length).toBeLessThan(largeImageBuffer.length); // Should be smaller

      // Check the resized dimensions
      const metadata = await sharp(result).metadata();
      expect(metadata.width).toBeLessThanOrEqual(2048);
      expect(metadata.height).toBeLessThanOrEqual(2048);
    });
  });

  describe('generateFilename', () => {
    it('should generate filename with timestamp and random suffix', () => {
      const filename = processor.testGenerateFilename('jpeg');

      expect(filename).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z-[a-z0-9]{6}\.jpeg$/);
    });

    it('should handle different formats', () => {
      const jpgFilename = processor.testGenerateFilename('jpg');
      const pngFilename = processor.testGenerateFilename('png');

      expect(jpgFilename).toMatch(/\.jpeg$/); // jpg should become jpeg
      expect(pngFilename).toMatch(/\.png$/);
    });

    it('should default to jpeg format', () => {
      const filename = processor.testGenerateFilename();
      expect(filename).toMatch(/\.jpeg$/);
    });
  });

  describe('generateImagePath', () => {
    it('should generate path with year/month structure', () => {
      const path = processor.generateImagePath('test-image.jpg');
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');

      expect(path).toBe(`source/images/${year}/${month}/test-image.jpg`);
    });

    it('should generate filename if not provided', () => {
      const path = processor.generateImagePath();
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');

      expect(path).toMatch(new RegExp(`^source/images/${year}/${month}/\\d{4}-\\d{2}-\\d{2}T.*\\.jpeg$`));
    });
  });

  describe('processImage', () => {
    it('should process a valid image successfully', async () => {
      const imageBuffer = await sharp({
        create: {
          width: 800,
          height: 600,
          channels: 3,
          background: { r: 100, g: 150, b: 200 }
        }
      })
      .jpeg()
      .toBuffer();

      const result = await processor.processImage(imageBuffer);

      expect(result.buffer).toBeInstanceOf(Buffer);
      expect(result.filename).toMatch(/\.jpeg$/);
      expect(result.relativePath).toMatch(/^source\/images\/\d{4}\/\d{2}\//);
      expect(result.tempStorageKey).toMatch(/^test-\d+-.*\.jpeg$/);
      expect(result.mimeType).toBe('image/jpeg');
      expect(result.size).toBeGreaterThan(0);

      // Verify the image was stored in temp storage
      const storedBuffer = await processor.downloadFromTempStorage(result.tempStorageKey);
      expect(storedBuffer).toEqual(result.buffer);
    });

    it('should resize large images during processing', async () => {
      const largeImageBuffer = await sharp({
        create: {
          width: 4000,
          height: 3000,
          channels: 3,
          background: { r: 255, g: 0, b: 0 }
        }
      })
      .jpeg()
      .toBuffer();

      const result = await processor.processImage(largeImageBuffer);

      // Check that the processed image is smaller
      expect(result.size).toBeLessThan(largeImageBuffer.length);

      // Verify dimensions are within limits
      const metadata = await sharp(result.buffer).metadata();
      expect(metadata.width).toBeLessThanOrEqual(2048);
      expect(metadata.height).toBeLessThanOrEqual(2048);
    });

    it('should handle processing errors gracefully', async () => {
      const invalidBuffer = Buffer.from('invalid image data');

      await expect(processor.processImage(invalidBuffer))
        .rejects.toThrow(ValidationError);
    });
  });

  describe('temporary storage operations', () => {
    it('should upload, download, and cleanup images', async () => {
      const testBuffer = Buffer.from('test image data');
      const filename = 'test-image.jpg';

      // Upload
      const key = await processor.uploadToTempStorage(testBuffer, filename);
      expect(key).toMatch(/^test-\d+-test-image\.jpg$/);

      // Download
      const downloadedBuffer = await processor.downloadFromTempStorage(key);
      expect(downloadedBuffer).toEqual(testBuffer);

      // Cleanup
      await processor.cleanupTempStorage(key);

      // Verify cleanup
      await expect(processor.downloadFromTempStorage(key))
        .rejects.toThrow('Image not found');
    });
  });
});