import { haversineFeet } from "../affinity/geo";
import type { DesignLaunchSession } from "../design/DesignLaunchSession";
import { resolveDesignDoctrineForSession } from "../designDoctrine/DesignDoctrineEngine";
import type { NetworkClass } from "../designDoctrine/NetworkClass";
import { generateRouteCandidate } from "../routeGeneration/RouteGenerationEngine";
import type { RouteConstructionMethod } from "../routeGeneration/RouteSegment";
import { routeInventoryExtensionViaOsrm } from "../routing/OsrmLateralRouter";
import type { TeralinxPrimaryProduct } from "../teralinx/TeralinxDesignIntent";
import type { TeralinxSite } from "../teralinx/TeralinxRouteRequest";
import type { DALCoordinate } from "../types/dal";
import type { CenterlineRoute, CenterlineRouteDiagnostic, CenterlineRouteSite, CenterlineRouteStatus } from "./CenterlineRoute";
import type { CorridorInventoryObject, CorridorInventoryObjectType } from "./CorridorInventoryObject";
import type { CorridorSegment } from "./CorridorSegment";
import type { CorridorStation } from "./CorridorStation";
import type { CorridorTakeoff } from "./CorridorTakeoff";
import type { StationedCorridor } from "./StationedCorridor";

type ResolvedSite = CenterlineRouteSite & {
  coordinate: DALCoordinate;
  confidence: number;
  method: "INPUT_COORDINATE" | "FIXTURE_ADDRESS_LOOKUP" | "DETERMINISTIC_TEXT_FALLBACK";
};

const KNOWN_COORDINATES: Array<{ tokens: string[]; coordinate: DALCoordinate; confidence: number }> = [
  { tokens: ["dallas", "stemmons"], coordinate: [-96.8385, 32.8065], confidence: 88 },
  { tokens: ["dallas"], coordinate: [-96.797, 32.7767], confidence: 82 },
  { tokens: ["temple"], coordinate: [-97.3428, 31.0256], confidence: 84 },
  { tokens: ["austin pop"], coordinate: [-97.7431, 30.2672], confidence: 92 },
  { tokens: ["611 walker", "austin"], coordinate: [-97.7278, 30.2609], confidence: 72 },
  { tokens: ["downtown austin"], coordinate: [-97.7392, 30.2655], confidence: 80 },
  { tokens: ["austin"], coordinate: [-97.7431, 30.2672], confidence: 82 },
  { tokens: ["wichita falls"], coordinate: [-98.4934, 33.9137], confidence: 84 },
  { tokens: ["lawton"], coordinate: [-98.3959, 34.6087], confidence: 84 },
];

function now() {
  return new Date().toISOString();
}

function diagnostic(
  centerlineRouteId: string,
  code: CenterlineRouteDiagnostic["code"],
  severity: CenterlineRouteDiagnostic["severity"],
  message: string,
  details?: Record<string, unknown>,
): CenterlineRouteDiagnostic {
  const entry: CenterlineRouteDiagnostic = {
    diagnosticId: `${centerlineRouteId}:${code}:${Date.now()}`,
    code,
    severity,
    message,
    timestamp: now(),
    details,
  };
  console.info(`[${code}]`, entry);
  return entry;
}

function textHash(text: string) {
  return [...text].reduce((sum, char) => sum + char.charCodeAt(0), 0);
}

function addOffset(coordinate: DALCoordinate, lonOffset: number, latOffset: number): DALCoordinate {
  return [Number((coordinate[0] + lonOffset).toFixed(6)), Number((coordinate[1] + latOffset).toFixed(6))];
}

function siteText(site: TeralinxSite) {
  return `${site.facilityName ?? ""} ${site.address ?? ""}`.trim().toLowerCase();
}

function resolveSite(site: TeralinxSite | undefined, fallbackIndex: number): ResolvedSite {
  const safeSite = site ?? {
    siteId: `MISSING-SITE-${fallbackIndex}`,
    role: fallbackIndex === 0 ? "A_SITE" : "Z_SITE",
    facilityName: fallbackIndex === 0 ? "A Site" : "Z Site",
  };

  if (Number.isFinite(safeSite.latitude) && Number.isFinite(safeSite.longitude)) {
    return {
      siteId: safeSite.siteId,
      role: safeSite.role,
      facilityName: safeSite.facilityName,
      address: safeSite.address,
      coordinate: [Number(safeSite.longitude), Number(safeSite.latitude)],
      confidence: 96,
      method: "INPUT_COORDINATE",
    };
  }

  const text = siteText(safeSite);
  const match = KNOWN_COORDINATES.find((item) => item.tokens.every((token) => text.includes(token)));
  if (match) {
    return {
      siteId: safeSite.siteId,
      role: safeSite.role,
      facilityName: safeSite.facilityName,
      address: safeSite.address,
      coordinate: match.coordinate,
      confidence: match.confidence,
      method: "FIXTURE_ADDRESS_LOOKUP",
    };
  }

  const hash = textHash(text || safeSite.siteId);
  const base: DALCoordinate = [-97.4, 31.8];
  const lonOffset = ((hash % 120) - 60) / 100;
  const latOffset = (((hash / 7) % 90) - 45) / 100;
  return {
    siteId: safeSite.siteId,
    role: safeSite.role,
    facilityName: safeSite.facilityName,
    address: safeSite.address,
    coordinate: addOffset(base, lonOffset + fallbackIndex * 0.35, latOffset - fallbackIndex * 0.2),
    confidence: 42,
    method: "DETERMINISTIC_TEXT_FALLBACK",
  };
}

function centerlineSite(site: ResolvedSite): CenterlineRouteSite {
  return {
    siteId: site.siteId,
    role: site.role,
    facilityName: site.facilityName,
    address: site.address,
    coordinate: site.coordinate,
  };
}

function routeLengthFeet(geometry: DALCoordinate[]) {
  let feet = 0;
  for (let index = 1; index < geometry.length; index += 1) feet += haversineFeet(geometry[index - 1], geometry[index]);
  return Math.round(feet);
}

function coordinateAtDistance(geometry: DALCoordinate[], distanceFeet: number): DALCoordinate {
  if (!geometry.length) return [0, 0];
  if (distanceFeet <= 0) return geometry[0];
  let walked = 0;
  for (let index = 1; index < geometry.length; index += 1) {
    const start = geometry[index - 1];
    const end = geometry[index];
    const segmentFeet = haversineFeet(start, end);
    if (walked + segmentFeet >= distanceFeet) {
      const ratio = segmentFeet === 0 ? 0 : (distanceFeet - walked) / segmentFeet;
      return [
        Number((start[0] + (end[0] - start[0]) * ratio).toFixed(6)),
        Number((start[1] + (end[1] - start[1]) * ratio).toFixed(6)),
      ];
    }
    walked += segmentFeet;
  }
  return geometry[geometry.length - 1];
}

function geometryBetweenDistances(geometry: DALCoordinate[], startFeet: number, endFeet: number): DALCoordinate[] {
  if (geometry.length < 2) return geometry;
  const start = coordinateAtDistance(geometry, startFeet);
  const end = coordinateAtDistance(geometry, endFeet);
  const points: DALCoordinate[] = [start];
  let walked = 0;
  for (let index = 1; index < geometry.length - 1; index += 1) {
    walked += haversineFeet(geometry[index - 1], geometry[index]);
    if (walked > startFeet && walked < endFeet) points.push(geometry[index]);
  }
  points.push(end);
  return points;
}

function stationLabel(feet: number) {
  const rounded = Math.round(feet);
  const thousands = Math.floor(rounded / 1000);
  const remainder = rounded % 1000;
  return `STA ${thousands}+${remainder.toString().padStart(3, "0")}`;
}

function stationSpacingFeet(networkClass: NetworkClass) {
  if (networkClass === "CAMPUS") return 250;
  if (networkClass === "METRO") return 500;
  if (networkClass === "MIDDLE_MILE") return 1000;
  return 2500;
}

function constructionMethod(networkClass: NetworkClass): RouteConstructionMethod {
  if (networkClass === "LONG_HAUL") return "BURIED_BACKBONE";
  if (networkClass === "MIDDLE_MILE") return "BURIED_MIDDLE_MILE";
  if (networkClass === "CAMPUS") return "CAMPUS_DUCT";
  return "URBAN_UNDERGROUND";
}

function estimatedCostPerFoot(method: RouteConstructionMethod) {
  if (method === "URBAN_UNDERGROUND") return 58;
  if (method === "CAMPUS_DUCT") return 74;
  if (method === "BURIED_MIDDLE_MILE") return 38;
  if (method === "BURIED_BACKBONE") return 31;
  return 45;
}

function productFeet(product: TeralinxPrimaryProduct | undefined, lengthFeet: number) {
  return {
    fiberFeet: product === "DUCT" ? 0 : Math.round(lengthFeet),
    ductFeet: product === "FIBER" ? 0 : Math.round(lengthFeet),
  };
}

function nearestStation(stations: CorridorStation[], feet: number) {
  return stations.reduce((best, station) => (Math.abs(station.stationFeet - feet) < Math.abs(best.stationFeet - feet) ? station : best), stations[0]);
}

function createInventoryObject(args: {
  stationedCorridorId: string;
  type: CorridorInventoryObjectType;
  station: CorridorStation;
  quantity: number;
  unit: CorridorInventoryObject["unit"];
  materialProfile: string;
  installMethod: string;
  estimatedCost: number;
  metadata?: Record<string, unknown>;
}): CorridorInventoryObject {
  return {
    objectId: `${args.stationedCorridorId}:${args.type}:${args.station.stationId}`,
    objectType: args.type,
    stationId: args.station.stationId,
    stationLabel: args.station.stationLabel,
    lat: args.station.lat,
    lng: args.station.lng,
    quantity: args.quantity,
    unit: args.unit,
    materialProfile: args.materialProfile,
    installMethod: args.installMethod,
    estimatedCost: Math.round(args.estimatedCost),
    status: "PROPOSED",
    engineeringStatus: "PENDING_VERIFICATION",
    metadata: args.metadata ?? {},
  };
}

function buildStations(centerlineRoute: CenterlineRoute, networkClass: NetworkClass): CorridorStation[] {
  const interval = stationSpacingFeet(networkClass);
  const distances: number[] = [];
  for (let distance = 0; distance < centerlineRoute.totalFeet; distance += interval) distances.push(distance);
  if (!distances.length || distances[distances.length - 1] !== centerlineRoute.totalFeet) distances.push(centerlineRoute.totalFeet);
  return distances.map((distance, index) => {
    const coordinate = coordinateAtDistance(centerlineRoute.geometry, distance);
    return {
      stationId: `${centerlineRoute.centerlineRouteId}:STATION:${index.toString().padStart(4, "0")}`,
      stationLabel: stationLabel(distance),
      stationFeet: Math.round(distance),
      stationMiles: Number((distance / 5280).toFixed(3)),
      lat: coordinate[1],
      lng: coordinate[0],
      coordinate,
      visibleAtZoom: {
        stationMarkerVisibleZoom: 10,
        stationLabelVisibleZoom: 12,
      },
      inventoryObjectIds: [],
      engineeringStatus: "PENDING_VERIFICATION",
      metadata: {
        stationSpacingFeet: interval,
        centerlineRouteId: centerlineRoute.centerlineRouteId,
      },
    };
  });
}

function buildSegments(centerlineRoute: CenterlineRoute, stations: CorridorStation[], networkClass: NetworkClass): CorridorSegment[] {
  const method = constructionMethod(networkClass);
  return stations.slice(0, -1).map((station, index) => {
    const next = stations[index + 1];
    const lengthFeet = Math.max(0, next.stationFeet - station.stationFeet);
    return {
      segmentId: `${centerlineRoute.centerlineRouteId}:SEGMENT:${index + 1}`,
      fromStationId: station.stationId,
      toStationId: next.stationId,
      fromStationFeet: station.stationFeet,
      toStationFeet: next.stationFeet,
      lengthFeet,
      lengthMiles: Number((lengthFeet / 5280).toFixed(3)),
      geometry: geometryBetweenDistances(centerlineRoute.geometry, station.stationFeet, next.stationFeet),
      constructionMethod: method,
      estimatedCost: Math.round(lengthFeet * estimatedCostPerFoot(method)),
      confidence: centerlineRoute.confidence === "HIGH" ? 82 : centerlineRoute.confidence === "MEDIUM" ? 68 : 48,
      constraintIds: [],
      inventoryObjectIds: [],
      engineeringStatus: "PENDING_VERIFICATION",
      metadata: {
        sourceCenterlineRouteId: centerlineRoute.centerlineRouteId,
        snappedCenterlineSegment: true,
      },
    };
  });
}

function addLinearObjects(args: {
  objects: CorridorInventoryObject[];
  segments: CorridorSegment[];
  stations: CorridorStation[];
  product?: TeralinxPrimaryProduct;
  stationedCorridorId: string;
  materialProfile: string;
}) {
  args.segments.forEach((segment) => {
    const station = args.stations.find((item) => item.stationId === segment.fromStationId) ?? args.stations[0];
    const feet = productFeet(args.product, segment.lengthFeet);
    if (feet.ductFeet > 0) {
      args.objects.push(
        createInventoryObject({
          stationedCorridorId: args.stationedCorridorId,
          type: "DUCT",
          station,
          quantity: feet.ductFeet,
          unit: "FOOT",
          materialProfile: args.materialProfile,
          installMethod: segment.constructionMethod,
          estimatedCost: feet.ductFeet * 2.25,
          metadata: { segmentId: segment.segmentId, toStationId: segment.toStationId },
        }),
      );
    }
    if (feet.fiberFeet > 0) {
      args.objects.push(
        createInventoryObject({
          stationedCorridorId: args.stationedCorridorId,
          type: "FIBER",
          station,
          quantity: feet.fiberFeet,
          unit: "FOOT",
          materialProfile: args.materialProfile,
          installMethod: segment.constructionMethod,
          estimatedCost: feet.fiberFeet * 1.85,
          metadata: { segmentId: segment.segmentId, toStationId: segment.toStationId },
        }),
      );
    }
  });
}

function addPointObjects(args: {
  objects: CorridorInventoryObject[];
  stations: CorridorStation[];
  centerlineRoute: CenterlineRoute;
  networkClass: NetworkClass;
  stationedCorridorId: string;
  materialProfile: string;
}) {
  const vaultSpacing = args.networkClass === "METRO" ? 1000 : args.networkClass === "CAMPUS" ? 500 : 10000;
  const regenSpacing = args.networkClass === "LONG_HAUL" ? 60 * 5280 : args.networkClass === "MIDDLE_MILE" ? 45 * 5280 : Number.POSITIVE_INFINITY;
  args.stations.forEach((station, index) => {
    const isEndpoint = index === 0 || index === args.stations.length - 1;
    if (isEndpoint || station.stationFeet % vaultSpacing === 0) {
      args.objects.push(
        createInventoryObject({
          stationedCorridorId: args.stationedCorridorId,
          type: args.networkClass === "METRO" || args.networkClass === "CAMPUS" ? "HANDHOLE" : "VAULT",
          station,
          quantity: 1,
          unit: "EACH",
          materialProfile: args.materialProfile,
          installMethod: "BURIED_BACKBONE",
          estimatedCost: args.networkClass === "METRO" || args.networkClass === "CAMPUS" ? 6500 : 18500,
          metadata: { endpoint: isEndpoint, centerlineRouteId: args.centerlineRoute.centerlineRouteId },
        }),
      );
    }
    if (isEndpoint) {
      args.objects.push(
        createInventoryObject({
          stationedCorridorId: args.stationedCorridorId,
          type: "SPLICE_POINT",
          station,
          quantity: 1,
          unit: "EACH",
          materialProfile: args.materialProfile,
          installMethod: "SPLICING",
          estimatedCost: 4200,
          metadata: { endpoint: true },
        }),
      );
    }
    if (Number.isFinite(regenSpacing) && station.stationFeet > 0 && station.stationFeet < args.centerlineRoute.totalFeet && station.stationFeet % regenSpacing < stationSpacingFeet(args.networkClass)) {
      args.objects.push(
        createInventoryObject({
          stationedCorridorId: args.stationedCorridorId,
          type: "REGEN_SITE",
          station,
          quantity: 1,
          unit: "EACH",
          materialProfile: args.materialProfile,
          installMethod: "REGEN_PLACEMENT",
          estimatedCost: 125000,
          metadata: { spacingFeet: regenSpacing },
        }),
      );
    }
  });
}

function addEstimatedCrossings(args: {
  objects: CorridorInventoryObject[];
  stations: CorridorStation[];
  centerlineRoute: CenterlineRoute;
  stationedCorridorId: string;
  materialProfile: string;
}) {
  const crossingRules: Array<{ type: CorridorInventoryObjectType; intervalFeet: number; cost: number }> = [
    { type: "ROAD_CROSSING", intervalFeet: 10 * 5280, cost: 16000 },
    { type: "WATER_CROSSING", intervalFeet: 30 * 5280, cost: 68000 },
    { type: "RAIL_CROSSING", intervalFeet: 45 * 5280, cost: 95000 },
    { type: "BRIDGE_CROSSING", intervalFeet: 75 * 5280, cost: 72000 },
  ];
  crossingRules.forEach((rule) => {
    for (let distance = rule.intervalFeet; distance < args.centerlineRoute.totalFeet; distance += rule.intervalFeet) {
      const station = nearestStation(args.stations, distance);
      args.objects.push(
        createInventoryObject({
          stationedCorridorId: args.stationedCorridorId,
          type: rule.type,
          station,
          quantity: 1,
          unit: "EACH",
          materialProfile: args.materialProfile,
          installMethod: "ENGINEERING_REVIEW",
          estimatedCost: rule.cost,
          metadata: {
            estimatedCrossing: true,
            distanceFeet: Math.round(distance),
            engineeringStatus: "PENDING_VERIFICATION",
          },
        }),
      );
    }
  });
  if (args.centerlineRoute.totalFeet > 0 && args.centerlineRoute.totalFeet < 5280) {
    const station = args.stations[Math.floor(args.stations.length / 2)] ?? args.stations[0];
    args.objects.push(
      createInventoryObject({
        stationedCorridorId: args.stationedCorridorId,
        type: "UNKNOWN_CONSTRAINT",
        station,
        quantity: 1,
        unit: "EACH",
        materialProfile: args.materialProfile,
        installMethod: "ENGINEERING_REVIEW",
        estimatedCost: 8000,
        metadata: { reason: "Short route requires engineering constraint verification." },
      }),
    );
  }
}

function attachObjectsToStationsAndSegments(objects: CorridorInventoryObject[], stations: CorridorStation[], segments: CorridorSegment[]) {
  const objectsByStation = new Map<string, string[]>();
  objects.forEach((object) => {
    objectsByStation.set(object.stationId, [...(objectsByStation.get(object.stationId) ?? []), object.objectId]);
    if (object.objectType.includes("CROSSING") || object.objectType === "UNKNOWN_CONSTRAINT") {
      const segment = segments.find((item) => {
        const station = stations.find((candidate) => candidate.stationId === object.stationId);
        return station ? station.stationFeet >= item.fromStationFeet && station.stationFeet <= item.toStationFeet : false;
      });
      if (segment) segment.constraintIds.push(object.objectId);
    }
    const explicitSegmentId = typeof object.metadata.segmentId === "string" ? object.metadata.segmentId : undefined;
    const segment = explicitSegmentId ? segments.find((item) => item.segmentId === explicitSegmentId) : undefined;
    if (segment) segment.inventoryObjectIds.push(object.objectId);
  });
  stations.forEach((station) => {
    station.inventoryObjectIds.push(...(objectsByStation.get(station.stationId) ?? []));
  });
}

function buildTakeoff(args: {
  stationedCorridorId: string;
  centerlineRoute: CenterlineRoute;
  objects: CorridorInventoryObject[];
}): CorridorTakeoff {
  const count = (type: CorridorInventoryObjectType) => args.objects.filter((object) => object.objectType === type).length;
  const feet = (type: CorridorInventoryObjectType) => args.objects.filter((object) => object.objectType === type).reduce((sum, object) => sum + object.quantity, 0);
  const estimatedConstructionCost = Math.round(args.centerlineRoute.totalFeet * 38 + args.objects.reduce((sum, object) => sum + object.estimatedCost, 0));
  return {
    takeoffId: `TAKEOFF-${args.stationedCorridorId}`,
    centerlineRouteId: args.centerlineRoute.centerlineRouteId,
    stationedCorridorId: args.stationedCorridorId,
    routeFeet: args.centerlineRoute.totalFeet,
    routeMiles: args.centerlineRoute.totalMiles,
    ductFeet: Math.round(feet("DUCT")),
    fiberFeet: Math.round(feet("FIBER")),
    vaultCount: count("VAULT"),
    handholeCount: count("HANDHOLE"),
    regenSiteCount: count("REGEN_SITE"),
    splicePointCount: count("SPLICE_POINT"),
    markerPostCount: count("MARKER_POST"),
    roadCrossingCount: count("ROAD_CROSSING"),
    railCrossingCount: count("RAIL_CROSSING"),
    waterCrossingCount: count("WATER_CROSSING"),
    bridgeCrossingCount: count("BRIDGE_CROSSING"),
    unknownConstraintCount: count("UNKNOWN_CONSTRAINT"),
    estimatedConstructionCost,
    confidence: args.centerlineRoute.confidence,
    assumptions: [
      "Quantities are generated from the snapped centerline design candidate and remain subject to Route Engineering verification.",
      "Objects are proposed inventory only and are not engineering-certified.",
      "Crossing counts are design-candidate estimates until constraint review is performed.",
    ],
    diagnostics: [
      `routeFeet=${args.centerlineRoute.totalFeet}`,
      `routeMiles=${args.centerlineRoute.totalMiles}`,
      `objectCount=${args.objects.length}`,
      `source=${args.centerlineRoute.source}`,
      `status=${args.centerlineRoute.status}`,
    ],
  };
}

function emptyTakeoff(stationedCorridorId: string, centerlineRoute: CenterlineRoute): CorridorTakeoff {
  return {
    takeoffId: `TAKEOFF-${stationedCorridorId}`,
    centerlineRouteId: centerlineRoute.centerlineRouteId,
    stationedCorridorId,
    routeFeet: 0,
    routeMiles: 0,
    ductFeet: 0,
    fiberFeet: 0,
    vaultCount: 0,
    handholeCount: 0,
    regenSiteCount: 0,
    splicePointCount: 0,
    markerPostCount: 0,
    roadCrossingCount: 0,
    railCrossingCount: 0,
    waterCrossingCount: 0,
    bridgeCrossingCount: 0,
    unknownConstraintCount: 0,
    estimatedConstructionCost: 0,
    confidence: "LOW",
    assumptions: ["OSRM centerline route was unavailable. No straight-line fallback geometry was generated."],
    diagnostics: [`status=${centerlineRoute.status}`, "blocked=true"],
  };
}

export async function generateCenterlineRoute(session: DesignLaunchSession): Promise<CenterlineRoute> {
  const appliedDoctrine = resolveDesignDoctrineForSession(session);
  const routeRequestId = session.launchId.replace(/^DESIGN-LAUNCH-DESIGN-/, "");
  const centerlineRouteId = `CLR-${session.launchId}`;
  const aSite = resolveSite(session.siteList.find((site) => site.role === "A_SITE") ?? session.siteList[0], 0);
  const zSite = resolveSite(session.siteList.find((site) => site.role === "Z_SITE") ?? session.siteList[session.siteList.length - 1], 1);
  const intermediateSites = session.siteList.filter((site) => site.role === "INTERMEDIATE_SITE").map((site, index) => centerlineSite(resolveSite(site, index + 2)));
  const requestDiagnostic = diagnostic(centerlineRouteId, "CENTERLINE_ROUTE_REQUESTED", "INFO", "Requesting snapped centerline route from existing DAL OSRM integration.", {
    routeRequestId,
    aSite: aSite.facilityName,
    zSite: zSite.facilityName,
  });
  const result = await routeInventoryExtensionViaOsrm({
    attachmentCoordinate: aSite.coordinate,
    candidateCoordinate: zSite.coordinate,
    existingInventoryLengthFeet: 0,
    attachmentId: `${routeRequestId}:A_SITE`,
  });
  if (result.routeStatus !== "VALID" || result.geometry.length < 2) {
    const blocked = diagnostic(
      centerlineRouteId,
      "CENTERLINE_ROUTE_BLOCKED",
      "ERROR",
      "OSRM centerline route unavailable. No straight-line fallback geometry was generated.",
      { failureReason: result.failureReason, audit: result.audit },
    );
    return {
      centerlineRouteId,
      routeRequestId,
      designDoctrineId: appliedDoctrine.doctrine.designDoctrineId,
      source: "OSRM_EXISTING_DAL",
      status: "CENTERLINE_ROUTE_BLOCKED",
      aSite: centerlineSite(aSite),
      zSite: centerlineSite(zSite),
      intermediateSites,
      geometry: [],
      totalFeet: 0,
      totalMiles: 0,
      confidence: "LOW",
      diagnostics: [requestDiagnostic, blocked],
      noEngineeringCertification: true,
      salesEstimateOnly: true,
    };
  }
  const verified = diagnostic(centerlineRouteId, "CENTERLINE_ROUTE_VERIFIED", "INFO", "OSRM snapped centerline route verified for sales design candidate.", {
    routeFeet: result.routeFeet,
    routeMiles: result.routeMiles,
    vertexCount: result.geometry.length,
    audit: result.audit,
  });
  return {
    centerlineRouteId,
    routeRequestId,
    designDoctrineId: appliedDoctrine.doctrine.designDoctrineId,
    source: "OSRM_EXISTING_DAL",
    status: "CENTERLINE_ROUTE_VERIFIED",
    aSite: centerlineSite(aSite),
    zSite: centerlineSite(zSite),
    intermediateSites,
    geometry: result.geometry,
    totalFeet: Math.round(result.routeFeet),
    totalMiles: Number(result.routeMiles.toFixed(2)),
    confidence: result.audit?.distanceToStartNode && result.audit.distanceToStartNode > 600 ? "MEDIUM" : "HIGH",
    diagnostics: [requestDiagnostic, verified],
    noEngineeringCertification: true,
    salesEstimateOnly: true,
  };
}

export function generateFixtureCenterlineRoute(session: DesignLaunchSession): CenterlineRoute {
  const appliedDoctrine = resolveDesignDoctrineForSession(session);
  const routeCandidate = generateRouteCandidate(session);
  const routeRequestId = session.launchId.replace(/^DESIGN-LAUNCH-DESIGN-/, "");
  const centerlineRouteId = `CLR-${session.launchId}`;
  const aSite = resolveSite(session.siteList.find((site) => site.role === "A_SITE") ?? session.siteList[0], 0);
  const zSite = resolveSite(session.siteList.find((site) => site.role === "Z_SITE") ?? session.siteList[session.siteList.length - 1], 1);
  const geometry = routeCandidate.geometry;
  const totalFeet = routeLengthFeet(geometry);
  return {
    centerlineRouteId,
    routeRequestId,
    designDoctrineId: appliedDoctrine.doctrine.designDoctrineId,
    source: "STATIC_FIXTURE",
    status: "CENTERLINE_ROUTE_ESTIMATED_FIXTURE",
    aSite: centerlineSite(aSite),
    zSite: centerlineSite(zSite),
    intermediateSites: session.siteList.filter((site) => site.role === "INTERMEDIATE_SITE").map((site, index) => centerlineSite(resolveSite(site, index + 2))),
    geometry,
    totalFeet,
    totalMiles: Number((totalFeet / 5280).toFixed(2)),
    confidence: "MEDIUM",
    diagnostics: [
      diagnostic(centerlineRouteId, "CENTERLINE_ROUTE_FIXTURE_CREATED", "WARNING", "Static centerline fixture created for build-safe workspace rendering. Live Teralinx handoff uses OSRM_EXISTING_DAL.", {
        routeCandidateId: routeCandidate.routeCandidateId,
      }),
    ],
    noEngineeringCertification: true,
    salesEstimateOnly: true,
  };
}

export function generateStationedCorridorFromCenterline(session: DesignLaunchSession, centerlineRoute: CenterlineRoute): StationedCorridor {
  const appliedDoctrine = resolveDesignDoctrineForSession(session);
  const stationedCorridorId = `SC-${centerlineRoute.centerlineRouteId}`;
  if (centerlineRoute.status === "CENTERLINE_ROUTE_BLOCKED" || centerlineRoute.geometry.length < 2) {
    return {
      stationedCorridorId,
      centerlineRouteId: centerlineRoute.centerlineRouteId,
      routeRequestId: centerlineRoute.routeRequestId,
      designDoctrineId: appliedDoctrine.doctrine.designDoctrineId,
      centerlineRoute,
      stations: [],
      segments: [],
      inventoryObjects: [],
      takeoff: emptyTakeoff(stationedCorridorId, centerlineRoute),
      status: "BLOCKED",
      diagnostics: ["CENTERLINE_ROUTE_BLOCKED", "No stationing, objects, or takeoff created."],
      noEngineeringCertification: true,
      salesEstimateOnly: true,
      noScopeVersionCreation: true,
      noInventoryMutation: true,
    };
  }

  const stations = buildStations(centerlineRoute, appliedDoctrine.networkClass);
  const segments = buildSegments(centerlineRoute, stations, appliedDoctrine.networkClass);
  const objects: CorridorInventoryObject[] = [];
  addLinearObjects({
    objects,
    segments,
    stations,
    product: session.primaryProduct,
    stationedCorridorId,
    materialProfile: appliedDoctrine.materialProfileId,
  });
  addPointObjects({
    objects,
    stations,
    centerlineRoute,
    networkClass: appliedDoctrine.networkClass,
    stationedCorridorId,
    materialProfile: appliedDoctrine.materialProfileId,
  });
  addEstimatedCrossings({
    objects,
    stations,
    centerlineRoute,
    stationedCorridorId,
    materialProfile: appliedDoctrine.materialProfileId,
  });
  attachObjectsToStationsAndSegments(objects, stations, segments);
  const takeoff = buildTakeoff({ stationedCorridorId, centerlineRoute, objects });
  return {
    stationedCorridorId,
    centerlineRouteId: centerlineRoute.centerlineRouteId,
    routeRequestId: centerlineRoute.routeRequestId,
    designDoctrineId: appliedDoctrine.doctrine.designDoctrineId,
    centerlineRoute,
    stations,
    segments,
    inventoryObjects: objects,
    takeoff,
    status: "READY_FOR_PROPOSAL",
    diagnostics: [
      `stations=${stations.length}`,
      `segments=${segments.length}`,
      `objects=${objects.length}`,
      `takeoff=${takeoff.takeoffId}`,
      "All generated station, segment, and object engineering statuses are PENDING_VERIFICATION.",
    ],
    noEngineeringCertification: true,
    salesEstimateOnly: true,
    noScopeVersionCreation: true,
    noInventoryMutation: true,
  };
}

export async function generateStationedCorridor(session: DesignLaunchSession): Promise<StationedCorridor> {
  const centerlineRoute = await generateCenterlineRoute(session);
  return generateStationedCorridorFromCenterline(session, centerlineRoute);
}

export function generateFixtureStationedCorridor(session: DesignLaunchSession): StationedCorridor {
  return generateStationedCorridorFromCenterline(session, generateFixtureCenterlineRoute(session));
}
