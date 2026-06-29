import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

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
  iofPackages: path.join(DATA_ROOT, "iof-packages"),
  closeEvents: path.join(DATA_ROOT, "close-events"),
  certifiedRoutes: path.join(DATA_ROOT, "certified-routes"),
  controlWorkItems: path.join(DATA_ROOT, "control-work-items"),
  fieldClosures: path.join(DATA_ROOT, "field-closures"),
  customerDesignImports: path.join(DATA_ROOT, "customer-design-imports"),
  commercialOpportunities: path.join(DATA_ROOT, "commercial-opportunities"),
  engineeringDrafts: path.join(DATA_ROOT, "engineering-drafts"),
  proposalDrafts: path.join(DATA_ROOT, "proposal-drafts"),
  activity: path.join(DATA_ROOT, "activity"),
  runtimeEvidence: path.join(DATA_ROOT, "runtime-evidence"),
  runtimeInventories: path.join(DATA_ROOT, "runtime-inventories"),
  runtimeObjects: path.join(DATA_ROOT, "runtime-objects"),
  runtimeRelationships: path.join(DATA_ROOT, "runtime-relationships"),
  runtimeValidation: path.join(DATA_ROOT, "runtime-validation"),
  runtimeHistory: path.join(DATA_ROOT, "runtime-history"),
  runtimeConnectors: path.join(DATA_ROOT, "runtime-connectors"),
  translationCommits: path.join(DATA_ROOT, "translation-commits"),
};

export function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, Accept, X-Requested-With, X-Teralinx-Runtime",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Expose-Headers": "Content-Type, Authorization",
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
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw.trim()) return {};
  return JSON.parse(raw);
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

export function recordPath(dir, id) {
  return path.join(dir, `${encodeURIComponent(String(id))}.json`);
}

export async function listRecords(dir) {
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
  return JSON.parse(await readFile(recordPath(dir, id), "utf8"));
}

export async function persistRecord(dir, id, record) {
  await ensureDir(dir);
  await writeFile(recordPath(dir, id), JSON.stringify(record, null, 2));
  return record;
}

export async function deleteRecord(dir, id) {
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
    jsonResponse(res, 200, { [listKey]: sortedByUpdated((await listRecords(dir)).map(normalize)) });
    return true;
  }

  if (!match.base && req.method === "GET") {
    try {
      jsonResponse(res, 200, { [itemKey]: normalize(await loadRecord(dir, match.id)) });
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
      });
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
    const normalized = normalize({ ...input, [idKey]: input?.[idKey] ?? match.id, updatedAt: nowIso() });
    jsonResponse(res, 200, { [itemKey]: await persistRecord(dir, normalized[idKey], normalized) });
    return true;
  }

  return false;
}
