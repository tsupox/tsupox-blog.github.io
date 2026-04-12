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

```
LINE App
  │
  ▼
LINE Messaging API
  │  Webhook (POST /webhook)
  ▼
API Gateway (HTTP API)
  │  AWS_PROXY統合
  ▼
Lambda (Node.js 20.x)
  ├── DynamoDB … セッション管理（会話状態の保持）
  ├── S3 ………… 一時画像保存（1日で自動削除）
  ├── LINE API … 画像ダウンロード・返信メッセージ送信
  └── GitHub API … Hexo記事のコミット・プッシュ
```

CloudFormation で作成されるリソース:

| リソース | 用途 |
|---|---|
| API Gateway (HTTP API) | LINE Webhook エンドポイント (`POST /webhook`, `GET /health`) |
| Lambda | Webhook 処理（タイムアウト30秒、メモリ512MB） |
| DynamoDB テーブル | ユーザーごとの会話セッション（TTL有効） |
| S3 バケット | 一時画像保存（ライフサイクルで1日後に自動削除） |
| IAM ロール | Lambda 用（DynamoDB・S3 アクセス権限） |
| CloudWatch Logs | Lambda ログ（保持期間7日） |

## トラブルシューティング

問題が発生した場合、以下の順番で確認してください。

### 1. CloudFormation スタックの状態確認

```bash
# スタックの状態を確認
aws cloudformation describe-stacks \
  --stack-name <スタック名> \
  --query "Stacks[0].{Status:StackStatus,Outputs:Outputs}"

# スタックイベント（エラー時の詳細）
aws cloudformation describe-stack-events \
  --stack-name <スタック名> \
  --query "StackEvents[?ResourceStatus=='CREATE_FAILED']"
```

Outputs から `WebhookUrl` を取得し、LINE Developers Console に設定する URL と一致しているか確認してください。

### 2. ヘルスチェック

```bash
# API Gateway → Lambda の疎通確認
curl -s <HealthCheckUrl の値>
```

`{"status":"ok",...}` が返れば API Gateway と Lambda の接続は正常です。

### 3. Lambda の動作確認

```bash
# Lambda 関数の設定確認（環境変数・ランタイム等）
aws lambda get-function-configuration \
  --function-name <Lambda関数名> \
  --query "{Runtime:Runtime,Handler:Handler,Timeout:Timeout,EnvVars:Environment.Variables|keys(@)}"
```

ログの確認:

```bash
# 最新のログを確認
MSYS_NO_PATHCONV=1 aws logs tail /aws/lambda/<Lambda関数名> --since 1h

# エラーだけ抽出
MSYS_NO_PATHCONV=1 aws logs filter-log-events \
  --log-group-name /aws/lambda/<Lambda関数名> \
  --filter-pattern "ERROR"
```

> **注意（Git Bash / MSYS2 環境）:** Git Bash（MINGW64）は `/aws/...` のようなスラッシュ始まりの引数を Windows パスに自動変換します（例: `C:/Program Files/Git/aws/...`）。クォートや `//` プレフィックスでは回避できません。コマンドの先頭に `MSYS_NO_PATHCONV=1` を付けてください。PowerShell や CMD ではこの問題は発生しません。

ログが一切ない場合は、LINE からの Webhook が Lambda に到達していません。LINE Developers Console の Webhook URL 設定を確認してください。

### 4. LINE Webhook の確認

LINE Developers Console で以下を確認:

- Webhook URL が CloudFormation Outputs の `WebhookUrl` と一致しているか
- 「Webhookの利用」がオンになっているか
- 「検証」ボタンで成功するか（200 が返るか）
- 「応答メッセージ」がオフになっているか（オンだと LINE 公式の自動応答が優先される）

### 5. DynamoDB セッション確認

```bash
# テーブルの存在とアイテム数を確認
aws dynamodb describe-table \
  --table-name <テーブル名> \
  --query "Table.{Status:TableStatus,ItemCount:ItemCount,TTL:TimeToLiveDescription}"

# 特定ユーザーのセッション状態を確認
aws dynamodb get-item \
  --table-name <テーブル名> \
  --key '{"userId":{"S":"<LINEユーザーID>"}}'

# セッションが壊れている場合は削除してリセット
aws dynamodb delete-item \
  --table-name <テーブル名> \
  --key '{"userId":{"S":"<LINEユーザーID>"}}'
```

### 6. S3 画像保存の確認

```bash
# バケットの存在確認
aws s3 ls s3://<バケット名>/ --recursive --summarize

# ライフサイクルルールの確認（1日で自動削除されるか）
aws s3api get-bucket-lifecycle-configuration --bucket <バケット名>
```

### 7. GitHub 連携の確認

```bash
# トークンの有効性を確認
curl -s -H "Authorization: token <GITHUB_TOKEN>" \
  https://api.github.com/user \
  | grep -E '"login"|"message"'

# リポジトリへのアクセス確認
curl -s -H "Authorization: token <GITHUB_TOKEN>" \
  https://api.github.com/repos/<OWNER>/<REPO> \
  | grep -E '"full_name"|"message"|"permissions"'
```

トークンに `repo` 権限が付与されていること、有効期限が切れていないことを確認してください。

### 8. Lambda コードのデプロイ確認

```bash
# 現在デプロイされているコードのハッシュとサイズを確認
aws lambda get-function \
  --function-name <Lambda関数名> \
  --query "Configuration.{CodeSize:CodeSize,LastModified:LastModified,CodeSha256:CodeSha256}"
```

CloudFormation 作成直後はプレースホルダーコードがデプロイされています。`npm run build` 後に実際のコードをデプロイする必要があります。

### よくある問題

| 症状 | 原因 | 対処 |
|---|---|---|
| Bot が一切反応しない | Webhook URL 未設定 or 不一致 | LINE Developers Console で URL を確認 |
| 「Please deploy your code」が返る | Lambda にコードが未デプロイ | `npm run build` → デプロイスクリプト実行 |
| 「投稿作成」に反応しない | LINE の自動応答がオン | LINE Console で応答メッセージをオフに |
| 画像送信でエラー | S3 バケットへの権限不足 | IAM ロールのポリシーを確認 |
| 会話が途中で止まる | DynamoDB セッション破損 | セッションを削除してリセット |
| 「公開しました」と出るが投稿されない | GitHub Token 期限切れ or 権限不足 | トークンを再生成して環境変数を更新 |

## ライセンス

MIT License