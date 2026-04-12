/**
 * Tag management system
 * Handles tag retrieval, display formatting, selection parsing, and validation
 *
 * Requirements: 4.3 (既存タグの取得と表示、タグ選択とfront-matter統合)
 */

export interface TagManager {
  getAvailableTags(): string[];
  formatTagsForSelection(tags: string[]): string;
  parseSelectedTags(input: string, availableTags: string[]): string[];
  validateTags(tags: string[]): boolean;
}

/**
 * Default tag manager using config-based available tags,
 * optionally merged with tags fetched from the GitHub repository.
 */
export class DefaultTagManager implements TagManager {
  private readonly maxTagLength = 20;
  private readonly maxTagCount = 10;
  private repoTags: string[] = [];

  constructor(private readonly configTags: string[]) {}

  /**
   * Set tags fetched from the GitHub repository.
   * These are merged (deduplicated) with config tags.
   */
  setRepoTags(tags: string[]): void {
    this.repoTags = tags;
  }

  /**
   * Get available tags — config tags first, then any repo-only tags appended
   */
  getAvailableTags(): string[] {
    const configSet = new Set(this.configTags);
    const merged = [...this.configTags];
    for (const tag of this.repoTags) {
      if (!configSet.has(tag)) {
        merged.push(tag);
      }
    }
    return merged;
  }

  /**
   * Format tags as numbered list for LINE text display
   */
  formatTagsForSelection(tags: string[]): string {
    if (tags.length === 0) {
      return 'タグがありません。';
    }

    return tags
      .map((tag, index) => `${index + 1}. ${tag}`)
      .join('\n');
  }

  /**
   * Parse user input into selected tags
   * Supports mixed input of numbers and new tags:
   * - Number selection: "1,3,5" → picks tags by index
   * - New tag creation: "新規:タグ名" → creates a new tag
   * - Mixed: "1,3,新規：タグ名" → existing tags + new tag
   * - Direct tag name match: exact match against available tags
   */
  parseSelectedTags(input: string, availableTags: string[]): string[] {
    const trimmed = input.trim();

    // Check for direct tag name match (single tag name, no commas)
    if (!trimmed.includes(',') && !trimmed.includes('、') && availableTags.includes(trimmed)) {
      return [trimmed];
    }

    // Parse comma-separated parts: each part can be a number or 新規:タグ名
    const parts = trimmed.split(/[,、]/);
    const selectedTags: string[] = [];

    for (const part of parts) {
      const p = part.trim();
      if (p.length === 0) continue;

      // Check for new tag prefix
      if (p.startsWith('新規:') || p.startsWith('新規：')) {
        const newTag = p.replace(/^新規[:：]/, '').trim();
        if (newTag.length > 0 && newTag.length <= this.maxTagLength && !selectedTags.includes(newTag)) {
          selectedTags.push(newTag);
        }
        continue;
      }

      // Try as number
      const num = parseInt(p, 10);
      if (!isNaN(num) && num >= 1 && num <= availableTags.length) {
        const tag = availableTags[num - 1];
        if (!selectedTags.includes(tag)) {
          selectedTags.push(tag);
        }
      }
    }

    return selectedTags;
  }

  /**
   * Validate that tags are well-formed
   */
  validateTags(tags: string[]): boolean {
    if (tags.length === 0 || tags.length > this.maxTagCount) {
      return false;
    }

    return tags.every(tag =>
      tag.length > 0 &&
      tag.length <= this.maxTagLength &&
      tag.trim() === tag
    );
  }
}
