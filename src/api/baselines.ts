import { CHICAGO_API } from "../config/api";
import {
  buildBaselineGraphFromGeometry,
  extractBaselineGraphGeometryFromGeoJSON,
  type BaselineGraph,
  type BaselineGraphGeometry,
  type LonLat,
  type StoredBaselineMetadata,
  type StoredBaselineNetwork,
} from "../types/fiberlightBeta";

type RawBaseline = Record<string, any>;

type GeometryNormalization = {
  routeCoords: LonLat[];
  fullGeometry: LonLat[][];
  detectedGeometryType: string;
};

export type CreateBaselinePayload = {
  accountId: string;
  baselineId?: string;
  baselineScopeVersionId?: string;
  datasetId?: string;
  datasetType: "EXISTING_NETWORK" | "BASELINE_GRAPH";
  name: string;
  routeCoords?: LonLat[];
  fullGeometry?: LonLat[][];
  geometry?: BaselineGraphGeometry[];
  graph?: BaselineGraph;
  graphSummary?: Record<string, unknown>;
  nodeCount?: number;
  edgeCount?: number;
  bounds?: [number, number, number, number] | null;
  routePointCount?: number;
  stationCount?: number;
  stations?: StoredBaselineNetwork["stations"];
  sourceFilename?: string;
  metadata?: Record<string, unknown>;
};

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText}${text ? `: ${text}` : ""}`);
  }
  return (await res.json()) as T;
}

function unwrapList(data: any): RawBaseline[] {
  const list = data?.baselines ?? data?.items ?? data?.data ?? data;
  return Array.isArray(list) ? list : [];
}

function unwrapBaseline(data: any): RawBaseline {
  return data?.baseline ?? data?.item ?? data?.data ?? data ?? {};
}

function isLonLatPair(value: any): value is LonLat {
  return (
    Array.isArray(value) &&
    value.length >= 2 &&
    Number.isFinite(Number(value[0])) &&
    Number.isFinite(Number(value[1]))
  );
}

function normalizePoint(value: any): LonLat | null {
  if (!isLonLatPair(value)) return null;
  return [Number(value[0]), Number(value[1])];
}

function normalizeCoordinateArray(value: any): LonLat[] {
  if (!Array.isArray(value)) return [];
  return value.map(normalizePoint).filter(Boolean) as LonLat[];
}

function normalizeMultiLineString(value: any): LonLat[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((part) => normalizeCoordinateArray(part));
}

function normalizeFullGeometry(value: any): LonLat[][] {
  if (!Array.isArray(value)) return [];

  if (value.every((part) => isLonLatPair(part))) {
    const line = normalizeCoordinateArray(value);
    return line.length >= 2 ? [line] : [];
  }

  return value
    .map((part) => {
      if (Array.isArray(part)) return normalizeCoordinateArray(part);
      if (Array.isArray(part?.coordinates)) return normalizeCoordinateArray(part.coordinates);
      return [];
    })
    .filter((line) => line.length >= 2);
}

function flattenGeometry(lines: LonLat[][]) {
  return lines.flatMap((line) => line);
}

function graphGeometryFromRaw(raw: RawBaseline): BaselineGraphGeometry[] {
  const graphGeometry = raw.graph?.geometry ?? raw.baselineGraph?.geometry ?? raw.baseline_graph?.geometry;
  if (Array.isArray(graphGeometry)) {
    return graphGeometry
      .map((line: any, index: number) => ({
        lineId: String(line.lineId ?? line.line_id ?? `line-${index + 1}`),
        routeId:
          line.routeId !== undefined || line.route_id !== undefined
            ? String(line.routeId ?? line.route_id)
            : undefined,
        name: line.name !== undefined ? String(line.name) : undefined,
        coordinates: normalizeCoordinateArray(line.coordinates),
        sourceFolder: line.sourceFolder ?? line.source_folder ?? undefined,
        properties: typeof line.properties === "object" && line.properties ? line.properties : undefined,
      }))
      .filter((line) => line.coordinates.length >= 2);
  }

  const graphFullGeometry = raw.graph?.fullGeometry ?? raw.graph?.full_geometry;
  const graphFullLines = normalizeFullGeometry(graphFullGeometry);
  if (graphFullLines.length) {
    return graphFullLines.map((coordinates, index) => ({
      lineId: `line-${index + 1}`,
      routeId: `line-${index + 1}`,
      coordinates,
    }));
  }

  const rawGeometry = raw.geometry ?? raw.geojson ?? raw.fullGeometry ?? raw.full_geometry;
  if (Array.isArray(rawGeometry) && rawGeometry.every((line: any) => Array.isArray(line?.coordinates))) {
    return rawGeometry
      .map((line: any, index: number) => ({
        lineId: String(line.lineId ?? line.line_id ?? `line-${index + 1}`),
        routeId:
          line.routeId !== undefined || line.route_id !== undefined
            ? String(line.routeId ?? line.route_id)
            : undefined,
        name: line.name !== undefined ? String(line.name) : undefined,
        coordinates: normalizeCoordinateArray(line.coordinates),
        sourceFolder: line.sourceFolder ?? line.source_folder ?? undefined,
        properties: typeof line.properties === "object" && line.properties ? line.properties : undefined,
      }))
      .filter((line) => line.coordinates.length >= 2);
  }

  return extractBaselineGraphGeometryFromGeoJSON(rawGeometry ?? raw);
}

function normalizeFeatureCollection(value: any): GeometryNormalization {
  const features = Array.isArray(value?.features) ? value.features : [];
  const parts = features.map((feature: any) => normalizeBaselineGeometry(feature));
  const routeCoords = parts.flatMap((part) => part.routeCoords);
  const fullGeometry = parts.flatMap((part) => part.fullGeometry);
  const detectedTypes = [...new Set(parts.map((part) => part.detectedGeometryType).filter(Boolean))];
  return {
    routeCoords,
    fullGeometry,
    detectedGeometryType: detectedTypes.length ? `FeatureCollection(${detectedTypes.join(",")})` : "FeatureCollection",
  };
}

export function normalizeBaselineGeometry(baseline: any): GeometryNormalization {
  const candidates = [
    { label: "routeCoords", value: baseline?.routeCoords },
    { label: "route_coords", value: baseline?.route_coords },
    { label: "route", value: baseline?.route },
    { label: "coordinates", value: baseline?.coordinates },
    { label: "geometry", value: baseline?.geometry },
    { label: "geojson", value: baseline?.geojson },
  ];

  for (const candidate of candidates) {
    const value = candidate.value;
    if (!value) continue;

    if (Array.isArray(value)) {
      const routeCoords = normalizeCoordinateArray(value);
      if (routeCoords.length) {
        return {
          routeCoords,
          fullGeometry: routeCoords.length >= 2 ? [routeCoords] : [],
          detectedGeometryType: candidate.label === "geometry" ? "GeometryArray" : candidate.label,
        };
      }

      const fullGeometry = normalizeFullGeometry(value);
      if (fullGeometry.length) {
        return {
          routeCoords: flattenGeometry(fullGeometry),
          fullGeometry,
          detectedGeometryType: `${candidate.label}:MultiLineArray`,
        };
      }
    }

    if (value?.type === "LineString") {
      const routeCoords = normalizeCoordinateArray(value.coordinates);
      return { routeCoords, fullGeometry: routeCoords.length >= 2 ? [routeCoords] : [], detectedGeometryType: "LineString" };
    }

    if (value?.type === "MultiLineString") {
      const fullGeometry = normalizeFullGeometry(value.coordinates);
      return { routeCoords: flattenGeometry(fullGeometry), fullGeometry, detectedGeometryType: "MultiLineString" };
    }

    if (value?.type === "Feature") {
      const normalized = normalizeBaselineGeometry(value.geometry);
      return { ...normalized, detectedGeometryType: `Feature:${normalized.detectedGeometryType}` };
    }

    if (value?.type === "FeatureCollection") {
      return normalizeFeatureCollection(value);
    }
  }

  if (baseline?.type === "LineString") {
    const routeCoords = normalizeCoordinateArray(baseline.coordinates);
    return { routeCoords, fullGeometry: routeCoords.length >= 2 ? [routeCoords] : [], detectedGeometryType: "LineString" };
  }

  if (baseline?.type === "MultiLineString") {
    const fullGeometry = normalizeFullGeometry(baseline.coordinates);
    return { routeCoords: flattenGeometry(fullGeometry), fullGeometry, detectedGeometryType: "MultiLineString" };
  }

  if (baseline?.type === "Feature") {
    const normalized = normalizeBaselineGeometry(baseline.geometry);
    return { ...normalized, detectedGeometryType: `Feature:${normalized.detectedGeometryType}` };
  }

  if (baseline?.type === "FeatureCollection") {
    return normalizeFeatureCollection(baseline);
  }

  const graphGeometry = graphGeometryFromRaw(baseline);
  if (graphGeometry.length) {
    const fullGeometry = graphGeometry.map((line) => line.coordinates);
    return { routeCoords: flattenGeometry(fullGeometry), fullGeometry, detectedGeometryType: "BaselineGraphGeometry" };
  }

  return { routeCoords: [], fullGeometry: [], detectedGeometryType: "Unknown" };
}

function countGeometryPoints(raw: RawBaseline) {
  const explicit = Number(
    raw.routePointCount ??
      raw.route_point_count ??
      raw.geometryPointCount ??
      raw.geometry_point_count ??
      raw.metadata?.acceptedPointCount ??
      raw.metadata?.accepted_point_count ??
      raw.metadata?.sourceRowCount ??
      raw.metadata?.source_row_count ??
      raw.graphSummary?.sourcePointCount ??
      raw.graph_summary?.source_point_count ??
      raw.metadata?.graphSummary?.sourcePointCount
  );
  if (Number.isFinite(explicit)) return explicit;
  return normalizeBaselineGeometry(raw).routeCoords.length;
}

function hasBaselineGeometry(raw: RawBaseline) {
  return Boolean(
    raw.routeCoords ||
      raw.route_coords ||
      raw.route ||
      raw.coordinates ||
      raw.geometry ||
      raw.geojson ||
      raw.fullGeometry ||
      raw.full_geometry ||
      raw.graph ||
      raw.type
  );
}

function normalizeDatasetType(raw: RawBaseline): StoredBaselineMetadata["datasetType"] {
  const value = String(raw.datasetType ?? raw.dataset_type ?? raw.metadata?.datasetType ?? raw.metadata?.dataset_type ?? "").toUpperCase();
  return value === "BASELINE_GRAPH" ? "BASELINE_GRAPH" : "EXISTING_NETWORK";
}

export function normalizeBaselineMetadata(raw: RawBaseline, routePointCountOverride?: number): StoredBaselineMetadata {
  const datasetId = String(raw.datasetId ?? raw.dataset_id ?? raw.id ?? raw.baselineId ?? raw.baseline_id ?? "");
  const datasetType = normalizeDatasetType(raw);
  const baselineId = String(raw.baselineId ?? raw.baseline_id ?? raw.datasetId ?? raw.dataset_id ?? raw.id ?? datasetId);
  const baselineScopeVersionId = String(
    raw.baselineScopeVersionId ??
      raw.baseline_scope_version_id ??
      raw.scopeVersionId ??
      raw.scope_version_id ??
      baselineId ??
      datasetId
  );
  const accountId = String(raw.accountId ?? raw.account_id ?? raw.carrier ?? raw.owner ?? "unknown");
  const nameValue = raw.name ?? raw.baselineName ?? raw.baseline_name ?? raw.label ?? raw.title ?? (datasetId || "Untitled baseline");
  const name = String(nameValue);
  const routePointCount = routePointCountOverride ?? countGeometryPoints(raw);
  const stationCount = Number(
    raw.stationCount ??
      raw.station_count ??
      raw.graphSummary?.stationCount ??
      raw.graph_summary?.station_count ??
      raw.metadata?.graphSummary?.stationCount ??
      raw.stations?.length
  );

  return {
    baselineId,
    accountId,
    baselineScopeVersionId,
    datasetId,
    datasetType,
    name,
    importedAt: String(raw.importedAt ?? raw.imported_at ?? raw.createdAt ?? raw.created_at ?? raw.metadata?.importDate ?? ""),
    sourceFilename: raw.sourceFilename ?? raw.source_filename ?? raw.filename ?? raw.metadata?.sourceFile ?? undefined,
    budgetRequired: false,
    authoritativeStatus: "STORED_BASELINE",
    routePointCount: Number.isFinite(routePointCount) ? routePointCount : undefined,
    stationCount: Number.isFinite(stationCount) ? stationCount : undefined,
    geometryLoaded: hasBaselineGeometry(raw),
    apiId: raw.id ?? raw.baselineId ?? raw.baseline_id ?? datasetId,
    status: raw.status ? String(raw.status) : undefined,
  };
}

export function normalizeBaseline(raw: RawBaseline): StoredBaselineNetwork {
  const { routeCoords, fullGeometry, detectedGeometryType } = normalizeBaselineGeometry(raw);
  const meta = normalizeBaselineMetadata(raw, routeCoords.length);
  console.log("BASELINE GEOMETRY SHAPE", detectedGeometryType);
  console.log("BASELINE ROUTE POINTS MAPPED", routeCoords.length);
  console.log("BASELINE FIRST POINT", routeCoords[0]);
  console.log("BASELINE LAST POINT", routeCoords[routeCoords.length - 1]);

  let graph: BaselineGraph | undefined;
  if (meta.datasetType === "BASELINE_GRAPH") {
    const rawGraph = raw.graph ?? raw.baselineGraph ?? raw.baseline_graph;
    if (rawGraph?.nodes?.length && rawGraph?.edges?.length) {
      graph = {
        baselineId: String(rawGraph.baselineId ?? rawGraph.baseline_id ?? meta.baselineId),
        name: String(rawGraph.name ?? meta.name),
        datasetType: "BASELINE_GRAPH",
        geometry: graphGeometryFromRaw(raw),
        fullGeometry:
          normalizeFullGeometry(rawGraph.fullGeometry ?? rawGraph.full_geometry).length > 0
            ? normalizeFullGeometry(rawGraph.fullGeometry ?? rawGraph.full_geometry)
            : fullGeometry,
        nodes: rawGraph.nodes.map((node: any, index: number) => {
          const nodeId = String(node.nodeId ?? node.node_id ?? node.id ?? `N-${index + 1}`);
          const lon = Number(node.lon ?? node.lng);
          const lat = Number(node.lat);
          return { ...node, id: node.id ?? nodeId, nodeId, lat, lon, lng: node.lng ?? lon };
        }),
        edges: rawGraph.edges.map((edge: any, index: number) => {
          const edgeId = String(edge.edgeId ?? edge.edge_id ?? edge.id ?? `E-${index + 1}`);
          const startNodeId = String(edge.startNodeId ?? edge.start_node_id ?? edge.fromNodeId ?? edge.from_node_id ?? "");
          const endNodeId = String(edge.endNodeId ?? edge.end_node_id ?? edge.toNodeId ?? edge.to_node_id ?? "");
          const geometry = normalizeCoordinateArray(edge.geometry);
          const lengthFt =
            Number(edge.lengthFt ?? edge.length_ft) ||
            (geometry.length >= 2 ? 5280 * 0 : 0);
          return {
            ...edge,
            id: edge.id ?? edgeId,
            edgeId,
            startNodeId,
            endNodeId,
            fromNodeId: edge.fromNodeId ?? edge.from_node_id ?? startNodeId,
            toNodeId: edge.toNodeId ?? edge.to_node_id ?? endNodeId,
            geometry,
            lengthFt,
            startFeet: Number(edge.startFeet ?? edge.start_feet ?? 0),
            endFeet: Number(edge.endFeet ?? edge.end_feet ?? lengthFt),
          };
        }),
        stations: Array.isArray(rawGraph.stations) ? rawGraph.stations : [],
        metadata: rawGraph.metadata ?? raw.metadata,
      };
    } else {
      graph = buildBaselineGraphFromGeometry({
        baselineId: meta.baselineId,
        name: meta.name,
        geometry: graphGeometryFromRaw(raw),
        sourceFilename: meta.sourceFilename,
        metadata: raw.metadata,
      });
    }
  }

  const baselineGraphFullGeometry = graph?.fullGeometry?.length ? graph.fullGeometry : fullGeometry;
  const normalizedRouteCoords = meta.datasetType === "BASELINE_GRAPH" ? [] : routeCoords;
  const normalizedPointCount =
    meta.datasetType === "BASELINE_GRAPH"
      ? baselineGraphFullGeometry.reduce((total, line) => total + line.length, 0) || meta.routePointCount
      : routeCoords.length || meta.routePointCount;

  return {
    ...meta,
    routePointCount: normalizedPointCount,
    routeCoords: normalizedRouteCoords,
    fullGeometry: baselineGraphFullGeometry,
    graph,
    stations: Array.isArray(raw.stations) ? raw.stations : [],
    geometryLoaded: true,
  };
}

export async function listBaselines(): Promise<StoredBaselineMetadata[]> {
  const data = await requestJson<any>(`${CHICAGO_API}/api/baselines`);
  return unwrapList(data).map(normalizeBaselineMetadata).filter((item) => item.datasetId);
}

export async function createBaseline(payload: CreateBaselinePayload): Promise<StoredBaselineMetadata> {
  const data = await requestJson<any>(`${CHICAGO_API}/api/baselines`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return normalizeBaselineMetadata({ ...payload, ...unwrapBaseline(data) });
}

export async function loadBaseline(id: string): Promise<StoredBaselineNetwork> {
  const data = await requestJson<any>(`${CHICAGO_API}/api/baselines/${encodeURIComponent(id)}`);
  console.log("BASELINE RAW RESPONSE", data);
  return normalizeBaseline(unwrapBaseline(data));
}
