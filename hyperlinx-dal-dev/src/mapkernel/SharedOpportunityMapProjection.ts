import type { DALCoordinate } from "../types/dal";
import type { MapKernelRenderSpec } from "./MapLayerManager";

export type SharedOpportunityMapEndpoint = {
  role: "A" | "Z";
  label: string;
  coordinate: DALCoordinate;
  coordinateSource?: string;
};

export type SharedOpportunityMapProjection = {
  authority: "COMMERCIAL_ROUTE_REPOSITORY";
  projectionPurpose: "SHARED_OPPORTUNITY_MAP";
  opportunityId: string;
  routeRepositoryId: string;
  routeRevision: number;
  routeGeometryId: string;
  geometryHash: string;
  routeMiles?: number;
  routeFeet?: number;
  orientation: string;
  coordinates: DALCoordinate[];
  endpoints: SharedOpportunityMapEndpoint[];
  responseProjectionOnly: true;
};

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function text(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function coordinate(value: unknown): DALCoordinate | null {
  if (!Array.isArray(value) || value.length < 2) return null;
  const longitude = Number(value[0]);
  const latitude = Number(value[1]);
  return Number.isFinite(longitude) && Number.isFinite(latitude) ? [longitude, latitude] : null;
}

function coordinates(value: unknown): DALCoordinate[] {
  return Array.isArray(value) ? value.map(coordinate).filter((item): item is DALCoordinate => Boolean(item)) : [];
}

function endpoint(value: unknown, fallback: DALCoordinate | undefined, role: "A" | "Z"): SharedOpportunityMapEndpoint | null {
  const source = record(value);
  const site = record(source.site);
  const resolvedCoordinate = coordinate(source.coordinate) ?? coordinate(site.coordinate) ?? fallback ?? null;
  if (!resolvedCoordinate) return null;
  return {
    role,
    label: text(source.label, source.siteName, site.name, `${role} endpoint`),
    coordinate: resolvedCoordinate,
    coordinateSource: text(source.coordinateSource, site.coordinateSource, "COMMERCIAL_ROUTE_REPOSITORY"),
  };
}

/**
 * Presentation-only adapter for the governed Commercial Route Repository record.
 * It performs no route derivation, stationing, persistence, or authority transfer.
 */
export function sharedOpportunityMapProjectionFromRouteRepository(value: unknown): SharedOpportunityMapProjection | null {
  const route = record(value);
  const routeCoordinates = coordinates(route.commercialGeometry);
  const routeRepositoryId = text(route.routeRepositoryId, route.routeSnapshotId);
  if (!routeRepositoryId || routeCoordinates.length < 2) return null;
  const endpointAuthority = record(route.endpointAuthority);
  const aEndpoint = endpoint(endpointAuthority.aSite ?? route.aLocation, routeCoordinates[0], "A");
  const zEndpoint = endpoint(endpointAuthority.zSite ?? route.zLocation, routeCoordinates.at(-1), "Z");
  return {
    authority: "COMMERCIAL_ROUTE_REPOSITORY",
    projectionPurpose: "SHARED_OPPORTUNITY_MAP",
    opportunityId: text(route.opportunityId),
    routeRepositoryId,
    routeRevision: Math.max(1, Number(route.routeRevision ?? 1) || 1),
    routeGeometryId: text(route.routeGeometryId, `${routeRepositoryId}:geometry`),
    geometryHash: text(route.geometryHash),
    orientation: text(endpointAuthority.orientation, endpointAuthority.commercialOrientation, "A_TO_Z"),
    coordinates: routeCoordinates,
    endpoints: [aEndpoint, zEndpoint].filter((item): item is SharedOpportunityMapEndpoint => Boolean(item)),
    responseProjectionOnly: true,
  };
}

export function sharedOpportunityMapProjectionFromDraft(value: unknown): SharedOpportunityMapProjection | null {
  const draft = record(value);
  const supplied = record(draft.sharedOpportunityMapProjection);
  return supplied.authority === "COMMERCIAL_ROUTE_REPOSITORY"
    ? sharedOpportunityMapProjectionFromRouteRepository({
        ...supplied,
        commercialGeometry: supplied.coordinates,
        endpointAuthority: {
          orientation: supplied.orientation,
          aSite: Array.isArray(supplied.endpoints) ? supplied.endpoints.find((item) => record(item).role === "A") : undefined,
          zSite: Array.isArray(supplied.endpoints) ? supplied.endpoints.find((item) => record(item).role === "Z") : undefined,
        },
      })
    : null;
}

export function renderSharedOpportunityMapProjection(projection: SharedOpportunityMapProjection): MapKernelRenderSpec {
  const routeId = `${projection.routeRepositoryId}:shared-opportunity-route`;
  return {
    specId: `shared-opportunity-map:${projection.routeRepositoryId}:${projection.geometryHash || projection.routeRevision}`,
    sourceType: "CommercialRouteRepository",
    sourceId: projection.routeRepositoryId,
    name: "Shared Opportunity Map",
    primitives: [
      {
        id: routeId,
        layerId: "routeAuthorityDraft",
        kind: "line",
        coordinates: projection.coordinates,
        label: "Governed Commercial route",
        style: { stroke: "#22c55e", strokeWidth: 5, opacity: 0.92 },
        metadata: {
          source: "Commercial Route Repository",
          sourceLayer: "SHARED_OPPORTUNITY_GOVERNED_ROUTE",
          renderAuthority: projection.authority,
          isRouteAuthority: true,
          opportunityId: projection.opportunityId,
          routeRepositoryId: projection.routeRepositoryId,
          routeRevision: projection.routeRevision,
          routeGeometryId: projection.routeGeometryId,
          geometryHash: projection.geometryHash,
          orientation: projection.orientation,
          responseProjectionOnly: true,
        },
        ref: { kind: "Route", id: routeId, routeId: projection.routeRepositoryId },
      },
      ...projection.endpoints.map((item) => ({
        id: `${projection.routeRepositoryId}:endpoint:${item.role}`,
        layerId: "site" as const,
        kind: "point" as const,
        coordinate: item.coordinate,
        label: `${item.role} · ${item.label}`,
        style: { fill: item.role === "A" ? "#38bdf8" : "#f59e0b", stroke: "#071927", radius: 8, opacity: 1 },
        metadata: {
          source: "Commercial Route Repository",
          sourceLayer: "SHARED_OPPORTUNITY_ENDPOINT",
          renderAuthority: projection.authority,
          role: item.role,
          coordinateSource: item.coordinateSource,
          routeRepositoryId: projection.routeRepositoryId,
          geometryHash: projection.geometryHash,
        },
        ref: { kind: "Site" as const, id: `${projection.routeRepositoryId}:endpoint:${item.role}`, routeId: projection.routeRepositoryId },
      })),
      ...projection.endpoints.map((item) => ({
        id: `${projection.routeRepositoryId}:endpoint:${item.role}:label`,
        layerId: "site" as const,
        kind: "label" as const,
        coordinate: item.coordinate,
        label: item.role,
        style: { fill: "#f8fafc", fontSize: 13, fontWeight: 800, opacity: 1 },
        metadata: {
          source: "Commercial Route Repository",
          sourceLayer: "SHARED_OPPORTUNITY_ENDPOINT_LABEL",
          disclosureRole: "ENDPOINT",
          labelPriority: 100,
          role: item.role,
          responseProjectionOnly: true,
        },
        ref: { kind: "Site" as const, id: `${projection.routeRepositoryId}:endpoint:${item.role}:label`, routeId: projection.routeRepositoryId },
      })),
    ],
    metadata: {
      authority: projection.authority,
      projectionPurpose: projection.projectionPurpose,
      routeRepositoryId: projection.routeRepositoryId,
      routeRevision: projection.routeRevision,
      routeGeometryId: projection.routeGeometryId,
      geometryHash: projection.geometryHash,
      orientation: projection.orientation,
      responseProjectionOnly: true,
    },
  };
}
