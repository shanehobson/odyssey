# Odyssey infrastructure

AWS CDK stack for Odyssey: one CloudFront distribution that serves the React SPA from S3 and routes `/api/*` and `/auth/*` to a single Lambda BFF (backend-for-frontend) with response streaming.

```
browser ──► CloudFront ──┬── /            S3 web bucket (SPA, OAC)
                         └── /api, /auth  Lambda Function URL (RESPONSE_STREAM)
                                            ├── Cognito user pool (sign-in, sessions)
                                            ├── DynamoDB: trips, sessions, entitlements, weekly usage
                                            ├── S3: trip JSON blobs
                                            ├── OpenAI (streamed itinerary generation)
                                            └── Stripe (checkout + webhooks)
```

## How the pieces fit

- **Single origin.** The SPA and the API share one domain, so auth is a plain HttpOnly session cookie: no tokens in the browser, no CORS in production.
- **Sessions, not JWTs, in the browser.** `/auth/signin` exchanges credentials with Cognito, stores the tokens in a DynamoDB sessions table (TTL) and sets an HttpOnly cookie plus a CSRF cookie. Every API call resolves the cookie to a Cognito `sub` server-side.
- **Streaming.** `POST /api/stream-trip` streams NDJSON from OpenAI's structured output straight to the client through a Lambda Function URL in `RESPONSE_STREAM` mode.
- **Locking the Function URL.** Function URLs must be public for streaming, so CloudFront attaches a shared secret header (`X-Bff-Auth`) to every origin request and the Lambda rejects `/api/*` and `/auth/*` requests that lack it, including the streaming path. The secret lives in SSM and is resolved at deploy time.
- **Secrets stay in SSM.** OpenAI key, Stripe secret key, Stripe webhook secret, the Cognito server-client secret and the edge secret are all SSM parameters read by the Lambda. Nothing sensitive is in this repository or the CloudFormation template.
- **Plans and rate limits.** A Stripe subscription flips the user's entitlement row; a per-user weekly usage table enforces the AI request quota per plan (`lambda/plan-policy.ts`).

## Layout

```
bin/trip-planner-infra.ts       CDK app entry
lib/trip-planner-infra-stack.ts The stack
lambda/api.ts                   BFF handler (auth, trips, billing, streaming)
lambda/trip-schema.ts           JSON schema for OpenAI structured output
lambda/trip-contract.ts         Shared TripPlan types
lambda/plan-policy.ts           Plan limits
test/                           CDK assertions (synth with dummy context)
docs/api.md                     REST API reference
docs/frontend-integration.md    Auth flow and fetch conventions
docs/jwt-testing.md             Minting a test JWT for curl
```

## Deploying

Prerequisites: an AWS CLI profile, Node 20+, a Route 53 hosted zone for your domain and an ACM certificate in `us-east-1` covering the apex and `www`.

```bash
cp .env.example .env          # AWS_PROFILE, DOMAIN_NAME, HOSTED_ZONE_ID, CERTIFICATE_ARN
npm ci
./setup-edge-secret-ssm.sh    # once: CloudFront -> Lambda shared secret
./setup-openai-ssm.sh <key>   # once: OpenAI key
./setup-stripe-ssm.sh         # once: Stripe keys (prompts; nothing echoed)
./deploy.sh                   # cdk deploy with the settings above as context
```

`./deploy-frontend.sh` builds `../frontend` and syncs it to the web bucket with a CloudFront invalidation (about 30 seconds). `./deploy-full-stack.sh` does both through CDK.

Stack outputs give you everything else: `CloudFrontDomainName`, `FunctionUrlOutput`, `WebBucketName`, `UserPoolId`, `UserPoolClientId`, table and bucket names.

## Development

```bash
npm run build      # tsc
npm test           # jest: synthesizes the stack with dummy context and asserts on it
npx cdk synth -c domainName=example.com -c hostedZoneId=Z0123456789ABCDEFGHIJ \
  -c certificateArn=arn:aws:acm:us-east-1:123456789012:certificate/00000000-0000-0000-0000-000000000000
```

## Known limitations

- Resources use `RemovalPolicy.DESTROY` and `autoDeleteObjects`, which suits a personal project; switch to `RETAIN` before trusting it with data you cannot recreate.
- The Cognito server-client secret is written to a plain SSM `String` parameter by CDK (`unsafeUnwrap`). A SecureString written out-of-band would be stricter.
- The Lambda is a single file. It grew with the product and would benefit from being split into route modules.
