import type { DALCoordinate } from "../types/dal";

export type EndpointRelationship = "MATCH" | "NEAR" | "MISMATCH" | "UNRESOLVED";
export type RouteOrientation = "SOURCE_START_TO_END" | "SOURCE_END_TO_START";

export interface ImportedRouteEndpointSite {
  endpoint: "A" | "Z";
  coordinate: DALCoordinate;
  coordinateSource: "IMPORTED_ROUTE";
  sourceFileHash: string;
  sourceGeometryId: string;
  routeRevision: number;
  geometryHash: string;
  sourceEndpoint: "START" | "END";
  siteName: string;
  customerSiteId: string;
  address: string;
  city: string;
  state: string;
  facilityType: string;
  notes: string;
}

export interface ImportedRouteEndpointAuthority {
  orientation: RouteOrientation;
  originalSourceOrientation: "START_TO_END";
  sourceStartCoordinate: DALCoordinate;
  sourceEndCoordinate: DALCoordinate;
  aSite: ImportedRouteEndpointSite;
  zSite: ImportedRouteEndpointSite;
}

function coordinateCopy(value: DALCoordinate): DALCoordinate {
  return [Number(value[0]), Number(value[1])];
}

function site(endpoint: "A" | "Z", sourceEndpoint: "START" | "END", coordinate: DALCoordinate, args: {
  sourceFileHash: string;
  sourceGeometryId: string;
  routeRevision: number;
  geometryHash: string;
}): ImportedRouteEndpointSite {
  return {
    endpoint,
    coordinate: coordinateCopy(coordinate),
    coordinateSource: "IMPORTED_ROUTE",
    sourceFileHash: args.sourceFileHash,
    sourceGeometryId: args.sourceGeometryId,
    routeRevision: args.routeRevision,
    geometryHash: args.geometryHash,
    sourceEndpoint,
    siteName: `${endpoint} Endpoint`,
    customerSiteId: "",
    address: "",
    city: "",
    state: "",
    facilityType: "",
    notes: "",
  };
}

export function deriveImportedRouteEndpointAuthority(args: {
  sourceGeometry: DALCoordinate[];
  sourceFileHash: string;
  sourceGeometryId: string;
  routeRevision: number;
  geometryHash: string;
  orientation?: RouteOrientation;
}): ImportedRouteEndpointAuthority {
  if (args.sourceGeometry.length < 2) throw new Error("Accepted route centerline requires at least two coordinates before A/Z derivation.");
  const sourceStartCoordinate = coordinateCopy(args.sourceGeometry[0]);
  const sourceEndCoordinate = coordinateCopy(args.sourceGeometry.at(-1) as DALCoordinate);
  const orientation = args.orientation ?? "SOURCE_START_TO_END";
  const reversed = orientation === "SOURCE_END_TO_START";
  return {
    orientation,
    originalSourceOrientation: "START_TO_END",
    sourceStartCoordinate,
    sourceEndCoordinate,
    aSite: site("A", reversed ? "END" : "START", reversed ? sourceEndCoordinate : sourceStartCoordinate, args),
    zSite: site("Z", reversed ? "START" : "END", reversed ? sourceStartCoordinate : sourceEndCoordinate, args),
  };
}

export function reverseImportedRouteEndpointAuthority(authority: ImportedRouteEndpointAuthority): ImportedRouteEndpointAuthority {
  const orientation = authority.orientation === "SOURCE_START_TO_END" ? "SOURCE_END_TO_START" : "SOURCE_START_TO_END";
  const next = deriveImportedRouteEndpointAuthority({
    sourceGeometry: [authority.sourceStartCoordinate, authority.sourceEndCoordinate],
    sourceFileHash: authority.aSite.sourceFileHash,
    sourceGeometryId: authority.aSite.sourceGeometryId,
    routeRevision: authority.aSite.routeRevision,
    geometryHash: authority.aSite.geometryHash,
    orientation,
  });
  return {
    ...next,
    aSite: { ...next.aSite, siteName: authority.zSite.siteName, customerSiteId: authority.zSite.customerSiteId, address: authority.zSite.address, city: authority.zSite.city, state: authority.zSite.state, facilityType: authority.zSite.facilityType, notes: authority.zSite.notes },
    zSite: { ...next.zSite, siteName: authority.aSite.siteName, customerSiteId: authority.aSite.customerSiteId, address: authority.aSite.address, city: authority.aSite.city, state: authority.aSite.state, facilityType: authority.aSite.facilityType, notes: authority.aSite.notes },
  };
}

export function orientedImportedRouteGeometry(sourceGeometry: DALCoordinate[], orientation: RouteOrientation): DALCoordinate[] {
  const copy = sourceGeometry.map(coordinateCopy);
  return orientation === "SOURCE_END_TO_START" ? copy.reverse() : copy;
}

function distanceFeet(a: DALCoordinate, b: DALCoordinate) {
  const earthRadiusFeet = 20_902_231;
  const latitudeA = a[1] * Math.PI / 180;
  const latitudeB = b[1] * Math.PI / 180;
  const latitudeDelta = (b[1] - a[1]) * Math.PI / 180;
  const longitudeDelta = (b[0] - a[0]) * Math.PI / 180;
  const haversine = Math.sin(latitudeDelta / 2) ** 2 + Math.cos(latitudeA) * Math.cos(latitudeB) * Math.sin(longitudeDelta / 2) ** 2;
  return 2 * earthRadiusFeet * Math.asin(Math.sqrt(haversine));
}

export function compareEndpointCoordinate(existing: DALCoordinate | null | undefined, candidate: DALCoordinate | null | undefined): {
  relationship: EndpointRelationship;
  distanceFeet: number | null;
} {
  if (!existing || !candidate) return { relationship: "UNRESOLVED", distanceFeet: null };
  const feet = distanceFeet(existing, candidate);
  return {
    relationship: feet <= 25 ? "MATCH" : feet <= 1_320 ? "NEAR" : "MISMATCH",
    distanceFeet: feet,
  };
}

export function enrichImportedEndpointSite(site: ImportedRouteEndpointSite, patch: Partial<Omit<ImportedRouteEndpointSite, "coordinate" | "coordinateSource" | "sourceFileHash" | "sourceGeometryId" | "routeRevision" | "geometryHash" | "sourceEndpoint" | "endpoint">>): ImportedRouteEndpointSite {
  return { ...site, ...patch, coordinate: coordinateCopy(site.coordinate) };
}
