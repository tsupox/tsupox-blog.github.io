/**
 * GitHub client - handles file commits to GitHub repository
 */

import { Octokit } from '@octokit/rest';
import { GitHubFile } from '../types';

export interface CommitOptions {
  owner: string;
  repo: string;
  branch?: string;
  message: string;
}

export class GitHubClient {
  private octokit: Octokit;

  constructor(token: string) {
    this.octokit = new Octokit({
      auth: token
    });
  }

  /**
   * Commit multiple files to GitHub repository
   */
  async commitFiles(
    files: GitHubFile[],
    options: CommitOptions
  ): Promise<void> {
    const { owner, repo, branch = 'main', message } = options;

    try {
      // Get the current commit SHA
      const { data: refData } = await this.octokit.git.getRef({
        owner,
        repo,
        ref: `heads/${branch}`
      });

      const currentCommitSha = refData.object.sha;

      // Get the tree SHA of the current commit
      const { data: commitData } = await this.octokit.git.getCommit({
        owner,
        repo,
        commit_sha: currentCommitSha
      });

      const currentTreeSha = commitData.tree.sha;

      // Create blobs for each file
      const blobs = await Promise.all(
        files.map(async (file) => {
          const content = file.encoding === 'base64'
            ? (file.content as Buffer).toString('base64')
            : file.content as string;

          const { data: blobData } = await this.octokit.git.createBlob({
            owner,
            repo,
            content,
            encoding: file.encoding || 'utf-8'
          });

          return {
            path: file.path,
            mode: '100644' as const,
            type: 'blob' as const,
            sha: blobData.sha
          };
        })
      );

      // Create a new tree with the files
      const { data: newTree } = await this.octokit.git.createTree({
        owner,
        repo,
        base_tree: currentTreeSha,
        tree: blobs
      });

      // Create a new commit
      const { data: newCommit } = await this.octokit.git.createCommit({
        owner,
        repo,
        message,
        tree: newTree.sha,
        parents: [currentCommitSha]
      });

      // Update the reference
      await this.octokit.git.updateRef({
        owner,
        repo,
        ref: `heads/${branch}`,
        sha: newCommit.sha
      });

      console.log(`Successfully committed ${files.length} file(s) to ${owner}/${repo}`);
    } catch (error) {
      console.error('GitHub commit error:', error);
      throw new Error(`Failed to commit files to GitHub: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Check if a file exists in the repository
   */
  async fileExists(
    owner: string,
    repo: string,
    path: string,
    branch: string = 'main'
  ): Promise<boolean> {
    try {
      await this.octokit.repos.getContent({
        owner,
        repo,
        path,
        ref: branch
      });
      return true;
    } catch (error: any) {
      if (error.status === 404) {
        return false;
      }
      throw error;
    }
  }
}
