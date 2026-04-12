/**
 * Hexo blog post generator
 * Generates Markdown files with front-matter based on scaffold templates
 *
 * References: scaffolds/post.md template format
 * Requirements: 4.1 (template-based Markdown generation), 4.2 (date-based filename)
 */

import * as yaml from 'js-yaml';
import moment from 'moment';
import { PostData, GeneratedPost, HexoFrontMatter, Config } from '../types';

export interface PostGenerator {
  generatePost(postData: PostData, config: Config): GeneratedPost;
  generateFrontMatter(postData: PostData, config: Config): HexoFrontMatter;
  generateFilename(title: string, date: Date): string;
}

/**
 * Hexo post generator implementation
 */
export class HexoPostGenerator implements PostGenerator {
  /**
   * Generate a complete Hexo blog post from post data
   */
  generatePost(postData: PostData, config: Config): GeneratedPost {
    if (!postData.title) {
      throw new Error('タイトルが必要です');
    }
    if (!postData.content) {
      throw new Error('本文が必要です');
    }

    const now = new Date();
    const frontMatter = this.generateFrontMatter(postData, config);
    const filename = this.generateFilename(postData.title, now);

    const frontMatterYaml = this.serializeFrontMatter(frontMatter);
    let body = postData.content;

    // Append image markdown link if image path exists
    if (postData.imagePath) {
      body += `\n\n![](${postData.imagePath})`;
    }

    const content = `---\n${frontMatterYaml}---\n\n${body}\n`;

    return { filename, content, frontMatter };
  }

  /**
   * Generate Hexo front-matter from post data
   * Follows the format found in existing posts (e.g., source/_posts/20241124-*.md)
   */
  generateFrontMatter(postData: PostData, config: Config): HexoFrontMatter {
    const now = moment();
    const dateStr = now.format('YYYY-MM-DD HH:mm:ss');

    return {
      title: postData.title!,
      date: dateStr,
      updated: dateStr,
      category: config.blog.categories,
      tags: postData.tags,
      cover_index: postData.imagePath,
      sitemap: true,
    };
  }

  /**
   * Generate filename with date prefix (YYYYMMDD format)
   * Requirement 4.2: 日付形式（YYYYMMDD）を含むファイル名
   */
  generateFilename(title: string, date: Date): string {
    const datePrefix = moment(date).format('YYYYMMDD');
    const slug = this.slugify(title);
    return `${datePrefix}-${slug}.md`;
  }

  /**
   * Serialize front-matter object to YAML string
   */
  private serializeFrontMatter(frontMatter: HexoFrontMatter): string {
    // Build ordered output to match existing post format
    const obj: Record<string, unknown> = {
      title: frontMatter.title,
      date: frontMatter.date,
      updated: frontMatter.updated,
      category: frontMatter.category,
      tags: frontMatter.tags,
    };

    if (frontMatter.cover_index) {
      obj.cover_index = frontMatter.cover_index;
    }

    obj.sitemap = frontMatter.sitemap;

    return yaml.dump(obj, {
      lineWidth: -1,
      quotingType: "'",
      forceQuotes: false,
    });
  }

  /**
   * Convert title to URL-friendly slug
   * Keeps Japanese characters, replaces spaces/special chars with hyphens
   */
  private slugify(title: string): string {
    return title
      .trim()
      .toLowerCase()
      .replace(/[\s\t]+/g, '-')
      .replace(/[^\p{L}\p{N}\-]/gu, '')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 80);
  }
}
