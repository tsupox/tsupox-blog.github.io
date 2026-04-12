/**
 * Tests for image processing functionality
 */

import { BaseImageProcessor, ImageValidationResult } from './processor';
import { ValidationError } from '../types';

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

  public testGenerateFilename(originalFormat?: string): string {
    return this.generateFilename(originalFormat);
  }
}

// Helper: create a minimal valid JPEG buffer (magic bytes + padding)
function createJpegBuffer(size = 128): Buffer {
  const buf = Buffer.alloc(size);
  buf[0] = 0xFF; buf[1] = 0xD8; buf[2] = 0xFF; // JPEG magic bytes
  return buf;
}

// Helper: create a minimal valid PNG buffer
function createPngBuffer(size = 128): Buffer {
  const buf = Buffer.alloc(size);
  buf[0] = 0x89; buf[1] = 0x50; buf[2] = 0x4E; buf[3] = 0x47; // PNG magic bytes
  return buf;
}

// Helper: create a minimal valid GIF buffer
function createGifBuffer(size = 128): Buffer {
  const buf = Buffer.alloc(size);
  buf[0] = 0x47; buf[1] = 0x49; buf[2] = 0x46; buf[3] = 0x38; // GIF magic bytes
  return buf;
}

describe('BaseImageProcessor', () => {
  let processor: TestImageProcessor;

  beforeEach(() => {
    processor = new TestImageProcessor();
  });

  describe('validateImage', () => {
    it('should validate a valid JPEG image', async () => {
      const imageBuffer = createJpegBuffer();
      const result = await processor.testValidateImage(imageBuffer);

      expect(result.isValid).toBe(true);
      expect(result.mimeType).toBe('image/jpeg');
      expect(result.format).toBe('jpeg');
      expect(result.size).toBeGreaterThan(0);
    });

    it('should validate a valid PNG image', async () => {
      const imageBuffer = createPngBuffer();
      const result = await processor.testValidateImage(imageBuffer);

      expect(result.isValid).toBe(true);
      expect(result.mimeType).toBe('image/png');
      expect(result.format).toBe('png');
    });

    it('should validate a valid GIF image', async () => {
      const imageBuffer = createGifBuffer();
      const result = await processor.testValidateImage(imageBuffer);

      expect(result.isValid).toBe(true);
      expect(result.mimeType).toBe('image/gif');
      expect(result.format).toBe('gif');
    });

    it('should reject invalid image data', async () => {
      const invalidBuffer = Buffer.from('not an image');

      await expect(processor.testValidateImage(invalidBuffer))
        .rejects.toThrow(ValidationError);
    });

    it('should reject oversized images', async () => {
      const largeBuffer = Buffer.alloc(11 * 1024 * 1024); // 11MB
      // Add JPEG magic bytes so format detection passes
      largeBuffer[0] = 0xFF; largeBuffer[1] = 0xD8; largeBuffer[2] = 0xFF;

      await expect(processor.testValidateImage(largeBuffer))
        .rejects.toThrow(ValidationError);
    });

    it('should reject buffer too small to detect format', async () => {
      const tinyBuffer = Buffer.from([0x00, 0x01]);

      await expect(processor.testValidateImage(tinyBuffer))
        .rejects.toThrow(ValidationError);
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
    it('should process a valid JPEG image successfully', async () => {
      const imageBuffer = createJpegBuffer(256);
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

    it('should process a valid PNG image successfully', async () => {
      const imageBuffer = createPngBuffer(256);
      const result = await processor.processImage(imageBuffer);

      expect(result.mimeType).toBe('image/png');
      expect(result.filename).toMatch(/\.png$/);
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
