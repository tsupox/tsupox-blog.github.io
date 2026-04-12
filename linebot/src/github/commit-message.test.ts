/**
 * Tests for commit message generation
 */

import { generateCommitMessage } from './commit-message';
import { PostData } from '../types';

describe('generateCommitMessage', () => {
  const basePostData: PostData = {
    title: 'テスト投稿',
    content: '本文',
    tags: ['お絵かき', 'ねこ劇場'],
  };

  it('should include the post title', () => {
    const msg = generateCommitMessage(basePostData, '20260412-テスト投稿.md');
    expect(msg).toContain('Add new post: テスト投稿');
  });

  it('should include filename', () => {
    const msg = generateCommitMessage(basePostData, '20260412-テスト投稿.md');
    expect(msg).toContain('File: 20260412-テスト投稿.md');
  });

  it('should include tags', () => {
    const msg = generateCommitMessage(basePostData, 'post.md');
    expect(msg).toContain('Tags: お絵かき, ねこ劇場');
  });

  it('should indicate when image is included', () => {
    const withImage: PostData = {
      ...basePostData,
      imagePath: '/images/2026/photo.jpg',
    };
    const msg = generateCommitMessage(withImage, 'post.md');
    expect(msg).toContain('(with image)');
  });

  it('should not mention image when none provided', () => {
    const msg = generateCommitMessage(basePostData, 'post.md');
    expect(msg).not.toContain('(with image)');
  });

  it('should handle missing title gracefully', () => {
    const noTitle: PostData = { content: 'text', tags: [] };
    const msg = generateCommitMessage(noTitle, 'post.md');
    expect(msg).toContain('Add new post: Untitled');
  });

  it('should omit tags line when no tags', () => {
    const noTags: PostData = { title: 'Post', content: 'text', tags: [] };
    const msg = generateCommitMessage(noTags, 'post.md');
    expect(msg).not.toContain('Tags:');
  });
});
