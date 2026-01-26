/**
 * Message processor - handles message processing based on conversation state
 */

import { LineMessage, ConversationState, ConversationStep, Config } from '../types';
import { ConversationFlow } from './flow';
import { createImageProcessor, ImageProcessor } from '../image';
import { LineApiClient } from '../line/client';

export interface ProcessingResult {
  nextState?: ConversationState;
  responseMessage?: string;
}

export class MessageProcessor {
  private flow: ConversationFlow;
  private imageProcessor: ImageProcessor;
  private lineClient: LineApiClient;

  constructor(private config: Config) {
    this.flow = new ConversationFlow();
    this.imageProcessor = createImageProcessor(config);
    this.lineClient = new LineApiClient(config);
  }

  /**
   * Process message based on current conversation state
   */
  async processMessage(
    message: LineMessage,
    currentState: ConversationState,
    _userId: string
  ): Promise<ProcessingResult> {
    try {
      // Handle text messages
      if (message.type === 'text' && message.text !== undefined) {
        return await this.processTextMessage(message.text, currentState, _userId);
      }

      // Handle image messages
      if (message.type === 'image' && message.id) {
        return await this.processImageMessage(message.id, currentState, _userId);
      }

      // Unknown message type
      return {
        responseMessage: 'すみません、そのメッセージタイプには対応していません。\n' +
          'テキストメッセージまたは画像を送信してください。'
      };
    } catch (error) {
      console.error('Error processing message:', error);
      throw error;
    }
  }

  /**
   * Process text message based on current state
   */
  private async processTextMessage(
    text: string,
    currentState: ConversationState,
    _userId: string
  ): Promise<ProcessingResult> {
    const trimmedText = text.trim();

    // Handle global commands
    if (this.isGlobalCommand(trimmedText)) {
      return this.handleGlobalCommand(trimmedText, currentState);
    }

    // Process based on current conversation step
    switch (currentState.step) {
      case ConversationStep.IDLE:
        return this.handleIdleState(trimmedText, currentState);

      case ConversationStep.WAITING_TITLE:
        return this.handleTitleInput(trimmedText, currentState);

      case ConversationStep.WAITING_CONTENT:
        return this.handleContentInput(trimmedText, currentState);

      case ConversationStep.WAITING_IMAGE:
        return this.handleImageWaitingState(trimmedText, currentState);

      case ConversationStep.WAITING_TAGS:
        return this.handleTagSelection(trimmedText, currentState);

      case ConversationStep.CONFIRMING:
        return this.handleConfirmation(trimmedText, currentState);

      default:
        return {
          responseMessage: 'すみません、現在の状態が不明です。「投稿作成」と送信して最初からやり直してください。'
        };
    }
  }

  /**
   * Process image message
   */
  private async processImageMessage(
    imageId: string,
    currentState: ConversationState,
    _userId: string
  ): Promise<ProcessingResult> {
    if (currentState.step !== ConversationStep.WAITING_IMAGE) {
      return {
        responseMessage: '画像は投稿作成中の画像送信段階でのみ受け付けています。\n' +
          '「投稿作成」と送信して最初から始めてください。'
      };
    }

    try {
      // Download image from LINE
      const imageBuffer = await this.lineClient.downloadImage(imageId);

      // Process image (validate, resize, upload to temp storage)
      const processedImage = await this.imageProcessor.processImage(imageBuffer);

      // Store processed image information
      const nextState = this.flow.transitionToNext(currentState, {
        imageUrl: processedImage.tempStorageKey,
        imagePath: processedImage.relativePath
      });

      const responseMessage = '画像を受信しました！📸\n\n' +
        '次にタグを選択してください。\n' +
        '利用可能なタグ:\n' +
        this.formatAvailableTags() + '\n\n' +
        'タグ番号をカンマ区切りで入力してください（例: 1,3,5）\n' +
        '新しいタグを追加する場合は「新規:タグ名」と入力してください。';

      return {
        nextState,
        responseMessage
      };
    } catch (error) {
      console.error('Error processing image:', error);

      // Provide user-friendly error message based on error type
      let errorMessage = '画像の処理中にエラーが発生しました。もう一度画像を送信してください。';

      if (error instanceof Error) {
        // Check if it's a validation error (user-friendly message available)
        if (error.message.includes('サポートされていない') ||
            error.message.includes('大きすぎます') ||
            error.message.includes('検証に失敗')) {
          errorMessage = error.message + '\n\n対応形式: JPEG, PNG, WebP, GIF（最大10MB）';
        }
      }

      return {
        responseMessage: errorMessage
      };
    }
  }

  /**
   * Check if text is a global command
   */
  private isGlobalCommand(text: string): boolean {
    const globalCommands = [
      '投稿作成', 'ヘルプ', 'help', 'キャンセル', 'cancel', 'やめる', '中止'
    ];
    return globalCommands.includes(text.toLowerCase());
  }

  /**
   * Handle global commands
   */
  private handleGlobalCommand(command: string, currentState: ConversationState): ProcessingResult {
    const lowerCommand = command.toLowerCase();

    if (lowerCommand === '投稿作成') {
      const nextState = this.flow.transitionTo(currentState, ConversationStep.WAITING_TITLE);
      return {
        nextState,
        responseMessage: '新しいブログ投稿を作成しましょう！✨\n\n' +
          'まず、投稿のタイトルを入力してください。'
      };
    }

    if (['ヘルプ', 'help'].includes(lowerCommand)) {
      return {
        responseMessage: this.getHelpMessage()
      };
    }

    if (['キャンセル', 'cancel', 'やめる', '中止'].includes(lowerCommand)) {
      if (this.flow.canCancel(currentState.step)) {
        const nextState = this.flow.transitionTo(currentState, ConversationStep.IDLE);
        return {
          nextState,
          responseMessage: '投稿作成をキャンセルしました。\n\n' +
            '新しい投稿を作成するには「投稿作成」と送信してください。'
        };
      } else {
        return {
          responseMessage: 'キャンセルできる投稿作成が進行中ではありません。'
        };
      }
    }

    return {
      responseMessage: '不明なコマンドです。「ヘルプ」と送信してコマンド一覧を確認してください。'
    };
  }

  /**
   * Handle IDLE state
   */
  private handleIdleState(_text: string, _currentState: ConversationState): ProcessingResult {
    return {
      responseMessage: '投稿を作成するには「投稿作成」と送信してください。\n' +
        'ヘルプが必要な場合は「ヘルプ」と送信してください。'
    };
  }

  /**
   * Handle title input
   */
  private handleTitleInput(text: string, currentState: ConversationState): ProcessingResult {
    if (text.length < 1) {
      return {
        responseMessage: 'タイトルを入力してください。'
      };
    }

    if (text.length > 100) {
      return {
        responseMessage: 'タイトルが長すぎます。100文字以内で入力してください。'
      };
    }

    const nextState = this.flow.transitionToNext(currentState, { title: text });

    return {
      nextState,
      responseMessage: `タイトル: "${text}"\n\n` +
        '次に、投稿の本文を入力してください。'
    };
  }

  /**
   * Handle content input
   */
  private handleContentInput(text: string, currentState: ConversationState): ProcessingResult {
    if (text.length < 1) {
      return {
        responseMessage: '本文を入力してください。'
      };
    }

    if (text.length > 5000) {
      return {
        responseMessage: '本文が長すぎます。5000文字以内で入力してください。'
      };
    }

    const nextState = this.flow.transitionToNext(currentState, { content: text });

    return {
      nextState,
      responseMessage: '本文を受信しました！📝\n\n' +
        '次に、投稿に使用する画像を送信してください。\n' +
        '（JPEG、PNG、GIF形式に対応しています）'
    };
  }

  /**
   * Handle image waiting state (text received instead of image)
   */
  private handleImageWaitingState(_text: string, _currentState: ConversationState): ProcessingResult {
    return {
      responseMessage: '画像を送信してください。\n' +
        'テキストではなく、画像ファイルを送信してください。\n\n' +
        '投稿をキャンセルする場合は「キャンセル」と送信してください。'
    };
  }

  /**
   * Handle tag selection
   */
  private handleTagSelection(text: string, currentState: ConversationState): ProcessingResult {
    try {
      const selectedTags = this.parseTagSelection(text);

      if (selectedTags.length === 0) {
        return {
          responseMessage: '有効なタグを選択してください。\n\n' +
            this.formatAvailableTags() + '\n\n' +
            'タグ番号をカンマ区切りで入力してください（例: 1,3,5）'
        };
      }

      const nextState = this.flow.transitionToNext(currentState, { tags: selectedTags });

      const confirmationMessage = this.generateConfirmationMessage(nextState);

      return {
        nextState,
        responseMessage: confirmationMessage
      };
    } catch (error) {
      return {
        responseMessage: 'タグの選択でエラーが発生しました。\n\n' +
          this.formatAvailableTags() + '\n\n' +
          'もう一度タグ番号を入力してください。'
      };
    }
  }

  /**
   * Handle confirmation
   */
  private handleConfirmation(text: string, currentState: ConversationState): ProcessingResult {
    const lowerText = text.toLowerCase().trim();

    if (['はい', 'yes', 'y', '公開', '投稿', 'ok'].includes(lowerText)) {
      // TODO: Implement actual blog post creation
      const nextState = this.flow.transitionTo(currentState, ConversationStep.IDLE);

      return {
        nextState,
        responseMessage: '投稿を公開しました！🎉\n\n' +
          `ブログURL: ${this.config.blog.baseUrl}\n\n` +
          '新しい投稿を作成するには「投稿作成」と送信してください。'
      };
    }

    if (['いいえ', 'no', 'n', 'キャンセル', '修正'].includes(lowerText)) {
      const nextState = this.flow.transitionTo(currentState, ConversationStep.IDLE);

      return {
        nextState,
        responseMessage: '投稿をキャンセルしました。\n\n' +
          '新しい投稿を作成するには「投稿作成」と送信してください。'
      };
    }

    return {
      responseMessage: '「はい」または「いいえ」で回答してください。\n\n' +
        '投稿を公開する場合は「はい」\n' +
        'キャンセルする場合は「いいえ」と送信してください。'
    };
  }

  /**
   * Parse tag selection from user input
   */
  private parseTagSelection(text: string): string[] {
    const availableTags = this.config.blog.availableTags;
    const selectedTags: string[] = [];

    // Handle new tag creation
    if (text.startsWith('新規:')) {
      const newTag = text.substring(3).trim();
      if (newTag.length > 0 && newTag.length <= 20) {
        return [newTag];
      }
      return [];
    }

    // Parse tag numbers
    const tagNumbers = text.split(',').map(num => parseInt(num.trim()));

    for (const num of tagNumbers) {
      if (num >= 1 && num <= availableTags.length) {
        const tag = availableTags[num - 1];
        if (!selectedTags.includes(tag)) {
          selectedTags.push(tag);
        }
      }
    }

    return selectedTags;
  }

  /**
   * Format available tags for display
   */
  private formatAvailableTags(): string {
    return this.config.blog.availableTags
      .map((tag, index) => `${index + 1}. ${tag}`)
      .join('\n');
  }

  /**
   * Generate confirmation message
   */
  private generateConfirmationMessage(state: ConversationState): string {
    const { title, content, tags } = state.data;

    return '投稿内容を確認してください:\n\n' +
      `📝 タイトル: ${title}\n\n` +
      `📄 本文: ${content?.substring(0, 100)}${content && content.length > 100 ? '...' : ''}\n\n` +
      `🏷️ タグ: ${tags.join(', ')}\n\n` +
      `📸 画像: 添付済み\n\n` +
      'この内容で投稿を公開しますか？\n' +
      '「はい」で公開、「いいえ」でキャンセルしてください。';
  }

  /**
   * Get help message
   */
  private getHelpMessage(): string {
    return 'つぽブログボット ヘルプ 📚\n\n' +
      '【基本コマンド】\n' +
      '• 投稿作成 - 新しいブログ投稿を作成\n' +
      '• ヘルプ - このヘルプを表示\n' +
      '• キャンセル - 投稿作成を中止\n\n' +
      '【投稿作成の流れ】\n' +
      '1. タイトル入力\n' +
      '2. 本文入力\n' +
      '3. 画像送信\n' +
      '4. タグ選択\n' +
      '5. 確認・公開\n\n' +
      '【対応ファイル形式】\n' +
      '• 画像: JPEG, PNG, GIF\n\n' +
      '何か問題があれば「投稿作成」と送信して最初からやり直してください。';
  }
}