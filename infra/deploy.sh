#!/bin/bash
# Deploy the CDK stack. Reads deployment settings from .env (see .env.example) and
# uses the AWS CLI profile named there; no credentials are stored in this repo.
set -euo pipefail
cd "$(dirname "$0")"

if [ -f .env ]; then
  set -a; . ./.env; set +a
fi
: "${AWS_PROFILE:?set AWS_PROFILE in .env}"
: "${AWS_REGION:=us-west-2}"
: "${DOMAIN_NAME:?set DOMAIN_NAME in .env}"
: "${HOSTED_ZONE_ID:?set HOSTED_ZONE_ID in .env}"
: "${CERTIFICATE_ARN:?set CERTIFICATE_ARN in .env}"
export AWS_PROFILE AWS_REGION CDK_DEFAULT_REGION="$AWS_REGION"

# The edge shared secret must exist before the first deploy (see setup-edge-secret-ssm.sh)
if ! aws ssm get-parameter --name /odyssey/edge-shared-secret --region "$AWS_REGION" >/dev/null 2>&1; then
  echo "Missing SSM parameter /odyssey/edge-shared-secret. Run ./setup-edge-secret-ssm.sh first." >&2
  exit 1
fi

[ -d node_modules ] || npm ci
npm run build

if ! aws cloudformation describe-stacks --stack-name CDKToolkit --region "$AWS_REGION" >/dev/null 2>&1; then
  echo "Bootstrapping CDK..."
  npx cdk bootstrap
fi

npx cdk deploy --require-approval never \
  -c domainName="$DOMAIN_NAME" \
  -c hostedZoneId="$HOSTED_ZONE_ID" \
  -c certificateArn="$CERTIFICATE_ARN" \
  -c extraCorsOrigins="${EXTRA_CORS_ORIGINS:-}"

echo "Deployment complete: https://$DOMAIN_NAME"
