import type { CertifiedRoute } from "../routing/CertifiedRouteAuthority";
import type {
  RouteStation,
  ScopeInfrastructureObject,
  ScopeInfrastructureObjectType,
  ScopeVersion,
  ScopeVersionObjectPlacementSummary,
} from "../types/dal";
import {
  DEFAULT_LATERAL_STATION_INTERVAL_FEET,
  generateRouteStationsFromCertifiedRoute,
  summarizeRouteStationing,
} from "./RouteStationingEngine";

const LONG_LATERAL_OBJECT_THRESHOLD_FEET = 1000;

function objectId(scopeVersionId: string, type: ScopeInfrastructureObjectType, stationId: string) {
  return `${scopeVersionId}:${type}:${stationId}`;
}

function objectForStation(args: {
  scopeVersion: ScopeVersion;
  station: RouteStation;
  type: ScopeInfrastructureObjectType;
  label: string;
  quantity: number;
  unit: string;
  specification: string;
  createdAt: string;
}): ScopeInfrastructureObject {
  return {
    objectId: objectId(args.scopeVersion.scopeVersionId, args.type, args.station.stationId),
    scopeVersionId: args.scopeVersion.scopeVersionId,
    stationId: args.station.stationId,
    objectCategory: "INFRASTRUCTURE",
    objectType: args.type,
    objectState: "PLANNED",
    label: args.label,
    coordinate: args.station.coordinate,
    measureFeet: args.station.measureFeet,
    quantity: args.quantity,
    unit: args.unit,
    specification: args.specification,
    createdAt: args.createdAt,
    updatedAt: args.createdAt,
  };
}

function nearestStation(stations: RouteStation[], measureFeet: number) {
  return stations.reduce((best, station) => {
    if (!best) return station;
    return Math.abs(station.measureFeet - measureFeet) < Math.abs(best.measureFeet - measureFeet) ? station : best;
  }, undefined as RouteStation | undefined);
}

export function generateDefaultLateralObjects(args: {
  scopeVersion: ScopeVersion;
  certifiedRoute: CertifiedRoute;
  stations: RouteStation[];
  createdAt?: string;
}) {
  const createdAt = args.createdAt ?? new Date().toISOString();
  const firstStation = args.stations[0];
  const finalStation = args.stations[args.stations.length - 1];
  if (!firstStation || !finalStation) return [];

  const routeFeet = Math.max(0, Math.round(Number(args.certifiedRoute.routeFeet)));
  const objects: ScopeInfrastructureObject[] = [
    objectForStation({
      scopeVersion: args.scopeVersion,
      station: firstStation,
      type: "ATTACHMENT_POINT",
      label: "Backbone attachment point",
      quantity: 1,
      unit: "EA",
      specification: "Certified inventory attachment for lateral origin",
      createdAt,
    }),
    objectForStation({
      scopeVersion: args.scopeVersion,
      station: firstStation,
      type: "DUCT",
      label: "Buried lateral duct",
      quantity: routeFeet,
      unit: "FT",
      specification: "BURIED_LATERAL_DUCT",
      createdAt,
    }),
    objectForStation({
      scopeVersion: args.scopeVersion,
      station: firstStation,
      type: "FIBER",
      label: "Lateral fiber",
      quantity: routeFeet,
      unit: "FT",
      specification: "BURIED_LATERAL_FIBER",
      createdAt,
    }),
    objectForStation({
      scopeVersion: args.scopeVersion,
      station: finalStation,
      type: "BUILDING_ENTRANCE",
      label: "Building entrance",
      quantity: 1,
      unit: "EA",
      specification: "CUSTOMER_BUILDING_ENTRANCE",
      createdAt,
    }),
    objectForStation({
      scopeVersion: args.scopeVersion,
      station: finalStation,
      type: "SERVICE_LOCATION",
      label: "Service location",
      quantity: 1,
      unit: "EA",
      specification: "CUSTOMER_SERVICE_LOCATION",
      createdAt,
    }),
  ];

  if (routeFeet > LONG_LATERAL_OBJECT_THRESHOLD_FEET) {
    const midpoint = nearestStation(args.stations, routeFeet / 2) ?? finalStation;
    objects.push(
      objectForStation({
        scopeVersion: args.scopeVersion,
        station: midpoint,
        type: "HANDHOLE",
        label: "Intermediate handhole",
        quantity: 1,
        unit: "EA",
        specification: "LONG_LATERAL_HANDHOLE",
        createdAt,
      }),
      objectForStation({
        scopeVersion: args.scopeVersion,
        station: midpoint,
        type: "VAULT",
        label: "Intermediate vault",
        quantity: 1,
        unit: "EA",
        specification: "LONG_LATERAL_VAULT",
        createdAt,
      })
    );
  }

  return objects;
}

export function summarizeScopeInfrastructureObjects(args: {
  objects: ScopeInfrastructureObject[];
  routeFeet: number;
}): ScopeVersionObjectPlacementSummary {
  const objectsByStation: Record<string, string[]> = {};
  args.objects.forEach((object) => {
    objectsByStation[object.stationId] = [...(objectsByStation[object.stationId] ?? []), object.objectId];
  });

  return {
    objectCount: args.objects.length,
    objectTypes: Array.from(new Set(args.objects.map((object) => object.objectType))),
    objectsByStation,
    productionFeetPlanned: Math.round(Number(args.routeFeet ?? 0)),
    productionFeetComplete: args.objects.some((object) => object.objectState === "COMPLETE") ? Math.round(Number(args.routeFeet ?? 0)) : 0,
    percentComplete: args.objects.some((object) => object.objectState === "COMPLETE") ? 100 : 0,
  };
}

export function applyLateralStationingAndObjects(args: {
  scopeVersion: ScopeVersion;
  certifiedRoute: CertifiedRoute;
  stationIntervalFeet?: number;
}) {
  const createdAt = new Date().toISOString();
  const stationIntervalFeet = args.stationIntervalFeet ?? DEFAULT_LATERAL_STATION_INTERVAL_FEET;
  const stations = generateRouteStationsFromCertifiedRoute({
    scopeVersion: args.scopeVersion,
    certifiedRoute: args.certifiedRoute,
    stationIntervalFeet,
    createdAt,
  });
  const objects = generateDefaultLateralObjects({
    scopeVersion: args.scopeVersion,
    certifiedRoute: args.certifiedRoute,
    stations,
    createdAt,
  });
  const stationing = summarizeRouteStationing({ certifiedRoute: args.certifiedRoute, stations, stationIntervalFeet });
  const objectPlacement = summarizeScopeInfrastructureObjects({ objects, routeFeet: stationing.routeFeet });

  return {
    ...args.scopeVersion,
    updatedAt: createdAt,
    canonicalTruth: {
      ...args.scopeVersion.canonicalTruth,
      stations,
      objects,
      stationing,
      objectPlacement,
      productionBasis: {
        routeFeet: stationing.routeFeet,
        productionFeetPlanned: objectPlacement.productionFeetPlanned,
        productionFeetComplete: objectPlacement.productionFeetComplete,
        percentComplete: objectPlacement.percentComplete,
        productionAuthority: "RouteStation",
        objectAuthority: "ScopeInfrastructureObject",
      },
    },
    events: [
      ...(args.scopeVersion.events ?? []),
      {
        eventId: `${args.scopeVersion.scopeVersionId}:stationing:${Date.now()}`,
        type: "scopeversion.stationing.generated",
        entityId: args.scopeVersion.scopeVersionId,
        entityType: "ScopeVersion",
        payload: {
          certifiedRouteId: args.certifiedRoute.certifiedRouteId,
          stationCount: stations.length,
          objectCount: objects.length,
          stationIntervalFeet,
        },
        createdAt,
      },
    ],
  } satisfies ScopeVersion;
}
