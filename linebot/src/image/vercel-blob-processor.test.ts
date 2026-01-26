/**
 * Tests for Vercel Blob image processor
 */

import { VercelBlobImageProcessor } from './vercel-blob-processor';
import { ProcessingError } from '../types';

// Mock @vercel/blob
jest.mock('@vercel/blob', () => ({
  put: jest.fn(),
  del: jest.fn(),
  head: jest.fn(),
}));

// Mock fetch for download tests
global.fetch = jest.fn();

import { put, del, head } from '@vercel/blob';

const mockPut = put as jest.MockedFunction<typeof put>;
const mockDel = del as jest.MockedFunction<typeof del>;
const mockHead = head as jest.MockedFunction<typeof head>;
const mockFetch = fetch as jest.MockedFunction<typeof fetch>;

describe('VercelBlobImageProcessor', () => {
  let processor: VercelBlobImageProcessor;

  beforeEach(() => {
    processor = new VercelBlobImageProcessor();
    jest.clearAllMocks();
  });

  describe('uploadToTempStorage', () => {
    it('should upload image to Vercel Blob successfully', async () => {
      const testBuffer = Buffer.from('test image data');
      const filename = 'test-image.jpg';
      const mockUrl = 'https://blob.vercel-storage.com/temp-images/test-image.jpg';

      mockPut.mockResolvedValueOnce({
        url: mockUrl,
        downloadUrl: mockUrl,
        pathname: 'temp-images/test-image.jpg',
        contentType: 'image/jpeg',
        contentDisposition: 'inline; filename="test-image.jpg"',
      });

      const result = await processor.uploadToTempStorage(testBuffer, filename);

      expect(result).toBe(mockUrl);
      expect(mockPut).toHaveBeenCalledWith(
        `temp-images/${filename}`,
        testBuffer,
        {
          access: 'public',
          addRandomSuffix: false,
        }
      );
    });

    it('should handle upload errors', async () => {
      const testBuffer = Buffer.from('test image data');
      const filename = 'test-image.jpg';

      mockPut.mockRejectedValueOnce(new Error('Upload failed'));

      await expect(processor.uploadToTempStorage(testBuffer, filename))
        .rejects.toThrow(ProcessingError);
    });
  });

  describe('downloadFromTempStorage', () => {
    it('should download image from Vercel Blob successfully', async () => {
      const testUrl = 'https://blob.vercel-storage.com/temp-images/test-image.jpg';
      const testData = 'test image data';
      const testBuffer = Buffer.from(testData);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        arrayBuffer: () => Promise.resolve(testBuffer.buffer.slice(testBuffer.byteOffset, testBuffer.byteOffset + testBuffer.byteLength)),
      } as Response);

      const result = await processor.downloadFromTempStorage(testUrl);

      expect(result).toEqual(testBuffer);
      expect(mockFetch).toHaveBeenCalledWith(testUrl);
    });

    it('should handle download errors', async () => {
      const testUrl = 'https://blob.vercel-storage.com/temp-images/test-image.jpg';

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      } as Response);

      await expect(processor.downloadFromTempStorage(testUrl))
        .rejects.toThrow(ProcessingError);
    });

    it('should handle fetch errors', async () => {
      const testUrl = 'https://blob.vercel-storage.com/temp-images/test-image.jpg';

      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(processor.downloadFromTempStorage(testUrl))
        .rejects.toThrow(ProcessingError);
    });
  });

  describe('cleanupTempStorage', () => {
    it('should delete image from Vercel Blob successfully', async () => {
      const testUrl = 'https://blob.vercel-storage.com/temp-images/test-image.jpg';

      mockDel.mockResolvedValueOnce(undefined);

      await expect(processor.cleanupTempStorage(testUrl))
        .resolves.not.toThrow();

      expect(mockDel).toHaveBeenCalledWith(testUrl);
    });

    it('should not throw on cleanup errors', async () => {
      const testUrl = 'https://blob.vercel-storage.com/temp-images/test-image.jpg';

      mockDel.mockRejectedValueOnce(new Error('Delete failed'));

      // Should not throw - cleanup failures are logged but not propagated
      await expect(processor.cleanupTempStorage(testUrl))
        .resolves.not.toThrow();
    });
  });

  describe('imageExists', () => {
    it('should return true if image exists', async () => {
      const testUrl = 'https://blob.vercel-storage.com/temp-images/test-image.jpg';

      mockHead.mockResolvedValueOnce({
        url: testUrl,
        downloadUrl: testUrl,
        size: 1024,
        uploadedAt: new Date(),
        pathname: 'temp-images/test-image.jpg',
        contentType: 'image/jpeg',
        contentDisposition: 'inline; filename="test-image.jpg"',
        cacheControl: 'public, max-age=31536000',
      });

      const result = await processor.imageExists(testUrl);

      expect(result).toBe(true);
      expect(mockHead).toHaveBeenCalledWith(testUrl);
    });

    it('should return false if image does not exist', async () => {
      const testUrl = 'https://blob.vercel-storage.com/temp-images/nonexistent.jpg';

      mockHead.mockRejectedValueOnce(new Error('Not found'));

      const result = await processor.imageExists(testUrl);

      expect(result).toBe(false);
    });
  });

  describe('integration with base processor', () => {
    it('should process image end-to-end', async () => {
      const mockUrl = 'https://blob.vercel-storage.com/temp-images/processed-image.jpeg';

      mockPut.mockResolvedValueOnce({
        url: mockUrl,
        downloadUrl: mockUrl,
        pathname: 'temp-images/processed-image.jpeg',
        contentType: 'image/jpeg',
        contentDisposition: 'inline; filename="processed-image.jpeg"',
      });

      // Create a simple test image using Sharp
      const sharp = require('sharp');
      const testImageBuffer = await sharp({
        create: {
          width: 100,
          height: 100,
          channels: 3,
          background: { r: 255, g: 0, b: 0 }
        }
      })
      .jpeg()
      .toBuffer();

      const result = await processor.processImage(testImageBuffer);

      expect(result.tempStorageKey).toBe(mockUrl);
      expect(result.mimeType).toBe('image/jpeg');
      expect(result.buffer).toBeInstanceOf(Buffer);
      expect(result.filename).toMatch(/\.jpeg$/);
      expect(result.relativePath).toMatch(/^source\/images\/\d{4}\/\d{2}\//);
    });
  });
});