/**
 * Tests for tag management system
 */

import { DefaultTagManager } from './tag-manager';

const sampleTags = [
  'お絵かき',
  'ねこ劇場',
  'おばけ',
  'つぽWorks',
  '今日のKさん',
  '今日のつぽ劇場',
  '今日の母劇場',
  '今日の自分劇場',
  '行事',
  '超落書きシリーズ',
];

describe('DefaultTagManager', () => {
  let manager: DefaultTagManager;

  beforeEach(() => {
    manager = new DefaultTagManager(sampleTags);
  });

  describe('getAvailableTags', () => {
    it('should return a copy of config tags', () => {
      const tags = manager.getAvailableTags();
      expect(tags).toEqual(sampleTags);
      // Should be a copy, not the same reference
      tags.push('extra');
      expect(manager.getAvailableTags()).toEqual(sampleTags);
    });
  });

  describe('formatTagsForSelection', () => {
    it('should format tags as numbered list', () => {
      const result = manager.formatTagsForSelection(['タグA', 'タグB', 'タグC']);
      expect(result).toBe('1. タグA\n2. タグB\n3. タグC');
    });

    it('should return message for empty tags', () => {
      expect(manager.formatTagsForSelection([])).toBe('タグがありません。');
    });
  });

  describe('parseSelectedTags', () => {
    it('should parse single number', () => {
      const result = manager.parseSelectedTags('1', sampleTags);
      expect(result).toEqual(['お絵かき']);
    });

    it('should parse comma-separated numbers', () => {
      const result = manager.parseSelectedTags('1,3,5', sampleTags);
      expect(result).toEqual(['お絵かき', 'おばけ', '今日のKさん']);
    });

    it('should handle Japanese comma separator', () => {
      const result = manager.parseSelectedTags('1、3', sampleTags);
      expect(result).toEqual(['お絵かき', 'おばけ']);
    });

    it('should deduplicate selections', () => {
      const result = manager.parseSelectedTags('1,1,2', sampleTags);
      expect(result).toEqual(['お絵かき', 'ねこ劇場']);
    });

    it('should ignore out-of-range numbers', () => {
      const result = manager.parseSelectedTags('0,1,99', sampleTags);
      expect(result).toEqual(['お絵かき']);
    });

    it('should handle new tag with 新規: prefix', () => {
      const result = manager.parseSelectedTags('新規:新しいタグ', sampleTags);
      expect(result).toEqual(['新しいタグ']);
    });

    it('should handle new tag with full-width colon', () => {
      const result = manager.parseSelectedTags('新規：全角コロン', sampleTags);
      expect(result).toEqual(['全角コロン']);
    });

    it('should reject empty new tag', () => {
      const result = manager.parseSelectedTags('新規:', sampleTags);
      expect(result).toEqual([]);
    });

    it('should reject new tag exceeding max length', () => {
      const longTag = 'あ'.repeat(21);
      const result = manager.parseSelectedTags(`新規:${longTag}`, sampleTags);
      expect(result).toEqual([]);
    });

    it('should match direct tag name', () => {
      const result = manager.parseSelectedTags('ねこ劇場', sampleTags);
      expect(result).toEqual(['ねこ劇場']);
    });

    it('should return empty for invalid input', () => {
      const result = manager.parseSelectedTags('abc', sampleTags);
      expect(result).toEqual([]);
    });

    it('should handle mixed numbers and new tag: 1,3,新規：タグ名', () => {
      const result = manager.parseSelectedTags('1,3,新規：新タグ', sampleTags);
      expect(result).toEqual(['お絵かき', 'おばけ', '新タグ']);
    });

    it('should handle new tag first: 新規：タグ名,1,3', () => {
      const result = manager.parseSelectedTags('新規：先頭タグ,1,3', sampleTags);
      expect(result).toEqual(['先頭タグ', 'お絵かき', 'おばけ']);
    });

    it('should handle multiple new tags in mixed input', () => {
      const result = manager.parseSelectedTags('1,新規:タグA,新規：タグB', sampleTags);
      expect(result).toEqual(['お絵かき', 'タグA', 'タグB']);
    });

    it('should deduplicate new tags in mixed input', () => {
      const result = manager.parseSelectedTags('1,新規:同じ,新規:同じ', sampleTags);
      expect(result).toEqual(['お絵かき', '同じ']);
    });
  });

  describe('validateTags', () => {
    it('should accept valid tags', () => {
      expect(manager.validateTags(['お絵かき', 'ねこ劇場'])).toBe(true);
    });

    it('should reject empty array', () => {
      expect(manager.validateTags([])).toBe(false);
    });

    it('should reject tags exceeding max count', () => {
      const tooMany = Array.from({ length: 11 }, (_, i) => `tag${i}`);
      expect(manager.validateTags(tooMany)).toBe(false);
    });

    it('should reject empty string tag', () => {
      expect(manager.validateTags([''])).toBe(false);
    });

    it('should reject tag exceeding max length', () => {
      expect(manager.validateTags(['あ'.repeat(21)])).toBe(false);
    });

    it('should reject tags with leading/trailing whitespace', () => {
      expect(manager.validateTags([' タグ '])).toBe(false);
    });
  });
});
