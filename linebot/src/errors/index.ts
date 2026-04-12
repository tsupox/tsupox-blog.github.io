/**
 * Multi-layer error handling module
 *
 * Classifies errors into user, system, and resource categories,
 * provides Japanese error messages, and handles structured logging.
 *
 * Requirements:
 * - 6.2: 分かりやすいエラーメッセージを日本語で返信
 * - 6.3: ログに詳細を記録して管理者に通知
 */

import { LineBotError, ValidationError, ProcessingError, ExternalServiceError } from '../types';

/**
 * Error category classification
 */
export enum ErrorCategory {
  /** User input errors (invalid format, wrong data, etc.) */
  USER = 'USER',
  /** External system errors (GitHub API, LINE API, etc.) */
  SYSTEM = 'SYSTEM',
  /** Resource errors (memory, timeout, storage, etc.) */
  RESOURCE = 'RESOURCE',
}

/**
 * Structured error log entry
 */
export interface ErrorLogEntry {
  timestamp: string;
  category: ErrorCategory;
  code: string;
  message: string;
  userMessage: string;
  userId?: string;
  context?: Record<string, unknown>;
}

/**
 * Classify an error into a category
 */
export function classifyError(error: unknown): ErrorCategory {
  if (error instanceof ValidationError) {
    return ErrorCategory.USER;
  }

  if (error instanceof ExternalServiceError) {
    return ErrorCategory.SYSTEM;
  }

  if (error instanceof ProcessingError) {
    // Processing errors can be resource-related
    const msg = error.message.toLowerCase();
    if (msg.includes('timeout') || msg.includes('memory') || msg.includes('quota')) {
      return ErrorCategory.RESOURCE;
    }
    return ErrorCategory.SYSTEM;
  }

  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    if (msg.includes('timeout') || msg.includes('memory') || msg.includes('enospc') || msg.includes('quota')) {
      return ErrorCategory.RESOURCE;
    }
    if (msg.includes('validation') || msg.includes('invalid input')) {
      return ErrorCategory.USER;
    }
  }

  return ErrorCategory.SYSTEM;
}

/**
 * Get a user-friendly Japanese error message based on error category and type
 */
export function getUserMessage(error: unknown): string {
  // If the error already has a user message, use it
  if (error instanceof LineBotError && error.userMessage) {
    return error.userMessage;
  }

  const category = classifyError(error);

  switch (category) {
    case ErrorCategory.USER:
      return getUserErrorMessage(error);
    case ErrorCategory.SYSTEM:
      return getSystemErrorMessage(error);
    case ErrorCategory.RESOURCE:
      return getResourceErrorMessage(error);
  }
}

function getUserErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    if (msg.includes('title') || msg.includes('タイトル')) {
      return 'タイトルの入力内容に問題があります。もう一度お試しください。';
    }
    if (msg.includes('image') || msg.includes('画像')) {
      return '画像の形式またはサイズに問題があります。JPEG、PNG、GIF形式（最大10MB）で再送信してください。';
    }
    if (msg.includes('tag') || msg.includes('タグ')) {
      return 'タグの選択に問題があります。もう一度お試しください。';
    }
  }
  return 'すみません、入力内容に問題があります。もう一度お試しください。';
}

function getSystemErrorMessage(error: unknown): string {
  if (error instanceof ExternalServiceError) {
    if (error.code.includes('GITHUB')) {
      return 'GitHubとの通信でエラーが発生しました。しばらく時間をおいて再度お試しください。';
    }
    if (error.code.includes('LINE')) {
      return 'LINE APIとの通信でエラーが発生しました。しばらく時間をおいて再度お試しください。';
    }
  }
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    if (msg.includes('network') || msg.includes('fetch')) {
      return 'ネットワークエラーが発生しました。しばらく待ってからもう一度お試しください。';
    }
    if (msg.includes('session') || msg.includes('storage')) {
      return 'セッション管理でエラーが発生しました。「投稿作成」と送信して最初からやり直してください。';
    }
  }
  return 'すみません、システムエラーが発生しました。しばらく時間をおいて再度お試しください。';
}

function getResourceErrorMessage(_error: unknown): string {
  return 'サーバーリソースが不足しています。しばらく時間をおいて再度お試しください。';
}

/**
 * Create a structured error log entry and write it to console
 */
export function logError(
  error: unknown,
  userId?: string,
  context?: Record<string, unknown>
): ErrorLogEntry {
  const category = classifyError(error);
  const entry: ErrorLogEntry = {
    timestamp: new Date().toISOString(),
    category,
    code: error instanceof LineBotError ? error.code : 'UNKNOWN_ERROR',
    message: error instanceof Error ? error.message : String(error),
    userMessage: getUserMessage(error),
    userId,
    context,
  };

  // Always log to console with structured data
  console.error(JSON.stringify(entry));

  // System and resource errors are critical — log additional detail for admin
  if (category === ErrorCategory.SYSTEM || category === ErrorCategory.RESOURCE) {
    console.error('[ADMIN_ALERT]', {
      ...entry,
      stack: error instanceof Error ? error.stack : undefined,
    });
  }

  return entry;
}
