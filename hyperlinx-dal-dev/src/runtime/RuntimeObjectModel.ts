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

export type RuntimeVisibility = "PRIVATE" | "SHARED" | "ORGANIZATION" | "PUBLIC";

export type RuntimeLifecycleState =
  | "DRAFT"
  | "ACTIVE"
  | "IN_REVIEW"
  | "APPROVED"
  | "ACCEPTED"
  | "ARCHIVED"
  | "SUPERSEDED"
  | "RETIRED";

export type RuntimeObjectType =
  | "DESIGN_REQUEST"
  | "PROPOSED_ROUTE"
  | "PROPOSED_SEGMENT"
  | "OPPORTUNITY"
  | "PROPOSAL"
  | "ENGINEERING"
  | "SCOPE_VERSION"
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
  organization: string;
  organizationId?: string;
  workspace: string;
  workspaceId?: string;
  visibility: RuntimeVisibility;
  authority: RuntimeAuthority;
  lifecycleState: RuntimeLifecycleState;
  customer?: string;
  customerId?: string;
  source?: string;
  sourceType?: string;
  sourceFilename?: string;
  inventoryAuthorityType?: string;
  ownerUserId?: string;
  validationStatus?: string;
  runtimeObjectIds?: string[];
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
  objectId: string;
  objectType: RuntimeObjectType;
  name: string;
  owner: string;
  createdBy: string;
  assignedTo: string[];
  organization: string;
  workspace: string;
  inventoryId?: string;
  inventoryAuthorityType?: string;
  sourceType?: string;
  sourceFilename?: string;
  customerId?: string;
  organizationId?: string;
  workspaceId?: string;
  ownerUserId?: string;
  validationStatus?: string;
  runtimeObjectIds?: string[];
  designImportId?: string;
  requestedBy?: string;
  designIntent?: string;
  scopeVersionId?: string;
  proposedGeometry?: DALCoordinate[];
  scopeVersion?: string;
  customer?: string;
  source?: string;
  classification?: string;
  confidence?: number;
  visibility: RuntimeVisibility;
  version: number;
  authority: RuntimeAuthority;
  lifecycleState: RuntimeLifecycleState;
  evidenceIds: string[];
  evidenceLinks: string[];
  relationshipIds: string[];
  relationshipLinks: string[];
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
  sourceWorkspace: "Translate" | "CommercialPlanning" | "CustomerDesignRequest";
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

function runtimeGovernance(record: CustomerDesignImport) {
  return {
    owner: (record as any).owner ?? record.customerName ?? "Teralinx",
    createdBy: record.uploadedBy ?? (record as any).createdBy ?? "Teralinx",
    assignedTo: [] as string[],
    organization: (record as any).organizationId ?? "org-teralinx",
    workspace: (record as any).workspaceId ?? "workspace-teralinx-system",
    scopeVersion: "NO_SCOPEVERSION",
    customer: record.customerName,
    source: record.sourceFileName,
    visibility: "ORGANIZATION" as RuntimeVisibility,
    lifecycleState: "ACTIVE" as RuntimeLifecycleState,
  };
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
  const runtimeObjectId = runtimeId("RUNTIME-ROUTE", record.designId, route.routeId);
  return {
    runtimeId: runtimeObjectId,
    objectId: runtimeObjectId,
    objectType: "ROUTE",
    name: route.name,
    ...runtimeGovernance(record),
    classification: route.designState,
    confidence: route.confidence,
    version: 1,
    authority: "CUSTOMER_EVIDENCE",
    evidenceIds: [evidenceId],
    evidenceLinks: [evidenceId],
    relationshipIds: [],
    relationshipLinks: [],
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
  const runtimeObjectId = runtimeId("RUNTIME-SEGMENT", record.designId, route.routeId, "001");
  return {
    runtimeId: runtimeObjectId,
    objectId: runtimeObjectId,
    objectType: "SEGMENT",
    name: `${route.name} Segment 001`,
    ...runtimeGovernance(record),
    classification: "SEGMENT",
    confidence: route.confidence,
    version: 1,
    authority: "CUSTOMER_EVIDENCE",
    evidenceIds: [evidenceId],
    evidenceLinks: [evidenceId],
    relationshipIds: [],
    relationshipLinks: [],
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
  const runtimeObjectId = runtimeId("RUNTIME-OBJECT", record.designId, object.objectId);
  const evidenceId = objectEvidenceId(record, object);
  return {
    runtimeId: runtimeObjectId,
    objectId: runtimeObjectId,
    objectType: mapCustomerObjectType(object),
    name: object.name,
    ...runtimeGovernance(record),
    classification: object.objectType,
    confidence: object.confidence,
    version: 1,
    authority: "CUSTOMER_EVIDENCE",
    evidenceIds: [evidenceId],
    evidenceLinks: [evidenceId],
    relationshipIds: [],
    relationshipLinks: [],
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
  const runtimeObjectId = runtimeId("RUNTIME-POLYGON", record.designId, polygon.polygonId);
  const evidenceId = polygonEvidenceId(record, polygon);
  return {
    runtimeId: runtimeObjectId,
    objectId: runtimeObjectId,
    objectType: isCrossing ? "CROSSING" : "POLYGON",
    name: polygon.name,
    ...runtimeGovernance(record),
    classification: isCrossing ? "CROSSING" : "POLYGON",
    confidence: polygon.confidence,
    version: 1,
    authority: "CUSTOMER_EVIDENCE",
    evidenceIds: [evidenceId],
    evidenceLinks: [evidenceId],
    relationshipIds: [],
    relationshipLinks: [],
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

function runtimeEvidenceForRecord(record: CustomerDesignImport, timestamp: string) {
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
  return [sourceEvidenceRecord, ...routeEvidence, ...objectEvidence, ...polygonEvidence];
}

function parsedRuntimeObjects(record: CustomerDesignImport, timestamp: string) {
  const routeObjects = record.routes.map((route) => routeRuntimeObject(record, route, timestamp));
  const segmentObjects = record.routes.map((route) => segmentRuntimeObject(record, route, timestamp));
  const customerObjects = record.objects.map((object) => objectRuntimeObject(record, object, timestamp));
  const polygonObjects = record.polygons.map((polygon) => polygonRuntimeObject(record, polygon, timestamp));
  return { routeObjects, segmentObjects, customerObjects, polygonObjects };
}

function attachRelationshipLinks(runtimeObjects: RuntimeObjectRecord[], relationships: RuntimeRelationshipRecord[]) {
  for (const object of runtimeObjects) {
    const linkedRelationships = relationships
      .filter((item) => item.fromRuntimeId === object.runtimeId || item.toRuntimeId === object.runtimeId)
      .map((item) => item.relationshipId);
    object.relationshipIds = linkedRelationships;
    object.relationshipLinks = linkedRelationships;
  }
}

function activeDesignRoute(record: CustomerDesignImport) {
  const activeRouteId = record.activeRouteId ?? record.routes[0]?.routeId ?? "";
  return record.routes.find((route) => route.routeId === activeRouteId) ?? record.routes[0];
}

function proposedGeometryForRecord(record: CustomerDesignImport) {
  const route = activeDesignRoute(record);
  return record.proposedGeometry?.length
    ? record.proposedGeometry
    : route?.dalGeometry?.length
      ? route.dalGeometry
      : record.previewGeometry ?? [];
}

function ownerUserIdForRecord(record: CustomerDesignImport) {
  return String((record as any).ownerUserId ?? (record as any).createdById ?? record.uploadedBy ?? "teralinx-system");
}

function inventoryAuthorityFields(record: CustomerDesignImport, inventoryId: string, validationStatus: string, runtimeObjectIds: string[]) {
  const governance = runtimeGovernance(record);
  return {
    inventoryId,
    inventoryAuthorityType: "EXISTING_CUSTOMER_INVENTORY",
    sourceType: record.sourceType,
    sourceFilename: record.sourceFileName,
    customerId: record.accountId,
    organizationId: governance.organization,
    workspaceId: governance.workspace,
    ownerUserId: ownerUserIdForRecord(record),
    classification: "EXISTING_INVENTORY",
    validationStatus,
    runtimeObjectIds,
  };
}

function designRequestFields(record: CustomerDesignImport) {
  const governance = runtimeGovernance(record);
  const scopeVersionId = record.scopeVersionId ?? runtimeId("SV-CDR", record.designId);
  return {
    designImportId: record.designImportId ?? record.importId,
    customerId: record.accountId,
    sourceType: record.sourceType,
    sourceFilename: record.sourceFileName,
    requestedBy: record.uploadedBy,
    organizationId: governance.organization,
    workspaceId: governance.workspace,
    designIntent: record.designIntent ?? "CUSTOMER_DESIGN_REQUEST",
    scopeVersionId,
    scopeVersion: scopeVersionId,
    proposedGeometry: proposedGeometryForRecord(record),
  };
}

export function buildRuntimeCommitFromExistingInventoryImport(
  record: CustomerDesignImport,
  graph: InventoryGraph | null | undefined,
  actor = record.uploadedBy || "Teralinx",
): RuntimeTranslationCommitRequest {
  const timestamp = new Date().toISOString();
  const commitId = runtimeId("RUNTIME-COMMIT-INVENTORY", record.importId);
  const evidence = runtimeEvidenceForRecord(record, timestamp);
  const { routeObjects, segmentObjects, customerObjects, polygonObjects } = parsedRuntimeObjects(record, timestamp);
  const runtimeObjects = [...routeObjects, ...segmentObjects, ...customerObjects, ...polygonObjects];

  const inventoryId = runtimeId("RUNTIME-INVENTORY-CUSTOMER", record.designId);
  const validationState = record.diagnostics.some((item) => item.severity === "ERROR") ? "FAIL" : "PASS";
  const objectIds = runtimeObjects.map((object) => object.runtimeId);
  const authorityFields = inventoryAuthorityFields(record, inventoryId, validationState, objectIds);
  runtimeObjects.forEach((object) => {
    Object.assign(object, authorityFields, {
      classification: object.classification ?? authorityFields.classification,
      metadata: {
        ...object.metadata,
        lane: "EXISTING_INVENTORY",
        inventoryId,
        inventoryAuthorityType: authorityFields.inventoryAuthorityType,
        sourceType: record.sourceType,
        sourceFilename: record.sourceFileName,
        customerId: record.accountId,
      },
    });
  });

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
  attachRelationshipLinks(runtimeObjects, relationships);

  const relationshipIds = relationships.map((item) => item.relationshipId);
  const inventoryGovernance = runtimeGovernance(record);
  const inventories: RuntimeInventoryRecord[] = [{
    inventoryId,
    inventoryType: "CUSTOMER",
    owner: record.customerName,
    name: `${record.customerName} Customer Inventory`,
    organization: inventoryGovernance.organization,
    organizationId: inventoryGovernance.organization,
    workspace: inventoryGovernance.workspace,
    workspaceId: inventoryGovernance.workspace,
    visibility: "ORGANIZATION",
    authority: "CUSTOMER_EVIDENCE",
    lifecycleState: "ACTIVE",
    customer: record.customerName,
    customerId: record.accountId,
    source: record.sourceFileName,
    sourceType: record.sourceType,
    sourceFilename: record.sourceFileName,
    inventoryAuthorityType: "EXISTING_CUSTOMER_INVENTORY",
    ownerUserId: ownerUserIdForRecord(record),
    validationStatus: validationState,
    runtimeObjectIds: objectIds,
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
      lane: "EXISTING_INVENTORY",
      inventoryAuthorityType: "EXISTING_CUSTOMER_INVENTORY",
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
      message: "Existing Inventory evidence normalized into Customer Twin runtime objects.",
      details: { objectCount: runtimeObjects.length },
    },
    {
      checkId: "RELATIONSHIP_REFERENCES_VALID",
      status: relationships.every((item) => relationshipTargets.has(item.fromRuntimeId) && relationshipTargets.has(item.toRuntimeId)) ? "PASS" : "FAIL",
      message: "Runtime relationships reference registered runtime IDs.",
      details: { relationshipCount: relationships.length },
    },
    {
      checkId: "EXISTING_INVENTORY_LANE",
      status: inventories.length > 0 && runtimeObjects.every((object) => object.inventoryId === inventoryId) ? "PASS" : "FAIL",
      message: "Existing Inventory commits create Runtime Inventory and Customer Twin source objects.",
      details: {
        inventoryId,
        runtimeObjectCount: runtimeObjects.length,
      },
    },
  ];

  return {
    commitId,
    sourceWorkspace: "CommercialPlanning",
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
      details: "Existing Inventory evidence prepared for Customer Twin runtime authority.",
      metadata: {
        lane: "EXISTING_INVENTORY",
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
        sourceWorkspace: "CommercialPlanning",
        lane: "EXISTING_INVENTORY",
        customerName: record.customerName,
        accountId: record.accountId,
      },
    }],
    metadata: {
      designId: record.designId,
      lane: "EXISTING_INVENTORY",
      customerName: record.customerName,
      sourceFileName: record.sourceFileName,
      activeRouteId: record.activeRouteId,
      graphId: graph?.graphId ?? record.graphId,
    },
  };
}

export function buildRuntimeCommitFromCustomerDesign(
  record: CustomerDesignImport,
  _graph: InventoryGraph | null | undefined,
  actor = record.uploadedBy || "Teralinx",
): RuntimeTranslationCommitRequest {
  const timestamp = new Date().toISOString();
  const commitId = runtimeId("RUNTIME-COMMIT-DESIGN-REQUEST", record.importId);
  const evidence = runtimeEvidenceForRecord(record, timestamp);
  const { routeObjects, segmentObjects, customerObjects, polygonObjects } = parsedRuntimeObjects(record, timestamp);
  const fields = designRequestFields(record);
  const designRequestId = runtimeId("RUNTIME-DESIGN-REQUEST", record.designImportId ?? record.importId);
  const governance = runtimeGovernance(record);
  const designRequestObject: RuntimeObjectRecord = {
    runtimeId: designRequestId,
    objectId: designRequestId,
    objectType: "DESIGN_REQUEST",
    name: `${record.customerName} Design Request`,
    ...governance,
    ...fields,
    visibility: "SHARED",
    classification: "CUSTOMER_DESIGN_REQUEST",
    confidence: Math.max(60, Math.round(record.provenance?.parseConfidence ?? 72)),
    version: 1,
    authority: "CUSTOMER_EVIDENCE",
    lifecycleState: "DRAFT",
    evidenceIds: evidence.map((item) => item.evidenceId),
    evidenceLinks: evidence.map((item) => item.evidenceId),
    relationshipIds: [],
    relationshipLinks: [],
    geometry: fields.proposedGeometry.length ? { type: "LineString", coordinates: fields.proposedGeometry } : undefined,
    sourceId: record.importId,
    createdAt: timestamp,
    updatedAt: timestamp,
    metadata: {
      lane: "CUSTOMER_DESIGN_REQUEST",
      designId: record.designId,
      designImportId: fields.designImportId,
      scopeVersionId: fields.scopeVersionId,
      sourceType: record.sourceType,
      sourceFilename: record.sourceFileName,
      customerId: record.accountId,
      routeCount: record.routes.length,
      objectCount: record.objects.length,
      polygonCount: record.polygons.length,
    },
  };

  const proposedObjects = [...routeObjects, ...segmentObjects, ...customerObjects, ...polygonObjects].map((object) => {
    const nextType = object.objectType === "ROUTE"
      ? "PROPOSED_ROUTE"
      : object.objectType === "SEGMENT"
        ? "PROPOSED_SEGMENT"
        : object.objectType;
    return {
      ...object,
      objectType: nextType,
      ...fields,
      visibility: "SHARED" as RuntimeVisibility,
      lifecycleState: "DRAFT" as RuntimeLifecycleState,
      classification: object.classification ?? "CUSTOMER_DESIGN_REQUEST",
      metadata: {
        ...object.metadata,
        lane: "CUSTOMER_DESIGN_REQUEST",
        designImportId: fields.designImportId,
        scopeVersionId: fields.scopeVersionId,
        sourceType: record.sourceType,
        sourceFilename: record.sourceFileName,
        customerId: record.accountId,
      },
    } as RuntimeObjectRecord;
  });
  const runtimeObjects = [designRequestObject, ...proposedObjects];

  const relationships: RuntimeRelationshipRecord[] = [];
  for (const object of proposedObjects) {
    relationships.push(relationship("CONTAINS", designRequestId, object.runtimeId, object.evidenceIds, timestamp, { lane: "CUSTOMER_DESIGN_REQUEST" }));
  }
  for (const route of record.routes) {
    const routeId = runtimeId("RUNTIME-ROUTE", record.designId, route.routeId);
    const segmentId = runtimeId("RUNTIME-SEGMENT", record.designId, route.routeId, "001");
    relationships.push(relationship("CONTAINS", routeId, segmentId, [routeEvidenceId(record, route)], timestamp, { lane: "CUSTOMER_DESIGN_REQUEST" }));
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
        { lane: "CUSTOMER_DESIGN_REQUEST", stationFeet: object.nearestStationFeet },
      ),
    );
  }
  attachRelationshipLinks(runtimeObjects, relationships);

  const relationshipTargets = new Set(runtimeObjects.map((object) => object.runtimeId));
  const checks: RuntimeValidationReport["checks"] = [
    {
      checkId: "EVIDENCE_REGISTERED",
      status: evidence.length > 0 ? "PASS" : "FAIL",
      message: "Every customer design request starts from raw evidence.",
      details: { evidenceCount: evidence.length },
    },
    {
      checkId: "DESIGN_REQUEST_OBJECT_CREATED",
      status: runtimeObjects.some((object) => object.objectType === "DESIGN_REQUEST") ? "PASS" : "FAIL",
      message: "Customer Design Request creates design intent, not Existing Inventory.",
      details: { designRequestId, scopeVersionId: fields.scopeVersionId },
    },
    {
      checkId: "SCOPEVERSION_REFERENCE_PRESENT",
      status: fields.scopeVersionId ? "PASS" : "FAIL",
      message: "Customer Design Request carries a candidate ScopeVersion reference.",
      details: { scopeVersionId: fields.scopeVersionId },
    },
    {
      checkId: "RELATIONSHIP_REFERENCES_VALID",
      status: relationships.every((item) => relationshipTargets.has(item.fromRuntimeId) && relationshipTargets.has(item.toRuntimeId)) ? "PASS" : "FAIL",
      message: "Runtime relationships reference registered design request runtime IDs.",
      details: { relationshipCount: relationships.length },
    },
    {
      checkId: "NO_EXISTING_INVENTORY_MUTATION",
      status: "PASS",
      message: "Customer Design Request commits do not create Runtime Inventory or Customer Twin source data.",
      details: { inventoryCount: 0 },
    },
  ];

  return {
    commitId,
    sourceWorkspace: "CustomerDesignRequest",
    sourceImportId: record.importId,
    actor,
    committedAt: timestamp,
    evidence,
    inventories: [],
    runtimeObjects,
    relationships,
    validationReports: [{
      validationId: runtimeId("RUNTIME-VALIDATION", commitId),
      status: validationStatus(checks),
      checks,
      validatedAt: timestamp,
      metadata: {
        lane: "CUSTOMER_DESIGN_REQUEST",
        importId: record.importId,
        designId: record.designId,
        scopeVersionId: fields.scopeVersionId,
        sourceFileName: record.sourceFileName,
      },
    }],
    history: [{
      historyId: runtimeId("RUNTIME-HISTORY", commitId, "PREPARED"),
      eventType: "runtime.customer_design_request.prepared",
      actor,
      objectType: "CustomerDesignRequest",
      objectId: record.importId,
      objectName: record.sourceFileName,
      timestamp,
      details: "Customer Design Request evidence prepared as design intent with candidate ScopeVersion.",
      metadata: {
        lane: "CUSTOMER_DESIGN_REQUEST",
        designId: record.designId,
        designImportId: fields.designImportId,
        scopeVersionId: fields.scopeVersionId,
      },
    }],
    connectors: [{
      connectorId: runtimeId("CONNECTOR", record.sourceType, "CUSTOMER-DESIGN-REQUEST"),
      connectorType: record.sourceType === "API" ? "API" : "FILE",
      name: `${record.sourceType} Customer Design Request Connector`,
      status: "ACTIVE",
      authorityBoundary: "EVIDENCE_ONLY",
      supportedEvidenceTypes: [record.sourceType],
      metadata: {
        sourceWorkspace: "CustomerDesignRequest",
        lane: "CUSTOMER_DESIGN_REQUEST",
        customerName: record.customerName,
        accountId: record.accountId,
      },
    }],
    metadata: {
      lane: "CUSTOMER_DESIGN_REQUEST",
      designId: record.designId,
      designImportId: fields.designImportId,
      customerName: record.customerName,
      sourceFileName: record.sourceFileName,
      activeRouteId: record.activeRouteId,
      scopeVersionId: fields.scopeVersionId,
    },
  };
}
