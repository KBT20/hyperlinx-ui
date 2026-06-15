import { useEffect, useMemo, useState } from "react";
import { createId, listOpportunitySeeds, listPrismOpportunities, now, saveOpportunitySeeds, savePrismOpportunity } from "../api/dalClient";
import { useDALState } from "../dal/DALState";
import { DEFAULT_BUILD_COST_MODEL } from "../prism/buildCostEstimator";
import { generateOpportunitySeedForCandidate } from "../prism/opportunityGenerator";
import { evaluatePortfolioOpportunities, generateCandidateSitesFromGraph, parseCandidateCsv } from "../prism/prismOpportunityEngine";
import type { DALCoordinate, InventoryEdge, InventoryNode, InventoryStation, PrismOpportunity, ServiceabilityStatus } from "../types/dal";
import type { CandidateType, ConstructionType, OpportunitySeed } from "../types/portfolio";

function fmt(n: number | undefined) {
  return Number(n || 0).toLocaleString();
}

function haversineFeet(a: DALCoordinate, b: DALCoordinate) {
  const r = 6371008.8;
  const toRad = Math.PI / 180;
  const lat1 = a[1] * toRad;
  const lat2 = b[1] * toRad;
  const dLat = (b[1] - a[1]) * toRad;
  const dLon = (b[0] - a[0]) * toRad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(h)) * 3.28084;
}

function statusFor(distanceFeet: number): ServiceabilityStatus {
  if (distanceFeet < 500) return "GREEN";
  if (distanceFeet <= 1500) return "YELLOW";
  return "RED";
}

function nearestByDistance<T>(items: T[], coordFor: (item: T) => DALCoordinate, target: DALCoordinate) {
  let best: { item: T; distanceFeet: number } | null = null;
  for (const item of items) {
    const distanceFeet = haversineFeet(coordFor(item), target);
    if (!best || distanceFeet < best.distanceFeet) best = { item, distanceFeet };
  }
  return best;
}

function nearestEdge(edges: InventoryEdge[], target: DALCoordinate) {
  let best: { edge: InventoryEdge; distanceFeet: number } | null = null;
  for (const edge of edges) {
    const distanceFeet = Math.min(...edge.coordinates.map((coord) => haversineFeet(coord, target)));
    if (!best || distanceFeet < best.distanceFeet) best = { edge, distanceFeet };
  }
  return best;
}

function nearestProposedRoute(scopeTruth: Record<string, unknown> | undefined, target: DALCoordinate) {
  const extensions = Array.isArray((scopeTruth as any)?.extensions) ? ((scopeTruth as any).extensions as any[]) : [];
  let best: { routeId: string; distanceFeet: number } | null = null;
  for (const extension of extensions) {
    for (const route of extension.routes ?? []) {
      const coords = Array.isArray(route.geometry) ? route.geometry : [];
      if (!coords.length) continue;
      const distanceFeet = Math.min(...coords.map((coord: DALCoordinate) => haversineFeet(coord, target)));
      if (!best || distanceFeet < best.distanceFeet) best = { routeId: route.extensionRouteId, distanceFeet };
    }
  }
  return best;
}

export default function PrismWorkspace() {
  const {
    selectedGraph,
    selectedScopeVersion,
    setSelectedOpportunity,
    setSelectedOpportunityId,
    setSelectedOpportunitySeed,
    setSelectedOpportunitySeedId,
    setWorkspace,
  } = useDALState();
  const [lat, setLat] = useState("");
  const [lon, setLon] = useState("");
  const [radiusFeet, setRadiusFeet] = useState(1500);
  const [opportunities, setOpportunities] = useState<PrismOpportunity[]>([]);
  const [portfolioSeeds, setPortfolioSeeds] = useState<OpportunitySeed[]>([]);
  const [candidateText, setCandidateText] = useState("");
  const [candidateType, setCandidateType] = useState<CandidateType>("enterprise");
  const [candidateCount, setCandidateCount] = useState(400);
  const [constructionType, setConstructionType] = useState<ConstructionType>("BURIED");
  const [draft, setDraft] = useState<PrismOpportunity | null>(null);
  const [status, setStatus] = useState("Prism ready.");

  useEffect(() => {
    void refresh();
  }, []);

  const connectedRouteSummary = useMemo(() => {
    if (!selectedGraph) return [];
    return selectedGraph.routes.slice(0, 10).map((route) => `${route.name}: ${fmt(route.edgeIds.length)} edges`);
  }, [selectedGraph]);

  const extensionSummary = selectedScopeVersion?.canonicalTruth?.extensionSummary as any;

  async function refresh() {
    try {
      const [nextOpportunities, nextSeeds] = await Promise.all([listPrismOpportunities(), listOpportunitySeeds()]);
      setOpportunities(nextOpportunities);
      setPortfolioSeeds(nextSeeds);
    } catch (err: any) {
      setStatus(`Opportunity load failed: ${err?.message ?? String(err)}`);
    }
  }

  async function handleCandidateFile(file: File | null) {
    if (!file) return;
    setCandidateText(await file.text());
  }

  function candidateSites() {
    const parsed = parseCandidateCsv(candidateText, candidateType);
    if (parsed.length) return parsed;
    if (!selectedGraph) return [];
    return generateCandidateSitesFromGraph(selectedGraph, candidateCount, candidateType);
  }

  async function generatePortfolio() {
    if (!selectedGraph) {
      setStatus("Load an inventory graph before generating a portfolio.");
      return;
    }
    const candidates = candidateSites();
    if (!candidates.length) {
      setStatus("Provide candidate sites or generate sample sites from the graph.");
      return;
    }
    setStatus(`Evaluating ${candidates.length.toLocaleString()} candidate sites...`);
    const certifiedSeeds = candidates
      .map((candidate) =>
        generateOpportunitySeedForCandidate(
          selectedGraph,
          {
            candidateId: candidate.id,
            companyName: candidate.name,
            address: "",
            city: "",
            state: "TX",
            zipCode: "",
            latitude: candidate.latitude,
            longitude: candidate.longitude,
            geocodeProvider: "portfolio-coordinate",
            geocodeConfidence: 0.92,
            geocodeStatus: "GEOCODED",
            status: "ANALYZED",
            createdAt: now(),
          },
          { termMonths: 60, revenueMultiplier: 1 },
          { ...DEFAULT_BUILD_COST_MODEL, constructionType }
        )
      )
      .filter(Boolean) as OpportunitySeed[];
    const seeds = certifiedSeeds.length
      ? certifiedSeeds
      : evaluatePortfolioOpportunities(
          selectedGraph,
          candidates,
          { termMonths: 60, revenueMultiplier: 1 },
          { ...DEFAULT_BUILD_COST_MODEL, constructionType }
        );
    const saved = await saveOpportunitySeeds(seeds);
    const ranked = saved.sort((a, b) => b.overallScore - a.overallScore).map((seed, index) => ({ ...seed, rank: index + 1 }));
    setPortfolioSeeds(ranked);
    if (ranked[0]) {
      setSelectedOpportunitySeed(ranked[0]);
      setSelectedOpportunitySeedId(ranked[0].id);
    }
    setStatus(`Generated ${ranked.length.toLocaleString()} ranked Opportunity Seeds.`);
  }

  function runSearch() {
    if (!selectedGraph) {
      setStatus("Select an inventory graph first.");
      return;
    }
    if (!selectedScopeVersion) {
      setStatus("Create or select a Graph Extension ScopeVersion before running Prism.");
      return;
    }
    const parsedLat = Number(lat);
    const parsedLon = Number(lon);
    if (!Number.isFinite(parsedLat) || !Number.isFinite(parsedLon)) {
      setStatus("Enter a valid latitude and longitude.");
      return;
    }

    const target: DALCoordinate = [parsedLon, parsedLat];
    const nearestNode = nearestByDistance<InventoryNode>(selectedGraph.nodes, (node) => [node.lon, node.lat], target);
    const nearestStation = nearestByDistance<InventoryStation>(selectedGraph.stations, (station) => [station.lon, station.lat], target);
    const edge = nearestEdge(selectedGraph.edges, target);
    const proposedRoute = nearestProposedRoute(selectedScopeVersion.canonicalTruth, target);
    const distanceFeet = Math.min(
      nearestNode?.distanceFeet ?? Infinity,
      nearestStation?.distanceFeet ?? Infinity,
      edge?.distanceFeet ?? Infinity,
      proposedRoute?.distanceFeet ?? Infinity
    );
    const opportunity: PrismOpportunity = {
      opportunityId: createId("opportunity"),
      inventoryId: selectedGraph.inventoryId,
      graphId: selectedGraph.graphId,
      nearestNode: nearestNode?.item,
      nearestStation: nearestStation?.item,
      distanceFeet,
      serviceabilityStatus: statusFor(distanceFeet),
      candidateScopeVersionId: selectedScopeVersion.scopeVersionId,
      notes: `ScopeVersion ${selectedScopeVersion.scopeVersionId}. Radius ${radiusFeet.toLocaleString()} ft. Nearest inventory edge ${edge?.edge.edgeId ?? "n/a"}. Nearest proposed route ${proposedRoute?.routeId ?? "n/a"}.`,
      lat: parsedLat,
      lon: parsedLon,
      createdAt: now(),
    };
    setDraft(opportunity);
    setStatus(`Nearest asset is ${Math.round(distanceFeet).toLocaleString()} ft away.`);
  }

  async function saveOpportunitySeed() {
    if (!draft || !selectedGraph || !selectedScopeVersion) return;
    const savedOpportunity = await savePrismOpportunity({ ...draft, candidateScopeVersionId: selectedScopeVersion.scopeVersionId });
    setSelectedOpportunity(savedOpportunity);
    setSelectedOpportunityId(savedOpportunity.opportunityId);
    setOpportunities((prev) => [savedOpportunity, ...prev.filter((item) => item.opportunityId !== savedOpportunity.opportunityId)]);
    setStatus(`Saved opportunity ${savedOpportunity.opportunityId}.`);
  }

  return (
    <section className="dal-workspace">
      <div className="dal-workspace-header">
        <div>
          <h2>DAL Prism</h2>
          <p>Portfolio generation, nearest-asset analysis, and Opportunity Seed creation against immutable inventory graph truth.</p>
        </div>
      </div>

      <div className="dal-grid">
        <div className="dal-panel">
          <h3>Portfolio Generation</h3>
          <div className="dal-grid compact">
            <select value={candidateType} onChange={(event) => setCandidateType(event.target.value as CandidateType)}>
              <option value="enterprise">Enterprise</option>
              <option value="tower">Tower</option>
              <option value="data_center">Data Center</option>
              <option value="wireless">Wireless</option>
              <option value="carrier">Carrier</option>
              <option value="hyperscaler">Hyperscaler</option>
              <option value="residential_cluster">Residential Cluster</option>
            </select>
            <select value={constructionType} onChange={(event) => setConstructionType(event.target.value as ConstructionType)}>
              <option value="BURIED">Buried</option>
              <option value="Mixed" disabled>Mixed (future)</option>
              <option value="Aerial" disabled>Aerial (future)</option>
              <option value="Underground" disabled>Underground (future)</option>
            </select>
          </div>
          <input type="number" min={1} max={5000} value={candidateCount} onChange={(event) => setCandidateCount(Number(event.target.value))} />
          <input type="file" accept=".csv,.txt" onChange={(event) => void handleCandidateFile(event.target.files?.[0] ?? null)} />
          <textarea
            value={candidateText}
            onChange={(event) => setCandidateText(event.target.value)}
            placeholder="CSV: id,name,type,latitude,longitude. Leave blank to generate FiberLight sample sites from the loaded graph."
          />
          <div className="dal-actions">
            <button type="button" onClick={() => void generatePortfolio()}>
              Generate Opportunity Seeds
            </button>
            <button type="button" onClick={() => setWorkspace("portfolio")}>
              Portfolio
            </button>
          </div>
          <div className="dal-status">{status}</div>
        </div>

        <div className="dal-panel">
          <h3>Portfolio Output</h3>
          <div className="dal-metrics">
            <span>Seeds: {fmt(portfolioSeeds.length)}</span>
            <span>Top score: {fmt(Math.round(portfolioSeeds[0]?.overallScore ?? 0))}</span>
            <span>Top TCV: {fmt(Math.round(portfolioSeeds[0]?.estimatedTCV ?? 0))}</span>
            <span>Avg payback: {fmt(Math.round(portfolioSeeds.reduce((sum, seed) => sum + seed.paybackMonths, 0) / Math.max(portfolioSeeds.length, 1)))} mo</span>
          </div>
          <div className="dal-list">
            {portfolioSeeds.slice(0, 5).map((seed) => (
              <button
                key={seed.id}
                type="button"
                onClick={() => {
                  setSelectedOpportunitySeed(seed);
                  setSelectedOpportunitySeedId(seed.id);
                  setWorkspace("portfolio");
                }}
              >
                #{seed.rank ?? "-"} {seed.siteName ?? seed.id} | {seed.candidateType} | Score {Math.round(seed.overallScore)} | Payback {Math.round(seed.paybackMonths)} mo
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="dal-grid">
        <div className="dal-panel">
          <h3>Serviceability Search</h3>
          <input value={lat} onChange={(event) => setLat(event.target.value)} placeholder="Latitude" />
          <input value={lon} onChange={(event) => setLon(event.target.value)} placeholder="Longitude" />
          <input value={radiusFeet} min={100} step={100} type="number" onChange={(event) => setRadiusFeet(Number(event.target.value))} />
          <button type="button" onClick={runSearch}>
            Run Search
          </button>
          <div className="dal-status">{status}</div>
        </div>

        <div className="dal-panel">
          <h3>Selected Graph</h3>
          {selectedGraph ? (
            <div className="dal-metrics">
              <span>{selectedGraph.metadata.name}</span>
              <span>Scope: {selectedScopeVersion?.scopeVersionId ?? "none"}</span>
              <span>Added feet: {fmt(Math.round(extensionSummary?.addedFeet ?? 0))}</span>
              <span>Routes: {fmt(selectedGraph.routes.length)}</span>
              <span>Stations: {fmt(selectedGraph.stations.length)}</span>
              <span>Edges: {fmt(selectedGraph.edges.length)}</span>
            </div>
          ) : (
            <div className="dal-status">Send a graph from Inventory Graphs.</div>
          )}
          <div className="dal-status">{connectedRouteSummary.join(" | ")}</div>
        </div>
      </div>

      {draft && (
        <div className="dal-panel">
          <div className="dal-panel-title-row">
            <h3>Opportunity Seed</h3>
            <span className={`dal-badge ${draft.serviceabilityStatus.toLowerCase()}`}>{draft.serviceabilityStatus}</span>
          </div>
          <div className="dal-metrics">
            <span>Distance: {fmt(Math.round(draft.distanceFeet))} ft</span>
            <span>Nearest node: {draft.nearestNode?.nodeId ?? "n/a"}</span>
            <span>Nearest station: {draft.nearestStation?.stationId ?? "n/a"}</span>
          </div>
          <div className="dal-actions">
            <button type="button" onClick={() => void saveOpportunitySeed()}>
              Save Opportunity Seed
            </button>
            <button type="button" onClick={() => setWorkspace("marketplace")}>
              Marketplace
            </button>
          </div>
        </div>
      )}

      <div className="dal-panel">
        <h3>Saved Opportunities</h3>
        {opportunities.length ? (
          <div className="dal-list">
            {opportunities.map((item) => (
              <button
                key={item.opportunityId}
                type="button"
                onClick={() => {
                  setSelectedOpportunity(item);
                  setSelectedOpportunityId(item.opportunityId);
                }}
              >
                {item.opportunityId} | {item.serviceabilityStatus} | {fmt(Math.round(item.distanceFeet))} ft
              </button>
            ))}
          </div>
        ) : (
          <div className="dal-status">No Opportunity Seeds yet.</div>
        )}
      </div>
    </section>
  );
}
