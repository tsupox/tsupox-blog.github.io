/**
 * Unit tests for multi-layer error handling
 *
 * Requirements:
 * - 6.2: 分かりやすいエラーメッセージを日本語で返信
 * - 6.3: ログに詳細を記録して管理者に通知
 */

import { classifyError, getUserMessage, logError, ErrorCategory } from './index';
import { ValidationError, ProcessingError, ExternalServiceError } from '../types';

describe('Error handling module', () => {
  describe('classifyError', () => {
    it('should classify ValidationError as USER', () => {
      const error = new ValidationError('bad input');
      expect(classifyError(error)).toBe(ErrorCategory.USER);
    });

    it('should classify ExternalServiceError as SYSTEM', () => {
      const error = new ExternalServiceError('api down', 'GITHUB');
      expect(classifyError(error)).toBe(ErrorCategory.SYSTEM);
    });

    it('should classify ProcessingError with timeout as RESOURCE', () => {
      const error = new ProcessingError('timeout exceeded');
      expect(classifyError(error)).toBe(ErrorCategory.RESOURCE);
    });

    it('should classify ProcessingError without resource keywords as SYSTEM', () => {
      const error = new ProcessingError('processing failed');
      expect(classifyError(error)).toBe(ErrorCategory.SYSTEM);
    });

    it('should classify generic Error with memory keyword as RESOURCE', () => {
      const error = new Error('out of memory');
      expect(classifyError(error)).toBe(ErrorCategory.RESOURCE);
    });

    it('should classify generic Error with validation keyword as USER', () => {
      const error = new Error('validation failed');
      expect(classifyError(error)).toBe(ErrorCategory.USER);
    });

    it('should classify unknown errors as SYSTEM', () => {
      expect(classifyError('string error')).toBe(ErrorCategory.SYSTEM);
      expect(classifyError(null)).toBe(ErrorCategory.SYSTEM);
      expect(classifyError(42)).toBe(ErrorCategory.SYSTEM);
    });
  });

  describe('getUserMessage', () => {
    it('should return userMessage from LineBotError if present', () => {
      const error = new ExternalServiceError('api fail', 'GITHUB', 'カスタムメッセージ');
      expect(getUserMessage(error)).toBe('カスタムメッセージ');
    });

    it('should return Japanese message for GitHub errors', () => {
      const error = new ExternalServiceError('api fail', 'GITHUB');
      expect(getUserMessage(error)).toContain('GitHub');
    });

    it('should return Japanese message for LINE errors', () => {
      const error = new ExternalServiceError('api fail', 'LINE_API');
      expect(getUserMessage(error)).toContain('LINE');
    });

    it('should return Japanese message for validation errors', () => {
      const error = new ValidationError('bad input');
      expect(getUserMessage(error)).toContain('入力内容に問題があります');
    });

    it('should return Japanese message for network errors', () => {
      const error = new Error('network connection failed');
      expect(getUserMessage(error)).toContain('ネットワーク');
    });

    it('should return Japanese message for session errors', () => {
      const error = new Error('session storage failed');
      expect(getUserMessage(error)).toContain('セッション');
    });

    it('should return Japanese message for resource errors', () => {
      const error = new Error('timeout exceeded');
      expect(getUserMessage(error)).toContain('リソース');
    });

    it('should return generic Japanese message for unknown errors', () => {
      const msg = getUserMessage('unknown');
      expect(msg).toContain('システムエラー');
    });
  });

  describe('logError', () => {
    it('should create structured log entry', () => {
      const error = new ValidationError('bad input', 'ユーザーメッセージ');
      const entry = logError(error, 'user123', { step: 'title' });

      expect(entry.category).toBe(ErrorCategory.USER);
      expect(entry.code).toBe('VALIDATION_ERROR');
      expect(entry.message).toBe('bad input');
      expect(entry.userMessage).toBe('ユーザーメッセージ');
      expect(entry.userId).toBe('user123');
      expect(entry.context).toEqual({ step: 'title' });
      expect(entry.timestamp).toBeDefined();
    });

    it('should log ADMIN_ALERT for system errors', () => {
      const error = new ExternalServiceError('github down', 'GITHUB');
      logError(error);

      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('SYSTEM')
      );
      expect(console.error).toHaveBeenCalledWith(
        '[ADMIN_ALERT]',
        expect.objectContaining({ category: ErrorCategory.SYSTEM })
      );
    });

    it('should log ADMIN_ALERT for resource errors', () => {
      const error = new Error('timeout exceeded');
      logError(error);

      expect(console.error).toHaveBeenCalledWith(
        '[ADMIN_ALERT]',
        expect.objectContaining({ category: ErrorCategory.RESOURCE })
      );
    });

    it('should NOT log ADMIN_ALERT for user errors', () => {
      const error = new ValidationError('bad input');
      logError(error);

      expect(console.error).not.toHaveBeenCalledWith(
        '[ADMIN_ALERT]',
        expect.anything()
      );
    });

    it('should handle non-Error objects', () => {
      const entry = logError('string error');

      expect(entry.code).toBe('UNKNOWN_ERROR');
      expect(entry.message).toBe('string error');
    });
  });
});
