import type {
  DALCoordinate,
  ScopeVersion,
  ScopeVersionCanonicalTruth,
  ScopeVersionStatus,
  ValidationStatus,
} from "../types/dal";

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
  DRAFT: ["ANALYZED", "REJECTED"],
  ANALYZED: ["QUOTED", "APPROVED", "REJECTED"],
  QUOTED: ["APPROVED", "REJECTED"],
  APPROVED: ["ACTIVATED", "REJECTED"],
  ACTIVATED: ["IN_CONSTRUCTION", "COMPLETE", "REJECTED"],
  IN_CONSTRUCTION: ["COMPLETE"],
  COMPLETE: [],
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

  const canonicalTruth: ScopeVersionCanonicalTruth = {
    ...next.canonicalTruth,
  };
  for (const key of IMMUTABLE_CANONICAL_KEYS) {
    canonicalTruth[key] = existing.canonicalTruth?.[key] ?? next.canonicalTruth?.[key];
  }

  const merged: ScopeVersion = {
    ...next,
    canonicalTruth: {
      ...canonicalTruth,
      quoteBasis: next.canonicalTruth?.quoteBasis ?? existing.canonicalTruth?.quoteBasis,
      commercial: next.canonicalTruth?.commercial ?? existing.canonicalTruth?.commercial,
      validation: next.canonicalTruth?.validation ?? existing.canonicalTruth?.validation,
    },
  };

  for (const key of IMMUTABLE_TOP_LEVEL_KEYS) {
    (merged as any)[key] = (existing as any)[key] ?? (next as any)[key];
  }

  return merged;
}
