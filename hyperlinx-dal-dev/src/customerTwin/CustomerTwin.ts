import type { DALCoordinate, TwinGraphContext, TwinProjectionMetrics } from "../types/dal";
import type {
  CustomerInventoryFeatureType,
  CustomerInventoryLayer,
  CustomerNetworkGraph,
  CustomerNetworkObject,
  CustomerNetworkRoute,
  CustomerNetworkStation,
} from "../customerInventory/CustomerNetworkInventory";

export type CustomerTwinDomain =
  | "EXISTING_INVENTORY"
  | "CUSTOMER_PROPOSED"
  | "SALES_COMMERCIAL_DRAFT"
  | "CUSTOMER_DRAFT"
  | "SHARED_REVIEW";

export type CustomerTwinAuthority =
  | "Customer / Inventory"
  | "Customer"
  | "Sales"
  | "Commercial Review";

export type CustomerTwinDomainState = "CURRENT" | "PLANNED" | "DRAFT" | "REVIEW";
export type CustomerTwinRouteUse = "ATTACHMENT_CANDIDATE" | "DIVERSITY_CONSTRAINT" | "AVOIDANCE_CONSTRAINT" | "REFERENCE_ONLY";
export type CustomerTwinObjectType = CustomerInventoryFeatureType;

export interface CustomerTwinRoute {
  routeId: string;
  accountId: string;
  layerId: string;
  routeName: string;
  domain: CustomerTwinDomain;
  authority: CustomerTwinAuthority;
  state: CustomerTwinDomainState;
  routeUse: CustomerTwinRouteUse;
  coordinates: DALCoordinate[];
  routeMiles: number;
  locked: boolean;
  provenance: string;
  stationIds: string[];
}

export interface CustomerTwinObject {
  objectId: string;
  accountId: string;
  layerId: string;
  name: string;
  objectType: CustomerTwinObjectType;
  domain: CustomerTwinDomain;
  authority: CustomerTwinAuthority;
  state: CustomerTwinDomainState;
  coordinate: DALCoordinate;
  locked: boolean;
  provenance: string;
  nearestRouteId?: string;
  nearestStationId?: string;
}

export interface CustomerTwinStation {
  stationId: string;
  accountId: string;
  layerId: string;
  routeId: string;
  routeName: string;
  domain: CustomerTwinDomain;
  authority: CustomerTwinAuthority;
  state: CustomerTwinDomainState;
  coordinate: DALCoordinate;
  cumulativeFeet: number;
  stationIndex: number;
  locked: boolean;
}

export interface CustomerTwinLayer {
  layerId: string;
  accountId: string;
  label: string;
  sourceAssetName: string;
  source: "Customer Twin";
  provenance: string;
  domain: CustomerTwinDomain;
  authority: CustomerTwinAuthority;
  state: CustomerTwinDomainState;
  locked: boolean;
  visibleByDefault: boolean;
  routeUse: CustomerTwinRouteUse;
  routeMiles: number;
  routeCount: number;
  objectCount: number;
  stationCount: number;
  routes: CustomerTwinRoute[];
  objects: CustomerTwinObject[];
  stations: CustomerTwinStation[];
}

export interface CustomerTwinRenderableState {
  customerTwinId: string;
  accountId: string;
  generatedAt: string;
  graphContext: TwinGraphContext;
  layers: CustomerTwinLayer[];
  routes: CustomerTwinRoute[];
  objects: CustomerTwinObject[];
  stations: CustomerTwinStation[];
  metrics: TwinProjectionMetrics;
  provenance: string[];
}

export interface CustomerTwinState {
  customerTwinId: string;
  accountId: string;
  sourceGraphId: string;
  inventorySessionVersion: string;
  synchronizedAt: string;
  frozenAt: string;
  graphContext: TwinGraphContext;
  layers: CustomerTwinLayer[];
  routes: CustomerTwinRoute[];
  objects: CustomerTwinObject[];
  stations: CustomerTwinStation[];
  metrics: TwinProjectionMetrics;
  provenance: string[];
  operationalAuthority: "PRE_KERNEL_CUSTOMER_TWIN";
}

export interface CustomerTwinDomainFilters {
  domains?: CustomerTwinDomain[];
  routeUsesByLayerId?: Record<string, CustomerTwinRouteUse>;
}

export interface CustomerTwinNearestResult<T> {
  item: T | null;
  distanceScore: number;
}

export interface CustomerTwinSharedCorridorResult {
  candidateCoordinateCount: number;
  nearestAttachmentRoute: CustomerTwinRoute | null;
  nearestAttachmentStation: CustomerTwinStation | null;
  nearestAttachmentObject: CustomerTwinObject | null;
  relationship: "ATTACHED" | "NEAR_EXISTING_NETWORK" | "INDEPENDENT";
}

export interface CustomerTwinDiversityResult {
  constraintRouteCount: number;
  avoidanceRouteCount: number;
  nearestConstraintRoute: CustomerTwinRoute | null;
  diversityStatus: "DIVERSE_REVIEW_REQUIRED" | "NO_CONSTRAINTS_SELECTED" | "REFERENCE_ONLY";
}

function domainFromAuthorityState(authorityState: CustomerNetworkRoute["authorityState"]): CustomerTwinDomain {
  if (authorityState === "CUSTOMER_PROPOSED_NETWORK") return "CUSTOMER_PROPOSED";
  if (authorityState === "COMMERCIAL_DRAFT") return "SALES_COMMERCIAL_DRAFT";
  if (authorityState === "CUSTOMER_DRAFT") return "CUSTOMER_DRAFT";
  if (authorityState === "ACCEPTED_PROPOSAL") return "SHARED_REVIEW";
  return "EXISTING_INVENTORY";
}

function authorityForDomain(domain: CustomerTwinDomain): CustomerTwinAuthority {
  if (domain === "EXISTING_INVENTORY") return "Customer / Inventory";
  if (domain === "CUSTOMER_PROPOSED" || domain === "CUSTOMER_DRAFT") return "Customer";
  if (domain === "SALES_COMMERCIAL_DRAFT") return "Sales";
  return "Commercial Review";
}

function stateForDomain(domain: CustomerTwinDomain): CustomerTwinDomainState {
  if (domain === "EXISTING_INVENTORY") return "CURRENT";
  if (domain === "CUSTOMER_PROPOSED") return "PLANNED";
  if (domain === "SHARED_REVIEW") return "REVIEW";
  return "DRAFT";
}

function defaultRouteUse(layer: CustomerInventoryLayer, domain: CustomerTwinDomain): CustomerTwinRouteUse {
  if (domain !== "EXISTING_INVENTORY") return "REFERENCE_ONLY";
  return layer.useAsDiversityConstraintByDefault ? "DIVERSITY_CONSTRAINT" : "ATTACHMENT_CANDIDATE";
}

function distanceScore(a: DALCoordinate, b: DALCoordinate) {
  const lng = a[0] - b[0];
  const lat = a[1] - b[1];
  return lng * lng + lat * lat;
}

function nearestCoordinateOnRoute(point: DALCoordinate, route: CustomerTwinRoute) {
  return route.coordinates.reduce(
    (best, coordinate) => {
      const score = distanceScore(point, coordinate);
      return score < best.score ? { coordinate, score } : best;
    },
    { coordinate: route.coordinates[0] ?? point, score: Number.POSITIVE_INFINITY },
  );
}

function nearestByCoordinate<T>(items: T[], point: DALCoordinate, coordinateFor: (item: T) => DALCoordinate): CustomerTwinNearestResult<T> {
  return items.reduce<CustomerTwinNearestResult<T>>(
    (best, item) => {
      const score = distanceScore(point, coordinateFor(item));
      return score < best.distanceScore ? { item, distanceScore: score } : best;
    },
    { item: null, distanceScore: Number.POSITIVE_INFINITY },
  );
}

function routeWithRole(route: CustomerTwinRoute, routeUsesByLayerId?: Record<string, CustomerTwinRouteUse>) {
  const routeUse = routeUsesByLayerId?.[route.layerId] ?? route.routeUse;
  return route.routeUse === routeUse ? route : { ...route, routeUse };
}

function layerWithRole(layer: CustomerTwinLayer, routeUsesByLayerId?: Record<string, CustomerTwinRouteUse>): CustomerTwinLayer {
  const routeUse = routeUsesByLayerId?.[layer.layerId] ?? layer.routeUse;
  return {
    ...layer,
    routeUse,
    routes: layer.routes.map((route) => routeWithRole(route, routeUsesByLayerId)),
  };
}

export function buildCustomerTwinFromNetworkGraph(graph: CustomerNetworkGraph | null | undefined): CustomerTwinState | null {
  if (!graph) return null;
  const routesByLayer = new Map<string, CustomerTwinRoute[]>();
  const objectsByLayer = new Map<string, CustomerTwinObject[]>();
  const stationsByLayer = new Map<string, CustomerTwinStation[]>();

  const layerById = new Map(graph.layers.map((layer) => [layer.layerId, layer]));

  const routes = graph.routes.map<CustomerTwinRoute>((route) => {
    const layer = layerById.get(route.layerId);
    const domain = domainFromAuthorityState(route.authorityState);
    const authority = authorityForDomain(domain);
    const state = stateForDomain(domain);
    const twinRoute: CustomerTwinRoute = {
      routeId: route.routeId,
      accountId: route.accountId,
      layerId: route.layerId,
      routeName: route.routeName,
      domain,
      authority,
      state,
      routeUse: layer ? defaultRouteUse(layer, domain) : "REFERENCE_ONLY",
      coordinates: route.displayCoordinates,
      routeMiles: route.routeMiles,
      locked: true,
      provenance: route.provenance,
      stationIds: route.stationIds,
    };
    routesByLayer.set(route.layerId, [...(routesByLayer.get(route.layerId) ?? []), twinRoute]);
    return twinRoute;
  });

  const objects = graph.objects.map<CustomerTwinObject>((object: CustomerNetworkObject) => {
    const domain = domainFromAuthorityState(object.authorityState);
    const twinObject: CustomerTwinObject = {
      objectId: object.objectId,
      accountId: object.accountId,
      layerId: object.layerId,
      name: object.name,
      objectType: object.objectType,
      domain,
      authority: authorityForDomain(domain),
      state: stateForDomain(domain),
      coordinate: object.coordinate,
      locked: true,
      provenance: object.sourceKmz,
      nearestRouteId: object.nearestRouteId,
      nearestStationId: object.nearestStationId,
    };
    objectsByLayer.set(object.layerId, [...(objectsByLayer.get(object.layerId) ?? []), twinObject]);
    return twinObject;
  });

  const stations = graph.stations.map<CustomerTwinStation>((station: CustomerNetworkStation) => {
    const route = graph.routes.find((item) => item.routeId === station.routeId);
    const domain = domainFromAuthorityState(route?.authorityState ?? "EXISTING_NETWORK");
    const twinStation: CustomerTwinStation = {
      stationId: station.stationId,
      accountId: station.accountId,
      layerId: station.layerId,
      routeId: station.routeId,
      routeName: station.routeName,
      domain,
      authority: authorityForDomain(domain),
      state: stateForDomain(domain),
      coordinate: station.coordinate,
      cumulativeFeet: station.cumulativeFeet,
      stationIndex: station.stationIndex,
      locked: true,
    };
    stationsByLayer.set(station.layerId, [...(stationsByLayer.get(station.layerId) ?? []), twinStation]);
    return twinStation;
  });

  const layers = graph.layers.map<CustomerTwinLayer>((layer) => {
    const domain = domainFromAuthorityState(layer.authorityState);
    const layerRoutes = routesByLayer.get(layer.layerId) ?? [];
    const layerObjects = objectsByLayer.get(layer.layerId) ?? [];
    const layerStations = stationsByLayer.get(layer.layerId) ?? [];
    return {
      layerId: layer.layerId,
      accountId: layer.accountId,
      label: layer.networkName,
      sourceAssetName: layer.sourceAssetName,
      source: "Customer Twin",
      provenance: layer.sourceAssetName,
      domain,
      authority: authorityForDomain(domain),
      state: stateForDomain(domain),
      locked: true,
      visibleByDefault: domain === "EXISTING_INVENTORY",
      routeUse: defaultRouteUse(layer, domain),
      routeMiles: layer.routeMiles,
      routeCount: layer.routeLineCount,
      objectCount: layer.objectCount,
      stationCount: layer.stationCount,
      routes: layerRoutes,
      objects: layerObjects,
      stations: layerStations,
    };
  });

  const metrics: TwinProjectionMetrics = {
    openWorkItems: 0,
    completedWorkItems: 0,
    activeWorkItems: 0,
    pendingWorkItems: 0,
    cancelledWorkItems: 0,
    closureCount: 0,
    totalFeet: graph.summary.routeMiles * 5280,
    completedFeet: 0,
    plannedAssets: routes.length + objects.length + stations.length,
    completedAssets: 0,
    verifiedAssets: 0,
    percentComplete: 0,
    completionAuthority: "SCOPEVERSION_STATE",
  };

  return {
    customerTwinId: `CUSTOMER-TWIN-${graph.accountId}-${graph.inventorySessionVersion}`,
    accountId: graph.accountId,
    sourceGraphId: graph.graphId,
    inventorySessionVersion: graph.inventorySessionVersion,
    synchronizedAt: graph.synchronizedAt,
    frozenAt: graph.frozenAt,
    graphContext: {
      inventoryId: graph.graphId,
      graphId: graph.graphId,
      graphVersion: graph.inventorySessionVersion,
      matched: true,
    },
    layers,
    routes,
    objects,
    stations,
    metrics,
    provenance: graph.provenance,
    operationalAuthority: "PRE_KERNEL_CUSTOMER_TWIN",
  };
}

export function createCustomerTwinService(twin: CustomerTwinState | null | undefined) {
  const empty: CustomerTwinRenderableState = {
    customerTwinId: "CUSTOMER-TWIN-NONE",
    accountId: "",
    generatedAt: new Date().toISOString(),
    graphContext: {},
    layers: [],
    routes: [],
    objects: [],
    stations: [],
    metrics: {
      openWorkItems: 0,
      completedWorkItems: 0,
      activeWorkItems: 0,
      pendingWorkItems: 0,
      cancelledWorkItems: 0,
      closureCount: 0,
      completedFeet: 0,
      routeProgress: [],
    } as TwinProjectionMetrics,
    provenance: [],
  };

  function scoped(accountId: string) {
    if (!twin || twin.accountId !== accountId) return empty;
    return getRenderableTwinState(accountId);
  }

  function getRenderableTwinState(accountId: string, filters: CustomerTwinDomainFilters = {}): CustomerTwinRenderableState {
    if (!twin || twin.accountId !== accountId) return empty;
    const domains = new Set<CustomerTwinDomain>(filters.domains ?? ["EXISTING_INVENTORY", "CUSTOMER_PROPOSED", "SALES_COMMERCIAL_DRAFT", "CUSTOMER_DRAFT", "SHARED_REVIEW"]);
    const layers = twin.layers
      .filter((layer) => domains.has(layer.domain))
      .map((layer) => layerWithRole(layer, filters.routeUsesByLayerId));
    return {
      customerTwinId: twin.customerTwinId,
      accountId: twin.accountId,
      generatedAt: new Date().toISOString(),
      graphContext: twin.graphContext,
      layers,
      routes: layers.flatMap((layer) => layer.routes),
      objects: layers.flatMap((layer) => layer.objects),
      stations: layers.flatMap((layer) => layer.stations),
      metrics: twin.metrics,
      provenance: twin.provenance,
    };
  }

  function getExistingRoutes(accountId: string) {
    return scoped(accountId).routes.filter((route) => route.domain === "EXISTING_INVENTORY");
  }

  function getCustomerProposedRoutes(accountId: string) {
    return scoped(accountId).routes.filter((route) => route.domain === "CUSTOMER_PROPOSED");
  }

  function getObjects(accountId: string) {
    return scoped(accountId).objects;
  }

  function getStations(accountId: string) {
    return scoped(accountId).stations;
  }

  function getAvailableAttachmentPoints(accountId: string) {
    const renderable = scoped(accountId);
    const popObjects = renderable.objects.filter((object) => ["POP", "FACILITY", "CUSTOMER_FACILITY", "CAMPUS"].includes(object.objectType));
    const attachmentStations = renderable.stations.filter((station) => {
      const route = renderable.routes.find((item) => item.routeId === station.routeId);
      return route?.routeUse === "ATTACHMENT_CANDIDATE";
    });
    return { objects: popObjects, stations: attachmentStations };
  }

  function findNearestRoute(point: DALCoordinate, accountId = twin?.accountId ?? ""): CustomerTwinNearestResult<CustomerTwinRoute> {
    const routes = scoped(accountId).routes;
    return routes.reduce<CustomerTwinNearestResult<CustomerTwinRoute>>((best, route) => {
      const nearest = nearestCoordinateOnRoute(point, route);
      return nearest.score < best.distanceScore ? { item: route, distanceScore: nearest.score } : best;
    }, { item: null, distanceScore: Number.POSITIVE_INFINITY });
  }

  function findNearestStation(point: DALCoordinate, accountId = twin?.accountId ?? "") {
    return nearestByCoordinate(scoped(accountId).stations, point, (station) => station.coordinate);
  }

  function findNearestObject(point: DALCoordinate, accountId = twin?.accountId ?? "") {
    return nearestByCoordinate(scoped(accountId).objects, point, (object) => object.coordinate);
  }

  function findNearestSplice(point: DALCoordinate, accountId = twin?.accountId ?? "") {
    return nearestByCoordinate(
      scoped(accountId).objects.filter((object) => object.objectType === "SPLICE_CASE"),
      point,
      (object) => object.coordinate,
    );
  }

  function findNearestPOP(point: DALCoordinate, accountId = twin?.accountId ?? "") {
    return nearestByCoordinate(
      scoped(accountId).objects.filter((object) => ["POP", "FACILITY", "CUSTOMER_FACILITY"].includes(object.objectType)),
      point,
      (object) => object.coordinate,
    );
  }

  function calculateSharedCorridor(candidateRoute: DALCoordinate[], accountId = twin?.accountId ?? ""): CustomerTwinSharedCorridorResult {
    const midpoint = candidateRoute[Math.floor(candidateRoute.length / 2)] ?? candidateRoute[0] ?? [-97.7431, 30.2672];
    const nearestAttachmentRoute = findNearestRoute(midpoint, accountId).item;
    const nearestAttachmentStation = findNearestStation(midpoint, accountId).item;
    const nearestAttachmentObject = findNearestObject(midpoint, accountId).item;
    return {
      candidateCoordinateCount: candidateRoute.length,
      nearestAttachmentRoute,
      nearestAttachmentStation,
      nearestAttachmentObject,
      relationship: nearestAttachmentRoute?.routeUse === "ATTACHMENT_CANDIDATE" ? "ATTACHED" : nearestAttachmentRoute ? "NEAR_EXISTING_NETWORK" : "INDEPENDENT",
    };
  }

  function calculateDiversity(candidateRoute: DALCoordinate[], accountId = twin?.accountId ?? ""): CustomerTwinDiversityResult {
    const renderable = scoped(accountId);
    const constraintRoutes = renderable.routes.filter((route) => route.routeUse === "DIVERSITY_CONSTRAINT");
    const avoidanceRoutes = renderable.routes.filter((route) => route.routeUse === "AVOIDANCE_CONSTRAINT");
    const midpoint = candidateRoute[Math.floor(candidateRoute.length / 2)] ?? candidateRoute[0] ?? [-97.7431, 30.2672];
    const nearestConstraintRoute = constraintRoutes.reduce<CustomerTwinNearestResult<CustomerTwinRoute>>((best, route) => {
      const nearest = nearestCoordinateOnRoute(midpoint, route);
      return nearest.score < best.distanceScore ? { item: route, distanceScore: nearest.score } : best;
    }, { item: null, distanceScore: Number.POSITIVE_INFINITY }).item;
    return {
      constraintRouteCount: constraintRoutes.length,
      avoidanceRouteCount: avoidanceRoutes.length,
      nearestConstraintRoute,
      diversityStatus: constraintRoutes.length || avoidanceRoutes.length ? "DIVERSE_REVIEW_REQUIRED" : renderable.routes.length ? "REFERENCE_ONLY" : "NO_CONSTRAINTS_SELECTED",
    };
  }

  return {
    getExistingRoutes,
    getCustomerProposedRoutes,
    getObjects,
    getStations,
    getAvailableAttachmentPoints,
    findNearestRoute,
    findNearestStation,
    findNearestObject,
    findNearestSplice,
    findNearestPOP,
    calculateSharedCorridor,
    calculateDiversity,
    getRenderableTwinState,
  };
}
