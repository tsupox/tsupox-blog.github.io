/**
 * Core type definitions for LINE Bot Blog Publisher
 */

// LINE Messaging API Types
export interface LineEvent {
  type: 'message' | 'follow' | 'unfollow';
  replyToken: string;
  source: {
    userId: string;
    type: 'user';
  };
  message?: LineMessage;
}

export interface LineMessage {
  type: 'text' | 'image';
  text?: string;
  id?: string;
}

// Conversation State Management
export enum ConversationStep {
  IDLE = 'idle',
  WAITING_TITLE = 'waiting_title',
  WAITING_CONTENT = 'waiting_content',
  WAITING_IMAGE = 'waiting_image',
  WAITING_TAGS = 'waiting_tags',
  CONFIRMING = 'confirming'
}

export interface PostData {
  title?: string;
  content?: string;
  imageUrl?: string;
  imagePath?: string;
  tags: string[];
}

export interface ConversationState {
  step: ConversationStep;
  data: PostData;
  createdAt: Date;
  updatedAt: Date;
}

// Image Processing Types
export interface ProcessedImage {
  buffer: Buffer;
  filename: string;
  relativePath: string;
  tempStorageKey: string;
  mimeType: string;
  size: number;
}

// Blog Post Generation Types
export interface HexoFrontMatter {
  title: string;
  date: string;
  updated: string;
  category: string[];
  tags: string[];
  cover_index?: string;
  cover_detail?: string;
  sitemap: boolean;
}

export interface GeneratedPost {
  filename: string;
  content: string;
  frontMatter: HexoFrontMatter;
}

// GitHub Integration Types
export interface GitHubFile {
  path: string;
  content: string | Buffer;
  encoding?: 'utf-8' | 'base64';
}

// Configuration Types
export interface Config {
  line: {
    channelSecret: string;
    channelAccessToken: string;
  };
  github: {
    token: string;
    owner: string;
    repo: string;
  };
  blog: {
    baseUrl: string;
    imageBasePath: string;
    categories: string[];
    availableTags: string[];
  };
  storage: {
    type: 'dynamodb' | 'vercel-kv';
    tableName?: string; // For DynamoDB
    kvUrl?: string; // For Vercel KV
  };
  imageStorage: {
    type: 's3' | 'vercel-blob';
    bucketName?: string; // For S3
    region?: string; // For S3
  };
}

// Error Types
export class LineBotError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly userMessage?: string
  ) {
    super(message);
    this.name = 'LineBotError';
  }
}

export class ValidationError extends LineBotError {
  constructor(message: string, userMessage?: string) {
    super(message, 'VALIDATION_ERROR', userMessage);
  }
}

export class ProcessingError extends LineBotError {
  constructor(message: string, userMessage?: string) {
    super(message, 'PROCESSING_ERROR', userMessage);
  }
}

export class ExternalServiceError extends LineBotError {
  constructor(message: string, service: string, userMessage?: string) {
    super(message, `${service.toUpperCase()}_ERROR`, userMessage);
  }
}

// API Response Types
export interface APIGatewayEvent {
  body: string;
  headers: Record<string, string>;
  httpMethod: string;
  path: string;
  queryStringParameters: Record<string, string> | null;
}

export interface APIGatewayResponse {
  statusCode: number;
  headers?: Record<string, string>;
  body: string;
}

// Vercel Function Types (alternative to AWS Lambda)
export interface VercelRequest {
  body: string;
  headers: Record<string, string>;
  method: string;
  url: string;
  query: Record<string, string>;
}

export interface VercelResponse {
  status: (code: number) => VercelResponse;
  json: (object: unknown) => VercelResponse;
  send: (body: string) => VercelResponse;
  setHeader: (name: string, value: string) => VercelResponse;
}