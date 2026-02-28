# クイックテストガイド

## 最速でブログ投稿機能をテストする方法

### 1. 環境変数の設定（初回のみ）

```bash
cd linebot
cp .env.example .env
# .env を編集して必要な値を設定
```

### 2. 依存関係のインストール（初回のみ）

```bash
npm install
```

### 3. S3に画像が存在するか確認

```bash
aws s3 ls s3://linebot-blog-publisher-temp-images-325278861250/temp-images/1772177067730-2026-02-27T07-24-27-409Z-6c1mmo.jpeg
```

画像がない場合は任意の画像をアップロード：

```bash
# 例: 手元の画像をアップロード
aws s3 cp your-image.jpg s3://linebot-blog-publisher-temp-images-325278861250/temp-images/1772177067730-2026-02-27T07-24-27-409Z-6c1mmo.jpeg
```

### 4. テスト実行

```bash
npm run test:blog-posting
```

### 5. 結果確認

#### GitHubで確認
```bash
# ブラウザで開く
open https://github.com/{your-username}/{your-repo}/commits/main

# またはローカルで確認
git pull origin main
ls source/_posts/20260227-*.md
```

#### 生成されたファイルを確認
```bash
# ブログ記事
cat source/_posts/20260227-*.md

# 画像
ls -lh source/images/2026-rakugaki/
```

### 成功の確認

✅ テストスクリプトが「Test Completed Successfully」と表示される
✅ GitHubに新しいコミットが作成される
✅ `source/_posts/` に Markdown ファイルが追加される
✅ `source/images/2026-rakugaki/` に画像が追加される

### エラーが出た場合

#### "Missing required environment variables"
→ `.env` ファイルを確認し、全ての環境変数を設定

#### "Failed to download from S3"
→ S3に画像が存在するか確認、または画像をアップロード

#### "Failed to commit files to GitHub"
→ GitHub Personal Access Token の権限を確認（`repo` スコープが必要）

### 詳細なトラブルシューティング

詳しくは `TESTING_GUIDE.md` を参照してください。

---

## ワンライナーテスト（全て設定済みの場合）

```bash
cd linebot && npm run test:blog-posting
```

これだけで動作確認ができます！
