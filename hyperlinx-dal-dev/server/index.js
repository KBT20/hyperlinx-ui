import http from "node:http";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.DAL_PORT ?? process.env.PORT ?? 3001);
const DATA_ROOT = process.env.DAL_DATA_ROOT
  ? path.resolve(process.env.DAL_DATA_ROOT)
  : path.resolve(__dirname, "..", "data");
const SCOPEVERSION_DIR = path.join(DATA_ROOT, "scopeversions");
const IOF_PACKAGE_DIR = path.join(DATA_ROOT, "iof-packages");
const CLOSE_EVENT_DIR = path.join(DATA_ROOT, "close-events");

function jsonResponse(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
  });
  res.end(body);
}

function errorResponse(res, statusCode, message) {
  jsonResponse(res, statusCode, { error: message });
}

function scopePath(scopeVersionId) {
  const safeId = String(scopeVersionId).replace(/[^a-zA-Z0-9._-]/g, "_");
  return path.join(SCOPEVERSION_DIR, `${safeId}.json`);
}

function iofPackagePath(packageId) {
  const safeId = String(packageId).replace(/[^a-zA-Z0-9._-]/g, "_");
  return path.join(IOF_PACKAGE_DIR, `${safeId}.json`);
}

function closeEventPath(closeEventId) {
  const safeId = String(closeEventId).replace(/[^a-zA-Z0-9._-]/g, "_");
  return path.join(CLOSE_EVENT_DIR, `${safeId}.json`);
}

async function ensureStore() {
  await mkdir(SCOPEVERSION_DIR, { recursive: true });
  await mkdir(IOF_PACKAGE_DIR, { recursive: true });
  await mkdir(CLOSE_EVENT_DIR, { recursive: true });
}

async function readRequestJson(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (!chunks.length) return {};
  const text = Buffer.concat(chunks).toString("utf8");
  return text ? JSON.parse(text) : {};
}

function normalizeScopeVersion(input) {
  const now = new Date().toISOString();
  const raw = input?.scopeVersion ?? input?.data ?? input ?? {};
  const scopeVersionId = String(raw.scopeVersionId ?? `scope-${randomUUID()}`);
  const type = raw.type ?? (raw.source === "InventoryGraph" ? "INVENTORY" : raw.source === "FieldClosure" ? "FIELD_CLOSED" : raw.status === "APPROVED" ? "APPROVED" : "CANDIDATE");
  const certificationState = raw.certificationState ?? raw.canonicalTruth?.certification?.certificationState ?? "DRAFT";
  const relationshipType = raw.relationshipType ?? (raw.parentScopeVersionId ? "AMENDMENT" : "ROOT");
  const graphSummary = raw.graphSummary ?? raw.canonicalTruth?.graphSummary ?? {
    nodeCount: Number(raw.canonicalTruth?.nodeCount ?? 0),
    edgeCount: Number(raw.canonicalTruth?.edgeCount ?? 0),
    stationCount: Number(raw.canonicalTruth?.stationCount ?? 0),
    routeCount: Number(raw.canonicalTruth?.routeCount ?? 0),
  };
  return {
    ...raw,
    scopeVersionId,
    type,
    relationshipType,
    rootScopeVersionId: raw.rootScopeVersionId ?? raw.parentScopeVersionId ?? scopeVersionId,
    sourceInventoryId: raw.sourceInventoryId ?? raw.inventoryId,
    certificationState,
    isImmutable: raw.isImmutable ?? certificationState === "CERTIFIED",
    graphSummary,
    iofPackageIds: Array.isArray(raw.iofPackageIds) ? raw.iofPackageIds : [],
    createdAt: raw.createdAt ?? now,
    updatedAt: now,
    canonicalTruth: {
      ...(raw.canonicalTruth ?? {}),
      graphSummary,
      constitutionalAuthority: certificationState === "CERTIFIED" ? "CERTIFIED_SCOPEVERSION" : "NON_AUTHORITATIVE",
    },
  };
}

function normalizeIofPackage(input) {
  const now = new Date().toISOString();
  const raw = input?.iofPackage ?? input?.package ?? input?.data ?? input ?? {};
  const packageId = String(raw.packageId ?? `iof-package-${randomUUID()}`);
  const objects = Array.isArray(raw.objects) ? raw.objects : [];
  const totalObjects = Number(raw.progress?.totalObjects ?? objects.length);
  const completedObjects = raw.status === "CLOSED" || raw.status === "COMPLETE" ? totalObjects : Number(raw.progress?.completedObjects ?? 0);
  const percentComplete = totalObjects ? Math.round((completedObjects / totalObjects) * 100) : raw.status === "CLOSED" ? 100 : 0;
  return {
    ...raw,
    packageId,
    scopeVersionId: String(raw.scopeVersionId ?? ""),
    packageType: raw.packageType ?? "CONSTRUCTION",
    status: raw.status ?? "DRAFT",
    createdAt: raw.createdAt ?? now,
    updatedAt: now,
    route: Array.isArray(raw.route) ? raw.route : [],
    stations: Array.isArray(raw.stations) ? raw.stations : [],
    objects,
    progress: { totalObjects, completedObjects, percentComplete },
    metadata: raw.metadata ?? {},
  };
}

function normalizeCloseEvent(input) {
  const raw = input?.closeEvent ?? input?.data ?? input ?? {};
  return {
    ...raw,
    closeEventId: String(raw.closeEventId ?? `close-event-${randomUUID()}`),
    sourceScopeVersionId: String(raw.sourceScopeVersionId ?? ""),
    packageId: String(raw.packageId ?? ""),
    eventType: raw.eventType ?? "FIELD_CLOSE",
    timestamp: raw.timestamp ?? new Date().toISOString(),
    payload: raw.payload ?? {},
  };
}

function numberOrUndefined(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function summarizeBody(value) {
  if (value == null) return "";
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return text.length > 700 ? `${text.slice(0, 700)}...` : text;
}

function normalizeAddressForLookup(input = {}) {
  const rawAddress = String(input.address ?? "").trim();
  const city = String(input.city ?? "").trim();
  const state = String(input.state ?? "").trim();
  const zip = String(input.zip ?? input.zipCode ?? "").trim();
  const companyName = String(input.companyName ?? input.name ?? "").trim();
  const suiteMatches = [
    ...rawAddress.matchAll(/\b(?:suite|ste|unit|apt|apartment|floor|fl|room|rm)\.?\s*#?\s*[\w-]+/gi),
    ...rawAddress.matchAll(/(?:^|\s)#\s*[\w-]+/g),
  ].map((match) => match[0].trim());
  let normalizedStreet = rawAddress
    .replace(/\b(?:suite|ste|unit|apt|apartment|floor|fl|room|rm)\.?\s*#?\s*[\w-]+/gi, "")
    .replace(/(?:^|\s)#\s*[\w-]+/g, " ")
    .replace(/\s+,/g, ",")
    .replace(/,{2,}/g, ",")
    .replace(/\s{2,}/g, " ")
    .replace(/^\s*,|,\s*$/g, "")
    .trim();
  if (companyName && normalizedStreet.toLowerCase().startsWith(companyName.toLowerCase())) {
    normalizedStreet = normalizedStreet.slice(companyName.length).replace(/^\s*,?\s*/, "");
  }
  const rawAddressLine = [rawAddress, city, state, zip].filter(Boolean).join(", ");
  const normalizedAddress = [normalizedStreet, city, state, zip].filter(Boolean).join(", ");
  const issueFlags = [];
  if (rawAddress && !/^\s*\d+/.test(normalizedStreet)) issueFlags.push("missing street number");
  if (suiteMatches.length) issueFlags.push("suite/unit/floor numbers");
  if (zip && !/^\d{5}(?:-\d{4})?$/.test(zip)) issueFlags.push("bad ZIP");
  if (!city) issueFlags.push("city mismatch risk");
  if (companyName && rawAddress.toLowerCase().includes(companyName.toLowerCase())) issueFlags.push("agency/company name included in address");
  if (/\b(office|department|agency|authority|school|district|county|city of|isd)\b/i.test(rawAddress)) issueFlags.push("agency/company name included in address");
  if (/,,|^\s*,|,\s*,|,\s*$/.test(rawAddress)) issueFlags.push("malformed commas");
  return {
    rawAddress,
    rawAddressLine,
    normalizedStreet,
    normalizedAddress,
    suiteDetail: suiteMatches.join(", ") || undefined,
    suiteStripped: suiteMatches.length > 0 || rawAddress !== normalizedStreet,
    issueFlags: Array.from(new Set(issueFlags)),
  };
}

function normalizeGeocodeCandidate(provider, candidate = {}) {
  const lat = numberOrUndefined(candidate.lat ?? candidate.latitude ?? candidate.y);
  const lon = numberOrUndefined(candidate.lon ?? candidate.longitude ?? candidate.lng ?? candidate.x);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return {
    lat,
    lon,
    confidence: Math.max(0, Math.min(1, Number(candidate.confidence ?? candidate.score ?? 0.5))),
    provider,
    normalizedAddress: candidate.normalizedAddress ?? candidate.address ?? candidate.display_name ?? candidate.place_name,
    raw: candidate.raw ?? candidate,
  };
}

async function fetchJsonWithDiagnostics(url, init = {}, timeoutMs = 10000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        ...(init.headers ?? {}),
      },
    });
    const text = await response.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text;
    }
    return {
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
      data,
      responseBodySummary: summarizeBody(data ?? text),
      failureReason: response.ok ? undefined : `${response.status} ${response.statusText}`,
    };
  } catch (err) {
    return {
      ok: false,
      status: err?.name === "AbortError" ? "TIMEOUT" : "FETCH_ERROR",
      statusText: "",
      data: null,
      responseBodySummary: "",
      failureReason: err instanceof Error ? err.message : String(err),
    };
  } finally {
    clearTimeout(timer);
  }
}

function attemptRecord(args) {
  return {
    rawAddress: args.rawAddress,
    normalizedAddress: args.normalizedAddress,
    provider: args.provider,
    providerUrl: args.providerUrl,
    responseStatus: args.responseStatus,
    responseBodySummary: args.responseBodySummary,
    failureReason: args.failureReason,
    confidence: args.confidence,
    candidates: args.candidates ?? [],
    addressVariant: args.addressVariant,
  };
}

async function censusGeocode(context) {
  const address = context.address;
  if (!address) return { candidates: [], attempt: attemptRecord({ ...context, provider: "us-census", failureReason: "No address supplied." }) };
  const url = `https://geocoding.geo.census.gov/geocoder/locations/onelineaddress?address=${encodeURIComponent(address)}&benchmark=Public_AR_Current&format=json`;
  const response = await fetchJsonWithDiagnostics(url);
  const data = response.data;
  const candidates = (data?.result?.addressMatches ?? [])
    .map((match) =>
      normalizeGeocodeCandidate("us-census", {
        lat: match?.coordinates?.y,
        lon: match?.coordinates?.x,
        confidence: match?.tigerLine ? 0.88 : 0.74,
        normalizedAddress: match?.matchedAddress,
        raw: match,
      })
    )
    .filter(Boolean);
  return {
    candidates,
    attempt: attemptRecord({
      ...context,
      provider: "us-census",
      providerUrl: url,
      responseStatus: response.status,
      responseBodySummary: response.responseBodySummary,
      failureReason: response.failureReason ?? (candidates.length ? undefined : "No Census address matches."),
      confidence: candidates[0]?.confidence,
      candidates,
    }),
  };
}

async function arcgisGeocode(context) {
  const address = context.address;
  if (!address) return { candidates: [], attempt: attemptRecord({ ...context, provider: "arcgis-esri", failureReason: "No address supplied." }) };
  const url = `https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates?f=json&countryCode=USA&maxLocations=5&SingleLine=${encodeURIComponent(address)}`;
  const response = await fetchJsonWithDiagnostics(url);
  const data = response.data;
  const candidates = (data?.candidates ?? [])
    .map((candidate) =>
      normalizeGeocodeCandidate("arcgis-esri", {
        lat: candidate?.location?.y,
        lon: candidate?.location?.x,
        confidence: Number(candidate?.score ?? 0) / 100,
        normalizedAddress: candidate?.address,
        raw: candidate,
      })
    )
    .filter(Boolean);
  return {
    candidates,
    attempt: attemptRecord({
      ...context,
      provider: "arcgis-esri",
      providerUrl: url,
      responseStatus: response.status,
      responseBodySummary: response.responseBodySummary,
      failureReason: response.failureReason ?? (candidates.length ? undefined : "No ArcGIS candidates."),
      confidence: candidates[0]?.confidence,
      candidates,
    }),
  };
}

async function nominatimGeocode(context) {
  const address = context.address;
  if (!address) return { candidates: [], attempt: attemptRecord({ ...context, provider: "nominatim-osm", failureReason: "No address supplied." }) };
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&countrycodes=us&q=${encodeURIComponent(address)}`;
  const response = await fetchJsonWithDiagnostics(url, {
    headers: {
      "User-Agent": "Hyperlinx-DAL-Geocoder/1.0",
    },
  });
  const data = response.data;
  const candidates = (Array.isArray(data) ? data : [])
    .map((match) =>
      normalizeGeocodeCandidate("nominatim-osm", {
        lat: match?.lat,
        lon: match?.lon,
        confidence: match?.importance,
        normalizedAddress: match?.display_name,
        raw: match,
      })
    )
    .filter(Boolean);
  return {
    candidates,
    attempt: attemptRecord({
      ...context,
      provider: "nominatim-osm",
      providerUrl: url,
      responseStatus: response.status,
      responseBodySummary: response.responseBodySummary,
      failureReason: response.failureReason ?? (candidates.length ? undefined : "No Nominatim candidates."),
      confidence: candidates[0]?.confidence,
      candidates,
    }),
  };
}

async function resolveGeocode(input) {
  const providerAttempts = [
    ["us-census", censusGeocode],
    ["arcgis-esri", arcgisGeocode],
    ["nominatim-osm", nominatimGeocode],
  ];
  const normalization = normalizeAddressForLookup(input);
  const allCandidates = [];
  const attempts = [];
  const variants = [
    { addressVariant: "RAW", address: normalization.rawAddressLine },
    ...(normalization.normalizedAddress && normalization.normalizedAddress !== normalization.rawAddressLine
      ? [{ addressVariant: "NORMALIZED", address: normalization.normalizedAddress }]
      : []),
  ];
  for (const variant of variants) {
    for (const [, provider] of providerAttempts) {
      const { candidates, attempt } = await provider({
        ...variant,
        rawAddress: normalization.rawAddressLine,
        normalizedAddress: normalization.normalizedAddress,
      });
      attempts.push(attempt);
      allCandidates.push(...candidates.map((candidate) => ({ ...candidate, addressVariant: variant.addressVariant })));
      const certified = candidates.find((candidate) => Number(candidate.confidence ?? 0) >= 0.75);
      if (certified) {
        const usedNormalized = variant.addressVariant === "NORMALIZED";
        return {
          siteId: String(input.siteId ?? ""),
          status: "CERTIFIED",
          lat: certified.lat,
          lon: certified.lon,
          confidence: certified.confidence,
          provider: certified.provider,
          normalizedAddress: certified.normalizedAddress,
          rawAddress: normalization.rawAddressLine,
          lookupAddress: variant.address,
          geocodeMethod: usedNormalized ? "NORMALIZED_ADDRESS" : "SERVER_PROXY",
          suiteDetail: normalization.suiteDetail,
          addressIssueFlags: normalization.issueFlags,
          suiteStrippingImprovedMatch: usedNormalized && normalization.suiteStripped,
          candidates: allCandidates,
          attempts,
        };
      }
    }
  }
  if (allCandidates.length) {
    const best = allCandidates.sort((a, b) => Number(b.confidence ?? 0) - Number(a.confidence ?? 0))[0];
    return {
      siteId: String(input.siteId ?? ""),
      status: "AMBIGUOUS",
      lat: best.lat,
      lon: best.lon,
      confidence: best.confidence,
      provider: best.provider,
      normalizedAddress: best.normalizedAddress,
      rawAddress: normalization.rawAddressLine,
      lookupAddress: best.addressVariant === "NORMALIZED" ? normalization.normalizedAddress : normalization.rawAddressLine,
      geocodeMethod: best.addressVariant === "NORMALIZED" ? "NORMALIZED_ADDRESS" : "SERVER_PROXY",
      suiteDetail: normalization.suiteDetail,
      addressIssueFlags: normalization.issueFlags,
      suiteStrippingImprovedMatch: best.addressVariant === "NORMALIZED" && normalization.suiteStripped,
      candidates: allCandidates,
      attempts,
      failureReason: "No provider returned a certification-grade match. Human review required.",
    };
  }
  return {
    siteId: String(input.siteId ?? ""),
    status: "FAILED",
    confidence: 0,
    provider: "manual-review",
    rawAddress: normalization.rawAddressLine,
    normalizedAddress: normalization.normalizedAddress,
    lookupAddress: normalization.normalizedAddress,
    geocodeMethod: "SERVER_PROXY",
    suiteDetail: normalization.suiteDetail,
    addressIssueFlags: normalization.issueFlags,
    suiteStrippingImprovedMatch: false,
    candidates: [],
    attempts,
    failureReason: attempts.map((attempt) => `${attempt.provider}: ${attempt.failureReason ?? "No certified match"}`).join("; ") || "No geocoder returned candidate coordinates. Manual pin required.",
  };
}

async function handleGeocode(req, res, pathname) {
  if (pathname !== "/api/geocode") return false;
  if (req.method === "OPTIONS") {
    jsonResponse(res, 200, { ok: true });
    return true;
  }
  if (req.method !== "POST") {
    errorResponse(res, 405, "POST /api/geocode required.");
    return true;
  }
  const body = await readRequestJson(req);
  jsonResponse(res, 200, await resolveGeocode(body));
  return true;
}

function isCertifiedImmutable(scopeVersion) {
  return scopeVersion?.certificationState === "CERTIFIED" || scopeVersion?.isImmutable === true;
}

function relationshipForChild(scopeVersion) {
  if (scopeVersion.relationshipType && scopeVersion.relationshipType !== "ROOT") return scopeVersion.relationshipType;
  if (scopeVersion.source === "GraphExtension") return "GRAPH_EXTENSION";
  if (scopeVersion.source === "FieldClosure") return "FIELD_CLOSURE";
  if (scopeVersion.type === "AS_BUILT") return "AS_BUILT";
  return "AMENDMENT";
}

function stripCertificationTruth(canonicalTruth = {}) {
  const { certification, constitutionalAuthority, ...rest } = canonicalTruth;
  return rest;
}

function createChildScopeVersion(parent, proposed, relationshipType = relationshipForChild(proposed)) {
  const now = new Date().toISOString();
  const scopeVersionId =
    proposed.scopeVersionId && proposed.scopeVersionId !== parent.scopeVersionId
      ? proposed.scopeVersionId
      : `${parent.scopeVersionId}-${relationshipType.toLowerCase().replaceAll("_", "-")}-${Date.now().toString(36)}`;
  return normalizeScopeVersion({
    ...proposed,
    scopeVersionId,
    parentScopeVersionId: parent.scopeVersionId,
    rootScopeVersionId: parent.rootScopeVersionId ?? parent.scopeVersionId,
    relationshipType,
    certificationState: "DRAFT",
    isImmutable: false,
    createdAt: now,
    updatedAt: now,
    canonicalTruth: {
      ...stripCertificationTruth(proposed.canonicalTruth),
      parentScopeVersionId: parent.scopeVersionId,
      rootScopeVersionId: parent.rootScopeVersionId ?? parent.scopeVersionId,
      relationshipType,
      supersedesScopeVersionId: relationshipType === "SUPERSEDES" ? parent.scopeVersionId : undefined,
      constitutionalAuthority: "NON_AUTHORITATIVE",
    },
    events: [
      ...(proposed.events ?? []),
      {
        eventId: `event-${randomUUID()}`,
        type: "scopeversion.child.created",
        entityId: scopeVersionId,
        entityType: "ScopeVersion",
        payload: {
          parentScopeVersionId: parent.scopeVersionId,
          rootScopeVersionId: parent.rootScopeVersionId ?? parent.scopeVersionId,
          relationshipType,
        },
        createdAt: now,
      },
    ],
  });
}

function assertConstitutionalGuardrails(scopeVersion) {
  const truth = scopeVersion.canonicalTruth ?? {};
  const relationshipType = scopeVersion.relationshipType ?? "ROOT";
  const claimsAuthority =
    scopeVersion.isImmutable === true ||
    truth.constitutionalAuthority === "CERTIFIED_SCOPEVERSION" ||
    truth.authoritative === true ||
    truth.authority === "AUTHORITATIVE";
  const machineClaimsAuthority =
    truth.aiAuthoritative === true ||
    truth.machineOutputsAuthoritative === true ||
    truth.reasoning?.authoritative === true ||
    truth.machineOutput?.authoritative === true;

  if (relationshipType !== "ROOT" && !scopeVersion.parentScopeVersionId) {
    throw new Error("Child ScopeVersions must reference parentScopeVersionId.");
  }
  if (scopeVersion.source === "GraphExtension" && !scopeVersion.parentScopeVersionId) {
    throw new Error("Graph extensions must create child ScopeVersions with parentScopeVersionId.");
  }
  if (machineClaimsAuthority) {
    throw new Error("Machine or AI output is advisory and cannot claim ScopeVersion authority.");
  }
  if (claimsAuthority && scopeVersion.certificationState !== "CERTIFIED") {
    throw new Error("Only certified ScopeVersions may claim constitutional authority.");
  }
  if (scopeVersion.certificationState === "REJECTED" && claimsAuthority) {
    throw new Error("Rejected ScopeVersions cannot become authoritative.");
  }
}

async function listScopeVersions() {
  await ensureStore();
  const files = await readdir(SCOPEVERSION_DIR).catch(() => []);
  const records = [];
  for (const file of files.filter((item) => item.endsWith(".json"))) {
    try {
      records.push(JSON.parse(await readFile(path.join(SCOPEVERSION_DIR, file), "utf8")));
    } catch (err) {
      console.warn("DAL SCOPEVERSION READ WARNING", file, err instanceof Error ? err.message : String(err));
    }
  }
  return records.sort((a, b) => String(b.updatedAt ?? b.createdAt).localeCompare(String(a.updatedAt ?? a.createdAt)));
}

async function listRecords(dir) {
  await ensureStore();
  const files = await readdir(dir).catch(() => []);
  const records = [];
  for (const file of files.filter((item) => item.endsWith(".json"))) {
    try {
      records.push(JSON.parse(await readFile(path.join(dir, file), "utf8")));
    } catch (err) {
      console.warn("DAL RECORD READ WARNING", file, err instanceof Error ? err.message : String(err));
    }
  }
  return records;
}

async function loadScopeVersion(scopeVersionId) {
  return JSON.parse(await readFile(scopePath(scopeVersionId), "utf8"));
}

async function loadIofPackage(packageId) {
  return JSON.parse(await readFile(iofPackagePath(packageId), "utf8"));
}

async function loadCloseEvent(closeEventId) {
  return JSON.parse(await readFile(closeEventPath(closeEventId), "utf8"));
}

async function persistScopeVersion(scopeVersion) {
  await ensureStore();
  assertConstitutionalGuardrails(scopeVersion);
  await writeFile(scopePath(scopeVersion.scopeVersionId), JSON.stringify(scopeVersion, null, 2));
  return scopeVersion;
}

async function persistIofPackage(iofPackage) {
  await ensureStore();
  await writeFile(iofPackagePath(iofPackage.packageId), JSON.stringify(iofPackage, null, 2));
  return iofPackage;
}

async function persistCloseEvent(closeEvent) {
  await ensureStore();
  await writeFile(closeEventPath(closeEvent.closeEventId), JSON.stringify(closeEvent, null, 2));
  return closeEvent;
}

function closeEventTypeForPackage(iofPackage) {
  if (iofPackage.packageType === "ENGINEERING") return "ENGINEERING_CLOSE";
  if (iofPackage.packageType === "PERMITTING") return "PERMIT_CLOSE";
  if (iofPackage.packageType === "AS_BUILT") return "AS_BUILT_CLOSE";
  if (["CONSTRUCTION", "SPLICING", "TESTING"].includes(iofPackage.packageType)) return "CONSTRUCTION_CLOSE";
  return "FIELD_CLOSE";
}

function relationshipForClose(eventType) {
  return eventType === "AS_BUILT_CLOSE" ? "AS_BUILT" : "FIELD_CLOSURE";
}

function typeForClose(eventType) {
  return eventType === "AS_BUILT_CLOSE" ? "AS_BUILT" : "FIELD_CLOSED";
}

function createCloseEventFromPackage(iofPackage) {
  return normalizeCloseEvent({
    closeEventId: `close-event-${randomUUID()}`,
    sourceScopeVersionId: iofPackage.scopeVersionId,
    packageId: iofPackage.packageId,
    eventType: closeEventTypeForPackage(iofPackage),
    timestamp: new Date().toISOString(),
    payload: {
      packageType: iofPackage.packageType,
      packageStatus: iofPackage.status,
      progress: iofPackage.progress,
    },
  });
}

function createChildScopeVersionFromClose(parent, iofPackage, closeEvent) {
  const relationshipType = relationshipForClose(closeEvent.eventType);
  const type = typeForClose(closeEvent.eventType);
  const scopeVersionId = `${type === "AS_BUILT" ? "SV-ASBUILT" : "SV-CLOSE"}-${closeEvent.closeEventId.replace(/^close-event-/, "").slice(0, 18)}`;
  return normalizeScopeVersion({
    ...parent,
    scopeVersionId,
    type,
    parentScopeVersionId: parent.scopeVersionId,
    rootScopeVersionId: parent.rootScopeVersionId ?? parent.scopeVersionId,
    relationshipType,
    source: "FieldClosure",
    status: closeEvent.eventType === "AS_BUILT_CLOSE" ? "COMPLETE" : parent.status,
    certificationState: "DRAFT",
    isImmutable: false,
    closureEventId: closeEvent.closeEventId,
    iofPackageIds: Array.from(new Set([...(parent.iofPackageIds ?? []), iofPackage.packageId])),
    createdAt: closeEvent.timestamp,
    updatedAt: closeEvent.timestamp,
    canonicalTruth: {
      ...(parent.canonicalTruth ?? {}),
      parentScopeVersionId: parent.scopeVersionId,
      rootScopeVersionId: parent.rootScopeVersionId ?? parent.scopeVersionId,
      relationshipType,
      constitutionalAuthority: "NON_AUTHORITATIVE",
      executionChain: {
        sourceScopeVersionId: parent.scopeVersionId,
        packageId: iofPackage.packageId,
        closeEventId: closeEvent.closeEventId,
        childScopeVersionId: scopeVersionId,
      },
      latestCloseEvent: closeEvent,
      latestIOFPackage: iofPackage,
    },
    events: [
      ...(parent.events ?? []),
      {
        eventId: `event-${randomUUID()}`,
        type: "scopeversion.child.created_from_close",
        entityId: scopeVersionId,
        entityType: "ScopeVersion",
        payload: {
          sourceScopeVersionId: parent.scopeVersionId,
          packageId: iofPackage.packageId,
          closeEventId: closeEvent.closeEventId,
          relationshipType,
        },
        createdAt: closeEvent.timestamp,
      },
    ],
  });
}

function certifyScopeVersion(scopeVersion) {
  const truth = scopeVersion.canonicalTruth ?? {};
  const summary = scopeVersion.graphSummary ?? truth.graphSummary ?? {};
  const checks = [
    { label: "Routes Exist", status: Number(summary.routeCount ?? 0) > 0 ? "PASS" : "FAIL" },
    { label: "Stations Exist", status: Number(summary.stationCount ?? 0) > 0 ? "PASS" : "FAIL" },
    { label: "Nodes Exist", status: Number(summary.nodeCount ?? 0) > 0 ? "PASS" : "FAIL" },
    { label: "Edges Exist", status: Number(summary.edgeCount ?? 0) > 0 ? "PASS" : "FAIL" },
  ].map((check) => ({ ...check, detail: check.status === "PASS" ? "Summary count present." : "Summary count missing." }));
  const rejected = checks.some((check) => check.status === "FAIL");
  const certification = {
    certificationState: rejected ? "REJECTED" : "CERTIFIED",
    status: rejected ? "FAIL" : "PASS",
    graphSummary: summary,
    checks,
    certifiedAt: rejected ? undefined : new Date().toISOString(),
    rejectedAt: rejected ? new Date().toISOString() : undefined,
  };
  return normalizeScopeVersion({
    ...scopeVersion,
    certificationState: certification.certificationState,
    isImmutable: certification.certificationState === "CERTIFIED",
    canonicalTruth: {
      ...truth,
      certification,
      constitutionalAuthority: rejected ? "NON_AUTHORITATIVE" : "CERTIFIED_SCOPEVERSION",
    },
  });
}

async function handleScopeVersions(req, res, pathname) {
  const match = pathname.match(/^\/api\/scopeversions\/?([^/]*)?(?:\/(certify))?$/);
  if (!match) return false;
  const scopeVersionId = match[1] ? decodeURIComponent(match[1]) : "";
  const action = match[2];

  if (req.method === "OPTIONS") {
    jsonResponse(res, 200, { ok: true });
    return true;
  }

  if (!scopeVersionId && req.method === "GET") {
    jsonResponse(res, 200, { scopeVersions: await listScopeVersions() });
    return true;
  }

  if (!scopeVersionId && req.method === "POST") {
    const body = await readRequestJson(req);
    const scopeVersion = await persistScopeVersion(normalizeScopeVersion(body));
    jsonResponse(res, 201, { scopeVersion });
    return true;
  }

  if (scopeVersionId && req.method === "GET") {
    try {
      jsonResponse(res, 200, { scopeVersion: await loadScopeVersion(scopeVersionId) });
    } catch {
      errorResponse(res, 404, `ScopeVersion not found: ${scopeVersionId}`);
    }
    return true;
  }

  if (scopeVersionId && req.method === "PUT") {
    const body = await readRequestJson(req);
    const input = body.scopeVersion
      ? { scopeVersion: { ...body.scopeVersion, scopeVersionId: body.scopeVersion.scopeVersionId ?? scopeVersionId } }
      : { ...body, scopeVersionId: body.scopeVersionId ?? scopeVersionId };
    const proposed = normalizeScopeVersion(input);
    const existing = await loadScopeVersion(scopeVersionId).catch(() => null);
    const scopeVersion = existing && isCertifiedImmutable(existing)
      ? await persistScopeVersion(createChildScopeVersion(existing, proposed))
      : existing?.certificationState === "REJECTED" && proposed.certificationState === "CERTIFIED"
        ? await persistScopeVersion(createChildScopeVersion(existing, proposed, "AMENDMENT"))
        : await persistScopeVersion(proposed);
    jsonResponse(res, 200, { scopeVersion });
    return true;
  }

  if (scopeVersionId && action === "certify" && req.method === "POST") {
    try {
      const existing = await loadScopeVersion(scopeVersionId);
      if (isCertifiedImmutable(existing)) {
        jsonResponse(res, 200, { scopeVersion: existing });
        return true;
      }
      if (existing.certificationState === "REJECTED") {
        errorResponse(res, 409, "Rejected ScopeVersions cannot become authoritative. Create a child ScopeVersion with corrected truth.");
        return true;
      }
      const scopeVersion = certifyScopeVersion(existing);
      await persistScopeVersion(scopeVersion);
      jsonResponse(res, 200, { scopeVersion });
    } catch {
      errorResponse(res, 404, `ScopeVersion not found: ${scopeVersionId}`);
    }
    return true;
  }

  if (scopeVersionId && req.method === "DELETE") {
    const existing = await loadScopeVersion(scopeVersionId).catch(() => null);
    if (existing && isCertifiedImmutable(existing)) {
      errorResponse(res, 409, "Certified ScopeVersions are immutable and cannot be deleted.");
      return true;
    }
    await rm(scopePath(scopeVersionId), { force: true });
    jsonResponse(res, 200, { ok: true });
    return true;
  }

  return false;
}

async function handleIofPackages(req, res, pathname) {
  const match = pathname.match(/^\/api\/iof-packages\/?([^/]*)?(?:\/(close|archive))?$/);
  if (!match) return false;
  const packageId = match[1] ? decodeURIComponent(match[1]) : "";
  const action = match[2];

  if (req.method === "OPTIONS") {
    jsonResponse(res, 200, { ok: true });
    return true;
  }

  if (!packageId && req.method === "GET") {
    const iofPackages = (await listRecords(IOF_PACKAGE_DIR)).sort((a, b) => String(b.updatedAt ?? b.createdAt).localeCompare(String(a.updatedAt ?? a.createdAt)));
    jsonResponse(res, 200, { iofPackages });
    return true;
  }

  if (!packageId && req.method === "POST") {
    const body = await readRequestJson(req);
    const iofPackage = await persistIofPackage(normalizeIofPackage(body));
    jsonResponse(res, 201, { iofPackage });
    return true;
  }

  if (packageId && req.method === "GET") {
    try {
      jsonResponse(res, 200, { iofPackage: await loadIofPackage(packageId) });
    } catch {
      errorResponse(res, 404, `IOFPackage not found: ${packageId}`);
    }
    return true;
  }

  if (packageId && action === "archive" && req.method === "POST") {
    try {
      const iofPackage = normalizeIofPackage({ ...(await loadIofPackage(packageId)), isArchived: true, archivedAt: new Date().toISOString() });
      await persistIofPackage(iofPackage);
      jsonResponse(res, 200, { iofPackage });
    } catch {
      errorResponse(res, 404, `IOFPackage not found: ${packageId}`);
    }
    return true;
  }

  if (packageId && action === "close" && req.method === "POST") {
    try {
      const existingPackage = await loadIofPackage(packageId);
      if (existingPackage.status === "CLOSED" && existingPackage.closeEventId) {
        jsonResponse(res, 200, { iofPackage: existingPackage, closeEvent: await loadCloseEvent(existingPackage.closeEventId).catch(() => undefined) });
        return true;
      }
      const parent = await loadScopeVersion(existingPackage.scopeVersionId);
      const closeEvent = await persistCloseEvent(createCloseEventFromPackage(existingPackage));
      const closedPackage = await persistIofPackage(normalizeIofPackage({
        ...existingPackage,
        status: "CLOSED",
        closeEventId: closeEvent.closeEventId,
        progress: {
          totalObjects: existingPackage.objects?.length ?? 0,
          completedObjects: existingPackage.objects?.length ?? 0,
          percentComplete: 100,
        },
        updatedAt: closeEvent.timestamp,
      }));
      const childScopeVersion = await persistScopeVersion(createChildScopeVersionFromClose(parent, closedPackage, closeEvent));
      closeEvent.childScopeVersionId = childScopeVersion.scopeVersionId;
      await persistCloseEvent(closeEvent);
      jsonResponse(res, 200, { iofPackage: closedPackage, closeEvent, childScopeVersion });
    } catch (err) {
      errorResponse(res, 500, err instanceof Error ? err.message : String(err));
    }
    return true;
  }

  if (packageId && req.method === "PUT") {
    const existing = await loadIofPackage(packageId).catch(() => null);
    if (existing?.status === "CLOSED") {
      errorResponse(res, 409, "Closed IOF Packages cannot be updated. Create a new package for new work.");
      return true;
    }
    const body = await readRequestJson(req);
    const iofPackage = await persistIofPackage(normalizeIofPackage(body.iofPackage ? { iofPackage: { ...body.iofPackage, packageId } } : { ...body, packageId }));
    jsonResponse(res, 200, { iofPackage });
    return true;
  }

  return false;
}

async function handleCloseEvents(req, res, pathname) {
  const match = pathname.match(/^\/api\/close-events\/?([^/]*)?$/);
  if (!match) return false;
  const closeEventId = match[1] ? decodeURIComponent(match[1]) : "";

  if (req.method === "OPTIONS") {
    jsonResponse(res, 200, { ok: true });
    return true;
  }

  if (!closeEventId && req.method === "GET") {
    const closeEvents = (await listRecords(CLOSE_EVENT_DIR)).sort((a, b) => String(b.timestamp).localeCompare(String(a.timestamp)));
    jsonResponse(res, 200, { closeEvents });
    return true;
  }

  if (!closeEventId && req.method === "POST") {
    const body = await readRequestJson(req);
    const closeEvent = await persistCloseEvent(normalizeCloseEvent(body));
    jsonResponse(res, 201, { closeEvent });
    return true;
  }

  if (closeEventId && req.method === "GET") {
    try {
      jsonResponse(res, 200, { closeEvent: await loadCloseEvent(closeEventId) });
    } catch {
      errorResponse(res, 404, `CloseEvent not found: ${closeEventId}`);
    }
    return true;
  }

  return false;
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
    if (await handleGeocode(req, res, url.pathname)) return;
    if (await handleScopeVersions(req, res, url.pathname)) return;
    if (await handleIofPackages(req, res, url.pathname)) return;
    if (await handleCloseEvents(req, res, url.pathname)) return;
    if (url.pathname === "/health") {
      jsonResponse(res, 200, { ok: true, service: "hyperlinx-dal-dev", scopeVersions: true, iofPackages: true, closeEvents: true });
      return;
    }
    errorResponse(res, 404, "Not found");
  } catch (err) {
    errorResponse(res, 500, err instanceof Error ? err.message : String(err));
  }
});

server.listen(PORT, () => {
  console.log("HYPERLINX DAL SERVER READY", { port: PORT, scopeVersionDir: SCOPEVERSION_DIR, iofPackageDir: IOF_PACKAGE_DIR, closeEventDir: CLOSE_EVENT_DIR });
});
