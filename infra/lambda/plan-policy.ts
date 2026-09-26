export type UserPlan = "free" | "pro";

export interface PlanLimits {
  maxTripDays: number;
  maxItemsPerDay: number;
  weeklyAiRequests: number;
  maxTripInputChars: number;
  maxDrivingHoursPerDay: number;
  maxDrivingMilesPerDay: number;
}

const FREE_PLAN_LIMITS: PlanLimits = {
  maxTripDays: 14,
  maxItemsPerDay: 4,
  weeklyAiRequests: 10,
  maxTripInputChars: 2000,
  maxDrivingHoursPerDay: 10,
  maxDrivingMilesPerDay: 1500,
};

const PRO_PLAN_LIMITS: PlanLimits = {
  maxTripDays: 31,
  maxItemsPerDay: 6,
  weeklyAiRequests: 100,
  maxTripInputChars: 2000,
  maxDrivingHoursPerDay: 10,
  maxDrivingMilesPerDay: 1500,
};

export function getPlanLimits(plan: UserPlan): PlanLimits {
  return plan === "pro" ? PRO_PLAN_LIMITS : FREE_PLAN_LIMITS;
}

export function getActivitiesPerDay(plan: UserPlan, tripDays: number): number {
  const limits = getPlanLimits(plan);
  if (plan === "pro") {
    return tripDays <= 7 ? 6 : 5;
  }
  return tripDays <= 3 ? 4 : tripDays <= 7 ? 3 : 2;
}

export function getSuggestedPlaces(tripDays: number): number {
  return Math.min(Math.max(2, Math.ceil(tripDays / 2)), 8);
}
