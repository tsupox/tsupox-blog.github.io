# Implementation Plan: LINE Bot Blog Publisher

## Overview

LINE Bot経由でHexoブログを自動更新するサーバーレスシステムの実装。TypeScriptを使用してAWS LambdaまたはVercel Functionsで動作する対話型ボットを構築し、GitHub APIを通じてブログリポジトリを自動更新する。

## Tasks

- [x] 1. プロジェクト基盤とコア型定義の設定
  - TypeScriptプロジェクトの初期化とビルド設定
  - 基本的な型定義とインターフェースの作成
  - 環境変数管理とコンフィグ設定
  - _Requirements: 7.1, 7.4_

- [x] 2. LINE Webhook処理の実装
  - [x] 2.1 Webhookハンドラーとイベント解析の実装
    - LINE Messaging APIのWebhook受信処理
    - イベント解析とメッセージ型判定
    - _Requirements: 1.2, 1.3_

  - [ ]* 2.2 Webhook署名検証のプロパティテスト
    - **Property 7: セキュリティ検証**
    - **Validates: Requirements 7.2**

  - [x] 2.3 LINE APIクライアントの実装
    - メッセージ送信とリプライ機能
    - 画像ダウンロード機能
    - _Requirements: 1.2, 1.3_

- [x] 3. セッション管理システムの実装
  - [x] 3.1 DynamoDB/Vercel KVセッションストレージの実装
    - セッション状態の永続化とTTL設定
    - CRUD操作とIDLE状態リセット機能
    - _Requirements: 2.1, 2.2, 2.5_

  - [ ]* 3.2 セッション永続化のプロパティテスト
    - **Property 3: セッション永続化**
    - **Validates: Requirements 2.1, 2.5**

  - [x] 3.3 対話フロー管理の実装
    - 状態遷移ロジックとフロー制御
    - ユーザー入力の検証と処理
    - _Requirements: 1.2, 2.2_

- [ ] 4. Checkpoint - 基本フロー動作確認
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. 画像処理システムの実装
  - [x] 5.1 画像ダウンロードと検証の実装
    - LINE APIからの画像取得
    - 画像形式とサイズの検証
    - _Requirements: 3.1, 3.2_

  - [x] 5.2 S3/Vercel Blob一時保存の実装
    - 画像の一時保存とクリーンアップ
    - 一意ファイル名生成とパス管理
    - _Requirements: 3.1, 3.4_

  - [ ]* 5.3 画像処理パイプラインのプロパティテスト
    - **Property 2: 画像処理パイプライン**
    - **Validates: Requirements 1.3, 3.1, 3.2, 3.3, 3.4**

  - [x] 5.4 画像リサイズとエラーハンドリング
    - 大きな画像のリサイズ処理
    - 処理失敗時のフォールバック
    - _Requirements: 3.3, 3.5_

- [ ] 6. ブログ投稿生成システムの実装
  - [x] 6.1 Hexo投稿ジェネレーターの実装
    - テンプレート参照とMarkdown生成
    - Front-matterとメタデータ生成
    - _Requirements: 4.1, 4.2_

  - [x] 6.2 タグ管理システムの実装
    - 既存タグの取得と表示
    - タグ選択とfront-matter統合
    - _Requirements: 4.3_

  - [ ]* 6.3 投稿生成統合性のプロパティテスト
    - **Property 4: 投稿生成統合性**
    - **Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5, 4.6**

  - [x] 6.4 画像リンクとファイル配置の実装
    - Markdown画像リンク生成
    - UTF-8エンコーディングとファイル配置
    - _Requirements: 4.4, 4.5, 4.6_

- [x] 7. GitHub統合システムの実装
  - [x] 7.1 GitHub APIクライアントの実装
    - 認証とリポジトリ操作
    - ファイル作成とコミット機能
    - _Requirements: 5.1, 5.2, 7.3_

  - [x] 7.2 既存タグ取得機能の実装
    - リポジトリからのタグ抽出
    - タグ管理システムとの統合
    - _Requirements: 4.3_

  - [ ]* 7.3 GitHub操作原子性のプロパティテスト
    - **Property 5: GitHub操作原子性**
    - **Validates: Requirements 5.1, 5.2, 5.3**

  - [x] 7.4 コミットメッセージ生成とエラーハンドリング
    - 意味のあるコミットメッセージ生成
    - GitHub API障害時のエラー処理
    - _Requirements: 5.3, 5.5_

- [x] 8. エラーハンドリングと通知システムの実装
  - [x] 8.1 多層エラーハンドリングの実装
    - ユーザーエラー、システムエラー、リソースエラーの分類
    - 日本語エラーメッセージとログ記録
    - _Requirements: 6.2, 6.3_

  - [ ]* 8.2 エラーハンドリング多層防御のプロパティテスト
    - **Property 6: エラーハンドリング多層防御**
    - **Validates: Requirements 6.2, 6.3**

  - [x] 8.3 投稿完了メッセージとGitHubコミット順序制御の実装
    - GitHubコミット・プッシュ完了を `await` で待機してから成功メッセージを送信
    - 成功メッセージにブログURL、ページ生成遅延説明、カスタムドメイン反映遅延説明を含める
    - 処理中通知と進捗表示
    - _Requirements: 6.1, 6.4, 6.6, 9.1, 9.2_

  - [x] 8.4 成功メッセージ送信順序のプロパティテスト
    - **Property 11: 成功メッセージ送信順序**
    - **Validates: Requirements 6.6**

  - [x] 8.5 成功時通知完全性のプロパティテスト
    - **Property 10: 成功時通知完全性**
    - **Validates: Requirements 6.1, 9.1, 9.2**

- [x] 9. 投稿後確認フローの実装
  - [x] 9.1 セッション型拡張（lastPublishedUrl / lastPublishedAt）
    - `ConversationState` に `lastPublishedUrl` と `lastPublishedAt` フィールドを追加
    - 投稿完了時にIDLE状態へリセットする際、これらのフィールドを保持するよう `resetToIdle` を修正
    - _Requirements: 9.1, 9.2_

  - [x] 9.2 投稿後確認キーワード応答の実装
    - IDLE状態で「確認」キーワード受信時に `lastPublishedUrl` からURL再案内
    - 「見られない」等のキーワード受信時にGitHub Actionsページ生成遅延の説明を返信
    - `handleIdleState` メソッドの拡張（processor.ts）
    - _Requirements: 9.3, 9.4_

  - [ ]* 9.3 投稿後確認フロー応答のプロパティテスト
    - **Property 12: 投稿後確認フロー応答**
    - **Validates: Requirements 9.3, 9.4**

- [x] 10. Checkpoint - 投稿フローと確認フロー動作確認
  - Ensure all tests pass, ask the user if questions arise.

- [x] 11. 統合とワイヤリング
  - [x] 11.1 全コンポーネントの統合
    - メインハンドラーでの全機能統合
    - 対話フローの完全実装
    - _Requirements: 1.1, 1.4, 1.5, 1.6_

  - [ ]* 11.2 対話フロー状態遷移のプロパティテスト
    - **Property 1: 対話フロー状態遷移**
    - **Validates: Requirements 1.2, 2.2**

  - [x] 11.3 サーバーレス制約の実装
    - ステートレス処理とリソースクリーンアップ
    - 並行処理安全性の確保
    - _Requirements: 8.2, 8.3, 8.4_

  - [ ]* 11.4 サーバーレス制約遵守のプロパティテスト
    - **Property 8: サーバーレス制約遵守**
    - **Validates: Requirements 8.2, 8.3, 8.4**

- [ ]* 12. LINE UI操作による対話フローの実装（オプション）
  - [ ]* 12.1 LINE UI Builder モジュールの作成
    - 既存 `LineApiClient` の Quick Reply メソッドを LINE UI Builder に統合・拡張
    - Flex Message 構築関数の実装（タグ選択用、投稿プレビュー用）
    - _Requirements: 10.1, 10.2_

  - [ ]* 12.2 タグ選択UIの実装（Quick Reply / Flex Message）
    - 既存タグをボタンとして表示する Quick Reply または Flex Message の生成
    - ボタン選択とテキスト入力（「新規:タグ名」形式）の同時受付ロジック
    - `isTagButtonSelection` による入力判定と `parseSelectedTags` の拡張
    - _Requirements: 10.2, 10.3_

  - [ ]* 12.3 タグ選択UIのタグ網羅性のプロパティテスト
    - **Property 13: タグ選択UIのタグ網羅性（オプション）**
    - **Validates: Requirements 10.2**

  - [ ]* 12.4 タグ入力の二重受付のプロパティテスト
    - **Property 14: タグ入力の二重受付（オプション）**
    - **Validates: Requirements 10.3**

  - [ ]* 12.5 確認フェーズQuick Replyの実装
    - 「公開する」「キャンセル」ボタンの Quick Reply 表示
    - 確認フェーズでの Quick Reply 付きメッセージ送信
    - _Requirements: 10.4_

  - [ ]* 12.6 Rich Menu 投稿開始ボタンの設定
    - Rich Menu ペイロード定義と「投稿作成」ボタン配置
    - LINE API を使用した Rich Menu の登録処理
    - _Requirements: 10.1_

- [ ] 13. 包括的テストとバリデーション
  - [ ]* 13.1 無効入力拒否のプロパティテスト
    - **Property 9: 無効入力拒否**
    - **Validates: Requirements 1.6, 3.5, 5.5, 6.5**

  - [ ]* 13.2 統合テストの実装
    - エンドツーエンドフローのテスト（投稿後確認フロー含む）
    - モックサービスを使用した統合テスト
    - _Requirements: 全要件_

- [ ] 14. Final checkpoint - 全機能テスト完了
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties with minimum 100 iterations
- Unit tests validate specific examples and edge cases
- TypeScript implementation targets AWS Lambda and Vercel Functions compatibility
- Task 12（LINE UI操作）は Requirement 10（オプション）に対応し、全サブタスクがオプション
- 投稿完了メッセージは GitHub コミット完了後にのみ送信される（Requirement 6.6）
