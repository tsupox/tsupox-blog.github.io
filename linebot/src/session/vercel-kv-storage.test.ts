/**
 * Unit tests for Vercel KV session storage
 */

import { VercelKVSessionStorage } from './vercel-kv-storage';
import { ConversationStep, ConversationState } from '../types';
import { createIdleState } from './storage';

// Mock @vercel/kv
jest.mock('@vercel/kv', () => ({
  kv: {
    get: jest.fn(),
    setex: jest.fn(),
    del: jest.fn(),
    keys: jest.fn(),
  }
}));

import { kv } from '@vercel/kv';

describe('VercelKVSessionStorage', () => {
  let storage: VercelKVSessionStorage;
  const mockKv = kv as jest.Mocked<typeof kv>;

  beforeEach(() => {
    storage = new VercelKVSessionStorage();
    jest.clearAllMocks();
  });

  describe('get', () => {
    it('should return null when session does not exist', async () => {
      mockKv.get.mockResolvedValue(null);

      const result = await storage.get('user123');

      expect(result).toBeNull();
      expect(mockKv.get).toHaveBeenCalledWith('linebot:session:user123');
    });

    it('should return session state when it exists', async () => {
      const mockState: ConversationState = {
        step: ConversationStep.WAITING_TITLE,
        data: { tags: [] },
        createdAt: new Date('2024-01-01T10:00:00Z'),
        updatedAt: new Date('2024-01-01T10:30:00Z')
      };

      mockKv.get.mockResolvedValue(mockState);

      const result = await storage.get('user123');

      expect(result).toEqual(mockState);
      expect(result?.createdAt).toBeInstanceOf(Date);
      expect(result?.updatedAt).toBeInstanceOf(Date);
    });

    it('should handle KV errors gracefully', async () => {
      mockKv.get.mockRejectedValue(new Error('KV connection failed'));

      await expect(storage.get('user123')).rejects.toThrow('Failed to get session for user user123');
    });
  });

  describe('set', () => {
    it('should save session state with TTL', async () => {
      const state: ConversationState = {
        step: ConversationStep.WAITING_CONTENT,
        data: { title: 'Test Title', tags: [] },
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockKv.setex.mockResolvedValue('OK');

      await storage.set('user123', state);

      expect(mockKv.setex).toHaveBeenCalledWith(
        'linebot:session:user123',
        24 * 60 * 60, // 24 hours in seconds
        state
      );
    });

    it('should handle KV errors gracefully', async () => {
      const state = createIdleState();
      mockKv.setex.mockRejectedValue(new Error('KV write failed'));

      await expect(storage.set('user123', state)).rejects.toThrow('Failed to set session for user user123');
    });
  });

  describe('resetToIdle', () => {
    it('should reset session to IDLE state', async () => {
      mockKv.setex.mockResolvedValue('OK');

      await storage.resetToIdle('user123');

      expect(mockKv.setex).toHaveBeenCalledWith(
        'linebot:session:user123',
        24 * 60 * 60,
        expect.objectContaining({
          step: ConversationStep.IDLE,
          data: { tags: [] }
        })
      );
    });
  });

  describe('delete', () => {
    it('should delete session from KV', async () => {
      mockKv.del.mockResolvedValue(1);

      await storage.delete('user123');

      expect(mockKv.del).toHaveBeenCalledWith('linebot:session:user123');
    });

    it('should handle deletion errors gracefully', async () => {
      mockKv.del.mockRejectedValue(new Error('KV delete failed'));

      await expect(storage.delete('user123')).rejects.toThrow('Failed to delete session for user user123');
    });
  });

  describe('cleanup', () => {
    it('should clean up expired and invalid sessions', async () => {
      const now = new Date();
      const oldDate = new Date(now.getTime() - 26 * 60 * 60 * 1000); // 26 hours ago

      mockKv.keys.mockResolvedValue([
        'linebot:session:user1',
        'linebot:session:user2',
        'linebot:session:user3'
      ]);

      // Mock session data
      mockKv.get
        .mockResolvedValueOnce(null) // user1: no data
        .mockResolvedValueOnce({ // user2: expired
          step: ConversationStep.WAITING_TITLE,
          data: { tags: [] },
          createdAt: oldDate,
          updatedAt: oldDate
        })
        .mockResolvedValueOnce({ // user3: valid
          step: ConversationStep.IDLE,
          data: { tags: [] },
          createdAt: now,
          updatedAt: now
        });

      mockKv.del.mockResolvedValue(1);

      await storage.cleanup();

      // Should delete user1 (no data) and user2 (expired)
      expect(mockKv.del).toHaveBeenCalledTimes(2);
      expect(mockKv.del).toHaveBeenCalledWith('linebot:session:user1');
      expect(mockKv.del).toHaveBeenCalledWith('linebot:session:user2');
    });

    it('should handle cleanup errors gracefully', async () => {
      mockKv.keys.mockRejectedValue(new Error('KV keys failed'));

      await expect(storage.cleanup()).rejects.toThrow('Session cleanup failed');
    });
  });

  describe('getStats', () => {
    it('should return session statistics', async () => {
      mockKv.keys.mockResolvedValue([
        'linebot:session:user1',
        'linebot:session:user2',
        'linebot:session:user3'
      ]);

      mockKv.get
        .mockResolvedValueOnce({
          step: ConversationStep.IDLE,
          data: { tags: [] },
          createdAt: new Date(),
          updatedAt: new Date()
        })
        .mockResolvedValueOnce({
          step: ConversationStep.WAITING_TITLE,
          data: { tags: [] },
          createdAt: new Date(),
          updatedAt: new Date()
        })
        .mockResolvedValueOnce({
          step: ConversationStep.IDLE,
          data: { tags: [] },
          createdAt: new Date(),
          updatedAt: new Date()
        });

      const stats = await storage.getStats();

      expect(stats).toEqual({
        totalSessions: 3,
        activeSteps: {
          [ConversationStep.IDLE]: 2,
          [ConversationStep.WAITING_TITLE]: 1
        }
      });
    });

    it('should handle stats errors gracefully', async () => {
      mockKv.keys.mockRejectedValue(new Error('KV keys failed'));

      const stats = await storage.getStats();

      expect(stats).toEqual({
        totalSessions: 0,
        activeSteps: {}
      });
    });
  });

  describe('key generation', () => {
    it('should generate correct Redis keys', async () => {
      mockKv.get.mockResolvedValue(null);

      await storage.get('test-user-123');

      expect(mockKv.get).toHaveBeenCalledWith('linebot:session:test-user-123');
    });
  });

  describe('TTL configuration', () => {
    it('should use 24 hour TTL', async () => {
      const state = createIdleState();
      mockKv.setex.mockResolvedValue('OK');

      await storage.set('user123', state);

      expect(mockKv.setex).toHaveBeenCalledWith(
        expect.any(String),
        24 * 60 * 60, // 24 hours in seconds
        expect.any(Object)
      );
    });
  });
});