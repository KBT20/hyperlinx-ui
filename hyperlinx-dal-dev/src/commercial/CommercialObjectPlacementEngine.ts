import type { DraftIofPackageRuntime } from "../api/teralinxRuntime";
import type { DALCoordinate } from "../types/dal";
import type { ObjectStationAttachment } from "../spine/SpineAuthorityContracts";
import { distanceFeet } from "../spine/MeasuredSpineEngine";
import {
  commercialObjectId,
  commercialObjectType,
  isCommercialMovableObjectType,
  lookupCommercialStation,
  objectStationAttachmentsFromCommercialDraft,
  sourceObjectsForCommercialStationReview,
  stationAuthorityFromCommercialDraft,
  type CommercialStationLookupQuery,
} from "./CommercialStationReviewEngine";

type JsonObject = Record<string, unknown>;

export interface CommercialObjectPlacementRevision {
  revisionId: string;
  packageId: string;
  objectId: string;
  objectType: string;
  action: "MOVE_OBJECT_BY_STATION" | "ADD_OBJECT_AT_STATION" | "REMOVE_PROPOSED_OBJECT";
  previousStationId?: string;
  previousStationLabel?: string;
  previousMeasureFeet?: number;
  previousCoordinate?: DALCoordinate;
  newStationId?: string;
  newStationLabel?: string;
  newMeasureFeet?: number;
  newCoordinate?: DALCoordinate;
  distanceMovedFeet: number;
  reason: string;
  actor: string;
  customerRequested: boolean;
  requiresEngineeringReview: true;
  createdAt: string;
  authority: "COMMERCIAL_STATION_REVIEW";
  noScopeVersionCreation: true;
}

export interface CommercialImpactSummary {
  impactId: string;
  packageId: string;
  objectId: string;
  distanceMovedFeet: number;
  priorStation?: string;
  newStation?: string;
  affectedDoctrineSpacing: "PASS" | "WARNING" | "FAIL" | "NEEDS_ENGINEERING_REVIEW";
  affectedIlaRegenChain: string;
  affectedCommercialQuantities: string;
  affectedPricing: string;
  requiresEngineeringReview: "YES";
  status: "NEEDS_ENGINEERING_REVIEW";
  noCertification: true;
  noScopeVersionCreation: true;
}

export interface CommercialObjectPlacementResult {
  draftPackage: DraftIofPackageRuntime;
  updatedObjectStationAttachments: ObjectStationAttachment[];
  revision: CommercialObjectPlacementRevision;
  commercialImpactSummary: CommercialImpactSummary;
}

function asRecord(value: unknown): JsonObject {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : {};
}

function asArray<T = unknown>(value: unknown): T[] {
  return Array.isArray(value) ? value as T[] : [];
}

function asString(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function nowIso() {
  return new Date().toISOString();
}

function historyId(packageId: string, objectId: string, createdAt: string) {
  return `${packageId}:COMMERCIAL-STATION-REVIEW:${objectId.replace(/[^A-Za-z0-9_-]+/g, "-")}:${createdAt.replace(/[^0-9]+/g, "")}`;
}

function patchObjectRecord(record: JsonObject, station: ReturnType<typeof lookupCommercialStation>) {
  if (!station) return record;
  const metadata = asRecord(record.metadata);
  return {
    ...record,
    stationId: station.stationId,
    station: station.stationLabel,
    stationLabel: station.stationLabel,
    measureFeet: station.measureFeet,
    stationFeet: station.measureFeet,
    coordinate: station.coordinate,
    lat: station.lat,
    lng: station.lng,
    metadata: {
      ...metadata,
      stationId: station.stationId,
      stationLabel: station.stationLabel,
      measureFeet: station.measureFeet,
      coordinate: station.coordinate,
      commercialStationReview: true,
    },
  };
}

function updateObjectCollection(collection: unknown, packageId: string, objectId: string, station: ReturnType<typeof lookupCommercialStation>) {
  return asArray<JsonObject>(collection).map((record, index) => {
    const candidateId = commercialObjectId(record, packageId, index);
    return candidateId === objectId ? patchObjectRecord(record, station) : record;
  });
}

function createAttachment(args: {
  packageId: string;
  objectId: string;
  stationAuthority: NonNullable<ReturnType<typeof stationAuthorityFromCommercialDraft>>;
  station: NonNullable<ReturnType<typeof lookupCommercialStation>>;
  previous?: ObjectStationAttachment;
}): ObjectStationAttachment {
  return {
    ...(args.previous ?? {}),
    attachmentId: args.previous?.attachmentId ?? `${args.packageId}:OBJECT-STATION-ATTACHMENT:${args.objectId.replace(/[^A-Za-z0-9_-]+/g, "-")}`,
    objectId: args.objectId,
    packageId: args.packageId,
    spineId: args.station.spineId,
    routeId: args.station.routeId,
    stationId: args.station.stationId,
    stationLabel: args.station.stationLabel,
    measureFeet: args.station.measureFeet,
    coordinate: args.station.coordinate,
    attachmentMethod: "EXPLICIT_STATION",
    attachmentStatus: "ATTACHED",
    geometryHash: args.station.geometryHash,
    authority: "OBJECT_STATION_ATTACHMENT_AUTHORITY",
    reason: "Commercial station-aware review placement.",
  };
}

function impactSummary(args: {
  packageId: string;
  objectId: string;
  distanceMovedFeet: number;
  priorStation?: string;
  newStation?: string;
}): CommercialImpactSummary {
  return {
    impactId: `${args.packageId}:COMMERCIAL-IMPACT:${args.objectId.replace(/[^A-Za-z0-9_-]+/g, "-")}`,
    packageId: args.packageId,
    objectId: args.objectId,
    distanceMovedFeet: Math.round(args.distanceMovedFeet),
    priorStation: args.priorStation,
    newStation: args.newStation,
    affectedDoctrineSpacing: "NEEDS_ENGINEERING_REVIEW",
    affectedIlaRegenChain: "Station placement changed; Engineering must review final chain.",
    affectedCommercialQuantities: "No automatic quantity delta from station move.",
    affectedPricing: "No automatic pricing delta from station move.",
    requiresEngineeringReview: "YES",
    status: "NEEDS_ENGINEERING_REVIEW",
    noCertification: true,
    noScopeVersionCreation: true,
  };
}

function attachCommercialRevision(nextDraft: DraftIofPackageRuntime, revision: CommercialObjectPlacementRevision, summary: CommercialImpactSummary) {
  const existingHistory = asArray<CommercialObjectPlacementRevision>((nextDraft as JsonObject).commercialObjectPlacementHistory);
  const existingCustomerMoves = asArray<CommercialObjectPlacementRevision>((nextDraft as JsonObject).customerRequestedMoves);
  const existingSummaries = asArray<CommercialImpactSummary>((nextDraft as JsonObject).commercialImpactSummaries);
  return {
    ...nextDraft,
    commercialObjectPlacementHistory: [...existingHistory, revision],
    customerRequestedMoves: revision.customerRequested ? [...existingCustomerMoves, revision] : existingCustomerMoves,
    commercialImpactSummary: summary,
    commercialImpactSummaries: [...existingSummaries, summary],
    commercialReviewRevision: Number((nextDraft as JsonObject).commercialReviewRevision ?? 0) + 1,
    engineeringReadiness: "COMMERCIAL_STATION_REVIEW_REQUIRES_ENGINEERING_REVIEW",
    updatedAt: revision.createdAt,
    noScopeVersionCreation: true,
  } as DraftIofPackageRuntime;
}

export function moveCommercialObjectByStation(args: {
  draftPackage: DraftIofPackageRuntime;
  objectId: string;
  targetStation: CommercialStationLookupQuery;
  reason: string;
  actor: string;
  customerRequested?: boolean;
  createdAt?: string;
}): CommercialObjectPlacementResult {
  const draftPackage = args.draftPackage;
  const packageId = draftPackage.packageId;
  const stationAuthority = stationAuthorityFromCommercialDraft(draftPackage);
  if (!stationAuthority) throw new Error("Commercial move requires stationAuthority.");
  const targetStation = lookupCommercialStation(draftPackage, args.targetStation);
  if (!targetStation) throw new Error(`Target station not found: ${String(args.targetStation)}`);
  const sourceObjects = sourceObjectsForCommercialStationReview(draftPackage);
  const objectIndex = sourceObjects.findIndex((record, index) => commercialObjectId(record, packageId, index) === args.objectId);
  if (objectIndex < 0) throw new Error(`Object not found: ${args.objectId}`);
  const sourceObject = sourceObjects[objectIndex];
  const objectType = commercialObjectType(sourceObject);
  if (!isCommercialMovableObjectType(objectType)) throw new Error(`Object type is not movable by Commercial station review: ${objectType}`);
  const attachments = objectStationAttachmentsFromCommercialDraft(draftPackage);
  const previousAttachment = attachments.find((attachment) => attachment.objectId === args.objectId);
  const previousStation = previousAttachment?.stationId ? lookupCommercialStation(draftPackage, previousAttachment.stationId) : null;
  const updatedAttachment = createAttachment({
    packageId,
    objectId: args.objectId,
    stationAuthority,
    station: targetStation,
    previous: previousAttachment,
  });
  const updatedAttachments = previousAttachment
    ? attachments.map((attachment) => attachment.objectId === args.objectId ? updatedAttachment : attachment)
    : [...attachments, updatedAttachment];
  const distanceMovedFeet = previousAttachment?.coordinate
    ? distanceFeet(previousAttachment.coordinate, targetStation.coordinate)
    : Math.abs(Number(previousAttachment?.measureFeet ?? 0) - targetStation.measureFeet);
  const createdAt = args.createdAt ?? nowIso();
  const revision: CommercialObjectPlacementRevision = {
    revisionId: historyId(packageId, args.objectId, createdAt),
    packageId,
    objectId: args.objectId,
    objectType,
    action: "MOVE_OBJECT_BY_STATION",
    previousStationId: previousAttachment?.stationId,
    previousStationLabel: previousAttachment?.stationLabel,
    previousMeasureFeet: previousAttachment?.measureFeet,
    previousCoordinate: previousAttachment?.coordinate,
    newStationId: targetStation.stationId,
    newStationLabel: targetStation.stationLabel,
    newMeasureFeet: targetStation.measureFeet,
    newCoordinate: targetStation.coordinate,
    distanceMovedFeet: Math.round(distanceMovedFeet),
    reason: args.reason,
    actor: args.actor,
    customerRequested: Boolean(args.customerRequested),
    requiresEngineeringReview: true,
    createdAt,
    authority: "COMMERCIAL_STATION_REVIEW",
    noScopeVersionCreation: true,
  };
  const summary = impactSummary({
    packageId,
    objectId: args.objectId,
    distanceMovedFeet,
    priorStation: previousStation?.stationLabel ?? previousAttachment?.stationLabel,
    newStation: targetStation.stationLabel,
  });
  const nextDraft = attachCommercialRevision({
    ...draftPackage,
    objects: updateObjectCollection(draftPackage.objects, packageId, args.objectId, targetStation),
    structures: updateObjectCollection(draftPackage.structures, packageId, args.objectId, targetStation),
    proposedIofUnits: updateObjectCollection(draftPackage.proposedIofUnits, packageId, args.objectId, targetStation) as DraftIofPackageRuntime["proposedIofUnits"],
    objectStationAttachments: updatedAttachments,
  }, revision, summary);
  return {
    draftPackage: nextDraft,
    updatedObjectStationAttachments: updatedAttachments,
    revision,
    commercialImpactSummary: summary,
  };
}

export function addCommercialObjectAtStation(args: {
  draftPackage: DraftIofPackageRuntime;
  objectType: string;
  targetStation: CommercialStationLookupQuery;
  reason: string;
  actor: string;
  customerRequested?: boolean;
  createdAt?: string;
}): CommercialObjectPlacementResult {
  const station = lookupCommercialStation(args.draftPackage, args.targetStation);
  if (!station) throw new Error(`Target station not found: ${String(args.targetStation)}`);
  const createdAt = args.createdAt ?? nowIso();
  const packageId = args.draftPackage.packageId;
  const objectId = `${packageId}:COMMERCIAL-OBJECT:${args.objectType.toUpperCase().replace(/[^A-Z0-9_-]+/g, "-")}:${createdAt.replace(/[^0-9]+/g, "")}`;
  const newObject = patchObjectRecord({
    objectId,
    objectType: args.objectType.toUpperCase(),
    label: `${args.objectType.toUpperCase()} ${station.stationLabel}`,
    source: "COMMERCIAL_STATION_REVIEW",
    status: "PROPOSED",
    noScopeVersionCreation: true,
  }, station);
  const draftWithObject = {
    ...args.draftPackage,
    objects: [...asArray<JsonObject>(args.draftPackage.objects), newObject],
  };
  return moveCommercialObjectByStation({
    draftPackage: draftWithObject,
    objectId,
    targetStation: station.stationId,
    reason: args.reason,
    actor: args.actor,
    customerRequested: args.customerRequested,
    createdAt,
  });
}

export function removeCommercialProposedObject(args: {
  draftPackage: DraftIofPackageRuntime;
  objectId: string;
  reason: string;
  actor: string;
  customerRequested?: boolean;
  createdAt?: string;
}): CommercialObjectPlacementResult {
  const createdAt = args.createdAt ?? nowIso();
  const packageId = args.draftPackage.packageId;
  const attachments = objectStationAttachmentsFromCommercialDraft(args.draftPackage);
  const previousAttachment = attachments.find((attachment) => attachment.objectId === args.objectId);
  const revision: CommercialObjectPlacementRevision = {
    revisionId: historyId(packageId, args.objectId, createdAt),
    packageId,
    objectId: args.objectId,
    objectType: "PROPOSED_OBJECT",
    action: "REMOVE_PROPOSED_OBJECT",
    previousStationId: previousAttachment?.stationId,
    previousStationLabel: previousAttachment?.stationLabel,
    previousMeasureFeet: previousAttachment?.measureFeet,
    previousCoordinate: previousAttachment?.coordinate,
    distanceMovedFeet: 0,
    reason: args.reason,
    actor: args.actor,
    customerRequested: Boolean(args.customerRequested),
    requiresEngineeringReview: true,
    createdAt,
    authority: "COMMERCIAL_STATION_REVIEW",
    noScopeVersionCreation: true,
  };
  const summary = impactSummary({
    packageId,
    objectId: args.objectId,
    distanceMovedFeet: 0,
    priorStation: previousAttachment?.stationLabel,
    newStation: "Removed",
  });
  const removeFromCollection = (collection: unknown) => asArray<JsonObject>(collection)
    .filter((record, index) => commercialObjectId(record, packageId, index) !== args.objectId);
  const updatedAttachments = attachments.filter((attachment) => attachment.objectId !== args.objectId);
  const nextDraft = attachCommercialRevision({
    ...args.draftPackage,
    objects: removeFromCollection(args.draftPackage.objects),
    structures: removeFromCollection(args.draftPackage.structures),
    proposedIofUnits: removeFromCollection(args.draftPackage.proposedIofUnits) as DraftIofPackageRuntime["proposedIofUnits"],
    objectStationAttachments: updatedAttachments,
  }, revision, summary);
  return {
    draftPackage: nextDraft,
    updatedObjectStationAttachments: updatedAttachments,
    revision,
    commercialImpactSummary: summary,
  };
}
