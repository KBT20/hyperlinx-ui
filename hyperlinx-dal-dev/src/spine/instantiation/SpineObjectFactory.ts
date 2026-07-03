import type { InstantiatedSpineObject, SpineObjectFactoryInput } from "./SpineObjectInstantiationContracts";

export function createSpineObject(input: SpineObjectFactoryInput): InstantiatedSpineObject {
  const entry = input.catalogEntry;
  const addressStatus = input.stationAddress ? "BOUND" : input.fromStationAddress && input.toStationAddress ? "BOUND" : input.parentObjectId ? "INHERITED" : entry.addressType === "UNASSIGNED_REVIEW" ? "PENDING_REVIEW" : "UNASSIGNED";
  const reviewStatus = input.reviewObject || addressStatus === "PENDING_REVIEW" ? "ENGINEERING_DISPOSITION_REQUIRED" : "READY_FOR_ENGINEERING_REVIEW";
  return {
    spineObjectId: input.identity.spineObjectId,
    identity: input.identity,
    packageId: input.packageId,
    manifestEntryId: input.manifestEntry?.manifestEntryId,
    reviewObjectId: input.reviewObject?.reviewObjectId,
    catalogEntryId: entry.catalogEntryId,
    constitutionalRole: entry.constitutionalRole,
    objectClass: entry.objectClass,
    objectType: entry.objectType,
    displayName: entry.displayName,
    description: entry.description,
    stationAddress: input.stationAddress,
    fromStationAddress: input.fromStationAddress,
    toStationAddress: input.toStationAddress,
    constructionSegmentId: input.constructionSegmentId,
    paymentSegmentId: input.paymentSegmentId,
    executionZoneId: input.executionZoneId,
    parentObjectId: input.parentObjectId,
    childObjectIds: [],
    ancestorObjectIds: [],
    descendantObjectIds: [],
    productionProfileId: input.productionBinding.productionProfileId,
    productionProfileIds: input.productionBinding.productionProfileIds,
    materialProfileIds: input.productionBinding.materialProfileIds,
    constructionMethod: input.productionBinding.constructionMethod,
    executionSequenceTemplate: entry.sequenceTemplates,
    dependencyTemplate: entry.dependencyTemplates,
    evidenceTemplate: entry.evidenceTemplates,
    visibilityProfile: entry.visibilityProfile,
    reviewStatus,
    addressStatus,
    currentState: "PLANNED",
    authority: "SPINE_OBJECT_INSTANTIATION_AUTHORITY",
    confidence: input.reviewObject ? input.reviewObject.confidence : 90,
    noScopeVersionCreation: true,
  };
}
