# Minting a test JWT

This directory contains scripts for generating JWT tokens for testing the Trip Planner API.

## Prerequisites

1. **AWS CLI**: Must be installed and configured
   ```bash
   brew install awscli  # On macOS
   # or
   curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
   ```

2. **jq**: Required for JSON parsing
   ```bash
   brew install jq  # On macOS
   # or
   sudo apt-get install jq  # On Ubuntu/Debian
   ```

3. **AWS Profile**: an AWS CLI profile with access to the user pool (`AWS_PROFILE` in `.env`, or the `trip-planner` default in the script)

## Files

- **generate-jwt.sh**: Main script to generate JWT tokens
- **.cognito-config**: gitignored; copy `.cognito-config.example` and fill it in

## Usage

### Generate a JWT Token
```bash
./generate-jwt.sh
# or
./generate-jwt.sh generate
```

### Generate and Decode a JWT Token
```bash
./generate-jwt.sh decode
```

### Generate Bearer Token Format
```bash
./generate-jwt.sh bearer
```

### Using a Different AWS Profile
```bash
AWS_PROFILE=other-profile ./generate-jwt.sh
```

## Configuration

The `.cognito-config` file contains:
- `USER_POOL_ID`: Cognito User Pool ID (stack output `UserPoolId`)
- `CLIENT_ID`: Cognito App Client ID (stack output `UserPoolClientId`)
- `TEST_USERNAME`: a confirmed test user's email
- `TEST_PASSWORD`: Test user password
- `AWS_REGION`: AWS region (us-west-2)

## Troubleshooting

### "Incorrect username or password" Error
- Ensure the test user exists in Cognito
- Verify the password is correct
- Check if the user status is CONFIRMED

### AWS Credentials Not Found
- Ensure AWS CLI is configured: `aws configure list`
- Check if the `trip-planner` profile exists: `aws configure list --profile trip-planner`
- Set AWS_PROFILE environment variable: `export AWS_PROFILE=trip-planner`

### Script Permission Denied
```bash
chmod +x generate-jwt.sh
```

## Testing the JWT

Use the generated JWT token with your API:
```bash
# Get JWT
JWT=$(./generate-jwt.sh)

# Use with curl
curl -H "Authorization: Bearer $JWT" https://your-api-endpoint.com/

# Or use the bearer format directly
curl -H "Authorization: $(./generate-jwt.sh bearer)" https://your-api-endpoint.com/
```