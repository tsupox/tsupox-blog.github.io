/**
 * Property-based tests for success message ordering and completeness
 *
 * Property 11: 成功メッセージ送信順序 (Requirement 6.6)
 *   - Success message is only returned AFTER GitHub commit completes
 *   - If GitHub commit fails, no success message is returned
 *
 * Property 10: 成功時通知完全性 (Requirements 6.1, 9.1, 9.2)
 *   - Success message contains blog URL
 *   - Success message explains page generation delay
 *   - Success message explains custom domain propagation delay
 */

import * as fc from 'fast-check';
import { MessageProcessor } from './processor';
import { ConversationStep, Config, ConversationState } from '../types';
import { createIdleState } from '../session/storage';
import { PROPERTY_TEST_CONFIG } from '../test-setup';

// --- Mocks ---

let mockCommitResult: string | Error = 'abc123sha';
let commitCallOrder: string[] = [];

jest.mock('../image', () => ({
  createImageProcessor: jest.fn(() => ({
    processImage: jest.fn().mockResolvedValue({
      tempStorageKey: 'temp-key',
      relativePath: 'source/images/2026/04/img.jpeg',
      buffer: Buffer.from('img'),
      filename: 'img.jpeg',
      mimeType: 'image/jpeg',
      size: 512,
    }),
    downloadFromTempStorage: jest.fn().mockResolvedValue(Buffer.from('img-data')),
    cleanupTempStorage: jest.fn().mockResolvedValue(undefined),
  })),
}));

jest.mock('../line/client', () => ({
  LineApiClient: jest.fn().mockImplementation(() => ({
    downloadImage: jest.fn().mockResolvedValue(Buffer.from('img-data')),
  })),
}));

jest.mock('../github/client', () => ({
  GitHubApiClient: jest.fn().mockImplementation(() => ({
    commitMultipleFiles: jest.fn().mockImplementation(async () => {
      commitCallOrder.push('github_commit');
      if (mockCommitResult instanceof Error) {
        throw mockCommitResult;
      }
      return mockCommitResult;
    }),
  })),
}));

jest.mock('../errors', () => ({
  logError: jest.fn(),
}));

// --- Helpers ---

function makeConfig(baseUrl: string, tags: string[]): Config {
  return {
    line: { channelSecret: 'secret', channelAccessToken: 'token' },
    github: { token: 'gh-token', owner: 'owner', repo: 'repo' },
    blog: {
      baseUrl,
      imageBasePath: '/images',
      categories: ['日記'],
      availableTags: tags.length > 0 ? tags : ['default-tag'],
    },
    storage: { type: 'dynamodb', tableName: 'sessions' },
    imageStorage: { type: 's3', bucketName: 'bucket', region: 'us-east-1' },
  } as Config;
}

function makeConfirmingState(
  title: string,
  content: string,
  tags: string[],
  withImage: boolean
): ConversationState {
  const state = createIdleState();
  state.step = ConversationStep.CONFIRMING;
  state.data = {
    title,
    content,
    tags: tags.length > 0 ? tags : ['tag'],
    ...(withImage
      ? { imageUrl: 'temp-key', imagePath: 'source/images/2026/04/img.jpeg' }
      : {}),
  };
  return state;
}

// --- Arbitraries ---

/** Non-empty printable string (1-80 chars) */
const arbTitle = fc.string({ minLength: 1, maxLength: 80 }).filter((s) => s.trim().length > 0);

/** Non-empty content (1-200 chars) */
const arbContent = fc.string({ minLength: 1, maxLength: 200 }).filter((s) => s.trim().length > 0);

/** Valid blog base URL */
const arbBaseUrl = fc.constantFrom(
  'https://blog.example.com',
  'https://tsupolog.com',
  'https://my-hexo.github.io',
  'https://custom-domain.jp/blog'
);

/** Tag list (1-5 tags) */
const arbTags = fc
  .array(fc.string({ minLength: 1, maxLength: 20 }).filter((s) => s.trim().length > 0), {
    minLength: 1,
    maxLength: 5,
  });

/** Whether the post has an image */
const arbHasImage = fc.boolean();

// --- Tests ---

describe('Feature: linebot-blog-publisher, Property 11: 成功メッセージ送信順序', () => {
  beforeEach(() => {
    commitCallOrder = [];
    mockCommitResult = 'abc123sha';
  });

  it('success message is returned only after GitHub commit completes successfully', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbTitle,
        arbContent,
        arbBaseUrl,
        arbTags,
        arbHasImage,
        async (title, content, baseUrl, tags, hasImage) => {
          commitCallOrder = [];
          mockCommitResult = 'sha-ok';

          const config = makeConfig(baseUrl, tags);
          const processor = new MessageProcessor(config);
          const state = makeConfirmingState(title, content, tags, hasImage);

          const result = await processor.processMessage(
            { type: 'text', text: 'はい' },
            state,
            'user1'
          );

          // GitHub commit must have been called
          expect(commitCallOrder).toContain('github_commit');

          // Success message must be present
          expect(result.responseMessage).toBeDefined();
          expect(result.responseMessage).toContain('投稿をしました');

          // State must transition to IDLE
          expect(result.nextState?.step).toBe(ConversationStep.IDLE);
        }
      ),
      { numRuns: PROPERTY_TEST_CONFIG.numRuns, seed: PROPERTY_TEST_CONFIG.seed }
    );
  });

  it('no success message is returned when GitHub commit fails', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbTitle,
        arbContent,
        arbBaseUrl,
        arbTags,
        arbHasImage,
        async (title, content, baseUrl, tags, hasImage) => {
          commitCallOrder = [];
          mockCommitResult = new Error('GitHub API failure');

          const config = makeConfig(baseUrl, tags);
          const processor = new MessageProcessor(config);
          const state = makeConfirmingState(title, content, tags, hasImage);

          const result = await processor.processMessage(
            { type: 'text', text: 'はい' },
            state,
            'user1'
          );

          // GitHub commit was attempted
          expect(commitCallOrder).toContain('github_commit');

          // No success message — error message instead
          expect(result.responseMessage).not.toContain('投稿をしました');
          expect(result.responseMessage).toContain('エラー');

          // State must NOT transition (no nextState on failure)
          expect(result.nextState).toBeUndefined();
        }
      ),
      { numRuns: PROPERTY_TEST_CONFIG.numRuns, seed: PROPERTY_TEST_CONFIG.seed }
    );
  });
});


describe('Feature: linebot-blog-publisher, Property 10: 成功時通知完全性', () => {
  beforeEach(() => {
    commitCallOrder = [];
    mockCommitResult = 'abc123sha';
  });

  it('success message contains blog URL, page generation delay, and custom domain delay', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbTitle,
        arbContent,
        arbBaseUrl,
        arbTags,
        arbHasImage,
        async (title, content, baseUrl, tags, hasImage) => {
          commitCallOrder = [];
          mockCommitResult = 'sha-ok';

          const config = makeConfig(baseUrl, tags);
          const processor = new MessageProcessor(config);
          const state = makeConfirmingState(title, content, tags, hasImage);

          const result = await processor.processMessage(
            { type: 'text', text: '公開する' },
            state,
            'user1'
          );

          const msg = result.responseMessage!;

          // Requirement 6.1: ブログURLを含む
          expect(msg).toContain(baseUrl);

          // Requirement 9.1: ページ生成に数分かかる旨の説明
          expect(msg).toMatch(/数分|しばらく/);

          // Requirement 9.2: カスタムドメインへの反映遅延の説明
          expect(msg).toContain('カスタムドメイン');
        }
      ),
      { numRuns: PROPERTY_TEST_CONFIG.numRuns, seed: PROPERTY_TEST_CONFIG.seed }
    );
  });

  it('success message is structurally complete for any valid post data', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbTitle,
        arbContent,
        arbBaseUrl,
        arbTags,
        async (title, content, baseUrl, tags) => {
          commitCallOrder = [];
          mockCommitResult = 'sha-ok';

          const config = makeConfig(baseUrl, tags);
          const processor = new MessageProcessor(config);
          // Always with image to test the full path
          const state = makeConfirmingState(title, content, tags, true);

          const result = await processor.processMessage(
            { type: 'text', text: 'はい' },
            state,
            'user1'
          );

          // Must have both a success message and a state transition
          expect(result.responseMessage).toBeDefined();
          expect(result.nextState).toBeDefined();
          expect(result.nextState?.step).toBe(ConversationStep.IDLE);

          const msg = result.responseMessage!;

          // All three required elements must be present
          const hasUrl = msg.includes(baseUrl);
          const hasDelayExplanation = /数分|しばらく/.test(msg);
          const hasDomainExplanation = msg.includes('カスタムドメイン');

          expect(hasUrl).toBe(true);
          expect(hasDelayExplanation).toBe(true);
          expect(hasDomainExplanation).toBe(true);
        }
      ),
      { numRuns: PROPERTY_TEST_CONFIG.numRuns, seed: PROPERTY_TEST_CONFIG.seed }
    );
  });
});
