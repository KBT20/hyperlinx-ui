import { DAL_API, DAL_INVENTORY_GRAPH_API } from "../config/dalApi";
import {
  deleteRecord,
  findRecord,
  graphStorageTelemetry,
  readCollection,
  storagePressureWarning,
  writeRecord,
  writeRecords,
} from "./dalStorage";
import { listServerBaselineGraphMetadata, loadServerBaselineGraph } from "./inventoryRecovery";
import { assertValidScopeVersion, mergeImmutableScopeVersion, validateScopeVersion } from "../scopeversion/scopeVersionValidation";
import type {
  ControlWorkItem,
  FieldClosure,
  InventoryGraph,
  InventoryGraphMetadata,
  MarketplaceQuote,
  OperationalEvent,
  PrismOpportunity,
  ScopeVersion,
  TwinState,
} from "../types/dal";
import type { CandidateSite } from "../types/candidateSite";
import type { GraphExtension } from "../types/graphExtension";
import type { OpportunitySeed } from "../types/portfolio";

function createId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return `${prefix}-${crypto.randomUUID()}`;
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function now() {
  return new Date().toISOString();
}

function apiUrl(path: string, base = DAL_API) {
  return `${base}${path}`;
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const text = await res.text().catch(() => "");
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}${text ? `: ${text}` : ""}`);
  return (text ? JSON.parse(text) : {}) as T;
}

async function tryRemote<T>(url: string, init?: RequestInit): Promise<T | null> {
  try {
    return await requestJson<T>(url, init);
  } catch (err: any) {
    console.warn("DAL LOCAL FALLBACK ACTIVE", url, err?.message ?? String(err));
    return null;
  }
}

function unwrapList<T>(data: any, keys: string[]): T[] {
  const items = keys.map((key) => data?.[key]).find(Array.isArray) ?? data?.items ?? data?.data ?? data;
  return Array.isArray(items) ? items : [];
}

function normalizeInventoryGraph(raw: any): InventoryGraph {
  const metadata = raw?.metadata ?? raw;
  const inventoryId = String(raw?.inventoryId ?? metadata?.inventoryId ?? createId("inventory"));
  const graphId = String(raw?.graphId ?? metadata?.graphId ?? createId("graph"));
  const createdAt = String(raw?.createdAt ?? metadata?.createdAt ?? metadata?.createdDate ?? now());
  const updatedAt = String(raw?.updatedAt ?? metadata?.updatedAt ?? createdAt);
  const nodes = Array.isArray(raw?.nodes) ? raw.nodes : [];
  const edges = Array.isArray(raw?.edges) ? raw.edges : [];
  const stations = Array.isArray(raw?.stations) ? raw.stations : [];
  const routes = Array.isArray(raw?.routes) ? raw.routes : [];
  const routeMiles = Number(metadata?.routeMiles ?? raw?.routeMiles ?? routes.reduce((sum: number, route: any) => sum + Number(route.lengthFeet || 0), 0) / 5280);

  return {
    inventoryId,
    graphId,
    scopeVersionId: raw?.scopeVersionId ?? metadata?.scopeVersionId,
    metadata: {
      inventoryId,
      graphId,
      scopeVersionId: raw?.scopeVersionId ?? metadata?.scopeVersionId,
      name: String(metadata?.name ?? raw?.name ?? inventoryId),
      sourceFile: metadata?.sourceFile ?? raw?.sourceFile,
      sourceType: metadata?.sourceType ?? raw?.sourceType,
      createdDate: String(metadata?.createdDate ?? createdAt),
      validationStatus: metadata?.validationStatus ?? raw?.validation?.status,
      nodeCount: Number(metadata?.nodeCount ?? nodes.length),
      edgeCount: Number(metadata?.edgeCount ?? edges.length),
      stationCount: Number(metadata?.stationCount ?? stations.length),
      routeCount: Number(metadata?.routeCount ?? routes.length),
      routeMiles,
      localFallback: Boolean(metadata?.localFallback ?? raw?.localFallback),
      ...(metadata ?? {}),
    },
    nodes,
    edges,
    stations,
    routes,
    validation: raw?.validation ?? { status: metadata?.validationStatus ?? "PASS", issues: [] },
    createdAt,
    updatedAt,
  };
}

function normalizeGraphMetadata(raw: any): InventoryGraphMetadata {
  const graph = normalizeInventoryGraph(raw);
  return graph.metadata;
}

function normalizeGraphExtension(raw: any): GraphExtension {
  const extension = raw?.graphExtension ?? raw?.extension ?? raw?.data ?? raw;
  const timestamp = String(extension?.createdAt ?? now());
  return {
    extensionId: String(extension?.extensionId ?? createId("extension")),
    inventoryId: String(extension?.inventoryId ?? ""),
    graphId: String(extension?.graphId ?? ""),
    type: extension?.type ?? "NEW_ROUTE",
    status: extension?.status ?? "DRAFT",
    extensionCertificationStatus: extension?.extensionCertificationStatus ?? extension?.metadata?.extensionCertificationStatus,
    createdAt: timestamp,
    updatedAt: String(extension?.updatedAt ?? timestamp),
    metadata: extension?.metadata ?? {},
    nodes: Array.isArray(extension?.nodes) ? extension.nodes : [],
    edges: Array.isArray(extension?.edges) ? extension.edges : [],
    stations: Array.isArray(extension?.stations) ? extension.stations : [],
    routes: Array.isArray(extension?.routes) ? extension.routes : [],
  };
}

function normalizeCandidateSite(raw: any): CandidateSite {
  const site = raw?.candidateSite ?? raw?.site ?? raw?.data ?? raw;
  return {
    candidateId: String(site?.candidateId ?? createId("candidate-site")),
    companyName: String(site?.companyName ?? site?.company_name ?? "Unnamed Candidate"),
    address: String(site?.address ?? site?.location_address ?? ""),
    city: String(site?.city ?? site?.location_city ?? ""),
    state: String(site?.state ?? site?.location_state ?? "TX"),
    zipCode: String(site?.zipCode ?? site?.location_zip_code__5 ?? ""),
    latitude: Number.isFinite(Number(site?.latitude)) ? Number(site.latitude) : undefined,
    longitude: Number.isFinite(Number(site?.longitude)) ? Number(site.longitude) : undefined,
    geocodeProvider: site?.geocodeProvider,
    geocodeConfidence: Number.isFinite(Number(site?.geocodeConfidence)) ? Number(site.geocodeConfidence) : undefined,
    geocodeStatus: site?.geocodeStatus,
    geocodeFailureReason: site?.geocodeFailureReason,
    geocodeTimestamp: site?.geocodeTimestamp ?? site?.geocodedAt,
    geocodedAt: site?.geocodedAt ?? site?.geocodeTimestamp,
    county: site?.county,
    facilityType: site?.facilityType,
    marketSegment: site?.marketSegment,
    status: site?.status ?? "IMPORTED",
    createdAt: String(site?.createdAt ?? now()),
  };
}

function stripRouteGeometryFromScopeVersion(scopeVersion: ScopeVersion): ScopeVersion {
  const truth = scopeVersion.canonicalTruth ?? {};
  const geographicBasis = truth.geographicBasis ? { ...truth.geographicBasis } : undefined;
  const routeGeometry = geographicBasis?.routeGeometry;
  const graphGeometryReference = Array.isArray(routeGeometry)
    ? {
        inventoryId: scopeVersion.inventoryId,
        graphId: scopeVersion.graphId,
        routeId: truth.networkBasis?.routeId,
        routeCoordinateCount: routeGeometry.length,
      }
    : truth.graphGeometryReference;
  if (geographicBasis && "routeGeometry" in geographicBasis) {
    delete (geographicBasis as any).routeGeometry;
  }
  const route =
    scopeVersion.route && typeof scopeVersion.route === "object"
      ? (() => {
          const next = { ...(scopeVersion.route as any) };
          delete next.coordinates;
          return next;
        })()
      : scopeVersion.route;
  const canonicalRoute =
    truth.route && typeof truth.route === "object"
      ? (() => {
          const next = { ...(truth.route as any) };
          delete next.coordinates;
          return next;
        })()
      : truth.route;

  return {
    ...scopeVersion,
    route,
    canonicalTruth: {
      ...truth,
      route: canonicalRoute,
      ...(geographicBasis ? { geographicBasis } : {}),
      ...(graphGeometryReference ? { graphGeometryReference } : {}),
    },
  };
}

export async function listInventoryGraphs() {
  const baselineItems = await listServerBaselineGraphMetadata()
    .then((items) => items.map((item) => ({ ...item, localFallback: false, serverBacked: true })))
    .catch((err) => {
      console.warn("DAL BASELINE GRAPH DISCOVERY FALLBACK", err instanceof Error ? err.message : String(err));
      return [] as InventoryGraphMetadata[];
    });
  const remote = await tryRemote<any>(apiUrl("/api/inventory-graphs", DAL_INVENTORY_GRAPH_API));
  const remoteItems = remote ? unwrapList<any>(remote, ["inventoryGraphs", "graphs"]).map(normalizeGraphMetadata) : [];
  const localItems = (await readCollection<InventoryGraph>("inventoryGraphs")).map((item) => ({
    ...item.metadata,
    localFallback: true,
  })) as InventoryGraphMetadata[];
  const byId = new Map<string, InventoryGraphMetadata>();
  [...localItems, ...remoteItems, ...baselineItems].forEach((item) => byId.set(item.inventoryId, item));
  return Array.from(byId.values()).sort((a, b) => String(b.createdDate).localeCompare(String(a.createdDate)));
}

export async function loadInventoryGraph(inventoryId: string) {
  const baseline = await loadServerBaselineGraph(inventoryId).catch((err) => {
    console.warn("DAL BASELINE GRAPH LOAD FALLBACK", inventoryId, err instanceof Error ? err.message : String(err));
    return null;
  });
  if (baseline) return normalizeInventoryGraph({ ...baseline, metadata: { ...baseline.metadata, localFallback: false, serverBacked: true } });
  const remote = await tryRemote<any>(apiUrl(`/api/inventory-graphs/${encodeURIComponent(inventoryId)}`, DAL_INVENTORY_GRAPH_API));
  if (remote) return normalizeInventoryGraph(remote?.inventoryGraph ?? remote?.graph ?? remote?.data ?? remote);
  const local = await findRecord<InventoryGraph>("inventoryGraphs", inventoryId);
  if (!local) throw new Error(`Inventory graph not found: ${inventoryId}`);
  return normalizeInventoryGraph({ ...local, metadata: { ...local.metadata, localFallback: true } });
}

export async function saveInventoryGraph(payload: InventoryGraph) {
  const telemetry = graphStorageTelemetry(payload);
  const pressure = await storagePressureWarning(telemetry.serializedSizeBytes);
  const payloadWithTelemetry: InventoryGraph = {
    ...payload,
    metadata: {
      ...payload.metadata,
      serializedSizeBytes: telemetry.serializedSizeBytes,
      serializedSizeMB: telemetry.serializedSizeMB,
      storageWarning: pressure.message,
    },
  };
  const remote = await tryRemote<any>(apiUrl("/api/inventory-graphs", DAL_INVENTORY_GRAPH_API), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payloadWithTelemetry),
  });
  const graph = normalizeInventoryGraph(remote?.inventoryGraph ?? remote?.graph ?? remote?.data ?? remote ?? { ...payloadWithTelemetry, metadata: { ...payloadWithTelemetry.metadata, localFallback: true } });
  if (!remote) {
    await writeRecord("inventoryGraphs", graph);
  }
  return graph.metadata;
}

export async function deleteLocalInventoryGraph(inventoryId: string) {
  await deleteRecord("inventoryGraphs", inventoryId);
}

export async function listCandidateSites() {
  const remote = await tryRemote<any>(apiUrl("/api/candidate-sites"));
  const remoteItems = remote ? unwrapList<any>(remote, ["candidateSites", "sites"]).map(normalizeCandidateSite) : [];
  const localItems = await readCollection<CandidateSite>("candidateSites");
  const byId = new Map<string, CandidateSite>();
  [...localItems, ...remoteItems].forEach((item) => byId.set(item.candidateId, item));
  return Array.from(byId.values()).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

export async function saveCandidateSite(site: CandidateSite) {
  const remote = await tryRemote<any>(apiUrl("/api/candidate-sites"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(site),
  });
  const saved = normalizeCandidateSite(remote ?? site);
  if (!remote) await writeRecord("candidateSites", saved);
  return saved;
}

export async function saveCandidateSites(sites: CandidateSite[]) {
  const remote = await tryRemote<any>(apiUrl("/api/candidate-sites/bulk"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ candidateSites: sites }),
  });
  const saved = remote ? unwrapList<any>(remote, ["candidateSites", "sites"]).map(normalizeCandidateSite) : sites;
  if (!remote) {
    await writeRecords("candidateSites", saved);
  }
  return saved;
}

export async function listGraphExtensions() {
  const remote = await tryRemote<any>(apiUrl("/api/graph-extensions"));
  const remoteItems = remote ? unwrapList<any>(remote, ["graphExtensions", "extensions"]).map(normalizeGraphExtension) : [];
  const localItems = await readCollection<GraphExtension>("graphExtensions");
  const byId = new Map<string, GraphExtension>();
  [...localItems, ...remoteItems].forEach((item) => byId.set(item.extensionId, item));
  return Array.from(byId.values()).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

export async function loadGraphExtension(extensionId: string) {
  const remote = await tryRemote<any>(apiUrl(`/api/graph-extensions/${encodeURIComponent(extensionId)}`));
  if (remote) return normalizeGraphExtension(remote);
  const local = await findRecord<GraphExtension>("graphExtensions", extensionId);
  if (!local) throw new Error(`Graph extension not found: ${extensionId}`);
  return local;
}

export async function saveGraphExtension(extension: GraphExtension) {
  const remote = await tryRemote<any>(apiUrl("/api/graph-extensions"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(extension),
  });
  const saved = normalizeGraphExtension(remote ?? extension);
  if (!remote) await writeRecord("graphExtensions", saved);
  return saved;
}

export async function deleteLocalGraphExtension(extensionId: string) {
  await deleteRecord("graphExtensions", extensionId);
}

export async function listScopeVersions() {
  const remote = await tryRemote<any>(apiUrl("/api/scopeversions"));
  return remote ? unwrapList<ScopeVersion>(remote, ["scopeVersions"]) : readCollection<ScopeVersion>("scopeVersions");
}

export async function loadScopeVersion(scopeVersionId: string) {
  const remote = await tryRemote<any>(apiUrl(`/api/scopeversions/${encodeURIComponent(scopeVersionId)}`));
  if (remote) return (remote?.scopeVersion ?? remote?.data ?? remote) as ScopeVersion;
  const local = await findRecord<ScopeVersion>("scopeVersions", scopeVersionId);
  if (!local) throw new Error(`ScopeVersion not found: ${scopeVersionId}`);
  return local;
}

export async function saveScopeVersion(scopeVersion: ScopeVersion) {
  const existingLocal = await findRecord<ScopeVersion>("scopeVersions", scopeVersion.scopeVersionId);
  const candidate = mergeImmutableScopeVersion(existingLocal, scopeVersion);
  const validation = validateScopeVersion(candidate);
  const requiresStrictValidation = candidate.status !== "DRAFT" || (candidate.canonicalTruth as any)?.decisionType === "PrismSiteDecision";
  if (requiresStrictValidation) assertValidScopeVersion(candidate);
  const payload = stripRouteGeometryFromScopeVersion({
    ...candidate,
    canonicalTruth: {
      ...candidate.canonicalTruth,
      validation,
    },
  });
  const remote = await tryRemote<any>(apiUrl("/api/scopeversions"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const saved = (remote?.scopeVersion ?? remote?.data ?? remote ?? payload) as ScopeVersion;
  if (!remote) await writeRecord("scopeVersions", saved);
  return saved;
}

export async function listPrismOpportunities() {
  const remote = await tryRemote<any>(apiUrl("/api/prism/opportunities"));
  return remote ? unwrapList<PrismOpportunity>(remote, ["opportunities"]) : readCollection<PrismOpportunity>("opportunities");
}

export async function listOpportunitySeeds() {
  const remote = await tryRemote<any>(apiUrl("/api/opportunity-seeds"));
  const remoteItems = remote ? unwrapList<OpportunitySeed>(remote, ["opportunitySeeds", "seeds"]) : [];
  const localItems = await readCollection<OpportunitySeed>("opportunitySeeds");
  const byId = new Map<string, OpportunitySeed>();
  [...localItems, ...remoteItems].forEach((item) => byId.set(item.id, item));
  return Array.from(byId.values()).sort((a, b) => (b.overallScore - a.overallScore) || String(b.createdAt).localeCompare(String(a.createdAt)));
}

export async function saveOpportunitySeed(seed: OpportunitySeed) {
  const remote = await tryRemote<any>(apiUrl("/api/opportunity-seeds"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(seed),
  });
  const saved = (remote?.opportunitySeed ?? remote?.seed ?? remote?.data ?? remote ?? seed) as OpportunitySeed;
  if (!remote) await writeRecord("opportunitySeeds", saved);
  return saved;
}

export async function saveOpportunitySeeds(seeds: OpportunitySeed[]) {
  const remote = await tryRemote<any>(apiUrl("/api/opportunity-seeds/bulk"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ opportunitySeeds: seeds }),
  });
  const saved = remote ? unwrapList<OpportunitySeed>(remote, ["opportunitySeeds", "seeds"]) : seeds;
  if (!remote) {
    await writeRecords("opportunitySeeds", saved);
  }
  return saved;
}

export async function savePrismOpportunity(opportunity: PrismOpportunity) {
  const remote = await tryRemote<any>(apiUrl("/api/prism/opportunities"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(opportunity),
  });
  const saved = (remote?.opportunity ?? remote?.data ?? remote ?? opportunity) as PrismOpportunity;
  if (!remote) await writeRecord("opportunities", saved);
  return saved;
}

export async function listMarketplaceQuotes() {
  const remote = await tryRemote<any>(apiUrl("/api/marketplace/quotes"));
  return remote ? unwrapList<MarketplaceQuote>(remote, ["quotes"]) : readCollection<MarketplaceQuote>("quotes");
}

export async function saveMarketplaceQuote(quote: MarketplaceQuote) {
  const remote = await tryRemote<any>(apiUrl("/api/marketplace/quotes"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(quote),
  });
  const saved = (remote?.quote ?? remote?.data ?? remote ?? quote) as MarketplaceQuote;
  if (!remote) await writeRecord("quotes", saved);
  return saved;
}

export async function listControlWorkItems() {
  const remote = await tryRemote<any>(apiUrl("/api/control/work-items"));
  return remote ? unwrapList<ControlWorkItem>(remote, ["workItems"]) : readCollection<ControlWorkItem>("workItems");
}

export async function saveControlWorkItem(workItem: ControlWorkItem) {
  const remote = await tryRemote<any>(apiUrl("/api/control/work-items"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(workItem),
  });
  const saved = (remote?.workItem ?? remote?.data ?? remote ?? workItem) as ControlWorkItem;
  if (!remote) await writeRecord("workItems", saved);
  return saved;
}

export async function listFieldClosures() {
  const remote = await tryRemote<any>(apiUrl("/api/field/closures"));
  return remote ? unwrapList<FieldClosure>(remote, ["closures"]) : readCollection<FieldClosure>("closures");
}

export async function saveFieldClosure(closure: FieldClosure) {
  const remote = await tryRemote<any>(apiUrl("/api/field/closures"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(closure),
  });
  const saved = (remote?.closure ?? remote?.data ?? remote ?? closure) as FieldClosure;
  if (!remote) await writeRecord("closures", saved);
  return saved;
}

export async function loadTwinState() {
  const remote = await tryRemote<any>(apiUrl("/api/twin/state"));
  if (remote) return (remote?.state ?? remote?.data ?? remote) as TwinState;
  const closures = await readCollection<FieldClosure>("closures");
  const workItems = await readCollection<ControlWorkItem>("workItems");
  const events: OperationalEvent[] = [
    ...workItems.map((item) => ({
      eventId: item.workItemId,
      type: `control.${item.status.toLowerCase()}`,
      entityId: item.workItemId,
      entityType: "ControlWorkItem",
      payload: item as unknown as Record<string, unknown>,
      createdAt: item.updatedAt,
    })),
    ...closures.map((item) => ({
      eventId: item.closureId,
      type: `field.${item.closureType.toLowerCase()}.closed`,
      entityId: item.closureId,
      entityType: "FieldClosure",
      payload: item as unknown as Record<string, unknown>,
      createdAt: item.closedAt,
    })),
  ].sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  return {
    twinStateId: "local-fallback-twin-state",
    openWorkItems: workItems.filter((item) => !["COMPLETE", "CANCELLED"].includes(item.status)).length,
    completedWorkItems: workItems.filter((item) => item.status === "COMPLETE").length,
    closureCount: closures.length,
    completedFeet: closures.reduce((sum, item) => sum + Number(item.footage || 0), 0),
    routeProgress: [],
    timeline: events,
    updatedAt: now(),
  } as TwinState;
}

export { createId, now };
