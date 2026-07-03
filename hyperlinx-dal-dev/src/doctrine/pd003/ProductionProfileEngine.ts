import { getPD003ProductionDoctrine } from "./PD003ProductionDoctrine";
import {
  type CreateProductionArtifactsInput,
  type ObjectProductionProfile,
  type ProductionDoctrineArtifacts,
  type ProductionHumanOverride,
  type ProductionProfile,
  type ProductionProfileId,
  type ProductionReviewObject,
  type ProductionScalar,
} from "./PD003ProductionContracts";
import { createProductionProfileLibrary } from "./ProductionProfileLibrary";
import { createProductionScheduleProjection } from "./ProductionScheduleProjectionEngine";
import { createProductionCostProjection } from "./ProductionCostProjectionEngine";
import { createProductionPaymentProjection } from "./ProductionPaymentProjectionEngine";
import { createProductionValidation } from "./ProductionValidationEngine";

function profileIdsForObjectType(objectType: string, productIncludesFiber: boolean): ProductionProfileId[] {
  const type = objectType.toUpperCase();
  if (type === "PLOW_SEGMENT") return ["PLOW_STANDARD", "HYDROVAC_INCLUDED_STANDARD"];
  if (type === "DIRECTIONAL_BORE_SEGMENT") return ["BORE_DIRT_STANDARD", "HYDROVAC_INCLUDED_STANDARD"];
  if (type === "ROCK_BORE_SEGMENT") return ["BORE_ROCK_STANDARD", "HYDROVAC_INCLUDED_STANDARD"];
  if (type === "OPEN_TRENCH_SEGMENT") return ["OPEN_TRENCH_DIRT_STANDARD"];
  if (type === "CONDUIT") return ["PLOW_STANDARD", "MATERIAL_CONDUIT_1_5_STANDARD"];
  if (type === "INNERDUCT" || type === "FUTUREPATH") return ["MATERIAL_FUTUREPATH_STANDARD"];
  if (type === "FIBER") return productIncludesFiber ? ["FIBER_BLOW_STANDARD", "FIBER_PULL_STANDARD", "MATERIAL_FIBER_864_STANDARD", "TESTING_INCLUDED_WITH_SPLICING"] : [];
  if (type === "SPLICE_CASE") return ["SPLICE_864_STANDARD", "MATERIAL_SPLICE_CASE_STANDARD", "TESTING_INCLUDED_WITH_SPLICING"];
  if (type === "HANDHOLE" || type === "MANHOLE" || type === "VAULT") return ["MATERIAL_HANDHOLE_STANDARD"];
  if (type === "RESTORATION") return ["RESTORATION_INCLUDED_STANDARD"];
  if (type.includes("RAILROAD") || type.includes("ROAD") || type.includes("RIVER") || type.includes("WATER") || type.includes("DOT")) return ["BORE_DIRT_STANDARD"];
  return [];
}

function primaryProductionProfileId(objectType: string, productIncludesFiber: boolean): ProductionProfileId | undefined {
  return profileIdsForObjectType(objectType, productIncludesFiber).find((profileId) => !profileId.startsWith("MATERIAL_") && !profileId.includes("INCLUDED"));
}

export function productionProfileIdsForCatalogObject(objectType: string, productIncludesFiber = true): ProductionProfileId[] {
  return profileIdsForObjectType(objectType, productIncludesFiber);
}

export function materialProfileIdsForCatalogObject(objectType: string, productIncludesFiber = true): ProductionProfileId[] {
  return profileIdsForObjectType(objectType, productIncludesFiber).filter((profileId) => profileId.startsWith("MATERIAL_"));
}

export function applyProductionHumanOverride(profile: ProductionProfile, override: Omit<ProductionHumanOverride, "overrideId" | "profileId" | "replacesProfileValue" | "noSilentOverride" | "noScopeVersionCreation">): { profile: ProductionProfile; override: ProductionHumanOverride } {
  const replacesProfileValue = profile[override.field] as ProductionScalar;
  const fullOverride: ProductionHumanOverride = {
    ...override,
    overrideId: `${profile.profileId}:OVERRIDE:${override.field}:${override.timestamp}`,
    profileId: profile.profileId,
    replacesProfileValue,
    noSilentOverride: true,
    noScopeVersionCreation: true,
  };
  return {
    profile: {
      ...profile,
      [override.field]: override.overrideValue,
      authorityMode: "HUMAN_OVERRIDE",
      confidence: override.confidence,
      notes: [...profile.notes, `Human override by ${override.actor}: ${override.reason}`],
    },
    override: fullOverride,
  };
}

function reviewObjectsForProfile(packageId: string, item: ObjectProductionProfile): ProductionReviewObject[] {
  const reviews: ProductionReviewObject[] = [];
  const values: Array<[ProductionScalar, "productionRate" | "laborRate" | "materialRate"]> = [
    [item.profile.productionRate, "productionRate"],
    [item.profile.laborRate, "laborRate"],
    [item.profile.materialRate, "materialRate"],
  ];
  values.forEach(([value, field]) => {
    if (value === "UNKNOWN" || value === "CONFIGURABLE") {
      reviews.push({
        reviewObjectId: `${item.objectProductionProfileId}:REVIEW:${field}`,
        packageId,
        profileId: item.profileId,
        manifestEntryId: item.manifestEntryId,
        reviewType: value === "UNKNOWN" ? "UNKNOWN_PRODUCTION_VALUE" : "CONFIGURABLE_RATE",
        blocking: value === "UNKNOWN",
        confidence: value === "UNKNOWN" ? 40 : Math.min(item.profile.confidence, 65),
        reason: `${item.profileId} ${field} is ${value}; human review required before production certification.`,
        engineeringActionRequired: true,
        noScopeVersionCreation: true,
      });
    }
  });
  if (item.profile.requiresHumanReview) {
    reviews.push({
      reviewObjectId: `${item.objectProductionProfileId}:REVIEW:HUMAN`,
      packageId,
      profileId: item.profileId,
      manifestEntryId: item.manifestEntryId,
      reviewType: "HUMAN_REVIEW_REQUIRED",
      blocking: false,
      confidence: item.profile.confidence,
      reason: `${item.profileId} requires human production review.`,
      engineeringActionRequired: true,
      noScopeVersionCreation: true,
    });
  }
  return reviews;
}

export function createObjectProductionProfiles(input: CreateProductionArtifactsInput): ObjectProductionProfile[] {
  const library = createProductionProfileLibrary(input.generatedAt);
  return input.auditObjectManifest.entries.flatMap((entry) => {
    const profileIds = profileIdsForObjectType(entry.objectType, input.productIncludesFiber);
    return profileIds
      .map((profileId) => library.byProfileId[profileId])
      .filter(Boolean)
      .map((profile) => ({
        objectProductionProfileId: `${input.packageId}:OBJECT-PRODUCTION:${entry.manifestEntryId}:${profile.profileId}`,
        packageId: input.packageId,
        manifestEntryId: entry.manifestEntryId,
        catalogEntryId: entry.catalogEntryId,
        objectType: entry.objectType,
        objectClass: entry.objectClass,
        profileId: profile.profileId,
        profile,
        quantity: entry.objectType === "SPLICE_CASE" && profile.profileId === "SPLICE_864_STANDARD" ? entry.expectedQuantity * 1728 : entry.expectedQuantity,
        quantityUnit: entry.objectType === "SPLICE_CASE" && profile.profileId === "SPLICE_864_STANDARD" ? "termination" : entry.expectedQuantityUnit,
        source: "AUDIT_OBJECT_MANIFEST" as const,
        humanOverrides: [],
        requiresHumanReview: profile.requiresHumanReview,
        noScopeVersionCreation: true as const,
      }));
  });
}

export function createPD003ProductionArtifacts(input: CreateProductionArtifactsInput): ProductionDoctrineArtifacts {
  const productionProfileLibrary = createProductionProfileLibrary(input.generatedAt);
  const objectProductionProfiles = createObjectProductionProfiles(input);
  const productionReviewObjects = objectProductionProfiles.flatMap((item) => reviewObjectsForProfile(input.packageId, item));
  const productionScheduleProjection = createProductionScheduleProjection(input.packageId, objectProductionProfiles);
  const productionDurationDays = productionScheduleProjection.reduce((max, item) => Math.max(max, item.crewAdjustedDurationDays), 0);
  const productionCostProjection = createProductionCostProjection(input.packageId, objectProductionProfiles, productionDurationDays);
  const productionPaymentProjection = createProductionPaymentProjection(objectProductionProfiles, productionScheduleProjection, productionCostProjection);
  const productionValidation = createProductionValidation({
    packageId: input.packageId,
    objectProductionProfiles,
    paymentProjection: productionPaymentProjection,
    reviewObjects: productionReviewObjects,
  });
  return {
    productionDoctrine: getPD003ProductionDoctrine(),
    productionProfiles: productionProfileLibrary.profiles,
    objectProductionProfiles,
    productionProjectionSummary: {
      summaryId: `${input.packageId}:PD003-PRODUCTION-SUMMARY`,
      packageId: input.packageId,
      productionProfileCount: productionProfileLibrary.profiles.length,
      objectProductionProfileCount: objectProductionProfiles.length,
      projectedCrewDays: productionScheduleProjection.reduce((sum, item) => sum + item.crewAdjustedDurationDays, 0),
      projectedWeeklyProduction: productionScheduleProjection.reduce((sum, item) => sum + item.weeklyProduction, 0),
      projectedLaborCost: productionCostProjection.reduce((sum, item) => sum + item.laborCost, 0),
      projectedMaterialCost: productionCostProjection.reduce((sum, item) => sum + item.materialCost, 0),
      projectedProjectManagementCost: productionCostProjection.reduce((sum, item) => sum + item.projectManagementCost, 0),
      paymentProjectionCount: productionPaymentProjection.length,
      paymentAuthorized: false,
      unknownProductionReviewCount: productionReviewObjects.length,
      status: productionValidation.status,
      noScopeVersionCreation: true,
    },
    productionScheduleProjection,
    productionCostProjection,
    productionPaymentProjection,
    productionReviewObjects,
    productionValidation,
    productionProfileLibrary,
    noScopeVersionCreation: true,
  };
}

export { primaryProductionProfileId };
