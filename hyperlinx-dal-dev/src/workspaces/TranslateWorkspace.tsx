import JSZip from "jszip";
import { useMemo, useState } from "react";
import { saveInventoryGraph } from "../api/dalClient";
import { useDALState } from "../dal/DALState";
import type { DALCoordinate, InventoryEdge, InventoryGraph, InventoryNode, InventoryRoute, InventoryStation, ValidationStatus } from "../types/dal";

type SourceType = "CSV" | "KML" | "KMZ" | "GeoJSON";

type SourceRoute = {
  routeId: string;
  name: string;
  coordinates: DALCoordinate[];
};

type ParseIssue = {
  check: ValidationCheck;
  message: string;
};

type ValidationCheck =
  | "Missing coordinates"
  | "Duplicate nodes"
  | "Duplicate edges"
  | "Orphan nodes"
  | "Invalid geometry"
  | "Empty routes"
  | "Unconnected routes"
  | "Excessive duplicate geometry"
  | "Unsupported source structure";

type ValidationRow = {
  check: ValidationCheck;
  result: ValidationStatus;
  count: number;
  message: string;
};

type BuiltGraph = {
  payload: InventoryGraph;
  validationRows: ValidationRow[];
  validationStatus: ValidationStatus;
};

type ParseResult = {
  sourceType: SourceType;
  sourceFile: string;
  sourceRoutes: SourceRoute[];
  issues: ParseIssue[];
};

const STATION_INTERVAL_FEET = 1000;
const FEET_PER_METER = 3.28084;

function createId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return `${prefix}-${crypto.randomUUID()}`;
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function baseName(fileName: string) {
  return fileName.replace(/\.[^.]+$/, "") || fileName;
}

function fmt(n: number | undefined) {
  return Number(n || 0).toLocaleString();
}

function parseNumber(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;
  const parsed = Number(value.trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function validCoordinate(coord: DALCoordinate | null | undefined): coord is DALCoordinate {
  return Boolean(coord && Number.isFinite(coord[0]) && Number.isFinite(coord[1]) && Math.abs(coord[0]) <= 180 && Math.abs(coord[1]) <= 90);
}

function coordKey(coord: DALCoordinate) {
  return `${coord[0].toFixed(7)},${coord[1].toFixed(7)}`;
}

function haversineFeet(a: DALCoordinate, b: DALCoordinate) {
  const r = 6371008.8;
  const toRad = Math.PI / 180;
  const lat1 = a[1] * toRad;
  const lat2 = b[1] * toRad;
  const dLat = (b[1] - a[1]) * toRad;
  const dLon = (b[0] - a[0]) * toRad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(h)) * FEET_PER_METER;
}

function formatStation(feet: number) {
  const rounded = Math.round(feet);
  return `${Math.floor(rounded / 100)}+${String(rounded % 100).padStart(2, "0")}`;
}

function interpolateCoordinate(a: DALCoordinate, b: DALCoordinate, ratio: number): DALCoordinate {
  return [a[0] + (b[0] - a[0]) * ratio, a[1] + (b[1] - a[1]) * ratio];
}

function coordinateAtFeet(route: DALCoordinate[], targetFeet: number) {
  if (targetFeet <= 0) return route[0];
  let cursor = 0;
  for (let index = 1; index < route.length; index++) {
    const a = route[index - 1];
    const b = route[index];
    const segmentFeet = haversineFeet(a, b);
    if (cursor + segmentFeet >= targetFeet) {
      const ratio = segmentFeet > 0 ? (targetFeet - cursor) / segmentFeet : 0;
      return interpolateCoordinate(a, b, Math.max(0, Math.min(1, ratio)));
    }
    cursor += segmentFeet;
  }
  return route[route.length - 1];
}

function parseCsv(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    const next = text[index + 1];
    if (char === '"' && quoted && next === '"') {
      field += '"';
      index++;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(field);
      field = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index++;
      row.push(field);
      if (row.some((cell) => cell.trim())) rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }

  row.push(field);
  if (row.some((cell) => cell.trim())) rows.push(row);
  return rows;
}

function normalizedHeader(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

function findHeader(headers: string[], candidates: string[]) {
  const normalized = headers.map(normalizedHeader);
  return candidates.map(normalizedHeader).map((candidate) => normalized.indexOf(candidate)).find((index) => index >= 0) ?? -1;
}

function parseCsvRoutes(fileName: string, text: string): ParseResult {
  const rows = parseCsv(text);
  const [headers = [], ...body] = rows;
  const latIndex = findHeader(headers, ["lat", "latitude", "y"]);
  const lonIndex = findHeader(headers, ["lon", "lng", "longitude", "x"]);
  const routeIndex = findHeader(headers, ["route", "routeId", "route_id", "segment", "name"]);
  const sequenceIndex = findHeader(headers, ["sequence", "seq", "order", "index"]);
  const issues: ParseIssue[] = [];
  const groups = new Map<string, Array<{ order: number; coord: DALCoordinate }>>();

  if (latIndex < 0 || lonIndex < 0) {
    issues.push({ check: "Missing coordinates", message: "CSV does not include latitude/longitude columns." });
    return { sourceType: "CSV", sourceFile: fileName, sourceRoutes: [], issues };
  }

  body.forEach((cells, index) => {
    const lat = parseNumber(cells[latIndex]);
    const lon = parseNumber(cells[lonIndex]);
    if (lat === null || lon === null || !validCoordinate([lon, lat])) {
      issues.push({ check: "Missing coordinates", message: `CSV row ${index + 2} has missing or invalid coordinates.` });
      return;
    }

    const routeName = String(routeIndex >= 0 ? cells[routeIndex] || baseName(fileName) : baseName(fileName)).trim() || baseName(fileName);
    const order = sequenceIndex >= 0 ? Number(cells[sequenceIndex]) : index;
    const routeRows = groups.get(routeName) ?? [];
    routeRows.push({ order: Number.isFinite(order) ? order : index, coord: [lon, lat] });
    groups.set(routeName, routeRows);
  });

  const sourceRoutes = Array.from(groups.entries()).map(([name, records], index) => ({
    routeId: `route-${index + 1}`,
    name,
    coordinates: records.sort((a, b) => a.order - b.order).map((record) => record.coord),
  }));

  return { sourceType: "CSV", sourceFile: fileName, sourceRoutes, issues };
}

function repairKmlNamespaces(xml: string) {
  let repaired = xml;
  const repairs: Array<[RegExp, string]> = [
    [/\bxsi:/, 'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"'],
    [/\bgx:/, 'xmlns:gx="http://www.google.com/kml/ext/2.2"'],
    [/\bkml:/, 'xmlns:kml="http://www.opengis.net/kml/2.2"'],
  ];

  for (const [prefixPattern, declaration] of repairs) {
    const attrName = declaration.split("=")[0];
    if (prefixPattern.test(repaired) && !repaired.includes(attrName)) {
      repaired = repaired.replace(/<([A-Za-z_][\w.-]*(?::[A-Za-z_][\w.-]*)?)([^<>]*)>/, `<$1$2 ${declaration}>`);
    }
  }

  return repaired;
}

function parseXml(text: string) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(repairKmlNamespaces(text), "application/xml");
  const parserError = Array.from(doc.getElementsByTagName("parsererror"))
    .map((item) => item.textContent?.trim())
    .filter(Boolean)
    .join("\n");
  if (parserError) throw new Error(parserError);
  return doc;
}

function byLocalName(root: Document | Element, localName: string): Element[] {
  const nsMatches = Array.from(root.getElementsByTagNameNS("*", localName));
  if (nsMatches.length) return nsMatches;
  const all = Array.from(root.querySelectorAll("*"));
  return all.filter((item) => item.localName === localName || item.nodeName.split(":").pop() === localName);
}

function nearestPlacemarkName(lineString: Element, fallback: string) {
  let current: Element | null = lineString;
  while (current) {
    if (current.localName === "Placemark" || current.nodeName.split(":").pop() === "Placemark") {
      const nameNode = byLocalName(current, "name")[0];
      return nameNode?.textContent?.trim() || fallback;
    }
    current = current.parentElement;
  }
  return fallback;
}

function parseKmlCoordinateText(text: string) {
  return text
    .trim()
    .split(/\s+/)
    .map((token) => {
      const [lonRaw, latRaw] = token.split(",");
      const lon = parseNumber(lonRaw);
      const lat = parseNumber(latRaw);
      return lon === null || lat === null ? null : ([lon, lat] as DALCoordinate);
    })
    .filter(validCoordinate) as DALCoordinate[];
}

function parseKmlRoutes(fileName: string, text: string, sourceType: SourceType): ParseResult {
  const doc = parseXml(text);
  const issues: ParseIssue[] = [];
  const lineStrings = byLocalName(doc, "LineString");
  const sourceRoutes = lineStrings
    .map((lineString, index) => {
      const coordinateNode = byLocalName(lineString, "coordinates")[0];
      const coordinates = parseKmlCoordinateText(coordinateNode?.textContent ?? "");
      if (coordinates.length < 2) {
        issues.push({ check: "Invalid geometry", message: `KML LineString ${index + 1} has fewer than two valid coordinates.` });
      }
      const name = nearestPlacemarkName(lineString, `${baseName(fileName)} ${index + 1}`);
      return { routeId: `route-${index + 1}`, name, coordinates };
    })
    .filter((route) => route.coordinates.length > 0);

  if (!lineStrings.length) issues.push({ check: "Unsupported source structure", message: "No KML LineString geometry was found." });
  return { sourceType, sourceFile: fileName, sourceRoutes, issues };
}

async function parseKmzRoutes(file: File): Promise<ParseResult> {
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const kmlFiles = Object.values(zip.files).filter((entry) => !entry.dir && entry.name.toLowerCase().endsWith(".kml"));
  const selected = kmlFiles.find((entry) => entry.name.toLowerCase().endsWith("doc.kml")) ?? kmlFiles[0];
  if (!selected) {
    return {
      sourceType: "KMZ",
      sourceFile: file.name,
      sourceRoutes: [],
      issues: [{ check: "Unsupported source structure", message: "KMZ does not contain a KML file." }],
    };
  }
  return parseKmlRoutes(file.name, await selected.async("text"), "KMZ");
}

function coordinateFromGeoJson(value: unknown): DALCoordinate | null {
  if (!Array.isArray(value) || value.length < 2) return null;
  const lon = parseNumber(value[0]);
  const lat = parseNumber(value[1]);
  const coord = lon === null || lat === null ? null : ([lon, lat] as DALCoordinate);
  return validCoordinate(coord) ? coord : null;
}

function routeNameFromProperties(properties: any, fallback: string) {
  return String(properties?.name ?? properties?.route ?? properties?.routeId ?? properties?.segment ?? fallback);
}

function parseGeoJsonRoutes(fileName: string, text: string): ParseResult {
  const data = JSON.parse(text);
  const issues: ParseIssue[] = [];
  const sourceRoutes: SourceRoute[] = [];

  function addLineString(rawCoords: unknown[], name: string) {
    const parsedCoordinates = rawCoords.map(coordinateFromGeoJson);
    const coordinates = parsedCoordinates.filter(validCoordinate);
    const missingCoordinates = parsedCoordinates.length - coordinates.length;
    if (missingCoordinates > 0) {
      issues.push({ check: "Missing coordinates", message: `${name} has ${missingCoordinates.toLocaleString()} invalid coordinate positions.` });
    }
    if (coordinates.length < 2) {
      issues.push({ check: "Invalid geometry", message: `${name} has fewer than two valid coordinates.` });
    }
    sourceRoutes.push({ routeId: `route-${sourceRoutes.length + 1}`, name, coordinates });
  }

  function readGeometry(geometry: any, properties: any, fallback: string) {
    if (!geometry) {
      issues.push({ check: "Invalid geometry", message: `${fallback} has no geometry.` });
      return;
    }
    if (geometry.type === "LineString" && Array.isArray(geometry.coordinates)) {
      addLineString(geometry.coordinates, routeNameFromProperties(properties, fallback));
    } else if (geometry.type === "MultiLineString" && Array.isArray(geometry.coordinates)) {
      geometry.coordinates.forEach((coords: unknown[], index: number) => addLineString(coords, `${routeNameFromProperties(properties, fallback)} ${index + 1}`));
    } else if (geometry.type === "GeometryCollection" && Array.isArray(geometry.geometries)) {
      geometry.geometries.forEach((child: unknown, index: number) => readGeometry(child, properties, `${fallback} ${index + 1}`));
    } else {
      issues.push({ check: "Unsupported source structure", message: `${fallback} uses unsupported geometry type ${geometry.type ?? "unknown"}.` });
    }
  }

  if (data?.type === "FeatureCollection" && Array.isArray(data.features)) {
    data.features.forEach((feature: any, index: number) => readGeometry(feature.geometry, feature.properties, `Feature ${index + 1}`));
  } else if (data?.type === "Feature") {
    readGeometry(data.geometry, data.properties, baseName(fileName));
  } else {
    readGeometry(data, {}, baseName(fileName));
  }

  return { sourceType: "GeoJSON", sourceFile: fileName, sourceRoutes, issues };
}

async function parseUpload(file: File) {
  const name = file.name.toLowerCase();
  if (name.endsWith(".csv")) return parseCsvRoutes(file.name, await file.text());
  if (name.endsWith(".kml")) return parseKmlRoutes(file.name, await file.text(), "KML");
  if (name.endsWith(".kmz")) return parseKmzRoutes(file);
  if (name.endsWith(".geojson") || name.endsWith(".json")) return parseGeoJsonRoutes(file.name, await file.text());
  throw new Error("Unsupported file type.");
}

function validationStatus(rows: ValidationRow[]): ValidationStatus {
  if (rows.some((row) => row.result === "FAIL")) return "FAIL";
  if (rows.some((row) => row.result === "WARNING")) return "WARNING";
  return "PASS";
}

function rowFor(check: ValidationCheck, count: number, fail: boolean, warningMessage: string, passMessage: string): ValidationRow {
  return {
    check,
    count,
    result: count === 0 ? "PASS" : fail ? "FAIL" : "WARNING",
    message: count === 0 ? passMessage : warningMessage,
  };
}

function buildInventoryGraph(parseResult: ParseResult): BuiltGraph {
  const inventoryId = createId("inventory");
  const graphId = createId("graph");
  const createdDate = new Date().toISOString();
  const nodes: InventoryNode[] = [];
  const edges: InventoryEdge[] = [];
  const stations: InventoryStation[] = [];
  const routes: InventoryRoute[] = [];
  const nodeByCoord = new Map<string, InventoryNode>();
  const pointCounts = new Map<string, number>();
  const duplicateEdges = new Set<string>();
  const seenEdges = new Set<string>();
  let invalidGeometryCount = parseResult.issues.filter((issue) => issue.check === "Invalid geometry").length;

  for (const sourceRoute of parseResult.sourceRoutes) {
    for (const coord of sourceRoute.coordinates) pointCounts.set(coordKey(coord), (pointCounts.get(coordKey(coord)) ?? 0) + 1);
  }

  function nodeFor(coord: DALCoordinate, routeId: string) {
    const key = coordKey(coord);
    const existing = nodeByCoord.get(key);
    if (existing) {
      if (!existing.routeIds.includes(routeId)) existing.routeIds.push(routeId);
      return existing;
    }
    const node: InventoryNode = { nodeId: `node-${nodes.length + 1}`, lat: coord[1], lon: coord[0], routeIds: [routeId] };
    nodeByCoord.set(key, node);
    nodes.push(node);
    return node;
  }

  for (const sourceRoute of parseResult.sourceRoutes) {
    if (sourceRoute.coordinates.length < 2) {
      invalidGeometryCount++;
      continue;
    }

    const edgeIds: string[] = [];
    let routeFeet = 0;
    for (let index = 1; index < sourceRoute.coordinates.length; index++) {
      const a = sourceRoute.coordinates[index - 1];
      const b = sourceRoute.coordinates[index];
      const lengthFeet = haversineFeet(a, b);
      if (lengthFeet <= 0) {
        invalidGeometryCount++;
        continue;
      }
      const from = nodeFor(a, sourceRoute.routeId);
      const to = nodeFor(b, sourceRoute.routeId);
      const edgeKey = [from.nodeId, to.nodeId].sort().join("::");
      if (seenEdges.has(edgeKey)) duplicateEdges.add(edgeKey);
      seenEdges.add(edgeKey);

      const edge: InventoryEdge = {
        edgeId: `edge-${edges.length + 1}`,
        fromNodeId: from.nodeId,
        toNodeId: to.nodeId,
        routeId: sourceRoute.routeId,
        coordinates: [a, b],
        lengthFeet,
      };
      edgeIds.push(edge.edgeId);
      routeFeet += lengthFeet;
      edges.push(edge);
    }

    routes.push({
      routeId: sourceRoute.routeId,
      name: sourceRoute.name,
      coordinates: sourceRoute.coordinates,
      edgeIds,
      lengthFeet: routeFeet,
    });

    if (routeFeet > 0) {
      const stationTargets = new Set<number>([0, Math.round(routeFeet)]);
      for (let feet = STATION_INTERVAL_FEET; feet < routeFeet; feet += STATION_INTERVAL_FEET) stationTargets.add(feet);
      Array.from(stationTargets)
        .sort((a, b) => a - b)
        .forEach((feet) => {
          const coord = coordinateAtFeet(sourceRoute.coordinates, feet);
          stations.push({
            stationId: `${sourceRoute.routeId}-station-${feet}`,
            routeId: sourceRoute.routeId,
            lat: coord[1],
            lon: coord[0],
            feet,
            label: formatStation(feet),
          });
        });
    }
  }

  const connectedNodes = new Set<string>();
  edges.forEach((edge) => {
    connectedNodes.add(edge.fromNodeId);
    connectedNodes.add(edge.toNodeId);
  });

  const missingCoordinateCount = parseResult.issues.filter((issue) => issue.check === "Missing coordinates").length;
  const unsupportedSourceCount = parseResult.issues.filter((issue) => issue.check === "Unsupported source structure").length;
  const emptyRouteCount = parseResult.sourceRoutes.filter((route) => route.coordinates.length === 0).length + (parseResult.sourceRoutes.length === 0 ? 1 : 0);
  const duplicateNodeCount = Array.from(pointCounts.values()).filter((count) => count > 1).length;
  const orphanNodeCount = nodes.filter((node) => !connectedNodes.has(node.nodeId)).length;
  const unconnectedRouteCount = routes.filter((route) => route.edgeIds.length === 0).length;
  const excessiveDuplicateCount = duplicateNodeCount > Math.max(10, nodes.length * 0.2) ? duplicateNodeCount : 0;
  const validationRows: ValidationRow[] = [
    rowFor("Missing coordinates", missingCoordinateCount, true, "Rows or geometry positions were skipped.", "No missing coordinates found."),
    rowFor("Duplicate nodes", duplicateNodeCount, false, "Duplicate source coordinates were collapsed into graph nodes.", "No duplicate node coordinates found."),
    rowFor("Duplicate edges", duplicateEdges.size, false, "Duplicate edge endpoints were detected.", "No duplicate edges found."),
    rowFor("Orphan nodes", orphanNodeCount, false, "Nodes without connected edges were detected.", "No orphan nodes found."),
    rowFor("Invalid geometry", invalidGeometryCount, true, "Invalid route geometry was skipped.", "No invalid geometry found."),
    rowFor("Empty routes", emptyRouteCount, true, "One or more routes had no usable coordinates.", "No empty routes found."),
    rowFor("Unconnected routes", unconnectedRouteCount, false, "One or more routes do not contain connected edges.", "All routes contain connected edges."),
    rowFor("Excessive duplicate geometry", excessiveDuplicateCount, false, "Duplicate geometry exceeds the DAL warning threshold.", "Duplicate geometry is below the warning threshold."),
    rowFor("Unsupported source structure", unsupportedSourceCount, true, "Some source structures were not supported by DAL Translate v1.", "No unsupported source structures found."),
  ];
  const status = validationStatus(validationRows);
  const routeFeet = routes.reduce((sum, route) => sum + route.lengthFeet, 0);
  const metadata = {
    inventoryId,
    graphId,
    createdDate,
    InventoryID: inventoryId,
    GraphID: graphId,
    CreatedDate: createdDate,
    name: baseName(parseResult.sourceFile),
    sourceFile: parseResult.sourceFile,
    sourceType: parseResult.sourceType,
    validationStatus: status,
    nodeCount: nodes.length,
    edgeCount: edges.length,
    stationCount: stations.length,
    routeCount: routes.length,
    routeMiles: routeFeet / 5280,
  };

  const payload: InventoryGraph = {
    inventoryId,
    graphId,
    metadata,
    nodes,
    edges,
    stations,
    routes,
    validation: {
      status,
      issues: validationRows.map((row) => ({ check: row.check, status: row.result, count: row.count, message: row.message })),
    },
    createdAt: createdDate,
    updatedAt: createdDate,
  };

  return {
    payload,
    validationRows,
    validationStatus: status,
  };
}

function ValidationPanel({ graph }: { graph: BuiltGraph | null }) {
  if (!graph) {
    return (
      <div className="dal-panel">
        <h3>Validation</h3>
        <div className="dal-status">No graph built.</div>
      </div>
    );
  }

  return (
    <div className="dal-panel">
      <div className="dal-panel-title-row">
        <h3>Validation</h3>
        <span className={`dal-badge ${graph.validationStatus.toLowerCase()}`}>{graph.validationStatus}</span>
      </div>
      <div className="dal-validation-list">
        {graph.validationRows.map((row) => (
          <div className="dal-validation-row" key={row.check}>
            <span>{row.check}</span>
            <b className={`dal-result ${row.result.toLowerCase()}`}>{row.result}</b>
            <span>{fmt(row.count)}</span>
            <small>{row.message}</small>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function TranslateWorkspace() {
  const { setWorkspace, setSelectedInventoryId, setSelectedGraph, upsertInventorySummary } = useDALState();
  const [graph, setGraph] = useState<BuiltGraph | null>(null);
  const [status, setStatus] = useState("Translate workspace ready.");
  const [saving, setSaving] = useState(false);

  const metrics = useMemo(() => {
    const payload = graph?.payload;
    return {
      nodes: payload?.nodes.length ?? 0,
      edges: payload?.edges.length ?? 0,
      stations: payload?.stations.length ?? 0,
      routes: payload?.routes.length ?? 0,
      miles: payload?.metadata.routeMiles ?? 0,
    };
  }, [graph]);

  async function handleUpload(file: File) {
    try {
      setStatus(`Parsing ${file.name}...`);
      const parsed = await parseUpload(file);
      const built = buildInventoryGraph(parsed);
      setGraph(built);
      setStatus(`Built ${built.payload.metadata.name}: ${fmt(built.payload.nodes.length)} nodes / ${fmt(built.payload.edges.length)} edges.`);
    } catch (err: any) {
      setGraph(null);
      setStatus(`Translate failed: ${err?.message ?? String(err)}`);
    }
  }

  async function handleSave() {
    if (!graph) return;
    try {
      setSaving(true);
      setStatus("Saving inventory graph...");
      const saved = await saveInventoryGraph(graph.payload);
      upsertInventorySummary(saved);
      setSelectedInventoryId(saved.inventoryId);
      setSelectedGraph(graph.payload);
      setStatus(`Saved ${saved.name}.`);
      setWorkspace("inventory");
    } catch (err: any) {
      setStatus(`Save failed: ${err?.message ?? String(err)}`);
    } finally {
      setSaving(false);
    }
  }

  function openGraphViewer() {
    if (!graph) return;
    setSelectedGraph(graph.payload);
    setSelectedInventoryId(graph.payload.inventoryId);
    upsertInventorySummary(graph.payload.metadata);
    setWorkspace("graphViewer");
  }

  return (
    <section className="dal-workspace">
      <div className="dal-workspace-header">
        <div>
          <h2>DAL Translate</h2>
          <p>Carrier source files normalize into inventory graph payloads for DAL validation and persistence.</p>
        </div>
      </div>

      <div className="dal-grid">
        <div className="dal-panel">
          <h3>Upload</h3>
          <input
            type="file"
            accept=".csv,.kml,.kmz,.geojson,.json,application/json,text/csv"
            onChange={(event) => {
              const file = event.currentTarget.files?.[0];
              if (file) void handleUpload(file);
              event.currentTarget.value = "";
            }}
          />
          <div className="dal-status">{status}</div>
        </div>

        <ValidationPanel graph={graph} />
      </div>

      {graph && (
        <div className="dal-panel">
          <div className="dal-panel-title-row">
            <h3>{graph.payload.metadata.name}</h3>
            <div className="dal-actions">
              <button type="button" onClick={openGraphViewer}>
                Open Graph Viewer
              </button>
              <button type="button" disabled={saving || graph.validationStatus === "FAIL"} onClick={() => void handleSave()}>
                {saving ? "Saving..." : "Save Graph"}
              </button>
            </div>
          </div>
          <div className="dal-metrics">
            <span>InventoryID: {graph.payload.inventoryId}</span>
            <span>GraphID: {graph.payload.metadata.graphId}</span>
            <span>CreatedDate: {graph.payload.metadata.createdDate}</span>
            <span>Nodes: {fmt(metrics.nodes)}</span>
            <span>Edges: {fmt(metrics.edges)}</span>
            <span>Stations: {fmt(metrics.stations)}</span>
            <span>Routes: {fmt(metrics.routes)}</span>
            <span>Miles: {Number(metrics.miles || 0).toFixed(2)}</span>
          </div>
          <pre className="dal-pre">{JSON.stringify(graph.payload.metadata, null, 2)}</pre>
        </div>
      )}
    </section>
  );
}
