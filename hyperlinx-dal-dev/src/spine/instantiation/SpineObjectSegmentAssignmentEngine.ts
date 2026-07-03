import type { ConstructionSegment, ExecutionZone, InstantiatedSpineObject, PaymentSegment } from "./SpineObjectInstantiationContracts";
import type { StationAddress } from "../../doctrine/pd002/addressing/PD002AAddressingContracts";

function segmentId(packageId: string, label: string) {
  return `${packageId}:${label}`;
}

export function constructionSegmentForObject(packageId: string, objectType: string, stationAddress?: StationAddress, index = 1) {
  const boundary = ["ILA", "REGEN", "POP"].includes(objectType) ? objectType : "PRODUCTION_PACKAGE";
  const measureBucket = stationAddress ? Math.floor(stationAddress.measureFeet / 5280) + 1 : index;
  return {
    constructionSegmentId: segmentId(packageId, `CONSTRUCTION-SEGMENT-${String(measureBucket).padStart(4, "0")}`),
    boundaryReason: boundary as ConstructionSegment["boundaryReason"],
  };
}

export function paymentSegmentForObject(packageId: string, stationAddress?: StationAddress, index = 1) {
  const measureBucket = stationAddress ? Math.floor(stationAddress.measureFeet / 5280) + 1 : index;
  return segmentId(packageId, `PAYMENT-SEGMENT-${String(measureBucket).padStart(4, "0")}`);
}

export function executionZoneForObject(packageId: string, stationAddress?: StationAddress, index = 1) {
  const measureBucket = stationAddress ? Math.floor(stationAddress.measureFeet / 10560) + 1 : index;
  return segmentId(packageId, `EXECUTION-ZONE-${String(measureBucket).padStart(4, "0")}`);
}

export function buildConstructionSegments(packageId: string, objects: InstantiatedSpineObject[]): ConstructionSegment[] {
  const ids = [...new Set(objects.map((object) => object.constructionSegmentId))];
  return ids.map((constructionSegmentId) => {
    const segmentObjects = objects.filter((object) => object.constructionSegmentId === constructionSegmentId);
    return {
      constructionSegmentId,
      packageId,
      label: constructionSegmentId.split(":").at(-1) ?? constructionSegmentId,
      boundaryReason: segmentObjects.some((object) => object.objectType === "ILA") ? "ILA" :
        segmentObjects.some((object) => object.objectType === "REGEN") ? "REGEN" :
          segmentObjects.some((object) => object.objectType === "POP") ? "POP" : "PRODUCTION_PACKAGE",
      fromStationAddress: segmentObjects.find((object) => object.stationAddress || object.fromStationAddress)?.stationAddress ?? segmentObjects.find((object) => object.fromStationAddress)?.fromStationAddress,
      toStationAddress: [...segmentObjects].reverse().find((object) => object.toStationAddress || object.stationAddress)?.toStationAddress ?? [...segmentObjects].reverse().find((object) => object.stationAddress)?.stationAddress,
      spineObjectIds: segmentObjects.map((object) => object.spineObjectId),
      noScopeVersionCreation: true,
    };
  });
}

export function buildPaymentSegments(packageId: string, objects: InstantiatedSpineObject[]): PaymentSegment[] {
  return [...new Set(objects.map((object) => object.paymentSegmentId))].map((paymentSegmentId) => ({
    paymentSegmentId,
    packageId,
    label: paymentSegmentId.split(":").at(-1) ?? paymentSegmentId,
    forecastOnly: true,
    paymentEligible: false,
    reason: "Validation required",
    spineObjectIds: objects.filter((object) => object.paymentSegmentId === paymentSegmentId).map((object) => object.spineObjectId),
    noScopeVersionCreation: true,
  }));
}

export function buildExecutionZones(packageId: string, objects: InstantiatedSpineObject[]): ExecutionZone[] {
  return [...new Set(objects.map((object) => object.executionZoneId))].map((executionZoneId) => ({
    executionZoneId,
    packageId,
    label: executionZoneId.split(":").at(-1) ?? executionZoneId,
    concurrentExecutionEligible: true,
    sequencingConflict: false,
    spineObjectIds: objects.filter((object) => object.executionZoneId === executionZoneId).map((object) => object.spineObjectId),
    noScopeVersionCreation: true,
  }));
}
