/**
 * GitHub API Client
 * Handles authentication, repository operations, file creation, and commits
 *
 * Uses the GitHub Trees/Commits API for atomic multi-file commits.
 *
 * Requirements:
 * - 5.1: source/_posts/ にファイルを追加
 * - 5.2: source/images/ に画像をコミット
 * - 5.3: 意味のあるコミットメッセージを生成
 * - 5.5: エラーを記録してユーザーに通知
 * - 7.3: 適切な権限を持つアクセストークンを使用
 */

import { Octokit } from '@octokit/rest';
import { Config, ExternalServiceError, GitHubFile } from '../types';

export interface GitHubManager {
  commitMultipleFiles(files: GitHubFile[], message: string): Promise<string>;
  getFileContent(path: string): Promise<string | null>;
  listDirectoryFiles(path: string): Promise<string[]>;
}

export class GitHubApiClient implements GitHubManager {
  private readonly octokit: Octokit;
  private readonly owner: string;
  private readonly repo: string;
  private readonly defaultBranch = 'master';

  constructor(config: Config) {
    if (!config.github.token || !config.github.owner || !config.github.repo) {
      throw new ExternalServiceError(
        'GitHub configuration is incomplete',
        'GITHUB',
        'GitHub設定が不完全です。管理者に連絡してください。'
      );
    }

    this.octokit = new Octokit({ auth: config.github.token });
    this.owner = config.github.owner;
    this.repo = config.github.repo;
  }

  /**
   * Commit multiple files atomically using the Git Trees API
   * Returns the commit SHA on success.
   */
  async commitMultipleFiles(files: GitHubFile[], message: string): Promise<string> {
    if (files.length === 0) {
      throw new ExternalServiceError(
        'No files to commit',
        'GITHUB',
        'コミットするファイルがありません。'
      );
    }

    try {
      // 1. Get the latest commit SHA on the default branch
      const { data: ref } = await this.octokit.git.getRef({
        owner: this.owner,
        repo: this.repo,
        ref: `heads/${this.defaultBranch}`,
      });
      const latestCommitSha = ref.object.sha;

      // 2. Get the tree SHA of the latest commit
      const { data: latestCommit } = await this.octokit.git.getCommit({
        owner: this.owner,
        repo: this.repo,
        commit_sha: latestCommitSha,
      });
      const baseTreeSha = latestCommit.tree.sha;

      // 3. Create blobs for each file
      const treeItems = await Promise.all(
        files.map(async (file) => {
          const blob = await this.createBlob(file);
          return {
            path: file.path,
            mode: '100644' as const,
            type: 'blob' as const,
            sha: blob.sha,
          };
        })
      );

      // 4. Create a new tree
      const { data: newTree } = await this.octokit.git.createTree({
        owner: this.owner,
        repo: this.repo,
        base_tree: baseTreeSha,
        tree: treeItems,
      });

      // 5. Create a new commit
      const { data: newCommit } = await this.octokit.git.createCommit({
        owner: this.owner,
        repo: this.repo,
        message,
        tree: newTree.sha,
        parents: [latestCommitSha],
      });

      // 6. Update the branch reference
      await this.octokit.git.updateRef({
        owner: this.owner,
        repo: this.repo,
        ref: `heads/${this.defaultBranch}`,
        sha: newCommit.sha,
      });

      console.log(`Committed ${files.length} file(s): ${newCommit.sha}`);
      return newCommit.sha;
    } catch (error) {
      if (error instanceof ExternalServiceError) throw error;

      const msg = error instanceof Error ? error.message : 'Unknown error';
      console.error('GitHub commit error:', error);
      throw new ExternalServiceError(
        `Failed to commit files: ${msg}`,
        'GITHUB',
        'GitHubへのコミットに失敗しました。しばらく時間をおいて再度お試しください。'
      );
    }
  }

  /**
   * Create a blob for a file (handles both text and binary content)
   */
  private async createBlob(file: GitHubFile): Promise<{ sha: string }> {
    const isBuffer = Buffer.isBuffer(file.content);
    const encoding = isBuffer ? 'base64' : 'utf-8';
    const content = isBuffer
      ? (file.content as Buffer).toString('base64')
      : (file.content as string);

    const { data } = await this.octokit.git.createBlob({
      owner: this.owner,
      repo: this.repo,
      content,
      encoding,
    });

    return { sha: data.sha };
  }

  /**
   * Get file content from the repository
   * Returns null if the file does not exist.
   */
  async getFileContent(path: string): Promise<string | null> {
    try {
      const { data } = await this.octokit.repos.getContent({
        owner: this.owner,
        repo: this.repo,
        path,
        ref: this.defaultBranch,
      });

      if ('content' in data && typeof data.content === 'string') {
        return Buffer.from(data.content, 'base64').toString('utf-8');
      }

      return null;
    } catch (error: unknown) {
      // 404 means file doesn't exist — not an error
      if (isOctokitError(error) && error.status === 404) {
        return null;
      }

      const msg = error instanceof Error ? error.message : 'Unknown error';
      console.error(`GitHub getFileContent error for ${path}:`, error);
      throw new ExternalServiceError(
        `Failed to get file content: ${msg}`,
        'GITHUB',
        'GitHubからファイルの取得に失敗しました。'
      );
    }
  }

  /**
   * List files in a repository directory
   * Returns an empty array if the directory does not exist.
   */
  async listDirectoryFiles(path: string): Promise<string[]> {
    try {
      const { data } = await this.octokit.repos.getContent({
        owner: this.owner,
        repo: this.repo,
        path,
        ref: this.defaultBranch,
      });

      if (!Array.isArray(data)) {
        return [];
      }

      return data
        .filter((item) => item.type === 'file')
        .map((item) => item.name);
    } catch (error: unknown) {
      if (isOctokitError(error) && error.status === 404) {
        return [];
      }

      const msg = error instanceof Error ? error.message : 'Unknown error';
      console.error(`GitHub listDirectoryFiles error for ${path}:`, error);
      throw new ExternalServiceError(
        `Failed to list directory: ${msg}`,
        'GITHUB',
        'GitHubからディレクトリの取得に失敗しました。'
      );
    }
  }
}

/**
 * Type guard for Octokit HTTP errors
 */
function isOctokitError(error: unknown): error is { status: number; message: string } {
  return (
    typeof error === 'object' &&
    error !== null &&
    'status' in error &&
    typeof (error as Record<string, unknown>).status === 'number'
  );
}
