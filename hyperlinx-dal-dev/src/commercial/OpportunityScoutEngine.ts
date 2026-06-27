import type { BudgetAssumptionState } from "./BudgetAssumptionState";
import type { AttachmentCandidate, AttachmentResolution } from "./CommercialAttachmentEngine";
import type { CommercialRouteResult } from "./CommercialOsrmRoutingEngine";
import type { CustomerTwinObject, CustomerTwinRenderableState, CustomerTwinRoute, CustomerTwinStation } from "../customerTwin/CustomerTwin";
import type { DALCoordinate } from "../types/dal";

export type OpportunityScoutMode = "CLICK_SITE" | "ADDRESS" | "LAT_LNG" | "AZ_BUILDER";
export type OpportunityScoutCandidateSource = "MAP_CLICK" | "ADDRESS_GEOCODE" | "LAT_LNG" | "AZ_BUILDER" | "BROWSER_RESULT";
export type OpportunityScoutDesignIntent = "EXTEND_EXISTING_NETWORK" | "NEW_INDEPENDENT_GRAPH";

export type ResolvedLocationSource =
  | "ADDRESS"
  | "LAT_LNG"
  | "MAP_CLICK"
  | "CUSTOMER_NODE"
  | "CUSTOMER_ROUTE"
  | "CUSTOMER_STATION"
  | "CUSTOMER_POP"
  | "CUSTOMER_BUILDING"
  | "CUSTOMER_SPLICE_CASE"
  | "CUSTOMER_OBJECT"
  | "COMMERCIAL_DRAFT_POINT"
  | "CUSTOMER_DRAFT_POINT"
  | "ACCEPTED_PROPOSAL_POINT";

export type ResolvedLocationDomain =
  | "CUSTOMER_EXISTING"
  | "CUSTOMER_PROPOSED"
  | "SALES_DRAFT"
  | "CUSTOMER_DRAFT"
  | "ACCEPTED_PROPOSAL"
  | "MAP_INPUT";

export interface ResolvedLocation {
  id: string;
  label: string;
  source: ResolvedLocationSource;
  inputValue?: string;
  latitude: number;
  longitude: number;
  accountId: string;
  domain: ResolvedLocationDomain;
  snappedRouteId?: string;
  snappedStationId?: string;
  snappedObjectId?: string;
  snappedNodeId?: string;
  nearestRouteId?: string;
  nearestStationId?: string;
  nearestObjectId?: string;
  confidence: number;
}

export interface OpportunityScoutCandidate {
  candidateId: string;
  accountId: string;
  mode: OpportunityScoutMode;
  source: OpportunityScoutCandidateSource;
  label: string;
  coordinate: DALCoordinate;
  createdAt: string;
  origin?: OpportunityScoutEndpoint;
  destination?: OpportunityScoutEndpoint;
  originLocation?: ResolvedLocation;
  destinationLocation?: ResolvedLocation;
  resolvedLocation?: ResolvedLocation;
  corridorGeometry?: DALCoordinate[];
  lockedIntoCommercialDraft: boolean;
  noScopeVersionCreation: true;
  noInventoryMutation: true;
}

export interface OpportunityScoutEndpoint {
  label: string;
  coordinate: DALCoordinate;
}

export interface OpportunityScoutNearestItem {
  id: string;
  label: string;
  type: string;
  layerId: string;
  coordinate: DALCoordinate;
  distanceFeet: number;
}

export interface OpportunityScoutSiteDecision {
  candidateId: string;
  nearestInventory: OpportunityScoutNearestItem | null;
  nearestGraphNode: OpportunityScoutNearestItem | null;
  nearestStation: OpportunityScoutNearestItem | null;
  nearestSplice: OpportunityScoutNearestItem | null;
  nearestPOP: OpportunityScoutNearestItem | null;
  nearestAttachment: OpportunityScoutNearestItem | null;
  nearestExistingCorridor: OpportunityScoutNearestItem | null;
  distanceFeet: number | null;
  power: string;
  floodplain: string;
  rail: string;
  parcel: string;
  environmental: string;
  utilityCorridor: string;
  diversityScore: number;
  expandability: number;
  commercialConfidence: number;
  advisoryOnly: true;
  source: "SITE_DECISION_SERVICE_STUB";
}

export interface OpportunityQuickQuote {
  candidateId: string;
  routeEngineeringMode: "COMMERCIAL_MODE_DRAFT_AUTHORITY";
  routeSource: "OSRM";
  selectedAttachment?: {
    id: string;
    type: string;
    routeId: string;
    routeName: string;
    stationId?: string;
    stationMeasureFeet?: number;
  };
  routeMiles: number;
  lateralFootage: number;
  osrmDistanceMeters: number;
  budgetCost: number;
  civilMix: {
    hddPercent: number;
    plowPercent: number;
    openCutPercent: number;
    label: string;
  };
  crossings: number;
  stationCount: number;
  svaScore: number;
  marginPercent: number;
  revenue: number;
  nrc: number;
  mrc: number;
  confidence: number;
  geometry: DALCoordinate[];
  assumptionsLabel: string;
  diagnostics: string[];
  advisoryOnly: true;
  noScopeVersionCreation: true;
  noInventoryMutation: true;
}

export interface OpportunityBrowserResult {
  resultId: string;
  title: string;
  summary: string;
  score: number;
  recommendedMode: OpportunityScoutDesignIntent;
  coordinate: DALCoordinate;
  nearestInventoryLabel: string;
  estimatedRouteMiles: number;
}

export interface OpportunityScoutAnalysisScope {
  selectedInventoryLayerIds?: string[];
}

const DODGE_CITY_CENTER: DALCoordinate = [-100.0171, 37.7528];
const MUSKOGEE_CENTER: DALCoordinate = [-95.3697, 35.7479];
const STILLWATER_CENTER: DALCoordinate = [-97.0584, 36.1156];
const KANSAS_CITY_CENTER: DALCoordinate = [-94.5786, 39.0997];
const HELIUM_CENTER: DALCoordinate = [-100.0507, 37.7852];

function round(value: number, places = 2) {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function stableHash(value: string) {
  return [...value].reduce((sum, char) => ((sum * 31) + char.charCodeAt(0)) >>> 0, 17);
}

function normalizeCoordinate(coordinate: DALCoordinate): DALCoordinate {
  return [Number(coordinate[0].toFixed(6)), Number(coordinate[1].toFixed(6))];
}

function coordinateKey(coordinate: DALCoordinate) {
  return `${coordinate[0].toFixed(5)}:${coordinate[1].toFixed(5)}`;
}

function distanceMiles(a: DALCoordinate, b: DALCoordinate) {
  const latAvgRadians = ((a[1] + b[1]) / 2) * Math.PI / 180;
  const milesPerLonDegree = 69.172 * Math.cos(latAvgRadians);
  const dx = (a[0] - b[0]) * milesPerLonDegree;
  const dy = (a[1] - b[1]) * 69.0;
  return Math.hypot(dx, dy);
}

function nearestItem<T>(
  items: T[],
  target: DALCoordinate,
  toCoordinate: (item: T) => DALCoordinate,
): { item: T; distanceFeet: number } | null {
  let best: { item: T; distanceFeet: number } | null = null;
  items.forEach((item) => {
    const distanceFeet = distanceMiles(target, toCoordinate(item)) * 5280;
    if (!best || distanceFeet < best.distanceFeet) best = { item, distanceFeet };
  });
  return best;
}

function nearestRoute(routes: CustomerTwinRoute[], target: DALCoordinate): { route: CustomerTwinRoute; coordinate: DALCoordinate; distanceFeet: number } | null {
  let best: { route: CustomerTwinRoute; coordinate: DALCoordinate; distanceFeet: number } | null = null;
  routes.forEach((route) => {
    route.coordinates.forEach((coordinate) => {
      const distanceFeet = distanceMiles(target, coordinate) * 5280;
      if (!best || distanceFeet < best.distanceFeet) best = { route, coordinate, distanceFeet };
    });
  });
  return best;
}

function routeToNearestItem(result: { route: CustomerTwinRoute; coordinate: DALCoordinate; distanceFeet: number } | null): OpportunityScoutNearestItem | null {
  if (!result) return null;
  return {
    id: result.route.routeId,
    label: result.route.routeName,
    type: "EXISTING_CORRIDOR",
    layerId: result.route.layerId,
    coordinate: result.coordinate,
    distanceFeet: Math.round(result.distanceFeet),
  };
}

function objectToNearestItem(result: { item: CustomerTwinObject; distanceFeet: number } | null): OpportunityScoutNearestItem | null {
  if (!result) return null;
  return {
    id: result.item.objectId,
    label: result.item.name,
    type: result.item.objectType,
    layerId: result.item.layerId,
    coordinate: result.item.coordinate,
    distanceFeet: Math.round(result.distanceFeet),
  };
}

function stationToNearestItem(result: { item: CustomerTwinStation; distanceFeet: number } | null): OpportunityScoutNearestItem | null {
  if (!result) return null;
  return {
    id: result.item.stationId,
    label: `${result.item.routeName} STA ${Math.round(result.item.cumulativeFeet).toLocaleString()}`,
    type: "STATION",
    layerId: result.item.layerId,
    coordinate: result.item.coordinate,
    distanceFeet: Math.round(result.distanceFeet),
  };
}

function chooseNearest(...items: Array<OpportunityScoutNearestItem | null>) {
  return items
    .filter((item): item is OpportunityScoutNearestItem => Boolean(item))
    .sort((a, b) => a.distanceFeet - b.distanceFeet)[0] ?? null;
}

function filteredTwinState(customerTwinState: CustomerTwinRenderableState | null, scope: OpportunityScoutAnalysisScope = {}) {
  const selectedLayerIds = new Set(scope.selectedInventoryLayerIds?.filter(Boolean) ?? []);
  const scoped = selectedLayerIds.size > 0;
  const inScope = (layerId: string) => !scoped || selectedLayerIds.has(layerId);
  return {
    routes: (customerTwinState?.routes ?? []).filter((route) => route.domain === "EXISTING_INVENTORY" && inScope(route.layerId)),
    objects: (customerTwinState?.objects ?? []).filter((object) => object.domain === "EXISTING_INVENTORY" && inScope(object.layerId)),
    stations: (customerTwinState?.stations ?? []).filter((station) => station.domain === "EXISTING_INVENTORY" && inScope(station.layerId)),
  };
}

export function deterministicGeocodeAddress(address: string): DALCoordinate {
  const normalized = address.trim().toLowerCase();
  if (normalized.includes("muskogee") || normalized.includes("mus")) return MUSKOGEE_CENTER;
  if (normalized.includes("stillwater")) return STILLWATER_CENTER;
  if (normalized.includes("kansas city")) return KANSAS_CITY_CENTER;
  if (normalized.includes("helium") || normalized.includes("hiu")) return HELIUM_CENTER;
  if (normalized.includes("dodge")) return DODGE_CITY_CENTER;
  const hash = stableHash(normalized || "opportunity");
  const lonOffset = ((hash % 1800) - 900) / 10000;
  const latOffset = (((hash >> 5) % 1200) - 600) / 10000;
  return normalizeCoordinate([DODGE_CITY_CENTER[0] + lonOffset, DODGE_CITY_CENTER[1] + latOffset]);
}

export function createResolvedLocation(args: {
  accountId: string;
  label: string;
  source: ResolvedLocationSource;
  coordinate: DALCoordinate;
  domain?: ResolvedLocationDomain;
  inputValue?: string;
  snappedRouteId?: string;
  snappedStationId?: string;
  snappedObjectId?: string;
  snappedNodeId?: string;
  nearestRouteId?: string;
  nearestStationId?: string;
  nearestObjectId?: string;
  confidence?: number;
}): ResolvedLocation {
  const coordinate = normalizeCoordinate(args.coordinate);
  return {
    id: `RESOLVED-${args.source}-${stableHash(`${args.accountId}:${args.label}:${coordinateKey(coordinate)}`)}-${Date.now()}`,
    label: args.label,
    source: args.source,
    inputValue: args.inputValue,
    latitude: coordinate[1],
    longitude: coordinate[0],
    accountId: args.accountId,
    domain: args.domain ?? "MAP_INPUT",
    snappedRouteId: args.snappedRouteId,
    snappedStationId: args.snappedStationId,
    snappedObjectId: args.snappedObjectId,
    snappedNodeId: args.snappedNodeId,
    nearestRouteId: args.nearestRouteId,
    nearestStationId: args.nearestStationId,
    nearestObjectId: args.nearestObjectId,
    confidence: args.confidence ?? 86,
  };
}

export function createMapResolvedLocation(accountId: string, coordinate: DALCoordinate, label = "Map Selected Site"): ResolvedLocation {
  return createResolvedLocation({
    accountId,
    label,
    source: "MAP_CLICK",
    coordinate,
    domain: "MAP_INPUT",
    confidence: 82,
  });
}

export function createAddressResolvedLocation(accountId: string, address: string): ResolvedLocation {
  return createResolvedLocation({
    accountId,
    label: address.trim(),
    source: "ADDRESS",
    inputValue: address.trim(),
    coordinate: deterministicGeocodeAddress(address),
    domain: "MAP_INPUT",
    confidence: 74,
  });
}

export function createLatLngResolvedLocation(accountId: string, lat: number, lng: number): ResolvedLocation {
  const coordinate = normalizeCoordinate([lng, lat]);
  return createResolvedLocation({
    accountId,
    label: `Lat/Lng ${lat.toFixed(5)}, ${lng.toFixed(5)}`,
    source: "LAT_LNG",
    inputValue: `${lat},${lng}`,
    coordinate,
    domain: "MAP_INPUT",
    confidence: 92,
  });
}

export function createObjectResolvedLocation(accountId: string, object: CustomerTwinObject): ResolvedLocation {
  const isPOP = object.objectType === "POP" || object.objectType === "FACILITY" || object.objectType === "CUSTOMER_FACILITY";
  const isBuilding = object.objectType === "BUILDING" || object.objectType === "CAMPUS";
  return createResolvedLocation({
    accountId,
    label: object.name,
    source: isPOP ? "CUSTOMER_POP" : isBuilding ? "CUSTOMER_BUILDING" : object.objectType === "SPLICE_CASE" ? "CUSTOMER_SPLICE_CASE" : "CUSTOMER_OBJECT",
    coordinate: object.coordinate,
    domain: object.domain === "CUSTOMER_PROPOSED" ? "CUSTOMER_PROPOSED" : "CUSTOMER_EXISTING",
    snappedObjectId: object.objectId,
    nearestObjectId: object.objectId,
    confidence: 96,
  });
}

export function createStationResolvedLocation(accountId: string, station: CustomerTwinStation): ResolvedLocation {
  return createResolvedLocation({
    accountId,
    label: `${station.routeName} STA ${Math.round(station.cumulativeFeet).toLocaleString()}`,
    source: "CUSTOMER_STATION",
    coordinate: station.coordinate,
    domain: station.domain === "CUSTOMER_PROPOSED" ? "CUSTOMER_PROPOSED" : "CUSTOMER_EXISTING",
    snappedStationId: station.stationId,
    snappedRouteId: station.routeId,
    nearestStationId: station.stationId,
    nearestRouteId: station.routeId,
    confidence: 95,
  });
}

export function createRouteResolvedLocation(accountId: string, route: CustomerTwinRoute): ResolvedLocation {
  const midpoint = route.coordinates[Math.floor(route.coordinates.length / 2)] ?? route.coordinates[0] ?? DODGE_CITY_CENTER;
  return createResolvedLocation({
    accountId,
    label: route.routeName,
    source: "CUSTOMER_ROUTE",
    coordinate: midpoint,
    domain: route.domain === "CUSTOMER_PROPOSED" ? "CUSTOMER_PROPOSED" : "CUSTOMER_EXISTING",
    snappedRouteId: route.routeId,
    nearestRouteId: route.routeId,
    confidence: 94,
  });
}

function endpointFromResolvedLocation(location: ResolvedLocation): OpportunityScoutEndpoint {
  return {
    label: location.label,
    coordinate: [location.longitude, location.latitude],
  };
}

export function createMapScoutCandidate(accountId: string, coordinate: DALCoordinate): OpportunityScoutCandidate {
  const normalized = normalizeCoordinate(coordinate);
  const resolvedLocation = createMapResolvedLocation(accountId, normalized);
  return {
    candidateId: `SCOUT-MAP-${coordinateKey(normalized)}-${Date.now()}`,
    accountId,
    mode: "CLICK_SITE",
    source: "MAP_CLICK",
    label: "Map Selected Site",
    coordinate: normalized,
    resolvedLocation,
    createdAt: new Date().toISOString(),
    lockedIntoCommercialDraft: false,
    noScopeVersionCreation: true,
    noInventoryMutation: true,
  };
}

export function createAddressScoutCandidate(accountId: string, address: string): OpportunityScoutCandidate {
  const resolvedLocation = createAddressResolvedLocation(accountId, address);
  const coordinate: DALCoordinate = [resolvedLocation.longitude, resolvedLocation.latitude];
  return {
    candidateId: `SCOUT-ADDRESS-${stableHash(address)}-${Date.now()}`,
    accountId,
    mode: "ADDRESS",
    source: "ADDRESS_GEOCODE",
    label: address.trim() || "Address Candidate",
    coordinate,
    resolvedLocation,
    createdAt: new Date().toISOString(),
    lockedIntoCommercialDraft: false,
    noScopeVersionCreation: true,
    noInventoryMutation: true,
  };
}

export function createLatLngScoutCandidate(accountId: string, lat: number, lng: number): OpportunityScoutCandidate {
  const resolvedLocation = createLatLngResolvedLocation(accountId, lat, lng);
  const coordinate: DALCoordinate = [resolvedLocation.longitude, resolvedLocation.latitude];
  return {
    candidateId: `SCOUT-LATLNG-${coordinateKey(coordinate)}-${Date.now()}`,
    accountId,
    mode: "LAT_LNG",
    source: "LAT_LNG",
    label: `Lat/Lng ${lat.toFixed(5)}, ${lng.toFixed(5)}`,
    coordinate,
    resolvedLocation,
    createdAt: new Date().toISOString(),
    lockedIntoCommercialDraft: false,
    noScopeVersionCreation: true,
    noInventoryMutation: true,
  };
}

export function createAzBuilderScoutCandidate(accountId: string, origin: string, destination: string): OpportunityScoutCandidate {
  const originLocation = createAddressResolvedLocation(accountId, origin);
  const destinationLocation = createAddressResolvedLocation(accountId, destination);
  return createAzBuilderScoutCandidateFromResolvedLocations(accountId, originLocation, destinationLocation);
}

export function createAzBuilderScoutCandidateFromResolvedLocations(
  accountId: string,
  originLocation: ResolvedLocation,
  destinationLocation: ResolvedLocation,
): OpportunityScoutCandidate {
  const originCoordinate: DALCoordinate = [originLocation.longitude, originLocation.latitude];
  const destinationCoordinate: DALCoordinate = [destinationLocation.longitude, destinationLocation.latitude];
  const midpoint: DALCoordinate = normalizeCoordinate([
    (originCoordinate[0] + destinationCoordinate[0]) / 2,
    (originCoordinate[1] + destinationCoordinate[1]) / 2,
  ]);
  const origin = endpointFromResolvedLocation(originLocation);
  const destination = endpointFromResolvedLocation(destinationLocation);
  return {
    candidateId: `SCOUT-AZ-${stableHash(`${originLocation.id}|${destinationLocation.id}`)}-${Date.now()}`,
    accountId,
    mode: "AZ_BUILDER",
    source: "AZ_BUILDER",
    label: `${origin.label} to ${destination.label}`,
    coordinate: midpoint,
    origin,
    destination,
    originLocation,
    destinationLocation,
    createdAt: new Date().toISOString(),
    lockedIntoCommercialDraft: false,
    noScopeVersionCreation: true,
    noInventoryMutation: true,
  };
}

export function createBrowserScoutCandidate(accountId: string, result: OpportunityBrowserResult): OpportunityScoutCandidate {
  return {
    candidateId: `SCOUT-BROWSER-${result.resultId}-${Date.now()}`,
    accountId,
    mode: result.recommendedMode === "NEW_INDEPENDENT_GRAPH" ? "CLICK_SITE" : "ADDRESS",
    source: "BROWSER_RESULT",
    label: result.title,
    coordinate: result.coordinate,
    createdAt: new Date().toISOString(),
    lockedIntoCommercialDraft: false,
    noScopeVersionCreation: true,
    noInventoryMutation: true,
  };
}

export function runOpportunityScoutSiteDecision(
  candidate: OpportunityScoutCandidate,
  customerTwinState: CustomerTwinRenderableState | null,
  scope: OpportunityScoutAnalysisScope = {},
): OpportunityScoutSiteDecision {
  const scopedTwin = filteredTwinState(customerTwinState, scope);
  const majorObjects = scopedTwin.objects.filter((object) => ["POP", "FACILITY", "CUSTOMER_FACILITY", "CAMPUS", "BUILDING"].includes(object.objectType));
  const spliceObjects = scopedTwin.objects.filter((object) => object.objectType === "SPLICE_CASE");
  const attachmentObjects = scopedTwin.objects.filter((object) => ["POP", "FACILITY", "CUSTOMER_FACILITY", "CAMPUS", "SPLICE_CASE", "HANDHOLE", "VAULT"].includes(object.objectType));
  const nearestMajorObject = objectToNearestItem(nearestItem(majorObjects, candidate.coordinate, (object) => object.coordinate));
  const nearestObject = objectToNearestItem(nearestItem(scopedTwin.objects, candidate.coordinate, (object) => object.coordinate));
  const nearestStation = stationToNearestItem(nearestItem(scopedTwin.stations, candidate.coordinate, (station) => station.coordinate));
  const nearestSplice = objectToNearestItem(nearestItem(spliceObjects, candidate.coordinate, (object) => object.coordinate));
  const nearestPOP = objectToNearestItem(nearestItem(majorObjects.filter((object) => ["POP", "FACILITY", "CUSTOMER_FACILITY", "CAMPUS"].includes(object.objectType)), candidate.coordinate, (object) => object.coordinate));
  const nearestAttachment = chooseNearest(
    objectToNearestItem(nearestItem(attachmentObjects, candidate.coordinate, (object) => object.coordinate)),
    nearestStation,
  );
  const nearestCorridor = routeToNearestItem(nearestRoute(scopedTwin.routes, candidate.coordinate));
  const nearestGraphNode = chooseNearest(nearestObject, nearestStation, nearestCorridor);
  const distanceFeet = chooseNearest(nearestAttachment, nearestCorridor)?.distanceFeet ?? null;
  const coordinateRiskHash = stableHash(`${candidate.coordinate[0].toFixed(4)}:${candidate.coordinate[1].toFixed(4)}`);
  const nearMiles = (distanceFeet ?? 15000) / 5280;
  const diversityScore = clamp(Math.round(88 - Math.min(nearMiles * 2.5, 22) + (nearestCorridor ? 4 : 0)), 45, 96);
  const expandability = clamp(Math.round(74 + Math.min(scopedTwin.routes.length * 2, 14) - Math.min(nearMiles * 1.5, 18)), 35, 94);
  const commercialConfidence = clamp(Math.round(92 - Math.min(nearMiles * 3.8, 34) + (nearestAttachment ? 6 : -8)), 32, 97);

  return {
    candidateId: candidate.candidateId,
    nearestInventory: nearestMajorObject,
    nearestGraphNode,
    nearestStation,
    nearestSplice,
    nearestPOP,
    nearestAttachment,
    nearestExistingCorridor: nearestCorridor,
    distanceFeet,
    power: nearestPOP && nearestPOP.distanceFeet < 7500 ? "High proximity to existing facility power context" : "Utility power screen required",
    floodplain: coordinateRiskHash % 7 === 0 ? "Flag for floodplain screen" : "No floodplain signal in advisory screen",
    rail: coordinateRiskHash % 5 === 0 ? "Rail proximity review likely" : "No rail conflict signal in advisory screen",
    parcel: coordinateRiskHash % 3 === 0 ? "Parcel ownership research required" : "Parcel screen clean enough for commercial review",
    environmental: coordinateRiskHash % 11 === 0 ? "Environmental desktop review required" : "No environmental blocker in advisory screen",
    utilityCorridor: nearestCorridor && nearestCorridor.distanceFeet < 3500 ? "Existing corridor adjacency" : "No existing utility corridor adjacency confirmed",
    diversityScore,
    expandability,
    commercialConfidence,
    advisoryOnly: true,
    source: "SITE_DECISION_SERVICE_STUB",
  };
}

export function runOpportunityQuickQuote(args: {
  candidate: OpportunityScoutCandidate;
  siteDecision: OpportunityScoutSiteDecision;
  routeResult: CommercialRouteResult | null;
  attachmentResolution?: AttachmentResolution | null;
  selectedAttachment?: AttachmentCandidate | null;
  assumptionState: BudgetAssumptionState;
}): OpportunityQuickQuote | null {
  if (args.routeResult?.status !== "ROUTED" || !args.routeResult.routeMiles || !args.routeResult.geometry?.length) return null;
  const geometry = args.routeResult.geometry.map((coordinate) => [coordinate.longitude, coordinate.latitude] as DALCoordinate);
  if (geometry.length < 2) return null;
  const routeMiles = round(args.routeResult.routeMiles, 2);
  const routeFeet = routeMiles * 5280;
  const civilMix = args.assumptionState.civilMix;
  const weightedUnitCost =
    (civilMix.plowPercent / 100) * 28 +
    (civilMix.hddPercent / 100) * 118 +
    (civilMix.openCutPercent / 100) * 76;
  const crossings = Math.max(1, Math.round(routeMiles / 8) + (args.siteDecision.rail.includes("likely") ? 1 : 0));
  const stationCount = Math.max(2, Math.ceil(routeFeet / 1000));
  const budgetCost = Math.round(routeFeet * weightedUnitCost + crossings * 68000 + stationCount * 1800);
  const attachmentConfidence = args.selectedAttachment?.confidence ?? args.attachmentResolution?.recommendedAttachment?.confidence ?? 82;
  const confidence = clamp(Math.round((args.siteDecision.commercialConfidence * 0.45) + (args.siteDecision.diversityScore * 0.16) + (attachmentConfidence * 0.24) + 12), 25, 98);
  const svaScore = clamp(Math.round((args.siteDecision.expandability * 0.45) + (args.siteDecision.diversityScore * 0.35) + (confidence * 0.2)), 20, 98);
  const revenue = Math.round(budgetCost * (1.35 + Math.max(0, svaScore - 70) / 200));
  const marginPercent = round(((revenue - budgetCost) / Math.max(revenue, 1)) * 100, 1);
  const selectedAttachment = args.selectedAttachment ?? args.attachmentResolution?.recommendedAttachment;

  return {
    candidateId: args.candidate.candidateId,
    routeEngineeringMode: "COMMERCIAL_MODE_DRAFT_AUTHORITY",
    routeSource: "OSRM",
    selectedAttachment: selectedAttachment ? {
      id: selectedAttachment.id,
      type: selectedAttachment.attachmentType,
      routeId: selectedAttachment.routeId,
      routeName: selectedAttachment.routeName,
      stationId: selectedAttachment.stationId,
      stationMeasureFeet: selectedAttachment.stationMeasureFeet,
    } : undefined,
    routeMiles,
    lateralFootage: Math.round(routeFeet),
    osrmDistanceMeters: args.routeResult.osrmDistanceMeters ?? Math.round(routeFeet / 3.28084),
    budgetCost,
    civilMix: {
      ...civilMix,
      label: `${civilMix.plowPercent}% plow / ${civilMix.hddPercent}% bore / ${civilMix.openCutPercent}% open cut`,
    },
    crossings,
    stationCount,
    svaScore,
    marginPercent,
    revenue,
    nrc: revenue,
    mrc: Math.round(revenue * 0.014),
    confidence,
    geometry,
    assumptionsLabel: `${args.assumptionState.label} / OSRM routed geometry`,
    diagnostics: [
      "Quick Quote mileage, stationing, and budget use OSRM route geometry only.",
      ...(selectedAttachment ? [`Selected attachment: ${selectedAttachment.routeName}${selectedAttachment.stationId ? ` / ${selectedAttachment.stationId}` : ""}.`] : ["Independent A/Z route used no Customer Twin attachment."]),
      ...args.routeResult.diagnostics,
    ],
    advisoryOnly: true,
    noScopeVersionCreation: true,
    noInventoryMutation: true,
  };
}

export function searchOpportunityBrowser(
  query: string,
  customerTwinState: CustomerTwinRenderableState | null,
  scope: OpportunityScoutAnalysisScope = {},
): OpportunityBrowserResult[] {
  const scopedTwin = filteredTwinState(customerTwinState, scope);
  const normalizedQuery = query.trim().toLowerCase();
  const priorityObjects = scopedTwin.objects
    .filter((object) => ["POP", "FACILITY", "CUSTOMER_FACILITY", "CAMPUS", "BUILDING", "SPLICE_CASE"].includes(object.objectType))
    .slice(0, 10);
  const routeSeeds = scopedTwin.routes.slice(0, 6).map((route) => ({
    objectId: route.routeId,
    name: route.routeName,
    objectType: "ROUTE",
    coordinate: route.coordinates[Math.floor(route.coordinates.length / 2)] ?? DODGE_CITY_CENTER,
    layerId: route.layerId,
  }));
  const seeds = [...priorityObjects, ...routeSeeds];

  if (!seeds.length) {
    return [{
      resultId: "SCOUT-FALLBACK-DODGE",
      title: "New independent corridor near Dodge City",
      summary: "No active inventory candidates are visible, so Scout is offering an independent graph seed.",
      score: 62,
      recommendedMode: "NEW_INDEPENDENT_GRAPH",
      coordinate: DODGE_CITY_CENTER,
      nearestInventoryLabel: "No selected inventory",
      estimatedRouteMiles: 1,
    }];
  }

  return seeds
    .map((seed, index) => {
      const queryBoost = normalizedQuery && `${seed.name} ${seed.objectType}`.toLowerCase().includes(normalizedQuery) ? 12 : 0;
      const routeProximity = nearestRoute(scopedTwin.routes, seed.coordinate);
      const estimatedRouteMiles = round(Math.max(0.4, (routeProximity?.distanceFeet ?? 4000) / 5280 + 0.7), 2);
      const score = clamp(88 - index * 4 + queryBoost - Math.min(estimatedRouteMiles * 1.6, 12), 35, 98);
      return {
        resultId: `SCOUT-BROWSER-${seed.objectId}`,
        title: seed.objectType === "ROUTE" ? `Corridor adjacency: ${seed.name}` : `Site candidate near ${seed.name}`,
        summary: seed.objectType === "ROUTE"
          ? "Extend from an active existing corridor reference with commercial draft authority."
          : `Analyze ${seed.objectType.replaceAll("_", " ").toLowerCase()} proximity, laterals, and commercial confidence.`,
        score: Math.round(score),
        recommendedMode: seed.objectType === "ROUTE" ? "EXTEND_EXISTING_NETWORK" : "EXTEND_EXISTING_NETWORK",
        coordinate: seed.coordinate,
        nearestInventoryLabel: seed.name,
        estimatedRouteMiles,
      } satisfies OpportunityBrowserResult;
    })
    .sort((a, b) => b.score - a.score);
}
