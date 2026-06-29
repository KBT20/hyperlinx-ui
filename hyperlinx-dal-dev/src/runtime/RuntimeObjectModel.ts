import type {
  CustomerDesignImport,
  ImportedCustomerObject,
  ImportedCustomerPolygon,
  ImportedCustomerRoute,
} from "../translate/CustomerDesignImport";
import type { DALCoordinate, InventoryGraph, ValidationStatus } from "../types/dal";

export type RuntimeInventoryType = "CUSTOMER" | "CARRIER" | "TERALINX";

export type RuntimeAuthority =
  | "CUSTOMER_EVIDENCE"
  | "CARRIER_EVIDENCE"
  | "TERALINX_RUNTIME"
  | "COMMERCIAL_REVIEW"
  | "ENGINEERING_REVIEW";

export type RuntimeObjectType =
  | "ROUTE"
  | "SEGMENT"
  | "HANDHOLE"
  | "CONDUIT"
  | "POLE"
  | "POP"
  | "ILA"
  | "CROSSING"
  | "CUSTOMER_SITE"
  | "DATA_CENTER"
  | "POINT"
  | "POLYGON"
  | "UNKNOWN";

export type RuntimeRelationshipType =
  | "CONTAINS"
  | "TERMINATES_AT"
  | "SNAPPED_TO"
  | "EVIDENCED_BY"
  | "DERIVED_FROM"
  | "RELATED_TO";

export interface RuntimeEvidenceRecord {
  evidenceId: string;
  sourceType: string;
  sourceName: string;
  sourceSystem: string;
  authority: RuntimeAuthority;
  validationStatus: ValidationStatus | "PENDING";
  collectedAt: string;
  ingestedAt: string;
  lineage: {
    importId?: string;
    designId?: string;
    accountId?: string;
    customerName?: string;
    sourceFileName?: string;
    routeId?: string;
    objectId?: string;
    polygonId?: string;
  };
  metadata: Record<string, unknown>;
}

export interface RuntimeInventoryRecord {
  inventoryId: string;
  inventoryType: RuntimeInventoryType;
  owner: string;
  name: string;
  authority: RuntimeAuthority;
  version: number;
  status: "ACTIVE" | "SUPERSEDED" | "RETIRED";
  evidenceIds: string[];
  objectIds: string[];
  relationshipIds: string[];
  graphId?: string;
  sourceImportId?: string;
  createdAt: string;
  updatedAt: string;
  metadata: Record<string, unknown>;
}

export interface RuntimeObjectRecord {
  runtimeId: string;
  objectType: RuntimeObjectType;
  name: string;
  version: number;
  authority: RuntimeAuthority;
  evidenceIds: string[];
  relationshipIds: string[];
  coordinates?: DALCoordinate;
  geometry?: {
    type: "LineString" | "Polygon" | "Point";
    coordinates: DALCoordinate[] | DALCoordinate[][];
  };
  routeId?: string;
  stationFeet?: number;
  routeFeet?: number;
  routeMiles?: number;
  sourceId?: string;
  createdAt: string;
  updatedAt: string;
  metadata: Record<string, unknown>;
}

export interface RuntimeRelationshipRecord {
  relationshipId: string;
  relationshipType: RuntimeRelationshipType;
  fromRuntimeId: string;
  toRuntimeId: string;
  authority: RuntimeAuthority;
  version: number;
  evidenceIds: string[];
  createdAt: string;
  updatedAt: string;
  metadata: Record<string, unknown>;
}

export interface RuntimeValidationReport {
  validationId: string;
  status: ValidationStatus;
  checks: Array<{
    checkId: string;
    status: ValidationStatus;
    message: string;
    details?: Record<string, unknown>;
  }>;
  validatedAt: string;
  metadata: Record<string, unknown>;
}

export interface RuntimeHistoryEvent {
  historyId: string;
  eventType: string;
  actor: string;
  objectType: string;
  objectId: string;
  objectName?: string;
  timestamp: string;
  details?: string;
  metadata?: Record<string, unknown>;
}

export interface RuntimeConnectorRecord {
  connectorId: string;
  connectorType: "FILE" | "API" | "STREAM" | "MANUAL";
  name: string;
  status: "CONFIGURED" | "ACTIVE" | "DISABLED";
  authorityBoundary: "EVIDENCE_ONLY" | "READ_ONLY_RUNTIME" | "WRITE_REQUIRES_APPROVAL";
  supportedEvidenceTypes: string[];
  metadata: Record<string, unknown>;
}

export interface RuntimeTranslationCommitRequest {
  commitId: string;
  sourceWorkspace: "Translate";
  sourceImportId: string;
  actor: string;
  committedAt: string;
  evidence: RuntimeEvidenceRecord[];
  inventories: RuntimeInventoryRecord[];
  runtimeObjects: RuntimeObjectRecord[];
  relationships: RuntimeRelationshipRecord[];
  validationReports: RuntimeValidationReport[];
  history: RuntimeHistoryEvent[];
  connectors: RuntimeConnectorRecord[];
  metadata: Record<string, unknown>;
}

export interface RuntimeTranslationCommitResponse {
  commit: RuntimeTranslationCommitRequest & {
    status: "COMMITTED";
    evidenceIds: string[];
    inventoryIds: string[];
    runtimeObjectIds: string[];
    relationshipIds: string[];
    validationReportIds: string[];
    historyIds: string[];
    connectorIds?: string[];
  };
  counts: {
    evidence: number;
    inventories: number;
    runtimeObjects: number;
    relationships: number;
    validationReports: number;
    history: number;
    connectors?: number;
  };
}

function safePart(value: unknown) {
  return String(value ?? "UNKNOWN")
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "UNKNOWN";
}

export function runtimeId(prefix: string, ...parts: unknown[]) {
  return [prefix, ...parts.map(safePart)].join("-").toUpperCase();
}

function routeEvidenceId(record: CustomerDesignImport, route: ImportedCustomerRoute) {
  return runtimeId("EVIDENCE", record.importId, "ROUTE", route.routeId);
}

function objectEvidenceId(record: CustomerDesignImport, object: ImportedCustomerObject) {
  return runtimeId("EVIDENCE", record.importId, "OBJECT", object.objectId);
}

function polygonEvidenceId(record: CustomerDesignImport, polygon: ImportedCustomerPolygon) {
  return runtimeId("EVIDENCE", record.importId, "POLYGON", polygon.polygonId);
}

function mapCustomerObjectType(object: ImportedCustomerObject): RuntimeObjectType {
  if (object.objectType === "POP") return "POP";
  if (object.objectType === "ILA" || object.objectType === "REGEN") return "ILA";
  if (object.objectType === "HANDHOLE" || object.objectType === "VAULT") return "HANDHOLE";
  if (object.objectType === "CUSTOMER_SITE") return "CUSTOMER_SITE";
  if (object.objectType === "BUILDING") {
    return /data\s*center|dc\b/i.test(object.name) ? "DATA_CENTER" : "CUSTOMER_SITE";
  }
  return "POINT";
}

function sourceEvidence(record: CustomerDesignImport, timestamp: string): RuntimeEvidenceRecord {
  return {
    evidenceId: runtimeId("EVIDENCE", record.importId, "SOURCE"),
    sourceType: record.sourceType,
    sourceName: record.sourceFileName,
    sourceSystem: "Universal Translator",
    authority: "CUSTOMER_EVIDENCE",
    validationStatus: record.diagnostics.some((item) => item.severity === "ERROR") ? "FAIL" : "PASS",
    collectedAt: record.uploadedAt,
    ingestedAt: timestamp,
    lineage: {
      importId: record.importId,
      designId: record.designId,
      accountId: record.accountId,
      customerName: record.customerName,
      sourceFileName: record.sourceFileName,
    },
    metadata: {
      accountId: record.accountId,
      customerName: record.customerName,
      libraryPath: record.libraryPath,
      diagnostics: record.diagnostics.length,
      noScopeVersionCreation: record.noScopeVersionCreation,
      noInventoryMutation: record.noInventoryMutation,
    },
  };
}

function routeRuntimeObject(record: CustomerDesignImport, route: ImportedCustomerRoute, timestamp: string): RuntimeObjectRecord {
  const evidenceId = routeEvidenceId(record, route);
  return {
    runtimeId: runtimeId("RUNTIME-ROUTE", record.designId, route.routeId),
    objectType: "ROUTE",
    name: route.name,
    version: 1,
    authority: "CUSTOMER_EVIDENCE",
    evidenceIds: [evidenceId],
    relationshipIds: [],
    geometry: {
      type: "LineString",
      coordinates: route.dalGeometry,
    },
    routeId: route.routeId,
    routeFeet: route.routeFeet,
    routeMiles: route.routeMiles,
    sourceId: route.routeId,
    createdAt: timestamp,
    updatedAt: timestamp,
    metadata: {
      folderPath: route.folderPath,
      designState: route.designState,
      pricingEligible: route.pricingEligible,
      confidence: route.confidence,
      sourceStyle: route.sourceStyle,
    },
  };
}

function segmentRuntimeObject(record: CustomerDesignImport, route: ImportedCustomerRoute, timestamp: string): RuntimeObjectRecord {
  const evidenceId = routeEvidenceId(record, route);
  return {
    runtimeId: runtimeId("RUNTIME-SEGMENT", record.designId, route.routeId, "001"),
    objectType: "SEGMENT",
    name: `${route.name} Segment 001`,
    version: 1,
    authority: "CUSTOMER_EVIDENCE",
    evidenceIds: [evidenceId],
    relationshipIds: [],
    geometry: {
      type: "LineString",
      coordinates: route.dalGeometry,
    },
    routeId: route.routeId,
    routeFeet: route.routeFeet,
    routeMiles: route.routeMiles,
    sourceId: `${route.routeId}:001`,
    createdAt: timestamp,
    updatedAt: timestamp,
    metadata: {
      folderPath: route.folderPath,
      segmentIndex: 1,
      sourceRouteId: route.routeId,
    },
  };
}

function objectRuntimeObject(record: CustomerDesignImport, object: ImportedCustomerObject, timestamp: string): RuntimeObjectRecord {
  return {
    runtimeId: runtimeId("RUNTIME-OBJECT", record.designId, object.objectId),
    objectType: mapCustomerObjectType(object),
    name: object.name,
    version: 1,
    authority: "CUSTOMER_EVIDENCE",
    evidenceIds: [objectEvidenceId(record, object)],
    relationshipIds: [],
    coordinates: [object.longitude, object.latitude],
    routeId: object.nearestRouteId,
    stationFeet: object.nearestStationFeet,
    sourceId: object.objectId,
    createdAt: timestamp,
    updatedAt: timestamp,
    metadata: {
      sourceObjectType: object.objectType,
      folderPath: object.folderPath,
      confidence: object.confidence,
      sourceDescription: object.sourceDescription,
    },
  };
}

function polygonRuntimeObject(record: CustomerDesignImport, polygon: ImportedCustomerPolygon, timestamp: string): RuntimeObjectRecord {
  const isCrossing = /crossing|rail|river|highway|road|bridge/i.test(polygon.name);
  return {
    runtimeId: runtimeId("RUNTIME-POLYGON", record.designId, polygon.polygonId),
    objectType: isCrossing ? "CROSSING" : "POLYGON",
    name: polygon.name,
    version: 1,
    authority: "CUSTOMER_EVIDENCE",
    evidenceIds: [polygonEvidenceId(record, polygon)],
    relationshipIds: [],
    geometry: {
      type: "Polygon",
      coordinates: polygon.rings,
    },
    sourceId: polygon.polygonId,
    createdAt: timestamp,
    updatedAt: timestamp,
    metadata: {
      folderPath: polygon.folderPath,
      confidence: polygon.confidence,
      sourceStyle: polygon.sourceStyle,
      sourceDescription: polygon.sourceDescription,
    },
  };
}

function relationship(
  type: RuntimeRelationshipType,
  fromRuntimeId: string,
  toRuntimeId: string,
  evidenceIds: string[],
  timestamp: string,
  metadata: Record<string, unknown> = {},
): RuntimeRelationshipRecord {
  return {
    relationshipId: runtimeId("RUNTIME-REL", type, fromRuntimeId, toRuntimeId),
    relationshipType: type,
    fromRuntimeId,
    toRuntimeId,
    authority: "CUSTOMER_EVIDENCE",
    version: 1,
    evidenceIds,
    createdAt: timestamp,
    updatedAt: timestamp,
    metadata,
  };
}

function validationStatus(checks: RuntimeValidationReport["checks"]): ValidationStatus {
  if (checks.some((check) => check.status === "FAIL")) return "FAIL";
  if (checks.some((check) => check.status === "WARNING")) return "WARNING";
  return "PASS";
}

export function buildRuntimeCommitFromCustomerDesign(
  record: CustomerDesignImport,
  graph: InventoryGraph | null | undefined,
  actor = record.uploadedBy || "Teralinx",
): RuntimeTranslationCommitRequest {
  const timestamp = new Date().toISOString();
  const commitId = runtimeId("RUNTIME-COMMIT", record.importId);
  const sourceEvidenceRecord = sourceEvidence(record, timestamp);
  const routeEvidence = record.routes.map((route) => ({
    ...sourceEvidenceRecord,
    evidenceId: routeEvidenceId(record, route),
    sourceName: route.name,
    lineage: { ...sourceEvidenceRecord.lineage, routeId: route.routeId },
    metadata: {
      ...sourceEvidenceRecord.metadata,
      folderPath: route.folderPath,
      routeFeet: route.routeFeet,
      routeMiles: route.routeMiles,
      designState: route.designState,
      sourceDescription: route.sourceDescription,
    },
  }));
  const objectEvidence = record.objects.map((object) => ({
    ...sourceEvidenceRecord,
    evidenceId: objectEvidenceId(record, object),
    sourceName: object.name,
    lineage: { ...sourceEvidenceRecord.lineage, objectId: object.objectId },
    metadata: {
      ...sourceEvidenceRecord.metadata,
      folderPath: object.folderPath,
      objectType: object.objectType,
      nearestRouteId: object.nearestRouteId,
      nearestStationFeet: object.nearestStationFeet,
    },
  }));
  const polygonEvidence = record.polygons.map((polygon) => ({
    ...sourceEvidenceRecord,
    evidenceId: polygonEvidenceId(record, polygon),
    sourceName: polygon.name,
    lineage: { ...sourceEvidenceRecord.lineage, polygonId: polygon.polygonId },
    metadata: {
      ...sourceEvidenceRecord.metadata,
      folderPath: polygon.folderPath,
      rings: polygon.rings.length,
    },
  }));
  const evidence = [sourceEvidenceRecord, ...routeEvidence, ...objectEvidence, ...polygonEvidence];

  const routeObjects = record.routes.map((route) => routeRuntimeObject(record, route, timestamp));
  const segmentObjects = record.routes.map((route) => segmentRuntimeObject(record, route, timestamp));
  const customerObjects = record.objects.map((object) => objectRuntimeObject(record, object, timestamp));
  const polygonObjects = record.polygons.map((polygon) => polygonRuntimeObject(record, polygon, timestamp));
  const runtimeObjects = [...routeObjects, ...segmentObjects, ...customerObjects, ...polygonObjects];

  const inventoryId = runtimeId("RUNTIME-INVENTORY-CUSTOMER", record.designId);
  const relationships: RuntimeRelationshipRecord[] = [];
  for (const object of runtimeObjects) {
    relationships.push(relationship("CONTAINS", inventoryId, object.runtimeId, object.evidenceIds, timestamp));
  }
  for (const route of record.routes) {
    const routeId = runtimeId("RUNTIME-ROUTE", record.designId, route.routeId);
    const segmentId = runtimeId("RUNTIME-SEGMENT", record.designId, route.routeId, "001");
    relationships.push(relationship("CONTAINS", routeId, segmentId, [routeEvidenceId(record, route)], timestamp));
  }
  for (const object of record.objects) {
    if (!object.nearestRouteId) continue;
    relationships.push(
      relationship(
        "SNAPPED_TO",
        runtimeId("RUNTIME-OBJECT", record.designId, object.objectId),
        runtimeId("RUNTIME-ROUTE", record.designId, object.nearestRouteId),
        [objectEvidenceId(record, object)],
        timestamp,
        { stationFeet: object.nearestStationFeet },
      ),
    );
  }

  const objectIds = runtimeObjects.map((object) => object.runtimeId);
  const relationshipIds = relationships.map((item) => item.relationshipId);
  const inventories: RuntimeInventoryRecord[] = [{
    inventoryId,
    inventoryType: "CUSTOMER",
    owner: record.customerName,
    name: `${record.customerName} Customer Inventory`,
    authority: "CUSTOMER_EVIDENCE",
    version: 1,
    status: "ACTIVE",
    evidenceIds: evidence.map((item) => item.evidenceId),
    objectIds,
    relationshipIds,
    graphId: graph?.graphId ?? record.graphId,
    sourceImportId: record.importId,
    createdAt: timestamp,
    updatedAt: timestamp,
    metadata: {
      designId: record.designId,
      accountId: record.accountId,
      customerName: record.customerName,
      sourceFileName: record.sourceFileName,
      sourceType: record.sourceType,
      routeCount: record.routes.length,
      objectCount: record.objects.length,
      polygonCount: record.polygons.length,
      graphInventoryId: graph?.inventoryId ?? record.inventoryGraphId,
    },
  }];

  const relationshipTargets = new Set(runtimeObjects.map((object) => object.runtimeId));
  relationshipTargets.add(inventoryId);
  const checks: RuntimeValidationReport["checks"] = [
    {
      checkId: "EVIDENCE_REGISTERED",
      status: evidence.length > 0 ? "PASS" : "FAIL",
      message: "Every translation commit starts from registered evidence.",
      details: { evidenceCount: evidence.length },
    },
    {
      checkId: "RUNTIME_OBJECTS_CREATED",
      status: runtimeObjects.length > 0 ? "PASS" : "WARNING",
      message: "Customer design evidence normalized into runtime objects.",
      details: { objectCount: runtimeObjects.length },
    },
    {
      checkId: "RELATIONSHIP_REFERENCES_VALID",
      status: relationships.every((item) => relationshipTargets.has(item.fromRuntimeId) && relationshipTargets.has(item.toRuntimeId)) ? "PASS" : "FAIL",
      message: "Runtime relationships reference registered runtime IDs.",
      details: { relationshipCount: relationships.length },
    },
    {
      checkId: "AUTHORITY_CONTAINED",
      status: record.noScopeVersionCreation && record.noInventoryMutation && record.noCertifiedRouteAuthority ? "PASS" : "FAIL",
      message: "Translator commit does not create ScopeVersion, certified route, or production inventory authority.",
      details: {
        noScopeVersionCreation: record.noScopeVersionCreation,
        noInventoryMutation: record.noInventoryMutation,
        noCertifiedRouteAuthority: record.noCertifiedRouteAuthority,
      },
    },
  ];

  return {
    commitId,
    sourceWorkspace: "Translate",
    sourceImportId: record.importId,
    actor,
    committedAt: timestamp,
    evidence,
    inventories,
    runtimeObjects,
    relationships,
    validationReports: [{
      validationId: runtimeId("RUNTIME-VALIDATION", commitId),
      status: validationStatus(checks),
      checks,
      validatedAt: timestamp,
      metadata: {
        importId: record.importId,
        designId: record.designId,
        sourceFileName: record.sourceFileName,
      },
    }],
    history: [{
      historyId: runtimeId("RUNTIME-HISTORY", commitId, "PREPARED"),
      eventType: "runtime.translation.prepared",
      actor,
      objectType: "CustomerDesignImport",
      objectId: record.importId,
      objectName: record.sourceFileName,
      timestamp,
      details: "Customer design evidence prepared for shared runtime commit.",
      metadata: {
        designId: record.designId,
        inventoryId,
      },
    }],
    connectors: [{
      connectorId: runtimeId("CONNECTOR", record.sourceType, "CUSTOMER-EVIDENCE"),
      connectorType: record.sourceType === "API" ? "API" : "FILE",
      name: `${record.sourceType} Customer Evidence Connector`,
      status: "ACTIVE",
      authorityBoundary: "EVIDENCE_ONLY",
      supportedEvidenceTypes: [record.sourceType],
      metadata: {
        sourceWorkspace: "Translate",
        customerName: record.customerName,
        accountId: record.accountId,
      },
    }],
    metadata: {
      designId: record.designId,
      customerName: record.customerName,
      sourceFileName: record.sourceFileName,
      activeRouteId: record.activeRouteId,
      graphId: graph?.graphId ?? record.graphId,
    },
  };
}
