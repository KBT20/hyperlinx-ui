import { haversineFeet } from "../affinity/geo";
import type { CandidateSite } from "../types/candidateSite";
import type { DALCoordinate, ScopeVersion } from "../types/dal";

export type AttachmentAuthoritySource = "CERTIFIED_INVENTORY_GEOMETRY" | "CERTIFIED_SCOPEVERSION" | "CERTIFIED_ATTACHMENT";

export type AttachmentAuthorityMethod =
  | "CERTIFIED_ATTACHMENT_POINT"
  | "EDGE_PROJECTION"
  | "STATION_REFERENCE"
  | "NODE_REFERENCE"
  | "ROUTE_SEGMENT_REFERENCE";

export type AttachmentAuthorityResult = {
  attachmentAuthority: AttachmentAuthoritySource;
  attachmentMethod: AttachmentAuthorityMethod;
  attachmentConfidence: number;
  stationId?: string;
  nodeId?: string;
  edgeId?: string;
  routeId?: string;
  attachmentCoordinate: DALCoordinate;
  authorityScopeVersionId: string;
  parentScopeVersionId?: string;
  evidence: string[];
  excludesReferenceLayers: true;
};

export type AttachmentAuthorityInput = {
  candidate?: CandidateSite;
  candidateCoordinate?: DALCoordinate;
  inventoryScopeVersion: ScopeVersion;
  station?: { stationId?: string; lon?: number; lat?: number; distanceFeet?: number };
  node?: { nodeId?: string; lon?: number; lat?: number; distanceFeet?: number };
  edge?: { edgeId?: string; routeId?: string; projectedLon?: number; projectedLat?: number; distanceFeet?: number };
  route?: { routeId?: string; coordinates?: DALCoordinate[] };
  certifiedAttachment?: { attachmentId?: string; routeId?: string; stationId?: string; nodeId?: string; edgeId?: string; coordinate?: DALCoordinate; lon?: number; lat?: number };
  attachmentCoordinate?: DALCoordinate;
};

function clampConfidence(value: number) {
  return Math.max(0.1, Math.min(0.99, Number(value.toFixed(2))));
}

function coordinateFromLonLat(value?: { lon?: number; lat?: number }) {
  const lon = Number(value?.lon);
  const lat = Number(value?.lat);
  return Number.isFinite(lon) && Number.isFinite(lat) ? ([lon, lat] as DALCoordinate) : undefined;
}

function coordinateFromCertifiedAttachment(value?: AttachmentAuthorityInput["certifiedAttachment"]) {
  if (!value) return undefined;
  if (Array.isArray(value.coordinate) && value.coordinate.length >= 2) return value.coordinate;
  return coordinateFromLonLat(value);
}

function firstRouteCoordinate(route?: AttachmentAuthorityInput["route"]) {
  return route?.coordinates?.find((coordinate) => Array.isArray(coordinate) && Number.isFinite(coordinate[0]) && Number.isFinite(coordinate[1]));
}

function authorityForScopeVersion(scopeVersion: ScopeVersion): AttachmentAuthoritySource {
  if (scopeVersion.certificationState === "CERTIFIED" && scopeVersion.source !== "InventoryGraph") return "CERTIFIED_SCOPEVERSION";
  return "CERTIFIED_INVENTORY_GEOMETRY";
}

function confidenceFor(method: AttachmentAuthorityMethod, distanceFeet?: number) {
  const base: Record<AttachmentAuthorityMethod, number> = {
    CERTIFIED_ATTACHMENT_POINT: 0.96,
    EDGE_PROJECTION: 0.92,
    STATION_REFERENCE: 0.86,
    NODE_REFERENCE: 0.82,
    ROUTE_SEGMENT_REFERENCE: 0.72,
  };
  const penalty = Math.min(0.24, Number(distanceFeet ?? 0) / 8000);
  return clampConfidence(base[method] - penalty);
}

export function resolveAttachmentAuthority(input: AttachmentAuthorityInput): AttachmentAuthorityResult | null {
  const scopeVersionId = input.inventoryScopeVersion.scopeVersionId;
  const parentScopeVersionId = input.inventoryScopeVersion.parentScopeVersionId;
  const candidateCoordinate = input.candidateCoordinate;
  const certifiedAttachmentCoordinate = coordinateFromCertifiedAttachment(input.certifiedAttachment);
  const edgeCoordinate = input.attachmentCoordinate ?? coordinateFromLonLat({ lon: input.edge?.projectedLon, lat: input.edge?.projectedLat });
  const stationCoordinate = coordinateFromLonLat(input.station);
  const nodeCoordinate = coordinateFromLonLat(input.node);
  const routeCoordinate = firstRouteCoordinate(input.route);

  const selected =
    certifiedAttachmentCoordinate
      ? {
          method: "CERTIFIED_ATTACHMENT_POINT" as const,
          coordinate: certifiedAttachmentCoordinate,
          distanceFeet: candidateCoordinate ? haversineFeet(candidateCoordinate, certifiedAttachmentCoordinate) : 0,
          authority: "CERTIFIED_ATTACHMENT" as const,
        }
      : edgeCoordinate
        ? {
            method: "EDGE_PROJECTION" as const,
            coordinate: edgeCoordinate,
            distanceFeet: input.edge?.distanceFeet ?? (candidateCoordinate ? haversineFeet(candidateCoordinate, edgeCoordinate) : 0),
            authority: authorityForScopeVersion(input.inventoryScopeVersion),
          }
        : stationCoordinate
          ? {
              method: "STATION_REFERENCE" as const,
              coordinate: stationCoordinate,
              distanceFeet: input.station?.distanceFeet ?? (candidateCoordinate ? haversineFeet(candidateCoordinate, stationCoordinate) : 0),
              authority: authorityForScopeVersion(input.inventoryScopeVersion),
            }
          : nodeCoordinate
            ? {
                method: "NODE_REFERENCE" as const,
                coordinate: nodeCoordinate,
                distanceFeet: input.node?.distanceFeet ?? (candidateCoordinate ? haversineFeet(candidateCoordinate, nodeCoordinate) : 0),
                authority: authorityForScopeVersion(input.inventoryScopeVersion),
              }
            : routeCoordinate
              ? {
                  method: "ROUTE_SEGMENT_REFERENCE" as const,
                  coordinate: routeCoordinate,
                  distanceFeet: candidateCoordinate ? haversineFeet(candidateCoordinate, routeCoordinate) : 0,
                  authority: authorityForScopeVersion(input.inventoryScopeVersion),
                }
              : null;

  if (!selected) return null;

  return {
    attachmentAuthority: selected.authority,
    attachmentMethod: selected.method,
    attachmentConfidence: confidenceFor(selected.method, selected.distanceFeet),
    stationId: input.certifiedAttachment?.stationId ?? input.station?.stationId,
    nodeId: input.certifiedAttachment?.nodeId ?? input.node?.nodeId,
    edgeId: input.certifiedAttachment?.edgeId ?? input.edge?.edgeId,
    routeId: input.certifiedAttachment?.routeId ?? input.edge?.routeId ?? input.route?.routeId,
    attachmentCoordinate: selected.coordinate,
    authorityScopeVersionId: scopeVersionId,
    parentScopeVersionId,
    evidence: [
      "Attachment authority is resolved only from certified inventory, certified ScopeVersion geometry, or certified attachment points.",
      "Geographic reference layers are excluded from attachment authority.",
      `Selected method: ${selected.method}`,
    ],
    excludesReferenceLayers: true,
  };
}
