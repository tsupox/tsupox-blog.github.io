/**
 * Unit tests for message processor
 */

import { MessageProcessor } from './processor';
import { ConversationStep, Config } from '../types';
import { createIdleState } from '../session/storage';

// Mock the image processor and LINE client
jest.mock('../image', () => ({
  createImageProcessor: jest.fn(() => ({
    processImage: jest.fn().mockResolvedValue({
      tempStorageKey: 'temp-storage-key',
      relativePath: 'source/images/2024/01/test-image.jpeg',
      buffer: Buffer.from('test'),
      filename: 'test-image.jpeg',
      mimeType: 'image/jpeg',
      size: 1024
    }),
    downloadFromTempStorage: jest.fn().mockResolvedValue(Buffer.from('test-image-data')),
    cleanupTempStorage: jest.fn().mockResolvedValue(undefined),
  }))
}));

jest.mock('../line/client', () => ({
  LineApiClient: jest.fn().mockImplementation(() => ({
    downloadImage: jest.fn().mockResolvedValue(Buffer.from('test-image-data'))
  }))
}));

jest.mock('../github/client', () => ({
  GitHubApiClient: jest.fn().mockImplementation(() => ({
    commitMultipleFiles: jest.fn().mockResolvedValue('abc123sha'),
  }))
}));

jest.mock('../errors', () => ({
  logError: jest.fn(),
}));

describe('MessageProcessor', () => {
  let processor: MessageProcessor;
  let mockConfig: Config;

  beforeEach(() => {
    mockConfig = {
      blog: {
        baseUrl: 'https://test-blog.com',
        availableTags: ['タグ1', 'タグ2', 'タグ3'],
        imageBasePath: '/images',
        categories: ['日記']
      },
      github: {
        token: 'test-token',
        owner: 'test-owner',
        repo: 'test-repo',
      },
      imageStorage: {
        type: 's3',
        bucketName: 'test-bucket',
        region: 'us-east-1'
      }
    } as Config;

    processor = new MessageProcessor(mockConfig);
  });

  describe('processMessage', () => {
    it('should handle text messages', async () => {
      const message = { type: 'text' as const, text: '投稿作成' };
      const state = createIdleState();

      const result = await processor.processMessage(message, state, 'user123');

      expect(result.nextState?.step).toBe(ConversationStep.WAITING_TITLE);
      expect(result.responseMessage).toContain('新しいブログ投稿を作成しましょう');
    });

    it('should handle image messages in correct state', async () => {
      const message = { type: 'image' as const, id: 'image123' };
      const state = createIdleState();
      state.step = ConversationStep.WAITING_IMAGE;
      state.data = { title: 'Test', content: 'Content', tags: [] };

      const result = await processor.processMessage(message, state, 'user123');

      expect(result.nextState?.step).toBe(ConversationStep.WAITING_TAGS);
      expect(result.nextState?.data.imageUrl).toBe('temp-storage-key');
      expect(result.nextState?.data.imagePath).toBe('source/images/2024/01/test-image.jpeg');
      expect(result.responseMessage).toContain('画像を受信しました');
    });

    it('should reject image messages in wrong state', async () => {
      const message = { type: 'image' as const, id: 'image123' };
      const state = createIdleState();

      const result = await processor.processMessage(message, state, 'user123');

      expect(result.nextState).toBeUndefined();
      expect(result.responseMessage).toContain('画像は投稿作成中の画像送信段階でのみ');
    });

    it('should handle unknown message types', async () => {
      const message = { type: 'unknown' as any };
      const state = createIdleState();

      const result = await processor.processMessage(message, state, 'user123');

      expect(result.responseMessage).toContain('そのメッセージタイプには対応していません');
    });
  });

  describe('global commands', () => {
    it('should handle 投稿作成 command', async () => {
      const message = { type: 'text' as const, text: '投稿作成' };
      const state = createIdleState();

      const result = await processor.processMessage(message, state, 'user123');

      expect(result.nextState?.step).toBe(ConversationStep.WAITING_TITLE);
      expect(result.responseMessage).toContain('新しいブログ投稿を作成しましょう');
    });

    it('should handle ヘルプ command', async () => {
      const message = { type: 'text' as const, text: 'ヘルプ' };
      const state = createIdleState();

      const result = await processor.processMessage(message, state, 'user123');

      expect(result.responseMessage).toContain('つぽブログボット ヘルプ');
    });

    it('should handle キャンセル command', async () => {
      const message = { type: 'text' as const, text: 'キャンセル' };
      const state = createIdleState();
      state.step = ConversationStep.WAITING_TITLE;

      const result = await processor.processMessage(message, state, 'user123');

      expect(result.nextState?.step).toBe(ConversationStep.IDLE);
      expect(result.responseMessage).toContain('投稿作成をキャンセルしました');
    });

    it('should reject キャンセル when not in cancellable state', async () => {
      const message = { type: 'text' as const, text: 'キャンセル' };
      const state = createIdleState();

      const result = await processor.processMessage(message, state, 'user123');

      expect(result.responseMessage).toContain('キャンセルできる投稿作成が進行中ではありません');
    });
  });

  describe('title input', () => {
    it('should accept valid title', async () => {
      const message = { type: 'text' as const, text: 'テストタイトル' };
      const state = createIdleState();
      state.step = ConversationStep.WAITING_TITLE;

      const result = await processor.processMessage(message, state, 'user123');

      expect(result.nextState?.step).toBe(ConversationStep.WAITING_CONTENT);
      expect(result.nextState?.data.title).toBe('テストタイトル');
      expect(result.responseMessage).toContain('次に、投稿の本文を入力してください');
    });

    it('should reject empty title', async () => {
      const message = { type: 'text' as const, text: '' };
      const state = createIdleState();
      state.step = ConversationStep.WAITING_TITLE;

      const result = await processor.processMessage(message, state, 'user123');

      expect(result.nextState).toBeUndefined();
      expect(result.responseMessage).toContain('タイトルを入力してください');
    });

    it('should reject too long title', async () => {
      const message = { type: 'text' as const, text: 'a'.repeat(101) };
      const state = createIdleState();
      state.step = ConversationStep.WAITING_TITLE;

      const result = await processor.processMessage(message, state, 'user123');

      expect(result.nextState).toBeUndefined();
      expect(result.responseMessage).toContain('タイトルが長すぎます');
    });
  });

  describe('content input', () => {
    it('should accept valid content', async () => {
      const message = { type: 'text' as const, text: 'テスト本文です。' };
      const state = createIdleState();
      state.step = ConversationStep.WAITING_CONTENT;

      const result = await processor.processMessage(message, state, 'user123');

      expect(result.nextState?.step).toBe(ConversationStep.WAITING_IMAGE);
      expect(result.nextState?.data.content).toBe('テスト本文です。');
      expect(result.responseMessage).toContain('次に、投稿に使用する画像を送信してください');
    });

    it('should reject empty content', async () => {
      const message = { type: 'text' as const, text: '' };
      const state = createIdleState();
      state.step = ConversationStep.WAITING_CONTENT;

      const result = await processor.processMessage(message, state, 'user123');

      expect(result.nextState).toBeUndefined();
      expect(result.responseMessage).toContain('本文を入力してください');
    });

    it('should reject too long content', async () => {
      const message = { type: 'text' as const, text: 'a'.repeat(5001) };
      const state = createIdleState();
      state.step = ConversationStep.WAITING_CONTENT;

      const result = await processor.processMessage(message, state, 'user123');

      expect(result.nextState).toBeUndefined();
      expect(result.responseMessage).toContain('本文が長すぎます');
    });
  });

  describe('tag selection', () => {
    it('should accept valid tag numbers', async () => {
      const message = { type: 'text' as const, text: '1,2' };
      const state = createIdleState();
      state.step = ConversationStep.WAITING_TAGS;

      const result = await processor.processMessage(message, state, 'user123');

      expect(result.nextState?.step).toBe(ConversationStep.CONFIRMING);
      expect(result.nextState?.data.tags).toEqual(['タグ1', 'タグ2']);
      expect(result.responseMessage).toContain('投稿内容を確認してください');
    });

    it('should accept new tag creation', async () => {
      const message = { type: 'text' as const, text: '新規:新しいタグ' };
      const state = createIdleState();
      state.step = ConversationStep.WAITING_TAGS;

      const result = await processor.processMessage(message, state, 'user123');

      expect(result.nextState?.step).toBe(ConversationStep.CONFIRMING);
      expect(result.nextState?.data.tags).toEqual(['新しいタグ']);
    });

    it('should reject invalid tag numbers', async () => {
      const message = { type: 'text' as const, text: '99,100' };
      const state = createIdleState();
      state.step = ConversationStep.WAITING_TAGS;

      const result = await processor.processMessage(message, state, 'user123');

      expect(result.nextState).toBeUndefined();
      expect(result.responseMessage).toContain('有効なタグを選択してください');
    });

    it('should handle duplicate tag selections', async () => {
      const message = { type: 'text' as const, text: '1,1,2' };
      const state = createIdleState();
      state.step = ConversationStep.WAITING_TAGS;

      const result = await processor.processMessage(message, state, 'user123');

      expect(result.nextState?.data.tags).toEqual(['タグ1', 'タグ2']);
    });
  });

  describe('confirmation', () => {
    it('should publish post and include success message with blog URL and delay explanations', async () => {
      const message = { type: 'text' as const, text: 'はい' };
      const state = createIdleState();
      state.step = ConversationStep.CONFIRMING;
      state.data = {
        title: 'テスト投稿',
        content: 'テスト本文',
        imageUrl: 'temp-storage-key',
        imagePath: 'source/images/2024/01/test-image.jpeg',
        tags: ['タグ1'],
      };

      const result = await processor.processMessage(message, state, 'user123');

      expect(result.nextState?.step).toBe(ConversationStep.IDLE);
      // Requirement 6.1: ブログURLを含む
      expect(result.responseMessage).toContain(mockConfig.blog.baseUrl);
      // Requirement 9.1: ページ生成に数分かかる旨
      expect(result.responseMessage).toContain('数分');
      // Requirement 9.2: カスタムドメイン反映遅延
      expect(result.responseMessage).toContain('カスタムドメイン');
    });

    it('should handle negative confirmation', async () => {
      const message = { type: 'text' as const, text: 'いいえ' };
      const state = createIdleState();
      state.step = ConversationStep.CONFIRMING;

      const result = await processor.processMessage(message, state, 'user123');

      expect(result.nextState?.step).toBe(ConversationStep.IDLE);
      expect(result.responseMessage).toContain('投稿をキャンセルしました');
    });

    it('should handle invalid confirmation response', async () => {
      const message = { type: 'text' as const, text: 'わからない' };
      const state = createIdleState();
      state.step = ConversationStep.CONFIRMING;

      const result = await processor.processMessage(message, state, 'user123');

      expect(result.nextState).toBeUndefined();
      expect(result.responseMessage).toContain('「はい」または「いいえ」で回答してください');
    });

    it('should return error message when GitHub commit fails', async () => {
      // Override the mock to simulate failure
      const { GitHubApiClient } = require('../github/client');
      GitHubApiClient.mockImplementation(() => ({
        commitMultipleFiles: jest.fn().mockRejectedValue(new Error('GitHub API error')),
      }));
      // Re-create processor with failing mock
      const failProcessor = new MessageProcessor(mockConfig);

      const message = { type: 'text' as const, text: 'はい' };
      const state = createIdleState();
      state.step = ConversationStep.CONFIRMING;
      state.data = {
        title: 'テスト投稿',
        content: 'テスト本文',
        tags: ['タグ1'],
      };

      const result = await failProcessor.processMessage(message, state, 'user123');

      // Should not transition state on error
      expect(result.nextState).toBeUndefined();
      expect(result.responseMessage).toContain('エラーが発生しました');
    });
  });

  describe('image waiting state', () => {
    it('should prompt for image when text is received', async () => {
      const message = { type: 'text' as const, text: 'テキストメッセージ' };
      const state = createIdleState();
      state.step = ConversationStep.WAITING_IMAGE;

      const result = await processor.processMessage(message, state, 'user123');

      expect(result.nextState).toBeUndefined();
      expect(result.responseMessage).toContain('画像を送信してください');
    });
  });

  describe('idle state handling', () => {
    it('should provide guidance in IDLE state', async () => {
      const message = { type: 'text' as const, text: 'なんでもメッセージ' };
      const state = createIdleState();

      const result = await processor.processMessage(message, state, 'user123');

      expect(result.responseMessage).toContain('投稿を作成するには「投稿作成」と送信してください');
    });
  });

  describe('post-publish confirmation flow', () => {
    it('should return blog URL when 確認 keyword is sent after publishing', async () => {
      const message = { type: 'text' as const, text: '確認' };
      const state = createIdleState();
      state.lastPublishedUrl = 'https://test-blog.com';
      state.lastPublishedAt = new Date();

      const result = await processor.processMessage(message, state, 'user123');

      expect(result.responseMessage).toContain('https://test-blog.com');
      expect(result.responseMessage).toContain('投稿先URL');
    });

    it('should return blog URL when URL keyword is sent after publishing', async () => {
      const message = { type: 'text' as const, text: 'url' };
      const state = createIdleState();
      state.lastPublishedUrl = 'https://test-blog.com';

      const result = await processor.processMessage(message, state, 'user123');

      expect(result.responseMessage).toContain('https://test-blog.com');
    });

    it('should explain page generation delay when 見られない is sent after publishing', async () => {
      const message = { type: 'text' as const, text: '見られない' };
      const state = createIdleState();
      state.lastPublishedUrl = 'https://test-blog.com';
      state.lastPublishedAt = new Date();

      const result = await processor.processMessage(message, state, 'user123');

      expect(result.responseMessage).toContain('GitHub Actions');
      expect(result.responseMessage).toContain('数分');
      expect(result.responseMessage).toContain('https://test-blog.com');
    });

    it('should explain page generation delay when 表示されない is sent after publishing', async () => {
      const message = { type: 'text' as const, text: '表示されない' };
      const state = createIdleState();
      state.lastPublishedUrl = 'https://test-blog.com';

      const result = await processor.processMessage(message, state, 'user123');

      expect(result.responseMessage).toContain('GitHub Actions');
      expect(result.responseMessage).toContain('数分');
    });

    it('should show default guidance when 確認 is sent without lastPublishedUrl', async () => {
      const message = { type: 'text' as const, text: '確認' };
      const state = createIdleState();

      const result = await processor.processMessage(message, state, 'user123');

      expect(result.responseMessage).toContain('投稿を作成するには「投稿作成」と送信してください');
    });

    it('should show default guidance when 見られない is sent without lastPublishedUrl', async () => {
      const message = { type: 'text' as const, text: '見られない' };
      const state = createIdleState();

      const result = await processor.processMessage(message, state, 'user123');

      expect(result.responseMessage).toContain('投稿を作成するには「投稿作成」と送信してください');
    });

    it('should preserve lastPublishedUrl and lastPublishedAt in state after successful publish', async () => {
      // Re-create processor to ensure clean mocks (previous test may override GitHubApiClient)
      const { GitHubApiClient } = require('../github/client');
      GitHubApiClient.mockImplementation(() => ({
        commitMultipleFiles: jest.fn().mockResolvedValue('abc123sha'),
      }));
      const freshProcessor = new MessageProcessor(mockConfig);

      const message = { type: 'text' as const, text: 'はい' };
      const state = createIdleState();
      state.step = ConversationStep.CONFIRMING;
      state.data = {
        title: 'テスト投稿',
        content: 'テスト本文',
        imageUrl: 'temp-storage-key',
        imagePath: 'source/images/2024/01/test-image.jpeg',
        tags: ['タグ1'],
      };

      const result = await freshProcessor.processMessage(message, state, 'user123');

      expect(result.nextState?.step).toBe(ConversationStep.IDLE);
      expect(result.nextState?.lastPublishedUrl).toBe(mockConfig.blog.baseUrl);
      expect(result.nextState?.lastPublishedAt).toBeInstanceOf(Date);
    });
  });
});