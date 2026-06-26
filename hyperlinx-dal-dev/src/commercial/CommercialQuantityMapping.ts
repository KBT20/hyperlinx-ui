import type { CommercialCapabilityStatus, CommercialUnit } from "./CommercialItemCatalog";

export type CommercialSourceDomain = "CORRIDOR_TAKEOFF" | "CIVIL_MIX_ESTIMATE" | "DIRECT_COST";

export interface CommercialQuantityMapping {
  mappingId: string;
  sourceDomain: CommercialSourceDomain;
  sourceField: string;
  sourceLabel: string;
  commercialItemId: string;
  unit: CommercialUnit;
  status: CommercialCapabilityStatus;
  budgetEligible: boolean;
  notes: string;
}

export const COMMERCIAL_QUANTITY_MAPPINGS: readonly CommercialQuantityMapping[] = Object.freeze([
  { mappingId: "MAP-TAKEOFF-ROUTE-MILES-SURVEY", sourceDomain: "CORRIDOR_TAKEOFF", sourceField: "routeMiles", sourceLabel: "Route miles", commercialItemId: "COMM-ENG-SURVEY-MILE", unit: "MILE", status: "PARTIAL", budgetEligible: true, notes: "Survey allowance is mileage-based until survey scope exists." },
  { mappingId: "MAP-TAKEOFF-ROUTE-MILES-DESIGN", sourceDomain: "CORRIDOR_TAKEOFF", sourceField: "routeMiles", sourceLabel: "Route miles", commercialItemId: "COMM-ENG-DESIGN-MILE", unit: "MILE", status: "IMPLEMENTED", budgetEligible: true, notes: "Design allowance is mileage-based." },
  { mappingId: "MAP-TAKEOFF-ROUTE-FEET-PLOW", sourceDomain: "CORRIDOR_TAKEOFF", sourceField: "routeFeet", sourceLabel: "Route feet", commercialItemId: "COMM-CIVIL-PLOW-FOOT", unit: "FOOT", status: "IMPLEMENTED", budgetEligible: true, notes: "Allocated from route footage." },
  { mappingId: "MAP-TAKEOFF-ROUTE-FEET-HDD", sourceDomain: "CORRIDOR_TAKEOFF", sourceField: "routeFeet", sourceLabel: "Route feet and crossings", commercialItemId: "COMM-CIVIL-HDD-FOOT", unit: "FOOT", status: "IMPLEMENTED", budgetEligible: true, notes: "Allocated from crossing-driven footage." },
  { mappingId: "MAP-TAKEOFF-ROUTE-FEET-OPEN", sourceDomain: "CORRIDOR_TAKEOFF", sourceField: "routeFeet", sourceLabel: "Route feet", commercialItemId: "COMM-CIVIL-OPEN-TRENCH-FOOT", unit: "FOOT", status: "IMPLEMENTED", budgetEligible: true, notes: "Allocated from route footage." },
  { mappingId: "MAP-TAKEOFF-DUCT", sourceDomain: "CORRIDOR_TAKEOFF", sourceField: "routeFeet", sourceLabel: "Route feet x 3 standard ducts", commercialItemId: "COMM-MAT-CONDUIT-FOOT", unit: "FOOT", status: "IMPLEMENTED", budgetEligible: true, notes: "Selected-scope estimator prices the standard 3 x 1.25\" HDPE duct package as route length x 3." },
  { mappingId: "MAP-TAKEOFF-FIBER", sourceDomain: "CORRIDOR_TAKEOFF", sourceField: "fiberFeet", sourceLabel: "Fiber feet", commercialItemId: "COMM-MAT-FIBER-FOOT", unit: "FOOT", status: "IMPLEMENTED", budgetEligible: true, notes: "Direct takeoff mapping." },
  { mappingId: "MAP-TAKEOFF-FIBER-PLACEMENT", sourceDomain: "CORRIDOR_TAKEOFF", sourceField: "fiberFeet", sourceLabel: "Fiber feet", commercialItemId: "COMM-LABOR-FIBER-PLACEMENT-FOOT", unit: "FOOT", status: "IMPLEMENTED", budgetEligible: true, notes: "Labor allowance maps to fiber footage." },
  { mappingId: "MAP-TAKEOFF-VAULT", sourceDomain: "CORRIDOR_TAKEOFF", sourceField: "vaultCount", sourceLabel: "Vault count", commercialItemId: "COMM-MAT-VAULT-EACH", unit: "EACH", status: "IMPLEMENTED", budgetEligible: true, notes: "Direct takeoff mapping." },
  { mappingId: "MAP-TAKEOFF-HANDHOLE", sourceDomain: "CORRIDOR_TAKEOFF", sourceField: "handholeCount", sourceLabel: "Handhole count", commercialItemId: "COMM-MAT-HANDHOLE-EACH", unit: "EACH", status: "IMPLEMENTED", budgetEligible: true, notes: "Direct takeoff mapping." },
  { mappingId: "MAP-TAKEOFF-REGEN", sourceDomain: "CORRIDOR_TAKEOFF", sourceField: "regenSiteCount", sourceLabel: "Regen / ILA site count", commercialItemId: "COMM-GC-MOBILIZATION-ALLOWANCE", unit: "ALLOWANCE", status: "PARTIAL", budgetEligible: false, notes: "Current unit cost library does not yet price ILA facilities; cost remains fixture/profile driven." },
  { mappingId: "MAP-TAKEOFF-SPLICE-CASE", sourceDomain: "CORRIDOR_TAKEOFF", sourceField: "fiberFeet", sourceLabel: "Purchased fiber reel count", commercialItemId: "COMM-MAT-SPLICE-CASE-EACH", unit: "EACH", status: "IMPLEMENTED", budgetEligible: true, notes: "Selected-scope estimator derives splice cases from purchased fiber reel count; splice cases equal field butt splice locations." },
  { mappingId: "MAP-TAKEOFF-SPLICING", sourceDomain: "CORRIDOR_TAKEOFF", sourceField: "fiberFeet", sourceLabel: "Purchased fiber reel count", commercialItemId: "COMM-LABOR-SPLICING-EACH", unit: "EACH", status: "IMPLEMENTED", budgetEligible: true, notes: "Labor allowance derives from field butt splice locations, not fiber-count-expanded splices." },
  { mappingId: "MAP-TAKEOFF-TESTING", sourceDomain: "CORRIDOR_TAKEOFF", sourceField: "splicePointCount", sourceLabel: "Splice point count", commercialItemId: "COMM-LABOR-TESTING-EACH", unit: "EACH", status: "PARTIAL", budgetEligible: true, notes: "Testing section count is not yet generated; splice count is the current proxy." },
  { mappingId: "MAP-TAKEOFF-MARKER", sourceDomain: "CORRIDOR_TAKEOFF", sourceField: "markerPostCount", sourceLabel: "Marker post count", commercialItemId: "COMM-MAT-MARKER-EACH", unit: "EACH", status: "IMPLEMENTED", budgetEligible: true, notes: "Direct takeoff mapping." },
  { mappingId: "MAP-TAKEOFF-ROAD", sourceDomain: "CORRIDOR_TAKEOFF", sourceField: "roadCrossingCount", sourceLabel: "Road crossing count", commercialItemId: "COMM-CIVIL-ROAD-BORE-EACH", unit: "EACH", status: "IMPLEMENTED", budgetEligible: true, notes: "Final method requires engineering." },
  { mappingId: "MAP-TAKEOFF-RAIL", sourceDomain: "CORRIDOR_TAKEOFF", sourceField: "railCrossingCount", sourceLabel: "Rail crossing count", commercialItemId: "COMM-CIVIL-RAILROAD-BORE-EACH", unit: "EACH", status: "IMPLEMENTED", budgetEligible: true, notes: "Final method requires engineering and permits." },
  { mappingId: "MAP-TAKEOFF-WATER", sourceDomain: "CORRIDOR_TAKEOFF", sourceField: "waterCrossingCount", sourceLabel: "Water crossing count", commercialItemId: "COMM-CIVIL-WATER-CROSSING-EACH", unit: "EACH", status: "IMPLEMENTED", budgetEligible: true, notes: "Final method requires engineering and permits." },
  { mappingId: "MAP-TAKEOFF-BRIDGE", sourceDomain: "CORRIDOR_TAKEOFF", sourceField: "bridgeCrossingCount", sourceLabel: "Bridge crossing count", commercialItemId: "COMM-CIVIL-BRIDGE-ATTACHMENT-EACH", unit: "EACH", status: "IMPLEMENTED", budgetEligible: true, notes: "Final method requires structure review." },
  { mappingId: "MAP-TAKEOFF-UNKNOWN", sourceDomain: "CORRIDOR_TAKEOFF", sourceField: "unknownConstraintCount", sourceLabel: "Unknown constraint count", commercialItemId: "COMM-CIVIL-UNKNOWN-CONSTRAINT-EACH", unit: "EACH", status: "IMPLEMENTED", budgetEligible: true, notes: "Budgetary uncertainty allowance." },
  { mappingId: "MAP-TAKEOFF-AGGREGATE", sourceDomain: "CORRIDOR_TAKEOFF", sourceField: "estimatedConstructionCost", sourceLabel: "Estimated construction cost", commercialItemId: "COMM-REF-ESTIMATED-CONSTRUCTION-COST", unit: "ALLOWANCE", status: "PARTIAL", budgetEligible: false, notes: "Reference only; excluded to prevent double counting." },
  { mappingId: "MAP-DIRECT-PM", sourceDomain: "DIRECT_COST", sourceField: "directCost", sourceLabel: "Direct cost", commercialItemId: "COMM-GC-PROJECT-MANAGEMENT-PERCENT", unit: "PERCENT", status: "PARTIAL", budgetEligible: true, notes: "General conditions allowance." },
  { mappingId: "MAP-DIRECT-QAQC", sourceDomain: "DIRECT_COST", sourceField: "directCost", sourceLabel: "Direct cost", commercialItemId: "COMM-GC-QAQC-PERCENT", unit: "PERCENT", status: "PARTIAL", budgetEligible: true, notes: "QA/QC allowance." },
  { mappingId: "MAP-DIRECT-CONTINGENCY", sourceDomain: "DIRECT_COST", sourceField: "directCostAndGeneralConditions", sourceLabel: "Direct cost plus general conditions", commercialItemId: "COMM-GC-CONTINGENCY-PERCENT", unit: "PERCENT", status: "IMPLEMENTED", budgetEligible: true, notes: "Budgetary contingency." },
  { mappingId: "MAP-TAKEOFF-ROUTE-MILES-OANDM", sourceDomain: "CORRIDOR_TAKEOFF", sourceField: "routeMiles", sourceLabel: "Route miles", commercialItemId: "COMM-GC-OANDM-MILE-MONTH", unit: "MILE", status: "PARTIAL", budgetEligible: false, notes: "Used for preliminary recurring quote support, not itemized construction budget." },
  { mappingId: "MAP-DIRECT-OANDM-MINIMUM", sourceDomain: "DIRECT_COST", sourceField: "recurringMinimum", sourceLabel: "Recurring minimum", commercialItemId: "COMM-GC-OANDM-MINIMUM-MONTH", unit: "MONTH", status: "PARTIAL", budgetEligible: false, notes: "Used for preliminary recurring quote support, not itemized construction budget." },
]);

export function mappingForItem(itemId: string) {
  return COMMERCIAL_QUANTITY_MAPPINGS.find((mapping) => mapping.commercialItemId === itemId);
}
