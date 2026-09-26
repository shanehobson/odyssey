#!/bin/bash

# Exit on any error
set -e

echo "🔐 Setting up OpenAI API key in AWS SSM..."

# Get the directory of the script
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

# Deployment settings (AWS_PROFILE, AWS_REGION) come from .env; see .env.example
if [ -f .env ]; then set -a; . ./.env; set +a; fi
export AWS_PROFILE="${AWS_PROFILE:?set AWS_PROFILE in .env}"
export AWS_REGION="${AWS_REGION:-us-west-2}"

# Check if API key is provided as argument
if [ -z "$1" ]; then
    echo "❌ Error: Please provide your OpenAI API key as an argument"
    echo "Usage: ./setup-openai-ssm.sh YOUR_OPENAI_API_KEY"
    echo ""
    echo "Get your API key from: https://platform.openai.com/account/api-keys"
    exit 1
fi

OPENAI_API_KEY="$1"

# Update the API key in SSM Parameter Store
echo "🔧 Updating OpenAI API key in SSM Parameter Store..."
aws ssm put-parameter \
    --name "/trip-planner/ai/api-key" \
    --value "$OPENAI_API_KEY" \
    --type SecureString \
    --overwrite \
    --region "$AWS_REGION"

if [ $? -eq 0 ]; then
    echo "✅ OpenAI API key successfully updated in SSM!"
    echo ""
    echo "The API key has been securely stored and will be used by your Lambda functions."
    echo "Your trip generation should now work properly."
else
    echo "❌ Failed to update OpenAI API key in SSM"
    exit 1
fi