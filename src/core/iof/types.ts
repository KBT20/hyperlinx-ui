export type LonLat = [number, number];

export type IOFRoute = LonLat[];

export type NetworkRole = "metro" | "middlemile" | "longhaul";

export type IOFStation = {
  stationId: string;
  station?: string;
  lat: number;
  lon: number;
  feet?: number | null;
  [key: string]: any;
};

export type IOFObject = {
  objectId: string;
  objectType: string;
  networkRole: NetworkRole;
  unit: string;
  quantity: number;
  [key: string]: any;
};

export type IOFConstraints = Record<string, any>;

export type IOFCloseTaxonomy = Record<string, string[]>;

export type IOFStateDefinition = {
  state: string;
  requires: string[];
};

export type IOFStateModel = {
  version: string;
  derivationMode: "closure_only" | "event_based" | string;
  states: IOFStateDefinition[];
};

export type IOFCanonicalTruth = {
  route: IOFRoute;
  stations: IOFStation[];
  objects: IOFObject[];
  constraints: IOFConstraints;
  closeTaxonomy: IOFCloseTaxonomy;
  stateModel: IOFStateModel;
  metadata?: Record<string, any>;
  [key: string]: any;
};

export type IOFDesignBudgetLineItem = {
  id: string;
  label: string;
  unit: string;
  quantity: number;
  budgetUnitCost: number;
  budgetAmount: number;
  marketUnitCost?: number;
  marketAmount?: number;
  vendorName?: string;
  quoteStatus?: string;
  [key: string]: any;
};

export type IOFDesignBudgetModel = {
  routeFeet: number;
  totalBid: number;
  directCivilLabor: number;
  materialsBase: number;
  materialsEscalated: number;
  engineering: number;
  permitting: number;
  crossings: number;
  nodes: number;
  program: number;
  subtotal: number;
  contingency: number;
  riskedCost: number;
  margin: number;
  costPerFoot: number;
  costPerMile: number;
  recovery60: number;
  recovery120: number;
  materialBreakdown: {
    conduit: number;
    innerduct: number;
    fiber: number;
    tracer: number;
    handholes: number;
    vaults: number;
    spliceClosures: number;
    restoration: number;
  };
  budgetLineItems: IOFDesignBudgetLineItem[];
  [key: string]: any;
};

export type IOFFinancialContext = {
  designBudgetModel?: IOFDesignBudgetModel;
  [key: string]: any;
};

export type IOFPackage = {
  event: string;
  corridorId: string;
  segmentId: string;
  scopeVersionId: string;
  canonicalTruth: IOFCanonicalTruth;
  timestamp: string;
  actor?: string;
  context?: Record<string, any>;
  financialContext?: IOFFinancialContext;
};

export type IOFPackageBuilderOptions = {
  corridorId: string;
  segmentId: string;
  scopeVersionId: string;
  route: IOFRoute;
  stations: IOFStation[];
  role: NetworkRole;
  routeFeet: number;
  timestamp?: string;
  actor?: string;
  context?: Record<string, any>;
  financialContext?: IOFFinancialContext;
  event?: string;
};

export type IOFEventRecord = {
  id: string;
  scopeVersionId: string;
  type: string;
  targetId: string;
  timestamp: number;
  payload?: Record<string, any>;
};

export type IOFStationReplayState = {
  stationId: string;
  isActivated: boolean;
  latestCloseType?: string;
  latestCloseTime?: number;
  closeCount: number;
  status: string; // derived from latest close
};

export type IOFObjectReplayState = {
  objectId: string;
  nextCloseType?: string;
  isEligible: boolean;
};

export type IOFScopeReplayState = {
  stations: Map<string, IOFStationReplayState>;
  objects: Map<string, IOFObjectReplayState>;
  activationMap: Map<string, boolean>;
  executionMap: Map<string, IOFCloseRecord>;
  overallState: IOFStateEvaluation;
};
