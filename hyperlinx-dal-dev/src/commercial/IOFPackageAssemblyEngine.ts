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
  pricing: unknown;
  validation?: ValidationInput[];
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
      status: args.geometryReferences.length > 0 ? "PASS" : "WARNING",
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
  const stations = buildStationObjects(packageId, input.commercialDraft, input.stationing);
  const structures = buildStructureObjects(packageId, input.commercialDraft);
  const dependencies = uniqueStrings([
    `${packageId}:DEPENDENCY:PROPOSAL`,
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
  const pricing = input.pricing ?? proposal.pricingSummary ?? input.commercialDraft?.transparentEstimate ?? input.quickQuote;
  const validation = buildValidation({
    packageId,
    timestamp,
    proposal,
    units: proposedIofUnits,
    geometryReferences,
    pricing,
    validation: input.validation,
  });
  const readiness = packageReadiness(validation, proposedIofUnits);
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
      routeMiles: draft?.routeMiles ?? quickQuote?.routeMiles,
      routeFeet: draft?.routeFeet,
      segmentCount: draft?.routeSegments.length ?? (quickQuote ? 1 : 0),
      stationCount: stations.length,
      constructionMix: draft?.constructionMix,
      graphSummary: graphSummary(input.graph),
      designArtifactCount: input.designArtifacts?.length ?? 0,
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
        pricing: Boolean(pricing),
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
    route: draft?.routeSegments ?? (quickQuote ? [{ routeId: quickQuote.candidateId, routeMiles: quickQuote.routeMiles, geometry: quickQuote.geometry }] : []),
    stations,
    structures,
    dependencies,
    objects: input.objectInventory ?? [],
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
      "Engineering certification is required before Certified IOF Package or ScopeVersion creation.",
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
