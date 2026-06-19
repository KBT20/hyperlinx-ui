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
  | "PROVISIONALLY_CERTIFIED"
  | "QUOTED"
  | "APPROVED"
  | "RELEASED_TO_CONTROL"
  | "IN_FIELD"
  | "PARTIALLY_COMPLETE"
  | "ACTIVATED"
  | "IN_CONSTRUCTION"
  | "COMPLETE"
  | "VERIFIED"
  | "OPERATIONAL"
  | "BLOCKED"
  | "REJECTED";

export type ScopeVersionLifecycleState =
  | "ANALYZED"
  | "PROVISIONALLY_CERTIFIED"
  | "QUOTED"
  | "APPROVED"
  | "RELEASED_TO_CONTROL"
  | "IN_FIELD"
  | "PARTIALLY_COMPLETE"
  | "COMPLETE"
  | "VERIFIED"
  | "OPERATIONAL"
  | "BLOCKED"
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
  streetRouting?: unknown;
  streetLayerLoaded?: boolean;
  streetFeatureCount?: number;
  streetLayerAuthority?: string;
  streetLayerCertificationUse?: string;
  streetLayerBboxCoverage?: boolean;
  routingBBox?: [number, number, number, number];
  routingBufferMiles?: number;
  routingScope?: "NEW_LATERAL_ONLY";
  existingInventoryRoutePreserved?: boolean;
  existingInventoryLengthFeet?: number;
  newLateralLengthFeet?: number;
  osmRouteFound?: boolean;
  osmSnapDistanceFeet?: number;
  candidateSnapDistanceFeet?: number;
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
    | "OSRM_ROUTE"
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

export type RouteStationState = "PLANNED" | "RELEASED" | "IN_PROGRESS" | "COMPLETE" | "VERIFIED" | "BLOCKED" | "REJECTED";

export type ScopeObjectState =
  | "PLANNED"
  | "RELEASED"
  | "INSTALLED"
  | "TESTED"
  | "ACCEPTED"
  | "COMPLETE"
  | "VERIFIED"
  | "BLOCKED"
  | "REJECTED";

export type ClosureType =
  | "STATION_STATE_TRANSITION"
  | "STATION_RANGE_TRANSITION"
  | "OBJECT_STATE_TRANSITION"
  | "OBJECT_RANGE_TRANSITION";

export type ClosureAuthority = "FIELD" | "CONTROL" | "ENGINEERING_REVIEW" | "SYSTEM";

export type ClosureRecord = {
  closureId: string;
  scopeVersionId: string;
  certifiedRouteId: string;
  stationId?: string;
  stationStartId?: string;
  stationEndId?: string;
  objectIds: string[];
  closureType: ClosureType;
  previousStationState?: RouteStationState;
  newStationState?: RouteStationState;
  previousObjectStates?: Record<string, ScopeObjectState>;
  newObjectState?: ScopeObjectState;
  actorId: string;
  actorName: string;
  authority: ClosureAuthority;
  evidenceIds: string[];
  notes?: string;
  feetAffected?: number;
  persistenceStatus?: "PERSISTED" | "PERSISTENCE_PENDING";
  createdAt: string;
  updatedAt: string;
};

export type ScopeObjectCategory = "INFRASTRUCTURE" | "CONSTRAINT";

export type NetworkAttachmentMode =
  | "EXISTING_HANDHOLE"
  | "EXISTING_VAULT"
  | "EXISTING_SPLICE"
  | "EXISTING_NODE"
  | "PLANNED_HANDHOLE";

export type ScopeInfrastructureObjectType =
  | "NETWORK_ATTACHMENT"
  | "SERVICE_LOCATION"
  | "BUILDING_ENTRANCE"
  | "DUCT"
  | "FIBER"
  | "SPLICE"
  | "HANDHOLE"
  | "VAULT"
  | "ATTACHMENT_POINT"
  | "ROAD_CROSSING"
  | "PARCEL"
  | "BUILDING"
  | "RAILROAD"
  | "WATERWAY"
  | "TERRAIN_ZONE"
  | "UTILITY_CONFLICT"
  | "PERMIT_AUTHORITY";

export type RouteStation = {
  stationId: string;
  scopeVersionId: string;
  certifiedRouteId: string;
  routeId: string;
  measureFeet: number;
  stationLabel: string;
  coordinate: DALCoordinate;
  stationState: RouteStationState;
  createdAt: string;
  updatedAt: string;
};

export type ScopeInfrastructureObject = {
  objectId: string;
  scopeVersionId: string;
  stationId: string;
  objectCategory: ScopeObjectCategory;
  objectType: ScopeInfrastructureObjectType;
  objectState: ScopeObjectState;
  label: string;
  coordinate: DALCoordinate;
  measureFeet: number;
  quantity: number;
  unit: string;
  specification: string;
  parentObjectId?: string;
  inventoryId?: string;
  graphId?: string;
  sourceRouteId?: string;
  sourceNodeId?: string;
  sourceEdgeId?: string;
  sourceStationId?: string;
  sourceObjectId?: string;
  sourceObjectType?: string;
  attachmentMode?: NetworkAttachmentMode;
  attachmentCoordinate?: DALCoordinate;
  attachmentReferenceResolved?: boolean;
  attachmentReferenceType?: "STATION" | "NODE" | "EDGE" | "ROUTE_POINT" | "UNKNOWN";
  attachmentReferenceFallbackReason?: string;
  existingInventoryReferencePreserved?: boolean;
  lateralStationId?: string;
  lateralStationLabel?: string;
  plannedHandholeRequired?: boolean;
  latitude?: number;
  longitude?: number;
  createdAt: string;
  updatedAt: string;
};

export type FieldObjectWorkContext = {
  objectId: string;
  stationId: string;
  objectType: ScopeInfrastructureObjectType;
  objectCategory: ScopeObjectCategory;
  objectLabel: string;
  humanName: string;
  objectState: ScopeObjectState;
  measureFeet: number;
  coordinate: DALCoordinate;
  requiredWork: string;
  dependencies: string[];
  allowedTransitions: ScopeObjectState[];
  isClosable: boolean;
  isBlocked: boolean;
  closureHistory: ClosureRecord[];
  sourceObject: ScopeInfrastructureObject;
};

export type FieldStationWorkContext = {
  scopeVersionId: string;
  certifiedRouteId: string;
  routeId: string;
  stationId: string;
  stationLabel: string;
  measureFeet: number;
  coordinate: DALCoordinate;
  nearestRoad: string;
  nearestAddress: string;
  nearestParcel: string;
  stationState: RouteStationState;
  stationDerivedState: RouteStationState;
  objectsAtStation: FieldObjectWorkContext[];
  openObjectsAtStation: FieldObjectWorkContext[];
  completeObjectsAtStation: FieldObjectWorkContext[];
  verifiedObjectsAtStation: FieldObjectWorkContext[];
  blockedObjectsAtStation: FieldObjectWorkContext[];
  allowedStationTransitions: RouteStationState[];
  nextRecommendedObjectId?: string;
  sourceStation: RouteStation;
};

export type ScopeVersionStationingSummary = {
  stationIntervalFeet: number;
  routeFeet: number;
  stationCount: number;
  firstStationId?: string;
  finalStationId?: string;
  finalStationMeasureFeet: number;
  certifiedRouteId: string;
  geometryHash: string;
};

export type ScopeVersionObjectPlacementSummary = {
  objectCount: number;
  objectTypes: ScopeInfrastructureObjectType[];
  objectsByStation: Record<string, string[]>;
  productionFeetPlanned: number;
  productionFeetComplete: number;
  percentComplete: number;
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
  attachmentId?: string;
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
  streetRouting?: unknown;
  streetLayerLoaded?: boolean;
  streetFeatureCount?: number;
  streetLayerAuthority?: string;
  streetLayerCertificationUse?: string;
  streetLayerBboxCoverage?: boolean;
  routingBBox?: [number, number, number, number];
  routingBufferMiles?: number;
  routingScope?: "NEW_LATERAL_ONLY";
  existingInventoryRoutePreserved?: boolean;
  existingInventoryLengthFeet?: number;
  newLateralLengthFeet?: number;
  attachmentId?: string;
  osmRouteFound?: boolean;
  osmSnapDistanceFeet?: number;
  candidateSnapDistanceFeet?: number;
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
  proposedNetworkExtension?: unknown;
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
  stations?: Array<RouteStation | InventoryStation>;
  objects?: ScopeInfrastructureObject[];
  closures?: ClosureRecord[];
  stationing?: ScopeVersionStationingSummary;
  objectPlacement?: ScopeVersionObjectPlacementSummary;
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
  closures?: ClosureRecord[];
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
