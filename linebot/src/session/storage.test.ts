/**
 * Unit tests for session storage utilities
 */

import { createIdleState, updateStateStep } from './storage';
import { ConversationStep } from '../types';

describe('Session Storage Utilities', () => {
  describe('createIdleState', () => {
    it('should create a valid IDLE state', () => {
      const state = createIdleState();

      expect(state.step).toBe(ConversationStep.IDLE);
      expect(state.data).toEqual({ tags: [] });
      expect(state.createdAt).toBeInstanceOf(Date);
      expect(state.updatedAt).toBeInstanceOf(Date);
      expect(state.createdAt.getTime()).toBeLessThanOrEqual(Date.now());
      expect(state.updatedAt.getTime()).toBeLessThanOrEqual(Date.now());
    });

    it('should create states with recent timestamps', () => {
      const before = Date.now();
      const state = createIdleState();
      const after = Date.now();

      expect(state.createdAt.getTime()).toBeGreaterThanOrEqual(before);
      expect(state.createdAt.getTime()).toBeLessThanOrEqual(after);
      expect(state.updatedAt.getTime()).toBeGreaterThanOrEqual(before);
      expect(state.updatedAt.getTime()).toBeLessThanOrEqual(after);
    });
  });

  describe('updateStateStep', () => {
    it('should update step and preserve existing data', () => {
      const originalState = {
        step: ConversationStep.IDLE,
        data: { title: 'Existing Title', tags: ['tag1'] },
        createdAt: new Date('2024-01-01T10:00:00Z'),
        updatedAt: new Date('2024-01-01T10:00:00Z')
      };

      const updatedState = updateStateStep(originalState, ConversationStep.WAITING_CONTENT);

      expect(updatedState.step).toBe(ConversationStep.WAITING_CONTENT);
      expect(updatedState.data.title).toBe('Existing Title');
      expect(updatedState.data.tags).toEqual(['tag1']);
      expect(updatedState.createdAt).toEqual(originalState.createdAt);
      expect(updatedState.updatedAt.getTime()).toBeGreaterThan(originalState.updatedAt.getTime());
    });

    it('should update step and merge new data', () => {
      const originalState = {
        step: ConversationStep.WAITING_TITLE,
        data: { tags: [] },
        createdAt: new Date('2024-01-01T10:00:00Z'),
        updatedAt: new Date('2024-01-01T10:00:00Z')
      };

      const updatedState = updateStateStep(
        originalState,
        ConversationStep.WAITING_CONTENT,
        { title: 'New Title', content: 'New Content' }
      );

      expect(updatedState.step).toBe(ConversationStep.WAITING_CONTENT);
      expect(updatedState.data.title).toBe('New Title');
      expect(updatedState.data.content).toBe('New Content');
      expect(updatedState.data.tags).toEqual([]);
      expect(updatedState.createdAt).toEqual(originalState.createdAt);
      expect(updatedState.updatedAt.getTime()).toBeGreaterThan(originalState.updatedAt.getTime());
    });

    it('should overwrite existing data fields', () => {
      const originalState = {
        step: ConversationStep.WAITING_CONTENT,
        data: { title: 'Old Title', content: 'Old Content', tags: ['old'] },
        createdAt: new Date('2024-01-01T10:00:00Z'),
        updatedAt: new Date('2024-01-01T10:00:00Z')
      };

      const updatedState = updateStateStep(
        originalState,
        ConversationStep.WAITING_IMAGE,
        { title: 'New Title', tags: ['new1', 'new2'] }
      );

      expect(updatedState.step).toBe(ConversationStep.WAITING_IMAGE);
      expect(updatedState.data.title).toBe('New Title');
      expect(updatedState.data.content).toBe('Old Content'); // Preserved
      expect(updatedState.data.tags).toEqual(['new1', 'new2']); // Overwritten
    });

    it('should update timestamp to current time', () => {
      const originalState = {
        step: ConversationStep.IDLE,
        data: { tags: [] },
        createdAt: new Date('2024-01-01T10:00:00Z'),
        updatedAt: new Date('2024-01-01T10:00:00Z')
      };

      const before = Date.now();
      const updatedState = updateStateStep(originalState, ConversationStep.WAITING_TITLE);
      const after = Date.now();

      expect(updatedState.updatedAt.getTime()).toBeGreaterThanOrEqual(before);
      expect(updatedState.updatedAt.getTime()).toBeLessThanOrEqual(after);
    });

    it('should handle empty data updates', () => {
      const originalState = {
        step: ConversationStep.WAITING_TITLE,
        data: { title: 'Title', tags: ['tag'] },
        createdAt: new Date('2024-01-01T10:00:00Z'),
        updatedAt: new Date('2024-01-01T10:00:00Z')
      };

      const updatedState = updateStateStep(originalState, ConversationStep.WAITING_CONTENT, {});

      expect(updatedState.step).toBe(ConversationStep.WAITING_CONTENT);
      expect(updatedState.data).toEqual(originalState.data);
      expect(updatedState.updatedAt.getTime()).toBeGreaterThan(originalState.updatedAt.getTime());
    });
  });
});