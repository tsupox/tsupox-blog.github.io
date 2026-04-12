/**
 * Tests for GitHub tag extractor
 */

import { fetchExistingTags, extractTagsFromFrontMatter } from './tag-extractor';
import { GitHubManager } from './client';

describe('extractTagsFromFrontMatter', () => {
  it('should extract tags from valid front-matter', () => {
    const md = `---
title: Test Post
tags:
  - お絵かき
  - ねこ劇場
---

Content here`;

    expect(extractTagsFromFrontMatter(md)).toEqual(['お絵かき', 'ねこ劇場']);
  });

  it('should return empty array when no front-matter', () => {
    expect(extractTagsFromFrontMatter('# Just a heading')).toEqual([]);
  });

  it('should return empty array when no tags field', () => {
    const md = `---
title: No Tags
date: 2024-01-01
---

Content`;

    expect(extractTagsFromFrontMatter(md)).toEqual([]);
  });

  it('should handle empty tags array', () => {
    const md = `---
title: Empty Tags
tags: []
---`;

    expect(extractTagsFromFrontMatter(md)).toEqual([]);
  });

  it('should filter out non-string and empty tags', () => {
    const md = `---
title: Mixed
tags:
  - valid
  - ""
  - "  "
---`;

    // "" becomes empty after trim, "  " becomes empty after trim
    expect(extractTagsFromFrontMatter(md)).toEqual(['valid']);
  });

  it('should handle malformed YAML gracefully', () => {
    const md = `---
title: Bad YAML
tags: [unclosed
---`;

    expect(extractTagsFromFrontMatter(md)).toEqual([]);
  });

  it('should trim whitespace from tags', () => {
    const md = `---
tags:
  - " spaced "
  - normal
---`;

    expect(extractTagsFromFrontMatter(md)).toEqual(['spaced', 'normal']);
  });
});

describe('fetchExistingTags', () => {
  function createMockGitHub(files: Record<string, string | null>): GitHubManager {
    const fileNames = Object.keys(files).map((p) => p.split('/').pop()!);
    return {
      commitMultipleFiles: jest.fn(),
      getFileContent: jest.fn().mockImplementation((path: string) => {
        return Promise.resolve(files[path] ?? null);
      }),
      listDirectoryFiles: jest.fn().mockResolvedValue(fileNames),
    };
  }

  it('should collect unique tags from multiple posts', async () => {
    const github = createMockGitHub({
      'source/_posts/post1.md': `---
tags:
  - お絵かき
  - ねこ劇場
---`,
      'source/_posts/post2.md': `---
tags:
  - お絵かき
  - おばけ
---`,
    });

    const tags = await fetchExistingTags(github);

    expect(tags).toEqual(['おばけ', 'お絵かき', 'ねこ劇場']);
  });

  it('should return empty array when no posts exist', async () => {
    const github: GitHubManager = {
      commitMultipleFiles: jest.fn(),
      getFileContent: jest.fn(),
      listDirectoryFiles: jest.fn().mockResolvedValue([]),
    };

    const tags = await fetchExistingTags(github);
    expect(tags).toEqual([]);
  });

  it('should skip non-markdown files', async () => {
    const github: GitHubManager = {
      commitMultipleFiles: jest.fn(),
      getFileContent: jest.fn(),
      listDirectoryFiles: jest.fn().mockResolvedValue(['image.png', 'data.json']),
    };

    const tags = await fetchExistingTags(github);
    expect(tags).toEqual([]);
    expect(github.getFileContent).not.toHaveBeenCalled();
  });

  it('should handle null file content gracefully', async () => {
    const github: GitHubManager = {
      commitMultipleFiles: jest.fn(),
      getFileContent: jest.fn().mockResolvedValue(null),
      listDirectoryFiles: jest.fn().mockResolvedValue(['post.md']),
    };

    const tags = await fetchExistingTags(github);
    expect(tags).toEqual([]);
  });
});
