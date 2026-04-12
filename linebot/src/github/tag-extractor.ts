/**
 * Extract unique tags from existing Hexo blog posts in the GitHub repository
 *
 * Reads post files from source/_posts/ and parses YAML front-matter
 * to collect all tags used across the blog.
 *
 * Requirements: 4.3 (既存タグの取得と表示)
 */

import * as yaml from 'js-yaml';
import { GitHubManager } from './client';

const POSTS_DIR = 'source/_posts';

/**
 * Fetch all unique tags from existing blog posts in the repository
 */
export async function fetchExistingTags(github: GitHubManager): Promise<string[]> {
  const filenames = await github.listDirectoryFiles(POSTS_DIR);
  const mdFiles = filenames.filter((f) => f.endsWith('.md'));

  const tagSet = new Set<string>();

  // Fetch files in parallel (bounded to avoid rate limits)
  const batchSize = 10;
  for (let i = 0; i < mdFiles.length; i += batchSize) {
    const batch = mdFiles.slice(i, i + batchSize);
    const contents = await Promise.all(
      batch.map((f) => github.getFileContent(`${POSTS_DIR}/${f}`))
    );

    for (const content of contents) {
      if (!content) continue;
      const tags = extractTagsFromFrontMatter(content);
      for (const tag of tags) {
        tagSet.add(tag);
      }
    }
  }

  return Array.from(tagSet).sort();
}

/**
 * Extract tags array from Hexo Markdown front-matter
 */
export function extractTagsFromFrontMatter(markdown: string): string[] {
  const fmMatch = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!fmMatch) return [];

  try {
    const parsed = yaml.load(fmMatch[1]) as Record<string, unknown> | null;
    if (!parsed || !Array.isArray(parsed.tags)) return [];

    return parsed.tags
      .filter((t): t is string => typeof t === 'string')
      .map((t) => t.trim())
      .filter((t) => t.length > 0);
  } catch {
    // Malformed YAML — skip silently
    return [];
  }
}
