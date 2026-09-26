export type UserPlan = "free" | "pro";

export interface PlanLimits {
  maxTripDays: number;
  maxItemsPerDay: number;
  weeklyAiRequests: number;
}

const FREE_PLAN_LIMITS: PlanLimits = {
  maxTripDays: 14,
  maxItemsPerDay: 4,
  weeklyAiRequests: 10,
};

const PRO_PLAN_LIMITS: PlanLimits = {
  maxTripDays: 31,
  maxItemsPerDay: 6,
  weeklyAiRequests: 100,
};

export function getPlanLimits(plan: UserPlan): PlanLimits {
  return plan === "pro" ? PRO_PLAN_LIMITS : FREE_PLAN_LIMITS;
}
