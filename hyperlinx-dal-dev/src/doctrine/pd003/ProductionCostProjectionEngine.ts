import type { ObjectProductionProfile, ProductionCostProjectionItem, ProductionProfile, ProductionScalar } from "./PD003ProductionContracts";

function numeric(value: ProductionScalar) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

export function calculateProductionCost(quantity: number, profile: ProductionProfile) {
  return numeric(profile.laborRate) * quantity;
}

export function calculateMaterialCost(quantity: number, profile: ProductionProfile) {
  return numeric(profile.materialRate) * quantity;
}

export function calculateProjectManagementCost(productionDurationDays: number, profile: ProductionProfile) {
  if (profile.profileId !== "PROJECT_MANAGEMENT_STANDARD") return 0;
  const annualLoadedCost = profile.annualLoadedCost ?? 100000;
  return (productionDurationDays / 260) * annualLoadedCost;
}

export function createProductionCostProjection(packageId: string, objectProductionProfiles: ObjectProductionProfile[], productionDurationDays: number): ProductionCostProjectionItem[] {
  return objectProductionProfiles.map((item) => {
    const laborCost = item.profile.costParticipation ? calculateProductionCost(item.quantity, item.profile) : 0;
    const materialCost = item.profile.costParticipation ? calculateMaterialCost(item.quantity, item.profile) : 0;
    const projectManagementCost = calculateProjectManagementCost(productionDurationDays, item.profile);
    return {
      costProjectionId: `${item.objectProductionProfileId}:COST`,
      packageId,
      manifestEntryId: item.manifestEntryId,
      objectType: item.objectType,
      productionProfileId: item.profileId,
      quantity: item.quantity,
      laborCost,
      materialCost,
      projectManagementCost,
      totalForecastCost: laborCost + materialCost + projectManagementCost,
      costParticipation: item.profile.costParticipation,
      costNote: item.profile.productionRate === "INCLUDED" || item.profile.laborRate === "INCLUDED" ? "Included profile creates no additive labor cost unless overridden." : "Deterministic labor/material cost projection.",
    };
  });
}
