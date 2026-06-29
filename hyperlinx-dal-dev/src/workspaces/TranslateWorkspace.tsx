import JSZip from "jszip";
import { useEffect, useMemo, useState } from "react";
import { saveInventoryGraph } from "../api/dalClient";
import { commitRuntimeTranslation } from "../api/runtimeFoundation";
import { createDefaultBudgetAssumptionState } from "../commercial/BudgetAssumptionState";
import {
  buildCommercialCorridorDraftFromImportedRoute,
  type CommercialCorridorDraft,
} from "../commercial/CommercialCorridorDraftEngine";
import { useDALState } from "../dal/DALState";
import type { CustomerDesignImport, ImportedCustomerRoute, ImportedCustomerRouteState } from "../translate/CustomerDesignImport";
import {
  attachPricedDraftToImportedRoute,
  attachInventoryGraphToCustomerDesignImport,
  markImportedRoutePromoted,
  parseCustomerDesignFile,
  stageCustomerDesignImport,
  updateImportedRouteState,
} from "../translate/CustomerDesignImportEngine";
import { useTeralinxAuth } from "../identity/TeralinxAuth";
import { buildRuntimeCommitFromCustomerDesign } from "../runtime/RuntimeObjectModel";
import { runUniversalTranslationPipeline, type UniversalTranslationAdapter } from "../runtime/UniversalTranslatorFramework";
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

function money(value: number | undefined) {
  return `$${Math.round(value || 0).toLocaleString()}`;
}

function formatMiles(value: number | undefined) {
  return `${Number(value || 0).toFixed(2)} mi`;
}

function formatFeet(value: number | undefined) {
  return `${Math.round(value || 0).toLocaleString()} ft`;
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

function parseResultFromCustomerDesignImport(record: CustomerDesignImport): ParseResult {
  return {
    sourceType: record.sourceType === "API" ? "GeoJSON" : record.sourceType,
    sourceFile: record.sourceFileName,
    sourceRoutes: record.routes.map((route) => ({
      routeId: route.routeId,
      name: route.name,
      coordinates: route.dalGeometry,
    })),
    issues: record.diagnostics
      .filter((diagnostic) => diagnostic.severity !== "INFO")
      .map((diagnostic) => ({
        check: diagnostic.severity === "ERROR" ? "Invalid geometry" : "Unsupported source structure",
        message: diagnostic.message,
      })),
  };
}

function CustomerDesignPreviewMap({
  record,
  selectedRoute,
}: {
  record: CustomerDesignImport;
  selectedRoute: ImportedCustomerRoute | null;
}) {
  const points = selectedRoute?.dalGeometry ?? [];
  const objectPoints = record.objects.map((object) => [object.longitude, object.latitude] as DALCoordinate);
  const allPoints = [...points, ...objectPoints];
  if (allPoints.length === 0) {
    return <div className="dal-empty">No geometry available for preview.</div>;
  }

  const minLon = Math.min(...allPoints.map((point) => point[0]));
  const maxLon = Math.max(...allPoints.map((point) => point[0]));
  const minLat = Math.min(...allPoints.map((point) => point[1]));
  const maxLat = Math.max(...allPoints.map((point) => point[1]));
  const lonSpan = Math.max(maxLon - minLon, 0.0001);
  const latSpan = Math.max(maxLat - minLat, 0.0001);
  const width = 760;
  const height = 280;
  const pad = 24;
  const project = (point: DALCoordinate) => {
    const x = pad + ((point[0] - minLon) / lonSpan) * (width - pad * 2);
    const y = height - pad - ((point[1] - minLat) / latSpan) * (height - pad * 2);
    return [x, y] as const;
  };
  const routePath = points.map((point) => project(point).join(",")).join(" ");

  return (
    <div className="dal-map-lite">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Imported customer design preview">
        <rect x="0" y="0" width={width} height={height} rx="8" />
        {routePath && <polyline points={routePath} fill="none" stroke="#2563eb" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />}
        {record.objects.map((object) => {
          const [x, y] = project([object.longitude, object.latitude]);
          return (
            <g key={object.objectId}>
              <circle cx={x} cy={y} r="5" />
              <title>{`${object.name} (${object.objectType})`}</title>
            </g>
          );
        })}
      </svg>
      <div className="dal-map-caption">
        {selectedRoute ? `${selectedRoute.name} - ${formatMiles(selectedRoute.routeMiles)} customer geometry` : "Object-only preview"}
      </div>
    </div>
  );
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
  const { session, recordActivity } = useTeralinxAuth();
  const {
    setWorkspace,
    setSelectedInventoryId,
    setSelectedGraph,
    upsertInventorySummary,
    upsertCustomerDesignImport,
    selectedCustomerDesignImport,
    customerDesignImports,
    customerDesignLibraryLoaded,
    setSelectedCustomerDesignImportId,
    setSelectedCustomerDesignRouteId,
    setSelectedCommercialCorridorDraft,
    activateRouteEngineeringFromCommercialDraft,
  } = useDALState();
  const [graph, setGraph] = useState<BuiltGraph | null>(null);
  const [status, setStatus] = useState("Translate workspace ready.");
  const [saving, setSaving] = useState(false);
  const [runtimeCommitting, setRuntimeCommitting] = useState(false);
  const [runtimeCommitStatus, setRuntimeCommitStatus] = useState("");
  const [customerImport, setCustomerImport] = useState<CustomerDesignImport | null>(null);
  const [selectedRouteId, setSelectedRouteId] = useState("");

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

  const selectedImportedRoute = useMemo(() => {
    if (!customerImport) return null;
    return customerImport.routes.find((route) => route.routeId === selectedRouteId) ?? customerImport.routes[0] ?? null;
  }, [customerImport, selectedRouteId]);

  const importMetrics = useMemo(() => {
    const diagnostics = customerImport?.diagnostics ?? [];
    const totalRouteMiles = customerImport?.routes.reduce((total, route) => total + route.routeMiles, 0) ?? 0;
    return {
      totalRouteMiles,
      warnings: diagnostics.filter((diagnostic) => diagnostic.severity === "WARNING").length,
      errors: diagnostics.filter((diagnostic) => diagnostic.severity === "ERROR").length,
      pricedRoutes: customerImport?.routes.filter((route) => route.pricedDraft).length ?? 0,
    };
  }, [customerImport]);

  useEffect(() => {
    if (!customerDesignLibraryLoaded || !selectedCustomerDesignImport) return;
    setCustomerImport(selectedCustomerDesignImport);
    setSelectedRouteId(selectedCustomerDesignImport.activeRouteId ?? selectedCustomerDesignImport.routes[0]?.routeId ?? "");
    if (selectedCustomerDesignImport.inventoryGraph) {
      setGraph({
        payload: selectedCustomerDesignImport.inventoryGraph,
        validationRows: selectedCustomerDesignImport.inventoryGraph.validation.issues.map((issue) => ({
          check: issue.check as ValidationCheck,
          result: issue.status,
          count: issue.count,
          message: issue.message,
        })),
        validationStatus: selectedCustomerDesignImport.inventoryGraph.validation.status,
      });
      setStatus(`Restored ${selectedCustomerDesignImport.sourceFileName} from Customer Design Library.`);
    }
  }, [customerDesignLibraryLoaded, selectedCustomerDesignImport]);

  async function handleUpload(file: File) {
    try {
      setStatus(`Parsing ${file.name}...`);
      const imported = await parseCustomerDesignFile({
        file,
        accountId: "google",
        customerName: "Google",
        uploadedBy: session?.user.name ?? "Ryan",
      });
      const parsed = parseResultFromCustomerDesignImport(imported);
      const built = buildInventoryGraph(parsed);
      const importedWithGraph = attachInventoryGraphToCustomerDesignImport(imported, built.payload);
      setCustomerImport(importedWithGraph);
      setSelectedRouteId(importedWithGraph.routes[0]?.routeId ?? "");
      setSelectedCustomerDesignImportId(importedWithGraph.importId);
      setSelectedCustomerDesignRouteId(importedWithGraph.routes[0]?.routeId ?? "");
      setGraph(built);
      setStatus(
        `Parsed ${importedWithGraph.sourceFileName}: ${fmt(importedWithGraph.routes.length)} route(s), ${fmt(importedWithGraph.objects.length)} object(s), ${fmt(importedWithGraph.diagnostics.length)} diagnostic(s).`,
      );
    } catch (err: any) {
      setGraph(null);
      setCustomerImport(null);
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

  function setRouteState(designState: ImportedCustomerRouteState) {
    if (!customerImport || !selectedImportedRoute) return;
    const updated = updateImportedRouteState(customerImport, selectedImportedRoute.routeId, designState);
    setCustomerImport(updated);
    upsertCustomerDesignImport(updated);
    setStatus(`${selectedImportedRoute.name} marked ${designState}.`);
  }

  function stageImport(record = customerImport) {
    if (!record) return null;
    const activeRouteId = selectedImportedRoute?.routeId ?? selectedRouteId ?? record.activeRouteId ?? record.routes[0]?.routeId ?? "";
    const activeRoute = record.routes.find((route) => route.routeId === activeRouteId) ?? record.routes[0];
    const recordWithActiveRoute = {
      ...record,
      activeRouteId,
      previewGeometry: activeRoute?.dalGeometry?.length ? activeRoute.dalGeometry : record.previewGeometry,
    };
    const recordWithGraph = graph && !recordWithActiveRoute.inventoryGraph ? attachInventoryGraphToCustomerDesignImport(recordWithActiveRoute, graph.payload) : recordWithActiveRoute;
    const staged = recordWithGraph.status === "STAGED" || recordWithGraph.status === "PRICED" ? recordWithGraph : stageCustomerDesignImport(recordWithGraph);
    setCustomerImport(staged);
    upsertCustomerDesignImport(staged);
    setSelectedCustomerDesignImportId(staged.importId);
    setSelectedCustomerDesignRouteId(activeRouteId);
    setStatus(`${staged.sourceFileName} staged as non-authoritative customer design evidence.`);
    return staged;
  }

  async function commitCurrentImport(record = customerImport) {
    const staged = record?.status === "STAGED" || record?.status === "PRICED" ? record : stageImport(record);
    if (!staged) return null;

    try {
      setRuntimeCommitting(true);
      setRuntimeCommitStatus("Preparing runtime commit...");
      const graphPayload = graph?.payload ?? staged.inventoryGraph ?? null;
      const adapter: UniversalTranslationAdapter<CustomerDesignImport> = {
        adapterId: "customer-design-import-adapter",
        domain: "CUSTOMER_INVENTORY",
        sourceTypes: ["KMZ", "KML", "CSV", "API"],
        normalize: (input, context) => buildRuntimeCommitFromCustomerDesign(input, graphPayload, context.actor),
      };
      const pipeline = await runUniversalTranslationPipeline(adapter, staged, {
        actor: session?.user.name ?? staged.uploadedBy ?? "Teralinx",
        domain: "CUSTOMER_INVENTORY",
        commitToRuntime: true,
        evidence: {
          sourceType: staged.sourceType,
          sourceName: staged.sourceFileName,
          sourceSystem: "Translate",
          collectedAt: staged.uploadedAt,
          submittedBy: staged.uploadedBy,
          customerName: staged.customerName,
          accountId: staged.accountId,
        },
      });
      if (!pipeline.canCommit) {
        throw new Error("Runtime validation failed. Commit was not sent.");
      }
      const response = await commitRuntimeTranslation(pipeline.commit);
      const committedAt = response.commit.committedAt ?? new Date().toISOString();
      const committed: CustomerDesignImport = {
        ...staged,
        runtimeCommitId: response.commit.commitId,
        runtimeInventoryId: response.commit.inventoryIds[0],
        runtimeEvidenceIds: response.commit.evidenceIds,
        runtimeObjectIds: response.commit.runtimeObjectIds,
        runtimeRelationshipIds: response.commit.relationshipIds,
        runtimeValidationReportIds: response.commit.validationReportIds,
        runtimeCommittedAt: committedAt,
        auditEvents: [
          ...staged.auditEvents,
          {
            eventId: `CUSTOMER-DESIGN-AUDIT-RUNTIME-${staged.importId}-${Date.now()}`,
            eventType: "RUNTIME_COMMITTED",
            message: `${staged.sourceFileName} committed to the shared runtime object layer.`,
            createdAt: committedAt,
            actor: session?.user.name ?? staged.uploadedBy ?? "Teralinx",
          },
        ],
      };
      setCustomerImport(committed);
      upsertCustomerDesignImport(committed);
      setRuntimeCommitStatus(
        `Runtime committed: ${response.counts.evidence.toLocaleString()} evidence, ${response.counts.runtimeObjects.toLocaleString()} objects, ${response.counts.relationships.toLocaleString()} relationships.`,
      );
      setStatus(`${staged.sourceFileName} committed to Runtime Object Layer.`);
      void recordActivity({
        action: "committed translation to runtime",
        objectType: "Runtime Translation Commit",
        objectId: response.commit.commitId,
        objectName: staged.sourceFileName,
        revision: "Runtime Object Layer",
        customerId: staged.accountId,
        details: `${response.counts.runtimeObjects} runtime objects and ${response.counts.relationships} relationships persisted from customer evidence.`,
      });
      return response;
    } catch (err: any) {
      const message = err?.message ?? String(err);
      setRuntimeCommitStatus(`Runtime commit failed: ${message}`);
      setStatus(`Runtime commit failed: ${message}`);
      return null;
    } finally {
      setRuntimeCommitting(false);
    }
  }

  function priceRoute(record: CustomerDesignImport, route: ImportedCustomerRoute) {
    const draft = buildCommercialCorridorDraftFromImportedRoute({
      importRecord: record,
      importedRoute: route,
      assumptionState: createDefaultBudgetAssumptionState(),
    });
    if (!draft) {
      setStatus(`${route.name} is not pricing eligible. Mark it as proposed or draft before pricing.`);
      return null;
    }
    const updated = attachPricedDraftToImportedRoute(record, route.routeId, draft);
    setCustomerImport(updated);
    upsertCustomerDesignImport(updated);
    setSelectedCustomerDesignImportId(updated.importId);
    setSelectedCustomerDesignRouteId(route.routeId);
    setSelectedCommercialCorridorDraft(draft);
    setStatus(`${route.name} priced by Transparent Estimating Engine.`);
    return { record: updated, draft };
  }

  function priceSelectedRoute() {
    if (!customerImport || !selectedImportedRoute) return null;
    const staged = stageImport(customerImport);
    if (!staged) return null;
    const stagedRoute = staged.routes.find((route) => route.routeId === selectedImportedRoute.routeId) ?? selectedImportedRoute;
    return priceRoute(staged, stagedRoute);
  }

  function sendToCommercialPlanning() {
    if (!customerImport || !selectedImportedRoute) return;
    const priced = selectedImportedRoute.pricedDraft
      ? { record: customerImport, draft: selectedImportedRoute.pricedDraft as CommercialCorridorDraft }
      : priceSelectedRoute();
    if (!priced) return;
    const promoted = markImportedRoutePromoted(priced.record, selectedImportedRoute.routeId, "ROUTE_PROMOTED_TO_COMMERCIAL_DRAFT");
    setCustomerImport(promoted);
    upsertCustomerDesignImport(promoted);
    setSelectedCustomerDesignImportId(promoted.importId);
    setSelectedCustomerDesignRouteId(selectedImportedRoute.routeId);
    setSelectedCommercialCorridorDraft(priced.draft);
    setStatus(`${selectedImportedRoute.name} sent to Commercial Planning as a draft candidate.`);
    setWorkspace("googleRfp");
  }

  function openInEngineering() {
    if (!customerImport || !selectedImportedRoute) return;
    const priced = selectedImportedRoute.pricedDraft
      ? { record: customerImport, draft: selectedImportedRoute.pricedDraft as CommercialCorridorDraft }
      : priceSelectedRoute();
    if (!priced) return;
    const promoted = markImportedRoutePromoted(priced.record, selectedImportedRoute.routeId, "ROUTE_OPENED_IN_ENGINEERING");
    setCustomerImport(promoted);
    upsertCustomerDesignImport(promoted);
    setSelectedCustomerDesignImportId(promoted.importId);
    setSelectedCustomerDesignRouteId(selectedImportedRoute.routeId);
    activateRouteEngineeringFromCommercialDraft({
      commercialDraft: priced.draft,
      accountId: promoted.accountId,
      accountName: promoted.customerName,
      createdBy: "Ryan",
      activationReason: "Imported customer design opened as immutable customer baseline.",
    });
  }

  return (
    <section className="dal-workspace">
      <div className="dal-workspace-header">
        <div>
          <h2>DAL Translate 2.0</h2>
          <p>Customer design files ingest into staged, priced, non-authoritative route evidence.</p>
        </div>
      </div>

      <div className="dal-grid">
        <div className="dal-panel">
          <h3>Customer Design Upload</h3>
          <input
            type="file"
            accept=".csv,.kml,.kmz,text/csv"
            onChange={(event) => {
              const file = event.currentTarget.files?.[0];
              if (file) void handleUpload(file);
              event.currentTarget.value = "";
            }}
          />
          <div className="dal-status">{status}</div>
          <div className="dal-callout">
            KMZ, KML, and CSV imports preserve folder/source provenance and remain customer evidence until explicitly promoted through Commercial Planning or Engineering.
          </div>
        </div>

        <div className="dal-panel">
          <h3>Parse Status</h3>
          {customerImport ? (
            <div className="dal-metrics compact">
              <span>Status: {customerImport.status}</span>
              <span>Source: {customerImport.sourceType}</span>
              <span>Routes: {fmt(customerImport.routes.length)}</span>
              <span>Objects: {fmt(customerImport.objects.length)}</span>
              <span>Folders: {fmt(customerImport.folders.length)}</span>
              <span>Miles: {importMetrics.totalRouteMiles.toFixed(2)}</span>
              <span>Warnings: {fmt(importMetrics.warnings)}</span>
              <span>Errors: {fmt(importMetrics.errors)}</span>
            </div>
          ) : (
            <div className="dal-status">No customer design import loaded.</div>
          )}
        </div>
      </div>

      <div className="dal-panel">
        <div className="dal-panel-title-row">
          <h3>Customer Design Library</h3>
          <span className="dal-badge pass">{customerDesignLibraryLoaded ? `${fmt(customerDesignImports.length)} design(s)` : "Loading"}</span>
        </div>
        {customerDesignImports.length ? (
          <div className="dal-route-list">
            {customerDesignImports.map((record) => (
              <button
                type="button"
                className={`dal-route-row ${record.importId === customerImport?.importId ? "active" : ""}`}
                key={record.importId}
                onClick={() => {
                  setCustomerImport(record);
                  setSelectedRouteId(record.activeRouteId ?? record.routes[0]?.routeId ?? "");
                  setSelectedCustomerDesignImportId(record.importId);
                  setSelectedCustomerDesignRouteId(record.activeRouteId ?? record.routes[0]?.routeId ?? "");
                  if (record.inventoryGraph) {
                    setGraph({
                      payload: record.inventoryGraph,
                      validationRows: record.inventoryGraph.validation.issues.map((issue) => ({
                        check: issue.check as ValidationCheck,
                        result: issue.status,
                        count: issue.count,
                        message: issue.message,
                      })),
                      validationStatus: record.inventoryGraph.validation.status,
                    });
                  }
                }}
              >
                <span>
                  <b>{record.libraryPath.join(" / ")}</b>
                  <small>{record.designId}</small>
                </span>
                <span>{record.status}</span>
                <span>{fmt(record.routes.length)} route(s)</span>
                <span>{fmt(record.lineage.length)} lineage</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="dal-empty">No staged customer designs persisted yet.</div>
        )}
      </div>

      {customerImport && (
        <div className="dal-grid">
          <div className="dal-panel">
            <div className="dal-panel-title-row">
              <h3>Imported Routes</h3>
              <div className="dal-actions">
                <button type="button" onClick={() => stageImport()}>
                  Stage Import
                </button>
                <button type="button" disabled={runtimeCommitting} onClick={() => void commitCurrentImport()}>
                  {runtimeCommitting ? "Committing..." : "Commit to Runtime"}
                </button>
              </div>
            </div>
            {runtimeCommitStatus && <div className="dal-status">{runtimeCommitStatus}</div>}
            <div className="dal-route-list">
              {customerImport.routes.map((route) => (
                <button
                  type="button"
                  className={`dal-route-row ${route.routeId === selectedImportedRoute?.routeId ? "active" : ""}`}
                  key={route.routeId}
                  onClick={() => {
                    const updated = {
                      ...customerImport,
                      activeRouteId: route.routeId,
                      previewGeometry: route.dalGeometry?.length ? route.dalGeometry : customerImport.previewGeometry,
                    };
                    setCustomerImport(updated);
                    setSelectedRouteId(route.routeId);
                    setSelectedCustomerDesignImportId(customerImport.importId);
                    setSelectedCustomerDesignRouteId(route.routeId);
                    if (["STAGED", "PRICED", "PROMOTED_TO_COMMERCIAL_DRAFT", "OPENED_IN_ENGINEERING"].includes(customerImport.status)) {
                      upsertCustomerDesignImport(updated);
                    }
                  }}
                >
                  <span>
                    <b>{route.name}</b>
                    <small>{route.folderPath.join(" / ") || "Root"}</small>
                  </span>
                  <span>{formatMiles(route.routeMiles)}</span>
                  <span>{route.designState}</span>
                  <span>{route.pricedDraft ? "Priced" : route.pricingEligible ? "Eligible" : "No price"}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="dal-panel">
            <h3>Selected Route</h3>
            {selectedImportedRoute ? (
              <>
                <div className="dal-metrics compact">
                  <span>DesignID: {customerImport.designId}</span>
                  <span>Name: {selectedImportedRoute.name}</span>
                  <span>State: {selectedImportedRoute.designState}</span>
                  <span>Confidence: {selectedImportedRoute.confidence}%</span>
                  <span>Miles: {formatMiles(selectedImportedRoute.routeMiles)}</span>
                  <span>Feet: {formatFeet(selectedImportedRoute.routeFeet)}</span>
                  <span>Folder: {selectedImportedRoute.folderPath.join(" / ") || "Root"}</span>
                  <span>Runtime Commit: {customerImport.runtimeCommitId ?? "Not committed"}</span>
                  <span>Runtime Inventory: {customerImport.runtimeInventoryId ?? "Not committed"}</span>
                </div>
                <div className="dal-actions">
                  <button type="button" onClick={() => setRouteState("CUSTOMER_PROPOSED")}>
                    Mark Proposed
                  </button>
                  <button type="button" onClick={() => setRouteState("CUSTOMER_DRAFT")}>
                    Mark Draft
                  </button>
                  <button type="button" onClick={() => setRouteState("CUSTOMER_EXISTING")}>
                    Mark Existing
                  </button>
                </div>
                <CustomerDesignPreviewMap record={customerImport} selectedRoute={selectedImportedRoute} />
              </>
            ) : (
              <div className="dal-empty">No route selected.</div>
            )}
          </div>
        </div>
      )}

      {customerImport && (
        <div className="dal-grid">
          <div className="dal-panel">
            <h3>Customer Objects</h3>
            {customerImport.objects.length ? (
              <div className="dal-table-wrap">
                <table className="dal-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Type</th>
                      <th>Folder</th>
                      <th>Nearest Route</th>
                      <th>Station</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customerImport.objects.slice(0, 50).map((object) => (
                      <tr key={object.objectId}>
                        <td>{object.name}</td>
                        <td>{object.objectType}</td>
                        <td>{object.folderPath.join(" / ") || "Root"}</td>
                        <td>{object.nearestRouteId ?? "Unmatched"}</td>
                        <td>{object.nearestStationFeet ? formatFeet(object.nearestStationFeet) : "n/a"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="dal-empty">No customer objects parsed.</div>
            )}
          </div>

          <div className="dal-panel">
            <h3>Diagnostics</h3>
            {customerImport.diagnostics.length ? (
              <div className="dal-diagnostic-list">
                {customerImport.diagnostics.slice(0, 20).map((diagnostic) => (
                  <div className={`dal-diagnostic-row ${diagnostic.severity.toLowerCase()}`} key={diagnostic.diagnosticId}>
                    <b>{diagnostic.severity}</b>
                    <span>{diagnostic.code}</span>
                    <small>{diagnostic.message}</small>
                  </div>
                ))}
              </div>
            ) : (
              <div className="dal-status">No diagnostics.</div>
            )}
          </div>
        </div>
      )}

      {customerImport && selectedImportedRoute && (
        <div className="dal-panel">
          <div className="dal-panel-title-row">
            <h3>Pricing And Handoff</h3>
            <div className="dal-actions">
              <button type="button" disabled={!selectedImportedRoute.pricingEligible} onClick={priceSelectedRoute}>
                Price Imported Route
              </button>
              <button type="button" disabled={!selectedImportedRoute.pricingEligible} onClick={sendToCommercialPlanning}>
                Send To Commercial Planning
              </button>
              <button type="button" disabled={!selectedImportedRoute.pricingEligible} onClick={openInEngineering}>
                Open In Engineering
              </button>
            </div>
          </div>
          {selectedImportedRoute.pricedDraft ? (
            <div className="dal-metrics compact">
              <span>Cost: {money(selectedImportedRoute.pricedDraft.totalCost)}</span>
              <span>Sell: {money(selectedImportedRoute.pricedDraft.sellPrice)}</span>
              <span>Margin: {selectedImportedRoute.pricedDraft.grossMarginPercent}%</span>
              <span>Cost/Mile: {money(selectedImportedRoute.pricedDraft.costPerMile)}</span>
              <span>Cost/Foot: ${selectedImportedRoute.pricedDraft.costPerFoot.toLocaleString()}</span>
              <span>Revenue/Mile: {money(selectedImportedRoute.pricedDraft.revenuePerMile)}</span>
              <span>Margin/Mile: {money(selectedImportedRoute.pricedDraft.marginPerMile)}</span>
              <span>Commercial Readiness: {selectedImportedRoute.pricedDraft.transparentEstimate.commercialReadiness.score}%</span>
            </div>
          ) : (
            <div className="dal-callout">
              Pricing is available for proposed and draft customer routes. Customer-existing routes remain reference evidence unless their state is changed.
            </div>
          )}
          <div className="dal-note">
            Handoff actions do not create ScopeVersions, CertifiedRoutes, or production inventory. Engineering receives an immutable customer baseline for review.
          </div>
          <div className="dal-lineage">
            {customerImport.lineage.map((event) => (
              <div key={event.lineageEventId}>
                <b>{event.stage}</b>
                <span>{event.label}</span>
                <small>{new Date(event.createdAt).toLocaleString()} / {event.relatedId ?? customerImport.designId}</small>
              </div>
            ))}
          </div>
        </div>
      )}

      <ValidationPanel graph={graph} />

      {graph && (
        <div className="dal-panel">
          <div className="dal-panel-title-row">
            <h3>Inventory Graph Preview: {graph.payload.metadata.name}</h3>
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
