import { App } from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import { TripPlannerInfraStack } from "../lib/trip-planner-infra-stack";

const context = {
  domainName: "example.com",
  hostedZoneId: "Z0123456789ABCDEFGHIJ",
  certificateArn:
    "arn:aws:acm:us-east-1:123456789012:certificate/00000000-0000-0000-0000-000000000000",
};

function synth() {
  const app = new App({ context });
  const stack = new TripPlannerInfraStack(app, "TestStack", {
    env: { account: "123456789012", region: "us-west-2" },
  });
  return Template.fromStack(stack);
}

describe("TripPlannerInfraStack", () => {
  test("requires deployment settings", () => {
    const app = new App();
    expect(() => new TripPlannerInfraStack(app, "Missing")).toThrow(/domainName/);
  });

  test("serves the SPA and BFF through one CloudFront distribution", () => {
    const template = synth();
    template.resourceCountIs("AWS::CloudFront::Distribution", 1);
    template.hasResourceProperties("AWS::CloudFront::Distribution", {
      DistributionConfig: { Aliases: ["example.com", "www.example.com"] },
    });
    template.hasResourceProperties("AWS::Lambda::Url", { AuthType: "NONE", InvokeMode: "RESPONSE_STREAM" });
  });

  test("reads the edge shared secret from SSM rather than the template", () => {
    const template = synth();
    const params = template.toJSON().Parameters ?? {};
    const ssmParams = Object.values(params).filter(
      (p: any) => p.Type === "AWS::SSM::Parameter::Value<String>" && p.Default === "/odyssey/edge-shared-secret"
    );
    expect(ssmParams).toHaveLength(1);
    expect(JSON.stringify(template.toJSON())).not.toMatch(/edge-TestStack/);
  });

  test("creates the data stores", () => {
    const template = synth();
    template.resourceCountIs("AWS::DynamoDB::Table", 4);
    template.resourceCountIs("AWS::Cognito::UserPool", 1);
  });
});
