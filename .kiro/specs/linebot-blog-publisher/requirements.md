# Requirements Document

## Introduction

LINE Bot経由でHexoブログを自動更新するシステム。ユーザーがスマートフォンのLINEアプリから画像とテキストを送信することで、自動的にHexoの投稿形式に変換し、GitHubリポジトリにコミット・プッシュしてブログを更新する。

## Glossary

- **LINE_Bot**: LINE Messaging APIを使用したチャットボット
- **Hexo_Generator**: Hexo静的サイトジェネレーターのブログ投稿生成機能
- **GitHub_API**: GitHubリポジトリへのファイル操作を行うAPI
- **Conversation_Manager**: ユーザーとの対話フローを管理する機能
- **Session_State**: ユーザーの投稿作成セッション状態を保持する機能
- **Image_Handler**: 画像ファイルの処理と保存を行う機能
- **Post_Generator**: Hexo形式のMarkdownファイルを生成する機能
- **Tag_Manager**: 既存タグの管理と新規タグ作成を行う機能
- **Repository_Manager**: GitHubリポジトリへのコミット・プッシュを管理する機能

## Requirements

### Requirement 1: 対話型ブログ投稿作成

**User Story:** ユーザーとして、LINEボットとの対話を通じてブログ投稿を作成したい。そうすることで、段階的に投稿内容を構築できる。

#### Acceptance Criteria

1. WHEN ユーザーが投稿作成を開始する THEN THE LINE_Bot SHALL 投稿作成フローを開始してタイトル入力を促す
2. WHEN ユーザーがテキストメッセージを送信する THEN THE LINE_Bot SHALL メッセージを受信して現在のフロー状態に応じて処理する
3. WHEN ユーザーが画像を送信する THEN THE LINE_Bot SHALL 画像を受信してダウンロードし、次のステップを案内する
4. WHEN タグ選択フェーズに入る THEN THE LINE_Bot SHALL 既存タグ一覧を表示して選択または新規作成を促す
5. WHEN ユーザーが投稿内容を確認する THEN THE LINE_Bot SHALL プレビューを表示して公開確認を求める
6. WHEN 無効な入力が送信される THEN THE LINE_Bot SHALL 適切なガイダンスメッセージを返信する

### Requirement 2: セッション状態管理

**User Story:** ユーザーとして、投稿作成中に中断しても状態が保持されることを期待する。そうすることで、安心して段階的に投稿を作成できる。

#### Acceptance Criteria

1. WHEN 投稿作成フローが開始される THEN THE Session_State SHALL 単一ユーザーのセッションを作成して状態を初期化する
2. WHEN ユーザーが入力を送信する THEN THE Session_State SHALL 現在の状態を更新して次のステップに進む
3. WHEN セッションがタイムアウトする THEN THE Session_State SHALL セッションを削除してユーザーに通知する
4. WHEN ユーザーが投稿をキャンセルする THEN THE Session_State SHALL セッションを削除して初期状態に戻る
5. WHEN システムが再起動する THEN THE Session_State SHALL 永続化されたセッション状態を復元する

### Requirement 3: 画像処理と保存

**User Story:** ユーザーとして、送信した画像がブログで適切に表示されることを期待する。そうすることで、視覚的に魅力的な投稿を作成できる。

#### Acceptance Criteria

1. WHEN 画像が受信される THEN THE Image_Handler SHALL 画像をダウンロードして一意のファイル名を生成する
2. WHEN 画像ファイルが処理される THEN THE Image_Handler SHALL 適切な形式（JPEG、PNG、GIF）であることを検証する
3. WHEN 画像サイズが大きすぎる THEN THE Image_Handler SHALL 適切なサイズにリサイズする
4. WHEN 画像の保存先を決定する THEN THE Image_Handler SHALL source/images/ディレクトリ構造に従って保存パスを生成する
5. WHEN 画像処理に失敗する THEN THE Image_Handler SHALL エラーログを記録してデフォルト画像を使用する

### Requirement 4: ブログ投稿生成

**User Story:** ユーザーとして、送信したコンテンツが適切なHexo投稿形式に変換されることを期待する。そうすることで、ブログの一貫性を保てる。

#### Acceptance Criteria

1. WHEN テキストと画像が処理される THEN THE Post_Generator SHALL source/_drafts/内のテンプレートファイルを参考にしてMarkdownファイルを生成する
2. WHEN 投稿メタデータを生成する THEN THE Post_Generator SHALL 日付形式（YYYYMMDD）を含むファイル名を作成する
3. WHEN タグが選択される THEN THE Post_Generator SHALL 選択されたタグを投稿のfront-matterに追加する
4. WHEN 画像参照を作成する THEN THE Post_Generator SHALL 正しい相対パスでMarkdown画像リンクを生成する
5. WHEN 日本語テキストを処理する THEN THE Post_Generator SHALL UTF-8エンコーディングで正しく保存する
6. WHEN ファイルを保存する THEN THE Post_Generator SHALL source/_posts/ディレクトリに投稿ファイルを配置する

### Requirement 5: GitHubリポジトリ操作

**User Story:** ユーザーとして、作成された投稿が自動的にGitHubリポジトリに反映されることを期待する。そうすることで、手動でのファイル操作が不要になる。

#### Acceptance Criteria

1. WHEN 投稿ファイルが生成される THEN THE Repository_Manager SHALL GitHubリポジトリのsource/_posts/ディレクトリにファイルを追加する
2. WHEN 画像ファイルが処理される THEN THE Repository_Manager SHALL source/images/ディレクトリに画像をコミットする
3. WHEN ファイルをコミットする THEN THE Repository_Manager SHALL 意味のあるコミットメッセージを生成する
4. WHEN リポジトリ操作が完了する THEN THE Repository_Manager SHALL 既存の.github/pages.ymlワークフローによる自動デプロイをトリガーする
5. WHEN リポジトリ操作に失敗する THEN THE Repository_Manager SHALL エラーを記録してユーザーに通知する

### Requirement 6: エラーハンドリングと通知

**User Story:** ユーザーとして、処理の成功・失敗を適切に通知されたい。そうすることで、問題が発生した場合に対処できる。

#### Acceptance Criteria

1. WHEN 投稿処理が成功する THEN THE LINE_Bot SHALL 成功メッセージとブログURLをユーザーに送信する
2. WHEN 処理中にエラーが発生する THEN THE LINE_Bot SHALL 分かりやすいエラーメッセージを日本語で返信する
3. WHEN システムエラーが発生する THEN THE LINE_Bot SHALL ログに詳細を記録して管理者に通知する
4. WHEN 処理に時間がかかる THEN THE LINE_Bot SHALL 処理中であることをユーザーに通知する
5. WHEN 不正なアクセスを検出する THEN THE LINE_Bot SHALL アクセスをブロックしてログに記録する

### Requirement 7: 設定管理とセキュリティ

**User Story:** システム管理者として、安全で設定可能なシステムを運用したい。そうすることで、セキュリティを保ちながら柔軟な運用ができる。

#### Acceptance Criteria

1. WHEN システムが起動する THEN THE LINE_Bot SHALL 必要な環境変数とAPIキーが設定されていることを検証する
2. WHEN LINE Webhookを受信する THEN THE LINE_Bot SHALL 署名検証によってリクエストの正当性を確認する
3. WHEN GitHubAPIを使用する THEN THE Repository_Manager SHALL 適切な権限を持つアクセストークンを使用する
4. WHEN 設定を変更する THEN THE LINE_Bot SHALL 環境変数から設定を動的に読み込む
5. WHEN 機密情報を扱う THEN THE LINE_Bot SHALL APIキーやトークンを安全に管理する

### Requirement 8: サーバーレス実装

**User Story:** システム管理者として、コスト効率的で保守しやすいサーバーレス構成を使用したい。そうすることで、運用コストを最小化できる。

#### Acceptance Criteria

1. WHEN システムをデプロイする THEN THE LINE_Bot SHALL AWS LambdaまたはVercel Functionsで動作する
2. WHEN リクエストを処理する THEN THE LINE_Bot SHALL ステートレスな方式で各リクエストを独立して処理する
3. WHEN 一時ファイルを扱う THEN THE LINE_Bot SHALL 関数実行終了時に適切にクリーンアップする
4. WHEN 同時リクエストを処理する THEN THE LINE_Bot SHALL 複数のリクエストを並行して安全に処理する
5. WHEN 関数がタイムアウトする THEN THE LINE_Bot SHALL 適切なエラーハンドリングでユーザーに通知する