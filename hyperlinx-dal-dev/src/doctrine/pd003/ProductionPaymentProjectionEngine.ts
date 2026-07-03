import type { ObjectProductionProfile, ProductionCostProjectionItem, ProductionPaymentProjection, ProductionScheduleProjectionItem } from "./PD003ProductionContracts";

export function createProductionPaymentProjection(
  objectProductionProfiles: ObjectProductionProfile[],
  scheduleProjection: ProductionScheduleProjectionItem[],
  costProjection: ProductionCostProjectionItem[],
): ProductionPaymentProjection[] {
  return objectProductionProfiles
    .filter((item) => item.profile.paymentParticipation)
    .map((item) => {
      const schedule = scheduleProjection.find((candidate) => candidate.manifestEntryId === item.manifestEntryId && candidate.productionProfileId === item.profileId);
      const cost = costProjection.find((candidate) => candidate.manifestEntryId === item.manifestEntryId && candidate.productionProfileId === item.profileId);
      const weeklyQuantity = schedule?.weeklyProduction ?? 0;
      const unitValue = item.quantity > 0 ? (cost?.totalForecastCost ?? 0) / item.quantity : 0;
      return {
        paymentSegmentId: `${item.packageId}:PAYMENT-SEGMENT:${item.manifestEntryId}:${item.profileId}`,
        productionProfileId: item.profileId,
        manifestEntryId: item.manifestEntryId,
        forecastWeeklyQuantity: weeklyQuantity,
        forecastWeeklyValue: weeklyQuantity * unitValue,
        requiredCloses: ["CONSTRUCTION_CLOSE", "INSPECTION_CLOSE", "AS_BUILT_CLOSE", "ENGINEERING_ACCEPTANCE_CLOSE"],
        validationRequired: true,
        paymentEligible: false,
        reason: "Validation required",
        noPaymentAuthorization: true,
        noScopeVersionCreation: true,
      };
    });
}
