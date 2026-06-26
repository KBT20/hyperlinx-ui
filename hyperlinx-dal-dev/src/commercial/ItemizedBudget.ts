import type { CommercialCategory, CommercialUnit } from "./CommercialItemCatalog";
import type { UnitCostConfidence } from "./UnitCostLibrary";

export interface CommercialSourceQuantity {
  sourceType: "CorridorTakeoff" | "CivilMixEstimate" | "DirectCost";
  sourceId: string;
  field: string;
  value: number;
}

export interface CommercialSourceCorridor {
  centerlineRouteId?: string;
  stationedCorridorId?: string;
  takeoffId?: string;
}

export interface ItemizedBudgetLine {
  budgetLineId: string;
  commercialItemId: string;
  description: string;
  category: CommercialCategory;
  assumptionSetId: string;
  assumptionIds: string[];
  quantity: number;
  unit: CommercialUnit;
  unitCost: number;
  extendedCost: number;
  sourceQuantity: CommercialSourceQuantity;
  sourceCorridor: CommercialSourceCorridor;
  confidence: UnitCostConfidence;
  overrideFlag: false;
  traceability: string[];
}

export interface ItemizedBudgetTotals {
  civil: number;
  materials: number;
  labor: number;
  engineering: number;
  generalConditions: number;
  directCost: number;
  markup: number;
  contingency: number;
  totalBudget: number;
}

export interface ItemizedBudget {
  budgetId: string;
  proposalId: string;
  source: "COMMERCIAL_FOUNDATION";
  budgetAssumptionSetId: string;
  budgetAssumptionSetVersion: string;
  sourceCorridor: CommercialSourceCorridor;
  lines: ItemizedBudgetLine[];
  totals: ItemizedBudgetTotals;
  currency: "USD";
  unitCostLibraryVersion: string;
  assumptions: string[];
  diagnostics: string[];
  readOnly: true;
  preliminary: true;
  nonContractual: true;
  noBudgetLock: true;
  noExecutionAuthority: true;
  generatedAt: string;
}
