import type { CorridorNetworkRole } from "./corridorTypes";
import type { EnrichedCorridorCandidate } from "./EnrichmentContract";
import { applyCorridorLens } from "./CorridorLensRegistry";
import type { CorridorLensObjectType, CorridorLensType } from "./CorridorLens";
import { CORRIDOR_OBJECT_DESIGN_STANDARDS } from "./CorridorDesignStandards";
import { REFERENCE_ARCHITECTURE_CATALOG, type ReferenceArchitectureFit, type ReferenceArchitectureToolRequirement, type ReferenceArchitectureToolType } from "./CorridorReferenceArchitecture";
import type { PrismDecisionSummary } from "./PrismDecisionHierarchy";
import type { PrismScore } from "./PrismScoreContract";
import type {
  PrismHumanReviewBlocker,
  PrismHumanReviewBlockerType,
  PrismHumanReviewGate,
  PrismObjectEvidenceRequirement,
  PrismObjectPopulationPlan,
  PrismProductPlan,
  PrismProductType,
  PrismRecommendation,
  PrismRecommendationDiagnostic,
  PrismRecommendationDiagnosticCode,
  PrismRecommendationLevel,
  PrismRecommendationRisk,
  PrismRecommendationStrength,
  PrismRouteEngineeringHandoffDraft,
} from "./PrismRecommendationContract";

export interface PrismRecommendationInput {
  candidateId?: string;
  corridorId?: string;
  lensType?: CorridorLensType;
  networkRole?: CorridorNetworkRole;
  customerRequirement?: string;
  enrichedCandidate?: EnrichedCorridorCandidate;
  prismScore?: PrismScore;
  decisionSummary?: PrismDecisionSummary;
  referenceArchitectureFit?: ReferenceArchitectureFit;
  availableObjectTypes?: CorridorLensObjectType[];
  evidenceIds?: string[];
  unresolvedDesignStandardIds?: string[];
  unresolvedConflictIds?: string[];
  routeEngineeringReviewed?: boolean;
  routeDiversityReviewed?: boolean;
  regenAdmOpticalReviewComplete?: boolean;
  powerCapacityVerified?: boolean;
  jurisdictionRiskResolved?: boolean;
  crossingRiskResolved?: boolean;
}

function unique<T>(items: readonly T[]): T[] {
  return [...new Set(items)];
}

function candidateId(input: PrismRecommendationInput): string {
  return input.candidateId ?? input.enrichedCandidate?.candidate.candidateId ?? input.prismScore?.candidateId ?? input.decisionSummary?.candidateId ?? "UNKNOWN_CANDIDATE";
}

function corridorId(input: PrismRecommendationInput): string {
  return input.corridorId ?? input.enrichedCandidate?.candidate.corridorId ?? input.prismScore?.corridorId ?? input.decisionSummary?.corridorId ?? "UNKNOWN_CORRIDOR";
}

function evidenceIds(input: PrismRecommendationInput): string[] {
  return unique([
    ...(input.evidenceIds ?? []),
    ...(input.enrichedCandidate?.candidate.sourceEvidenceIds ?? []),
    ...(input.prismScore?.summary.evidenceUsed.flatMap((evidence) => evidence.evidenceIds) ?? []),
    ...(input.decisionSummary?.layerResults.flatMap((result) => result.findings.flatMap((finding) => finding.evidenceIds)) ?? []),
  ]);
}

function diagnostic(input: {
  code: PrismRecommendationDiagnosticCode;
  recommendationInput: PrismRecommendationInput;
  severity?: PrismRecommendationDiagnostic["severity"];
  message: string;
  evidenceIds?: string[];
  details?: Record<string, unknown>;
}): PrismRecommendationDiagnostic {
  const result: PrismRecommendationDiagnostic = {
    code: input.code,
    candidateId: candidateId(input.recommendationInput),
    corridorId: corridorId(input.recommendationInput),
    severity: input.severity ?? "INFO",
    message: input.message,
    timestamp: new Date().toISOString(),
    evidenceIds: input.evidenceIds ?? evidenceIds(input.recommendationInput),
    details: input.details,
  };
  console.log(`[${result.code}]`, {
    candidateId: result.candidateId,
    corridorId: result.corridorId,
    severity: result.severity,
    message: result.message,
    details: result.details,
  });
  return result;
}

function blocker(input: {
  candidateId: string;
  type: PrismHumanReviewBlockerType;
  severity: PrismRecommendationRisk;
  message: string;
  requiredAction: string;
  evidenceIds?: string[];
  objectTypes?: CorridorLensObjectType[];
  requiredTools?: ReferenceArchitectureToolType[];
  requiredStandards?: string[];
}): PrismHumanReviewBlocker {
  return {
    blockerId: `${input.candidateId}-${input.type}`,
    blockerType: input.type,
    severity: input.severity,
    message: input.message,
    requiredAction: input.requiredAction,
    evidenceIds: input.evidenceIds ?? [],
    objectTypes: input.objectTypes,
    requiredTools: input.requiredTools,
    requiredStandards: input.requiredStandards,
  };
}

function scoreValue(input: PrismRecommendationInput): number {
  return input.prismScore?.summary.overallScore ?? 0;
}

function scoreConfidenceStrong(input: PrismRecommendationInput): boolean {
  const confidence = input.prismScore?.summary.confidence;
  return confidence === "HIGH" || confidence === "VERIFIED";
}

function requiredTools(input: PrismRecommendationInput): ReferenceArchitectureToolRequirement[] {
  return input.referenceArchitectureFit?.requiredTools ?? [];
}

function requiredToolTypes(input: PrismRecommendationInput): ReferenceArchitectureToolType[] {
  return requiredTools(input).map((tool) => tool.toolType);
}

function requiredObjects(input: PrismRecommendationInput): CorridorLensObjectType[] {
  return input.referenceArchitectureFit?.requiredObjects ?? [];
}

function requiredStandards(input: PrismRecommendationInput): string[] {
  return input.referenceArchitectureFit?.requiredStandards ?? [];
}

function matchingArchitecture(input: PrismRecommendationInput) {
  const architectureId = input.referenceArchitectureFit?.architectureId;
  return REFERENCE_ARCHITECTURE_CATALOG.find((architecture) => architecture.architectureId === architectureId);
}

function isOnlyRouteEngineeringReview(blockers: PrismHumanReviewBlocker[]): boolean {
  return blockers.length > 0 && blockers.every((item) => item.blockerType === "ROUTE_ENGINEERING_REVIEW_REQUIRED");
}

export function evaluateHumanReviewGate(input: PrismRecommendationInput): PrismHumanReviewGate {
  const id = candidateId(input);
  const blockers: PrismHumanReviewBlocker[] = [];
  const fit = input.referenceArchitectureFit;
  const tools = requiredToolTypes(input);
  const objects = requiredObjects(input);
  const standards = requiredStandards(input);

  if (!input.lensType) {
    blockers.push(
      blocker({
        candidateId: id,
        type: "MISSING_LENS",
        severity: "BLOCKING",
        message: "No corridor lens is selected.",
        requiredAction: "Select a corridor lens before recommendation handoff.",
      }),
    );
  }

  if (!input.customerRequirement) {
    blockers.push(
      blocker({
        candidateId: id,
        type: "MISSING_CUSTOMER_REQUIREMENT",
        severity: "HIGH",
        message: "Customer requirement or ask is missing.",
        requiredAction: "Capture customer intent, endpoints, product intent, or commercial target.",
      }),
    );
  }

  if (!fit || fit.fitLevel === "NOT_APPLICABLE") {
    blockers.push(
      blocker({
        candidateId: id,
        type: "MISSING_REFERENCE_ARCHITECTURE_FIT",
        severity: "BLOCKING",
        message: "No applicable reference architecture fit is available.",
        requiredAction: "Match a reference architecture before creating a Route Engineering handoff draft.",
      }),
    );
  }

  fit?.missingObjects.forEach((missingObject) => {
    blockers.push(
      blocker({
        candidateId: id,
        type: "MISSING_REQUIRED_OBJECT_EVIDENCE",
        severity: "HIGH",
        message: `${missingObject} evidence is required by the reference architecture.`,
        requiredAction: `Provide evidence for ${missingObject} or document why it does not apply.`,
        objectTypes: [missingObject],
      }),
    );
  });

  fit?.missingToolEvidence.forEach((missingTool) => {
    blockers.push(
      blocker({
        candidateId: id,
        type: "MISSING_REQUIRED_TOOL_EVIDENCE",
        severity: "HIGH",
        message: `${missingTool.toolType} evidence is required by the reference architecture.`,
        requiredAction: `Provide ${missingTool.toolType} evidence or mark it unavailable for human review.`,
        requiredTools: [missingTool.toolType],
      }),
    );
  });

  if ((input.unresolvedDesignStandardIds?.length ?? 0) > 0) {
    blockers.push(
      blocker({
        candidateId: id,
        type: "UNRESOLVED_HIGH_SEVERITY_DESIGN_STANDARD",
        severity: "HIGH",
        message: "One or more high-severity design standards remain unresolved.",
        requiredAction: "Resolve or request exception review for the unresolved standards.",
        requiredStandards: input.unresolvedDesignStandardIds,
      }),
    );
  }

  const decisionConflicts = input.decisionSummary?.conflicts.map((conflict) => conflict.conflictId) ?? [];
  const unresolvedConflictIds = unique([...(input.unresolvedConflictIds ?? []), ...decisionConflicts]);
  if (unresolvedConflictIds.length > 0) {
    blockers.push(
      blocker({
        candidateId: id,
        type: "UNRESOLVED_CONFLICT",
        severity: "HIGH",
        message: "Unresolved evidence or decision conflicts require human review.",
        requiredAction: "Resolve conflicting evidence or document human review disposition.",
        evidenceIds: unresolvedConflictIds,
      }),
    );
  }

  const confidence = input.prismScore?.summary.confidence;
  if (!confidence || confidence === "VERY_LOW" || confidence === "LOW") {
    blockers.push(
      blocker({
        candidateId: id,
        type: "MISSING_EVIDENCE_CONFIDENCE",
        severity: "HIGH",
        message: "Evidence confidence is missing or too low for advisory recommendation handoff.",
        requiredAction: "Improve evidence confidence or mark the recommendation conditional.",
      }),
    );
  }

  if (tools.includes("ROUTE_DIVERSITY_REVIEW") && input.routeDiversityReviewed !== true) {
    blockers.push(
      blocker({
        candidateId: id,
        type: "ROUTE_DIVERSITY_NOT_REVIEWED",
        severity: "HIGH",
        message: "Route diversity review is required but not complete.",
        requiredAction: "Complete Route Engineering diversity review before relying on diversity claims.",
        requiredTools: ["ROUTE_DIVERSITY_REVIEW"],
      }),
    );
  }

  if (
    (tools.includes("OPTICAL_REACH_REVIEW") ||
      tools.includes("REGEN_SPACING_REVIEW") ||
      tools.includes("ADM_PLACEMENT_REVIEW") ||
      standards.includes("STANDARD-REGEN-SITE-001") ||
      standards.includes("STANDARD-ADM-SITE-001")) &&
    input.regenAdmOpticalReviewComplete !== true
  ) {
    blockers.push(
      blocker({
        candidateId: id,
        type: "REGEN_ADM_OPTICAL_REVIEW_REQUIRED",
        severity: "HIGH",
        message: "Regen, ADM, or optical review is required.",
        requiredAction: "Complete Route Engineering optical/regen/ADM review.",
        requiredTools: ["OPTICAL_REACH_REVIEW", "REGEN_SPACING_REVIEW", "ADM_PLACEMENT_REVIEW"].filter((tool) =>
          tools.includes(tool as ReferenceArchitectureToolType),
        ) as ReferenceArchitectureToolType[],
        requiredStandards: standards.filter((standard) => standard === "STANDARD-REGEN-SITE-001" || standard === "STANDARD-ADM-SITE-001"),
      }),
    );
  }

  if (
    (objects.includes("SUBSTATION") ||
      objects.includes("TRANSMISSION_LINE") ||
      objects.includes("GENERATION_SITE") ||
      objects.includes("POWER_FEED") ||
      tools.includes("POWER_PROXIMITY_EVALUATION")) &&
    input.powerCapacityVerified !== true
  ) {
    blockers.push(
      blocker({
        candidateId: id,
        type: "POWER_CAPACITY_UNVERIFIED",
        severity: "HIGH",
        message: "Power capacity is not verified.",
        requiredAction: "Preserve proximity as evidence only or provide verified power capacity evidence.",
        objectTypes: objects.filter((objectType) => ["SUBSTATION", "TRANSMISSION_LINE", "GENERATION_SITE", "POWER_FEED"].includes(objectType)),
      }),
    );
  }

  if ((objects.includes("JURISDICTION") || tools.includes("JURISDICTION_REVIEW")) && input.jurisdictionRiskResolved !== true) {
    blockers.push(
      blocker({
        candidateId: id,
        type: "JURISDICTION_RISK_UNRESOLVED",
        severity: "MEDIUM",
        message: "Jurisdiction risk remains unresolved.",
        requiredAction: "Review permit authority, lead time, and jurisdiction complexity.",
        requiredTools: tools.includes("JURISDICTION_REVIEW") ? ["JURISDICTION_REVIEW"] : undefined,
      }),
    );
  }

  if ((objects.includes("CROSSING") || tools.includes("CROSSING_REVIEW")) && input.crossingRiskResolved !== true) {
    blockers.push(
      blocker({
        candidateId: id,
        type: "CROSSING_RISK_UNRESOLVED",
        severity: "MEDIUM",
        message: "Crossing risk remains unresolved.",
        requiredAction: "Review crossing owner, method, permit, cost, and schedule risk.",
        requiredTools: tools.includes("CROSSING_REVIEW") ? ["CROSSING_REVIEW"] : undefined,
      }),
    );
  }

  if (input.routeEngineeringReviewed !== true) {
    blockers.push(
      blocker({
        candidateId: id,
        type: "ROUTE_ENGINEERING_REVIEW_REQUIRED",
        severity: "MEDIUM",
        message: "Route Engineering review has not been completed.",
        requiredAction: "Submit draft package to Route Engineering for review.",
      }),
    );
  }

  const gateStatus =
    blockers.some((item) => item.severity === "BLOCKING")
      ? "BLOCKED"
      : isOnlyRouteEngineeringReview(blockers)
        ? "PASS_TO_ROUTE_ENGINEERING_REVIEW"
        : blockers.length > 0
          ? "REVIEW_REQUIRED"
          : "PASS_TO_ROUTE_ENGINEERING_REVIEW";

  console.log("[PRISM_HUMAN_REVIEW_GATE]", {
    candidateId: id,
    gateStatus,
    blockerCount: blockers.length,
  });

  return {
    gateStatus,
    blockers,
    routeEngineeringReviewRequired: true,
    passToRouteEngineeringReview: gateStatus === "PASS_TO_ROUTE_ENGINEERING_REVIEW",
    notes:
      gateStatus === "PASS_TO_ROUTE_ENGINEERING_REVIEW"
        ? "Package is ready for Route Engineering review. This is not approval."
        : "Human review must resolve blockers before Route Engineering handoff readiness.",
  };
}

export function createObjectPopulationPlan(input: PrismRecommendationInput): PrismObjectPopulationPlan {
  const lensApplication = input.lensType ? applyCorridorLens(input.lensType) : undefined;
  const architecture = matchingArchitecture(input);
  const lensPrimaryAndSecondary = lensApplication?.prioritizedObjectTypes ?? [];
  const required = unique(requiredObjects(input));
  const suggested = unique([...lensPrimaryAndSecondary, ...(architecture?.optionalObjects ?? [])]).filter((objectType) => !required.includes(objectType));
  const optional = unique([...(architecture?.optionalObjects ?? [])]).filter((objectType) => !required.includes(objectType));
  const missingObjects = input.referenceArchitectureFit?.missingObjects ?? [];
  const allObjects = unique([...required, ...suggested, ...optional]);
  const objectEvidenceRequirements: PrismObjectEvidenceRequirement[] = allObjects.map((objectType) => {
    const standards = CORRIDOR_OBJECT_DESIGN_STANDARDS.filter((standard) => standard.objectType === objectType).map((standard) => standard.standardId);
    const toolsForObject = requiredTools(input)
      .filter((tool) => {
        const joined = `${tool.purpose} ${tool.evidenceExpected.join(" ")}`.toLowerCase();
        return joined.includes(objectType.toLowerCase().replaceAll("_", " ").split(" ")[0]);
      })
      .map((tool) => tool.toolType);
    return {
      objectType,
      evidenceRequired: standards.length > 0 ? ["Applicable design standard evidence", "Source provenance", "Human review disposition"] : ["Source provenance", "Human review disposition"],
      requiredTools: unique(toolsForObject),
      requiredStandards: standards,
    };
  });

  const objectDesignStandards: Record<string, string[]> = {};
  const objectReviewRequirements: Record<string, string[]> = {};
  objectEvidenceRequirements.forEach((requirement) => {
    objectDesignStandards[requirement.objectType] = requirement.requiredStandards;
    objectReviewRequirements[requirement.objectType] =
      requirement.requiredStandards.length > 0
        ? ["Route Engineering review required", "Standards context required before authority"]
        : ["Human evidence review required"];
  });

  console.log("[PRISM_OBJECT_POPULATION_PLAN]", {
    candidateId: candidateId(input),
    requiredObjects: required.length,
    suggestedObjects: suggested.length,
    missingObjects: missingObjects.length,
  });

  return {
    requiredObjects: required,
    suggestedObjects: suggested,
    optionalObjects: optional,
    missingObjects,
    objectEvidenceRequirements,
    objectDesignStandards,
    objectReviewRequirements,
    providerPriorities: lensApplication?.prioritizedProviderTypes ?? [],
  };
}

function productForLens(input: PrismRecommendationInput): PrismProductType {
  if (input.lensType === "DUCT_MONETIZATION") return "DUCT_SALE";
  if (input.lensType === "DARK_FIBER_IRU") return "DARK_FIBER_IRU";
  if (input.lensType === "TRANSPORT") return "WAVE_SERVICE";
  if (input.lensType === "ENTERPRISE") return "MANAGED_FIBER";
  if (input.lensType === "POWER_AI_EXPANSION" || input.lensType === "HYPERSCALER" || input.lensType === "NEOCLOUD") return "AI_INTERCONNECT";
  return "ETHERNET_TRANSPORT";
}

export function createProductPlan(input: PrismRecommendationInput, objectPlan = createObjectPopulationPlan(input)): PrismProductPlan {
  const productType = productForLens(input);
  const commercialModelByProduct: Record<PrismProductType, string> = {
    DUCT_SALE: "Sale or lease of sale-eligible spare duct after residual capacity review.",
    DUCT_MAINTENANCE: "Maintenance responsibility and access model for duct assets.",
    DARK_FIBER_IRU: "Long-term fiber pair IRU subject to strand reservation and handoff review.",
    MANAGED_FIBER: "Managed fiber service subject to building entry and serviceability review.",
    WAVE_SERVICE: "Protected or unprotected wavelength service subject to optical review.",
    ETHERNET_TRANSPORT: "Ethernet transport service subject to capacity and handoff review.",
    AI_INTERCONNECT: "High-capacity AI interconnect subject to power, fiber, and interconnection review.",
    ROUTE_OPERATIONS: "Operational route service subject to maintenance and restoration review.",
    RESIDUAL_CAPACITY_MONETIZATION: "Monetization of residual capacity after committed capacity is protected.",
  };
  const riskNotes = [
    ...(input.referenceArchitectureFit?.warnings ?? []),
    ...(input.prismScore?.summary.warnings ?? []),
  ];

  console.log("[PRISM_PRODUCT_PLAN]", {
    candidateId: candidateId(input),
    productType,
    routeEngineeringReviewRequired: true,
  });

  return {
    productType,
    commercialModel: commercialModelByProduct[productType],
    requiredObjects: objectPlan.requiredObjects,
    capacityAssumptions: [
      "Capacity assumptions are advisory until Route Engineering review.",
      "Approved capacity must remain separate from commercial intent.",
    ],
    termAssumptions: ["Commercial terms are placeholders only.", "No pricing or quote is generated in this phase."],
    revenueEvidenceIds: evidenceIds(input),
    riskNotes,
    routeEngineeringReviewRequired: true,
  };
}

function recommendationLevelFor(input: PrismRecommendationInput, gate: PrismHumanReviewGate): PrismRecommendationLevel {
  if (input.decisionSummary?.hardExclusion === "FAIL") return "REJECTED";
  if (input.decisionSummary?.hardExclusion === "REVIEW_REQUIRED") return "CONDITIONAL";
  if (input.decisionSummary?.strategicFit === "WEAK") return gate.gateStatus === "PASS_TO_ROUTE_ENGINEERING_REVIEW" ? "NOT_RECOMMENDED" : "CONDITIONAL";
  if (gate.gateStatus === "BLOCKED") return "CONDITIONAL";

  const score = scoreValue(input);
  const strongScore = score >= 80;
  const acceptableScore = score >= 65;
  const strongFit = input.referenceArchitectureFit?.fitLevel === "STRONG";

  if (strongScore && scoreConfidenceStrong(input) && strongFit && gate.gateStatus === "PASS_TO_ROUTE_ENGINEERING_REVIEW") return "RECOMMENDED";
  if (acceptableScore && gate.gateStatus === "PASS_TO_ROUTE_ENGINEERING_REVIEW") return "ACCEPTABLE";
  if (acceptableScore || gate.blockers.length > 0) return "CONDITIONAL";
  return "NOT_RECOMMENDED";
}

function strengthFor(level: PrismRecommendationLevel): PrismRecommendationStrength {
  if (level === "RECOMMENDED") return "STRONG";
  if (level === "ACCEPTABLE" || level === "CONDITIONAL") return "MODERATE";
  return "WEAK";
}

function riskFor(gate: PrismHumanReviewGate, level: PrismRecommendationLevel): PrismRecommendationRisk {
  if (level === "REJECTED" || gate.gateStatus === "BLOCKED") return "BLOCKING";
  if (gate.blockers.some((item) => item.severity === "HIGH")) return "HIGH";
  if (gate.blockers.some((item) => item.severity === "MEDIUM")) return "MEDIUM";
  return "LOW";
}

function requiredRouteEngineeringReviews(input: PrismRecommendationInput, gate: PrismHumanReviewGate): string[] {
  return unique([
    ...gate.blockers.map((item) => item.requiredAction),
    ...requiredTools(input)
      .filter((tool) => tool.category === "DESIGN_ENGINEERING")
      .map((tool) => tool.purpose),
    ...requiredStandards(input).map((standardId) => `Review ${standardId}`),
  ]);
}

export function createRouteEngineeringHandoffDraft(
  input: PrismRecommendationInput,
  recommendationLevel: PrismRecommendationLevel,
  objectPlan = createObjectPopulationPlan(input),
  gate = evaluateHumanReviewGate(input),
): PrismRouteEngineeringHandoffDraft {
  const draft: PrismRouteEngineeringHandoffDraft = {
    candidateId: candidateId(input),
    corridorId: corridorId(input),
    lensType: input.lensType,
    networkRole: input.networkRole,
    referenceArchitectureId: input.referenceArchitectureFit?.architectureId,
    recommendationLevel,
    requiredObjects: objectPlan.requiredObjects,
    requiredTools: requiredTools(input),
    requiredDesignStandards: requiredStandards(input),
    humanReviewBlockers: gate.blockers,
    requiredRouteEngineeringReviews: requiredRouteEngineeringReviews(input, gate),
    evidenceIds: evidenceIds(input),
    notes: "DRAFT_ONLY. This handoff does not approve, certify, create a ScopeVersion, or create execution work.",
    status: "DRAFT_ONLY",
  };
  console.log("[PRISM_HANDOFF_DRAFT_CREATED]", {
    candidateId: draft.candidateId,
    corridorId: draft.corridorId,
    recommendationLevel,
    status: draft.status,
  });
  return draft;
}

export function recommendCorridorCandidate(input: PrismRecommendationInput): PrismRecommendation {
  const diagnostics: PrismRecommendationDiagnostic[] = [
    diagnostic({
      code: "PRISM_RECOMMENDATION_STARTED",
      recommendationInput: input,
      message: "Prism recommendation evaluation started.",
    }),
  ];
  const gate = evaluateHumanReviewGate(input);
  const objectPlan = createObjectPopulationPlan(input);
  const productPlan = createProductPlan(input, objectPlan);
  const recommendationLevel = recommendationLevelFor(input, gate);
  const routeEngineeringHandoffDraft = createRouteEngineeringHandoffDraft(input, recommendationLevel, objectPlan, gate);

  diagnostics.push(
    diagnostic({
      code: "PRISM_RECOMMENDATION_LEVEL",
      recommendationInput: input,
      message: `Recommendation level is ${recommendationLevel}.`,
      details: {
        recommendationLevel,
        overallScore: input.prismScore?.summary.overallScore,
        fitLevel: input.referenceArchitectureFit?.fitLevel,
        gateStatus: gate.gateStatus,
      },
    }),
  );

  diagnostics.push(
    diagnostic({
      code: "PRISM_HUMAN_REVIEW_GATE",
      recommendationInput: input,
      severity: gate.gateStatus === "BLOCKED" ? "BLOCKING" : gate.gateStatus === "REVIEW_REQUIRED" ? "WARNING" : "INFO",
      message: `Human review gate status is ${gate.gateStatus}.`,
      details: { blockerCount: gate.blockers.length },
    }),
  );

  gate.blockers.forEach((reviewBlocker) => {
    diagnostics.push(
      diagnostic({
        code: "PRISM_RECOMMENDATION_BLOCKER",
        recommendationInput: input,
        severity: reviewBlocker.severity === "BLOCKING" ? "BLOCKING" : "WARNING",
        message: reviewBlocker.message,
        evidenceIds: reviewBlocker.evidenceIds,
        details: { blockerType: reviewBlocker.blockerType, requiredAction: reviewBlocker.requiredAction },
      }),
    );
  });

  diagnostics.push(
    diagnostic({
      code: "PRISM_OBJECT_POPULATION_PLAN",
      recommendationInput: input,
      message: "Object population plan created.",
      details: {
        requiredObjects: objectPlan.requiredObjects,
        suggestedObjects: objectPlan.suggestedObjects,
        missingObjects: objectPlan.missingObjects,
      },
    }),
    diagnostic({
      code: "PRISM_PRODUCT_PLAN",
      recommendationInput: input,
      message: "Product plan created.",
      details: { productType: productPlan.productType, commercialModel: productPlan.commercialModel },
    }),
    diagnostic({
      code: "PRISM_HANDOFF_DRAFT_CREATED",
      recommendationInput: input,
      message: "Route Engineering handoff draft created.",
      details: { status: routeEngineeringHandoffDraft.status, referenceArchitectureId: routeEngineeringHandoffDraft.referenceArchitectureId },
    }),
  );

  if (input.referenceArchitectureFit?.warnings.length) {
    diagnostics.push(
      diagnostic({
        code: "PRISM_RECOMMENDATION_WARNING",
        recommendationInput: input,
        severity: "WARNING",
        message: "Reference architecture warnings are present.",
        details: { warnings: input.referenceArchitectureFit.warnings },
      }),
    );
  }

  diagnostics.push(
    diagnostic({
      code: "PRISM_RECOMMENDATION_COMPLETE",
      recommendationInput: input,
      message: "Prism recommendation evaluation complete.",
      details: { recommendationLevel, gateStatus: gate.gateStatus },
    }),
  );

  const recommendation: PrismRecommendation = {
    recommendationId: `PRISM-REC-${candidateId(input)}`,
    candidateId: candidateId(input),
    corridorId: corridorId(input),
    recommendationLevel,
    recommendationStrength: strengthFor(recommendationLevel),
    risk: riskFor(gate, recommendationLevel),
    rationale: {
      summary: `Prism produced an advisory ${recommendationLevel} recommendation.`,
      scoreContext: input.prismScore
        ? `Overall score ${input.prismScore.summary.overallScore} with ${input.prismScore.summary.confidence} confidence.`
        : "No Prism score was supplied.",
      architectureContext: input.referenceArchitectureFit
        ? `${input.referenceArchitectureFit.architectureId} fit is ${input.referenceArchitectureFit.fitLevel}.`
        : "No reference architecture fit was supplied.",
      standardsContext:
        requiredStandards(input).length > 0
          ? `${requiredStandards(input).length} design standards are required before Route Engineering authority.`
          : "No required design standards were supplied.",
      decisionContext: input.decisionSummary
        ? `Hard exclusion ${input.decisionSummary.hardExclusion}; strategic fit ${input.decisionSummary.strategicFit}.`
        : "No decision hierarchy summary was supplied.",
      evidenceIds: evidenceIds(input),
    },
    humanReviewGate: gate,
    objectPopulationPlan: objectPlan,
    productPlan,
    routeEngineeringHandoffDraft,
    diagnostics,
    doctrine: "PRISM_RECOMMENDATION_IS_ADVISORY_ONLY",
    createdAt: new Date().toISOString(),
  };

  return recommendation;
}
