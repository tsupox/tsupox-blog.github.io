/**
 * File placement and image link utilities for Hexo blog posts
 *
 * Handles conversion between GitHub repository paths and blog-relative paths,
 * and determines correct file placement within the repository structure.
 *
 * Requirements:
 * - 4.4: Markdown画像リンク生成 (correct relative paths)
 * - 4.5: UTF-8エンコーディング
 * - 4.6: source/_posts/ディレクトリに投稿ファイルを配置
 */

/**
 * Convert a GitHub repository image path to a blog-relative image path
 * e.g. "source/images/2026/04/photo.jpg" → "/images/2026/04/photo.jpg"
 */
export function toMarkdownImagePath(repoPath: string): string {
  // Strip "source" prefix if present
  const stripped = repoPath.replace(/^source\//, '/');
  // Ensure leading slash
  return stripped.startsWith('/') ? stripped : `/${stripped}`;
}

/**
 * Generate a Markdown image link
 * e.g. ![alt](/images/2026/04/photo.jpg)
 */
export function generateImageMarkdown(imagePath: string, alt: string = ''): string {
  return `![${alt}](${imagePath})`;
}

/**
 * Get the repository path for a post file
 * Posts are placed in source/_posts/ directory
 */
export function getPostRepoPath(filename: string): string {
  return `source/_posts/${filename}`;
}

/**
 * Get the repository path for an image file
 * Images are placed in source/images/ directory structure
 */
export function getImageRepoPath(relativePath: string): string {
  // If already starts with source/, return as-is
  if (relativePath.startsWith('source/')) {
    return relativePath;
  }
  // Strip leading slash and prepend source/
  const cleaned = relativePath.replace(/^\//, '');
  return `source/${cleaned}`;
}

/**
 * Encode content as UTF-8 Buffer for GitHub API
 */
export function encodeUtf8(content: string): Buffer {
  return Buffer.from(content, 'utf-8');
}

/**
 * Prepare all files for a blog post commit
 * Returns the list of files with their repository paths and content
 */
export interface CommitFile {
  repoPath: string;
  content: string | Buffer;
  encoding: 'utf-8' | 'base64';
}

export function preparePostFiles(
  postFilename: string,
  postContent: string,
  imageRepoPath?: string,
  imageBuffer?: Buffer
): CommitFile[] {
  const files: CommitFile[] = [];

  // Post markdown file
  files.push({
    repoPath: getPostRepoPath(postFilename),
    content: postContent,
    encoding: 'utf-8',
  });

  // Image file (if provided)
  if (imageRepoPath && imageBuffer) {
    files.push({
      repoPath: imageRepoPath,
      content: imageBuffer,
      encoding: 'base64',
    });
  }

  return files;
}
