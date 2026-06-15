import { useEffect, useMemo, useState } from "react";
import {
  createId,
  listGraphExtensions,
  listInventoryGraphs,
  loadInventoryGraph,
  now,
  saveGraphExtension,
  saveScopeVersion,
} from "../api/dalClient";
import GraphMap, { type GraphLayerToggles, type GraphMapPath, type GraphMapPoint, type RenderedFeature } from "../components/GraphMap";
import { diffInventoryGraphExtensions, formatGraphDiffSummary } from "../graph/graphDiff";
import { useDALState } from "../dal/DALState";
import { certifyGraphExtension } from "../engineering/certificationEngine";
import { createScopeVersionFromGraphExtensions } from "../scopeversion/scopeVersionUtils";
import type { DALCoordinate, InventoryGraphMetadata, InventoryNode, InventoryRoute } from "../types/dal";
import type { GraphExtension, GraphExtensionType } from "../types/graphExtension";

const extensionTypes: Array<{ type: GraphExtensionType; label: string }> = [
  { type: "NEW_ROUTE", label: "New Route" },
  { type: "NEW_NODE", label: "New Node" },
  { type: "NEW_STATION", label: "New Station" },
  { type: "BUILDING_CONNECTION", label: "Building Connection" },
  { type: "LATERAL_BUILD", label: "Lateral Build" },
  { type: "REGENERATION_SITE", label: "Regeneration Site" },
  { type: "DATA_CENTER_CONNECTION", label: "Data Center Connection" },
];

function fmt(n: number | undefined) {
  return Number(n || 0).toLocaleString();
}

function fmtCoord(coord?: DALCoordinate | null) {
  if (!coord) return "n/a";
  return `${coord[1].toFixed(6)}, ${coord[0].toFixed(6)}`;
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

function nearestRoutePoint(routes: InventoryRoute[], target: DALCoordinate, routeId?: string) {
  const routePool = routeId ? routes.filter((route) => route.routeId === routeId) : routes;
  let best: { route: InventoryRoute; coord: DALCoordinate; distanceFeet: number } | null = null;
  for (const route of routePool) {
    const step = Math.max(1, Math.ceil(route.coordinates.length / 800));
    for (let i = 0; i < route.coordinates.length; i += step) {
      const coord = route.coordinates[i];
      const distanceFeet = haversineFeet(coord, target);
      if (!best || distanceFeet < best.distanceFeet) best = { route, coord, distanceFeet };
    }
  }
  return best;
}

function nearestNode(nodes: InventoryNode[], target: DALCoordinate) {
  let best: { node: InventoryNode; distanceFeet: number } | null = null;
  const step = Math.max(1, Math.ceil(nodes.length / 12000));
  for (let i = 0; i < nodes.length; i += step) {
    const node = nodes[i];
    const distanceFeet = haversineFeet([node.lon, node.lat], target);
    if (!best || distanceFeet < best.distanceFeet) best = { node, distanceFeet };
  }
  return best;
}

function featureCoordinates(feature: RenderedFeature | null) {
  const payload: any = feature?.payload;
  if (!feature) return "No selected feature.";
  if (feature.type === "node") return fmtCoord([payload.lon, payload.lat]);
  if (feature.type === "station") return fmtCoord([payload.lon, payload.lat]);
  if (feature.type === "route") return `${fmt(payload.coordinates?.length)} coordinates`;
  if (feature.type === "edge") return `${fmt(payload.coordinates?.length)} coordinates`;
  if (feature.type === "extension-node") return fmtCoord([payload.node.lng, payload.node.lat]);
  if (feature.type === "extension-station") return fmtCoord([payload.station.lng, payload.station.lat]);
  if (feature.type === "extension-route") return `${fmt(payload.route.geometry?.length)} coordinates`;
  if (feature.type === "extension-edge") return `${fmt(payload.edge.geometry?.length)} coordinates`;
  return "n/a";
}

function featureMetadata(feature: RenderedFeature | null) {
  if (!feature) return {};
  const payload: any = feature.payload;
  if (feature.type.startsWith("extension-")) return payload.extension?.metadata ?? payload;
  if (feature.type === "route") {
    return {
      routeId: payload.routeId,
      name: payload.name,
      edgeCount: payload.edgeIds?.length ?? 0,
      coordinateCount: payload.coordinates?.length ?? 0,
      lengthFeet: payload.lengthFeet,
    };
  }
  if (feature.type === "edge") {
    return {
      edgeId: payload.edgeId,
      fromNodeId: payload.fromNodeId,
      toNodeId: payload.toNodeId,
      routeId: payload.routeId,
      coordinateCount: payload.coordinates?.length ?? 0,
      lengthFeet: payload.lengthFeet,
    };
  }
  return payload;
}

export default function GraphExtensionWorkspace() {
  const {
    selectedInventoryId,
    selectedGraph,
    selectedExtension,
    setSelectedExtension,
    setSelectedExtensionId,
    setSelectedGraph,
    setSelectedGraphFeature,
    setSelectedInventoryId,
    setSelectedScopeVersion,
    setSelectedScopeVersionId,
    setWorkspace,
  } = useDALState();
  const [graphs, setGraphs] = useState<InventoryGraphMetadata[]>([]);
  const [extensions, setExtensions] = useState<GraphExtension[]>([]);
  const [pendingInventoryId, setPendingInventoryId] = useState(selectedInventoryId);
  const [selectedFeature, setSelectedFeature] = useState<RenderedFeature | null>(null);
  const [clickedCoord, setClickedCoord] = useState<DALCoordinate | null>(null);
  const [selectedRouteId, setSelectedRouteId] = useState("");
  const [extensionType, setExtensionType] = useState<GraphExtensionType>("NEW_ROUTE");
  const [buildingLat, setBuildingLat] = useState("");
  const [buildingLng, setBuildingLng] = useState("");
  const [status, setStatus] = useState("Graph Extensions ready.");
  const [layers, setLayers] = useState<GraphLayerToggles>({
    inventory: true,
    extensions: true,
    inventoryPath: true,
    candidate: true,
    buildPath: true,
    attachmentPoint: true,
    routes: true,
    stations: true,
    edges: true,
    nodes: true,
  });

  useEffect(() => {
    void refresh();
  }, []);

  useEffect(() => {
    setPendingInventoryId(selectedInventoryId);
  }, [selectedInventoryId]);

  const graphExtensions = useMemo(
    () => extensions.filter((extension) => extension.inventoryId === selectedGraph?.inventoryId && extension.graphId === selectedGraph?.graphId),
    [extensions, selectedGraph]
  );

  const diff = useMemo(() => diffInventoryGraphExtensions(selectedGraph, graphExtensions), [selectedGraph, graphExtensions]);

  const extensionBuildPaths = useMemo(
    () =>
      graphExtensions.flatMap((extension) =>
        extension.routes.map(
          (route): GraphMapPath => ({
            id: route.extensionRouteId,
            label: route.name,
            geometry: route.geometry,
            payload: { extension, route },
          })
        )
      ),
    [graphExtensions]
  );

  const extensionAttachmentPoints = useMemo(
    () =>
      graphExtensions.flatMap((extension) =>
        extension.nodes.slice(0, 1).map(
          (node): GraphMapPoint => ({
            id: node.extensionNodeId,
            label: node.name,
            coordinate: [node.lng, node.lat],
            payload: { extension, node },
          })
        )
      ),
    [graphExtensions]
  );

  const liveMeasurement = useMemo(() => {
    if (!selectedGraph || !clickedCoord) return null;
    return nearestRoutePoint(selectedGraph.routes, clickedCoord, selectedRouteId);
  }, [clickedCoord, selectedGraph, selectedRouteId]);

  async function refresh() {
    try {
      const [nextGraphs, nextExtensions] = await Promise.all([listInventoryGraphs(), listGraphExtensions()]);
      setGraphs(nextGraphs);
      setExtensions(nextExtensions);
      if (!pendingInventoryId && nextGraphs[0]) setPendingInventoryId(nextGraphs[0].inventoryId);
      setStatus("Graph extension data loaded.");
    } catch (err: any) {
      setStatus(`Graph extension load failed: ${err?.message ?? String(err)}`);
    }
  }

  async function loadGraph() {
    if (!pendingInventoryId) {
      setStatus("Select an inventory graph.");
      return;
    }
    try {
      const graph = await loadInventoryGraph(pendingInventoryId);
      setSelectedInventoryId(graph.inventoryId);
      setSelectedGraph(graph);
      setSelectedRouteId(graph.routes[0]?.routeId ?? "");
      setStatus(`Loaded ${graph.metadata.name}.`);
    } catch (err: any) {
      setStatus(`Inventory graph load failed: ${err?.message ?? String(err)}`);
    }
  }

  function setFeature(feature: RenderedFeature | null) {
    setSelectedFeature(feature);
    setSelectedGraphFeature(feature);
    if (feature?.type === "route") setSelectedRouteId((feature.payload as InventoryRoute).routeId);
    if (feature?.type === "extension-route") setSelectedExtension((feature.payload as any).extension);
  }

  function toggleLayer(layer: keyof GraphLayerToggles) {
    setLayers((prev) => ({ ...prev, [layer]: !prev[layer] }));
  }

  function targetCoordinate() {
    const parsedLat = Number(buildingLat);
    const parsedLng = Number(buildingLng);
    if (buildingLat.trim() && buildingLng.trim() && Number.isFinite(parsedLat) && Number.isFinite(parsedLng)) return [parsedLng, parsedLat] as DALCoordinate;
    return clickedCoord;
  }

  async function createExtension() {
    if (!selectedGraph) {
      setStatus("Load an inventory graph before creating an extension.");
      return;
    }
    const target = targetCoordinate();
    if (!target) {
      setStatus("Click the map or enter target building coordinates.");
      return;
    }

    const anchor = nearestRoutePoint(selectedGraph.routes, target, selectedRouteId) ?? nearestRoutePoint(selectedGraph.routes, target);
    const closestNode = nearestNode(selectedGraph.nodes, target);
    const extensionId = createId("extension");
    const timestamp = now();
    const source = "DAL Graph Extension Workspace";
    const routeLike = ["NEW_ROUTE", "BUILDING_CONNECTION", "LATERAL_BUILD", "DATA_CENTER_CONNECTION"].includes(extensionType);
    const start = anchor?.coord ?? target;
    const lengthFeet = routeLike ? haversineFeet(start, target) : 0;
    const startNodeId = createId("ext-node");
    const targetNodeId = createId("ext-node");
    const routeId = createId("ext-route");

    const extension: GraphExtension = {
      extensionId,
      inventoryId: selectedGraph.inventoryId,
      graphId: selectedGraph.graphId,
      type: extensionType,
      status: "DRAFT",
      createdAt: timestamp,
      updatedAt: timestamp,
      metadata: {
        selectedRouteId,
        nearestRouteId: anchor?.route.routeId,
        nearestNodeId: closestNode?.node.nodeId,
        nearestNodeDistanceFeet: closestNode?.distanceFeet,
        nearestRouteDistanceFeet: anchor?.distanceFeet,
        startPoint: start,
        endPoint: target,
        estimatedBuildLengthFeet: lengthFeet,
        selectedFeatureId: selectedFeature?.id,
        selectedFeatureType: selectedFeature?.type,
      },
      nodes: routeLike
        ? [
            { extensionNodeId: startNodeId, lat: start[1], lng: start[0], name: "Extension tie-in", type: "TIE_IN", source },
            { extensionNodeId: targetNodeId, lat: target[1], lng: target[0], name: extensionTypes.find((item) => item.type === extensionType)?.label ?? extensionType, type: extensionType, source },
          ]
        : [{ extensionNodeId: targetNodeId, lat: target[1], lng: target[0], name: extensionTypes.find((item) => item.type === extensionType)?.label ?? extensionType, type: extensionType, source }],
      edges: routeLike
        ? [
            {
              extensionEdgeId: createId("ext-edge"),
              sourceNodeId: startNodeId,
              targetNodeId,
              lengthFeet,
              geometry: [start, target],
              source,
            },
          ]
        : [],
      stations:
        extensionType === "NEW_STATION" || extensionType === "REGENERATION_SITE"
          ? [
              {
                extensionStationId: createId("ext-station"),
                routeId: anchor?.route.routeId,
                lat: target[1],
                lng: target[0],
                feet: 0,
                label: extensionType === "REGENERATION_SITE" ? "REGEN" : "NEW",
                source,
              },
            ]
          : [],
      routes: routeLike
        ? [
            {
              extensionRouteId: routeId,
              name: `${extensionTypes.find((item) => item.type === extensionType)?.label ?? "Extension"} ${graphExtensions.length + 1}`,
              geometry: [start, target],
              lengthFeet,
              source,
            },
          ]
        : [],
    };

    const certifiedExtension = certifyGraphExtension(selectedGraph, extension);
    const saved = await saveGraphExtension(certifiedExtension);
    setExtensions((prev) => [saved, ...prev.filter((item) => item.extensionId !== saved.extensionId)]);
    setSelectedExtension(saved);
    setSelectedExtensionId(saved.extensionId);
    setStatus(`Created ${saved.type} extension ${saved.extensionId}. Certification: ${saved.extensionCertificationStatus ?? "WARNING"}.`);
  }

  async function createScopeVersion() {
    if (!selectedGraph || graphExtensions.length === 0) {
      setStatus("Create at least one graph extension before creating a ScopeVersion.");
      return;
    }
    const certifiedExtensions = graphExtensions.map((extension) => (extension.extensionCertificationStatus ? extension : certifyGraphExtension(selectedGraph, extension)));
    const failedExtensions = certifiedExtensions.filter((extension) => extension.extensionCertificationStatus === "FAILED");
    if (failedExtensions.length) {
      setStatus(`ScopeVersion blocked: ${failedExtensions.length} extension certification failed.`);
      return;
    }
    try {
      await Promise.all(certifiedExtensions.filter((extension) => !graphExtensions.find((item) => item.extensionId === extension.extensionId)?.extensionCertificationStatus).map(saveGraphExtension));
      setExtensions((prev) => certifiedExtensions.concat(prev.filter((item) => !certifiedExtensions.some((extension) => extension.extensionId === item.extensionId))));
      const nextDiff = diffInventoryGraphExtensions(selectedGraph, certifiedExtensions);
      const scopeVersion = createScopeVersionFromGraphExtensions(selectedGraph, certifiedExtensions, nextDiff);
      const saved = await saveScopeVersion(scopeVersion);
      setSelectedScopeVersion(saved);
      setSelectedScopeVersionId(saved.scopeVersionId);
      setStatus(`Created ScopeVersion ${saved.scopeVersionId}.`);
    } catch (err: any) {
      setStatus(`ScopeVersion blocked: ${err?.message ?? String(err)}`);
    }
  }

  return (
    <section className="dal-workspace">
      <div className="dal-workspace-header">
        <div>
          <h2>DAL Graph Extensions</h2>
          <p>Propose network changes against immutable inventory graphs, then package extension references into ScopeVersions.</p>
        </div>
        <button type="button" onClick={() => void refresh()}>
          Refresh
        </button>
      </div>

      <div className="dal-grid">
        <div className="dal-panel">
          <h3>Inventory Graph</h3>
          <select value={pendingInventoryId} onChange={(event) => setPendingInventoryId(event.target.value)}>
            <option value="">Select Inventory Graph</option>
            {graphs.map((graph) => (
              <option key={graph.inventoryId} value={graph.inventoryId}>
                {graph.name} [{graph.inventoryId}]
              </option>
            ))}
          </select>
          <button type="button" onClick={() => void loadGraph()}>
            Load Graph
          </button>
          {selectedGraph && (
            <div className="dal-metrics">
              <span>Inventory ID: {selectedGraph.inventoryId}</span>
              <span>Graph ID: {selectedGraph.graphId}</span>
              <span>Nodes: {fmt(selectedGraph.nodes.length)}</span>
              <span>Edges: {fmt(selectedGraph.edges.length)}</span>
              <span>Stations: {fmt(selectedGraph.stations.length)}</span>
              <span>Routes: {fmt(selectedGraph.routes.length)}</span>
            </div>
          )}
          <div className="dal-status">{status}</div>
        </div>

        <div className="dal-panel">
          <h3>Layer Toggles</h3>
          <div className="dal-actions">
            {(["inventory", "inventoryPath", "extensions", "candidate", "buildPath", "attachmentPoint", "routes", "edges", "stations", "nodes"] as Array<keyof GraphLayerToggles>).map((layer) => (
              <button key={layer} type="button" className={layers[layer] ? "active-toggle" : ""} onClick={() => toggleLayer(layer)}>
                {layer}
              </button>
            ))}
          </div>
          <div className="dal-metrics">
            <span>Map click: {fmtCoord(clickedCoord)}</span>
            <span>Live distance: {fmt(Math.round(liveMeasurement?.distanceFeet ?? 0))} ft</span>
            <span>Nearest route: {liveMeasurement?.route.routeId ?? "n/a"}</span>
          </div>
        </div>
      </div>

      <GraphMap
        graph={selectedGraph}
        extensions={graphExtensions}
        buildPaths={extensionBuildPaths}
        attachmentPoints={extensionAttachmentPoints}
        layers={layers}
        onSelectFeature={setFeature}
        onMapCoordinateClick={setClickedCoord}
      />

      <div className="dal-grid">
        <div className="dal-panel">
          <h3>Selected Feature</h3>
          {selectedFeature ? (
            <>
              <div className="dal-metrics">
                <span>Feature ID: {selectedFeature.id}</span>
                <span>Type: {selectedFeature.type}</span>
                <span>Coordinates: {featureCoordinates(selectedFeature)}</span>
              </div>
              <pre className="dal-pre">{JSON.stringify(featureMetadata(selectedFeature), null, 2)}</pre>
            </>
          ) : (
            <div className="dal-status">Click a node, edge, route, station, or blank map location.</div>
          )}
        </div>

        <div className="dal-panel">
          <h3>Create Extension</h3>
          <div className="dal-actions">
            {extensionTypes.map((item) => (
              <button key={item.type} type="button" className={extensionType === item.type ? "active-toggle" : ""} onClick={() => setExtensionType(item.type)}>
                {item.label}
              </button>
            ))}
          </div>
          <select value={selectedRouteId} onChange={(event) => setSelectedRouteId(event.target.value)}>
            <option value="">Select existing route</option>
            {selectedGraph?.routes.slice(0, 5000).map((route) => (
              <option key={route.routeId} value={route.routeId}>
                {route.name || route.routeId}
              </option>
            ))}
          </select>
          <div className="dal-grid compact">
            <input value={buildingLat} onChange={(event) => setBuildingLat(event.target.value)} placeholder="Target building latitude" />
            <input value={buildingLng} onChange={(event) => setBuildingLng(event.target.value)} placeholder="Target building longitude" />
          </div>
          <div className="dal-metrics">
            <span>Start: {fmtCoord(liveMeasurement?.coord)}</span>
            <span>End: {fmtCoord(targetCoordinate())}</span>
            <span>Distance: {fmt(Math.round(liveMeasurement?.distanceFeet ?? 0))} ft</span>
          </div>
          <button type="button" onClick={() => void createExtension()}>
            Create Extension
          </button>
        </div>
      </div>

      <div className="dal-grid">
        <div className="dal-panel">
          <h3>Graph Change Summary</h3>
          <div className="dal-metrics">
            <span>{formatGraphDiffSummary(diff)}</span>
            <span>Extensions: {fmt(graphExtensions.length)}</span>
          </div>
          <pre className="dal-pre">{JSON.stringify(diff, null, 2)}</pre>
        </div>

        <div className="dal-panel">
          <h3>ScopeVersion</h3>
          <div className="dal-metrics">
            <span>Inventory: {selectedGraph?.inventoryId ?? "none"}</span>
            <span>Graph: {selectedGraph?.graphId ?? "none"}</span>
            <span>Extension refs: {fmt(graphExtensions.length)}</span>
            <span>Certified: {fmt(graphExtensions.filter((extension) => extension.extensionCertificationStatus === "CERTIFIED").length)}</span>
            <span>Warnings: {fmt(graphExtensions.filter((extension) => extension.extensionCertificationStatus === "WARNING" || !extension.extensionCertificationStatus).length)}</span>
            <span>Failed: {fmt(graphExtensions.filter((extension) => extension.extensionCertificationStatus === "FAILED").length)}</span>
            <span>Selected extension: {selectedExtension?.extensionId ?? "none"}</span>
          </div>
          <div className="dal-actions">
            <button type="button" onClick={() => void createScopeVersion()}>
              Create ScopeVersion
            </button>
            <button type="button" onClick={() => setWorkspace("prism")}>
              Send ScopeVersion to Prism
            </button>
          </div>
        </div>
      </div>

      <div className="dal-panel">
        <h3>Graph Extensions</h3>
        {graphExtensions.length ? (
          <div className="dal-list">
            {graphExtensions.map((extension) => (
              <button
                key={extension.extensionId}
                type="button"
                onClick={() => {
                  setSelectedExtension(extension);
                  setSelectedExtensionId(extension.extensionId);
                }}
              >
                {extension.extensionId} | {extension.type} | {extension.status} | {extension.extensionCertificationStatus ?? "WARNING"} | +{fmt(Math.round(extension.edges.reduce((sum, edge) => sum + edge.lengthFeet, 0)))} ft
              </button>
            ))}
          </div>
        ) : (
          <div className="dal-status">No extensions for this graph yet.</div>
        )}
      </div>
    </section>
  );
}
