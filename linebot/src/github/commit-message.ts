/**
 * Commit message generation for blog post publishing
 *
 * Generates meaningful commit messages that describe the content being published.
 *
 * Requirements:
 * - 5.3: 意味のあるコミットメッセージを生成
 */

import { PostData } from '../types';

/**
 * Generate a commit message for a new blog post
 */
export function generateCommitMessage(postData: PostData, filename: string): string {
  const title = postData.title ?? 'Untitled';
  const hasImage = !!postData.imagePath;

  let message = `Add new post: ${title}`;

  if (hasImage) {
    message += ' (with image)';
  }

  message += `\n\nFile: ${filename}`;

  if (postData.tags.length > 0) {
    message += `\nTags: ${postData.tags.join(', ')}`;
  }

  return message;
}
