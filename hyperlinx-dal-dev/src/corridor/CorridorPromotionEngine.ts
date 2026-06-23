import type {
  CorridorEndpoint,
  CorridorEvidence,
  CorridorEvidenceEntityType,
} from "./corridorTypes";
import type {
  CorridorPromotionBlocker,
  CorridorPromotionEvaluation,
  CorridorPromotionEvidenceCategory,
  CorridorPromotionEvidenceRequirement,
  CorridorPromotionInput,
  CorridorPromotionStatus,
  CorridorScopeVersionDraft,
} from "./corridorPromotion";

const DEFAULT_ROUTE_CONFIDENCE_THRESHOLD = 60;

function promotionIdFor(input: CorridorPromotionInput) {
  return input.promotionId ?? `PROMO-${input.corridor.corridorId}-${input.routeCandidate?.routeCandidateId ?? "NO_ROUTE"}`;
}

function blocker(args: Omit<CorridorPromotionBlocker, "blockerId">): CorridorPromotionBlocker {
  return {
    blockerId: `blocker-${args.code.toLowerCase()}-${args.entityId ?? "global"}`,
    ...args,
  };
}

function requirement(args: Omit<CorridorPromotionEvidenceRequirement, "requirementId">): CorridorPromotionEvidenceRequirement {
  return {
    requirementId: `req-${args.category.toLowerCase()}-${args.code.toLowerCase()}-${args.entityId ?? "global"}`,
    ...args,
  };
}

function isFiniteCoordinate(latitude?: number, longitude?: number) {
  return Number.isFinite(latitude) && Number.isFinite(longitude) && Math.abs(Number(latitude)) <= 90 && Math.abs(Number(longitude)) <= 180;
}

function evidenceFor(
  evidence: CorridorEvidence[],
  entityType: CorridorEvidenceEntityType,
  entityId: string
) {
  return evidence.filter((item) => item.entityType === entityType && item.entityId === entityId);
}

function bestConfidence(evidence: CorridorEvidence[]) {
  return evidence.reduce((best, item) => Math.max(best, item.confidence), 0);
}

function pushRequirement(
  requirements: CorridorPromotionEvidenceRequirement[],
  category: CorridorPromotionEvidenceCategory,
  code: string,
  description: string,
  entityType?: CorridorEvidenceEntityType,
  entityId?: string,
  satisfiedByEvidenceId?: string
) {
  requirements.push(
    requirement({
      category,
      code,
      description,
      entityType,
      entityId,
      required: true,
      satisfiedByEvidenceId,
    })
  );
}

function firstEvidenceId(items: CorridorEvidence[]) {
  return items[0]?.evidenceId;
}

function collectSatisfiedEvidenceIds(requirements: CorridorPromotionEvidenceRequirement[]) {
  return Array.from(new Set(requirements.map((item) => item.satisfiedByEvidenceId).filter((id): id is string => Boolean(id))));
}

function deriveStatus(
  blockers: CorridorPromotionBlocker[],
  missingEvidence: CorridorPromotionEvidenceRequirement[],
  reviewedBy?: string
): CorridorPromotionStatus {
  if (blockers.some((item) => item.severity === "BLOCKING")) return "EVIDENCE_COLLECTING";
  if (missingEvidence.length > 0) return "EVIDENCE_COLLECTING";
  if (!reviewedBy) return "ENGINEERING_REVIEW";
  return "PROMOTION_READY";
}

function endpointByRole(endpoints: CorridorEndpoint[], role: CorridorEndpoint["role"]) {
  return endpoints.find((endpoint) => endpoint.role === role);
}

function countRouteVertices(input: CorridorPromotionInput) {
  return input.routeCandidate?.geometry.filter((coord) => Number.isFinite(coord[0]) && Number.isFinite(coord[1])).length ?? 0;
}

export function evaluateCorridorPromotionReadiness(input: CorridorPromotionInput): CorridorPromotionEvaluation {
  const promotionId = promotionIdFor(input);
  const routeCandidateId = input.routeCandidate?.routeCandidateId ?? "NO_ROUTE_CANDIDATE";
  const requirements: CorridorPromotionEvidenceRequirement[] = [];
  const blockers: CorridorPromotionBlocker[] = [];
  const warnings: CorridorPromotionBlocker[] = [];
  const routeConfidenceThreshold = input.routeConfidenceThreshold ?? DEFAULT_ROUTE_CONFIDENCE_THRESHOLD;

  const aEndpoint = endpointByRole(input.endpoints, "A_END");
  const zEndpoint = endpointByRole(input.endpoints, "Z_END");

  for (const endpoint of [aEndpoint, zEndpoint]) {
    if (!endpoint) continue;
    const endpointEvidence = evidenceFor(input.evidence, "ENDPOINT", endpoint.endpointId);
    pushRequirement(
      requirements,
      "ENDPOINT",
      `${endpoint.role}_EVIDENCE`,
      `${endpoint.role} endpoint evidence`,
      "ENDPOINT",
      endpoint.endpointId,
      firstEvidenceId(endpointEvidence)
    );
    if (!isFiniteCoordinate(endpoint.latitude, endpoint.longitude)) {
      blockers.push(
        blocker({
          code: "MISSING_ENDPOINT_COORDINATES",
          severity: "BLOCKING",
          message: `${endpoint.role} endpoint is missing valid coordinates.`,
          entityId: endpoint.endpointId,
          evidenceId: firstEvidenceId(endpointEvidence),
        })
      );
    }
    if (bestConfidence(endpointEvidence) <= 0) {
      blockers.push(
        blocker({
          code: "MISSING_ENDPOINT_CONFIDENCE",
          severity: "BLOCKING",
          message: `${endpoint.role} endpoint lacks confidence-bearing evidence.`,
          entityId: endpoint.endpointId,
        })
      );
    }
  }

  if (!aEndpoint) {
    blockers.push(
      blocker({
        code: "MISSING_A_ENDPOINT",
        severity: "BLOCKING",
        message: "Corridor promotion requires an A endpoint.",
      })
    );
  }
  if (!zEndpoint) {
    blockers.push(
      blocker({
        code: "MISSING_Z_ENDPOINT",
        severity: "BLOCKING",
        message: "Corridor promotion requires a Z endpoint.",
      })
    );
  }

  const routeCandidate = input.routeCandidate;
  if (!routeCandidate) {
    blockers.push(
      blocker({
        code: "NO_ROUTE_CANDIDATE_SELECTED",
        severity: "BLOCKING",
        message: "No CorridorRouteCandidate was selected for promotion.",
      })
    );
  } else {
    const routeEvidence = evidenceFor(input.evidence, "ROUTE_CANDIDATE", routeCandidate.routeCandidateId);
    pushRequirement(
      requirements,
      "ROUTE",
      "ROUTE_GEOMETRY",
      "Route geometry evidence",
      "ROUTE_CANDIDATE",
      routeCandidate.routeCandidateId,
      firstEvidenceId(routeEvidence)
    );
    if (countRouteVertices(input) < 2 || routeCandidate.distanceMiles <= 0) {
      blockers.push(
        blocker({
          code: "INVALID_GEOMETRY",
          severity: "BLOCKING",
          message: "Route candidate geometry must contain at least two valid coordinates and positive distance.",
          entityId: routeCandidate.routeCandidateId,
          evidenceId: firstEvidenceId(routeEvidence),
        })
      );
    }
    if (bestConfidence(routeEvidence) < routeConfidenceThreshold) {
      blockers.push(
        blocker({
          code: "ROUTE_CONFIDENCE_BELOW_THRESHOLD",
          severity: "BLOCKING",
          message: `Route confidence is below threshold ${routeConfidenceThreshold}.`,
          entityId: routeCandidate.routeCandidateId,
          evidenceId: firstEvidenceId(routeEvidence),
        })
      );
    }
  }

  const activeRequirements = input.requirements ?? input.corridor.requirements;
  const firstRequirement = activeRequirements[0];
  if (!firstRequirement) {
    blockers.push(
      blocker({
        code: "MISSING_CUSTOMER_REQUIREMENT",
        severity: "BLOCKING",
        message: "Promotion requires bandwidth/service, topology, availability, diversity, and commercial intent.",
        entityId: input.corridor.corridorId,
      })
    );
  } else {
    const requirementEvidence = evidenceFor(input.evidence, "CORRIDOR", input.corridor.corridorId);
    pushRequirement(
      requirements,
      "REQUIREMENT",
      "CUSTOMER_REQUIREMENT",
      "Customer requirement evidence",
      "CORRIDOR",
      input.corridor.corridorId,
      firstEvidenceId(requirementEvidence)
    );
    if (!firstRequirement.bandwidth && !firstRequirement.serviceType && !firstRequirement.transportCapacity) {
      blockers.push(
        blocker({
          code: "MISSING_SERVICE_INTENT",
          severity: "BLOCKING",
          message: "Requirement must include bandwidth, service type, or transport capacity.",
          entityId: firstRequirement.requirementId,
        })
      );
    }
    if (!firstRequirement.availabilityTarget) {
      blockers.push(
        blocker({
          code: "MISSING_AVAILABILITY_TARGET",
          severity: "BLOCKING",
          message: "Requirement must include an availability target.",
          entityId: firstRequirement.requirementId,
        })
      );
    }
    if (!firstRequirement.commercialPreference && !firstRequirement.serviceType) {
      blockers.push(
        blocker({
          code: "MISSING_COMMERCIAL_PRODUCT_INTENT",
          severity: "BLOCKING",
          message: "Requirement must include commercial product intent.",
          entityId: firstRequirement.requirementId,
        })
      );
    }
  }

  const jurisdictionEvidenceId = firstEvidenceId(input.evidence.filter((item) => item.entityType === "JURISDICTION"));
  const crossingEvidenceId = firstEvidenceId(input.evidence.filter((item) => item.entityType === "CROSSING"));
  const constraintEvidenceId = firstEvidenceId(input.evidence.filter((item) => item.entityType === "CONSTRAINT"));
  pushRequirement(requirements, "BUILDABILITY", "JURISDICTION_SUMMARY", "Jurisdiction summary", undefined, undefined, jurisdictionEvidenceId);
  pushRequirement(requirements, "BUILDABILITY", "CROSSING_SUMMARY", "Crossing summary", undefined, undefined, crossingEvidenceId);
  pushRequirement(requirements, "BUILDABILITY", "CONSTRAINT_SUMMARY", "Constraint summary", undefined, undefined, constraintEvidenceId);

  if ((input.jurisdictions ?? []).length === 0) {
    blockers.push(blocker({ code: "MISSING_JURISDICTION_SUMMARY", severity: "BLOCKING", message: "Promotion requires jurisdiction summary evidence." }));
  }
  if ((input.crossings ?? []).length === 0) {
    warnings.push(blocker({ code: "NO_CROSSINGS_IDENTIFIED", severity: "WARNING", message: "No crossings are identified; verify that this is a true zero-crossing route." }));
  }
  const unresolvedHighConstraints = (input.constraints ?? []).filter((constraint) => ["HIGH", "CRITICAL"].includes(constraint.severity) && !constraint.mitigation);
  if (unresolvedHighConstraints.length > 0) {
    for (const constraint of unresolvedHighConstraints) {
      blockers.push(
        blocker({
          code: "UNRESOLVED_HIGH_SEVERITY_CONSTRAINT",
          severity: "BLOCKING",
          message: `Constraint ${constraint.constraintId} requires mitigation before promotion.`,
          entityId: constraint.constraintId,
          evidenceId: constraint.evidenceIds[0],
        })
      );
    }
  }
  if (!Number.isFinite(input.routeCandidate?.constructabilityScore)) {
    blockers.push(blocker({ code: "MISSING_CONSTRUCTABILITY_RISK", severity: "BLOCKING", message: "Route candidate requires constructability risk evidence." }));
  }
  if (!Number.isFinite(input.routeCandidate?.riskScore)) {
    blockers.push(blocker({ code: "MISSING_PERMIT_RISK", severity: "BLOCKING", message: "Route candidate requires permit or risk score evidence." }));
  }

  const conduitSystem = input.conduitSystems?.[0];
  const fiberSystem = input.fiberSystems?.[0];
  const opticalSystem = input.opticalSystems?.[0];
  pushRequirement(requirements, "INFRASTRUCTURE_ASSUMPTION", "CONDUIT_ASSUMPTION", "Conduit count assumption", "CONDUIT_SYSTEM", conduitSystem?.conduitSystemId, conduitSystem?.evidenceIds[0]);
  pushRequirement(requirements, "INFRASTRUCTURE_ASSUMPTION", "FIBER_ASSUMPTION", "Fiber count assumption", "FIBER_SYSTEM", fiberSystem?.fiberSystemId, fiberSystem?.evidenceIds[0]);
  if (!conduitSystem || conduitSystem.ductCount <= 0) {
    blockers.push(blocker({ code: "MISSING_CONDUIT_ASSUMPTION", severity: "BLOCKING", message: "Promotion requires conduit count assumption." }));
  }
  if (!fiberSystem || fiberSystem.fiberCount <= 0) {
    blockers.push(blocker({ code: "MISSING_FIBER_ASSUMPTION", severity: "BLOCKING", message: "Promotion requires fiber count assumption." }));
  }
  if (firstRequirement?.serviceType && ["WAVE", "ETHERNET", "AI_INTERCONNECT"].includes(firstRequirement.serviceType)) {
    pushRequirement(requirements, "INFRASTRUCTURE_ASSUMPTION", "OPTICAL_TRANSPORT_ASSUMPTION", "Optical or transport assumption", "OPTICAL_SYSTEM", opticalSystem?.opticalSystemId, opticalSystem?.evidenceIds[0]);
    if (!opticalSystem) {
      blockers.push(blocker({ code: "MISSING_OPTICAL_TRANSPORT_ASSUMPTION", severity: "BLOCKING", message: "Transport service requires optical or transport assumption." }));
    }
  }

  const humanApprovalEvidence = input.approvalEvidenceId
    ? input.evidence.find((item) => item.evidenceId === input.approvalEvidenceId)
    : input.evidence.find((item) => item.sourceType === "HUMAN_ENGINEERING_REVIEW");
  pushRequirement(
    requirements,
    "HUMAN_APPROVAL",
    "ENGINEERING_APPROVAL",
    "Engineering reviewer, approval timestamp, and promotion note",
    humanApprovalEvidence?.entityType,
    humanApprovalEvidence?.entityId,
    humanApprovalEvidence?.evidenceId
  );
  if (!input.reviewedBy || !input.reviewedAt || !humanApprovalEvidence) {
    blockers.push(blocker({ code: "MISSING_HUMAN_ENGINEERING_APPROVAL", severity: "BLOCKING", message: "Human engineering approval is required before promotion." }));
  }

  if (input.duplicateActiveScopeVersionId) {
    blockers.push(
      blocker({
        code: "DUPLICATE_ACTIVE_SCOPEVERSION",
        severity: "BLOCKING",
        message: "An active ScopeVersion already exists for this corridor candidate.",
        entityId: input.duplicateActiveScopeVersionId,
      })
    );
  }

  const missingEvidence = requirements.filter((item) => item.required && !item.satisfiedByEvidenceId);
  const status = deriveStatus(blockers, missingEvidence, input.reviewedBy);
  const readyForPromotion = status === "PROMOTION_READY";
  const satisfiedEvidenceIds = collectSatisfiedEvidenceIds(requirements);

  const evaluation: CorridorPromotionEvaluation = {
    promotionId,
    corridorId: input.corridor.corridorId,
    routeCandidateId,
    status,
    readyForPromotion,
    blockers,
    satisfiedEvidenceIds,
    missingEvidence,
    warnings,
  };

  console.log("[CORRIDOR_PROMOTION_EVALUATION]", evaluation);
  for (const item of blockers) console.warn("[CORRIDOR_PROMOTION_BLOCKER]", item);
  if (readyForPromotion) console.log("[CORRIDOR_PROMOTION_READY]", evaluation);

  return evaluation;
}

export function mapCorridorCandidateToScopeVersionDraft(input: CorridorPromotionInput): CorridorScopeVersionDraft {
  const evaluation = evaluateCorridorPromotionReadiness(input);
  if (!input.routeCandidate) {
    throw new Error("Cannot create CorridorScopeVersionDraft without a route candidate.");
  }

  const activeRequirements = input.requirements ?? input.corridor.requirements;
  const endpointReferences = input.endpoints.map((endpoint) => ({
    endpointId: endpoint.endpointId,
    role: endpoint.role,
    name: endpoint.name,
    latitude: endpoint.latitude,
    longitude: endpoint.longitude,
  }));
  const conduitSystem = input.conduitSystems?.[0];
  const fiberSystem = input.fiberSystems?.[0];
  const opticalSystem = input.opticalSystems?.[0];
  const allEvidenceIds = Array.from(
    new Set([
      ...input.corridor.evidenceIds,
      ...input.routeCandidate.evidenceIds,
      ...input.endpoints.flatMap((endpoint) => endpoint.evidenceIds),
      ...activeRequirements.flatMap((requirement) => requirement.evidenceIds),
      ...evaluation.satisfiedEvidenceIds,
    ])
  );

  const draft: CorridorScopeVersionDraft = {
    draftId: `DRAFT-SV-${input.corridor.corridorId}-${input.routeCandidate.routeCandidateId}`,
    corridorId: input.corridor.corridorId,
    routeCandidateId: input.routeCandidate.routeCandidateId,
    lifecycleState: "ANALYZED",
    source: "CORRIDOR_PROMOTION_DRAFT",
    corridorName: input.corridor.corridorName,
    customerType: input.corridor.customerType,
    designObjective: input.corridor.designObjective,
    endpointReferences,
    route: {
      geometry: input.routeCandidate.geometry,
      distanceMiles: input.routeCandidate.distanceMiles,
      buildFeet: Math.round(input.routeCandidate.distanceMiles * 5280),
      source: input.routeCandidate.source,
      routeClass: input.routeCandidate.routeClass,
      routeEvidenceIds: input.routeCandidate.evidenceIds,
      candidateRouteName: `${input.corridor.corridorName} ${input.routeCandidate.routeClass}`,
    },
    requirements: activeRequirements,
    infrastructureAssumptions: {
      conduitSystemIds: input.conduitSystems?.map((system) => system.conduitSystemId) ?? [],
      fiberSystemIds: input.fiberSystems?.map((system) => system.fiberSystemId) ?? [],
      opticalSystemIds: input.opticalSystems?.map((system) => system.opticalSystemId) ?? [],
      ductCount: conduitSystem?.ductCount,
      fiberCount: fiberSystem?.fiberCount,
      transportAssumption: opticalSystem?.designCapacity,
      regenRequired: opticalSystem?.regenRequired,
    },
    riskBasis: {
      jurisdictionIds: input.jurisdictions?.map((jurisdiction) => jurisdiction.jurisdictionId) ?? [],
      crossingIds: input.crossings?.map((crossing) => crossing.crossingId) ?? [],
      constraintIds: input.constraints?.map((constraint) => constraint.constraintId) ?? [],
      constructabilityScore: input.routeCandidate.constructabilityScore,
      permitRisk: input.routeCandidate.riskScore,
    },
    evidenceIds: allEvidenceIds,
    promotion: {
      promotionId: evaluation.promotionId,
      status: evaluation.status,
      readyForPromotion: evaluation.readyForPromotion,
      blockerCodes: evaluation.blockers.map((item) => item.code),
    },
  };

  console.log("[CORRIDOR_SCOPEVERSION_DRAFT_CREATED]", draft);
  return draft;
}

