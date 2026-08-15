import type { CommercialCorridorSegment } from "../commercial/CommercialCorridorDraftEngine";
import type { DALCoordinate } from "../types/dal";
import type {
  ProductDoctrine,
  ProductDoctrineAssembly,
  ProductDoctrineAppliesTo,
  ProductDoctrineCertificationRules,
  ProductDoctrineCloseSequence,
  ProductDoctrineConduitAssembly,
  ProductDoctrineCrossingAssembly,
  ProductDoctrineEngineeringObjectDefinition,
  ProductDoctrineEvidenceRequirement,
  ProductDoctrineExecutionSequence,
  ProductDoctrineFiberAssembly,
  ProductDoctrineLifecycleDefinition,
  ProductDoctrineObject,
  ProductDoctrineOsrmRoute,
  ProductDoctrinePricingSummary,
  ProductDoctrineQuantitySummary,
  ProductDoctrineRegistryEntry,
  ProductDoctrineRequiredAsset,
  ProductDoctrineRequiredService,
  ProductDoctrineRouteSegment,
  ProductDoctrineScopeVersionReadinessRequirement,
  ProductDoctrineSite,
  ProductDoctrineSpine,
  ProductDoctrineStation,
  ProductDoctrineStationLifecycleProjection,
  ProductDoctrineStructureAssembly,
  ProductDoctrineValidationCheck,
  ProductDoctrineValidationSummary,
} from "./ProductDoctrineContracts";
import type { DuctDarkFiberProjectConfiguration } from "./DuctDarkFiberProjectConfiguration";

export const POINT_TO_POINT_LONG_HAUL_PRODUCT_ID = "POINT_TO_POINT_LONG_HAUL_CONDUIT_FIBER";
export const POINT_TO_POINT_LONG_HAUL_DOCTRINE_ID = "DOCTRINE-L1-POINT-TO-POINT-LONG-HAUL-CONDUIT-FIBER";
export const POINT_TO_POINT_LONG_HAUL_PREVIOUS_DOCTRINE_VERSION = "19B.1.0";
export const POINT_TO_POINT_LONG_HAUL_DOCTRINE_VERSION = "20C.1.0";
export const POINT_TO_POINT_LONG_HAUL_DOCTRINE_CHANGE_REASON = "Separate Product Doctrine requirements from Project Configuration, source evidence, estimating assumptions, Commercial Policy, and Engineering authority; remove mileage-generated infrastructure.";
export const POINT_TO_POINT_LONG_HAUL_BUSINESS_PRODUCT_NAME = "Point-to-Point Duct & Dark Fiber";
export const POINT_TO_POINT_LONG_HAUL_TECHNICAL_DOCTRINE_NAME = "Point-to-Point Long-Haul Conduit & Fiber";

const DEFAULT_SERVICE_STATES = [
  "DEFINED",
  "SCHEDULED",
  "PREREQUISITES_RELEASED",
  "MOBILIZED",
  "WORK_COMPLETED",
  "EVIDENCE_CAPTURED",
  "ENGINEERING_ACCEPTED",
  "BILLABLE",
  "PAYMENT_ELIGIBLE",
  "CLOSED",
];

const DEFAULT_ASSET_STATES = [
  "DEFINED",
  "PROCURED",
  "RECEIVED",
  "ALLOCATED",
  "INSTALLED",
  "GPS_VERIFIED",
  "EVIDENCE_CAPTURED",
  "ENGINEERING_ACCEPTED",
  "CERTIFIED",
  "OPERATIONAL",
];

function serviceLifecycle(overrides: Partial<ProductDoctrineLifecycleDefinition> = {}): ProductDoctrineLifecycleDefinition {
  return {
    lifecycleStates: DEFAULT_SERVICE_STATES,
    prerequisiteDependencies: ["commercial release package", "draft IOF package", "station projection"],
    releaseGates: ["engineering station release", "permit release when applicable", "materials release when applicable"],
    blockedReasons: ["missing prerequisite", "unresolved engineering exception", "missing evidence"],
    requiredEvidence: ["work completion evidence", "station evidence", "engineering acceptance"],
    acceptanceCriteria: ["scope completed at required station or range", "required evidence accepted", "engineering review accepted"],
    responsibleRole: "CONSTRUCTION",
    billableTrigger: "Engineering acceptance recorded for completed service.",
    paymentTrigger: "Close sequence accepted and billing eligibility released.",
    capitalCashFlowTrigger: "Service cost accrues when work is completed and accepted.",
    twinStateTransition: "SERVICE_CLOSED_PROJECTS_TO_TWIN_ACTIVITY",
    ...overrides,
  };
}

function assetLifecycle(overrides: Partial<ProductDoctrineLifecycleDefinition> = {}): ProductDoctrineLifecycleDefinition {
  return {
    lifecycleStates: DEFAULT_ASSET_STATES,
    prerequisiteDependencies: ["commercial release package", "draft IOF package", "station projection"],
    releaseGates: ["engineering asset release", "material availability", "station/object release"],
    blockedReasons: ["material not received", "station not released", "missing evidence"],
    requiredEvidence: ["material receipt", "installation evidence", "GPS/photo evidence", "engineering acceptance"],
    acceptanceCriteria: ["asset installed or allocated as defined", "asset evidence accepted", "engineering acceptance recorded"],
    responsibleRole: "CONSTRUCTION",
    billableTrigger: "Asset installed and accepted by Engineering.",
    paymentTrigger: "Asset close sequence accepted.",
    capitalCashFlowTrigger: "Capitalized asset value starts when installed and accepted.",
    twinStateTransition: "ASSET_OPERATIONAL_PROJECTS_TO_TWIN_STATE",
    ...overrides,
  };
}

function objectLifecycle(overrides: Partial<ProductDoctrineLifecycleDefinition> = {}): ProductDoctrineLifecycleDefinition {
  return {
    lifecycleStates: ["DEFINED", "STATIONED", "DEPENDENCIES_RELEASED", "PLACED", "EVIDENCE_CAPTURED", "ENGINEERING_ACCEPTED", "CERTIFIED"],
    prerequisiteDependencies: ["engineering baseline", "station projection", "dependency graph"],
    releaseGates: ["station release", "object dependency release", "engineering review"],
    blockedReasons: ["missing station", "dependency unresolved", "evidence missing"],
    requiredEvidence: ["object placement evidence", "dependency evidence", "engineering acceptance"],
    acceptanceCriteria: ["object has station or station range", "dependencies resolved", "evidence accepted"],
    responsibleRole: "ENGINEERING",
    billableTrigger: "Object accepted into certified engineering definition.",
    paymentTrigger: "Object close sequence or related service/asset close is accepted.",
    capitalCashFlowTrigger: "Object contributes to capital plan after certification.",
    twinStateTransition: "CERTIFIED_OBJECT_PROJECTS_TO_TWIN",
    ...overrides,
  };
}

function service(
  serviceId: string,
  serviceName: string,
  serviceType: string,
  overrides: Partial<ProductDoctrineLifecycleDefinition> = {},
): ProductDoctrineRequiredService {
  return {
    serviceId,
    serviceName,
    serviceType,
    serviceVsAssetRule: "SERVICE_NOT_ASSET",
    consumes: ["LABOR", "EQUIPMENT", "SUBCONTRACTOR", "PROFESSIONAL_EFFORT"],
    stationLevelProjection: true,
    ...serviceLifecycle(overrides),
  };
}

function asset(
  assetId: string,
  assetName: string,
  assetType: string,
  overrides: Partial<ProductDoctrineLifecycleDefinition> & { requiredWhen?: string } = {},
): ProductDoctrineRequiredAsset {
  return {
    assetId,
    assetName,
    assetType,
    tangibleInfrastructure: true,
    representedInTwin: true,
    ...assetLifecycle(overrides),
  };
}

function engineeringObject(
  engineeringObjectType: ProductDoctrineEngineeringObjectDefinition["engineeringObjectType"],
  label: string,
  requiredServiceIds: string[],
  requiredAssetIds: string[],
  stationLevelProjection = true,
  overrides: Partial<ProductDoctrineLifecycleDefinition> = {},
): ProductDoctrineEngineeringObjectDefinition {
  return {
    engineeringObjectType,
    label,
    stationLevelProjection,
    requiredServiceIds,
    requiredAssetIds,
    ...objectLifecycle(overrides),
  };
}

function executionSequence(
  appliesTo: ProductDoctrineAppliesTo,
  appliesToId: string,
  lifecycle: ProductDoctrineLifecycleDefinition,
): ProductDoctrineExecutionSequence {
  return {
    sequenceId: `${POINT_TO_POINT_LONG_HAUL_DOCTRINE_ID}:EXECUTION:${appliesTo}:${appliesToId}`,
    appliesTo,
    appliesToId,
    lifecycleStates: lifecycle.lifecycleStates,
    prerequisiteDependencies: lifecycle.prerequisiteDependencies,
    releaseGates: lifecycle.releaseGates,
    blockedReasons: lifecycle.blockedReasons,
    requiredEvidence: lifecycle.requiredEvidence,
    acceptanceCriteria: lifecycle.acceptanceCriteria,
    responsibleRole: lifecycle.responsibleRole,
    billableTrigger: lifecycle.billableTrigger,
    paymentTrigger: lifecycle.paymentTrigger,
    capitalCashFlowTrigger: lifecycle.capitalCashFlowTrigger,
    twinStateTransition: lifecycle.twinStateTransition,
  };
}

function closeSequence(
  appliesTo: ProductDoctrineAppliesTo,
  appliesToId: string,
  lifecycle: ProductDoctrineLifecycleDefinition,
): ProductDoctrineCloseSequence {
  return {
    ...executionSequence(appliesTo, appliesToId, lifecycle),
    closeSequenceId: `${POINT_TO_POINT_LONG_HAUL_DOCTRINE_ID}:CLOSE:${appliesTo}:${appliesToId}`,
    closeStates: lifecycle.lifecycleStates.slice(Math.max(0, lifecycle.lifecycleStates.length - 5)),
    closeEligibility: lifecycle.acceptanceCriteria,
    paymentEligibility: [lifecycle.billableTrigger, lifecycle.paymentTrigger],
  };
}

export const POINT_TO_POINT_LONG_HAUL_DOCTRINE_REGISTRY_ENTRY: ProductDoctrineRegistryEntry = {
  alias: "PD-001",
  canonicalDoctrineId: POINT_TO_POINT_LONG_HAUL_DOCTRINE_ID,
  productId: POINT_TO_POINT_LONG_HAUL_PRODUCT_ID,
  businessProductName: POINT_TO_POINT_LONG_HAUL_BUSINESS_PRODUCT_NAME,
  technicalDoctrineName: POINT_TO_POINT_LONG_HAUL_TECHNICAL_DOCTRINE_NAME,
  doctrineVersion: POINT_TO_POINT_LONG_HAUL_DOCTRINE_VERSION,
  active: true,
};

export const POINT_TO_POINT_LONG_HAUL_REQUIRED_SERVICES: ProductDoctrineRequiredService[] = [
  service("SERVICE:ENGINEERING", "engineering", "PROFESSIONAL_ENGINEERING", {
    responsibleRole: "ENGINEERING",
    lifecycleStates: ["DEFINED", "ASSIGNED", "REVIEWING", "STATIONED", "OBJECTS_DEFINED", "DEPENDENCIES_VALIDATED", "CERTIFICATION_READY", "CLOSED"],
    prerequisiteDependencies: ["customer accepted proposal", "commercial release package", "draft IOF package"],
    releaseGates: ["draft IOF package complete", "engineering baseline created"],
    requiredEvidence: ["engineering review notes", "quantity confirmation", "exception rationale when required"],
    acceptanceCriteria: ["product doctrine compliance confirmed", "customer technical requirements translated", "dependencies and exceptions documented"],
    billableTrigger: "Engineering review accepted for certification.",
    paymentTrigger: "Engineering review close sequence accepted.",
    twinStateTransition: "ENGINEERING_ACCEPTANCE_PROJECTS_TO_TWIN_DESIGN_STATE",
  }),
  service("SERVICE:SURVEY", "survey", "FIELD_SURVEY", {
    responsibleRole: "SURVEY",
    requiredEvidence: ["survey control", "GPS station evidence", "field notes"],
    acceptanceCriteria: ["A/Z and station evidence captured", "survey exceptions documented", "engineering acceptance recorded"],
  }),
  service("SERVICE:PERMITTING", "permitting", "PERMITTING", {
    responsibleRole: "PERMITTING",
    lifecycleStates: ["DEFINED", "JURISDICTIONS_IDENTIFIED", "SUBMITTED", "APPROVED", "RELEASED", "CLOSED"],
    releaseGates: ["jurisdiction identified", "permit approval received"],
    blockedReasons: ["permit not approved", "jurisdiction unknown", "permit condition unresolved"],
    requiredEvidence: ["permit approval", "permit conditions", "release authorization"],
    acceptanceCriteria: ["permit approved for station range", "permit conditions attached to release gates"],
  }),
  service("SERVICE:UTILITY-LOCATE", "utility locate", "UTILITY_LOCATE", {
    responsibleRole: "CONSTRUCTION",
    lifecycleStates: ["DEFINED", "TICKET_CREATED", "LOCATE_SCHEDULED", "LOCATE_COMPLETE", "VALID_WINDOW_ACTIVE", "CLOSED"],
    releaseGates: ["valid locate ticket", "locate complete"],
    blockedReasons: ["locate incomplete", "ticket expired", "utility conflict unresolved"],
    requiredEvidence: ["locate ticket", "locate completion evidence", "conflict notes"],
    acceptanceCriteria: ["valid locate window active", "conflicts documented"],
  }),
  service("SERVICE:TRAFFIC-CONTROL", "traffic control", "TRAFFIC_CONTROL", {
    responsibleRole: "CONTROL",
    lifecycleStates: ["DEFINED", "PLAN_APPROVED", "CREW_SCHEDULED", "RELEASED", "DEMOBILIZED", "CLOSED"],
    releaseGates: ["traffic control plan approved", "permit conditions satisfied"],
    blockedReasons: ["traffic control not released", "lane closure unavailable"],
    requiredEvidence: ["traffic control plan", "release record", "demobilization record"],
    acceptanceCriteria: ["traffic control released for station range", "demobilization complete"],
  }),
  service("SERVICE:DIRECTIONAL-BORE", "directional bore", "CIVIL_CONSTRUCTION", {
    lifecycleStates: [
      "DEFINED",
      "SCHEDULED",
      "MATERIALS_READY",
      "PERMITS_RELEASED",
      "LOCATE_COMPLETE",
      "TRAFFIC_CONTROL_RELEASED",
      "MOBILIZED",
      "BORE_COMPLETED",
      "CONDUIT_VERIFIED",
      "EVIDENCE_CAPTURED",
      "ENGINEERING_ACCEPTED",
      "BILLABLE",
      "CLOSED",
    ],
    prerequisiteDependencies: ["permit approval", "conduit material received", "traffic control released", "utility locate complete", "engineering exceptions resolved"],
    releaseGates: ["permit released", "locate complete", "traffic control released", "materials ready"],
    blockedReasons: ["permit is not approved", "conduit material is not received", "traffic control is not released", "locate is not complete", "engineering exception is unresolved"],
    requiredEvidence: ["bore log", "conduit proof", "photo evidence", "station GPS evidence", "engineering acceptance"],
    acceptanceCriteria: ["bore completed within approved station range", "conduit verified", "evidence captured and accepted"],
  }),
  service("SERVICE:PLOWING", "plowing", "CIVIL_CONSTRUCTION", {
    prerequisiteDependencies: ["utility locate complete", "ROW release", "conduit material received"],
    releaseGates: ["ROW released", "locate complete", "materials ready"],
    blockedReasons: ["ROW not released", "locate incomplete", "material unavailable"],
    requiredEvidence: ["plow log", "GPS evidence", "photo evidence", "engineering acceptance"],
  }),
  service("SERVICE:OPEN-TRENCH", "open trench", "CIVIL_CONSTRUCTION", {
    prerequisiteDependencies: ["utility locate complete", "permit release", "restoration plan"],
    releaseGates: ["permit released", "locate complete", "restoration plan approved"],
    blockedReasons: ["permit blocked", "locate incomplete", "restoration plan missing"],
    requiredEvidence: ["trench log", "conduit placement evidence", "restoration evidence"],
  }),
  service("SERVICE:CONDUIT-PLACEMENT", "conduit placement", "ASSET_PLACEMENT", {
    prerequisiteDependencies: ["civil path released", "conduit material received"],
    releaseGates: ["civil method released", "conduit allocated"],
    blockedReasons: ["conduit material not received", "civil path not released"],
    requiredEvidence: ["conduit proof", "installation photo", "GPS evidence"],
  }),
  service("SERVICE:HANDHOLE-VAULT-PLACEMENT", "handhole/vault placement", "STRUCTURE_PLACEMENT", {
    prerequisiteDependencies: ["structure material received", "station released", "excavation released"],
    releaseGates: ["structure allocated", "station released"],
    blockedReasons: ["structure is not installed", "GPS evidence is missing", "photo evidence is missing", "inspection is incomplete", "engineering acceptance is missing"],
    requiredEvidence: ["structure photo", "GPS evidence", "inspection record", "engineering acceptance"],
    acceptanceCriteria: ["structure installed at assigned station", "GPS/photo evidence accepted", "inspection complete", "engineering acceptance recorded"],
  }),
  service("SERVICE:FIBER-PLACEMENT", "fiber placement", "FIBER_PLACEMENT", {
    prerequisiteDependencies: ["conduit path accepted", "handholes/vaults accepted", "fiber material received", "splice plan approved"],
    releaseGates: ["conduit path accepted", "structure path accepted", "fiber allocated"],
    blockedReasons: ["conduit path is not accepted", "handholes/vaults are not accepted", "fiber material is not received", "splice plan is not approved"],
    requiredEvidence: ["pull log", "fiber reel evidence", "slack loop evidence", "engineering acceptance"],
  }),
  service("SERVICE:SPLICING", "splicing", "FIBER_SPLICING", {
    prerequisiteDependencies: ["fiber installed", "splice case installed", "splice plan approved"],
    releaseGates: ["fiber path released", "splice plan approved"],
    blockedReasons: ["fiber is not installed", "splice evidence is missing", "OTDR/testing is incomplete", "labeling is incomplete"],
    requiredEvidence: ["splice record", "splice photo", "labeling evidence", "engineering acceptance"],
  }),
  service("SERVICE:OTDR-TESTING", "OTDR testing", "FIBER_TESTING", {
    prerequisiteDependencies: ["fiber installed", "splicing complete"],
    releaseGates: ["splice complete", "test plan approved"],
    blockedReasons: ["splice incomplete", "test result missing", "loss threshold failed"],
    requiredEvidence: ["OTDR trace", "loss report", "test acceptance"],
    acceptanceCriteria: ["OTDR trace passed", "loss report within threshold", "engineering acceptance recorded"],
  }),
  service("SERVICE:RESTORATION", "restoration", "RESTORATION", {
    prerequisiteDependencies: ["civil work complete", "surface restoration required"],
    releaseGates: ["construction complete", "restoration method approved"],
    blockedReasons: ["restoration incomplete", "surface condition rejected"],
    requiredEvidence: ["restoration photo", "inspection signoff", "customer/municipal acceptance when required"],
  }),
  service("SERVICE:AS-BUILT-DOCUMENTATION", "as-built documentation", "DOCUMENTATION", {
    responsibleRole: "ENGINEERING",
    lifecycleStates: ["DEFINED", "FIELD_DATA_RECEIVED", "AS_BUILT_DRAFTED", "ENGINEERING_REVIEWED", "ACCEPTED", "CLOSED"],
    prerequisiteDependencies: ["station/object evidence captured", "field redlines received"],
    releaseGates: ["field evidence accepted", "redlines reviewed"],
    blockedReasons: ["field evidence missing", "redline unresolved"],
    requiredEvidence: ["as-built drawing", "station evidence", "object inventory reference"],
    acceptanceCriteria: ["as-built complete", "engineering acceptance recorded"],
  }),
  service("SERVICE:INSPECTION", "inspection", "INSPECTION", {
    responsibleRole: "INSPECTION",
    lifecycleStates: ["DEFINED", "SCHEDULED", "INSPECTED", "PUNCHLIST_CREATED", "PUNCHLIST_RESOLVED", "ACCEPTED", "CLOSED"],
    prerequisiteDependencies: ["service or asset ready for inspection"],
    releaseGates: ["inspection scheduled", "evidence available"],
    blockedReasons: ["inspection incomplete", "punchlist unresolved"],
    requiredEvidence: ["inspection checklist", "photo evidence", "punchlist resolution"],
    acceptanceCriteria: ["inspection accepted", "punchlist resolved"],
  }),
];

export const POINT_TO_POINT_LONG_HAUL_REQUIRED_ASSETS: ProductDoctrineRequiredAsset[] = [
  asset("ASSET:CONDUIT", "conduit", "CONDUIT", {
    lifecycleStates: ["DEFINED", "PROCURED", "RECEIVED", "ALLOCATED", "INSTALLED", "GPS_VERIFIED", "EVIDENCE_CAPTURED", "ENGINEERING_ACCEPTED", "CERTIFIED", "OPERATIONAL"],
    prerequisiteDependencies: ["conduit placement service", "civil path released"],
    requiredEvidence: ["material receipt", "conduit proof", "GPS evidence", "photo evidence"],
  }),
  asset("ASSET:FIBER", "fiber", "FIBER", {
    lifecycleStates: ["DEFINED", "RECEIVED", "PULLED", "SLACK_INSTALLED", "SPLICED", "OTDR_PASSED", "EVIDENCE_CAPTURED", "ENGINEERING_ACCEPTED", "CERTIFIED", "OPERATIONAL"],
    prerequisiteDependencies: ["conduit path accepted", "handholes/vaults accepted", "fiber placement service", "splicing service", "OTDR testing"],
    releaseGates: ["conduit path accepted", "fiber material received", "splice plan approved"],
    blockedReasons: ["conduit path not accepted", "fiber material missing", "OTDR failed"],
    requiredEvidence: ["fiber reel evidence", "pull log", "slack loop evidence", "splice record", "OTDR trace"],
    acceptanceCriteria: ["fiber installed", "slack installed", "splice accepted", "OTDR passed"],
  }),
  asset("ASSET:HANDHOLES", "handholes", "HANDHOLE", {
    prerequisiteDependencies: ["handhole/vault placement service", "station released"],
    blockedReasons: ["structure is not installed", "GPS evidence is missing", "photo evidence is missing", "inspection is incomplete", "engineering acceptance is missing"],
  }),
  asset("ASSET:VAULTS", "vaults", "VAULT", {
    prerequisiteDependencies: ["handhole/vault placement service", "station released"],
    blockedReasons: ["vault not installed", "GPS evidence missing", "inspection incomplete"],
  }),
  asset("ASSET:SPLICE-CASES", "splice cases", "SPLICE_CASE", {
    prerequisiteDependencies: ["fiber installed", "splice plan approved"],
    requiredEvidence: ["splice case photo", "splice record", "labeling evidence"],
  }),
  asset("ASSET:MARKER-POSTS", "marker posts", "MARKER_POST", {
    prerequisiteDependencies: ["route segment released", "marker placement plan"],
    requiredEvidence: ["marker photo", "GPS evidence"],
  }),
  asset("ASSET:WARNING-TAPE", "warning tape", "WARNING_TAPE", {
    prerequisiteDependencies: ["open trench or plow service", "material received"],
    requiredEvidence: ["installation photo", "station range evidence"],
  }),
  asset("ASSET:LOCATE-WIRE", "locate wire", "LOCATE_WIRE", {
    prerequisiteDependencies: ["conduit placement", "material received"],
    requiredEvidence: ["continuity evidence", "installation photo"],
  }),
  asset("ASSET:SLACK-LOOPS", "slack loops", "SLACK_LOOP", {
    prerequisiteDependencies: ["fiber placement", "structure placement"],
    requiredEvidence: ["slack loop photo", "fiber inventory evidence"],
  }),
  asset("ASSET:ILA-REGEN-FACILITIES", "ILA/regeneration facilities where required", "ILA_REGENERATION_FACILITY", {
    requiredWhen: "Route span length or optical budget requires amplification/regeneration.",
    prerequisiteDependencies: ["engineering optical review", "site/power availability", "structure allocation"],
    releaseGates: ["engineering optical requirement confirmed", "site and power released"],
    requiredEvidence: ["facility layout", "power availability evidence", "engineering acceptance"],
  }),
  asset("ASSET:LIU-TERMINATION-HARDWARE", "LIU/termination hardware where required", "LIU_TERMINATION_HARDWARE", {
    requiredWhen: "Customer handoff, POP termination, or termination point requires LIU hardware.",
    prerequisiteDependencies: ["termination point defined", "fiber assignment approved"],
    releaseGates: ["termination point released", "hardware allocated"],
    requiredEvidence: ["termination photo", "labeling evidence", "handoff acceptance"],
  }),
];

export const POINT_TO_POINT_LONG_HAUL_ENGINEERING_OBJECTS: ProductDoctrineEngineeringObjectDefinition[] = [
  engineeringObject("SPINE", "spine", ["SERVICE:ENGINEERING", "SERVICE:SURVEY"], ["ASSET:CONDUIT", "ASSET:FIBER"], true),
  engineeringObject("ROUTE_SEGMENT", "route segment", ["SERVICE:ENGINEERING", "SERVICE:SURVEY", "SERVICE:PERMITTING"], ["ASSET:CONDUIT", "ASSET:FIBER"], true),
  engineeringObject("STATION", "station", ["SERVICE:SURVEY", "SERVICE:INSPECTION"], [], true),
  engineeringObject("CONDUIT_SEGMENT", "conduit segment", ["SERVICE:CONDUIT-PLACEMENT"], ["ASSET:CONDUIT", "ASSET:WARNING-TAPE", "ASSET:LOCATE-WIRE"], true),
  engineeringObject("FIBER_SEGMENT", "fiber segment", ["SERVICE:FIBER-PLACEMENT", "SERVICE:OTDR-TESTING"], ["ASSET:FIBER", "ASSET:SLACK-LOOPS"], true),
  engineeringObject("STRUCTURE", "structure", ["SERVICE:HANDHOLE-VAULT-PLACEMENT", "SERVICE:INSPECTION"], ["ASSET:HANDHOLES", "ASSET:VAULTS"], true),
  engineeringObject("CROSSING", "crossing", ["SERVICE:PERMITTING", "SERVICE:DIRECTIONAL-BORE", "SERVICE:INSPECTION"], ["ASSET:CONDUIT"], true),
  engineeringObject("SPLICE_CASE", "splice case", ["SERVICE:SPLICING", "SERVICE:OTDR-TESTING"], ["ASSET:SPLICE-CASES", "ASSET:FIBER"], true),
  engineeringObject("ILA_REGENERATION_SITE", "ILA/regeneration site", ["SERVICE:ENGINEERING", "SERVICE:INSPECTION"], ["ASSET:ILA-REGEN-FACILITIES"], true),
  engineeringObject("TERMINATION_POINT", "termination point", ["SERVICE:ENGINEERING", "SERVICE:SPLICING", "SERVICE:OTDR-TESTING"], ["ASSET:LIU-TERMINATION-HARDWARE"], true),
  engineeringObject("EVIDENCE_OBJECT", "evidence object", ["SERVICE:AS-BUILT-DOCUMENTATION", "SERVICE:INSPECTION"], [], false),
];

export const POINT_TO_POINT_LONG_HAUL_EXECUTION_SEQUENCES: ProductDoctrineExecutionSequence[] = [
  ...POINT_TO_POINT_LONG_HAUL_REQUIRED_SERVICES.map((item) => executionSequence("SERVICE", item.serviceId, item)),
  ...POINT_TO_POINT_LONG_HAUL_REQUIRED_ASSETS.map((item) => executionSequence("ASSET", item.assetId, item)),
  ...POINT_TO_POINT_LONG_HAUL_ENGINEERING_OBJECTS.map((item) => executionSequence("ENGINEERING_OBJECT", item.engineeringObjectType, item)),
];

export const POINT_TO_POINT_LONG_HAUL_CLOSE_SEQUENCES: ProductDoctrineCloseSequence[] = [
  ...POINT_TO_POINT_LONG_HAUL_REQUIRED_SERVICES.map((item) => closeSequence("SERVICE", item.serviceId, item)),
  ...POINT_TO_POINT_LONG_HAUL_REQUIRED_ASSETS.map((item) => closeSequence("ASSET", item.assetId, item)),
  ...POINT_TO_POINT_LONG_HAUL_ENGINEERING_OBJECTS.map((item) => closeSequence("ENGINEERING_OBJECT", item.engineeringObjectType, item)),
];

export const POINT_TO_POINT_LONG_HAUL_EVIDENCE_REQUIREMENTS: ProductDoctrineEvidenceRequirement[] = [
  {
    evidenceRequirementId: "EVIDENCE:ENGINEERING-APPROVAL",
    evidenceType: "ENGINEERING_REVIEW",
    label: "Engineering approval and exception rationale",
    requiredFor: ["SERVICE:ENGINEERING", "ENGINEERING_OBJECT:SPINE", "ENGINEERING_OBJECT:ROUTE_SEGMENT"],
    requiredAtState: "ENGINEERING_ACCEPTED",
    acceptanceCriteria: ["reviewer identified", "exception rationale attached when required", "approval timestamp recorded"],
    responsibleRole: "ENGINEERING",
    blocksRelease: true,
    blocksClose: true,
  },
  {
    evidenceRequirementId: "EVIDENCE:SURVEY-GPS",
    evidenceType: "GPS_SURVEY",
    label: "Survey/GPS station evidence",
    requiredFor: ["SERVICE:SURVEY", "ENGINEERING_OBJECT:STATION", "ASSET:HANDHOLES", "ASSET:VAULTS"],
    requiredAtState: "GPS_VERIFIED",
    acceptanceCriteria: ["station coordinate captured", "station range identified", "survey source recorded"],
    responsibleRole: "SURVEY",
    blocksRelease: false,
    blocksClose: true,
  },
  {
    evidenceRequirementId: "EVIDENCE:PERMIT-APPROVAL",
    evidenceType: "PERMIT",
    label: "Permit approval and conditions",
    requiredFor: ["SERVICE:PERMITTING", "SERVICE:DIRECTIONAL-BORE", "SERVICE:OPEN-TRENCH", "ENGINEERING_OBJECT:CROSSING"],
    requiredAtState: "PERMITS_RELEASED",
    acceptanceCriteria: ["permit approved", "station range covered", "conditions attached to release gates"],
    responsibleRole: "PERMITTING",
    blocksRelease: true,
    blocksClose: true,
  },
  {
    evidenceRequirementId: "EVIDENCE:UTILITY-LOCATE",
    evidenceType: "UTILITY_LOCATE",
    label: "Utility locate ticket and completion evidence",
    requiredFor: ["SERVICE:UTILITY-LOCATE", "SERVICE:DIRECTIONAL-BORE", "SERVICE:PLOWING", "SERVICE:OPEN-TRENCH"],
    requiredAtState: "LOCATE_COMPLETE",
    acceptanceCriteria: ["ticket valid", "locate complete", "conflicts documented"],
    responsibleRole: "CONSTRUCTION",
    blocksRelease: true,
    blocksClose: true,
  },
  {
    evidenceRequirementId: "EVIDENCE:TRAFFIC-CONTROL",
    evidenceType: "TRAFFIC_CONTROL",
    label: "Traffic control release",
    requiredFor: ["SERVICE:TRAFFIC-CONTROL", "SERVICE:DIRECTIONAL-BORE"],
    requiredAtState: "TRAFFIC_CONTROL_RELEASED",
    acceptanceCriteria: ["plan approved", "release window valid"],
    responsibleRole: "CONTROL",
    blocksRelease: true,
    blocksClose: false,
  },
  {
    evidenceRequirementId: "EVIDENCE:MATERIAL-RECEIPT",
    evidenceType: "MATERIAL_RECEIPT",
    label: "Material receipt and allocation",
    requiredFor: ["ASSET:CONDUIT", "ASSET:FIBER", "ASSET:SPLICE-CASES", "ASSET:LIU-TERMINATION-HARDWARE"],
    requiredAtState: "RECEIVED",
    acceptanceCriteria: ["material received", "material allocated to station/range", "quantity recorded"],
    responsibleRole: "MARKETPLACE",
    blocksRelease: true,
    blocksClose: true,
  },
  {
    evidenceRequirementId: "EVIDENCE:BORE-LOG",
    evidenceType: "BORE_LOG",
    label: "Directional bore log and conduit verification",
    requiredFor: ["SERVICE:DIRECTIONAL-BORE", "ASSET:CONDUIT"],
    requiredAtState: "CONDUIT_VERIFIED",
    acceptanceCriteria: ["bore completed", "conduit verified", "station range documented"],
    responsibleRole: "CONSTRUCTION",
    blocksRelease: false,
    blocksClose: true,
  },
  {
    evidenceRequirementId: "EVIDENCE:PHOTO-GPS",
    evidenceType: "PHOTO_GPS",
    label: "Photo and GPS close evidence",
    requiredFor: ["ASSET:HANDHOLES", "ASSET:VAULTS", "ASSET:MARKER-POSTS", "SERVICE:RESTORATION"],
    requiredAtState: "EVIDENCE_CAPTURED",
    acceptanceCriteria: ["photo attached", "GPS coordinate attached", "station/object reference attached"],
    responsibleRole: "FIELD",
    blocksRelease: false,
    blocksClose: true,
  },
  {
    evidenceRequirementId: "EVIDENCE:SPLICE-RECORD",
    evidenceType: "SPLICE_RECORD",
    label: "Splice record and labeling evidence",
    requiredFor: ["SERVICE:SPLICING", "ENGINEERING_OBJECT:SPLICE_CASE"],
    requiredAtState: "EVIDENCE_CAPTURED",
    acceptanceCriteria: ["splice record complete", "labeling complete", "splice case reference attached"],
    responsibleRole: "CONSTRUCTION",
    blocksRelease: false,
    blocksClose: true,
  },
  {
    evidenceRequirementId: "EVIDENCE:OTDR-TRACE",
    evidenceType: "OTDR_TRACE",
    label: "OTDR trace and loss report",
    requiredFor: ["SERVICE:OTDR-TESTING", "ASSET:FIBER", "ENGINEERING_OBJECT:FIBER_SEGMENT"],
    requiredAtState: "OTDR_PASSED",
    acceptanceCriteria: ["trace attached", "loss report within threshold", "engineering acceptance recorded"],
    responsibleRole: "CONSTRUCTION",
    blocksRelease: false,
    blocksClose: true,
  },
  {
    evidenceRequirementId: "EVIDENCE:INSPECTION-SIGNOFF",
    evidenceType: "INSPECTION",
    label: "Inspection signoff",
    requiredFor: ["SERVICE:INSPECTION", "SERVICE:RESTORATION", "ASSET:HANDHOLES", "ASSET:VAULTS"],
    requiredAtState: "ENGINEERING_ACCEPTED",
    acceptanceCriteria: ["inspection complete", "punchlist resolved", "signoff recorded"],
    responsibleRole: "INSPECTION",
    blocksRelease: false,
    blocksClose: true,
  },
  {
    evidenceRequirementId: "EVIDENCE:AS-BUILT",
    evidenceType: "AS_BUILT",
    label: "As-built documentation",
    requiredFor: ["SERVICE:AS-BUILT-DOCUMENTATION", "ENGINEERING_OBJECT:EVIDENCE_OBJECT"],
    requiredAtState: "ACCEPTED",
    acceptanceCriteria: ["as-built drawing attached", "station/object refs attached", "engineering acceptance recorded"],
    responsibleRole: "ENGINEERING",
    blocksRelease: false,
    blocksClose: true,
  },
];

export const POINT_TO_POINT_LONG_HAUL_CERTIFICATION_RULES: ProductDoctrineCertificationRules = {
  certificationAuthority: "ENGINEERING",
  engineeringCertifies: [
    "product doctrine compliance",
    "customer technical requirements",
    "material, technical, and placement changes",
    "quantities",
    "stationing",
    "object definitions",
    "dependencies",
    "evidence requirements",
    "close sequences",
    "exceptions and rationale",
  ],
  engineeringDoesNotCertify: [
    "pricing",
    "margin",
    "commercial terms",
    "finance/admin reporting",
  ],
  mustContain: [
    "required services",
    "required assets",
    "required engineering objects",
    "station-level lifecycle projection",
    "close sequences",
    "evidence requirements",
    "acceptance criteria",
    "dependency graph",
    "billing/payment triggers",
    "ScopeVersion readiness requirements",
  ],
  failureConditions: [
    "missing required service definition",
    "missing required asset definition",
    "missing engineering object definition",
    "missing station-level lifecycle projection",
    "missing close sequence",
    "missing evidence requirement",
    "missing acceptance criteria",
    "missing dependency graph",
    "missing billing/payment trigger",
    "missing ScopeVersion readiness requirement",
  ],
  noScopeVersionCreationBeforeSignedServiceOrder: true,
};

export const POINT_TO_POINT_LONG_HAUL_STATION_LIFECYCLE_PROJECTION: ProductDoctrineStationLifecycleProjection = {
  projectionId: `${POINT_TO_POINT_LONG_HAUL_DOCTRINE_ID}:STATION-LIFECYCLE-PROJECTION`,
  derivesFor: ["station", "station-attached object", "service", "asset", "engineering object"],
  projectedFields: [
    "required service",
    "required asset",
    "prerequisite dependencies",
    "release status",
    "blocked reason",
    "evidence required",
    "close eligibility",
    "payment eligibility",
    "Twin state transition",
  ],
  releaseBlockedWhen: [
    "permit is not approved",
    "conduit material is not received",
    "traffic control is not released",
    "locate is not complete",
    "engineering exception is unresolved",
    "conduit path is not accepted",
    "handholes/vaults are not accepted",
    "fiber material is not received",
    "splice plan is not approved",
  ],
  closeBlockedWhen: [
    "structure is not installed",
    "GPS evidence is missing",
    "photo evidence is missing",
    "inspection is incomplete",
    "engineering acceptance is missing",
    "splice evidence is missing",
    "OTDR/testing is incomplete",
    "labeling is incomplete",
  ],
  paymentEligibleWhen: [
    "close sequence accepted",
    "billable trigger fired",
    "payment trigger released",
  ],
  twinStateTransitions: [
    "SERVICE_CLOSED_PROJECTS_TO_TWIN_ACTIVITY",
    "ASSET_OPERATIONAL_PROJECTS_TO_TWIN_STATE",
    "CERTIFIED_OBJECT_PROJECTS_TO_TWIN",
  ],
};

export const POINT_TO_POINT_LONG_HAUL_SCOPEVERSION_READINESS_REQUIREMENTS: ProductDoctrineScopeVersionReadinessRequirement[] = [
  { requirementId: "SCOPEVERSION-READINESS:CERTIFIED-IOF", label: "Certified IOF Package exists.", sourceArtifact: "Certified IOF Package", required: true },
  { requirementId: "SCOPEVERSION-READINESS:SERVICE-ORDER", label: "Service Order executed.", sourceArtifact: "Service Order", required: true },
  { requirementId: "SCOPEVERSION-READINESS:CUSTOMER-SIGNATURE", label: "Customer signature received.", sourceArtifact: "Customer Acceptance / Service Order", required: true },
  { requirementId: "SCOPEVERSION-READINESS:REQUIRED-SERVICES", label: "Required services are present as ScopeVersion-ready references.", sourceArtifact: "Product Doctrine", required: true },
  { requirementId: "SCOPEVERSION-READINESS:REQUIRED-ASSETS", label: "Required assets are present as ScopeVersion-ready references.", sourceArtifact: "Product Doctrine", required: true },
  { requirementId: "SCOPEVERSION-READINESS:ENGINEERING-OBJECTS", label: "Engineering objects are certified.", sourceArtifact: "Engineering Certification", required: true },
  { requirementId: "SCOPEVERSION-READINESS:STATION-LIFECYCLE", label: "Station-level lifecycle projection exists.", sourceArtifact: "Product Doctrine Assembly", required: true },
  { requirementId: "SCOPEVERSION-READINESS:CLOSE-SEQUENCES", label: "Close sequence references exist.", sourceArtifact: "Product Doctrine", required: true },
  { requirementId: "SCOPEVERSION-READINESS:EVIDENCE", label: "Evidence requirements and evidence references exist.", sourceArtifact: "Certification Evidence Manifest", required: true },
  { requirementId: "SCOPEVERSION-READINESS:DEPENDENCY-GRAPH", label: "Dependency graph exists.", sourceArtifact: "Draft IOF Package / Engineering Revision", required: true },
];

export const POINT_TO_POINT_LONG_HAUL_DOCTRINE: ProductDoctrine = {
  doctrineId: POINT_TO_POINT_LONG_HAUL_DOCTRINE_ID,
  productId: POINT_TO_POINT_LONG_HAUL_PRODUCT_ID,
  productName: "Point-to-Point Long Haul Conduit & Fiber",
  productVersion: "1.0.0",
  doctrineVersion: POINT_TO_POINT_LONG_HAUL_DOCTRINE_VERSION,
  rules: {
    networkClass: "LONG_HAUL",
    topology: "LINEAR",
    layer: 1,
    opticalTransport: false,
    comparisonAllowed: false,
    reuseRecommendationAllowed: false,
    scopeVersionCreationAllowedFromCommercial: false,
    engineeringCertificationRequired: true,
  },
  requiredInputs: [
    "account/customer",
    "productId",
    "doctrineId",
    "A site",
    "Z site",
    "authoritative route centerline",
    "route authority and measurement provenance",
    "project configuration",
  ],
  assembledArtifacts: [
    "spine",
    "stations",
    "route segments",
    "conduit objects",
    "fiber objects",
    "structures",
    "crossings",
    "required services",
    "required assets",
    "engineering object definitions",
    "execution sequences",
    "close sequences",
    "evidence requirements",
    "station-level lifecycle projection",
    "quantity summary",
    "pricing inputs",
    "validation summary",
  ],
  readinessChecks: [
    "account/customer exists",
    "productId exists",
    "doctrineId exists",
    "A site exists",
    "Z site exists",
    "authoritative route centerline exists",
    "route authority and measurement provenance exist",
    "spine exists",
    "stations count > 0",
    "objects count > 0",
    "quantity summary exists",
    "pricing authority is explicit or unresolved",
    "required services exist",
    "required assets exist",
    "engineering objects exist",
    "execution sequences exist",
    "close sequences exist",
    "evidence requirements exist",
    "certification rules exist",
    "station-level lifecycle projection exists",
    "ScopeVersion readiness requirements exist",
    "validation PASS",
  ],
  registry: POINT_TO_POINT_LONG_HAUL_DOCTRINE_REGISTRY_ENTRY,
  requiredServices: POINT_TO_POINT_LONG_HAUL_REQUIRED_SERVICES,
  requiredAssets: POINT_TO_POINT_LONG_HAUL_REQUIRED_ASSETS,
  engineeringObjects: POINT_TO_POINT_LONG_HAUL_ENGINEERING_OBJECTS,
  executionSequences: POINT_TO_POINT_LONG_HAUL_EXECUTION_SEQUENCES,
  closeSequences: POINT_TO_POINT_LONG_HAUL_CLOSE_SEQUENCES,
  evidenceRequirements: POINT_TO_POINT_LONG_HAUL_EVIDENCE_REQUIREMENTS,
  certificationRules: POINT_TO_POINT_LONG_HAUL_CERTIFICATION_RULES,
  stationLevelLifecycleProjection: POINT_TO_POINT_LONG_HAUL_STATION_LIFECYCLE_PROJECTION,
  scopeVersionReadinessRequirements: POINT_TO_POINT_LONG_HAUL_SCOPEVERSION_READINESS_REQUIREMENTS,
  requirementPolicies: [
    { requirementId: "HANDHOLE_PLAN_DEFINED", requirement: "CONDITIONAL", quantityAuthority: "ENGINEERING_DESIGN", resolutionRequired: true },
    { requirementId: "VAULT_PLAN_DEFINED", requirement: "CONDITIONAL", quantityAuthority: "ENGINEERING_DESIGN", resolutionRequired: true },
    { requirementId: "SPLICE_ARCHITECTURE_DEFINED", requirement: "CONDITIONAL", quantityAuthority: "ENGINEERING_DESIGN", resolutionRequired: true },
    { requirementId: "ILA_CONFIGURATION_DEFINED", requirement: "CONDITIONAL", quantityAuthority: "PROJECT_CONFIGURATION", resolutionRequired: true },
    { requirementId: "REGENERATION_REQUIREMENT_DEFINED", requirement: "CONDITIONAL", quantityAuthority: "OPTICAL_ENGINEERING_DEFINED", resolutionRequired: true },
    { requirementId: "FIBER_PLACEMENT_ALLOWANCE_DEFINED", requirement: "REQUIRED", quantityAuthority: "PROJECT_CONFIGURATION", resolutionRequired: true },
    { requirementId: "APPLICABLE_CONSTRAINTS_EVALUATED", requirement: "REQUIRED", quantityAuthority: "ENGINEERING_DESIGN", resolutionRequired: true },
  ],
  previousDoctrineVersion: POINT_TO_POINT_LONG_HAUL_PREVIOUS_DOCTRINE_VERSION,
  changeReason: POINT_TO_POINT_LONG_HAUL_DOCTRINE_CHANGE_REASON,
};

export interface PointToPointLongHaulDoctrineInput {
  accountId: string;
  customerId: string;
  aSite: ProductDoctrineSite | null;
  zSite: ProductDoctrineSite | null;
  osrmRoute: ProductDoctrineOsrmRoute | null;
  authoritativeRoute?: ProductDoctrineOsrmRoute | null;
  projectConfiguration?: Partial<DuctDarkFiberProjectConfiguration>;
  routeSegments?: CommercialCorridorSegment[];
  pricingSummary?: Partial<ProductDoctrinePricingSummary> & Record<string, unknown>;
  stationIntervalFeet?: number;
  conduitCount?: number;
  conduitSizeInches?: number;
  fiberCount?: number;
}

function stableIdPart(value: unknown, fallback = "UNKNOWN") {
  const raw = String(value ?? fallback).trim() || fallback;
  return raw.replace(/[^A-Za-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 120) || fallback;
}

function round(value: number, places = 3) {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

function coordinateAt(centerline: DALCoordinate[], ratio: number): DALCoordinate {
  if (!centerline.length) return [0, 0];
  if (centerline.length === 1) return centerline[0];
  const index = Math.min(centerline.length - 1, Math.max(0, Math.round(ratio * (centerline.length - 1))));
  return centerline[index];
}

function makeSite(role: "A" | "Z", accountId: string, coordinate: DALCoordinate | undefined, fallbackLabel: string): ProductDoctrineSite | null {
  if (!coordinate) return null;
  return {
    siteId: `${POINT_TO_POINT_LONG_HAUL_PRODUCT_ID}:SITE:${role}:${stableIdPart(accountId)}`,
    role,
    label: fallbackLabel,
    coordinate,
    source: "AUTHORITATIVE_ROUTE_ENDPOINT",
  };
}

function buildStations(spineId: string, centerline: DALCoordinate[], routeFeet: number, stationIntervalFeet: number): ProductDoctrineStation[] {
  if (!centerline.length || routeFeet <= 0) return [];
  const stationCount = Math.max(2, Math.floor(routeFeet / stationIntervalFeet) + 1);
  return Array.from({ length: stationCount }, (_, index) => {
    const ratio = stationCount === 1 ? 0 : index / (stationCount - 1);
    const stationFeet = index === stationCount - 1 ? routeFeet : Math.min(routeFeet, index * stationIntervalFeet);
    return {
      stationId: `${spineId}:STATION:${String(index).padStart(4, "0")}`,
      spineId,
      stationIndex: index,
      stationFeet: Math.round(stationFeet),
      milepost: round(stationFeet / 5280),
      coordinate: coordinateAt(centerline, ratio),
      stationRole: "DISPLAY_INDEX",
      constitutionalResolution: false,
    };
  });
}

function buildSegments(spineId: string, stations: ProductDoctrineStation[], sourceSegments: CommercialCorridorSegment[] | undefined, routeFeet: number): ProductDoctrineRouteSegment[] {
  if (sourceSegments?.length && stations.length) {
    return sourceSegments.map((segment, index) => ({
      segmentId: `${spineId}:SEGMENT:${stableIdPart(segment.segmentId, String(index + 1))}`,
      spineId,
      fromStationId: stations[Math.min(index, stations.length - 1)]?.stationId ?? stations[0].stationId,
      toStationId: stations[Math.min(index + 1, stations.length - 1)]?.stationId ?? stations[stations.length - 1].stationId,
      fromMile: round(segment.fromMile),
      toMile: round(segment.toMile),
      routeMiles: round(segment.routeMiles),
      routeFeet: Math.round(segment.routeMiles * 5280),
    }));
  }
  if (stations.length < 2 || routeFeet <= 0) return [];
  return stations.slice(0, -1).map((station, index) => {
    const next = stations[index + 1];
    const feet = Math.max(0, next.stationFeet - station.stationFeet);
    return {
      segmentId: `${spineId}:SEGMENT:${String(index + 1).padStart(3, "0")}`,
      spineId,
      fromStationId: station.stationId,
      toStationId: next.stationId,
      fromMile: station.milepost,
      toMile: next.milepost,
      routeMiles: round(feet / 5280),
      routeFeet: Math.round(feet),
    };
  });
}

function object(objectId: string, objectType: ProductDoctrineObject["objectType"], label: string, parentId: string | undefined, quantity: number | undefined, unit: string | undefined, metadata: Record<string, unknown>): ProductDoctrineObject {
  return { objectId, objectType, label, parentId, quantity, unit, metadata };
}

function buildConduitAssembly(spineId: string, segments: ProductDoctrineRouteSegment[], conduitCount: number, conduitSizeInches: number): ProductDoctrineConduitAssembly {
  const objects = segments.map((segment) => object(
    `${segment.segmentId}:CONDUIT`,
    "CONDUIT",
    `Conduit ${segment.fromMile}-${segment.toMile}`,
    segment.segmentId,
    Math.round(segment.routeFeet * conduitCount),
    "conduit-foot",
    { conduitCount, conduitSizeInches, routeFeet: segment.routeFeet },
  ));
  return {
    assemblyId: `${spineId}:CONDUIT-ASSEMBLY`,
    conduitCount,
    conduitSizeInches,
    conduitFeet: objects.reduce((sum, item) => sum + Number(item.quantity ?? 0), 0),
    objects,
  };
}

function buildFiberAssembly(
  spineId: string,
  segments: ProductDoctrineRouteSegment[],
  fiberCount: number,
  slackPolicy: DuctDarkFiberProjectConfiguration["slackPolicy"] | undefined,
): ProductDoctrineFiberAssembly {
  const slackFactor = slackPolicy?.mode === "PERCENTAGE" && Number.isFinite(slackPolicy.slackPercent)
    ? 1 + Number(slackPolicy.slackPercent) / 100
    : 1;
  const objects = segments.map((segment) => object(
    `${segment.segmentId}:FIBER`,
    "FIBER",
    `Fiber ${segment.fromMile}-${segment.toMile}`,
    segment.segmentId,
    Math.round(segment.routeFeet * slackFactor),
    "fiber-foot",
    { fiberCount, slackFactor, slackPolicy: slackPolicy ?? { mode: "ENGINEERING_DEFINED", authority: "UNKNOWN", source: "UNRESOLVED", revision: "UNRESOLVED" }, routeFeet: segment.routeFeet },
  ));
  return {
    assemblyId: `${spineId}:FIBER-ASSEMBLY`,
    fiberCount,
    fiberFeet: objects.reduce((sum, item) => sum + Number(item.quantity ?? 0), 0),
    objects,
  };
}

function buildStructureAssembly(spineId: string, configuration: Partial<DuctDarkFiberProjectConfiguration> | undefined): ProductDoctrineStructureAssembly {
  const counts = [
    ["HANDHOLE", configuration?.handholeCount, configuration?.structurePlanAuthority],
    ["VAULT", configuration?.vaultCount, configuration?.structurePlanAuthority],
    ["SPLICE_CASE", configuration?.spliceCaseCount, configuration?.spliceArchitectureAuthority],
  ] as const;
  const structures = counts
    .filter(([, count]) => Number.isFinite(count) && Number(count) > 0)
    .map(([type, count, authority]) => object(
      `${spineId}:STRUCTURE:${type}`,
      "STRUCTURE",
      type,
      spineId,
      Number(count),
      "count",
      { structureType: type, quantityAuthority: authority ?? "UNKNOWN", source: "PROJECT_CONFIGURATION_OR_SOURCE_EVIDENCE" },
    ));
  return {
    assemblyId: `${spineId}:STRUCTURE-ASSEMBLY`,
    structureCount: structures.reduce((sum, item) => sum + Number(item.quantity ?? 0), 0),
    structures,
  };
}

function buildCrossingAssembly(spineId: string): ProductDoctrineCrossingAssembly {
  const crossings: ProductDoctrineObject[] = [];
  return {
    assemblyId: `${spineId}:CROSSING-ASSEMBLY`,
    crossingCount: 0,
    crossings,
  };
}

function buildPricingSummary(input: PointToPointLongHaulDoctrineInput, quantitySummary: ProductDoctrineQuantitySummary): ProductDoctrinePricingSummary {
  const provided = input.pricingSummary ?? {};
  const hasBudgetAuthority = Number.isFinite(Number(provided.budgetCost ?? provided.ospCost));
  const hasPriceAuthority = Number.isFinite(Number(provided.sellPriceIru ?? provided.nrcRevenue));
  const budgetCost = hasBudgetAuthority ? Number(provided.budgetCost ?? provided.ospCost) : 0;
  const sellPriceIru = hasPriceAuthority ? Number(provided.sellPriceIru ?? provided.nrcRevenue) : 0;
  const nrcRevenue = Number(provided.nrcRevenue ?? sellPriceIru);
  const mrcRevenue = Number(provided.mrcRevenue ?? 0);
  const grossMarginDollars = Number(provided.grossMarginDollars ?? sellPriceIru - budgetCost);
  const grossMarginPercent = Number(provided.grossMarginPercent ?? (sellPriceIru ? Math.round((grossMarginDollars / sellPriceIru) * 10000) / 100 : 0));
  return {
    budgetCost,
    sellPriceIru,
    nrcRevenue,
    mrcRevenue,
    grossMarginDollars,
    grossMarginPercent,
    pricingInputs: {
      routeFeet: quantitySummary.routeFeet,
      conduitFeet: quantitySummary.conduitFeet,
      fiberFeet: quantitySummary.fiberFeet,
      source: provided,
    },
    priceStatus: hasBudgetAuthority && hasPriceAuthority ? "AUTHORIZED" : "UNRESOLVED",
    authorityLayer: hasBudgetAuthority || hasPriceAuthority ? "COMMERCIAL_POLICY" : "UNKNOWN",
  };
}

function validationCheck(key: string, label: string, pass: boolean): ProductDoctrineValidationCheck {
  return { key, label, status: pass ? "PASS" : "FAIL" };
}

function validateAssembly(args: {
  accountId: string;
  customerId: string;
  productId: string;
  doctrineId: string;
  aSite: ProductDoctrineSite | null;
  zSite: ProductDoctrineSite | null;
  osrmRoute: ProductDoctrineOsrmRoute | null;
  centerline: DALCoordinate[];
  spine: ProductDoctrineSpine | null;
  stations: ProductDoctrineStation[];
  objects: ProductDoctrineObject[];
  quantitySummary: ProductDoctrineQuantitySummary;
  pricingSummary: ProductDoctrinePricingSummary;
  requiredServices: ProductDoctrineRequiredService[];
  requiredAssets: ProductDoctrineRequiredAsset[];
  engineeringObjects: ProductDoctrineEngineeringObjectDefinition[];
  executionSequences: ProductDoctrineExecutionSequence[];
  closeSequences: ProductDoctrineCloseSequence[];
  evidenceRequirements: ProductDoctrineEvidenceRequirement[];
  certificationRules: ProductDoctrineCertificationRules;
  stationLevelLifecycleProjection: ProductDoctrineStationLifecycleProjection;
  scopeVersionReadinessRequirements: ProductDoctrineScopeVersionReadinessRequirement[];
}): ProductDoctrineValidationSummary {
  const checks = [
    validationCheck("account-customer", "account/customer exists", Boolean(args.accountId && args.customerId)),
    validationCheck("product-id", "productId exists", args.productId === POINT_TO_POINT_LONG_HAUL_PRODUCT_ID),
    validationCheck("doctrine-id", "doctrineId exists", args.doctrineId === POINT_TO_POINT_LONG_HAUL_DOCTRINE_ID),
    validationCheck("a-site", "A site exists", Boolean(args.aSite)),
    validationCheck("z-site", "Z site exists", Boolean(args.zSite)),
    validationCheck("authoritative-route-centerline", "Authoritative route centerline exists", Boolean(args.osrmRoute && args.centerline.length > 1)),
    validationCheck("route-authority", "Route measurement authority is explicit", Boolean(args.osrmRoute?.routeAuthority || args.osrmRoute?.source)),
    validationCheck("spine", "spine exists", Boolean(args.spine)),
    validationCheck("stations", "stations count > 0", args.stations.length > 0),
    validationCheck("objects", "objects count > 0", args.objects.length > 0),
    validationCheck("quantity-summary", "quantity summary exists", args.quantitySummary.routeFeet > 0 && args.quantitySummary.objectCount > 0),
    validationCheck("pricing-authority", "Pricing authority is explicit or unresolved", ["AUTHORIZED", "UNRESOLVED", "COMMERCIAL_PLANNING_ASSUMPTION"].includes(args.pricingSummary.priceStatus ?? "UNRESOLVED")),
    validationCheck("required-services", "required services exist", args.requiredServices.length > 0),
    validationCheck("required-assets", "required assets exist", args.requiredAssets.length > 0),
    validationCheck("engineering-objects", "engineering objects exist", args.engineeringObjects.length > 0),
    validationCheck("execution-sequences", "execution sequences exist", args.executionSequences.length > 0),
    validationCheck("close-sequences", "close sequences exist", args.closeSequences.length > 0),
    validationCheck("evidence-requirements", "evidence requirements exist", args.evidenceRequirements.length > 0),
    validationCheck("certification-rules", "certification rules exist", args.certificationRules.mustContain.length > 0),
    validationCheck("station-lifecycle-projection", "station-level lifecycle projection exists", Boolean(args.stationLevelLifecycleProjection.projectionId)),
    validationCheck("scopeversion-readiness", "ScopeVersion readiness requirements exist", args.scopeVersionReadinessRequirements.length > 0),
  ];
  const passCount = checks.filter((check) => check.status === "PASS").length;
  return {
    status: passCount === checks.length ? "PASS" : "FAIL",
    checks,
    readinessScore: Math.round((passCount / checks.length) * 100),
  };
}

export function assemblePointToPointLongHaulDoctrine(input: PointToPointLongHaulDoctrineInput): ProductDoctrineAssembly {
  const authoritativeRoute = input.authoritativeRoute ?? input.osrmRoute;
  const centerline = authoritativeRoute?.geometry ?? [];
  const routeFeet = Math.max(0, Math.round(authoritativeRoute?.routeFeet ?? 0));
  const routeMiles = round(authoritativeRoute?.routeMiles ?? routeFeet / 5280);
  const aSite = input.aSite ?? makeSite("A", input.accountId, centerline[0], "A site");
  const zSite = input.zSite ?? makeSite("Z", input.accountId, centerline[centerline.length - 1], "Z site");
  const centerlineId = `${POINT_TO_POINT_LONG_HAUL_PRODUCT_ID}:CENTERLINE:${stableIdPart(authoritativeRoute?.routeId, "AUTHORITATIVE-ROUTE")}`;
  const spine: ProductDoctrineSpine | null = aSite && zSite && centerline.length > 1 && routeFeet > 0
    ? {
      spineId: `${POINT_TO_POINT_LONG_HAUL_PRODUCT_ID}:SPINE:${stableIdPart(authoritativeRoute?.routeId, "AUTHORITATIVE-ROUTE")}`,
      topology: "LINEAR",
      networkClass: "LONG_HAUL",
      aSiteId: aSite.siteId,
      zSiteId: zSite.siteId,
      centerlineId,
      routeMiles,
      routeFeet,
      stationAuthorityMode: "CONTINUOUS",
      routeSource: authoritativeRoute?.source,
      routeAuthority: authoritativeRoute?.routeAuthority ?? authoritativeRoute?.source,
      routeRevision: authoritativeRoute?.routeRevision ?? "UNSPECIFIED",
      routeHash: authoritativeRoute?.routeHash ?? "UNSPECIFIED",
      measurementAuthority: authoritativeRoute?.measurementAuthority ?? "MEASURED_CENTERLINE",
      noScopeVersionCreation: true,
    }
    : null;
  const stations = spine ? buildStations(spine.spineId, centerline, routeFeet, input.stationIntervalFeet ?? 5280) : [];
  const routeSegments = spine ? buildSegments(spine.spineId, stations, input.routeSegments, routeFeet) : [];
  const segmentObjects = routeSegments.map((segment) => object(segment.segmentId, "ROUTE_SEGMENT", `Route segment ${segment.fromMile}-${segment.toMile}`, spine?.spineId, segment.routeFeet, "route-foot", segment as unknown as Record<string, unknown>));
  const spineObject = spine ? [object(spine.spineId, "SPINE", "Point-to-point long-haul spine", undefined, routeFeet, "route-foot", spine as unknown as Record<string, unknown>)] : [];
  const configuredDuctCount = input.projectConfiguration?.ductCount ?? input.conduitCount ?? 0;
  const configuredDuctDiameter = input.projectConfiguration?.ductDiameter ?? input.conduitSizeInches ?? 0;
  const configuredFiberCount = input.projectConfiguration?.fiberCount ?? input.fiberCount ?? 0;
  const conduitAssembly = spine && configuredDuctCount > 0 && configuredDuctDiameter > 0 ? buildConduitAssembly(spine.spineId, routeSegments, configuredDuctCount, configuredDuctDiameter) : { assemblyId: `${POINT_TO_POINT_LONG_HAUL_PRODUCT_ID}:CONDUIT-ASSEMBLY`, conduitCount: configuredDuctCount, conduitSizeInches: configuredDuctDiameter, conduitFeet: 0, objects: [] };
  const fiberAssembly = spine && configuredFiberCount > 0 ? buildFiberAssembly(spine.spineId, routeSegments, configuredFiberCount, input.projectConfiguration?.slackPolicy) : { assemblyId: `${POINT_TO_POINT_LONG_HAUL_PRODUCT_ID}:FIBER-ASSEMBLY`, fiberCount: configuredFiberCount, fiberFeet: 0, objects: [] };
  const structureAssembly = spine ? buildStructureAssembly(spine.spineId, input.projectConfiguration) : { assemblyId: `${POINT_TO_POINT_LONG_HAUL_PRODUCT_ID}:STRUCTURE-ASSEMBLY`, structureCount: 0, structures: [] };
  const crossingAssembly = spine ? buildCrossingAssembly(spine.spineId) : { assemblyId: `${POINT_TO_POINT_LONG_HAUL_PRODUCT_ID}:CROSSING-ASSEMBLY`, crossingCount: 0, crossings: [] };
  const objects = [
    ...spineObject,
    ...segmentObjects,
    ...conduitAssembly.objects,
    ...fiberAssembly.objects,
    ...structureAssembly.structures,
    ...crossingAssembly.crossings,
  ];
  const quantitySummary: ProductDoctrineQuantitySummary = {
    routeMiles,
    routeFeet,
    stationCount: stations.length,
    segmentCount: routeSegments.length,
    objectCount: objects.length,
    conduitFeet: conduitAssembly.conduitFeet,
    conduitCount: conduitAssembly.conduitCount,
    fiberFeet: fiberAssembly.fiberFeet,
    fiberCount: fiberAssembly.fiberCount,
    structureCount: structureAssembly.structureCount,
    crossingCount: crossingAssembly.crossingCount,
  };
  const pricingSummary = buildPricingSummary(input, quantitySummary);
  const validationSummary = validateAssembly({
    accountId: input.accountId,
    customerId: input.customerId,
    productId: POINT_TO_POINT_LONG_HAUL_PRODUCT_ID,
    doctrineId: POINT_TO_POINT_LONG_HAUL_DOCTRINE_ID,
    aSite,
    zSite,
    osrmRoute: authoritativeRoute,
    centerline,
    spine,
    stations,
    objects,
    quantitySummary,
    pricingSummary,
    requiredServices: POINT_TO_POINT_LONG_HAUL_REQUIRED_SERVICES,
    requiredAssets: POINT_TO_POINT_LONG_HAUL_REQUIRED_ASSETS,
    engineeringObjects: POINT_TO_POINT_LONG_HAUL_ENGINEERING_OBJECTS,
    executionSequences: POINT_TO_POINT_LONG_HAUL_EXECUTION_SEQUENCES,
    closeSequences: POINT_TO_POINT_LONG_HAUL_CLOSE_SEQUENCES,
    evidenceRequirements: POINT_TO_POINT_LONG_HAUL_EVIDENCE_REQUIREMENTS,
    certificationRules: POINT_TO_POINT_LONG_HAUL_CERTIFICATION_RULES,
    stationLevelLifecycleProjection: POINT_TO_POINT_LONG_HAUL_STATION_LIFECYCLE_PROJECTION,
    scopeVersionReadinessRequirements: POINT_TO_POINT_LONG_HAUL_SCOPEVERSION_READINESS_REQUIREMENTS,
  });
  const assemblyId = `${POINT_TO_POINT_LONG_HAUL_PRODUCT_ID}:ASSEMBLY:${stableIdPart(authoritativeRoute?.routeId, "AUTHORITATIVE-ROUTE")}`;
  return {
    assemblyId,
    doctrineId: POINT_TO_POINT_LONG_HAUL_DOCTRINE_ID,
    productId: POINT_TO_POINT_LONG_HAUL_PRODUCT_ID,
    productDoctrineVersion: POINT_TO_POINT_LONG_HAUL_DOCTRINE_VERSION,
    projectConfiguration: input.projectConfiguration,
    aSite,
    zSite,
    authoritativeRoute,
    osrmRoute: authoritativeRoute,
    centerline,
    centerlineId,
    spine,
    stations,
    routeSegments,
    objects,
    conduitAssembly,
    fiberAssembly,
    structureAssembly,
    crossingAssembly,
    quantitySummary,
    pricingSummary,
    validationSummary,
    engineeringManifest: {
      manifestId: `${assemblyId}:ENGINEERING-MANIFEST`,
      packagePath: "Commercial Proposal -> Product Doctrine Assembly -> Draft IOF Package -> Engineering Review",
      requiresEngineeringCertification: true,
      noScopeVersionCreation: true,
      objectIds: objects.map((item) => item.objectId),
      stationIds: stations.map((station) => station.stationId),
      quantityKeys: Object.keys(quantitySummary),
      serviceIds: POINT_TO_POINT_LONG_HAUL_REQUIRED_SERVICES.map((item) => item.serviceId),
      assetIds: POINT_TO_POINT_LONG_HAUL_REQUIRED_ASSETS.map((item) => item.assetId),
      evidenceRequirementIds: POINT_TO_POINT_LONG_HAUL_EVIDENCE_REQUIREMENTS.map((item) => item.evidenceRequirementId),
      closeSequenceIds: POINT_TO_POINT_LONG_HAUL_CLOSE_SEQUENCES.map((item) => item.closeSequenceId),
      scopeVersionReadinessRequirementIds: POINT_TO_POINT_LONG_HAUL_SCOPEVERSION_READINESS_REQUIREMENTS.map((item) => item.requirementId),
    },
    rules: POINT_TO_POINT_LONG_HAUL_DOCTRINE.rules,
    registry: POINT_TO_POINT_LONG_HAUL_DOCTRINE_REGISTRY_ENTRY,
    requiredServices: POINT_TO_POINT_LONG_HAUL_REQUIRED_SERVICES,
    requiredAssets: POINT_TO_POINT_LONG_HAUL_REQUIRED_ASSETS,
    engineeringObjects: POINT_TO_POINT_LONG_HAUL_ENGINEERING_OBJECTS,
    executionSequences: POINT_TO_POINT_LONG_HAUL_EXECUTION_SEQUENCES,
    closeSequences: POINT_TO_POINT_LONG_HAUL_CLOSE_SEQUENCES,
    evidenceRequirements: POINT_TO_POINT_LONG_HAUL_EVIDENCE_REQUIREMENTS,
    certificationRules: POINT_TO_POINT_LONG_HAUL_CERTIFICATION_RULES,
    stationLevelLifecycleProjection: POINT_TO_POINT_LONG_HAUL_STATION_LIFECYCLE_PROJECTION,
    scopeVersionReadinessRequirements: POINT_TO_POINT_LONG_HAUL_SCOPEVERSION_READINESS_REQUIREMENTS,
    requirementGaps: [
      ...(!input.projectConfiguration?.structurePlanAuthority || input.projectConfiguration.structurePlanAuthority === "UNKNOWN" || (!Number.isFinite(input.projectConfiguration.handholeCount) && !Number.isFinite(input.projectConfiguration.vaultCount)) ? [{ requirementId: "STRUCTURE_PLAN_DEFINED", objectClass: "STRUCTURE", status: "ENGINEERING_REVIEW_REQUIRED" as const, authority: "ENGINEERING", reason: "Access and structure quantities require source evidence or an Engineering-defined structure plan." }] : []),
      ...(!input.projectConfiguration?.spliceArchitectureAuthority || input.projectConfiguration.spliceArchitectureAuthority === "UNKNOWN" || !Number.isFinite(input.projectConfiguration.spliceCaseCount) ? [{ requirementId: "SPLICE_ARCHITECTURE_DEFINED", objectClass: "SPLICE_CASE", status: "ENGINEERING_REVIEW_REQUIRED" as const, authority: "ENGINEERING", reason: "Splice architecture is not defined by route length." }] : []),
      { requirementId: "APPLICABLE_CONSTRAINTS_EVALUATED", objectClass: "CROSSING", status: "UNKNOWN", authority: "ENGINEERING", reason: "Crossing and environmental constraint counts remain unknown until evaluated." },
    ],
    doctrineMigration: { previousDoctrineVersion: POINT_TO_POINT_LONG_HAUL_PREVIOUS_DOCTRINE_VERSION, newDoctrineVersion: POINT_TO_POINT_LONG_HAUL_DOCTRINE_VERSION, changeReason: POINT_TO_POINT_LONG_HAUL_DOCTRINE_CHANGE_REASON },
    noScopeVersionCreation: true,
  };
}

export const PRODUCT_DOCTRINE_REGISTRY: ProductDoctrineRegistryEntry[] = [
  POINT_TO_POINT_LONG_HAUL_DOCTRINE_REGISTRY_ENTRY,
];

export function resolveProductDoctrineRegistryEntry(value: unknown): ProductDoctrineRegistryEntry | null {
  const key = String(value ?? "").trim();
  if (!key) return null;
  return PRODUCT_DOCTRINE_REGISTRY.find((entry) => [
    entry.alias,
    entry.canonicalDoctrineId,
    entry.productId,
    entry.businessProductName,
    entry.technicalDoctrineName,
  ].includes(key)) ?? null;
}
