import * as turf from "@turf/turf";

export type LonLat = [number, number];

export type UploadedSitesRow = {
  id?: string;
  name?: string;
  lat: number;
  lon: number;
  order?: number;
};

export type DesignStation = {
  stationId: string;
  station: string;
  lat: number;
  lon: number;
  feet?: number;
  status?: string;
};

export type DatasetType =
  | "BASELINE_GRAPH"
  | "INVENTORY_SCOPEVERSION"
  | "EXISTING_NETWORK"
  | "TARGET_SITE_LIST"
  | "OPPORTUNITY_BATCH"
  | "OPPORTUNITY_ROUTE";

export type BaselineGraphGeometry = {
  lineId: string;
  routeId?: string;
  name?: string;
  coordinates: LonLat[];
  sourceFolder?: string;
  properties?: Record<string, unknown>;
};

export type BaselineGraphNode = {
  id: string;
  nodeId: string;
  lat: number;
  lon: number;
  lng: number;
};

export type BaselineGraphEdge = {
  id: string;
  edgeId: string;
  startNodeId: string;
  endNodeId: string;
  fromNodeId: string;
  toNodeId: string;
  geometry: LonLat[];
  lengthFt: number;
  startFeet: number;
  endFeet: number;
  routeId?: string;
  routeName?: string;
};

export type GraphStation = {
  stationId: string;
  edgeId: string;
  stationFeet: number;
  lat: number;
  lon: number;
  lng: number;
  intervalFt: number;
};

export type BaselineGraph = {
  baselineId: string;
  name: string;
  datasetType: "BASELINE_GRAPH";
  geometry: BaselineGraphGeometry[];
  fullGeometry: LonLat[][];
  nodes: BaselineGraphNode[];
  edges: BaselineGraphEdge[];
  stations: GraphStation[];
  metadata?: Record<string, unknown>;
};

export type BaselineGraphSummary = {
  baselineId: string;
  name: string;
  nodeCount: number;
  edgeCount: number;
  routeCount?: number;
  sourcePointCount?: number;
  stationCount: number;
  bounds?: [number, number, number, number] | null;
  bbox?: [number, number, number, number] | null;
  totalLengthFt?: number;
  totalLengthMiles?: number;
  routeMiles?: number;
  connectedComponents?: number;
  longestSegment?: number;
};

export type InventoryScopeVersion = {
  scopeVersionId: string;
  type: "INVENTORY_SCOPEVERSION";
  inventoryId: string;
  baselineGraphId: string;
  sourceFile?: string;
  importedAt: string;
  nodeCount: number;
  edgeCount: number;
  stationCount: number;
  status: "ACTIVE";
};

export type BaselineGraphMetadata = {
  inventoryId: string;
  name: string;
  nodeCount: number;
  edgeCount: number;
  stationCount: number;
  routeMiles?: number;
  bbox?: [number, number, number, number] | null;
  connectedComponents?: number;
  longestSegment?: number;
  chunkCounts?: Partial<Record<"nodes" | "edges" | "stations" | "routes", number>>;
  importedAt: string;
  baselineGraphId?: string;
  inventoryScopeVersionId?: string;
  sourceFile?: string;
  graphSummary?: BaselineGraphSummary;
};

export type BaselineGraphDetail = {
  graph: BaselineGraph;
  stations: GraphStation[];
  metadata: BaselineGraphMetadata;
  inventoryScopeVersion?: InventoryScopeVersion;
};

export type CreateBaselineGraphPayload = {
  inventoryId: string;
  name: string;
  graphSummary: BaselineGraphSummary;
  nodes: BaselineGraphNode[];
  edges: BaselineGraphEdge[];
  stations: GraphStation[];
  routes?: BaselineGraphGeometry[];
  sourceFile?: string;
  importedAt: string;
  metadata?: Record<string, unknown>;
};

export type GraphStationLookupResult = {
  stationId: string;
  distanceFt: number;
  edgeId: string;
  scopeVersionId: string | null;
  lat: number;
  lon: number;
  lng: number;
};

export type StoredBaselineMetadata = {
  baselineId: string;
  accountId: string;
  baselineScopeVersionId: string;
  datasetId: string;
  datasetType: "EXISTING_NETWORK" | "BASELINE_GRAPH";
  name: string;
  importedAt: string;
  sourceFilename?: string;
  budgetRequired: false;
  authoritativeStatus: "STORED_BASELINE";
  routePointCount?: number;
  stationCount?: number;
  geometryLoaded?: boolean;
  apiId?: string;
  status?: string;
};

export type StoredBaselineNetwork = StoredBaselineMetadata & {
  routeCoords: LonLat[];
  fullGeometry?: LonLat[][];
  graph?: BaselineGraph;
  stations?: DesignStation[];
  geometryLoaded: true;
};

export type SiteCampaign = {
  accountId: string;
  campaignId: string;
  baselineId?: string;
  baselineScopeVersionId: string;
  datasetId: string;
  datasetType: "TARGET_SITE_LIST";
  name: string;
  sites: UploadedSitesRow[];
  importedAt: string;
  sourceFilename?: string;
  budgetRequired: false;
};

export type SiteServiceabilityResult = {
  siteId: string;
  name?: string;
  lat: number;
  lon: number;
  nearestRoutePoint: LonLat | null;
  nearestGraphEdgeId?: string | null;
  nearestGraphNodeId?: string | null;
  nearestGraphNodeFeet?: number | null;
  nearestStation?: string | null;
  nearestStationFeet?: number | null;
  distanceToNetworkFeet: number | null;
  serviceabilityClass: "ON_NET" | "NEAR_NET" | "BUILD_REQUIRED" | "OUT_OF_FOOTPRINT";
  estimatedLateralFeet: number | null;
  estimatedLateralCost: number | null;
  confidence: number;
  selected: boolean;
};

export type ServiceabilityCandidate = {
  candidateId: string;
  nearestEdgeId: string | null;
  nearestNodeId: string | null;
  distanceFeet: number | null;
  score: number;
};

export type OpportunitySeed = {
  opportunityId: string;
  candidateId: string;
  nearestNodeId: string | null;
  nearestEdgeId: string | null;
  distanceFeet: number | null;
  inventoryId: string;
  status: "DISCOVERED";
};

export type OpportunityBatch = {
  accountId: string;
  batchId: string;
  campaignId: string;
  baselineId?: string;
  baselineScopeVersionId: string;
  datasetType: "OPPORTUNITY_BATCH";
  selectedSites: SiteServiceabilityResult[];
  createdAt: string;
  budgetRequired: true;
};

export const FIBERLIGHT_STORAGE_KEYS = {
  siteCampaigns: "hyperlinx.siteCampaigns",
  opportunityBatches: "hyperlinx.opportunityBatches",
  opportunitySeeds: "hyperlinx.opportunitySeeds",
} as const;

export function createFiberlightId(prefix: string) {
  const id =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
          const r = (Math.random() * 16) | 0;
          const v = c === "x" ? r : (r & 0x3) | 0x8;
          return v.toString(16);
        });
  return `${prefix}-${id}`;
}

function normalizeLonLat(value: any): LonLat | null {
  if (!Array.isArray(value) || value.length < 2) return null;
  const lon = Number(value[0]);
  const lat = Number(value[1]);
  if (!Number.isFinite(lon) || !Number.isFinite(lat)) return null;
  return [lon, lat];
}

function normalizeLineCoordinates(value: any): LonLat[] {
  if (!Array.isArray(value)) return [];
  return value.map(normalizeLonLat).filter(Boolean) as LonLat[];
}

function routeIdentifier(properties: Record<string, unknown>, fallback: string) {
  const id =
    properties.routeId ??
    properties.route_id ??
    properties.id ??
    properties.ID ??
    properties.name ??
    properties.Name ??
    fallback;
  return String(id);
}

function routeName(properties: Record<string, unknown>) {
  const name = properties.name ?? properties.Name ?? properties.routeName ?? properties.route_name;
  return name === undefined || name === null || !String(name) ? undefined : String(name);
}

function stationLabelFromFeet(feetFromOrigin: number) {
  const s = Math.max(0, Math.round(feetFromOrigin));
  const hundreds = Math.floor(s / 100);
  const remainder = s % 100;
  return `${hundreds}+${remainder.toString().padStart(2, "0")}`;
}

function localElementName(element: Element) {
  return element.localName || element.nodeName.split(":").pop() || element.nodeName;
}

function directChildElements(element: Element, name?: string) {
  const expected = name?.toLowerCase();
  return Array.from(element.children).filter((child) => !expected || localElementName(child).toLowerCase() === expected);
}

function directChildText(element: Element, name: string) {
  return directChildElements(element, name)[0]?.textContent?.trim() || undefined;
}

function parseKmlCoordinateText(text?: string | null): LonLat[] {
  if (!text) return [];
  return text
    .trim()
    .split(/\s+/)
    .map((token) => {
      const [lonRaw, latRaw] = token.split(",");
      const lon = Number(lonRaw);
      const lat = Number(latRaw);
      return Number.isFinite(lon) && Number.isFinite(lat) ? ([lon, lat] as LonLat) : null;
    })
    .filter(Boolean) as LonLat[];
}

function extendedDataProperties(placemark: Element): Record<string, unknown> {
  const properties: Record<string, unknown> = {};
  const descendants = Array.from(placemark.getElementsByTagName("*"));

  for (const element of descendants) {
    const elementName = localElementName(element).toLowerCase();
    if (elementName !== "data" && elementName !== "simpledata") continue;

    const key = element.getAttribute("name");
    if (!key) continue;
    const value =
      elementName === "data"
        ? directChildText(element, "value")
        : element.textContent?.trim() || undefined;
    if (value !== undefined) properties[key] = value;
  }

  return properties;
}

function shouldLogKmlDiagnostic(count: number) {
  return count <= 100 || count % 1000 === 0;
}

export function extractLineStringsRecursive(kml: Document | Element): BaselineGraphGeometry[] {
  const root = "documentElement" in kml ? kml.documentElement : kml;
  const output: BaselineGraphGeometry[] = [];
  let folderCount = 0;
  let placemarkCount = 0;
  let lineStringCount = 0;
  let acceptedPointCount = 0;

  console.log("KML RECURSIVE WALK START");

  if (!root) {
    console.log("KML RECURSIVE WALK COMPLETE", { folders: 0, placemarks: 0, lineStrings: 0, points: 0 });
    console.log("LINESTRINGS FOUND", 0);
    return output;
  }

  const walk = (
    element: Element,
    folderPath: string[],
    placemarkContext?: {
      id?: string;
      name?: string;
      sourceFolder?: string;
      properties: Record<string, unknown>;
    }
  ) => {
    const elementName = localElementName(element).toLowerCase();
    let nextFolderPath = folderPath;
    let nextPlacemarkContext = placemarkContext;

    if (elementName === "folder") {
      folderCount += 1;
      const folderName = directChildText(element, "name");
      nextFolderPath = folderName ? [...folderPath, folderName] : folderPath;
      if (shouldLogKmlDiagnostic(folderCount)) {
        console.log("KML FOLDER FOUND", { folder: folderName ?? "(unnamed)", depth: nextFolderPath.length });
      }
    }

    if (elementName === "placemark") {
      placemarkCount += 1;
      const sourceFolder = folderPath.join(" / ");
      const properties = {
        ...extendedDataProperties(element),
        sourceFolder,
      };
      const id = element.getAttribute("id") ?? String(properties.id ?? properties.ID ?? `placemark-${placemarkCount}`);
      const name = directChildText(element, "name") ?? routeName(properties);
      nextPlacemarkContext = {
        id,
        name,
        sourceFolder,
        properties: {
          ...properties,
          id,
          name,
        },
      };
      if (shouldLogKmlDiagnostic(placemarkCount)) {
        console.log("KML PLACEMARK FOUND", { id, name: name ?? "(unnamed)", sourceFolder });
      }
    }

    if (elementName === "linestring") {
      lineStringCount += 1;
      const coordinates = parseKmlCoordinateText(directChildText(element, "coordinates"));
      const sourceFolder = nextPlacemarkContext?.sourceFolder ?? folderPath.join(" / ");
      const lineId = `${nextPlacemarkContext?.id ?? "kml-line"}-${output.length + 1}`;
      const properties = {
        ...(nextPlacemarkContext?.properties ?? {}),
        sourceFolder,
        kmlLineStringIndex: lineStringCount,
      };

      if (shouldLogKmlDiagnostic(lineStringCount)) {
        console.log("KML LINESTRING FOUND", {
          lineId,
          name: nextPlacemarkContext?.name ?? "(unnamed)",
          sourceFolder,
        });
        console.log("KML LINESTRING POINTS", { lineId, points: coordinates.length });
      }

      if (coordinates.length >= 2) {
        acceptedPointCount += coordinates.length;
        output.push({
          lineId,
          routeId: routeIdentifier(properties, lineId),
          name: nextPlacemarkContext?.name,
          coordinates,
          sourceFolder,
          properties,
        });
      }
    }

    for (const child of directChildElements(element)) {
      walk(child, nextFolderPath, nextPlacemarkContext);
    }
  };

  walk(root, []);

  console.log("KML RECURSIVE WALK COMPLETE", {
    folders: folderCount,
    placemarks: placemarkCount,
    lineStrings: output.length,
    points: acceptedPointCount,
  });
  console.log("LINESTRINGS FOUND", output.length);
  return output;
}

function extractLineGeometries(
  geometry: any,
  properties: Record<string, unknown>,
  idPrefix: string,
  output: BaselineGraphGeometry[]
) {
  if (!geometry) return;

  if (geometry.type === "LineString") {
    const coordinates = normalizeLineCoordinates(geometry.coordinates);
    if (coordinates.length >= 2) {
      const lineId = `${idPrefix}-${output.length + 1}`;
      output.push({
        lineId,
        routeId: routeIdentifier(properties, lineId),
        name: routeName(properties),
        coordinates,
        sourceFolder: typeof properties.sourceFolder === "string" ? properties.sourceFolder : undefined,
        properties,
      });
    }
    return;
  }

  if (geometry.type === "MultiLineString" && Array.isArray(geometry.coordinates)) {
    geometry.coordinates.forEach((part: any, index: number) => {
      const coordinates = normalizeLineCoordinates(part);
      if (coordinates.length >= 2) {
        const lineId = `${idPrefix}-${output.length + 1}`;
        output.push({
          lineId,
          routeId: `${routeIdentifier(properties, lineId)}-${index + 1}`,
          name: routeName(properties),
          coordinates,
          sourceFolder: typeof properties.sourceFolder === "string" ? properties.sourceFolder : undefined,
          properties,
        });
      }
    });
    return;
  }

  if (geometry.type === "GeometryCollection" && Array.isArray(geometry.geometries)) {
    geometry.geometries.forEach((part: any, index: number) =>
      extractLineGeometries(part, properties, `${idPrefix}-g${index + 1}`, output)
    );
  }
}

export function extractBaselineGraphGeometryFromGeoJSON(geojson: any): BaselineGraphGeometry[] {
  const output: BaselineGraphGeometry[] = [];

  if (geojson?.type === "FeatureCollection" && Array.isArray(geojson.features)) {
    geojson.features.forEach((feature: any, index: number) => {
      const properties = typeof feature?.properties === "object" && feature.properties ? feature.properties : {};
      const prefix = String(feature?.id ?? properties.id ?? properties.routeId ?? properties.route_id ?? `line-${index + 1}`);
      extractLineGeometries(feature?.geometry, properties, prefix, output);
    });
    return output;
  }

  if (geojson?.type === "Feature") {
    const properties = typeof geojson.properties === "object" && geojson.properties ? geojson.properties : {};
    extractLineGeometries(geojson.geometry, properties, String(geojson.id ?? properties.id ?? "line"), output);
    return output;
  }

  if (geojson?.type) {
    extractLineGeometries(geojson, {}, "line", output);
  }

  return output;
}

export function buildBaselineGraphFromGeometry(args: {
  baselineId: string;
  name: string;
  geometry: BaselineGraphGeometry[];
  sourceFilename?: string;
  metadata?: Record<string, unknown>;
}): BaselineGraph {
  const nodes = new Map<string, BaselineGraphNode>();
  const edges: BaselineGraphEdge[] = [];
  const nodeIdByCoordinate = new Map<string, string>();

  const keyForCoordinate = ([lon, lat]: LonLat) => `${lon.toFixed(7)},${lat.toFixed(7)}`;
  const getNodeId = ([lon, lat]: LonLat) => {
    const key = keyForCoordinate([lon, lat]);
    const existing = nodeIdByCoordinate.get(key);
    if (existing) return existing;

    const nodeId = `N-${nodes.size + 1}`;
    nodeIdByCoordinate.set(key, nodeId);
    nodes.set(nodeId, { id: nodeId, nodeId, lat, lon, lng: lon });
    return nodeId;
  };

  args.geometry.forEach((line) => {
    const coordinates = line.coordinates.filter((coord) => normalizeLonLat(coord));
    coordinates.forEach(getNodeId);
    let lineFeet = 0;

    for (let index = 1; index < coordinates.length; index++) {
      const start = coordinates[index - 1];
      const end = coordinates[index];
      const startNodeId = getNodeId(start);
      const endNodeId = getNodeId(end);
      if (startNodeId === endNodeId) continue;
      const lengthFt = turf.distance(turf.point(start), turf.point(end), { units: "miles" }) * 5280;

      edges.push({
        id: `E-${line.lineId}-${index}`,
        edgeId: `E-${line.lineId}-${index}`,
        startNodeId,
        endNodeId,
        fromNodeId: startNodeId,
        toNodeId: endNodeId,
        geometry: [start, end],
        lengthFt,
        startFeet: lineFeet,
        endFeet: lineFeet + lengthFt,
        routeId: line.routeId,
        routeName: line.name,
      });
      lineFeet += lengthFt;
    }
  });

  const fullGeometry = args.geometry.map((line) => line.coordinates);
  const stations = generateGraphStationsFromEdges(edges, 1000, { maxStations: 100_000 });
  console.log("STATIONS GENERATED", stations.length);
  console.log("STATION COUNT", stations.length);

  return {
    baselineId: args.baselineId,
    name: args.name,
    datasetType: "BASELINE_GRAPH",
    geometry: args.geometry,
    fullGeometry,
    nodes: [...nodes.values()],
    edges,
    stations,
    metadata: {
      sourceFile: args.sourceFilename,
      importDate: new Date().toISOString(),
      lineCount: args.geometry.length,
      nodeCount: nodes.size,
      edgeCount: edges.length,
      stationCount: stations.length,
      ...(args.metadata ?? {}),
    },
  };
}

function pointAtDistanceOnEdge(edge: BaselineGraphEdge, stationFeet: number): LonLat | null {
  if (edge.geometry.length < 2 || edge.lengthFt <= 0) return null;
  const localFeet = Math.max(0, Math.min(edge.lengthFt, stationFeet - edge.startFeet));
  const line = turf.lineString(edge.geometry);
  const point = turf.along(line, localFeet / 5280, { units: "miles" });
  return normalizeLonLat(point.geometry.coordinates);
}

function pointInBounds([lon, lat]: LonLat, bounds?: [number, number, number, number]) {
  if (!bounds) return true;
  return lon >= bounds[0] && lon <= bounds[2] && lat >= bounds[1] && lat <= bounds[3];
}

function generateGraphStationsFromEdges(
  edges: BaselineGraphEdge[],
  intervalFt: number,
  options: { bounds?: [number, number, number, number]; maxStations?: number } = {}
): GraphStation[] {
  const interval = Math.max(1, Math.round(intervalFt));
  const maxStations = options.maxStations ?? 5000;
  const stations: GraphStation[] = [];

  for (const edge of edges) {
    if (edge.lengthFt <= 0) continue;
    const firstStationFeet = interval <= 10 ? Math.round(edge.startFeet) : Math.ceil(edge.startFeet / interval) * interval;
    for (let stationFeet = firstStationFeet; stationFeet <= edge.endFeet + 1e-6; stationFeet += interval) {
      const coord = pointAtDistanceOnEdge(edge, stationFeet);
      if (!coord || !pointInBounds(coord, options.bounds)) continue;
      stations.push({
        stationId: `${edge.edgeId}-${stationLabelFromFeet(stationFeet)}`,
        edgeId: edge.edgeId,
        stationFeet,
        lat: coord[1],
        lon: coord[0],
        lng: coord[0],
        intervalFt: interval,
      });
      if (stations.length >= maxStations) return stations;
    }
  }

  return stations;
}

export function generateGraphStations(
  graph: BaselineGraph,
  intervalFt: number,
  options: { bounds?: [number, number, number, number]; maxStations?: number } = {}
) {
  const stations = generateGraphStationsFromEdges(graph.edges, intervalFt, options);
  console.log("STATIONS GENERATED", stations.length);
  console.log("STATION COUNT", stations.length);
  return stations;
}

export function findNearestStation(args: {
  graph: BaselineGraph;
  gps: { lat: number; lon?: number; lng?: number };
  scopeVersionId?: string | null;
}): GraphStationLookupResult | null {
  const lon = Number(args.gps.lon ?? args.gps.lng);
  const lat = Number(args.gps.lat);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  const sitePoint = turf.point([lon, lat]);

  let best:
    | {
        edge: BaselineGraphEdge;
        nearestPoint: LonLat;
        distanceFt: number;
        locationFt: number;
      }
    | null = null;

  for (const edge of args.graph.edges) {
    if (edge.geometry.length < 2 || edge.lengthFt <= 0) continue;
    const line = turf.lineString(edge.geometry);
    const nearest = turf.nearestPointOnLine(line, sitePoint, { units: "miles" });
    const distanceFt = turf.distance(sitePoint, nearest, { units: "miles" }) * 5280;
    if (!best || distanceFt < best.distanceFt) {
      const locationFt = edge.startFeet + Number(nearest.properties?.location ?? 0) * 5280;
      best = {
        edge,
        nearestPoint: nearest.geometry.coordinates as LonLat,
        distanceFt,
        locationFt,
      };
    }
  }

  if (!best) return null;
  const stationFeet = Math.max(0, Math.round(best.locationFt));
  const stationCoord = pointAtDistanceOnEdge(best.edge, stationFeet) ?? best.nearestPoint;

  return {
    stationId: `${best.edge.edgeId}-${stationLabelFromFeet(stationFeet)}`,
    distanceFt: Math.round(best.distanceFt),
    edgeId: best.edge.edgeId,
    scopeVersionId: args.scopeVersionId ?? null,
    lat: stationCoord[1],
    lon: stationCoord[0],
    lng: stationCoord[0],
  };
}

export function buildBaselineGraphFromGeoJSON(args: {
  baselineId: string;
  name: string;
  geojson: any;
  sourceFilename?: string;
  metadata?: Record<string, unknown>;
}) {
  return buildBaselineGraphFromGeometry({
    baselineId: args.baselineId,
    name: args.name,
    geometry: extractBaselineGraphGeometryFromGeoJSON(args.geojson),
    sourceFilename: args.sourceFilename,
    metadata: args.metadata,
  });
}

export function buildBaselineGraph(args: {
  baselineId: string;
  name: string;
  lineStrings: BaselineGraphGeometry[];
  sourceFilename?: string;
  metadata?: Record<string, unknown>;
}) {
  return buildBaselineGraphFromGeometry({
    baselineId: args.baselineId,
    name: args.name,
    geometry: args.lineStrings,
    sourceFilename: args.sourceFilename,
    metadata: args.metadata,
  });
}

console.log("BASELINE GRAPH BUILDER EXPORTED");

export function loadBaselineNetworks() {
  return [] as StoredBaselineMetadata[];
}

export function loadSiteCampaigns() {
  return readList<SiteCampaign>(FIBERLIGHT_STORAGE_KEYS.siteCampaigns);
}

export function loadOpportunityBatches() {
  return readList<OpportunityBatch>(FIBERLIGHT_STORAGE_KEYS.opportunityBatches);
}

export function loadOpportunitySeeds() {
  return readList<OpportunitySeed>(FIBERLIGHT_STORAGE_KEYS.opportunitySeeds);
}

export function saveBaselineNetwork(network: StoredBaselineNetwork) {
  void network;
  console.warn("Baseline persistence is server-backed via Chicago API; saveBaselineNetwork is deprecated.");
}

export function saveSiteCampaign(campaign: SiteCampaign) {
  // TODO: Replace beta localStorage persistence with API-backed campaign persistence.
  upsertList(FIBERLIGHT_STORAGE_KEYS.siteCampaigns, campaign, (item) => item.campaignId === campaign.campaignId);
}

export function saveOpportunityBatch(batch: OpportunityBatch) {
  // TODO: Replace beta localStorage persistence with API-backed batch persistence.
  upsertList(FIBERLIGHT_STORAGE_KEYS.opportunityBatches, batch, (item) => item.batchId === batch.batchId);
}

export function saveOpportunitySeed(seed: OpportunitySeed) {
  // TODO: Replace beta localStorage persistence with API-backed opportunity persistence.
  upsertList(FIBERLIGHT_STORAGE_KEYS.opportunitySeeds, seed, (item) => item.opportunityId === seed.opportunityId);
}

export function buildServiceabilityResults(args: {
  sites: UploadedSitesRow[];
  baseline: StoredBaselineNetwork | null;
  lateralCostPerFoot?: number;
}) {
  if (args.baseline?.datasetType === "BASELINE_GRAPH" && args.baseline.graph?.edges.length) {
    return buildGraphServiceabilityResults(args.sites, args.baseline.graph);
  }

  const lateralCostPerFoot = args.lateralCostPerFoot ?? 18;
  const route = args.baseline?.routeCoords ?? [];
  const hasRoute = route.length >= 2;
  const routeLine = hasRoute ? turf.lineString(route) : null;

  return args.sites.map((site, index): SiteServiceabilityResult => {
    const siteId = String(site.id || site.name || `site-${index + 1}`);

    if (!routeLine) {
      return {
        siteId,
        name: site.name,
        lat: site.lat,
        lon: site.lon,
        nearestRoutePoint: null,
        nearestGraphEdgeId: null,
        nearestGraphNodeId: null,
        nearestGraphNodeFeet: null,
        nearestStation: null,
        nearestStationFeet: null,
        distanceToNetworkFeet: null,
        serviceabilityClass: "OUT_OF_FOOTPRINT",
        estimatedLateralFeet: null,
        estimatedLateralCost: null,
        confidence: 0,
        selected: false,
      };
    }

    const sitePoint = turf.point([site.lon, site.lat]);
    const nearest = turf.nearestPointOnLine(routeLine, sitePoint, { units: "miles" });
    const nearestRoutePoint = nearest.geometry.coordinates as LonLat;
    const distanceFeet = Math.round(turf.distance(sitePoint, nearest, { units: "miles" }) * 5280);
    const nearestStation = findNearestDesignStation(args.baseline?.stations ?? [], { lat: site.lat, lon: site.lon });
    const serviceabilityClass = classifyDistance(distanceFeet);

    return {
      siteId,
      name: site.name,
      lat: site.lat,
      lon: site.lon,
      nearestRoutePoint,
      nearestGraphEdgeId: null,
      nearestGraphNodeId: null,
      nearestGraphNodeFeet: null,
      nearestStation: nearestStation?.station.station || nearestStation?.station.stationId || null,
      nearestStationFeet: nearestStation ? Math.round(nearestStation.distanceFeet) : null,
      distanceToNetworkFeet: distanceFeet,
      serviceabilityClass,
      estimatedLateralFeet: distanceFeet,
      estimatedLateralCost: Math.round(distanceFeet * lateralCostPerFoot),
      confidence: confidenceForDistance(distanceFeet),
      selected: false,
    };
  });
}

function buildGraphServiceabilityResults(sites: UploadedSitesRow[], graph: BaselineGraph) {
  const nodesById = new Map(graph.nodes.map((node) => [node.nodeId, node]));

  return sites.map((site, index): SiteServiceabilityResult => {
    const siteId = String(site.id || site.name || `site-${index + 1}`);
    const sitePoint = turf.point([site.lon, site.lat]);
    let best:
      | {
          edge: BaselineGraphEdge;
          nearestPoint: LonLat;
          distanceFeet: number;
        }
      | null = null;

    for (const edge of graph.edges) {
      if (edge.geometry.length < 2) continue;
      const nearest = turf.nearestPointOnLine(turf.lineString(edge.geometry), sitePoint, { units: "miles" });
      const distanceFeet = Math.round(turf.distance(sitePoint, nearest, { units: "miles" }) * 5280);
      if (!best || distanceFeet < best.distanceFeet) {
        best = {
          edge,
          nearestPoint: nearest.geometry.coordinates as LonLat,
          distanceFeet,
        };
      }
    }

    if (!best) {
      return {
        siteId,
        name: site.name,
        lat: site.lat,
        lon: site.lon,
        nearestRoutePoint: null,
        nearestGraphEdgeId: null,
        nearestGraphNodeId: null,
        nearestGraphNodeFeet: null,
        nearestStation: null,
        nearestStationFeet: null,
        distanceToNetworkFeet: null,
        serviceabilityClass: "OUT_OF_FOOTPRINT",
        estimatedLateralFeet: null,
        estimatedLateralCost: null,
        confidence: 0,
        selected: false,
      };
    }

    const startNodeId = best.edge.startNodeId ?? best.edge.fromNodeId;
    const endNodeId = best.edge.endNodeId ?? best.edge.toNodeId;
    const endpointNodes = [nodesById.get(startNodeId), nodesById.get(endNodeId)].filter(
      Boolean
    ) as BaselineGraphNode[];
    let nearestNode: { node: BaselineGraphNode; distanceFeet: number } | null = null;
    for (const node of endpointNodes) {
      const distanceFeet =
        turf.distance(sitePoint, turf.point([node.lon, node.lat]), { units: "miles" }) * 5280;
      if (!nearestNode || distanceFeet < nearestNode.distanceFeet) nearestNode = { node, distanceFeet };
    }

    return {
      siteId,
      name: site.name,
      lat: site.lat,
      lon: site.lon,
      nearestRoutePoint: best.nearestPoint,
      nearestGraphEdgeId: best.edge.edgeId,
      nearestGraphNodeId: nearestNode?.node.nodeId ?? null,
      nearestGraphNodeFeet: nearestNode ? Math.round(nearestNode.distanceFeet) : null,
      nearestStation: nearestNode?.node.nodeId ?? null,
      nearestStationFeet: nearestNode ? Math.round(nearestNode.distanceFeet) : null,
      distanceToNetworkFeet: best.distanceFeet,
      serviceabilityClass: classifyDistance(best.distanceFeet),
      estimatedLateralFeet: best.distanceFeet,
      estimatedLateralCost: null,
      confidence: confidenceForDistance(best.distanceFeet),
      selected: false,
    };
  });
}

function classifyDistance(distanceFeet: number): SiteServiceabilityResult["serviceabilityClass"] {
  if (distanceFeet <= 250) return "ON_NET";
  if (distanceFeet <= 1000) return "NEAR_NET";
  if (distanceFeet <= 5280) return "BUILD_REQUIRED";
  return "OUT_OF_FOOTPRINT";
}

function confidenceForDistance(distanceFeet: number) {
  if (distanceFeet <= 250) return 96;
  if (distanceFeet <= 1000) return Math.max(82, 94 - Math.round(distanceFeet / 85));
  if (distanceFeet <= 5280) return Math.max(55, 85 - Math.round(distanceFeet / 140));
  return Math.max(15, 50 - Math.round((distanceFeet - 5280) / 1000));
}

function findNearestDesignStation(stations: DesignStation[], point: { lat: number; lon: number }) {
  let best: { station: DesignStation; distanceFeet: number } | null = null;

  for (const station of stations) {
    const distanceFeet =
      turf.distance(turf.point([station.lon, station.lat]), turf.point([point.lon, point.lat]), { units: "miles" }) *
      5280;
    if (!best || distanceFeet < best.distanceFeet) best = { station, distanceFeet };
  }

  return best;
}

function readList<T>(key: string): T[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function upsertList<T>(key: string, item: T, matches: (item: T) => boolean) {
  if (typeof localStorage === "undefined") return;
  const next = readList<T>(key).filter((existing) => !matches(existing));
  next.unshift(item);
  localStorage.setItem(key, JSON.stringify(next));
}
