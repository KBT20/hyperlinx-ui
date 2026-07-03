import type { InstantiatedSpineObject, InstantiationHealth } from "./SpineObjectInstantiationContracts";
import type { AuditObjectManifest } from "../manifest/AuditObjectManifestContracts";
import type { SpineObjectCatalog } from "../catalog/SpineObjectCatalogContracts";

export function expectedObjectCount(manifest: AuditObjectManifest) {
  const manifested = manifest.entries.reduce((sum, entry) => {
    if (entry.placementStrategy.addressType === "RANGE") return sum + 1;
    if (entry.placementStrategy.addressType === "PACKAGE") return sum + 1;
    return sum + Math.max(1, Math.ceil(entry.expectedQuantity));
  }, 0);
  return manifested + manifest.reviewObjects.length;
}

export function createInstantiationHealth(packageId: string, catalog: SpineObjectCatalog, manifest: AuditObjectManifest, objects: InstantiatedSpineObject[]): InstantiationHealth {
  const expected = expectedObjectCount(manifest);
  const addressErrors = objects.filter((object) => object.addressStatus === "UNASSIGNED").length;
  const hierarchyErrors = objects.filter((object) => object.objectClass === "CONTAINED_CONNECTION" && !object.parentObjectId).length;
  const catalogErrors = objects.filter((object) => !catalog.entries.some((entry) => entry.catalogEntryId === object.catalogEntryId)).length;
  const productionBindingErrors = objects.filter((object) => object.objectClass !== "CONSTRAINT" && object.productionProfileIds.length === 0).length;
  const failures = [
    ...(expected !== objects.length ? [`Expected ${expected} objects but created ${objects.length}.`] : []),
    ...(addressErrors ? [`${addressErrors} instantiated objects have address errors.`] : []),
    ...(hierarchyErrors ? [`${hierarchyErrors} contained objects are missing parent relationships.`] : []),
    ...(catalogErrors ? [`${catalogErrors} instantiated objects are missing catalog bindings.`] : []),
    ...(productionBindingErrors ? [`${productionBindingErrors} instantiated objects are missing production bindings.`] : []),
  ];
  const warnings = objects
    .filter((object) => object.reviewStatus === "ENGINEERING_DISPOSITION_REQUIRED")
    .map((object) => `${object.spineObjectId} requires Engineering disposition.`);
  return {
    healthId: `${packageId}:SPINE-OBJECT-INSTANTIATION-HEALTH`,
    packageId,
    objectsExpected: expected,
    objectsCreated: objects.length,
    objectsMissing: Math.max(0, expected - objects.length),
    objectsExtra: Math.max(0, objects.length - expected),
    addressErrors,
    hierarchyErrors,
    catalogErrors,
    productionBindingErrors,
    reviewObjects: objects.filter((object) => object.reviewStatus === "ENGINEERING_DISPOSITION_REQUIRED").length,
    instantiationStatus: failures.length ? "FAIL" : "PASS",
    failures,
    warnings,
    noScopeVersionCreation: true,
  };
}
