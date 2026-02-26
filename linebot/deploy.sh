#!/bin/bash

# LINE Bot Blog Publisher - Deployment Script
# This script builds and deploys the Lambda function code to AWS

set -e

STACK_NAME="linebot-blog-publisher"
REGION="ap-northeast-1"

echo "🚀 Starting deployment process..."

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
    echo "❌ AWS CLI is not installed. Please install it first."
    exit 1
fi

# Check if stack exists
echo "📋 Checking CloudFormation stack..."
if ! aws cloudformation describe-stacks --stack-name $STACK_NAME --region $REGION &> /dev/null; then
    echo "❌ CloudFormation stack '$STACK_NAME' not found."
    echo "Please create the stack first using:"
    echo "  aws cloudformation create-stack --stack-name $STACK_NAME --template-body file://cloudformation-template.yaml --parameters file://cloudformation-parameters.json --capabilities CAPABILITY_NAMED_IAM --region $REGION"
    exit 1
fi

# Get Lambda function name from CloudFormation outputs
echo "🔍 Getting Lambda function name..."
FUNCTION_NAME=$(aws cloudformation describe-stacks \
  --stack-name $STACK_NAME \
  --region $REGION \
  --query 'Stacks[0].Outputs[?OutputKey==`LambdaFunctionName`].OutputValue' \
  --output text)

if [ -z "$FUNCTION_NAME" ]; then
    echo "❌ Could not get Lambda function name from CloudFormation stack"
    exit 1
fi

echo "✅ Lambda function: $FUNCTION_NAME"

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Build TypeScript
echo "🔨 Building TypeScript..."
npm run build

# Create deployment package
echo "📦 Creating deployment package..."
if [ -f lambda-deployment.zip ]; then
    rm lambda-deployment.zip
fi

cd dist
zip -r ../lambda-deployment.zip . > /dev/null
cd ..
zip -r lambda-deployment.zip node_modules > /dev/null

echo "✅ Deployment package created: lambda-deployment.zip"

# Deploy to Lambda
echo "🚀 Deploying to Lambda..."
aws lambda update-function-code \
  --function-name $FUNCTION_NAME \
  --zip-file fileb://lambda-deployment.zip \
  --region $REGION \
  > /dev/null

echo "⏳ Waiting for function update to complete..."
aws lambda wait function-updated \
  --function-name $FUNCTION_NAME \
  --region $REGION

echo "✅ Deployment completed successfully!"

# Get Webhook URL
WEBHOOK_URL=$(aws cloudformation describe-stacks \
  --stack-name $STACK_NAME \
  --region $REGION \
  --query 'Stacks[0].Outputs[?OutputKey==`WebhookUrl`].OutputValue' \
  --output text)

echo ""
echo "📝 Webhook URL: $WEBHOOK_URL"
echo "   Set this URL in LINE Developers Console"
echo ""
echo "🎉 Deployment complete!"
