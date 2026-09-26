#!/bin/bash
# Fast frontend-only deploy: build ../frontend, sync to the web bucket, invalidate CloudFront.
# Bucket and distribution are read from the deployed stack's outputs; nothing is hardcoded.
set -euo pipefail
cd "$(dirname "$0")"

if [ -f .env ]; then
  set -a; . ./.env; set +a
fi
: "${AWS_PROFILE:?set AWS_PROFILE in .env}"
: "${AWS_REGION:=us-west-2}"
export AWS_PROFILE AWS_REGION
STACK_NAME="${STACK_NAME:-TripPlannerInfraStack}"

output() {
  aws cloudformation describe-stacks --stack-name "$STACK_NAME" --region "$AWS_REGION" \
    --query "Stacks[0].Outputs[?OutputKey=='$1'].OutputValue" --output text
}

echo "Building frontend..."
(cd ../frontend && ./build-for-production.sh)

BUCKET_NAME=$(output WebBucketName)
CLOUDFRONT_DOMAIN=$(output CloudFrontDomainName)
CUSTOM_URL=$(output CustomDomainUrl)
DISTRIBUTION_ID=$(aws cloudfront list-distributions \
  --query "DistributionList.Items[?DomainName=='${CLOUDFRONT_DOMAIN}'].Id" --output text)

echo "Syncing to s3://$BUCKET_NAME"
aws s3 sync ../frontend/dist/ "s3://$BUCKET_NAME/" --delete \
  --cache-control "public,max-age=31536000" --exclude "*.html" --region "$AWS_REGION"
aws s3 sync ../frontend/dist/ "s3://$BUCKET_NAME/" \
  --cache-control "public,max-age=0,must-revalidate" --include "*.html" --region "$AWS_REGION"

echo "Invalidating CloudFront $DISTRIBUTION_ID"
INVALIDATION_ID=$(aws cloudfront create-invalidation --distribution-id "$DISTRIBUTION_ID" \
  --paths "/*" --query 'Invalidation.Id' --output text)

echo "Done. Live at $CUSTOM_URL (invalidation $INVALIDATION_ID, usually 1-2 minutes)"
