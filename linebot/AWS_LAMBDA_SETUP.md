# AWS Lambda セットアップガイド（手動セットアップ）

LINE Bot Blog PublisherをAWS Lambdaに**手動で**デプロイする手順です。

**注意**: CloudFormationを使った自動セットアップを推奨します。詳細は [CLOUDFORMATION_DEPLOY.md](./CLOUDFORMATION_DEPLOY.md) を参照してください。

## 前提条件

- AWSアカウント
- AWS CLI インストール済み（`aws configure`で認証情報設定済み）
- Node.js 20以上（**Node.js 18は非推奨**）
- LINE Bot設定完了（Channel Secret、Access Token取得済み）
- GitHub Personal Access Token取得済み

## 1. DynamoDBテーブル作成

セッション管理用のDynamoDBテーブルを作成します。

### AWS Management Consoleから作成

1. [DynamoDB Console](https://console.aws.amazon.com/dynamodb/)にアクセス
2. 「テーブルの作成」をクリック
3. 以下を設定：
   - **テーブル名**: `linebot-sessions`
   - **パーティションキー**: `userId` (文字列)
4. 「テーブル設定」で「カスタマイズ設定」を選択
5. 「Time to Live (TTL)」を有効化
   - **TTL属性名**: `ttl`
6. 「テーブルの作成」をクリック

### AWS CLIから作成

```bash
# テーブル作成
aws dynamodb create-table \
  --table-name linebot-sessions \
  --attribute-definitions AttributeName=userId,AttributeType=S \
  --key-schema AttributeName=userId,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --region ap-northeast-1

# TTL有効化
aws dynamodb update-time-to-live \
  --table-name linebot-sessions \
  --time-to-live-specification "Enabled=true, AttributeName=ttl" \
  --region ap-northeast-1
```

## 2. S3バケット作成

画像の一時保存用のS3バケットを作成します。

### AWS Management Consoleから作成

1. [S3 Console](https://console.aws.amazon.com/s3/)にアクセス
2. 「バケットを作成」をクリック
3. 以下を設定：
   - **バケット名**: `linebot-temp-images-<your-unique-id>` (グローバルで一意な名前)
   - **リージョン**: `ap-northeast-1` (または任意のリージョン)
   - **パブリックアクセスをすべてブロック**: オン（推奨）
4. 「バケットを作成」をクリック
5. 作成したバケットを選択 → 「管理」タブ → 「ライフサイクルルール」
6. 「ライフサイクルルールを作成」をクリック
   - **ルール名**: `delete-temp-images`
   - **ルールスコープ**: プレフィックス `temp-images/`
   - **ライフサイクルルールアクション**: 「オブジェクトの現行バージョンを期限切れにする」
   - **期限切れまでの日数**: `1` (24時間後に自動削除)
7. 「ルールを作成」をクリック

### AWS CLIから作成

```bash
# バケット作成
aws s3 mb s3://linebot-temp-images-<your-unique-id> --region ap-northeast-1

# ライフサイクルポリシー設定
cat > lifecycle-policy.json << 'EOF'
{
  "Rules": [
    {
      "Id": "delete-temp-images",
      "Status": "Enabled",
      "Prefix": "temp-images/",
      "Expiration": {
        "Days": 1
      }
    }
  ]
}
EOF

aws s3api put-bucket-lifecycle-configuration \
  --bucket linebot-temp-images-<your-unique-id> \
  --lifecycle-configuration file://lifecycle-policy.json
```

## 3. IAMロール作成

Lambda関数用のIAMロールを作成します。

### AWS Management Consoleから作成

1. [IAM Console](https://console.aws.amazon.com/iam/)にアクセス
2. 「ロール」→「ロールを作成」をクリック
3. 「信頼されたエンティティタイプ」で「AWSのサービス」を選択
4. 「ユースケース」で「Lambda」を選択
5. 以下のポリシーをアタッチ：
   - `AWSLambdaBasicExecutionRole` (CloudWatch Logs用)
6. 「次へ」をクリック
7. **ロール名**: `linebot-lambda-role`
8. 「ロールを作成」をクリック
9. 作成したロールを選択 → 「許可を追加」→「インラインポリシーを作成」
10. JSONタブで以下を貼り付け：

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:GetItem",
        "dynamodb:PutItem",
        "dynamodb:DeleteItem",
        "dynamodb:Scan"
      ],
      "Resource": "arn:aws:dynamodb:ap-northeast-1:*:table/linebot-sessions"
    },
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject",
        "s3:HeadObject"
      ],
      "Resource": "arn:aws:s3:::linebot-temp-images-*/*"
    }
  ]
}
```

11. **ポリシー名**: `linebot-dynamodb-s3-policy`
12. 「ポリシーの作成」をクリック

## 4. Lambda関数作成

### デプロイパッケージの作成

```bash
cd linebot

# 依存関係のインストール
npm install

# sharpをLinux x64用にインストール（重要！）
npm install --platform=linux --arch=x64 sharp

# ビルド
npm run build

# デプロイパッケージ作成（Windows PowerShell）
Compress-Archive -Path dist\*,node_modules -DestinationPath lambda-deployment.zip -Force

# または（Linux/Mac）
cd dist && zip -r ../lambda-deployment.zip . && cd ..
zip -r lambda-deployment.zip node_modules
```

**重要**: `sharp`ライブラリはネイティブバイナリを含むため、Lambda（Linux x64）用に明示的にインストールする必要があります。

### AWS Management Consoleから作成

1. [Lambda Console](https://console.aws.amazon.com/lambda/)にアクセス
2. 「関数の作成」をクリック
3. 以下を設定：
   - **関数名**: `linebot-webhook`
   - **ランタイム**: `Node.js 20.x`
   - **アーキテクチャ**: `x86_64`
   - **実行ロール**: 「既存のロールを使用する」→ `linebot-lambda-role`
4. 「関数の作成」をクリック
5. 「コード」タブで「アップロード元」→「.zipファイル」
6. `lambda-deployment.zip`をアップロード
7. 「設定」タブ → 「一般設定」→「編集」
   - **ハンドラ**: `lambda.handler`
   - **タイムアウト**: `30秒`
   - **メモリ**: `512 MB`
8. 「環境変数」→「編集」で以下を追加：

```
LINE_CHANNEL_SECRET=your_channel_secret
LINE_CHANNEL_ACCESS_TOKEN=your_access_token
GITHUB_TOKEN=your_github_token
GITHUB_OWNER=your_github_username
GITHUB_REPO=your_blog_repo
BLOG_BASE_URL=https://your-blog.com
BLOG_IMAGE_BASE_PATH=/images
DYNAMODB_TABLE_NAME=linebot-sessions
S3_BUCKET_NAME=linebot-temp-images-<your-unique-id>
S3_AWS_REGION=ap-northeast-1
NODE_ENV=production
```

## 5. API Gateway設定

Lambda関数にHTTPエンドポイントを追加します。

### AWS Management Consoleから作成

1. Lambda関数の「設定」タブ → 「トリガー」→「トリガーを追加」
2. 「トリガーを選択」で「API Gateway」を選択
3. 以下を設定：
   - **API**: 「新規APIの作成」
   - **APIタイプ**: `HTTP API`
   - **セキュリティ**: `オープン`
4. 「追加」をクリック
5. 作成されたAPI Gatewayのエンドポイント（例: `https://xxxxx.execute-api.ap-northeast-1.amazonaws.com/default/linebot-webhook`）をコピー

## 6. LINE Webhook URL設定

1. [LINE Developers Console](https://developers.line.biz/)にアクセス
2. チャンネルを選択
3. 「Messaging API」タブを開く
4. **Webhook URL**に以下を設定：
   ```
   https://xxxxx.execute-api.ap-northeast-1.amazonaws.com/default/linebot-webhook/webhook
   ```
   （API GatewayのエンドポイントURL + `/webhook`）
5. 「検証」をクリックして接続確認
6. 「Webhookの利用」をオンに設定

## 7. 動作確認

1. LINE BotをLINEアプリで友だち追加
2. 「投稿作成」とメッセージを送信
3. Botから返信があれば成功！

## トラブルシューティング

### sharpモジュールのエラー

**エラー**: `Could not load the "sharp" module using the linux-x64 runtime`

**原因**: sharpライブラリがWindows/Mac用にインストールされており、Lambda（Linux x64）で動作しない

**解決方法**:
```bash
# sharpをLinux x64用に再インストール
npm install --platform=linux --arch=x64 sharp

# 再ビルド・再パッケージ
npm run build
Compress-Archive -Path dist\*,node_modules -DestinationPath lambda-deployment.zip -Force

# Lambda関数の更新
aws lambda update-function-code \
  --function-name linebot-webhook \
  --zip-file fileb://lambda-deployment.zip
```

### Node.js 18 deprecatedエラー

**エラー**: Lambda関数でNode.js 18が非推奨の警告

**解決方法**: Lambda関数のランタイムをNode.js 20.xに更新してください：

```bash
aws lambda update-function-configuration \
  --function-name linebot-webhook \
  --runtime nodejs20.x
```

### Lambda関数のログ確認

```bash
# CloudWatch Logsでログを確認
aws logs tail /aws/lambda/linebot-webhook --follow
```

### DynamoDBテーブルの確認

```bash
# テーブルの内容を確認
aws dynamodb scan --table-name linebot-sessions
```

### S3バケットの確認

```bash
# バケットの内容を確認
aws s3 ls s3://linebot-temp-images-<your-unique-id>/temp-images/
```

## コスト見積もり

AWS無料利用枠内で運用可能です：

- **Lambda**: 月100万リクエスト、40万GB秒まで無料
- **DynamoDB**: 月25GBストレージ、25読み込み/書き込みユニットまで無料
- **S3**: 月5GBストレージ、2万GETリクエスト、2千PUTリクエストまで無料
- **API Gateway**: HTTP APIは月100万リクエストまで無料

個人利用であれば、ほぼ無料で運用できます。

## 更新方法

コードを更新した場合：

```bash
# 依存関係のインストール
npm install

# sharpをLinux x64用にインストール
npm install --platform=linux --arch=x64 sharp

# ビルドとパッケージ作成
npm run build
Compress-Archive -Path dist\*,node_modules -DestinationPath lambda-deployment.zip -Force

# Lambda関数の更新
aws lambda update-function-code \
  --function-name linebot-webhook \
  --zip-file fileb://lambda-deployment.zip

# 更新完了を待機
aws lambda wait function-updated \
  --function-name linebot-webhook
```

## CloudFormationを使った自動セットアップ

手動セットアップは手間がかかるため、CloudFormationを使った自動セットアップを推奨します。

詳細は [CLOUDFORMATION_DEPLOY.md](./CLOUDFORMATION_DEPLOY.md) を参照してください。

CloudFormationを使用すると：
- ✅ すべてのAWSリソースを一括作成
- ✅ 設定ミスを防止
- ✅ 簡単に削除・再作成可能
- ✅ インフラのバージョン管理が可能
