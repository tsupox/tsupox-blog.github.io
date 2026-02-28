/**
 * Test script for blog posting functionality
 *
 * This script simulates the blog posting process using existing DynamoDB and S3 data
 * without requiring LINE Bot interaction.
 *
 * Usage:
 *   npm run test:blog-posting
 */

// Load environment variables from .env file
import * as dotenv from 'dotenv';
dotenv.config();

import { MessageProcessor } from './conversation/processor';
import { ConversationState, ConversationStep } from './types';
import { getConfig } from './config';

async function testBlogPosting() {
  console.log('=== Blog Posting Test ===\n');

  try {
    // Load configuration
    console.log('1. Loading configuration...');
    const config = getConfig();
    console.log('✓ Configuration loaded');
    console.log(`  - GitHub: ${config.github.owner}/${config.github.repo}`);
    console.log(`  - Blog URL: ${config.blog.baseUrl}`);
    console.log(`  - S3 Bucket: ${config.imageStorage.bucketName}`);
    console.log(`  - DynamoDB Table: ${config.storage.tableName}\n`);

    // Create test conversation state from DynamoDB data
    console.log('2. Creating test conversation state...');
    const testState: ConversationState = {
      step: ConversationStep.CONFIRMING, // Change to CONFIRMING to trigger blog posting
      data: {
        title: 'ねこのひ',
        slug: 'nekonohi',
        postDate: '2026-02-22',
        content: '2026/2/22 に書いたもの',
        imageUrl: 'temp-images/1772177067730-2026-02-27T07-24-27-409Z-6c1mmo.jpeg',
        imagePath: 'source/images/2026/02/2026-02-27T07-24-27-409Z-6c1mmo.jpeg',
        tags: ['お絵かき', 'ねこ劇場', '超落書きシリーズ']
      },
      createdAt: new Date('2026-02-27T05:57:03.418Z'),
      updatedAt: new Date('2026-02-27T07:24:59.925Z')
    };
    console.log('✓ Test state created');
    console.log(`  - Title: ${testState.data.title}`);
    console.log(`  - Slug: ${testState.data.slug}`);
    console.log(`  - Date: ${testState.data.postDate}`);
    console.log(`  - Content: ${testState.data.content}`);
    console.log(`  - Tags: ${testState.data.tags.join(', ')}`);
    console.log(`  - Image: ${testState.data.imageUrl}\n`);

    // Initialize message processor
    console.log('3. Initializing message processor...');
    const processor = new MessageProcessor(config);
    console.log('✓ Message processor initialized\n');

    // Simulate user confirmation
    console.log('4. Simulating user confirmation ("はい")...');
    const result = await processor.processMessage(
      {
        type: 'text',
        text: 'はい'
      },
      testState,
      'Ud30b5ea3cdb47b8bd3b8eb7f5c69fe66'
    );

    console.log('✓ Processing completed\n');

    // Display results
    console.log('=== Results ===');
    console.log(`Response: ${result.responseMessage}\n`);

    if (result.nextState) {
      console.log(`Next state: ${result.nextState.step}`);
    }

    console.log('\n=== Test Completed Successfully ===');
    console.log('\nNext steps:');
    console.log('1. Check your GitHub repository for the new blog post');
    console.log('2. Verify the image was uploaded correctly');
    console.log('3. Check that the S3 temporary image was cleaned up');

  } catch (error) {
    console.error('\n=== Test Failed ===');
    console.error('Error:', error);

    if (error instanceof Error) {
      console.error('Message:', error.message);
      console.error('Stack:', error.stack);
    }

    console.error('\nTroubleshooting:');
    console.error('1. Verify all environment variables are set correctly');
    console.error('2. Check that the S3 image exists at the specified path');
    console.error('3. Verify GitHub token has correct permissions');
    console.error('4. Check CloudWatch Logs for detailed error information');

    process.exit(1);
  }
}

// Run the test
testBlogPosting();
