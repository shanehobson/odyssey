#!/bin/bash
# Create (or rotate) the CloudFront -> Lambda shared secret in SSM Parameter Store.
# The CDK stack reads it at deploy time; rotate by re-running this script and redeploying.
#   ./setup-edge-secret-ssm.sh            # generate a random value
#   ./setup-edge-secret-ssm.sh <value>    # use a specific value
set -euo pipefail
cd "$(dirname "$0")"
if [ -f .env ]; then set -a; . ./.env; set +a; fi
: "${AWS_PROFILE:?set AWS_PROFILE in .env}"
: "${AWS_REGION:=us-west-2}"
export AWS_PROFILE AWS_REGION

SECRET="${1:-$(openssl rand -base64 48 | tr -d '/+=' | cut -c1-48)}"
aws ssm put-parameter --name /odyssey/edge-shared-secret --type String --overwrite \
  --value "$SECRET" --region "$AWS_REGION" \
  --description "Shared secret CloudFront sends to the Odyssey BFF as X-Bff-Auth" >/dev/null
echo "Stored /odyssey/edge-shared-secret. Redeploy the stack (./deploy.sh) to apply it."
echo "For local development put the same value in frontend/.env as DEV_PROXY_BFF_AUTH."
