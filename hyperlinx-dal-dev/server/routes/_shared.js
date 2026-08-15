import { mkdir, open, readdir, readFile, rename, rm } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  listPostgresRecords,
  loadPostgresRecord,
  mirrorRecord,
  mirrorRecordBestEffort,
  postgresReadsEnabled,
  postgresShadowEnabled,
} from "../persistence/postgres/repositoryAdapter.js";

export const ROUTES_DIR = path.dirname(fileURLToPath(import.meta.url));
export const SERVER_ROOT = path.resolve(ROUTES_DIR, "..");
export const PROJECT_ROOT = path.resolve(SERVER_ROOT, "..");

export const PORT = Number(process.env.DAL_PORT ?? process.env.PORT ?? 3001);
export const DATA_ROOT = process.env.DAL_DATA_ROOT
  ? path.resolve(process.env.DAL_DATA_ROOT)
  : path.join(SERVER_ROOT, "data");

export const DIRS = {
  scopeVersions: path.join(DATA_ROOT, "scopeversions"),
  candidateSites: path.join(DATA_ROOT, "candidate-sites"),
  opportunitySeeds: path.join(DATA_ROOT, "opportunity-seeds"),
  inventoryGraphs: path.join(DATA_ROOT, "inventory-graphs"),
  marketplaceQuotes: path.join(DATA_ROOT, "marketplace-quotes"),
  marketplacePackages: path.join(DATA_ROOT, "marketplace-packages"),
  marketplaceResponses: path.join(DATA_ROOT, "marketplace-responses"),
  marketplaceAllocations: path.join(DATA_ROOT, "marketplace-allocations"),
  marketplaceAwards: path.join(DATA_ROOT, "marketplace-awards"),
  marketplaceObservations: path.join(DATA_ROOT, "marketplace-observations"),
  products: path.join(DATA_ROOT, "products"),
  fulfillmentPlans: path.join(DATA_ROOT, "fulfillment-plans"),
  iofPackages: path.join(DATA_ROOT, "iof-packages"),
  engineeringObjectManifests: path.join(DATA_ROOT, "engineering-object-manifests"),
  stationProjections: path.join(DATA_ROOT, "station-projections"),
  stationGraphs: path.join(DATA_ROOT, "station-graphs"),
  stationObjectManifests: path.join(DATA_ROOT, "station-object-manifests"),
  measuredCenterlines: path.join(DATA_ROOT, "measured-centerlines"),
  projectedObjectManifests: path.join(DATA_ROOT, "projected-object-manifests"),
  closureLedgers: path.join(DATA_ROOT, "closure-ledgers"),
  iofPackageTwins: path.join(DATA_ROOT, "iof-package-twins"),
  productDoctrineAssemblies: path.join(DATA_ROOT, "product-doctrine-assemblies"),
  projectConfigurations: path.join(DATA_ROOT, "project-configurations"),
  quantityReconciliations: path.join(DATA_ROOT, "quantity-reconciliations"),
  engineeringIntakes: path.join(DATA_ROOT, "engineering-intakes"),
  engineeringBaselines: path.join(DATA_ROOT, "engineering-baselines"),
  engineeringChangeSets: path.join(DATA_ROOT, "engineering-change-sets"),
  engineeringApprovals: path.join(DATA_ROOT, "engineering-approvals"),
  engineeringPackages: path.join(DATA_ROOT, "engineering-packages"),
  certificationLedgers: path.join(DATA_ROOT, "certification-ledgers"),
  certifiedIofPackages: path.join(DATA_ROOT, "certified-iof-packages"),
  executionAuthorizationCertificates: path.join(DATA_ROOT, "execution-authorization-certificates"),
  closeEvents: path.join(DATA_ROOT, "close-events"),
  certifiedRoutes: path.join(DATA_ROOT, "certified-routes"),
  controlWorkItems: path.join(DATA_ROOT, "control-work-items"),
  fieldClosures: path.join(DATA_ROOT, "field-closures"),
  accounts: path.join(DATA_ROOT, "accounts"),
  contacts: path.join(DATA_ROOT, "contacts"),
  customerDesignImports: path.join(DATA_ROOT, "customer-design-imports"),
  commercialOpportunities: path.join(DATA_ROOT, "commercial-opportunities"),
  commercialRoutes: path.join(DATA_ROOT, "commercial-routes"),
  commercialRevisions: path.join(DATA_ROOT, "commercial-revisions"),
  commercialChangeSets: path.join(DATA_ROOT, "commercial-change-sets"),
  commercialReleasePackages: path.join(DATA_ROOT, "commercial-release-packages"),
  engineeringDrafts: path.join(DATA_ROOT, "engineering-drafts"),
  proposalDrafts: path.join(DATA_ROOT, "proposal-drafts"),
  serviceOrders: path.join(DATA_ROOT, "service-orders"),
  customerSignatures: path.join(DATA_ROOT, "customer-signatures"),
  teralinxCountersignatures: path.join(DATA_ROOT, "teralinx-countersignatures"),
  commercialAuthorizationTransactions: path.join(DATA_ROOT, "commercial-authorization-transactions"),
  activity: path.join(DATA_ROOT, "activity"),
  runtimeWorkspaces: path.join(DATA_ROOT, "runtime-workspaces"),
  runtimeEvidence: path.join(DATA_ROOT, "runtime-evidence"),
  runtimeInventories: path.join(DATA_ROOT, "runtime-inventories"),
  runtimeObjects: path.join(DATA_ROOT, "runtime-objects"),
  runtimeRelationships: path.join(DATA_ROOT, "runtime-relationships"),
  runtimeValidation: path.join(DATA_ROOT, "runtime-validation"),
  runtimeHistory: path.join(DATA_ROOT, "runtime-history"),
  runtimeConnectors: path.join(DATA_ROOT, "runtime-connectors"),
  runtimeWorkspaceSessions: path.join(DATA_ROOT, "runtime-workspace-sessions"),
  translationCommits: path.join(DATA_ROOT, "translation-commits"),
  transactionManifests: path.join(DATA_ROOT, "transaction-manifests"),
};

export function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, Accept, X-Requested-With, X-Teralinx-Runtime",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Expose-Headers": "Content-Type, Content-Disposition, Content-Length, Authorization, X-Teralinx-Export-Hash, X-Teralinx-Authority-Hash, X-Teralinx-Geometry-Hash, X-Teralinx-Route-Revision, X-Teralinx-Execution-State",
    "Access-Control-Max-Age": "86400",
    "Access-Control-Allow-Private-Network": "true",
    Vary: "Origin, Access-Control-Request-Headers, Access-Control-Request-Method",
  };
}

export function jsonResponse(res, statusCode, payload) {
  const body = JSON.stringify(payload ?? {});
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    ...corsHeaders(),
  });
  res.end(body);
}

export function errorResponse(res, statusCode, message) {
  jsonResponse(res, statusCode, { error: message });
}

export function handleOptions(req, res) {
  if (req.method !== "OPTIONS") return false;
  res.writeHead(204, corsHeaders());
  res.end();
  return true;
}

export async function readRequestJson(req) {
  const { body } = await readRequestJsonWithRaw(req);
  return body;
}

export async function readRequestJsonWithRaw(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  return {
    raw,
    byteLength: Buffer.byteLength(raw, "utf8"),
    body: raw.trim() ? JSON.parse(raw) : {},
  };
}

export function nowIso() {
  return new Date().toISOString();
}

export function createId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export async function ensureDir(dir) {
  await mkdir(dir, { recursive: true });
}

function sharedRecord(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function sharedFirstText(...values) {
  for (const value of values) {
    const text = String(value ?? "").trim();
    if (text) return text;
  }
  return "";
}

function sharedArray(value) {
  return Array.isArray(value) ? value : [];
}

const IOF_PROJECTION_ARTIFACT_SPECS = [
  {
    field: "engineeringObjectManifest",
    aliases: ["doctrineObjectManifest"],
    idFields: ["engineeringObjectManifestId", "doctrineObjectManifestId", "objectManifestId", "manifestId"],
    dirKey: "engineeringObjectManifests",
    refKey: "engineeringObjectManifest",
    repositoryType: "ENGINEERING_OBJECT_MANIFEST",
    authority: "DOCTRINE_OBJECT_INSTANTIATION_ENGINE",
  },
  {
    field: "stationProjection",
    aliases: [],
    idFields: ["stationProjectionId", "projectionId"],
    dirKey: "stationProjections",
    refKey: "stationProjection",
    repositoryType: "STATION_PROJECTION",
    authority: "DOCTRINE_PROJECTION_ENGINE",
  },
  {
    field: "stationGraph",
    aliases: ["stationIndexedGraph"],
    idFields: ["stationGraphId", "graphId"],
    dirKey: "stationGraphs",
    refKey: "stationGraph",
    repositoryType: "STATION_GRAPH",
    authority: "DOCTRINE_PROJECTION_ENGINE",
  },
  {
    field: "stationObjectManifest",
    aliases: [],
    idFields: ["stationObjectManifestId", "manifestId"],
    dirKey: "stationObjectManifests",
    refKey: "stationObjectManifest",
    repositoryType: "STATION_OBJECT_MANIFEST",
    authority: "DOCTRINE_PROJECTION_ENGINE",
  },
  {
    field: "measuredCenterline",
    aliases: ["measuredSpine"],
    idFields: ["measuredCenterlineId", "measuredSpineId", "spineId"],
    dirKey: "measuredCenterlines",
    refKey: "measuredCenterline",
    repositoryType: "MEASURED_CENTERLINE",
    authority: "DOCTRINE_PROJECTION_ENGINE",
  },
  {
    field: "projectedObjectManifest",
    aliases: [],
    idFields: ["projectedObjectManifestId", "manifestId"],
    dirKey: "projectedObjectManifests",
    refKey: "projectedObjectManifest",
    repositoryType: "PROJECTED_OBJECT_MANIFEST",
    authority: "DOCTRINE_PROJECTION_ENGINE",
  },
  {
    field: "closureLedger",
    aliases: [],
    idFields: ["closureLedgerId", "ledgerId"],
    dirKey: "closureLedgers",
    refKey: "closureLedger",
    repositoryType: "CLOSURE_LEDGER",
    authority: "CLOSURE_LEDGER",
  },
  {
    field: "iofPackageTwin",
    aliases: ["iofTwin"],
    idFields: ["iofPackageTwinId", "twinProjectionId", "packageTwinId"],
    dirKey: "iofPackageTwins",
    refKey: "iofPackageTwin",
    repositoryType: "IOF_PACKAGE_TWIN",
    authority: "IOF_PACKAGE_TWIN",
  },
  {
    field: "productDoctrineAssembly",
    aliases: ["doctrineAssembly"],
    idFields: ["productDoctrineAssemblyId", "assemblyId", "productDoctrineId", "doctrineId"],
    dirKey: "productDoctrineAssemblies",
    refKey: "productDoctrineAssembly",
    repositoryType: "PRODUCT_DOCTRINE_ASSEMBLY",
    authority: "PRODUCT_DOCTRINE_ASSEMBLY_ENGINE",
  },
  {
    field: "projectConfiguration",
    aliases: [],
    idFields: ["projectConfigurationId", "configurationId"],
    dirKey: "projectConfigurations",
    refKey: "projectConfiguration",
    repositoryType: "PROJECT_CONFIGURATION",
    authority: "PROJECT_CONFIGURATION_REPOSITORY",
  },
  {
    field: "quantityReconciliation",
    aliases: ["commercialAuditReconciliation"],
    idFields: ["quantityReconciliationId", "reconciliationId"],
    dirKey: "quantityReconciliations",
    refKey: "quantityReconciliation",
    repositoryType: "QUANTITY_RECONCILIATION",
    authority: "COMMERCIAL_QUANTITY_RECONCILIATION",
  },
];

function artifactHash(payload) {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

function artifactIntegrityError(message) {
  const error = new Error(`ARTIFACT_INTEGRITY_FAILURE: ${message}`);
  error.code = "ARTIFACT_INTEGRITY_FAILURE";
  error.status = 409;
  return error;
}

function artifactSourceFor(record, spec) {
  const candidates = [record?.[spec.field], ...spec.aliases.map((alias) => record?.[alias])];
  return candidates.map(sharedRecord).find((candidate) => Object.keys(candidate).length) ?? {};
}

function artifactIdFor(record, artifact, spec) {
  return sharedFirstText(
    ...spec.idFields.map((field) => artifact?.[field]),
    ...spec.idFields.map((field) => record?.[field]),
  );
}

export function stripIofProjectionArtifacts(record = {}, artifactReferences = undefined) {
  const next = { ...record };
  for (const spec of IOF_PROJECTION_ARTIFACT_SPECS) {
    delete next[spec.field];
    for (const alias of spec.aliases) delete next[alias];
  }
  delete next.doctrineObjectInstantiation;
  delete next.doctrineProjection;
  delete next.projectedObjects;
  delete next.projectedSpans;
  delete next.workSegments;
  delete next.objectStationAttachments;
  delete next.objectAddresses;
  delete next.stationAddressRegistry;
  delete next.commercialAuditReconciliation;
  delete next.constitutionalStateValidation;
  delete next.doctrineInstantiatedObjects;
  delete next.geometry;
  delete next.centerline;
  delete next.centerlineRoute;
  delete next.osrmRoute;
  delete next.spine;
  // Station/closure assembly exposes these repository-backed projections as
  // convenient top-level views while a Draft IOF is hydrated. They must not be
  // copied back into the reference-only repository record during handoff.
  for (const field of [
    "stationAuthority",
    "stations",
    "spineAuditProjection",
    "spineObjectCatalogEntries",
    "instantiatedSpineObjects",
    "auditObjectManifestEntries",
    "objects",
    "spineReviewObjects",
    "linearAssetSpanAttachments",
    "doctrineLinearAssetSpanAttachments",
    "spineAuditAttachments",
    "proposedIofUnits",
    "constructionSegments",
    "kernelSpineObjectReferences",
    "executionZones",
    "addressBindings",
    "productionScheduleProjection",
    "stationedExpectations",
    "doctrineProjectionDiagnostics",
    "objectProductionProfiles",
    "paymentSegments",
    "productionBindings",
    "closureExpectations",
    "productionCostProjection",
    "stationRangeExpectations",
    "productionPaymentProjection",
  ]) delete next[field];
  const references = artifactReferences ?? record.iofArtifactRepositoryReferences;
  return {
    ...next,
    iofArtifactRepositoryReferences: references ?? next.iofArtifactRepositoryReferences ?? {},
    referenceOnly: true,
    noEmbeddedManifests: true,
    noEmbeddedGeometry: true,
    noDuplicatedObjectGraphs: true,
  };
}

export async function persistIofProjectionArtifacts(record = {}, metadata = {}) {
  const timestamp = metadata.timestamp ?? nowIso();
  const references = {};
  for (const spec of IOF_PROJECTION_ARTIFACT_SPECS) {
    const source = artifactSourceFor(record, spec);
    const artifactId = artifactIdFor(record, source, spec);
    if (!artifactId || !Object.keys(source).length) continue;
    const revision = sharedFirstText(source.revision, source.revisionId, record.routeRevision, record.packageRevision, "1");
    const hash = artifactHash(source);
    const artifact = {
      artifactId,
      revision,
      hash,
      payload: source,
      packageId: record.packageId,
      draftIofPackageId: record.draftIofPackageId ?? record.draftPackageId ?? record.packageId,
      proposalId: record.proposalId,
      opportunityId: record.opportunityId,
      organizationId: record.organizationId,
      tenantId: record.tenantId ?? record.organizationId,
      customerId: record.customerId ?? record.accountId,
      routeRepositoryId: record.routeRepositoryId ?? sharedRecord(record.routeRepositoryRef).routeRepositoryId,
      repositoryType: spec.repositoryType,
      authority: source.authority ?? spec.authority,
      immutable: true,
      sourceAuthority: "COMMERCIAL_DRAFT_IOF_PACKAGE_ASSEMBLY",
      createdAt: source.createdAt ?? record.createdAt ?? timestamp,
      updatedAt: timestamp,
    };
    await persistRecord(DIRS[spec.dirKey], artifactId, artifact);
    references[spec.refKey] = {
      artifactType: spec.repositoryType,
      artifactId,
      revision,
      hash,
      organizationId: artifact.organizationId,
      tenantId: artifact.tenantId,
      customerId: artifact.customerId,
      opportunityId: artifact.opportunityId,
      createdAt: artifact.createdAt,
      repositoryType: spec.repositoryType,
      repositoryPath: `server/data/${DIRS[spec.dirKey].split(/[\\/]/).pop()}`,
      field: spec.field,
      authority: artifact.authority,
      immutable: true,
      referenceOnly: true,
    };
  }
  return references;
}

export async function hydrateIofProjectionArtifacts(record = {}, options = {}) {
  if (!record || typeof record !== "object") return record;
  const references = sharedRecord(record.iofArtifactRepositoryReferences);
  const hydrated = { ...record };
  for (const spec of IOF_PROJECTION_ARTIFACT_SPECS) {
    const existing = artifactSourceFor(hydrated, spec);
    if (Object.keys(existing).length) continue;
    const reference = sharedRecord(references[spec.refKey]);
    const artifactId = sharedFirstText(
      reference.artifactId,
      ...spec.idFields.map((field) => hydrated[field]),
    );
    if (!artifactId) continue;
    const artifact = await loadRecord(DIRS[spec.dirKey], artifactId).catch(() => null);
    if (!artifact) {
      if (options.strict && reference.artifactId) throw artifactIntegrityError(`missing ${spec.repositoryType} ${artifactId}`);
      continue;
    }
    const payload = sharedRecord(artifact.payload);
    const resolved = Object.keys(payload).length ? payload : artifact;
    if (options.strict && reference.artifactId) {
      if (!sharedFirstText(reference.revision) || !sharedFirstText(reference.hash)) throw artifactIntegrityError(`${spec.repositoryType} reference is missing immutable revision/hash`);
      if (sharedFirstText(artifact.artifactId) !== sharedFirstText(reference.artifactId)) throw artifactIntegrityError(`${spec.repositoryType} artifact ID mismatch`);
      if (sharedFirstText(reference.revision) && sharedFirstText(artifact.revision) !== sharedFirstText(reference.revision)) throw artifactIntegrityError(`${spec.repositoryType} revision mismatch`);
      if (sharedFirstText(reference.hash) && artifactHash(resolved) !== sharedFirstText(reference.hash)) throw artifactIntegrityError(`${spec.repositoryType} hash mismatch`);
      for (const field of ["organizationId", "tenantId", "customerId", "opportunityId"]) {
        const expected = sharedFirstText(record[field], reference[field]);
        const actual = sharedFirstText(artifact[field]);
        if (expected && actual && expected !== actual) throw artifactIntegrityError(`${spec.repositoryType} ${field} scope mismatch`);
      }
    }
    hydrated[spec.field] = resolved;
    for (const alias of spec.aliases) hydrated[alias] = resolved;
    for (const field of spec.idFields) {
      if (!hydrated[field] && resolved[field]) hydrated[field] = resolved[field];
    }
  }
  const stationGraph = sharedRecord(hydrated.stationGraph);
  if (!hydrated.stationIndexedGraph && Object.keys(stationGraph).length) hydrated.stationIndexedGraph = stationGraph;
  // Reference-only Draft IOF records persist the governed station list inside
  // the immutable Station Projection artifact. Engineering historically read a
  // pre-normalization top-level `stationAuthority`, which made valid station and
  // graph authority appear absent after rehydration. Project the existing
  // authority into that response contract; do not persist or regenerate it.
  const stationProjection = sharedRecord(hydrated.stationProjection);
  const projectedStations = sharedArray(stationProjection.stations);
  if (!Object.keys(sharedRecord(hydrated.stationAuthority)).length && projectedStations.length) {
    const stationAuthorityId = sharedFirstText(
      sharedArray(stationProjection.stationAuthorityIds)[0],
      sharedArray(hydrated.stationAuthorityIds)[0],
      sharedRecord(hydrated.stationObjectManifest).stationAuthorityId,
    );
    const firstMeasure = Number(sharedRecord(projectedStations[0]).stationFeet ?? sharedRecord(projectedStations[0]).measuredDistanceFeet ?? sharedRecord(projectedStations[0]).measure);
    const secondMeasure = Number(sharedRecord(projectedStations[1]).stationFeet ?? sharedRecord(projectedStations[1]).measuredDistanceFeet ?? sharedRecord(projectedStations[1]).measure);
    const intervalFeet = Number.isFinite(firstMeasure) && Number.isFinite(secondMeasure)
      ? Math.abs(secondMeasure - firstMeasure)
      : 0;
    hydrated.stationAuthority = {
      authorityId: stationAuthorityId,
      stationAuthorityId,
      stationAuthorityIds: stationAuthorityId ? [stationAuthorityId] : [],
      stationProjectionId: sharedFirstText(stationProjection.stationProjectionId, hydrated.stationProjectionId),
      stationGraphId: sharedFirstText(stationProjection.stationGraphId, hydrated.stationGraphId),
      intervalFeet,
      stationCount: projectedStations.length,
      stations: projectedStations,
      authority: sharedFirstText(stationProjection.authority, "DOCTRINE_PROJECTION_ENGINE"),
      responseProjectionOnly: true,
    };
  }
  if (!sharedArray(hydrated.stations).length && projectedStations.length) hydrated.stations = projectedStations;
  const engineeringObjectManifest = sharedRecord(hydrated.engineeringObjectManifest);
  if (!hydrated.doctrineObjectManifest && Object.keys(engineeringObjectManifest).length) hydrated.doctrineObjectManifest = engineeringObjectManifest;
  const projectedObjectManifest = sharedRecord(hydrated.projectedObjectManifest);
  if (!sharedArray(hydrated.projectedObjects).length && sharedArray(projectedObjectManifest.projectedObjects).length) {
    hydrated.projectedObjects = projectedObjectManifest.projectedObjects;
  }
  if (!sharedArray(hydrated.projectedSpans).length && sharedArray(projectedObjectManifest.projectedSpans).length) {
    hydrated.projectedSpans = projectedObjectManifest.projectedSpans;
  }
  if (!sharedArray(hydrated.objectAddresses).length && sharedArray(projectedObjectManifest.objectAddresses).length) {
    hydrated.objectAddresses = projectedObjectManifest.objectAddresses;
  }
  // Project the attachment view from the exact governed object station address
  // when the former redundant attachment array is absent. The source object,
  // station identity, coordinate and projection hash remain the authority.
  if (!sharedArray(hydrated.objectStationAttachments).length && sharedArray(projectedObjectManifest.projectedObjects).length) {
    hydrated.objectStationAttachments = projectedObjectManifest.projectedObjects
      .filter((value) => {
        const object = sharedRecord(value);
        return Boolean(sharedFirstText(object.objectId) && sharedFirstText(object.stationId) && Array.isArray(object.projectedCoordinate ?? object.coordinate));
      })
      .map((value) => {
        const object = sharedRecord(value);
        const objectId = sharedFirstText(object.objectId);
        return {
          attachmentId: `${objectId}:PROJECTED-STATION-ATTACHMENT`,
          objectId,
          stationId: sharedFirstText(object.stationId),
          stationLabel: sharedFirstText(object.stationAddress),
          stationValue: object.stationValue ?? object.measure,
          coordinate: object.projectedCoordinate ?? object.coordinate,
          attachmentMethod: "GOVERNED_PROJECTED_OBJECT_STATION_ADDRESS",
          attachmentStatus: "ATTACHED",
          projectionHash: object.projectionHash,
          sourceAuthority: sharedFirstText(object.projectionAuthority, object.engineeringAuthority, "DOCTRINE_PROJECTION_ENGINE"),
          responseProjectionOnly: true,
        };
      });
  }
  if (!sharedArray(hydrated.linearAssetSpanAttachments).length && sharedArray(projectedObjectManifest.linearAssetSpanAttachments).length) {
    hydrated.linearAssetSpanAttachments = projectedObjectManifest.linearAssetSpanAttachments;
  }
  if (!sharedArray(hydrated.doctrineLinearAssetSpanAttachments).length && sharedArray(projectedObjectManifest.linearAssetSpanAttachments).length) {
    hydrated.doctrineLinearAssetSpanAttachments = projectedObjectManifest.linearAssetSpanAttachments;
  }
  if (!sharedRecord(hydrated.geometryAuthorityDiagnostics).diagnosticsId && sharedRecord(projectedObjectManifest.geometryAuthorityDiagnostics).diagnosticsId) {
    hydrated.geometryAuthorityDiagnostics = projectedObjectManifest.geometryAuthorityDiagnostics;
  }
  if (!sharedRecord(hydrated.closureLedger).closureLedgerId && sharedRecord(projectedObjectManifest.closureLedger).closureLedgerId) {
    hydrated.closureLedger = projectedObjectManifest.closureLedger;
    hydrated.closureLedgerId = hydrated.closureLedgerId ?? projectedObjectManifest.closureLedger.closureLedgerId;
  }
  if (!sharedRecord(hydrated.iofPackageTwin).twinProjectionId && sharedRecord(projectedObjectManifest.iofPackageTwin).twinProjectionId) {
    hydrated.iofPackageTwin = projectedObjectManifest.iofPackageTwin;
    hydrated.iofPackageTwinId = hydrated.iofPackageTwinId ?? projectedObjectManifest.iofPackageTwin.twinProjectionId;
  }
  if (!sharedArray(hydrated.workSegments).length && sharedArray(projectedObjectManifest.workSegments).length) {
    hydrated.workSegments = projectedObjectManifest.workSegments;
  }
  if (!sharedRecord(hydrated.commercialAuditReconciliation).reconciliationId && sharedRecord(projectedObjectManifest.commercialAuditReconciliation).reconciliationId) {
    hydrated.commercialAuditReconciliation = projectedObjectManifest.commercialAuditReconciliation;
  }
  if (!sharedRecord(hydrated.constitutionalStateValidation).validationId && sharedRecord(projectedObjectManifest.constitutionalStateValidation).validationId) {
    hydrated.constitutionalStateValidation = projectedObjectManifest.constitutionalStateValidation;
  }
  return hydrated;
}

export function recordPath(dir, id) {
  return path.join(dir, `${encodeURIComponent(String(id))}.json`);
}

export async function listRecords(dir) {
  if (postgresReadsEnabled()) return listPostgresRecords(dir);
  await ensureDir(dir);
  const files = await readdir(dir).catch(() => []);
  const records = [];
  for (const file of files) {
    if (!file.endsWith(".json")) continue;
    try {
      records.push(JSON.parse(await readFile(path.join(dir, file), "utf8")));
    } catch {
      // Skip corrupt records; endpoint health should survive one bad file.
    }
  }
  return records;
}

export async function loadRecord(dir, id) {
  if (postgresReadsEnabled()) return loadPostgresRecord(dir, id);
  return JSON.parse(await readFile(recordPath(dir, id), "utf8"));
}

export async function persistRecord(dir, id, record) {
  if (postgresReadsEnabled()) return mirrorRecord(dir, id, record);
  await ensureDir(dir);
  const destination = recordPath(dir, id);
  const temporary = `${destination}.${process.pid}.${Date.now()}.${Math.random().toString(16).slice(2)}.tmp`;
  const handle = await open(temporary, "wx");
  try {
    await handle.writeFile(JSON.stringify(record, null, 2), "utf8");
    await handle.sync();
  } finally {
    await handle.close();
  }
  try {
    await rename(temporary, destination);
  } catch (error) {
    await rm(temporary, { force: true }).catch(() => undefined);
    throw error;
  }
  if (postgresShadowEnabled()) await mirrorRecordBestEffort(dir, id, record);
  return record;
}

export async function updateTransactionManifest(args) {
  const transactionId = String(args.transactionId || createId("transaction"));
  const existing = await loadRecord(DIRS.transactionManifests, transactionId).catch(() => null);
  const timestamp = nowIso();
  const completedWrites = [...new Set([...(existing?.completedWrites ?? []), ...(args.completedWrites ?? [])])];
  const plannedWrites = [...new Set([...(existing?.plannedWrites ?? []), ...(args.plannedWrites ?? [])])];
  const artifactIds = [...new Set([...(existing?.artifactIds ?? []), ...(args.artifactIds ?? [])])];
  const revisionIds = [...new Set([...(existing?.revisionIds ?? []), ...(args.revisionIds ?? [])])];
  const hashes = [...new Set([...(existing?.hashes ?? []), ...(args.hashes ?? [])])];
  const manifest = {
    transactionId,
    operationType: args.operationType ?? existing?.operationType ?? "REPOSITORY_OPERATION",
    tenantId: args.tenantId ?? existing?.tenantId ?? "LOCAL_DEVELOPMENT",
    customerId: args.customerId ?? existing?.customerId ?? "",
    opportunityId: args.opportunityId ?? existing?.opportunityId ?? "",
    startedAt: existing?.startedAt ?? timestamp,
    completedAt: args.state === "COMMITTED" || args.state === "FAILED" || args.state === "RECOVERY_REQUIRED" ? timestamp : existing?.completedAt,
    state: args.state ?? existing?.state ?? "STARTED",
    plannedWrites,
    completedWrites,
    artifactIds,
    revisionIds,
    hashes,
    failureReason: args.failureReason ?? existing?.failureReason ?? "",
    localDevelopmentOnly: true,
    updatedAt: timestamp,
  };
  await persistRecord(DIRS.transactionManifests, transactionId, manifest);
  return manifest;
}

export async function deleteRecord(dir, id) {
  if (postgresReadsEnabled()) {
    const error = new Error("POSTGRES_DELETE_REQUIRES_GOVERNED_COMMAND");
    error.code = "POSTGRES_DELETE_REQUIRES_GOVERNED_COMMAND";
    error.status = 409;
    throw error;
  }
  await rm(recordPath(dir, id), { force: true });
}

export function sortedByUpdated(records) {
  return [...records].sort((a, b) => String(b.updatedAt ?? b.createdAt ?? b.timestamp ?? "").localeCompare(String(a.updatedAt ?? a.createdAt ?? a.timestamp ?? "")));
}

export function unwrapBody(body, singularKey, pluralKeys = []) {
  if (body?.[singularKey]) return body[singularKey];
  for (const key of pluralKeys) {
    if (body?.[key]) return body[key];
  }
  return body;
}

export function routeMatch(pathname, basePath) {
  if (pathname === basePath || pathname === `${basePath}/`) return { base: true, id: "" };
  if (!pathname.startsWith(`${basePath}/`)) return null;
  const rest = pathname.slice(basePath.length + 1);
  const [encodedId, action] = rest.split("/");
  return { base: false, id: decodeURIComponent(encodedId ?? ""), action };
}

export async function handleJsonCollection(req, res, pathname, options) {
  const match = routeMatch(pathname, options.basePath);
  if (!match) return false;
  if (handleOptions(req, res)) return true;

  const {
    dir,
    idKey,
    listKey,
    itemKey,
    singularBodyKey = itemKey,
    pluralBodyKeys = [listKey, "items", "data"],
    idPrefix = itemKey ?? "record",
    normalize = (record) => record,
    singleCreateResponse = "wrapped",
  } = options;

  if (match.base && req.method === "GET") {
    jsonResponse(res, 200, { [listKey]: sortedByUpdated((await listRecords(dir)).map((record) => normalize(record, { operation: "read", user: req.authUser ?? null }))) });
    return true;
  }

  if (!match.base && req.method === "GET") {
    try {
      jsonResponse(res, 200, { [itemKey]: normalize(await loadRecord(dir, match.id), { operation: "read", user: req.authUser ?? null }) });
    } catch {
      errorResponse(res, 404, `${itemKey} not found: ${match.id}`);
    }
    return true;
  }

  if ((match.base || match.id === "bulk" || match.action === "bulk") && req.method === "POST") {
    const body = await readRequestJson(req);
    const input = unwrapBody(body, singularBodyKey, pluralBodyKeys);
    const records = Array.isArray(input) ? input : [input];
    const saved = [];
    for (const record of records) {
      const normalized = normalize({
        ...record,
        [idKey]: record?.[idKey] ?? createId(idPrefix),
      }, { operation: "write", user: req.authUser ?? null });
      saved.push(await persistRecord(dir, normalized[idKey], normalized));
    }
    if (Array.isArray(input) || match.action === "bulk") {
      jsonResponse(res, 201, { [listKey]: saved, items: saved });
    } else if (singleCreateResponse === "plain") {
      jsonResponse(res, 201, saved[0]);
    } else {
      jsonResponse(res, 201, { [itemKey]: saved[0] });
    }
    return true;
  }

  if (!match.base && req.method === "PUT") {
    const body = await readRequestJson(req);
    const input = unwrapBody(body, singularBodyKey);
    const normalized = normalize({ ...input, [idKey]: input?.[idKey] ?? match.id, updatedAt: nowIso() }, { operation: "write", user: req.authUser ?? null });
    jsonResponse(res, 200, { [itemKey]: await persistRecord(dir, normalized[idKey], normalized) });
    return true;
  }

  return false;
}
