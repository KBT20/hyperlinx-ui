import type {
  SpineObjectAddressType,
  SpineObjectAuthorityOwner,
  SpineObjectCatalogEntry,
  SpineObjectClass,
  SpineObjectConstitutionalRole,
  SpineObjectConstructionMethod,
  SpineObjectEvidenceTemplates,
  SpineObjectExecutionStep,
  SpineObjectLifecycleParticipation,
  SpineObjectParticipation,
  SpineObjectPlacementStrategy,
  SpineObjectRecommendationTemplate,
  SpineObjectReviewClassification,
  SpineObjectVisibility,
} from "./SpineObjectCatalogContracts";
import {
  AUTHORITY_PAYMENT_BEHAVIOR,
  DEFAULT_DEPENDENCIES,
  DEFAULT_EXECUTION_SEQUENCE,
  DEFAULT_PAYMENT_BEHAVIOR,
  DEFAULT_REQUIRED_DOCTRINE,
  REVIEW_EXECUTION_SEQUENCE,
  REVIEW_PAYMENT_BEHAVIOR,
} from "./SpineObjectDoctrine";

type CatalogSeed = {
  objectClass: SpineObjectClass;
  objectType: string;
  displayName: string;
  description: string;
  addressType: SpineObjectAddressType;
  parentClasses?: SpineObjectClass[];
  childClasses?: SpineObjectClass[];
  placement?: string;
  engineeringReview?: string;
  evidence?: string[];
  constructionMethods?: string[];
  recommendations?: string[];
  commercialVisibility?: SpineObjectVisibility;
  engineeringVisibility?: SpineObjectVisibility;
  marketplaceVisibility?: SpineObjectVisibility;
  controlVisibility?: SpineObjectVisibility;
  fieldVisibility?: SpineObjectVisibility;
  twinVisibility?: SpineObjectVisibility;
  lifecycleParticipation?: SpineObjectLifecycleParticipation;
  reviewClassification?: SpineObjectReviewClassification;
  role?: SpineObjectConstitutionalRole;
  roles?: SpineObjectConstitutionalRole[];
  authorityOwner?: SpineObjectAuthorityOwner;
  fieldReviewRequired?: boolean;
};

function roleFor(seed: CatalogSeed): SpineObjectConstitutionalRole {
  if (seed.role) return seed.role;
  if (seed.objectClass === "LINEAR_INFRASTRUCTURE") return "LINEAR_ASSET";
  if (seed.objectClass === "LINEAR_CONSTRUCTION") return "CONSTRUCTION_METHOD";
  if (seed.objectClass === "CONTAINED_CONNECTION") return "CONTAINED_OBJECT";
  if (seed.objectClass === "CONSTRAINT") return "CONSTRAINT";
  if (seed.objectClass === "AUTHORITY") return "AUTHORITY";
  return "EXECUTION_OBJECT";
}

function roleSet(seed: CatalogSeed): SpineObjectConstitutionalRole[] {
  const primary = roleFor(seed);
  const extras: SpineObjectConstitutionalRole[] = [];
  if (seed.objectClass === "CONSTRAINT") extras.push("REVIEW_OBJECT");
  if (seed.objectClass === "PRIMARY_STRUCTURE" || seed.objectClass === "LINEAR_INFRASTRUCTURE" || seed.objectClass === "LINEAR_CONSTRUCTION") extras.push("PAYMENT_OBJECT", "LIFECYCLE_OBJECT");
  if (seed.objectClass === "AUTHORITY") extras.push("VALIDATION_OBJECT");
  return [...new Set([primary, ...(seed.roles ?? []), ...extras])];
}

function participation(seed: CatalogSeed, kind: "payment" | "review" | "construction"): SpineObjectParticipation {
  if (seed.objectClass === "AUTHORITY") return kind === "review" ? "REFERENCE_ONLY" : "NOT_APPLICABLE";
  if (seed.objectClass === "CONSTRAINT") return kind === "review" ? "REVIEW_ONLY" : "NOT_APPLICABLE";
  if (kind === "payment") return "PARTICIPATES";
  if (kind === "construction") return seed.objectClass === "LINEAR_INFRASTRUCTURE" || seed.objectClass === "PRIMARY_STRUCTURE" || seed.objectClass === "LINEAR_CONSTRUCTION" ? "PARTICIPATES" : "REFERENCE_ONLY";
  return "PARTICIPATES";
}

function constructionMethods(seed: CatalogSeed): SpineObjectConstructionMethod[] {
  const type = seed.objectType;
  const methods = seed.constructionMethods ?? (
    type.includes("CONDUIT") || type.includes("INNERDUCT") || type.includes("FUTUREPATH") ? ["Plow", "Directional Bore", "Open Trench"] :
      type.includes("RAILROAD") ? ["Directional Bore", "Steel Casing"] :
        type.includes("ROAD") || type.includes("DOT") || type.includes("RIVER") || type.includes("WATER") ? ["Directional Bore"] :
          type.includes("BRIDGE") ? ["Engineering Review Required"] :
            type.includes("HANDHOLE") ? ["Default spacing from Product Doctrine and Audit"] :
              type.includes("MANHOLE") ? ["Major transitions and bore terminations"] :
                type.includes("VAULT") ? ["Product Doctrine driven"] :
                  type.includes("PLOW") ? ["Plow"] :
                    type.includes("BORE") ? ["Directional Bore"] :
                      type.includes("TRENCH") ? ["Open Trench"] :
                        type.includes("RESTORATION") ? ["Restoration"] :
                          ["Engineering Review Required"]
  );
  return methods.map((method, index) => ({
    method,
    preference: method.includes("Review") ? "ENGINEERING_REVIEW_REQUIRED" : index === 0 ? "PREFERRED" : "FALLBACK",
    conditions: index === 0 ? ["Default catalog recommendation"] : ["Use when preferred method is not constructible or permitted"],
  }));
}

function sequenceFor(seed: CatalogSeed): SpineObjectExecutionStep[] {
  if (seed.objectClass === "PRIMARY_STRUCTURE") {
    return [
      { sequence: 10, closeType: "ENGINEERING_CLOSE", label: "Engineering", requiredEvidence: ["Engineering placement record"], legalAfter: [] },
      { sequence: 20, closeType: "PERMIT_CLOSE", label: "Permit", requiredEvidence: ["Permit record"], legalAfter: ["ENGINEERING_CLOSE"] },
      { sequence: 30, closeType: "MATERIAL_PROCUREMENT_CLOSE", label: "Procurement", requiredEvidence: ["Material procurement record"], legalAfter: ["PERMIT_CLOSE"] },
      { sequence: 40, closeType: "LOCATE_CLOSE", label: "Locate", requiredEvidence: ["Utility locate record"], legalAfter: ["MATERIAL_PROCUREMENT_CLOSE"] },
      { sequence: 50, closeType: "CONSTRUCTION_CLOSE", label: "Construction", requiredEvidence: ["GPS", "Photos", "Depth"], legalAfter: ["LOCATE_CLOSE"] },
      { sequence: 60, closeType: "INSPECTION_CLOSE", label: "Inspection", requiredEvidence: ["Inspection"], legalAfter: ["CONSTRUCTION_CLOSE"] },
      { sequence: 70, closeType: "ACCEPTANCE_CLOSE", label: "Acceptance", requiredEvidence: ["Acceptance record"], legalAfter: ["INSPECTION_CLOSE"] },
    ];
  }
  if (seed.objectClass === "LINEAR_CONSTRUCTION") {
    return [
      { sequence: 10, closeType: "PERMIT_CLOSE", label: "Permit", requiredEvidence: ["Permit record"], legalAfter: [] },
      { sequence: 20, closeType: "LOCATE_CLOSE", label: "Locate", requiredEvidence: ["Utility locate record"], legalAfter: ["PERMIT_CLOSE"] },
      { sequence: 30, closeType: "CONSTRUCTION_CLOSE", label: "Construction", requiredEvidence: ["As-Built", "Depth", "Photos"], legalAfter: ["LOCATE_CLOSE"] },
      { sequence: 40, closeType: "INSPECTION_CLOSE", label: "Inspection", requiredEvidence: ["Inspection"], legalAfter: ["CONSTRUCTION_CLOSE"] },
    ];
  }
  if (seed.objectClass === "CONTAINED_CONNECTION") {
    return [
      { sequence: 10, closeType: "FIBER_PLACEMENT_CLOSE", label: "Fiber Placement", requiredEvidence: ["Fiber placement record"], legalAfter: [] },
      { sequence: 20, closeType: "SPLICE_CLOSE", label: "Splicing", requiredEvidence: ["Splice record", "Photos"], legalAfter: ["FIBER_PLACEMENT_CLOSE"] },
      { sequence: 30, closeType: "TESTING_CLOSE", label: "Testing", requiredEvidence: ["OTDR", "Loss", "Labels"], legalAfter: ["SPLICE_CLOSE"] },
      { sequence: 40, closeType: "ACCEPTANCE_CLOSE", label: "Acceptance", requiredEvidence: ["Acceptance record"], legalAfter: ["TESTING_CLOSE"] },
    ];
  }
  if (seed.objectClass === "LINEAR_INFRASTRUCTURE") {
    return [
      { sequence: 10, closeType: "ENGINEERING_CLOSE", label: "Engineering", requiredEvidence: ["Engineering alignment record"], legalAfter: [] },
      { sequence: 20, closeType: "PLACEMENT_CLOSE", label: "Placement", requiredEvidence: ["As-Built", "Photos"], legalAfter: ["ENGINEERING_CLOSE"] },
      { sequence: 30, closeType: "TESTING_CLOSE", label: "Testing", requiredEvidence: seed.objectType.includes("FIBER") ? ["OTDR", "Loss", "Labels"] : ["Continuity or placement inspection"], legalAfter: ["PLACEMENT_CLOSE"] },
      { sequence: 40, closeType: "ACCEPTANCE_CLOSE", label: "Acceptance", requiredEvidence: ["Acceptance record"], legalAfter: ["TESTING_CLOSE"] },
    ];
  }
  return seed.objectClass === "AUTHORITY" || seed.objectClass === "CONSTRAINT" ? REVIEW_EXECUTION_SEQUENCE : DEFAULT_EXECUTION_SEQUENCE;
}

function evidenceFor(seed: CatalogSeed, baseEvidence: string[]): SpineObjectEvidenceTemplates {
  const type = seed.objectType;
  const requiredEvidence = seed.evidence ?? (
    type.includes("HANDHOLE") || type.includes("MANHOLE") || type.includes("VAULT") ? ["GPS", "Photos", "Depth", "Inspection"] :
      type.includes("FIBER") ? ["OTDR", "Loss", "Labels"] :
        type.includes("BORE") ? ["As-Built", "Depth", "Pullback", "Photos"] :
          type.includes("SPLICE") ? ["Splice record", "Photos", "OTDR"] :
            baseEvidence
  );
  return {
    requiredEvidence,
    evidenceByCloseType: {
      ENGINEERING_CLOSE: ["Engineering review record"],
      CONSTRUCTION_CLOSE: requiredEvidence,
      INSPECTION_CLOSE: ["Inspection"],
      TESTING_CLOSE: requiredEvidence.filter((item) => ["OTDR", "Loss", "Labels"].includes(item)),
      ACCEPTANCE_CLOSE: ["Acceptance record"],
    },
  };
}

function placementStrategies(seed: CatalogSeed): SpineObjectPlacementStrategy[] {
  const behavior = seed.placement ?? (
    seed.objectType.includes("HANDHOLE") ? "Audit-derived spacing. Engineering refinement permitted." :
      seed.objectType.includes("SPLICE") ? "Attach to nearest valid parent structure." :
        seed.objectType.includes("FIBER") ? "Align with conduit." :
          seed.objectType.includes("ILA") || seed.objectType.includes("REGEN") ? "Planning engine driven." :
            seed.objectClass === "CONSTRAINT" ? "Remain pending until addressed." :
              seed.addressType === "RANGE" ? "Station address range." :
                seed.addressType === "INHERITED" ? "Inherit parent station address." :
                  "Point station address."
  );
  return [{
    strategyId: `${seed.objectType}:PLACEMENT`,
    label: seed.placement ?? behavior,
    behavior,
    engineeringRefinementPermitted: seed.objectClass !== "AUTHORITY",
    commercialBaselineMutable: false,
  }];
}

function recommendations(seed: CatalogSeed): SpineObjectRecommendationTemplate[] {
  const values = seed.recommendations ?? (
    seed.objectType.includes("RIVER") || seed.objectType.includes("WATER") ? ["Directional Bore"] :
      seed.objectType.includes("RAILROAD") ? ["Directional Bore", "Steel Casing"] :
        seed.objectType.includes("CONDUIT") ? ["Preferred: Plow", "Fallback: Directional Bore"] :
          seed.objectClass === "CONSTRAINT" ? ["Recommend Engineering Review"] :
            constructionMethods(seed).map((method) => method.method)
  );
  return values.map((recommendation, index) => ({
    recommendationId: `${seed.objectType}:RECOMMENDATION:${String(index + 1).padStart(2, "0")}`,
    recommendation,
    deterministic: true,
    noAiReasoning: true,
  }));
}

function productionProfileIds(seed: CatalogSeed): string[] {
  const type = seed.objectType;
  if (type === "PLOW_SEGMENT") return ["PLOW_STANDARD", "HYDROVAC_INCLUDED_STANDARD"];
  if (type === "DIRECTIONAL_BORE_SEGMENT") return ["BORE_DIRT_STANDARD", "HYDROVAC_INCLUDED_STANDARD"];
  if (type === "ROCK_BORE_SEGMENT") return ["BORE_ROCK_STANDARD", "HYDROVAC_INCLUDED_STANDARD"];
  if (type === "OPEN_TRENCH_SEGMENT") return ["OPEN_TRENCH_DIRT_STANDARD"];
  if (type === "CONDUIT") return ["PLOW_STANDARD", "MATERIAL_CONDUIT_1_5_STANDARD"];
  if (type === "FIBER") return ["FIBER_BLOW_STANDARD", "FIBER_PULL_STANDARD", "MATERIAL_FIBER_864_STANDARD", "TESTING_INCLUDED_WITH_SPLICING"];
  if (type === "INNERDUCT" || type === "FUTUREPATH") return ["MATERIAL_FUTUREPATH_STANDARD"];
  if (type === "SPLICE_CASE") return ["SPLICE_864_STANDARD", "MATERIAL_SPLICE_CASE_STANDARD", "TESTING_INCLUDED_WITH_SPLICING"];
  if (type === "HANDHOLE" || type === "MANHOLE" || type === "VAULT") return ["MATERIAL_HANDHOLE_STANDARD"];
  if (type === "RESTORATION") return ["RESTORATION_INCLUDED_STANDARD"];
  if (type === "POP" || type === "ILA" || type === "REGEN" || type === "CABINET" || type === "SHELTER") return ["PROJECT_MANAGEMENT_STANDARD"];
  if (type === "LOCATE_WIRE") return ["PLOW_STANDARD"];
  if (type.includes("RAILROAD") || type.includes("ROAD") || type.includes("RIVER") || type.includes("WATER") || type.includes("DOT")) return ["BORE_DIRT_STANDARD"];
  return [];
}

function materialProfileIds(seed: CatalogSeed): string[] {
  return productionProfileIds(seed).filter((profileId) => profileId.startsWith("MATERIAL_"));
}

function primaryProductionProfileId(seed: CatalogSeed): string | undefined {
  const ids = productionProfileIds(seed);
  return ids.find((profileId) => !profileId.startsWith("MATERIAL_") && !profileId.includes("INCLUDED")) ?? ids[0];
}

function entry(seed: CatalogSeed): SpineObjectCatalogEntry {
  const reviewOnly = seed.lifecycleParticipation === "REVIEW_ONLY" || seed.objectClass === "CONSTRAINT";
  const authorityOnly = seed.lifecycleParticipation === "AUTHORITY_ONLY" || seed.objectClass === "AUTHORITY";
  const constitutionalRole = roleFor(seed);
  const constitutionalRoles = roleSet(seed);
  const defaultStatus = reviewOnly ? "PENDING_REVIEW" : authorityOnly ? "AUTHORITY_REQUIRED" : "NOT_INSTANTIATED_YET";
  const commercialVisibility = seed.commercialVisibility ?? (["HANDHOLE", "SPLICE_CASE", "SLACK_LOOP", "GROUNDING", "LABEL"].includes(seed.objectType) ? "SUMMARY" : "VISIBLE");
  const engineeringVisibility = seed.engineeringVisibility ?? "VISIBLE";
  const marketplaceVisibility = seed.marketplaceVisibility ?? (authorityOnly || reviewOnly ? "SUMMARY" : "VISIBLE");
  const controlVisibility = seed.controlVisibility ?? (authorityOnly || reviewOnly ? "SUMMARY" : "VISIBLE");
  const fieldVisibility = seed.fieldVisibility ?? (reviewOnly || authorityOnly ? "SUMMARY" : "VISIBLE");
  const operationalTwinVisibility = seed.twinVisibility ?? "VISIBLE";
  const lifecycleParticipation = seed.lifecycleParticipation ?? "EXECUTABLE";
  const requiredEvidence = seed.evidence ?? ["Commercial audit reference", "Engineering certification evidence", "Validated Close evidence"];
  const defaultExecutionSequence = sequenceFor(seed);
  const defaultDependencies = DEFAULT_DEPENDENCIES;
  const defaultPaymentBehavior = authorityOnly ? AUTHORITY_PAYMENT_BEHAVIOR : reviewOnly ? REVIEW_PAYMENT_BEHAVIOR : DEFAULT_PAYMENT_BEHAVIOR;
  const entryProductionProfileIds = productionProfileIds(seed);
  const entryMaterialProfileIds = materialProfileIds(seed);
  const entryPrimaryProductionProfileId = primaryProductionProfileId(seed);
  const profile = {
    identity: `SPINE-CATALOG:${seed.objectType}`,
    displayName: seed.displayName,
    description: seed.description,
    constitutionalRole,
    constitutionalRoles,
    objectClass: seed.objectClass,
    objectType: seed.objectType,
    defaultStatus,
    addressType: seed.addressType,
    commercialVisibility,
    engineeringVisibility,
    marketplaceVisibility,
    controlVisibility,
    fieldVisibility,
    operationalTwinVisibility,
    paymentParticipation: participation(seed, "payment"),
    reviewParticipation: participation(seed, "review"),
    lifecycleParticipation,
    constructionParticipation: participation(seed, "construction"),
    engineeringReviewRequired: reviewOnly || seed.engineeringReview?.includes("REQUIRED") !== false,
    fieldReviewRequired: seed.fieldReviewRequired ?? (!reviewOnly && !authorityOnly),
    authorityOwner: seed.authorityOwner ?? (reviewOnly ? "ENGINEERING" : authorityOnly ? "SYSTEM" : "ENGINEERING"),
    primaryProductionProfileId: entryPrimaryProductionProfileId,
    productionProfileIds: entryProductionProfileIds,
    materialProfileIds: entryMaterialProfileIds,
  } as const;
  const hierarchy = {
    legalParents: seed.parentClasses ?? [],
    legalChildren: seed.childClasses ?? [],
    inheritanceRules: seed.addressType === "INHERITED" ? ["Inherit parent Station Address from legal parent object."] : ["Addressing behavior is defined by catalog and assigned by PD-002A."],
    illegalHierarchyFailsValidation: true,
    defaultPath: [
      "MEASURED_SPINE",
      "EXECUTION_ZONE",
      "PAYMENT_SEGMENT",
      "CONSTRUCTION_SEGMENT",
      "STATION_ADDRESS",
      "PRIMARY_SPINE_OBJECT",
      "CONTAINED_OBJECTS",
    ],
  } as const;
  const evidenceTemplates = evidenceFor(seed, requiredEvidence);
  return {
    catalogEntryId: `SPINE-CATALOG:${seed.objectType}`,
    profile,
    constitutionalRole,
    constitutionalRoles,
    objectClass: seed.objectClass,
    objectType: seed.objectType,
    displayName: seed.displayName,
    description: seed.description,
    addressType: seed.addressType,
    parentClasses: seed.parentClasses ?? [],
    childClasses: seed.childClasses ?? [],
    requiredDoctrine: DEFAULT_REQUIRED_DOCTRINE,
    defaultPlacementMethod: seed.placement ?? "STATION_ADDRESS_REQUIRED",
    defaultEngineeringReview: seed.engineeringReview ?? (reviewOnly ? "ENGINEERING_DISPOSITION_REQUIRED" : "ENGINEERING_PLACEMENT_CERTIFICATION_REQUIRED"),
    requiredEvidence: evidenceTemplates.requiredEvidence,
    defaultDependencies,
    defaultExecutionSequence,
    defaultPaymentBehavior,
    commercialVisibility,
    engineeringVisibility,
    marketplaceVisibility,
    controlVisibility,
    fieldVisibility,
    operationalTwinVisibility,
    twinVisibility: operationalTwinVisibility,
    paymentParticipation: profile.paymentParticipation,
    reviewParticipation: profile.reviewParticipation,
    lifecycleParticipation,
    constructionParticipation: profile.constructionParticipation,
    engineeringReviewRequired: profile.engineeringReviewRequired,
    fieldReviewRequired: profile.fieldReviewRequired,
    authorityOwner: profile.authorityOwner,
    primaryProductionProfileId: entryPrimaryProductionProfileId,
    productionProfileIds: entryProductionProfileIds,
    materialProfileIds: entryMaterialProfileIds,
    reviewClassification: seed.reviewClassification ?? (reviewOnly ? "BLOCKING_REVIEW" : "STANDARD"),
    defaultStatus,
    doctrine: {
      doctrineId: `${seed.objectType}:SPINE_OBJECT_DOCTRINE`,
      requiredDoctrine: DEFAULT_REQUIRED_DOCTRINE,
      constitutionalRole,
      behaviorSource: "SPINE_OBJECT_CATALOG",
      workspaceDuplicationProhibited: true,
    },
    constructionMethods: constructionMethods(seed),
    placementStrategies: placementStrategies(seed),
    hierarchy,
    dependencyTemplates: {
      templates: defaultDependencies,
      examples: seed.objectType.includes("FIBER") ? ["Fiber depends on Conduit"] :
        seed.objectType.includes("SPLICE") ? ["Splice depends on Fiber"] :
          ["Payment depends on Validation"],
    },
    sequenceTemplates: {
      templates: defaultExecutionSequence,
      executionOutsideSprint24B: true,
    },
    evidenceTemplates,
    visibilityProfile: {
      commercial: commercialVisibility,
      engineering: engineeringVisibility,
      marketplace: marketplaceVisibility,
      control: controlVisibility,
      field: fieldVisibility,
      operationalTwin: operationalTwinVisibility,
    },
    recommendationTemplates: recommendations(seed),
    noScopeVersionCreation: true,
  };
}

export const SPINE_OBJECT_CATALOG_ENTRIES: SpineObjectCatalogEntry[] = [
  entry({ objectClass: "PRIMARY_STRUCTURE", objectType: "HANDHOLE", displayName: "Handhole", description: "Station-addressed access structure.", addressType: "POINT", childClasses: ["CONTAINED_CONNECTION", "CONSTRAINT", "AUTHORITY"], placement: "POINT_STATION_ADDRESS" }),
  entry({ objectClass: "PRIMARY_STRUCTURE", objectType: "MANHOLE", displayName: "Manhole", description: "Station-addressed maintenance structure.", addressType: "POINT", childClasses: ["CONTAINED_CONNECTION", "CONSTRAINT", "AUTHORITY"], placement: "POINT_STATION_ADDRESS" }),
  entry({ objectClass: "PRIMARY_STRUCTURE", objectType: "VAULT", displayName: "Vault", description: "Station-addressed access vault.", addressType: "POINT", childClasses: ["CONTAINED_CONNECTION", "CONSTRAINT", "AUTHORITY"], placement: "POINT_STATION_ADDRESS" }),
  entry({ objectClass: "PRIMARY_STRUCTURE", objectType: "POP", displayName: "POP", description: "Point of presence facility on the measured spine.", addressType: "POINT", childClasses: ["CONTAINED_CONNECTION", "CONSTRAINT", "AUTHORITY"], placement: "POINT_STATION_ADDRESS" }),
  entry({ objectClass: "PRIMARY_STRUCTURE", objectType: "CABINET", displayName: "Cabinet", description: "Station-addressed cabinet or enclosure.", addressType: "POINT", childClasses: ["CONTAINED_CONNECTION", "AUTHORITY"], placement: "POINT_STATION_ADDRESS" }),
  entry({ objectClass: "PRIMARY_STRUCTURE", objectType: "ILA", displayName: "ILA Facility", description: "Inline amplifier or regeneration facility.", addressType: "POINT", childClasses: ["CONTAINED_CONNECTION", "CONSTRAINT", "AUTHORITY"], placement: "POINT_STATION_ADDRESS" }),
  entry({ objectClass: "PRIMARY_STRUCTURE", objectType: "REGEN", displayName: "Regen Facility", description: "Regeneration facility on the measured spine.", addressType: "POINT", childClasses: ["CONTAINED_CONNECTION", "CONSTRAINT", "AUTHORITY"], placement: "POINT_STATION_ADDRESS" }),
  entry({ objectClass: "PRIMARY_STRUCTURE", objectType: "SHELTER", displayName: "Shelter", description: "Station-addressed hut or shelter.", addressType: "POINT", childClasses: ["CONTAINED_CONNECTION", "AUTHORITY"], placement: "POINT_STATION_ADDRESS" }),

  entry({ objectClass: "LINEAR_INFRASTRUCTURE", objectType: "CONDUIT", displayName: "Conduit", description: "Linear duct/conduit infrastructure.", addressType: "RANGE", parentClasses: ["LINEAR_CONSTRUCTION"], childClasses: ["CONTAINED_CONNECTION", "CONSTRAINT", "AUTHORITY"], placement: "STATION_ADDRESS_RANGE" }),
  entry({ objectClass: "LINEAR_INFRASTRUCTURE", objectType: "FIBER", displayName: "Fiber", description: "Linear fiber infrastructure.", addressType: "RANGE", parentClasses: ["LINEAR_CONSTRUCTION"], childClasses: ["CONTAINED_CONNECTION", "CONSTRAINT", "AUTHORITY"], placement: "STATION_ADDRESS_RANGE" }),
  entry({ objectClass: "LINEAR_INFRASTRUCTURE", objectType: "INNERDUCT", displayName: "Innerduct", description: "Linear innerduct infrastructure.", addressType: "RANGE", parentClasses: ["LINEAR_CONSTRUCTION"], childClasses: ["CONTAINED_CONNECTION", "AUTHORITY"], placement: "STATION_ADDRESS_RANGE" }),
  entry({ objectClass: "LINEAR_INFRASTRUCTURE", objectType: "FUTUREPATH", displayName: "FuturePath", description: "Linear future duct or microduct reserve.", addressType: "RANGE", parentClasses: ["LINEAR_CONSTRUCTION"], childClasses: ["CONTAINED_CONNECTION", "AUTHORITY"], placement: "STATION_ADDRESS_RANGE" }),
  entry({ objectClass: "LINEAR_INFRASTRUCTURE", objectType: "LOCATE_WIRE", displayName: "Locate Wire", description: "Linear locate wire infrastructure.", addressType: "RANGE", parentClasses: ["LINEAR_CONSTRUCTION"], childClasses: ["AUTHORITY"], placement: "STATION_ADDRESS_RANGE" }),
  entry({ objectClass: "LINEAR_INFRASTRUCTURE", objectType: "RESTORATION", displayName: "Restoration", description: "Station-ranged restoration obligation.", addressType: "RANGE", parentClasses: ["LINEAR_CONSTRUCTION"], childClasses: ["AUTHORITY"], placement: "STATION_ADDRESS_RANGE" }),

  entry({ objectClass: "LINEAR_CONSTRUCTION", objectType: "PLOW_SEGMENT", displayName: "Plow Segment", description: "Linear plowing construction method.", addressType: "RANGE", childClasses: ["LINEAR_INFRASTRUCTURE", "CONSTRAINT", "AUTHORITY"], placement: "CONSTRUCTION_METHOD_RANGE" }),
  entry({ objectClass: "LINEAR_CONSTRUCTION", objectType: "DIRECTIONAL_BORE_SEGMENT", displayName: "Directional Bore Segment", description: "Linear directional bore construction method.", addressType: "RANGE", childClasses: ["LINEAR_INFRASTRUCTURE", "CONSTRAINT", "AUTHORITY"], placement: "CONSTRUCTION_METHOD_RANGE" }),
  entry({ objectClass: "LINEAR_CONSTRUCTION", objectType: "ROCK_BORE_SEGMENT", displayName: "Rock Bore Segment", description: "Linear rock boring construction method.", addressType: "RANGE", childClasses: ["LINEAR_INFRASTRUCTURE", "CONSTRAINT", "AUTHORITY"], placement: "CONSTRUCTION_METHOD_RANGE", engineeringReview: "GEOTECH_REVIEW_REQUIRED" }),
  entry({ objectClass: "LINEAR_CONSTRUCTION", objectType: "OPEN_TRENCH_SEGMENT", displayName: "Open Trench Segment", description: "Linear trench construction method.", addressType: "RANGE", childClasses: ["LINEAR_INFRASTRUCTURE", "CONSTRAINT", "AUTHORITY"], placement: "CONSTRUCTION_METHOD_RANGE" }),

  entry({ objectClass: "CONTAINED_CONNECTION", objectType: "SPLICE_CASE", displayName: "Splice Case", description: "Contained splice object inheriting parent station address.", addressType: "INHERITED", parentClasses: ["PRIMARY_STRUCTURE", "LINEAR_INFRASTRUCTURE"], childClasses: ["AUTHORITY"], placement: "INHERIT_PARENT_STATION_ADDRESS" }),
  entry({ objectClass: "CONTAINED_CONNECTION", objectType: "SLACK_LOOP", displayName: "Slack Loop", description: "Contained slack loop inheriting parent address.", addressType: "INHERITED", parentClasses: ["PRIMARY_STRUCTURE", "LINEAR_INFRASTRUCTURE"], childClasses: ["AUTHORITY"], placement: "INHERIT_PARENT_STATION_ADDRESS" }),
  entry({ objectClass: "CONTAINED_CONNECTION", objectType: "FIBER_TERMINATION", displayName: "Fiber Termination", description: "Fiber termination inside a structure or cabinet.", addressType: "INHERITED", parentClasses: ["PRIMARY_STRUCTURE", "LINEAR_INFRASTRUCTURE"], childClasses: ["AUTHORITY"], placement: "INHERIT_PARENT_STATION_ADDRESS" }),
  entry({ objectClass: "CONTAINED_CONNECTION", objectType: "GROUNDING", displayName: "Grounding", description: "Grounding connection associated with a parent object.", addressType: "INHERITED", parentClasses: ["PRIMARY_STRUCTURE", "LINEAR_INFRASTRUCTURE"], childClasses: ["AUTHORITY"], placement: "INHERIT_PARENT_STATION_ADDRESS" }),
  entry({ objectClass: "CONTAINED_CONNECTION", objectType: "LABEL", displayName: "Label", description: "Physical labeling attached to a parent object.", addressType: "INHERITED", parentClasses: ["PRIMARY_STRUCTURE", "LINEAR_INFRASTRUCTURE"], childClasses: ["AUTHORITY"], placement: "INHERIT_PARENT_STATION_ADDRESS" }),

  entry({ objectClass: "CONSTRAINT", objectType: "RAILROAD_CROSSING", displayName: "Railroad Crossing", description: "Railroad crossing requiring Engineering disposition.", addressType: "UNASSIGNED_REVIEW", parentClasses: ["LINEAR_CONSTRUCTION", "LINEAR_INFRASTRUCTURE"], childClasses: ["AUTHORITY"], lifecycleParticipation: "REVIEW_ONLY", placement: "ENGINEERING_ASSIGN_ADDRESS_OR_DISPOSITION", evidence: ["Crossing evidence", "Permit or disposition record"] }),
  entry({ objectClass: "CONSTRAINT", objectType: "ROAD_CROSSING", displayName: "Road Crossing", description: "Road crossing requiring Engineering disposition.", addressType: "UNASSIGNED_REVIEW", parentClasses: ["LINEAR_CONSTRUCTION", "LINEAR_INFRASTRUCTURE"], childClasses: ["AUTHORITY"], lifecycleParticipation: "REVIEW_ONLY", placement: "ENGINEERING_ASSIGN_ADDRESS_OR_DISPOSITION" }),
  entry({ objectClass: "CONSTRAINT", objectType: "RIVER_CROSSING", displayName: "River Crossing", description: "River crossing requiring Engineering disposition.", addressType: "UNASSIGNED_REVIEW", parentClasses: ["LINEAR_CONSTRUCTION", "LINEAR_INFRASTRUCTURE"], childClasses: ["AUTHORITY"], lifecycleParticipation: "REVIEW_ONLY", placement: "ENGINEERING_ASSIGN_ADDRESS_OR_DISPOSITION" }),
  entry({ objectClass: "CONSTRAINT", objectType: "WATER_CROSSING", displayName: "Water Crossing", description: "Water crossing requiring Engineering disposition.", addressType: "UNASSIGNED_REVIEW", parentClasses: ["LINEAR_CONSTRUCTION", "LINEAR_INFRASTRUCTURE"], childClasses: ["AUTHORITY"], lifecycleParticipation: "REVIEW_ONLY", placement: "ENGINEERING_ASSIGN_ADDRESS_OR_DISPOSITION" }),
  entry({ objectClass: "CONSTRAINT", objectType: "DOT_CROSSING", displayName: "DOT / Highway Crossing", description: "DOT or highway crossing requiring review.", addressType: "UNASSIGNED_REVIEW", parentClasses: ["LINEAR_CONSTRUCTION", "LINEAR_INFRASTRUCTURE"], childClasses: ["AUTHORITY"], lifecycleParticipation: "REVIEW_ONLY", placement: "ENGINEERING_ASSIGN_ADDRESS_OR_DISPOSITION" }),
  entry({ objectClass: "CONSTRAINT", objectType: "BRIDGE", displayName: "Bridge", description: "Bridge crossing or attachment requiring Engineering disposition.", addressType: "UNASSIGNED_REVIEW", parentClasses: ["LINEAR_CONSTRUCTION", "LINEAR_INFRASTRUCTURE"], childClasses: ["AUTHORITY"], lifecycleParticipation: "REVIEW_ONLY", placement: "ENGINEERING_ASSIGN_ADDRESS_OR_DISPOSITION" }),
  entry({ objectClass: "CONSTRAINT", objectType: "BRIDGE_ATTACHMENT", displayName: "Bridge Attachment", description: "Bridge attachment review object.", addressType: "UNASSIGNED_REVIEW", parentClasses: ["LINEAR_CONSTRUCTION", "LINEAR_INFRASTRUCTURE"], childClasses: ["AUTHORITY"], lifecycleParticipation: "REVIEW_ONLY", placement: "ENGINEERING_ASSIGN_ADDRESS_OR_DISPOSITION" }),
  entry({ objectClass: "CONSTRAINT", objectType: "UTILITY_CONFLICT", displayName: "Utility Conflict", description: "Utility conflict review object.", addressType: "UNASSIGNED_REVIEW", parentClasses: ["LINEAR_CONSTRUCTION", "LINEAR_INFRASTRUCTURE", "PRIMARY_STRUCTURE"], childClasses: ["AUTHORITY"], lifecycleParticipation: "REVIEW_ONLY", placement: "ENGINEERING_ASSIGN_ADDRESS_OR_DISPOSITION" }),
  entry({ objectClass: "CONSTRAINT", objectType: "ENVIRONMENTAL_IMPACT", displayName: "Environmental Impact", description: "Environmental review object.", addressType: "UNASSIGNED_REVIEW", parentClasses: ["LINEAR_CONSTRUCTION", "LINEAR_INFRASTRUCTURE"], childClasses: ["AUTHORITY"], lifecycleParticipation: "REVIEW_ONLY", placement: "ENGINEERING_ASSIGN_ADDRESS_OR_DISPOSITION" }),
  entry({ objectClass: "CONSTRAINT", objectType: "ROCK_REVIEW", displayName: "Rock Review", description: "Geotech or rock percentage review object.", addressType: "UNASSIGNED_REVIEW", parentClasses: ["LINEAR_CONSTRUCTION"], childClasses: ["AUTHORITY"], lifecycleParticipation: "REVIEW_ONLY", placement: "ENGINEERING_ASSIGN_ADDRESS_OR_DISPOSITION" }),

  entry({ objectClass: "AUTHORITY", objectType: "COMMERCIAL_APPROVAL", displayName: "Commercial Approval", description: "Commercial authority reference.", addressType: "PACKAGE", parentClasses: ["PRIMARY_STRUCTURE", "LINEAR_INFRASTRUCTURE", "LINEAR_CONSTRUCTION", "CONTAINED_CONNECTION", "CONSTRAINT"], lifecycleParticipation: "AUTHORITY_ONLY", placement: "PACKAGE_LEVEL_AUTHORITY", commercialVisibility: "SUMMARY", engineeringVisibility: "SUMMARY", fieldVisibility: "HIDDEN", twinVisibility: "HIDDEN" }),
  entry({ objectClass: "AUTHORITY", objectType: "ENGINEERING_REVIEW", displayName: "Engineering Review", description: "Engineering review authority reference.", addressType: "PACKAGE", parentClasses: ["PRIMARY_STRUCTURE", "LINEAR_INFRASTRUCTURE", "LINEAR_CONSTRUCTION", "CONTAINED_CONNECTION", "CONSTRAINT"], lifecycleParticipation: "AUTHORITY_ONLY", placement: "PACKAGE_LEVEL_AUTHORITY", commercialVisibility: "SUMMARY", engineeringVisibility: "SUMMARY", fieldVisibility: "HIDDEN", twinVisibility: "HIDDEN" }),
  entry({ objectClass: "AUTHORITY", objectType: "PERMIT_PACKAGE", displayName: "Permit Package", description: "Permit package authority reference.", addressType: "PACKAGE", parentClasses: ["CONSTRAINT", "LINEAR_CONSTRUCTION"], lifecycleParticipation: "AUTHORITY_ONLY", placement: "PACKAGE_LEVEL_AUTHORITY", commercialVisibility: "SUMMARY", engineeringVisibility: "VISIBLE", fieldVisibility: "SUMMARY", twinVisibility: "SUMMARY" }),
  entry({ objectClass: "AUTHORITY", objectType: "MATERIAL_PROCUREMENT", displayName: "Material Procurement", description: "Material procurement authority reference.", addressType: "PACKAGE", parentClasses: ["PRIMARY_STRUCTURE", "LINEAR_INFRASTRUCTURE", "CONTAINED_CONNECTION"], lifecycleParticipation: "AUTHORITY_ONLY", placement: "PACKAGE_LEVEL_AUTHORITY", commercialVisibility: "SUMMARY", engineeringVisibility: "SUMMARY", fieldVisibility: "SUMMARY", twinVisibility: "SUMMARY" }),
];
