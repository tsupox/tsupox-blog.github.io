/**
 * Test setup configuration for Jest
 */

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.LINE_CHANNEL_SECRET = 'test_channel_secret';
process.env.LINE_CHANNEL_ACCESS_TOKEN = 'test_channel_access_token';
process.env.GITHUB_TOKEN = 'test_github_token';
process.env.GITHUB_OWNER = 'test_owner';
process.env.GITHUB_REPO = 'test_repo';
process.env.BLOG_BASE_URL = 'https://test-blog.com';
process.env.DYNAMODB_TABLE_NAME = 'test-sessions';
process.env.S3_BUCKET_NAME = 'test-images';

// Mock console methods in tests to reduce noise
const originalConsole = { ...console };

beforeEach(() => {
  // Reset console mocks before each test
  console.log = jest.fn();
  console.error = jest.fn();
  console.warn = jest.fn();
  console.info = jest.fn();
});

afterEach(() => {
  // Restore console after each test
  Object.assign(console, originalConsole);
});

// Global test timeout
jest.setTimeout(30000);

// Property-based test configuration
export const PROPERTY_TEST_CONFIG = {
  numRuns: 100,
  seed: 42,
  verbose: false,
};