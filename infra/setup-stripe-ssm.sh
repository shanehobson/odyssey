#!/bin/bash

# Exit on any error
set -e

echo "🔐 Setting up Stripe SSM parameters..."

# Get the directory of the script
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

# Deployment settings (AWS_PROFILE, AWS_REGION) come from .env; see .env.example
if [ -f .env ]; then set -a; . ./.env; set +a; fi
export AWS_PROFILE="${AWS_PROFILE:?set AWS_PROFILE in .env}"
export AWS_REGION="${AWS_REGION:-us-west-2}"

# Check if AWS CLI is configured properly
if ! aws sts get-caller-identity >/dev/null 2>&1; then
    echo "❌ Error: AWS CLI is not properly configured. Please check your credentials."
    exit 1
fi

# Get region from environment or use default
REGION=${AWS_REGION:-us-west-2}
echo "🌍 Using AWS Region: $REGION"

# Prompt for Stripe keys if not in environment
if [ -z "$STRIPE_SECRET_KEY" ]; then
    echo "Enter your Stripe secret key (starts with sk_test_ or sk_live_):"
    read -s STRIPE_SECRET_KEY
    echo
fi

if [ -z "$STRIPE_WEBHOOK_SECRET" ]; then
    echo "Enter your Stripe webhook signing secret (starts with whsec_):"
    read -s STRIPE_WEBHOOK_SECRET
    echo
fi

# Create SSM parameters
echo "📝 Creating Stripe secret key parameter..."
aws ssm put-parameter \
    --name "/odyssey/stripe/secret_key_test" \
    --value "$STRIPE_SECRET_KEY" \
    --type SecureString \
    --overwrite \
    --region "$REGION" \
    --description "Stripe API secret key for Road Trip Planner"

echo "📝 Creating Stripe webhook secret parameter..."
aws ssm put-parameter \
    --name "/odyssey/stripe/webhook_secret_test" \
    --value "$STRIPE_WEBHOOK_SECRET" \
    --type SecureString \
    --overwrite \
    --region "$REGION" \
    --description "Stripe webhook signing secret for Road Trip Planner"

echo "✅ SSM parameters created successfully!"
echo ""
echo "Next steps:"
echo "1. Configure your Stripe webhook in the Stripe Dashboard"
echo "2. Set the webhook URL to: https://YOUR_API_DOMAIN/api/stripe/webhook"
echo "3. Select these events: checkout.session.completed, customer.subscription.updated, customer.subscription.deleted"