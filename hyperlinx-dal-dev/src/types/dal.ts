export type DALCoordinate = [number, number];

export type ValidationStatus = "PASS" | "WARNING" | "FAIL";
export type CertificationStatus = "CERTIFIED" | "WARNING" | "FAILED";
export type ServiceabilityCertificationStatus = "SERVICEABLE" | "CONDITIONALLY_SERVICEABLE" | "NOT_SERVICEABLE";

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
  serializedSizeBytes?: number;
  serializedSizeMB?: number;
  storageWarning?: string;
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
  | "REJECTED";

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

export type AttachmentPoint = {
  attachmentId: string;
  routeId: string;
  routeSegmentId: string;
  nodeId: string;
  stationId: string;
  latitude: number;
  longitude: number;
  distanceFeet: number;
  confidenceScore: number;
  certificationStatus: CertificationStatus;
};

export type ConstructionAssumptions = {
  constructionType: "BURIED";
  trenchCost: number;
  boreCost: number;
  crossingCost: number;
  restorationCost: number;
  costPerFoot: number;
};

export type LateralPath = {
  lateralId: string;
  attachmentId: string;
  geometry: DALCoordinate[];
  buildFeet: number;
  buildMiles: number;
  segmentCount: number;
  crossings: number;
  turns: number;
  permitCount: number;
  certificationStatus: CertificationStatus;
  constructionAssumptions: ConstructionAssumptions;
};

export type ServiceabilityAssessment = {
  serviceable: boolean;
  attachmentCertified: boolean;
  lateralCertified: boolean;
  routeCertified: boolean;
  permitRisk: number;
  buildRisk: number;
  confidenceScore: number;
  status: ServiceabilityCertificationStatus;
};

export type CertificationSnapshot = {
  attachmentPoint: AttachmentPoint;
  lateralPath: LateralPath;
  serviceabilityAssessment: ServiceabilityAssessment;
  constructionAssumptions: ConstructionAssumptions;
  certifiedAt: string;
};

export type ScopeVersionDecisionRecommendation = "GO" | "NO_GO" | "REVIEW";

export type ScopeVersionGraphReference = {
  inventoryId?: string;
  graphId: string;
  graphVersion: string;
};

export type ScopeVersionNetworkBasis = {
  routeId: string;
  routeName?: string;
  nodeId: string;
  nodeName?: string;
  stationId: string;
  stationName?: string;
  attachmentPoint: DALCoordinate;
  attachmentCoordinates: DALCoordinate;
  capacityStatus?: string;
  attachmentStrategy?: string;
  networkAffinityScore?: number;
  certificationStatus?: CertificationStatus;
};

export type ScopeVersionGeographicBasis = {
  candidateLatitude: number;
  candidateLongitude: number;
  geocodeProvider?: string;
  geocodeConfidence?: number;
  geometry: DALCoordinate[];
  buildPath: unknown;
  routeGeometry: DALCoordinate[];
  stationGeometry?: DALCoordinate;
  nodeGeometry?: DALCoordinate;
  attachmentGeometry?: DALCoordinate;
  lateralGeometry?: DALCoordinate[];
};

export type ScopeVersionEngineeringBasis = {
  buildFeet: number;
  buildMiles: number;
  constructionType?: string;
  crossings?: unknown;
  roadCrossings?: number;
  railCrossings?: number;
  waterCrossings?: number;
  permits?: unknown;
  permitAuthorities?: string[];
  constructabilityScore?: number;
  engineeringScore?: number;
  constructionAssumptions?: ConstructionAssumptions;
  attachmentCertification?: AttachmentPoint;
  lateralCertification?: LateralPath;
  serviceabilityAssessment?: ServiceabilityAssessment;
};

export type ScopeVersionFinancialBasis = {
  estimatedConstructionCost: number;
  estimatedEngineeringCost: number;
  estimatedPermitCost: number;
  estimatedCrossingCost: number;
  estimatedEnvironmentalCost: number;
  NRC: number;
  MRC: number;
  TCV: number;
  payback?: number;
  ROI?: number;
  margin?: number;
  financialScore?: number;
};

export type ScopeVersionRiskBasis = {
  permitRisk?: number;
  crossingRisk?: number;
  constructionRisk?: number;
  environmentalRisk?: number;
  compositeRisk?: number;
};

export type ScopeVersionDecisionBasis = {
  recommendation: ScopeVersionDecisionRecommendation;
  compositeScore?: number;
  strategicScore?: number;
  engineeringScore?: number;
  financialScore?: number;
  riskScore?: number;
  phase?: string;
  priority?: string;
};

export type ScopeVersionCanonicalTruth = {
  graphReference?: ScopeVersionGraphReference;
  networkBasis?: ScopeVersionNetworkBasis;
  geographicBasis?: ScopeVersionGeographicBasis;
  engineeringBasis?: ScopeVersionEngineeringBasis;
  financialBasis?: ScopeVersionFinancialBasis;
  riskBasis?: ScopeVersionRiskBasis;
  decisionBasis?: ScopeVersionDecisionBasis;
  sourceCandidate?: {
    candidateSiteId: string;
    name?: string;
    address?: string;
  };
  sourceOpportunity?: {
    opportunitySeedId?: string;
    opportunityId?: string;
  };
  certificationSnapshot?: CertificationSnapshot;
  validation?: unknown;
  [key: string]: unknown;
};

export type ScopeVersion = {
  scopeVersionId: string;
  inventoryId?: string;
  graphId?: string;
  graphVersion?: string;
  candidateSiteId?: string;
  sourceOpportunityId?: string;
  createdBy?: string;
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
  certificationSnapshot?: CertificationSnapshot;
  serviceabilityAssessment?: ServiceabilityAssessment;
  graphReference?: unknown;
  decisionTimestamp?: string;
  user?: string;
  station?: unknown;
  route?: unknown;
  canonicalTruth: ScopeVersionCanonicalTruth;
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
