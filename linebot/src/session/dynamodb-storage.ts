/**
 * DynamoDB implementation of session storage
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, DeleteCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { ConversationState } from '../types';
import { SessionStorage, createIdleState } from './storage';

export class DynamoDBSessionStorage implements SessionStorage {
  private client: DynamoDBDocumentClient;
  private tableName: string;

  constructor(tableName: string, region?: string) {
    const dynamoRegion = region || process.env.APP_AWS_REGION || process.env.AWS_REGION || 'ap-northeast-1';
    console.log(`Initializing DynamoDB client with region: ${dynamoRegion}, table: ${tableName}`);

    const dynamoClient = new DynamoDBClient({ region: dynamoRegion });
    this.client = DynamoDBDocumentClient.from(dynamoClient);
    this.tableName = tableName;
  }

  async get(userId: string): Promise<ConversationState | null> {
    try {
      const command = new GetCommand({
        TableName: this.tableName,
        Key: { userId },
      });

      const response = await this.client.send(command);

      if (!response.Item) {
        return null;
      }

      // Check if session has expired (TTL)
      const ttl = response.Item.ttl as number;
      if (ttl && ttl < Math.floor(Date.now() / 1000)) {
        await this.delete(userId);
        return null;
      }

      const state = response.Item.state as any;

      // Convert ISO strings back to Date objects
      return {
        ...state,
        createdAt: typeof state.createdAt === 'string' ? new Date(state.createdAt) : state.createdAt,
        updatedAt: typeof state.updatedAt === 'string' ? new Date(state.updatedAt) : state.updatedAt,
      };
    } catch (error) {
      console.error('DynamoDB get error:', error);
      throw new Error(`Failed to get session: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async set(userId: string, state: ConversationState): Promise<void> {
    try {
      // Set TTL to 24 hours from now
      const ttl = Math.floor(Date.now() / 1000) + 86400;

      // Convert Date objects to ISO strings for DynamoDB
      const serializedState = {
        ...state,
        createdAt: state.createdAt instanceof Date ? state.createdAt.toISOString() : state.createdAt,
        updatedAt: state.updatedAt instanceof Date ? state.updatedAt.toISOString() : state.updatedAt,
      };

      const command = new PutCommand({
        TableName: this.tableName,
        Item: {
          userId,
          state: serializedState,
          ttl,
          updatedAt: new Date().toISOString(),
        },
      });

      await this.client.send(command);
    } catch (error) {
      console.error('DynamoDB set error:', error);
      throw new Error(`Failed to set session: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async resetToIdle(userId: string): Promise<void> {
    const idleState = createIdleState();
    await this.set(userId, idleState);
  }

  async delete(userId: string): Promise<void> {
    try {
      const command = new DeleteCommand({
        TableName: this.tableName,
        Key: { userId },
      });

      await this.client.send(command);
    } catch (error) {
      console.error('DynamoDB delete error:', error);
      // Don't throw on delete errors - just log them
    }
  }

  async cleanup(): Promise<void> {
    try {
      // Scan for expired sessions
      const now = Math.floor(Date.now() / 1000);
      const command = new ScanCommand({
        TableName: this.tableName,
        FilterExpression: 'ttl < :now',
        ExpressionAttributeValues: {
          ':now': now,
        },
      });

      const response = await this.client.send(command);

      if (response.Items && response.Items.length > 0) {
        // Delete expired sessions
        const deletePromises = response.Items.map(item =>
          this.delete(item.userId as string)
        );
        await Promise.all(deletePromises);
        console.log(`Cleaned up ${response.Items.length} expired sessions`);
      }
    } catch (error) {
      console.error('DynamoDB cleanup error:', error);
      // Don't throw on cleanup errors - just log them
    }
  }
}