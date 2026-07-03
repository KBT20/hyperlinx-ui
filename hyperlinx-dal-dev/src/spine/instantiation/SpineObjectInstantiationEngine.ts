import type { StationAddress } from "../../doctrine/pd002/addressing/PD002AAddressingContracts";
import { createSpineObject } from "./SpineObjectFactory";
import { buildSpineObjectHierarchy } from "./SpineObjectHierarchyEngine";
import { createSpineObjectIdentity, createIdentityRegistry } from "./SpineObjectIdentityEngine";
import { createProductionBinding } from "./SpineObjectProductionBindingEngine";
import {
  buildConstructionSegments,
  buildExecutionZones,
  buildPaymentSegments,
  constructionSegmentForObject,
  executionZoneForObject,
  paymentSegmentForObject,
} from "./SpineObjectSegmentAssignmentEngine";
import { createHierarchySummary, createInstantiationSummary } from "./SpineObjectInstantiationSummary";
import { createInstantiationHealth, expectedObjectCount } from "./SpineObjectInstantiationValidationEngine";
import type {
  InstantiatedSpineObject,
  SpineObjectAddressBinding,
  SpineObjectInstantiationInput,
  SpineObjectInstantiationResult,
  SpineObjectProductionBinding,
  SpineObjectRegistry,
} from "./SpineObjectInstantiationContracts";

function stationAtIndex(stations: StationAddress[], index: number, total: number) {
  if (!stations.length) return undefined;
  if (total <= 1) return stations[0];
  const stationIndex = Math.min(stations.length - 1, Math.max(0, Math.round((index / Math.max(1, total - 1)) * (stations.length - 1))));
  return stations[stationIndex];
}

function terminalStations(stations: StationAddress[]) {
  return {
    from: stations[0],
    to: stations[stations.length - 1],
  };
}

function createAddressBinding(object: InstantiatedSpineObject): SpineObjectAddressBinding {
  return {
    bindingId: `${object.spineObjectId}:ADDRESS-BINDING`,
    spineObjectId: object.spineObjectId,
    addressType: object.addressStatus === "INHERITED" ? "INHERITED" : object.fromStationAddress && object.toStationAddress ? "RANGE" : object.stationAddress ? "POINT" : object.parentObjectId ? "INHERITED" : "UNASSIGNED_REVIEW",
    stationAddress: object.stationAddress,
    fromStationAddress: object.fromStationAddress,
    toStationAddress: object.toStationAddress,
    inheritedFromSpineObjectId: object.parentObjectId,
    status: object.addressStatus,
    authority: "PD002A_OBJECT_ADDRESSING_AUTHORITY",
    noScopeVersionCreation: true,
  };
}

function createRegistry(packageId: string, objects: InstantiatedSpineObject[]): SpineObjectRegistry {
  const byObjectType: Record<string, string[]> = {};
  const byCatalogEntryId: Record<string, string[]> = {};
  const byConstructionSegmentId: Record<string, string[]> = {};
  const byPaymentSegmentId: Record<string, string[]> = {};
  const byExecutionZoneId: Record<string, string[]> = {};
  objects.forEach((object) => {
    (byObjectType[object.objectType] ??= []).push(object.spineObjectId);
    (byCatalogEntryId[object.catalogEntryId] ??= []).push(object.spineObjectId);
    (byConstructionSegmentId[object.constructionSegmentId] ??= []).push(object.spineObjectId);
    (byPaymentSegmentId[object.paymentSegmentId] ??= []).push(object.spineObjectId);
    (byExecutionZoneId[object.executionZoneId] ??= []).push(object.spineObjectId);
  });
  return {
    registryId: `${packageId}:SPINE-OBJECT-REGISTRY`,
    packageId,
    objectCount: objects.length,
    bySpineObjectId: Object.fromEntries(objects.map((object) => [object.spineObjectId, object])),
    byObjectType,
    byCatalogEntryId,
    byConstructionSegmentId,
    byPaymentSegmentId,
    byExecutionZoneId,
    authority: "SPINE_OBJECT_INSTANTIATION_AUTHORITY",
    noScopeVersionCreation: true,
  };
}

export function instantiateSpineObjects(input: SpineObjectInstantiationInput): SpineObjectInstantiationResult {
  const stations = [...(input.stationAddressRegistry?.entries ?? [])].sort((a, b) => a.measureFeet - b.measureFeet);
  const objects: InstantiatedSpineObject[] = [];
  const counters = new Map<string, number>();

  input.auditObjectManifest.entries.forEach((manifestEntry) => {
    const catalogEntry = input.catalog.byObjectType[manifestEntry.objectType];
    if (!catalogEntry) return;
    const total = manifestEntry.placementStrategy.addressType === "RANGE" || manifestEntry.placementStrategy.addressType === "PACKAGE"
      ? 1
      : Math.max(1, Math.ceil(manifestEntry.expectedQuantity));
    for (let index = 0; index < total; index += 1) {
      const next = (counters.get(manifestEntry.objectType) ?? 0) + 1;
      counters.set(manifestEntry.objectType, next);
      const identity = createSpineObjectIdentity(manifestEntry.objectType, next);
      const pointStation = manifestEntry.placementStrategy.addressType === "POINT" || manifestEntry.placementStrategy.addressType === "INHERITED"
        ? stationAtIndex(stations, index, total)
        : undefined;
      const range = manifestEntry.placementStrategy.addressType === "RANGE" ? terminalStations(stations) : { from: undefined, to: undefined };
      const segment = constructionSegmentForObject(input.packageId, manifestEntry.objectType, pointStation ?? range.from, next);
      const productionBinding = createProductionBinding({
        packageId: input.packageId,
        spineObjectId: identity.spineObjectId,
        catalogEntry,
        manifestEntry,
        objectProductionProfiles: input.objectProductionProfiles,
      });
      objects.push(createSpineObject({
        packageId: input.packageId,
        manifestEntry,
        catalogEntry,
        quantityIndex: index,
        identity,
        stationAddress: pointStation,
        fromStationAddress: range.from,
        toStationAddress: range.to,
        constructionSegmentId: segment.constructionSegmentId,
        paymentSegmentId: paymentSegmentForObject(input.packageId, pointStation ?? range.from, next),
        executionZoneId: executionZoneForObject(input.packageId, pointStation ?? range.from, next),
        productionBinding,
      }));
    }
  });

  input.auditObjectManifest.reviewObjects.forEach((reviewObject) => {
    const objectType = reviewObject.objectType ?? "GENERAL_REVIEW";
    const catalogEntry = input.catalog.byObjectType[objectType] ?? input.catalog.byObjectType.ROCK_REVIEW ?? input.catalog.entries.find((entry) => entry.objectClass === "CONSTRAINT");
    if (!catalogEntry) return;
    const next = (counters.get(objectType) ?? 0) + 1;
    counters.set(objectType, next);
    const identity = createSpineObjectIdentity(objectType, next);
    const productionBinding = createProductionBinding({
      packageId: input.packageId,
      spineObjectId: identity.spineObjectId,
      catalogEntry,
      objectProductionProfiles: input.objectProductionProfiles,
    });
    objects.push(createSpineObject({
      packageId: input.packageId,
      reviewObject,
      catalogEntry,
      quantityIndex: next,
      identity,
      constructionSegmentId: constructionSegmentForObject(input.packageId, objectType, undefined, next).constructionSegmentId,
      paymentSegmentId: paymentSegmentForObject(input.packageId, undefined, next),
      executionZoneId: executionZoneForObject(input.packageId, undefined, next),
      productionBinding,
    }));
  });

  const hierarchicalObjects = buildSpineObjectHierarchy(objects);
  const identities = hierarchicalObjects.map((object) => object.identity);
  const constructionSegments = buildConstructionSegments(input.packageId, hierarchicalObjects);
  const paymentSegments = buildPaymentSegments(input.packageId, hierarchicalObjects);
  const executionZones = buildExecutionZones(input.packageId, hierarchicalObjects);
  const productionBindings: SpineObjectProductionBinding[] = hierarchicalObjects.map((object) => ({
    bindingId: `${object.spineObjectId}:PRODUCTION-BINDING`,
    spineObjectId: object.spineObjectId,
    productionProfileId: object.productionProfileId,
    productionProfileIds: object.productionProfileIds,
    materialProfileIds: object.materialProfileIds,
    objectProductionProfileIds: input.objectProductionProfiles.filter((profile) => profile.manifestEntryId === object.manifestEntryId).map((profile) => profile.objectProductionProfileId),
    constructionMethod: object.constructionMethod,
    authority: "PD003_PRODUCTION_DOCTRINE_AUTHORITY",
    noScopeVersionCreation: true,
  }));
  const addressBindings = hierarchicalObjects.map(createAddressBinding);
  const expected = expectedObjectCount(input.auditObjectManifest);
  return {
    instantiatedSpineObjects: hierarchicalObjects,
    spineObjectRegistry: createRegistry(input.packageId, hierarchicalObjects),
    spineObjectIdentityRegistry: createIdentityRegistry(input.packageId, identities),
    constructionSegments,
    paymentSegments,
    executionZones,
    instantiationSummary: createInstantiationSummary(input.packageId, expected, hierarchicalObjects),
    instantiationHealth: createInstantiationHealth(input.packageId, input.catalog, input.auditObjectManifest, hierarchicalObjects),
    hierarchySummary: createHierarchySummary(input.packageId, hierarchicalObjects),
    productionBindings,
    addressBindings,
    noScopeVersionCreation: true,
  };
}
