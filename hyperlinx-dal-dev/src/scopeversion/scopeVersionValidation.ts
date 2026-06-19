import type {
  DALCoordinate,
  ScopeVersion,
  ScopeVersionCanonicalTruth,
  ScopeVersionStatus,
  ValidationStatus,
} from "../types/dal";
import { calculateScopeVersionProgress } from "./ClosureAuthorityEngine";
import { validateScopeVersionStationing } from "./ScopeVersionStationingValidator";

export type ScopeVersionValidationIssue = {
  field: string;
  status: ValidationStatus;
  message: string;
};

export type ScopeVersionValidationResult = {
  status: ValidationStatus;
  valid: boolean;
  errors: ScopeVersionValidationIssue[];
  warnings: ScopeVersionValidationIssue[];
};

export const SCOPEVERSION_STATUS_TRANSITIONS: Record<ScopeVersionStatus, ScopeVersionStatus[]> = {
  DRAFT: ["ANALYZED", "PROVISIONALLY_CERTIFIED", "QUOTED", "APPROVED", "RELEASED_TO_CONTROL", "IN_FIELD", "PARTIALLY_COMPLETE", "COMPLETE", "VERIFIED", "BLOCKED", "REJECTED"],
  ANALYZED: ["PROVISIONALLY_CERTIFIED", "QUOTED", "APPROVED", "RELEASED_TO_CONTROL", "BLOCKED", "REJECTED"],
  PROVISIONALLY_CERTIFIED: ["QUOTED", "APPROVED", "RELEASED_TO_CONTROL", "BLOCKED", "REJECTED"],
  QUOTED: ["APPROVED", "RELEASED_TO_CONTROL", "BLOCKED", "REJECTED"],
  APPROVED: ["RELEASED_TO_CONTROL", "ACTIVATED", "BLOCKED", "REJECTED"],
  RELEASED_TO_CONTROL: ["IN_FIELD", "PARTIALLY_COMPLETE", "COMPLETE", "BLOCKED", "REJECTED"],
  IN_FIELD: ["PARTIALLY_COMPLETE", "COMPLETE", "VERIFIED", "BLOCKED", "REJECTED"],
  PARTIALLY_COMPLETE: ["IN_FIELD", "COMPLETE", "VERIFIED", "BLOCKED", "REJECTED"],
  ACTIVATED: ["IN_CONSTRUCTION", "IN_FIELD", "PARTIALLY_COMPLETE", "COMPLETE", "BLOCKED", "REJECTED"],
  IN_CONSTRUCTION: ["PARTIALLY_COMPLETE", "COMPLETE", "VERIFIED", "BLOCKED", "REJECTED"],
  COMPLETE: ["VERIFIED", "OPERATIONAL", "BLOCKED", "REJECTED"],
  VERIFIED: ["OPERATIONAL", "BLOCKED", "REJECTED"],
  OPERATIONAL: ["BLOCKED", "REJECTED"],
  BLOCKED: ["IN_FIELD", "PARTIALLY_COMPLETE", "REJECTED"],
  REJECTED: [],
};

const IMMUTABLE_CANONICAL_KEYS: Array<keyof ScopeVersionCanonicalTruth> = [
  "graphReference",
  "networkBasis",
  "geographicBasis",
  "engineeringBasis",
  "financialBasis",
  "riskBasis",
  "decisionBasis",
  "sourceCandidate",
  "sourceOpportunity",
  "stations",
  "objects",
  "stationing",
  "objectPlacement",
  "certificationSnapshot",
];

const IMMUTABLE_TOP_LEVEL_KEYS: Array<keyof ScopeVersion> = [
  "scopeVersionId",
  "inventoryId",
  "graphId",
  "graphVersion",
  "candidateSiteId",
  "sourceOpportunityId",
  "createdBy",
  "source",
  "geometry",
  "attachmentPoint",
  "candidateSite",
  "latitude",
  "longitude",
  "attachmentCoordinates",
  "nearestRoute",
  "nearestNode",
  "nearestStation",
  "buildPath",
  "buildFeet",
  "buildMiles",
  "crossings",
  "permits",
  "constructability",
  "financialInputs",
  "decisionRecommendation",
  "certificationSnapshot",
  "serviceabilityAssessment",
  "graphReference",
  "certifiedRouteReference",
  "decisionTimestamp",
  "user",
  "station",
  "route",
  "createdAt",
];

function isCoordinate(value: unknown): value is DALCoordinate {
  return (
    Array.isArray(value) &&
    value.length >= 2 &&
    Number.isFinite(Number(value[0])) &&
    Number.isFinite(Number(value[1]))
  );
}

function isCoordinateArray(value: unknown) {
  return Array.isArray(value) && value.length >= 2 && value.every(isCoordinate);
}

function hasNumber(value: unknown) {
  return Number.isFinite(Number(value));
}

function error(field: string, message: string): ScopeVersionValidationIssue {
  return { field, status: "FAIL", message };
}

function warning(field: string, message: string): ScopeVersionValidationIssue {
  return { field, status: "WARNING", message };
}

export function canTransitionScopeVersion(from: ScopeVersionStatus, to: ScopeVersionStatus) {
  if (from === to) return true;
  return SCOPEVERSION_STATUS_TRANSITIONS[from]?.includes(to) ?? false;
}

export function assertScopeVersionTransition(from: ScopeVersionStatus, to: ScopeVersionStatus) {
  if (!canTransitionScopeVersion(from, to)) {
    throw new Error(`Invalid ScopeVersion status transition: ${from} -> ${to}`);
  }
}

export function validateScopeVersion(scopeVersion: ScopeVersion): ScopeVersionValidationResult {
  const truth = scopeVersion.canonicalTruth ?? {};
  const graphReference = truth.graphReference ?? (scopeVersion.graphReference as any);
  const network = truth.networkBasis;
  const geographic = truth.geographicBasis;
  const engineering = truth.engineeringBasis;
  const financial = truth.financialBasis;
  const decision = truth.decisionBasis;
  const requiresEngineeringCertification = truth.decisionType === "PrismSiteDecision" || scopeVersion.status !== "DRAFT";
  const certificationSnapshot = truth.certificationSnapshot ?? scopeVersion.certificationSnapshot;
  const certifiedRouteReference = scopeVersion.certifiedRouteReference ?? (truth as any).certifiedRouteReference;
  const serviceability = truth.serviceabilityAssessment ?? scopeVersion.serviceabilityAssessment ?? (certificationSnapshot as any)?.serviceabilityAssessment;
  const attachmentCertification = truth.engineeringBasis?.attachmentCertification ?? (certificationSnapshot as any)?.attachmentPoint;
  const lateralCertification = truth.engineeringBasis?.lateralCertification ?? (certificationSnapshot as any)?.lateralPath;
  const errors: ScopeVersionValidationIssue[] = [];
  const warnings: ScopeVersionValidationIssue[] = [];

  if (!scopeVersion.scopeVersionId) errors.push(error("scopeVersionId", "ScopeVersion ID is required."));
  if (!scopeVersion.createdAt) errors.push(error("createdAt", "Creation timestamp is required."));
  if (!scopeVersion.createdBy && !scopeVersion.user) errors.push(error("createdBy", "Creator is required."));
  if (!scopeVersion.decisionTimestamp) errors.push(error("decisionTimestamp", "Decision timestamp is required."));
  if (!scopeVersion.status) errors.push(error("status", "Lifecycle status is required."));

  if (!graphReference?.graphId && !scopeVersion.graphId) errors.push(error("graphReference.graphId", "Graph ID is required."));
  if (!graphReference?.graphVersion && !scopeVersion.graphVersion) errors.push(error("graphReference.graphVersion", "Graph version is required."));

  if (!scopeVersion.candidateSiteId && !truth.sourceCandidate?.candidateSiteId) {
    errors.push(error("candidateSiteId", "Source candidate is required."));
  }

  if (!network?.routeId) errors.push(error("networkBasis.routeId", "Route ID is required."));
  if (!network?.nodeId) errors.push(error("networkBasis.nodeId", "Node ID is required."));
  if (!network?.stationId) errors.push(error("networkBasis.stationId", "Station ID is required."));
  if (!isCoordinate(network?.attachmentCoordinates ?? network?.attachmentPoint)) {
    errors.push(error("networkBasis.attachmentCoordinates", "Attachment coordinates are required."));
  }

  if (!hasNumber(geographic?.candidateLatitude) || !hasNumber(geographic?.candidateLongitude)) {
    errors.push(error("geographicBasis.candidate", "Candidate latitude and longitude are required."));
  }
  if (!isCoordinateArray(geographic?.geometry)) errors.push(error("geographicBasis.geometry", "Build path geometry is required."));
  if (!geographic?.buildPath) errors.push(error("geographicBasis.buildPath", "Build path object is required."));
  if (!isCoordinateArray(geographic?.routeGeometry)) warnings.push(warning("geographicBasis.routeGeometry", "Route geometry is missing or too small."));
  if (!isCoordinate(geographic?.stationGeometry)) warnings.push(warning("geographicBasis.stationGeometry", "Station geometry is missing."));
  if (!isCoordinate(geographic?.nodeGeometry)) warnings.push(warning("geographicBasis.nodeGeometry", "Node geometry is missing."));

  if (!hasNumber(engineering?.buildFeet) || Number(engineering?.buildFeet ?? 0) <= 0) {
    errors.push(error("engineeringBasis.buildFeet", "Build feet must be greater than zero."));
  }
  if (!hasNumber(engineering?.buildMiles)) errors.push(error("engineeringBasis.buildMiles", "Build miles are required."));

  if (!financial) {
    errors.push(error("financialBasis", "Financial basis is required."));
  } else {
    if (!hasNumber(financial.NRC)) errors.push(error("financialBasis.NRC", "NRC is required."));
    if (!hasNumber(financial.MRC)) errors.push(error("financialBasis.MRC", "MRC is required."));
    if (!hasNumber(financial.TCV)) errors.push(error("financialBasis.TCV", "TCV is required."));
  }

  if (!decision?.recommendation) errors.push(error("decisionBasis.recommendation", "GO / NO_GO / REVIEW recommendation is required."));

  if (requiresEngineeringCertification) {
    if (!certificationSnapshot) {
      errors.push(error("certificationSnapshot", "Certified engineering snapshot is required."));
    }
    if (!attachmentCertification) {
      errors.push(error("engineeringBasis.attachmentCertification", "Certified attachment point is required."));
    } else if ((attachmentCertification as any).certificationStatus === "FAILED") {
      errors.push(error("engineeringBasis.attachmentCertification", "Attachment certification failed."));
    }
    if (!lateralCertification) {
      errors.push(error("engineeringBasis.lateralCertification", "Certified lateral path is required."));
    } else if ((lateralCertification as any).certificationStatus === "FAILED") {
      errors.push(error("engineeringBasis.lateralCertification", "Lateral certification failed."));
    }
    if (!serviceability) {
      errors.push(error("serviceabilityAssessment", "Serviceability assessment is required."));
    } else if ((serviceability as any).status === "NOT_SERVICEABLE" || !(serviceability as any).serviceable) {
      errors.push(error("serviceabilityAssessment", "ScopeVersion cannot be created from a NOT_SERVICEABLE site."));
    }
    if (!certifiedRouteReference) {
      errors.push(error("certifiedRouteReference", "CertifiedRoute reference is required for authoritative ScopeVersion workflows."));
    } else if (!["CERTIFIED_ROUTE", "PROVISIONALLY_CERTIFIED"].includes(String(certifiedRouteReference.routeAuthorityState))) {
      errors.push(error("certifiedRouteReference.routeAuthorityState", "Route authority must be CERTIFIED_ROUTE or PROVISIONALLY_CERTIFIED."));
    }
    const stationingValidation = validateScopeVersionStationing(scopeVersion);
    stationingValidation.errors.forEach((item) => errors.push(error(item.field, item.message)));
    stationingValidation.warnings.forEach((item) => warnings.push(warning(item.field, item.message)));
    const progress = calculateScopeVersionProgress(scopeVersion);
    if (progress.closureAuthorityStatus !== "PASS") {
      errors.push(error("closureAuthority.progress", "ClosureAuthorityEngine requires stations and objects before field closure readiness."));
    }
    const routeStationStates = new Set(["PLANNED", "RELEASED", "IN_PROGRESS", "COMPLETE", "VERIFIED", "BLOCKED", "REJECTED"]);
    const objectStates = new Set(["PLANNED", "RELEASED", "INSTALLED", "TESTED", "ACCEPTED", "COMPLETE", "VERIFIED", "BLOCKED", "REJECTED"]);
    const stations = Array.isArray(truth.stations) ? truth.stations : [];
    const objects = Array.isArray(truth.objects) ? truth.objects : [];
    const stationIds = new Set(stations.map((station: any) => station?.stationId).filter(Boolean));
    const objectIds = new Set(objects.map((object: any) => object?.objectId).filter(Boolean));
    stations.forEach((station: any) => {
      if (station?.stationState && !routeStationStates.has(String(station.stationState))) {
        errors.push(error(`stations.${station.stationId}.stationState`, `Invalid station state ${station.stationState}.`));
      }
    });
    objects.forEach((object: any) => {
      if (object?.objectState && !objectStates.has(String(object.objectState))) {
        errors.push(error(`objects.${object.objectId}.objectState`, `Invalid object state ${object.objectState}.`));
      }
    });
    const closures = [...(Array.isArray(scopeVersion.closures) ? scopeVersion.closures : []), ...(Array.isArray(truth.closures) ? truth.closures : [])];
    closures.forEach((closure: any) => {
      if (closure.stationId && !stationIds.has(closure.stationId)) {
        errors.push(error(`closures.${closure.closureId}.stationId`, "Closure stationId must reference a ScopeVersion station."));
      }
      if (closure.stationStartId && !stationIds.has(closure.stationStartId)) {
        errors.push(error(`closures.${closure.closureId}.stationStartId`, "Closure stationStartId must reference a ScopeVersion station."));
      }
      if (closure.stationEndId && !stationIds.has(closure.stationEndId)) {
        errors.push(error(`closures.${closure.closureId}.stationEndId`, "Closure stationEndId must reference a ScopeVersion station."));
      }
      (Array.isArray(closure.objectIds) ? closure.objectIds : []).forEach((objectId: string) => {
        if (!objectIds.has(objectId)) {
          errors.push(error(`closures.${closure.closureId}.objectIds`, `Closure objectId ${objectId} must reference a ScopeVersion object.`));
        }
      });
    });
  }

  const status: ValidationStatus = errors.length ? "FAIL" : warnings.length ? "WARNING" : "PASS";
  return {
    status,
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

export function assertValidScopeVersion(scopeVersion: ScopeVersion) {
  const result = validateScopeVersion(scopeVersion);
  if (!result.valid) {
    throw new Error(`Invalid ScopeVersion ${scopeVersion.scopeVersionId}: ${result.errors.map((item) => item.message).join(" ")}`);
  }
  return result;
}

export function mergeImmutableScopeVersion(existing: ScopeVersion | undefined, next: ScopeVersion) {
  if (!existing) return next;
  assertScopeVersionTransition(existing.status, next.status);

  const existingClosureCount = Math.max(existing.closures?.length ?? 0, Array.isArray(existing.canonicalTruth?.closures) ? existing.canonicalTruth.closures.length : 0);
  const nextClosureCount = Math.max(next.closures?.length ?? 0, Array.isArray(next.canonicalTruth?.closures) ? next.canonicalTruth.closures.length : 0);
  const hasClosureAuthorityChange = nextClosureCount > existingClosureCount;
  const canonicalTruth: ScopeVersionCanonicalTruth = {
    ...next.canonicalTruth,
  };
  for (const key of IMMUTABLE_CANONICAL_KEYS) {
    if (hasClosureAuthorityChange && (key === "stations" || key === "objects")) {
      (canonicalTruth as any)[key] = next.canonicalTruth?.[key] ?? existing.canonicalTruth?.[key];
      continue;
    }
    (canonicalTruth as any)[key] = existing.canonicalTruth?.[key] ?? next.canonicalTruth?.[key];
  }

  const merged: ScopeVersion = {
    ...next,
    canonicalTruth: {
      ...canonicalTruth,
      quoteBasis: next.canonicalTruth?.quoteBasis ?? existing.canonicalTruth?.quoteBasis,
      commercial: next.canonicalTruth?.commercial ?? existing.canonicalTruth?.commercial,
      validation: next.canonicalTruth?.validation ?? existing.canonicalTruth?.validation,
      closures: next.canonicalTruth?.closures ?? existing.canonicalTruth?.closures,
      progress: next.canonicalTruth?.progress ?? existing.canonicalTruth?.progress,
      lifecycleState: next.canonicalTruth?.lifecycleState ?? existing.canonicalTruth?.lifecycleState,
    },
  };

  for (const key of IMMUTABLE_TOP_LEVEL_KEYS) {
    (merged as any)[key] = (existing as any)[key] ?? (next as any)[key];
  }

  return merged;
}
