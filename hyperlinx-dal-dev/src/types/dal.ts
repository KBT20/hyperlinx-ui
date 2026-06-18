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

export type InventoryImportJobStatus =
  | "QUEUED"
  | "UPLOADING"
  | "IMPORTING"
  | "CHUNKING"
  | "VALIDATING"
  | "REGISTERING"
  | "COMPLETE"
  | "FAILED";

export type InventorySourceFormat =
  | "HYPERLINX"
  | "SHAPEFILE"
  | "GEOJSON"
  | "KMZ"
  | "KML"
  | "3GIS"
  | "IQGEO"
  | "CONNECTBASE"
  | "FIBER_ENGINEERING_RECORDS"
  | "UNKNOWN";

export type HyperlinxInventoryPackage = {
  packageVersion: string;
  exportedAt: string;
  sourceFormat: InventorySourceFormat;
  inventoryMetadata: InventoryGraphMetadata & Record<string, unknown>;
  nodes: InventoryNode[];
  edges: InventoryEdge[];
  stations: InventoryStation[];
  routes: InventoryRoute[];
  graphSummary: {
    inventoryId: string;
    graphId: string;
    nodeCount: number;
    edgeCount: number;
    stationCount: number;
    routeCount: number;
    serializedSizeBytes: number;
    serializedSizeMB: number;
  };
  validation?: ValidationResult | unknown;
};

export type InventoryUploadProgress = {
  jobId: string;
  status: InventoryImportJobStatus;
  uploadedBytes: number;
  totalBytes: number;
  uploadedChunks: number;
  totalChunks: number;
  percentComplete: number;
  responseTimeMs?: number;
  retryCount?: number;
  currentChunkIndex?: number;
  message?: string;
};

export type InventoryImportJob = {
  jobId: string;
  inventoryId?: string;
  graphId?: string;
  sourceFile: string;
  sourceFormat: InventorySourceFormat;
  endpoint: string;
  status: InventoryImportJobStatus;
  createdAt: string;
  updatedAt: string;
  totalBytes: number;
  uploadedBytes: number;
  chunkSizeBytes: number;
  totalChunks: number;
  uploadedChunks: number;
  retryCount: number;
  serverSupported: boolean;
  validationStatus?: ValidationStatus;
  validationSummary?: Record<string, unknown>;
  error?: string;
};

export type InventoryHealthMetrics = {
  totalInventories: number;
  serverInventories: number;
  browserInventories: number;
  synchronizedInventories: number;
  unsynchronizedInventories: number;
  totalNodes: number;
  totalEdges: number;
  totalStations: number;
  totalRoutes: number;
  serverSizeMB: number;
  browserSizeMB: number;
  largestInventories: Array<{
    inventoryId: string;
    name: string;
    graphSizeMB: number;
    storageLocation: string;
  }>;
  failedImports: number;
  failedValidations: number;
  syncFailures: number;
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

export type ScopeVersionTruthType = "INVENTORY" | "CANDIDATE" | "APPROVED" | "FIELD_CLOSED" | "AS_BUILT";

export type ScopeVersionCertificationState = "DRAFT" | "CERTIFIED" | "REJECTED";

export type ScopeVersionRelationshipType =
  | "ROOT"
  | "AMENDMENT"
  | "GRAPH_EXTENSION"
  | "LATERAL_EXTENSION"
  | "REDESIGN"
  | "FIELD_CLOSURE"
  | "AS_BUILT"
  | "SUPERSEDES";

export type ScopeVersionGraphSummary = {
  nodeCount: number;
  edgeCount: number;
  stationCount: number;
  routeCount: number;
};

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
  routingMode?: string;
  routingClassification?: string;
  pathConfidence?: "LOW" | "MEDIUM" | "HIGH";
  routeStatus?: "VALID" | "ROUTE_NOT_FOUND" | "INVALID";
  routeFailureReason?: string;
  routingAudit?: unknown;
  streetGraphRoute?: unknown;
  roadSegmentCount?: number;
  roadNamesTraversed?: string[];
  roadClassesTraversed?: string[];
  attachmentMethod?: string;
  missingRoutingDependencies?: string[];
  routeAccessPoints?: Record<string, DALCoordinate | undefined>;
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

export type ScopeVersionCertifiedRouteReference = {
  certifiedRouteId: string;
  geometryHash: string;
  routeAuthorityState:
    | "DRAFT_ROUTE"
    | "DIRECT_FALLBACK"
    | "ENGINEER_REVIEW_REQUIRED"
    | "PROVISIONALLY_CERTIFIED"
    | "CERTIFIED_ROUTE"
    | "REJECTED_ROUTE"
    | "BLOCKED";
  routeMode:
    | "DIRECT_FALLBACK"
    | "ROAD_ROW"
    | "UTILITY_EASEMENT"
    | "EXISTING_TELECOM"
    | "RAIL_CORRIDOR"
    | "POWER_CORRIDOR"
    | "PRIVATE_EASEMENT"
    | "ENGINEER_DEFINED";
  routeFeet: number;
  routeMiles: number;
  constraintEvidenceId?: string;
};

export type IOFPackageType =
  | "ENGINEERING"
  | "PERMITTING"
  | "CONSTRUCTION"
  | "SPLICING"
  | "TESTING"
  | "AS_BUILT"
  | "REVENUE";

export type IOFPackageStatus = "DRAFT" | "APPROVED" | "ACTIVE" | "COMPLETE" | "CLOSED";

export type IOFPackageProgress = {
  totalObjects: number;
  completedObjects: number;
  percentComplete: number;
};

export type IOFPackage = {
  packageId: string;
  scopeVersionId: string;
  packageType: IOFPackageType;
  status: IOFPackageStatus;
  createdAt: string;
  updatedAt: string;
  corridorId?: string;
  segmentId?: string;
  route: unknown[];
  stations: unknown[];
  objects: unknown[];
  closeEventId?: string;
  progress?: IOFPackageProgress;
  archivedAt?: string;
  isArchived?: boolean;
  metadata?: Record<string, unknown>;
};

export type CloseEventType =
  | "ENGINEERING_CLOSE"
  | "PERMIT_CLOSE"
  | "CONSTRUCTION_CLOSE"
  | "FIELD_CLOSE"
  | "AS_BUILT_CLOSE";

export type CloseEvent = {
  closeEventId: string;
  sourceScopeVersionId: string;
  packageId: string;
  eventType: CloseEventType;
  timestamp: string;
  childScopeVersionId?: string;
  payload?: Record<string, unknown>;
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
  attachmentAuthority?: unknown;
  attachmentMethod?: string;
  attachmentConfidence?: number;
  attachmentAuthorityEvidence?: unknown;
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
  attachmentAuthority?: unknown;
  attachmentCertification?: AttachmentPoint;
  lateralCertification?: LateralPath;
  serviceabilityAssessment?: ServiceabilityAssessment;
  routingMode?: string;
  routingClassification?: string;
  pathConfidence?: string;
  routeStatus?: "VALID" | "ROUTE_NOT_FOUND" | "INVALID";
  routeFailureReason?: string;
  routingAudit?: unknown;
  streetGraphRoute?: unknown;
  roadSegmentCount?: number;
  roadNamesTraversed?: string[];
  roadClassesTraversed?: string[];
  attachmentMethod?: string;
  missingRoutingDependencies?: string[];
  routeAccessPoints?: Record<string, DALCoordinate | undefined>;
  routeCertification?: unknown;
  certifiedGeometrySnapshot?: DALCoordinate[];
  certifiedGeometryHash?: string;
  constraintEvidenceId?: string;
  constraintEvidencePackage?: unknown;
  constraintSummary?: unknown;
  constraints?: unknown;
  unresolvedConstraints?: unknown;
  certificationReadiness?: string;
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
  type?: ScopeVersionTruthType;
  parentScopeVersionId?: string;
  rootScopeVersionId?: string;
  relationshipType?: ScopeVersionRelationshipType;
  inventoryId?: string;
  sourceInventoryId?: string;
  graphId?: string;
  graphVersion?: string;
  candidateSiteId?: string;
  sourceOpportunityId?: string;
  createdBy?: string;
  source: "InventoryGraph" | "GraphExtension" | "OpportunitySeed" | "PrismOpportunity" | "DesignCandidate" | "FieldClosure" | "Manual";
  status: ScopeVersionStatus;
  certificationState: ScopeVersionCertificationState;
  isImmutable?: boolean;
  closureEventId?: string;
  graphSummary?: ScopeVersionGraphSummary;
  iofPackageIds?: string[];
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
  certifiedRouteReference?: ScopeVersionCertifiedRouteReference;
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
  constraintEvidenceId?: string;
  routeGeometryHash?: string;
  quoteStatus?: "PRELIMINARY_QUOTE_CERTIFIED_EVIDENCE" | "PRELIMINARY_QUOTE_INCOMPLETE_EVIDENCE" | "PRELIMINARY_QUOTE_REVIEW_REQUIRED";
  evidenceGrade?: "COMPLETE_CONSTRAINT_EVIDENCE" | "INCOMPLETE_CONSTRAINT_EVIDENCE" | "STALE_CONSTRAINT_EVIDENCE" | "UNKNOWN_CONSTRAINT_EVIDENCE";
  certificationAuthority?: unknown;
  missingConstraintLayers?: string[];
  constraintCompletenessPercent?: number;
  confidenceLevel?: "HIGH" | "MEDIUM" | "LOW" | "REVIEW_REQUIRED";
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
