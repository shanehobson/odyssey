#!/bin/bash

# JWT Generator for Testing
# This script authenticates with AWS Cognito and retrieves a fresh JWT token
#
# Requirements:
# - AWS CLI installed and configured with 'trip-planner' profile
# - jq installed for JSON parsing
# - .cognito-config file with Cognito configuration
#
# Usage:
#   ./generate-jwt.sh [generate|decode|bearer]
#   
# To use a different AWS profile:
#   AWS_PROFILE=other-profile ./generate-jwt.sh

# Load configuration
CONFIG_FILE="$(dirname "$0")/.cognito-config"

if [ ! -f "$CONFIG_FILE" ]; then
    echo "Error: Configuration file not found at $CONFIG_FILE"
    exit 1
fi

source "$CONFIG_FILE"

# Set AWS profile if not already set
: ${AWS_PROFILE:=trip-planner}

# Function to authenticate and get tokens
get_jwt_token() {
    echo "Authenticating with AWS Cognito..." >&2
    
    # Initiate auth flow
    AUTH_RESPONSE=$(aws cognito-idp initiate-auth \
        --profile "$AWS_PROFILE" \
        --client-id "$CLIENT_ID" \
        --auth-flow USER_PASSWORD_AUTH \
        --auth-parameters USERNAME="$TEST_USERNAME",PASSWORD="$TEST_PASSWORD" \
        --region "$AWS_REGION" \
        2>&1)
    
    if [ $? -ne 0 ]; then
        echo "Error: Failed to authenticate with Cognito" >&2
        echo "Error details: $AUTH_RESPONSE" >&2
        echo "Make sure AWS CLI is configured and the credentials are correct" >&2
        exit 1
    fi
    
    # Extract the ID token
    ID_TOKEN=$(echo "$AUTH_RESPONSE" | jq -r '.AuthenticationResult.IdToken')
    
    if [ -z "$ID_TOKEN" ] || [ "$ID_TOKEN" = "null" ]; then
        echo "Error: Failed to extract ID token from response" >&2
        exit 1
    fi
    
    echo "$ID_TOKEN"
}

# Function to decode and display JWT claims (optional)
decode_jwt() {
    local token=$1
    
    # Extract the payload (second part of the JWT)
    local payload=$(echo "$token" | cut -d'.' -f2)
    
    # Add padding if needed
    local padding=$((4 - ${#payload} % 4))
    if [ $padding -ne 4 ]; then
        payload="${payload}$(printf '=%.0s' $(seq 1 $padding))"
    fi
    
    # Decode base64 and parse JSON
    echo "$payload" | base64 -d 2>/dev/null | jq . 2>/dev/null
}

# Main script logic
case "${1:-generate}" in
    "generate")
        # Just output the token
        get_jwt_token
        ;;
    "decode")
        # Generate and decode the token
        TOKEN=$(get_jwt_token)
        echo "JWT Token:" >&2
        echo "$TOKEN" >&2
        echo "" >&2
        echo "Decoded Claims:" >&2
        decode_jwt "$TOKEN" >&2
        echo "" >&2
        echo "Token (for copying):"
        echo "$TOKEN"
        ;;
    "bearer")
        # Output in Bearer token format
        TOKEN=$(get_jwt_token)
        echo "Bearer $TOKEN"
        ;;
    *)
        echo "Usage: $0 [generate|decode|bearer]" >&2
        echo "  generate - Output just the JWT token (default)" >&2
        echo "  decode   - Generate token and show decoded claims" >&2
        echo "  bearer   - Output token in 'Bearer TOKEN' format" >&2
        exit 1
        ;;
esac