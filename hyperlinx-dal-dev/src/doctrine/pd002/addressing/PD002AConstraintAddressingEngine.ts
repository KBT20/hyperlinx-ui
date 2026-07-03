import type { DALCoordinate } from "../../../types/dal";
import {
  PD002A_OBJECT_ADDRESSING_AUTHORITY,
  type AddressAssignmentEvent,
  type AssignReviewObjectAddressInput,
  type AssignReviewObjectAddressResult,
  type ObjectAddress,
  type PD002AReviewObject,
  type StationAddress,
  type StationAddressRegistry,
} from "./PD002AAddressingContracts";
import { validateObjectAddresses } from "./PD002AAddressValidationEngine";

type JsonObject = Record<string, unknown>;

function asRecord(value: unknown): JsonObject {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : {};
}

function asArray<T = unknown>(value: unknown): T[] {
  return Array.isArray(value) ? value as T[] : [];
}

function asString(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function stableIdPart(value: unknown, fallback = "UNKNOWN") {
  const raw = String(value ?? fallback).trim() || fallback;
  return raw.replace(/[^A-Za-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 120) || fallback;
}

function nearestStationAddress(registry: StationAddressRegistry, coordinate: DALCoordinate) {
  return registry.entries.reduce<StationAddress | undefined>((nearest, address) => {
    if (!nearest) return address;
    const current = Math.hypot(address.coordinate[0] - coordinate[0], address.coordinate[1] - coordinate[1]);
    const previous = Math.hypot(nearest.coordinate[0] - coordinate[0], nearest.coordinate[1] - coordinate[1]);
    return current < previous ? address : nearest;
  }, undefined);
}

function stationByLabelOrId(registry: StationAddressRegistry, value: string | undefined) {
  if (!value) return undefined;
  return registry.byStationLabel[value] ?? registry.byStationId[value];
}

function assignedPointAddress(reviewObject: PD002AReviewObject, stationAddress: StationAddress, source: string): ObjectAddress {
  return {
    objectId: reviewObject.reviewObjectId,
    objectType: reviewObject.reviewType,
    addressType: "POINT",
    stationAddress: {
      ...stationAddress,
      source,
      addressStatus: "ENGINEERING_ASSIGNED",
      confidence: 100,
    },
    measureFeet: stationAddress.measureFeet,
    coordinate: stationAddress.coordinate,
    addressStatus: "ENGINEERING_ASSIGNED",
    addressAuthority: PD002A_OBJECT_ADDRESSING_AUTHORITY,
    addressSource: source,
    requiresEngineeringReview: false,
    requiresFieldRedlineReview: false,
    notes: [`Engineering assigned ${reviewObject.reviewObjectId} to ${stationAddress.stationLabel}.`],
  };
}

function assignedRangeAddress(reviewObject: PD002AReviewObject, from: StationAddress, to: StationAddress, source: string): ObjectAddress {
  return {
    objectId: reviewObject.reviewObjectId,
    objectType: reviewObject.reviewType,
    addressType: "RANGE",
    fromStationAddress: {
      ...from,
      source,
      addressStatus: "ENGINEERING_ASSIGNED",
      confidence: 100,
    },
    toStationAddress: {
      ...to,
      source,
      addressStatus: "ENGINEERING_ASSIGNED",
      confidence: 100,
    },
    addressRange: {
      fromStationAddress: from,
      toStationAddress: to,
      fromMeasureFeet: from.measureFeet,
      toMeasureFeet: to.measureFeet,
      lengthFeet: Math.max(0, to.measureFeet - from.measureFeet),
    },
    fromMeasureFeet: from.measureFeet,
    toMeasureFeet: to.measureFeet,
    fromCoordinate: from.coordinate,
    toCoordinate: to.coordinate,
    addressStatus: "ENGINEERING_ASSIGNED",
    addressAuthority: PD002A_OBJECT_ADDRESSING_AUTHORITY,
    addressSource: source,
    requiresEngineeringReview: false,
    requiresFieldRedlineReview: false,
    notes: [`Engineering assigned ${reviewObject.reviewObjectId} to ${from.stationLabel} - ${to.stationLabel}.`],
  };
}

function createAssignmentEvent(args: {
  input: AssignReviewObjectAddressInput;
  snapped?: StationAddress;
  from?: StationAddress;
  to?: StationAddress;
}): AddressAssignmentEvent {
  const assignedAt = args.input.assignedAt ?? new Date().toISOString();
  return {
    assignmentEventId: `${asString(args.input.draftPackage.packageId, "DRAFT-IOF")}:PD002A:ADDRESS-ASSIGNMENT:${stableIdPart(args.input.reviewObjectId)}:${stableIdPart(assignedAt)}`,
    reviewObjectId: args.input.reviewObjectId,
    actor: args.input.actor,
    reason: args.input.reason,
    assignedAt,
    addressType: args.input.addressType,
    clickedCoordinate: args.input.clickedCoordinate,
    stationLabel: args.input.stationLabel,
    fromStationLabel: args.input.fromStationLabel,
    toStationLabel: args.input.toStationLabel,
    snappedStationAddress: args.snapped,
    fromStationAddress: args.from,
    toStationAddress: args.to,
    addressStatus: "ENGINEERING_ASSIGNED",
    requiresEngineeringDelta: args.input.requiresEngineeringDelta ?? true,
    commercialBaselineMutated: false,
    originalReviewRecordPreserved: true,
    authority: PD002A_OBJECT_ADDRESSING_AUTHORITY,
    noScopeVersionCreation: true,
  };
}

export function assignReviewObjectAddress(input: AssignReviewObjectAddressInput): AssignReviewObjectAddressResult {
  const registry = asRecord(input.draftPackage.stationAddressRegistry) as unknown as StationAddressRegistry;
  if (!registry?.entries?.length) throw new Error("PD-002A stationAddressRegistry is required before assigning review object address.");
  const unassignedReviewObjects = asArray<PD002AReviewObject>(input.draftPackage.unassignedReviewObjects);
  const addressedReviewObjects = asArray<PD002AReviewObject>(input.draftPackage.addressedReviewObjects);
  const objectAddresses = asArray<ObjectAddress>(input.draftPackage.objectAddresses);
  const reviewObject = unassignedReviewObjects.find((item) => item.reviewObjectId === input.reviewObjectId) ??
    addressedReviewObjects.find((item) => item.reviewObjectId === input.reviewObjectId);
  if (!reviewObject) throw new Error(`Review object not found: ${input.reviewObjectId}`);

  const source = "PD-002A_ENGINEERING_ADDRESS_ASSIGNMENT";
  const snapped = input.clickedCoordinate
    ? nearestStationAddress(registry, input.clickedCoordinate)
    : stationByLabelOrId(registry, input.stationLabel);
  const from = input.addressType === "RANGE"
    ? stationByLabelOrId(registry, input.fromStationLabel) ?? snapped
    : undefined;
  const to = input.addressType === "RANGE"
    ? stationByLabelOrId(registry, input.toStationLabel) ?? snapped
    : undefined;
  if (input.addressType === "POINT" && !snapped) throw new Error("Point address assignment requires clickedCoordinate or stationLabel.");
  if (input.addressType === "RANGE" && (!from || !to)) throw new Error("Range address assignment requires from/to station labels or a snapped station.");
  if (input.addressType === "RANGE" && from && to && from.measureFeet >= to.measureFeet) throw new Error("Range address assignment requires from station before to station.");

  const objectAddress = input.addressType === "RANGE" && from && to
    ? assignedRangeAddress(reviewObject, from, to, source)
    : assignedPointAddress(reviewObject, snapped as StationAddress, source);
  const addressedReviewObject: PD002AReviewObject = {
    ...reviewObject,
    addressStatus: "ENGINEERING_ASSIGNED",
    objectAddress,
    originalReviewObject: reviewObject.originalReviewObject ?? reviewObject,
    requiresEngineeringAddressing: false,
  };
  const nextUnassigned = unassignedReviewObjects.filter((item) => item.reviewObjectId !== input.reviewObjectId);
  const nextAddressed = [
    ...addressedReviewObjects.filter((item) => item.reviewObjectId !== input.reviewObjectId),
    addressedReviewObject,
  ];
  const nextObjectAddresses = [
    ...objectAddresses.filter((address) => address.objectId !== input.reviewObjectId),
    objectAddress,
  ];
  const addressAssignmentEvent = createAssignmentEvent({ input, snapped, from, to });
  const stationAuthority = asRecord(input.draftPackage.stationAuthority) as any;
  const addressValidation = validateObjectAddresses({
    packageId: asString(input.draftPackage.packageId, "DRAFT-IOF"),
    stationAuthority,
    stationAddressRegistry: registry,
    objectAddresses: nextObjectAddresses,
    unassignedReviewObjects: nextUnassigned,
    addressedReviewObjects: nextAddressed,
  });
  return {
    addressedReviewObject,
    addressAssignmentEvent,
    addressedReviewObjects: nextAddressed,
    unassignedReviewObjects: nextUnassigned,
    addressValidation,
    commercialBaselineMutated: false,
    draftPackagePatch: {
      addressedReviewObjects: nextAddressed,
      unassignedReviewObjects: nextUnassigned,
      addressAssignmentEvents: [
        ...asArray<AddressAssignmentEvent>(input.draftPackage.addressAssignmentEvents),
        addressAssignmentEvent,
      ],
      addressValidation,
    },
    noScopeVersionCreation: true,
  };
}
