import type { BudgetAssumptionState } from "./BudgetAssumptionState";
import {
  authorityModeCostIncluded,
  createConstraintValue,
  resolveConstraintValue,
  type ConstraintAuthorityMode,
  type ConstraintValue,
} from "./ConstraintAuthority";
import { ESTIMATOR_DEFAULTS } from "./EstimatorDefaults";
import type { DALCoordinate } from "../types/dal";

export type TransparentEstimateValueStatus =
  | "CALCULATED"
  | "USER_OVERRIDE"
  | "UNKNOWN"
  | "SYNTHESIS_PENDING"
  | "NOT_APPLICABLE";

export type TransparentEstimateSectionId =
  | "EXECUTIVE_SUMMARY"
  | "CORRIDOR"
  | "FIBER"
  | "OSP_CONSTRUCTION"
  | "ILA_FACILITIES"
  | "MATERIALS"
  | "LABOR"
  | "EQUIPMENT"
  | "PERMITS"
  | "MOBILIZATION"
  | "CONTINGENCY"
  | "FINANCIAL_MODEL"
  | "REVENUE"
  | "ASSUMPTIONS"
  | "ESTIMATE_CONFIDENCE"
  | "ESTIMATE_AUDIT";

export type TransparentEstimateLineCategory =
  | "PHYSICAL"
  | "PRODUCTION"
  | "LABOR"
  | "MATERIAL"
  | "EQUIPMENT"
  | "ILA"
  | "PERMIT"
  | "MOBILIZATION"
  | "CONTINGENCY"
  | "FINANCIAL"
  | "UNKNOWN";

export interface TransparentEstimateValue<T = number> {
  value: T | null;
  display: string;
  status: TransparentEstimateValueStatus;
  formula: string;
  source: string;
  workbook?: string;
  editable: boolean;
  userOverride: string | null;
  calculated: boolean;
}

export interface TransparentEstimateLineItem {
  lineItemId: string;
  sectionId: TransparentEstimateSectionId;
  category: TransparentEstimateLineCategory;
  description: string;
  quantity: TransparentEstimateValue<number>;
  production: TransparentEstimateValue<number>;
  requiredProduction: TransparentEstimateValue<number>;
  crewCount: TransparentEstimateValue<number>;
  durationDays: TransparentEstimateValue<number>;
  unitCost: TransparentEstimateValue<number>;
  extendedCost: TransparentEstimateValue<number>;
  source: string;
  workbook?: string;
  formula: string;
  authority: ConstraintValue;
  editableFields: string[];
}

export interface TransparentEstimateMetric {
  metricId: string;
  label: string;
  value: TransparentEstimateValue<number | string>;
}

export interface TransparentEstimateSection {
  sectionId: TransparentEstimateSectionId;
  label: string;
  summary: string;
  total: TransparentEstimateValue<number> | null;
  metrics: TransparentEstimateMetric[];
  lineItems: TransparentEstimateLineItem[];
  collapsedByDefault: true;
}

export interface TransparentUnknownQuantity {
  unknownId: string;
  label: string;
  display: "UNKNOWN";
  status: "Human Review Required" | "Synthesis Pending";
  source: string;
  confidenceImpact: number;
  costImpact: 0;
  costTreatment: "Confidence only; no automatic cost adder";
  authority: ConstraintValue;
}

export interface TransparentIlaFacility {
  facilityId: string;
  location: string;
  gps: string;
  milepost: number;
  facilityType: string;
  power: string;
  generator: string;
  hvac: string;
  racks: number;
  grounding: string;
  civil: string;
  fiberTermination: string;
  equipment: string;
  constructionCost: TransparentEstimateValue<number>;
  materialCost: TransparentEstimateValue<number>;
  laborCost: TransparentEstimateValue<number>;
  total: TransparentEstimateValue<number>;
  workbook: string;
}

export interface TransparentEstimateProductionControls {
  directionalBoreDirtFeetPerDay: number;
  directionalBoreRockFeetPerDay: number;
  openTrenchDirtFeetPerDay: number;
  openTrenchRockFeetPerDay: number;
  plowFeetPerDay: number;
  fiberBlowingFeetPerDay: number | null;
  fiberPullingFeetPerDay: number | null;
  splicingTerminationsPerDay: number | null;
  testingFeetPerDay: number | null;
  restorationFeetPerDay: number | null;
}

export interface TransparentEstimateFinancialControls {
  contingencyPercent: number;
  overheadPercent: number;
  markupPercent: number;
  monthlyOmPerRouteMile: number;
}

export interface TransparentEstimateControls {
  targetDurationDays: number;
  production: TransparentEstimateProductionControls;
  financial: TransparentEstimateFinancialControls;
  constraints?: Record<string, ConstraintValue>;
}

export interface TransparentPhysicalQuantities {
  routeMiles: number;
  routeFeet: number;
  segmentCount: number;
  stationCount: number;
  stationSpacingFeet: number;
  routeFiberFeet: number;
  slackStorageFeet: number;
  fiberWasteFeet: number;
  purchasedFiberFeet: number;
  conduitFeet: number;
  conduitWasteFeet: number;
  fiberCount: number;
  handholeCount: number;
  vaultCount: number;
  spliceCaseCount: number;
  fieldSpliceLocations: number;
  fiberTerminations: number;
  ilaCount: number;
  regenCount: number;
}

export interface TransparentEstimateConfidence {
  score: number;
  level: "HIGH" | "MEDIUM" | "LOW";
  drivers: Array<{
    label: string;
    status: "Known" | "Unknown" | "Synthesis Pending";
    impact: number;
    reason: string;
  }>;
}

export interface TransparentFinancialModel {
  constructionCost: TransparentEstimateValue<number>;
  engineering: TransparentEstimateValue<number>;
  permits: TransparentEstimateValue<number>;
  equipment: TransparentEstimateValue<number>;
  labor: TransparentEstimateValue<number>;
  materials: TransparentEstimateValue<number>;
  contingency: TransparentEstimateValue<number>;
  overhead: TransparentEstimateValue<number>;
  markup: TransparentEstimateValue<number>;
  margin: TransparentEstimateValue<number>;
  sellPrice: TransparentEstimateValue<number>;
  nrc: TransparentEstimateValue<number>;
  mrc: TransparentEstimateValue<number>;
  roi: TransparentEstimateValue<number>;
  irr: TransparentEstimateValue<number>;
  payback: TransparentEstimateValue<number>;
}

export interface TransparentEstimateAuditEntry {
  auditId: string;
  label: string;
  value: string;
  unit: string;
  authorityMode: ConstraintAuthorityMode;
  formula: string;
  source: string;
  workbook?: string;
  confidence: number;
  costImpact: "Included" | "Not included";
  scheduleImpact: "Included" | "Not included";
  approvedBy?: string;
  notes?: string;
  userOverride: string | null;
  calculated: boolean;
}

export interface TransparentCorridorEstimate {
  estimateId: string;
  controls: TransparentEstimateControls;
  physicalQuantities: TransparentPhysicalQuantities;
  sections: TransparentEstimateSection[];
  laborLineItems: TransparentEstimateLineItem[];
  materialLineItems: TransparentEstimateLineItem[];
  equipmentLineItems: TransparentEstimateLineItem[];
  ospLineItems: TransparentEstimateLineItem[];
  ilaFacilities: TransparentIlaFacility[];
  unknownQuantities: TransparentUnknownQuantity[];
  constraintValues: Record<string, ConstraintValue>;
  confidence: TransparentEstimateConfidence;
  financialModel: TransparentFinancialModel;
  auditTrail: TransparentEstimateAuditEntry[];
  totalKnownCost: number;
  sellPrice: number;
  nrc: number;
  mrc: number;
  grossMarginPercent: number;
  noScopeVersionCreation: true;
  noInventoryMutation: true;
}

export const DEFAULT_TRANSPARENT_ESTIMATE_CONTROLS: TransparentEstimateControls = {
  targetDurationDays: 120,
  production: {
    directionalBoreDirtFeetPerDay: 600,
    directionalBoreRockFeetPerDay: 300,
    openTrenchDirtFeetPerDay: 300,
    openTrenchRockFeetPerDay: 150,
    plowFeetPerDay: 5280,
    fiberBlowingFeetPerDay: 5280,
    fiberPullingFeetPerDay: 5280,
    splicingTerminationsPerDay: 1728,
    testingFeetPerDay: null,
    restorationFeetPerDay: null,
  },
  financial: {
    contingencyPercent: ESTIMATOR_DEFAULTS.commercial.defaultContingencyPercent,
    overheadPercent: 0,
    markupPercent: ESTIMATOR_DEFAULTS.commercial.defaultMarkupPoints,
    monthlyOmPerRouteMile: 1200 / 12,
  },
};

const MASTER_OSP_WORKBOOK = "Google Fiber Project - 20251121.xlsx / Master OSP Build Metrics";
const FIBER_SUMMARY_WORKBOOK = "Google Fiber Project - 20251121.xlsx / Fiber Summary";
const ILA_LOCATION_WORKBOOK = "Google Fiber Project - 20251121.xlsx / ILA Locations";
const PER_ILA_COST_WORKBOOK = "Google Fiber Project - 20251121.xlsx / Per ILA Cost";
const DOBSON_ILA_WORKBOOK = "Dobson ILA Cost Summary 27 vs 36 Racks.xlsx / 27 vs 36 ILA Rack Costs";

const WORKBOOK_RATES = {
  plowLaborPerFoot: 5,
  dirtBoreLaborPerFoot: 11,
  openTrenchLaborPerFoot: 38,
  conduitMaterialPerFoot: 0.65,
  futurePathPerFoot: 1.8,
  fiber864MaterialPerFoot: 5,
  fiberBlowLaborPerFoot: 1,
  handholeLaborEach: 315,
  handholeMaterialEach: 900,
  spliceCaseEach: 850,
  splicingLaborPerTermination: 15,
  engineeringPermittingPerFoot: 0.75,
  projectManagerAnnualLoadedCost: 100000,
  contingencyPercent: 7.5,
  annualOmPerRouteMile: 550,
  fiberCount: 864,
  handholeSpacingFeet: 2500,
  regenSpacingMiles: 45,
  stationSpacingFeet: 5000,
};

const ILA_36_RACK_COSTS = [
  { label: "Land acquisition", category: "civil", cost: 55500 },
  { label: "Quality / material testing", category: "civil", cost: 14000 },
  { label: "Permits fees / insurance", category: "permit", cost: 55000 },
  { label: "Site work", category: "civil", cost: 130100 },
  { label: "Foundation", category: "civil", cost: 20000 },
  { label: "Prefabricated building", category: "equipment", cost: 575000 },
  { label: "Electrical", category: "equipment", cost: 253000 },
  { label: "Security / access control", category: "equipment", cost: 7500 },
  { label: "Landscaping", category: "civil", cost: 2500 },
  { label: "Fire suppression system", category: "equipment", cost: 7500 },
  { label: "Finalization", category: "civil", cost: 1500 },
  { label: "Telecom fit-out", category: "equipment", cost: 751000 },
] as const;

function money(value: number) {
  return Math.round(value);
}

function round(value: number, places = 2) {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

function clampPositive(value: number, fallback: number) {
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function cloneControls(controls?: TransparentEstimateControls): TransparentEstimateControls {
  return {
    targetDurationDays: clampPositive(controls?.targetDurationDays ?? DEFAULT_TRANSPARENT_ESTIMATE_CONTROLS.targetDurationDays, DEFAULT_TRANSPARENT_ESTIMATE_CONTROLS.targetDurationDays),
    production: {
      ...DEFAULT_TRANSPARENT_ESTIMATE_CONTROLS.production,
      ...(controls?.production ?? {}),
    },
    financial: {
      ...DEFAULT_TRANSPARENT_ESTIMATE_CONTROLS.financial,
      ...(controls?.financial ?? {}),
    },
    constraints: { ...(controls?.constraints ?? {}) },
  };
}

function constraint<T = number | string | boolean>(args: Parameters<typeof createConstraintValue<T>>[0]) {
  return createConstraintValue<T>(args);
}

function buildConstraintValues(assumptionState: BudgetAssumptionState, controls: TransparentEstimateControls): Record<string, ConstraintValue> {
  const base: ConstraintValue[] = [
    constraint<number>({
      key: "civil.plowPercent",
      label: "Plow %",
      value: assumptionState.civilMix.plowPercent,
      unit: "%",
      authorityMode: "ALGORITHM",
      source: "Selected commercial construction strategy",
      sourceDetail: "Algorithmic civil mix from active BudgetAssumptionState.",
      affectsCost: true,
      affectsSchedule: true,
      affectsConfidence: true,
    }),
    constraint<number>({
      key: "civil.directionalBoreDirtPercent",
      label: "Directional bore dirt %",
      value: assumptionState.civilMix.hddPercent,
      unit: "%",
      authorityMode: "ALGORITHM",
      source: "Selected commercial construction strategy",
      sourceDetail: "Algorithmic civil mix from active BudgetAssumptionState.",
      affectsCost: true,
      affectsSchedule: true,
      affectsConfidence: true,
    }),
    constraint<number>({
      key: "civil.directionalBoreRockPercent",
      label: "Directional bore rock %",
      value: null,
      unit: "%",
      authorityMode: "UNKNOWN",
      source: "Geotechnical review required",
      sourceDetail: "Rock percentage is not guessed into cost.",
      affectsCost: true,
      affectsSchedule: true,
      affectsConfidence: true,
    }),
    constraint<number>({
      key: "civil.openTrenchPercent",
      label: "Open trench %",
      value: assumptionState.civilMix.openCutPercent,
      unit: "%",
      authorityMode: "ALGORITHM",
      source: "Selected commercial construction strategy",
      sourceDetail: "Open trench remains near zero unless algorithm or human sets it.",
      affectsCost: true,
      affectsSchedule: true,
      affectsConfidence: true,
    }),
    constraint<number>({
      key: "civil.rockAdderPerFoot",
      label: "Rock adder",
      value: 30,
      unit: "$/ft",
      authorityMode: "ALGORITHM",
      source: "Estimator default",
      sourceDetail: "Explicit rock adder default from Phase 4C.",
      affectsCost: true,
      affectsSchedule: false,
      affectsConfidence: true,
    }),
    constraint<number>({
      key: "production.directionalBoreDirtFeetPerDay",
      label: "Directional bore dirt production",
      value: controls.production.directionalBoreDirtFeetPerDay,
      unit: "ft/day",
      authorityMode: "ALGORITHM",
      source: "Production Engine default",
      affectsCost: false,
      affectsSchedule: true,
      affectsConfidence: true,
    }),
    constraint<number>({
      key: "production.directionalBoreRockFeetPerDay",
      label: "Directional bore rock production",
      value: controls.production.directionalBoreRockFeetPerDay,
      unit: "ft/day",
      authorityMode: "ALGORITHM",
      source: "Production Engine default",
      affectsCost: false,
      affectsSchedule: true,
      affectsConfidence: true,
    }),
    constraint<number>({
      key: "production.plowFeetPerDay",
      label: "Plow production",
      value: controls.production.plowFeetPerDay,
      unit: "ft/day",
      authorityMode: "ALGORITHM",
      source: "Production Engine default",
      affectsCost: false,
      affectsSchedule: true,
      affectsConfidence: true,
    }),
    constraint<number>({
      key: "production.openTrenchDirtFeetPerDay",
      label: "Open trench dirt production",
      value: controls.production.openTrenchDirtFeetPerDay,
      unit: "ft/day",
      authorityMode: "ALGORITHM",
      source: "Production Engine default",
      affectsCost: false,
      affectsSchedule: true,
      affectsConfidence: true,
    }),
    constraint<number>({
      key: "production.openTrenchRockFeetPerDay",
      label: "Open trench rock production",
      value: controls.production.openTrenchRockFeetPerDay,
      unit: "ft/day",
      authorityMode: "ALGORITHM",
      source: "Production Engine default",
      affectsCost: false,
      affectsSchedule: true,
      affectsConfidence: true,
    }),
    constraint<number>({
      key: "production.fiberBlowingFeetPerDay",
      label: "Fiber blowing production",
      value: controls.production.fiberBlowingFeetPerDay,
      unit: "ft/day",
      authorityMode: "ALGORITHM",
      source: "Production Engine default",
      sourceDetail: "1 mile/day.",
      affectsCost: false,
      affectsSchedule: true,
      affectsConfidence: true,
    }),
    constraint<number>({
      key: "production.fiberPullingFeetPerDay",
      label: "Fiber pulling production",
      value: controls.production.fiberPullingFeetPerDay,
      unit: "ft/day",
      authorityMode: "ALGORITHM",
      source: "Production Engine default",
      sourceDetail: "1 mile/day.",
      affectsCost: false,
      affectsSchedule: true,
      affectsConfidence: true,
    }),
    constraint<number>({
      key: "production.splicingTerminationsPerDay",
      label: "Butt splice production",
      value: controls.production.splicingTerminationsPerDay,
      unit: "terminations/day",
      authorityMode: "ALGORITHM",
      source: "Production Engine default",
      sourceDetail: "One 864-count closure per day per crew.",
      affectsCost: false,
      affectsSchedule: true,
      affectsConfidence: true,
    }),
    constraint<string>({
      key: "production.testing",
      label: "Testing",
      value: "Included with splicing unless overridden",
      authorityMode: "ALGORITHM",
      source: "Production Engine default",
      affectsCost: false,
      affectsSchedule: true,
      affectsConfidence: true,
    }),
    constraint<string>({
      key: "production.restoration",
      label: "Restoration",
      value: "Included with drilling/plowing schedule allowance unless overridden",
      authorityMode: "ALGORITHM",
      source: "Production Engine default",
      affectsCost: false,
      affectsSchedule: true,
      affectsConfidence: true,
    }),
    constraint<string>({
      key: "production.hydrovac",
      label: "Hydrovac",
      value: "Included in OSP construction; not additive unless human overrides",
      authorityMode: "ALGORITHM",
      source: "Production Engine default",
      affectsCost: false,
      affectsSchedule: true,
      affectsConfidence: true,
    }),
    constraint<number>({
      key: "financial.omCostPerRouteMile",
      label: "O&M cost",
      value: controls.financial.monthlyOmPerRouteMile * 12,
      unit: "$/route mile/year",
      authorityMode: "ALGORITHM",
      source: "Financial Engine default",
      sourceDetail: "$1,200 / route mile annual default.",
      affectsCost: true,
      affectsSchedule: false,
      affectsConfidence: true,
    }),
    constraint<number>({
      key: "crossing.rail",
      label: "Rail crossings",
      value: null,
      unit: "count",
      authorityMode: "UNKNOWN",
      source: "Human/API/synthesis crossing review required",
      affectsCost: false,
      affectsSchedule: true,
      affectsConfidence: true,
    }),
    constraint<number>({
      key: "crossing.water",
      label: "Water crossings",
      value: null,
      unit: "count",
      authorityMode: "UNKNOWN",
      source: "Human/API/synthesis crossing review required",
      affectsCost: false,
      affectsSchedule: true,
      affectsConfidence: true,
    }),
    constraint<number>({
      key: "crossing.dot",
      label: "DOT crossings",
      value: null,
      unit: "count",
      authorityMode: "UNKNOWN",
      source: "Human/API/synthesis crossing review required",
      affectsCost: false,
      affectsSchedule: true,
      affectsConfidence: true,
    }),
    constraint<number>({
      key: "utility.conflicts",
      label: "Utility conflicts",
      value: null,
      unit: "count",
      authorityMode: "UNKNOWN",
      source: "Utility conflict review required",
      affectsCost: true,
      affectsSchedule: true,
      affectsConfidence: true,
    }),
    constraint<number>({
      key: "environmental.impacts",
      label: "Environmental impacts",
      value: null,
      unit: "count",
      authorityMode: "UNKNOWN",
      source: "Environmental constraint synthesis pending",
      affectsCost: true,
      affectsSchedule: true,
      affectsConfidence: true,
    }),
    constraint<number>({
      key: "bridge.attachments",
      label: "Bridge attachments",
      value: null,
      unit: "count",
      authorityMode: "UNKNOWN",
      source: "Bridge attachment review required",
      affectsCost: true,
      affectsSchedule: true,
      affectsConfidence: true,
    }),
    constraint<number>({
      key: "permit.jurisdictionFees",
      label: "Permit jurisdiction fees",
      value: null,
      unit: "USD",
      authorityMode: "UNKNOWN",
      source: "Permit jurisdiction review required",
      affectsCost: true,
      affectsSchedule: true,
      affectsConfidence: true,
    }),
    constraint<string>({
      key: "ila.assumptions",
      label: "ILA assumptions",
      value: "36-rack Hyperlinx-managed ILA workbook profile",
      authorityMode: "ALGORITHM",
      source: PER_ILA_COST_WORKBOOK,
      affectsCost: true,
      affectsSchedule: true,
      affectsConfidence: true,
    }),
    constraint<string>({
      key: "bom.assumptions",
      label: "BOM assumptions",
      value: "Google Fiber workbook OSP material rates",
      authorityMode: "ALGORITHM",
      source: MASTER_OSP_WORKBOOK,
      affectsCost: true,
      affectsSchedule: false,
      affectsConfidence: true,
    }),
    constraint<string>({
      key: "labor.assumptions",
      label: "Labor assumptions",
      value: "Production-based labor from workbook rates and crew optimization",
      authorityMode: "ALGORITHM",
      source: MASTER_OSP_WORKBOOK,
      affectsCost: true,
      affectsSchedule: true,
      affectsConfidence: true,
    }),
    constraint<string>({
      key: "financial.assumptions",
      label: "Financial assumptions",
      value: "Contingency, overhead, markup, NRC, MRC",
      authorityMode: "ALGORITHM",
      source: "Financial Engine",
      affectsCost: true,
      affectsSchedule: false,
      affectsConfidence: true,
    }),
  ];
  return Object.fromEntries(base.map((item) => [
    item.key,
    resolveConstraintValue(item, controls.constraints?.[item.key] ?? null),
  ]));
}

function constraintNumber(values: Record<string, ConstraintValue>, key: string, fallback: number) {
  const value = values[key];
  if (!value) return fallback;
  if (typeof value.value !== "number") return value.affectsCost ? 0 : fallback;
  if (value.affectsCost) return authorityModeCostIncluded(value) ? value.value : 0;
  return value.authorityMode !== "UNKNOWN" && value.authorityMode !== "SYNTHESIS" ? value.value : fallback;
}

function constraintProduction(values: Record<string, ConstraintValue>, key: string, fallback: number | null) {
  const value = values[key];
  if (!value) return fallback;
  if (value.authorityMode === "UNKNOWN" || value.authorityMode === "SYNTHESIS") return null;
  if (typeof value.value !== "number") return fallback;
  return value.value;
}

function authorityFor(values: Record<string, ConstraintValue>, key: string): ConstraintValue {
  return values[key] ?? createConstraintValue<number | string | boolean>({
    key,
    label: key,
    value: null,
    authorityMode: "UNKNOWN",
    source: "Authority value missing",
    affectsConfidence: true,
  });
}

function confidenceImpactForAuthority(authority: ConstraintValue, unknownImpact: number) {
  if (!authority.affectsConfidence) return 0;
  if (authority.authorityMode === "APPROVED") return 0;
  if (authority.authorityMode === "HUMAN" || authority.authorityMode === "API") return Math.max(1, Math.round(unknownImpact * 0.25));
  if (authority.authorityMode === "ALGORITHM" || authority.authorityMode === "SYNTHESIS") return Math.max(2, Math.round(unknownImpact * 0.5));
  return unknownImpact;
}

function confidenceStatusForAuthority(authority: ConstraintValue, fallback: "Human Review Required" | "Synthesis Pending") {
  if (authority.authorityMode === "UNKNOWN") return fallback === "Synthesis Pending" ? "Synthesis Pending" as const : "Unknown" as const;
  if (authority.authorityMode === "ALGORITHM" || authority.authorityMode === "SYNTHESIS") return "Synthesis Pending" as const;
  return "Known" as const;
}

function numericValue(args: {
  value: number;
  formula: string;
  source: string;
  workbook?: string;
  editable?: boolean;
  userOverride?: string | null;
  status?: TransparentEstimateValueStatus;
  suffix?: string;
}): TransparentEstimateValue<number> {
  const rounded = round(args.value, Number.isInteger(args.value) ? 0 : 2);
  return {
    value: rounded,
    display: `${rounded.toLocaleString()}${args.suffix ?? ""}`,
    status: args.status ?? (args.userOverride ? "USER_OVERRIDE" : "CALCULATED"),
    formula: args.formula,
    source: args.source,
    workbook: args.workbook,
    editable: Boolean(args.editable),
    userOverride: args.userOverride ?? null,
    calculated: true,
  };
}

function currencyValue(args: {
  value: number;
  formula: string;
  source: string;
  workbook?: string;
  editable?: boolean;
  userOverride?: string | null;
  status?: TransparentEstimateValueStatus;
}): TransparentEstimateValue<number> {
  const rounded = money(args.value);
  return {
    value: rounded,
    display: `$${rounded.toLocaleString()}`,
    status: args.status ?? (args.userOverride ? "USER_OVERRIDE" : "CALCULATED"),
    formula: args.formula,
    source: args.source,
    workbook: args.workbook,
    editable: Boolean(args.editable),
    userOverride: args.userOverride ?? null,
    calculated: true,
  };
}

function textMetricValue(args: {
  value: string;
  formula: string;
  source: string;
  workbook?: string;
  status?: TransparentEstimateValueStatus;
}): TransparentEstimateValue<string> {
  return {
    value: args.value,
    display: args.value,
    status: args.status ?? "CALCULATED",
    formula: args.formula,
    source: args.source,
    workbook: args.workbook,
    editable: false,
    userOverride: null,
    calculated: args.status !== "UNKNOWN" && args.status !== "SYNTHESIS_PENDING",
  };
}

function pendingValue(status: "UNKNOWN" | "SYNTHESIS_PENDING" | "NOT_APPLICABLE", source: string, formula: string): TransparentEstimateValue<number> {
  return {
    value: null,
    display: status === "UNKNOWN" ? "UNKNOWN" : status.replaceAll("_", " "),
    status,
    formula,
    source,
    editable: status === "SYNTHESIS_PENDING",
    userOverride: null,
    calculated: false,
  };
}

function sumKnown(items: Array<{ extendedCost: TransparentEstimateValue<number> }>) {
  return items.reduce((total, item) => total + (item.extendedCost.value ?? 0), 0);
}

function totalLine(
  sectionId: TransparentEstimateSectionId,
  category: TransparentEstimateLineCategory,
  id: string,
  label: string,
  total: number,
  source: string,
  formula: string,
  authority?: ConstraintValue,
): TransparentEstimateLineItem {
  const lineAuthority = authority ?? createConstraintValue({
    key: id,
    label,
    value: total,
    unit: "USD",
    authorityMode: "ALGORITHM",
    source,
    affectsCost: total > 0,
    affectsSchedule: false,
    affectsConfidence: true,
  });
  return {
    lineItemId: id,
    sectionId,
    category,
    description: label,
    quantity: numericValue({ value: 1, formula: "One explicit total line.", source }),
    production: pendingValue("NOT_APPLICABLE", source, "No production applies to this total."),
    requiredProduction: pendingValue("NOT_APPLICABLE", source, "No production applies to this total."),
    crewCount: pendingValue("NOT_APPLICABLE", source, "No crew count applies to this total."),
    durationDays: pendingValue("NOT_APPLICABLE", source, "No duration applies to this total."),
    unitCost: currencyValue({ value: total, formula, source }),
    extendedCost: currencyValue({ value: total, formula, source }),
    source,
    formula,
    authority: lineAuthority,
    editableFields: [],
  };
}

function laborLine(args: {
  lineItemId: string;
  description: string;
  quantity: number;
  unitCost: number;
  productionFeetPerDay: number | null;
  targetDurationDays: number;
  source: string;
  workbook?: string;
  quantityFormula: string;
  unitCostFormula: string;
  productionFormula: string;
  costFormula?: string;
  authority?: ConstraintValue;
}): TransparentEstimateLineItem {
  const quantity = Math.max(0, args.quantity);
  const production = args.productionFeetPerDay && args.productionFeetPerDay > 0 ? args.productionFeetPerDay : null;
  const requiredProduction = args.targetDurationDays > 0 ? quantity / args.targetDurationDays : 0;
  const singleCrewDuration = production ? quantity / production : null;
  const crewCount = production && args.targetDurationDays > 0 ? Math.max(1, Math.ceil((singleCrewDuration ?? 0) / args.targetDurationDays)) : null;
  const billableCrewDays = production
    ? Math.max(singleCrewDuration ?? 0, (crewCount ?? 1) * Math.min(args.targetDurationDays, singleCrewDuration ?? args.targetDurationDays))
    : 0;
  const crewDayRate = production ? args.unitCost * production : 0;
  const extended = production ? billableCrewDays * crewDayRate : quantity * args.unitCost;
  const lineAuthority = args.authority ?? createConstraintValue({
    key: args.lineItemId,
    label: args.description,
    value: quantity,
    authorityMode: "ALGORITHM",
    source: args.source,
    affectsCost: true,
    affectsSchedule: Boolean(production),
    affectsConfidence: true,
  });
  return {
    lineItemId: args.lineItemId,
    sectionId: "LABOR",
    category: "LABOR",
    description: args.description,
    quantity: numericValue({ value: quantity, formula: args.quantityFormula, source: "Corridor geometry and selected construction strategy." }),
    production: production
      ? numericValue({ value: production, formula: args.productionFormula, source: args.source, editable: true, suffix: " ft/day" })
      : pendingValue("SYNTHESIS_PENDING", args.source, args.productionFormula),
    requiredProduction: numericValue({
      value: requiredProduction,
      formula: "Quantity / customer target duration days.",
      source: "Customer duration control.",
      editable: true,
      suffix: " ft/day",
    }),
    crewCount: crewCount
      ? numericValue({
          value: crewCount,
          formula: "ceil(single-crew duration / target duration).",
          source: "Crew Optimization",
          editable: true,
        })
      : pendingValue("SYNTHESIS_PENDING", "Crew Optimization", "Production must be known before crew count can be calculated."),
    durationDays: singleCrewDuration
      ? numericValue({
          value: singleCrewDuration,
          formula: "Quantity / production per crew-day.",
          source: "Duration Engine",
          suffix: " days",
        })
      : pendingValue("SYNTHESIS_PENDING", "Duration Engine", "Production must be known before duration can be calculated."),
    unitCost: currencyValue({ value: args.unitCost, formula: args.unitCostFormula, source: args.source, workbook: args.workbook }),
    extendedCost: currencyValue({
      value: extended,
      formula: args.costFormula ?? "If production is known: max(single-crew days, crew count x constrained target days) x unit cost x production. Otherwise: quantity x workbook unit cost.",
      source: args.source,
      workbook: args.workbook,
    }),
    source: args.source,
    workbook: args.workbook,
    formula: args.costFormula ?? "Quantity, production, crew count, and workbook rate create the labor value.",
    authority: lineAuthority,
    editableFields: ["production", "targetDurationDays", "crewCount"],
  };
}

function materialLine(args: {
  lineItemId: string;
  description: string;
  quantity: number;
  unit: string;
  unitCost: number;
  source: string;
  workbook?: string;
  formula: string;
  authority?: ConstraintValue;
}): TransparentEstimateLineItem {
  const lineAuthority = args.authority ?? createConstraintValue({
    key: args.lineItemId,
    label: args.description,
    value: args.quantity,
    authorityMode: "ALGORITHM",
    source: args.source,
    sourceDetail: args.workbook,
    affectsCost: true,
    affectsSchedule: false,
    affectsConfidence: true,
  });
  return {
    lineItemId: args.lineItemId,
    sectionId: "MATERIALS",
    category: "MATERIAL",
    description: args.description,
    quantity: numericValue({ value: args.quantity, formula: args.formula, source: "Physical quantity engine.", suffix: ` ${args.unit}` }),
    production: pendingValue("NOT_APPLICABLE", "Material Engine", "Material quantities do not use crew production."),
    requiredProduction: pendingValue("NOT_APPLICABLE", "Material Engine", "Material quantities do not use customer duration."),
    crewCount: pendingValue("NOT_APPLICABLE", "Material Engine", "Material quantities do not use crew counts."),
    durationDays: pendingValue("NOT_APPLICABLE", "Material Engine", "Material quantities do not use production duration."),
    unitCost: currencyValue({ value: args.unitCost, formula: "Workbook unit rate.", source: args.source, workbook: args.workbook }),
    extendedCost: currencyValue({ value: args.quantity * args.unitCost, formula: "Quantity x unit cost.", source: args.source, workbook: args.workbook }),
    source: args.source,
    workbook: args.workbook,
    formula: "Quantity x workbook unit cost.",
    authority: lineAuthority,
    editableFields: ["quantityAssumption", "unitCost"],
  };
}

function unknownLine(sectionId: TransparentEstimateSectionId, id: string, description: string, source: string, authority?: ConstraintValue): TransparentEstimateLineItem {
  const lineAuthority: ConstraintValue = authority ?? createConstraintValue<number | string | boolean>({
    key: id,
    label: description,
    value: null,
    authorityMode: "UNKNOWN",
    source,
    affectsCost: true,
    affectsSchedule: true,
    affectsConfidence: true,
  });
  return {
    lineItemId: id,
    sectionId,
    category: "UNKNOWN",
    description,
    quantity: pendingValue("UNKNOWN", source, "Quantity cannot be derived from corridor geometry alone."),
    production: pendingValue("UNKNOWN", source, "Production cannot be calculated before the quantity is known."),
    requiredProduction: pendingValue("UNKNOWN", source, "Required production cannot be calculated before the quantity is known."),
    crewCount: pendingValue("UNKNOWN", source, "Crew count cannot be calculated before quantity and production are known."),
    durationDays: pendingValue("UNKNOWN", source, "Duration cannot be calculated before quantity and production are known."),
    unitCost: pendingValue("UNKNOWN", source, "No unit cost applied while quantity is unknown."),
    extendedCost: currencyValue({
      value: 0,
      formula: "Unknown constraints reduce confidence only; no automatic cost adder is applied.",
      source,
      status: "CALCULATED",
    }),
    source,
    formula: "Unknown quantity; cost impact is intentionally zero until reviewed.",
    authority: lineAuthority,
    editableFields: ["humanReviewQuantity"],
  };
}

function geometryPointAt(geometry: DALCoordinate[], ratio: number): DALCoordinate {
  if (!geometry.length) return [0, 0];
  const index = Math.max(0, Math.min(geometry.length - 1, Math.round((geometry.length - 1) * ratio)));
  return geometry[index];
}

function buildIlaFacilities(args: {
  estimateId: string;
  geometry: DALCoordinate[];
  routeMiles: number;
  regenCount: number;
  aLabel: string;
  zLabel: string;
}): TransparentIlaFacility[] {
  const siteCost = ILA_36_RACK_COSTS.reduce((total, item) => total + item.cost, 0);
  const facilityCount = args.regenCount + 2;
  return Array.from({ length: facilityCount }, (_, index) => {
    const ratio = facilityCount === 1 ? 0 : index / (facilityCount - 1);
    const coordinate = geometryPointAt(args.geometry, ratio);
    const isA = index === 0;
    const isZ = index === facilityCount - 1;
    const label = isA ? `${args.aLabel} bookend ILA` : isZ ? `${args.zLabel} bookend ILA` : `Intermediate ILA ${index}`;
    const milepost = round(args.routeMiles * ratio, 2);
    return {
      facilityId: `${args.estimateId}-ILA-${String(index + 1).padStart(2, "0")}`,
      location: label,
      gps: `${coordinate[1]?.toFixed(6) ?? "0.000000"}, ${coordinate[0]?.toFixed(6) ?? "0.000000"}`,
      milepost,
      facilityType: "Hyperlinx-managed 36-rack double-wide ILA",
      power: "Electrical service and generator included in workbook profile",
      generator: "300KW generator from ILA cost structure",
      hvac: "Wall-pack HVAC included in ILA cost structure",
      racks: 36,
      grounding: "Included in telecom fit-out profile",
      civil: "Land, site work, foundation, building, fencing, finalization",
      fiberTermination: "Telecom fit-out includes racks, fiber guide, FDU, splice enclosure, labor",
      equipment: "Power, generator, ATS, HVAC, security, fire suppression, telecom fit-out",
      constructionCost: currencyValue({
        value: siteCost,
        formula: "Sum of 36-rack ILA cost categories from workbook structure.",
        source: "ILA Detail",
        workbook: PER_ILA_COST_WORKBOOK,
      }),
      materialCost: pendingValue("UNKNOWN", "ILA workbook does not split every category into material-only cost.", "Human estimator must split workbook total into material buckets before material-only reporting."),
      laborCost: pendingValue("UNKNOWN", "ILA workbook does not split every category into labor-only cost.", "Human estimator must split workbook total into labor buckets before labor-only reporting."),
      total: currencyValue({
        value: siteCost,
        formula: "Land + testing + permits + site work + foundation + building + electrical + telecom fit-out.",
        source: "ILA Detail",
        workbook: DOBSON_ILA_WORKBOOK,
      }),
      workbook: `${PER_ILA_COST_WORKBOOK}; ${DOBSON_ILA_WORKBOOK}; ${ILA_LOCATION_WORKBOOK}`,
    };
  });
}

function confidenceLevel(score: number): TransparentEstimateConfidence["level"] {
  if (score >= 80) return "HIGH";
  if (score >= 60) return "MEDIUM";
  return "LOW";
}

function buildSection(
  sectionId: TransparentEstimateSectionId,
  label: string,
  summary: string,
  lineItems: TransparentEstimateLineItem[],
  metrics: TransparentEstimateMetric[] = [],
): TransparentEstimateSection {
  const total = lineItems.length
    ? currencyValue({
        value: sumKnown(lineItems),
        formula: "Sum of known line-item extended costs in this section.",
        source: label,
      })
    : null;
  return {
    sectionId,
    label,
    summary,
    total,
    metrics,
    lineItems,
    collapsedByDefault: true,
  };
}

function auditEntries(
  sections: TransparentEstimateSection[],
  financialModel: TransparentFinancialModel,
  unknowns: TransparentUnknownQuantity[],
  financialAuthority: ConstraintValue,
  omAuthority: ConstraintValue,
): TransparentEstimateAuditEntry[] {
  const lineAudits = sections.flatMap((section) => section.lineItems.map((line) => ({
    auditId: line.lineItemId,
    label: `${section.label} / ${line.description}`,
    value: line.extendedCost.display,
    unit: line.quantity.display,
    authorityMode: line.authority.authorityMode,
    formula: line.extendedCost.formula,
    source: line.source,
    workbook: line.workbook,
    confidence: line.authority.confidence,
    costImpact: authorityModeCostIncluded(line.authority) && (line.extendedCost.value ?? 0) > 0 ? "Included" as const : "Not included" as const,
    scheduleImpact: line.authority.affectsSchedule ? "Included" as const : "Not included" as const,
    approvedBy: line.authority.approvedBy,
    notes: line.authority.notes,
    userOverride: line.extendedCost.userOverride,
    calculated: line.extendedCost.calculated,
  })));
  const totalAudits = [
    ["AUDIT-CONSTRUCTION-COST", "Construction Cost", financialModel.constructionCost],
    ["AUDIT-CONTINGENCY", "Contingency", financialModel.contingency],
    ["AUDIT-OVERHEAD", "Overhead", financialModel.overhead],
    ["AUDIT-MARKUP", "Markup", financialModel.markup],
    ["AUDIT-SELL-PRICE", "Sell Price", financialModel.sellPrice],
    ["AUDIT-NRC", "NRC", financialModel.nrc],
    ["AUDIT-MRC", "MRC", financialModel.mrc],
  ].map(([auditId, label, value]) => {
    const estimateValue = value as TransparentEstimateValue<number>;
    const totalAuthority = label === "MRC" ? omAuthority : financialAuthority;
    return {
      auditId: auditId as string,
      label: label as string,
      value: estimateValue.display,
      unit: "USD",
      authorityMode: totalAuthority.authorityMode,
      formula: estimateValue.formula,
      source: estimateValue.source,
      workbook: estimateValue.workbook,
      confidence: totalAuthority.confidence,
      costImpact: authorityModeCostIncluded(totalAuthority) && estimateValue.value ? "Included" as const : "Not included" as const,
      scheduleImpact: totalAuthority.affectsSchedule ? "Included" as const : "Not included" as const,
      approvedBy: totalAuthority.approvedBy,
      notes: totalAuthority.notes,
      userOverride: estimateValue.userOverride,
      calculated: estimateValue.calculated,
    };
  });
  const unknownAudits = unknowns.map((unknown) => ({
    auditId: `AUDIT-${unknown.unknownId}`,
    label: unknown.label,
    value: unknown.display,
    unit: "count",
    authorityMode: unknown.authority.authorityMode,
    formula: unknown.costTreatment,
    source: unknown.source,
    confidence: unknown.authority.confidence,
    costImpact: "Not included" as const,
    scheduleImpact: unknown.authority.affectsSchedule ? "Included" as const : "Not included" as const,
    approvedBy: unknown.authority.approvedBy,
    notes: unknown.authority.notes,
    userOverride: null,
    calculated: false,
  }));
  return [...totalAudits, ...lineAudits, ...unknownAudits];
}

export function buildTransparentCorridorEstimate(args: {
  estimateId: string;
  aLabel: string;
  zLabel: string;
  geometry: DALCoordinate[];
  routeMiles: number;
  routeFeet: number;
  segmentCount: number;
  assumptionState: BudgetAssumptionState;
  controls?: TransparentEstimateControls;
}): TransparentCorridorEstimate {
  const controls = cloneControls(args.controls);
  const constraintValues = buildConstraintValues(args.assumptionState, controls);
  const routeFeet = Math.round(args.routeFeet);
  const routeMiles = round(args.routeMiles, 2);
  const plowPercent = constraintNumber(constraintValues, "civil.plowPercent", args.assumptionState.civilMix.plowPercent);
  const borePercent = constraintNumber(constraintValues, "civil.directionalBoreDirtPercent", args.assumptionState.civilMix.hddPercent);
  const openTrenchPercent = constraintNumber(constraintValues, "civil.openTrenchPercent", args.assumptionState.civilMix.openCutPercent);
  const plowFeet = Math.round(routeFeet * (plowPercent / 100));
  const boreFeet = Math.round(routeFeet * (borePercent / 100));
  const openTrenchFeet = Math.round(routeFeet * (openTrenchPercent / 100));
  const rockPercentAuthority = authorityFor(constraintValues, "civil.directionalBoreRockPercent");
  const rockAdderAuthority = authorityFor(constraintValues, "civil.rockAdderPerFoot");
  const rockPercent = authorityModeCostIncluded(rockPercentAuthority) && typeof rockPercentAuthority.value === "number" ? rockPercentAuthority.value : 0;
  const rockAdderPerFoot = authorityModeCostIncluded(rockAdderAuthority) && typeof rockAdderAuthority.value === "number" ? rockAdderAuthority.value : 30;
  const rockBoreFeet = Math.round(boreFeet * (rockPercent / 100));
  const stationCount = Math.max(2, Math.ceil(routeFeet / WORKBOOK_RATES.stationSpacingFeet) + 1);
  const vaultCount = Math.max(2, Math.ceil(routeMiles / 8));
  const handholeCount = Math.max(4, Math.ceil(routeFeet / WORKBOOK_RATES.handholeSpacingFeet));
  const regenCount = Math.max(0, Math.ceil(routeMiles / WORKBOOK_RATES.regenSpacingMiles) - 1);
  const ilaCount = regenCount + 2;
  const routeFiberFeet = routeFeet;
  const slackStorageFeet = vaultCount * args.assumptionState.slack.vaultSlackFeet + handholeCount * args.assumptionState.slack.handholeSlackFeet;
  const fiberBeforeWaste = routeFiberFeet + slackStorageFeet;
  const fiberWasteFeet = Math.round(fiberBeforeWaste * (args.assumptionState.waste.fiberWastePercent / 100));
  const purchasedFiberFeet = fiberBeforeWaste + fiberWasteFeet;
  const conduitBaseFeet = routeFeet * args.assumptionState.materials.standardDuctPackageConduitCount;
  const conduitWasteFeet = Math.round(conduitBaseFeet * (args.assumptionState.waste.conduitWastePercent / 100));
  const conduitFeet = conduitBaseFeet + conduitWasteFeet;
  const fieldSpliceLocations = Math.max(0, Math.ceil(purchasedFiberFeet / args.assumptionState.splicing.reelLengthFeet) - 1);
  const spliceCaseCount = Math.max(2, fieldSpliceLocations);
  const fiberTerminations = fieldSpliceLocations * WORKBOOK_RATES.fiberCount * 2;
  const targetDurationDays = controls.targetDurationDays;

  const laborLines = [
    laborLine({
      lineItemId: `${args.estimateId}:LABOR:PLOW`,
      description: "Plowing",
      quantity: plowFeet,
      unitCost: WORKBOOK_RATES.plowLaborPerFoot,
      productionFeetPerDay: constraintProduction(constraintValues, "production.plowFeetPerDay", controls.production.plowFeetPerDay),
      targetDurationDays,
      source: "Production Engine",
      workbook: MASTER_OSP_WORKBOOK,
      quantityFormula: "Route feet x selected plow percentage.",
      unitCostFormula: "Master OSP Build Metrics: Plow Labor / Plow Ft / Labor.",
      productionFormula: "Phase 4 default: Plowing 5,280 ft/day.",
      authority: authorityFor(constraintValues, "civil.plowPercent"),
    }),
    laborLine({
      lineItemId: `${args.estimateId}:LABOR:DIRT-BORE`,
      description: "Directional bore - dirt",
      quantity: boreFeet,
      unitCost: WORKBOOK_RATES.dirtBoreLaborPerFoot,
      productionFeetPerDay: constraintProduction(constraintValues, "production.directionalBoreDirtFeetPerDay", controls.production.directionalBoreDirtFeetPerDay),
      targetDurationDays,
      source: "Production Engine",
      workbook: MASTER_OSP_WORKBOOK,
      quantityFormula: "Route feet x selected directional bore percentage; rock quantity remains UNKNOWN.",
      unitCostFormula: "Master OSP Build Metrics: Bore Labor / Bore Ft / Labor.",
      productionFormula: "Phase 4 default: Directional Bore Dirt 600 ft/day.",
      authority: authorityFor(constraintValues, "civil.directionalBoreDirtPercent"),
    }),
    laborLine({
      lineItemId: `${args.estimateId}:LABOR:ROCK-ADDER`,
      description: "Directional bore - rock adder",
      quantity: rockBoreFeet,
      unitCost: rockAdderPerFoot,
      productionFeetPerDay: constraintProduction(constraintValues, "production.directionalBoreRockFeetPerDay", controls.production.directionalBoreRockFeetPerDay),
      targetDurationDays,
      source: rockPercentAuthority.source,
      workbook: MASTER_OSP_WORKBOOK,
      quantityFormula: "Directional bore feet x approved/algorithm/human/API rock percentage.",
      unitCostFormula: "Explicit rock adder per foot.",
      productionFormula: "Phase 4 default: Directional Bore Rock 300 ft/day.",
      authority: rockPercentAuthority,
    }),
    laborLine({
      lineItemId: `${args.estimateId}:LABOR:OPEN-TRENCH`,
      description: "Open trench - dirt",
      quantity: openTrenchFeet,
      unitCost: WORKBOOK_RATES.openTrenchLaborPerFoot,
      productionFeetPerDay: constraintProduction(constraintValues, "production.openTrenchDirtFeetPerDay", controls.production.openTrenchDirtFeetPerDay),
      targetDurationDays,
      source: "Estimator default pending workbook-specific open trench rate",
      quantityFormula: "Route feet x selected open trench percentage; rock quantity remains UNKNOWN.",
      unitCostFormula: "Existing Hyperlinx development-seed open trench rate.",
      productionFormula: "Phase 4 default: Open Trench Dirt 300 ft/day.",
      authority: authorityFor(constraintValues, "civil.openTrenchPercent"),
    }),
    laborLine({
      lineItemId: `${args.estimateId}:LABOR:FIBER-BLOWING`,
      description: "Fiber placement - blowing",
      quantity: purchasedFiberFeet,
      unitCost: WORKBOOK_RATES.fiberBlowLaborPerFoot,
      productionFeetPerDay: constraintProduction(constraintValues, "production.fiberBlowingFeetPerDay", controls.production.fiberBlowingFeetPerDay),
      targetDurationDays,
      source: "Material / Labor Engine",
      workbook: MASTER_OSP_WORKBOOK,
      quantityFormula: "Purchased fiber feet = route fiber + slack + waste.",
      unitCostFormula: "Master OSP Build Metrics: Blow Fiber Labor / Per Fiber Material Calc / Labor.",
      productionFormula: "Separate blowing production is user-editable; default remains synthesis pending because the workbook provides rate but not ft/day.",
      authority: authorityFor(constraintValues, "production.fiberBlowingFeetPerDay"),
    }),
    laborLine({
      lineItemId: `${args.estimateId}:LABOR:SPLICING`,
      description: "Splicing by fiber terminations",
      quantity: fiberTerminations,
      unitCost: WORKBOOK_RATES.splicingLaborPerTermination,
      productionFeetPerDay: constraintProduction(constraintValues, "production.splicingTerminationsPerDay", controls.production.splicingTerminationsPerDay),
      targetDurationDays,
      source: "Labor Engine",
      workbook: MASTER_OSP_WORKBOOK,
      quantityFormula: "Field splice locations x 864 fibers x 2 terminations.",
      unitCostFormula: "Master OSP Build Metrics: Splicing Labor / Fiber Ct factor / Labor.",
      productionFormula: "Splicing production is user-editable; default remains synthesis pending until estimator sets terminations/day.",
      costFormula: "Fiber terminations x splicing labor per termination.",
      authority: authorityFor(constraintValues, "production.splicingTerminationsPerDay"),
    }),
  ].filter((line) => (line.quantity.value ?? 0) > 0);

  const unknownLaborLines = [
    rockPercentAuthority.authorityMode === "UNKNOWN"
      ? unknownLine("LABOR", `${args.estimateId}:LABOR:ROCK-PERCENT`, "Directional bore rock percentage", "Geology review", rockPercentAuthority)
      : null,
    unknownLine("LABOR", `${args.estimateId}:LABOR:HYDROVAC`, "Hydrovac", "Utility conflict review", authorityFor(constraintValues, "production.hydrovac")),
    unknownLine("LABOR", `${args.estimateId}:LABOR:RESTORATION`, "Restoration requirements", "Human Review Required", authorityFor(constraintValues, "production.restoration")),
    unknownLine("LABOR", `${args.estimateId}:LABOR:TRAFFIC-CONTROL`, "Traffic control", "Permitting / MOT review"),
    unknownLine("LABOR", `${args.estimateId}:LABOR:TESTING`, "Testing production", "Synthesis Pending", authorityFor(constraintValues, "production.testing")),
  ].filter((line): line is TransparentEstimateLineItem => Boolean(line));

  const projectScheduleDays = laborLines
    .map((line) => line.durationDays.value ?? 0)
    .reduce((max, duration) => Math.max(max, duration), 0);
  const projectManagerCost = (Math.max(projectScheduleDays, targetDurationDays) / 260) * WORKBOOK_RATES.projectManagerAnnualLoadedCost;
  const projectManagementLine = laborLine({
    lineItemId: `${args.estimateId}:LABOR:PROJECT-MANAGEMENT`,
    description: "Project management",
    quantity: Math.max(projectScheduleDays, targetDurationDays),
    unitCost: WORKBOOK_RATES.projectManagerAnnualLoadedCost / 260,
    productionFeetPerDay: 1,
    targetDurationDays,
    source: "Crew Optimization",
    workbook: MASTER_OSP_WORKBOOK,
    quantityFormula: "Max calculated production schedule days and customer target duration.",
    unitCostFormula: "Master OSP Build Metrics: Project Manager Labor annual loaded comp / 260 working days.",
    productionFormula: "One project-management day per elapsed project day.",
    costFormula: "Project management days x daily loaded project manager cost.",
    authority: authorityFor(constraintValues, "labor.assumptions"),
  });
  projectManagementLine.extendedCost = currencyValue({
    value: projectManagerCost,
    formula: "Max calculated production schedule days and customer target duration / 260 x annual loaded project manager cost.",
    source: "Crew Optimization",
    workbook: MASTER_OSP_WORKBOOK,
  });

  const materialLines = [
    materialLine({
      lineItemId: `${args.estimateId}:MAT:CONDUIT`,
      description: "1 1/2 inch conduit material",
      quantity: conduitFeet,
      unit: "ft",
      unitCost: WORKBOOK_RATES.conduitMaterialPerFoot,
      source: "Material Engine",
      workbook: MASTER_OSP_WORKBOOK,
      formula: "Route feet x standard duct package conduit count + conduit waste.",
      authority: authorityFor(constraintValues, "bom.assumptions"),
    }),
    materialLine({
      lineItemId: `${args.estimateId}:MAT:FIBER-864`,
      description: "864-count shielded fiber material",
      quantity: purchasedFiberFeet,
      unit: "ft",
      unitCost: WORKBOOK_RATES.fiber864MaterialPerFoot,
      source: "Material Engine",
      workbook: MASTER_OSP_WORKBOOK,
      formula: "Route fiber feet + vault slack + handhole slack + fiber waste.",
      authority: authorityFor(constraintValues, "bom.assumptions"),
    }),
    materialLine({
      lineItemId: `${args.estimateId}:MAT:HANDHOLE-LABOR`,
      description: "Handhole labor",
      quantity: handholeCount,
      unit: "ea",
      unitCost: WORKBOOK_RATES.handholeLaborEach,
      source: "Material Engine",
      workbook: MASTER_OSP_WORKBOOK,
      formula: "Route feet / 2,500 ft handhole spacing.",
      authority: authorityFor(constraintValues, "bom.assumptions"),
    }),
    materialLine({
      lineItemId: `${args.estimateId}:MAT:HANDHOLE-MATERIAL`,
      description: "Handhole material",
      quantity: handholeCount,
      unit: "ea",
      unitCost: WORKBOOK_RATES.handholeMaterialEach,
      source: "Material Engine",
      workbook: MASTER_OSP_WORKBOOK,
      formula: "Route feet / 2,500 ft handhole spacing.",
      authority: authorityFor(constraintValues, "bom.assumptions"),
    }),
    materialLine({
      lineItemId: `${args.estimateId}:MAT:SPLICE-CASE`,
      description: "Splice case materials",
      quantity: spliceCaseCount,
      unit: "ea",
      unitCost: WORKBOOK_RATES.spliceCaseEach,
      source: "Material Engine",
      workbook: MASTER_OSP_WORKBOOK,
      formula: "Field splice locations derived from purchased fiber feet / reel length.",
      authority: authorityFor(constraintValues, "bom.assumptions"),
    }),
  ];

  const futurePathLine = args.assumptionState.materials.futurePathEnabled
    ? materialLine({
        lineItemId: `${args.estimateId}:MAT:FUTUREPATH`,
        description: "4-way FuturePath 18/14mm and couplers",
        quantity: routeFeet * args.assumptionState.materials.futurePathMultiplier,
        unit: "ft",
        unitCost: WORKBOOK_RATES.futurePathPerFoot,
        source: "Material Engine",
        workbook: MASTER_OSP_WORKBOOK,
        formula: "Route feet x FuturePath multiplier when enabled by commercial assumption.",
        authority: authorityFor(constraintValues, "bom.assumptions"),
      })
    : null;
  const allMaterialLines = futurePathLine ? [...materialLines, futurePathLine] : materialLines;

  const ilaFacilities = buildIlaFacilities({
    estimateId: args.estimateId,
    geometry: args.geometry,
    routeMiles,
    regenCount,
    aLabel: args.aLabel,
    zLabel: args.zLabel,
  });
  const ilaTotal = ilaFacilities.reduce((total, facility) => total + (facility.total.value ?? 0), 0);
  const ilaLine = totalLine(
    "ILA_FACILITIES",
    "ILA",
    `${args.estimateId}:ILA:36-RACK`,
    "Hyperlinx-managed ILA facilities",
    ilaTotal,
    "ILA Detail",
    "Bookend ILA sites + intermediate regen ILA sites x 36-rack workbook cost.",
    authorityFor(constraintValues, "ila.assumptions"),
  );
  ilaLine.workbook = `${PER_ILA_COST_WORKBOOK}; ${DOBSON_ILA_WORKBOOK}`;

  const engineeringLine = laborLine({
    lineItemId: `${args.estimateId}:PERMIT:ENGINEERING`,
    description: "Engineering / permitting labor",
    quantity: routeFeet,
    unitCost: WORKBOOK_RATES.engineeringPermittingPerFoot,
    productionFeetPerDay: null,
    targetDurationDays,
    source: "Permits",
    workbook: MASTER_OSP_WORKBOOK,
    quantityFormula: "Route feet from OSRM corridor geometry.",
    unitCostFormula: "Master OSP Build Metrics: Engineering/Permitting Labor / Total Ft / Labor.",
    productionFormula: "Production is synthesis pending; workbook provides per-foot engineering/permitting rate.",
    authority: authorityFor(constraintValues, "financial.assumptions"),
  });
  engineeringLine.sectionId = "PERMITS";
  engineeringLine.category = "PERMIT";

  const unknownQuantities: TransparentUnknownQuantity[] = [
    {
      unknownId: "RAILROAD-CROSSINGS",
      label: "Railroad crossings",
      display: "UNKNOWN",
      status: "Human Review Required",
      source: "Crossing review not available from OSRM geometry.",
      confidenceImpact: 8,
      costImpact: 0,
      costTreatment: "Confidence only; no automatic cost adder",
      authority: authorityFor(constraintValues, "crossing.rail"),
    },
    {
      unknownId: "WATER-CROSSINGS",
      label: "Water crossings",
      display: "UNKNOWN",
      status: "Human Review Required",
      source: "Water crossing layer synthesis pending.",
      confidenceImpact: 8,
      costImpact: 0,
      costTreatment: "Confidence only; no automatic cost adder",
      authority: authorityFor(constraintValues, "crossing.water"),
    },
    {
      unknownId: "DOT-CROSSINGS",
      label: "DOT / highway crossings",
      display: "UNKNOWN",
      status: "Human Review Required",
      source: "DOT crossing review not available from OSRM geometry.",
      confidenceImpact: 7,
      costImpact: 0,
      costTreatment: "Confidence only; no automatic cost adder",
      authority: authorityFor(constraintValues, "crossing.dot"),
    },
    {
      unknownId: "UTILITY-CONFLICTS",
      label: "Utility conflicts",
      display: "UNKNOWN",
      status: "Synthesis Pending",
      source: "Utility conflict layer pending.",
      confidenceImpact: 7,
      costImpact: 0,
      costTreatment: "Confidence only; no automatic cost adder",
      authority: authorityFor(constraintValues, "utility.conflicts"),
    },
    {
      unknownId: "ENVIRONMENTAL-IMPACTS",
      label: "Environmental impacts",
      display: "UNKNOWN",
      status: "Synthesis Pending",
      source: "Environmental constraint synthesis pending.",
      confidenceImpact: 6,
      costImpact: 0,
      costTreatment: "Confidence only; no automatic cost adder",
      authority: authorityFor(constraintValues, "environmental.impacts"),
    },
    {
      unknownId: "BRIDGE-ATTACHMENTS",
      label: "Bridge attachments",
      display: "UNKNOWN",
      status: "Human Review Required",
      source: "Bridge attachment review not available from OSRM geometry.",
      confidenceImpact: 6,
      costImpact: 0,
      costTreatment: "Confidence only; no automatic cost adder",
      authority: authorityFor(constraintValues, "bridge.attachments"),
    },
    {
      unknownId: "ROCK-PERCENTAGE",
      label: "Rock percentage",
      display: "UNKNOWN",
      status: "Human Review Required",
      source: "Geotechnical review required; default rock percent is not applied in transparent corridor draft.",
      confidenceImpact: 8,
      costImpact: 0,
      costTreatment: "Confidence only; no automatic cost adder",
      authority: rockPercentAuthority,
    },
    {
      unknownId: "RESTORATION-REQUIREMENTS",
      label: "Restoration requirements",
      display: "UNKNOWN",
      status: "Human Review Required",
      source: "Restoration scope cannot be derived from corridor geometry alone.",
      confidenceImpact: 5,
      costImpact: 0,
      costTreatment: "Confidence only; no automatic cost adder",
      authority: authorityFor(constraintValues, "production.restoration"),
    },
  ];

  const unknownLines = unknownQuantities.map((unknown) => unknownLine(
    "ESTIMATE_CONFIDENCE",
    `${args.estimateId}:UNKNOWN:${unknown.unknownId}`,
    unknown.label,
    unknown.source,
    unknown.authority,
  ));

  const laborWithPm = [...laborLines, projectManagementLine, ...unknownLaborLines];
  const ospLines = laborLines.filter((line) => ["Plowing", "Directional bore - dirt", "Open trench - dirt"].includes(line.description));
  const laborCost = sumKnown(laborWithPm);
  const materialCost = sumKnown(allMaterialLines);
  const permitCost = engineeringLine.extendedCost.value ?? 0;
  const equipmentCost = ilaTotal;
  const constructionCost = laborCost + materialCost + permitCost + equipmentCost;
  const contingency = constructionCost * (controls.financial.contingencyPercent / 100);
  const overhead = constructionCost * (controls.financial.overheadPercent / 100);
  const costBeforeMarkup = constructionCost + contingency + overhead;
  const markup = costBeforeMarkup * (controls.financial.markupPercent / 100);
  const sellPrice = costBeforeMarkup + markup;
  const margin = sellPrice > 0 ? ((sellPrice - costBeforeMarkup) / sellPrice) * 100 : 0;
  const financialAuthority = authorityFor(constraintValues, "financial.assumptions");
  const omAuthority = authorityFor(constraintValues, "financial.omCostPerRouteMile");
  const annualOmPerRouteMile = authorityModeCostIncluded(omAuthority) && typeof omAuthority.value === "number" ? omAuthority.value : 0;
  const monthlyOmPerRouteMile = annualOmPerRouteMile / 12;
  const mrc = routeMiles * monthlyOmPerRouteMile;

  const financialModel: TransparentFinancialModel = {
    constructionCost: currencyValue({
      value: constructionCost,
      formula: "Known labor + known materials + known engineering/permitting + known ILA facilities.",
      source: "Financial Engine",
    }),
    engineering: currencyValue({
      value: permitCost,
      formula: "Route feet x engineering/permitting workbook rate.",
      source: "Financial Engine",
      workbook: MASTER_OSP_WORKBOOK,
    }),
    permits: pendingValue("UNKNOWN", "Permit jurisdiction review", "Permit quantities and jurisdiction fees require human review; no cost adder applied."),
    equipment: currencyValue({
      value: equipmentCost,
      formula: "Sum of ILA facility workbook totals.",
      source: "Financial Engine",
      workbook: PER_ILA_COST_WORKBOOK,
    }),
    labor: currencyValue({
      value: laborCost,
      formula: "Sum of known labor line items; unknown labor categories add confidence impact only.",
      source: "Financial Engine",
    }),
    materials: currencyValue({
      value: materialCost,
      formula: "Sum of material line items from physical quantities and workbook unit rates.",
      source: "Financial Engine",
      workbook: MASTER_OSP_WORKBOOK,
    }),
    contingency: currencyValue({
      value: contingency,
      formula: "Construction cost x explicit contingency percent.",
      source: "Financial assumption",
      workbook: MASTER_OSP_WORKBOOK,
      editable: true,
      userOverride: `${controls.financial.contingencyPercent}%`,
    }),
    overhead: currencyValue({
      value: overhead,
      formula: "Construction cost x explicit overhead percent.",
      source: "Financial assumption",
      editable: true,
      userOverride: `${controls.financial.overheadPercent}%`,
    }),
    markup: currencyValue({
      value: markup,
      formula: "(Construction cost + contingency + overhead) x markup percent.",
      source: "Financial assumption",
      editable: true,
      userOverride: `${controls.financial.markupPercent}%`,
    }),
    margin: numericValue({
      value: margin,
      formula: "(Sell price - cost before markup) / sell price.",
      source: "Financial Engine",
      suffix: "%",
    }),
    sellPrice: currencyValue({
      value: sellPrice,
      formula: "Construction cost + contingency + overhead + markup.",
      source: "Financial Engine",
    }),
    nrc: currencyValue({
      value: sellPrice,
      formula: "For advisory corridor draft, NRC equals sell price.",
      source: "Commercial Proposal",
    }),
    mrc: currencyValue({
      value: mrc,
      formula: "Route miles x monthly O&M per route mile.",
      source: "Revenue",
      workbook: FIBER_SUMMARY_WORKBOOK,
      editable: true,
      userOverride: `$${round(monthlyOmPerRouteMile, 2)} / route mile / month`,
    }),
    roi: pendingValue("SYNTHESIS_PENDING", "Revenue terms not set", "ROI requires revenue term, capex, opex, and contract assumptions."),
    irr: pendingValue("SYNTHESIS_PENDING", "Revenue terms not set", "IRR requires cash-flow timing and term assumptions."),
    payback: pendingValue("SYNTHESIS_PENDING", "Revenue terms not set", "Payback requires customer revenue assumptions."),
  };

  const physicalQuantities: TransparentPhysicalQuantities = {
    routeMiles,
    routeFeet,
    segmentCount: args.segmentCount,
    stationCount,
    stationSpacingFeet: WORKBOOK_RATES.stationSpacingFeet,
    routeFiberFeet,
    slackStorageFeet,
    fiberWasteFeet,
    purchasedFiberFeet,
    conduitFeet,
    conduitWasteFeet,
    fiberCount: WORKBOOK_RATES.fiberCount,
    handholeCount,
    vaultCount,
    spliceCaseCount,
    fieldSpliceLocations,
    fiberTerminations,
    ilaCount,
    regenCount,
  };

  const confidenceDrivers: TransparentEstimateConfidence["drivers"] = [
    { label: "Known Geometry", status: "Known", impact: 0, reason: "OSRM routed geometry exists." },
    { label: "Known Quantities", status: "Known", impact: 0, reason: "Route feet, stations, handholes, vaults, fiber, conduit, and ILA count derive from geometry and explicit spacing assumptions." },
    { label: "Known Production", status: "Synthesis Pending", impact: controls.production.fiberBlowingFeetPerDay && controls.production.splicingTerminationsPerDay ? 2 : 9, reason: "Civil production defaults are known; placement/splicing/testing production may still need estimator input." },
    { label: "Known Labor", status: "Synthesis Pending", impact: 5, reason: "Civil, placement, splicing, PM labor are explainable; hydrovac/restoration/traffic/testing remain pending." },
    { label: "Known Material", status: "Known", impact: 0, reason: "Core OSP material rates are workbook-derived." },
    { label: "Known Equipment", status: "Known", impact: 0, reason: "ILA equipment is included in workbook facility structure." },
    ...unknownQuantities.map((unknown) => ({
      label: unknown.label,
      status: confidenceStatusForAuthority(unknown.authority, unknown.status),
      impact: confidenceImpactForAuthority(unknown.authority, unknown.confidenceImpact),
      reason: `${unknown.source} Authority: ${unknown.authority.authorityMode} from ${unknown.authority.source}.`,
    })),
  ];
  const confidenceScore = Math.max(0, 100 - confidenceDrivers.reduce((total, driver) => total + driver.impact, 0));
  const confidence: TransparentEstimateConfidence = {
    score: confidenceScore,
    level: confidenceLevel(confidenceScore),
    drivers: confidenceDrivers,
  };

  const corridorMetrics: TransparentEstimateMetric[] = [
    { metricId: "ROUTE-MILES", label: "Route miles", value: numericValue({ value: routeMiles, formula: "OSRM route distance.", source: "Physical Quantities", suffix: " mi" }) },
    { metricId: "ROUTE-FEET", label: "Route feet", value: numericValue({ value: routeFeet, formula: "Route miles x 5,280.", source: "Physical Quantities", suffix: " ft" }) },
    { metricId: "SEGMENT-COUNT", label: "Commercial segments", value: numericValue({ value: args.segmentCount, formula: "Commercial segment builder.", source: "Physical Quantities" }) },
    { metricId: "STATION-COUNT", label: "Station count", value: numericValue({ value: stationCount, formula: "ceil(route feet / station spacing) + 1.", source: "Physical Quantities" }) },
  ];
  const fiberMetrics: TransparentEstimateMetric[] = [
    { metricId: "FIBER-COUNT", label: "Fiber type", value: textMetricValue({ value: "864-count shielded fiber", formula: "Customer workbook fiber count.", source: "Physical Quantities", workbook: FIBER_SUMMARY_WORKBOOK }) },
    { metricId: "ROUTE-FIBER", label: "Route fiber", value: numericValue({ value: routeFiberFeet, formula: "Route feet.", source: "Physical Quantities", suffix: " ft" }) },
    { metricId: "SLACK-STORAGE", label: "Slack storage", value: numericValue({ value: slackStorageFeet, formula: "Vault slack + handhole slack.", source: "Physical Quantities", suffix: " ft" }) },
    { metricId: "PURCHASED-FIBER", label: "Purchased fiber", value: numericValue({ value: purchasedFiberFeet, formula: "Route fiber + slack + waste.", source: "Material Engine", suffix: " ft" }) },
  ];
  const assumptionMetrics: TransparentEstimateMetric[] = [
    { metricId: "TARGET-DURATION", label: "Customer duration", value: numericValue({ value: targetDurationDays, formula: "User-editable target duration.", source: "Customer Duration", editable: true, suffix: " days" }) },
    { metricId: "ASSUMPTION-STATE", label: "Assumption state", value: textMetricValue({ value: args.assumptionState.label, formula: "Selected commercial assumption state.", source: "Assumptions" }) },
    { metricId: "CIVIL-MIX", label: "Civil mix", value: textMetricValue({ value: `${args.assumptionState.civilMix.plowPercent}% plow / ${args.assumptionState.civilMix.hddPercent}% bore / ${args.assumptionState.civilMix.openCutPercent}% open trench`, formula: "Selected construction strategy.", source: "Assumptions" }) },
  ];
  const financialMetrics: TransparentEstimateMetric[] = [
    { metricId: "SELL-PRICE", label: "Sell price", value: financialModel.sellPrice },
    { metricId: "NRC", label: "NRC", value: financialModel.nrc },
    { metricId: "MRC", label: "MRC", value: financialModel.mrc },
    { metricId: "MARGIN", label: "Margin", value: financialModel.margin },
  ];
  const confidenceMetrics: TransparentEstimateMetric[] = [
    { metricId: "CONFIDENCE-SCORE", label: "Estimate confidence", value: numericValue({ value: confidence.score, formula: "100 minus confidence impacts.", source: "Estimate Confidence", suffix: "%" }) },
    { metricId: "CONFIDENCE-LEVEL", label: "Level", value: textMetricValue({ value: confidence.level, formula: "Score band.", source: "Estimate Confidence" }) },
  ];

  const sections = [
    buildSection("EXECUTIVE_SUMMARY", "Executive Summary", "Known cost, price, duration, and confidence.", [
      totalLine("EXECUTIVE_SUMMARY", "FINANCIAL", `${args.estimateId}:SUMMARY:CONSTRUCTION`, "Construction cost", constructionCost, "Executive Summary", financialModel.constructionCost.formula, financialAuthority),
      totalLine("EXECUTIVE_SUMMARY", "FINANCIAL", `${args.estimateId}:SUMMARY:SELL`, "Sell price", sellPrice, "Executive Summary", financialModel.sellPrice.formula, financialAuthority),
    ], [...financialMetrics, ...confidenceMetrics]),
    buildSection("CORRIDOR", "Corridor", "Physical corridor quantities derived from routed geometry.", [], corridorMetrics),
    buildSection("FIBER", "Fiber", "Fiber footage, slack, waste, and terminations.", [], fiberMetrics),
    buildSection("OSP_CONSTRUCTION", "OSP Construction", "Civil production and construction line items.", ospLines),
    buildSection("ILA_FACILITIES", "ILA Facilities", "Bookend and intermediate Hyperlinx-managed ILA sites.", [ilaLine]),
    buildSection("MATERIALS", "Materials", "Workbook-derived OSP materials.", allMaterialLines),
    buildSection("LABOR", "Labor", "Production, schedule, crew, and labor cost detail.", laborWithPm),
    buildSection("EQUIPMENT", "Equipment", "Equipment is currently represented inside ILA facility workbook totals.", [
      totalLine("EQUIPMENT", "EQUIPMENT", `${args.estimateId}:EQUIPMENT:ILA`, "ILA equipment bundle", equipmentCost, "Equipment Engine", "Equipment categories are included in ILA workbook totals.", authorityFor(constraintValues, "ila.assumptions")),
    ]),
    buildSection("PERMITS", "Permits", "Engineering/permitting rate plus unknown jurisdictional fees.", [
      engineeringLine,
      unknownLine("PERMITS", `${args.estimateId}:PERMIT:JURISDICTION`, "Permit jurisdiction fees", "Permit jurisdiction review", authorityFor(constraintValues, "permit.jurisdictionFees")),
    ]),
    buildSection("MOBILIZATION", "Mobilization", "Mobilization is not fabricated without a mobilization plan.", [
      unknownLine("MOBILIZATION", `${args.estimateId}:MOBILIZATION:PLAN`, "Mobilization plan", "Human Review Required"),
    ]),
    buildSection("CONTINGENCY", "Contingency", "Explicit contingency assumption, separate from confidence.", [
      totalLine("CONTINGENCY", "CONTINGENCY", `${args.estimateId}:CONTINGENCY:BASE`, "Contingency", contingency, "Financial assumption", financialModel.contingency.formula, financialAuthority),
    ]),
    buildSection("FINANCIAL_MODEL", "Financial Model", "Financial assumptions are isolated from engineering quantities.", [
      totalLine("FINANCIAL_MODEL", "FINANCIAL", `${args.estimateId}:FINANCIAL:OVERHEAD`, "Overhead", overhead, "Financial assumption", financialModel.overhead.formula, financialAuthority),
      totalLine("FINANCIAL_MODEL", "FINANCIAL", `${args.estimateId}:FINANCIAL:MARKUP`, "Markup", markup, "Financial assumption", financialModel.markup.formula, financialAuthority),
      unknownLine("FINANCIAL_MODEL", `${args.estimateId}:FINANCIAL:ROI`, "ROI / IRR / Payback", "Revenue terms not set", financialAuthority),
    ], financialMetrics),
    buildSection("REVENUE", "Revenue", "NRC/MRC preview; contract terms are not authority.", [
      totalLine("REVENUE", "FINANCIAL", `${args.estimateId}:REVENUE:NRC`, "NRC", sellPrice, "Commercial Proposal", financialModel.nrc.formula, financialAuthority),
      totalLine("REVENUE", "FINANCIAL", `${args.estimateId}:REVENUE:MRC`, "MRC", mrc, "Revenue", financialModel.mrc.formula, omAuthority),
    ]),
    buildSection("ASSUMPTIONS", "Assumptions", "Editable production and financial assumptions.", [], assumptionMetrics),
    buildSection("ESTIMATE_CONFIDENCE", "Estimate Confidence", "Confidence changes independently from construction cost.", unknownLines, confidenceMetrics),
  ];
  const auditTrail = auditEntries(sections, financialModel, unknownQuantities, financialAuthority, omAuthority);
  sections.push(buildSection("ESTIMATE_AUDIT", "Estimate Audit", "Every displayed total exposes value, formula, source, workbook, override, and calculation status.", [], [
    { metricId: "AUDIT-COUNT", label: "Audit entries", value: numericValue({ value: auditTrail.length, formula: "Count of generated audit entries.", source: "Estimate Audit" }) },
  ]));

  return {
    estimateId: args.estimateId,
    controls,
    physicalQuantities,
    sections,
    laborLineItems: laborWithPm,
    materialLineItems: allMaterialLines,
    equipmentLineItems: sections.find((section) => section.sectionId === "EQUIPMENT")?.lineItems ?? [],
    ospLineItems: ospLines,
    ilaFacilities,
    unknownQuantities,
    constraintValues,
    confidence,
    financialModel,
    auditTrail,
    totalKnownCost: money(constructionCost + contingency + overhead),
    sellPrice: money(sellPrice),
    nrc: money(sellPrice),
    mrc: money(mrc),
    grossMarginPercent: round(margin, 1),
    noScopeVersionCreation: true,
    noInventoryMutation: true,
  };
}
