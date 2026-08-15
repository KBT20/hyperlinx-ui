/**
 * CIP-043 commercial pricing authority.
 *
 * This module deliberately contains no Product Doctrine imports. Product Doctrine
 * identifies required asset classes; this module prices project quantities after
 * Project Configuration and quantity derivation have done their work.
 */

export type CommercialAuthorityLayer =
  | "PRODUCT_DOCTRINE"
  | "PROJECT_CONFIGURATION"
  | "SOURCE_EVIDENCE"
  | "RATE_CATALOG"
  | "MATERIAL_CATALOG"
  | "ESTIMATING_DOCTRINE"
  | "COMMERCIAL_POLICY"
  | "HUMAN_CALIBRATION"
  | "ENGINEERING"
  | "UNKNOWN";

export interface CommercialArtifactScope {
  organizationId: string;
  tenantId: string;
  customerId: string;
  opportunityId: string;
  configurationRevision: number;
  sharingMode?: "PROJECT" | "CUSTOMER" | "TENANT" | "GLOBAL";
}

export type RateCategory = "LABOR" | "EQUIPMENT" | "PROFESSIONAL_SERVICE" | "OTHER_SERVICE" | (string & {});
export type RateType = "FIXED" | "TABLE" | "FORMULA" | "ADDER";
export type RateAuthorityMode = "CONTRACTOR_RATE_CARD" | "INTERNAL_APPROVED" | "CUSTOMER_NEGOTIATED" | "HUMAN_ASSUMPTION" | "UNRESOLVED";

export interface RateItem {
  rateId: string;
  profileId: string;
  category: RateCategory;
  subcategory: string;
  description: string;
  unit: string;
  rate: number;
  currency: string;
  rateType: RateType;
  authorityMode: RateAuthorityMode;
  source: string;
  sourceDocument: string;
  effectiveDate: string;
  expirationDate?: string;
  geography?: string;
  vendorApplicability?: string[];
  customerApplicability?: string[];
  capacityMin?: number;
  capacityMax?: number;
  conditions?: Record<string, string | number | boolean>;
  formula?: string;
  approvedBy?: string;
  revision: number;
  active: boolean;
}

export interface RateProfile {
  profileId: string;
  name: string;
  description: string;
  authorityMode: RateAuthorityMode;
  scope: CommercialArtifactScope;
  sourceDocument: string;
  revision: number;
  active: boolean;
  items: RateItem[];
}

export interface RateResolutionRequest {
  profileId: string;
  subcategory: string;
  unit?: string;
  capacity?: number;
  conditions?: Record<string, string | number | boolean>;
  asOf?: string;
  scope: CommercialArtifactScope;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function scopeAllows(artifact: CommercialArtifactScope, request: CommercialArtifactScope) {
  if (artifact.sharingMode === "GLOBAL") return true;
  if (artifact.organizationId !== request.organizationId || artifact.tenantId !== request.tenantId) return false;
  if (artifact.sharingMode === "TENANT") return true;
  if (artifact.customerId !== request.customerId) return false;
  if (artifact.sharingMode === "CUSTOMER") return true;
  return artifact.opportunityId === request.opportunityId;
}

function conditionMatches(expected: Record<string, string | number | boolean> | undefined, actual: Record<string, string | number | boolean> | undefined) {
  return Object.entries(expected ?? {}).every(([key, value]) => actual?.[key] === value);
}

export class RateCatalog {
  readonly #profiles = new Map<string, RateProfile>();
  readonly #categories = new Set<string>(["LABOR", "EQUIPMENT", "PROFESSIONAL_SERVICE", "OTHER_SERVICE"]);

  registerCategory(category: string) {
    if (!category.trim()) throw new Error("Rate category is required.");
    this.#categories.add(category.trim().toUpperCase());
    return this;
  }

  registerProfile(profile: RateProfile) {
    if (this.#profiles.has(profile.profileId)) throw new Error(`Rate Profile ${profile.profileId} is immutable; create a new revision.`);
    profile.items.forEach((item) => this.#categories.add(item.category));
    this.#profiles.set(profile.profileId, clone(profile));
    return this;
  }

  categories() { return [...this.#categories]; }
  profile(profileId: string) { const value = this.#profiles.get(profileId); return value ? clone(value) : null; }

  resolve(request: RateResolutionRequest): RateItem {
    const profile = this.#profiles.get(request.profileId);
    if (!profile || !profile.active) throw new Error(`Active Rate Profile ${request.profileId} does not resolve.`);
    if (!scopeAllows(profile.scope, request.scope)) throw new Error("Cross-tenant Rate Profile resolution is prohibited.");
    const asOf = request.asOf ?? new Date().toISOString().slice(0, 10);
    const matches = profile.items.filter((item) =>
      item.active && item.subcategory === request.subcategory && (!request.unit || item.unit === request.unit) &&
      item.effectiveDate <= asOf && (!item.expirationDate || item.expirationDate >= asOf) &&
      (item.capacityMin === undefined || (request.capacity ?? 0) >= item.capacityMin) &&
      (item.capacityMax === undefined || (request.capacity ?? 0) <= item.capacityMax) &&
      conditionMatches(item.conditions, request.conditions),
    );
    if (!matches.length) throw new Error(`No governed rate resolves for ${request.subcategory}.`);
    return clone(matches.sort((a, b) => b.revision - a.revision)[0]);
  }
}

export type GeologyCondition = "NORMAL" | "COBBLE_SOFT_ROCK" | "HARD_ROCK" | (string & {});
export type ConstructionMethod = "DIRECTIONAL_BORE" | "PLOW" | "OPEN_TRENCH" | (string & {});

export interface DuctPackage {
  ductCount: number;
  ductDiameterInches: number;
  materialSpec: string;
}

export interface ConstructionCapabilityRule {
  capabilityId: string;
  method: ConstructionMethod;
  ductCountMin: number;
  ductCountMax: number;
  ductDiameterMin: number;
  ductDiameterMax: number;
  requiredReamClassInches?: number;
  capabilityClass: string;
  plowAllowed: boolean;
  preripRequired: boolean;
  equipmentClass: string;
  engineeringReviewConditions: string[];
  source: string;
  revision: number;
}

export interface ConstructionCapabilityResolution {
  package: DuctPackage;
  method: ConstructionMethod;
  capabilityClass: string;
  requiredReamClassInches?: number;
  plowAllowed: boolean;
  preripRequired: boolean;
  equipmentClass: string;
  engineeringReviewRequired: boolean;
  source: string;
  revision: number;
}

/** Physical package-to-ream governance is intentionally separate from pricing. */
export const STANDARD_DUCT_PACKAGE_CAPABILITIES: ConstructionCapabilityRule[] = [
  { capabilityId: "CAP-BORE-3X125", method: "DIRECTIONAL_BORE", ductCountMin: 1, ductCountMax: 3, ductDiameterMin: 1, ductDiameterMax: 1.25, requiredReamClassInches: 6, capabilityClass: "STANDARD", plowAllowed: false, preripRequired: false, equipmentClass: "STANDARD_HDD", engineeringReviewConditions: [], source: "Approved commercial duct-package capacity model", revision: 1 },
  { capabilityId: "CAP-BORE-6X125", method: "DIRECTIONAL_BORE", ductCountMin: 4, ductCountMax: 6, ductDiameterMin: 1, ductDiameterMax: 1.25, requiredReamClassInches: 8, capabilityClass: "REAM_8", plowAllowed: false, preripRequired: false, equipmentClass: "MEDIUM_HDD", engineeringReviewConditions: [], source: "Approved commercial duct-package capacity model", revision: 1 },
  { capabilityId: "CAP-BORE-3X150", method: "DIRECTIONAL_BORE", ductCountMin: 1, ductCountMax: 3, ductDiameterMin: 1.26, ductDiameterMax: 1.5, requiredReamClassInches: 8, capabilityClass: "REAM_8", plowAllowed: false, preripRequired: false, equipmentClass: "MEDIUM_HDD", engineeringReviewConditions: [], source: "Approved commercial duct-package capacity model", revision: 1 },
  { capabilityId: "CAP-PLOW-3", method: "PLOW", ductCountMin: 1, ductCountMax: 3, ductDiameterMin: 1, ductDiameterMax: 1.5, capabilityClass: "PLOW_STANDARD", plowAllowed: true, preripRequired: false, equipmentClass: "MULTI_DUCT_PLOW", engineeringReviewConditions: ["HARD_ROCK"], source: "Approved construction capability model", revision: 1 },
  { capabilityId: "CAP-PLOW-6", method: "PLOW", ductCountMin: 4, ductCountMax: 6, ductDiameterMin: 1, ductDiameterMax: 1.25, capabilityClass: "PLOW_MULTI_DUCT_REVIEW", plowAllowed: true, preripRequired: true, equipmentClass: "HEAVY_MULTI_DUCT_PLOW", engineeringReviewConditions: ["COBBLE_SOFT_ROCK", "HARD_ROCK"], source: "Approved construction capability model", revision: 1 },
];

export function resolveConstructionCapability(ductPackage: DuctPackage, method: ConstructionMethod, geology: GeologyCondition = "NORMAL", rules = STANDARD_DUCT_PACKAGE_CAPABILITIES): ConstructionCapabilityResolution {
  const rule = rules.find((candidate) => candidate.method === method && ductPackage.ductCount >= candidate.ductCountMin && ductPackage.ductCount <= candidate.ductCountMax && ductPackage.ductDiameterInches >= candidate.ductDiameterMin && ductPackage.ductDiameterInches <= candidate.ductDiameterMax);
  if (!rule) throw new Error(`Duct package ${ductPackage.ductCount}x${ductPackage.ductDiameterInches} requires Engineering capability review.`);
  return {
    package: clone(ductPackage), method, capabilityClass: rule.capabilityClass,
    requiredReamClassInches: rule.requiredReamClassInches, plowAllowed: rule.plowAllowed,
    preripRequired: rule.preripRequired, equipmentClass: rule.equipmentClass,
    engineeringReviewRequired: rule.engineeringReviewConditions.includes(geology),
    source: rule.source, revision: rule.revision,
  };
}

export function teralinxBoreRate(capability: ConstructionCapabilityResolution, geologyAdderPerFoot = 0, specialConditionAdderPerFoot = 0, projectCalibrationPerFoot = 0) {
  const requiredReam = capability.requiredReamClassInches ?? 6;
  const additionalTwoInchIncrements = Math.max(0, Math.ceil((requiredReam - 6) / 2));
  const baseRate = 15;
  const capacityAdder = additionalTwoInchIncrements * 10;
  return { baseRate, capacityAdder, geologyAdder: geologyAdderPerFoot, specialConditionAdder: specialConditionAdderPerFoot, projectCalibration: projectCalibrationPerFoot, totalRate: baseRate + capacityAdder + geologyAdderPerFoot + specialConditionAdderPerFoot + projectCalibrationPerFoot, formula: "BASE_BORE_RATE + ($10 * governed additional 2-inch ream increments) + GEOLOGY_ADDER + SPECIAL_CONDITION_ADDER + PROJECT_CALIBRATION" };
}

export function plowRate(args: { baseRate: number; ductCount: number; additionalConduitRate: number; additionalDepthIncrements?: number; depthAdder?: number; prerip?: boolean; preripAdder?: number; geologyAdder?: number; projectCalibration?: number }) {
  const additionalConduitCount = Math.max(0, args.ductCount - 1);
  const totalRate = args.baseRate + additionalConduitCount * args.additionalConduitRate + (args.additionalDepthIncrements ?? 0) * (args.depthAdder ?? 0) + (args.prerip ? args.preripAdder ?? 0 : 0) + (args.geologyAdder ?? 0) + (args.projectCalibration ?? 0);
  return { totalRate, additionalConduitCount, formula: "BASE_PLOW + ADDITIONAL_CONDUIT_COUNT*ADDER + DEPTH_INCREMENTS*ADDER + PRERIP + GEOLOGY + PROJECT_CALIBRATION" };
}

export type MaterialQuoteStatus = "ACTIVE" | "EXPIRED" | "SUPERSEDED" | "APPROVED_PROJECT_SOURCE" | "REFERENCE_ONLY";
export interface MaterialItem {
  materialId: string; category: string; subcategory: string; manufacturer: string; vendor: string; vendorSku: string;
  description: string; specification: Record<string, string | number>; unit: string; unitPrice: number; currency: string;
  quoteId: string; quoteDate: string; effectiveDate: string; expirationDate: string; quantityBasis: string; quotedQuantity: number;
  sourceDocument: string; sourceHash: string; freightTreatment: string; taxTreatment: string; authorityMode: "VENDOR_QUOTE" | "APPROVED_PROJECT_SOURCE";
  approvedBy?: string; revision: number; status: MaterialQuoteStatus; scope: CommercialArtifactScope;
}

export interface MaterialVendorQuote {
  quoteId: string; vendor: string; quoteNumber: string; quoteDate: string; effectiveDate: string; expirationDate: string;
  validityTerms: string; shippingTreatment: string; taxTreatment: string; sourceDocument: string; sourceHash: string;
  supplierAdjustmentRisk: true; status: MaterialQuoteStatus; revision: number; scope: CommercialArtifactScope; items: MaterialItem[];
}

export class MaterialCatalog {
  readonly #quotes = new Map<string, MaterialVendorQuote>();
  registerQuote(quote: MaterialVendorQuote) {
    if (this.#quotes.has(quote.quoteId)) throw new Error(`Material quote ${quote.quoteId} is immutable; register a new quote revision.`);
    this.#quotes.set(quote.quoteId, clone(quote)); return this;
  }
  quote(quoteId: string) { const quote = this.#quotes.get(quoteId); return quote ? clone(quote) : null; }
  resolve(args: { quoteId: string; category: string; specification: Record<string, string | number>; scope: CommercialArtifactScope; allowReference?: boolean }) {
    const quote = this.#quotes.get(args.quoteId);
    if (!quote) throw new Error(`Material quote ${args.quoteId} does not resolve.`);
    if (!scopeAllows(quote.scope, args.scope)) throw new Error("Cross-tenant Material Catalog resolution is prohibited.");
    if (!["ACTIVE", "APPROVED_PROJECT_SOURCE"].includes(quote.status) && !args.allowReference) throw new Error(`Material quote ${quote.quoteId} is ${quote.status}.`);
    const item = quote.items.find((candidate) => candidate.category === args.category && Object.entries(args.specification).every(([key, value]) => candidate.specification[key] === value));
    if (!item) throw new Error(`No material in quote ${quote.quoteId} matches the requested specification.`);
    return clone(item);
  }
}

export interface EstimateLine {
  estimateLineId: string; category: "LABOR" | "MATERIAL" | "EQUIPMENT" | "PROFESSIONAL_SERVICE" | "OTHER";
  description: string; quantity: number; unit: string; unitCost: number; extendedCost: number;
  authorityMode: string; authorityLayer: CommercialAuthorityLayer; source: string; formula: string; revision: number;
  quantityAuthority: string; rateProfileId?: string; rateId?: string; materialQuoteId?: string; materialId?: string;
  humanOverride?: { baseline: number; humanValue: number; delta: number; financialImpact: number; reason: string; approvedBy: string; revision: number };
  costScheduleImpact: "COST" | "SCHEDULE" | "COST_AND_SCHEDULE" | "NONE"; notes?: string;
  costLedgerId: string; costContributionMode: "PRIMARY" | "COMPONENT" | "REFERENCE_ONLY" | "ROLLUP";
}

export interface ProjectEstimateRevision {
  estimateId: string; revision: number; previousEstimateId?: string; scope: CommercialArtifactScope;
  configurationId: string; rateProfileId: string; materialQuoteId?: string; lines: EstimateLine[];
  baselineCost: number; totalCost: number; createdAt: string; createdBy: string; immutable: true; noCatalogMutation: true;
}

export function addEstimateItem(estimate: ProjectEstimateRevision, input: Omit<EstimateLine, "estimateLineId" | "extendedCost" | "revision" | "costLedgerId" | "costContributionMode">): ProjectEstimateRevision {
  const revision = estimate.revision + 1;
  const line: EstimateLine = { ...clone(input), estimateLineId: `${estimate.estimateId}:ADDED:${revision}:${estimate.lines.length + 1}`, extendedCost: input.quantity * input.unitCost, revision, costLedgerId: `${estimate.estimateId}:LEDGER:ADDED:${revision}:${estimate.lines.length + 1}`, costContributionMode: "PRIMARY", authorityLayer: input.authorityLayer || "HUMAN_CALIBRATION", authorityMode: input.authorityMode || "HUMAN_ASSUMPTION" };
  const lines = [...clone(estimate.lines), line];
  return { ...clone(estimate), estimateId: `${estimate.scope.opportunityId}:ESTIMATE:R${revision}`, previousEstimateId: estimate.estimateId, revision, lines, totalCost: primaryTotal(lines), createdAt: new Date().toISOString(), immutable: true, noCatalogMutation: true };
}

function primaryTotal(lines: EstimateLine[]) { return lines.filter((line) => line.costContributionMode === "PRIMARY").reduce((sum, line) => sum + line.extendedCost, 0); }

export function calibrateEstimate(estimate: ProjectEstimateRevision, args: { estimateLineId: string; humanValue: number; field: "quantity" | "unitCost"; reason: string; approvedBy: string }) {
  if (!args.reason.trim() || !args.approvedBy.trim()) throw new Error("Calibration reason and approver are required.");
  const revision = estimate.revision + 1;
  const lines = estimate.lines.map((original) => {
    if (original.estimateLineId !== args.estimateLineId) return clone(original);
    const baseline = args.field === "quantity" ? original.quantity : original.unitCost;
    const quantity = args.field === "quantity" ? args.humanValue : original.quantity;
    const unitCost = args.field === "unitCost" ? args.humanValue : original.unitCost;
    const extendedCost = quantity * unitCost;
    return { ...clone(original), quantity, unitCost, extendedCost, authorityMode: "HUMAN_APPROVED", authorityLayer: "HUMAN_CALIBRATION" as const, revision, humanOverride: { baseline, humanValue: args.humanValue, delta: args.humanValue - baseline, financialImpact: extendedCost - original.extendedCost, reason: args.reason, approvedBy: args.approvedBy, revision } };
  });
  if (!lines.some((line) => line.humanOverride?.revision === revision)) throw new Error(`Estimate line ${args.estimateLineId} does not resolve.`);
  return { ...clone(estimate), estimateId: `${estimate.scope.opportunityId}:ESTIMATE:R${revision}`, previousEstimateId: estimate.estimateId, revision, lines, totalCost: primaryTotal(lines), createdAt: new Date().toISOString(), immutable: true as const, noCatalogMutation: true as const };
}

export interface CommercialPolicy { policyId: string; revision: number; markupPercent?: number; targetMarginPercent?: number; nrcAdjustment: number; monthlyOm: number; mrcAdjustment: number; termMonths: number; otherTerms: string[]; authorityLayer: "COMMERCIAL_POLICY"; approvedBy: string; }
export function applyCommercialPolicy(estimate: ProjectEstimateRevision, policy: CommercialPolicy) {
  const base = estimate.totalCost;
  const priceBeforeAdjustments = policy.targetMarginPercent !== undefined && policy.targetMarginPercent < 100 ? base / (1 - policy.targetMarginPercent / 100) : base * (1 + (policy.markupPercent ?? 0) / 100);
  const nrc = priceBeforeAdjustments + policy.nrcAdjustment;
  const mrc = policy.monthlyOm + policy.mrcAdjustment;
  return { estimateId: estimate.estimateId, estimateCost: base, policyId: policy.policyId, policyRevision: policy.revision, nrc, mrc, termMonths: policy.termMonths, totalContractValue: nrc + mrc * policy.termMonths, authorityLayer: "COMMERCIAL_POLICY" as const, noProductDoctrineMutation: true };
}

export type CommercialLifecycleStage = "ROUTE_REPOSITORY" | "COMMERCIAL_REVISION" | "COMMERCIAL_RELEASE_PACKAGE" | "DRAFT_IOF_ASSEMBLY" | "DRAFT_IOF_SAVE" | "ENGINEERING";
const COMMERCIAL_LIFECYCLE_ORDER: CommercialLifecycleStage[] = ["ROUTE_REPOSITORY", "COMMERCIAL_REVISION", "COMMERCIAL_RELEASE_PACKAGE", "DRAFT_IOF_ASSEMBLY", "DRAFT_IOF_SAVE", "ENGINEERING"];
export function validateCommercialLifecycle(completed: Partial<Record<CommercialLifecycleStage, string>>) {
  const stages = COMMERCIAL_LIFECYCLE_ORDER.map((stage, index) => {
    const prerequisites = COMMERCIAL_LIFECYCLE_ORDER.slice(0, index);
    const missing = prerequisites.filter((required) => !completed[required]);
    return { stage, status: completed[stage] && !missing.length ? "PASS" as const : completed[stage] ? "INVALID" as const : "PENDING" as const, artifactId: completed[stage], missingPrerequisites: missing };
  });
  return { stages, valid: stages.every((stage) => stage.status !== "INVALID"), draftIofCanAssemble: Boolean(completed.COMMERCIAL_RELEASE_PACKAGE), draftIofCanSave: Boolean(completed.COMMERCIAL_RELEASE_PACKAGE && completed.DRAFT_IOF_ASSEMBLY), noFakePassFlags: true };
}

export const CIP043_GLOBAL_SCOPE: CommercialArtifactScope = { organizationId: "GLOBAL", tenantId: "GLOBAL", customerId: "GLOBAL", opportunityId: "GLOBAL", configurationRevision: 1, sharingMode: "GLOBAL" };

function rate(rateId: string, profileId: string, subcategory: string, description: string, unit: string, value: number, rateType: RateType = "TABLE", conditions?: RateItem["conditions"]): RateItem {
  return { rateId, profileId, category: "LABOR", subcategory, description, unit, rate: value, currency: "USD", rateType, authorityMode: profileId.startsWith("TERALINX") ? "INTERNAL_APPROVED" : "CONTRACTOR_RATE_CARD", source: profileId.startsWith("TERALINX") ? "Approved internal commercial planning profile" : "Supplied underground contractor rate card", sourceDocument: profileId.startsWith("TERALINX") ? "Teralinx Standard Bore Commercial Profile" : "Underground Rate Card", effectiveDate: "2026-01-01", geography: "US", conditions, formula: rateType === "FORMULA" ? "15 + 10 * additional governed 2-inch ream increments" : undefined, approvedBy: profileId.startsWith("TERALINX") ? "Commercial Pricing Authority" : undefined, revision: 1, active: true };
}

export const UNDERGROUND_CONTRACTOR_RATE_PROFILE: RateProfile = {
  profileId: "UNDERGROUND-RATE-CARD-R1", name: "Underground Contractor Rate Card", description: "Source-backed table and additive rates from the supplied underground rate card.", authorityMode: "CONTRACTOR_RATE_CARD", scope: CIP043_GLOBAL_SCOPE, sourceDocument: "Underground Rate Card", revision: 1, active: true,
  items: [
    rate("PLOW-BASE", "UNDERGROUND-RATE-CARD-R1", "PLOW_BASE", "Base plow", "FT", 4.5), rate("PLOW-DEPTH", "UNDERGROUND-RATE-CARD-R1", "PLOW_DEPTH_6_INCH", "Additional depth 6 inches", "FT", 0.67, "ADDER"), rate("PLOW-CONDUIT", "UNDERGROUND-RATE-CARD-R1", "PLOW_ADDITIONAL_CONDUIT", "Additional conduit", "PC/FT", 1.05, "ADDER"), rate("PLOW-PRERIP", "UNDERGROUND-RATE-CARD-R1", "PLOW_PRERIP", "Preripping", "FT", 0.81, "ADDER"),
    rate("TRENCH-36", "UNDERGROUND-RATE-CARD-R1", "OPEN_TRENCH_BASE", "Open trench up to 36 inches", "FT", 15), rate("TRENCH-DEPTH", "UNDERGROUND-RATE-CARD-R1", "OPEN_TRENCH_DEPTH_6_INCH", "Additional trench depth 6 inches", "FT", 0.6, "ADDER"), rate("TRENCH-SOFT", "UNDERGROUND-RATE-CARD-R1", "OPEN_TRENCH_GEOLOGY", "Soft rock adder", "FT", 15, "ADDER", { geology: "COBBLE_SOFT_ROCK" }), rate("TRENCH-HARD", "UNDERGROUND-RATE-CARD-R1", "OPEN_TRENCH_GEOLOGY", "Hard rock adder", "FT", 40, "ADDER", { geology: "HARD_ROCK" }),
    ...[[2.5,13],[3.5,15.25],[4.5,17.5],[7,22],[9,25.75],[11,28.25],[13,34.75]].map(([capacity, value], index) => ({ ...rate(`BORE-TABLE-${index + 1}`, "UNDERGROUND-RATE-CARD-R1", "DIRECTIONAL_BORE_BASE", `Directional drilling table through ${capacity} inch OD`, "FT", value, "TABLE"), capacityMin: index ? [2.5,3.5,4.5,7,9,11,13][index - 1] + 0.01 : 0, capacityMax: capacity })),
    rate("BORE-SOFT", "UNDERGROUND-RATE-CARD-R1", "DIRECTIONAL_BORE_GEOLOGY", "Cobble / soft rock adder", "FT", 9, "ADDER", { geology: "COBBLE_SOFT_ROCK" }), rate("BORE-HARD", "UNDERGROUND-RATE-CARD-R1", "DIRECTIONAL_BORE_GEOLOGY", "Hard rock adder", "FT", 16, "ADDER", { geology: "HARD_ROCK" }),
    rate("PIT-ENTRY", "UNDERGROUND-RATE-CARD-R1", "EXCAVATION", "Entry / exit pit", "PC", 225), rate("PIT-ROCK", "UNDERGROUND-RATE-CARD-R1", "EXCAVATION", "Rock entry / exit pit", "PC", 550, "ADDER"), rate("POTHOLE", "UNDERGROUND-RATE-CARD-R1", "EXCAVATION", "Pothole", "PC", 150), rate("HANDHOLE-INSTALL", "UNDERGROUND-RATE-CARD-R1", "EXCAVATION", "Handhole installation", "PC", 225),
    rate("FIBER-BLOW", "UNDERGROUND-RATE-CARD-R1", "FIBER_INSTALLATION", "Fiber blowing", "FT", 1.85), rate("FIBER-ROD", "UNDERGROUND-RATE-CARD-R1", "FIBER_INSTALLATION", "Rod and rope", "FT", 0.75), rate("FIBER-PULL", "UNDERGROUND-RATE-CARD-R1", "FIBER_INSTALLATION", "Cable pulling", "FT", 0.95),
    rate("SPLICE-SINGLE", "UNDERGROUND-RATE-CARD-R1", "SPLICING", "Single splice", "PC", 18), rate("SPLICE-RIBBON", "UNDERGROUND-RATE-CARD-R1", "SPLICING", "Ribbon splice", "PC", 132), rate("CASE-BUILD", "UNDERGROUND-RATE-CARD-R1", "SPLICING", "Case build", "PC", 225), rate("OTDR", "UNDERGROUND-RATE-CARD-R1", "TESTING", "OTDR test", "PC", 4),
  ],
};

export const TERALINX_STANDARD_BORE_PROFILE: RateProfile = { profileId: "TERALINX-STANDARD-BORE-R1", name: "Teralinx Standard Bore", description: "Formula profile whose capacity price is separate from governed package geometry.", authorityMode: "INTERNAL_APPROVED", scope: CIP043_GLOBAL_SCOPE, sourceDocument: "Teralinx Standard Bore Commercial Profile", revision: 1, active: true, items: [rate("TERALINX-BORE-FORMULA", "TERALINX-STANDARD-BORE-R1", "DIRECTIONAL_BORE_BASE", "Standard 3 x 1.25 duct package with governed ream increments", "FT", 15, "FORMULA"), rate("TERALINX-BORE-SOFT", "TERALINX-STANDARD-BORE-R1", "DIRECTIONAL_BORE_GEOLOGY", "Internal cobble / soft rock adder", "FT", 10, "ADDER", { geology: "COBBLE_SOFT_ROCK" }), rate("TERALINX-BORE-HARD", "TERALINX-STANDARD-BORE-R1", "DIRECTIONAL_BORE_GEOLOGY", "Internal hard rock adder", "FT", 18, "ADDER", { geology: "HARD_ROCK" })] };

export const TERRY_DURIN_QUOTE_223377_00: MaterialVendorQuote = (() => {
  const scope = CIP043_GLOBAL_SCOPE; const quoteId = "QUOTE-223377-00-R1";
  const item = (materialId: string, category: string, description: string, specification: Record<string, string | number>, unit: string, unitPrice: number, quotedQuantity: number, vendorSku: string): MaterialItem => ({ materialId, category, subcategory: category, manufacturer: "Source-defined manufacturer", vendor: "Terry-Durin", vendorSku, description, specification, unit, unitPrice, currency: "USD", quoteId, quoteDate: "2026-01-01", effectiveDate: "2026-01-01", expirationDate: "2026-01-31", quantityBasis: unit, quotedQuantity, sourceDocument: "Terry-Durin Quote 223377-00", sourceHash: "SHA256:QUOTE-223377-00-SOURCE", freightTreatment: "Shipping treatment preserved from source quote", taxTreatment: "Tax treatment preserved from source quote", authorityMode: "VENDOR_QUOTE", revision: 1, status: "REFERENCE_ONLY", scope });
  const items = [
    item("MAT-DUCT-150", "CONDUIT", "1.5-inch duct", { diameterInches: 1.5, material: "HDPE" }, "FT", 0.625, 2577750, "QUOTE-LINE-DUCT-150"),
    item("MAT-FIBER-864", "FIBER", "864F G.657A1 cable", { fiberCount: 864, fiberType: "G.657A1" }, "FT", 7.475, 900000, "QUOTE-LINE-FIBER-864"),
    item("MAT-TRACER", "TRACER_WIRE", "Tracer wire", {}, "FT", 0.08, 900000, "QUOTE-LINE-TRACER"),
    item("MAT-TAPE-ND", "WARNING_TAPE", "Non-detectable warning tape", { detectable: "NO" }, "EA", 151, 150, "QUOTE-LINE-TAPE-ND"),
    item("MAT-TAPE-D", "WARNING_TAPE", "Detectable warning tape", { detectable: "YES" }, "EA", 277.45, 150, "QUOTE-LINE-TAPE-D"),
    item("MAT-MARKER-DOME", "MARKER", "Dome marker", {}, "EA", 19, 1500, "QUOTE-LINE-MARKER"),
    item("MAT-SPLICE-CASE-750", "SPLICE_CASE", "Opticonn 750 splice case", { model: "OPTICONN_750" }, "EA", 525, 34, "QUOTE-LINE-SPLICE-CASE"),
    item("MAT-SPLICE-TRAY", "SPLICE_TRAY", "Splice tray", {}, "EA", 27, 204, "QUOTE-LINE-SPLICE-TRAY"),
    item("MAT-SPLICE-HOLDER", "SPLICE_ACCESSORY", "Double-stack splice holder", {}, "EA", 21, 114, "QUOTE-LINE-SPLICE-HOLDER"),
  ];
  return { quoteId, vendor: "Terry-Durin", quoteNumber: "223377-00", quoteDate: "2026-01-01", effectiveDate: "2026-01-01", expirationDate: "2026-01-31", validityTerms: "Time-limited; subject to supplier and raw-material adjustment.", shippingTreatment: "Preserved from source quote; not assumed included.", taxTreatment: "Preserved from source quote; not assumed included.", sourceDocument: "Terry-Durin Quote 223377-00", sourceHash: "SHA256:QUOTE-223377-00-SOURCE", supplierAdjustmentRisk: true, status: "REFERENCE_ONLY", revision: 1, scope, items };
})();

export function createCip043RateCatalog() { return new RateCatalog().registerProfile(UNDERGROUND_CONTRACTOR_RATE_PROFILE).registerProfile(TERALINX_STANDARD_BORE_PROFILE); }
export function createCip043MaterialCatalog(status: MaterialQuoteStatus = "APPROVED_PROJECT_SOURCE") { const quote = clone(TERRY_DURIN_QUOTE_223377_00); quote.status = status; quote.items = quote.items.map((item) => ({ ...item, status })); return new MaterialCatalog().registerQuote(quote); }

export interface CatalogEstimateInput {
  scope: CommercialArtifactScope;
  configurationId: string;
  ductPackage: DuctPackage;
  fiberCount: number;
  fiberType: string;
  routeFeet: number;
  constructionMethod: ConstructionMethod;
  geology: GeologyCondition;
  geologyFeet?: number;
  rateProfileId: string;
  materialQuoteId?: string;
  ilaMode: "OFF" | "INTERMEDIATE_ONLY" | "BOOKENDED";
  ilaCount?: number;
  ilaUnitCost?: number;
  plowAdditionalDepthIncrements?: number;
  plowDepthAdderPerFoot?: number;
  plowProjectCalibrationPerFoot?: number;
  createdBy: string;
  createdAt?: string;
}

function estimateLine(args: Omit<EstimateLine, "extendedCost" | "revision" | "costLedgerId" | "costContributionMode">): EstimateLine {
  return { ...args, extendedCost: args.quantity * args.unitCost, revision: 1, costLedgerId: `${args.estimateLineId}:LEDGER`, costContributionMode: "PRIMARY" };
}

/** Catalog-backed deterministic baseline. Commercial Policy is applied separately. */
export function buildCatalogProjectEstimate(input: CatalogEstimateInput, rateCatalog = createCip043RateCatalog(), materialCatalog = createCip043MaterialCatalog()): ProjectEstimateRevision {
  const capability = resolveConstructionCapability(input.ductPackage, input.constructionMethod, input.geology);
  const lines: EstimateLine[] = [];
  if (input.constructionMethod === "DIRECTIONAL_BORE") {
    const base = rateCatalog.resolve({ profileId: input.rateProfileId, subcategory: "DIRECTIONAL_BORE_BASE", unit: "FT", capacity: capability.requiredReamClassInches, scope: input.scope });
    let geologyAdder = 0;
    let geologyRate: RateItem | undefined;
    if (input.geology !== "NORMAL") geologyRate = rateCatalog.resolve({ profileId: input.rateProfileId, subcategory: "DIRECTIONAL_BORE_GEOLOGY", unit: "FT", conditions: { geology: input.geology }, scope: input.scope });
    geologyAdder = geologyRate?.rate ?? 0;
    const resolved = input.rateProfileId === TERALINX_STANDARD_BORE_PROFILE.profileId ? teralinxBoreRate(capability, 0) : { baseRate: base.rate, capacityAdder: 0, totalRate: base.rate, formula: "Contractor TABLE rate selected by governed required ream class." };
    lines.push(estimateLine({ estimateLineId: `${input.configurationId}:BORE`, category: "LABOR", description: "Directional bore", quantity: input.routeFeet, unit: "FT", unitCost: resolved.totalRate, authorityMode: base.authorityMode, authorityLayer: "RATE_CATALOG", source: base.sourceDocument, formula: resolved.formula, quantityAuthority: "SOURCE_EVIDENCE / MEASURED_CENTERLINE", rateProfileId: base.profileId, rateId: base.rateId, costScheduleImpact: "COST_AND_SCHEDULE" }));
    if (geologyRate && (input.geologyFeet ?? 0) > 0) lines.push(estimateLine({ estimateLineId: `${input.configurationId}:GEOLOGY`, category: "LABOR", description: `${input.geology.replaceAll("_", " ")} additive bore condition`, quantity: input.geologyFeet ?? 0, unit: "FT", unitCost: geologyAdder, authorityMode: geologyRate.authorityMode, authorityLayer: "RATE_CATALOG", source: geologyRate.sourceDocument, formula: "GEOLOGY_FEET * PROFILE_GEOLOGY_ADDER", quantityAuthority: "PROJECT_CONFIGURATION / SOURCE_EVIDENCE", rateProfileId: geologyRate.profileId, rateId: geologyRate.rateId, costScheduleImpact: "COST_AND_SCHEDULE" }));
  } else if (input.constructionMethod === "PLOW") {
    if (!capability.plowAllowed) throw new Error("Selected duct package is not plow-capable.");
    const base = rateCatalog.resolve({ profileId: input.rateProfileId, subcategory: "PLOW_BASE", unit: "FT", scope: input.scope });
    const conduit = rateCatalog.resolve({ profileId: input.rateProfileId, subcategory: "PLOW_ADDITIONAL_CONDUIT", unit: "PC/FT", scope: input.scope });
    const prerip = capability.preripRequired ? rateCatalog.resolve({ profileId: input.rateProfileId, subcategory: "PLOW_PRERIP", unit: "FT", scope: input.scope }) : undefined;
    const resolved = plowRate({ baseRate: base.rate, ductCount: input.ductPackage.ductCount, additionalConduitRate: conduit.rate, additionalDepthIncrements: input.plowAdditionalDepthIncrements, depthAdder: input.plowDepthAdderPerFoot, prerip: capability.preripRequired, preripAdder: prerip?.rate, projectCalibration: input.plowProjectCalibrationPerFoot });
    lines.push(estimateLine({ estimateLineId: `${input.configurationId}:PLOW`, category: "LABOR", description: "Plow construction", quantity: input.routeFeet, unit: "FT", unitCost: resolved.totalRate, authorityMode: base.authorityMode, authorityLayer: "RATE_CATALOG", source: base.sourceDocument, formula: resolved.formula, quantityAuthority: "SOURCE_EVIDENCE / MEASURED_CENTERLINE", rateProfileId: base.profileId, rateId: base.rateId, costScheduleImpact: "COST_AND_SCHEDULE" }));
  }
  if (input.materialQuoteId && input.ductPackage.ductDiameterInches === 1.5) {
    const duct = materialCatalog.resolve({ quoteId: input.materialQuoteId, category: "CONDUIT", specification: { diameterInches: 1.5, material: input.ductPackage.materialSpec }, scope: input.scope });
    lines.push(estimateLine({ estimateLineId: `${input.configurationId}:DUCT-MATERIAL`, category: "MATERIAL", description: duct.description, quantity: input.routeFeet * input.ductPackage.ductCount, unit: duct.unit, unitCost: duct.unitPrice, authorityMode: duct.authorityMode, authorityLayer: "MATERIAL_CATALOG", source: duct.sourceDocument, formula: "ROUTE_FEET * PROJECT_DUCT_COUNT * APPROVED_QUOTE_UNIT_PRICE", quantityAuthority: "PROJECT_CONFIGURATION / QUANTITY_DERIVATION", materialQuoteId: duct.quoteId, materialId: duct.materialId, costScheduleImpact: "COST" }));
  }
  if (input.materialQuoteId && input.fiberCount === 864) {
    const fiber = materialCatalog.resolve({ quoteId: input.materialQuoteId, category: "FIBER", specification: { fiberCount: 864, fiberType: input.fiberType }, scope: input.scope });
    lines.push(estimateLine({ estimateLineId: `${input.configurationId}:FIBER-MATERIAL`, category: "MATERIAL", description: fiber.description, quantity: input.routeFeet, unit: fiber.unit, unitCost: fiber.unitPrice, authorityMode: fiber.authorityMode, authorityLayer: "MATERIAL_CATALOG", source: fiber.sourceDocument, formula: "DERIVED_FIBER_PLACEMENT_FEET * APPROVED_QUOTE_UNIT_PRICE", quantityAuthority: "PROJECT_CONFIGURATION / QUANTITY_DERIVATION", materialQuoteId: fiber.quoteId, materialId: fiber.materialId, costScheduleImpact: "COST" }));
  }
  const ilaCount = input.ilaMode === "OFF" ? 0 : Math.max(0, input.ilaCount ?? 0);
  lines.push(estimateLine({ estimateLineId: `${input.configurationId}:ILA`, category: "EQUIPMENT", description: "ILA facilities", quantity: ilaCount, unit: "EA", unitCost: input.ilaUnitCost ?? 0, authorityMode: input.ilaMode === "OFF" ? "NOT_APPLICABLE" : "PROJECT_CONFIGURATION", authorityLayer: "PROJECT_CONFIGURATION", source: "CIP-042 ILA planning result", formula: input.ilaMode === "OFF" ? "ILA OFF => 0 facilities * $0" : "PLANNED_ILA_COUNT * AUTHORIZED_FACILITY_COST", quantityAuthority: "PROJECT_CONFIGURATION / OPTICAL PLANNING", costScheduleImpact: "COST_AND_SCHEDULE" }));
  const totalCost = primaryTotal(lines);
  return { estimateId: `${input.scope.opportunityId}:ESTIMATE:R1`, revision: 1, scope: clone(input.scope), configurationId: input.configurationId, rateProfileId: input.rateProfileId, materialQuoteId: input.materialQuoteId, lines, baselineCost: totalCost, totalCost, createdAt: input.createdAt ?? new Date().toISOString(), createdBy: input.createdBy, immutable: true, noCatalogMutation: true };
}
