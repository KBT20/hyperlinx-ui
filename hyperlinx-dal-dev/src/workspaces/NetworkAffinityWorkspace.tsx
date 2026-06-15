import { useEffect, useMemo, useState } from "react";
import {
  listCandidateSites,
  listInventoryGraphs,
  listOpportunitySeeds,
  loadInventoryGraph,
  saveOpportunitySeed,
} from "../api/dalClient";
import GraphMap, { type GraphLayerToggles, type GraphMapPath, type GraphMapPoint } from "../components/GraphMap";
import { analyzeNetworkAffinity, analyzeNetworkAffinities } from "../affinity/networkAffinityEngine";
import { generateOpportunitySeedForCandidate } from "../prism/opportunityGenerator";
import { useDALState } from "../dal/DALState";
import type { CandidateSite } from "../types/candidateSite";
import type { DALCoordinate, InventoryGraph, InventoryGraphMetadata } from "../types/dal";
import type { GraphExtension } from "../types/graphExtension";
import type { AttachmentStrategy, NetworkAffinity } from "../types/networkAffinity";
import type { OpportunitySeed } from "../types/portfolio";

function fmt(n: number | undefined) {
  return Number(n || 0).toLocaleString();
}

function money(n: number | undefined) {
  return Number(n || 0).toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function statusClass(status: string | undefined) {
  if (status === "CRITICAL") return "fail";
  if (status === "HIGH") return "warning";
  return "pass";
}

function affinityPathExtension(affinity: NetworkAffinity | null): GraphExtension[] {
  const geometry = affinity?.buildPath.geometry.filter((coord): coord is DALCoordinate => Array.isArray(coord) && coord.length >= 2) ?? [];
  if (!affinity || geometry.length < 2) return [];
  const start = geometry[0];
  const end = geometry[geometry.length - 1];
  return [
    {
      extensionId: `affinity-${affinity.siteId}`,
      inventoryId: affinity.inventoryId,
      graphId: affinity.graphId,
      type: "LATERAL_BUILD",
      status: "CANDIDATE",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      metadata: {
        source: "NetworkAffinityWorkspace",
        attachmentType: affinity.preferredStrategy.attachmentType,
        routeId: affinity.buildPath.routeId,
        nodeId: affinity.buildPath.nodeId,
        stationId: affinity.buildPath.stationId,
      },
      nodes: [
        { extensionNodeId: `${affinity.siteId}-site`, lat: start[1], lng: start[0], name: "Candidate site", type: "CandidateSite", source: "NetworkAffinity" },
        { extensionNodeId: `${affinity.siteId}-attach`, lat: end[1], lng: end[0], name: "Attachment point", type: "AttachmentPoint", source: "NetworkAffinity" },
      ],
      edges: [
        {
          extensionEdgeId: `${affinity.siteId}-build-path`,
          sourceNodeId: `${affinity.siteId}-site`,
          targetNodeId: `${affinity.siteId}-attach`,
          lengthFeet: affinity.buildPath.buildFeet,
          geometry,
          source: "NetworkAffinity",
        },
      ],
      stations: [],
      routes: [
        {
          extensionRouteId: `${affinity.siteId}-build-route`,
          name: `${affinity.preferredStrategy.attachmentType} path`,
          geometry,
          lengthFeet: affinity.buildPath.buildFeet,
          source: "NetworkAffinity",
        },
      ],
    },
  ];
}

function strategyLabel(strategy: AttachmentStrategy | undefined) {
  return strategy?.attachmentType?.replaceAll("_", " ") ?? "none";
}

export default function NetworkAffinityWorkspace() {
  const {
    selectedCandidateSite,
    selectedCandidateSiteId,
    selectedGraph,
    selectedInventoryId,
    selectedNetworkAffinity,
    setSelectedCandidateSite,
    setSelectedCandidateSiteId,
    setSelectedGraph,
    setSelectedGraphFeature,
    setSelectedInventoryId,
    setSelectedNetworkAffinity,
    setSelectedOpportunitySeed,
    setSelectedOpportunitySeedId,
    setWorkspace,
  } = useDALState();
  const [graphs, setGraphs] = useState<InventoryGraphMetadata[]>([]);
  const [sites, setSites] = useState<CandidateSite[]>([]);
  const [seeds, setSeeds] = useState<OpportunitySeed[]>([]);
  const [inventoryId, setInventoryId] = useState(selectedInventoryId);
  const [candidateId, setCandidateId] = useState(selectedCandidateSiteId);
  const [batchLimit, setBatchLimit] = useState<number | "all">(25);
  const [batchAffinities, setBatchAffinities] = useState<NetworkAffinity[]>([]);
  const [layers, setLayers] = useState<GraphLayerToggles>({
    inventory: true,
    extensions: true,
    inventoryPath: true,
    candidate: true,
    buildPath: true,
    attachmentPoint: true,
    routes: true,
    stations: true,
    edges: false,
    nodes: false,
  });
  const [status, setStatus] = useState("Network Affinity ready.");

  useEffect(() => {
    void refresh();
  }, []);

  useEffect(() => {
    if (!selectedGraph || !selectedCandidateSite) return;
    const affinity = analyzeNetworkAffinity(selectedGraph, selectedCandidateSite);
    setSelectedNetworkAffinity(affinity);
  }, [selectedCandidateSite, selectedGraph, setSelectedNetworkAffinity]);

  async function refresh() {
    try {
      const [nextGraphs, nextSites, nextSeeds] = await Promise.all([listInventoryGraphs(), listCandidateSites(), listOpportunitySeeds()]);
      setGraphs(nextGraphs);
      setSites(nextSites);
      setSeeds(nextSeeds);
      const nextInventoryId = selectedInventoryId || selectedGraph?.inventoryId || nextGraphs[0]?.inventoryId || "";
      const nextCandidateId = selectedCandidateSiteId || selectedCandidateSite?.candidateId || nextSites[0]?.candidateId || "";
      setInventoryId(nextInventoryId);
      setCandidateId(nextCandidateId);
      if (!selectedCandidateSite && nextCandidateId) setSelectedCandidateSite(nextSites.find((site) => site.candidateId === nextCandidateId) ?? null);
      setStatus("Network Affinity data loaded.");
    } catch (err: any) {
      setStatus(`Network Affinity load failed: ${err?.message ?? String(err)}`);
    }
  }

  async function ensureGraph() {
    if (selectedGraph && selectedGraph.inventoryId === inventoryId) return selectedGraph;
    if (!inventoryId) return null;
    const graph = await loadInventoryGraph(inventoryId);
    setSelectedInventoryId(graph.inventoryId);
    setSelectedGraph(graph);
    return graph;
  }

  function selectSite(siteId: string) {
    const site = sites.find((item) => item.candidateId === siteId) ?? null;
    setCandidateId(siteId);
    setSelectedCandidateSite(site);
    setSelectedCandidateSiteId(site?.candidateId ?? "");
  }

  async function analyzeSelected() {
    const graph = await ensureGraph();
    const site = sites.find((item) => item.candidateId === candidateId) ?? selectedCandidateSite;
    if (!graph || !site) {
      setStatus("Select an inventory graph and candidate site before running affinity.");
      return;
    }
    const affinity = analyzeNetworkAffinity(graph, site);
    setSelectedNetworkAffinity(affinity);
    setStatus(
      affinity
        ? `Affinity ${Math.round(affinity.affinityScore)} for ${site.companyName}: ${strategyLabel(affinity.preferredStrategy)}, ${fmt(Math.round(affinity.estimatedBuildFootage))} ft.`
        : "Affinity could not be calculated for this site."
    );
  }

  async function analyzeBatch() {
    const graph = await ensureGraph();
    if (!graph) {
      setStatus("Load an inventory graph before batch analysis.");
      return;
    }
    const geocodedSites = sites.filter((site) => Number.isFinite(site.latitude) && Number.isFinite(site.longitude));
    const candidates = batchLimit === "all" ? geocodedSites : geocodedSites.slice(0, batchLimit);
    const affinities = analyzeNetworkAffinities(graph, candidates).sort((a, b) => b.affinityScore - a.affinityScore);
    setBatchAffinities(affinities);
    if (affinities[0]) setSelectedNetworkAffinity(affinities[0]);
    setStatus(`Analyzed ${fmt(affinities.length)} sites for Network Affinity.`);
  }

  async function saveSeedWithAffinity() {
    const graph = await ensureGraph();
    const site = sites.find((item) => item.candidateId === candidateId) ?? selectedCandidateSite;
    if (!graph || !site) {
      setStatus("Select an inventory graph and candidate site before saving an OpportunitySeed.");
      return;
    }
    const seed = generateOpportunitySeedForCandidate(graph, site);
    if (!seed) {
      setStatus("OpportunitySeed generation failed for selected site.");
      return;
    }
    const saved = await saveOpportunitySeed(seed);
    setSeeds((prev) => [saved, ...prev.filter((item) => item.id !== saved.id)]);
    setSelectedOpportunitySeed(saved);
    setSelectedOpportunitySeedId(saved.id);
    setSelectedNetworkAffinity(saved.networkAffinity ?? selectedNetworkAffinity);
    setStatus(`Saved OpportunitySeed ${saved.id} with ${strategyLabel(saved.attachmentStrategy)} affinity.`);
  }

  const activeSite = useMemo(
    () => sites.find((site) => site.candidateId === candidateId) ?? selectedCandidateSite ?? sites[0] ?? null,
    [candidateId, selectedCandidateSite, sites]
  );
  const activeSeed = useMemo(
    () => seeds.find((seed) => seed.candidateSiteId === activeSite?.candidateId) ?? seeds.find((seed) => seed.networkAffinity?.siteId === activeSite?.candidateId),
    [activeSite?.candidateId, seeds]
  );
  const activeAffinity = selectedNetworkAffinity ?? activeSeed?.networkAffinity ?? null;
  const pathExtensions = useMemo(() => affinityPathExtension(activeAffinity), [activeAffinity]);
  const candidatePoints = useMemo(
    () =>
      activeSite && Number.isFinite(activeSite.longitude) && Number.isFinite(activeSite.latitude)
        ? [
            {
              id: activeSite.candidateId,
              label: activeSite.companyName,
              coordinate: [Number(activeSite.longitude), Number(activeSite.latitude)] as DALCoordinate,
              payload: activeSite,
            } satisfies GraphMapPoint,
          ]
        : [],
    [activeSite]
  );
  const buildPaths = useMemo(
    () =>
      activeAffinity
        ? [
            {
              id: activeAffinity.buildPath.corridorPath?.id ?? `${activeAffinity.siteId}-build-path`,
              label: `${activeAffinity.preferredStrategy.attachmentType} build path`,
              geometry: activeAffinity.buildPath.geometry,
              payload: activeAffinity.buildPath,
            } satisfies GraphMapPath,
          ]
        : [],
    [activeAffinity]
  );
  const attachmentPoints = useMemo(
    () =>
      activeAffinity?.preferredAttachmentPoint
        ? [
            {
              id: `${activeAffinity.siteId}-attachment`,
              label: activeAffinity.preferredStrategy.attachmentType,
              coordinate: activeAffinity.preferredAttachmentPoint,
              payload: activeAffinity.preferredStrategy,
            } satisfies GraphMapPoint,
          ]
        : [],
    [activeAffinity]
  );

  function toggleLayer(layer: keyof GraphLayerToggles) {
    setLayers((prev) => ({ ...prev, [layer]: !prev[layer] }));
  }

  return (
    <section className="dal-workspace wide">
      <div className="dal-workspace-header">
        <div>
          <h2>DAL Network Affinity</h2>
          <p>Deterministic candidate-site attachment analysis against imported inventory graphs. Outputs advisory opportunity context; it does not mutate carrier inventory.</p>
        </div>
        <button type="button" onClick={() => void refresh()}>
          Refresh
        </button>
      </div>

      <div className="dal-grid">
        <div className="dal-panel">
          <h3>Candidate Panel</h3>
          <div className="dal-grid compact">
            <select
              value={inventoryId}
              onChange={(event) => {
                setInventoryId(event.target.value);
                setSelectedInventoryId(event.target.value);
              }}
            >
              <option value="">Select inventory graph</option>
              {graphs.map((graph) => (
                <option key={graph.inventoryId} value={graph.inventoryId}>
                  {graph.name} ({fmt(graph.routeCount)} routes)
                </option>
              ))}
            </select>
            <select value={candidateId} onChange={(event) => selectSite(event.target.value)}>
              <option value="">Select candidate site</option>
              {sites.map((site) => (
                <option key={site.candidateId} value={site.candidateId}>
                  {site.companyName}
                </option>
              ))}
            </select>
          </div>
          <div className="dal-metrics">
            <span>Site: {activeSite?.companyName ?? "none"}</span>
            <span>Facility: {activeSite?.facilityType ?? "n/a"}</span>
            <span>Market: {activeSite?.marketSegment ?? "n/a"}</span>
            <span>Lat/Lon: {activeSite?.latitude?.toFixed(5) ?? "n/a"}, {activeSite?.longitude?.toFixed(5) ?? "n/a"}</span>
            <span>Sites Loaded: {fmt(sites.length)}</span>
            <span>Seeds Loaded: {fmt(seeds.length)}</span>
          </div>
          <div className="dal-actions">
            <button type="button" onClick={() => void analyzeSelected()}>
              Analyze Site
            </button>
            <button type="button" onClick={() => void saveSeedWithAffinity()}>
              Save Seed With Affinity
            </button>
            <button type="button" onClick={() => setWorkspace("portfolio")}>
              Portfolio
            </button>
          </div>
          <div className="dal-status">{status}</div>
        </div>

        <div className="dal-panel">
          <h3>Affinity Analysis</h3>
          {activeAffinity ? (
            <div className="dal-metrics">
              <span>Affinity Score: {Math.round(activeAffinity.affinityScore)}</span>
              <span>Attachment: {strategyLabel(activeAffinity.preferredStrategy)}</span>
              <span>Build Feet: {fmt(Math.round(activeAffinity.estimatedBuildFootage))}</span>
              <span>Build Miles: {Number(activeAffinity.buildPath.buildMiles ?? 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
              <span>Estimated Cost: {money(activeAffinity.estimatedCost)}</span>
              <span>Constructability: {fmt(Math.round(activeAffinity.constructabilityScore ?? 0))}</span>
              <span>Permit Score: {fmt(Math.round(activeAffinity.permitScore ?? 0))}</span>
              <span>Parcel Score: {fmt(Math.round(activeAffinity.parcelScore ?? 0))}</span>
              <span>Road Access: {fmt(Math.round(activeAffinity.roadAccessScore ?? 0))}</span>
              <span>Crossing Score: {fmt(Math.round(activeAffinity.crossingScore ?? 0))}</span>
              <span>Risk Score: {fmt(Math.round(activeAffinity.riskScore))}</span>
              <span>Construction: {activeAffinity.constructionType}</span>
              <span>Route: {activeAffinity.nearestRoute.routeId ?? "n/a"}</span>
              <span>Route Distance: {fmt(Math.round(activeAffinity.nearestRoute.distanceFeet))} ft</span>
              <span>Node: {activeAffinity.nearestNode.nodeId ?? "n/a"}</span>
              <span>Node Distance: {fmt(Math.round(activeAffinity.nearestNode.distanceFeet))} ft</span>
              <span>Station: {activeAffinity.nearestStation.stationId ?? "n/a"}</span>
              <span>Station Distance: {fmt(Math.round(activeAffinity.nearestStation.distanceFeet))} ft</span>
              <span className={statusClass(activeAffinity.capacity.projectedUtilization)}>Capacity: {activeAffinity.capacity.projectedUtilization}</span>
            </div>
          ) : (
            <div className="dal-status">Run affinity to calculate nearest route, node, station, attachment strategy, build path, and capacity.</div>
          )}
        </div>
      </div>

      <div className="dal-grid">
        <div className="dal-panel">
          <h3>Path Visualization</h3>
          <div className="dal-actions">
            {(["inventoryPath", "candidate", "buildPath", "attachmentPoint", "routes", "stations", "edges", "nodes"] as Array<keyof GraphLayerToggles>).map((layer) => (
              <button key={layer} type="button" className={layers[layer] ? "active-toggle" : ""} onClick={() => toggleLayer(layer)}>
                {layer}
              </button>
            ))}
          </div>
          <GraphMap
            graph={selectedGraph}
            extensions={pathExtensions}
            candidatePoints={candidatePoints}
            buildPaths={buildPaths}
            attachmentPoints={attachmentPoints}
            layers={layers}
            onSelectFeature={setSelectedGraphFeature}
          />
        </div>

        <div className="dal-panel">
          <h3>Build Path</h3>
          {activeAffinity ? (
            <div className="dal-metrics">
              <span>Route ID: {activeAffinity.buildPath.routeId ?? "n/a"}</span>
              <span>Node ID: {activeAffinity.buildPath.nodeId ?? "n/a"}</span>
              <span>Station ID: {activeAffinity.buildPath.stationId ?? "n/a"}</span>
              <span>Attachment Type: {strategyLabel(activeAffinity.preferredStrategy)}</span>
              <span>Build Feet: {fmt(activeAffinity.buildPath.buildFeet)}</span>
              <span>Build Miles: {Number(activeAffinity.buildPath.buildMiles ?? 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
              <span>Estimated Cost: {money(activeAffinity.buildPath.estimatedCost ?? activeAffinity.estimatedCost)}</span>
              <span>Permit Cost: {money(activeAffinity.estimatedPermitCost ?? activeAffinity.buildPath.estimatedPermitCost)}</span>
              <span>Crossing Cost: {money(activeAffinity.estimatedCrossingCost ?? activeAffinity.buildPath.estimatedCrossingCost)}</span>
              <span>Environmental Cost: {money(activeAffinity.estimatedEnvironmentalCost ?? activeAffinity.buildPath.estimatedEnvironmentalCost)}</span>
              <span>Engineering Cost: {money(activeAffinity.estimatedEngineeringCost ?? activeAffinity.buildPath.estimatedEngineeringCost)}</span>
              <span>Risk Score: {fmt(Math.round(activeAffinity.buildPath.riskScore ?? activeAffinity.riskScore))}</span>
              <span>Buildable: {activeAffinity.constructabilityAssessment?.buildableStatus ?? "n/a"}</span>
              <span>Authorities: {activeAffinity.constructabilityAssessment?.permitting.authorities.join(", ") ?? "n/a"}</span>
              <span>Construction: {activeAffinity.buildPath.constructionType ?? activeAffinity.constructionType}</span>
              <span>Crossings: {fmt(activeAffinity.buildPath.estimatedCrossings)}</span>
              <span>Rail: {fmt(activeAffinity.buildPath.railCrossingCount)}</span>
              <span>Highway: {fmt(activeAffinity.buildPath.highwayCrossingCount)}</span>
              <span>Water: {fmt(activeAffinity.buildPath.waterCrossingCount)}</span>
              <span>Turns: {fmt(activeAffinity.buildPath.turnCount)}</span>
              <span>Segments: {fmt(activeAffinity.buildPath.segmentCount)}</span>
              <span>Bores: {fmt(activeAffinity.buildPath.estimatedBores)}</span>
              <span>Aerial Feet: {fmt(activeAffinity.buildPath.estimatedAerialFeet)}</span>
              <span>Underground Feet: {fmt(activeAffinity.buildPath.estimatedUndergroundFeet)}</span>
              <span>Network Segment: {activeAffinity.networkSegmentUtilized ?? "n/a"}</span>
            </div>
          ) : (
            <div className="dal-status">No build path selected.</div>
          )}
        </div>
      </div>

      <div className="dal-panel">
        <div className="dal-panel-title-row">
          <h3>Strategy Comparison</h3>
          <div className="dal-actions">
            {([10, 25, 50, 100, "all"] as Array<number | "all">).map((size) => (
              <button key={size} type="button" className={batchLimit === size ? "active-toggle" : ""} onClick={() => setBatchLimit(size)}>
                {size === "all" ? "All" : size}
              </button>
            ))}
            <button type="button" onClick={() => void analyzeBatch()}>
              Batch Analyze
            </button>
          </div>
        </div>
        {activeAffinity ? (
          <div className="dal-table-wrap">
            <table className="dal-table">
              <thead>
                <tr>
                  <th>Strategy</th>
                  <th>Build</th>
                  <th>Cost</th>
                  <th>Annual Revenue</th>
                  <th>Payback</th>
                  <th>ROI</th>
                  <th>Risk</th>
                  <th>Constructability</th>
                  <th>Permit</th>
                  <th>Crossing</th>
                  <th>Construction</th>
                  <th>Engineering</th>
                  <th>Financial</th>
                  <th>Strategic</th>
                  <th>Composite</th>
                  <th>Capacity</th>
                </tr>
              </thead>
              <tbody>
                {activeAffinity.strategies.map((strategy) => (
                  <tr key={strategy.attachmentType} className={strategy.attachmentType === activeAffinity.preferredStrategy.attachmentType ? "selected-row" : ""}>
                    <td>{strategyLabel(strategy)}</td>
                    <td>{fmt(Math.round(strategy.buildFeet))} ft</td>
                    <td>{money(strategy.estimatedCost)}</td>
                    <td>{money(strategy.estimatedRevenueAnnual)}</td>
                    <td>{fmt(Math.round(strategy.paybackMonths))} mo</td>
                    <td>{Number(strategy.roi).toLocaleString(undefined, { maximumFractionDigits: 2 })}x</td>
                    <td>{fmt(Math.round(strategy.riskScore))}</td>
                    <td>{fmt(Math.round(strategy.constructabilityScore ?? strategy.buildPath.constructabilityScore ?? 0))}</td>
                    <td>{fmt(Math.round(strategy.permitScore ?? 0))}</td>
                    <td>{fmt(Math.round(strategy.crossingScore ?? 0))}</td>
                    <td>{strategy.constructionType}</td>
                    <td>{fmt(Math.round(strategy.engineeringScore))}</td>
                    <td>{fmt(Math.round(strategy.financialScore))}</td>
                    <td>{fmt(Math.round(strategy.strategicScore))}</td>
                    <td>{fmt(Math.round(strategy.compositeScore))}</td>
                    <td className={statusClass(strategy.capacity.projectedUtilization)}>{strategy.capacity.projectedUtilization}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="dal-status">Select a candidate and run analysis to compare attachment strategies.</div>
        )}
      </div>

      <div className="dal-grid">
        <div className="dal-panel">
          <h3>Top 10 By Affinity</h3>
          {batchAffinities.length ? (
            <div className="dal-list">
              {batchAffinities.slice(0, 10).map((affinity) => (
                <button
                  key={affinity.siteId}
                  type="button"
                  onClick={() => {
                    selectSite(affinity.siteId);
                    setSelectedNetworkAffinity(affinity);
                  }}
                >
                  {affinity.siteId} | {Math.round(affinity.affinityScore)} | {strategyLabel(affinity.preferredStrategy)} | {fmt(Math.round(affinity.estimatedBuildFootage))} ft
                </button>
              ))}
            </div>
          ) : (
            <div className="dal-status">Run batch analysis for affinity rankings.</div>
          )}
        </div>

        <div className="dal-panel">
          <h3>Selected Seed Context</h3>
          <pre className="dal-pre">{JSON.stringify(activeSeed ?? activeAffinity ?? {}, null, 2)}</pre>
        </div>
      </div>
    </section>
  );
}
