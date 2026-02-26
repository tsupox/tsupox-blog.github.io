# LINE Bot Blog Publisher - Deployment Script (PowerShell)
# This script builds and deploys the Lambda function code to AWS

$ErrorActionPreference = "Stop"

$STACK_NAME = "linebot-blog-publisher"
$REGION = "us-east-1"

Write-Host "🚀 Starting deployment process..." -ForegroundColor Green

# Check if AWS CLI is installed
try {
    aws --version | Out-Null
} catch {
    Write-Host "❌ AWS CLI is not installed. Please install it first." -ForegroundColor Red
    exit 1
}

# Check if stack exists
Write-Host "📋 Checking CloudFormation stack..." -ForegroundColor Cyan
try {
    aws cloudformation describe-stacks --stack-name $STACK_NAME --region $REGION 2>&1 | Out-Null
} catch {
    Write-Host "❌ CloudFormation stack '$STACK_NAME' not found." -ForegroundColor Red
    Write-Host "Please create the stack first using:" -ForegroundColor Yellow
    Write-Host "  aws cloudformation create-stack --stack-name $STACK_NAME --template-body file://cloudformation-template.yaml --parameters file://cloudformation-parameters.json --capabilities CAPABILITY_NAMED_IAM --region $REGION" -ForegroundColor Yellow
    exit 1
}

# Get Lambda function name from CloudFormation outputs
Write-Host "🔍 Getting Lambda function name..." -ForegroundColor Cyan
$FUNCTION_NAME = aws cloudformation describe-stacks `
  --stack-name $STACK_NAME `
  --region $REGION `
  --query 'Stacks[0].Outputs[?OutputKey==`LambdaFunctionName`].OutputValue' `
  --output text

if ([string]::IsNullOrEmpty($FUNCTION_NAME)) {
    Write-Host "❌ Could not get Lambda function name from CloudFormation stack" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Lambda function: $FUNCTION_NAME" -ForegroundColor Green

# Install dependencies
Write-Host "📦 Installing dependencies..." -ForegroundColor Cyan
npm install

# Install sharp for Linux (Lambda environment)
Write-Host "🖼️  Installing sharp for Linux x64..." -ForegroundColor Cyan
npm install --platform=linux --arch=x64 sharp

# Build TypeScript
Write-Host "🔨 Building TypeScript..." -ForegroundColor Cyan
npm run build

# Create deployment package
Write-Host "📦 Creating deployment package..." -ForegroundColor Cyan
if (Test-Path lambda-deployment.zip) {
    Remove-Item lambda-deployment.zip
}

Compress-Archive -Path dist\*,node_modules -DestinationPath lambda-deployment.zip -Force

Write-Host "✅ Deployment package created: lambda-deployment.zip" -ForegroundColor Green

# Deploy to Lambda
Write-Host "🚀 Deploying to Lambda..." -ForegroundColor Cyan
aws lambda update-function-code `
  --function-name $FUNCTION_NAME `
  --zip-file fileb://lambda-deployment.zip `
  --region $REGION `
  | Out-Null

Write-Host "⏳ Waiting for function update to complete..." -ForegroundColor Cyan
aws lambda wait function-updated `
  --function-name $FUNCTION_NAME `
  --region $REGION

Write-Host "✅ Deployment completed successfully!" -ForegroundColor Green

# Get Webhook URL
$WEBHOOK_URL = aws cloudformation describe-stacks `
  --stack-name $STACK_NAME `
  --region $REGION `
  --query 'Stacks[0].Outputs[?OutputKey==`WebhookUrl`].OutputValue' `
  --output text

Write-Host ""
Write-Host "📝 Webhook URL: $WEBHOOK_URL" -ForegroundColor Yellow
Write-Host "   Set this URL in LINE Developers Console" -ForegroundColor Yellow
Write-Host ""
Write-Host "🎉 Deployment complete!" -ForegroundColor Green
