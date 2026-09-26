#!/usr/bin/env node
import { App } from "aws-cdk-lib";
import "source-map-support/register";
import { TripPlannerInfraStack } from "../lib/trip-planner-infra-stack";

const app = new App();
new TripPlannerInfraStack(app, "TripPlannerInfraStack", {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || "us-west-2",
  },
});
