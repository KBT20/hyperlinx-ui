export type DALCoordinate = [number, number];

export type ValidationStatus = "PASS" | "WARNING" | "FAIL";

export type ValidationIssue = {
  check:
    | "Missing coordinates"
    | "Duplicate nodes"
    | "Duplicate edges"
    | "Orphan nodes"
    | "Invalid geometry"
    | "Empty routes"
    | "Unconnected routes"
    | "Excessive duplicate geometry"
    | "Unsupported source structure";
  status: ValidationStatus;
  count: number;
  message: string;
};

export type ValidationResult = {
  status: ValidationStatus;
  issues: ValidationIssue[];
};

export type InventoryGraphMetadata = {
  inventoryId: string;
  graphId: string;
  scopeVersionId?: string;
  name: string;
  sourceFile?: string;
  sourceType?: string;
  createdDate: string;
  validationStatus?: ValidationStatus;
  nodeCount: number;
  edgeCount: number;
  stationCount: number;
  routeCount: number;
  routeMiles: number;
};

export type InventoryNode = {
  nodeId: string;
  lat: number;
  lon: number;
  routeIds: string[];
};

export type InventoryEdge = {
  edgeId: string;
  fromNodeId: string;
  toNodeId: string;
  routeId: string;
  coordinates: DALCoordinate[];
  lengthFeet: number;
};

export type InventoryRoute = {
  routeId: string;
  name: string;
  coordinates: DALCoordinate[];
  edgeIds: string[];
  lengthFeet: number;
};

export type InventoryStation = {
  stationId: string;
  routeId: string;
  lat: number;
  lon: number;
  feet: number;
  label: string;
};

export type InventoryGraph = {
  inventoryId: string;
  graphId: string;
  scopeVersionId?: string;
  metadata: InventoryGraphMetadata & Record<string, unknown>;
  nodes: InventoryNode[];
  edges: InventoryEdge[];
  routes: InventoryRoute[];
  stations: InventoryStation[];
  validation: ValidationResult;
  createdAt: string;
  updatedAt: string;
};

export type ScopeVersionStatus =
  | "DRAFT"
  | "ANALYZED"
  | "QUOTED"
  | "APPROVED"
  | "ACTIVATED"
  | "IN_CONSTRUCTION"
  | "COMPLETE"
  | "REJECTED"
  | "CANDIDATE"
  | "ACTIVE"
  | "FIELD_CLOSED"
  | "SUPERSEDED";

export type ScopeVersionCandidate = {
  candidateId: string;
  inventoryId: string;
  graphId: string;
  opportunityId?: string;
  name: string;
  routeIds: string[];
  stationIds: string[];
  estimatedFeet: number;
  createdAt: string;
};

export type ScopeVersion = {
  scopeVersionId: string;
  inventoryId?: string;
  graphId?: string;
  source: "InventoryGraph" | "GraphExtension" | "OpportunitySeed" | "PrismOpportunity" | "DesignCandidate" | "FieldClosure" | "Manual";
  status: ScopeVersionStatus;
  geometry?: DALCoordinate[];
  attachmentPoint?: DALCoordinate;
  candidateSite?: unknown;
  latitude?: number;
  longitude?: number;
  attachmentCoordinates?: DALCoordinate;
  nearestRoute?: unknown;
  nearestNode?: unknown;
  nearestStation?: unknown;
  buildPath?: unknown;
  buildFeet?: number;
  buildMiles?: number;
  crossings?: unknown;
  permits?: unknown;
  constructability?: unknown;
  financialInputs?: unknown;
  decisionRecommendation?: unknown;
  graphReference?: unknown;
  graphVersion?: string;
  decisionTimestamp?: string;
  user?: string;
  station?: unknown;
  route?: unknown;
  canonicalTruth: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  events: OperationalEvent[];
};

export type ServiceabilityStatus = "GREEN" | "YELLOW" | "RED";

export type PrismOpportunity = {
  opportunityId: string;
  inventoryId: string;
  graphId: string;
  nearestNode?: InventoryNode;
  nearestStation?: InventoryStation;
  distanceFeet: number;
  serviceabilityStatus: ServiceabilityStatus;
  candidateScopeVersionId?: string;
  notes?: string;
  lat?: number;
  lon?: number;
  createdAt: string;
};

export type MarketplaceQuote = {
  quoteId: string;
  opportunitySeedId?: string;
  opportunityId?: string;
  scopeVersionId?: string;
  inventoryId?: string;
  graphId?: string;
  nrc: number;
  mrc: number;
  constructionNrc?: number;
  engineeringNrc?: number;
  permitNrc?: number;
  crossingNrc?: number;
  monthlyService?: number;
  termMonths: number;
  totalContractValue: number;
  margin?: number;
  paybackMonths?: number;
  roi?: number;
  constructionType?: string;
  riskScore?: number;
  estimatedCost?: number;
  routeId?: string;
  nodeId?: string;
  stationId?: string;
  attachmentType?: string;
  buildFeet?: number;
  buildPath?: unknown;
  estimatedPermitCost?: number;
  estimatedCrossingCost?: number;
  estimatedEnvironmentalCost?: number;
  estimatedEngineeringCost?: number;
  constructabilityAssessment?: unknown;
  quoteExplanation?: {
    summary: string;
    buildLengthFeet?: number;
    constructionType?: string;
    crossings?: number;
    permits?: string[];
    engineeringFactors?: string[];
    revenueFactors?: string[];
  };
  worksheet?: Record<string, unknown>;
  notes?: string;
  createdAt: string;
};

export type ControlWorkStatus = "PENDING" | "ACTIVE" | "ON_HOLD" | "COMPLETE" | "CANCELLED";

export type ControlWorkItem = {
  workItemId: string;
  workType?: "ENGINEERING" | "PERMITTING" | "CONSTRUCTION" | "ACTIVATION" | "VALIDATION" | "GENERAL";
  scopeVersionId?: string;
  opportunitySeedId?: string;
  quoteId?: string;
  inventoryId?: string;
  graphId?: string;
  routeId?: string;
  nodeId?: string;
  stationId?: string;
  attachmentType?: string;
  buildPath?: unknown;
  constructabilityAssessment?: unknown;
  permitRequirements?: unknown;
  crossingInventory?: unknown;
  status: ControlWorkStatus;
  title: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
};

export type FieldClosure = {
  closureId: string;
  workItemId?: string;
  scopeVersionId?: string;
  inventoryId?: string;
  graphId?: string;
  stationId?: string;
  routeId?: string;
  segmentId?: string;
  closureType: "STATION" | "SEGMENT";
  footage: number;
  crew: string;
  closedAt: string;
  notes?: string;
};

export type OperationalEvent = {
  eventId: string;
  type: string;
  entityId: string;
  entityType: string;
  payload: Record<string, unknown>;
  createdAt: string;
};

export type TwinState = {
  twinStateId: string;
  inventoryId?: string;
  scopeVersionId?: string;
  openWorkItems: number;
  completedWorkItems: number;
  closureCount: number;
  completedFeet: number;
  routeProgress: Array<{ routeId: string; completedFeet: number; totalFeet: number; percent: number }>;
  timeline: OperationalEvent[];
  updatedAt: string;
};

export type DALInventoryGraphPayload = InventoryGraph;
export type DALInventoryGraphMetadata = InventoryGraphMetadata;
export type DALInventoryNode = InventoryNode;
export type DALInventoryEdge = InventoryEdge;
export type DALInventoryRoute = InventoryRoute;
export type DALInventoryStation = InventoryStation;
export type DALValidationStatus = ValidationStatus;
export type DALValidationIssue = ValidationIssue;
export type DALValidationResult = ValidationResult;
