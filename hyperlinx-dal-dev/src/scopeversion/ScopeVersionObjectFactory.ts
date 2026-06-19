import type { CertifiedRoute } from "../routing/CertifiedRouteAuthority";
import type {
  RouteStation,
  NetworkAttachmentMode,
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
  attachmentMode?: NetworkAttachmentMode;
  sourceObjectId?: string;
  sourceObjectType?: string;
  sourceRouteId?: string;
  sourceNodeId?: string;
  sourceEdgeId?: string;
  sourceStationId?: string;
  attachmentCoordinate?: ScopeInfrastructureObject["attachmentCoordinate"];
  attachmentReferenceResolved?: boolean;
  attachmentReferenceType?: ScopeInfrastructureObject["attachmentReferenceType"];
  attachmentReferenceFallbackReason?: string;
  existingInventoryReferencePreserved?: boolean;
  lateralStationId?: string;
  lateralStationLabel?: string;
  plannedHandholeRequired?: boolean;
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
    inventoryId: args.scopeVersion.inventoryId,
    graphId: args.scopeVersion.graphId,
    sourceRouteId: args.sourceRouteId,
    sourceNodeId: args.sourceNodeId,
    sourceEdgeId: args.sourceEdgeId,
    sourceStationId: args.sourceStationId,
    sourceObjectId: args.sourceObjectId,
    sourceObjectType: args.sourceObjectType,
    attachmentMode: args.attachmentMode,
    attachmentCoordinate: args.attachmentCoordinate,
    attachmentReferenceResolved: args.attachmentReferenceResolved,
    attachmentReferenceType: args.attachmentReferenceType,
    attachmentReferenceFallbackReason: args.attachmentReferenceFallbackReason,
    existingInventoryReferencePreserved: args.existingInventoryReferencePreserved,
    lateralStationId: args.lateralStationId,
    lateralStationLabel: args.lateralStationLabel,
    plannedHandholeRequired: args.plannedHandholeRequired,
    longitude: args.station.coordinate[0],
    latitude: args.station.coordinate[1],
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

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function asString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function attachmentModeFromSource(sourceObjectType?: string): NetworkAttachmentMode {
  const normalized = String(sourceObjectType ?? "").toUpperCase();
  if (normalized.includes("HANDHOLE")) return "EXISTING_HANDHOLE";
  if (normalized.includes("VAULT")) return "EXISTING_VAULT";
  if (normalized.includes("SPLICE")) return "EXISTING_SPLICE";
  if (normalized.includes("NODE")) return "EXISTING_NODE";
  return "PLANNED_HANDHOLE";
}

function referenceTypeFor(args: { sourceStationId?: string; sourceNodeId?: string; sourceEdgeId?: string; sourceRouteId?: string }): ScopeInfrastructureObject["attachmentReferenceType"] {
  if (args.sourceStationId) return "STATION";
  if (args.sourceNodeId) return "NODE";
  if (args.sourceEdgeId) return "EDGE";
  if (args.sourceRouteId) return "ROUTE_POINT";
  return "UNKNOWN";
}

function fallbackReasonFor(referenceType: ScopeInfrastructureObject["attachmentReferenceType"]) {
  if (referenceType === "STATION") return undefined;
  if (referenceType === "NODE") return "NO_EXISTING_STATION_REFERENCE_NEAREST_NODE_USED";
  if (referenceType === "EDGE") return "NO_EXISTING_STATION_OR_NODE_REFERENCE_NEAREST_EDGE_USED";
  if (referenceType === "ROUTE_POINT") return "NO_EXISTING_STATION_NODE_OR_EDGE_REFERENCE_ROUTE_POINT_USED";
  return "NO_EXISTING_INVENTORY_REFERENCE_RESOLVED";
}

function networkAttachmentAuthority(args: { scopeVersion: ScopeVersion; certifiedRoute: CertifiedRoute }) {
  const truth = args.scopeVersion.canonicalTruth ?? {};
  const network = asRecord(truth.networkBasis);
  const engineering = asRecord(truth.engineeringBasis);
  const attachmentCertification = asRecord(engineering.attachmentCertification);
  const sourceObjectId = asString(network.sourceObjectId ?? attachmentCertification.sourceObjectId);
  const sourceObjectType = asString(network.sourceObjectType ?? attachmentCertification.sourceObjectType);
  const sourceRouteId = asString(network.sourceRouteId ?? network.routeId ?? attachmentCertification.routeId ?? args.certifiedRoute.nearestRouteId);
  const sourceNodeId = asString(network.sourceNodeId ?? network.nodeId ?? attachmentCertification.nodeId ?? args.certifiedRoute.nearestNodeId);
  const sourceEdgeId = asString(network.sourceEdgeId ?? attachmentCertification.edgeId ?? attachmentCertification.routeSegmentId);
  const sourceStationId = asString(network.sourceStationId ?? network.stationId ?? attachmentCertification.stationId ?? args.certifiedRoute.nearestStationId);
  const attachmentMode = attachmentModeFromSource(sourceObjectType || (sourceNodeId ? "NODE" : undefined));
  const attachmentReferenceType = referenceTypeFor({ sourceStationId, sourceNodeId, sourceEdgeId, sourceRouteId });
  const attachmentReferenceResolved = attachmentReferenceType !== "UNKNOWN";
  const existingInventoryReferencePreserved = Boolean(sourceStationId || sourceNodeId || sourceEdgeId || sourceRouteId);
  const plannedHandholeRequired = attachmentMode === "PLANNED_HANDHOLE";

  return {
    sourceObjectId: sourceObjectId || undefined,
    sourceObjectType: sourceObjectType || undefined,
    sourceRouteId: sourceRouteId || undefined,
    sourceNodeId: sourceNodeId || undefined,
    sourceEdgeId: sourceEdgeId || undefined,
    sourceStationId: sourceStationId || undefined,
    attachmentMode,
    attachmentReferenceResolved,
    attachmentReferenceType,
    attachmentReferenceFallbackReason: fallbackReasonFor(attachmentReferenceType),
    existingInventoryReferencePreserved,
    plannedHandholeRequired,
    existingStructure: attachmentMode !== "PLANNED_HANDHOLE",
  };
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
  const attachmentAuthority = networkAttachmentAuthority({ scopeVersion: args.scopeVersion, certifiedRoute: args.certifiedRoute });
  const objects: ScopeInfrastructureObject[] = [
    objectForStation({
      scopeVersion: args.scopeVersion,
      station: firstStation,
      type: "NETWORK_ATTACHMENT",
      label: "Network attachment",
      quantity: 1,
      unit: "EA",
      specification: attachmentAuthority.existingStructure ? "EXISTING_INVENTORY_ATTACHMENT" : "PLANNED_HANDHOLE_ATTACHMENT",
      createdAt,
      attachmentCoordinate: firstStation.coordinate,
      lateralStationId: firstStation.stationId,
      lateralStationLabel: firstStation.stationLabel,
      ...attachmentAuthority,
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

  if (!attachmentAuthority.existingStructure) {
    objects.push(
      objectForStation({
        scopeVersion: args.scopeVersion,
        station: firstStation,
        type: "HANDHOLE",
        label: "Planned origin handhole",
        quantity: 1,
        unit: "EA",
        specification: "PLANNED_HANDHOLE",
        createdAt,
        attachmentMode: "PLANNED_HANDHOLE",
        attachmentCoordinate: firstStation.coordinate,
        lateralStationId: firstStation.stationId,
        lateralStationLabel: firstStation.stationLabel,
        plannedHandholeRequired: true,
      })
    );
  }

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
  const networkAttachment = objects.find((object) => object.objectType === "NETWORK_ATTACHMENT");
  const stationing = summarizeRouteStationing({ certifiedRoute: args.certifiedRoute, stations, stationIntervalFeet });
  const objectPlacement = summarizeScopeInfrastructureObjects({ objects, routeFeet: stationing.routeFeet });

  const projectedScopeVersion = {
    ...args.scopeVersion,
    updatedAt: createdAt,
    canonicalTruth: {
      ...args.scopeVersion.canonicalTruth,
      stations,
      objects,
      stationing,
      objectPlacement,
      networkAttachmentAuthority: networkAttachment
        ? {
            objectId: networkAttachment.objectId,
            inventoryId: networkAttachment.inventoryId,
            graphId: networkAttachment.graphId,
            sourceRouteId: networkAttachment.sourceRouteId,
            sourceNodeId: networkAttachment.sourceNodeId,
            sourceEdgeId: networkAttachment.sourceEdgeId,
            sourceStationId: networkAttachment.sourceStationId,
            sourceObjectId: networkAttachment.sourceObjectId,
            sourceObjectType: networkAttachment.sourceObjectType,
            attachmentMode: networkAttachment.attachmentMode,
            attachmentCoordinate: networkAttachment.attachmentCoordinate,
            lateralStationId: networkAttachment.lateralStationId,
            lateralStationLabel: networkAttachment.lateralStationLabel,
            attachmentReferenceResolved: networkAttachment.attachmentReferenceResolved,
            attachmentReferenceType: networkAttachment.attachmentReferenceType,
            attachmentReferenceFallbackReason: networkAttachment.attachmentReferenceFallbackReason,
            existingInventoryReferencePreserved: networkAttachment.existingInventoryReferencePreserved,
            plannedHandholeRequired: networkAttachment.plannedHandholeRequired,
            coordinate: networkAttachment.coordinate,
            latitude: networkAttachment.latitude,
            longitude: networkAttachment.longitude,
          }
        : undefined,
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

  console.log("[STATION_PROJECTION]", {
    generatedStations: stations.length,
    projectedStations: projectedScopeVersion.canonicalTruth.stations?.length,
  });

  return projectedScopeVersion;
}
