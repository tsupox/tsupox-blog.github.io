# CloudFormation デプロイガイド

CloudFormationを使用してLINE Bot Blog PublisherのAWSインフラを自動構築する手順です。

## 前提条件

- AWS CLI インストール済み（`aws configure`で認証情報設定済み）
- LINE Bot設定完了（Channel Secret、Access Token取得済み）
- GitHub Personal Access Token取得済み
- Node.js 20以上（**Node.js 18は非推奨**）

**重要**: このプロジェクトはNode.js 20ランタイムを使用します。Lambda関数もnodejs20.xで動作します。

## 1. パラメータファイルの作成

CloudFormationスタックのパラメータを設定するファイルを作成します。

```bash
cd linebot
```

`cloudformation-parameters.json`を作成：

```json
[
  {
    "ParameterKey": "ProjectName",
    "ParameterValue": "linebot-blog-publisher"
  },
  {
    "ParameterKey": "LineChannelSecret",
    "ParameterValue": "your_line_channel_secret_here"
  },
  {
    "ParameterKey": "LineChannelAccessToken",
    "ParameterValue": "your_line_channel_access_token_here"
  },
  {
    "ParameterKey": "GitHubToken",
    "ParameterValue": "your_github_token_here"
  },
  {
    "ParameterKey": "GitHubOwner",
    "ParameterValue": "your_github_username"
  },
  {
    "ParameterKey": "GitHubRepo",
    "ParameterValue": "your_blog_repo_name"
  },
  {
    "ParameterKey": "BlogBaseUrl",
    "ParameterValue": "https://your-blog.github.io"
  },
  {
    "ParameterKey": "BlogImageBasePath",
    "ParameterValue": "/images"
  }
]
```

**重要**: このファイルには機密情報が含まれるため、`.gitignore`に追加してください。

```bash
echo "cloudformation-parameters.json" >> .gitignore
```

## 2. CloudFormationスタックの作成

### AWS CLIを使用する場合

```bash
# スタックを作成
aws cloudformation create-stack \
  --stack-name linebot-blog-publisher \
  --template-body file://cloudformation-template.yaml \
  --parameters file://cloudformation-parameters.json \
  --capabilities CAPABILITY_NAMED_IAM \
  --region ap-northeast-1

# スタック作成の進行状況を確認
aws cloudformation describe-stacks \
  --stack-name linebot-blog-publisher \
  --region ap-northeast-1 \
  --query 'Stacks[0].StackStatus'

# スタック作成完了まで待機
aws cloudformation wait stack-create-complete \
  --stack-name linebot-blog-publisher \
  --region ap-northeast-1
```

### AWS Management Consoleを使用する場合

1. [CloudFormation Console](https://console.aws.amazon.com/cloudformation/)にアクセス
2. 「スタックの作成」→「新しいリソースを使用（標準）」をクリック
3. 「テンプレートファイルのアップロード」を選択
4. `cloudformation-template.yaml`をアップロード
5. スタック名を入力（例: `linebot-blog-publisher`）
6. パラメータを入力：
   - LINE Bot設定（Channel Secret、Access Token）
   - GitHub設定（Token、Owner、Repo）
   - ブログ設定（Base URL、Image Base Path）
7. 「IAMリソースの作成を承認する」にチェック
8. 「スタックの作成」をクリック

## 3. スタック出力の確認

スタック作成完了後、出力値を確認します。

```bash
# 出力値を取得
aws cloudformation describe-stacks \
  --stack-name linebot-blog-publisher \
  --region ap-northeast-1 \
  --query 'Stacks[0].Outputs'
```

出力例：
```json
[
  {
    "OutputKey": "WebhookUrl",
    "OutputValue": "https://xxxxx.execute-api.ap-northeast-1.amazonaws.com/webhook",
    "Description": "LINE Webhook URL (set this in LINE Developers Console)"
  },
  {
    "OutputKey": "HealthCheckUrl",
    "OutputValue": "https://xxxxx.execute-api.ap-northeast-1.amazonaws.com/health",
    "Description": "Health check endpoint URL"
  },
  {
    "OutputKey": "LambdaFunctionName",
    "OutputValue": "linebot-blog-publisher-webhook",
    "Description": "Lambda function name for code deployment"
  }
]
```

## 4. Lambda関数コードのデプロイ

CloudFormationでインフラは作成されましたが、Lambda関数のコードはまだデプロイされていません。

### 自動デプロイスクリプトを使用（推奨）

**Linux/Mac:**
```bash
chmod +x deploy.sh
./deploy.sh
```

**Windows PowerShell:**
```powershell
.\deploy.ps1
```

デプロイスクリプトは以下を自動実行します：
- 依存関係のインストール
- TypeScriptビルド
- デプロイパッケージ作成
- Lambda関数への自動デプロイ

### 手動デプロイ

手動でデプロイする場合は以下の手順を実行：

```bash
# 依存関係のインストール
npm install

# ビルド
npm run build

# デプロイパッケージ作成（Windows PowerShell）
Compress-Archive -Path dist\*,node_modules -DestinationPath lambda-deployment.zip -Force

# または（Linux/Mac）
cd dist && zip -r ../lambda-deployment.zip . && cd ..
zip -r lambda-deployment.zip node_modules
```

### Lambda関数の更新

```bash
# CloudFormationの出力からLambda関数名を取得
FUNCTION_NAME=$(aws cloudformation describe-stacks \
  --stack-name linebot-blog-publisher \
  --region ap-northeast-1 \
  --query 'Stacks[0].Outputs[?OutputKey==`LambdaFunctionName`].OutputValue' \
  --output text)

# Lambda関数コードを更新
aws lambda update-function-code \
  --function-name $FUNCTION_NAME \
  --zip-file fileb://lambda-deployment.zip \
  --region ap-northeast-1

# 更新完了まで待機
aws lambda wait function-updated \
  --function-name $FUNCTION_NAME \
  --region ap-northeast-1
```

## 5. LINE Webhook URLの設定

1. [LINE Developers Console](https://developers.line.biz/)にアクセス
2. チャンネルを選択
3. 「Messaging API」タブを開く
4. **Webhook URL**にCloudFormationの出力値`WebhookUrl`を設定
5. 「検証」をクリックして接続確認
6. 「Webhookの利用」をオンに設定

## 6. 動作確認

### ヘルスチェック

```bash
# ヘルスチェックエンドポイントにアクセス
HEALTH_URL=$(aws cloudformation describe-stacks \
  --stack-name linebot-blog-publisher \
  --region ap-northeast-1 \
  --query 'Stacks[0].Outputs[?OutputKey==`HealthCheckUrl`].OutputValue' \
  --output text)

curl $HEALTH_URL
```

期待される応答：
```json
{
  "status": "ok",
  "timestamp": "2024-01-30T12:00:00.000Z"
}
```

### LINE Botテスト

1. LINE BotをLINEアプリで友だち追加
2. 「投稿作成」とメッセージを送信
3. Botから返信があれば成功！

## 7. ログの確認

```bash
# CloudWatch Logsでログを確認
aws logs tail /aws/lambda/linebot-blog-publisher-webhook --follow
```

## スタックの更新

パラメータや設定を変更する場合：

```bash
# パラメータファイルを編集後、スタックを更新
aws cloudformation update-stack \
  --stack-name linebot-blog-publisher \
  --template-body file://cloudformation-template.yaml \
  --parameters file://cloudformation-parameters.json \
  --capabilities CAPABILITY_NAMED_IAM \
  --region ap-northeast-1

# 更新完了まで待機
aws cloudformation wait stack-update-complete \
  --stack-name linebot-blog-publisher \
  --region ap-northeast-1
```

## スタックの削除

不要になった場合、すべてのリソースを削除できます：

```bash
# S3バケットを空にする（削除前に必要）
BUCKET_NAME=$(aws cloudformation describe-stacks \
  --stack-name linebot-blog-publisher \
  --region ap-northeast-1 \
  --query 'Stacks[0].Outputs[?OutputKey==`S3BucketName`].OutputValue' \
  --output text)

aws s3 rm s3://$BUCKET_NAME --recursive

# スタックを削除
aws cloudformation delete-stack \
  --stack-name linebot-blog-publisher \
  --region ap-northeast-1

# 削除完了まで待機
aws cloudformation wait stack-delete-complete \
  --stack-name linebot-blog-publisher \
  --region ap-northeast-1
```

## トラブルシューティング

### Node.js 18 deprecatedエラー

**エラー**: Lambda関数でNode.js 18が非推奨の警告

**解決方法**: CloudFormationテンプレートとpackage.jsonは既にNode.js 20に更新済みです。スタックを更新してください：

```bash
aws cloudformation update-stack \
  --stack-name linebot-blog-publisher \
  --template-body file://cloudformation-template.yaml \
  --parameters file://cloudformation-parameters.json \
  --capabilities CAPABILITY_NAMED_IAM \
  --region ap-northeast-1
```

### スタック作成が失敗する

```bash
# スタックイベントを確認
aws cloudformation describe-stack-events \
  --stack-name linebot-blog-publisher \
  --region ap-northeast-1 \
  --max-items 20
```

### Lambda関数のエラー

```bash
# 最新のログを確認
aws logs tail /aws/lambda/linebot-blog-publisher-webhook \
  --since 10m \
  --format short
```

### DynamoDBテーブルの確認

```bash
# テーブルの内容を確認
aws dynamodb scan \
  --table-name linebot-blog-publisher-sessions \
  --region ap-northeast-1
```

## コスト見積もり

AWS無料利用枠内で運用可能です：

- **Lambda**: 月100万リクエスト、40万GB秒まで無料
- **DynamoDB**: 月25GBストレージ、25読み込み/書き込みユニットまで無料
- **S3**: 月5GBストレージ、2万GETリクエスト、2千PUTリクエストまで無料
- **API Gateway**: HTTP APIは月100万リクエストまで無料
- **CloudWatch Logs**: 月5GBまで無料

個人利用であれば、ほぼ無料で運用できます。

## 便利なコマンド

### スタック情報の確認

```bash
# スタックの詳細情報
aws cloudformation describe-stacks \
  --stack-name linebot-blog-publisher \
  --region ap-northeast-1

# スタックのリソース一覧
aws cloudformation list-stack-resources \
  --stack-name linebot-blog-publisher \
  --region ap-northeast-1
```

### Lambda関数の環境変数更新

```bash
# 環境変数を更新（例：GitHub Tokenの変更）
aws lambda update-function-configuration \
  --function-name linebot-blog-publisher-webhook \
  --environment "Variables={GITHUB_TOKEN=new_token_here,...}" \
  --region ap-northeast-1
```

### DynamoDBテーブルのバックアップ

```bash
# オンデマンドバックアップを作成
aws dynamodb create-backup \
  --table-name linebot-blog-publisher-sessions \
  --backup-name linebot-sessions-backup-$(date +%Y%m%d) \
  --region ap-northeast-1
```
