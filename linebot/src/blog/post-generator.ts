/**
 * Blog post generator - creates Hexo markdown files with front matter
 */

import yaml from 'js-yaml';
import moment from 'moment';
import { HexoFrontMatter, GeneratedPost, ConversationState } from '../types';

export interface PostGeneratorOptions {
  categories: string[];
  imageFolder: string; // e.g., "2025-rakugaki" or "2025-works"
  imageFilename: string; // e.g., "nekonohi.jpg"
}

export class PostGenerator {
  /**
   * Generate Hexo blog post from conversation state
   */
  generatePost(
    state: ConversationState,
    options: PostGeneratorOptions
  ): GeneratedPost {
    const { title, slug, postDate, content, tags } = state.data;

    if (!title || !slug || !postDate || !content) {
      throw new Error('Missing required post data: title, slug, postDate, or content');
    }

    // Parse the post date
    const date = moment(postDate);

    // Generate filename: YYYYMMDD-slug.md
    const dateStr = date.format('YYYYMMDD');
    const filename = `${dateStr}-${slug}.md`;

    // Create front matter
    const frontMatter: HexoFrontMatter = {
      title: `${date.format('YYYY/MM/DD')} ${title}`,
      date: date.format('YYYY-MM-DD HH:mm:ss'),
      updated: moment().format('YYYY-MM-DD HH:mm:ss'),
      category: options.categories,
      tags: tags,
      cover_index: `/images/${options.imageFolder}/${options.imageFilename}`,
      sitemap: true
    };

    // Generate markdown content
    const markdownContent = this.generateMarkdown(frontMatter, content, options.imageFolder, options.imageFilename);

    return {
      filename,
      content: markdownContent,
      frontMatter
    };
  }

  /**
   * Generate markdown content with YAML front matter
   */
  private generateMarkdown(
    frontMatter: HexoFrontMatter,
    content: string,
    imageFolder: string,
    imageFilename: string
  ): string {
    // Convert front matter to YAML
    const yamlFrontMatter = yaml.dump(frontMatter, {
      lineWidth: -1, // Don't wrap lines
      noRefs: true
    });

    // Build markdown content
    const markdown = [
      '---',
      yamlFrontMatter.trim(),
      '---',
      '',
      content,
      '',
      `![](/images/${imageFolder}/${imageFilename})`,
      '',
      ''
    ].join('\n');

    return markdown;
  }
}
