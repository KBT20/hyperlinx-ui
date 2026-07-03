import type {
  SpineObjectClass,
  SpineObjectDependencyTemplate,
  SpineObjectExecutionStep,
  SpineObjectPaymentBehavior,
} from "./SpineObjectCatalogContracts";

export const SPINE_OBJECT_CLASSES: SpineObjectClass[] = [
  "PRIMARY_STRUCTURE",
  "LINEAR_INFRASTRUCTURE",
  "LINEAR_CONSTRUCTION",
  "CONTAINED_CONNECTION",
  "CONSTRAINT",
  "AUTHORITY",
];

export const LEGAL_CHILD_CLASSES: Record<SpineObjectClass, SpineObjectClass[]> = {
  PRIMARY_STRUCTURE: ["CONTAINED_CONNECTION", "CONSTRAINT", "AUTHORITY"],
  LINEAR_INFRASTRUCTURE: ["CONTAINED_CONNECTION", "CONSTRAINT", "AUTHORITY"],
  LINEAR_CONSTRUCTION: ["LINEAR_INFRASTRUCTURE", "CONSTRAINT", "AUTHORITY"],
  CONTAINED_CONNECTION: ["AUTHORITY"],
  CONSTRAINT: ["AUTHORITY"],
  AUTHORITY: [],
};

export const LEGAL_PARENT_CLASSES: Record<SpineObjectClass, SpineObjectClass[]> = {
  PRIMARY_STRUCTURE: [],
  LINEAR_INFRASTRUCTURE: ["LINEAR_CONSTRUCTION"],
  LINEAR_CONSTRUCTION: [],
  CONTAINED_CONNECTION: ["PRIMARY_STRUCTURE", "LINEAR_INFRASTRUCTURE"],
  CONSTRAINT: ["PRIMARY_STRUCTURE", "LINEAR_INFRASTRUCTURE", "LINEAR_CONSTRUCTION"],
  AUTHORITY: ["PRIMARY_STRUCTURE", "LINEAR_INFRASTRUCTURE", "LINEAR_CONSTRUCTION", "CONTAINED_CONNECTION", "CONSTRAINT"],
};

export const DEFAULT_REQUIRED_DOCTRINE = ["PD-001", "PD-002A", "PD-002B-PRECURSOR"];

export const DEFAULT_DEPENDENCIES: SpineObjectDependencyTemplate[] = [
  { dependencyType: "DOCTRINE_REQUIRED", description: "Object must resolve to product and placement doctrine.", required: true },
  { dependencyType: "ADDRESS_REQUIRED", description: "Object must be addressable on the measured spine when physical execution is required.", required: true },
  { dependencyType: "EVIDENCE_REQUIRED", description: "Object must declare evidence required for valid Close.", required: true },
  { dependencyType: "SEQUENCE_REQUIRED", description: "Object must carry a legal Close sequence before Draft IOF approval.", required: true },
];

export const DEFAULT_EXECUTION_SEQUENCE: SpineObjectExecutionStep[] = [
  { sequence: 10, closeType: "COMMERCIAL_CLOSE", label: "Commercial manifest validated", requiredEvidence: ["Commercial audit reference"], legalAfter: [] },
  { sequence: 20, closeType: "ENGINEERING_CLOSE", label: "Engineering placement certified", requiredEvidence: ["Engineering review record"], legalAfter: ["COMMERCIAL_CLOSE"] },
  { sequence: 30, closeType: "CONSTRUCTION_CLOSE", label: "Physical work completed", requiredEvidence: ["Field evidence"], legalAfter: ["ENGINEERING_CLOSE"] },
  { sequence: 40, closeType: "ACCEPTANCE_CLOSE", label: "Object accepted for payment", requiredEvidence: ["Acceptance record"], legalAfter: ["CONSTRUCTION_CLOSE"] },
];

export const REVIEW_EXECUTION_SEQUENCE: SpineObjectExecutionStep[] = [
  { sequence: 10, closeType: "COMMERCIAL_CLOSE", label: "Commercial review item declared", requiredEvidence: ["Commercial audit reference"], legalAfter: [] },
  { sequence: 20, closeType: "ENGINEERING_ACCEPTANCE_CLOSE", label: "Engineering disposition recorded", requiredEvidence: ["Engineering disposition"], legalAfter: ["COMMERCIAL_CLOSE"] },
];

export const DEFAULT_PAYMENT_BEHAVIOR: SpineObjectPaymentBehavior = {
  paymentEligible: true,
  validationRelationship: "OBJECT_CLOSE_REQUIRED",
  revenueRelationship: "REVENUE_ELIGIBLE_AFTER_VALIDATED_CLOSE",
};

export const REVIEW_PAYMENT_BEHAVIOR: SpineObjectPaymentBehavior = {
  paymentEligible: false,
  validationRelationship: "REVIEW_DISPOSITION_REQUIRED",
  revenueRelationship: "REFERENCE_ONLY",
};

export const AUTHORITY_PAYMENT_BEHAVIOR: SpineObjectPaymentBehavior = {
  paymentEligible: false,
  validationRelationship: "NO_PAYMENT_RELATIONSHIP",
  revenueRelationship: "NOT_REVENUE_BEARING",
};

export function classAllowsChild(parentClass: SpineObjectClass, childClass: SpineObjectClass) {
  return LEGAL_CHILD_CLASSES[parentClass]?.includes(childClass) ?? false;
}

export function classAllowsParent(childClass: SpineObjectClass, parentClass: SpineObjectClass) {
  return LEGAL_PARENT_CLASSES[childClass]?.includes(parentClass) ?? false;
}
