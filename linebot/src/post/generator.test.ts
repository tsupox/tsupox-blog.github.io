/**
 * Tests for Hexo post generator
 */

import { HexoPostGenerator } from './generator';
import { PostData, Config } from '../types';

// Minimal config for testing
const testConfig: Config = {
  line: { channelSecret: 'test', channelAccessToken: 'test' },
  github: { token: 'test', owner: 'test', repo: 'test' },
  blog: {
    baseUrl: 'https://example.com',
    imageBasePath: '/images',
    categories: ['日記', '2026年'],
    availableTags: ['お絵かき', 'ねこ劇場'],
  },
  storage: { type: 'dynamodb', tableName: 'test' },
  imageStorage: { type: 's3', bucketName: 'test', region: 'us-east-1' },
};

describe('HexoPostGenerator', () => {
  let generator: HexoPostGenerator;

  beforeEach(() => {
    generator = new HexoPostGenerator();
  });

  describe('generateFilename', () => {
    it('should generate filename with YYYYMMDD date prefix', () => {
      const date = new Date('2026-04-12T10:00:00Z');
      const filename = generator.generateFilename('テスト投稿', date);
      expect(filename).toBe('20260412-テスト投稿.md');
    });

    it('should replace spaces with hyphens', () => {
      const date = new Date('2026-01-15T00:00:00Z');
      const filename = generator.generateFilename('hello world test', date);
      expect(filename).toBe('20260115-hello-world-test.md');
    });

    it('should remove special characters', () => {
      const date = new Date('2026-01-15T00:00:00Z');
      const filename = generator.generateFilename('test!@#post', date);
      expect(filename).toBe('20260115-testpost.md');
    });

    it('should truncate long titles to 80 chars in slug', () => {
      const date = new Date('2026-01-15T00:00:00Z');
      const longTitle = 'a'.repeat(100);
      const filename = generator.generateFilename(longTitle, date);
      // datePrefix(8) + '-' + slug(max 80) + '.md'
      const slug = filename.replace(/^\d{8}-/, '').replace(/\.md$/, '');
      expect(slug.length).toBeLessThanOrEqual(80);
    });
  });

  describe('generateFrontMatter', () => {
    it('should include all required fields', () => {
      const postData: PostData = {
        title: 'テスト投稿',
        content: '本文です',
        tags: ['お絵かき', 'ねこ劇場'],
      };

      const fm = generator.generateFrontMatter(postData, testConfig);

      expect(fm.title).toBe('テスト投稿');
      expect(fm.date).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
      expect(fm.updated).toBe(fm.date);
      expect(fm.category).toEqual(['日記', '2026年']);
      expect(fm.tags).toEqual(['お絵かき', 'ねこ劇場']);
      expect(fm.sitemap).toBe(true);
    });

    it('should include cover_index when imagePath is provided', () => {
      const postData: PostData = {
        title: 'テスト',
        content: '本文',
        imagePath: '/images/2026/04/test.jpg',
        tags: ['お絵かき'],
      };

      const fm = generator.generateFrontMatter(postData, testConfig);
      expect(fm.cover_index).toBe('/images/2026/04/test.jpg');
    });

    it('should not include cover_index when no imagePath', () => {
      const postData: PostData = {
        title: 'テスト',
        content: '本文',
        tags: [],
      };

      const fm = generator.generateFrontMatter(postData, testConfig);
      expect(fm.cover_index).toBeUndefined();
    });
  });

  describe('generatePost', () => {
    it('should generate complete post with front-matter and body', () => {
      const postData: PostData = {
        title: 'テスト投稿タイトル',
        content: 'これはテスト本文です。',
        imagePath: '/images/2026/04/test.jpg',
        tags: ['お絵かき'],
      };

      const post = generator.generatePost(postData, testConfig);

      expect(post.filename).toMatch(/^\d{8}-.*\.md$/);
      expect(post.content).toContain('---\n');
      expect(post.content).toContain('title: テスト投稿タイトル');
      expect(post.content).toContain('これはテスト本文です。');
      expect(post.content).toContain('![](/images/2026/04/test.jpg)');
      expect(post.frontMatter.title).toBe('テスト投稿タイトル');
    });

    it('should not append image link when no imagePath', () => {
      const postData: PostData = {
        title: 'テスト',
        content: '本文のみ',
        tags: [],
      };

      const post = generator.generatePost(postData, testConfig);
      expect(post.content).not.toContain('![]');
    });

    it('should throw when title is missing', () => {
      const postData: PostData = { content: '本文', tags: [] };
      expect(() => generator.generatePost(postData, testConfig)).toThrow('タイトルが必要です');
    });

    it('should throw when content is missing', () => {
      const postData: PostData = { title: 'タイトル', tags: [] };
      expect(() => generator.generatePost(postData, testConfig)).toThrow('本文が必要です');
    });

    it('should generate valid YAML front-matter', () => {
      const postData: PostData = {
        title: 'YAML テスト: コロン含む',
        content: '本文',
        tags: ['タグ1', 'タグ2'],
      };

      const post = generator.generatePost(postData, testConfig);

      // Extract YAML between --- markers
      const yamlMatch = post.content.match(/^---\n([\s\S]*?)---\n/);
      expect(yamlMatch).not.toBeNull();

      // Should be parseable YAML
      const yaml = require('js-yaml');
      const parsed = yaml.load(yamlMatch![1]);
      expect(parsed.title).toBe('YAML テスト: コロン含む');
      expect(parsed.tags).toEqual(['タグ1', 'タグ2']);
    });

    it('should use UTF-8 encoding for Japanese content', () => {
      const postData: PostData = {
        title: '日本語タイトル',
        content: '日本語の本文です。絵文字も🎉',
        tags: ['日本語タグ'],
      };

      const post = generator.generatePost(postData, testConfig);
      expect(post.content).toContain('日本語タイトル');
      expect(post.content).toContain('日本語の本文です。絵文字も🎉');
    });

    it('should include category from config', () => {
      const postData: PostData = {
        title: 'カテゴリテスト',
        content: '本文',
        tags: [],
      };

      const post = generator.generatePost(postData, testConfig);
      expect(post.content).toContain('category:');
      expect(post.content).toContain('日記');
      expect(post.content).toContain('2026年');
    });
  });
});
