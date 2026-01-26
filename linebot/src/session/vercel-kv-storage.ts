/**
 * Vercel KV implementation of session storage
 */

import { kv } from '@vercel/kv';
import { ConversationState } from '../types';
import { SessionStorage, createIdleState } from './storage';

export class VercelKVSessionStorage implements SessionStorage {
  private readonly keyPrefix = 'linebot:session:';
  private readonly ttlSeconds = 24 * 60 * 60; // 24 hours

  constructor(kvUrl?: string) {
    if (kvUrl) {
      // Configure KV with custom URL if provided
      // Note: @vercel/kv automatically uses KV_URL environment variable
      console.log(`Vercel KV configured with URL: ${kvUrl}`);
    }
  }

  /**
   * Generate Redis key for user session
   */
  private getKey(userId: string): string {
    return `${this.keyPrefix}${userId}`;
  }

  /**
   * Get session state for a user
   */
  async get(userId: string): Promise<ConversationState | null> {
    try {
      const key = this.getKey(userId);
      const data = await kv.get<ConversationState>(key);

      if (!data) {
        return null;
      }

      // Ensure dates are properly deserialized
      return {
        ...data,
        createdAt: new Date(data.createdAt),
        updatedAt: new Date(data.updatedAt)
      };
    } catch (error) {
      console.error('Error getting session from Vercel KV:', error);
      throw new Error(`Failed to get session for user ${userId}: ${error}`);
    }
  }

  /**
   * Set session state for a user with TTL
   */
  async set(userId: string, state: ConversationState): Promise<void> {
    try {
      const key = this.getKey(userId);

      // Set with TTL (24 hours)
      await kv.setex(key, this.ttlSeconds, state);

      console.log(`Session saved for user ${userId} with TTL ${this.ttlSeconds}s`);
    } catch (error) {
      console.error('Error setting session in Vercel KV:', error);
      throw new Error(`Failed to set session for user ${userId}: ${error}`);
    }
  }

  /**
   * Reset session to IDLE state (keeps session but clears data)
   */
  async resetToIdle(userId: string): Promise<void> {
    try {
      const idleState = createIdleState();
      await this.set(userId, idleState);

      console.log(`Session reset to IDLE for user ${userId}`);
    } catch (error) {
      console.error('Error resetting session to IDLE:', error);
      throw new Error(`Failed to reset session for user ${userId}: ${error}`);
    }
  }

  /**
   * Delete session completely
   */
  async delete(userId: string): Promise<void> {
    try {
      const key = this.getKey(userId);
      await kv.del(key);

      console.log(`Session deleted for user ${userId}`);
    } catch (error) {
      console.error('Error deleting session from Vercel KV:', error);
      throw new Error(`Failed to delete session for user ${userId}: ${error}`);
    }
  }

  /**
   * Cleanup expired sessions
   * Note: Vercel KV automatically handles TTL expiration,
   * so this is mainly for manual cleanup if needed
   */
  async cleanup(): Promise<void> {
    try {
      // Get all session keys
      const pattern = `${this.keyPrefix}*`;
      const keys = await kv.keys(pattern);

      let cleanedCount = 0;

      // Check each session and remove if expired or invalid
      for (const key of keys) {
        try {
          const data = await kv.get<ConversationState>(key);

          if (!data) {
            // Key exists but no data - remove it
            await kv.del(key);
            cleanedCount++;
            continue;
          }

          // Check if session is too old (beyond TTL + grace period)
          const updatedAt = new Date(data.updatedAt);
          const now = new Date();
          const ageHours = (now.getTime() - updatedAt.getTime()) / (1000 * 60 * 60);

          if (ageHours > 25) { // 1 hour grace period beyond 24h TTL
            await kv.del(key);
            cleanedCount++;
          }
        } catch (keyError) {
          console.warn(`Error processing key ${key} during cleanup:`, keyError);
          // Try to delete problematic key
          try {
            await kv.del(key);
            cleanedCount++;
          } catch (deleteError) {
            console.error(`Failed to delete problematic key ${key}:`, deleteError);
          }
        }
      }

      console.log(`Cleanup completed: ${cleanedCount} sessions cleaned`);
    } catch (error) {
      console.error('Error during session cleanup:', error);
      throw new Error(`Session cleanup failed: ${error}`);
    }
  }

  /**
   * Get session statistics (for monitoring)
   */
  async getStats(): Promise<{ totalSessions: number; activeSteps: Record<string, number> }> {
    try {
      const pattern = `${this.keyPrefix}*`;
      const keys = await kv.keys(pattern);

      const stats = {
        totalSessions: keys.length,
        activeSteps: {} as Record<string, number>
      };

      // Count sessions by step
      for (const key of keys) {
        try {
          const data = await kv.get<ConversationState>(key);
          if (data && data.step) {
            stats.activeSteps[data.step] = (stats.activeSteps[data.step] || 0) + 1;
          }
        } catch (keyError) {
          console.warn(`Error reading session for stats: ${key}`, keyError);
        }
      }

      return stats;
    } catch (error) {
      console.error('Error getting session stats:', error);
      return { totalSessions: 0, activeSteps: {} };
    }
  }
}