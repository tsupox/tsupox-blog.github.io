/**
 * Tests for GitHub API Client
 */

import { GitHubApiClient } from './client';
import { Config, ExternalServiceError } from '../types';

// --- Octokit mock -----------------------------------------------------------

const mockGetRef = jest.fn();
const mockGetCommit = jest.fn();
const mockCreateBlob = jest.fn();
const mockCreateTree = jest.fn();
const mockCreateCommit = jest.fn();
const mockUpdateRef = jest.fn();
const mockGetContent = jest.fn();

jest.mock('@octokit/rest', () => ({
  Octokit: jest.fn().mockImplementation(() => ({
    git: {
      getRef: mockGetRef,
      getCommit: mockGetCommit,
      createBlob: mockCreateBlob,
      createTree: mockCreateTree,
      createCommit: mockCreateCommit,
      updateRef: mockUpdateRef,
    },
    repos: {
      getContent: mockGetContent,
    },
  })),
}));

// --- Helpers -----------------------------------------------------------------

function createConfig(overrides: Partial<Config['github']> = {}): Config {
  return {
    line: { channelSecret: 'secret', channelAccessToken: 'token' },
    github: {
      token: 'gh-token',
      owner: 'test-owner',
      repo: 'test-repo',
      ...overrides,
    },
    blog: {
      baseUrl: 'https://example.com',
      imageBasePath: '/images',
      categories: [],
      availableTags: [],
    },
    storage: { type: 'dynamodb', tableName: 'sessions' },
    imageStorage: { type: 's3', bucketName: 'bucket', region: 'us-east-1' },
  };
}

function setupCommitMocks() {
  mockGetRef.mockResolvedValue({
    data: { object: { sha: 'ref-sha-123' } },
  });
  mockGetCommit.mockResolvedValue({
    data: { tree: { sha: 'tree-sha-123' } },
  });
  mockCreateBlob.mockResolvedValue({
    data: { sha: 'blob-sha-456' },
  });
  mockCreateTree.mockResolvedValue({
    data: { sha: 'new-tree-sha-789' },
  });
  mockCreateCommit.mockResolvedValue({
    data: { sha: 'new-commit-sha-abc' },
  });
  mockUpdateRef.mockResolvedValue({ data: {} });
}

// --- Tests -------------------------------------------------------------------

describe('GitHubApiClient', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('constructor', () => {
    it('should throw when GitHub config is incomplete', () => {
      expect(() => createClient({ token: '' })).toThrow(ExternalServiceError);
      expect(() => createClient({ owner: '' })).toThrow(ExternalServiceError);
      expect(() => createClient({ repo: '' })).toThrow(ExternalServiceError);
    });

    it('should create client with valid config', () => {
      expect(() => createClient()).not.toThrow();
    });
  });

  describe('commitMultipleFiles', () => {
    it('should commit a single text file atomically', async () => {
      setupCommitMocks();
      const client = createClient();

      const sha = await client.commitMultipleFiles(
        [{ path: 'source/_posts/test.md', content: '# Hello', encoding: 'utf-8' }],
        'Add post'
      );

      expect(sha).toBe('new-commit-sha-abc');
      expect(mockGetRef).toHaveBeenCalledTimes(1);
      expect(mockCreateBlob).toHaveBeenCalledTimes(1);
      expect(mockCreateTree).toHaveBeenCalledTimes(1);
      expect(mockCreateCommit).toHaveBeenCalledTimes(1);
      expect(mockUpdateRef).toHaveBeenCalledTimes(1);

      // Verify blob was created with utf-8 encoding
      expect(mockCreateBlob).toHaveBeenCalledWith(
        expect.objectContaining({ content: '# Hello', encoding: 'utf-8' })
      );
    });

    it('should commit binary (image) files as base64', async () => {
      setupCommitMocks();
      const client = createClient();
      const imgBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47]);

      await client.commitMultipleFiles(
        [{ path: 'source/images/photo.png', content: imgBuffer, encoding: 'base64' }],
        'Add image'
      );

      expect(mockCreateBlob).toHaveBeenCalledWith(
        expect.objectContaining({
          content: imgBuffer.toString('base64'),
          encoding: 'base64',
        })
      );
    });

    it('should commit multiple files in a single atomic commit', async () => {
      setupCommitMocks();
      const client = createClient();

      await client.commitMultipleFiles(
        [
          { path: 'source/_posts/post.md', content: '# Post' },
          { path: 'source/images/img.png', content: Buffer.from('img'), encoding: 'base64' },
        ],
        'Add post with image'
      );

      // Two blobs created
      expect(mockCreateBlob).toHaveBeenCalledTimes(2);
      // Single tree and commit
      expect(mockCreateTree).toHaveBeenCalledTimes(1);
      expect(mockCreateCommit).toHaveBeenCalledTimes(1);
    });

    it('should throw when no files provided', async () => {
      const client = createClient();
      await expect(client.commitMultipleFiles([], 'empty')).rejects.toThrow(ExternalServiceError);
    });

    it('should throw ExternalServiceError on GitHub API failure', async () => {
      mockGetRef.mockRejectedValue(new Error('API rate limit'));
      const client = createClient();

      await expect(
        client.commitMultipleFiles(
          [{ path: 'test.md', content: 'x' }],
          'msg'
        )
      ).rejects.toThrow(ExternalServiceError);
    });
  });

  describe('getFileContent', () => {
    it('should return file content decoded from base64', async () => {
      const content = Buffer.from('hello world').toString('base64');
      mockGetContent.mockResolvedValue({ data: { content, type: 'file' } });

      const client = createClient();
      const result = await client.getFileContent('README.md');

      expect(result).toBe('hello world');
    });

    it('should return null for non-existent files', async () => {
      mockGetContent.mockRejectedValue({ status: 404, message: 'Not Found' });

      const client = createClient();
      const result = await client.getFileContent('missing.md');

      expect(result).toBeNull();
    });

    it('should throw on unexpected errors', async () => {
      mockGetContent.mockRejectedValue(new Error('network error'));

      const client = createClient();
      await expect(client.getFileContent('file.md')).rejects.toThrow(ExternalServiceError);
    });
  });

  describe('listDirectoryFiles', () => {
    it('should return file names from a directory', async () => {
      mockGetContent.mockResolvedValue({
        data: [
          { name: 'post1.md', type: 'file' },
          { name: 'post2.md', type: 'file' },
          { name: 'subdir', type: 'dir' },
        ],
      });

      const client = createClient();
      const files = await client.listDirectoryFiles('source/_posts');

      expect(files).toEqual(['post1.md', 'post2.md']);
    });

    it('should return empty array for non-existent directory', async () => {
      mockGetContent.mockRejectedValue({ status: 404, message: 'Not Found' });

      const client = createClient();
      const files = await client.listDirectoryFiles('nonexistent');

      expect(files).toEqual([]);
    });

    it('should return empty array when path is a file (not directory)', async () => {
      mockGetContent.mockResolvedValue({ data: { type: 'file', content: '' } });

      const client = createClient();
      const files = await client.listDirectoryFiles('single-file');

      expect(files).toEqual([]);
    });
  });
});

function createClient(overrides: Partial<Config['github']> = {}): GitHubApiClient {
  return new GitHubApiClient(createConfig(overrides));
}
