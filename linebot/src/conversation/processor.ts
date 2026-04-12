/**
 * Message processor - handles message processing based on conversation state
 */

import { LineMessage, ConversationState, ConversationStep, Config } from '../types';
import { ConversationFlow } from './flow';
import { createImageProcessor, ImageProcessor } from '../image';
import { LineApiClient } from '../line/client';
import { GitHubApiClient } from '../github/client';
import { HexoPostGenerator } from '../post/generator';
import { DefaultTagManager } from '../post/tag-manager';
import { generateCommitMessage } from '../github/commit-message';
import { fetchExistingTags } from '../github/tag-extractor';
import { preparePostFiles, getImageRepoPath, toMarkdownImagePath } from '../post/file-placement';
import { logError } from '../errors';

export interface ProcessingResult {
  nextState?: ConversationState;
  responseMessage?: string;
}

export class MessageProcessor {
  private flow: ConversationFlow;
  private imageProcessor: ImageProcessor;
  private lineClient: LineApiClient;
  private githubClient: GitHubApiClient;
  private postGenerator: HexoPostGenerator;
  private tagManager: DefaultTagManager;

  constructor(private config: Config) {
    this.flow = new ConversationFlow();
    this.imageProcessor = createImageProcessor(config);
    this.lineClient = new LineApiClient(config);
    this.githubClient = new GitHubApiClient(config);
    this.postGenerator = new HexoPostGenerator();
    this.tagManager = new DefaultTagManager(config.blog.availableTags);
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
      return await this.handleGlobalCommand(trimmedText, currentState);
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

      // Fetch existing tags from GitHub repo and merge with config tags (Requirement 1.4)
      await this.refreshRepoTags();
      const availableTags = this.tagManager.getAvailableTags();

      const responseMessage = '画像を受信しました！📸\n\n' +
        '次にタグを選択してください。\n' +
        '利用可能なタグ:\n' +
        this.tagManager.formatTagsForSelection(availableTags) + '\n\n' +
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
  private async handleGlobalCommand(command: string, currentState: ConversationState): Promise<ProcessingResult> {
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
        // Requirement 8.3: Cleanup temp storage on cancel
        if (currentState.data.imageUrl) {
          try {
            await this.imageProcessor.cleanupTempStorage(currentState.data.imageUrl);
          } catch (cleanupError) {
            console.warn('Failed to cleanup temp storage on cancel:', cleanupError);
          }
        }

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
   * Includes post-publish confirmation flow (Requirements 9.3, 9.4)
   */
  private handleIdleState(text: string, currentState: ConversationState): ProcessingResult {
    // Post-publish confirmation: "確認" keyword (Requirement 9.3)
    if (this.isConfirmKeyword(text) && currentState.lastPublishedUrl) {
      return {
        responseMessage: `投稿先URL: ${currentState.lastPublishedUrl}\n\n` +
          'カスタムドメインへの反映にはさらに時間がかかる場合があります。'
      };
    }

    // Post-publish confirmation: "見られない" etc. keyword (Requirement 9.4)
    if (this.isTroubleKeyword(text) && currentState.lastPublishedUrl) {
      return {
        responseMessage: 'GitHub Actionsによるページ生成に数分かかります。\n' +
          'しばらくお待ちいただき、再度アクセスしてください。\n\n' +
          `投稿先URL: ${currentState.lastPublishedUrl}`
      };
    }

    return {
      responseMessage: '投稿を作成するには「投稿作成」と送信してください。\n' +
        'ヘルプが必要な場合は「ヘルプ」と送信してください。'
    };
  }

  /**
   * Check if text is a post-publish confirmation keyword
   */
  private isConfirmKeyword(text: string): boolean {
    const keywords = ['確認', 'url', 'リンク', 'アドレス'];
    return keywords.some(kw => text.toLowerCase().includes(kw));
  }

  /**
   * Check if text indicates trouble viewing the published post
   */
  private isTroubleKeyword(text: string): boolean {
    const keywords = ['見られない', '見れない', '表示されない', '開けない', 'アクセスできない', '404', 'not found'];
    return keywords.some(kw => text.toLowerCase().includes(kw));
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
   * Uses TagManager for parsing mixed input (numbers, direct names, new tags)
   * Requirement 1.4: 既存タグ一覧を表示して選択または新規作成を促す
   */
  private handleTagSelection(text: string, currentState: ConversationState): ProcessingResult {
    try {
      const availableTags = this.tagManager.getAvailableTags();
      const selectedTags = this.tagManager.parseSelectedTags(text, availableTags);

      if (selectedTags.length === 0) {
        return {
          responseMessage: '有効なタグを選択してください。\n\n' +
            this.tagManager.formatTagsForSelection(availableTags) + '\n\n' +
            'タグ番号をカンマ区切りで入力してください（例: 1,3,5）\n' +
            '新しいタグを追加する場合は「新規:タグ名」と入力してください。'
        };
      }

      if (!this.tagManager.validateTags(selectedTags)) {
        return {
          responseMessage: 'タグの形式に問題があります。\n' +
            'タグは1〜20文字で、最大10個まで選択できます。\n\n' +
            this.tagManager.formatTagsForSelection(availableTags) + '\n\n' +
            'もう一度タグを入力してください。'
        };
      }

      const nextState = this.flow.transitionToNext(currentState, { tags: selectedTags });

      const confirmationMessage = this.generateConfirmationMessage(nextState);

      return {
        nextState,
        responseMessage: confirmationMessage
      };
    } catch (error) {
      const availableTags = this.tagManager.getAvailableTags();
      return {
        responseMessage: 'タグの選択でエラーが発生しました。\n\n' +
          this.tagManager.formatTagsForSelection(availableTags) + '\n\n' +
          'もう一度タグ番号を入力してください。'
      };
    }
  }

  /**
   * Handle confirmation - publish post to GitHub or cancel
   *
   * Requirements:
   * - 6.1: 成功メッセージにブログURLを含める
   * - 6.4: 処理中通知
   * - 6.6: GitHubコミット完了後にのみ成功メッセージを送信
   * - 9.1: ページ生成に数分かかる旨を伝える
   * - 9.2: カスタムドメイン反映遅延の説明
   */
  private async handleConfirmation(
    text: string,
    currentState: ConversationState
  ): Promise<ProcessingResult> {
    const lowerText = text.toLowerCase().trim();

    if (['はい', 'yes', 'y', '公開', '公開する', '投稿', 'ok'].includes(lowerText)) {
      return await this.publishPost(currentState);
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
   * Publish post to GitHub and return success message
   *
   * Flow:
   * 1. Generate Hexo post from collected data
   * 2. Download image from temp storage if present
   * 3. Prepare commit files (post + image)
   * 4. Await GitHub commit completion
   * 5. Cleanup temp storage (guaranteed via finally)
   * 6. Return success message with blog URL and delay explanations
   *
   * Requirements: 6.1, 6.6, 8.3, 9.1, 9.2
   */
  private async publishPost(currentState: ConversationState): Promise<ProcessingResult> {
    const tempStorageKey = currentState.data.imageUrl;
    try {
      const { data } = currentState;

      // Convert image path for Markdown link
      const postData = { ...data };
      if (postData.imagePath) {
        postData.imagePath = toMarkdownImagePath(postData.imagePath);
      }

      // 1. Generate Hexo post
      const generatedPost = this.postGenerator.generatePost(postData, this.config);

      // 2. Download image from temp storage if present
      let imageBuffer: Buffer | undefined;
      let imageRepoPath: string | undefined;
      if (data.imageUrl && data.imagePath) {
        imageBuffer = await this.imageProcessor.downloadFromTempStorage(data.imageUrl);
        imageRepoPath = getImageRepoPath(data.imagePath);
      }

      // 3. Prepare commit files
      const commitFiles = preparePostFiles(
        generatedPost.filename,
        generatedPost.content,
        imageRepoPath,
        imageBuffer
      );

      // 4. Generate commit message
      const commitMessage = generateCommitMessage(data, generatedPost.filename);

      // 5. Await GitHub commit (Requirement 6.6: must complete before success message)
      const githubFiles = commitFiles.map(f => ({
        path: f.repoPath,
        content: f.content,
        encoding: f.encoding,
      }));
      await this.githubClient.commitMultipleFiles(githubFiles, commitMessage);

      // 6. Transition to IDLE, preserving publish info for post-publish confirmation flow
      const nextState = this.flow.transitionTo(currentState, ConversationStep.IDLE);
      const blogUrl = this.config.blog.baseUrl;
      nextState.lastPublishedUrl = blogUrl;
      nextState.lastPublishedAt = new Date();

      // 7. Build success message (Requirements 6.1, 9.1, 9.2)
      const successMessage =
        '投稿をしました！🎉\n\n' +
        'GitHub Actionsによるページの生成に数分かかるため、しばらくしてから確認してください。\n' +
        'カスタムドメインへの反映にはさらに時間がかかる場合があります。\n\n' +
        `ブログURL: ${blogUrl}`;

      return {
        nextState,
        responseMessage: successMessage,
      };
    } catch (error) {
      logError(error, undefined, { step: 'publishPost', title: currentState.data.title });

      return {
        responseMessage: '投稿の公開中にエラーが発生しました。😢\n\n' +
          'しばらく時間をおいて「はい」と送信して再度お試しください。\n' +
          'それでも解決しない場合は「キャンセル」して最初からやり直してください。',
      };
    } finally {
      // Requirement 8.3: Cleanup temp storage regardless of success/failure
      if (tempStorageKey) {
        try {
          await this.imageProcessor.cleanupTempStorage(tempStorageKey);
        } catch (cleanupError) {
          console.warn('Failed to cleanup temp storage:', cleanupError);
        }
      }
    }
  }

  /**
   * Refresh repo tags from GitHub (best-effort, falls back to config tags only)
   */
  private async refreshRepoTags(): Promise<void> {
    try {
      const repoTags = await fetchExistingTags(this.githubClient);
      this.tagManager.setRepoTags(repoTags);
    } catch (error) {
      console.warn('Failed to fetch repo tags, using config tags only:', error);
    }
  }

  /**
   * Generate confirmation message
   */
  private generateConfirmationMessage(state: ConversationState): string {
    const { title, content, tags } = state.data;

    return '投稿内容を確認してください:\n\n' +
      `📝 タイトル: ${title}\n` +
      `📄 本文: ${content?.substring(0, 100)}${content && content.length > 100 ? '...' : ''}\n` +
      `🏷️ タグ: ${tags.join(', ')}\n` +
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
      '2. ファイル名入力（英数字）\n' +
      '3. 投稿日付入力\n' +
      '4. 本文入力\n' +
      '5. 画像送信\n' +
      '6. タグ選択\n' +
      '7. 確認・公開\n\n' +
      '【対応ファイル形式】\n' +
      '• 画像: JPEG, PNG, GIF\n\n' +
      '何か問題があれば「投稿作成」と送信して最初からやり直してください。';
  }
}