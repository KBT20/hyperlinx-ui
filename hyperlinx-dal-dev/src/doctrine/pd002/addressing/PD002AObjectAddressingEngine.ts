import type { DALCoordinate } from "../../../types/dal";
import type {
  AuthorizedStation,
  MeasuredSpine,
  ObjectStationAttachment,
  StationAuthority,
} from "../../../spine/SpineAuthorityContracts";
import {
  PD002A_OBJECT_ADDRESSING_AUTHORITY,
  STATION_ADDRESS_AUTHORITY,
  type AddressProjectionSummary,
  type ObjectAddress,
  type ObjectAddressingResult,
  type PD002AReviewObject,
  type PD002AReviewObjectType,
  type StationAddress,
  type StationAddressRegistry,
} from "./PD002AAddressingContracts";
import {
  PD002A_OBJECT_ADDRESSING_DOCTRINE,
  isPD002AContainedObjectType,
  isPD002APackageLevelObjectType,
  isPD002APointObjectType,
  isPD002ARangeObjectType,
} from "./PD002AObjectAddressingDoctrine";
import { validateObjectAddresses } from "./PD002AAddressValidationEngine";

type JsonObject = Record<string, unknown>;

export type PD002AObjectAddressingInput = {
  packageId: string;
  measuredSpine: MeasuredSpine;
  stationAuthority: StationAuthority;
  objects?: unknown[];
  structures?: unknown[];
  engineeringObjects?: unknown[];
  proposedIofUnits?: unknown[];
  objectStationAttachments?: ObjectStationAttachment[];
  commercialAuditEntries?: unknown[];
  transparentEstimate?: unknown;
  quantitySummary?: unknown;
  spineAuditProjection?: unknown;
  stationRangeExpectations?: unknown[];
  spineReviewObjects?: unknown[];
  productIncludesFiber?: boolean;
  generatedAt?: string;
};

const ADDRESSING_MAP_LAYERS = [
  "Handholes / Manholes",
  "Vaults",
  "Splice Cases",
  "ILAs",
  "Civil Ranges",
  "Conduit",
  "Fiber",
  "Crossings",
  "Pending Review Objects",
  "Addressed Review Objects",
  "Engineering Deltas",
];

function asRecord(value: unknown): JsonObject {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : {};
}

function asArray<T = unknown>(value: unknown): T[] {
  return Array.isArray(value) ? value as T[] : [];
}

function asString(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function asNumber(value: unknown, fallback = 0) {
  const numeric = Number(typeof value === "string" ? value.replace(/[^0-9.-]+/g, "") : value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function stableIdPart(value: unknown, fallback = "UNKNOWN") {
  const raw = String(value ?? fallback).trim() || fallback;
  return raw.replace(/[^A-Za-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 120) || fallback;
}

function normalizeType(value: unknown) {
  return String(value ?? "OBJECT").trim().toUpperCase().replace(/\s+/g, "_") || "OBJECT";
}

function coordinateFrom(value: unknown): DALCoordinate | undefined {
  if (value === undefined || value === null) return undefined;
  if (Array.isArray(value) && value.length >= 2) {
    const first = Number(value[0]);
    const second = Number(value[1]);
    if (Number.isFinite(first) && Number.isFinite(second)) {
      if (Math.abs(first) <= 180 && Math.abs(second) <= 90) return [first, second];
      if (Math.abs(first) <= 90 && Math.abs(second) <= 180) return [second, first];
    }
    return undefined;
  }
  const record = asRecord(value);
  const nested = record.coordinate ?? record.coordinates ?? record.location ?? record.point ?? record.geometry;
  if (nested !== undefined && nested !== value) return coordinateFrom(nested);
  const lon = record.lon ?? record.lng ?? record.longitude ?? record.x;
  const lat = record.lat ?? record.latitude ?? record.y;
  return lon !== undefined || lat !== undefined ? coordinateFrom([lon, lat]) : undefined;
}

function stationAddressFromStation(station: AuthorizedStation, source: string, status: StationAddress["addressStatus"] = "ASSIGNED", confidence = 100): StationAddress {
  return {
    stationAddressId: `${station.packageId}:STATION-ADDRESS:${stableIdPart(station.stationId)}`,
    stationId: station.stationId,
    stationLabel: station.stationLabel,
    measureFeet: station.measureFeet,
    coordinate: station.coordinate,
    lat: station.lat,
    lng: station.lng,
    geometryHash: station.geometryHash,
    authority: STATION_ADDRESS_AUTHORITY,
    source,
    confidence,
    addressStatus: status,
  };
}

export function createStationAddressRegistry(args: {
  packageId: string;
  measuredSpine: MeasuredSpine;
  stationAuthority: StationAuthority;
}): StationAddressRegistry {
  const entries = args.stationAuthority.stations.map((station) => stationAddressFromStation(station, "stationAuthority", "ASSIGNED", 100));
  return {
    registryId: `${args.packageId}:PD002A:STATION-ADDRESS-REGISTRY`,
    packageId: args.packageId,
    measuredSpineId: args.measuredSpine.spineId,
    stationAuthorityId: args.stationAuthority.authorityId,
    geometryHash: args.stationAuthority.geometryHash,
    stationCount: entries.length,
    byStationId: Object.fromEntries(entries.map((entry) => [entry.stationId, entry])),
    byStationLabel: Object.fromEntries(entries.map((entry) => [entry.stationLabel, entry])),
    entries,
    authority: STATION_ADDRESS_AUTHORITY,
    noScopeVersionCreation: true,
  };
}

function nearestStationByMeasure(stations: AuthorizedStation[], measureFeet: number) {
  const bounded = Math.max(0, measureFeet);
  return stations.reduce<AuthorizedStation | undefined>((nearest, station) => {
    if (!nearest) return station;
    return Math.abs(station.measureFeet - bounded) < Math.abs(nearest.measureFeet - bounded) ? station : nearest;
  }, undefined);
}

function nearestStationByCoordinate(stations: AuthorizedStation[], coordinate: DALCoordinate) {
  return stations.reduce<AuthorizedStation | undefined>((nearest, station) => {
    if (!nearest) return station;
    const current = Math.hypot(station.coordinate[0] - coordinate[0], station.coordinate[1] - coordinate[1]);
    const previous = Math.hypot(nearest.coordinate[0] - coordinate[0], nearest.coordinate[1] - coordinate[1]);
    return current < previous ? station : nearest;
  }, undefined);
}

function stationByLabel(registry: StationAddressRegistry, stationLabelOrId: string) {
  return registry.byStationLabel[stationLabelOrId] ?? registry.byStationId[stationLabelOrId];
}

function stationAddressAtMeasure(args: {
  stationAuthority: StationAuthority;
  registry: StationAddressRegistry;
  measureFeet: number;
  source: string;
  confidence?: number;
}) {
  const station = nearestStationByMeasure(args.stationAuthority.stations, args.measureFeet);
  if (!station) return undefined;
  const base = args.registry.byStationId[station.stationId] ?? stationAddressFromStation(station, args.source);
  return {
    ...base,
    source: args.source,
    confidence: args.confidence ?? base.confidence,
    addressStatus: "ALGORITHM_ASSIGNED" as const,
  };
}

function sourceObjectId(record: JsonObject, packageId: string, index: number) {
  return asString(
    record.objectId ?? record.unitId ?? record.structureId ?? record.segmentId ?? record.id ?? record.runtimeObjectId,
    `${packageId}:OBJECT:${String(index + 1).padStart(6, "0")}`,
  );
}

function sourceObjectType(record: JsonObject) {
  const metadata = asRecord(record.metadata);
  return normalizeType(metadata.structureType ?? record.structureType ?? record.objectType ?? record.unitType ?? record.type);
}

function parentObjectId(record: JsonObject) {
  const metadata = asRecord(record.metadata);
  return asString(record.parentObjectId ?? record.parentId ?? record.parentReference ?? metadata.parentObjectId ?? metadata.parentId, "");
}

function objectMeasure(record: JsonObject) {
  const metadata = asRecord(record.metadata);
  return asNumber(record.measureFeet ?? record.stationFeet ?? metadata.measureFeet ?? metadata.stationFeet, Number.NaN);
}

function sourceObjects(args: PD002AObjectAddressingInput) {
  return [
    ...asArray(args.objects),
    ...asArray(args.structures),
    ...asArray(args.engineeringObjects),
    ...asArray(args.proposedIofUnits),
  ].map(asRecord);
}

function auditEntryId(record: JsonObject, index: number) {
  return asString(record.auditId ?? record.auditEntryId ?? record.lineItemId ?? record.unknownId, `AUDIT-${String(index + 1).padStart(4, "0")}`);
}

function auditLabel(record: JsonObject) {
  return asString(record.label ?? record.description ?? record.auditItem ?? record.lineItemId ?? record.unknownId, "Audit item");
}

function auditQuantity(record: JsonObject) {
  const quantity = asRecord(record.quantity);
  return asNumber(record.expectedQuantity ?? record.quantityValue ?? quantity.value ?? record.count ?? record.value, 0);
}

function auditEntries(args: PD002AObjectAddressingInput) {
  const estimate = asRecord(args.transparentEstimate);
  const direct = asArray(args.commercialAuditEntries);
  const trail = asArray(estimate.auditTrail);
  const attachments = asArray(asRecord(args.spineAuditProjection).attachments).map((attachment) => ({
    auditEntryId: asRecord(attachment).auditEntryId,
    label: asRecord(attachment).auditItem,
    expectedQuantity: asRecord(attachment).expectedQuantity,
    value: asRecord(attachment).value,
    confidence: asRecord(attachment).confidence,
  }));
  const entries = direct.length ? direct : trail.length ? trail : attachments;
  return entries.map((entry, index) => {
    const record = asRecord(entry);
    return {
      auditEntryId: auditEntryId(record, index),
      label: auditLabel(record),
      quantity: auditQuantity(record),
      confidence: asNumber(record.confidence ?? asRecord(record.authority).confidence, 76),
      raw: record,
    };
  });
}

function findAuditQuantity(entries: ReturnType<typeof auditEntries>, tokens: string[], fallback = 0) {
  const entry = entries.find((item) => {
    const text = `${item.auditEntryId} ${item.label}`.toLowerCase();
    return tokens.every((token) => text.includes(token.toLowerCase()));
  });
  return entry?.quantity && entry.quantity > 0 ? entry.quantity : fallback;
}

function findAuditEntries(entries: ReturnType<typeof auditEntries>, tokens: string[]) {
  return entries.filter((item) => {
    const text = `${item.auditEntryId} ${item.label}`.toLowerCase();
    return tokens.some((token) => text.includes(token.toLowerCase()));
  });
}

function pointAddress(args: {
  packageId: string;
  objectId: string;
  objectType: string;
  stationAddress: StationAddress | undefined;
  source: string;
  parentObjectId?: string;
  inheritedFromObjectId?: string;
  notes?: string[];
}): ObjectAddress {
  return {
    objectId: args.objectId,
    objectType: normalizeType(args.objectType),
    addressType: args.stationAddress ? "POINT" : "UNASSIGNED_REVIEW",
    stationAddress: args.stationAddress,
    measureFeet: args.stationAddress?.measureFeet,
    coordinate: args.stationAddress?.coordinate,
    addressStatus: args.stationAddress?.addressStatus ?? "UNASSIGNED",
    addressAuthority: PD002A_OBJECT_ADDRESSING_AUTHORITY,
    addressSource: args.source,
    parentObjectId: args.parentObjectId,
    inheritedFromObjectId: args.inheritedFromObjectId,
    requiresEngineeringReview: !args.stationAddress,
    requiresFieldRedlineReview: false,
    notes: args.notes ?? [],
  };
}

function rangeAddress(args: {
  packageId: string;
  objectId: string;
  objectType: string;
  from: StationAddress | undefined;
  to: StationAddress | undefined;
  source: string;
  notes?: string[];
}): ObjectAddress {
  const fromMeasureFeet = args.from?.measureFeet;
  const toMeasureFeet = args.to?.measureFeet;
  return {
    objectId: args.objectId,
    objectType: normalizeType(args.objectType),
    addressType: "RANGE",
    fromStationAddress: args.from,
    toStationAddress: args.to,
    addressRange: args.from && args.to ? {
      fromStationAddress: args.from,
      toStationAddress: args.to,
      fromMeasureFeet: args.from.measureFeet,
      toMeasureFeet: args.to.measureFeet,
      lengthFeet: Math.max(0, args.to.measureFeet - args.from.measureFeet),
    } : undefined,
    fromMeasureFeet,
    toMeasureFeet,
    fromCoordinate: args.from?.coordinate,
    toCoordinate: args.to?.coordinate,
    addressStatus: args.from && args.to ? "ALGORITHM_ASSIGNED" : "UNASSIGNED",
    addressAuthority: PD002A_OBJECT_ADDRESSING_AUTHORITY,
    addressSource: args.source,
    requiresEngineeringReview: !args.from || !args.to,
    requiresFieldRedlineReview: false,
    notes: args.notes ?? [],
  };
}

function packageLevelAddress(packageId: string, objectId: string, objectType: string, source: string): ObjectAddress {
  return {
    objectId,
    objectType: normalizeType(objectType),
    addressType: "PACKAGE_LEVEL",
    addressStatus: "ASSIGNED",
    addressAuthority: PD002A_OBJECT_ADDRESSING_AUTHORITY,
    addressSource: source,
    requiresEngineeringReview: false,
    requiresFieldRedlineReview: false,
    notes: ["Package-level authority object. Explicitly not station-addressed."],
  };
}

function addressExistingObjects(args: {
  input: PD002AObjectAddressingInput;
  registry: StationAddressRegistry;
  objectAddresses: ObjectAddress[];
}) {
  const attachmentsByObjectId = new Map((args.input.objectStationAttachments ?? []).map((attachment) => [attachment.objectId, attachment]));
  const byObjectId = new Map<string, ObjectAddress>();
  args.objectAddresses.forEach((address) => byObjectId.set(address.objectId, address));
  sourceObjects(args.input).forEach((object, index) => {
    const objectId = sourceObjectId(object, args.input.packageId, index);
    if (byObjectId.has(objectId)) return;
    const objectType = sourceObjectType(object);
    if (isPD002APackageLevelObjectType(objectType)) {
      const address = packageLevelAddress(args.input.packageId, objectId, objectType, "PD-002A_PACKAGE_LEVEL_RULE");
      args.objectAddresses.push(address);
      byObjectId.set(objectId, address);
      return;
    }
    const parentId = parentObjectId(object);
    const parentAddress = parentId ? byObjectId.get(parentId) : undefined;
    if (parentAddress && isPD002AContainedObjectType(objectType)) {
      const inherited = pointAddress({
        packageId: args.input.packageId,
        objectId,
        objectType,
        stationAddress: parentAddress.stationAddress,
        source: "PD-002A_CONTAINED_OBJECT_INHERITANCE",
        parentObjectId: parentId,
        inheritedFromObjectId: parentId,
        notes: [`Contained object inherited address from ${parentId}.`],
      });
      args.objectAddresses.push(inherited);
      byObjectId.set(objectId, inherited);
      return;
    }
    const attachment = attachmentsByObjectId.get(objectId);
    const explicitStation = attachment?.stationId ? args.registry.byStationId[attachment.stationId] : undefined;
    const coordinate = coordinateFrom(object.coordinate ?? object.geometry ?? asRecord(object.metadata).coordinate);
    const stationByCoordinate = coordinate ? nearestStationByCoordinate(args.input.stationAuthority.stations, coordinate) : undefined;
    const measureFeet = objectMeasure(object);
    const stationByMeasure = Number.isFinite(measureFeet) ? nearestStationByMeasure(args.input.stationAuthority.stations, measureFeet) : undefined;
    const stationAddress = explicitStation ??
      (stationByCoordinate ? stationAddressFromStation(stationByCoordinate, "PD-002A_EXPLICIT_COORDINATE_NEAREST_STATION", "ALGORITHM_ASSIGNED", 82) : undefined) ??
      (stationByMeasure ? stationAddressFromStation(stationByMeasure, "PD-002A_EXPLICIT_MEASURE_NEAREST_STATION", "ALGORITHM_ASSIGNED", 84) : undefined);
    if (isPD002ARangeObjectType(objectType)) {
      const from = attachment?.stationId ? args.registry.byStationId[attachment.stationId] : args.registry.entries[0];
      const to = args.registry.entries[args.registry.entries.length - 1];
      const address = rangeAddress({
        packageId: args.input.packageId,
        objectId,
        objectType,
        from,
        to,
        source: "PD-002A_EXISTING_RANGE_OBJECT",
        notes: ["Existing range object addressed to station range."],
      });
      args.objectAddresses.push(address);
      byObjectId.set(objectId, address);
      return;
    }
    if (isPD002APointObjectType(objectType) || stationAddress) {
      const address = pointAddress({
        packageId: args.input.packageId,
        objectId,
        objectType,
        stationAddress,
        source: stationAddress ? "PD-002A_EXISTING_POINT_OBJECT" : "PD-002A_UNASSIGNED_POINT_OBJECT",
        parentObjectId: parentId,
      });
      args.objectAddresses.push(address);
      byObjectId.set(objectId, address);
    }
  });
}

function addAuditPointObjects(args: {
  input: PD002AObjectAddressingInput;
  registry: StationAddressRegistry;
  entries: ReturnType<typeof auditEntries>;
  objectAddresses: ObjectAddress[];
}) {
  const handholeCount = Math.round(findAuditQuantity(args.entries, ["handhole"], 0) || findAuditQuantity(args.entries, ["manhole"], 0));
  const spliceCount = Math.round(findAuditQuantity(args.entries, ["splice"], 0));
  const ilaCount = Math.round(findAuditQuantity(args.entries, ["ila"], 0) || findAuditQuantity(args.entries, ["regen"], 0));
  const pointParents: ObjectAddress[] = [];
  if (handholeCount > 0) {
    const spacing = args.input.measuredSpine.routeLengthFeet / handholeCount;
    Array.from({ length: handholeCount }, (_, index) => {
      const measureFeet = Math.min(args.input.measuredSpine.routeLengthFeet, Math.max(0, Math.round((index + 0.5) * spacing)));
      const stationAddress = stationAddressAtMeasure({
        stationAuthority: args.input.stationAuthority,
        registry: args.registry,
        measureFeet,
        source: "PD-002A_AUDIT_DERIVED_HANDHOLE_SPACING",
        confidence: 78,
      });
      const address = pointAddress({
        packageId: args.input.packageId,
        objectId: `${args.input.packageId}:PD002A:HANDHOLE:${String(index + 1).padStart(4, "0")}`,
        objectType: "HANDHOLE",
        stationAddress,
        source: "AUDIT_DERIVED_HANDHOLE_SPACING",
        notes: [`Default spacing = routeLengthFeet / count (${Math.round(spacing).toLocaleString()} ft).`],
      });
      args.objectAddresses.push(address);
      pointParents.push(address);
    });
  }
  if (spliceCount > 0) {
    Array.from({ length: spliceCount }, (_, index) => {
      const parent = pointParents.length ? pointParents[Math.min(pointParents.length - 1, Math.round((index / Math.max(1, spliceCount - 1)) * (pointParents.length - 1)))] : undefined;
      args.objectAddresses.push(pointAddress({
        packageId: args.input.packageId,
        objectId: `${args.input.packageId}:PD002A:SPLICE_CASE:${String(index + 1).padStart(4, "0")}`,
        objectType: "SPLICE_CASE",
        stationAddress: parent?.stationAddress,
        source: parent ? "PD-002A_SPLICE_CASE_PARENT_INHERITANCE" : "PD-002A_SPLICE_CASE_UNASSIGNED_REVIEW",
        parentObjectId: parent?.objectId,
        inheritedFromObjectId: parent?.objectId,
        notes: parent ? [`Splice case inherited address from ${parent.objectId}.`] : ["No valid handhole/manhole/vault parent exists."],
      }));
    });
  }
  if (ilaCount > 0) {
    Array.from({ length: ilaCount }, (_, index) => {
      const measureFeet = ilaCount === 1
        ? args.input.measuredSpine.routeLengthFeet / 2
        : (index / Math.max(1, ilaCount - 1)) * args.input.measuredSpine.routeLengthFeet;
      const stationAddress = stationAddressAtMeasure({
        stationAuthority: args.input.stationAuthority,
        registry: args.registry,
        measureFeet,
        source: "PD-002A_AUDIT_DERIVED_ILA_SPACING",
        confidence: 74,
      });
      args.objectAddresses.push(pointAddress({
        packageId: args.input.packageId,
        objectId: `${args.input.packageId}:PD002A:ILA:${String(index + 1).padStart(3, "0")}`,
        objectType: "ILA",
        stationAddress,
        source: stationAddress ? "PD-002A_AUDIT_DERIVED_ILA" : "PD-002A_ILA_PENDING_REVIEW",
        notes: stationAddress ? ["High-value ILA point object is visible and station-addressed."] : ["ILA requires Engineering station address."],
      }));
    });
  }
}

function addRangeAddress(args: {
  input: PD002AObjectAddressingInput;
  registry: StationAddressRegistry;
  objectAddresses: ObjectAddress[];
  objectType: string;
  quantityFeet: number;
  source: string;
  notes?: string[];
}) {
  if (args.quantityFeet <= 0) return;
  const from = args.registry.entries[0];
  const endMeasure = Math.max(1, Math.min(args.input.measuredSpine.routeLengthFeet, args.quantityFeet));
  const to = stationAddressAtMeasure({
    stationAuthority: args.input.stationAuthority,
    registry: args.registry,
    measureFeet: endMeasure,
    source: args.source,
    confidence: 80,
  }) ?? args.registry.entries[args.registry.entries.length - 1];
  args.objectAddresses.push(rangeAddress({
    packageId: args.input.packageId,
    objectId: `${args.input.packageId}:PD002A:${stableIdPart(args.objectType)}:${String(args.objectAddresses.length + 1).padStart(4, "0")}`,
    objectType: args.objectType,
    from,
    to,
    source: args.source,
    notes: [
      `Audit quantity ${Math.round(args.quantityFeet).toLocaleString()} ft is addressed to a station range.`,
      ...(args.notes ?? []),
    ],
  }));
}

function addAuditRangeObjects(args: {
  input: PD002AObjectAddressingInput;
  registry: StationAddressRegistry;
  entries: ReturnType<typeof auditEntries>;
  objectAddresses: ObjectAddress[];
}) {
  const quantity = asRecord(args.input.quantitySummary);
  const plowFeet = findAuditQuantity(args.entries, ["plow"], asNumber(quantity.plowFeet, 0));
  const boreFeet = findAuditQuantity(args.entries, ["bore"], asNumber(quantity.directionalBoreFeet, 0));
  const trenchFeet = findAuditQuantity(args.entries, ["trench"], asNumber(quantity.openTrenchFeet, 0));
  const conduitFeet = findAuditQuantity(args.entries, ["conduit"], asNumber(quantity.conduitFeet, 0));
  const fiberFeet = findAuditQuantity(args.entries, ["fiber"], asNumber(quantity.fiberFeet, 0));
  addRangeAddress({ input: args.input, registry: args.registry, objectAddresses: args.objectAddresses, objectType: "PLOW_SEGMENT", quantityFeet: plowFeet || args.input.measuredSpine.routeLengthFeet, source: "PD-002A_AUDIT_DERIVED_CIVIL_RANGE", notes: ["Plow takes precedence where no known constraint exists."] });
  addRangeAddress({ input: args.input, registry: args.registry, objectAddresses: args.objectAddresses, objectType: "DIRECTIONAL_BORE_SEGMENT", quantityFeet: boreFeet, source: "PD-002A_AUDIT_DERIVED_CIVIL_RANGE" });
  addRangeAddress({ input: args.input, registry: args.registry, objectAddresses: args.objectAddresses, objectType: "OPEN_TRENCH_SEGMENT", quantityFeet: trenchFeet, source: "PD-002A_AUDIT_DERIVED_CIVIL_RANGE" });
  addRangeAddress({ input: args.input, registry: args.registry, objectAddresses: args.objectAddresses, objectType: "CONDUIT_SEGMENT", quantityFeet: conduitFeet || asNumber(quantity.routeFeet, args.input.measuredSpine.routeLengthFeet), source: "PD-002A_AUDIT_DERIVED_CONDUIT_RANGE" });
  if (args.input.productIncludesFiber !== false) {
    addRangeAddress({ input: args.input, registry: args.registry, objectAddresses: args.objectAddresses, objectType: "FIBER_SEGMENT", quantityFeet: fiberFeet || asNumber(quantity.fiberFeet, 0), source: "PD-002A_AUDIT_DERIVED_FIBER_RANGE", notes: ["Fiber range aligns with conduit range unless audit or doctrine says otherwise."] });
  }
}

function reviewObjectType(label: string): PD002AReviewObjectType {
  const text = label.toLowerCase();
  if (text.includes("rail")) return "RAILROAD_CROSSING_UNKNOWN";
  if (text.includes("water")) return "WATER_CROSSING_UNKNOWN";
  if (text.includes("dot") || text.includes("highway")) return "DOT_HIGHWAY_CROSSING_UNKNOWN";
  if (text.includes("utility")) return "UTILITY_CONFLICT_UNKNOWN";
  if (text.includes("environment")) return "ENVIRONMENTAL_IMPACT_UNKNOWN";
  if (text.includes("bridge")) return "BRIDGE_ATTACHMENT_UNKNOWN";
  if (text.includes("rock")) return "ROCK_PERCENTAGE_UNKNOWN";
  if (text.includes("restoration")) return "RESTORATION_REVIEW_UNKNOWN";
  return "GENERAL_REVIEW";
}

function reviewObjects(args: {
  input: PD002AObjectAddressingInput;
  entries: ReturnType<typeof auditEntries>;
}) {
  const unknownEntries = args.entries.filter((entry) => {
    const text = `${entry.auditEntryId} ${entry.label}`.toLowerCase();
    return ["unknown", "rail", "water", "dot", "highway", "utility", "environment", "bridge", "rock", "restoration"].some((token) => text.includes(token));
  });
  const sourceReviewObjects = asArray(args.input.spineReviewObjects).map((item, index) => {
    const record = asRecord(item);
    return {
      auditEntryId: asString(record.auditEntryId, `SPINE-REVIEW-${index + 1}`),
      label: asString(record.label, `Spine review ${index + 1}`),
      quantity: 0,
      confidence: 55,
      raw: record,
    };
  });
  const all = [...unknownEntries, ...sourceReviewObjects];
  const byKey = new Map<string, typeof all[number]>();
  all.forEach((entry) => byKey.set(`${reviewObjectType(entry.label)}:${entry.auditEntryId}`, entry));
  return [...byKey.values()].map((entry, index): PD002AReviewObject => {
    const type = reviewObjectType(entry.label);
    return {
      reviewObjectId: `${args.input.packageId}:PD002A:REVIEW:${stableIdPart(type)}:${String(index + 1).padStart(3, "0")}`,
      reviewType: type,
      addressStatus: "PENDING_REVIEW",
      sourceAuditEntry: entry.raw,
      reason: `${entry.label} requires Engineering address review.`,
      confidence: entry.confidence,
      blockingStatus: type === "GENERAL_REVIEW" || entry.confidence >= 65 ? "NON_BLOCKING" : "BLOCKING",
      requiresEngineeringAddressing: true,
      originalReviewObject: entry.raw,
      noScopeVersionCreation: true,
    };
  });
}

function addressSummary(args: {
  packageId: string;
  stationAddressRegistry: StationAddressRegistry;
  objectAddresses: ObjectAddress[];
  unassignedReviewObjects: PD002AReviewObject[];
  addressedReviewObjects: PD002AReviewObject[];
  validationStatus: AddressProjectionSummary["status"];
}): AddressProjectionSummary {
  return {
    summaryId: `${args.packageId}:PD002A:ADDRESS-PROJECTION-SUMMARY`,
    packageId: args.packageId,
    objectAddressCount: args.objectAddresses.length,
    stationAddressCount: args.stationAddressRegistry.entries.length,
    pointAddressCount: args.objectAddresses.filter((address) => address.addressType === "POINT").length,
    rangeAddressCount: args.objectAddresses.filter((address) => address.addressType === "RANGE").length,
    unassignedReviewObjectCount: args.unassignedReviewObjects.length,
    addressedReviewObjectCount: args.addressedReviewObjects.length,
    blockingUnassignedReviewObjectCount: args.unassignedReviewObjects.filter((review) => review.blockingStatus === "BLOCKING").length,
    mapLayerCount: ADDRESSING_MAP_LAYERS.length,
    status: args.validationStatus,
    authority: PD002A_OBJECT_ADDRESSING_AUTHORITY,
    noScopeVersionCreation: true,
  };
}

export function createObjectAddressing(args: PD002AObjectAddressingInput): ObjectAddressingResult {
  const stationAddressRegistry = createStationAddressRegistry({
    packageId: args.packageId,
    measuredSpine: args.measuredSpine,
    stationAuthority: args.stationAuthority,
  });
  const objectAddresses: ObjectAddress[] = [];
  const entries = auditEntries(args);
  addAuditPointObjects({ input: args, registry: stationAddressRegistry, entries, objectAddresses });
  addAuditRangeObjects({ input: args, registry: stationAddressRegistry, entries, objectAddresses });
  addressExistingObjects({ input: args, registry: stationAddressRegistry, objectAddresses });
  const unassignedReviewObjects = reviewObjects({ input: args, entries });
  unassignedReviewObjects.forEach((reviewObject) => {
    objectAddresses.push({
      objectId: reviewObject.reviewObjectId,
      objectType: reviewObject.reviewType,
      addressType: "UNASSIGNED_REVIEW",
      addressStatus: reviewObject.addressStatus,
      addressAuthority: PD002A_OBJECT_ADDRESSING_AUTHORITY,
      addressSource: "PD-002A_CONSTRAINT_REVIEW_OBJECT",
      requiresEngineeringReview: true,
      requiresFieldRedlineReview: false,
      notes: [reviewObject.reason],
    });
  });
  const addressedReviewObjects: PD002AReviewObject[] = [];
  const addressValidation = validateObjectAddresses({
    packageId: args.packageId,
    stationAuthority: args.stationAuthority,
    stationAddressRegistry,
    objectAddresses,
    unassignedReviewObjects,
    addressedReviewObjects,
  });
  const addressProjectionSummary = addressSummary({
    packageId: args.packageId,
    stationAddressRegistry,
    objectAddresses,
    unassignedReviewObjects,
    addressedReviewObjects,
    validationStatus: addressValidation.status,
  });
  return {
    objectAddressingDoctrine: PD002A_OBJECT_ADDRESSING_DOCTRINE,
    stationAddressRegistry,
    objectAddresses,
    unassignedReviewObjects,
    addressedReviewObjects,
    addressValidation,
    addressAssignmentEvents: [],
    addressProjectionSummary,
    mapLayers: ADDRESSING_MAP_LAYERS,
    noScopeVersionCreation: true,
  };
}

export { stationByLabel, stationAddressFromStation };
