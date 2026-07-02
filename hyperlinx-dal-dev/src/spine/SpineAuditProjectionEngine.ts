import type { DALCoordinate } from "../types/dal";
import type {
  AuthorizedStation,
  MeasuredSpine,
  ObjectStationAttachment,
  StationAuthority,
  StationIndexedGraph,
} from "./SpineAuthorityContracts";
import type {
  AuditProjectionSummary,
  AuditProjectionType,
  ClosureExpectation,
  SpineAuditAttachment,
  SpineAuditProjection,
  SpineAuditProjectionRedlineDelta,
  SpineReviewObject,
  StationedExpectation,
  StationRangeExpectation,
} from "./SpineAuditProjectionContracts";
import { distanceFeet } from "./MeasuredSpineEngine";

type JsonObject = Record<string, unknown>;

export type SpineAuditProjectionInput = {
  packageId: string;
  measuredSpine: MeasuredSpine;
  stationAuthority: StationAuthority;
  stationIndexedGraph?: StationIndexedGraph | null;
  engineeringObjects?: unknown[];
  objectStationAttachments?: ObjectStationAttachment[];
  commercialAuditEntries?: unknown[];
  quantitySummary?: unknown;
  pricingSummary?: unknown;
  transparentEstimate?: unknown;
  productionAssumptions?: unknown;
  unknownReviewItems?: unknown[];
  generatedAt?: string;
  baselineState?: "LIVE" | "FROZEN";
};

export type StationExpectationLookup = {
  station: AuthorizedStation;
  attachedObjects: StationedExpectation[];
  expectedWork: ClosureExpectation[];
  auditAttachments: SpineAuditAttachment[];
  reviewObjects: SpineReviewObject[];
  rangeExpectations: StationRangeExpectation[];
  closurePreview: Array<{
    closureExpectationId: string;
    expectedWork: string;
    requiredEvidence: string[];
    expectedQuantity: number;
    quantityUnit: string;
    currentStatus: "NOT_STARTED";
  }>;
};

type AuditRecord = {
  auditEntryId: string;
  auditItem: string;
  sourceEngine: string;
  authorityMode: string;
  value: unknown;
  unit: string;
  formula: string;
  sourceWorkbook?: string;
  confidence: number;
  costImpact: string;
  scheduleImpact: string;
  expectedCost?: number;
  expectedQuantity?: number;
  raw: JsonObject;
};

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
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function stableIdPart(value: unknown, fallback = "UNKNOWN") {
  const raw = String(value ?? fallback).trim() || fallback;
  return raw.replace(/[^A-Za-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 120) || fallback;
}

function numericFromDisplay(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return undefined;
  const numeric = Number(value.replace(/[^0-9.-]+/g, ""));
  return Number.isFinite(numeric) ? numeric : undefined;
}

function sourceAuditEntries(args: SpineAuditProjectionInput) {
  const estimate = asRecord(args.transparentEstimate);
  const direct = asArray(args.commercialAuditEntries);
  const auditTrail = asArray(estimate.auditTrail);
  if (direct.length) return direct;
  if (auditTrail.length) return auditTrail;
  const quantity = asRecord(args.quantitySummary);
  const pricing = asRecord(args.pricingSummary);
  const fallback: unknown[] = [];
  if (asNumber(quantity.routeFeet, 0) > 0) {
    fallback.push({
      auditId: "AUDIT-PD001-ROUTE-FEET",
      label: "PD-001 Route construction footage",
      value: `${Math.round(asNumber(quantity.routeFeet)).toLocaleString()} ft`,
      unit: "feet",
      authorityMode: "CALCULATED",
      formula: "Route feet from Product Doctrine quantity summary.",
      source: "PD-001 Product Doctrine",
      confidence: 88,
      costImpact: "Included",
      scheduleImpact: "Included",
      expectedQuantity: asNumber(quantity.routeFeet),
    });
  }
  if (asNumber(quantity.conduitFeet, 0) > 0) {
    fallback.push({
      auditId: "AUDIT-PD001-CONDUIT-FEET",
      label: "PD-001 Conduit material footage",
      value: `${Math.round(asNumber(quantity.conduitFeet)).toLocaleString()} ft`,
      unit: "feet",
      authorityMode: "CALCULATED",
      formula: "Conduit feet from Product Doctrine quantity summary.",
      source: "PD-001 Product Doctrine",
      confidence: 88,
      costImpact: "Included",
      scheduleImpact: "Included",
      expectedQuantity: asNumber(quantity.conduitFeet),
    });
  }
  if (asNumber(quantity.fiberFeet, 0) > 0) {
    fallback.push({
      auditId: "AUDIT-PD001-FIBER-FEET",
      label: "PD-001 Fiber material footage",
      value: `${Math.round(asNumber(quantity.fiberFeet)).toLocaleString()} ft`,
      unit: "feet",
      authorityMode: "CALCULATED",
      formula: "Fiber feet from Product Doctrine quantity summary.",
      source: "PD-001 Product Doctrine",
      confidence: 88,
      costImpact: "Included",
      scheduleImpact: "Included",
      expectedQuantity: asNumber(quantity.fiberFeet),
    });
  }
  if (asNumber(quantity.structureCount, 0) > 0) {
    fallback.push({
      auditId: "AUDIT-PD001-STRUCTURES",
      label: "PD-001 Handhole splice case and ILA facility structure count",
      value: `${Math.round(asNumber(quantity.structureCount)).toLocaleString()} count`,
      unit: "count",
      authorityMode: "CALCULATED",
      formula: "Structure count from Product Doctrine deterministic spacing.",
      source: "PD-001 Product Doctrine",
      confidence: 78,
      costImpact: "Included",
      scheduleImpact: "Included",
      expectedQuantity: asNumber(quantity.structureCount),
    });
  }
  if (asNumber(quantity.crossingCount, 0) > 0) {
    fallback.push({
      auditId: "AUDIT-PD001-CROSSING-REVIEW",
      label: "PD-001 Railroad crossing and jurisdiction review allowance",
      value: `${Math.round(asNumber(quantity.crossingCount)).toLocaleString()} count`,
      unit: "review",
      authorityMode: "REFERENCE",
      formula: "Crossing count is commercial review only until Engineering confirms jurisdiction conditions.",
      source: "PD-001 Product Doctrine",
      confidence: 62,
      costImpact: "Not included",
      scheduleImpact: "Included",
      expectedQuantity: asNumber(quantity.crossingCount),
    });
  }
  if (asNumber(pricing.budgetCost, 0) > 0) {
    fallback.push({
      auditId: "AUDIT-PD001-BUDGET-COST",
      label: "PD-001 Budget cost",
      value: `$${Math.round(asNumber(pricing.budgetCost)).toLocaleString()}`,
      unit: "USD",
      authorityMode: "CALCULATED",
      formula: "Budget cost from Product Doctrine pricing summary.",
      source: "PD-001 Product Doctrine",
      confidence: 76,
      costImpact: "Included",
      scheduleImpact: "Not included",
      expectedCost: asNumber(pricing.budgetCost),
    });
  }
  if (asNumber(pricing.mrcRevenue, 0) > 0) {
    fallback.push({
      auditId: "AUDIT-PD001-LAYER1-LIFECYCLE",
      label: "Layer 1 lifecycle MRC obligation",
      value: `$${Math.round(asNumber(pricing.mrcRevenue)).toLocaleString()}`,
      unit: "USD",
      authorityMode: "CALCULATED",
      formula: "Lifecycle item from Product Doctrine pricing summary.",
      source: "PD-001 Product Doctrine",
      confidence: 70,
      costImpact: "Included",
      scheduleImpact: "Not included",
      expectedCost: asNumber(pricing.mrcRevenue),
    });
  }
  return fallback;
}

function sourceUnknownItems(args: SpineAuditProjectionInput) {
  const estimate = asRecord(args.transparentEstimate);
  return [
    ...asArray(args.unknownReviewItems),
    ...asArray(estimate.unknownQuantities),
  ];
}

function auditRecord(value: unknown, index: number): AuditRecord {
  const record = asRecord(value);
  const quantity = asRecord(record.quantity);
  const extendedCost = asRecord(record.extendedCost);
  const authority = asRecord(record.authority);
  const label = asString(record.label ?? record.description ?? record.auditItem ?? record.lineItemId, `Audit item ${index + 1}`);
  const expectedCost = numericFromDisplay(record.value) ?? asNumber(extendedCost.value, 0);
  const expectedQuantity = numericFromDisplay(record.quantityValue ?? quantity.value ?? record.expectedQuantity);
  return {
    auditEntryId: asString(record.auditId ?? record.auditEntryId ?? record.lineItemId ?? record.unknownId, `AUDIT-${String(index + 1).padStart(4, "0")}`),
    auditItem: label,
    sourceEngine: asString(record.source ?? record.sourceEngine, "Estimate Audit"),
    authorityMode: asString(record.authorityMode ?? authority.authorityMode, "CALCULATED"),
    value: record.value ?? extendedCost.display ?? quantity.display ?? record.display ?? expectedCost ?? "",
    unit: asString(record.unit ?? record.quantityUnit ?? quantity.unit, asString(quantity.display, "unit")),
    formula: asString(record.formula ?? extendedCost.formula ?? record.costTreatment, "No formula supplied."),
    sourceWorkbook: asString(record.workbook ?? record.sourceWorkbook, ""),
    confidence: asNumber(record.confidence ?? authority.confidence, 0),
    costImpact: asString(record.costImpact, expectedCost ? "Included" : "Not included"),
    scheduleImpact: asString(record.scheduleImpact, authority.affectsSchedule ? "Included" : "Not included"),
    expectedCost,
    expectedQuantity,
    raw: record,
  };
}

function auditRecords(args: SpineAuditProjectionInput) {
  const entries = sourceAuditEntries(args).map(auditRecord);
  const unknowns = sourceUnknownItems(args).map((item, index) => {
    const record = asRecord(item);
    return auditRecord({
      auditId: `AUDIT-${asString(record.unknownId, `UNKNOWN-${index + 1}`)}`,
      label: asString(record.label, `Unknown review ${index + 1}`),
      value: record.display ?? "UNKNOWN",
      unit: "review",
      authorityMode: asRecord(record.authority).authorityMode ?? "REFERENCE",
      formula: record.costTreatment ?? "Unknown condition requires review.",
      source: record.source ?? "Unknown Quantity Review",
      confidence: asRecord(record.authority).confidence ?? 0,
      costImpact: "Not included",
      scheduleImpact: asRecord(record.authority).affectsSchedule ? "Included" : "Not included",
      notes: record.status,
    }, entries.length + index);
  });
  return [...entries, ...unknowns];
}

function classifyAudit(record: AuditRecord): AuditProjectionType {
  const text = `${record.auditEntryId} ${record.auditItem} ${record.formula}`.toLowerCase();
  if (text.includes("unknown") || text.includes("railroad") || text.includes("rock") || text.includes("traffic control") || text.includes("mot")) return "UNKNOWN_REVIEW";
  if (text.includes("confidence") || record.confidence < 60 && record.costImpact !== "Included") return "CONFIDENCE_REVIEW";
  if (text.includes("lifecycle") || text.includes("mrc") || text.includes("o&m") || text.includes("operations and maintenance")) return "LIFECYCLE";
  if (text.includes("ila") || text.includes("regen") || text.includes("hut") || text.includes("handhole") || text.includes("vault") || text.includes("splice") || text.includes("pull point") || text.includes("marker")) return "STATION_OBJECT";
  if (text.includes("plow") || text.includes("bore") || text.includes("hdd") || text.includes("trench") || text.includes("open cut") || text.includes("open trench")) return "STATION_RANGE";
  if (text.includes("conduit") || text.includes("fiber") || text.includes("material")) return "SEGMENT_RANGE";
  if (text.includes("permit") || text.includes("jurisdiction")) return "SPINE_WIDE";
  if (record.scheduleImpact === "Included" && record.costImpact !== "Included") return "SCHEDULE_ONLY";
  if (record.costImpact === "Included") return "COST_ONLY";
  return "SPINE_WIDE";
}

function expectationType(record: AuditRecord): StationRangeExpectation["expectationType"] {
  const text = `${record.auditItem} ${record.formula}`.toLowerCase();
  if (text.includes("plow")) return "PLOW";
  if (text.includes("bore") || text.includes("hdd")) return "BORE";
  if (text.includes("trench") || text.includes("open cut")) return "OPEN_TRENCH";
  if (text.includes("conduit")) return "CONDUIT";
  if (text.includes("fiber")) return "FIBER";
  return "GENERAL_SEGMENT";
}

function nearestStation(stations: AuthorizedStation[], measureFeet: number) {
  return stations.reduce<AuthorizedStation | null>((nearest, station) => {
    if (!nearest) return station;
    return Math.abs(station.measureFeet - measureFeet) < Math.abs(nearest.measureFeet - measureFeet) ? station : nearest;
  }, null);
}

function stationFromCoordinate(stations: AuthorizedStation[], coordinate: DALCoordinate | undefined) {
  if (!coordinate) return null;
  return stations.reduce<AuthorizedStation | null>((nearest, station) => {
    if (!nearest) return station;
    return distanceFeet(station.coordinate, coordinate) < distanceFeet(nearest.coordinate, coordinate) ? station : nearest;
  }, null);
}

function objectId(record: JsonObject, index: number) {
  return asString(record.objectId ?? record.unitId ?? record.structureId ?? record.id ?? record.facilityId, `OBJECT-${String(index + 1).padStart(4, "0")}`);
}

function objectType(record: JsonObject) {
  const metadata = asRecord(record.metadata);
  return asString(metadata.structureType ?? record.structureType ?? record.objectType ?? record.unitType ?? record.facilityType ?? record.type, "OBJECT").toUpperCase();
}

function coordinateFrom(value: unknown): DALCoordinate | undefined {
  if (Array.isArray(value) && value.length >= 2) {
    const first = Number(value[0]);
    const second = Number(value[1]);
    if (Number.isFinite(first) && Number.isFinite(second)) {
      if (Math.abs(first) <= 180 && Math.abs(second) <= 90) return [first, second];
      if (Math.abs(first) <= 90 && Math.abs(second) <= 180) return [second, first];
    }
  }
  const record = asRecord(value);
  if (record.coordinate !== undefined) return coordinateFrom(record.coordinate);
  return coordinateFrom([record.lon ?? record.lng ?? record.longitude ?? record.x, record.lat ?? record.latitude ?? record.y]);
}

function sourceObjects(args: SpineAuditProjectionInput) {
  const estimate = asRecord(args.transparentEstimate);
  const ilaFacilities = asArray(estimate.ilaFacilities);
  return [
    ...asArray(args.engineeringObjects),
    ...ilaFacilities,
  ].map(asRecord);
}

function stationObjectExpectations(args: SpineAuditProjectionInput, records: AuditRecord[]) {
  const objects = sourceObjects(args);
  const attachments = args.objectStationAttachments ?? [];
  const stationRecords: StationedExpectation[] = [];
  const closureRecords: ClosureExpectation[] = [];
  const objectAuditRecords = records.filter((record) => classifyAudit(record) === "STATION_OBJECT");
  objects.forEach((object, index) => {
    const id = objectId(object, index);
    const type = objectType(object);
    const attachment = attachments.find((candidate) => candidate.objectId === id);
    const station = attachment?.stationId
      ? args.stationAuthority.stations.find((candidate) => candidate.stationId === attachment.stationId)
      : stationFromCoordinate(args.stationAuthority.stations, coordinateFrom(object.coordinate));
    if (!station) return;
    const matchingAudits = objectAuditRecords.filter((record) => `${record.auditItem} ${record.auditEntryId}`.toUpperCase().includes(type));
    const auditIds = matchingAudits.length ? matchingAudits.map((record) => record.auditEntryId) : objectAuditRecords.slice(0, 1).map((record) => record.auditEntryId);
    const expectedCapitalCost = asNumber(object.totalCost ?? object.facilityTotal ?? object.quantity, undefined as unknown as number);
    const expectationId = `${args.packageId}:STATION-EXPECTATION:${stableIdPart(id)}`;
    const expectedWork = type.includes("SPLICE")
      ? ["install object", "splice", "test", "inspect"]
      : type.includes("ILA") || type.includes("REGEN") || type.includes("HUT")
        ? ["install object", "place facility", "test", "inspect"]
        : ["install object", "inspect"];
    stationRecords.push({
      expectationId,
      packageId: args.packageId,
      stationId: station.stationId,
      stationLabel: station.stationLabel,
      measureFeet: station.measureFeet,
      coordinate: station.coordinate,
      objectId: id,
      objectType: type,
      auditEntryIds: auditIds,
      expectedWork,
      expectedQuantity: asNumber(object.quantity, 1) || 1,
      quantityUnit: asString(object.unit, "each"),
      expectedLaborCost: numericFromDisplay(object.laborCost),
      expectedMaterialCost: numericFromDisplay(object.materialCost),
      expectedCapitalCost: Number.isFinite(expectedCapitalCost) ? expectedCapitalCost : undefined,
      sourceFormula: matchingAudits[0]?.formula,
      confidence: matchingAudits[0]?.confidence,
      closureRequired: true,
      reviewRequired: false,
      requiredEvidence: ["photo", "as-built coordinate", "inspection note"],
      status: "NOT_STARTED",
    });
    closureRecords.push({
      closureExpectationId: `${expectationId}:CLOSURE`,
      packageId: args.packageId,
      expectationKind: "STATION_OBJECT",
      stationId: station.stationId,
      stationLabel: station.stationLabel,
      objectId: id,
      objectType: type,
      auditEntryIds: auditIds,
      expectedWork: expectedWork.join(", "),
      expectedQuantity: asNumber(object.quantity, 1) || 1,
      quantityUnit: asString(object.unit, "each"),
      expectedCost: Number.isFinite(expectedCapitalCost) ? expectedCapitalCost : undefined,
      requiredEvidence: ["photo", "as-built coordinate", "inspection note"],
      closureRequired: true,
      reviewRequired: false,
      currentStatus: "NOT_STARTED",
    });
  });
  return { stationRecords, closureRecords };
}

function allRange(args: SpineAuditProjectionInput) {
  const stations = args.stationAuthority.stations;
  return {
    from: stations[0],
    to: stations[stations.length - 1],
    fromMeasureFeet: 0,
    toMeasureFeet: args.measuredSpine.routeLengthFeet,
    segmentIds: args.measuredSpine.segments.map((segment) => segment.segmentId),
  };
}

function rangeExpectations(args: SpineAuditProjectionInput, records: AuditRecord[]) {
  const rangeRecords: StationRangeExpectation[] = [];
  const closureRecords: ClosureExpectation[] = [];
  records
    .filter((record) => ["SEGMENT_RANGE", "STATION_RANGE"].includes(classifyAudit(record)))
    .forEach((record, index) => {
      const range = allRange(args);
      const type = expectationType(record);
      const expectationId = `${args.packageId}:RANGE-EXPECTATION:${stableIdPart(record.auditEntryId, String(index + 1))}`;
      const quantityFeet = record.expectedQuantity && record.expectedQuantity > 0 ? record.expectedQuantity : args.measuredSpine.routeLengthFeet;
      const productionRate = productionRateFor(type, args.productionAssumptions);
      rangeRecords.push({
        expectationId,
        packageId: args.packageId,
        fromStationId: range.from.stationId,
        toStationId: range.to.stationId,
        fromStationLabel: range.from.stationLabel,
        toStationLabel: range.to.stationLabel,
        fromMeasureFeet: range.fromMeasureFeet,
        toMeasureFeet: range.toMeasureFeet,
        spineSegmentIds: range.segmentIds,
        auditEntryIds: [record.auditEntryId],
        expectationType: type,
        quantityFeet,
        productionRate,
        expectedCost: record.expectedCost,
        expectedScheduleImpact: productionRate ? quantityFeet / productionRate : undefined,
        sourceFormula: record.formula,
        confidence: record.confidence,
        closureRequired: true,
        reviewRequired: false,
        status: "NOT_STARTED",
      });
      closureRecords.push({
        closureExpectationId: `${expectationId}:CLOSURE`,
        packageId: args.packageId,
        expectationKind: "STATION_RANGE",
        fromStationId: range.from.stationId,
        toStationId: range.to.stationId,
        auditEntryIds: [record.auditEntryId],
        expectedWork: `${type.replaceAll("_", " ").toLowerCase()} from ${range.from.stationLabel} to ${range.to.stationLabel}`,
        expectedQuantity: quantityFeet,
        quantityUnit: "feet",
        expectedCost: record.expectedCost,
        expectedScheduleImpact: productionRate ? quantityFeet / productionRate : undefined,
        requiredEvidence: ["daily production record", "as-built segment", "inspection note"],
        closureRequired: true,
        reviewRequired: false,
        currentStatus: "NOT_STARTED",
      });
    });
  return { rangeRecords, closureRecords };
}

function productionRateFor(type: StationRangeExpectation["expectationType"], productionAssumptions: unknown) {
  const production = asRecord(asRecord(productionAssumptions).production ?? productionAssumptions);
  if (type === "PLOW") return asNumber(production.plowFeetPerDay, undefined as unknown as number);
  if (type === "BORE") return asNumber(production.directionalBoreDirtFeetPerDay, undefined as unknown as number);
  if (type === "OPEN_TRENCH") return asNumber(production.openTrenchDirtFeetPerDay, undefined as unknown as number);
  if (type === "FIBER") return asNumber(production.fiberBlowingFeetPerDay ?? production.fiberPullingFeetPerDay, undefined as unknown as number);
  return undefined;
}

function reviewType(record: AuditRecord): SpineReviewObject["reviewType"] {
  const text = `${record.auditItem} ${record.formula}`.toLowerCase();
  if (text.includes("jurisdiction") || text.includes("permit")) return "JURISDICTION_REVIEW";
  if (text.includes("lifecycle") || text.includes("mrc") || text.includes("o&m") || text.includes("operations and maintenance")) return "LIFECYCLE_REVIEW";
  if (classifyAudit(record) === "CONFIDENCE_REVIEW") return "CONFIDENCE_RISK";
  if (classifyAudit(record) === "UNKNOWN_REVIEW") return "UNKNOWN_CONDITION";
  return "COMMERCIAL_REVIEW";
}

function reviewObjects(args: SpineAuditProjectionInput, records: AuditRecord[]) {
  const firstStation = args.stationAuthority.stations[0];
  return records
    .filter((record) => ["UNKNOWN_REVIEW", "CONFIDENCE_REVIEW"].includes(classifyAudit(record)))
    .map((record, index): SpineReviewObject => ({
      reviewObjectId: `${args.packageId}:REVIEW-OBJECT:${stableIdPart(record.auditEntryId, String(index + 1))}`,
      packageId: args.packageId,
      reviewType: reviewType(record),
      label: record.auditItem,
      auditEntryId: record.auditEntryId,
      stationId: firstStation?.stationId,
      stationLabel: firstStation?.stationLabel,
      measureFeet: firstStation?.measureFeet,
      coordinate: firstStation?.coordinate,
      requiredBeforeEngineeringCertification: classifyAudit(record) === "UNKNOWN_REVIEW",
      closureRequired: false,
      reviewRequired: true,
      status: "OPEN",
      reason: record.formula,
    }));
}

function attachmentForRecord(args: SpineAuditProjectionInput, record: AuditRecord, index: number): SpineAuditAttachment {
  const projectionType = classifyAudit(record);
  const range = allRange(args);
  const review = projectionType === "UNKNOWN_REVIEW" || projectionType === "CONFIDENCE_REVIEW";
  const stationObject = projectionType === "STATION_OBJECT";
  const station = stationObject ? nearestStation(args.stationAuthority.stations, args.measuredSpine.routeLengthFeet / 2) : null;
  const attachmentId = `${args.packageId}:AUDIT-ATTACHMENT:${stableIdPart(record.auditEntryId, String(index + 1))}`;
  const reviewObjectId = review ? `${args.packageId}:REVIEW-OBJECT:${stableIdPart(record.auditEntryId, String(index + 1))}` : undefined;
  return {
    projectionId: `${args.packageId}:SPINE-AUDIT-PROJECTION`,
    auditEntryId: record.auditEntryId,
    auditItem: record.auditItem,
    sourceEngine: record.sourceEngine,
    authorityMode: record.authorityMode,
    value: record.value,
    unit: record.unit,
    formula: record.formula,
    sourceWorkbook: record.sourceWorkbook,
    confidence: record.confidence,
    costImpact: record.costImpact,
    scheduleImpact: record.scheduleImpact,
    projectionType,
    attachmentType: review ? "REVIEW_OBJECT" : stationObject ? "STATION" : ["SEGMENT_RANGE", "STATION_RANGE"].includes(projectionType) ? "STATION_RANGE" : projectionType === "LIFECYCLE" ? "SPINE" : projectionType === "COST_ONLY" ? "COST_RECORD" : "SPINE",
    attachmentId,
    stationId: station?.stationId,
    stationLabel: station?.stationLabel,
    measureFeet: station?.measureFeet,
    fromStationId: ["SEGMENT_RANGE", "STATION_RANGE", "SPINE_WIDE", "LIFECYCLE"].includes(projectionType) ? range.from.stationId : undefined,
    toStationId: ["SEGMENT_RANGE", "STATION_RANGE", "SPINE_WIDE", "LIFECYCLE"].includes(projectionType) ? range.to.stationId : undefined,
    fromStationLabel: ["SEGMENT_RANGE", "STATION_RANGE", "SPINE_WIDE", "LIFECYCLE"].includes(projectionType) ? range.from.stationLabel : undefined,
    toStationLabel: ["SEGMENT_RANGE", "STATION_RANGE", "SPINE_WIDE", "LIFECYCLE"].includes(projectionType) ? range.to.stationLabel : undefined,
    fromMeasureFeet: ["SEGMENT_RANGE", "STATION_RANGE", "SPINE_WIDE", "LIFECYCLE"].includes(projectionType) ? range.fromMeasureFeet : undefined,
    toMeasureFeet: ["SEGMENT_RANGE", "STATION_RANGE", "SPINE_WIDE", "LIFECYCLE"].includes(projectionType) ? range.toMeasureFeet : undefined,
    reviewObjectId,
    expectedQuantity: record.expectedQuantity,
    expectedCost: record.expectedCost,
    expectedScheduleImpact: record.scheduleImpact === "Included" ? 1 : undefined,
    closureRequired: ["SEGMENT_RANGE", "STATION_RANGE", "STATION_OBJECT"].includes(projectionType),
    reviewRequired: review,
    status: review ? "REVIEW_REQUIRED" : "PROJECTED",
  };
}

function complianceSummary(args: SpineAuditProjectionInput, projection: Omit<SpineAuditProjection, "summary">): AuditProjectionSummary {
  const warnings: string[] = [];
  const failures: string[] = [];
  const costBearingUnattached = projection.attachments.filter((attachment) => (
    attachment.costImpact === "Included" &&
    (!attachment.attachmentId || attachment.status === "UNATTACHED") &&
    attachment.status !== "EXCEPTED"
  ));
  if (costBearingUnattached.length) failures.push(`${costBearingUnattached.length} cost-bearing audit line(s) have no projection.`);
  if (!projection.attachments.length) failures.push("audit entries did not project");
  if (!projection.stationedExpectations.length) warnings.push("station-attached object expectations are not present");
  if (!projection.stationRangeExpectations.length) warnings.push("segment/range expectations are not present");
  if (!projection.closureExpectations.length) failures.push("closure expectations were not created");
  const unknownReviewCount = projection.spineReviewObjects.filter((object) => object.reviewType === "UNKNOWN_CONDITION").length;
  if (unknownReviewCount) warnings.push(`${unknownReviewCount} unknown review object(s) require review.`);
  return {
    projectionId: projection.projectionId,
    packageId: args.packageId,
    sourceEngine: "SpineAuditProjectionEngine",
    auditEntryCount: projection.attachments.length,
    projectedAttachmentCount: projection.attachments.filter((attachment) => attachment.status !== "UNATTACHED").length,
    stationedExpectationCount: projection.stationedExpectations.length,
    stationRangeExpectationCount: projection.stationRangeExpectations.length,
    spineReviewObjectCount: projection.spineReviewObjects.length,
    closureExpectationCount: projection.closureExpectations.length,
    costBearingUnattachedCount: costBearingUnattached.length,
    unknownReviewCount,
    confidenceReviewCount: projection.spineReviewObjects.filter((object) => object.reviewType === "CONFIDENCE_RISK").length,
    complianceStatus: failures.length ? "FAIL" : warnings.length ? "WARNING" : "PASS",
    warnings,
    failures,
    baselineFrozen: projection.baselineState === "FROZEN",
    generatedAt: projection.generatedAt,
    noScopeVersionCreation: true,
  };
}

export function createSpineAuditProjection(args: SpineAuditProjectionInput): SpineAuditProjection {
  const records = auditRecords(args);
  const generatedAt = args.generatedAt ?? new Date().toISOString();
  const { stationRecords, closureRecords: stationClosures } = stationObjectExpectations(args, records);
  const { rangeRecords, closureRecords: rangeClosures } = rangeExpectations(args, records);
  const reviewObjectRecords = reviewObjects(args, records);
  const reviewClosures = reviewObjectRecords.map((object): ClosureExpectation => ({
    closureExpectationId: `${object.reviewObjectId}:REVIEW`,
    packageId: args.packageId,
    expectationKind: "REVIEW_OBJECT",
    stationId: object.stationId,
    stationLabel: object.stationLabel,
    auditEntryIds: [object.auditEntryId],
    expectedWork: object.label,
    expectedQuantity: 1,
    quantityUnit: "review",
    requiredEvidence: ["review disposition"],
    closureRequired: false,
    reviewRequired: true,
    currentStatus: "NOT_STARTED",
  }));
  const projectionBase = {
    projectionId: `${args.packageId}:SPINE-AUDIT-PROJECTION`,
    packageId: args.packageId,
    measuredSpineId: args.measuredSpine.spineId,
    stationAuthorityId: args.stationAuthority.authorityId,
    geometryHash: args.measuredSpine.geometryHash,
    sourceEngine: "SpineAuditProjectionEngine" as const,
    sourceAuditEngines: Array.from(new Set(records.map((record) => record.sourceEngine))).sort(),
    generatedAt,
    authority: "SPINE_AUDIT_PROJECTION_AUTHORITY" as const,
    baselineState: args.baselineState ?? "LIVE" as const,
    attachments: records.map((record, index) => attachmentForRecord(args, record, index)),
    stationedExpectations: stationRecords,
    stationRangeExpectations: rangeRecords,
    spineReviewObjects: reviewObjectRecords,
    closureExpectations: [...stationClosures, ...rangeClosures, ...reviewClosures],
    noScopeVersionCreation: true as const,
  };
  const summary = complianceSummary(args, projectionBase);
  return {
    ...projectionBase,
    summary,
  };
}

export function freezeSpineAuditProjection(projection: SpineAuditProjection, frozenAt = new Date().toISOString()): SpineAuditProjection {
  return {
    ...projection,
    baselineState: "FROZEN",
    baselineFrozenAt: frozenAt,
    baselineProjectionId: projection.baselineProjectionId ?? projection.projectionId,
    attachments: projection.attachments.map((attachment) => ({ ...attachment, status: attachment.status === "PROJECTED" ? "FROZEN" : attachment.status })),
    summary: {
      ...projection.summary,
      baselineFrozen: true,
    },
  };
}

export function createSpineAuditProjectionRedlineDelta(args: {
  baseline: SpineAuditProjection;
  next: SpineAuditProjection;
  reason: string;
  actor: string;
  createdAt?: string;
}): SpineAuditProjectionRedlineDelta {
  const baselineByAudit = new Map(args.baseline.attachments.map((attachment) => [attachment.auditEntryId, JSON.stringify(attachment)]));
  const nextByAudit = new Map(args.next.attachments.map((attachment) => [attachment.auditEntryId, JSON.stringify(attachment)]));
  const addedAttachmentIds = args.next.attachments.filter((attachment) => !baselineByAudit.has(attachment.auditEntryId)).map((attachment) => attachment.attachmentId);
  const removedAttachmentIds = args.baseline.attachments.filter((attachment) => !nextByAudit.has(attachment.auditEntryId)).map((attachment) => attachment.attachmentId);
  const changedAttachmentIds = args.next.attachments
    .filter((attachment) => baselineByAudit.has(attachment.auditEntryId) && baselineByAudit.get(attachment.auditEntryId) !== JSON.stringify(attachment))
    .map((attachment) => attachment.attachmentId);
  return {
    deltaId: `${args.baseline.packageId}:SPINE-AUDIT-DELTA:${stableIdPart(args.reason)}:${Date.now()}`,
    packageId: args.baseline.packageId,
    baselineProjectionId: args.baseline.baselineProjectionId ?? args.baseline.projectionId,
    reason: args.reason,
    actor: args.actor,
    createdAt: args.createdAt ?? new Date().toISOString(),
    addedAttachmentIds,
    removedAttachmentIds,
    changedAttachmentIds,
    baselineFrozen: true,
    originalBaselineImmutable: true,
    noScopeVersionCreation: true,
  };
}

export function lookupStationExpectations(projection: SpineAuditProjection | null | undefined, stationIdOrLabel: string): StationExpectationLookup | null {
  if (!projection) return null;
  const stationExpectation = projection.stationedExpectations.find((expectation) => (
    expectation.stationId === stationIdOrLabel || expectation.stationLabel === stationIdOrLabel
  ));
  const rangeExpectation = projection.stationRangeExpectations.find((expectation) => (
    expectation.fromStationId === stationIdOrLabel ||
    expectation.toStationId === stationIdOrLabel ||
    expectation.fromStationLabel === stationIdOrLabel ||
    expectation.toStationLabel === stationIdOrLabel
  ));
  const reviewObject = projection.spineReviewObjects.find((object) => (
    object.stationId === stationIdOrLabel || object.stationLabel === stationIdOrLabel
  ));
  const stationId = stationExpectation?.stationId ?? reviewObject?.stationId ?? rangeExpectation?.fromStationId;
  const stationLabel = stationExpectation?.stationLabel ?? reviewObject?.stationLabel ?? rangeExpectation?.fromStationLabel;
  if (!stationId || !stationLabel) return null;
  const attachedObjects = projection.stationedExpectations.filter((expectation) => expectation.stationId === stationId || expectation.stationLabel === stationLabel);
  const rangeExpectationsForStation = projection.stationRangeExpectations.filter((expectation) => (
    expectation.fromStationId === stationId ||
    expectation.toStationId === stationId ||
    (expectation.fromMeasureFeet <= (stationExpectation?.measureFeet ?? reviewObject?.measureFeet ?? 0) && expectation.toMeasureFeet >= (stationExpectation?.measureFeet ?? reviewObject?.measureFeet ?? 0))
  ));
  const expectedWork = projection.closureExpectations.filter((expectation) => (
    expectation.stationId === stationId ||
    expectation.fromStationId === stationId ||
    expectation.toStationId === stationId ||
    attachedObjects.some((object) => object.objectId && object.objectId === expectation.objectId)
  ));
  const auditAttachments = projection.attachments.filter((attachment) => (
    attachment.stationId === stationId ||
    attachment.fromStationId === stationId ||
    attachment.toStationId === stationId ||
    expectedWork.some((work) => work.auditEntryIds.includes(attachment.auditEntryId))
  ));
  const reviewObjectsForStation = projection.spineReviewObjects.filter((object) => object.stationId === stationId || object.stationLabel === stationLabel);
  const measureFeet = stationExpectation?.measureFeet ?? reviewObject?.measureFeet ?? rangeExpectation?.fromMeasureFeet ?? 0;
  const coordinate = stationExpectation?.coordinate ?? reviewObject?.coordinate ?? [0, 0] as DALCoordinate;
  return {
    station: {
      stationId,
      stationLabel,
      measureFeet,
      stationFeet: measureFeet,
      stationIndex: 0,
      coordinate,
      lat: coordinate[1],
      lng: coordinate[0],
      segmentId: rangeExpectation?.spineSegmentIds[0] ?? "",
      spineId: projection.measuredSpineId,
      routeId: projection.packageId,
      packageId: projection.packageId,
      cumulativeMeasureFeet: measureFeet,
      stationClass: "ENGINEERING",
      authority: "STATION_AUTHORITY",
      geometryHash: projection.geometryHash,
    },
    attachedObjects,
    expectedWork,
    auditAttachments,
    reviewObjects: reviewObjectsForStation,
    rangeExpectations: rangeExpectationsForStation,
    closurePreview: expectedWork.map((work) => ({
      closureExpectationId: work.closureExpectationId,
      expectedWork: work.expectedWork,
      requiredEvidence: work.requiredEvidence,
      expectedQuantity: work.expectedQuantity,
      quantityUnit: work.quantityUnit,
      currentStatus: work.currentStatus,
    })),
  };
}
