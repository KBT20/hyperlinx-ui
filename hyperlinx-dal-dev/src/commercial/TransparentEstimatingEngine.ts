import type { BudgetAssumptionState } from "./BudgetAssumptionState";
import {
  authorityModeCostIncluded,
  createConstraintValue,
  resolveConstraintValue,
  type ConstraintAuthorityMode,
  type ConstraintValue,
} from "./ConstraintAuthority";
import { ESTIMATOR_DEFAULTS } from "./EstimatorDefaults";
import {
  DEFAULT_ILA_PLANNING_CONTROLS,
  buildIlaPlanningResult,
  buildIlaFacilityProfiles,
  normalizeIlaPlanningControls,
  type IlaFacilityProfileId,
  type IlaPlanningControls,
  type IlaPlanningResult,
} from "./IlaPlanningEngine";
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
  | "OPTICAL_ENGINEERING_PREVIEW"
  | "ILA_FACILITIES"
  | "MATERIALS"
  | "LABOR"
  | "EQUIPMENT"
  | "PERMITS"
  | "MOBILIZATION"
  | "CONTINGENCY"
  | "FINANCIAL_MODEL"
  | "REVENUE"
  | "LAYER_1_LIFECYCLE"
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
  | "LIFECYCLE"
  | "OPTICAL"
  | "UNKNOWN";

export type TransparentCivilMixMode = "AUTOMATIC" | "MANUAL";
export type TransparentEstimateStatus =
  | "CURRENT"
  | "MODIFIED"
  | "RECALCULATING"
  | "EXTERNAL_REFRESH_REQUIRED"
  | "ROUTE_GEOMETRY_STALE"
  | "PROPOSAL_READY";

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
  dependencies: string[];
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
  graphNodeId: string;
  stationType: "START_BOOKEND" | "INTERMEDIATE" | "END_BOOKEND";
  station: string;
  ordinal: number;
  location: string;
  gps: string;
  milepost: number;
  routeId: string;
  scopeVersionLineage: string;
  facilityProfileId: IlaFacilityProfileId;
  facilityType: string;
  power: string;
  generator: string;
  hvac: string;
  racks: number;
  buildingProfile: string;
  costProfile: string;
  spanFromPreviousMiles: number;
  spanLossDb: number;
  remainingBudgetDb: number;
  recommendedRegen: boolean;
  coordinate: DALCoordinate;
  canMove: boolean;
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
  civilMixMode: TransparentCivilMixMode;
  production: TransparentEstimateProductionControls;
  financial: TransparentEstimateFinancialControls;
  ilaPlanning: IlaPlanningControls;
  constraints?: Record<string, ConstraintValue>;
  algorithmConstraints?: Record<string, ConstraintValue>;
  humanAuditTrail?: TransparentEstimateHumanAuditEntry[];
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

export interface TransparentCommercialReadiness {
  score: number;
  level: "READY" | "REVIEW" | "BLOCKED";
  drivers: Array<{
    label: string;
    status: "Ready" | "Review" | "Blocked";
    impact: number;
    reason: string;
  }>;
}

export interface TransparentContingencyCategory {
  key: string;
  label: string;
  percent: number;
  cost: number;
  authority: ConstraintValue;
}

export interface TransparentOmLifecycleComponent {
  key: string;
  label: string;
  annualCostPerRouteMile: number;
  annualCost: number;
  authority: ConstraintValue;
}

export interface TransparentLayer1RecurringOpportunity {
  opportunityId: string;
  label: string;
  description: string;
  optionalLineItem: true;
  requiresLightingFiber: false;
  proposalAuthority: "OPTIONAL";
}

export interface TransparentOpticalEngineeringPreview {
  routeLengthMiles: number;
  routeLengthKm: number;
  attenuationDb: number;
  approximateSpliceLossDb: number;
  connectorLossDb: number;
  estimatedEndToEndLossDb: number;
  estimatedSpanLengthMiles: number;
  estimatedIlaSpacingMiles: number;
  preliminaryEngineeringEstimate: true;
}

export interface TransparentCivilMixSummary {
  mode: TransparentCivilMixMode;
  plowPercent: number;
  directionalBoreDirtPercent: number;
  directionalBoreRockPercent: number;
  openTrenchPercent: number;
  totalPercent: number;
  warning: string | null;
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

export interface TransparentEstimateHumanAuditEntry {
  auditId: string;
  constraintKey: string;
  label: string;
  previousValue: string;
  newValue: string;
  previousAuthority: ConstraintAuthorityMode;
  newAuthority: ConstraintAuthorityMode;
  user: string;
  timestamp: string;
  reason?: string;
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
  ilaPlan: IlaPlanningResult;
  unknownQuantities: TransparentUnknownQuantity[];
  constraintValues: Record<string, ConstraintValue>;
  civilMix: TransparentCivilMixSummary;
  estimateStatus: TransparentEstimateStatus;
  commercialReadiness: TransparentCommercialReadiness;
  contingencyCategories: TransparentContingencyCategory[];
  omLifecycleComponents: TransparentOmLifecycleComponent[];
  layer1RecurringOpportunities: TransparentLayer1RecurringOpportunity[];
  opticalEngineeringPreview: TransparentOpticalEngineeringPreview;
  confidence: TransparentEstimateConfidence;
  financialModel: TransparentFinancialModel;
  auditTrail: TransparentEstimateAuditEntry[];
  humanAuditTrail: TransparentEstimateHumanAuditEntry[];
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
  civilMixMode: "AUTOMATIC",
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
  ilaPlanning: { ...DEFAULT_ILA_PLANNING_CONTROLS },
  constraints: {},
  algorithmConstraints: {},
  humanAuditTrail: [],
};

const CONTINGENCY_CATEGORIES = [
  { key: "contingency.projectAdministration", label: "Project Administration", percent: 0.45 },
  { key: "contingency.projectManagement", label: "Project Management", percent: 0.65 },
  { key: "contingency.materialHandling", label: "Material Handling", percent: 0.5 },
  { key: "contingency.shipping", label: "Shipping", percent: 0.45 },
  { key: "contingency.storage", label: "Storage", percent: 0.25 },
  { key: "contingency.smallToolsConsumables", label: "Small Tools / Consumables", percent: 0.45 },
  { key: "contingency.insuranceBonding", label: "Insurance / Bonding", percent: 0.55 },
  { key: "contingency.generalConditions", label: "General Conditions", percent: 0.75 },
  { key: "contingency.overheadRecovery", label: "Overhead Recovery", percent: 0.8 },
  { key: "contingency.cogsBuffer", label: "COGS Buffer", percent: 0.75 },
  { key: "contingency.estimatingRisk", label: "Estimating Risk", percent: 0.85 },
  { key: "contingency.unknownConditions", label: "Unknown Conditions", percent: 1.05 },
] as const;

const OM_LIFECYCLE_COMPONENTS = [
  { key: "om.layer1Monitoring", label: "Layer 1 Monitoring", annualPerRouteMile: 180 },
  { key: "om.preventiveMaintenance", label: "Preventive Maintenance", annualPerRouteMile: 180 },
  { key: "om.locateSupport", label: "Locate Support", annualPerRouteMile: 150 },
  { key: "om.emergencyResponse", label: "Emergency Response", annualPerRouteMile: 210 },
  { key: "om.annualInspection", label: "Annual Inspection", annualPerRouteMile: 120 },
  { key: "om.documentation", label: "Documentation", annualPerRouteMile: 90 },
  { key: "om.assetRegistry", label: "Asset Registry", annualPerRouteMile: 120 },
  { key: "om.slaReporting", label: "SLA Reporting", annualPerRouteMile: 150 },
] as const;

const LAYER_1_RECURRING_OPPORTUNITIES: TransparentLayer1RecurringOpportunity[] = [
  { opportunityId: "L1-PROACTIVE-FIBER-MONITORING", label: "Layer 1 Proactive Fiber Monitoring", description: "Optional dark-fiber infrastructure monitoring without transport service.", optionalLineItem: true, requiresLightingFiber: false, proposalAuthority: "OPTIONAL" },
  { opportunityId: "OTDR-MONITORING", label: "OTDR Monitoring", description: "Optional optical time-domain reflectometry monitoring placeholder for future engineering workflows.", optionalLineItem: true, requiresLightingFiber: false, proposalAuthority: "OPTIONAL" },
  { opportunityId: "FIBER-HEALTH-ANALYTICS", label: "Fiber Health Analytics", description: "Optional analytics around physical fiber condition and route health.", optionalLineItem: true, requiresLightingFiber: false, proposalAuthority: "OPTIONAL" },
  { opportunityId: "ASSET-INVENTORY", label: "Asset Inventory", description: "Optional recurring asset inventory support for Layer 1 records.", optionalLineItem: true, requiresLightingFiber: false, proposalAuthority: "OPTIONAL" },
  { opportunityId: "FIBER-ASSURANCE", label: "Fiber Assurance", description: "Optional physical-layer assurance service, not a lit service.", optionalLineItem: true, requiresLightingFiber: false, proposalAuthority: "OPTIONAL" },
  { opportunityId: "ROUTE-INTEGRITY-MONITORING", label: "Route Integrity Monitoring", description: "Optional monitoring for route integrity, encroachment, and physical risk indicators.", optionalLineItem: true, requiresLightingFiber: false, proposalAuthority: "OPTIONAL" },
  { opportunityId: "MAINTENANCE-CONTRACTS", label: "Maintenance Contracts", description: "Optional maintenance contract structure for dark infrastructure lifecycle management.", optionalLineItem: true, requiresLightingFiber: false, proposalAuthority: "OPTIONAL" },
  { opportunityId: "EMERGENCY-RESTORATION-RETAINER", label: "Emergency Restoration Retainers", description: "Optional retainer for emergency restoration readiness.", optionalLineItem: true, requiresLightingFiber: false, proposalAuthority: "OPTIONAL" },
  { opportunityId: "ROUTE-DOCUMENTATION", label: "Route Documentation Services", description: "Optional recurring route documentation upkeep.", optionalLineItem: true, requiresLightingFiber: false, proposalAuthority: "OPTIONAL" },
  { opportunityId: "ASBUILT-LIFECYCLE", label: "As-Built Lifecycle Management", description: "Optional as-built lifecycle management for Layer 1 records.", optionalLineItem: true, requiresLightingFiber: false, proposalAuthority: "OPTIONAL" },
];

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

function normalizeCivilMixMode(mode?: string): TransparentCivilMixMode {
  return mode === "MANUAL" ? "MANUAL" : "AUTOMATIC";
}

function cloneControls(controls?: TransparentEstimateControls): TransparentEstimateControls {
  return {
    targetDurationDays: clampPositive(controls?.targetDurationDays ?? DEFAULT_TRANSPARENT_ESTIMATE_CONTROLS.targetDurationDays, DEFAULT_TRANSPARENT_ESTIMATE_CONTROLS.targetDurationDays),
    civilMixMode: normalizeCivilMixMode(controls?.civilMixMode),
    production: {
      ...DEFAULT_TRANSPARENT_ESTIMATE_CONTROLS.production,
      ...(controls?.production ?? {}),
    },
    financial: {
      ...DEFAULT_TRANSPARENT_ESTIMATE_CONTROLS.financial,
      ...(controls?.financial ?? {}),
    },
    ilaPlanning: normalizeIlaPlanningControls(controls?.ilaPlanning),
    constraints: { ...(controls?.constraints ?? {}) },
    algorithmConstraints: { ...(controls?.algorithmConstraints ?? {}) },
    humanAuditTrail: [...(controls?.humanAuditTrail ?? [])],
  };
}

function constraint<T = number | string | boolean>(args: Parameters<typeof createConstraintValue<T>>[0]) {
  return createConstraintValue<T>(args);
}

function buildConstraintValues(assumptionState: BudgetAssumptionState, controls: TransparentEstimateControls): Record<string, ConstraintValue> {
  const annualOmTotal = controls.financial.monthlyOmPerRouteMile * 12;
  const defaultOmTotal = OM_LIFECYCLE_COMPONENTS.reduce((total, component) => total + component.annualPerRouteMile, 0);
  const omScale = defaultOmTotal > 0 ? annualOmTotal / defaultOmTotal : 1;
  const defaultIlaProfile = buildIlaFacilityProfiles(controls.ilaPlanning.customFacilityCost)
    .find((profile) => profile.profileId === controls.ilaPlanning.defaultFacilityProfileId);
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
    ...OM_LIFECYCLE_COMPONENTS.map((component) => constraint<number>({
      key: component.key,
      label: component.label,
      value: round(component.annualPerRouteMile * omScale, 2),
      unit: "$/route mile/year",
      authorityMode: "ALGORITHM" as const,
      source: "Infrastructure Lifecycle Management default",
      sourceDetail: "Layer 1 lifecycle O&M component; not a Layer 2 or lit service.",
      affectsCost: true,
      affectsSchedule: false,
      affectsConfidence: true,
    })),
    ...CONTINGENCY_CATEGORIES.map((category) => constraint<number>({
      key: category.key,
      label: category.label,
      value: category.percent,
      unit: "%",
      authorityMode: "ALGORITHM" as const,
      source: "Estimator contingency model",
      sourceDetail: "Commercial contingency category; separate from estimate confidence.",
      affectsCost: true,
      affectsSchedule: false,
      affectsConfidence: true,
    })),
    constraint<string>({
      key: "crossing.riverMethod",
      label: "River crossing method",
      value: "Directional Bore",
      authorityMode: "ALGORITHM",
      source: "Estimator crossing default",
      sourceDetail: "All rivers default to directional bore unless explicitly overridden. Open cut is not assumed.",
      affectsCost: false,
      affectsSchedule: true,
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
    constraint<number>({
      key: "labor.plowLaborPerFoot",
      label: "Plow labor rate",
      value: WORKBOOK_RATES.plowLaborPerFoot,
      unit: "$/ft",
      authorityMode: "ALGORITHM",
      source: MASTER_OSP_WORKBOOK,
      affectsCost: true,
      affectsSchedule: false,
      affectsConfidence: true,
    }),
    constraint<number>({
      key: "labor.dirtBoreLaborPerFoot",
      label: "Directional bore dirt labor rate",
      value: WORKBOOK_RATES.dirtBoreLaborPerFoot,
      unit: "$/ft",
      authorityMode: "ALGORITHM",
      source: MASTER_OSP_WORKBOOK,
      affectsCost: true,
      affectsSchedule: false,
      affectsConfidence: true,
    }),
    constraint<number>({
      key: "labor.openTrenchLaborPerFoot",
      label: "Open trench labor rate",
      value: WORKBOOK_RATES.openTrenchLaborPerFoot,
      unit: "$/ft",
      authorityMode: "ALGORITHM",
      source: MASTER_OSP_WORKBOOK,
      affectsCost: true,
      affectsSchedule: false,
      affectsConfidence: true,
    }),
    constraint<number>({
      key: "labor.fiberBlowLaborPerFoot",
      label: "Fiber placement labor rate",
      value: WORKBOOK_RATES.fiberBlowLaborPerFoot,
      unit: "$/ft",
      authorityMode: "ALGORITHM",
      source: MASTER_OSP_WORKBOOK,
      affectsCost: true,
      affectsSchedule: false,
      affectsConfidence: true,
    }),
    constraint<number>({
      key: "labor.splicingLaborPerTermination",
      label: "Splicing labor rate",
      value: WORKBOOK_RATES.splicingLaborPerTermination,
      unit: "$/termination",
      authorityMode: "ALGORITHM",
      source: MASTER_OSP_WORKBOOK,
      affectsCost: true,
      affectsSchedule: false,
      affectsConfidence: true,
    }),
    constraint<number>({
      key: "labor.projectManagerAnnualLoadedCost",
      label: "Project manager annual loaded cost",
      value: WORKBOOK_RATES.projectManagerAnnualLoadedCost,
      unit: "$/year",
      authorityMode: "ALGORITHM",
      source: MASTER_OSP_WORKBOOK,
      affectsCost: true,
      affectsSchedule: false,
      affectsConfidence: true,
    }),
    constraint<number>({
      key: "material.conduitPerFoot",
      label: "Conduit material rate",
      value: WORKBOOK_RATES.conduitMaterialPerFoot,
      unit: "$/ft",
      authorityMode: "ALGORITHM",
      source: MASTER_OSP_WORKBOOK,
      affectsCost: true,
      affectsSchedule: false,
      affectsConfidence: true,
    }),
    constraint<number>({
      key: "material.futurePathPerFoot",
      label: "FuturePath material rate",
      value: WORKBOOK_RATES.futurePathPerFoot,
      unit: "$/ft",
      authorityMode: "ALGORITHM",
      source: MASTER_OSP_WORKBOOK,
      affectsCost: true,
      affectsSchedule: false,
      affectsConfidence: true,
    }),
    constraint<number>({
      key: "material.fiber864PerFoot",
      label: "864-count fiber material rate",
      value: WORKBOOK_RATES.fiber864MaterialPerFoot,
      unit: "$/ft",
      authorityMode: "ALGORITHM",
      source: MASTER_OSP_WORKBOOK,
      affectsCost: true,
      affectsSchedule: false,
      affectsConfidence: true,
    }),
    constraint<number>({
      key: "material.handholeLaborEach",
      label: "Handhole labor rate",
      value: WORKBOOK_RATES.handholeLaborEach,
      unit: "$/ea",
      authorityMode: "ALGORITHM",
      source: MASTER_OSP_WORKBOOK,
      affectsCost: true,
      affectsSchedule: false,
      affectsConfidence: true,
    }),
    constraint<number>({
      key: "material.handholeMaterialEach",
      label: "Handhole material rate",
      value: WORKBOOK_RATES.handholeMaterialEach,
      unit: "$/ea",
      authorityMode: "ALGORITHM",
      source: MASTER_OSP_WORKBOOK,
      affectsCost: true,
      affectsSchedule: false,
      affectsConfidence: true,
    }),
    constraint<number>({
      key: "material.spliceCaseEach",
      label: "Splice case material rate",
      value: WORKBOOK_RATES.spliceCaseEach,
      unit: "$/ea",
      authorityMode: "ALGORITHM",
      source: MASTER_OSP_WORKBOOK,
      affectsCost: true,
      affectsSchedule: false,
      affectsConfidence: true,
    }),
    constraint<number>({
      key: "ila.facilityCost",
      label: "Default ILA facility profile cost",
      value: defaultIlaProfile?.totalCost ?? 0,
      unit: "$/site",
      authorityMode: "ALGORITHM",
      source: defaultIlaProfile?.workbook ?? DOBSON_ILA_WORKBOOK,
      sourceDetail: "Derived from selected ILA facility profile line items.",
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
  if (authority.authorityMode === "HUMAN_APPROVED" || authority.authorityMode === "APPROVED") return 0;
  if (authority.authorityMode === "PENDING_HUMAN" || authority.authorityMode === "HUMAN" || authority.authorityMode === "API") return Math.max(1, Math.round(unknownImpact * 0.25));
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
  dependencies: string[] = [],
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
    dependencies: dependencies.length ? dependencies : [lineAuthority.key, sectionId],
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
  dependencies?: string[];
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
    dependencies: args.dependencies ?? [lineAuthority.key, "targetDurationDays", "production", "labor"],
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
  dependencies?: string[];
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
    dependencies: args.dependencies ?? [lineAuthority.key, "physicalQuantities", "materialRate"],
    editableFields: ["quantityAssumption", "unitCost"],
  };
}

function unknownLine(sectionId: TransparentEstimateSectionId, id: string, description: string, source: string, authority?: ConstraintValue, dependencies: string[] = []): TransparentEstimateLineItem {
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
    dependencies: dependencies.length ? dependencies : [lineAuthority.key, "humanReview"],
    editableFields: ["humanReviewQuantity"],
  };
}

function buildTransparentIlaFacilities(ilaPlan: IlaPlanningResult): TransparentIlaFacility[] {
  return ilaPlan.stationObjects.map((station) => ({
    facilityId: station.stationId,
    graphNodeId: station.graphNodeId,
    stationType: station.stationType,
    station: station.station,
    ordinal: station.ordinal,
    location: station.label,
    gps: station.gps,
    milepost: station.milepost,
    routeId: station.routeId,
    scopeVersionLineage: station.scopeVersionLineage,
    facilityProfileId: station.facilityProfileId,
    facilityType: station.facilityType,
    power: station.powerProfile,
    generator: station.generatorProfile,
    hvac: station.hvacProfile,
    racks: station.facilityProfile.rackCount,
    buildingProfile: station.facilityProfile.buildingProfile,
    costProfile: station.costProfile,
    spanFromPreviousMiles: station.segmentFromPreviousMiles,
    spanLossDb: station.spanLossDb,
    remainingBudgetDb: station.remainingBudgetDb,
    recommendedRegen: station.recommendedRegen,
    coordinate: station.coordinate,
    canMove: station.canMove,
    grounding: "Workbook grounding and site electrical profile",
    civil: station.facilityProfile.civilProfile,
    fiberTermination: "Station-driven telecom fit-out, fiber guide, FDU, splice enclosure, and commissioning profile",
    equipment: station.facilityProfile.equipmentProfile,
    constructionCost: currencyValue({
      value: station.facilityProfile.civilCost + station.facilityProfile.equipmentCost,
      formula: "Facility civil/site profile + equipment profile line items.",
      source: "ILA Planning Engine",
      workbook: station.facilityProfile.workbook,
    }),
    materialCost: currencyValue({
      value: station.facilityProfile.materialCost,
      formula: "Material cost derived from selected facility profile telecom fit-out line items.",
      source: "ILA Planning Engine",
      workbook: station.facilityProfile.workbook,
    }),
    laborCost: currencyValue({
      value: station.facilityProfile.laborCost,
      formula: "Labor cost derived from selected facility profile survey, installation, testing, and commissioning line items.",
      source: "ILA Planning Engine",
      workbook: station.facilityProfile.workbook,
    }),
    total: currencyValue({
      value: station.totalCost,
      formula: "Facility profile line-item total. No static site total is used.",
      source: "ILA Planning Engine",
      workbook: station.facilityProfile.workbook,
    }),
    workbook: `${station.facilityProfile.workbook}; ${ILA_LOCATION_WORKBOOK}`,
  }));
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
  routeId?: string;
  scopeVersionLineage?: string;
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
  const dirtBorePercent = constraintNumber(constraintValues, "civil.directionalBoreDirtPercent", args.assumptionState.civilMix.hddPercent);
  const rockBorePercent = constraintNumber(constraintValues, "civil.directionalBoreRockPercent", 0);
  const openTrenchPercent = constraintNumber(constraintValues, "civil.openTrenchPercent", args.assumptionState.civilMix.openCutPercent);
  const civilMixTotalPercent = round(plowPercent + dirtBorePercent + rockBorePercent + openTrenchPercent, 2);
  const civilMix: TransparentCivilMixSummary = {
    mode: controls.civilMixMode,
    plowPercent,
    directionalBoreDirtPercent: dirtBorePercent,
    directionalBoreRockPercent: rockBorePercent,
    openTrenchPercent,
    totalPercent: civilMixTotalPercent,
    warning: Math.abs(civilMixTotalPercent - 100) > 0.1 ? `Civil mix totals ${civilMixTotalPercent}%; expected 100%.` : null,
  };
  const plowFeet = Math.round(routeFeet * (plowPercent / 100));
  const dirtBoreFeet = Math.round(routeFeet * (dirtBorePercent / 100));
  const rockBoreFeet = Math.round(routeFeet * (rockBorePercent / 100));
  const openTrenchFeet = Math.round(routeFeet * (openTrenchPercent / 100));
  const rockPercentAuthority = authorityFor(constraintValues, "civil.directionalBoreRockPercent");
  const rockAdderAuthority = authorityFor(constraintValues, "civil.rockAdderPerFoot");
  const rockAdderPerFoot = authorityModeCostIncluded(rockAdderAuthority) && typeof rockAdderAuthority.value === "number" ? rockAdderAuthority.value : 30;
  const plowLaborPerFoot = constraintNumber(constraintValues, "labor.plowLaborPerFoot", WORKBOOK_RATES.plowLaborPerFoot);
  const dirtBoreLaborPerFoot = constraintNumber(constraintValues, "labor.dirtBoreLaborPerFoot", WORKBOOK_RATES.dirtBoreLaborPerFoot);
  const openTrenchLaborPerFoot = constraintNumber(constraintValues, "labor.openTrenchLaborPerFoot", WORKBOOK_RATES.openTrenchLaborPerFoot);
  const fiberBlowLaborPerFoot = constraintNumber(constraintValues, "labor.fiberBlowLaborPerFoot", WORKBOOK_RATES.fiberBlowLaborPerFoot);
  const splicingLaborPerTermination = constraintNumber(constraintValues, "labor.splicingLaborPerTermination", WORKBOOK_RATES.splicingLaborPerTermination);
  const projectManagerAnnualLoadedCost = constraintNumber(constraintValues, "labor.projectManagerAnnualLoadedCost", WORKBOOK_RATES.projectManagerAnnualLoadedCost);
  const conduitMaterialPerFoot = constraintNumber(constraintValues, "material.conduitPerFoot", WORKBOOK_RATES.conduitMaterialPerFoot);
  const futurePathPerFoot = constraintNumber(constraintValues, "material.futurePathPerFoot", WORKBOOK_RATES.futurePathPerFoot);
  const fiber864MaterialPerFoot = constraintNumber(constraintValues, "material.fiber864PerFoot", WORKBOOK_RATES.fiber864MaterialPerFoot);
  const handholeLaborEach = constraintNumber(constraintValues, "material.handholeLaborEach", WORKBOOK_RATES.handholeLaborEach);
  const handholeMaterialEach = constraintNumber(constraintValues, "material.handholeMaterialEach", WORKBOOK_RATES.handholeMaterialEach);
  const spliceCaseEach = constraintNumber(constraintValues, "material.spliceCaseEach", WORKBOOK_RATES.spliceCaseEach);
  const stationCount = Math.max(2, Math.ceil(routeFeet / WORKBOOK_RATES.stationSpacingFeet) + 1);
  const vaultCount = Math.max(2, Math.ceil(routeMiles / 8));
  const handholeCount = Math.max(4, Math.ceil(routeFeet / WORKBOOK_RATES.handholeSpacingFeet));
  const ilaPlan = buildIlaPlanningResult({
    estimateId: args.estimateId,
    routeId: args.routeId,
    scopeVersionLineage: args.scopeVersionLineage,
    aLabel: args.aLabel,
    zLabel: args.zLabel,
    geometry: args.geometry,
    routeMiles,
    controls: controls.ilaPlanning,
  });
  const ilaCount = ilaPlan.stationObjects.length;
  const regenCount = ilaPlan.stationObjects.filter((station) => station.stationType === "INTERMEDIATE").length;
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
      unitCost: plowLaborPerFoot,
      productionFeetPerDay: constraintProduction(constraintValues, "production.plowFeetPerDay", controls.production.plowFeetPerDay),
      targetDurationDays,
      source: "Production Engine",
      workbook: MASTER_OSP_WORKBOOK,
      quantityFormula: "Route feet x selected plow percentage.",
      unitCostFormula: "Master OSP Build Metrics: Plow Labor / Plow Ft / Labor.",
      productionFormula: "Phase 4 default: Plowing 5,280 ft/day.",
      authority: authorityFor(constraintValues, "civil.plowPercent"),
      dependencies: ["civil.plowPercent", "labor.plowLaborPerFoot", "production.plowFeetPerDay", "targetDurationDays", "financial"],
    }),
    laborLine({
      lineItemId: `${args.estimateId}:LABOR:DIRT-BORE`,
      description: "Directional bore - dirt",
      quantity: dirtBoreFeet,
      unitCost: dirtBoreLaborPerFoot,
      productionFeetPerDay: constraintProduction(constraintValues, "production.directionalBoreDirtFeetPerDay", controls.production.directionalBoreDirtFeetPerDay),
      targetDurationDays,
      source: "Production Engine",
      workbook: MASTER_OSP_WORKBOOK,
      quantityFormula: "Route feet x selected directional bore percentage; rock quantity remains UNKNOWN.",
      unitCostFormula: "Master OSP Build Metrics: Bore Labor / Bore Ft / Labor.",
      productionFormula: "Phase 4 default: Directional Bore Dirt 600 ft/day.",
      authority: authorityFor(constraintValues, "civil.directionalBoreDirtPercent"),
      dependencies: ["civil.directionalBoreDirtPercent", "labor.dirtBoreLaborPerFoot", "production.directionalBoreDirtFeetPerDay", "targetDurationDays", "financial"],
    }),
    laborLine({
      lineItemId: `${args.estimateId}:LABOR:ROCK-ADDER`,
      description: "Directional bore - rock",
      quantity: rockBoreFeet,
      unitCost: dirtBoreLaborPerFoot + rockAdderPerFoot,
      productionFeetPerDay: constraintProduction(constraintValues, "production.directionalBoreRockFeetPerDay", controls.production.directionalBoreRockFeetPerDay),
      targetDurationDays,
      source: rockPercentAuthority.source,
      workbook: MASTER_OSP_WORKBOOK,
      quantityFormula: "Route feet x directional bore rock percentage.",
      unitCostFormula: "Directional bore dirt labor rate + explicit rock adder per foot.",
      productionFormula: "Phase 4 default: Directional Bore Rock 300 ft/day.",
      authority: rockPercentAuthority,
      dependencies: ["civil.directionalBoreRockPercent", "civil.rockAdderPerFoot", "labor.dirtBoreLaborPerFoot", "production.directionalBoreRockFeetPerDay", "targetDurationDays", "contingency", "margin"],
    }),
    laborLine({
      lineItemId: `${args.estimateId}:LABOR:OPEN-TRENCH`,
      description: "Open trench - dirt",
      quantity: openTrenchFeet,
      unitCost: openTrenchLaborPerFoot,
      productionFeetPerDay: constraintProduction(constraintValues, "production.openTrenchDirtFeetPerDay", controls.production.openTrenchDirtFeetPerDay),
      targetDurationDays,
      source: "Estimator default pending workbook-specific open trench rate",
      quantityFormula: "Route feet x selected open trench percentage; rock quantity remains UNKNOWN.",
      unitCostFormula: "Existing Hyperlinx development-seed open trench rate.",
      productionFormula: "Phase 4 default: Open Trench Dirt 300 ft/day.",
      authority: authorityFor(constraintValues, "civil.openTrenchPercent"),
      dependencies: ["civil.openTrenchPercent", "labor.openTrenchLaborPerFoot", "production.openTrenchDirtFeetPerDay", "targetDurationDays", "financial"],
    }),
    laborLine({
      lineItemId: `${args.estimateId}:LABOR:FIBER-BLOWING`,
      description: "Fiber placement - blowing",
      quantity: purchasedFiberFeet,
      unitCost: fiberBlowLaborPerFoot,
      productionFeetPerDay: constraintProduction(constraintValues, "production.fiberBlowingFeetPerDay", controls.production.fiberBlowingFeetPerDay),
      targetDurationDays,
      source: "Material / Labor Engine",
      workbook: MASTER_OSP_WORKBOOK,
      quantityFormula: "Purchased fiber feet = route fiber + slack + waste.",
      unitCostFormula: "Master OSP Build Metrics: Blow Fiber Labor / Per Fiber Material Calc / Labor.",
      productionFormula: "Separate blowing production is user-editable; default remains synthesis pending because the workbook provides rate but not ft/day.",
      authority: authorityFor(constraintValues, "production.fiberBlowingFeetPerDay"),
      dependencies: ["production.fiberBlowingFeetPerDay", "labor.fiberBlowLaborPerFoot", "physicalQuantities.purchasedFiberFeet", "targetDurationDays"],
    }),
    laborLine({
      lineItemId: `${args.estimateId}:LABOR:SPLICING`,
      description: "Splicing by fiber terminations",
      quantity: fiberTerminations,
      unitCost: splicingLaborPerTermination,
      productionFeetPerDay: constraintProduction(constraintValues, "production.splicingTerminationsPerDay", controls.production.splicingTerminationsPerDay),
      targetDurationDays,
      source: "Labor Engine",
      workbook: MASTER_OSP_WORKBOOK,
      quantityFormula: "Field splice locations x 864 fibers x 2 terminations.",
      unitCostFormula: "Master OSP Build Metrics: Splicing Labor / Fiber Ct factor / Labor.",
      productionFormula: "Splicing production is user-editable; default remains synthesis pending until estimator sets terminations/day.",
      costFormula: "Fiber terminations x splicing labor per termination.",
      authority: authorityFor(constraintValues, "production.splicingTerminationsPerDay"),
      dependencies: ["production.splicingTerminationsPerDay", "labor.splicingLaborPerTermination", "physicalQuantities.fiberTerminations", "targetDurationDays"],
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
  const projectManagerCost = (Math.max(projectScheduleDays, targetDurationDays) / 260) * projectManagerAnnualLoadedCost;
  const projectManagementLine = laborLine({
    lineItemId: `${args.estimateId}:LABOR:PROJECT-MANAGEMENT`,
    description: "Project management",
    quantity: Math.max(projectScheduleDays, targetDurationDays),
    unitCost: projectManagerAnnualLoadedCost / 260,
    productionFeetPerDay: 1,
    targetDurationDays,
    source: "Crew Optimization",
    workbook: MASTER_OSP_WORKBOOK,
    quantityFormula: "Max calculated production schedule days and customer target duration.",
    unitCostFormula: "Master OSP Build Metrics: Project Manager Labor annual loaded comp / 260 working days.",
    productionFormula: "One project-management day per elapsed project day.",
    costFormula: "Project management days x daily loaded project manager cost.",
    authority: authorityFor(constraintValues, "labor.assumptions"),
    dependencies: ["labor.projectManagerAnnualLoadedCost", "targetDurationDays", "projectScheduleDays"],
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
      unitCost: conduitMaterialPerFoot,
      source: "Material Engine",
      workbook: MASTER_OSP_WORKBOOK,
      formula: "Route feet x standard duct package conduit count + conduit waste.",
      authority: authorityFor(constraintValues, "bom.assumptions"),
      dependencies: ["material.conduitPerFoot", "physicalQuantities.conduitFeet", "civilMix"],
    }),
    materialLine({
      lineItemId: `${args.estimateId}:MAT:FIBER-864`,
      description: "864-count shielded fiber material",
      quantity: purchasedFiberFeet,
      unit: "ft",
      unitCost: fiber864MaterialPerFoot,
      source: "Material Engine",
      workbook: MASTER_OSP_WORKBOOK,
      formula: "Route fiber feet + vault slack + handhole slack + fiber waste.",
      authority: authorityFor(constraintValues, "bom.assumptions"),
      dependencies: ["material.fiber864PerFoot", "physicalQuantities.purchasedFiberFeet"],
    }),
    materialLine({
      lineItemId: `${args.estimateId}:MAT:HANDHOLE-LABOR`,
      description: "Handhole labor",
      quantity: handholeCount,
      unit: "ea",
      unitCost: handholeLaborEach,
      source: "Material Engine",
      workbook: MASTER_OSP_WORKBOOK,
      formula: "Route feet / 2,500 ft handhole spacing.",
      authority: authorityFor(constraintValues, "bom.assumptions"),
      dependencies: ["material.handholeLaborEach", "physicalQuantities.handholeCount"],
    }),
    materialLine({
      lineItemId: `${args.estimateId}:MAT:HANDHOLE-MATERIAL`,
      description: "Handhole material",
      quantity: handholeCount,
      unit: "ea",
      unitCost: handholeMaterialEach,
      source: "Material Engine",
      workbook: MASTER_OSP_WORKBOOK,
      formula: "Route feet / 2,500 ft handhole spacing.",
      authority: authorityFor(constraintValues, "bom.assumptions"),
      dependencies: ["material.handholeMaterialEach", "physicalQuantities.handholeCount"],
    }),
    materialLine({
      lineItemId: `${args.estimateId}:MAT:SPLICE-CASE`,
      description: "Splice case materials",
      quantity: spliceCaseCount,
      unit: "ea",
      unitCost: spliceCaseEach,
      source: "Material Engine",
      workbook: MASTER_OSP_WORKBOOK,
      formula: "Field splice locations derived from purchased fiber feet / reel length.",
      authority: authorityFor(constraintValues, "bom.assumptions"),
      dependencies: ["material.spliceCaseEach", "physicalQuantities.spliceCaseCount"],
    }),
  ];

  const futurePathLine = args.assumptionState.materials.futurePathEnabled
    ? materialLine({
        lineItemId: `${args.estimateId}:MAT:FUTUREPATH`,
        description: "4-way FuturePath 18/14mm and couplers",
        quantity: routeFeet * args.assumptionState.materials.futurePathMultiplier,
        unit: "ft",
        unitCost: futurePathPerFoot,
        source: "Material Engine",
        workbook: MASTER_OSP_WORKBOOK,
        formula: "Route feet x FuturePath multiplier when enabled by commercial assumption.",
        authority: authorityFor(constraintValues, "bom.assumptions"),
        dependencies: ["material.futurePathPerFoot", "physicalQuantities.routeFeet", "materials.futurePathMultiplier"],
      })
    : null;
  const allMaterialLines = futurePathLine ? [...materialLines, futurePathLine] : materialLines;

  const ilaFacilities = buildTransparentIlaFacilities(ilaPlan);
  const ilaTotal = ilaPlan.totalCost;
  const ilaLine = totalLine(
    "ILA_FACILITIES",
    "ILA",
    `${args.estimateId}:ILA:STATION-PLAN`,
    "Station-based ILA facilities",
    ilaTotal,
    "ILA Planning Engine",
    "Sum of station-object facility profile costs derived from workbook line items.",
    authorityFor(constraintValues, "ila.assumptions"),
  );
  ilaLine.workbook = `${PER_ILA_COST_WORKBOOK}; ${DOBSON_ILA_WORKBOOK}; ${ILA_LOCATION_WORKBOOK}`;

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
  const contingencyCategories: TransparentContingencyCategory[] = CONTINGENCY_CATEGORIES.map((category) => {
    const authority = authorityFor(constraintValues, category.key);
    const percent = constraintNumber(constraintValues, category.key, category.percent);
    return {
      key: category.key,
      label: category.label,
      percent,
      cost: constructionCost * (percent / 100),
      authority,
    };
  });
  const contingency = contingencyCategories.reduce((total, category) => total + category.cost, 0);
  const overhead = constructionCost * (controls.financial.overheadPercent / 100);
  const costBeforeMarkup = constructionCost + contingency + overhead;
  const markup = costBeforeMarkup * (controls.financial.markupPercent / 100);
  const sellPrice = costBeforeMarkup + markup;
  const margin = sellPrice > 0 ? ((sellPrice - costBeforeMarkup) / sellPrice) * 100 : 0;
  const financialAuthority = authorityFor(constraintValues, "financial.assumptions");
  const omAuthority = authorityFor(constraintValues, "financial.omCostPerRouteMile");
  const omLifecycleComponents: TransparentOmLifecycleComponent[] = OM_LIFECYCLE_COMPONENTS.map((component) => {
    const authority = authorityFor(constraintValues, component.key);
    const annualCostPerRouteMile = constraintNumber(constraintValues, component.key, component.annualPerRouteMile);
    return {
      key: component.key,
      label: component.label,
      annualCostPerRouteMile,
      annualCost: routeMiles * annualCostPerRouteMile,
      authority,
    };
  });
  const annualOmPerRouteMile = omLifecycleComponents.reduce((total, component) => total + component.annualCostPerRouteMile, 0);
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
      formula: "Sum of station-object ILA facility profile totals.",
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
      formula: "Construction cost x sum of editable contingency category percentages.",
      source: "Categorized contingency model",
      workbook: MASTER_OSP_WORKBOOK,
      editable: true,
      userOverride: `${round(contingencyCategories.reduce((total, category) => total + category.percent, 0), 2)}% categorized`,
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
      formula: "Route miles x monthly Layer 1 infrastructure lifecycle management per route mile.",
      source: "Infrastructure Lifecycle Management",
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

  const opticalEngineeringPreview: TransparentOpticalEngineeringPreview = {
    routeLengthMiles: routeMiles,
    routeLengthKm: round(routeMiles * 1.609344, 2),
    attenuationDb: round(Math.max(0, ...ilaPlan.spans.map((span) => span.attenuationLossDb)), 2),
    approximateSpliceLossDb: round(Math.max(0, ...ilaPlan.spans.map((span) => span.spliceLossDb)), 2),
    connectorLossDb: round(Math.max(0, ...ilaPlan.spans.map((span) => span.connectorLossDb)), 2),
    estimatedEndToEndLossDb: ilaPlan.maxSpanLossDb,
    estimatedSpanLengthMiles: ilaPlan.averageSpanMiles,
    estimatedIlaSpacingMiles: ilaPlan.maxSpanMiles,
    preliminaryEngineeringEstimate: true,
  };
  const opticalMetrics: TransparentEstimateMetric[] = [
    { metricId: "OPTICAL-ROUTE-LENGTH", label: "Route length", value: numericValue({ value: opticalEngineeringPreview.routeLengthMiles, formula: "Commercial corridor route miles.", source: "Preliminary optical estimate", suffix: " mi" }) },
    { metricId: "OPTICAL-ATTENUATION", label: "Max span attenuation", value: numericValue({ value: opticalEngineeringPreview.attenuationDb, formula: "Station span miles x attenuation dB/km.", source: "ILA Planning Engine", suffix: " dB" }) },
    { metricId: "OPTICAL-SPLICE-LOSS", label: "Span splice loss", value: numericValue({ value: opticalEngineeringPreview.approximateSpliceLossDb, formula: "Station-driven splice loss allowance per span.", source: "ILA Planning Engine", suffix: " dB" }) },
    { metricId: "OPTICAL-CONNECTOR-LOSS", label: "Span connector loss", value: numericValue({ value: opticalEngineeringPreview.connectorLossDb, formula: "Station-driven connector loss allowance per span.", source: "ILA Planning Engine", suffix: " dB" }) },
    { metricId: "OPTICAL-END-TO-END", label: "Max span loss", value: numericValue({ value: opticalEngineeringPreview.estimatedEndToEndLossDb, formula: "Max station span attenuation + connector + splice loss.", source: "ILA Planning Engine", suffix: " dB" }) },
    { metricId: "OPTICAL-SPAN", label: "Average span length", value: numericValue({ value: opticalEngineeringPreview.estimatedSpanLengthMiles, formula: "Station-object span average.", source: "ILA Planning Engine", suffix: " mi" }) },
    { metricId: "OPTICAL-ILA-SPACING", label: "Max span length", value: numericValue({ value: opticalEngineeringPreview.estimatedIlaSpacingMiles, formula: "Max station-object span length.", source: "ILA Planning Engine", suffix: " mi" }) },
  ];

  const unknownAuthorityCount = Object.values(constraintValues).filter((constraintValue) => constraintValue.affectsConfidence && constraintValue.authorityMode === "UNKNOWN").length;
  const approvedAuthorityCount = Object.values(constraintValues).filter((constraintValue) => constraintValue.authorityMode === "HUMAN_APPROVED" || constraintValue.authorityMode === "APPROVED").length;
  const humanAuthorityCount = Object.values(constraintValues).filter((constraintValue) => constraintValue.authorityMode === "PENDING_HUMAN" || constraintValue.authorityMode === "HUMAN" || constraintValue.authorityMode === "API").length;
  const financialApproved = financialAuthority.authorityMode === "HUMAN_APPROVED" || financialAuthority.authorityMode === "APPROVED";
  const readinessDrivers: TransparentCommercialReadiness["drivers"] = [
    { label: "Geometry", status: args.geometry.length > 1 ? "Ready" : "Blocked", impact: args.geometry.length > 1 ? 0 : 30, reason: args.geometry.length > 1 ? "Route geometry is present." : "Route geometry is missing." },
    { label: "Estimate", status: constructionCost > 0 ? "Ready" : "Blocked", impact: constructionCost > 0 ? 0 : 25, reason: constructionCost > 0 ? "Known construction cost is calculated." : "Known construction cost is not available." },
    { label: "Unknown Constraints", status: unknownAuthorityCount <= 3 ? "Ready" : "Review", impact: Math.min(20, unknownAuthorityCount * 2), reason: `${unknownAuthorityCount} authority-aware constraints remain unknown.` },
    { label: "Human Review", status: humanAuthorityCount + approvedAuthorityCount > 0 ? "Ready" : "Review", impact: humanAuthorityCount + approvedAuthorityCount > 0 ? 0 : 8, reason: humanAuthorityCount + approvedAuthorityCount > 0 ? "At least one estimator-supplied or approved assumption exists." : "No human or approved estimate calibration has been captured." },
    { label: "Financial Review", status: financialApproved ? "Ready" : "Review", impact: financialApproved ? 0 : 8, reason: `Financial assumptions are ${financialAuthority.authorityMode}.` },
    { label: "Proposal Completeness", status: sellPrice > 0 && mrc >= 0 ? "Ready" : "Review", impact: sellPrice > 0 && mrc >= 0 ? 0 : 10, reason: "NRC/MRC preview and proposal summary values are present." },
    { label: "Customer Decisions", status: "Review", impact: 6, reason: "Customer decisions remain outside the estimator until proposal review." },
  ];
  const readinessScore = Math.max(0, 100 - readinessDrivers.reduce((total, driver) => total + driver.impact, 0));
  const commercialReadiness: TransparentCommercialReadiness = {
    score: readinessScore,
    level: readinessScore >= 85 ? "READY" : readinessScore >= 55 ? "REVIEW" : "BLOCKED",
    drivers: readinessDrivers,
  };
  const readinessMetrics: TransparentEstimateMetric[] = [
    { metricId: "COMMERCIAL-READINESS-SCORE", label: "Commercial readiness", value: numericValue({ value: commercialReadiness.score, formula: "100 minus commercial readiness impacts.", source: "Commercial Readiness", suffix: "%" }) },
    { metricId: "COMMERCIAL-READINESS-LEVEL", label: "Readiness level", value: textMetricValue({ value: commercialReadiness.level, formula: "Readiness score band.", source: "Commercial Readiness" }) },
  ];

  const contingencyLines = contingencyCategories.map((category) => totalLine(
    "CONTINGENCY",
    "CONTINGENCY",
    `${args.estimateId}:${category.key.toUpperCase().replaceAll(".", ":")}`,
    category.label,
    category.cost,
    "Categorized contingency model",
    `Construction cost x ${category.percent}% ${category.label}.`,
    category.authority,
    [category.key, "constructionCost", "financialModel", "margin"],
  ));
  const omLifecycleLines = omLifecycleComponents.map((component) => totalLine(
    "LAYER_1_LIFECYCLE",
    "LIFECYCLE",
    `${args.estimateId}:${component.key.toUpperCase().replaceAll(".", ":")}`,
    component.label,
    component.annualCost,
    "Infrastructure Lifecycle Management",
    `Route miles x ${component.annualCostPerRouteMile} annual dollars per route mile.`,
    component.authority,
    [component.key, "routeMiles", "mrc", "financialSummary"],
  ));

  const sections = [
    buildSection("EXECUTIVE_SUMMARY", "Executive Summary", "Known cost, price, duration, and confidence.", [
      totalLine("EXECUTIVE_SUMMARY", "FINANCIAL", `${args.estimateId}:SUMMARY:CONSTRUCTION`, "Known cost", costBeforeMarkup, "Executive Summary", "Direct construction cost + contingency + overhead.", financialAuthority),
      totalLine("EXECUTIVE_SUMMARY", "FINANCIAL", `${args.estimateId}:SUMMARY:SELL`, "Sell price", sellPrice, "Executive Summary", financialModel.sellPrice.formula, financialAuthority),
    ], [...financialMetrics, ...confidenceMetrics, ...readinessMetrics]),
    buildSection("CORRIDOR", "Corridor", "Physical corridor quantities derived from routed geometry.", [], corridorMetrics),
    buildSection("FIBER", "Fiber", "Fiber footage, slack, waste, and terminations.", [], fiberMetrics),
    buildSection("OPTICAL_ENGINEERING_PREVIEW", "Optical Engineering Preview", "Preliminary Layer 1 optical metrics for future engineering workflows.", [], opticalMetrics),
    buildSection("OSP_CONSTRUCTION", "OSP Construction", "Civil production and construction line items.", ospLines),
    buildSection("ILA_FACILITIES", "ILA Facilities", "Station-based bookend and intermediate Hyperlinx-managed ILA sites.", [ilaLine]),
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
    buildSection("CONTINGENCY", "Contingency", "Editable categorized contingency, separate from confidence.", contingencyLines),
    buildSection("FINANCIAL_MODEL", "Financial Model", "Financial assumptions are isolated from engineering quantities.", [
      totalLine("FINANCIAL_MODEL", "FINANCIAL", `${args.estimateId}:FINANCIAL:OVERHEAD`, "Overhead", overhead, "Financial assumption", financialModel.overhead.formula, financialAuthority),
      totalLine("FINANCIAL_MODEL", "FINANCIAL", `${args.estimateId}:FINANCIAL:MARKUP`, "Markup", markup, "Financial assumption", financialModel.markup.formula, financialAuthority),
      unknownLine("FINANCIAL_MODEL", `${args.estimateId}:FINANCIAL:ROI`, "ROI / IRR / Payback", "Revenue terms not set", financialAuthority),
    ], financialMetrics),
    buildSection("REVENUE", "Revenue", "NRC/MRC preview; contract terms are not authority.", [
      totalLine("REVENUE", "FINANCIAL", `${args.estimateId}:REVENUE:NRC`, "NRC", sellPrice, "Commercial Proposal", financialModel.nrc.formula, financialAuthority),
      totalLine("REVENUE", "FINANCIAL", `${args.estimateId}:REVENUE:MRC`, "MRC", mrc, "Revenue", financialModel.mrc.formula, omAuthority),
    ]),
    buildSection("LAYER_1_LIFECYCLE", "Layer 1 Lifecycle", "Infrastructure lifecycle management and optional recurring Layer 1 opportunities.", omLifecycleLines),
    buildSection("ASSUMPTIONS", "Assumptions", "Editable production and financial assumptions.", [], assumptionMetrics),
    buildSection("ESTIMATE_CONFIDENCE", "Estimate Confidence", "Confidence changes independently from construction cost.", unknownLines, confidenceMetrics),
  ];
  const humanAuditTrail = controls.humanAuditTrail ?? [];
  const auditTrail = auditEntries(sections, financialModel, unknownQuantities, financialAuthority, omAuthority);
  sections.push(buildSection("ESTIMATE_AUDIT", "Estimate Audit", "Every displayed total exposes value, formula, source, workbook, override, and calculation status.", [], [
    { metricId: "AUDIT-COUNT", label: "Audit entries", value: numericValue({ value: auditTrail.length + humanAuditTrail.length, formula: "Count of generated audit entries and append-only human changes.", source: "Estimate Audit" }) },
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
    ilaPlan,
    unknownQuantities,
    constraintValues,
    civilMix,
    estimateStatus: commercialReadiness.level === "READY" ? "PROPOSAL_READY" : "CURRENT",
    commercialReadiness,
    contingencyCategories,
    omLifecycleComponents,
    layer1RecurringOpportunities: LAYER_1_RECURRING_OPPORTUNITIES,
    opticalEngineeringPreview,
    confidence,
    financialModel,
    auditTrail,
    humanAuditTrail,
    totalKnownCost: money(constructionCost + contingency + overhead),
    sellPrice: money(sellPrice),
    nrc: money(sellPrice),
    mrc: money(mrc),
    grossMarginPercent: round(margin, 1),
    noScopeVersionCreation: true,
    noInventoryMutation: true,
  };
}
