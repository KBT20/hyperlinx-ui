import type { CorridorAuthorityOwner } from "./corridorTypes";

export type CorridorObjectDomain =
  | "DEVELOPMENT"
  | "INFRASTRUCTURE"
  | "BUILDABILITY"
  | "MONETIZATION"
  | "EVIDENCE"
  | "EXECUTION_REFERENCE";

export type CorridorObjectRegistryEntry = {
  objectType: string;
  domain: CorridorObjectDomain;
  authorityOwner: CorridorAuthorityOwner;
  authorityBoundary: string;
  evidenceRequired: boolean;
  mayBecomeScopeVersion: boolean;
  executionObject: boolean;
};

export const CORRIDOR_OBJECT_REGISTRY: CorridorObjectRegistryEntry[] = [
  {
    objectType: "Corridor",
    domain: "DEVELOPMENT",
    authorityOwner: "CORRIDOR_SYNTHESIS",
    authorityBoundary: "Parent development opportunity; never executes work directly.",
    evidenceRequired: true,
    mayBecomeScopeVersion: false,
    executionObject: false,
  },
  {
    objectType: "CorridorEndpoint",
    domain: "DEVELOPMENT",
    authorityOwner: "TRANSLATE",
    authorityBoundary: "Normalized A/Z/intermediate asset evidence; promoted only through engineering review.",
    evidenceRequired: true,
    mayBecomeScopeVersion: false,
    executionObject: false,
  },
  {
    objectType: "CorridorRouteCandidate",
    domain: "DEVELOPMENT",
    authorityOwner: "CORRIDOR_SYNTHESIS",
    authorityBoundary: "Candidate geometry option; may be selected into a ScopeVersion after human approval.",
    evidenceRequired: true,
    mayBecomeScopeVersion: true,
    executionObject: false,
  },
  {
    objectType: "ConduitSystem",
    domain: "INFRASTRUCTURE",
    authorityOwner: "HUMAN_ENGINEERING",
    authorityBoundary: "Defines duct design and sale eligibility for selected corridor design.",
    evidenceRequired: true,
    mayBecomeScopeVersion: true,
    executionObject: false,
  },
  {
    objectType: "FiberSystem",
    domain: "INFRASTRUCTURE",
    authorityOwner: "HUMAN_ENGINEERING",
    authorityBoundary: "Defines fiber design, IRU eligibility, and strand allocation.",
    evidenceRequired: true,
    mayBecomeScopeVersion: true,
    executionObject: false,
  },
  {
    objectType: "OpticalSystem",
    domain: "INFRASTRUCTURE",
    authorityOwner: "HUMAN_ENGINEERING",
    authorityBoundary: "Defines transport capability, regen needs, and service standards.",
    evidenceRequired: true,
    mayBecomeScopeVersion: true,
    executionObject: false,
  },
  {
    objectType: "InterconnectionNode",
    domain: "INFRASTRUCTURE",
    authorityOwner: "HUMAN_ENGINEERING",
    authorityBoundary: "Identifies cloud, carrier, IX, or customer handoff nodes.",
    evidenceRequired: true,
    mayBecomeScopeVersion: true,
    executionObject: false,
  },
  {
    objectType: "RegenerationSite",
    domain: "INFRASTRUCTURE",
    authorityOwner: "HUMAN_ENGINEERING",
    authorityBoundary: "Identifies optical regeneration or amplification requirements.",
    evidenceRequired: true,
    mayBecomeScopeVersion: true,
    executionObject: false,
  },
  {
    objectType: "Jurisdiction",
    domain: "BUILDABILITY",
    authorityOwner: "CORRIDOR_SYNTHESIS",
    authorityBoundary: "Permitting evidence and lead-time model; not execution authority.",
    evidenceRequired: true,
    mayBecomeScopeVersion: true,
    executionObject: false,
  },
  {
    objectType: "Crossing",
    domain: "BUILDABILITY",
    authorityOwner: "CORRIDOR_SYNTHESIS",
    authorityBoundary: "Crossing risk and method evidence; certified by engineering before execution.",
    evidenceRequired: true,
    mayBecomeScopeVersion: true,
    executionObject: false,
  },
  {
    objectType: "Constraint",
    domain: "BUILDABILITY",
    authorityOwner: "CORRIDOR_SYNTHESIS",
    authorityBoundary: "Constraint evidence influencing scoring; cannot mutate kernel state.",
    evidenceRequired: true,
    mayBecomeScopeVersion: true,
    executionObject: false,
  },
  {
    objectType: "UtilityAsset",
    domain: "BUILDABILITY",
    authorityOwner: "CORRIDOR_SYNTHESIS",
    authorityBoundary: "Utility conflict or support evidence; authority remains with selected ScopeVersion.",
    evidenceRequired: true,
    mayBecomeScopeVersion: true,
    executionObject: false,
  },
  {
    objectType: "ServiceZone",
    domain: "BUILDABILITY",
    authorityOwner: "CORRIDOR_SYNTHESIS",
    authorityBoundary: "Operational serviceability evidence for restoration and maintenance planning.",
    evidenceRequired: true,
    mayBecomeScopeVersion: true,
    executionObject: false,
  },
  {
    objectType: "ResidualCapacity",
    domain: "MONETIZATION",
    authorityOwner: "MARKETPLACE",
    authorityBoundary: "Commercial opportunity estimate for unused duct/fiber/transport capacity.",
    evidenceRequired: true,
    mayBecomeScopeVersion: false,
    executionObject: false,
  },
  {
    objectType: "MonetizationOpportunity",
    domain: "MONETIZATION",
    authorityOwner: "MARKETPLACE",
    authorityBoundary: "Secondary customer opportunity; does not establish corridor truth.",
    evidenceRequired: true,
    mayBecomeScopeVersion: false,
    executionObject: false,
  },
  {
    objectType: "CorridorProduct",
    domain: "MONETIZATION",
    authorityOwner: "MARKETPLACE",
    authorityBoundary: "Product and commercial model; consumed by ScopeVersion quoting later.",
    evidenceRequired: true,
    mayBecomeScopeVersion: false,
    executionObject: false,
  },
  {
    objectType: "CorridorEvidence",
    domain: "EVIDENCE",
    authorityOwner: "TRANSLATE",
    authorityBoundary: "Evidence supports authority but is never authority by itself.",
    evidenceRequired: false,
    mayBecomeScopeVersion: false,
    executionObject: false,
  },
  {
    objectType: "ScopeVersionReference",
    domain: "EXECUTION_REFERENCE",
    authorityOwner: "KERNEL",
    authorityBoundary: "Selected corridor design executes only after promotion into ScopeVersion truth.",
    evidenceRequired: true,
    mayBecomeScopeVersion: false,
    executionObject: true,
  },
];

export function getCorridorObjectRegistryEntry(objectType: string) {
  return CORRIDOR_OBJECT_REGISTRY.find((entry) => entry.objectType === objectType);
}

