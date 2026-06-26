import type { CommercialCategory } from "./CommercialItemCatalog";
import type { BudgetAssumptionCategory } from "./BudgetAssumptionSet";

export type CostBreakdownCategory =
  | CommercialCategory
  | "CONTINGENCY"
  | "RECURRING";

export interface CostBreakdownAssumptionMapping {
  cbsCategory: CostBreakdownCategory;
  description: string;
  requiredAssumptionCategories: BudgetAssumptionCategory[];
  costDrivers: string[];
  notes: string;
}

export const CBS_ASSUMPTION_MAPPINGS: readonly CostBreakdownAssumptionMapping[] = Object.freeze([
  {
    cbsCategory: "CIVIL",
    description: "Civil construction cost.",
    requiredAssumptionCategories: ["CIVIL", "CONSTRUCTION", "RISK", "CORRIDOR_CONFIDENCE"],
    costDrivers: ["HDD percentage", "Plow percentage", "Open cut percentage", "Rock percentage", "Traffic control", "Production rate"],
    notes: "Civil cost must be explained by construction method, productivity, and unknown-risk assumptions.",
  },
  {
    cbsCategory: "MATERIALS",
    description: "Conduit, fiber, structures, markers, and splice materials.",
    requiredAssumptionCategories: ["EXISTING_INFRASTRUCTURE", "CUSTOMER", "COMMERCIAL"],
    costDrivers: ["Customer material standards", "Commodity assumptions", "Existing infrastructure reuse assumptions"],
    notes: "Materials cost must state whether existing infrastructure reuse is assumed.",
  },
  {
    cbsCategory: "LABOR",
    description: "Placement, splicing, testing, and restoration labor.",
    requiredAssumptionCategories: ["CONSTRUCTION", "CUSTOMER", "RISK"],
    costDrivers: ["Crew count", "Shift duration", "Working days", "Required testing", "Restoration assumptions"],
    notes: "Labor cost must be tied to production and customer acceptance assumptions.",
  },
  {
    cbsCategory: "ENGINEERING",
    description: "Survey, design, permitting, utility coordination, environmental review, and inspection.",
    requiredAssumptionCategories: ["ENGINEERING", "RISK", "CUSTOMER"],
    costDrivers: ["Survey included", "Permit included", "Environmental included", "Utility coordination included", "Inspection included"],
    notes: "Engineering cost cannot exist without explicit scope inclusion assumptions.",
  },
  {
    cbsCategory: "GENERAL_CONDITIONS",
    description: "Mobilization, traffic control, project management, QA/QC.",
    requiredAssumptionCategories: ["CONSTRUCTION", "COMMERCIAL", "RISK"],
    costDrivers: ["Mobilization", "Traffic control", "Project management", "QA/QC", "Fuel assumptions"],
    notes: "General conditions must state site, production, and review assumptions.",
  },
  {
    cbsCategory: "CONTINGENCY",
    description: "Budgetary contingency.",
    requiredAssumptionCategories: ["RISK", "CORRIDOR_CONFIDENCE", "ROUTE_MATURITY"],
    costDrivers: ["Unknown utilities", "Unknown geology", "ROW uncertainty", "Route maturity", "Budget confidence"],
    notes: "Contingency is not automatically calculated from confidence yet; mapping prepares the architecture.",
  },
  {
    cbsCategory: "RECURRING",
    description: "Monthly O&M and recurring proposal support.",
    requiredAssumptionCategories: ["COMMERCIAL", "CUSTOMER", "RISK"],
    costDrivers: ["Customer acceptance assumptions", "Required testing", "Inflation", "Operations risk"],
    notes: "Recurring values are proposal support only and do not create operations contracts.",
  },
]);

export function cbsMappingForCategory(category: CostBreakdownCategory) {
  return CBS_ASSUMPTION_MAPPINGS.find((mapping) => mapping.cbsCategory === category);
}

