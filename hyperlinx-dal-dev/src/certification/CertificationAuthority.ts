import type { ConstraintEvidencePackage } from "../routing/ConstraintAnalysisEngine";

export type RouteCertificationState =
  | "DRAFT"
  | "DRAFT_ROUTE"
  | "ENGINEER_REVIEW_REQUIRED"
  | "PROVISIONALLY_CERTIFIED"
  | "CERTIFIED_ROUTE"
  | "REJECTED"
  | "REJECTED_ROUTE"
  | "SUPERSEDED"
  | "BLOCKED";

export type EvidenceGrade =
  | "COMPLETE_CONSTRAINT_EVIDENCE"
  | "INCOMPLETE_CONSTRAINT_EVIDENCE"
  | "STALE_CONSTRAINT_EVIDENCE"
  | "UNKNOWN_CONSTRAINT_EVIDENCE";

export type CertificationAuthorityInput = {
  routeGeometryHash: string;
  constraintEvidencePackage?: ConstraintEvidencePackage | null;
  engineerApproval?: {
    approved: boolean;
    notes?: string;
    certifiedBy?: string;
    certifiedAt?: string;
    rejected?: boolean;
  };
  snapCertificationState?: string;
  attachmentAuthorityState?: string;
};

export type CertificationAuthorityDecision = {
  state: RouteCertificationState;
  reasons: string[];
  requiredActions: string[];
  canCreateChildScopeVersion: boolean;
  canGenerateQuote: boolean;
  canProceedToPackage: boolean;
  evidenceGrade: EvidenceGrade;
  missingConstraintLayers: string[];
  constraintCompletenessPercent: number;
  evidenceStatus: "CURRENT" | "STALE" | "MISSING";
  provisional: boolean;
};

function hasEngineerNotes(input: CertificationAuthorityInput) {
  return Boolean(input.engineerApproval?.approved && input.engineerApproval.notes?.trim());
}

function evidenceGradeFor(input: CertificationAuthorityInput): EvidenceGrade {
  const evidence = input.constraintEvidencePackage;
  if (!evidence) return "UNKNOWN_CONSTRAINT_EVIDENCE";
  if (evidence.routeGeometryHash !== input.routeGeometryHash) return "STALE_CONSTRAINT_EVIDENCE";
  const completeness = evidence.constraintRegistrySnapshot?.completeness;
  const hasUnknownCounts = Object.values(evidence.unknownCounts ?? {}).some(Boolean);
  const incomplete =
    evidence.certificationReadiness === "UNKNOWN" ||
    hasUnknownCounts ||
    !completeness ||
    !completeness.usableForCertification ||
    completeness.completenessPercent < 100 ||
    completeness.missingLayers.length > 0;
  return incomplete ? "INCOMPLETE_CONSTRAINT_EVIDENCE" : "COMPLETE_CONSTRAINT_EVIDENCE";
}

export function deriveRouteCertificationState(input: CertificationAuthorityInput): CertificationAuthorityDecision {
  const evidence = input.constraintEvidencePackage ?? undefined;
  const completeness = evidence?.constraintRegistrySnapshot?.completeness;
  const evidenceGrade = evidenceGradeFor(input);
  const missingConstraintLayers = (completeness?.missingLayers ?? []).map(String);
  const constraintCompletenessPercent = Number(completeness?.completenessPercent ?? 0);
  const evidenceStatus = !evidence ? "MISSING" : evidence.routeGeometryHash !== input.routeGeometryHash ? "STALE" : "CURRENT";
  const approvedWithNotes = hasEngineerNotes(input);
  const reasons: string[] = [];
  const requiredActions: string[] = [];

  if (input.engineerApproval?.rejected) {
    reasons.push("Engineer rejected the route.");
    requiredActions.push("Revise route geometry and request a new certification review.");
    return {
      state: "REJECTED",
      reasons,
      requiredActions,
      canCreateChildScopeVersion: false,
      canGenerateQuote: false,
      canProceedToPackage: false,
      evidenceGrade,
      missingConstraintLayers,
      constraintCompletenessPercent,
      evidenceStatus,
      provisional: false,
    };
  }

  if (!evidence) {
    reasons.push("No current ConstraintEvidencePackage is attached to the route.");
    requiredActions.push("Generate constraint evidence for the current route geometry.");
  } else if (evidenceStatus === "STALE") {
    reasons.push("Route geometry hash does not match the evidence package route geometry hash.");
    requiredActions.push("Regenerate constraint evidence for the current route geometry.");
  }

  if (input.snapCertificationState && input.snapCertificationState !== "CERTIFIED_SNAP") {
    reasons.push(`Snap certification is ${input.snapCertificationState}.`);
    requiredActions.push("Certify snap evidence before route certification.");
  }

  if (input.attachmentAuthorityState && input.attachmentAuthorityState === "FAILED") {
    reasons.push("Attachment authority failed.");
    requiredActions.push("Resolve attachment authority before route certification.");
  }

  if (evidence?.certificationReadiness === "BLOCKED") {
    reasons.push("Constraint evidence readiness is BLOCKED.");
    requiredActions.push("Resolve blocking constraints or reroute.");
    return {
      state: "BLOCKED",
      reasons,
      requiredActions,
      canCreateChildScopeVersion: false,
      canGenerateQuote: false,
      canProceedToPackage: false,
      evidenceGrade,
      missingConstraintLayers,
      constraintCompletenessPercent,
      evidenceStatus,
      provisional: false,
    };
  }

  if (evidenceGrade === "INCOMPLETE_CONSTRAINT_EVIDENCE") {
    reasons.push("Constraint evidence is incomplete or contains unknown required classes.");
    if (missingConstraintLayers.length) reasons.push(`Missing required layers: ${missingConstraintLayers.join(", ")}.`);
    requiredActions.push("Engineer must review missing evidence and record acknowledgment notes.");
  }

  if (evidence?.certificationReadiness === "UNKNOWN") {
    reasons.push("Constraint evidence readiness is UNKNOWN.");
  }
  if (evidence?.certificationReadiness === "REVIEW_REQUIRED") {
    reasons.push("Constraint evidence requires human judgment.");
  }

  if (evidenceGrade === "STALE_CONSTRAINT_EVIDENCE") {
    return {
      state: "ENGINEER_REVIEW_REQUIRED",
      reasons,
      requiredActions,
      canCreateChildScopeVersion: false,
      canGenerateQuote: false,
      canProceedToPackage: false,
      evidenceGrade,
      missingConstraintLayers,
      constraintCompletenessPercent,
      evidenceStatus,
      provisional: false,
    };
  }

  if (evidenceGrade === "UNKNOWN_CONSTRAINT_EVIDENCE") {
    return {
      state: "DRAFT",
      reasons,
      requiredActions,
      canCreateChildScopeVersion: false,
      canGenerateQuote: false,
      canProceedToPackage: false,
      evidenceGrade,
      missingConstraintLayers,
      constraintCompletenessPercent,
      evidenceStatus,
      provisional: false,
    };
  }

  if (evidenceGrade === "COMPLETE_CONSTRAINT_EVIDENCE" && evidence?.certificationReadiness === "READY") {
    if (input.engineerApproval?.approved) {
      reasons.push("Evidence is complete, current, READY, and engineer approved.");
      return {
        state: "CERTIFIED_ROUTE",
        reasons,
        requiredActions,
        canCreateChildScopeVersion: true,
        canGenerateQuote: true,
        canProceedToPackage: true,
        evidenceGrade,
        missingConstraintLayers,
        constraintCompletenessPercent,
        evidenceStatus,
        provisional: false,
      };
    }
    requiredActions.push("Engineer approval is required for full route certification.");
    return {
      state: "ENGINEER_REVIEW_REQUIRED",
      reasons,
      requiredActions,
      canCreateChildScopeVersion: false,
      canGenerateQuote: true,
      canProceedToPackage: false,
      evidenceGrade,
      missingConstraintLayers,
      constraintCompletenessPercent,
      evidenceStatus,
      provisional: false,
    };
  }

  if (approvedWithNotes && evidenceStatus === "CURRENT") {
    reasons.push("Engineer provisionally accepted incomplete or review-required evidence with notes.");
    return {
      state: "PROVISIONALLY_CERTIFIED",
      reasons,
      requiredActions,
      canCreateChildScopeVersion: true,
      canGenerateQuote: true,
      canProceedToPackage: false,
      evidenceGrade,
      missingConstraintLayers,
      constraintCompletenessPercent,
      evidenceStatus,
      provisional: true,
    };
  }

  return {
    state: "ENGINEER_REVIEW_REQUIRED",
    reasons,
    requiredActions,
    canCreateChildScopeVersion: false,
    canGenerateQuote: true,
    canProceedToPackage: false,
    evidenceGrade,
    missingConstraintLayers,
    constraintCompletenessPercent,
    evidenceStatus,
    provisional: false,
  };
}
