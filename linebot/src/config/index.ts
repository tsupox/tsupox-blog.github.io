/**
 * Configuration management for LINE Bot Blog Publisher
 */

import { Config } from '../types';

/**
 * Load and validate configuration from environment variables
 */
export function loadConfig(): Config {
  // Validate required environment variables
  const requiredEnvVars = [
    'LINE_CHANNEL_SECRET',
    'LINE_CHANNEL_ACCESS_TOKEN',
    'GITHUB_TOKEN',
    'GITHUB_OWNER',
    'GITHUB_REPO',
    'BLOG_BASE_URL'
  ];

  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
  if (missingVars.length > 0) {
    throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
  }

  // Determine storage type based on environment
  const storageType = process.env.VERCEL ? 'vercel-kv' : 'dynamodb';
  const imageStorageType = process.env.VERCEL ? 'vercel-blob' : 's3';

  const config: Config = {
    line: {
      channelSecret: process.env.LINE_CHANNEL_SECRET!,
      channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN!,
    },
    github: {
      token: process.env.GITHUB_TOKEN!,
      owner: process.env.GITHUB_OWNER!,
      repo: process.env.GITHUB_REPO!,
    },
    blog: {
      baseUrl: process.env.BLOG_BASE_URL!,
      imageBasePath: process.env.BLOG_IMAGE_BASE_PATH || '/images',
      categories: ['日記', getCurrentYear()],
      availableTags: [
        'お絵かき',
        'ねこ劇場',
        'おばけ',
        'つぽWorks',
        '今日のKさん',
        '今日のつぽ劇場',
        '今日の母劇場',
        '今日の自分劇場',
        '行事',
        '超落書きシリーズ'
      ],
    },
    storage: {
      type: storageType,
      tableName: process.env.DYNAMODB_TABLE_NAME,
      kvUrl: process.env.KV_URL,
    },
    imageStorage: {
      type: imageStorageType,
      bucketName: process.env.S3_BUCKET_NAME,
      region: process.env.AWS_REGION || 'us-east-1',
    },
  };

  // Validate storage-specific configuration
  if (config.storage.type === 'dynamodb' && !config.storage.tableName) {
    throw new Error('DYNAMODB_TABLE_NAME is required when using DynamoDB storage');
  }

  if (config.storage.type === 'vercel-kv' && !config.storage.kvUrl) {
    throw new Error('KV_URL is required when using Vercel KV storage');
  }

  if (config.imageStorage.type === 's3' && !config.imageStorage.bucketName) {
    throw new Error('S3_BUCKET_NAME is required when using S3 image storage');
  }

  return config;
}

/**
 * Get current year for blog categories
 */
function getCurrentYear(): string {
  return new Date().getFullYear().toString() + '年';
}

/**
 * Get image folder options based on user settings
 */
export function getImageFolderOptions(): string[] {
  const currentYear = new Date().getFullYear();
  return [
    `${currentYear}-rakugaki`,
    `${currentYear}-works`
  ];
}

/**
 * Generate image path based on folder selection and filename
 */
export function generateImagePath(folder: string, filename: string): string {
  return `/images/${folder}/${filename}`;
}

/**
 * Validate configuration at startup
 */
export function validateConfig(config: Config): void {
  // Validate LINE configuration
  if (!config.line.channelSecret || !config.line.channelAccessToken) {
    throw new Error('LINE channel configuration is incomplete');
  }

  // Validate GitHub configuration
  if (!config.github.token || !config.github.owner || !config.github.repo) {
    throw new Error('GitHub configuration is incomplete');
  }

  // Validate blog configuration
  if (!config.blog.baseUrl) {
    throw new Error('Blog base URL is required');
  }

  // Validate URL format
  try {
    new URL(config.blog.baseUrl);
  } catch {
    throw new Error('Blog base URL must be a valid URL');
  }
}

// Export singleton config instance
let configInstance: Config | null = null;

export function getConfig(): Config {
  if (!configInstance) {
    configInstance = loadConfig();
    validateConfig(configInstance);
  }
  return configInstance;
}