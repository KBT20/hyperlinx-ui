import type {
  DraftIofPackageRuntime,
  IofPackageDependencyGraph,
  IofPackageDifferences,
  IofPackageManifest,
  IofPackageManifestEntry,
  IofPackageValidation,
  ProposalRuntimeObject,
  ProposedIofUnit,
} from "../api/teralinxRuntime";
import type { CommercialCorridorDraft, CommercialCorridorSegment } from "./CommercialCorridorDraftEngine";
import type { OpportunityQuickQuote } from "./OpportunityScoutEngine";
import type { ProductDoctrine, ProductDoctrineAssembly } from "../products/ProductDoctrineContracts";
import { instantiateDoctrineObjects } from "../products/DoctrineObjectInstantiationEngine";
import { projectDoctrineToStationSpine } from "../products/DoctrineProjectionEngine";
import { createObjectAddressing } from "../doctrine/pd002/addressing/PD002AObjectAddressingEngine";
import { createPD003ProductionArtifacts } from "../doctrine/pd003/ProductionProfileEngine";
import { buildKernelExecutionGraph } from "../kernel/ExecutionGraphBuilder";
import { buildSpineObjectCatalog } from "../spine/catalog/SpineObjectCatalogEngine";
import { instantiateSpineObjects } from "../spine/instantiation/SpineObjectInstantiationEngine";
import { createAuditObjectManifest } from "../spine/manifest/AuditObjectManifestEngine";
import { createMeasuredSpine } from "../spine/MeasuredSpineEngine";
import { createObjectStationAttachments } from "../spine/ObjectStationAttachmentEngine";
import { createStationAuthority, ENGINEERING_STATION_INTERVAL_FEET } from "../spine/StationAuthorityEngine";
import { createStationIndexedGraph } from "../spine/StationIndexedGraphEngine";
import { createSpineAuditProjection } from "../spine/SpineAuditProjectionEngine";
import type { SpineSiteReference } from "../spine/SpineAuthorityContracts";

type JsonObject = Record<string, unknown>;
type ValidationTuple = [string, boolean];
type ValidationInput = ValidationTuple | { label?: string; key?: string; passed?: boolean; status?: string };

export type IOFPackageAssemblyInput = {
  proposal: Partial<ProposalRuntimeObject> & {
    proposalId: string;
    customerId: string;
    opportunityId?: string;
  };
  customerName?: string;
  accountId?: string;
  commercialCandidate?: JsonObject | null;
  commercialDraft?: CommercialCorridorDraft | null;
  quickQuote?: OpportunityQuickQuote | null;
  designArtifacts?: unknown[];
  graph?: unknown;
  stationing?: unknown[];
  objectInventory?: unknown[];
  pricing?: unknown;
  validation?: ValidationInput[];
  productDoctrine?: ProductDoctrine | null;
  productDoctrineAssembly?: ProductDoctrineAssembly | null;
  selectedRoutePlans?: unknown[];
  assignedEngineerId?: string;
  assignedEngineer?: string;
  priority?: string;
  generatedAt?: string;
  ownerId?: string;
  owner?: string;
  organizationId?: string;
  workspaceId?: string;
  runtimeObjectIds?: string[];
  runtimeRelationshipIds?: string[];
  runtimeEvidenceIds?: string[];
  existingInventoryReferences?: string[];
  customerDesignReferences?: string[];
  customerTwinReference?: string;
  geometryReferences?: string[];
  /** Existing immutable authorities used by the structural cache instead of rehashing full runtime mirrors. */
  routeGeometryHash?: string;
  stationAuthorityRevision?: string;
  objectInventoryAuthorityRevision?: string;
  commercialRevisionId?: string;
  revisionId?: string;
  commercialRevisionHash?: string;
  commercialRepositoryId?: string;
  commercialReleasePackageId?: string;
  commercialReleaseHash?: string;
  commercialReleaseState?: string;
  currentAuthority?: string;
};

const MODEL_VERSION = "iof-package-assembly-v1";
const DEFAULT_TIMESTAMP = "2026-07-01T00:00:00.000Z";

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
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function stableIdPart(value: unknown, fallback = "UNKNOWN") {
  const raw = asString(value, fallback);
  return raw.replace(/[^A-Za-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 120) || fallback;
}

function compactString(value: unknown) {
  return asString(value).trim();
}

function uniqueStrings(values: unknown[]) {
  const seen = new Set<string>();
  const result: string[] = [];
  values.flatMap((value) => asArray(value).length ? asArray(value) : [value]).forEach((value) => {
    const text = compactString(value);
    if (!text || seen.has(text)) return;
    seen.add(text);
    result.push(text);
  });
  return result;
}

function isCoordinate(value: unknown): value is [number, number] {
  return Array.isArray(value) &&
    value.length >= 2 &&
    Number.isFinite(Number(value[0])) &&
    Number.isFinite(Number(value[1])) &&
    Math.abs(Number(value[0])) <= 180 &&
    Math.abs(Number(value[1])) <= 90;
}

function normalizeCoordinate(value: unknown): [number, number] | null {
  if (isCoordinate(value)) return [Number(value[0]), Number(value[1])];
  const record = asRecord(value);
  const lon = Number(record.lon ?? record.lng ?? record.longitude);
  const lat = Number(record.lat ?? record.latitude);
  return isCoordinate([lon, lat]) ? [lon, lat] : null;
}

function normalizeGeometry(value: unknown): [number, number][] {
  if (!Array.isArray(value)) return [];
  return value.map(normalizeCoordinate).filter((coordinate): coordinate is [number, number] => Boolean(coordinate));
}

function geoJsonLineString(coordinates: [number, number][]) {
  return {
    type: "LineString",
    coordinates,
  };
}

function spineSiteReference(
  value: unknown,
  fallbackId: string,
  fallbackRole: "A" | "Z",
  fallbackCoordinate: [number, number],
): SpineSiteReference {
  const record = asRecord(value);
  return {
    siteId: asString(record.siteId ?? record.id, fallbackId),
    label: asString(record.label ?? record.name, `${fallbackRole} site`),
    role: asString(record.role, fallbackRole),
    coordinate: normalizeCoordinate(record.coordinate) ?? fallbackCoordinate,
  };
}

function normalizePercent(value: unknown, fallback = 0) {
  const numeric = asNumber(value, fallback);
  const percent = numeric > 0 && numeric <= 1 ? numeric * 100 : numeric;
  return Math.max(0, Math.min(100, Math.round(percent)));
}

function firstDefined<T>(...values: T[]) {
  return values.find((value) => value !== undefined && value !== null);
}

function graphSummary(graph: unknown) {
  const record = asRecord(graph);
  const nodes = asArray(record.nodes);
  const edges = asArray(record.edges);
  const routes = asArray(record.routes);
  return {
    graphId: asString(record.graphId, asString(record.customerNetworkId, asString(record.id, "COMMERCIAL-GRAPH"))),
    nodeCount: nodes.length,
    edgeCount: edges.length,
    routeCount: routes.length,
    source: graph ? "commercial-workspace-graph" : "not-provided",
  };
}

function inventoryId(value: unknown, index: number) {
  const record = asRecord(value);
  return asString(
    firstDefined(record.networkId, record.inventoryId, record.objectId, record.id),
    `COMMERCIAL-INVENTORY-${String(index + 1).padStart(3, "0")}`,
  );
}

function designArtifactId(value: unknown, index: number) {
  const record = asRecord(value);
  return asString(
    firstDefined(record.designId, record.designImportId, record.importId, record.routeId, record.opportunityId, record.id),
    `DESIGN-ARTIFACT-${String(index + 1).padStart(3, "0")}`,
  );
}

function buildStationObjects(packageId: string, draft?: CommercialCorridorDraft | null, explicitStationing: unknown[] = []) {
  if (explicitStationing.length) return explicitStationing;
  if (!draft) return [];
  const stationCount = Math.max(0, Math.min(500, Math.round(draft.stationCount)));
  if (!stationCount) return [];
  const intervalFeet = Math.max(1, draft.stationIntervalFeet);
  return Array.from({ length: stationCount }, (_, index) => {
    const stationFeet = index * intervalFeet;
    return {
      stationId: `${packageId}:STATION:${String(index).padStart(4, "0")}`,
      routeId: draft.routeId,
      stationIndex: index,
      stationFeet,
      milepost: Number((stationFeet / 5280).toFixed(3)),
      source: "COMMERCIAL_STATIONING",
      authority: "COMMERCIAL_DRAFT_IOF_PACKAGE",
    };
  });
}

function buildStructureObjects(packageId: string, draft?: CommercialCorridorDraft | null) {
  if (!draft) return [];
  return [
    ["ILA", draft.ilaCount],
    ["REGENERATION", draft.regenCount],
    ["SPLICE_CASE", draft.spliceCaseCount],
    ["VAULT", draft.vaultCount],
    ["HANDHOLE", draft.handholeCount],
  ].filter(([, count]) => asNumber(count) > 0).map(([type, count]) => ({
    structureId: `${packageId}:STRUCTURE:${type}`,
    structureType: type,
    quantity: count,
    sourceRouteId: draft.routeId,
    source: "COMMERCIAL_DRAFT_STRUCTURE_SUMMARY",
    authority: "COMMERCIAL_DRAFT_IOF_PACKAGE",
  }));
}

function routeGeometryReferences(packageId: string, proposal: Partial<ProposalRuntimeObject>, draft?: CommercialCorridorDraft | null, quickQuote?: OpportunityQuickQuote | null) {
  const explicit = uniqueStrings([proposal.geometryReferences]);
  if (explicit.length) return explicit;
  const routeId = draft?.routeId ?? quickQuote?.candidateId ?? proposal.proposalId ?? packageId;
  const geometry = draft?.geometry ?? quickQuote?.geometry ?? [];
  return geometry.slice(0, 20).map((coordinate, index) => `${stableIdPart(routeId)}:geometry:${index}:${coordinate.join(",")}`);
}

function buildRouteUnits(args: {
  packageId: string;
  timestamp: string;
  runtimeObjectIds: string[];
  runtimeRelationshipIds: string[];
  runtimeEvidenceIds: string[];
  geometryReferences: string[];
  draft?: CommercialCorridorDraft | null;
  quickQuote?: OpportunityQuickQuote | null;
}) {
  const { packageId, timestamp, runtimeObjectIds, runtimeRelationshipIds, runtimeEvidenceIds, geometryReferences, draft, quickQuote } = args;
  const segments = draft?.routeSegments ?? [];
  if (draft && segments.length) {
    return segments.map((segment: CommercialCorridorSegment, index): ProposedIofUnit => ({
      unitId: `${packageId}:UNIT:ROUTE-SEGMENT:${stableIdPart(segment.segmentId, String(index + 1))}`,
      unitType: "ROUTE_SEGMENT",
      name: segment.label || `Commercial route segment ${index + 1}`,
      status: "PROPOSED",
      sourceRuntimeObjectId: runtimeObjectIds[0],
      runtimeObjectIds,
      runtimeRelationshipIds,
      runtimeEvidenceIds,
      geometryReferences: [geometryReferences[index % Math.max(1, geometryReferences.length)] ?? `${packageId}:geometry:${index}`],
      dependencyIds: [`${packageId}:DEPENDENCY:DESIGN`, `${packageId}:DEPENDENCY:PRICING`],
      quantity: Number(segment.routeMiles.toFixed(3)),
      commercialQuantity: Number(segment.routeMiles.toFixed(3)),
      historicalQuantity: 0,
      unitOfMeasure: "route-mile",
      commercialFiberFeet: Math.round(segment.fiberFeet),
      commercialDuctFeet: Math.round(segment.ductFeet),
      commercialConstructionCost: Math.round(segment.constructionCost),
      engineeringQuantity: 0,
      confidence: normalizePercent(draft.transparentEstimate.confidence.score),
      commercialConfidence: normalizePercent(draft.transparentEstimate.commercialReadiness.score),
      engineeringDecision: "PENDING_ENGINEERING_REVIEW",
      engineeringNote: "Commercial-assembled Draft IOF unit. Engineering must certify or revise before ScopeVersion creation.",
      engineeringRisk: "ENGINEERING_REVIEW_REQUIRED",
      engineeringComments: [],
      immutable: false,
      createdAt: timestamp,
      updatedAt: timestamp,
    }));
  }
  if (quickQuote) {
    return [{
      unitId: `${packageId}:UNIT:ROUTE:${stableIdPart(quickQuote.candidateId, "QUICK-QUOTE")}`,
      unitType: "ROUTE_SEGMENT",
      name: asString(asRecord(quickQuote).label, "Commercial quick quote route"),
      status: "PROPOSED",
      sourceRuntimeObjectId: runtimeObjectIds[0],
      runtimeObjectIds,
      runtimeRelationshipIds,
      runtimeEvidenceIds,
      geometryReferences,
      dependencyIds: [`${packageId}:DEPENDENCY:DESIGN`, `${packageId}:DEPENDENCY:PRICING`],
      quantity: Number(quickQuote.routeMiles.toFixed(3)),
      commercialQuantity: Number(quickQuote.routeMiles.toFixed(3)),
      historicalQuantity: 0,
      unitOfMeasure: "route-mile",
      commercialConstructionCost: Math.round(quickQuote.budgetCost),
      engineeringQuantity: 0,
      confidence: normalizePercent(quickQuote.confidence),
      commercialConfidence: normalizePercent(quickQuote.confidence),
      engineeringDecision: "PENDING_ENGINEERING_REVIEW",
      engineeringNote: "Commercial-assembled quick quote unit. Engineering must certify or revise before ScopeVersion creation.",
      engineeringRisk: "ENGINEERING_REVIEW_REQUIRED",
      engineeringComments: [],
      immutable: false,
      createdAt: timestamp,
      updatedAt: timestamp,
    }];
  }
  return [{
    unitId: `${packageId}:UNIT:COMMERCIAL-PROPOSAL`,
    unitType: "COMMERCIAL_PROPOSAL_SCOPE",
    name: "Commercial proposal scope",
    status: "PROPOSED",
    sourceRuntimeObjectId: runtimeObjectIds[0],
    runtimeObjectIds,
    runtimeRelationshipIds,
    runtimeEvidenceIds,
    geometryReferences,
    dependencyIds: [`${packageId}:DEPENDENCY:PROPOSAL`],
    quantity: 1,
    commercialQuantity: 1,
    historicalQuantity: 0,
    unitOfMeasure: "package",
    engineeringQuantity: 0,
    confidence: 50,
    commercialConfidence: 50,
    engineeringDecision: "PENDING_ENGINEERING_REVIEW",
    engineeringNote: "Commercial scope unit assembled without route segment detail.",
    engineeringRisk: "ROUTE_SEGMENT_DETAIL_REQUIRED",
    engineeringComments: [],
    immutable: false,
    createdAt: timestamp,
    updatedAt: timestamp,
  }];
}

function buildStructureUnits(args: {
  packageId: string;
  timestamp: string;
  draft?: CommercialCorridorDraft | null;
  runtimeObjectIds: string[];
  runtimeRelationshipIds: string[];
  runtimeEvidenceIds: string[];
}) {
  const { packageId, timestamp, draft, runtimeObjectIds, runtimeRelationshipIds, runtimeEvidenceIds } = args;
  if (!draft) return [];
  return [
    ["ILA", "Intermediate line amplifier sites", draft.ilaCount],
    ["REGENERATION", "Regeneration facilities", draft.regenCount],
    ["SPLICE_CASE", "Splice cases", draft.spliceCaseCount],
    ["VAULT", "Vaults", draft.vaultCount],
    ["HANDHOLE", "Handholes", draft.handholeCount],
  ].filter(([, , count]) => asNumber(count) > 0).map(([unitType, name, count]): ProposedIofUnit => ({
    unitId: `${packageId}:UNIT:${unitType}`,
    unitType: String(unitType),
    name: String(name),
    status: "PROPOSED",
    sourceRuntimeObjectId: draft.routeId,
    runtimeObjectIds,
    runtimeRelationshipIds,
    runtimeEvidenceIds,
    geometryReferences: [`${packageId}:STRUCTURE:${unitType}`],
    dependencyIds: [`${packageId}:DEPENDENCY:DESIGN`, `${packageId}:DEPENDENCY:STATIONING`],
    quantity: Number(count),
    commercialQuantity: Number(count),
    historicalQuantity: 0,
    unitOfMeasure: "count",
    engineeringQuantity: 0,
    confidence: normalizePercent(draft.transparentEstimate.confidence.score),
    commercialConfidence: normalizePercent(draft.transparentEstimate.commercialReadiness.score),
    engineeringDecision: "PENDING_ENGINEERING_REVIEW",
    engineeringNote: "Commercial structure quantity requires engineering certification.",
    engineeringRisk: "ENGINEERING_REVIEW_REQUIRED",
    engineeringComments: [],
    immutable: false,
    createdAt: timestamp,
    updatedAt: timestamp,
  }));
}

function normalizeValidationInputs(validation: ValidationInput[] = []) {
  return validation.map((item, index) => {
    if (Array.isArray(item)) {
      return {
        key: stableIdPart(item[0], `validation-${index + 1}`).toLowerCase(),
        label: item[0],
        status: item[1] ? "PASS" : "FAIL",
      };
    }
    const label = item.label ?? item.key ?? `Validation ${index + 1}`;
    const explicitStatus = asString(item.status).toUpperCase();
    const status = explicitStatus || (item.passed === false ? "FAIL" : "PASS");
    return {
      key: stableIdPart(item.key ?? label, `validation-${index + 1}`).toLowerCase(),
      label,
      status,
    };
  });
}

function buildValidation(args: {
  packageId: string;
  timestamp: string;
  proposal: Partial<ProposalRuntimeObject>;
  units: ProposedIofUnit[];
  geometryReferences: string[];
  geometryCoordinateCount: number;
  pricing: unknown;
  validation?: ValidationInput[];
  productDoctrineAssembly?: ProductDoctrineAssembly | null;
  auditProjectionSummary?: unknown;
  kernelExecutionGraphSummary?: unknown;
  constitutionalAssembly?: unknown;
  instantiationHealth?: unknown;
  doctrineObjectInstantiation?: unknown;
  doctrineProjection?: unknown;
}): IofPackageValidation {
  const proposal = args.proposal;
  const checks = [
    {
      key: "proposal-runtime-object",
      label: "Proposal Runtime Object",
      status: proposal.proposalId ? "PASS" : "FAIL",
    },
    {
      key: "customer-id",
      label: "Customer ID",
      status: proposal.customerId ? "PASS" : "FAIL",
    },
    {
      key: "proposed-iof-units",
      label: "Proposed IOF units",
      status: args.units.length > 0 ? "PASS" : "FAIL",
    },
    {
      key: "geometry-or-design-artifact",
      label: "Geometry or design artifact",
      status: args.geometryCoordinateCount > 1 ? "PASS" : "FAIL",
    },
    {
      key: "pricing-inputs",
      label: "Pricing inputs",
      status: args.pricing ? "PASS" : "WARNING",
    },
    {
      key: "no-scopeversion-created",
      label: "No ScopeVersion created by Commercial assembly",
      status: "PASS",
    },
    ...(args.auditProjectionSummary ? [
      {
        key: "spine-audit-projection",
        label: "Audit Projection onto Measured Spine",
        status: asRecord(args.auditProjectionSummary).complianceStatus === "FAIL" ? "FAIL" : asRecord(args.auditProjectionSummary).complianceStatus === "WARNING" ? "WARNING" : "PASS",
      },
      {
        key: "closure-expectations-created",
        label: "Closure expectations created from audit projection",
        status: asNumber(asRecord(args.auditProjectionSummary).closureExpectationCount, 0) > 0 ? "PASS" : "FAIL",
      },
      {
        key: "cost-bearing-audit-lines-attached",
        label: "Cost-bearing audit lines attached to spine/stations/objects",
        status: asNumber(asRecord(args.auditProjectionSummary).costBearingUnattachedCount, 0) === 0 ? "PASS" : "FAIL",
      },
    ] : []),
    ...(args.kernelExecutionGraphSummary ? [
      {
        key: "kernel-execution-graph",
        label: "Kernel Execution Graph created",
        status: asRecord(args.kernelExecutionGraphSummary).validationStatus === "FAIL" ? "FAIL" : asNumber(asRecord(args.kernelExecutionGraphSummary).nodeCount, 0) > 0 ? "PASS" : "FAIL",
      },
      {
        key: "kernel-execution-station-nodes",
        label: "Stations projected as first-class execution nodes",
        status: asNumber(asRecord(args.kernelExecutionGraphSummary).stationNodeCount, 0) > 0 ? "PASS" : "FAIL",
      },
      {
        key: "kernel-execution-closure-nodes",
        label: "Closure expectations projected into execution graph",
        status: asNumber(asRecord(args.kernelExecutionGraphSummary).closureExpectationNodeCount, 0) > 0 ? "PASS" : "WARNING",
      },
    ] : []),
    ...(args.constitutionalAssembly ? [
      {
        key: "constitutional-assembly",
        label: "Constitutional Assembly validated",
        status: asRecord(args.constitutionalAssembly).status === "PASS" ? "PASS" : "FAIL",
      },
      {
        key: "constitutional-assembly-draft-approval-gate",
        label: "Draft IOF approval prohibited until Constitutional Assembly succeeds",
        status: asRecord(args.constitutionalAssembly).draftIofApprovalProhibitedUntilPass === true &&
          asRecord(args.constitutionalAssembly).status === "PASS" ? "PASS" : "FAIL",
      },
    ] : []),
    ...(args.doctrineObjectInstantiation ? [
      {
        key: "doctrine-object-instantiation-engine",
        label: "Doctrine Object Instantiation Engine",
        status: asRecord(args.doctrineObjectInstantiation).status === "FAIL" ? "FAIL" : "PASS",
      },
      {
        key: "doctrine-object-addressing",
        label: "Every doctrine object has a deterministic address",
        status: asNumber(asRecord(args.doctrineObjectInstantiation).missingAddressCount, 0) === 0 ? "PASS" : "FAIL",
      },
      {
        key: "doctrine-payment-close-sequences",
        label: "Doctrine payment and close sequences instantiated",
        status: asNumber(asRecord(args.doctrineObjectInstantiation).missingPaymentSequenceCount, 0) === 0 &&
          asNumber(asRecord(args.doctrineObjectInstantiation).missingCloseSequenceCount, 0) === 0 ? "PASS" : "FAIL",
      },
      {
        key: "doctrine-station-sequencing",
        label: "Doctrine quantity placement and station sequencing validated",
        status: asNumber(asRecord(args.doctrineObjectInstantiation).quantityMismatchCount, 0) === 0 &&
          asNumber(asRecord(args.doctrineObjectInstantiation).missingStationAddressCount, 0) === 0 &&
          asNumber(asRecord(args.doctrineObjectInstantiation).sequenceGapCount, 0) === 0 &&
          asNumber(asRecord(args.doctrineObjectInstantiation).duplicateObjectIdCount, 0) === 0 ? "PASS" : "FAIL",
      },
      {
        key: "doctrine-span-derivation",
        label: "Doctrine station spans derived from sequenced action objects",
        status: asNumber(asRecord(args.doctrineObjectInstantiation).spanDerivationFailureCount, 0) === 0 ? "PASS" : "FAIL",
      },
      {
        key: "doctrine-linear-asset-attachments",
        label: "Conduit, fiber, trace wire, warning tape, and pull tape attached to station spans",
        status: asNumber(asRecord(args.doctrineObjectInstantiation).unattachedLinearAssetCount, 0) === 0 ? "PASS" : "FAIL",
      },
    ] : []),
    ...(args.doctrineProjection ? [
      {
        key: "doctrine-projection-engine",
        label: "Doctrine Projection Engine",
        status: asRecord(args.doctrineProjection).status === "FAIL" ? "FAIL" : "PASS",
      },
      {
        key: "doctrine-projection-measured-centerline",
        label: "Measured Centerline materialized",
        status: asString(asRecord(args.doctrineProjection).measuredCenterlineId) ? "PASS" : "FAIL",
      },
      {
        key: "doctrine-projection-station-projection",
        label: "Station Projection materialized",
        status: asString(asRecord(args.doctrineProjection).stationProjectionId) ? "PASS" : "FAIL",
      },
      {
        key: "doctrine-projection-station-graph",
        label: "Station Graph materialized",
        status: asString(asRecord(args.doctrineProjection).stationGraphId) ? "PASS" : "FAIL",
      },
      {
        key: "doctrine-projection-station-authorities",
        label: "Station Authorities materialized",
        status: asNumber(asRecord(args.doctrineProjection).stationAuthorityCount, 0) > 0 ? "PASS" : "FAIL",
      },
      {
        key: "doctrine-projection-projected-object-manifest",
        label: "Projected Object Manifest materialized",
        status: asString(asRecord(args.doctrineProjection).projectedObjectManifestId) ? "PASS" : "FAIL",
      },
    ] : []),
    ...(args.instantiationHealth ? [
      {
        key: "spine-object-instantiation",
        label: "Constitutional Spine Object Instantiation",
        status: asRecord(args.instantiationHealth).instantiationStatus === "PASS" ? "PASS" : "FAIL",
      },
    ] : []),
    ...(args.productDoctrineAssembly ? [
      {
        key: "product-doctrine-assembly",
        label: "Product Doctrine Assembly",
        status: args.productDoctrineAssembly.validationSummary.status,
      },
      {
        key: "product-doctrine-scopeversion-gate",
        label: "Product Doctrine blocks commercial ScopeVersion creation",
        status: args.productDoctrineAssembly.rules.scopeVersionCreationAllowedFromCommercial === false ? "PASS" : "FAIL",
      },
      {
        key: "product-doctrine-engineering-gate",
        label: "Product Doctrine requires Engineering certification",
        status: args.productDoctrineAssembly.rules.engineeringCertificationRequired === true ? "PASS" : "FAIL",
      },
    ] : []),
    ...normalizeValidationInputs(args.validation),
  ];
  const passCount = checks.filter((check) => check.status === "PASS").length;
  const failCount = checks.filter((check) => check.status === "FAIL").length;
  return {
    validationId: `${args.packageId}:VALIDATION`,
    packageId: args.packageId,
    status: failCount ? "FAIL" : checks.some((check) => check.status === "WARNING") ? "WARNING" : "PASS",
    readinessScore: Math.round((passCount / Math.max(1, checks.length)) * 100),
    checks,
    validatedAt: args.timestamp,
  };
}

function manifestEntry(args: {
  packageId: string;
  entryType: string;
  objectId: string;
  objectType: string;
  label: string;
  source: string;
  runtimeObjectIds?: string[];
  lifecycle?: string;
  metadata?: JsonObject;
}): IofPackageManifestEntry {
  return {
    manifestEntryId: `${args.packageId}:MANIFEST:${stableIdPart(args.entryType)}:${stableIdPart(args.objectId)}`,
    entryType: args.entryType,
    objectId: args.objectId,
    objectType: args.objectType,
    label: args.label,
    runtimeObjectIds: args.runtimeObjectIds ?? [],
    source: args.source,
    authority: "COMMERCIAL_DRAFT_IOF_PACKAGE",
    lifecycle: args.lifecycle ?? "DRAFT",
    duplicated: false,
    metadata: args.metadata ?? {},
  };
}

function buildManifest(args: {
  packageId: string;
  proposal: Partial<ProposalRuntimeObject>;
  timestamp: string;
  runtimeObjectIds: string[];
  runtimeRelationshipIds: string[];
  runtimeEvidenceIds: string[];
  inventoryReferences: string[];
  geometryReferences: string[];
  stations: unknown[];
  structures: unknown[];
  dependencies: string[];
  designArtifacts: unknown[];
  proposalDocumentReferences: string[];
  commercialAssumptionIds: string[];
  engineeringRequirements: unknown[];
}): IofPackageManifest {
  const objects = args.runtimeObjectIds.map((id) => manifestEntry({
    packageId: args.packageId,
    entryType: "object",
    objectId: id,
    objectType: "RUNTIME_OBJECT_REFERENCE",
    label: id,
    source: "proposal.runtimeObjectIds",
    runtimeObjectIds: [id],
  }));
  const relationships = args.runtimeRelationshipIds.map((id) => manifestEntry({
    packageId: args.packageId,
    entryType: "relationship",
    objectId: id,
    objectType: "RUNTIME_RELATIONSHIP_REFERENCE",
    label: id,
    source: "proposal.runtimeRelationshipIds",
  }));
  const inventory = args.inventoryReferences.map((id) => manifestEntry({
    packageId: args.packageId,
    entryType: "inventory",
    objectId: id,
    objectType: "INVENTORY_REFERENCE",
    label: id,
    source: "commercial.objectInventory",
  }));
  const geometry = args.geometryReferences.map((id) => manifestEntry({
    packageId: args.packageId,
    entryType: "geometry",
    objectId: id,
    objectType: "GEOMETRY_REFERENCE",
    label: id,
    source: "commercial.designArtifacts",
  }));
  const stations = args.stations.map((station, index) => {
    const record = asRecord(station);
    const id = asString(record.stationId, `${args.packageId}:STATION:${index + 1}`);
    return manifestEntry({
      packageId: args.packageId,
      entryType: "station",
      objectId: id,
      objectType: "STATION_REFERENCE",
      label: id,
      source: "commercial.stationing",
      metadata: record,
    });
  });
  const structures = args.structures.map((structure, index) => {
    const record = asRecord(structure);
    const id = asString(record.structureId, `${args.packageId}:STRUCTURE:${index + 1}`);
    return manifestEntry({
      packageId: args.packageId,
      entryType: "structure",
      objectId: id,
      objectType: "STRUCTURE_REFERENCE",
      label: asString(record.structureType, id),
      source: "commercial.objectInventory",
      metadata: record,
    });
  });
  const dependencies = args.dependencies.map((id) => manifestEntry({
    packageId: args.packageId,
    entryType: "dependency",
    objectId: id,
    objectType: "PACKAGE_DEPENDENCY",
    label: id,
    source: "iof-package-assembly-engine",
  }));
  const evidence = args.runtimeEvidenceIds.map((id) => manifestEntry({
    packageId: args.packageId,
    entryType: "evidence",
    objectId: id,
    objectType: "RUNTIME_EVIDENCE_REFERENCE",
    label: id,
    source: "proposal.runtimeEvidenceIds",
  }));
  const documents = args.proposalDocumentReferences.map((id) => manifestEntry({
    packageId: args.packageId,
    entryType: "document",
    objectId: id,
    objectType: "PROPOSAL_DOCUMENT_REFERENCE",
    label: id,
    source: "proposal.proposalDocumentReferences",
  }));
  const commercialAssumptions = args.commercialAssumptionIds.map((id) => manifestEntry({
    packageId: args.packageId,
    entryType: "commercialAssumption",
    objectId: id,
    objectType: "COMMERCIAL_ASSUMPTION_REFERENCE",
    label: id,
    source: "proposal.commercialAssumptionIds",
  }));
  const customerRequests = args.designArtifacts.map((artifact, index) => {
    const id = designArtifactId(artifact, index);
    return manifestEntry({
      packageId: args.packageId,
      entryType: "customerRequest",
      objectId: id,
      objectType: "CUSTOMER_DESIGN_ARTIFACT",
      label: id,
      source: "commercial.designArtifacts",
      metadata: { artifactType: asString(asRecord(artifact).objectType, asString(asRecord(artifact).type, "DESIGN_ARTIFACT")) },
    });
  });
  const engineeringRequirements = args.engineeringRequirements.map((requirement, index) => {
    const record = asRecord(requirement);
    const id = asString(record.requirementId, `${args.packageId}:ENGINEERING-REQ:${index + 1}`);
    return manifestEntry({
      packageId: args.packageId,
      entryType: "engineeringRequirement",
      objectId: id,
      objectType: "ENGINEERING_REQUIREMENT",
      label: asString(record.label, id),
      source: "iof-package-assembly-engine",
      metadata: record,
    });
  });
  const counts = {
    objects: objects.length,
    relationships: relationships.length,
    inventory: inventory.length,
    geometry: geometry.length,
    stations: stations.length,
    structures: structures.length,
    dependencies: dependencies.length,
    evidence: evidence.length,
    documents: documents.length,
    commercialAssumptions: commercialAssumptions.length,
    customerRequests: customerRequests.length,
    engineeringRequirements: engineeringRequirements.length,
  };
  return {
    manifestId: `${args.packageId}:MANIFEST`,
    packageId: args.packageId,
    proposalId: args.proposal.proposalId ?? "",
    organizationId: args.proposal.organizationId,
    workspaceId: args.proposal.workspaceId,
    generatedAt: args.timestamp,
    modelVersion: MODEL_VERSION,
    duplicationPolicy: "REFERENCE_EXISTING_RUNTIME_OBJECTS_DO_NOT_RECREATE",
    objects,
    relationships,
    inventory,
    geometry,
    stations,
    structures,
    dependencies,
    evidence,
    documents,
    commercialAssumptions,
    customerRequests,
    engineeringRequirements,
    counts,
    summary: {
      packageAssembler: "IOFPackageAssemblyEngine",
      packageAuthority: "COMMERCIAL_DRAFT_IOF_PACKAGE",
      noScopeVersionCreation: true,
    },
  };
}

function buildDependencyGraph(args: {
  packageId: string;
  timestamp: string;
  proposal: Partial<ProposalRuntimeObject>;
  units: ProposedIofUnit[];
  dependencies: string[];
}): IofPackageDependencyGraph {
  const proposalId = args.proposal.proposalId ?? "PROPOSAL";
  const nodes = [
    { id: args.packageId, type: "DRAFT_IOF_PACKAGE", label: args.packageId },
    { id: proposalId, type: "PROPOSAL", label: asString(args.proposal.proposalNumber, proposalId) },
    ...args.dependencies.map((id) => ({ id, type: "DEPENDENCY", label: id })),
    ...args.units.map((unit) => ({ id: unit.unitId, type: unit.unitType, label: unit.name })),
  ];
  const edges = [
    { edgeId: `${args.packageId}:EDGE:FROM-PROPOSAL`, from: proposalId, to: args.packageId, relationship: "ASSEMBLES_DRAFT_IOF_PACKAGE" },
    ...args.dependencies.map((id) => ({ edgeId: `${args.packageId}:EDGE:DEP:${stableIdPart(id)}`, from: id, to: args.packageId, relationship: "REQUIRED_FOR_PACKAGE" })),
    ...args.units.map((unit) => ({ edgeId: `${args.packageId}:EDGE:UNIT:${stableIdPart(unit.unitId)}`, from: args.packageId, to: unit.unitId, relationship: "CONTAINS_PROPOSED_IOF_UNIT" })),
  ];
  return {
    graphId: `${args.packageId}:DEPENDENCY-GRAPH`,
    packageId: args.packageId,
    generatedAt: args.timestamp,
    path: "Commercial Proposal -> Draft IOF Package -> Engineering Review",
    nodes,
    edges,
    summary: {
      nodeCount: nodes.length,
      edgeCount: edges.length,
      noScopeVersionCreation: true,
    },
  };
}

function buildPackageDifferences(args: {
  packageId: string;
  proposal: Partial<ProposalRuntimeObject>;
  timestamp: string;
  units: ProposedIofUnit[];
  geometryReferences: string[];
  runtimeRelationshipIds: string[];
}): IofPackageDifferences {
  return {
    differenceId: `${args.packageId}:DIFFERENCES`,
    packageId: args.packageId,
    proposalId: args.proposal.proposalId ?? "",
    proposalVersion: args.proposal.version ?? null,
    packageSourceProposalVersion: args.proposal.version ?? null,
    comparedAt: args.timestamp,
    addedObjects: args.units.map((unit) => unit.unitId),
    removedObjects: [],
    modifiedUnits: [],
    geometryChanges: { added: args.geometryReferences, removed: [] },
    relationshipChanges: { added: args.runtimeRelationshipIds, removed: [] },
    engineeringImpact: "Commercial package assembled for Engineering review. No executable authority has been created.",
  };
}

function packageReadiness(validation: IofPackageValidation, units: ProposedIofUnit[]) {
  const blockingIssues = validation.checks
    .filter((check) => check.status === "FAIL")
    .map((check) => check.label);
  const missingInformation = validation.checks
    .filter((check) => check.status === "WARNING" || check.status === "FAIL")
    .map((check) => check.label);
  const ready = !blockingIssues.length && units.length > 0;
  return {
    status: ready ? "READY_FOR_ENGINEERING_REVIEW" : "BLOCKED",
    canEnterEngineeringReview: ready,
    canCreateScopeVersion: false,
    noScopeVersionCreation: true,
    missingInformation,
    blockingIssues,
    proposedUnitCount: units.length,
    certifiedUnitCount: 0,
    packageCompleteness: validation.readinessScore,
    certificationPercent: 0,
    recommendation: ready
      ? "Send this deterministic Draft IOF Package to Engineering for certification."
      : "Resolve blocking commercial package inputs before Engineering review.",
  };
}

function expectationSpineObjectId(expectation: JsonObject, index: number) {
  return asString(
    expectation.spineObjectId ?? expectation.executionObjectId ?? expectation.nodeId,
    `SPINE-OBJECT-${String(index + 1).padStart(4, "0")}`,
  );
}

function buildSpineObjectDependencies(expectations: unknown[]) {
  return asArray<JsonObject>(expectations).map((expectation, index) => ({
    dependencyId: `${expectationSpineObjectId(expectation, index)}:DEPENDENCY-GRAPH`,
    spineObjectId: expectationSpineObjectId(expectation, index),
    nodeId: asString(expectation.nodeId),
    dependencies: asArray(expectation.expectedDependencies),
    dependencyGraphNotSchedule: expectation.dependencyGraphNotSchedule === true,
    authority: asString(expectation.authority, "CONSTITUTIONAL_CLOSURE_AUTHORITY"),
    noScopeVersionCreation: true,
  }));
}

function buildSpineObjectCloseSequences(expectations: unknown[]) {
  return asArray<JsonObject>(expectations).map((expectation, index) => {
    const legalCloseSequence = asArray(expectation.legalCloseSequence);
    return {
      sequenceId: `${expectationSpineObjectId(expectation, index)}:LEGAL-CLOSE-SEQUENCE`,
      spineObjectId: expectationSpineObjectId(expectation, index),
      nodeId: asString(expectation.nodeId),
      legalCloseSequence,
      expectedCloseSequence: asArray(expectation.expectedCloseSequence),
      nextDeterministicClose: legalCloseSequence[0] ?? null,
      dependencyGraphNotSchedule: expectation.dependencyGraphNotSchedule === true,
      authority: asString(expectation.authority, "CONSTITUTIONAL_CLOSURE_AUTHORITY"),
      noScopeVersionCreation: true,
    };
  });
}

function buildSpineObjectEvidenceRequirements(expectations: unknown[]) {
  return asArray<JsonObject>(expectations).map((expectation, index) => ({
    evidenceRequirementId: `${expectationSpineObjectId(expectation, index)}:EVIDENCE-REQUIREMENTS`,
    spineObjectId: expectationSpineObjectId(expectation, index),
    nodeId: asString(expectation.nodeId),
    requiredEvidence: asArray(expectation.expectedEvidence),
    requiredMeasurements: asArray(expectation.expectedMeasurements),
    requiredAcceptanceCriteria: asArray(expectation.expectedAcceptanceCriteria),
    authority: asString(expectation.authority, "CONSTITUTIONAL_CLOSURE_AUTHORITY"),
    noScopeVersionCreation: true,
  }));
}

function buildSegmentValidationRules(args: {
  expectations: unknown[];
  stationRangeExpectations?: unknown[];
}) {
  const ranges = asArray<JsonObject>(args.stationRangeExpectations);
  if (ranges.length) {
    return ranges.map((range, index) => ({
      segmentValidationRuleId: `${asString(range.expectationId, `STATION-RANGE-${index + 1}`)}:SEGMENT-VALIDATION`,
      spineObjectId: asString(range.expectationId, `STATION-RANGE-${index + 1}`),
      fromStationId: range.fromStationId,
      toStationId: range.toStationId,
      expectedQuantity: range.expectedQuantity,
      quantityUnit: range.quantityUnit,
      validationRule: "NO_CLOSE_NO_VALIDATION_NO_PAYMENT",
      asBuiltRequiredFromValidatedCloses: true,
      segmentAcceptanceRequired: true,
      noScopeVersionCreation: true,
    }));
  }
  return asArray<JsonObject>(args.expectations)
    .filter((expectation) => ["STATION_RANGE", "CONDUIT_SEGMENT", "FIBER_SEGMENT"].includes(asString(expectation.nodeType)))
    .map((expectation, index) => ({
      segmentValidationRuleId: `${expectationSpineObjectId(expectation, index)}:SEGMENT-VALIDATION`,
      spineObjectId: expectationSpineObjectId(expectation, index),
      nodeId: asString(expectation.nodeId),
      validationRule: "NO_CLOSE_NO_VALIDATION_NO_PAYMENT",
      legalCloseSequence: asArray(expectation.legalCloseSequence),
      asBuiltRequiredFromValidatedCloses: true,
      segmentAcceptanceRequired: true,
      noScopeVersionCreation: true,
    }));
}

function buildPaymentEligibilityRules(expectations: unknown[]) {
  return asArray<JsonObject>(expectations).map((expectation, index) => ({
    paymentEligibilityRuleId: `${expectationSpineObjectId(expectation, index)}:PAYMENT-ELIGIBILITY`,
    spineObjectId: expectationSpineObjectId(expectation, index),
    nodeId: asString(expectation.nodeId),
    paymentEligibilityRule: asString(expectation.paymentEligibilityRule, "NO_CLOSE_NO_VALIDATION_NO_PAYMENT"),
    requiredCloseSequence: asArray(expectation.legalCloseSequence),
    validationRequired: true,
    segmentAcceptanceRequired: true,
    revenueRealizationRule: "NO_CLOSE_NO_VALIDATION_NO_PAYMENT",
    noScopeVersionCreation: true,
  }));
}

function buildDraftIofReadiness(args: {
  validation: IofPackageValidation;
  readiness: ReturnType<typeof packageReadiness>;
  constitutionalAssembly: unknown;
  spineObjectDependencies: unknown[];
  spineObjectCloseSequences: unknown[];
  spineObjectEvidenceRequirements: unknown[];
  segmentValidationRules: unknown[];
  paymentEligibilityRules: unknown[];
}) {
  const blockingIssues = [
    ...args.readiness.blockingIssues,
  ];
  const assembly = asRecord(args.constitutionalAssembly);
  if (assembly.status !== "PASS") blockingIssues.push("Constitutional Assembly failed.");
  if (!args.spineObjectDependencies.length) blockingIssues.push("spineObjectDependencies missing.");
  if (!args.spineObjectCloseSequences.length) blockingIssues.push("spineObjectCloseSequences missing.");
  if (!args.spineObjectEvidenceRequirements.length) blockingIssues.push("spineObjectEvidenceRequirements missing.");
  if (!args.segmentValidationRules.length) blockingIssues.push("segmentValidationRules missing.");
  if (!args.paymentEligibilityRules.length) blockingIssues.push("paymentEligibilityRules missing.");
  if (args.validation.status === "FAIL") blockingIssues.push("Draft IOF validation failed.");
  const ready = blockingIssues.length === 0;
  return {
    status: ready ? "READY" : "BLOCKED",
    canApproveDraftIof: ready,
    canSubmitToEngineering: ready,
    approvalGate: "Draft IOF approval prohibited until Constitutional Assembly succeeds.",
    blockingIssues,
    authority: "CONSTITUTIONAL_ASSEMBLY_REVIEW",
    noScopeVersionCreation: true,
    noServiceOrderCreation: true,
    noMarketplaceCreation: true,
    noControlCreation: true,
  };
}

export function assembleDraftIofPackage(input: IOFPackageAssemblyInput): DraftIofPackageRuntime {
  const proposal = input.proposal;
  const timestamp = asString(
    firstDefined(input.generatedAt, proposal.updatedAt, proposal.createdAt),
    DEFAULT_TIMESTAMP,
  );
  const proposalId = proposal.proposalId;
  const packageId = `DRAFT-IOF-${stableIdPart(proposalId)}`;
  const customerId = proposal.customerId;
  const opportunityId = asString(proposal.opportunityId, `${proposalId}:OPPORTUNITY`);
  const geometryReferences = routeGeometryReferences(packageId, proposal, input.commercialDraft, input.quickQuote);
  const objectInventoryIds = input.objectInventory?.map(inventoryId) ?? [];
  const runtimeObjectIds = uniqueStrings([
    proposal.runtimeObjectId,
    proposal.runtimeObjectIds,
    input.runtimeObjectIds,
    input.commercialDraft?.routeId,
    input.quickQuote?.candidateId,
    objectInventoryIds,
  ]);
  const runtimeRelationshipIds = uniqueStrings([proposal.runtimeRelationshipIds, input.runtimeRelationshipIds]);
  const runtimeEvidenceIds = uniqueStrings([proposal.runtimeEvidenceIds, input.runtimeEvidenceIds]);
  const existingInventoryReferences = uniqueStrings([proposal.existingInventoryReferences, input.existingInventoryReferences, objectInventoryIds]);
  const customerDesignReferences = uniqueStrings([proposal.customerDesignReferences, input.customerDesignReferences, input.designArtifacts?.map(designArtifactId)]);
  const doctrineAssembly = input.productDoctrineAssembly ?? null;
  const packageCenterline = [
    normalizeGeometry(doctrineAssembly?.centerline),
    normalizeGeometry(input.commercialDraft?.geometry),
    normalizeGeometry(input.quickQuote?.geometry),
    normalizeGeometry(asRecord(input.commercialCandidate).geometry),
  ].find((coordinates) => coordinates.length > 1) ?? [];
  const packageRouteFeet = Math.round(
    doctrineAssembly?.quantitySummary.routeFeet ??
    input.commercialDraft?.routeFeet ??
    ((input.quickQuote?.routeMiles ?? 0) * 5280),
  );
  const packageRouteMiles = Number((
    doctrineAssembly?.quantitySummary.routeMiles ??
    input.commercialDraft?.routeMiles ??
    input.quickQuote?.routeMiles ??
    (packageRouteFeet / 5280)
  ).toFixed(3));
  const centerlineId = doctrineAssembly?.centerlineId ?? `${packageId}:CENTERLINE`;
  const packageRouteId = input.commercialDraft?.routeId ?? input.quickQuote?.candidateId ?? packageId;
  const spine = doctrineAssembly?.spine ?? (packageCenterline.length > 1 ? {
    spineId: `${packageId}:SPINE`,
    topology: "LINEAR",
    networkClass: "LONG_HAUL",
    centerlineId,
    routeMiles: packageRouteMiles,
    routeFeet: packageRouteFeet,
    noScopeVersionCreation: true,
    source: "COMMERCIAL_OSRM_ROUTE_GEOMETRY",
  } : null);
  const centerlineRoute = packageCenterline.length > 1 ? {
    routeId: packageRouteId,
    source: "COMMERCIAL_OSRM",
    routeMiles: packageRouteMiles,
    routeFeet: packageRouteFeet,
    geometry: packageCenterline,
    geometryCoordinateCount: packageCenterline.length,
    pathFound: true,
  } : null;
  const measuredSpine = packageCenterline.length > 1 ? createMeasuredSpine({
    packageId,
    routeId: packageRouteId,
    geometry: packageCenterline,
    aSite: spineSiteReference(doctrineAssembly?.aSite, `${packageId}:SITE:A`, "A", packageCenterline[0]),
    zSite: spineSiteReference(doctrineAssembly?.zSite, `${packageId}:SITE:Z`, "Z", packageCenterline[packageCenterline.length - 1]),
    sourceGeometryRef: `${packageId}:GEOMETRY:COMMERCIAL-DRAFT`,
  }) : null;
  const stationAuthority = measuredSpine ? createStationAuthority({
    measuredSpine,
    intervalFeet: ENGINEERING_STATION_INTERVAL_FEET,
    stationClass: "ENGINEERING",
  }) : null;
  const stationIndexedGraph = measuredSpine && stationAuthority ? createStationIndexedGraph({
    packageId,
    measuredSpine,
    stationAuthority,
  }) : null;
  const legacyStations = doctrineAssembly?.stations ?? buildStationObjects(packageId, input.commercialDraft, input.stationing);
  const stations = stationAuthority?.stations ?? legacyStations;
  const structures = doctrineAssembly?.structureAssembly.structures ?? buildStructureObjects(packageId, input.commercialDraft);
  const doctrineObjects = doctrineAssembly?.objects ?? [];
  const packageObjects = doctrineObjects.length ? doctrineObjects : input.objectInventory ?? [];
  const dependencies = uniqueStrings([
    `${packageId}:DEPENDENCY:PROPOSAL`,
    input.productDoctrine?.doctrineId ? `${packageId}:DEPENDENCY:PRODUCT-DOCTRINE` : "",
    `${packageId}:DEPENDENCY:DESIGN`,
    `${packageId}:DEPENDENCY:STATIONING`,
    `${packageId}:DEPENDENCY:PRICING`,
    `${packageId}:DEPENDENCY:VALIDATION`,
  ]);
  const proposedRouteUnits = buildRouteUnits({
    packageId,
    timestamp,
    runtimeObjectIds,
    runtimeRelationshipIds,
    runtimeEvidenceIds,
    geometryReferences,
    draft: input.commercialDraft,
    quickQuote: input.quickQuote,
  });
  const proposedStructureUnits = buildStructureUnits({
    packageId,
    timestamp,
    draft: input.commercialDraft,
    runtimeObjectIds,
    runtimeRelationshipIds,
    runtimeEvidenceIds,
  });
  const proposedIofUnits = [...proposedRouteUnits, ...proposedStructureUnits];
  const stationAttachmentObjects = [...packageObjects, ...structures];
  const stationAttachmentInputs = stationAttachmentObjects.length ? stationAttachmentObjects : proposedIofUnits;
  const objectStationAttachments = stationAuthority ? createObjectStationAttachments({
    packageId,
    objects: stationAttachmentInputs,
    stationAuthority,
    stationIndexedGraph: stationIndexedGraph ?? undefined,
  }) : [];
  const productIncludesFiber = asNumber(doctrineAssembly?.quantitySummary.fiberFeet, 0) > 0 || asString(proposal.productName).toLowerCase().includes("fiber");
  const spineAuditProjection = measuredSpine && stationAuthority ? createSpineAuditProjection({
    packageId,
    measuredSpine,
    stationAuthority,
    stationIndexedGraph,
    engineeringObjects: stationAttachmentInputs,
    objectStationAttachments,
    commercialAuditEntries: input.commercialDraft?.transparentEstimate.auditTrail,
    quantitySummary: doctrineAssembly?.quantitySummary,
    pricingSummary: doctrineAssembly?.pricingSummary ?? input.pricing ?? proposal.pricingSummary,
    transparentEstimate: input.commercialDraft?.transparentEstimate,
    productionAssumptions: input.commercialDraft?.transparentEstimate.controls,
    unknownReviewItems: input.commercialDraft?.transparentEstimate.unknownQuantities,
    generatedAt: timestamp,
  }) : null;
  const objectAddressing = measuredSpine && stationAuthority ? createObjectAddressing({
    packageId,
    measuredSpine,
    stationAuthority,
    objects: packageObjects,
    structures,
    engineeringObjects: stationAttachmentInputs,
    proposedIofUnits,
    objectStationAttachments,
    commercialAuditEntries: input.commercialDraft?.transparentEstimate.auditTrail,
    transparentEstimate: input.commercialDraft?.transparentEstimate,
    quantitySummary: doctrineAssembly?.quantitySummary,
    spineAuditProjection,
    stationRangeExpectations: spineAuditProjection?.stationRangeExpectations,
    spineReviewObjects: spineAuditProjection?.spineReviewObjects,
    productIncludesFiber,
    generatedAt: timestamp,
  }) : null;
  const spineObjectCatalog = buildSpineObjectCatalog(timestamp);
  const auditObjectManifest = createAuditObjectManifest({
    packageId,
    catalog: spineObjectCatalog,
    commercialAuditEntries: input.commercialDraft?.transparentEstimate.auditTrail,
    quantitySummary: doctrineAssembly?.quantitySummary,
    productConfiguration: {
      productId: proposal.productId,
      productName: proposal.productName,
      doctrineId: input.productDoctrine?.doctrineId,
      doctrineVersion: input.productDoctrine?.doctrineVersion,
    },
    productDoctrineAssembly: doctrineAssembly,
    objectAddressing,
    generatedAt: timestamp,
  });
  const productionArtifacts = createPD003ProductionArtifacts({
    packageId,
    catalog: spineObjectCatalog,
    auditObjectManifest,
    productIncludesFiber,
    generatedAt: timestamp,
  });
  const baseKernelExecutionGraph = measuredSpine && stationAuthority ? buildKernelExecutionGraph({
    packageId,
    measuredSpine,
    stationAuthority,
    stationIndex: stationAuthority.stationIndex,
    stationToCoordinateMap: stationAuthority.stationToCoordinateMap,
    stationIndexedGraph,
    engineeringObjects: stationAttachmentInputs,
    objectStationAttachments,
    spineAuditProjection,
    closureExpectations: spineAuditProjection?.closureExpectations,
    generatedAt: timestamp,
  }) : null;
  const spineObjectInstantiation = instantiateSpineObjects({
    packageId,
    catalog: spineObjectCatalog,
    auditObjectManifest,
    stationAddressRegistry: objectAddressing?.stationAddressRegistry,
    objectProductionProfiles: productionArtifacts.objectProductionProfiles,
    kernelExecutionGraph: baseKernelExecutionGraph,
    generatedAt: timestamp,
  });
  const doctrineObjectInstantiation = input.productDoctrine && doctrineAssembly ? instantiateDoctrineObjects({
    packageId,
    productDoctrine: input.productDoctrine,
    productDoctrineAssembly: doctrineAssembly,
    routeId: packageRouteId,
    scopeVersionCandidateId: `${packageId}:SCOPEVERSION-CANDIDATE`,
    geometryHash: measuredSpine?.geometryHash ?? centerlineId,
  }) : null;
  const routeRepositoryId = asString(
    firstDefined(
      asRecord(input.commercialCandidate).routeRepositoryId,
      asRecord(input.commercialDraft).routeRepositoryId,
      asRecord(input.quickQuote).routeRepositoryId,
      packageRouteId,
    ),
    packageRouteId,
  );
  const doctrineProjection = input.productDoctrine && doctrineObjectInstantiation && measuredSpine && stationAuthority && stationIndexedGraph ? projectDoctrineToStationSpine({
    packageId,
    productDoctrine: input.productDoctrine,
    doctrineObjectManifest: doctrineObjectInstantiation.engineeringObjectManifest,
    measuredSpine,
    stationAuthority,
    stationIndexedGraph,
    routeRepositoryId,
    routeGeometryId: centerlineId,
    commercialReleasePackageId: input.commercialReleasePackageId,
  }) : null;
  const kernelSpineObjectReferences = spineObjectInstantiation.instantiatedSpineObjects.map((object) => ({
    spineObjectId: object.spineObjectId,
    objectType: object.objectType,
    catalogEntryId: object.catalogEntryId,
    constructionSegmentId: object.constructionSegmentId,
    paymentSegmentId: object.paymentSegmentId,
    executionZoneId: object.executionZoneId,
    currentState: object.currentState,
    authority: object.authority,
    noScopeVersionCreation: true,
  }));
  const kernelExecutionGraph = baseKernelExecutionGraph ? {
    ...baseKernelExecutionGraph,
    spineObjectIds: kernelSpineObjectReferences.map((reference) => reference.spineObjectId),
    spineObjectReferences: kernelSpineObjectReferences,
    referencesInstantiatedSpineObjects: true,
    spineObjectReferenceAuthority: "SPINE_OBJECT_INSTANTIATION_AUTHORITY",
  } : null;
  const executionExpectations = kernelExecutionGraph?.executionExpectations ?? [];
  const spineObjectDependencies = buildSpineObjectDependencies(executionExpectations);
  const spineObjectCloseSequences = buildSpineObjectCloseSequences(executionExpectations);
  const spineObjectEvidenceRequirements = buildSpineObjectEvidenceRequirements(executionExpectations);
  const segmentValidationRules = buildSegmentValidationRules({
    expectations: executionExpectations,
    stationRangeExpectations: spineAuditProjection?.stationRangeExpectations,
  });
  const paymentEligibilityRules = buildPaymentEligibilityRules(executionExpectations);
  const pricing = input.pricing ?? doctrineAssembly?.pricingSummary ?? proposal.pricingSummary ?? input.commercialDraft?.transparentEstimate ?? input.quickQuote;
  const validation = buildValidation({
    packageId,
    timestamp,
    proposal,
    units: proposedIofUnits,
    geometryReferences,
    geometryCoordinateCount: packageCenterline.length,
    pricing,
    validation: input.validation,
    productDoctrineAssembly: doctrineAssembly,
    auditProjectionSummary: spineAuditProjection?.summary,
    kernelExecutionGraphSummary: kernelExecutionGraph?.summary,
    constitutionalAssembly: kernelExecutionGraph?.constitutionalAssembly,
    instantiationHealth: spineObjectInstantiation.instantiationHealth,
    doctrineObjectInstantiation: doctrineObjectInstantiation?.validation,
    doctrineProjection: doctrineProjection ? {
      status: doctrineProjection.validation.status,
      measuredCenterlineId: doctrineProjection.measuredCenterline.measuredCenterlineId,
      stationProjectionId: doctrineProjection.stationProjection.stationProjectionId,
      stationGraphId: doctrineProjection.stationGraph.stationGraphId,
      stationAuthorityCount: doctrineProjection.stationAuthorityIds.length,
      projectedObjectManifestId: doctrineProjection.projectedObjectManifest.manifestId,
      diagnosticsStatus: doctrineProjection.doctrineProjectionDiagnostics.status,
    } : null,
  });
  const readiness = packageReadiness(validation, proposedIofUnits);
  const draftIofReadiness = buildDraftIofReadiness({
    validation,
    readiness,
    constitutionalAssembly: kernelExecutionGraph?.constitutionalAssembly,
    spineObjectDependencies,
    spineObjectCloseSequences,
    spineObjectEvidenceRequirements,
    segmentValidationRules,
    paymentEligibilityRules,
  });
  const engineeringRequirements = [
    {
      requirementId: `${packageId}:ENGINEERING-REQ:UNIT-CERTIFICATION`,
      label: "Engineering must certify or revise every proposed IOF unit.",
      noScopeVersionCreation: true,
    },
    {
      requirementId: `${packageId}:ENGINEERING-REQ:SCOPEVERSION-GATE`,
      label: "ScopeVersion creation remains blocked until Engineering certification completes.",
      noScopeVersionCreation: true,
    },
    ...(input.productDoctrine ? [{
      requirementId: `${packageId}:ENGINEERING-REQ:${input.productDoctrine.doctrineId}`,
      label: `${input.productDoctrine.productName} doctrine requires Engineering certification before ScopeVersion.`,
      doctrineId: input.productDoctrine.doctrineId,
      doctrineVersion: input.productDoctrine.doctrineVersion,
      noScopeVersionCreation: true,
    }] : []),
  ];
  const proposalDocumentReferences = uniqueStrings([
    proposal.proposalDocumentReferences,
    "Executive summary",
    "Commercial pricing summary",
    "Interactive proposal map",
    "Draft IOF Package JSON",
  ]);
  const manifest = buildManifest({
    packageId,
    proposal,
    timestamp,
    runtimeObjectIds,
    runtimeRelationshipIds,
    runtimeEvidenceIds,
    inventoryReferences: existingInventoryReferences,
    geometryReferences,
    stations,
    structures,
    dependencies,
    designArtifacts: input.designArtifacts ?? [],
    proposalDocumentReferences,
    commercialAssumptionIds: uniqueStrings([proposal.commercialAssumptionIds]),
    engineeringRequirements,
  });
  const dependencyGraph = buildDependencyGraph({ packageId, timestamp, proposal, units: proposedIofUnits, dependencies });
  const packageDifferences = buildPackageDifferences({ packageId, proposal, timestamp, units: proposedIofUnits, geometryReferences, runtimeRelationshipIds });
  const commercialConfidence = normalizePercent(
    firstDefined(
      asRecord(proposal.confidenceSummary).commercialReadiness,
      input.commercialDraft?.transparentEstimate.commercialReadiness.score,
      input.quickQuote?.confidence,
      validation.readinessScore,
    ),
    validation.readinessScore,
  );
  const draft = input.commercialDraft;
  const quickQuote = input.quickQuote;
  return {
    packageId,
    draftPackageId: packageId,
    packageName: `${asString(proposal.proposalNumber, proposalId)} Draft IOF Package`,
    packageType: "ENGINEERING",
    status: "DRAFT",
    workflowStatus: readiness.canEnterEngineeringReview ? "ENGINEERING_REVIEW" : "COMMERCIAL_BLOCKED",
    organizationId: asString(proposal.organizationId, input.organizationId),
    workspaceId: asString(proposal.workspaceId, input.workspaceId),
    ownerId: asString(proposal.ownerId, asString(input.ownerId, "commercial")),
    owner: asString(proposal.owner, asString(input.owner, "Commercial")),
    visibility: asString(proposal.visibility, "ORGANIZATION"),
    authority: "COMMERCIAL_DRAFT_IOF_PACKAGE",
    lifecycleState: "IN_REVIEW",
    proposalId,
    customerId,
    accountId: input.accountId ?? asString(proposal.accountId, customerId),
    opportunityId,
    productId: proposal.productId,
    productName: proposal.productName,
    fulfillmentPlanId: proposal.fulfillmentPlanId,
    fulfillmentStrategy: proposal.fulfillmentStrategy,
    fulfillmentPlan: proposal.fulfillmentPlan ?? null,
    fulfillmentMix: proposal.fulfillmentMix,
    assignedEngineerId: input.assignedEngineerId ?? "",
    assignedEngineer: input.assignedEngineer ?? "Unassigned",
    priority: input.priority ?? "NORMAL",
    submittedAt: timestamp,
    proposalSummary: {
      proposalId,
      proposalNumber: proposal.proposalNumber,
      title: proposal.title,
      summary: proposal.summary,
      executiveSummary: proposal.executiveSummary,
      status: proposal.status,
      approvalState: proposal.approvalState,
      version: proposal.version,
      readiness: proposal.readiness,
      noScopeVersionCreation: true,
    },
    commercialSummary: {
      pricingSummary: pricing,
      marginSummary: proposal.marginSummary,
      confidenceSummary: proposal.confidenceSummary,
      commercialAssumptionIds: proposal.commercialAssumptionIds ?? [],
      routeId: draft?.routeId ?? quickQuote?.candidateId,
      routeMiles: packageRouteMiles,
      routeFeet: packageRouteFeet,
      geometryCoordinateCount: packageCenterline.length,
      segmentCount: draft?.routeSegments.length ?? (quickQuote ? 1 : 0),
      stationCount: stations.length,
      stationAuthorityId: stationAuthority?.authorityId,
      measuredSpineId: measuredSpine?.spineId,
      constructionMix: draft?.constructionMix,
      graphSummary: graphSummary(input.graph),
      designArtifactCount: input.designArtifacts?.length ?? 0,
      doctrineId: input.productDoctrine?.doctrineId,
      productDoctrineVersion: input.productDoctrine?.doctrineVersion,
      quantitySummary: doctrineAssembly?.quantitySummary,
      validationStatus: validation.status,
    },
    customerSummary: {
      customerId,
      accountId: input.accountId ?? asString(proposal.accountId, customerId),
      name: input.customerName ?? asString(proposal.customerName, customerId),
      approvalState: proposal.approvalState,
      approvedAt: proposal.approvedAt,
      contactEmails: proposal.customerContactEmails ?? [],
      customerTwinReference: input.customerTwinReference ?? proposal.customerTwinReference,
    },
    proposalRecipientContactIds: proposal.proposalRecipientContactIds as string[] | undefined,
    customerReviewContactIds: proposal.customerReviewContactIds as string[] | undefined,
    approvalAuthorityContactIds: proposal.approvalAuthorityContactIds as string[] | undefined,
    sofRecipientContactIds: proposal.sofRecipientContactIds as string[] | undefined,
    customerContactEmails: proposal.customerContactEmails as string[] | undefined,
    packageReadiness: readiness,
    engineeringReadiness: readiness.status,
    commercialConfidence,
    engineeringConfidence: 0,
    assemblyConfidence: validation.readinessScore,
    packageCompleteness: validation.readinessScore,
    certificationProgress: 0,
    packageRevision: asNumber(proposal.version, 1),
    assemblyReport: {
      assembledBy: "IOFPackageAssemblyEngine",
      modelVersion: MODEL_VERSION,
      generatedAt: timestamp,
      sourceProposalId: proposalId,
      sourceProposalVersion: proposal.version,
      sourceCommercialCandidate: input.commercialCandidate ? "provided" : "not-provided",
      consumedInputs: {
        proposalRuntimeObject: Boolean(proposalId),
        commercialCandidateJson: Boolean(input.commercialCandidate),
        designArtifacts: input.designArtifacts?.length ?? 0,
        graph: Boolean(input.graph),
        stationing: stations.length,
        objectInventory: input.objectInventory?.length ?? 0,
        measuredSpine: Boolean(measuredSpine),
        stationAuthority: Boolean(stationAuthority),
        stationIndexedGraph: Boolean(stationIndexedGraph),
        objectStationAttachments: objectStationAttachments.length,
        spineAuditProjection: Boolean(spineAuditProjection),
        closureExpectations: spineAuditProjection?.closureExpectations.length ?? 0,
        objectAddressingDoctrine: Boolean(objectAddressing?.objectAddressingDoctrine),
        stationAddressRegistry: objectAddressing?.stationAddressRegistry.entries.length ?? 0,
        objectAddresses: objectAddressing?.objectAddresses.length ?? 0,
        unassignedReviewObjects: objectAddressing?.unassignedReviewObjects.length ?? 0,
        addressValidation: asString((objectAddressing?.addressValidation as { status?: string } | undefined)?.status, "MISSING"),
        spineObjectCatalog: spineObjectCatalog.entries.length,
        spineObjectCatalogValidation: spineObjectCatalog.validation.status,
        auditObjectManifest: auditObjectManifest.entries.length,
        auditManifestReviewObjects: auditObjectManifest.reviewObjects.length,
        auditObjectManifestValidation: auditObjectManifest.validation.status,
        objectManifestInstantiationStatus: auditObjectManifest.instantiationStatus,
        productionDoctrine: Boolean(productionArtifacts.productionDoctrine),
        productionProfiles: productionArtifacts.productionProfiles.length,
        objectProductionProfiles: productionArtifacts.objectProductionProfiles.length,
        productionScheduleProjection: productionArtifacts.productionScheduleProjection.length,
        productionCostProjection: productionArtifacts.productionCostProjection.length,
        productionPaymentProjection: productionArtifacts.productionPaymentProjection.length,
        productionReviewObjects: productionArtifacts.productionReviewObjects.length,
        productionValidation: productionArtifacts.productionValidation.status,
        instantiatedSpineObjects: spineObjectInstantiation.instantiatedSpineObjects.length,
        spineObjectRegistry: Boolean(spineObjectInstantiation.spineObjectRegistry),
        spineObjectIdentityRegistry: Boolean(spineObjectInstantiation.spineObjectIdentityRegistry),
        constructionSegments: spineObjectInstantiation.constructionSegments.length,
        paymentSegments: spineObjectInstantiation.paymentSegments.length,
        executionZones: spineObjectInstantiation.executionZones.length,
        instantiationHealth: spineObjectInstantiation.instantiationHealth.instantiationStatus,
        productionBindings: spineObjectInstantiation.productionBindings.length,
        addressBindings: spineObjectInstantiation.addressBindings.length,
        kernelExecutionGraph: Boolean(kernelExecutionGraph),
        executionNodes: kernelExecutionGraph?.nodes.length ?? 0,
        executionEdges: kernelExecutionGraph?.edges.length ?? 0,
        executionExpectations: kernelExecutionGraph?.executionExpectations?.length ?? 0,
        closureLedgers: kernelExecutionGraph?.closureLedgers?.length ?? 0,
        constitutionalAssembly: asString((kernelExecutionGraph?.constitutionalAssembly as { status?: string } | undefined)?.status, "MISSING"),
        spineObjectDependencies: spineObjectDependencies.length,
        spineObjectCloseSequences: spineObjectCloseSequences.length,
        spineObjectEvidenceRequirements: spineObjectEvidenceRequirements.length,
        segmentValidationRules: segmentValidationRules.length,
        paymentEligibilityRules: paymentEligibilityRules.length,
        draftIofReadiness: draftIofReadiness.status,
        pricing: Boolean(pricing),
        productDoctrine: Boolean(input.productDoctrine),
        productDoctrineAssembly: Boolean(doctrineAssembly),
        requiredServices: input.productDoctrine?.requiredServices.length ?? 0,
        requiredAssets: input.productDoctrine?.requiredAssets.length ?? 0,
        productDoctrineEngineeringObjects: input.productDoctrine?.engineeringObjects.length ?? 0,
        executionSequences: input.productDoctrine?.executionSequences.length ?? 0,
        closeSequences: input.productDoctrine?.closeSequences.length ?? 0,
        evidenceRequirements: input.productDoctrine?.evidenceRequirements.length ?? 0,
        scopeVersionReadinessRequirements: input.productDoctrine?.scopeVersionReadinessRequirements.length ?? 0,
        doctrineObjectInstantiation: Boolean(doctrineObjectInstantiation),
        doctrineInstantiatedObjects: doctrineObjectInstantiation?.instantiatedObjects.length ?? 0,
        doctrineObjectAddresses: doctrineObjectInstantiation?.summary.addressCount ?? 0,
        doctrineStationLifecycleRules: doctrineObjectInstantiation?.stationLifecycleRules.length ?? 0,
        doctrineStationObjectIndex: doctrineObjectInstantiation?.stationObjectIndex.length ?? 0,
        doctrineDerivedSpans: doctrineObjectInstantiation?.derivedSpans.length ?? 0,
        doctrineLinearAssetSpanAttachments: doctrineObjectInstantiation?.linearAssetSpanAttachments.length ?? 0,
        doctrineProjectionEngine: Boolean(doctrineProjection),
        doctrineProjectionStatus: doctrineProjection?.validation.status ?? "MISSING",
        doctrineProjectionObjects: doctrineProjection?.projectedObjects.length ?? 0,
        doctrineProjectedSpans: doctrineProjection?.projectedSpans.length ?? 0,
        doctrineProjectedObjectManifest: Boolean(doctrineProjection?.projectedObjectManifest.manifestId),
        doctrineProjectionDiagnosticsStatus: doctrineProjection?.doctrineProjectionDiagnostics.status ?? "MISSING",
        doctrineProjectionExpectedObjects: doctrineProjection?.doctrineProjectionDiagnostics.expectedObjectCount ?? 0,
        geometryAuthorityStatus: doctrineProjection?.geometryAuthorityDiagnostics.status ?? "MISSING",
        independentSpanGeometryCount: doctrineProjection?.geometryAuthorityDiagnostics.independentSpanGeometryCount ?? 0,
        routeGeometryCoordinates: packageCenterline.length,
        validationOutputs: input.validation?.length ?? 0,
      },
      noEngineeringRegenerationRequired: true,
      noScopeVersionCreation: true,
    },
    manifest,
    dependencyGraph,
    validation,
    packageDifferences,
    proposedIofUnits,
    productDoctrine: input.productDoctrine ?? undefined,
    doctrineId: input.productDoctrine?.doctrineId,
    productDoctrineVersion: input.productDoctrine?.doctrineVersion,
    productDoctrineRules: input.productDoctrine?.rules,
    productDoctrineAssembly: doctrineAssembly ?? undefined,
    doctrineObjectInstantiation,
    doctrineObjectManifest: doctrineObjectInstantiation?.engineeringObjectManifest,
    engineeringObjectManifest: doctrineObjectInstantiation?.engineeringObjectManifest,
    doctrineObjectManifestId: doctrineObjectInstantiation?.engineeringObjectManifest.manifestId,
    engineeringObjectManifestId: doctrineObjectInstantiation?.engineeringObjectManifest.manifestId,
    objectManifestId: doctrineObjectInstantiation?.engineeringObjectManifest.manifestId ?? auditObjectManifest.manifestId,
    doctrineInstantiatedObjects: doctrineObjectInstantiation?.instantiatedObjects ?? [],
    doctrineObjectAddresses: doctrineObjectInstantiation?.instantiatedObjects.map((object) => object.address) ?? [],
    doctrineObjectDependencyGraph: doctrineObjectInstantiation?.dependencyGraph,
    doctrineObjectExecutionSequence: doctrineObjectInstantiation?.executionSequence,
    doctrineObjectCloseSequence: doctrineObjectInstantiation?.closeSequence,
    doctrineObjectPaymentSequence: doctrineObjectInstantiation?.paymentSequence,
    doctrineObjectEvidenceRequirements: doctrineObjectInstantiation?.evidenceRequirements,
    doctrineStationLifecycleRules: doctrineObjectInstantiation?.stationLifecycleRules,
    doctrineQuantityPlacement: doctrineObjectInstantiation?.quantityPlacement,
    doctrineStationObjectIndex: doctrineObjectInstantiation?.stationObjectIndex,
    doctrineSequencedActionObjects: doctrineObjectInstantiation?.sequencedActionObjects,
    doctrineDerivedSpans: doctrineObjectInstantiation?.derivedSpans,
    doctrineLinearAssetSpanAttachments: doctrineObjectInstantiation?.linearAssetSpanAttachments,
    doctrineEngineeringMovementPolicy: doctrineObjectInstantiation?.engineeringMovementPolicy,
    doctrineContinuousStationClosure: doctrineObjectInstantiation ? true : undefined,
    doctrineObjectInstantiationValidation: doctrineObjectInstantiation?.validation,
    doctrineObjectInstantiationSummary: doctrineObjectInstantiation?.summary,
    doctrineMarketplaceProjection: doctrineObjectInstantiation?.engineeringObjectManifest.marketplaceProjection,
    doctrineControlProjection: doctrineObjectInstantiation?.engineeringObjectManifest.controlProjection,
    doctrineFieldProjection: doctrineObjectInstantiation?.engineeringObjectManifest.fieldProjection,
    doctrineTwinProjection: doctrineObjectInstantiation?.engineeringObjectManifest.twinProjection,
    doctrineProjection,
    doctrineProjectionId: doctrineProjection?.projectionId,
    doctrineProjectionValidation: doctrineProjection?.validation,
    doctrineProjectionSummary: doctrineProjection?.summary,
    doctrineProjectionDiagnostics: doctrineProjection?.doctrineProjectionDiagnostics,
    geometryAuthorityDiagnostics: doctrineProjection?.geometryAuthorityDiagnostics,
    commercialAuditReconciliation: doctrineProjection?.commercialAuditReconciliation,
    constitutionalStateValidation: doctrineProjection?.constitutionalStateValidation,
    executionGraphId: doctrineProjection?.executionGraphId,
    lifecycleGraphId: doctrineProjection?.lifecycleGraphId,
    closureLedger: doctrineProjection?.closureLedger,
    closureLedgerId: doctrineProjection?.closureLedger?.closureLedgerId,
    iofPackageTwin: doctrineProjection?.iofPackageTwin,
    iofPackageTwinId: doctrineProjection?.iofPackageTwin?.twinProjectionId,
    workSegments: doctrineProjection?.workSegments,
    productDoctrineRegistry: input.productDoctrine?.registry,
    productDoctrineExecution: input.productDoctrine ? {
      requiredServices: input.productDoctrine.requiredServices,
      requiredAssets: input.productDoctrine.requiredAssets,
      engineeringObjects: input.productDoctrine.engineeringObjects,
      executionSequences: input.productDoctrine.executionSequences,
      closeSequences: input.productDoctrine.closeSequences,
      evidenceRequirements: input.productDoctrine.evidenceRequirements,
      certificationRules: input.productDoctrine.certificationRules,
      stationLevelLifecycleProjection: input.productDoctrine.stationLevelLifecycleProjection,
      scopeVersionReadinessRequirements: input.productDoctrine.scopeVersionReadinessRequirements,
      serviceVsAssetRule: "Services are not assets. Services consume labor, equipment, subcontractors, or professional effort. Assets are tangible infrastructure objects placed into the network and represented in the Twin.",
      noScopeVersionCreation: true,
    } : undefined,
    requiredServices: input.productDoctrine?.requiredServices,
    requiredAssets: input.productDoctrine?.requiredAssets,
    productDoctrineEngineeringObjects: input.productDoctrine?.engineeringObjects,
    executionSequences: input.productDoctrine?.executionSequences,
    closeSequences: input.productDoctrine?.closeSequences,
    closeSequenceReferences: input.productDoctrine?.closeSequences.map((sequence) => ({
      closeSequenceId: sequence.closeSequenceId,
      appliesTo: sequence.appliesTo,
      appliesToId: sequence.appliesToId,
    })),
    evidenceRequirements: input.productDoctrine?.evidenceRequirements,
    certificationRules: input.productDoctrine?.certificationRules,
    stationLevelLifecycleProjection: input.productDoctrine?.stationLevelLifecycleProjection,
    scopeVersionReadinessRequirements: input.productDoctrine?.scopeVersionReadinessRequirements,
    aSite: doctrineAssembly?.aSite,
    zSite: doctrineAssembly?.zSite,
    azSites: doctrineAssembly ? [doctrineAssembly.aSite, doctrineAssembly.zSite].filter(Boolean) : undefined,
    osrmRoute: doctrineAssembly?.osrmRoute ?? centerlineRoute,
    geometry: geoJsonLineString(packageCenterline),
    geometryCoordinateCount: packageCenterline.length,
    centerline: packageCenterline,
    centerlineId,
    centerlineRoute,
    spine,
    measuredCenterlineId: doctrineProjection?.measuredCenterline.measuredCenterlineId,
    measuredCenterline: doctrineProjection?.measuredCenterline,
    measuredSpine,
    stationProjectionId: doctrineProjection?.stationProjection.stationProjectionId,
    stationProjection: doctrineProjection?.stationProjection,
    stationGraphId: doctrineProjection?.stationGraph.stationGraphId ?? stationIndexedGraph?.graphId,
    stationGraph: doctrineProjection?.stationGraph,
    stationAuthorityIds: doctrineProjection?.stationAuthorityIds ?? (stationAuthority ? [stationAuthority.authorityId] : []),
    stationAuthorities: doctrineProjection?.stationAuthorities,
    stationAuthority,
    stationIndex: stationAuthority?.stationIndex,
    stationToCoordinateMap: stationAuthority?.stationToCoordinateMap,
    objectStationAttachments: doctrineProjection?.objectStationAttachments ?? objectStationAttachments,
    stationIndexedGraph: doctrineProjection?.stationGraph ?? stationIndexedGraph,
    stationObjectManifestId: doctrineProjection?.stationObjectManifest.manifestId,
    stationObjectManifest: doctrineProjection?.stationObjectManifest,
    projectedObjectManifestId: doctrineProjection?.projectedObjectManifest.manifestId,
    projectedObjectManifest: doctrineProjection?.projectedObjectManifest,
    projectedObjects: doctrineProjection?.projectedObjects,
    projectedSpans: doctrineProjection?.projectedSpans,
    spineAuditProjection,
    spineAuditAttachments: spineAuditProjection?.attachments ?? [],
    stationedExpectations: spineAuditProjection?.stationedExpectations ?? [],
    stationRangeExpectations: spineAuditProjection?.stationRangeExpectations ?? [],
    spineReviewObjects: spineAuditProjection?.spineReviewObjects ?? [],
    closureExpectations: spineAuditProjection?.closureExpectations ?? [],
    auditProjectionSummary: spineAuditProjection?.summary,
    objectAddressingDoctrine: objectAddressing?.objectAddressingDoctrine,
    stationAddressRegistry: objectAddressing?.stationAddressRegistry,
    objectAddresses: doctrineProjection?.objectAddresses ?? objectAddressing?.objectAddresses ?? [],
    unassignedReviewObjects: objectAddressing?.unassignedReviewObjects ?? [],
    addressedReviewObjects: objectAddressing?.addressedReviewObjects ?? [],
    addressValidation: objectAddressing?.addressValidation,
    addressAssignmentEvents: objectAddressing?.addressAssignmentEvents ?? [],
    addressProjectionSummary: objectAddressing?.addressProjectionSummary,
    objectAddressingMapLayers: objectAddressing?.mapLayers ?? [],
    spineObjectCatalog,
    spineObjectCatalogEntries: spineObjectCatalog.entries,
    spineObjectCatalogValidation: spineObjectCatalog.validation,
    spineObjectCatalogSummary: spineObjectCatalog.summary,
    auditObjectManifest,
    auditObjectManifestEntries: auditObjectManifest.entries,
    auditManifestReviewObjects: auditObjectManifest.reviewObjects,
    auditObjectManifestValidation: auditObjectManifest.validation,
    auditObjectManifestSummary: auditObjectManifest.summary,
    objectManifestSummary: {
      ...auditObjectManifest.summary,
      panelTitle: "Object Manifest Summary",
      instantiationPending: true,
      instantiationStatusLabel: "Instantiation Pending",
      noObjectsInstantiated: true,
      noScopeVersionCreation: true,
    },
    productionDoctrine: productionArtifacts.productionDoctrine,
    productionProfileLibrary: productionArtifacts.productionProfileLibrary,
    productionProfiles: productionArtifacts.productionProfiles,
    objectProductionProfiles: productionArtifacts.objectProductionProfiles,
    productionProjectionSummary: productionArtifacts.productionProjectionSummary,
    productionScheduleProjection: productionArtifacts.productionScheduleProjection,
    productionCostProjection: productionArtifacts.productionCostProjection,
    productionPaymentProjection: productionArtifacts.productionPaymentProjection,
    productionReviewObjects: productionArtifacts.productionReviewObjects,
    productionValidation: productionArtifacts.productionValidation,
    instantiatedSpineObjects: spineObjectInstantiation.instantiatedSpineObjects,
    spineObjectRegistry: spineObjectInstantiation.spineObjectRegistry,
    spineObjectIdentityRegistry: spineObjectInstantiation.spineObjectIdentityRegistry,
    constructionSegments: spineObjectInstantiation.constructionSegments,
    paymentSegments: spineObjectInstantiation.paymentSegments,
    executionZones: spineObjectInstantiation.executionZones,
    instantiationSummary: spineObjectInstantiation.instantiationSummary,
    instantiationHealth: spineObjectInstantiation.instantiationHealth,
    hierarchySummary: spineObjectInstantiation.hierarchySummary,
    productionBindings: spineObjectInstantiation.productionBindings,
    addressBindings: spineObjectInstantiation.addressBindings,
    kernelSpineObjectReferences,
    kernelExecutionGraph,
    executionNodes: kernelExecutionGraph?.nodes ?? [],
    executionEdges: kernelExecutionGraph?.edges ?? [],
    executionGraphProjections: kernelExecutionGraph?.projections ?? [],
    executionGraphValidation: kernelExecutionGraph?.validation,
    executionGraphSummary: kernelExecutionGraph?.summary,
    executionExpectations: kernelExecutionGraph?.executionExpectations ?? [],
    closureLedgers: kernelExecutionGraph?.closureLedgers ?? [],
    closureReplaySummary: kernelExecutionGraph?.closureReplaySummary,
    constitutionalClosureSummary: kernelExecutionGraph?.constitutionalClosureSummary,
    constitutionalAssembly: kernelExecutionGraph?.constitutionalAssembly,
    spineObjectDependencies,
    spineObjectCloseSequences,
    spineObjectEvidenceRequirements,
    segmentValidationRules,
    paymentEligibilityRules,
    draftIofReadiness,
    commercialObjectPlacementHistory: [],
    customerRequestedMoves: [],
    commercialImpactSummary: {
      status: "NO_COMMERCIAL_STATION_MOVES",
      requiresEngineeringReview: "NO",
      noCertification: true,
      noScopeVersionCreation: true,
    },
    commercialImpactSummaries: [],
    commercialReviewRevision: 0,
    routeSegments: doctrineAssembly?.routeSegments,
    conduitAssembly: doctrineAssembly?.conduitAssembly,
    fiberAssembly: doctrineAssembly?.fiberAssembly,
    structureAssembly: doctrineAssembly?.structureAssembly,
    crossingAssembly: doctrineAssembly?.crossingAssembly,
    quantitySummary: doctrineAssembly?.quantitySummary,
    pricingSummary: doctrineAssembly?.pricingSummary ?? pricing,
    validationSummary: doctrineAssembly?.validationSummary,
    engineeringManifest: doctrineAssembly?.engineeringManifest,
    route: doctrineAssembly?.routeSegments ?? draft?.routeSegments ?? (quickQuote ? [{ routeId: quickQuote.candidateId, routeMiles: quickQuote.routeMiles, geometry: quickQuote.geometry }] : []),
    stations,
    structures,
    dependencies,
    objects: doctrineObjectInstantiation?.instantiatedObjects ?? packageObjects,
    relationships: runtimeRelationshipIds.map((relationshipId) => ({ relationshipId, source: "proposal.runtimeRelationshipIds" })),
    evidence: runtimeEvidenceIds.map((evidenceId) => ({ evidenceId, source: "proposal.runtimeEvidenceIds" })),
    proposalDocumentReferences,
    customerRequests: input.designArtifacts ?? [],
    commercialNotes: [
      "Draft IOF Package assembled deterministically from Commercial workspace artifacts.",
      "Engineering should review this package directly and must not regenerate it from Proposal state.",
    ],
    engineeringNotes: [
      "All IOF units are proposed only.",
      "Engineering certification is required before customer commitment and references the Draft IOF Package as the single engineering truth.",
    ],
    engineeringRequirements,
    runtimeObjectIds,
    runtimeRelationshipIds,
    runtimeEvidenceIds,
    existingInventoryReferences,
    customerDesignReferences,
    partnerInventoryReferences: proposal.partnerInventoryReferences,
    marketplaceAssetReferences: proposal.marketplaceAssetReferences,
    newInfrastructureRequired: proposal.newInfrastructureRequired,
    customerTwinReference: input.customerTwinReference ?? proposal.customerTwinReference ?? `CUSTOMER-TWIN-${input.accountId ?? customerId}`,
    geometryReferences,
    historyIds: uniqueStrings([proposal.historyIds, `${packageId}:HISTORY:ASSEMBLED`]),
    noScopeVersionCreation: true,
    noMarketplaceCreation: true,
    noControlCreation: true,
    noFieldCreation: true,
    noContractCreation: true,
    noSofCreation: true,
    immutable: false,
    createdAt: asString(proposal.createdAt, timestamp),
    updatedAt: timestamp,
  };
}
