/**
 * Unit tests for conversation flow
 */

import { ConversationFlow } from './flow';
import { ConversationStep } from '../types';
import { createIdleState } from '../session/storage';

describe('ConversationFlow', () => {
  let flow: ConversationFlow;

  beforeEach(() => {
    flow = new ConversationFlow();
  });

  describe('createInitialState', () => {
    it('should create initial IDLE state', () => {
      const state = flow.createInitialState();

      expect(state.step).toBe(ConversationStep.IDLE);
      expect(state.data.tags).toEqual([]);
      expect(state.createdAt).toBeInstanceOf(Date);
      expect(state.updatedAt).toBeInstanceOf(Date);
    });
  });

  describe('isValidTransition', () => {
    it('should allow valid transitions from IDLE', () => {
      expect(flow.isValidTransition(ConversationStep.IDLE, ConversationStep.WAITING_TITLE)).toBe(true);
    });

    it('should allow valid transitions from WAITING_TITLE', () => {
      expect(flow.isValidTransition(ConversationStep.WAITING_TITLE, ConversationStep.WAITING_CONTENT)).toBe(true);
      expect(flow.isValidTransition(ConversationStep.WAITING_TITLE, ConversationStep.IDLE)).toBe(true);
    });

    it('should allow valid transitions from WAITING_CONTENT', () => {
      expect(flow.isValidTransition(ConversationStep.WAITING_CONTENT, ConversationStep.WAITING_IMAGE)).toBe(true);
      expect(flow.isValidTransition(ConversationStep.WAITING_CONTENT, ConversationStep.IDLE)).toBe(true);
    });

    it('should allow valid transitions from WAITING_IMAGE', () => {
      expect(flow.isValidTransition(ConversationStep.WAITING_IMAGE, ConversationStep.WAITING_TAGS)).toBe(true);
      expect(flow.isValidTransition(ConversationStep.WAITING_IMAGE, ConversationStep.IDLE)).toBe(true);
    });

    it('should allow valid transitions from WAITING_TAGS', () => {
      expect(flow.isValidTransition(ConversationStep.WAITING_TAGS, ConversationStep.CONFIRMING)).toBe(true);
      expect(flow.isValidTransition(ConversationStep.WAITING_TAGS, ConversationStep.IDLE)).toBe(true);
    });

    it('should allow valid transitions from CONFIRMING', () => {
      expect(flow.isValidTransition(ConversationStep.CONFIRMING, ConversationStep.IDLE)).toBe(true);
    });

    it('should reject invalid transitions', () => {
      expect(flow.isValidTransition(ConversationStep.IDLE, ConversationStep.WAITING_CONTENT)).toBe(false);
      expect(flow.isValidTransition(ConversationStep.WAITING_TITLE, ConversationStep.WAITING_IMAGE)).toBe(false);
      expect(flow.isValidTransition(ConversationStep.CONFIRMING, ConversationStep.WAITING_TITLE)).toBe(false);
    });
  });

  describe('getNextStep', () => {
    it('should return correct next steps', () => {
      expect(flow.getNextStep(ConversationStep.IDLE)).toBe(ConversationStep.WAITING_TITLE);
      expect(flow.getNextStep(ConversationStep.WAITING_TITLE)).toBe(ConversationStep.WAITING_CONTENT);
      expect(flow.getNextStep(ConversationStep.WAITING_CONTENT)).toBe(ConversationStep.WAITING_IMAGE);
      expect(flow.getNextStep(ConversationStep.WAITING_IMAGE)).toBe(ConversationStep.WAITING_TAGS);
      expect(flow.getNextStep(ConversationStep.WAITING_TAGS)).toBe(ConversationStep.CONFIRMING);
      expect(flow.getNextStep(ConversationStep.CONFIRMING)).toBe(ConversationStep.IDLE);
    });
  });

  describe('transitionToNext', () => {
    it('should transition to next step with data updates', () => {
      const initialState = createIdleState();
      const initialTime = initialState.updatedAt.getTime();

      const nextState = flow.transitionToNext(initialState, { title: 'Test Title' });

      expect(nextState.step).toBe(ConversationStep.WAITING_TITLE);
      expect(nextState.data.title).toBe('Test Title');
      expect(nextState.updatedAt.getTime()).toBeGreaterThanOrEqual(initialTime);
    });

    it('should throw error for invalid transitions', () => {
      const state = createIdleState();
      state.step = ConversationStep.CONFIRMING;

      // CONFIRMING -> IDLE is valid, but let's test an invalid transition
      expect(() => flow.transitionTo(state, ConversationStep.WAITING_CONTENT))
        .toThrow('Invalid transition from confirming to waiting_content');
    });
  });

  describe('transitionTo', () => {
    it('should transition to specific step', () => {
      const initialState = createIdleState();

      const nextState = flow.transitionTo(initialState, ConversationStep.WAITING_TITLE, { title: 'Test' });

      expect(nextState.step).toBe(ConversationStep.WAITING_TITLE);
      expect(nextState.data.title).toBe('Test');
    });

    it('should throw error for invalid transitions', () => {
      const initialState = createIdleState();

      expect(() => flow.transitionTo(initialState, ConversationStep.WAITING_CONTENT))
        .toThrow('Invalid transition from idle to waiting_content');
    });
  });

  describe('isConversationComplete', () => {
    it('should return true for complete conversation', () => {
      const state = createIdleState();
      state.step = ConversationStep.CONFIRMING;
      state.data = {
        title: 'Test Title',
        content: 'Test Content',
        imageUrl: 'test-image-id',
        tags: ['tag1', 'tag2']
      };

      expect(flow.isConversationComplete(state)).toBe(true);
    });

    it('should return false for incomplete conversation', () => {
      const state = createIdleState();
      state.step = ConversationStep.CONFIRMING;
      state.data = {
        title: 'Test Title',
        tags: []
      };

      expect(flow.isConversationComplete(state)).toBe(false);
    });

    it('should return false for non-confirming step', () => {
      const state = createIdleState();
      state.step = ConversationStep.WAITING_TITLE;

      expect(flow.isConversationComplete(state)).toBe(false);
    });
  });

  describe('canCancel', () => {
    it('should allow cancellation for non-IDLE steps', () => {
      expect(flow.canCancel(ConversationStep.WAITING_TITLE)).toBe(true);
      expect(flow.canCancel(ConversationStep.WAITING_CONTENT)).toBe(true);
      expect(flow.canCancel(ConversationStep.CONFIRMING)).toBe(true);
    });

    it('should not allow cancellation for IDLE step', () => {
      expect(flow.canCancel(ConversationStep.IDLE)).toBe(false);
    });
  });

  describe('getRequiredDataForStep', () => {
    it('should return correct required data for each step', () => {
      expect(flow.getRequiredDataForStep(ConversationStep.IDLE)).toEqual([]);
      expect(flow.getRequiredDataForStep(ConversationStep.WAITING_TITLE)).toEqual([]);
      expect(flow.getRequiredDataForStep(ConversationStep.WAITING_CONTENT)).toEqual(['title']);
      expect(flow.getRequiredDataForStep(ConversationStep.WAITING_IMAGE)).toEqual(['title', 'content']);
      expect(flow.getRequiredDataForStep(ConversationStep.WAITING_TAGS)).toEqual(['title', 'content', 'imageUrl']);
      expect(flow.getRequiredDataForStep(ConversationStep.CONFIRMING)).toEqual(['title', 'content', 'imageUrl', 'tags']);
    });
  });

  describe('validateStateData', () => {
    it('should validate complete state data', () => {
      const state = createIdleState();
      state.step = ConversationStep.CONFIRMING;
      state.data = {
        title: 'Test Title',
        content: 'Test Content',
        imageUrl: 'test-image',
        tags: ['tag1']
      };

      const result = flow.validateStateData(state);

      expect(result.isValid).toBe(true);
      expect(result.missingFields).toEqual([]);
    });

    it('should identify missing fields', () => {
      const state = createIdleState();
      state.step = ConversationStep.CONFIRMING;
      state.data = {
        title: 'Test Title',
        tags: []
      };

      const result = flow.validateStateData(state);

      expect(result.isValid).toBe(false);
      expect(result.missingFields).toContain('content');
      expect(result.missingFields).toContain('imageUrl');
      expect(result.missingFields).toContain('tags');
    });
  });

  describe('getProgressPercentage', () => {
    it('should return correct progress percentages', () => {
      expect(flow.getProgressPercentage(ConversationStep.IDLE)).toBe(0);
      expect(flow.getProgressPercentage(ConversationStep.WAITING_TITLE)).toBe(20);
      expect(flow.getProgressPercentage(ConversationStep.WAITING_CONTENT)).toBe(40);
      expect(flow.getProgressPercentage(ConversationStep.WAITING_IMAGE)).toBe(60);
      expect(flow.getProgressPercentage(ConversationStep.WAITING_TAGS)).toBe(80);
      expect(flow.getProgressPercentage(ConversationStep.CONFIRMING)).toBe(100);
    });
  });

  describe('getStepDisplayName', () => {
    it('should return correct display names', () => {
      expect(flow.getStepDisplayName(ConversationStep.IDLE)).toBe('待機中');
      expect(flow.getStepDisplayName(ConversationStep.WAITING_TITLE)).toBe('タイトル入力');
      expect(flow.getStepDisplayName(ConversationStep.WAITING_CONTENT)).toBe('本文入力');
      expect(flow.getStepDisplayName(ConversationStep.WAITING_IMAGE)).toBe('画像送信');
      expect(flow.getStepDisplayName(ConversationStep.WAITING_TAGS)).toBe('タグ選択');
      expect(flow.getStepDisplayName(ConversationStep.CONFIRMING)).toBe('確認・公開');
    });
  });
});