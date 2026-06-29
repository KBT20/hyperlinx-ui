import type { ConstraintAuthorityMode, ConstraintValue } from "../commercial/ConstraintAuthority";
import type { CommercialCorridorDraft } from "../commercial/CommercialCorridorDraftEngine";
import type { DALCoordinate } from "../types/dal";

export type EngineeringSegmentState =
  | "COMMERCIAL_BASELINE"
  | "ENGINEERING_MODIFIED"
  | "OSRM_GENERATED"
  | "HUMAN_MODIFIED"
  | "SYNTHESIZED"
  | "API_VERIFIED"
  | "CONSTRUCTION_LOCKED"
  | "ACCEPTED"
  | "REJECTED";

export type GeometryAuthorityState =
  | "COMMERCIAL"
  | "OSRM"
  | "ENGINEERING"
  | "API"
  | "SYNTHESIS"
  | "CONSTRUCTION"
  | "AS_BUILT"
  | "OPERATIONAL";

export type EngineeringEditType =
  | "MOVE_VERTEX"
  | "MOVE_SEGMENT"
  | "INSERT_WAYPOINT"
  | "REMOVE_WAYPOINT"
  | "SPLIT_SEGMENT"
  | "MERGE_SEGMENTS"
  | "REPLACE_SEGMENT"
  | "REGENERATE_SEGMENT"
  | "REGENERATE_CORRIDOR"
  | "RESTORE_SEGMENT"
  | "LOCK_SEGMENT"
  | "ACCEPT_SEGMENT"
  | "REJECT_SEGMENT"
  | "ADD_EDIT_REASON"
  | "MOVE_STATION"
  | "RELOCATE_ILA"
  | "RELOCATE_REGENERATION"
  | "MOVE_SPLICE_CASE"
  | "MOVE_HANDHOLE";

export type EngineeringRevisionStatus =
  | "CURRENT"
  | "SUPERSEDED"
  | "ACCEPTED"
  | "REJECTED"
  | "RESTORED"
  | "BRANCHED";

export type SnapPriority =
  | "CUSTOMER_TWIN_ROUTE_GEOMETRY"
  | "EXISTING_BACKBONE"
  | "EXISTING_DUCT"
  | "EXISTING_CONDUIT"
  | "EXISTING_FIBER"
  | "EXISTING_ROAD_CENTERLINE"
  | "OSRM_GEOMETRY"
  | "MANUAL_GEOMETRY";

export type EngineeringLayerId =
  | "ROADS"
  | "PARCELS"
  | "RAIL"
  | "HYDROLOGY"
  | "ELEVATION"
  | "SLOPE"
  | "EXISTING_BACKBONE"
  | "CUSTOMER_TWIN"
  | "FIBER"
  | "CONDUIT"
  | "STATIONS"
  | "REGENERATION_SITES"
  | "HANDHOLES"
  | "STRUCTURES"
  | "CONSTRUCTION_METHODS";

export type EngineeringCompareMode = "BASELINE" | "REVISION" | "DIFFERENCE";

export interface SnapCandidate {
  candidateId: string;
  priority: SnapPriority;
  graphObjectId: string;
  label: string;
  coordinate: DALCoordinate;
  authorityMode: ConstraintAuthorityMode;
}

export interface SnapResult {
  snapId: string;
  priority: SnapPriority;
  priorityRank: number;
  graphObjectId: string;
  label: string;
  coordinate: DALCoordinate;
  requestedCoordinate: DALCoordinate;
  distanceFeet: number;
  authorityMode: ConstraintAuthorityMode;
  validGraphObject: true;
}

export interface SegmentIntelligence {
  lengthFeet: number;
  lengthMiles: number;
  constructionMethod: ConstraintValue<string>;
  civilType: ConstraintValue<string>;
  surface: ConstraintValue<string>;
  rockProbability: ConstraintValue<number>;
  utilityConflicts: ConstraintValue<string>;
  railroad: ConstraintValue<string>;
  waterCrossing: ConstraintValue<string>;
  bridgeAttachment: ConstraintValue<string>;
  poleAttachment: ConstraintValue<string>;
  existingConduit: ConstraintValue<string>;
  existingFiber: ConstraintValue<string>;
  existingDuct: ConstraintValue<string>;
  permitRequirements: ConstraintValue<string>;
  environmental: ConstraintValue<string>;
  unknowns: ConstraintValue<string>;
}

export interface EngineeringSegment {
  segmentId: string;
  commercialSegmentId?: string;
  label: string;
  sequence: number;
  fromVertexIndex: number;
  toVertexIndex: number;
  geometry: DALCoordinate[];
  states: EngineeringSegmentState[];
  geometryAuthority: GeometryAuthorityState;
  snapReferences: SnapResult[];
  intelligence: SegmentIntelligence;
}

export interface EngineeringFinancialSnapshot {
  routeMiles: number;
  fiberFootage: number;
  ductFootage: number;
  labor: number;
  equipment: number;
  materials: number;
  durationDays: number;
  crewCount: number;
  marginPercent: number;
  proposalValue: number;
  recurringRevenue: number;
  commercialReadiness: number;
  confidence: number;
  constructionCost: number;
  handholes: number;
  bores: number;
  opticalLossDb: number;
}

export interface EngineeringFinancialDelta {
  baseline: EngineeringFinancialSnapshot;
  revision: EngineeringFinancialSnapshot;
  difference: EngineeringFinancialSnapshot;
  executiveSummary: string[];
}

export interface EngineeringOpticalPreview {
  totalRouteLossDb: number;
  connectorLossDb: number;
  spliceLossDb: number;
  estimatedAttenuationDb: number;
  longestSpanMiles: number;
  averageSpanMiles: number;
  recommendedIlaSpacingMiles: number;
  estimatedOpticalBudgetDb: number;
  engineeringPreviewOnly: true;
}

export interface EngineeringGeometrySource {
  sourceId: string;
  authority: GeometryAuthorityState;
  label: string;
  geometryHash: string;
  preserved: true;
  createdAt: string;
}

export interface EngineeringEditRecord {
  editId: string;
  editType: EngineeringEditType;
  segmentId?: string;
  vertexIndex?: number;
  actor: string;
  reason: string;
  createdAt: string;
  fromGeometryHash: string;
  toGeometryHash: string;
  snapResult: SnapResult | null;
  financialDelta: EngineeringFinancialDelta;
}

export interface EngineeringRevision {
  revisionId: string;
  revisionNumber: number;
  revisionName: string;
  status: EngineeringRevisionStatus;
  parentRevisionId?: string;
  branchOfRevisionId?: string;
  createdAt: string;
  createdBy: string;
  reason: string;
  geometry: DALCoordinate[];
  geometryHash: string;
  segments: EngineeringSegment[];
  editLog: EngineeringEditRecord[];
  delta: EngineeringFinancialDelta;
  opticalPreview: EngineeringOpticalPreview;
  geometrySources: EngineeringGeometrySource[];
}

export interface ScopeVersionLineageReference {
  commercialDraftId: string;
  engineeringDraftId: string;
  parentScopeVersionId?: string;
  rootScopeVersionId?: string;
  note: string;
}

export interface RouteEngineeringDraft {
  engineeringDraftId: string;
  commercialDraftId: string;
  commercialRouteId: string;
  commercialBaselineSource: "COMMERCIAL_CORRIDOR_DRAFT" | "CERTIFIED_ROUTE_SELECTION" | "OPPORTUNITY_SEED_ROUTE";
  commercialBaselineGeometry: DALCoordinate[];
  commercialBaselineGeometryHash: string;
  commercialBaselineMetrics: EngineeringFinancialSnapshot;
  commercialDraft?: CommercialCorridorDraft;
  scopeVersionLineage: ScopeVersionLineageReference;
  currentRevisionId: string;
  acceptedRevisionId?: string;
  revisions: EngineeringRevision[];
  snapCandidates: SnapCandidate[];
  layerVisibility: Record<EngineeringLayerId, boolean>;
  noScopeVersionCreation: true;
  noInventoryMutation: true;
}
