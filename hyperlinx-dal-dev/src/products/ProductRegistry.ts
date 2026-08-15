import type { ProductDoctrine } from "./ProductDoctrineContracts";
import {
  POINT_TO_POINT_LONG_HAUL_BUSINESS_PRODUCT_NAME,
  POINT_TO_POINT_LONG_HAUL_DOCTRINE,
  POINT_TO_POINT_LONG_HAUL_DOCTRINE_ID,
  POINT_TO_POINT_LONG_HAUL_DOCTRINE_VERSION,
  POINT_TO_POINT_LONG_HAUL_PRODUCT_ID,
} from "./pointToPointLongHaulDoctrine";

export type ProductRequirementMode = "REQUIRED" | "OPTIONAL" | "CONDITIONAL";
export type ProductRegistryStatus = "ACTIVE" | "INACTIVE" | "DRAFT";
export type QuantityReconciliationStatus =
  | "MATCH"
  | "SOURCE_OVERRIDE_REQUIRES_AUTHORITY"
  | "DOCTRINE_EXCEPTION_REQUIRED"
  | "MISSING_SOURCE"
  | "MISSING_DOCTRINE";

export interface ProductAssetClassRequirement {
  objectClass: string;
  mode: ProductRequirementMode;
  condition?: string;
}

export interface ProductQuantityRule {
  normalizedField: string;
  authority: "MEASURED_SPINE" | "PRODUCT_DOCTRINE" | "PROJECT_CONFIGURATION" | "SOURCE_EVIDENCE" | "ENGINEERING_DESIGN";
  formula: string;
  sourceOverridePolicy: "REQUIRES_APPROVED_AUTHORITY" | "NOT_ALLOWED";
}

export interface ProductCommercialProfile {
  profileId: string;
  supportedTerms: string[];
  pricingInstruments: string[];
  createsScopeVersion: false;
}

export interface ProductEngineeringProfile {
  profileId: string;
  certificationRequired: true;
  certificationTarget: "DRAFT_IOF_PACKAGE";
  certificationMeaning: string;
}

export interface ProductEvidenceRule {
  evidenceType: string;
  mode: ProductRequirementMode;
  requiredFor: string[];
  acceptanceCriteria: string[];
}

export interface ProductAcceptanceProfile {
  profileId: string;
  model: string[];
  rules: ProductEvidenceRule[];
}

export interface ProductMaintenanceProfile {
  profileId: string;
  mode: "OPTIONAL_RECURRING";
  capabilities: string[];
}

export interface ProductContractProfile {
  contractProfileId: string;
  commercialInstrument: string;
  customerAssetDescription: string;
  commercialTermsSupported: string[];
  acceptanceModel: string[];
  maintenanceModel: "OPTIONAL_RECURRING";
  legalApprovalRequired: true;
  sourceDocumentsAreReferenceOnly: true;
}

export interface ProductCloseSequence {
  objectClass: string;
  states: string[];
  dependencies: string[];
}

export interface ProductPaymentPolicy {
  policyId: string;
  constitutionalRule: "NO_CLOSE_NO_VALIDATION_NO_PAYMENT";
  eligibilityByObjectClass: Record<string, string>;
  contractMilestonesRequired: true;
}

export interface ProductDefinition {
  productId: string;
  productVersion: string;
  displayName: string;
  description: string;
  productFamily: "LAYER_1_DUCT_DARK_FIBER";
  layer: "L1";
  networkClasses: Array<"LONG_HAUL" | "METRO" | "LATERAL" | "REGIONAL">;
  topologies: Array<"LINEAR" | "POINT_TO_POINT">;
  opticalTransportIncluded: false;
  engineeringCertificationRequired: true;
  commercialScopeVersionCreationAllowed: false;
  status: ProductRegistryStatus;
  doctrineId: string;
  doctrineVersion: string;
  doctrineAlias: string;
  requiredServices: string[];
  assetClasses: ProductAssetClassRequirement[];
  quantityRules: ProductQuantityRule[];
  commercialProfile: ProductCommercialProfile;
  engineeringProfile: ProductEngineeringProfile;
  evidenceProfile: { profileId: string; rules: ProductEvidenceRule[] };
  acceptanceProfile: ProductAcceptanceProfile;
  maintenanceProfile: ProductMaintenanceProfile;
  contractProfile: ProductContractProfile;
  closeSequences: ProductCloseSequence[];
  paymentPolicy: ProductPaymentPolicy;
  defaultCommercialConfiguration: {
    termYears: number;
    protected: boolean;
    ductCount: number;
    ductDiameter: number;
    configurable: true;
  };
}

export interface ResolvedProduct {
  definition: ProductDefinition;
  doctrine: ProductDoctrine;
}

const DARK_FIBER_EVIDENCE_RULES: ProductEvidenceRule[] = [
  { evidenceType: "GPS_STATION_AS_BUILT", mode: "REQUIRED", requiredFor: ["SPINE", "ROUTE_SEGMENT", "STRUCTURES"], acceptanceCriteria: ["station or range identified", "source and timestamp recorded"] },
  { evidenceType: "INSTALLED_QUANTITY", mode: "REQUIRED", requiredFor: ["CONDUIT", "FIBER", "STRUCTURES"], acceptanceCriteria: ["installed quantity reconciles to object close"] },
  { evidenceType: "CONDUIT_PLACEMENT", mode: "REQUIRED", requiredFor: ["CONDUIT"], acceptanceCriteria: ["installation and inspection evidence accepted"] },
  { evidenceType: "FIBER_PLACEMENT", mode: "REQUIRED", requiredFor: ["FIBER"], acceptanceCriteria: ["reel, pull, slack, and placement evidence accepted"] },
  { evidenceType: "SPLICE_COMPLETION", mode: "REQUIRED", requiredFor: ["SPLICE_CASE", "FIBER"], acceptanceCriteria: ["splice record complete", "case sealed and labeled"] },
  { evidenceType: "BIDIRECTIONAL_OTDR_1550NM", mode: "REQUIRED", requiredFor: ["FIBER", "SPLICE_CASE"], acceptanceCriteria: ["both directions attached", "1550nm test identified", "threshold profile passed or exception approved"] },
  { evidenceType: "END_TO_END_POWER_LOSS", mode: "REQUIRED", requiredFor: ["FIBER"], acceptanceCriteria: ["end-to-end power result attached", "loss budget passed or exception approved"] },
  { evidenceType: "INSPECTION", mode: "REQUIRED", requiredFor: ["CONDUIT", "FIBER", "STRUCTURES"], acceptanceCriteria: ["inspection accepted", "punch list resolved"] },
  { evidenceType: "AS_BUILT_MAP", mode: "REQUIRED", requiredFor: ["SPINE"], acceptanceCriteria: ["actual route and object references attached"] },
  { evidenceType: "TERMINATION_TEST_AND_LABEL", mode: "REQUIRED", requiredFor: ["TERMINATION_POINT", "DEMARCATION_POINT"], acceptanceCriteria: ["termination labeled", "handoff test accepted"] },
  { evidenceType: "ILA_SITE_COMMISSIONING", mode: "REQUIRED", requiredFor: ["ILA_SITE"], acceptanceCriteria: ["optical design approved", "power confirmed", "commissioning evidence accepted"] },
  { evidenceType: "SYSTEM_ACCEPTANCE_NOTICE", mode: "REQUIRED", requiredFor: ["CUSTOMER_ACCEPTANCE"], acceptanceCriteria: ["customer acceptance reference recorded"] },
];

const OBJECT_CLOSE_SEQUENCES: ProductCloseSequence[] = [
  { objectClass: "SPINE", states: ["PLANNED", "ENGINEERING_REVIEW", "ENGINEERED", "RELEASED", "AS_BUILT", "ACCEPTED", "CLOSED"], dependencies: ["route geometry authority", "station authority", "engineering certification"] },
  { objectClass: "ROUTE_SEGMENT", states: ["PLANNED", "ENGINEERED", "RELEASED", "IN_PROGRESS", "INSTALLED", "INSPECTED", "AS_BUILT", "ACCEPTED"], dependencies: ["SPINE engineered", "permits and constraints released"] },
  { objectClass: "CONDUIT", states: ["PLANNED", "ENGINEERED", "RELEASED", "INSTALLED", "INSPECTED", "AS_BUILT", "ACCEPTED"], dependencies: ["ROUTE_SEGMENT released", "material received"] },
  { objectClass: "FIBER", states: ["PLANNED", "ENGINEERED", "RELEASED", "PLACED", "SPLICED", "TESTED", "ACCEPTED", "AS_BUILT"], dependencies: ["CONDUIT accepted", "fiber material received", "splice plan approved"] },
  { objectClass: "HANDHOLE", states: ["PLANNED", "ENGINEERED", "RELEASED", "INSTALLED", "INSPECTED", "AS_BUILT", "ACCEPTED"], dependencies: ["station released", "structure material received"] },
  { objectClass: "MANHOLE", states: ["PLANNED", "ENGINEERED", "RELEASED", "INSTALLED", "INSPECTED", "AS_BUILT", "ACCEPTED"], dependencies: ["station released", "structure material received"] },
  { objectClass: "VAULT", states: ["PLANNED", "ENGINEERED", "RELEASED", "INSTALLED", "INSPECTED", "AS_BUILT", "ACCEPTED"], dependencies: ["station released", "structure material received"] },
  { objectClass: "SPLICE_CASE", states: ["PLANNED", "INSTALLED", "SPLICED", "OTDR_VERIFIED", "SEALED", "ACCEPTED"], dependencies: ["FIBER placed", "splice plan approved"] },
  { objectClass: "TERMINATION_POINT", states: ["PLANNED", "ENGINEERED", "INSTALLED", "TERMINATED", "TESTED", "ACCEPTED"], dependencies: ["FIBER placed", "demarcation approved"] },
  { objectClass: "MARKER_POST", states: ["PLANNED", "RELEASED", "INSTALLED", "GPS_VERIFIED", "ACCEPTED"], dependencies: ["route segment installed", "marker plan approved"] },
  { objectClass: "CROSSING", states: ["PLANNED", "ENGINEERED", "PERMITTED", "RELEASED", "INSTALLED", "INSPECTED", "AS_BUILT", "ACCEPTED"], dependencies: ["crossing evidence", "permit release", "locate complete"] },
  { objectClass: "ILA_SITE", states: ["PLANNED", "ENGINEERED", "POWER_CONFIRMED", "CIVIL_COMPLETE", "EQUIPMENT_INSTALLED", "COMMISSIONED", "ACCEPTED"], dependencies: ["optical design requires ILA", "site and power authority"] },
  { objectClass: "DEMARCATION_POINT", states: ["PLANNED", "ENGINEERED", "INSTALLED", "LABELED", "TESTED", "ACCEPTED"], dependencies: ["customer handoff approved", "termination released"] },
];

export const POINT_TO_POINT_DUCT_DARK_FIBER_PRODUCT: ProductDefinition = {
  productId: POINT_TO_POINT_LONG_HAUL_PRODUCT_ID,
  productVersion: "1.0.0",
  displayName: POINT_TO_POINT_LONG_HAUL_BUSINESS_PRODUCT_NAME,
  description: "Layer 1 point-to-point duct and dark-fiber infrastructure without optical transport.",
  productFamily: "LAYER_1_DUCT_DARK_FIBER",
  layer: "L1",
  networkClasses: ["LONG_HAUL", "METRO", "LATERAL", "REGIONAL"],
  topologies: ["LINEAR", "POINT_TO_POINT"],
  opticalTransportIncluded: false,
  engineeringCertificationRequired: true,
  commercialScopeVersionCreationAllowed: false,
  status: "ACTIVE",
  doctrineId: POINT_TO_POINT_LONG_HAUL_DOCTRINE_ID,
  doctrineVersion: POINT_TO_POINT_LONG_HAUL_DOCTRINE_VERSION,
  doctrineAlias: "PD-001",
  requiredServices: [
    "ROUTE_DESIGN", "ENGINEERING", "MATERIAL_PROCUREMENT", "CONSTRUCTION", "CONDUIT_PLACEMENT",
    "FIBER_PLACEMENT", "SPLICING", "TESTING", "AS_BUILT_DOCUMENTATION", "PROJECT_MANAGEMENT",
    "MAINTENANCE_OM_OPTIONAL", "RESTORATION_LOCATE_OPTIONAL",
  ],
  assetClasses: [
    { objectClass: "SPINE", mode: "REQUIRED" },
    { objectClass: "ROUTE_SEGMENT", mode: "REQUIRED" },
    { objectClass: "CONDUIT", mode: "REQUIRED" },
    { objectClass: "FIBER", mode: "REQUIRED" },
    { objectClass: "HANDHOLE", mode: "CONDITIONAL", condition: "Required by a source-defined or Engineering-defined structure plan." },
    { objectClass: "MANHOLE", mode: "OPTIONAL" },
    { objectClass: "VAULT", mode: "OPTIONAL" },
    { objectClass: "SPLICE_CASE", mode: "CONDITIONAL", condition: "Required by splice architecture." },
    { objectClass: "TERMINATION_POINT", mode: "REQUIRED" },
    { objectClass: "MARKER_POST", mode: "CONDITIONAL", condition: "Required by route and maintenance marking rules." },
    { objectClass: "CROSSING", mode: "CONDITIONAL", condition: "Required when source evidence or Engineering identifies a crossing." },
    { objectClass: "ILA_SITE", mode: "CONDITIONAL", condition: "Required only by approved optical design." },
    { objectClass: "DEMARCATION_POINT", mode: "CONDITIONAL", condition: "Required for a customer or network handoff." },
  ],
  quantityRules: [
    { normalizedField: "routeFeet", authority: "MEASURED_SPINE", formula: "geodesic length of authoritative centerline", sourceOverridePolicy: "NOT_ALLOWED" },
    { normalizedField: "conduitFeet", authority: "PROJECT_CONFIGURATION", formula: "measured routeFeet * project-configured ductCount", sourceOverridePolicy: "REQUIRES_APPROVED_AUTHORITY" },
    { normalizedField: "fiberFeet", authority: "PROJECT_CONFIGURATION", formula: "measured routeFeet * attributable project slack/placement policy", sourceOverridePolicy: "REQUIRES_APPROVED_AUTHORITY" },
    { normalizedField: "handholeCount", authority: "ENGINEERING_DESIGN", formula: "source-defined or Engineering-defined structure plan", sourceOverridePolicy: "REQUIRES_APPROVED_AUTHORITY" },
    { normalizedField: "spliceCaseCount", authority: "ENGINEERING_DESIGN", formula: "approved splice architecture", sourceOverridePolicy: "REQUIRES_APPROVED_AUTHORITY" },
    { normalizedField: "markerPostCount", authority: "ENGINEERING_DESIGN", formula: "source-defined or Engineering-defined route marking plan", sourceOverridePolicy: "REQUIRES_APPROVED_AUTHORITY" },
    { normalizedField: "crossingCount", authority: "SOURCE_EVIDENCE", formula: "source crossing evidence confirmed by Engineering", sourceOverridePolicy: "REQUIRES_APPROVED_AUTHORITY" },
    { normalizedField: "ILACount", authority: "ENGINEERING_DESIGN", formula: "approved optical design", sourceOverridePolicy: "NOT_ALLOWED" },
  ],
  commercialProfile: {
    profileId: "L1_DARK_FIBER_COMMERCIAL_PROFILE",
    supportedTerms: ["NRC_OR_IRU_FEE", "RECURRING_MAINTENANCE", "TERM", "DELIVERY_DATE"],
    pricingInstruments: ["IRU", "LEASE", "SERVICE_ORDER"],
    createsScopeVersion: false,
  },
  engineeringProfile: {
    profileId: "L1_DARK_FIBER_ENGINEERING_PROFILE",
    certificationRequired: true,
    certificationTarget: "DRAFT_IOF_PACKAGE",
    certificationMeaning: "The Draft IOF Package is complete, constructable, and constitutionally valid. If commercially authorized and signed, it is eligible to be promoted into a production ScopeVersion.",
  },
  evidenceProfile: { profileId: "L1_DARK_FIBER_EVIDENCE_PROFILE", rules: DARK_FIBER_EVIDENCE_RULES },
  acceptanceProfile: {
    profileId: "L1_DARK_FIBER_ACCEPTANCE_PROFILE",
    model: ["ATP", "PASS", "SAN", "ACCEPTED"],
    rules: DARK_FIBER_EVIDENCE_RULES,
  },
  maintenanceProfile: {
    profileId: "L1_DARK_FIBER_MAINTENANCE_PROFILE",
    mode: "OPTIONAL_RECURRING",
    capabilities: ["ROUTINE_MAINTENANCE", "EMERGENCY_RESTORATION", "LOCATE_SERVICE", "ROUTE_MARKING"],
  },
  contractProfile: {
    contractProfileId: "L1_DARK_FIBER_IRU_PROFILE",
    commercialInstrument: "IRU + SOW",
    customerAssetDescription: "Cable System / Dark Fiber System",
    commercialTermsSupported: ["NRC_IRU_FEE", "RECURRING_MAINTENANCE", "TERM", "ROUTE_MAP_EXHIBIT", "FIBER_QUANTITY", "CONSTRUCTION_TYPE", "DELIVERY_DATE", "ACCEPTANCE", "SAN", "MAINTENANCE_ELECTION"],
    acceptanceModel: ["ATP", "PASS", "SAN", "ACCEPTED"],
    maintenanceModel: "OPTIONAL_RECURRING",
    legalApprovalRequired: true,
    sourceDocumentsAreReferenceOnly: true,
  },
  closeSequences: OBJECT_CLOSE_SEQUENCES,
  paymentPolicy: {
    policyId: "L1_DARK_FIBER_VALIDATED_CLOSE_PAYMENT_POLICY",
    constitutionalRule: "NO_CLOSE_NO_VALIDATION_NO_PAYMENT",
    eligibilityByObjectClass: {
      CONDUIT: "installation close plus required installation evidence",
      FIBER: "placement close; testing is separately eligible after OTDR and power evidence",
      SPLICE_CASE: "splice completion close plus splice evidence",
      CUSTOMER_ACCEPTANCE: "contract-defined final milestone after SAN/customer acceptance",
    },
    contractMilestonesRequired: true,
  },
  defaultCommercialConfiguration: { termYears: 20, protected: false, ductCount: 3, ductDiameter: 1.25, configurable: true },
};

export class ProductRegistry {
  readonly #products = new Map<string, ResolvedProduct>();

  constructor(products: ResolvedProduct[] = []) {
    products.forEach((product) => this.register(product));
  }

  register(product: ResolvedProduct) {
    if (product.definition.productId !== product.doctrine.productId) {
      throw new Error(`Product ${product.definition.productId} cannot register doctrine for ${product.doctrine.productId}.`);
    }
    if (product.definition.doctrineId !== product.doctrine.doctrineId) {
      throw new Error(`Product ${product.definition.productId} doctrine reference does not resolve.`);
    }
    this.#products.set(product.definition.productId, product);
    return this;
  }

  resolve(productId: string): ResolvedProduct | null {
    return this.#products.get(productId) ?? null;
  }

  require(productId: string): ResolvedProduct {
    const product = this.resolve(productId);
    if (!product) throw new Error(`Unknown Product Registry product: ${productId}`);
    return product;
  }

  list(status?: ProductRegistryStatus): ProductDefinition[] {
    return [...this.#products.values()]
      .map((product) => product.definition)
      .filter((product) => !status || product.status === status);
  }

  commercialOptions() {
    return this.list("ACTIVE").map((product) => ({
      productId: product.productId,
      productName: product.displayName,
      productFamily: product.productFamily,
      defaultTermYears: product.defaultCommercialConfiguration.termYears,
      protected: product.defaultCommercialConfiguration.protected,
      defaultDuctCount: product.defaultCommercialConfiguration.ductCount,
      defaultDuctDiameter: product.defaultCommercialConfiguration.ductDiameter,
      configurationIsProjectAuthority: product.defaultCommercialConfiguration.configurable,
    }));
  }
}

export const PRODUCT_REGISTRY = new ProductRegistry([
  { definition: POINT_TO_POINT_DUCT_DARK_FIBER_PRODUCT, doctrine: POINT_TO_POINT_LONG_HAUL_DOCTRINE },
]);

export function resolveProduct(productId: string) {
  return PRODUCT_REGISTRY.resolve(productId);
}

export function reconcileQuantity(source: number | undefined, doctrine: number | undefined, tolerance = 0.005): QuantityReconciliationStatus {
  if (source === undefined) return "MISSING_SOURCE";
  if (doctrine === undefined) return "MISSING_DOCTRINE";
  if (source === doctrine || Math.abs(source - doctrine) <= Math.max(1, Math.abs(doctrine) * tolerance)) return "MATCH";
  return source > 0 && doctrine > 0 ? "SOURCE_OVERRIDE_REQUIRES_AUTHORITY" : "DOCTRINE_EXCEPTION_REQUIRED";
}
