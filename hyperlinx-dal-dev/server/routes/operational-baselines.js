import { createHash } from "node:crypto";
import {
  DIRS,
  errorResponse,
  handleOptions,
  hydrateIofProjectionArtifacts,
  jsonResponse,
  listRecords,
  loadRecord,
} from "./_shared.js";
import { requireRuntimeUser } from "./authority.js";

const BASE = "/api/operational-baselines";
const LENS_IDS = new Set(["MARKETPLACE", "CONTROL", "FIELD", "TWIN"]);

const arr = (value) => Array.isArray(value) ? value : [];
const rec = (value) => value && typeof value === "object" && !Array.isArray(value) ? value : {};
const txt = (...values) => values.map((value) => String(value ?? "").trim()).find(Boolean) ?? "";
const unique = (values) => [...new Set(arr(values).map((value) => String(value ?? "").trim()).filter(Boolean))];

function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function hash(value) {
  return createHash("sha256").update(stable(value)).digest("hex");
}

function fail(code, message, details = {}) {
  const error = new Error(message);
  error.status = 409;
  error.code = code;
  error.details = details;
  throw error;
}

function required(value, code, message) {
  if (value === undefined || value === null || value === "" || (Array.isArray(value) && !value.length)) fail(code, message);
  return value;
}

function same(expected, actual, code, label) {
  required(expected, `${code}_EXPECTED_MISSING`, `${label} is missing from ScopeVersion authority.`);
  required(actual, `${code}_RESOLVED_MISSING`, `${label} could not be resolved from its governed repository.`);
  if (String(expected) !== String(actual)) fail(code, `${label} does not match the exact ScopeVersion authority.`, { expected, actual });
}

function idList(values, keys) {
  return unique(arr(values).map((value) => {
    const item = rec(value);
    return txt(...keys.map((key) => item[key]));
  }));
}

export const OPERATIONAL_LENS_REGISTRY = Object.freeze([
  { lensId: "MARKETPLACE", lensType: "FULFILLMENT", supportedActions: ["INSPECT_DEMAND", "CREATE_FULFILLMENT_EVIDENCE"], requiredState: "AUTHORIZED", createsEvidence: true, createsOperationalState: true, createsCloseAuthority: false, mutatesSpine: false },
  { lensId: "CONTROL", lensType: "EXECUTION_CONTROL", supportedActions: ["INSPECT_WORK", "SCHEDULE", "HOLD", "RELEASE", "SEQUENCE"], requiredState: "AUTHORIZED", createsEvidence: true, createsOperationalState: true, createsCloseAuthority: false, mutatesSpine: false },
  { lensId: "FIELD", lensType: "FIELD_EXECUTION", supportedActions: ["INSPECT_ASSIGNMENT", "RECORD_ACTIVITY", "SUBMIT_EVIDENCE"], requiredState: "AUTHORIZED", createsEvidence: true, createsOperationalState: true, createsCloseAuthority: false, mutatesSpine: false, completionAuthority: "NOT_CLOSE_AUTHORITY" },
  { lensId: "TWIN", lensType: "OPERATIONAL_PROJECTION", supportedActions: ["INSPECT_AUTHORIZED_STATE", "INSPECT_REALIZED_STATE"], requiredState: "AUTHORIZED", createsEvidence: false, createsOperationalState: false, createsCloseAuthority: false, mutatesSpine: false, mutationAuthority: "NONE" },
]);

async function exactRecord(dir, id, code, label) {
  required(id, `${code}_REFERENCE_MISSING`, `${label} reference is required.`);
  const record = await loadRecord(dir, id).catch(() => null);
  if (!record) fail(code, `${label} ${id} was not found.`);
  return record;
}

async function exactLinkedRecord(dir, predicate, code, label) {
  const matches = (await listRecords(dir)).filter(predicate);
  if (matches.length !== 1) fail(code, `${label} must resolve to exactly one governed record.`, { matchCount: matches.length });
  return matches[0];
}

function routeAuthority(scope, sourceDraft) {
  const truth = rec(scope.canonicalTruth);
  const diagnostics = rec(scope.geometryAuthorityDiagnostics ?? truth.geometryAuthorityDiagnostics);
  const network = rec(truth.networkBasis);
  return {
    routeId: txt(network.routeId, diagnostics.routeRepositoryId, sourceDraft.routeRepositoryId),
    routeRevision: txt(diagnostics.routeRevision, sourceDraft.routeRevision, scope.routeRevision, "1"),
    geometryId: txt(diagnostics.routeGeometryId, diagnostics.geometryId, sourceDraft.routeGeometryId, sourceDraft.geometryId),
    geometryHash: txt(diagnostics.geometryHash, sourceDraft.geometryHash, rec(truth.engineeringBasis).geometryHash),
    spineId: txt(sourceDraft.measuredCenterlineId, truth.measuredCenterlineId, scope.measuredCenterlineId),
  };
}

function proposalRevision(proposal, revisionId) {
  const revisions = [
    ...arr(proposal.revisions),
    ...arr(proposal.proposalRevisions),
    rec(proposal.currentRevision),
    rec(proposal.savedRevision),
  ].filter((value) => Object.keys(rec(value)).length);
  return revisions.find((revision) => txt(revision.proposalRevisionId, revision.revisionId, revision.id) === revisionId) ?? null;
}

function operationalReferences({ scope, certified, serviceOrder, sourceDraft, authorizedTwin }) {
  const truth = rec(scope.canonicalTruth);
  const engineeringTruth = rec(truth.engineeringTruthAuthority);
  const artifactRefs = rec(sourceDraft.iofArtifactRepositoryReferences);
  const artifact = (key) => rec(artifactRefs[key]);
  const route = routeAuthority(scope, sourceDraft);
  return {
    scopeVersion: { id: scope.scopeVersionId, revision: scope.revision ?? 1, hash: hash(scope), repository: "scopeversions" },
    certifiedIof: { id: scope.certifiedIofPackageId, hash: txt(certified.certificationHash, certified.certifiedPackageHash, certified.packageHash), repository: "certified-iof-packages" },
    serviceOrder: { id: scope.serviceOrderId, hash: txt(serviceOrder.documentHash, serviceOrder.serviceOrderHash), revision: serviceOrder.documentRevision, repository: "service-orders" },
    route: { id: route.routeId, revision: route.routeRevision, geometryId: route.geometryId, geometryHash: route.geometryHash, repository: "commercial-routes" },
    spine: { id: route.spineId, ...artifact("measuredCenterline"), repository: "measured-centerlines" },
    stationAuthority: { ids: unique(scope.stationAuthorityIds ?? truth.stationAuthorityIds), projection: artifact("stationProjection"), graph: artifact("stationGraph") },
    objectManifest: { id: scope.projectedObjectManifestId ?? truth.projectedObjectManifestId, ...artifact("projectedObjectManifest"), repository: "projected-object-manifests" },
    closureLedger: { id: scope.closureLedgerId ?? truth.closureLedgerId, ...artifact("closureLedger"), repository: "closure-ledgers" },
    executionGraph: { id: scope.executionGraphId ?? truth.executionGraphId },
    lifecycleGraph: { id: scope.lifecycleGraphId ?? truth.lifecycleGraphId },
    authorizedTwin: { id: authorizedTwin.twinStateId, logicalTwinId: scope.iofPackageTwinId ?? truth.iofPackageTwinId, hash: authorizedTwin.twinStateHash, repository: "iof-package-twins" },
    engineering: {
      packageId: txt(engineeringTruth.engineeringPackageId, sourceDraft.engineeringPackageId),
      revisionId: txt(engineeringTruth.engineeringRevisionId, certified.engineeringRevisionId),
      approvalId: txt(engineeringTruth.engineeringApprovalId, certified.engineeringApprovalId),
    },
  };
}

export function projectOperationalBaseline(baseline, lensId) {
  const normalizedLensId = String(lensId ?? "").toUpperCase();
  const capability = OPERATIONAL_LENS_REGISTRY.find((lens) => lens.lensId === normalizedLensId);
  if (!capability) fail("OPERATIONAL_LENS_NOT_REGISTERED", `Operational lens ${normalizedLensId || "<missing>"} is not registered.`);
  return {
    projectionContractVersion: "1",
    lens: capability,
    baselineIdentity: baseline.baselineIdentity,
    executionAuthority: baseline.executionAuthority,
    project: baseline.project,
    lineage: baseline.lineage,
    route: baseline.route,
    authorityCensus: baseline.authorityCensus,
    identities: baseline.identities,
    initialState: baseline.initialState,
    closeBoundary: baseline.closeBoundary,
    projectionOnly: true,
  };
}

export async function resolveOperationalBaseline(scopeVersionId) {
  const scope = await exactRecord(DIRS.scopeVersions, scopeVersionId, "SCOPEVERSION_NOT_FOUND", "ScopeVersion");
  const truth = rec(scope.canonicalTruth);
  if (scope.isImmutable !== true || scope.orderForExecution !== true || String(scope.status).toUpperCase() !== "CERTIFIED") {
    fail("SCOPEVERSION_NOT_AUTHORIZED", "Operational bootstrap requires an immutable certified ScopeVersion Order for Execution.");
  }

  const certified = await exactRecord(DIRS.certifiedIofPackages, scope.certifiedIofPackageId, "CERTIFIED_IOF_NOT_FOUND", "Certified IOF");
  const serviceOrder = await exactRecord(DIRS.serviceOrders, scope.serviceOrderId, "SERVICE_ORDER_NOT_FOUND", "Service Order");
  const sourceDraftId = txt(certified.sourceDraftPackageId, certified.certifiedDraftIofPackageId, scope.certifiedDraftIofPackageId, scope.technicalSourcePackageId);
  const sourceDraftRaw = await exactRecord(DIRS.iofPackages, sourceDraftId, "DRAFT_IOF_NOT_FOUND", "Draft IOF source package");
  const sourceDraft = await hydrateIofProjectionArtifacts(sourceDraftRaw, { strict: true });
  const references = operationalReferences({ scope, certified, serviceOrder, sourceDraft, authorizedTwin: {} });
  const route = await exactRecord(DIRS.commercialRoutes, references.route.id, "ROUTE_NOT_FOUND", "Commercial Route");
  const account = await exactRecord(DIRS.accounts, scope.accountId, "ACCOUNT_NOT_FOUND", "Account");
  const opportunity = await exactRecord(DIRS.commercialOpportunities, scope.opportunityId, "OPPORTUNITY_NOT_FOUND", "Opportunity");
  const proposal = await exactRecord(DIRS.proposalDrafts, scope.proposalId, "PROPOSAL_NOT_FOUND", "Proposal");

  const proposalRevisionId = txt(truth.proposalRevisionId, sourceDraft.proposalRevisionId, certified.proposalRevisionId);
  const proposalHash = txt(truth.proposalHash, sourceDraft.proposalHash, certified.proposalHash);
  const revision = proposalRevision(proposal, proposalRevisionId);
  if (!revision) fail("PROPOSAL_REVISION_NOT_FOUND", `Exact Proposal Revision ${proposalRevisionId} was not found.`);
  same(proposalHash, txt(revision.proposalHash, revision.revisionHash, revision.hash), "PROPOSAL_HASH_MISMATCH", "Proposal Revision hash");

  let engineeringPackageId = txt(references.engineering.packageId, certified.engineeringPackageId);
  const engineeringPackage = engineeringPackageId
    ? await exactRecord(DIRS.engineeringPackages, engineeringPackageId, "ENGINEERING_PACKAGE_NOT_FOUND", "Engineering Package")
    : await exactLinkedRecord(
      DIRS.engineeringPackages,
      (item) => txt(item.draftIofPackageId, item.draftIOFPackageId, item.sourceDraftPackageId, item.packageId) === sourceDraftId,
      "ENGINEERING_PACKAGE_LINKAGE_UNRESOLVED",
      "Engineering Package linked to the exact Draft IOF",
    );
  engineeringPackageId = txt(engineeringPackage.engineeringPackageId, engineeringPackage.packageId);
  required(engineeringPackageId, "ENGINEERING_PACKAGE_ID_MISSING", "Resolved Engineering Package has no immutable identity.");
  const engineeringRevisionId = txt(references.engineering.revisionId, certified.engineeringRevisionId, engineeringPackage.engineeringRevisionId, engineeringPackage.currentRevisionId);
  same(engineeringRevisionId, txt(engineeringPackage.engineeringRevisionId, engineeringPackage.currentRevisionId, certified.engineeringRevisionId), "ENGINEERING_REVISION_MISMATCH", "Engineering Revision identity");
  let engineeringApprovalId = txt(references.engineering.approvalId, certified.engineeringApprovalId, engineeringPackage.engineeringApprovalId, engineeringPackage.approvalId);
  const approval = engineeringApprovalId
    ? await exactRecord(DIRS.engineeringApprovals, engineeringApprovalId, "ENGINEERING_APPROVAL_NOT_FOUND", "Engineering Approval")
    : await exactLinkedRecord(
      DIRS.engineeringApprovals,
      (item) => txt(item.engineeringPackageId, item.packageId) === engineeringPackageId && txt(item.engineeringRevisionId, item.revisionId) === engineeringRevisionId,
      "ENGINEERING_APPROVAL_LINKAGE_UNRESOLVED",
      "Engineering Approval linked to the exact Engineering Revision",
    );
  engineeringApprovalId = txt(approval.engineeringApprovalId, approval.approvalId);
  required(engineeringApprovalId, "ENGINEERING_APPROVAL_ID_MISSING", "Resolved Engineering Approval has no immutable identity.");

  same(scope.organizationId, txt(account.organizationId, account.tenantId), "ACCOUNT_ORGANIZATION_MISMATCH", "Account organization");
  same(scope.organizationId, txt(opportunity.organizationId, opportunity.tenantId), "OPPORTUNITY_ORGANIZATION_MISMATCH", "Opportunity organization");
  same(scope.opportunityId, txt(sourceDraft.opportunityId), "DRAFT_IOF_OPPORTUNITY_MISMATCH", "Draft IOF opportunity");
  same(scope.certifiedIofPackageId, txt(certified.certifiedPackageId, certified.certifiedIofPackageId), "CERTIFIED_IOF_ID_MISMATCH", "Certified IOF identity");
  same(scope.serviceOrderId, txt(serviceOrder.serviceOrderId), "SERVICE_ORDER_ID_MISMATCH", "Service Order identity");
  same(txt(certified.certificationHash, certified.certifiedPackageHash), txt(truth.digitalCertificationMetadata?.certificationHash, truth.certificationHash, certified.certificationHash, certified.certifiedPackageHash), "CERTIFIED_IOF_HASH_MISMATCH", "Certified IOF hash");

  const sourceRoute = routeAuthority(scope, sourceDraft);
  same(sourceRoute.routeRevision, txt(route.routeRevision, route.revision, "1"), "ROUTE_REVISION_MISMATCH", "Route revision");
  const resolvedGeometryId = txt(sourceRoute.geometryId, route.routeGeometryId, route.geometryId);
  required(resolvedGeometryId, "GEOMETRY_ID_MISSING", "Exact Commercial Route geometry identity is required.");
  same(resolvedGeometryId, txt(route.routeGeometryId, route.geometryId), "GEOMETRY_ID_MISMATCH", "Geometry identity");
  same(sourceRoute.geometryHash, txt(route.geometryHash, route.routeGeometryHash), "GEOMETRY_HASH_MISMATCH", "Geometry hash");

  const stationProjection = rec(sourceDraft.stationProjection);
  const stationGraph = rec(sourceDraft.stationGraph);
  const objectManifest = rec(sourceDraft.projectedObjectManifest);
  const closureLedger = rec(sourceDraft.closureLedger);
  const sourceTwin = rec(sourceDraft.iofPackageTwin);
  const stations = arr(stationProjection.stations).length ? arr(stationProjection.stations) : arr(sourceDraft.stations);
  const objects = arr(objectManifest.projectedObjects).length ? arr(objectManifest.projectedObjects) : arr(sourceDraft.projectedObjects);
  const relationships = arr(objectManifest.relationships).length ? arr(objectManifest.relationships) : [...arr(objectManifest.projectedSpans), ...arr(objectManifest.objectAddresses)];
  const workSegments = arr(objectManifest.workSegments).length ? arr(objectManifest.workSegments) : arr(sourceDraft.workSegments);
  required(references.spine.id, "SPINE_ID_MISSING", "Governed spine identity is required.");
  required(references.stationAuthority.ids, "STATION_AUTHORITY_MISSING", "Station Authority references are required.");
  required(stations, "STATIONS_MISSING", "Station Authority must resolve governed stations.");
  required(objects, "OBJECT_MANIFEST_MISSING", "Object Manifest must resolve authorized objects.");
  required(relationships, "RELATIONSHIPS_MISSING", "Object Manifest must resolve authorized relationships or spans.");
  required(workSegments, "WORK_SEGMENTS_MISSING", "Object Manifest must resolve authorized work segments.");
  same(references.executionGraph.id, txt(objectManifest.executionGraphId, sourceTwin.executionGraphId, closureLedger.executionGraphId), "EXECUTION_GRAPH_MISMATCH", "Execution Graph identity");
  same(references.lifecycleGraph.id, txt(objectManifest.lifecycleGraphId, sourceTwin.lifecycleGraphId, closureLedger.lifecycleGraphId), "LIFECYCLE_GRAPH_MISMATCH", "Lifecycle Graph identity");
  same(references.closureLedger.id, txt(closureLedger.closureLedgerId, closureLedger.ledgerId), "CLOSURE_LEDGER_MISMATCH", "Closure Ledger identity");

  const twins = await listRecords(DIRS.iofPackageTwins);
  const authorizedTwin = twins.find((item) => item?.scopeVersionId === scope.scopeVersionId && item?.twinState === "AUTHORIZED");
  if (!authorizedTwin) fail("AUTHORIZED_TWIN_NOT_FOUND", "Authorized IOF Package Twin was not found for the ScopeVersion.");
  same(scope.iofPackageTwinId ?? truth.iofPackageTwinId, txt(authorizedTwin.logicalTwinId, authorizedTwin.twinId), "AUTHORIZED_TWIN_MISMATCH", "Authorized Twin identity");

  const exactReferences = operationalReferences({ scope, certified, serviceOrder, sourceDraft, authorizedTwin });
  exactReferences.route.geometryId = resolvedGeometryId;
  const identitySet = {
    stationIds: idList(stations, ["stationId", "id"]),
    objectIds: idList(objects, ["objectId", "id"]),
    relationshipIds: idList(relationships, ["relationshipId", "spanId", "objectAddressId", "addressId", "attachmentId", "id"]),
    workSegmentIds: idList(workSegments, ["workSegmentId", "closureSegmentId", "segmentId", "id"]),
  };
  if (identitySet.stationIds.length !== stations.length) fail("STATION_IDENTITY_INCOMPLETE", "Every governed station must have an immutable identity.");
  if (identitySet.objectIds.length !== objects.length) fail("OBJECT_IDENTITY_INCOMPLETE", "Every authorized object must have an immutable identity.");
  if (identitySet.relationshipIds.length !== relationships.length) fail("RELATIONSHIP_IDENTITY_INCOMPLETE", "Every authorized relationship/span must have an immutable identity.");
  if (identitySet.workSegmentIds.length !== workSegments.length) fail("WORK_SEGMENT_IDENTITY_INCOMPLETE", "Every authorized work segment must have an immutable identity.");

  const referenceHashSet = {
    scopeVersionHash: exactReferences.scopeVersion.hash,
    certifiedIofHash: exactReferences.certifiedIof.hash,
    serviceOrderHash: exactReferences.serviceOrder.hash,
    geometryHash: exactReferences.route.geometryHash,
    stationAuthorityHash: hash({ refs: exactReferences.stationAuthority, ids: identitySet.stationIds }),
    objectManifestHash: txt(exactReferences.objectManifest.hash, hash({ objects: identitySet.objectIds, relationships: identitySet.relationshipIds, workSegments: identitySet.workSegmentIds })),
    executionGraphHash: hash({ id: exactReferences.executionGraph.id, workSegmentIds: identitySet.workSegmentIds }),
    lifecycleGraphHash: hash({ id: exactReferences.lifecycleGraph.id, objectIds: identitySet.objectIds }),
    closureLedgerHash: txt(exactReferences.closureLedger.hash, hash(closureLedger)),
  };
  const baselineReferenceSet = { references: exactReferences, identities: identitySet, hashes: referenceHashSet };
  const operationalBaselineHash = hash(baselineReferenceSet);
  const baselineIdentity = {
    operationalBaselineId: `OPERATIONAL-BASELINE-${scope.scopeVersionId}`,
    operationalBaselineHash,
    contractVersion: "1",
    deterministic: true,
    persisted: false,
    sourceAuthority: "SCOPEVERSION_ORDER_FOR_EXECUTION",
  };
  const baseline = {
    baselineIdentity,
    executionAuthority: { scopeVersionId: scope.scopeVersionId, scopeVersionRevision: scope.revision ?? 1, scopeVersionHash: exactReferences.scopeVersion.hash, state: "AUTHORIZED", orderForExecution: true, immutable: true },
    project: { organizationId: scope.organizationId, customerId: scope.customerId, accountId: scope.accountId, accountName: txt(account.name, account.accountName), opportunityId: scope.opportunityId, opportunityName: txt(opportunity.opportunityName, opportunity.name), productId: scope.productId, productName: scope.productName },
    lineage: {
      proposalId: scope.proposalId, proposalRevisionId, proposalHash,
      engineeringPackageId, engineeringRevisionId, engineeringApprovalId,
      certifiedIofPackageId: scope.certifiedIofPackageId, certifiedIofHash: exactReferences.certifiedIof.hash,
      serviceOrderId: scope.serviceOrderId, serviceOrderHash: exactReferences.serviceOrder.hash,
      productDoctrineId: txt(sourceDraft.productDoctrineId, rec(sourceDraft.productDoctrineAssembly).productDoctrineId, rec(sourceDraft.projectConfiguration).productDoctrineId),
      productDoctrineVersion: txt(sourceDraft.productDoctrineVersion, rec(sourceDraft.productDoctrineAssembly).productDoctrineVersion),
      productDoctrineHash: txt(sourceDraft.productDoctrineHash, rec(sourceDraft.iofArtifactRepositoryReferences).productDoctrineAssembly?.hash),
    },
    references: exactReferences,
    route: exactReferences.route,
    authorityCensus: { stations: stations.length, objects: objects.length, relationships: relationships.length, workSegments: workSegments.length, closureEvents: arr(closureLedger.events).length },
    identities: identitySet,
    hashes: referenceHashSet,
    initialState: { execution: "AUTHORIZED", objects: "AUTHORIZED_NOT_REALIZED", stations: "AUTHORIZED_NOT_REALIZED", twin: "AUTHORIZED_NOT_REALIZED", physicallyComplete: false, realized: false },
    evidenceRequirements: arr(sourceDraft.evidenceRequirements),
    certificationRequirements: arr(sourceDraft.certificationRequirements),
    closureRequirements: arr(closureLedger.closureRequirements ?? sourceDraft.closureRequirements),
    lensRegistry: OPERATIONAL_LENS_REGISTRY,
    closeBoundary: { mutationAuthority: "GOVERNED_CLOSE_ONLY", operationalLensesMutateSpine: false, fieldCompletionIsClose: false, controlCompletionIsClose: false, marketplaceFulfillmentIsClose: false, twinMutatesItself: false },
    referenceOnly: true,
    reconstructable: true,
    noUpstreamMutation: true,
  };
  return Object.freeze(baseline);
}

export async function handleOperationalBaselines(req, res, pathname) {
  if (pathname !== BASE && !pathname.startsWith(`${BASE}/`)) return false;
  if (handleOptions(req, res)) return true;
  const user = requireRuntimeUser(req, res);
  if (!user) return true;
  if (req.method !== "GET") {
    errorResponse(res, 405, "Operational Baseline is a read-only deterministic projection. Method not allowed.");
    return true;
  }
  const parts = pathname.slice(BASE.length).split("/").filter(Boolean).map(decodeURIComponent);
  const scopeVersionId = parts[0] ?? "";
  const lensId = parts[1] === "lenses" ? String(parts[2] ?? "").toUpperCase() : "";
  try {
    required(scopeVersionId, "SCOPEVERSION_ID_REQUIRED", "scopeVersionId is required for operational bootstrap.");
    if (lensId && !LENS_IDS.has(lensId)) fail("OPERATIONAL_LENS_NOT_REGISTERED", `Operational lens ${lensId} is not registered.`);
    const baseline = await resolveOperationalBaseline(scopeVersionId);
    if (baseline.project.organizationId !== user.organizationId) fail("OPERATIONAL_ORGANIZATION_SCOPE_REJECTED", "ScopeVersion is outside the authenticated organization.");
    jsonResponse(res, 200, lensId ? { operationalProjection: projectOperationalBaseline(baseline, lensId) } : { operationalBaseline: baseline });
  } catch (error) {
    jsonResponse(res, Number(error?.status ?? 409), {
      error: error?.code ?? "OPERATIONAL_BASELINE_INTEGRITY_FAILURE",
      message: error instanceof Error ? error.message : String(error),
      predicates: [{ predicate: error?.code ?? "OPERATIONAL_BASELINE_INTEGRITY_FAILURE", status: "FAIL", details: error?.details ?? {} }],
      scopeVersionId,
    });
  }
  return true;
}
