# ブログ投稿機能のテストガイド

## 概要

このガイドでは、LINE Botを使わずにブログ投稿機能をテストする方法を説明します。

## 前提条件

### 必要なデータ

1. **DynamoDB セッションデータ**
   - テーブル: `linebot-blog-publisher-sessions`
   - 必要なフィールド: `title`, `content`, `imageUrl`, `imagePath`, `tags`

2. **S3 一時画像**
   - バケット: `linebot-blog-publisher-temp-images-{account-id}`
   - パス: `temp-images/{timestamp}-{filename}`

3. **環境変数**
   - `.env` ファイルに全ての必要な環境変数が設定されていること

## テスト方法

### 方法1: テストスクリプトを使用（推奨）

#### ステップ1: 環境変数の確認

`.env` ファイルが正しく設定されているか確認：

```bash
cd linebot
cat .env
```

必要な環境変数：
- `LINE_CHANNEL_SECRET`
- `LINE_CHANNEL_ACCESS_TOKEN`
- `GITHUB_TOKEN`
- `GITHUB_OWNER`
- `GITHUB_REPO`
- `BLOG_BASE_URL`
- `DYNAMODB_TABLE_NAME`
- `S3_BUCKET_NAME`
- `APP_AWS_REGION`

#### ステップ2: S3画像の確認

テスト用の画像がS3に存在することを確認：

```bash
aws s3 ls s3://linebot-blog-publisher-temp-images-325278861250/temp-images/1772177067730-2026-02-27T07-24-27-409Z-6c1mmo.jpeg
```

画像が存在しない場合は、任意の画像をアップロード：

```bash
aws s3 cp your-test-image.jpg s3://linebot-blog-publisher-temp-images-325278861250/temp-images/1772177067730-2026-02-27T07-24-27-409Z-6c1mmo.jpeg
```

#### ステップ3: テストスクリプトの実行

```bash
npm run test:blog-posting
```

#### 期待される出力

```
=== Blog Posting Test ===

1. Loading configuration...
✓ Configuration loaded
  - GitHub: {owner}/{repo}
  - Blog URL: https://your-blog.com
  - S3 Bucket: linebot-blog-publisher-temp-images-325278861250
  - DynamoDB Table: linebot-blog-publisher-sessions

2. Creating test conversation state...
✓ Test state created
  - Title: ねこのひ
  - Content: 2026/2/22 に書いたもの
  - Tags: お絵かき, ねこ劇場, 超落書きシリーズ
  - Image: temp-images/1772177067730-2026-02-27T07-24-27-409Z-6c1mmo.jpeg

3. Initializing message processor...
✓ Message processor initialized

4. Simulating user confirmation ("はい")...
✓ Processing completed

=== Results ===
Response: 投稿を公開しました！🎉

ブログURL: https://your-blog.com

新しい投稿を作成するには「投稿作成」と送信してください。

Next state: idle

=== Test Completed Successfully ===

Next steps:
1. Check your GitHub repository for the new blog post
2. Verify the image was uploaded correctly
3. Check that the S3 temporary image was cleaned up
```

#### ステップ4: 結果の確認

1. **GitHubリポジトリを確認**
   ```bash
   # ブラウザでGitHubリポジトリを開く
   # または git pull して確認
   git pull origin main
   ls source/_posts/20260227-*.md
   ls source/images/2026-rakugaki/
   ```

2. **コミットログを確認**
   ```bash
   git log -1 --stat
   ```

   期待される出力：
   ```
   commit xxxxx
   Author: LINE Bot
   Date: ...

   Add blog post: ねこのひ

   Published via LINE Bot

   source/_posts/20260227-ねこのひ.md | ...
   source/images/2026-rakugaki/2026-02-27T07-24-27-409Z-6c1mmo.jpeg | ...
   ```

3. **ブログ記事の内容を確認**
   ```bash
   cat source/_posts/20260227-*.md
   ```

   期待される形式：
   ```markdown
   ---
   title: 2026/02/27 ねこのひ
   date: 2026-02-27 HH:mm:ss
   updated: 2026-02-27 HH:mm:ss
   category:
     - 日記
     - 2026年
   tags:
     - お絵かき
     - ねこ劇場
     - 超落書きシリーズ
   cover_index: /source/images/2026/02/2026-02-27T07-24-27-409Z-6c1mmo.jpeg
   sitemap: true
   ---

   2026/2/22 に書いたもの

   ![](/source/images/2026/02/2026-02-27T07-24-27-409Z-6c1mmo.jpeg)
   ```

4. **S3の一時画像が削除されたか確認**
   ```bash
   aws s3 ls s3://linebot-blog-publisher-temp-images-325278861250/temp-images/1772177067730-2026-02-27T07-24-27-409Z-6c1mmo.jpeg
   ```

   期待される結果: ファイルが見つからない（削除済み）

### 方法2: Node.jsで直接実行

より詳細なデバッグが必要な場合：

```bash
cd linebot
node -r dotenv/config dist/test-blog-posting.js
```

### 方法3: TypeScriptで直接実行

```bash
cd linebot
npx tsx src/test-blog-posting.ts
```

## トラブルシューティング

### エラー: "Image data is missing"

**原因**: `imageUrl` または `imagePath` が設定されていない

**解決策**: テストスクリプトのデータを確認し、両方のフィールドが設定されていることを確認

### エラー: "Failed to download from S3"

**原因**: S3に画像が存在しない、または権限がない

**解決策**:
1. S3バケットに画像が存在するか確認
   ```bash
   aws s3 ls s3://linebot-blog-publisher-temp-images-325278861250/temp-images/
   ```

2. Lambda実行ロールにS3読み取り権限があるか確認

3. 画像をアップロード
   ```bash
   aws s3 cp test-image.jpg s3://linebot-blog-publisher-temp-images-325278861250/temp-images/1772177067730-2026-02-27T07-24-27-409Z-6c1mmo.jpeg
   ```

### エラー: "Failed to commit files to GitHub"

**原因**: GitHub認証エラーまたは権限不足

**解決策**:
1. GitHub Personal Access Tokenが有効か確認
2. トークンに `repo` スコープがあるか確認
3. リポジトリ名とオーナー名が正しいか確認
4. ブランチ名が正しいか確認（デフォルト: `main`）

### エラー: "Cannot find module"

**原因**: 依存関係がインストールされていない

**解決策**:
```bash
npm install
```

### エラー: "Missing required environment variables"

**原因**: `.env` ファイルが存在しないか、必要な変数が設定されていない

**解決策**:
1. `.env.example` をコピー
   ```bash
   cp .env.example .env
   ```

2. 全ての環境変数を設定

## カスタムテストデータの作成

独自のテストデータを使用する場合は、`src/test-blog-posting.ts` を編集：

```typescript
const testState: ConversationState = {
  step: ConversationStep.CONFIRMING,
  data: {
    title: 'あなたのタイトル',
    content: 'あなたの本文',
    imageUrl: 'temp-images/your-image-key.jpg',
    imagePath: 'source/images/2026/02/your-image.jpg',
    tags: ['お絵かき', 'あなたのタグ']
  },
  createdAt: new Date(),
  updatedAt: new Date()
};
```

## 本番環境でのテスト

本番環境（AWS Lambda）でテストする場合：

1. **Lambda関数を直接呼び出し**
   ```bash
   aws lambda invoke \
     --function-name linebot-blog-publisher-webhook \
     --payload file://test-event.json \
     --region ap-northeast-1 \
     response.json
   ```

2. **test-event.json の例**
   ```json
   {
     "body": "{\"events\":[{\"type\":\"message\",\"replyToken\":\"test-token\",\"source\":{\"userId\":\"Ud30b5ea3cdb47b8bd3b8eb7f5c69fe66\",\"type\":\"user\"},\"message\":{\"type\":\"text\",\"text\":\"はい\"}}]}",
     "headers": {
       "x-line-signature": "dummy-signature"
     }
   }
   ```

3. **CloudWatch Logsで結果を確認**
   ```bash
   aws logs tail /aws/lambda/linebot-blog-publisher-webhook --follow --region ap-northeast-1
   ```

## 成功の確認チェックリスト

- [ ] テストスクリプトがエラーなく完了
- [ ] GitHubリポジトリに新しいコミットが作成された
- [ ] `source/_posts/` に新しいMarkdownファイルが追加された
- [ ] `source/images/{year}-rakugaki/` に画像が追加された
- [ ] Markdownファイルの形式が正しい（YAML front matter + 本文 + 画像）
- [ ] S3の一時画像が削除された
- [ ] エラーログがない

## 次のステップ

テストが成功したら：

1. LINE Botから実際に投稿を作成してテスト
2. 本番環境にデプロイ
3. モニタリングとアラートの設定
4. ユーザーマニュアルの作成
