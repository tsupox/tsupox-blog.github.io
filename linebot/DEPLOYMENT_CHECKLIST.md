# Deployment Checklist

## Pre-Deployment

- [ ] All environment variables configured in `.env` or CloudFormation parameters
- [ ] GitHub Personal Access Token created with `repo` scope
- [ ] LINE Bot channel created and configured
- [ ] AWS account ready with appropriate permissions

## Build and Test

- [ ] Run `npm install` to install dependencies
- [ ] Run `npm run build` to compile TypeScript
- [ ] Run `npm test` to verify tests pass (if available)
- [ ] Run `npm run lint` to check code quality

## CloudFormation Deployment

- [ ] Copy `cloudformation-parameters.example.json` to `cloudformation-parameters.json`
- [ ] Update all parameter values in `cloudformation-parameters.json`
- [ ] Create CloudFormation stack:
  ```bash
  aws cloudformation create-stack \
    --stack-name linebot-blog-publisher \
    --template-body file://cloudformation-template.yaml \
    --parameters file://cloudformation-parameters.json \
    --capabilities CAPABILITY_NAMED_IAM \
    --region ap-northeast-1 \
    --tags Key=auto-delete,Value=no Key=Project,Value=linebot-blog-publisher
  ```
- [ ] Wait for stack creation to complete
- [ ] Note the API Gateway URL from stack outputs

## Lambda Function Deployment

- [ ] Build deployment package:
  ```bash
  npm run build
  cd dist
  zip -r ../lambda-deployment.zip .
  cd ..
  zip -r lambda-deployment.zip node_modules
  ```
- [ ] Upload to Lambda:
  ```bash
  aws lambda update-function-code \
    --function-name linebot-blog-publisher-webhook \
    --zip-file fileb://lambda-deployment.zip \
    --region ap-northeast-1
  ```
- [ ] Verify Lambda function updated successfully

## LINE Bot Configuration

- [ ] Set Webhook URL in LINE Developers Console:
  - URL: `https://{api-gateway-id}.execute-api.ap-northeast-1.amazonaws.com/webhook`
- [ ] Enable webhook in LINE Official Account Manager
- [ ] Verify webhook connection (should show green checkmark)

## Post-Deployment Verification

- [ ] Test health check endpoint:
  ```bash
  curl https://{api-gateway-id}.execute-api.ap-northeast-1.amazonaws.com/health
  ```
- [ ] Send test message to LINE Bot: "ヘルプ"
- [ ] Verify bot responds with help message
- [ ] Test full blog post creation flow:
  1. Send "投稿作成"
  2. Enter title
  3. Enter content
  4. Send image
  5. Select tags
  6. Confirm with "はい"
- [ ] Verify blog post appears in GitHub repository
- [ ] Check CloudWatch Logs for any errors

## Monitoring Setup

- [ ] Set up CloudWatch alarms for Lambda errors
- [ ] Set up CloudWatch alarms for API Gateway 5xx errors
- [ ] Configure log retention period in CloudWatch
- [ ] Set up SNS notifications for critical errors (optional)

## Rollback Plan

If deployment fails:

1. Check CloudWatch Logs for error details
2. Verify all environment variables are correct
3. If Lambda function is broken, rollback to previous version:
   ```bash
   aws lambda update-function-code \
     --function-name linebot-blog-publisher-webhook \
     --zip-file fileb://lambda-deployment-backup.zip \
     --region ap-northeast-1
   ```
4. If CloudFormation stack is broken, delete and recreate:
   ```bash
   aws cloudformation delete-stack \
     --stack-name linebot-blog-publisher \
     --region ap-northeast-1
   ```

## Troubleshooting

### Common Issues

1. **Webhook not responding**
   - Check API Gateway URL is correct
   - Verify Lambda function has correct environment variables
   - Check CloudWatch Logs for errors

2. **DynamoDB access denied**
   - Verify IAM role has DynamoDB permissions
   - Check table name matches environment variable
   - Verify region is correct (APP_AWS_REGION)

3. **S3 access denied**
   - Verify IAM role has S3 permissions
   - Check bucket name matches environment variable
   - Verify region is correct

4. **GitHub commit fails**
   - Verify GitHub token has `repo` scope
   - Check repository name and owner are correct
   - Verify token hasn't expired

5. **Image processing fails**
   - Check image format is supported (JPEG, PNG, GIF, WebP)
   - Verify image size is under 10MB
   - Check S3 bucket has enough space

## Success Criteria

- [ ] Health check endpoint returns 200 OK
- [ ] LINE Bot responds to messages
- [ ] Full blog post creation flow works end-to-end
- [ ] Blog posts appear in GitHub repository
- [ ] Images are uploaded correctly
- [ ] No errors in CloudWatch Logs
- [ ] Webhook shows as connected in LINE Developers Console

## Notes

- Keep a backup of the previous Lambda deployment package
- Document any custom configuration changes
- Update this checklist if deployment process changes
