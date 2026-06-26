export type CommercialCategory =
  | "CIVIL"
  | "MATERIALS"
  | "LABOR"
  | "ENGINEERING"
  | "GENERAL_CONDITIONS";

export type CommercialCapabilityStatus = "IMPLEMENTED" | "PARTIAL" | "FUTURE";

export type CommercialUnit =
  | "FOOT"
  | "EACH"
  | "MILE"
  | "MONTH"
  | "ALLOWANCE"
  | "PERCENT";

export interface CommercialItem {
  itemId: string;
  description: string;
  category: CommercialCategory;
  unit: CommercialUnit;
  status: CommercialCapabilityStatus;
  sourceQuantity: string;
  notes: string;
}

export const COMMERCIAL_ITEM_CATALOG: readonly CommercialItem[] = Object.freeze([
  {
    itemId: "COMM-CIVIL-PLOW-FOOT",
    description: "Plow construction",
    category: "CIVIL",
    unit: "FOOT",
    status: "IMPLEMENTED",
    sourceQuantity: "CorridorTakeoff.routeFeet via civil mix allocation",
    notes: "Derived from route footage in current civil mix logic.",
  },
  {
    itemId: "COMM-CIVIL-HDD-FOOT",
    description: "HDD / directional bore construction",
    category: "CIVIL",
    unit: "FOOT",
    status: "IMPLEMENTED",
    sourceQuantity: "CorridorTakeoff crossing counts via civil mix allocation",
    notes: "Road, rail, water, and unknown constraints bias toward HDD.",
  },
  {
    itemId: "COMM-CIVIL-OPEN-TRENCH-FOOT",
    description: "Open cut / open trench construction",
    category: "CIVIL",
    unit: "FOOT",
    status: "IMPLEMENTED",
    sourceQuantity: "CorridorTakeoff.routeFeet via civil mix allocation",
    notes: "Representative sales allocation pending engineering verification.",
  },
  {
    itemId: "COMM-CIVIL-URBAN-FOOT",
    description: "Urban construction allowance",
    category: "CIVIL",
    unit: "FOOT",
    status: "PARTIAL",
    sourceQuantity: "CorridorTakeoff.routeFeet via urban allocation",
    notes: "Current platform estimates urban footage heuristically.",
  },
  {
    itemId: "COMM-CIVIL-ROAD-BORE-EACH",
    description: "Road bore / road crossing allowance",
    category: "CIVIL",
    unit: "EACH",
    status: "IMPLEMENTED",
    sourceQuantity: "CorridorTakeoff.roadCrossingCount",
    notes: "Crossing count exists; final method requires engineering.",
  },
  {
    itemId: "COMM-CIVIL-RAILROAD-BORE-EACH",
    description: "Railroad bore / railroad crossing allowance",
    category: "CIVIL",
    unit: "EACH",
    status: "IMPLEMENTED",
    sourceQuantity: "CorridorTakeoff.railCrossingCount",
    notes: "Railroad crossings require permit and engineering review.",
  },
  {
    itemId: "COMM-CIVIL-WATER-CROSSING-EACH",
    description: "Water crossing allowance",
    category: "CIVIL",
    unit: "EACH",
    status: "IMPLEMENTED",
    sourceQuantity: "CorridorTakeoff.waterCrossingCount",
    notes: "Water crossings require engineered crossing review.",
  },
  {
    itemId: "COMM-CIVIL-BRIDGE-ATTACHMENT-EACH",
    description: "Bridge attachment allowance",
    category: "CIVIL",
    unit: "EACH",
    status: "IMPLEMENTED",
    sourceQuantity: "CorridorTakeoff.bridgeCrossingCount",
    notes: "Bridge attachment requires structure and permit review.",
  },
  {
    itemId: "COMM-CIVIL-UNKNOWN-CONSTRAINT-EACH",
    description: "Unknown constraint allowance",
    category: "CIVIL",
    unit: "EACH",
    status: "IMPLEMENTED",
    sourceQuantity: "CorridorTakeoff.unknownConstraintCount",
    notes: "Used only as a budgetary uncertainty allowance.",
  },
  {
    itemId: "COMM-MAT-CONDUIT-FOOT",
    description: "Standard Duct Package (3 x 1.25\" HDPE)",
    category: "MATERIALS",
    unit: "FOOT",
    status: "IMPLEMENTED",
    sourceQuantity: "CorridorTakeoff.routeFeet x 3",
    notes: "Default OSP package is three 1.25\" HDPE conduits; one occupied and two available for future inventory.",
  },
  {
    itemId: "COMM-MAT-INNERDUCT-FOOT",
    description: "FuturePath (Optional)",
    category: "MATERIALS",
    unit: "FOOT",
    status: "FUTURE",
    sourceQuantity: "Not currently generated",
    notes: "Optional material for higher-density fiber systems; does not replace the standard duct package.",
  },
  {
    itemId: "COMM-MAT-FIBER-FOOT",
    description: "Fiber material",
    category: "MATERIALS",
    unit: "FOOT",
    status: "IMPLEMENTED",
    sourceQuantity: "CorridorTakeoff.fiberFeet",
    notes: "Fiber footage is produced by StationedCorridor takeoff.",
  },
  {
    itemId: "COMM-MAT-VAULT-EACH",
    description: "Vault material and placement",
    category: "MATERIALS",
    unit: "EACH",
    status: "IMPLEMENTED",
    sourceQuantity: "CorridorTakeoff.vaultCount",
    notes: "Vault counts are estimated before engineering.",
  },
  {
    itemId: "COMM-MAT-HANDHOLE-EACH",
    description: "Handhole material and placement",
    category: "MATERIALS",
    unit: "EACH",
    status: "IMPLEMENTED",
    sourceQuantity: "CorridorTakeoff.handholeCount",
    notes: "Handhole counts are estimated before engineering.",
  },
  {
    itemId: "COMM-MAT-MARKER-EACH",
    description: "Route marker",
    category: "MATERIALS",
    unit: "EACH",
    status: "IMPLEMENTED",
    sourceQuantity: "CorridorTakeoff.markerPostCount",
    notes: "Marker counts are estimated by route length.",
  },
  {
    itemId: "COMM-MAT-SPLICE-CASE-EACH",
    description: "Splice case",
    category: "MATERIALS",
    unit: "EACH",
    status: "IMPLEMENTED",
    sourceQuantity: "Butt splice locations",
    notes: "One field butt splice location requires one splice case.",
  },
  {
    itemId: "COMM-LABOR-FIBER-PLACEMENT-FOOT",
    description: "Cable placement / fiber blowing",
    category: "LABOR",
    unit: "FOOT",
    status: "IMPLEMENTED",
    sourceQuantity: "CorridorTakeoff.fiberFeet",
    notes: "Labor allowance maps to fiber footage.",
  },
  {
    itemId: "COMM-LABOR-SPLICING-EACH",
    description: "Splicing labor",
    category: "LABOR",
    unit: "EACH",
    status: "IMPLEMENTED",
    sourceQuantity: "Butt splice locations",
    notes: "Labor derives from purchased fiber reel count and field butt splice locations.",
  },
  {
    itemId: "COMM-LABOR-TESTING-EACH",
    description: "OTDR and acceptance testing",
    category: "LABOR",
    unit: "EACH",
    status: "PARTIAL",
    sourceQuantity: "CorridorTakeoff.splicePointCount",
    notes: "Testing is represented as a segment/splice allowance until test sections are generated.",
  },
  {
    itemId: "COMM-LABOR-RESTORATION-FOOT",
    description: "Restoration allowance",
    category: "LABOR",
    unit: "FOOT",
    status: "PARTIAL",
    sourceQuantity: "CorridorTakeoff.routeFeet via restoration allocation",
    notes: "Current platform does not produce restoration surface classes.",
  },
  {
    itemId: "COMM-ENG-SURVEY-MILE",
    description: "Survey allowance",
    category: "ENGINEERING",
    unit: "MILE",
    status: "PARTIAL",
    sourceQuantity: "CorridorTakeoff.routeMiles",
    notes: "Survey cost is mileage-based until survey scope is explicit.",
  },
  {
    itemId: "COMM-ENG-DESIGN-MILE",
    description: "Design engineering allowance",
    category: "ENGINEERING",
    unit: "MILE",
    status: "IMPLEMENTED",
    sourceQuantity: "CorridorTakeoff.routeMiles",
    notes: "Design allowance is derived from corridor mileage.",
  },
  {
    itemId: "COMM-ENG-PERMIT-EACH",
    description: "Permitting allowance",
    category: "ENGINEERING",
    unit: "EACH",
    status: "PARTIAL",
    sourceQuantity: "CorridorTakeoff crossing counts",
    notes: "Permit categories are not yet generated; crossing count drives allowance.",
  },
  {
    itemId: "COMM-ENG-INSPECTION-MILE",
    description: "Inspection allowance",
    category: "ENGINEERING",
    unit: "MILE",
    status: "PARTIAL",
    sourceQuantity: "CorridorTakeoff.routeMiles",
    notes: "Inspection scope remains budgetary.",
  },
  {
    itemId: "COMM-GC-MOBILIZATION-ALLOWANCE",
    description: "Mobilization",
    category: "GENERAL_CONDITIONS",
    unit: "ALLOWANCE",
    status: "PARTIAL",
    sourceQuantity: "Project allowance",
    notes: "Representative allowance; not production pricing.",
  },
  {
    itemId: "COMM-GC-TRAFFIC-CONTROL-EACH",
    description: "Traffic control",
    category: "GENERAL_CONDITIONS",
    unit: "EACH",
    status: "PARTIAL",
    sourceQuantity: "CorridorTakeoff roadCrossingCount + vaultCount + handholeCount",
    notes: "Traffic control is a budgetary proxy until traffic plan exists.",
  },
  {
    itemId: "COMM-GC-PROJECT-MANAGEMENT-PERCENT",
    description: "Project management",
    category: "GENERAL_CONDITIONS",
    unit: "PERCENT",
    status: "PARTIAL",
    sourceQuantity: "Direct cost",
    notes: "Percentage allowance; not execution authority.",
  },
  {
    itemId: "COMM-GC-QAQC-PERCENT",
    description: "QA/QC",
    category: "GENERAL_CONDITIONS",
    unit: "PERCENT",
    status: "PARTIAL",
    sourceQuantity: "Direct cost",
    notes: "Percentage allowance; not execution authority.",
  },
  {
    itemId: "COMM-GC-CONTINGENCY-PERCENT",
    description: "Contingency",
    category: "GENERAL_CONDITIONS",
    unit: "PERCENT",
    status: "IMPLEMENTED",
    sourceQuantity: "Direct cost + general conditions",
    notes: "Budgetary contingency, not budget lock.",
  },
  {
    itemId: "COMM-GC-OANDM-MILE-MONTH",
    description: "Monthly O&M per route mile",
    category: "GENERAL_CONDITIONS",
    unit: "MILE",
    status: "PARTIAL",
    sourceQuantity: "CorridorTakeoff.routeMiles",
    notes: "Recurring quote support only; not an operations contract.",
  },
  {
    itemId: "COMM-GC-OANDM-MINIMUM-MONTH",
    description: "Minimum monthly O&M",
    category: "GENERAL_CONDITIONS",
    unit: "MONTH",
    status: "PARTIAL",
    sourceQuantity: "Commercial recurring minimum",
    notes: "Recurring quote support only; not an operations contract.",
  },
  {
    itemId: "COMM-REF-ESTIMATED-CONSTRUCTION-COST",
    description: "Estimated construction cost reference",
    category: "GENERAL_CONDITIONS",
    unit: "ALLOWANCE",
    status: "PARTIAL",
    sourceQuantity: "CorridorTakeoff.estimatedConstructionCost",
    notes: "Reference-only aggregate; not used as a budget line to avoid double counting.",
  },
]);

export function findCommercialItem(itemId: string) {
  return COMMERCIAL_ITEM_CATALOG.find((item) => item.itemId === itemId);
}

export function commercialItemsByStatus(status: CommercialCapabilityStatus) {
  return COMMERCIAL_ITEM_CATALOG.filter((item) => item.status === status);
}
