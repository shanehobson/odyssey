// lib/trip-planner-infra-stack.ts
import * as cdk from "aws-cdk-lib";
import {
  Duration,
  RemovalPolicy,
  Stack,
  StackProps,
  CfnOutput,
  Fn,
  aws_cognito as cognito,
  aws_dynamodb as ddb,
  aws_lambda as lambda,
  aws_lambda_nodejs as nodejs,
  aws_s3 as s3,
  aws_s3_deployment as s3deploy,
  aws_ssm as ssm,
  aws_cloudfront as cloudfront,
  aws_cloudfront_origins as origins,
  aws_route53 as route53,
  aws_route53_targets as targets,
  aws_certificatemanager as acm,
} from "aws-cdk-lib";
import { Construct } from "constructs";

/** SSM parameter holding the CloudFront -> Lambda shared secret (see setup-edge-secret-ssm.sh). */
export const EDGE_SHARED_SECRET_PARAM = "/odyssey/edge-shared-secret";

/** Read a required deployment setting from CDK context, falling back to an environment variable. */
function requireSetting(scope: Construct, contextKey: string, envVar: string): string {
  const value = scope.node.tryGetContext(contextKey) ?? process.env[envVar];
  if (!value) {
    throw new Error(
      `Missing deployment setting: pass -c ${contextKey}=... or set ${envVar} (see .env.example)`
    );
  }
  return String(value);
}

export class TripPlannerInfraStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // Deployment configuration: passed as CDK context (-c key=value) or environment
    // variables. deploy.sh loads them from a local, gitignored .env file.
    const domainName = requireSetting(this, "domainName", "DOMAIN_NAME");
    const hostedZoneId = requireSetting(this, "hostedZoneId", "HOSTED_ZONE_ID");
    const certificateArn = requireSetting(this, "certificateArn", "CERTIFICATE_ARN");
    const extraCorsOrigins = (this.node.tryGetContext("extraCorsOrigins") ?? process.env.EXTRA_CORS_ORIGINS ?? "")
      .split(",")
      .map((o: string) => o.trim())
      .filter(Boolean);
    const wwwDomainName = `www.${domainName}`;

    // ACM certificate must live in us-east-1 (CloudFront) and cover apex + www
    const certificate = acm.Certificate.fromCertificateArn(this, "SiteCertificate", certificateArn);

    // Route 53 hosted zone for the domain
    const hostedZone = route53.HostedZone.fromHostedZoneAttributes(this, "HostedZone", {
      hostedZoneId,
      zoneName: domainName,
    });

    // 1) Cognito: User Pool + App Client (email sign-in)
    const userPool = new cognito.UserPool(this, "UserPool", {
      selfSignUpEnabled: true,
      signInAliases: { email: true },
      removalPolicy: RemovalPolicy.DESTROY, // dev only; use RETAIN in prod
      userVerification: {
        emailSubject: "Verify your Odyssey account",
        emailBody: "Your verification code is {####}",
        emailStyle: cognito.VerificationEmailStyle.CODE,
      },
      userInvitation: {
        emailSubject: "Welcome to Odyssey",
        emailBody: "Welcome to Odyssey! Your username is {username} and your temporary password is {####}",
      },
      // Customize password reset email
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
    });

    const userPoolClient = new cognito.UserPoolClient(this, "UserPoolClient", {
      userPool,
      generateSecret: false, // public SPA / native apps
      authFlows: {
        userPassword: true,
        userSrp: true,
      },
    });

    // Server-side client for BFF auth flow (with secret)
    const serverPoolClient = new cognito.UserPoolClient(this, "ServerPoolClient", {
      userPool,
      generateSecret: true, // server/confidential client
      authFlows: {
        userPassword: true,
        userSrp: true,
      },
      oAuth: {
        flows: {
          authorizationCodeGrant: true,
        },
        scopes: [cognito.OAuthScope.OPENID, cognito.OAuthScope.EMAIL, cognito.OAuthScope.PROFILE],
        callbackUrls: [
          `https://${domainName}/auth/callback`,
          `https://${wwwDomainName}/auth/callback`,
          "https://localhost:3000/auth/callback",
        ],
        logoutUrls: [
          `https://${domainName}/`,
          `https://${wwwDomainName}/`,
          "https://localhost:3000/",
        ],
      },
    });

    // Cognito domain for hosted UI
    const cognitoDomain = userPool.addDomain("CognitoDomain", {
      cognitoDomain: {
        domainPrefix: `trip-planner-${Stack.of(this).account}-${Stack.of(this).region}`, // Must be unique
      },
    });

    // 2) Data: DynamoDB trips table (PK userId, SK tripId)
    const tripsTable = new ddb.Table(this, "TripsTable", {
      partitionKey: { name: "userId", type: ddb.AttributeType.STRING },
      sortKey: { name: "tripId", type: ddb.AttributeType.STRING },
      billingMode: ddb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.DESTROY, // dev only
    });

    // Optional GSI to list trips newest-first per user
    tripsTable.addGlobalSecondaryIndex({
      indexName: "byUpdatedAt",
      partitionKey: { name: "userId", type: ddb.AttributeType.STRING },
      sortKey: { name: "updatedAt", type: ddb.AttributeType.NUMBER },
    });

    // 3) Storage: S3 bucket for trip JSON blobs
    const tripsBucket = new s3.Bucket(this, "TripsBucket", {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      autoDeleteObjects: true, // dev only
      removalPolicy: RemovalPolicy.DESTROY, // dev only
    });

    // S3: Frontend web bucket (empty now; you'll upload build artifacts later)
    const webBucket = new s3.Bucket(this, "WebBucket", {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      removalPolicy: RemovalPolicy.DESTROY, // dev only; use RETAIN in prod
      autoDeleteObjects: true,              // dev only
    });

    // 4) Parameter for AI API key (created as plain String to unblock deploy)
    const aiApiKeyParam = new ssm.StringParameter(this, "AiApiKeyParam", {
      parameterName: "/trip-planner/ai/api-key",
      stringValue: "REPLACE_AFTER_DEPLOY", // we'll overwrite as SecureString via CLI
      // NOTE: no 'type' here — we'll store a SecureString value after deploy
    });

    // No VPC needed for Lambda Function URL

    // 6) Lambda: backend handler (no VPC for streaming support)
    const apiHandler = new nodejs.NodejsFunction(this, "ApiHandler", {
      entry: "lambda/api.ts",
      runtime: lambda.Runtime.NODEJS_20_X,
      timeout: Duration.seconds(90),
      environment: {
        TABLE_NAME: tripsTable.tableName,
        BUCKET_NAME: tripsBucket.bucketName,
        AI_API_KEY_PARAM: aiApiKeyParam.parameterName,
        OPENAI_MODEL: "gpt-4o",
        COGNITO_USER_POOL_ID: userPool.userPoolId,
        COGNITO_APP_CLIENT_ID: userPoolClient.userPoolClientId,
        COGNITO_SERVER_CLIENT_ID: serverPoolClient.userPoolClientId,
        COGNITO_DOMAIN: cognitoDomain.domainName,
      },
    });

    // Store server client secret in SSM
    const serverClientSecretParam = new ssm.StringParameter(this, "ServerClientSecretParam", {
      parameterName: "/trip-planner/cognito/server-client-secret",
      stringValue: serverPoolClient.userPoolClientSecret.unsafeUnwrap(), // Only for dev; use SecureString in prod
      description: "Cognito server client secret for BFF auth flow",
    });

    // Add the secret parameter name to Lambda environment
    apiHandler.addEnvironment("COGNITO_SERVER_CLIENT_SECRET_PARAM", serverClientSecretParam.parameterName);

    // IAM grants for the Lambda
    tripsTable.grantReadWriteData(apiHandler);
    tripsBucket.grantReadWrite(apiHandler);
    aiApiKeyParam.grantRead(apiHandler);
    serverClientSecretParam.grantRead(apiHandler);

    // 6.1) Add Lambda Function URL for streaming support
    const streamingFunctionUrl = new lambda.FunctionUrl(this, "StreamingFunctionUrl", {
      function: apiHandler,
      authType: lambda.FunctionUrlAuthType.NONE,
      invokeMode: lambda.InvokeMode.RESPONSE_STREAM,
      cors: {
        allowedOrigins: [
          `https://${domainName}`,
          `https://${wwwDomainName}`,
          "http://localhost:3000",
          "http://localhost:3001",
          "http://localhost:4200",
          ...extraCorsOrigins,
        ],
        allowedMethods: [lambda.HttpMethod.ALL],
        allowedHeaders: ["*"],
        allowCredentials: true,
      },
    });

    // No ALB needed - using Lambda Function URL directly

    // Shared secret that CloudFront attaches to every origin request as X-Bff-Auth.
    // The Lambda rejects /api/* and /auth/* requests without it, so the Function URL
    // (which must be public for response streaming) cannot be called directly.
    // The value lives in SSM, created by setup-edge-secret-ssm.sh; it is resolved by
    // CloudFormation at deploy time and never appears in this repository.
    const edgeSharedSecret = ssm.StringParameter.valueForStringParameter(
      this,
      EDGE_SHARED_SECRET_PARAM
    );
    apiHandler.addEnvironment("EDGE_SHARED_SECRET", edgeSharedSecret);

    // 8) Add session table for auth tokens
    const sessionsTable = new ddb.Table(this, "SessionsTable", {
      partitionKey: { name: "sid", type: ddb.AttributeType.STRING },
      timeToLiveAttribute: "ttl",
      billingMode: ddb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.DESTROY, // dev only
    });
    sessionsTable.grantReadWriteData(apiHandler);
    apiHandler.addEnvironment("SESSIONS_TABLE", sessionsTable.tableName);

    // 9) Add user entitlements table for Stripe billing
    const userEntitlementsTable = new ddb.Table(this, "UserEntitlementsTable", {
      partitionKey: { name: "userId", type: ddb.AttributeType.STRING },
      billingMode: ddb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.DESTROY, // dev only
    });
    userEntitlementsTable.grantReadWriteData(apiHandler);
    apiHandler.addEnvironment("USER_ENTITLEMENTS_TABLE", userEntitlementsTable.tableName);

    // 10) Add user usage table for weekly tracking
    const userUsageTable = new ddb.Table(this, "UserUsageTable", {
      partitionKey: { name: "userId", type: ddb.AttributeType.STRING },
      sortKey: { name: "weekKey", type: ddb.AttributeType.STRING },
      timeToLiveAttribute: "ttl",
      billingMode: ddb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.DESTROY, // dev only
    });
    userUsageTable.grantReadWriteData(apiHandler);
    apiHandler.addEnvironment("USER_USAGE_TABLE", userUsageTable.tableName);

    // Add environment variables for cookie/session handling
    apiHandler.addEnvironment("SESSION_COOKIE_NAME", "tp_sess");
    apiHandler.addEnvironment("COOKIE_SAMESITE", "Lax"); // or 'Strict' if your flows allow

    // Add Stripe environment variables (SSM parameter paths)
    apiHandler.addEnvironment("STRIPE_SECRET_KEY_PARAM", "/odyssey/stripe/secret_key_test");
    apiHandler.addEnvironment("STRIPE_WEBHOOK_SECRET_PARAM", "/odyssey/stripe/webhook_secret_test");
    apiHandler.addEnvironment("STRIPE_PRICE_ID_PRO_PARAM", "/odyssey/stripe/price_id_pro");
    apiHandler.addEnvironment("APP_BASE_URL", `https://${domainName}`);
    
    // Grant Lambda permission to read Stripe SSM parameters
    apiHandler.addToRolePolicy(new cdk.aws_iam.PolicyStatement({
      actions: ["ssm:GetParameter"],
      resources: [
        `arn:aws:ssm:${this.region}:${this.account}:parameter/odyssey/stripe/*`
      ],
    }))
    apiHandler.addEnvironment("COOKIE_SECURE", "true");  // always true in prod
    apiHandler.addEnvironment("COOKIE_DOMAIN", domainName);  // custom domain for cookies

    // 9) CloudFront Cache Policies
    // Cache: Static assets (long cache)
    const cacheStatic = new cloudfront.CachePolicy(this, "CachePolicyStatic", {
      cachePolicyName: `${Stack.of(this).stackName}-static`,
      defaultTtl: Duration.days(30),
      minTtl: Duration.days(1),
      maxTtl: Duration.days(365),
      enableAcceptEncodingGzip: true,
      enableAcceptEncodingBrotli: true,
    });

    // Cache: Disabled for auth/api (always go to origin) with authorization headers
    const cacheDisabledWithAuth = new cloudfront.CachePolicy(this, "CachePolicyDisabledWithAuth", {
      cachePolicyName: `${Stack.of(this).stackName}-disabled-with-auth`,
      defaultTtl: Duration.seconds(0),
      minTtl: Duration.seconds(0),
      maxTtl: Duration.seconds(1),
      headerBehavior: cloudfront.CacheHeaderBehavior.allowList('Authorization'),
      cookieBehavior: cloudfront.CacheCookieBehavior.all(),
      queryStringBehavior: cloudfront.CacheQueryStringBehavior.all(),
      enableAcceptEncodingGzip: true,
      enableAcceptEncodingBrotli: true,
    });

    // Cache: Disabled for auth/api (always go to origin)
    const cacheDisabled = cloudfront.CachePolicy.CACHING_DISABLED;

    // Origin request: forward everything for dynamic routes + add shared secret header
    const originReqAll = new cloudfront.OriginRequestPolicy(this, "OriginReqAll", {
      originRequestPolicyName: `${Stack.of(this).stackName}-all`,
      cookieBehavior: cloudfront.OriginRequestCookieBehavior.all(),
      headerBehavior: cloudfront.OriginRequestHeaderBehavior.allowList(
        'Content-Type', 
        'X-CSRF-Token',
        'X-Requested-With',
        'Accept',
        'Accept-Language',
        'User-Agent',
        'Referer'
      ),
      queryStringBehavior: cloudfront.OriginRequestQueryStringBehavior.all(),
    });


    // 10) Define CloudFront Origins
    // Lambda Function URL origin for API routes
    const functionUrlHostname = Fn.select(2, Fn.split("/", streamingFunctionUrl.url));
    
    const functionUrlOrigin = new origins.HttpOrigin(
      functionUrlHostname,
      {
        protocolPolicy: cloudfront.OriginProtocolPolicy.HTTPS_ONLY,
        originId: "FunctionUrlOrigin",
        readTimeout: Duration.seconds(90),
        keepaliveTimeout: Duration.seconds(90),
        customHeaders: {
          'X-Bff-Auth': edgeSharedSecret, // Add the shared secret header
        },
      }
    );

    // SPA origin (S3 bucket)
    const spaOrigin = origins.S3BucketOrigin.withOriginAccessControl(webBucket, {
      originId: "SPAOrigin",
    });

    // 11) Create CloudFront Distribution
    const distribution = new cloudfront.Distribution(this, "WebDistribution", {
      defaultRootObject: "index.html",
      domainNames: [domainName, wwwDomainName],
      certificate: certificate,
      defaultBehavior: {
        origin: spaOrigin,
        cachePolicy: cacheStatic,
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        functionAssociations: [{
          function: new cloudfront.Function(this, "SPARewriteFunction", {
            code: cloudfront.FunctionCode.fromInline(`
              function handler(event) {
                var request = event.request;
                var uri = request.uri;
                
                // Check if it's an API or auth route - let these pass through
                if (uri.startsWith('/api') || uri.startsWith('/auth')) {
                  return request;
                }
                
                // Check if it's a static asset (has file extension)
                var lastSegment = uri.split('/').pop() || '';
                var hasExtension = lastSegment.includes('.') && lastSegment.split('.').length > 1;
                
                // If it's a static asset, let it pass through
                if (hasExtension) {
                  return request;
                }
                
                // For all other paths (SPA routes), serve index.html
                request.uri = '/index.html';
                
                return request;
              }
            `),
          }),
          eventType: cloudfront.FunctionEventType.VIEWER_REQUEST,
        }],
      },
      additionalBehaviors: {
        // If your build emits /assets/* (Vite does), keep long cache
        "/assets/*": {
          origin: spaOrigin,
          cachePolicy: cacheStatic,
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        },
        // Streaming endpoint for trip generation - using Lambda Function URL
        "/api/stream-trip*": {
          origin: functionUrlOrigin,
          cachePolicy: cacheDisabledWithAuth,
          originRequestPolicy: originReqAll,
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
        },
        "/api/*": {
          origin: functionUrlOrigin,
          cachePolicy: cacheDisabledWithAuth,
          originRequestPolicy: originReqAll,
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
        },
        "/auth/*": {
          origin: functionUrlOrigin,
          cachePolicy: cacheDisabledWithAuth,
          originRequestPolicy: originReqAll,
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
        },
      },
      // NOTE: Removed errorResponses - the CloudFront function handles SPA routing
      // by rewriting non-asset paths to /index.html. Error responses were causing
      // missing assets (like stale JS chunks) to return HTML instead of proper 404s,
      // which breaks dynamic imports with MIME type errors.
    });

    // 12) Route 53 DNS records pointing to CloudFront
    // A record for apex domain
    new route53.ARecord(this, "AliasApexA", {
      zone: hostedZone,
      recordName: domainName,
      target: route53.RecordTarget.fromAlias(new targets.CloudFrontTarget(distribution)),
    });

    // AAAA record for apex domain (IPv6)
    new route53.AaaaRecord(this, "AliasApexAAAA", {
      zone: hostedZone,
      recordName: domainName,
      target: route53.RecordTarget.fromAlias(new targets.CloudFrontTarget(distribution)),
    });

    // A record for www subdomain
    new route53.ARecord(this, "AliasWwwA", {
      zone: hostedZone,
      recordName: wwwDomainName,
      target: route53.RecordTarget.fromAlias(new targets.CloudFrontTarget(distribution)),
    });

    // AAAA record for www subdomain (IPv6)
    new route53.AaaaRecord(this, "AliasWwwAAAA", {
      zone: hostedZone,
      recordName: wwwDomainName,
      target: route53.RecordTarget.fromAlias(new targets.CloudFrontTarget(distribution)),
    });

    // Frontend deployment - conditionally deploy if dist folder exists
    const frontendPath = "../frontend/dist";
    try {
      new s3deploy.BucketDeployment(this, "WebsiteDeployment", {
        sources: [s3deploy.Source.asset(frontendPath)],
        destinationBucket: webBucket,
        distribution: distribution,
        distributionPaths: ["/*"], // Invalidate all paths
        memoryLimit: 1024,
        ephemeralStorageSize: cdk.Size.mebibytes(2048),
      });
    } catch (error) {
      // If dist folder doesn't exist, deployment will be skipped
      // This allows infrastructure to be deployed before frontend is built
      console.warn("Frontend dist folder not found. Skipping website deployment.");
    }

    // Outputs
    new CfnOutput(this, "FunctionUrlOutput", { value: streamingFunctionUrl.url });
    new CfnOutput(this, "CloudFrontDomainName", { value: distribution.distributionDomainName });
    new CfnOutput(this, "CustomDomainUrl", { value: `https://${domainName}` });
    new CfnOutput(this, "WebBucketName", { value: webBucket.bucketName });
    new CfnOutput(this, "TripsTableName", { value: tripsTable.tableName });
    new CfnOutput(this, "TripsBucketName", { value: tripsBucket.bucketName });
    new CfnOutput(this, "UserPoolId", { value: userPool.userPoolId });
    new CfnOutput(this, "UserPoolClientId", { value: userPoolClient.userPoolClientId });
    new CfnOutput(this, "ServerPoolClientId", { value: serverPoolClient.userPoolClientId });
    new CfnOutput(this, "CognitoDomain", { value: cognitoDomain.domainName });
    new CfnOutput(this, "SessionsTableName", { value: sessionsTable.tableName });
    new CfnOutput(this, "UserEntitlementsTableName", { value: userEntitlementsTable.tableName });
    new CfnOutput(this, "UserUsageTableName", { value: userUsageTable.tableName });
  }
}
