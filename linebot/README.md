# LINE Bot Blog Publisher

LINE Bot経由でHexoブログを自動更新するサーバーレスシステム（AWS Lambda版）

## 概要

このシステムは、LINEアプリから画像とテキストを送信することで、自動的にHexoブログの投稿を作成・公開できるボットです。

## 機能

- 📱 LINE経由での対話型ブログ投稿作成
- 🖼️ 画像の自動処理とリサイズ
- 🏷️ 既存タグの選択と新規タグ作成
- 📝 Hexo形式のMarkdown自動生成
- 🚀 GitHubへの自動コミット・プッシュ
- ☁️ AWS Lambda サーバーレス環境対応

## セットアップ手順

### 1. 前提条件

- Node.js 18以上
- LINE Developersアカウント
- GitHubアカウントとPersonal Access Token
- AWSアカウント

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

# AWS設定
DYNAMODB_TABLE_NAME=linebot-sessions
S3_BUCKET_NAME=linebot-temp-images-your-unique-id
AWS_REGION=us-east-1
```

### 6. AWS Lambda デプロイ

#### オプション A: CloudFormation（推奨）

CloudFormationを使用すると、すべてのAWSリソースを自動的に作成できます。

詳細な手順は [CLOUDFORMATION_DEPLOY.md](./CLOUDFORMATION_DEPLOY.md) を参照してください。

```bash
# パラメータファイルを作成
cp cloudformation-parameters.example.json cloudformation-parameters.json
# cloudformation-parameters.jsonを編集して実際の値を設定

# CloudFormationスタックを作成
aws cloudformation create-stack \
  --stack-name linebot-blog-publisher \
  --template-body file://cloudformation-template.yaml \
  --parameters file://cloudformation-parameters.json \
  --capabilities CAPABILITY_NAMED_IAM \
  --region us-east-1

# Lambda関数コードをデプロイ
npm run build
# デプロイパッケージ作成とアップロード（詳細はCLOUDFORMATION_DEPLOY.md参照）
```

#### オプション B: 手動セットアップ

手動でAWSリソースを作成する場合は [AWS_LAMBDA_SETUP.md](./AWS_LAMBDA_SETUP.md) を参照してください。

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
- **バックエンド**: AWS Lambda (Node.js/TypeScript)
- **セッション管理**: DynamoDB
- **画像保存**: S3
- **ブログ更新**: GitHub API

## トラブルシューティング

### よくある問題

1. **Webhook接続エラー**
   - API Gateway URLが正しく設定されているか確認
   - 環境変数が正しく設定されているか確認

2. **画像アップロードエラー**
   - 画像サイズが制限内か確認（10MB以下推奨）
   - 対応形式: JPEG, PNG, GIF

3. **GitHub連携エラー**
   - Personal Access Tokenの権限を確認
   - リポジトリへのアクセス権限を確認

## ライセンス

MIT License