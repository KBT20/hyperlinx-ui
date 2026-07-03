import type { HierarchySummary, InstantiatedSpineObject, InstantiationSummary } from "./SpineObjectInstantiationContracts";

export function createInstantiationSummary(packageId: string, expectedObjects: number, objects: InstantiatedSpineObject[]): InstantiationSummary {
  return {
    summaryId: `${packageId}:SPINE-OBJECT-INSTANTIATION-SUMMARY`,
    packageId,
    expectedObjects,
    createdObjects: objects.length,
    reviewObjects: objects.filter((object) => object.reviewStatus === "ENGINEERING_DISPOSITION_REQUIRED").length,
    productionProfileBindings: objects.filter((object) => object.productionProfileIds.length > 0).length,
    constructionSegments: new Set(objects.map((object) => object.constructionSegmentId)).size,
    paymentSegments: new Set(objects.map((object) => object.paymentSegmentId)).size,
    executionZones: new Set(objects.map((object) => object.executionZoneId)).size,
    status: expectedObjects === objects.length ? "PASS" : "FAIL",
    noScopeVersionCreation: true,
  };
}

export function createHierarchySummary(packageId: string, objects: InstantiatedSpineObject[]): HierarchySummary {
  return {
    summaryId: `${packageId}:SPINE-OBJECT-HIERARCHY-SUMMARY`,
    packageId,
    rootObjectCount: objects.filter((object) => !object.parentObjectId).length,
    parentRelationshipCount: objects.filter((object) => object.parentObjectId).length,
    childRelationshipCount: objects.reduce((sum, object) => sum + object.childObjectIds.length, 0),
    containedInheritanceCount: objects.filter((object) => object.objectClass === "CONTAINED_CONNECTION" && object.parentObjectId).length,
    hierarchyValid: objects.every((object) => object.objectClass !== "CONTAINED_CONNECTION" || Boolean(object.parentObjectId) || objects.length === 1),
    noScopeVersionCreation: true,
  };
}
