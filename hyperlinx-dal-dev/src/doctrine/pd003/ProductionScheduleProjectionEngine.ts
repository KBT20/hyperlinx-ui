import type { ObjectProductionProfile, ProductionProfile, ProductionScheduleProjectionItem, ProductionScalar } from "./PD003ProductionContracts";

function numeric(value: ProductionScalar) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

export function calculateDurationDays(quantity: number, profile: ProductionProfile) {
  const rate = numeric(profile.productionRate);
  if (!rate || profile.productionRate === "INCLUDED") return 0;
  return quantity / rate;
}

export function calculateCrewAdjustedDurationDays(quantity: number, profile: ProductionProfile) {
  const duration = calculateDurationDays(quantity, profile);
  const crewCount = Math.max(1, profile.crewCountDefault || 1);
  return duration / crewCount;
}

export function calculateWeeklyProduction(profile: ProductionProfile) {
  const rate = numeric(profile.productionRate);
  if (!rate || profile.productionRate === "INCLUDED") return 0;
  return rate * Math.max(1, profile.crewCountDefault || 1) * 5;
}

export function createProductionScheduleProjection(packageId: string, objectProductionProfiles: ObjectProductionProfile[]): ProductionScheduleProjectionItem[] {
  return objectProductionProfiles.map((item) => {
    const durationDays = calculateDurationDays(item.quantity, item.profile);
    const crewAdjustedDurationDays = calculateCrewAdjustedDurationDays(item.quantity, item.profile);
    return {
      scheduleProjectionId: `${item.objectProductionProfileId}:SCHEDULE`,
      packageId,
      manifestEntryId: item.manifestEntryId,
      objectType: item.objectType,
      productionProfileId: item.profileId,
      quantity: item.quantity,
      productionRate: item.profile.productionRate,
      durationDays,
      crewAdjustedDurationDays,
      weeklyProduction: calculateWeeklyProduction(item.profile),
      crewType: item.profile.crewType,
      crewCount: item.profile.crewCountDefault,
      scheduleParticipation: item.profile.scheduleParticipation,
      concurrentProductionEligible: true,
      scheduleNote: item.profile.productionRate === "INCLUDED" ? "Included production profile preserves schedule note without additive duration." : "Deterministic production duration projection.",
    };
  });
}
