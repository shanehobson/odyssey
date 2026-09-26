#!/bin/bash
# Deploy infrastructure and frontend together.
#   ./deploy-full-stack.sh                  # both
#   ./deploy-full-stack.sh --backend-only   # CDK stack only
#   ./deploy-full-stack.sh --frontend-only  # build ../frontend and deploy it via CDK
set -euo pipefail
cd "$(dirname "$0")"

FRONTEND_ONLY=false
BACKEND_ONLY=false
for arg in "$@"; do
  case $arg in
    --frontend-only) FRONTEND_ONLY=true ;;
    --backend-only) BACKEND_ONLY=true ;;
    --help|-h) sed -n '2,5p' "$0"; exit 0 ;;
    *) echo "Unknown option $arg" >&2; exit 1 ;;
  esac
done

if [ "$BACKEND_ONLY" = false ]; then
  echo "Building frontend..."
  (cd ../frontend && ./build-for-production.sh)
fi

# The stack picks up ../frontend/dist via a BucketDeployment, so one deploy does both.
./deploy.sh
