/**
 * Tests for file placement and image link utilities
 */

import {
  toMarkdownImagePath,
  generateImageMarkdown,
  getPostRepoPath,
  getImageRepoPath,
  encodeUtf8,
  preparePostFiles,
} from './file-placement';

describe('toMarkdownImagePath', () => {
  it('should strip source/ prefix', () => {
    expect(toMarkdownImagePath('source/images/2026/04/photo.jpg'))
      .toBe('/images/2026/04/photo.jpg');
  });

  it('should handle path already starting with /', () => {
    expect(toMarkdownImagePath('/images/2026/04/photo.jpg'))
      .toBe('/images/2026/04/photo.jpg');
  });

  it('should add leading slash for bare path', () => {
    expect(toMarkdownImagePath('images/2026/04/photo.jpg'))
      .toBe('/images/2026/04/photo.jpg');
  });
});

describe('generateImageMarkdown', () => {
  it('should generate markdown image with empty alt', () => {
    expect(generateImageMarkdown('/images/test.jpg'))
      .toBe('![](/images/test.jpg)');
  });

  it('should generate markdown image with alt text', () => {
    expect(generateImageMarkdown('/images/test.jpg', '写真'))
      .toBe('![写真](/images/test.jpg)');
  });
});

describe('getPostRepoPath', () => {
  it('should place post in source/_posts/', () => {
    expect(getPostRepoPath('20260412-test.md'))
      .toBe('source/_posts/20260412-test.md');
  });
});

describe('getImageRepoPath', () => {
  it('should return as-is if already starts with source/', () => {
    expect(getImageRepoPath('source/images/2026/04/photo.jpg'))
      .toBe('source/images/2026/04/photo.jpg');
  });

  it('should prepend source/ to /images path', () => {
    expect(getImageRepoPath('/images/2026/04/photo.jpg'))
      .toBe('source/images/2026/04/photo.jpg');
  });

  it('should prepend source/ to bare path', () => {
    expect(getImageRepoPath('images/2026/04/photo.jpg'))
      .toBe('source/images/2026/04/photo.jpg');
  });
});

describe('encodeUtf8', () => {
  it('should encode ASCII content', () => {
    const buf = encodeUtf8('hello');
    expect(buf.toString('utf-8')).toBe('hello');
  });

  it('should encode Japanese content correctly', () => {
    const content = '日本語テスト 🎉';
    const buf = encodeUtf8(content);
    expect(buf.toString('utf-8')).toBe(content);
  });
});

describe('preparePostFiles', () => {
  it('should return only post file when no image', () => {
    const files = preparePostFiles('20260412-test.md', '---\ntitle: test\n---\n\nbody\n');
    expect(files).toHaveLength(1);
    expect(files[0].repoPath).toBe('source/_posts/20260412-test.md');
    expect(files[0].encoding).toBe('utf-8');
  });

  it('should return post and image files when image provided', () => {
    const imageBuffer = Buffer.from([0xFF, 0xD8, 0xFF]);
    const files = preparePostFiles(
      '20260412-test.md',
      '---\ntitle: test\n---\n\nbody\n',
      'source/images/2026/04/photo.jpg',
      imageBuffer
    );
    expect(files).toHaveLength(2);
    expect(files[0].repoPath).toBe('source/_posts/20260412-test.md');
    expect(files[0].encoding).toBe('utf-8');
    expect(files[1].repoPath).toBe('source/images/2026/04/photo.jpg');
    expect(files[1].encoding).toBe('base64');
    expect(files[1].content).toBe(imageBuffer);
  });
});
