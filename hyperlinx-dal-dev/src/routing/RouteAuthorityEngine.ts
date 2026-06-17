import type { DALCoordinate } from "../types/dal";
import type {
  CertifiedRoute,
  CertifiedRouteAuthorityFlags,
  CertifiedRouteCrossingSummary,
  CorridorBasis,
  ConstraintEvidenceStatus,
  RouteAuthorityState,
  RouteMode,
} from "./CertifiedRouteAuthority";

const FEET_PER_MILE = 5280;
const EARTH_RADIUS_FEET = 20902231;

export type RouteConstraintEvidence = {
  evidenceId?: string;
  evidenceHash?: string;
  routeGeometryHash?: string;
  status?: ConstraintEvidenceStatus;
  summary?: Partial<CertifiedRouteCrossingSummary> & Record<string, unknown>;
  constructabilityScore?: number;
  riskScore?: number;
  permitAuthorities?: string[];
  incomplete?: boolean;
};

export type CreateDraftRouteInput = {
  inventoryId: string;
  graphId: string;
  parentScopeVersionId?: string;
  scopeVersionId?: string;
  opportunitySeedId?: string;
  candidateSiteId?: string;
  candidateCoordinate: DALCoordinate;
  attachmentCoordinate: DALCoordinate;
  attachmentAuthorityId?: string;
  nearestRouteId?: string;
  nearestNodeId?: string;
  nearestStationId?: string;
  geometry?: DALCoordinate[];
  routeMode?: RouteMode;
  corridorBasis?: CorridorBasis;
  permitAuthorities?: string[];
};

export type RouteCertificationEngineer = {
  engineerId?: string;
  name: string;
  notes?: string;
  provisionalReason?: string;
};

function now() {
  return new Date().toISOString();
}

function createId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return `${prefix}-${crypto.randomUUID()}`;
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function validCoordinate(coordinate: DALCoordinate | undefined): coordinate is DALCoordinate {
  return (
    Array.isArray(coordinate) &&
    coordinate.length >= 2 &&
    Number.isFinite(Number(coordinate[0])) &&
    Number.isFinite(Number(coordinate[1])) &&
    Math.abs(Number(coordinate[0])) <= 180 &&
    Math.abs(Number(coordinate[1])) <= 90
  );
}

function normalizeCoordinate(coordinate: DALCoordinate): DALCoordinate {
  return [Number(coordinate[0]), Number(coordinate[1])];
}

function normalizeGeometry(geometry: DALCoordinate[]) {
  return geometry.filter(validCoordinate).map(normalizeCoordinate);
}

function distanceFeet(a: DALCoordinate, b: DALCoordinate) {
  const lat1 = (a[1] * Math.PI) / 180;
  const lat2 = (b[1] * Math.PI) / 180;
  const deltaLat = ((b[1] - a[1]) * Math.PI) / 180;
  const deltaLon = ((b[0] - a[0]) * Math.PI) / 180;
  const hav =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2);
  return 2 * EARTH_RADIUS_FEET * Math.atan2(Math.sqrt(hav), Math.sqrt(1 - hav));
}

function routeLengthFeet(geometry: DALCoordinate[]) {
  let total = 0;
  for (let index = 1; index < geometry.length; index += 1) total += distanceFeet(geometry[index - 1], geometry[index]);
  return total;
}

export function computeRouteGeometryHash(geometry: DALCoordinate[]) {
  const normalized = normalizeGeometry(geometry)
    .map(([lon, lat]) => `${lon.toFixed(7)},${lat.toFixed(7)}`)
    .join("|");
  let hash = 2166136261;
  for (let index = 0; index < normalized.length; index += 1) {
    hash ^= normalized.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `fnv1a-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function defaultCrossingSummary(): CertifiedRouteCrossingSummary {
  return {
    roadCrossings: "UNKNOWN",
    railCrossings: "UNKNOWN",
    waterCrossings: "UNKNOWN",
    parcelCrossings: "UNKNOWN",
    buildingConflicts: "UNKNOWN",
  };
}

function crossingSummaryFromEvidence(evidence?: RouteConstraintEvidence): CertifiedRouteCrossingSummary {
  const summary = evidence?.summary ?? {};
  return {
    roadCrossings: Number.isFinite(Number(summary.roadCrossings)) ? Number(summary.roadCrossings) : "UNKNOWN",
    railCrossings: Number.isFinite(Number(summary.railCrossings)) ? Number(summary.railCrossings) : "UNKNOWN",
    waterCrossings: Number.isFinite(Number(summary.waterCrossings)) ? Number(summary.waterCrossings) : "UNKNOWN",
    parcelCrossings: Number.isFinite(Number(summary.parcelCrossings)) ? Number(summary.parcelCrossings) : "UNKNOWN",
    buildingConflicts: Number.isFinite(Number(summary.buildingConflicts)) ? Number(summary.buildingConflicts) : "UNKNOWN",
  };
}

function classifyRouteMode(geometry: DALCoordinate[], requestedMode?: RouteMode): RouteMode {
  if (requestedMode) return requestedMode;
  if (geometry.length <= 2) return "DIRECT_FALLBACK";
  return "ENGINEER_DEFINED";
}

function stateForRoute(route: Pick<CertifiedRoute, "routeMode" | "routeAuthorityState" | "constraintEvidenceStatus" | "certification">) {
  if (route.routeAuthorityState === "REJECTED_ROUTE") return "REJECTED_ROUTE";
  if (route.routeMode === "DIRECT_FALLBACK") return "DIRECT_FALLBACK";
  if (route.certification.certifiedBy && route.certification.certifiedAt) {
    return route.certification.provisionalReason ? "PROVISIONALLY_CERTIFIED" : "CERTIFIED_ROUTE";
  }
  if (route.constraintEvidenceStatus !== "CURRENT") return "ENGINEER_REVIEW_REQUIRED";
  return "ENGINEER_REVIEW_REQUIRED";
}

function authorityForState(route: Pick<CertifiedRoute, "routeAuthorityState" | "routeMode" | "constraintEvidenceStatus" | "geometry">): CertifiedRouteAuthorityFlags {
  const requiredActions: string[] = [];
  const warnings: string[] = [];
  const certified = route.routeAuthorityState === "CERTIFIED_ROUTE";
  const provisional = route.routeAuthorityState === "PROVISIONALLY_CERTIFIED";

  if (route.geometry.length < 2) requiredActions.push("Create constructable route geometry.");
  if (route.routeMode === "DIRECT_FALLBACK") {
    requiredActions.push("Replace DIRECT_FALLBACK geometry with constructable route geometry.");
    warnings.push("DIRECT_FALLBACK routes are advisory only.");
  }
  if (route.constraintEvidenceStatus !== "CURRENT") requiredActions.push("Attach current deterministic constraint evidence.");
  if (!certified && !provisional) requiredActions.push("Human engineering certification required.");
  if (route.routeAuthorityState === "REJECTED_ROUTE") requiredActions.push("Route rejected; create a new draft or revise geometry.");
  if (route.routeAuthorityState === "BLOCKED") requiredActions.push("Route blocked; resolve authority blockers.");

  const authoritative = certified;
  return {
    canGenerateAuthoritativeQuote: authoritative,
    canCreateIOFPackage: authoritative,
    canCreateControlWork: authoritative,
    canCreateFieldWork: authoritative,
    canMutateTwinPlannedState: authoritative,
    requiredActions,
    warnings,
  };
}

function recompute(route: CertifiedRoute): CertifiedRoute {
  const geometry = normalizeGeometry(route.geometry);
  const geometryHash = computeRouteGeometryHash(geometry);
  const routeFeet = routeLengthFeet(geometry);
  const crowFlyFeet = distanceFeet(route.candidateCoordinate, route.attachmentCoordinate);
  const routeMode = classifyRouteMode(geometry, route.routeMode);
  const constraintEvidenceStatus =
    route.constraintEvidenceHash && route.constraintEvidenceStatus === "CURRENT" ? "CURRENT" : route.constraintEvidenceStatus;
  const routeAuthorityState = stateForRoute({ ...route, routeMode, constraintEvidenceStatus });
  const next: CertifiedRoute = {
    ...route,
    geometry,
    geometryHash,
    routeFeet,
    routeMiles: routeFeet / FEET_PER_MILE,
    crowFlyFeet,
    routeToCrowFlyRatio: crowFlyFeet > 0 ? routeFeet / crowFlyFeet : 0,
    routeMode,
    routeAuthorityState,
    constraintEvidenceStatus,
    updatedAt: now(),
  };
  return {
    ...next,
    authority: authorityForState(next),
  };
}

export function createDraftRoute(input: CreateDraftRouteInput): CertifiedRoute {
  const geometry = normalizeGeometry(input.geometry?.length ? input.geometry : [input.candidateCoordinate, input.attachmentCoordinate]);
  const timestamp = now();
  return recompute({
    certifiedRouteId: createId("CR"),
    routeAuthorityState: "DRAFT_ROUTE",
    routeMode: classifyRouteMode(geometry, input.routeMode),
    corridorBasis: input.corridorBasis ?? "UNKNOWN",
    inventoryId: input.inventoryId,
    graphId: input.graphId,
    parentScopeVersionId: input.parentScopeVersionId,
    scopeVersionId: input.scopeVersionId,
    opportunitySeedId: input.opportunitySeedId,
    candidateSiteId: input.candidateSiteId,
    candidateCoordinate: normalizeCoordinate(input.candidateCoordinate),
    attachmentCoordinate: normalizeCoordinate(input.attachmentCoordinate),
    attachmentAuthorityId: input.attachmentAuthorityId,
    nearestRouteId: input.nearestRouteId,
    nearestNodeId: input.nearestNodeId,
    nearestStationId: input.nearestStationId,
    geometry,
    geometryHash: computeRouteGeometryHash(geometry),
    routeFeet: 0,
    routeMiles: 0,
    crowFlyFeet: 0,
    routeToCrowFlyRatio: 0,
    constraintEvidenceStatus: "MISSING",
    crossingSummary: defaultCrossingSummary(),
    constructabilityScore: 0,
    riskScore: 100,
    permitAuthorities: input.permitAuthorities ?? [],
    certification: {},
    authority: {
      canGenerateAuthoritativeQuote: false,
      canCreateIOFPackage: false,
      canCreateControlWork: false,
      canCreateFieldWork: false,
      canMutateTwinPlannedState: false,
      requiredActions: [],
      warnings: [],
    },
    createdAt: timestamp,
    updatedAt: timestamp,
  });
}

export function evaluateRouteAuthority(route: CertifiedRoute): CertifiedRoute {
  return recompute(route);
}

export function attachConstraintEvidence(route: CertifiedRoute, evidence: RouteConstraintEvidence): CertifiedRoute {
  const geometryHash = computeRouteGeometryHash(route.geometry);
  const stale = Boolean(evidence.routeGeometryHash && evidence.routeGeometryHash !== geometryHash);
  const status: ConstraintEvidenceStatus = stale ? "STALE" : evidence.incomplete ? "INCOMPLETE" : evidence.status ?? "CURRENT";
  return recompute({
    ...route,
    constraintEvidenceId: evidence.evidenceId ?? route.constraintEvidenceId,
    constraintEvidenceHash: evidence.evidenceHash ?? route.constraintEvidenceHash,
    constraintEvidenceStatus: status,
    crossingSummary: crossingSummaryFromEvidence(evidence),
    constructabilityScore: Number.isFinite(Number(evidence.constructabilityScore)) ? Number(evidence.constructabilityScore) : route.constructabilityScore,
    riskScore: Number.isFinite(Number(evidence.riskScore)) ? Number(evidence.riskScore) : route.riskScore,
    permitAuthorities: Array.isArray(evidence.permitAuthorities) ? evidence.permitAuthorities : route.permitAuthorities,
  });
}

export function markGeometryEdited(route: CertifiedRoute, geometry: DALCoordinate[]): CertifiedRoute {
  const normalizedGeometry = normalizeGeometry(geometry);
  return recompute({
    ...route,
    geometry: normalizedGeometry,
    routeMode: route.routeMode === "DIRECT_FALLBACK" && normalizedGeometry.length > 2 ? "ENGINEER_DEFINED" : route.routeMode,
    corridorBasis: route.corridorBasis === "UNKNOWN" && normalizedGeometry.length > 2 ? "ENGINEER_DEFINED_CORRIDOR" : route.corridorBasis,
    routeAuthorityState: "ENGINEER_REVIEW_REQUIRED",
    constraintEvidenceStatus: route.constraintEvidenceId ? "STALE" : "MISSING",
    certification: {},
  });
}

export function certifyRoute(route: CertifiedRoute, engineer: RouteCertificationEngineer): CertifiedRoute {
  const evaluated = recompute(route);
  const name = engineer.name.trim();
  if (!name) throw new Error("Engineer name is required for route certification.");
  if (evaluated.routeMode === "DIRECT_FALLBACK") throw new Error("DIRECT_FALLBACK geometry cannot be certified as authoritative.");
  if (evaluated.constraintEvidenceStatus !== "CURRENT") throw new Error("Current constraint evidence is required before route certification.");
  const routeAuthorityState: RouteAuthorityState = engineer.provisionalReason ? "PROVISIONALLY_CERTIFIED" : "CERTIFIED_ROUTE";
  return recompute({
    ...evaluated,
    routeAuthorityState,
    certification: {
      certifiedBy: engineer.engineerId ? `${name} (${engineer.engineerId})` : name,
      certifiedAt: now(),
      certificationNotes: engineer.notes,
      provisionalReason: engineer.provisionalReason,
    },
  });
}

export function rejectRoute(route: CertifiedRoute, reason: string): CertifiedRoute {
  return recompute({
    ...route,
    routeAuthorityState: "REJECTED_ROUTE",
    certification: {
      ...route.certification,
      rejectionReason: reason || "Rejected during engineering review.",
    },
  });
}

export function canUseForQuote(route: CertifiedRoute) {
  return evaluateRouteAuthority(route).authority.canGenerateAuthoritativeQuote;
}

export function canUseForPackage(route: CertifiedRoute) {
  return evaluateRouteAuthority(route).authority.canCreateIOFPackage;
}

export function canUseForExecution(route: CertifiedRoute) {
  const authority = evaluateRouteAuthority(route).authority;
  return authority.canCreateControlWork && authority.canCreateFieldWork && authority.canMutateTwinPlannedState;
}
