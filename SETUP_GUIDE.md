# LINE Bot Blog Publisher セットアップガイド

## 1. GitHub Personal Access Token作成

1. GitHubにログインして [Settings](https://github.com/settings/profile) にアクセス
2. 左メニューから「Developer settings」をクリック
3. 「Personal access tokens」→「Tokens (classic)」をクリック
4. 「Generate new token」→「Generate new token (classic)」をクリック
5. 以下を設定：
   - **Note**: `LINE Bot Blog Publisher`
   - **Expiration**: `No expiration` または適切な期限
   - **Select scopes**: `repo` にチェック（Full control of private repositories）
6. 「Generate token」をクリック
7. **重要**: 表示されたトークンをコピーして安全な場所に保存

## 2. Vercelアカウント作成

1. [Vercel](https://vercel.com/) にアクセス
2. 「Sign Up」をクリック
3. 「Continue with GitHub」でGitHubアカウントと連携
4. アカウント作成完了

## 3. LINE Official Account & Messaging API設定

### 3.1 LINE Official Account作成
1. [LINE Developers Console](https://developers.line.biz/) にアクセス
2. LINEアカウントでログイン
3. 「Create a LINE Official Account」ボタンをクリック
4. LINE Official Account Managerに移動するので、以下を設定：
   - **Account name**: `Blog Publisher Bot`
   - **Category**: 適切なカテゴリを選択
   - **Description**: `ブログ投稿用Bot`
5. アカウントを作成

### 3.2 Messaging API有効化
1. LINE Official Account Managerで作成したアカウントを選択
2. 「設定」→「Messaging API」をクリック
3. 「Messaging APIを利用する」をクリック
4. プロバイダーを選択（新規作成も可能）
5. 利用規約に同意して設定完了

### 3.3 LINE Developers Consoleでトークン取得
1. [LINE Developers Console](https://developers.line.biz/) に戻る
2. 作成されたプロバイダーとチャンネルを確認
3. チャンネルをクリック
4. 「Basic settings」タブで **Channel Secret** をコピー
5. 「Messaging API」タブで **Channel access token** の「Issue」をクリックしてトークンをコピー

### 3.4 Webhook URL設定（後で設定）
**注意**: この手順はVercelデプロイ後に行います。今は飛ばしてください。

1. LINE Developers Consoleのチャンネル設定
2. 「Messaging API」タブを開く
3. Webhook URLに `https://your-vercel-app.vercel.app/api/webhook` を設定
4. 「Use webhook」をオンに設定

### 3.5 応答設定
1. LINE Official Account Managerに戻る
2. 「設定」→「応答設定」をクリック
3. 以下を設定：
   - **応答メッセージ**: オフ
   - **あいさつメッセージ**: オフ
   - **Webhook**: （Webhook URL設定後にオンにする）
4. 設定を保存

## 4. 環境変数設定

プロジェクトの `linebot` フォルダに `.env` ファイルを作成：

```env
# LINE Bot設定
LINE_CHANNEL_SECRET=your_channel_secret_here
LINE_CHANNEL_ACCESS_TOKEN=your_channel_access_token_here

# GitHub設定
GITHUB_TOKEN=your_github_token_here
GITHUB_OWNER=your_github_username
GITHUB_REPO=your_blog_repo_name

# ブログ設定
BLOG_BASE_URL=https://your-username.github.io
BLOG_IMAGE_BASE_PATH=/images
```

## 次のステップ

設定が完了したら、以下のコマンドで開発を開始できます：

```bash
cd linebot
npm install
npm run dev
```

**重要**: Webhook URLの設定は、Vercelにデプロイした後に行います。
今は以下の情報があれば開発を進められます：
- GitHub Personal Access Token
- LINE Channel Secret
- LINE Channel Access Token

設定に問題がある場合は、エラーメッセージを確認して該当する環境変数を修正してください。

## Vercelデプロイ後の追加設定

1. Vercelデプロイ完了後、URLを確認
2. LINE Developers Console → Messaging API → Webhook URLに設定
3. LINE Official Account Manager → 応答設定 → WebhookをONに設定