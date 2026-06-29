import {
  DIRS,
  createId,
  errorResponse,
  handleJsonCollection,
  handleOptions,
  jsonResponse,
  listRecords,
  nowIso,
  persistRecord,
  readRequestJson,
} from "./_shared.js";

function asArray(value) {
  if (Array.isArray(value)) return value;
  if (value === undefined || value === null) return [];
  return [value];
}

function normalizeEvidence(record = {}) {
  const timestamp = record.ingestedAt ?? record.createdAt ?? nowIso();
  return {
    ...record,
    evidenceId: String(record.evidenceId ?? createId("evidence")),
    sourceType: record.sourceType ?? "UNKNOWN",
    sourceName: record.sourceName ?? record.fileName ?? "Unnamed evidence",
    authority: record.authority ?? "EVIDENCE",
    validationStatus: record.validationStatus ?? "PENDING",
    collectedAt: record.collectedAt ?? timestamp,
    ingestedAt: timestamp,
    createdAt: record.createdAt ?? timestamp,
    updatedAt: record.updatedAt ?? timestamp,
  };
}

function normalizeInventory(record = {}) {
  const timestamp = record.updatedAt ?? record.createdAt ?? nowIso();
  return {
    ...record,
    inventoryId: String(record.inventoryId ?? createId("runtime-inventory")),
    inventoryType: record.inventoryType ?? "CUSTOMER",
    owner: record.owner ?? record.customerName ?? record.organization ?? "Teralinx",
    authority: record.authority ?? "RUNTIME",
    version: Number(record.version ?? 1),
    status: record.status ?? "ACTIVE",
    evidenceIds: asArray(record.evidenceIds),
    objectIds: asArray(record.objectIds),
    relationshipIds: asArray(record.relationshipIds),
    createdAt: record.createdAt ?? timestamp,
    updatedAt: timestamp,
  };
}

function normalizeRuntimeObject(record = {}) {
  const timestamp = record.updatedAt ?? record.createdAt ?? nowIso();
  return {
    ...record,
    runtimeId: String(record.runtimeId ?? record.objectId ?? createId("runtime-object")),
    objectType: record.objectType ?? "UNKNOWN",
    authority: record.authority ?? "RUNTIME",
    version: Number(record.version ?? 1),
    evidenceIds: asArray(record.evidenceIds),
    relationshipIds: asArray(record.relationshipIds),
    createdAt: record.createdAt ?? timestamp,
    updatedAt: timestamp,
  };
}

function normalizeRelationship(record = {}) {
  const timestamp = record.updatedAt ?? record.createdAt ?? nowIso();
  return {
    ...record,
    relationshipId: String(record.relationshipId ?? createId("runtime-relationship")),
    relationshipType: record.relationshipType ?? "RELATED_TO",
    fromRuntimeId: String(record.fromRuntimeId ?? ""),
    toRuntimeId: String(record.toRuntimeId ?? ""),
    authority: record.authority ?? "RUNTIME",
    version: Number(record.version ?? 1),
    evidenceIds: asArray(record.evidenceIds),
    createdAt: record.createdAt ?? timestamp,
    updatedAt: timestamp,
  };
}

function normalizeValidation(record = {}) {
  const timestamp = record.validatedAt ?? record.createdAt ?? nowIso();
  return {
    ...record,
    validationId: String(record.validationId ?? createId("runtime-validation")),
    status: record.status ?? "WARNING",
    checks: asArray(record.checks),
    validatedAt: timestamp,
    createdAt: record.createdAt ?? timestamp,
    updatedAt: record.updatedAt ?? timestamp,
  };
}

function normalizeHistory(record = {}) {
  const timestamp = record.timestamp ?? record.createdAt ?? nowIso();
  return {
    ...record,
    historyId: String(record.historyId ?? record.eventId ?? createId("runtime-history")),
    eventType: record.eventType ?? record.type ?? "runtime.event",
    actor: record.actor ?? record.user ?? "system",
    timestamp,
    createdAt: record.createdAt ?? timestamp,
    updatedAt: record.updatedAt ?? timestamp,
  };
}

function normalizeConnector(record = {}) {
  const timestamp = record.updatedAt ?? record.createdAt ?? nowIso();
  return {
    ...record,
    connectorId: String(record.connectorId ?? createId("runtime-connector")),
    connectorType: record.connectorType ?? "API",
    status: record.status ?? "CONFIGURED",
    authorityBoundary: record.authorityBoundary ?? "EVIDENCE_ONLY",
    createdAt: record.createdAt ?? timestamp,
    updatedAt: timestamp,
  };
}

const collectionRoutes = [
  {
    basePaths: ["/api/evidence", "/api/runtime/evidence"],
    dir: DIRS.runtimeEvidence,
    idKey: "evidenceId",
    listKey: "evidence",
    itemKey: "evidenceRecord",
    singularBodyKey: "evidenceRecord",
    pluralBodyKeys: ["evidence", "evidenceRecords", "items", "data"],
    idPrefix: "evidence",
    normalize: normalizeEvidence,
  },
  {
    basePaths: ["/api/inventory", "/api/runtime/inventories"],
    dir: DIRS.runtimeInventories,
    idKey: "inventoryId",
    listKey: "inventories",
    itemKey: "inventory",
    singularBodyKey: "inventory",
    pluralBodyKeys: ["inventories", "runtimeInventories", "items", "data"],
    idPrefix: "runtime-inventory",
    normalize: normalizeInventory,
  },
  {
    basePaths: ["/api/runtime/objects"],
    dir: DIRS.runtimeObjects,
    idKey: "runtimeId",
    listKey: "runtimeObjects",
    itemKey: "runtimeObject",
    singularBodyKey: "runtimeObject",
    pluralBodyKeys: ["runtimeObjects", "objects", "items", "data"],
    idPrefix: "runtime-object",
    normalize: normalizeRuntimeObject,
  },
  {
    basePaths: ["/api/runtime/relationships"],
    dir: DIRS.runtimeRelationships,
    idKey: "relationshipId",
    listKey: "relationships",
    itemKey: "relationship",
    singularBodyKey: "relationship",
    pluralBodyKeys: ["relationships", "runtimeRelationships", "items", "data"],
    idPrefix: "runtime-relationship",
    normalize: normalizeRelationship,
  },
  {
    basePaths: ["/api/runtime/validation"],
    dir: DIRS.runtimeValidation,
    idKey: "validationId",
    listKey: "validationReports",
    itemKey: "validationReport",
    singularBodyKey: "validationReport",
    pluralBodyKeys: ["validationReports", "reports", "items", "data"],
    idPrefix: "runtime-validation",
    normalize: normalizeValidation,
  },
  {
    basePaths: ["/api/runtime/history"],
    dir: DIRS.runtimeHistory,
    idKey: "historyId",
    listKey: "history",
    itemKey: "historyEvent",
    singularBodyKey: "historyEvent",
    pluralBodyKeys: ["history", "events", "items", "data"],
    idPrefix: "runtime-history",
    normalize: normalizeHistory,
  },
  {
    basePaths: ["/api/connectors", "/api/runtime/connectors"],
    dir: DIRS.runtimeConnectors,
    idKey: "connectorId",
    listKey: "connectors",
    itemKey: "connector",
    singularBodyKey: "connector",
    pluralBodyKeys: ["connectors", "runtimeConnectors", "items", "data"],
    idPrefix: "runtime-connector",
    normalize: normalizeConnector,
  },
];

async function persistMany(dir, idKey, records, normalize) {
  const saved = [];
  for (const record of asArray(records)) {
    const normalized = normalize(record);
    saved.push(await persistRecord(dir, normalized[idKey], normalized));
  }
  return saved;
}

function collectionSearchItems(collection, records, idKey) {
  return records.map((record) => ({
    collection,
    id: record[idKey],
    label: record.name ?? record.label ?? record.sourceName ?? record.eventType ?? record[idKey],
    record,
  }));
}

async function handleRuntimeSearch(req, res, pathname) {
  if (pathname !== "/api/runtime/search") return false;
  if (handleOptions(req, res)) return true;
  if (req.method !== "GET") return false;

  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
  const query = String(url.searchParams.get("q") ?? "").trim().toLowerCase();
  const collectionFilter = String(url.searchParams.get("collection") ?? "").trim().toLowerCase();
  const pools = [
    ["evidence", await listRecords(DIRS.runtimeEvidence), "evidenceId"],
    ["inventories", await listRecords(DIRS.runtimeInventories), "inventoryId"],
    ["runtimeObjects", await listRecords(DIRS.runtimeObjects), "runtimeId"],
    ["relationships", await listRecords(DIRS.runtimeRelationships), "relationshipId"],
    ["validationReports", await listRecords(DIRS.runtimeValidation), "validationId"],
    ["history", await listRecords(DIRS.runtimeHistory), "historyId"],
    ["connectors", await listRecords(DIRS.runtimeConnectors), "connectorId"],
  ];
  const results = pools
    .flatMap(([collection, records, idKey]) => collectionSearchItems(collection, records, idKey))
    .filter((item) => !collectionFilter || item.collection.toLowerCase() === collectionFilter)
    .filter((item) => !query || JSON.stringify(item.record).toLowerCase().includes(query));

  jsonResponse(res, 200, { query, collection: collectionFilter || "all", total: results.length, results });
  return true;
}

async function handleRuntimeCommit(req, res, pathname) {
  if (pathname !== "/api/runtime/commit") return false;
  if (handleOptions(req, res)) return true;
  if (req.method !== "POST") return false;

  const body = await readRequestJson(req);
  const input = body.runtimeCommit ?? body.commit ?? body;
  const timestamp = nowIso();
  const commitId = String(input.commitId ?? createId("runtime-commit"));
  const evidence = await persistMany(DIRS.runtimeEvidence, "evidenceId", input.evidence ?? input.evidenceRecords, normalizeEvidence);
  const inventories = await persistMany(DIRS.runtimeInventories, "inventoryId", input.inventories ?? input.inventory, normalizeInventory);
  const runtimeObjects = await persistMany(DIRS.runtimeObjects, "runtimeId", input.runtimeObjects ?? input.objects, normalizeRuntimeObject);
  const relationships = await persistMany(DIRS.runtimeRelationships, "relationshipId", input.relationships, normalizeRelationship);
  const validationReports = await persistMany(DIRS.runtimeValidation, "validationId", input.validationReports ?? input.validation, normalizeValidation);
  const connectors = await persistMany(DIRS.runtimeConnectors, "connectorId", input.connectors, normalizeConnector);
  const history = [
    ...await persistMany(DIRS.runtimeHistory, "historyId", input.history, normalizeHistory),
    await persistRecord(DIRS.runtimeHistory, `${commitId}-history`, normalizeHistory({
      historyId: `${commitId}-history`,
      eventType: "runtime.translation_committed",
      actor: input.actor ?? "system",
      objectType: "RuntimeCommit",
      objectId: commitId,
      timestamp,
      payload: {
        evidenceCount: evidence.length,
        inventoryCount: inventories.length,
        objectCount: runtimeObjects.length,
        relationshipCount: relationships.length,
        connectorCount: connectors.length,
      },
    })),
  ];
  const savedCommit = await persistRecord(DIRS.translationCommits, commitId, {
    ...input,
    commitId,
    status: "COMMITTED",
    committedAt: input.committedAt ?? timestamp,
    updatedAt: timestamp,
    evidenceIds: evidence.map((item) => item.evidenceId),
    inventoryIds: inventories.map((item) => item.inventoryId),
    runtimeObjectIds: runtimeObjects.map((item) => item.runtimeId),
    relationshipIds: relationships.map((item) => item.relationshipId),
    validationReportIds: validationReports.map((item) => item.validationId),
    historyIds: history.map((item) => item.historyId),
    connectorIds: connectors.map((item) => item.connectorId),
  });

  jsonResponse(res, 201, {
    commit: savedCommit,
    counts: {
      evidence: evidence.length,
      inventories: inventories.length,
      runtimeObjects: runtimeObjects.length,
      relationships: relationships.length,
      validationReports: validationReports.length,
      history: history.length,
      connectors: connectors.length,
    },
  });
  return true;
}

async function handleRuntimeCommits(req, res, pathname) {
  if (pathname !== "/api/runtime/commits") return false;
  if (handleOptions(req, res)) return true;
  if (req.method !== "GET") return false;
  jsonResponse(res, 200, { commits: await listRecords(DIRS.translationCommits) });
  return true;
}

export async function handleRuntimeFoundation(req, res, pathname) {
  if (await handleRuntimeSearch(req, res, pathname)) return true;
  if (await handleRuntimeCommit(req, res, pathname)) return true;
  if (await handleRuntimeCommits(req, res, pathname)) return true;

  for (const config of collectionRoutes) {
    for (const basePath of config.basePaths) {
      if (await handleJsonCollection(req, res, pathname, { ...config, basePath })) return true;
    }
  }

  if (
    pathname.startsWith("/api/runtime/") ||
    pathname === "/api/evidence" ||
    pathname.startsWith("/api/evidence/") ||
    pathname === "/api/inventory" ||
    pathname.startsWith("/api/inventory/") ||
    pathname === "/api/connectors" ||
    pathname.startsWith("/api/connectors/")
  ) {
    errorResponse(res, 404, "Runtime foundation route not found.");
    return true;
  }

  return false;
}
