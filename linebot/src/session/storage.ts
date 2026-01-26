/**
 * Session storage interface
 */

import { ConversationState, ConversationStep } from '../types';

export interface SessionStorage {
  /**
   * Get session state for a user
   */
  get(userId: string): Promise<ConversationState | null>;

  /**
   * Set session state for a user
   */
  set(userId: string, state: ConversationState): Promise<void>;

  /**
   * Reset session to IDLE state (keeps session but clears data)
   */
  resetToIdle(userId: string): Promise<void>;

  /**
   * Delete session completely
   */
  delete(userId: string): Promise<void>;

  /**
   * Cleanup expired sessions (implementation-specific)
   */
  cleanup(): Promise<void>;
}

/**
 * Create default IDLE state
 */
export function createIdleState(): ConversationState {
  const now = new Date();
  return {
    step: ConversationStep.IDLE,
    data: { tags: [] },
    createdAt: now,
    updatedAt: now
  };
}

/**
 * Update state with new step and data
 */
export function updateStateStep(
  currentState: ConversationState,
  newStep: ConversationStep,
  dataUpdates: Partial<ConversationState['data']> = {}
): ConversationState {
  return {
    ...currentState,
    step: newStep,
    data: {
      ...currentState.data,
      ...dataUpdates
    },
    updatedAt: new Date()
  };
}