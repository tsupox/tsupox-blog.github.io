# LINE Bot Blog Publisher

LINE Bot経由でHexoブログを自動更新するサーバーレスシステム

## 概要

このシステムは、LINEアプリから画像とテキストを送信することで、自動的にHexoブログの投稿を作成・公開できるボットです。

## 機能

- 📱 LINE経由での対話型ブログ投稿作成
- 🖼️ 画像の自動処理とリサイズ
- 🏷️ 既存タグの選択と新規タグ作成
- 📝 Hexo形式のMarkdown自動生成
- 🚀 GitHubへの自動コミット・プッシュ
- ☁️ サーバーレス環境対応（AWS Lambda / Vercel Functions）

## セットアップ手順

### 1. 前提条件

- Node.js 18以上
- LINE Developersアカウント
- GitHubアカウントとPersonal Access Token
- Vercelアカウント（Vercel Functionsを使用する場合）

### 2. LINE Bot設定

1. [LINE Developers Console](https://developers.line.biz/)にアクセス
2. 新しいプロバイダーとチャンネルを作成
3. Messaging APIを有効化
4. Channel SecretとChannel Access Tokenを取得

### 3. GitHub設定

1. GitHubでPersonal Access Tokenを作成
   - Settings > Developer settings > Personal access tokens > Tokens (classic)
   - 必要な権限: `repo` (Full control of private repositories)
2. ブログリポジトリへのアクセス権限を確認

### 4. プロジェクト設定

```bash
# 依存関係のインストール
cd linebot
npm install

# 環境変数の設定
cp .env.example .env
# .envファイルを編集して必要な値を設定
```

### 5. 環境変数設定

`.env`ファイルに以下の値を設定：

```env
# LINE Bot設定
LINE_CHANNEL_SECRET=your_channel_secret
LINE_CHANNEL_ACCESS_TOKEN=your_access_token

# GitHub設定
GITHUB_TOKEN=your_github_token
GITHUB_OWNER=your_username
GITHUB_REPO=your_blog_repo

# ブログ設定
BLOG_BASE_URL=https://your-blog.com
```

### 6. Vercelデプロイ

```bash
# Vercel CLIのインストール（初回のみ）
npm install -g vercel

# デプロイ
vercel

# 環境変数の設定（Vercelダッシュボードまたはコマンドライン）
vercel env add LINE_CHANNEL_SECRET
vercel env add LINE_CHANNEL_ACCESS_TOKEN
# ... 他の環境変数も同様に追加
```

### 7. LINE Webhook設定

1. LINE Developers Consoleでチャンネル設定を開く
2. Webhook URLを設定: `https://your-vercel-app.vercel.app/webhook`
3. Webhookの使用を有効化

## 開発

```bash
# 開発サーバー起動
npm run dev

# ビルド
npm run build

# テスト実行
npm test

# リント
npm run lint
```

## 使用方法

1. LINE Botを友だち追加
2. 「投稿作成」と送信して投稿フローを開始
3. 指示に従ってタイトル、本文、画像、タグを設定
4. 確認後、自動的にブログに投稿される

## アーキテクチャ

- **フロントエンド**: LINE Messaging API
- **バックエンド**: Vercel Functions (Node.js/TypeScript)
- **セッション管理**: Vercel KV
- **画像保存**: Vercel Blob Storage
- **ブログ更新**: GitHub API

## トラブルシューティング

### よくある問題

1. **Webhook接続エラー**
   - Vercel URLが正しく設定されているか確認
   - 環境変数が正しく設定されているか確認

2. **画像アップロードエラー**
   - 画像サイズが制限内か確認（10MB以下推奨）
   - 対応形式: JPEG, PNG, GIF

3. **GitHub連携エラー**
   - Personal Access Tokenの権限を確認
   - リポジトリへのアクセス権限を確認

## ライセンス

MIT License