import { listRuntimeInventories, listRuntimeObjects } from "../api/runtimeFoundation";
import type { RuntimeInventoryRecord, RuntimeObjectRecord, RuntimeObjectType } from "../runtime/RuntimeObjectModel";
import type { DALCoordinate } from "../types/dal";

export type CustomerInventoryFeatureType =
  | "ROUTE"
  | "POP"
  | "SPLICE_CASE"
  | "HANDHOLE"
  | "VAULT"
  | "BUILDING"
  | "FACILITY"
  | "REGENERATION_SITE"
  | "CAMPUS"
  | "CUSTOMER_FACILITY"
  | "UNKNOWN_PLACEMARK";

export type CustomerInventoryParsedStatus = "PENDING" | "PARSING" | "PARSED" | "ERROR";
export type CustomerInventoryAuthorityState =
  | "EXISTING_NETWORK"
  | "CUSTOMER_PROPOSED_NETWORK"
  | "COMMERCIAL_DRAFT"
  | "CUSTOMER_DRAFT"
  | "ACCEPTED_PROPOSAL";

export interface CustomerInventoryLine {
  lineId: string;
  accountId: string;
  layerId: string;
  name: string;
  coordinates: DALCoordinate[];
  detailedCoordinates: DALCoordinate[];
  originalCoordinateCount: number;
  routeMiles: number;
  authorityState: CustomerInventoryAuthorityState;
  sourceKmz: string;
}

export interface CustomerInventoryPoint {
  pointId: string;
  accountId: string;
  layerId: string;
  name: string;
  coordinate: DALCoordinate;
  featureType: CustomerInventoryFeatureType;
  sourceKmz: string;
  confidence: string;
  authorityState: CustomerInventoryAuthorityState;
  nearestRouteId?: string;
  nearestStationId?: string;
}

export interface CustomerInventoryLayer {
  layerId: string;
  accountId: string;
  networkName: string;
  sourceAssetName: string;
  sourceUrl: string;
  source: "KMZ" | "GIS_API";
  parsedStatus: CustomerInventoryParsedStatus;
  authority: "Customer Inventory";
  authorityState: CustomerInventoryAuthorityState;
  locked: true;
  visibleByDefault: boolean;
  useAsDiversityConstraintByDefault: boolean;
  routeMiles: number;
  objectCount: number;
  routeLineCount: number;
  stationCount: number;
  featureCount: number;
  lastUpdated: string;
  kmlEntryName?: string;
  lines: CustomerInventoryLine[];
  points: CustomerInventoryPoint[];
  diagnostics: string[];
}

export interface CustomerNetworkRoute {
  routeId: string;
  accountId: string;
  layerId: string;
  routeName: string;
  sourceLayerName: string;
  sourceKmz: string;
  displayCoordinates: DALCoordinate[];
  originalCoordinateCount: number;
  routeMiles: number;
  edgeIds: string[];
  stationIds: string[];
  authorityState: CustomerInventoryAuthorityState;
  locked: true;
  provenance: string;
}

export interface CustomerNetworkEdge {
  edgeId: string;
  accountId: string;
  layerId: string;
  routeId: string;
  nodeIds: string[];
  displayCoordinates: DALCoordinate[];
  routeMiles: number;
  originalCoordinateCount: number;
  authorityState: CustomerInventoryAuthorityState;
}

export interface CustomerNetworkNode {
  nodeId: string;
  accountId: string;
  layerId: string;
  routeId?: string;
  nodeType: "ROUTE_START" | "ROUTE_END" | "OBJECT";
  name: string;
  coordinate: DALCoordinate;
  sourceKmz: string;
  authorityState: CustomerInventoryAuthorityState;
}

export interface CustomerNetworkStation {
  stationId: string;
  accountId: string;
  layerId: string;
  routeId: string;
  routeName: string;
  stationIntervalFeet: number;
  stationIndex: number;
  coordinate: DALCoordinate;
  cumulativeFeet: number;
  sourceLayerId: string;
  sourceLayerName: string;
}

export interface CustomerNetworkObject {
  objectId: string;
  accountId: string;
  layerId: string;
  name: string;
  objectType: CustomerInventoryFeatureType;
  coordinate: DALCoordinate;
  sourceKmz: string;
  confidence: string;
  authorityState: CustomerInventoryAuthorityState;
  nearestRouteId?: string;
  nearestStationId?: string;
}

export interface CustomerNetworkGraphSummary {
  routeCount: number;
  routeMiles: number;
  edgeCount: number;
  nodeCount: number;
  objectCount: number;
  stationCount: number;
  sourceFiles: string[];
  lastSynchronized: string;
  inventorySessionVersion: string;
}

export interface CustomerNetworkGraph {
  graphId: string;
  accountId: string;
  inventorySessionVersion: string;
  synchronizedAt: string;
  frozenAt: string;
  status: CustomerInventoryParsedStatus;
  stationIntervalFeet: number;
  layers: CustomerInventoryLayer[];
  routes: CustomerNetworkRoute[];
  edges: CustomerNetworkEdge[];
  nodes: CustomerNetworkNode[];
  stations: CustomerNetworkStation[];
  objects: CustomerNetworkObject[];
  provenance: string[];
  summary: CustomerNetworkGraphSummary;
  frozenForCommercialPlanning: true;
}

export interface CustomerInventoryLoadResult {
  accountId: string;
  status: CustomerInventoryParsedStatus;
  loadedAt: string;
  inventorySessionVersion: string;
  layers: CustomerInventoryLayer[];
  graph: CustomerNetworkGraph;
  diagnostics: string[];
}

interface CustomerInventoryAsset {
  layerId: string;
  accountId: string;
  networkName: string;
  sourceAssetName: string;
  sourceUrl: string;
  authorityState: CustomerInventoryAuthorityState;
  visibleByDefault: boolean;
  useAsDiversityConstraintByDefault: boolean;
}

const EARTH_RADIUS_MILES = 3958.7613;
const MAX_RENDER_COORDINATES_PER_LINE = 96;
const DEFAULT_STATION_INTERVAL_FEET = 500;
const FEET_PER_MILE = 5280;

function safeId(value: string, fallback: string) {
  const normalized = value
    .trim()
    .replace(/&amp;/g, "and")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72);
  return normalized || fallback;
}

function roundCoordinate(coordinate: DALCoordinate): DALCoordinate {
  return [Number(coordinate[0].toFixed(6)), Number(coordinate[1].toFixed(6))];
}

function parseCoordinateText(text: string): DALCoordinate[] {
  return text
    .trim()
    .split(/\s+/)
    .map((chunk) => {
      const [lonText, latText] = chunk.split(",");
      const lon = Number(lonText);
      const lat = Number(latText);
      return Number.isFinite(lon) && Number.isFinite(lat) ? roundCoordinate([lon, lat]) : null;
    })
    .filter((coordinate): coordinate is DALCoordinate => Boolean(coordinate));
}

function radians(value: number) {
  return value * Math.PI / 180;
}

function segmentMiles(a: DALCoordinate, b: DALCoordinate) {
  const dLat = radians(b[1] - a[1]);
  const dLon = radians(b[0] - a[0]);
  const lat1 = radians(a[1]);
  const lat2 = radians(b[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_MILES * Math.asin(Math.min(1, Math.sqrt(h)));
}

function routeMiles(coordinates: DALCoordinate[]) {
  let miles = 0;
  for (let index = 1; index < coordinates.length; index += 1) {
    miles += segmentMiles(coordinates[index - 1], coordinates[index]);
  }
  return miles;
}

function coordinateAtDistance(coordinates: DALCoordinate[], targetFeet: number): DALCoordinate {
  if (!coordinates.length) return [0, 0];
  if (targetFeet <= 0 || coordinates.length === 1) return coordinates[0];
  let cumulativeFeet = 0;
  for (let index = 1; index < coordinates.length; index += 1) {
    const previous = coordinates[index - 1];
    const current = coordinates[index];
    const segmentFeet = segmentMiles(previous, current) * FEET_PER_MILE;
    if (!segmentFeet) continue;
    if (cumulativeFeet + segmentFeet >= targetFeet) {
      const ratio = (targetFeet - cumulativeFeet) / segmentFeet;
      return roundCoordinate([
        previous[0] + (current[0] - previous[0]) * ratio,
        previous[1] + (current[1] - previous[1]) * ratio,
      ]);
    }
    cumulativeFeet += segmentFeet;
  }
  return coordinates[coordinates.length - 1];
}

function buildRouteStations(args: {
  accountId: string;
  layerId: string;
  routeId: string;
  routeName: string;
  layerName: string;
  coordinates: DALCoordinate[];
  routeMiles: number;
  stationIntervalFeet?: number;
}): CustomerNetworkStation[] {
  const stationIntervalFeet = args.stationIntervalFeet ?? DEFAULT_STATION_INTERVAL_FEET;
  const totalFeet = args.routeMiles * FEET_PER_MILE;
  if (!args.coordinates.length || totalFeet <= 0) return [];
  const stations: CustomerNetworkStation[] = [];
  for (let feet = 0, stationIndex = 0; feet <= totalFeet; feet += stationIntervalFeet, stationIndex += 1) {
    stations.push({
      stationId: `${args.routeId}-STA-${stationIndex.toString().padStart(5, "0")}`,
      accountId: args.accountId,
      layerId: args.layerId,
      routeId: args.routeId,
      routeName: args.routeName,
      stationIntervalFeet,
      stationIndex,
      coordinate: coordinateAtDistance(args.coordinates, feet),
      cumulativeFeet: Math.round(feet),
      sourceLayerId: args.layerId,
      sourceLayerName: args.layerName,
    });
  }
  const lastStation = stations[stations.length - 1];
  if (!lastStation || Math.abs(lastStation.cumulativeFeet - totalFeet) > 1) {
    stations.push({
      stationId: `${args.routeId}-STA-${stations.length.toString().padStart(5, "0")}`,
      accountId: args.accountId,
      layerId: args.layerId,
      routeId: args.routeId,
      routeName: args.routeName,
      stationIntervalFeet,
      stationIndex: stations.length,
      coordinate: coordinateAtDistance(args.coordinates, totalFeet),
      cumulativeFeet: Math.round(totalFeet),
      sourceLayerId: args.layerId,
      sourceLayerName: args.layerName,
    });
  }
  return stations;
}

function simplifyCoordinates(coordinates: DALCoordinate[]) {
  if (coordinates.length <= MAX_RENDER_COORDINATES_PER_LINE) return coordinates.map(roundCoordinate);
  const simplified: DALCoordinate[] = [];
  const step = (coordinates.length - 1) / (MAX_RENDER_COORDINATES_PER_LINE - 1);
  for (let index = 0; index < MAX_RENDER_COORDINATES_PER_LINE; index += 1) {
    const coordinate = coordinates[Math.round(index * step)];
    if (coordinate) simplified.push(roundCoordinate(coordinate));
  }
  return simplified.filter((coordinate, index, list) => (
    index === 0 || coordinate[0] !== list[index - 1][0] || coordinate[1] !== list[index - 1][1]
  ));
}

function elementsByLocalName(root: ParentNode, localName: string) {
  return Array.from(root.querySelectorAll("*")).filter((element) => element.localName === localName);
}

function firstLocalText(root: ParentNode, localName: string) {
  return elementsByLocalName(root, localName)[0]?.textContent?.trim() ?? "";
}

function inferFeatureType(name: string): CustomerInventoryFeatureType {
  const lower = name.toLowerCase();
  if (lower.includes("regen") || lower.includes("ila")) return "REGENERATION_SITE";
  if (lower.includes("splice")) return "SPLICE_CASE";
  if (lower.includes("handhole") || /\bhh\b/.test(lower)) return "HANDHOLE";
  if (lower.includes("vault")) return "VAULT";
  if (lower.includes("building")) return "BUILDING";
  if (lower.includes("campus")) return "CAMPUS";
  if (lower.includes("customer") || lower.includes("facility")) return "CUSTOMER_FACILITY";
  if (/(^|\b)(hiu|mus|swr|tul|pkn|yno|hax|pop|zcv|site|campus|facility)(\b|$)/.test(lower)) return "POP";
  return "UNKNOWN_PLACEMARK";
}

function parseKmlInventory(args: {
  asset: CustomerInventoryAsset;
  kmlText: string;
  kmlEntryName?: string;
}): CustomerInventoryLayer {
  const diagnostics: string[] = [];
  const dom = new DOMParser().parseFromString(args.kmlText, "application/xml");
  const parserError = dom.querySelector("parsererror");
  if (parserError) {
    return {
      layerId: args.asset.layerId,
      accountId: args.asset.accountId,
      networkName: args.asset.networkName,
      sourceAssetName: args.asset.sourceAssetName,
      sourceUrl: args.asset.sourceUrl,
      source: "KMZ",
      parsedStatus: "ERROR",
      authority: "Customer Inventory",
      authorityState: args.asset.authorityState,
      locked: true,
      visibleByDefault: args.asset.visibleByDefault,
      useAsDiversityConstraintByDefault: args.asset.useAsDiversityConstraintByDefault,
      routeMiles: 0,
      objectCount: 0,
      routeLineCount: 0,
      stationCount: 0,
      featureCount: 0,
      lastUpdated: new Date().toISOString(),
      kmlEntryName: args.kmlEntryName,
      lines: [],
      points: [],
      diagnostics: [`KML parser error: ${parserError.textContent?.slice(0, 160) ?? "unknown"}`],
    };
  }

  const lines: CustomerInventoryLine[] = [];
  const points: CustomerInventoryPoint[] = [];
  const placemarks = elementsByLocalName(dom, "Placemark");
  placemarks.forEach((placemark, placemarkIndex) => {
    const name = firstLocalText(placemark, "name") || `Placemark ${placemarkIndex + 1}`;
    elementsByLocalName(placemark, "LineString").forEach((lineString, lineIndex) => {
      const coordinates = parseCoordinateText(firstLocalText(lineString, "coordinates"));
      if (coordinates.length < 2) return;
      lines.push({
        lineId: `${args.asset.layerId}-LINE-${safeId(name, String(placemarkIndex + 1))}-${lineIndex + 1}`,
        accountId: args.asset.accountId,
        layerId: args.asset.layerId,
        name,
        coordinates: simplifyCoordinates(coordinates),
        detailedCoordinates: coordinates,
        originalCoordinateCount: coordinates.length,
        routeMiles: Number(routeMiles(coordinates).toFixed(2)),
        authorityState: args.asset.authorityState,
        sourceKmz: args.asset.sourceAssetName,
      });
    });
    elementsByLocalName(placemark, "Point").forEach((point, pointIndex) => {
      const coordinate = parseCoordinateText(firstLocalText(point, "coordinates"))[0];
      if (!coordinate) return;
      points.push({
        pointId: `${args.asset.layerId}-POINT-${safeId(name, String(placemarkIndex + 1))}-${pointIndex + 1}`,
        accountId: args.asset.accountId,
        layerId: args.asset.layerId,
        name,
        coordinate,
        featureType: inferFeatureType(name),
        sourceKmz: args.asset.sourceAssetName,
        confidence: "Parsed KMZ placemark",
        authorityState: args.asset.authorityState,
      });
    });
  });

  diagnostics.push(`Parsed ${placemarks.length.toLocaleString()} placemarks from ${args.asset.sourceAssetName}.`);
  diagnostics.push(`Extracted ${lines.length.toLocaleString()} route/path lines and ${points.length.toLocaleString()} markers.`);
  const estimatedStationCount = lines.reduce((sum, line) => sum + Math.max(1, Math.ceil((line.routeMiles * FEET_PER_MILE) / DEFAULT_STATION_INTERVAL_FEET)), 0);
  diagnostics.push(`Prepared lightweight ${DEFAULT_STATION_INTERVAL_FEET.toLocaleString()} ft stationing for ${estimatedStationCount.toLocaleString()} display/commercial stations.`);

  return {
    layerId: args.asset.layerId,
    accountId: args.asset.accountId,
    networkName: args.asset.networkName,
    sourceAssetName: args.asset.sourceAssetName,
    sourceUrl: args.asset.sourceUrl,
    source: "KMZ",
    parsedStatus: "PARSED",
    authority: "Customer Inventory",
    authorityState: args.asset.authorityState,
    locked: true,
    visibleByDefault: args.asset.visibleByDefault,
    useAsDiversityConstraintByDefault: args.asset.useAsDiversityConstraintByDefault,
    routeMiles: Number(lines.reduce((sum, line) => sum + line.routeMiles, 0).toFixed(2)),
    objectCount: points.length,
    routeLineCount: lines.length,
    stationCount: estimatedStationCount,
    featureCount: lines.length + points.length,
    lastUpdated: new Date().toISOString(),
    kmlEntryName: args.kmlEntryName,
    lines,
    points,
    diagnostics,
  };
}

async function loadKmzInventoryLayer(asset: CustomerInventoryAsset): Promise<CustomerInventoryLayer> {
  return {
    layerId: asset.layerId,
    accountId: asset.accountId,
    networkName: asset.networkName,
    sourceAssetName: asset.sourceAssetName,
    sourceUrl: asset.sourceUrl,
    source: "KMZ",
    parsedStatus: "ERROR",
    authority: "Customer Inventory",
    authorityState: asset.authorityState,
    locked: true,
    visibleByDefault: asset.visibleByDefault,
    useAsDiversityConstraintByDefault: asset.useAsDiversityConstraintByDefault,
    routeMiles: 0,
    objectCount: 0,
    routeLineCount: 0,
    stationCount: 0,
    featureCount: 0,
    lastUpdated: new Date().toISOString(),
    lines: [],
    points: [],
    diagnostics: ["Static customer inventory loading is disabled. Commit customer evidence through the shared runtime instead."],
  };
}

function distanceScore(a: DALCoordinate, b: DALCoordinate) {
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  return dx * dx + dy * dy;
}

function buildCustomerNetworkGraph(args: {
  accountId: string;
  layers: CustomerInventoryLayer[];
  status: CustomerInventoryParsedStatus;
  loadedAt: string;
  inventorySessionVersion: string;
}): CustomerNetworkGraph {
  const routes: CustomerNetworkRoute[] = [];
  const edges: CustomerNetworkEdge[] = [];
  const nodes: CustomerNetworkNode[] = [];
  const stations: CustomerNetworkStation[] = [];
  const objects: CustomerNetworkObject[] = [];

  args.layers.forEach((layer) => {
    layer.lines.forEach((line, index) => {
      const routeId = `${layer.layerId}-ROUTE-${(index + 1).toString().padStart(4, "0")}`;
      const startNodeId = `${routeId}-NODE-START`;
      const endNodeId = `${routeId}-NODE-END`;
      const edgeId = `${routeId}-EDGE-0001`;
      const routeStations = buildRouteStations({
        accountId: args.accountId,
        layerId: layer.layerId,
        routeId,
        routeName: line.name,
        layerName: layer.networkName,
        coordinates: line.detailedCoordinates,
        routeMiles: line.routeMiles,
      });
      stations.push(...routeStations);
      nodes.push({
        nodeId: startNodeId,
        accountId: args.accountId,
        layerId: layer.layerId,
        routeId,
        nodeType: "ROUTE_START",
        name: `${line.name} start`,
        coordinate: line.detailedCoordinates[0],
        sourceKmz: line.sourceKmz,
        authorityState: layer.authorityState,
      });
      nodes.push({
        nodeId: endNodeId,
        accountId: args.accountId,
        layerId: layer.layerId,
        routeId,
        nodeType: "ROUTE_END",
        name: `${line.name} end`,
        coordinate: line.detailedCoordinates[line.detailedCoordinates.length - 1],
        sourceKmz: line.sourceKmz,
        authorityState: layer.authorityState,
      });
      edges.push({
        edgeId,
        accountId: args.accountId,
        layerId: layer.layerId,
        routeId,
        nodeIds: [startNodeId, endNodeId],
        displayCoordinates: line.coordinates,
        routeMiles: line.routeMiles,
        originalCoordinateCount: line.originalCoordinateCount,
        authorityState: layer.authorityState,
      });
      routes.push({
        routeId,
        accountId: args.accountId,
        layerId: layer.layerId,
        routeName: line.name,
        sourceLayerName: layer.networkName,
        sourceKmz: line.sourceKmz,
        displayCoordinates: line.coordinates,
        originalCoordinateCount: line.originalCoordinateCount,
        routeMiles: line.routeMiles,
        edgeIds: [edgeId],
        stationIds: routeStations.map((station) => station.stationId),
        authorityState: layer.authorityState,
        locked: true,
        provenance: `${layer.sourceAssetName}:${line.lineId}`,
      });
    });
  });

  const stationsByRoute = new Map<string, CustomerNetworkStation[]>();
  stations.forEach((station) => {
    const list = stationsByRoute.get(station.routeId) ?? [];
    list.push(station);
    stationsByRoute.set(station.routeId, list);
  });

  args.layers.forEach((layer) => {
    layer.points.forEach((point, index) => {
      const candidateRoutes = routes.filter((route) => route.layerId === layer.layerId);
      let nearestRoute: CustomerNetworkRoute | undefined;
      let nearestRouteScore = Number.POSITIVE_INFINITY;
      candidateRoutes.forEach((route) => {
        route.displayCoordinates.forEach((coordinate) => {
          const score = distanceScore(point.coordinate, coordinate);
          if (score < nearestRouteScore) {
            nearestRouteScore = score;
            nearestRoute = route;
          }
        });
      });
      let nearestStation: CustomerNetworkStation | undefined;
      if (nearestRoute) {
        let nearestStationScore = Number.POSITIVE_INFINITY;
        (stationsByRoute.get(nearestRoute.routeId) ?? []).forEach((station) => {
          const score = distanceScore(point.coordinate, station.coordinate);
          if (score < nearestStationScore) {
            nearestStationScore = score;
            nearestStation = station;
          }
        });
      }
      const objectId = `${layer.layerId}-OBJECT-${(index + 1).toString().padStart(4, "0")}`;
      objects.push({
        objectId,
        accountId: args.accountId,
        layerId: layer.layerId,
        name: point.name,
        objectType: point.featureType,
        coordinate: point.coordinate,
        sourceKmz: point.sourceKmz,
        confidence: point.confidence,
        authorityState: point.authorityState,
        nearestRouteId: nearestRoute?.routeId,
        nearestStationId: nearestStation?.stationId,
      });
      nodes.push({
        nodeId: `${objectId}-NODE`,
        accountId: args.accountId,
        layerId: layer.layerId,
        routeId: nearestRoute?.routeId,
        nodeType: "OBJECT",
        name: point.name,
        coordinate: point.coordinate,
        sourceKmz: point.sourceKmz,
        authorityState: point.authorityState,
      });
      point.nearestRouteId = nearestRoute?.routeId;
      point.nearestStationId = nearestStation?.stationId;
    });
  });

  const sourceFiles = args.layers.map((layer) => layer.sourceAssetName);
  const routeMilesTotal = Number(routes.reduce((sum, route) => sum + route.routeMiles, 0).toFixed(2));
  return {
    graphId: `CUSTOMER-NETWORK-GRAPH-${args.accountId.toUpperCase()}-${args.inventorySessionVersion}`,
    accountId: args.accountId,
    inventorySessionVersion: args.inventorySessionVersion,
    synchronizedAt: args.loadedAt,
    frozenAt: args.loadedAt,
    status: args.status,
    stationIntervalFeet: DEFAULT_STATION_INTERVAL_FEET,
    layers: args.layers.map((layer) => ({ ...layer, stationCount: stations.filter((station) => station.layerId === layer.layerId).length })),
    routes,
    edges,
    nodes,
    stations,
    objects,
    provenance: sourceFiles,
    summary: {
      routeCount: routes.length,
      routeMiles: routeMilesTotal,
      edgeCount: edges.length,
      nodeCount: nodes.length,
      objectCount: objects.length,
      stationCount: stations.length,
      sourceFiles,
      lastSynchronized: args.loadedAt,
      inventorySessionVersion: args.inventorySessionVersion,
    },
    frozenForCommercialPlanning: true,
  };
}

function emptyCustomerNetworkGraph(accountId: string, loadedAt: string, inventorySessionVersion: string): CustomerNetworkGraph {
  return buildCustomerNetworkGraph({
    accountId,
    layers: [],
    status: "PARSED",
    loadedAt,
    inventorySessionVersion,
  });
}

function accountKey(value: unknown) {
  return String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function runtimeInventoryMatchesAccount(inventory: RuntimeInventoryRecord, accountId: string) {
  const target = accountKey(accountId);
  const candidates = [
    inventory.owner,
    inventory.metadata?.accountId,
    inventory.metadata?.customerName,
    inventory.metadata?.customerId,
  ];
  return inventory.inventoryType === "CUSTOMER" && candidates.some((candidate) => accountKey(candidate) === target);
}

function isCoordinate(value: unknown): value is DALCoordinate {
  return Array.isArray(value) && value.length >= 2 && Number.isFinite(Number(value[0])) && Number.isFinite(Number(value[1]));
}

function runtimeLineCoordinates(object: RuntimeObjectRecord) {
  if (object.geometry?.type !== "LineString" || !Array.isArray(object.geometry.coordinates)) return [];
  return (object.geometry.coordinates as unknown[]).filter(isCoordinate).map(roundCoordinate);
}

function runtimePointCoordinate(object: RuntimeObjectRecord): DALCoordinate | null {
  if (isCoordinate(object.coordinates)) return roundCoordinate(object.coordinates);
  if (object.geometry?.type === "Point" && isCoordinate(object.geometry.coordinates)) return roundCoordinate(object.geometry.coordinates);
  return null;
}

function customerFeatureType(objectType: RuntimeObjectType): CustomerInventoryFeatureType {
  if (objectType === "POP") return "POP";
  if (objectType === "ILA") return "REGENERATION_SITE";
  if (objectType === "HANDHOLE") return "HANDHOLE";
  if (objectType === "DATA_CENTER") return "CUSTOMER_FACILITY";
  if (objectType === "CUSTOMER_SITE") return "CUSTOMER_FACILITY";
  if (objectType === "CROSSING") return "UNKNOWN_PLACEMARK";
  return "UNKNOWN_PLACEMARK";
}

function runtimeObjectKind(object: RuntimeObjectRecord) {
  return String(object.objectType ?? object.classification ?? "").toUpperCase();
}

function isRuntimeLineInventoryObject(object: RuntimeObjectRecord, kinds: string[]) {
  const kind = runtimeObjectKind(object);
  return kinds.includes(kind) && runtimeLineCoordinates(object).length > 1;
}

function layerFromRuntimeInventory(
  accountId: string,
  inventory: RuntimeInventoryRecord,
  objects: RuntimeObjectRecord[],
): CustomerInventoryLayer {
  const sourceName = String(inventory.metadata?.sourceFileName ?? inventory.name ?? inventory.inventoryId);
  const routeObjects = objects.filter((object) => isRuntimeLineInventoryObject(object, ["ROUTE", "CUSTOMER_ROUTE"]));
  const segmentObjects = objects.filter((object) => isRuntimeLineInventoryObject(object, ["SEGMENT", "CUSTOMER_SEGMENT"]));
  const genericLineObjects = objects.filter((object) => runtimeLineCoordinates(object).length > 1 && !["POLYGON", "CUSTOMER_POLYGON"].includes(runtimeObjectKind(object)));
  const lineObjects = routeObjects.length ? routeObjects : segmentObjects.length ? segmentObjects : genericLineObjects;
  const lines: CustomerInventoryLine[] = lineObjects.map((object) => {
    const coordinates = runtimeLineCoordinates(object);
    return {
      lineId: object.runtimeId,
      accountId,
      layerId: inventory.inventoryId,
      name: object.name,
      coordinates,
      detailedCoordinates: coordinates,
      originalCoordinateCount: coordinates.length,
      routeMiles: Number((object.routeMiles ?? routeMiles(coordinates)).toFixed(2)),
      authorityState: "EXISTING_NETWORK",
      sourceKmz: sourceName,
    };
  });
  const points: CustomerInventoryPoint[] = objects
    .filter((object) => object.objectType !== "ROUTE" && object.objectType !== "SEGMENT" && object.objectType !== "POLYGON")
    .map((object) => ({ object, coordinate: runtimePointCoordinate(object) }))
    .filter((item): item is { object: RuntimeObjectRecord; coordinate: DALCoordinate } => Boolean(item.coordinate))
    .map(({ object, coordinate }) => ({
      pointId: object.runtimeId,
      accountId,
      layerId: inventory.inventoryId,
      name: object.name,
      coordinate,
      featureType: customerFeatureType(object.objectType),
      sourceKmz: sourceName,
      confidence: String(object.metadata?.confidence ?? "runtime"),
      authorityState: "EXISTING_NETWORK",
      nearestRouteId: object.routeId,
    }));

  return {
    layerId: inventory.inventoryId,
    accountId,
    networkName: inventory.name,
    sourceAssetName: sourceName,
    sourceUrl: `/api/runtime/inventories/${encodeURIComponent(inventory.inventoryId)}`,
    source: "GIS_API",
    parsedStatus: "PARSED",
    authority: "Customer Inventory",
    authorityState: "EXISTING_NETWORK",
    locked: true,
    visibleByDefault: true,
    useAsDiversityConstraintByDefault: false,
    routeMiles: Number(lines.reduce((sum, line) => sum + line.routeMiles, 0).toFixed(2)),
    objectCount: points.length,
    routeLineCount: lines.length,
    stationCount: 0,
    featureCount: lines.length + points.length,
    lastUpdated: inventory.updatedAt,
    lines,
    points,
    diagnostics: [
      `Loaded runtime customer inventory ${inventory.inventoryId}.`,
      `Runtime objects: ${objects.length.toLocaleString()}; route lines: ${lines.length.toLocaleString()}; points: ${points.length.toLocaleString()}.`,
    ],
  };
}

export async function loadCustomerInventoryForAccount(accountId: string): Promise<CustomerInventoryLoadResult> {
  const loadedAt = new Date().toISOString();
  const inventorySessionVersion = `INV-${loadedAt.replace(/[-:.TZ]/g, "").slice(0, 14)}`;
  try {
    const [inventories, runtimeObjects] = await Promise.all([listRuntimeInventories(), listRuntimeObjects()]);
    const accountInventories = inventories.filter((inventory) => runtimeInventoryMatchesAccount(inventory, accountId));
    const objectById = new Map(runtimeObjects.map((object) => [object.runtimeId, object]));
    const layers = accountInventories.map((inventory) => {
      const objects = inventory.objectIds.map((objectId) => objectById.get(objectId)).filter((object): object is RuntimeObjectRecord => Boolean(object));
      return layerFromRuntimeInventory(accountId, inventory, objects);
    }).filter((layer) => layer.routeLineCount || layer.objectCount);

    if (!layers.length) {
      const graph = emptyCustomerNetworkGraph(accountId, loadedAt, inventorySessionVersion);
      return {
        accountId,
        status: "PARSED",
        loadedAt,
        inventorySessionVersion,
        layers: [],
        graph,
        diagnostics: [`No runtime customer inventory committed for account ${accountId}.`],
      };
    }

    const graph = buildCustomerNetworkGraph({ accountId, layers, status: "PARSED", loadedAt, inventorySessionVersion });
    const diagnostics = layers.flatMap((layer) => layer.diagnostics);
    diagnostics.push(`Built runtime-backed account-scoped Customer Network Graph ${graph.graphId}.`);
    diagnostics.push(`Graph summary: ${graph.summary.routeCount.toLocaleString()} routes, ${graph.summary.objectCount.toLocaleString()} objects, ${graph.summary.stationCount.toLocaleString()} stations.`);
    return {
      accountId,
      status: "PARSED",
      loadedAt,
      inventorySessionVersion,
      layers: graph.layers,
      graph,
      diagnostics,
    };
  } catch (error) {
    const graph = emptyCustomerNetworkGraph(accountId, loadedAt, inventorySessionVersion);
    return {
      accountId,
      status: "ERROR",
      loadedAt,
      inventorySessionVersion,
      layers: [],
      graph,
      diagnostics: [`Runtime customer inventory load failed for account ${accountId}: ${error instanceof Error ? error.message : String(error)}`],
    };
  }
}
