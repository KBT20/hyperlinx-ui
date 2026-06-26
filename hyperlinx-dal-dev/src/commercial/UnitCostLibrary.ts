import type { CommercialCategory, CommercialUnit } from "./CommercialItemCatalog";

export type UnitCostConfidence = "LOW" | "MEDIUM" | "HIGH" | "VERIFIED";
export type UnitCostStatus = "DEVELOPMENT" | "ACTIVE" | "SUPERSEDED" | "FUTURE";

export interface UnitCostItem {
  itemId: string;
  description: string;
  category: CommercialCategory;
  unit: CommercialUnit;
  unitCost: number;
  costBasis: string;
  currency: "USD";
  version: string;
  effectiveDate: string;
  confidence: UnitCostConfidence;
  status: UnitCostStatus;
}

const BASIS = "Representative development value for architecture validation; not production pricing.";

export const UNIT_COST_LIBRARY_VERSION = "DEV-2026-06";

export const UNIT_COST_LIBRARY: readonly UnitCostItem[] = Object.freeze([
  { itemId: "COMM-CIVIL-PLOW-FOOT", description: "Plow construction", category: "CIVIL", unit: "FOOT", unitCost: 22, costBasis: BASIS, currency: "USD", version: UNIT_COST_LIBRARY_VERSION, effectiveDate: "2026-06-26", confidence: "LOW", status: "DEVELOPMENT" },
  { itemId: "COMM-CIVIL-HDD-FOOT", description: "HDD / directional bore construction", category: "CIVIL", unit: "FOOT", unitCost: 62, costBasis: BASIS, currency: "USD", version: UNIT_COST_LIBRARY_VERSION, effectiveDate: "2026-06-26", confidence: "LOW", status: "DEVELOPMENT" },
  { itemId: "COMM-CIVIL-OPEN-TRENCH-FOOT", description: "Open cut / open trench construction", category: "CIVIL", unit: "FOOT", unitCost: 38, costBasis: BASIS, currency: "USD", version: UNIT_COST_LIBRARY_VERSION, effectiveDate: "2026-06-26", confidence: "LOW", status: "DEVELOPMENT" },
  { itemId: "COMM-CIVIL-URBAN-FOOT", description: "Urban construction allowance", category: "CIVIL", unit: "FOOT", unitCost: 72, costBasis: BASIS, currency: "USD", version: UNIT_COST_LIBRARY_VERSION, effectiveDate: "2026-06-26", confidence: "LOW", status: "DEVELOPMENT" },
  { itemId: "COMM-CIVIL-ROAD-BORE-EACH", description: "Road bore / road crossing allowance", category: "CIVIL", unit: "EACH", unitCost: 18500, costBasis: BASIS, currency: "USD", version: UNIT_COST_LIBRARY_VERSION, effectiveDate: "2026-06-26", confidence: "LOW", status: "DEVELOPMENT" },
  { itemId: "COMM-CIVIL-RAILROAD-BORE-EACH", description: "Railroad bore / railroad crossing allowance", category: "CIVIL", unit: "EACH", unitCost: 125000, costBasis: BASIS, currency: "USD", version: UNIT_COST_LIBRARY_VERSION, effectiveDate: "2026-06-26", confidence: "LOW", status: "DEVELOPMENT" },
  { itemId: "COMM-CIVIL-WATER-CROSSING-EACH", description: "Water crossing allowance", category: "CIVIL", unit: "EACH", unitCost: 85000, costBasis: BASIS, currency: "USD", version: UNIT_COST_LIBRARY_VERSION, effectiveDate: "2026-06-26", confidence: "LOW", status: "DEVELOPMENT" },
  { itemId: "COMM-CIVIL-BRIDGE-ATTACHMENT-EACH", description: "Bridge attachment allowance", category: "CIVIL", unit: "EACH", unitCost: 65000, costBasis: BASIS, currency: "USD", version: UNIT_COST_LIBRARY_VERSION, effectiveDate: "2026-06-26", confidence: "LOW", status: "DEVELOPMENT" },
  { itemId: "COMM-CIVIL-UNKNOWN-CONSTRAINT-EACH", description: "Unknown constraint allowance", category: "CIVIL", unit: "EACH", unitCost: 35000, costBasis: BASIS, currency: "USD", version: UNIT_COST_LIBRARY_VERSION, effectiveDate: "2026-06-26", confidence: "LOW", status: "DEVELOPMENT" },
  { itemId: "COMM-MAT-CONDUIT-FOOT", description: "Standard Duct Package (3 x 1.25\" HDPE)", category: "MATERIALS", unit: "FOOT", unitCost: 2.25, costBasis: BASIS, currency: "USD", version: UNIT_COST_LIBRARY_VERSION, effectiveDate: "2026-06-26", confidence: "LOW", status: "DEVELOPMENT" },
  { itemId: "COMM-MAT-INNERDUCT-FOOT", description: "FuturePath (Optional)", category: "MATERIALS", unit: "FOOT", unitCost: 0, costBasis: "Optional support only; FuturePath is disabled by default and does not replace standard duct.", currency: "USD", version: UNIT_COST_LIBRARY_VERSION, effectiveDate: "2026-06-26", confidence: "LOW", status: "FUTURE" },
  { itemId: "COMM-MAT-FIBER-FOOT", description: "Fiber material", category: "MATERIALS", unit: "FOOT", unitCost: 1.85, costBasis: BASIS, currency: "USD", version: UNIT_COST_LIBRARY_VERSION, effectiveDate: "2026-06-26", confidence: "LOW", status: "DEVELOPMENT" },
  { itemId: "COMM-MAT-VAULT-EACH", description: "Vault material and placement", category: "MATERIALS", unit: "EACH", unitCost: 24500, costBasis: BASIS, currency: "USD", version: UNIT_COST_LIBRARY_VERSION, effectiveDate: "2026-06-26", confidence: "LOW", status: "DEVELOPMENT" },
  { itemId: "COMM-MAT-HANDHOLE-EACH", description: "Handhole material and placement", category: "MATERIALS", unit: "EACH", unitCost: 8500, costBasis: BASIS, currency: "USD", version: UNIT_COST_LIBRARY_VERSION, effectiveDate: "2026-06-26", confidence: "LOW", status: "DEVELOPMENT" },
  { itemId: "COMM-MAT-MARKER-EACH", description: "Route marker", category: "MATERIALS", unit: "EACH", unitCost: 325, costBasis: BASIS, currency: "USD", version: UNIT_COST_LIBRARY_VERSION, effectiveDate: "2026-06-26", confidence: "LOW", status: "DEVELOPMENT" },
  { itemId: "COMM-MAT-SPLICE-CASE-EACH", description: "Splice case", category: "MATERIALS", unit: "EACH", unitCost: 1800, costBasis: BASIS, currency: "USD", version: UNIT_COST_LIBRARY_VERSION, effectiveDate: "2026-06-26", confidence: "LOW", status: "DEVELOPMENT" },
  { itemId: "COMM-LABOR-FIBER-PLACEMENT-FOOT", description: "Cable placement / fiber blowing", category: "LABOR", unit: "FOOT", unitCost: 0.7, costBasis: BASIS, currency: "USD", version: UNIT_COST_LIBRARY_VERSION, effectiveDate: "2026-06-26", confidence: "LOW", status: "DEVELOPMENT" },
  { itemId: "COMM-LABOR-SPLICING-EACH", description: "Splicing labor", category: "LABOR", unit: "EACH", unitCost: 4200, costBasis: BASIS, currency: "USD", version: UNIT_COST_LIBRARY_VERSION, effectiveDate: "2026-06-26", confidence: "LOW", status: "DEVELOPMENT" },
  { itemId: "COMM-LABOR-TESTING-EACH", description: "OTDR and acceptance testing", category: "LABOR", unit: "EACH", unitCost: 1600, costBasis: BASIS, currency: "USD", version: UNIT_COST_LIBRARY_VERSION, effectiveDate: "2026-06-26", confidence: "LOW", status: "DEVELOPMENT" },
  { itemId: "COMM-LABOR-RESTORATION-FOOT", description: "Restoration allowance", category: "LABOR", unit: "FOOT", unitCost: 3.4, costBasis: BASIS, currency: "USD", version: UNIT_COST_LIBRARY_VERSION, effectiveDate: "2026-06-26", confidence: "LOW", status: "DEVELOPMENT" },
  { itemId: "COMM-ENG-SURVEY-MILE", description: "Survey allowance", category: "ENGINEERING", unit: "MILE", unitCost: 2200, costBasis: BASIS, currency: "USD", version: UNIT_COST_LIBRARY_VERSION, effectiveDate: "2026-06-26", confidence: "LOW", status: "DEVELOPMENT" },
  { itemId: "COMM-ENG-DESIGN-MILE", description: "Design engineering allowance", category: "ENGINEERING", unit: "MILE", unitCost: 9500, costBasis: BASIS, currency: "USD", version: UNIT_COST_LIBRARY_VERSION, effectiveDate: "2026-06-26", confidence: "LOW", status: "DEVELOPMENT" },
  { itemId: "COMM-ENG-PERMIT-EACH", description: "Permitting allowance", category: "ENGINEERING", unit: "EACH", unitCost: 7500, costBasis: BASIS, currency: "USD", version: UNIT_COST_LIBRARY_VERSION, effectiveDate: "2026-06-26", confidence: "LOW", status: "DEVELOPMENT" },
  { itemId: "COMM-ENG-INSPECTION-MILE", description: "Inspection allowance", category: "ENGINEERING", unit: "MILE", unitCost: 1800, costBasis: BASIS, currency: "USD", version: UNIT_COST_LIBRARY_VERSION, effectiveDate: "2026-06-26", confidence: "LOW", status: "DEVELOPMENT" },
  { itemId: "COMM-GC-MOBILIZATION-ALLOWANCE", description: "Mobilization", category: "GENERAL_CONDITIONS", unit: "ALLOWANCE", unitCost: 35000, costBasis: BASIS, currency: "USD", version: UNIT_COST_LIBRARY_VERSION, effectiveDate: "2026-06-26", confidence: "LOW", status: "DEVELOPMENT" },
  { itemId: "COMM-GC-TRAFFIC-CONTROL-EACH", description: "Traffic control", category: "GENERAL_CONDITIONS", unit: "EACH", unitCost: 2500, costBasis: BASIS, currency: "USD", version: UNIT_COST_LIBRARY_VERSION, effectiveDate: "2026-06-26", confidence: "LOW", status: "DEVELOPMENT" },
  { itemId: "COMM-GC-PROJECT-MANAGEMENT-PERCENT", description: "Project management", category: "GENERAL_CONDITIONS", unit: "PERCENT", unitCost: 0.08, costBasis: BASIS, currency: "USD", version: UNIT_COST_LIBRARY_VERSION, effectiveDate: "2026-06-26", confidence: "LOW", status: "DEVELOPMENT" },
  { itemId: "COMM-GC-QAQC-PERCENT", description: "QA/QC", category: "GENERAL_CONDITIONS", unit: "PERCENT", unitCost: 0.025, costBasis: BASIS, currency: "USD", version: UNIT_COST_LIBRARY_VERSION, effectiveDate: "2026-06-26", confidence: "LOW", status: "DEVELOPMENT" },
  { itemId: "COMM-GC-CONTINGENCY-PERCENT", description: "Contingency", category: "GENERAL_CONDITIONS", unit: "PERCENT", unitCost: 0.12, costBasis: BASIS, currency: "USD", version: UNIT_COST_LIBRARY_VERSION, effectiveDate: "2026-06-26", confidence: "LOW", status: "DEVELOPMENT" },
  { itemId: "COMM-GC-OANDM-MILE-MONTH", description: "Monthly O&M per route mile", category: "GENERAL_CONDITIONS", unit: "MILE", unitCost: 145, costBasis: BASIS, currency: "USD", version: UNIT_COST_LIBRARY_VERSION, effectiveDate: "2026-06-26", confidence: "LOW", status: "DEVELOPMENT" },
  { itemId: "COMM-GC-OANDM-MINIMUM-MONTH", description: "Minimum monthly O&M", category: "GENERAL_CONDITIONS", unit: "MONTH", unitCost: 2500, costBasis: BASIS, currency: "USD", version: UNIT_COST_LIBRARY_VERSION, effectiveDate: "2026-06-26", confidence: "LOW", status: "DEVELOPMENT" },
  { itemId: "COMM-REF-ESTIMATED-CONSTRUCTION-COST", description: "Estimated construction cost reference", category: "GENERAL_CONDITIONS", unit: "ALLOWANCE", unitCost: 0, costBasis: "Reference-only aggregate produced by CorridorTakeoff; excluded from budget lines to avoid double counting.", currency: "USD", version: UNIT_COST_LIBRARY_VERSION, effectiveDate: "2026-06-26", confidence: "LOW", status: "DEVELOPMENT" },
]);

export function findUnitCost(itemId: string) {
  return UNIT_COST_LIBRARY.find((item) => item.itemId === itemId);
}
