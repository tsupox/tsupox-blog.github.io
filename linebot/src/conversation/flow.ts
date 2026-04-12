/**
 * Conversation flow logic and state transitions
 */

import { ConversationState, ConversationStep } from '../types';
import { createIdleState, updateStateStep } from '../session/storage';

export class ConversationFlow {
  /**
   * Create initial conversation state
   */
  createInitialState(): ConversationState {
    return createIdleState();
  }

  /**
   * Determine if a state transition is valid
   */
  isValidTransition(from: ConversationStep, to: ConversationStep): boolean {
    const validTransitions: Record<ConversationStep, ConversationStep[]> = {
      [ConversationStep.IDLE]: [
        ConversationStep.WAITING_TITLE
      ],
      [ConversationStep.WAITING_TITLE]: [
        ConversationStep.WAITING_CONTENT,
        ConversationStep.IDLE // Cancel
      ],
      [ConversationStep.WAITING_CONTENT]: [
        ConversationStep.WAITING_IMAGE,
        ConversationStep.IDLE // Cancel
      ],
      [ConversationStep.WAITING_IMAGE]: [
        ConversationStep.WAITING_TAGS,
        ConversationStep.IDLE // Cancel
      ],
      [ConversationStep.WAITING_TAGS]: [
        ConversationStep.CONFIRMING,
        ConversationStep.IDLE // Cancel
      ],
      [ConversationStep.CONFIRMING]: [
        ConversationStep.IDLE // Complete or cancel
      ]
    };

    return validTransitions[from]?.includes(to) ?? false;
  }

  /**
   * Get next step in the conversation flow
   */
  getNextStep(currentStep: ConversationStep): ConversationStep | null {
    const flowOrder: Record<ConversationStep, ConversationStep | null> = {
      [ConversationStep.IDLE]: ConversationStep.WAITING_TITLE,
      [ConversationStep.WAITING_TITLE]: ConversationStep.WAITING_CONTENT,
      [ConversationStep.WAITING_CONTENT]: ConversationStep.WAITING_IMAGE,
      [ConversationStep.WAITING_IMAGE]: ConversationStep.WAITING_TAGS,
      [ConversationStep.WAITING_TAGS]: ConversationStep.CONFIRMING,
      [ConversationStep.CONFIRMING]: ConversationStep.IDLE
    };

    return flowOrder[currentStep] ?? null;
  }

  /**
   * Transition to next step with data updates
   */
  transitionToNext(
    currentState: ConversationState,
    dataUpdates: Partial<ConversationState['data']> = {}
  ): ConversationState {
    const nextStep = this.getNextStep(currentState.step);

    if (!nextStep) {
      throw new Error(`No next step available from ${currentState.step}`);
    }

    if (!this.isValidTransition(currentState.step, nextStep)) {
      throw new Error(`Invalid transition from ${currentState.step} to ${nextStep}`);
    }

    return updateStateStep(currentState, nextStep, dataUpdates);
  }

  /**
   * Transition to specific step with validation
   */
  transitionTo(
    currentState: ConversationState,
    targetStep: ConversationStep,
    dataUpdates: Partial<ConversationState['data']> = {}
  ): ConversationState {
    if (!this.isValidTransition(currentState.step, targetStep)) {
      throw new Error(`Invalid transition from ${currentState.step} to ${targetStep}`);
    }

    return updateStateStep(currentState, targetStep, dataUpdates);
  }

  /**
   * Check if conversation is complete
   */
  isConversationComplete(state: ConversationState): boolean {
    return state.step === ConversationStep.CONFIRMING &&
           !!state.data.title &&
           !!state.data.content &&
           !!state.data.imageUrl &&
           state.data.tags.length > 0;
  }

  /**
   * Check if conversation can be cancelled
   */
  canCancel(step: ConversationStep): boolean {
    return step !== ConversationStep.IDLE;
  }

  /**
   * Get required data for current step
   */
  getRequiredDataForStep(step: ConversationStep): string[] {
    const requirements: Record<ConversationStep, string[]> = {
      [ConversationStep.IDLE]: [],
      [ConversationStep.WAITING_TITLE]: [],
      [ConversationStep.WAITING_CONTENT]: ['title'],
      [ConversationStep.WAITING_IMAGE]: ['title', 'content'],
      [ConversationStep.WAITING_TAGS]: ['title', 'content', 'imageUrl'],
      [ConversationStep.CONFIRMING]: ['title', 'content', 'imageUrl', 'tags']
    };

    return requirements[step] || [];
  }

  /**
   * Validate that state has required data for its step
   */
  validateStateData(state: ConversationState): { isValid: boolean; missingFields: string[] } {
    const required = this.getRequiredDataForStep(state.step);
    const missingFields: string[] = [];

    for (const field of required) {
      if (field === 'tags') {
        if (!state.data.tags || state.data.tags.length === 0) {
          missingFields.push(field);
        }
      } else if (!state.data[field as keyof typeof state.data]) {
        missingFields.push(field);
      }
    }

    return {
      isValid: missingFields.length === 0,
      missingFields
    };
  }

  /**
   * Get progress percentage for current conversation
   */
  getProgressPercentage(step: ConversationStep): number {
    const stepOrder = [
      ConversationStep.IDLE,
      ConversationStep.WAITING_TITLE,
      ConversationStep.WAITING_CONTENT,
      ConversationStep.WAITING_IMAGE,
      ConversationStep.WAITING_TAGS,
      ConversationStep.CONFIRMING
    ];

    const currentIndex = stepOrder.indexOf(step);
    if (currentIndex === -1) return 0;

    return Math.round((currentIndex / (stepOrder.length - 1)) * 100);
  }

  /**
   * Get user-friendly step name
   */
  getStepDisplayName(step: ConversationStep): string {
    const displayNames: Record<ConversationStep, string> = {
      [ConversationStep.IDLE]: '待機中',
      [ConversationStep.WAITING_TITLE]: 'タイトル入力',
      [ConversationStep.WAITING_CONTENT]: '本文入力',
      [ConversationStep.WAITING_IMAGE]: '画像送信',
      [ConversationStep.WAITING_TAGS]: 'タグ選択',
      [ConversationStep.CONFIRMING]: '確認・公開'
    };

    return displayNames[step] || '不明';
  }
}