import { useEffect, useMemo, useRef, useState } from "react";
import {
  attachConstraintEvidence,
  certifyRoute,
  createDraftRoute,
  evaluateRouteAuthority,
  markGeometryEdited,
  rejectRoute,
  computeRouteGeometryHash,
} from "../routing/RouteAuthorityEngine";
import type { CertifiedRoute, CorridorBasis, RouteMode } from "../routing/CertifiedRouteAuthority";
import { renderCertifiedRouteAuthority } from "../routing/RouteAuthorityRenderer";
import { MapKernel, renderMapKernelPrimitives, type MapKernelRenderSpec } from "../mapkernel";
import {
  certifyCertifiedRoute,
  createCertifiedRoute,
  listCandidateSites,
  listCertifiedRoutes,
  listInventoryGraphs,
  listOpportunitySeeds,
  listScopeVersions,
  rejectCertifiedRoute,
  saveScopeVersion,
  updateCertifiedRoute,
} from "../api/dalClient";
import type { DALCoordinate, InventoryGraphMetadata, ScopeVersion } from "../types/dal";
import type { CandidateSite } from "../types/candidateSite";
import type { OpportunitySeed } from "../types/portfolio";
import { useDALState } from "../dal/DALState";
import { getAuthoritativeLifecycleState, transitionScopeVersionLifecycle } from "../scopeversion/ScopeVersionLifecycleGuard";
import {
  acceptEngineeringRevision,
  acceptEngineeringSegment,
  applyGeometryChangeAsRevision,
  applySegmentGeometryChangeAsRevision,
  branchEngineeringRevision,
  createCorridorCandidateRevision,
  createEngineeringDraftFromCommercialDraft,
  createEngineeringDraftFromRoute,
  currentEngineeringRevision,
  insertEngineeringWaypoint,
  lockEngineeringSegment,
  mergeEngineeringSegments,
  moveEngineeringSegment,
  recordEngineeringSegmentReason,
  regenerateEngineeringCorridor,
  regenerateEngineeringSegment,
  restoreEngineeringSegment,
  rejectEngineeringSegment,
  rejectEngineeringRevision,
  removeEngineeringWaypoint,
  replaceEngineeringSegment,
  restoreEngineeringRevision,
  saveCorridorCandidateRevision,
  setEngineeringLayerVisibility,
} from "../engineering/RouteEngineeringDraftEngine";
import {
  candidateRevisionReason,
  candidateSnapshot,
  createBaselineCorridorCandidate,
  generateInitialCorridorCandidates,
  generateWaypointCorridorCandidate,
  type CorridorCandidate,
  type CorridorCandidateFailure,
  type CorridorCandidateHintType,
  type CorridorCandidateType,
} from "../engineering/CorridorCandidateEngine";
import type {
  EngineeringCompareMode,
  EngineeringFinancialSnapshot,
  EngineeringLayerId,
  EngineeringSegment,
  RouteEngineeringDraft,
} from "../engineering/RouteEngineeringDraft";

type TargetType = "candidate" | "opportunity";
type EngineeringWorkspaceMode = "SALES_ENGINEERING" | "ROUTE_ENGINEERING";

const ENGINEERING_WORKSPACE_MODE_KEY = "hyperlinx-dal-dev:engineering-workspace-mode:v1";

function readEngineeringWorkspaceMode(): EngineeringWorkspaceMode {
  if (typeof window === "undefined") return "SALES_ENGINEERING";
  const value = window.sessionStorage.getItem(ENGINEERING_WORKSPACE_MODE_KEY);
  return value === "ROUTE_ENGINEERING" ? "ROUTE_ENGINEERING" : "SALES_ENGINEERING";
}

function fmt(value: number | undefined) {
  return Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function money(value: number | undefined) {
  return Number(value || 0).toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function feet(value: number | undefined) {
  return `${Math.round(Number(value || 0)).toLocaleString()} ft`;
}

function miles(value: number | undefined) {
  return `${Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })} mi`;
}

function coordinateLabel(coordinate: DALCoordinate | undefined) {
  if (!coordinate) return "n/a";
  return `${coordinate[1].toFixed(6)}, ${coordinate[0].toFixed(6)}`;
}

function validCoordinate(coordinate: DALCoordinate | undefined): coordinate is DALCoordinate {
  return (
    Array.isArray(coordinate) &&
    coordinate.length >= 2 &&
    Number.isFinite(Number(coordinate[0])) &&
    Number.isFinite(Number(coordinate[1])) &&
    Math.abs(Number(coordinate[0])) <= 180 &&
    Math.abs(Number(coordinate[1])) <= 90
  );
}

function midpoint(a: DALCoordinate, b: DALCoordinate): DALCoordinate {
  return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
}

function routeMidpoint(geometry: DALCoordinate[]): DALCoordinate | null {
  if (geometry.length < 2) return null;
  const index = Math.max(1, Math.floor(geometry.length / 2));
  return geometry[index] ?? midpoint(geometry[0], geometry[geometry.length - 1]);
}

function offsetCoordinate(coordinate: DALCoordinate, direction: "N" | "S" | "E" | "W", distance = 0.02): DALCoordinate {
  const offset = {
    N: [0, distance],
    S: [0, -distance],
    E: [distance, 0],
    W: [-distance, 0],
  }[direction];
  return [coordinate[0] + offset[0], coordinate[1] + offset[1]];
}

function signedMetric(value: number, unit = "") {
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}${unit}`;
}

function signedMoney(value: number) {
  const prefix = value > 0 ? "+" : value < 0 ? "-" : "";
  return `${prefix}${money(Math.abs(value))}`;
}

function snapshotValue(snapshot: EngineeringFinancialSnapshot, key: keyof EngineeringFinancialSnapshot) {
  return Number(snapshot[key] ?? 0);
}

const ENGINEERING_LAYER_LABELS: Record<EngineeringLayerId, string> = {
  ROADS: "Roads",
  PARCELS: "Parcels",
  RAIL: "Rail",
  HYDROLOGY: "Hydrology",
  ELEVATION: "Elevation",
  SLOPE: "Slope",
  EXISTING_BACKBONE: "Existing backbone",
  CUSTOMER_TWIN: "Customer Twin",
  FIBER: "Fiber",
  CONDUIT: "Conduit",
  STATIONS: "Stations",
  REGENERATION_SITES: "Regeneration sites",
  HANDHOLES: "Handholes",
  STRUCTURES: "Structures",
  CONSTRUCTION_METHODS: "Construction methods",
};

const DELTA_ROWS: Array<{ key: keyof EngineeringFinancialSnapshot; label: string; kind: "feet" | "money" | "number" | "percent" | "score" | "db" | "miles" }> = [
  { key: "routeMiles", label: "Route miles", kind: "miles" },
  { key: "fiberFootage", label: "Fiber footage", kind: "feet" },
  { key: "ductFootage", label: "Duct footage", kind: "feet" },
  { key: "labor", label: "Labor", kind: "money" },
  { key: "equipment", label: "Equipment", kind: "money" },
  { key: "materials", label: "Materials", kind: "money" },
  { key: "durationDays", label: "Duration", kind: "number" },
  { key: "crewCount", label: "Crew count", kind: "number" },
  { key: "marginPercent", label: "Margin", kind: "percent" },
  { key: "proposalValue", label: "Proposal value", kind: "money" },
  { key: "recurringRevenue", label: "Recurring revenue", kind: "money" },
  { key: "commercialReadiness", label: "Commercial readiness", kind: "score" },
  { key: "confidence", label: "Confidence", kind: "score" },
  { key: "constructionCost", label: "Construction cost", kind: "money" },
  { key: "handholes", label: "Handholes", kind: "number" },
  { key: "bores", label: "Bores", kind: "number" },
  { key: "opticalLossDb", label: "Optical loss", kind: "db" },
];

const EDIT_REASONS = [
  "Railroad",
  "River",
  "Existing Utility",
  "Existing Fiber",
  "Customer Request",
  "Diversity",
  "Easement",
  "ROW",
  "Cost",
  "Constructability",
  "Environmental",
  "Permit",
  "Engineering Judgment",
];

function formatSnapshotValue(value: number, kind: (typeof DELTA_ROWS)[number]["kind"]) {
  if (kind === "money") return money(value);
  if (kind === "feet") return feet(value);
  if (kind === "miles") return miles(value);
  if (kind === "percent") return `${fmt(value)}%`;
  if (kind === "score") return `${Math.round(value)}%`;
  if (kind === "db") return `${fmt(value)} dB`;
  return fmt(value);
}

function formatDeltaValue(value: number, kind: (typeof DELTA_ROWS)[number]["kind"]) {
  if (kind === "money") return signedMoney(value);
  if (kind === "feet") return signedMetric(Math.round(value), " ft");
  if (kind === "miles") return signedMetric(value, " mi");
  if (kind === "percent") return signedMetric(value, "%");
  if (kind === "score") return signedMetric(Math.round(value), " pts");
  if (kind === "db") return signedMetric(value, " dB");
  return signedMetric(value);
}

interface CorridorCandidateComparison {
  valid: boolean;
  reason?: string;
  snapshot: EngineeringFinancialSnapshot;
  grossMargin: number;
  costPerMile: number;
  revenuePerMile: number;
  marginPerMile: number;
  delta: {
    routeMiles: number;
    constructionCost: number;
    proposalValue: number;
    grossMargin: number;
    costPerMile: number;
    revenuePerMile: number;
    marginPerMile: number;
    opticalLossDb: number;
    durationDays: number;
    confidence: number;
    commercialReadiness: number;
  };
}

function finiteNumber(value: number | undefined | null) {
  return typeof value === "number" && Number.isFinite(value);
}

function positiveNumber(value: number | undefined | null) {
  return finiteNumber(value) && Number(value) > 0;
}

function financialSnapshotValid(snapshot: EngineeringFinancialSnapshot | undefined | null): snapshot is EngineeringFinancialSnapshot {
  if (!snapshot) return false;
  return [
    snapshot.routeMiles,
    snapshot.constructionCost,
    snapshot.proposalValue,
    snapshot.marginPercent,
    snapshot.opticalLossDb,
    snapshot.durationDays,
    snapshot.confidence,
    snapshot.commercialReadiness,
  ].every(finiteNumber) && snapshot.routeMiles > 0 && snapshot.constructionCost > 0 && snapshot.proposalValue > 0 && snapshot.durationDays > 0;
}

function buildCorridorCandidateComparison(candidate: CorridorCandidate, current: EngineeringFinancialSnapshot | undefined | null): CorridorCandidateComparison {
  const snapshot = candidateSnapshot(candidate);
  const invalid = (reason: string): CorridorCandidateComparison => ({
    valid: false,
    reason,
    snapshot,
    grossMargin: 0,
    costPerMile: 0,
    revenuePerMile: 0,
    marginPerMile: 0,
    delta: {
      routeMiles: 0,
      constructionCost: 0,
      proposalValue: 0,
      grossMargin: 0,
      costPerMile: 0,
      revenuePerMile: 0,
      marginPerMile: 0,
      opticalLossDb: 0,
      durationDays: 0,
      confidence: 0,
      commercialReadiness: 0,
    },
  });
  if (candidate.geometry.length < 2 || !candidate.geometryHash) return invalid("geometry authority missing");
  if (!financialSnapshotValid(snapshot) || !financialSnapshotValid(current)) return invalid("estimate authority missing");
  if (!positiveNumber(candidate.routeMiles) || !positiveNumber(candidate.constructionCost)) return invalid("candidate economics missing");
  if (!finiteNumber(candidate.opticalLossDb) || !positiveNumber(candidate.durationDays) || !finiteNumber(candidate.confidence)) return invalid("candidate performance metrics missing");
  const candidateGrossMargin = snapshot.proposalValue - snapshot.constructionCost;
  const currentGrossMargin = current.proposalValue - current.constructionCost;
  const costPerMile = snapshot.constructionCost / snapshot.routeMiles;
  const revenuePerMile = snapshot.proposalValue / snapshot.routeMiles;
  const marginPerMile = candidateGrossMargin / snapshot.routeMiles;
  const currentCostPerMile = current.constructionCost / current.routeMiles;
  const currentRevenuePerMile = current.proposalValue / current.routeMiles;
  const currentMarginPerMile = currentGrossMargin / current.routeMiles;
  if (![candidateGrossMargin, currentGrossMargin, costPerMile, revenuePerMile, marginPerMile, currentCostPerMile, currentRevenuePerMile, currentMarginPerMile].every(finiteNumber)) {
    return invalid("comparison math failed");
  }
  return {
    valid: true,
    snapshot,
    grossMargin: candidateGrossMargin,
    costPerMile,
    revenuePerMile,
    marginPerMile,
    delta: {
      routeMiles: snapshot.routeMiles - current.routeMiles,
      constructionCost: snapshot.constructionCost - current.constructionCost,
      proposalValue: snapshot.proposalValue - current.proposalValue,
      grossMargin: candidateGrossMargin - currentGrossMargin,
      costPerMile: costPerMile - currentCostPerMile,
      revenuePerMile: revenuePerMile - currentRevenuePerMile,
      marginPerMile: marginPerMile - currentMarginPerMile,
      opticalLossDb: snapshot.opticalLossDb - current.opticalLossDb,
      durationDays: snapshot.durationDays - current.durationDays,
      confidence: snapshot.confidence - current.confidence,
      commercialReadiness: snapshot.commercialReadiness - current.commercialReadiness,
    },
  };
}

function segmentStateClass(segment: EngineeringSegment) {
  if (segment.states.includes("ACCEPTED")) return "pass";
  if (segment.states.includes("REJECTED")) return "fail";
  if (segment.states.includes("ENGINEERING_MODIFIED") || segment.states.includes("HUMAN_MODIFIED")) return "warning";
  return "green";
}

function segmentConstraints(segment: EngineeringSegment) {
  return [
    segment.intelligence.constructionMethod,
    segment.intelligence.civilType,
    segment.intelligence.surface,
    segment.intelligence.rockProbability,
    segment.intelligence.utilityConflicts,
    segment.intelligence.railroad,
    segment.intelligence.waterCrossing,
    segment.intelligence.bridgeAttachment,
    segment.intelligence.poleAttachment,
    segment.intelligence.existingConduit,
    segment.intelligence.existingFiber,
    segment.intelligence.existingDuct,
    segment.intelligence.permitRequirements,
    segment.intelligence.environmental,
    segment.intelligence.unknowns,
  ];
}

function targetLabel(target: CandidateSite | OpportunitySeed | null, type: TargetType) {
  if (!target) return "No target selected";
  if (type === "candidate") return (target as CandidateSite).companyName;
  const seed = target as OpportunitySeed;
  return seed.siteName ?? seed.candidateSiteId ?? seed.id;
}

function targetCoordinate(target: CandidateSite | OpportunitySeed | null, type: TargetType): DALCoordinate | undefined {
  if (!target) return undefined;
  const lon = Number(type === "candidate" ? (target as CandidateSite).longitude : (target as OpportunitySeed).longitude);
  const lat = Number(type === "candidate" ? (target as CandidateSite).latitude : (target as OpportunitySeed).latitude);
  const coord: DALCoordinate = [lon, lat];
  return validCoordinate(coord) ? coord : undefined;
}

function nearestAttachmentFromSeed(seed: OpportunitySeed | null): DALCoordinate | undefined {
  const geometry = seed?.buildPath?.geometry;
  const candidate = targetCoordinate(seed, "opportunity");
  if (!geometry?.length || !candidate) return undefined;
  const first = geometry[0];
  const last = geometry[geometry.length - 1];
  if (!validCoordinate(first) || !validCoordinate(last)) return undefined;
  const firstDistance = Math.hypot(first[0] - candidate[0], first[1] - candidate[1]);
  const lastDistance = Math.hypot(last[0] - candidate[0], last[1] - candidate[1]);
  return firstDistance < lastDistance ? last : first;
}

function routeGeometryFromSeed(seed: OpportunitySeed | null, candidate: DALCoordinate, attachment: DALCoordinate) {
  const geometry = seed?.buildPath?.geometry?.filter(validCoordinate);
  if (geometry && geometry.length > 1) return geometry;
  return [candidate, attachment];
}

function referenceFromRoute(route: CertifiedRoute) {
  return {
    certifiedRouteId: route.certifiedRouteId,
    geometryHash: route.geometryHash,
    routeAuthorityState: route.routeAuthorityState,
    routeMode: route.routeMode,
    routeFeet: route.routeFeet,
    routeMiles: route.routeMiles,
    constraintEvidenceId: route.constraintEvidenceId,
  };
}

export default function RouteEngineeringWorkspace() {
  const {
    selectedInventoryId,
    setSelectedInventoryId,
    selectedCandidateSiteId,
    setSelectedCandidateSiteId,
    selectedOpportunitySeedId,
    setSelectedOpportunitySeedId,
    selectedCommercialCorridorDraft,
    selectedRouteEngineeringActivation,
    selectedRouteEngineeringDraft,
    setSelectedRouteEngineeringDraft,
    setWorkspace,
    setSelectedScopeVersion,
    setSelectedScopeVersionId,
  } = useDALState();
  const [inventories, setInventories] = useState<InventoryGraphMetadata[]>([]);
  const [candidateSites, setCandidateSites] = useState<CandidateSite[]>([]);
  const [opportunitySeeds, setOpportunitySeeds] = useState<OpportunitySeed[]>([]);
  const [certifiedRoutes, setCertifiedRoutes] = useState<CertifiedRoute[]>([]);
  const [scopeVersions, setScopeVersions] = useState<ScopeVersion[]>([]);
  const [engineeringMode, setEngineeringMode] = useState<EngineeringWorkspaceMode>(() => readEngineeringWorkspaceMode());
  const [selectedCertifiedRouteId, setSelectedCertifiedRouteId] = useState("");
  const [selectedApprovalScopeId, setSelectedApprovalScopeId] = useState("");
  const [targetType, setTargetType] = useState<TargetType>("opportunity");
  const [draftRoute, setDraftRoute] = useState<CertifiedRoute | null>(null);
  const [engineeringDraft, setEngineeringDraft] = useState<RouteEngineeringDraft | null>(() => selectedRouteEngineeringDraft);
  const [selectedEngineeringSegmentId, setSelectedEngineeringSegmentId] = useState("");
  const [selectedRevisionId, setSelectedRevisionId] = useState("");
  const [compareMode, setCompareMode] = useState<EngineeringCompareMode>("DIFFERENCE");
  const [selectedVertexIndex, setSelectedVertexIndex] = useState<number | null>(null);
  const [editReason, setEditReason] = useState("Engineering Judgment");
  const [editReasonNote, setEditReasonNote] = useState("");
  const [activationFailureReason, setActivationFailureReason] = useState("");
  const [activationRetryNonce, setActivationRetryNonce] = useState(0);
  const [salesCandidateStatus, setSalesCandidateStatus] = useState("Sales Engineering corridor mode ready.");
  const [corridorCandidates, setCorridorCandidates] = useState<CorridorCandidate[]>([]);
  const [candidateFailures, setCandidateFailures] = useState<CorridorCandidateFailure[]>([]);
  const [selectedCorridorCandidateId, setSelectedCorridorCandidateId] = useState("");
  const [previewCorridorCandidateId, setPreviewCorridorCandidateId] = useState("");
  const [candidateGenerationState, setCandidateGenerationState] = useState<"IDLE" | "GENERATING" | "FAILED">("IDLE");
  const [revisionExplanation, setRevisionExplanation] = useState("");
  const [engineerName, setEngineerName] = useState("DAL Engineer");
  const [certificationNotes, setCertificationNotes] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [status, setStatus] = useState("Route Engineering ready.");
  const candidateRequestSeqRef = useRef(0);
  const candidateDebounceRef = useRef<number | null>(null);
  const initialCandidateDraftRef = useRef("");

  async function refresh() {
    try {
      const [nextInventories, nextCandidates, nextSeeds, nextRoutes, nextScopes] = await Promise.all([
        listInventoryGraphs(),
        listCandidateSites(),
        listOpportunitySeeds(),
        listCertifiedRoutes(),
        listScopeVersions(),
      ]);
      setInventories(nextInventories);
      setCandidateSites(nextCandidates);
      setOpportunitySeeds(nextSeeds);
      setCertifiedRoutes(nextRoutes);
      setScopeVersions(nextScopes);
      if (!selectedInventoryId && nextInventories[0]) setSelectedInventoryId(nextInventories[0].inventoryId);
      if (!selectedApprovalScopeId && nextScopes[0]) setSelectedApprovalScopeId(nextScopes[0].scopeVersionId);
      setStatus("Route authority data loaded from DAL API.");
    } catch (error: any) {
      setStatus(`Route authority load failed: ${error?.message ?? String(error)}`);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.sessionStorage.setItem(ENGINEERING_WORKSPACE_MODE_KEY, engineeringMode);
  }, [engineeringMode]);

  useEffect(() => () => {
    if (candidateDebounceRef.current !== null) window.clearTimeout(candidateDebounceRef.current);
  }, []);

  const selectedInventory = inventories.find((inventory) => inventory.inventoryId === selectedInventoryId) ?? inventories[0] ?? null;
  const selectedSeed = opportunitySeeds.find((seed) => seed.id === selectedOpportunitySeedId) ?? opportunitySeeds[0] ?? null;
  const selectedCandidate = candidateSites.find((candidate) => candidate.candidateId === selectedCandidateSiteId) ?? candidateSites[0] ?? null;
  const selectedTarget = targetType === "candidate" ? selectedCandidate : selectedSeed;
  const selectedTargetCoordinate = targetCoordinate(selectedTarget, targetType);
  const activeRoute = draftRoute ?? certifiedRoutes.find((route) => route.certifiedRouteId === selectedCertifiedRouteId) ?? null;
  const evaluatedRoute = activeRoute ? evaluateRouteAuthority(activeRoute) : null;
  const routeSpec = useMemo(() => (evaluatedRoute ? renderCertifiedRouteAuthority(evaluatedRoute) : null), [evaluatedRoute]);
  const routeRenderAudit = useMemo(() => {
    const renderedPrimitives = routeSpec ? renderMapKernelPrimitives([routeSpec]) : [];
    const routePrimitive = renderedPrimitives.find(
      (primitive) =>
        primitive.ref.kind === "Route" &&
        (primitive.metadata?.isRouteAuthority === true || String(primitive.metadata?.sourceLayer ?? "").startsWith("ROUTE_AUTHORITY_"))
    );
    return {
      certifiedRouteExists: Boolean(evaluatedRoute),
      geometryCoordinateCount: evaluatedRoute?.geometry.length ?? 0,
      renderedPrimitiveCount: renderedPrimitives.length,
      routeAuthorityPrimitiveCount: renderedPrimitives.filter((primitive) => primitive.metadata?.isRouteAuthority === true).length,
      fitRouteEnabled: Boolean(evaluatedRoute?.geometry && evaluatedRoute.geometry.length > 1),
      fitCertifiedRouteEnabled: Boolean(evaluatedRoute?.geometry && evaluatedRoute.geometry.length > 1),
      renderSourceLayer: String(routePrimitive?.metadata?.sourceLayer ?? "none"),
      renderAuthorityId: String(routePrimitive?.metadata?.routeAuthorityId ?? evaluatedRoute?.certifiedRouteId ?? "none"),
    };
  }, [evaluatedRoute, routeSpec]);
  const approvalScope =
    scopeVersions.find((scope) => scope.scopeVersionId === selectedApprovalScopeId) ??
    scopeVersions.find((scope) => scope.certifiedRouteReference?.certifiedRouteId === evaluatedRoute?.certifiedRouteId) ??
    null;
  const activeEngineeringRevision = useMemo(() => currentEngineeringRevision(engineeringDraft), [engineeringDraft]);
  const selectedEngineeringSegment =
    activeEngineeringRevision?.segments.find((segment) => segment.segmentId === selectedEngineeringSegmentId) ??
    activeEngineeringRevision?.segments[0] ??
    null;
  const selectedRevision =
    engineeringDraft?.revisions.find((revision) => revision.revisionId === selectedRevisionId) ??
    activeEngineeringRevision ??
    null;
  const incomingCommercialDraft = selectedRouteEngineeringActivation?.commercialDraft ?? selectedCommercialCorridorDraft;
  const activationKey = selectedRouteEngineeringActivation?.requestId ?? incomingCommercialDraft?.routeId ?? "";
  const selectedEngineeringSegmentIndex = activeEngineeringRevision?.segments.findIndex((segment) => segment.segmentId === selectedEngineeringSegmentId) ?? -1;
  const editReasonText = editReasonNote.trim() ? `${editReason} - ${editReasonNote.trim()}` : editReason;
  const unknownConstraintCount = activeEngineeringRevision?.segments.reduce((total, segment) => (
    total + segmentConstraints(segment).filter((constraint) => constraint.authorityMode === "UNKNOWN" || constraint.value === null).length
  ), 0) ?? 0;
  const apiCoveragePercent = activeEngineeringRevision?.segments.length
    ? Math.round((activeEngineeringRevision.segments.filter((segment) => segment.geometryAuthority === "OSRM" || segment.geometryAuthority === "API").length / activeEngineeringRevision.segments.length) * 100)
    : 0;
  const selectedCorridorCandidate =
    corridorCandidates.find((candidate) => candidate.candidateId === selectedCorridorCandidateId) ??
    corridorCandidates[0] ??
    null;
  const previewCorridorCandidate =
    corridorCandidates.find((candidate) => candidate.candidateId === previewCorridorCandidateId) ??
    selectedCorridorCandidate;
  const currentRevisionGeometryHash = activeEngineeringRevision?.geometryHash ?? "";
  const selectedCorridorCandidateComparison = selectedCorridorCandidate && activeEngineeringRevision
    ? buildCorridorCandidateComparison(selectedCorridorCandidate, activeEngineeringRevision.delta.revision)
    : null;
  const candidateRenderSpecs = useMemo<MapKernelRenderSpec[]>(() => {
    if (!engineeringDraft) return [];
    const primitives: MapKernelRenderSpec["primitives"] = [];
    const addLine = (id: string, label: string, geometry: DALCoordinate[], stroke: string, strokeWidth: number, dasharray?: string, opacity = 0.75) => {
      if (geometry.length < 2) return;
      primitives.push({
        id,
        layerId: "lateral",
        kind: "line",
        ref: { kind: "Lateral", id, renderKey: id },
        coordinates: geometry,
        label,
        style: { stroke, strokeWidth, dasharray, opacity },
        metadata: {
          selectable: true,
          source: "sales-engineering-corridor-candidate",
          renderAuthority: "Non-authoritative Sales Engineering candidate",
        },
      });
    };
    addLine("commercial-baseline-candidate", "Commercial Baseline", engineeringDraft.commercialBaselineGeometry, "#94a3b8", 4, "8 8", 0.58);
    corridorCandidates.forEach((candidate) => {
      const highlighted = candidate.candidateId === previewCorridorCandidate?.candidateId || candidate.candidateId === selectedCorridorCandidate?.candidateId;
      const current = candidate.geometryHash === currentRevisionGeometryHash;
      addLine(
        `candidate-${candidate.candidateId}`,
        candidate.name,
        candidate.geometry,
        current ? "#22c55e" : highlighted ? "#f59e0b" : "#38bdf8",
        highlighted || current ? 5 : 3,
        candidate.source === "OSRM" || candidate.source === "OSRM_BASELINE" ? undefined : "10 7",
        highlighted || current ? 0.92 : 0.52
      );
      candidate.waypoints.forEach((waypoint, index) => {
        primitives.push({
          id: `candidate-${candidate.candidateId}-waypoint-${index}`,
          layerId: "node",
          kind: "point",
          ref: { kind: "Node", id: `candidate-${candidate.candidateId}-waypoint-${index}`, renderKey: `candidate-${candidate.candidateId}-waypoint-${index}` },
          coordinate: waypoint,
          label: `${candidate.name} waypoint`,
          style: { fill: "#fef3c7", stroke: "#92400e", radius: highlighted ? 8 : 6, strokeWidth: 2, opacity: highlighted ? 0.95 : 0.62 },
          metadata: { selectable: true, source: "sales-engineering-waypoint" },
        });
      });
    });
    const start = engineeringDraft.commercialBaselineGeometry[0];
    const end = engineeringDraft.commercialBaselineGeometry.at(-1);
    if (start) {
      primitives.push({
        id: "sales-engineering-fixed-a",
        layerId: "attachment",
        kind: "point",
        ref: { kind: "Attachment", id: "sales-engineering-fixed-a", renderKey: "sales-engineering-fixed-a" },
        coordinate: start,
        label: "Fixed A endpoint",
        style: { fill: "#dcfce7", stroke: "#166534", radius: 8, strokeWidth: 3, opacity: 0.95 },
        metadata: { selectable: true, source: "sales-engineering-fixed-endpoint" },
      });
    }
    if (end) {
      primitives.push({
        id: "sales-engineering-fixed-z",
        layerId: "site",
        kind: "point",
        ref: { kind: "Site", id: "sales-engineering-fixed-z", renderKey: "sales-engineering-fixed-z" },
        coordinate: end,
        label: "Fixed Z endpoint",
        style: { fill: "#fee2e2", stroke: "#991b1b", radius: 8, strokeWidth: 3, opacity: 0.95 },
        metadata: { selectable: true, source: "sales-engineering-fixed-endpoint" },
      });
    }
    return primitives.length
      ? [{
          specId: `${engineeringDraft.engineeringDraftId}:sales-engineering-candidates`,
          sourceType: "Manual",
          sourceId: engineeringDraft.engineeringDraftId,
          name: "Sales Engineering Corridor Candidates",
          primitives,
          metadata: {
            sourceLayer: "SALES_ENGINEERING_CANDIDATES",
            renderAuthority: "Non-authoritative candidate preview",
          },
        }]
      : [];
  }, [
    corridorCandidates,
    currentRevisionGeometryHash,
    engineeringDraft?.engineeringDraftId,
    engineeringDraft?.commercialBaselineGeometryHash,
    previewCorridorCandidate?.candidateId,
    selectedCorridorCandidate?.candidateId,
  ]);

  useEffect(() => {
    if (!activeEngineeringRevision) {
      setSelectedEngineeringSegmentId("");
      setSelectedRevisionId("");
      return;
    }
    setSelectedRevisionId(activeEngineeringRevision.revisionId);
    setSelectedEngineeringSegmentId((current) => (
      activeEngineeringRevision.segments.some((segment) => segment.segmentId === current)
        ? current
        : activeEngineeringRevision.segments[0]?.segmentId ?? ""
    ));
  }, [activeEngineeringRevision?.revisionId]);

  useEffect(() => {
    if (!incomingCommercialDraft) {
      setActivationFailureReason("No commercial corridor draft selected.");
      return;
    }
    if (engineeringDraft?.commercialRouteId === incomingCommercialDraft.routeId && activeEngineeringRevision) return;
    const geometry = incomingCommercialDraft.geometry.filter(validCoordinate);
    if (geometry.length < 2) {
      setActivationFailureReason("Draft creation failed: missing geometry. Commercial Draft must provide at least two valid coordinates.");
      return;
    }
    const endpoints = {
      first: geometry[0],
      last: geometry[geometry.length - 1],
    };
    const savedDraft = selectedRouteEngineeringDraft?.commercialRouteId === incomingCommercialDraft.routeId
      ? selectedRouteEngineeringDraft
      : null;
    const nextDraft = savedDraft ?? createEngineeringDraftFromCommercialDraft({
      commercialDraft: {
        ...incomingCommercialDraft,
        geometry,
      },
      createdBy: selectedRouteEngineeringActivation?.createdBy ?? (engineerName || "Route Engineering"),
      parentScopeVersionId: approvalScope?.parentScopeVersionId,
      rootScopeVersionId: approvalScope?.rootScopeVersionId,
    });
    const routeGeometry = currentEngineeringRevision(nextDraft)?.geometry ?? nextDraft.commercialBaselineGeometry;
    const inventoryId = selectedInventory?.inventoryId ?? (selectedInventoryId || "COMMERCIAL-HANDOFF-INVENTORY");
    const graphId = selectedInventory?.graphId ?? "COMMERCIAL-HANDOFF-GRAPH";
    const route = createDraftRoute({
      inventoryId,
      graphId,
      opportunitySeedId: selectedSeed?.id ?? selectedRouteEngineeringActivation?.opportunityId,
      candidateSiteId: selectedSeed?.candidateSiteId ?? selectedCandidate?.candidateId ?? selectedRouteEngineeringActivation?.accountId,
      candidateCoordinate: endpoints.first,
      attachmentCoordinate: endpoints.last,
      geometry: routeGeometry,
      routeMode: "OSRM_ROUTE",
      corridorBasis: "CANDIDATE_CORRIDOR",
      permitAuthorities: selectedSeed?.constructabilityAssessment?.permitting?.authorities ?? [],
    });
    setActivationFailureReason("");
    setEngineeringDraft(nextDraft);
    setSelectedRouteEngineeringDraft(nextDraft);
    setDraftRoute(route);
    setSelectedCertifiedRouteId("");
    setSelectedVertexIndex(null);
    setStatus(
      `Commercial baseline handed off: ${incomingCommercialDraft.routeId}. ${savedDraft ? "Saved Engineering Draft restored." : "Engineering Revision 1 created automatically."} ` +
      `${selectedInventory ? "Inventory context attached." : "Inventory context pending; fallback handoff identifiers used."} No ScopeVersion mutation.`
    );
  }, [activationKey, activationRetryNonce]);

  useEffect(() => {
    if (engineeringMode !== "SALES_ENGINEERING" || !engineeringDraft) return;
    if (initialCandidateDraftRef.current === engineeringDraft.engineeringDraftId) return;
    initialCandidateDraftRef.current = engineeringDraft.engineeringDraftId;
    void generateSalesInitialCandidates("Initial OSRM corridor candidates requested for Sales Engineering.");
  }, [engineeringMode, engineeringDraft?.engineeringDraftId]);

  function syncEngineeringDraft(nextDraft: RouteEngineeringDraft, message: string) {
    const revision = currentEngineeringRevision(nextDraft);
    setEngineeringDraft(nextDraft);
    setSelectedRouteEngineeringDraft(nextDraft);
    if (activeRoute && revision) setDraftRoute(markGeometryEdited(activeRoute, revision.geometry));
    if (revision?.segments[0] && !revision.segments.some((segment) => segment.segmentId === selectedEngineeringSegmentId)) {
      setSelectedEngineeringSegmentId(revision.segments[0].segmentId);
    }
    setStatus(message);
  }

  function applyEngineeringAction(message: string, updater: (draft: RouteEngineeringDraft) => RouteEngineeringDraft) {
    if (!engineeringDraft) {
      setStatus("Create or accept a commercial baseline before engineering edits.");
      return;
    }
    const nextDraft = updater(engineeringDraft);
    syncEngineeringDraft(nextDraft, message);
  }

  function createDraft() {
    if (!selectedInventory || !selectedTargetCoordinate) {
      setStatus("Select an inventory and a geocoded candidate/opportunity first.");
      return;
    }
    const seed = targetType === "opportunity" ? selectedSeed : null;
    const attachment = nearestAttachmentFromSeed(seed) ?? selectedTargetCoordinate;
    const geometry = routeGeometryFromSeed(seed, selectedTargetCoordinate, attachment);
    const route = createDraftRoute({
      inventoryId: selectedInventory.inventoryId,
      graphId: selectedInventory.graphId,
      opportunitySeedId: seed?.id,
      candidateSiteId: targetType === "candidate" ? selectedCandidate?.candidateId : seed?.candidateSiteId,
      candidateCoordinate: selectedTargetCoordinate,
      attachmentCoordinate: attachment,
      nearestRouteId: seed?.nearestRouteId ?? seed?.buildPath?.routeId,
      nearestNodeId: seed?.nearestNodeId ?? seed?.buildPath?.nodeId,
      nearestStationId: seed?.nearestStationId ?? seed?.buildPath?.stationId,
      geometry,
      routeMode: geometry.length <= 2 ? "DIRECT_FALLBACK" : "ENGINEER_DEFINED",
      corridorBasis: geometry.length <= 2 ? "REFERENCE_ONLY" : "CANDIDATE_CORRIDOR",
      permitAuthorities: seed?.constructabilityAssessment?.permitting?.authorities ?? [],
    });
    setDraftRoute(route);
    const nextDraft = createEngineeringDraftFromRoute({
      routeId: route.certifiedRouteId,
      label: targetLabel(selectedTarget, targetType),
      geometry: route.geometry,
      createdBy: engineerName || "Route Engineering",
      baselineSource: "OPPORTUNITY_SEED_ROUTE",
    });
    setEngineeringDraft(nextDraft);
    setSelectedRouteEngineeringDraft(nextDraft);
    setSelectedCertifiedRouteId("");
    setSelectedVertexIndex(null);
    setStatus(`${route.routeAuthorityState}: draft route created. Save to DAL API to establish server authority.`);
  }

  function updateGeometry(geometry: DALCoordinate[]) {
    if (!activeRoute) return;
    if (engineeringDraft) {
      const nextDraft = applyGeometryChangeAsRevision(engineeringDraft, geometry, engineerName || "Route Engineering", editReasonText);
      const revision = currentEngineeringRevision(nextDraft);
      setEngineeringDraft(nextDraft);
      setSelectedRouteEngineeringDraft(nextDraft);
      if (revision) {
        setDraftRoute(markGeometryEdited(activeRoute, revision.geometry));
        setStatus(`${revision.revisionName}: geometry moved and snapped. Financial delta recalculated.`);
      }
      return;
    }
    setDraftRoute(markGeometryEdited(activeRoute, geometry));
  }

  function updateSegmentGeometry(segmentIndex: number, geometry: DALCoordinate[]) {
    if (!activeRoute || !engineeringDraft) return;
    const nextDraft = applySegmentGeometryChangeAsRevision(engineeringDraft, segmentIndex, geometry, engineerName || "Route Engineering", editReasonText);
    const revision = currentEngineeringRevision(nextDraft);
    setEngineeringDraft(nextDraft);
    setSelectedRouteEngineeringDraft(nextDraft);
    if (revision) {
      setDraftRoute(markGeometryEdited(activeRoute, revision.geometry));
      setSelectedEngineeringSegmentId(revision.segments[segmentIndex]?.segmentId ?? revision.segments[0]?.segmentId ?? "");
      setStatus(`${revision.revisionName}: segment midpoint drag snapped and financial delta recalculated.`);
    }
  }

  function salesWaypoint(direction: "N" | "S" | "E" | "W" = "W") {
    const geometry = activeEngineeringRevision?.geometry ?? engineeringDraft?.commercialBaselineGeometry ?? [];
    const point = routeMidpoint(geometry);
    return point ? offsetCoordinate(point, direction) : null;
  }

  function selectSalesCandidate(candidate: CorridorCandidate, statusMessage?: string) {
    setSelectedCorridorCandidateId(candidate.candidateId);
    setPreviewCorridorCandidateId(candidate.candidateId);
    setRevisionExplanation(candidate.explanation);
    if (statusMessage) setSalesCandidateStatus(statusMessage);
  }

  function upsertSalesCandidate(candidate: CorridorCandidate) {
    setCorridorCandidates((current) => {
      const withoutCandidate = current.filter((item) => item.candidateId !== candidate.candidateId);
      const baseline = withoutCandidate.find((item) => item.source === "OSRM_BASELINE");
      const others = withoutCandidate.filter((item) => item.source !== "OSRM_BASELINE");
      return [baseline, candidate, ...others].filter((item): item is CorridorCandidate => Boolean(item)).slice(0, 5);
    });
    selectSalesCandidate(candidate, `${candidate.name} generated from OSRM. Preview it, compare it, or make it current.`);
  }

  async function generateSalesInitialCandidates(message = "Generating initial OSRM corridor candidates...") {
    if (!engineeringDraft) return;
    const requestId = candidateRequestSeqRef.current + 1;
    candidateRequestSeqRef.current = requestId;
    setCandidateGenerationState("GENERATING");
    setSalesCandidateStatus(message);
    try {
      const nextSet = await generateInitialCorridorCandidates(engineeringDraft);
      if (candidateRequestSeqRef.current !== requestId) return;
      setCorridorCandidates(nextSet.candidates);
      setCandidateFailures(nextSet.failures);
      const initialSelection = nextSet.candidates.find((candidate) => candidate.source !== "OSRM_BASELINE") ?? nextSet.candidates[0] ?? null;
      if (initialSelection) selectSalesCandidate(initialSelection);
      setCandidateGenerationState(nextSet.candidates.length >= 3 ? "IDLE" : "FAILED");
      setSalesCandidateStatus(
        `${nextSet.candidates.length.toLocaleString()} corridor candidates available. ` +
        `${nextSet.failures.length ? `${nextSet.failures.length.toLocaleString()} OSRM request(s) failed; no straight-line fallback was created.` : "All successful candidates use OSRM or preserved OSRM baseline geometry."}`
      );
    } catch (error: any) {
      if (candidateRequestSeqRef.current !== requestId) return;
      setCandidateGenerationState("FAILED");
      setCandidateFailures([{ name: "Initial Candidate Set", candidateType: "SHORTEST_PATH", failureReason: error?.message ?? String(error), diagnostics: [] }]);
      const baseline = createBaselineCorridorCandidate(engineeringDraft);
      setCorridorCandidates(baseline ? [baseline] : []);
      if (baseline) selectSalesCandidate(baseline);
      setSalesCandidateStatus(`Initial OSRM candidate generation failed: ${error?.message ?? String(error)}. No straight-line fallback was created.`);
    }
  }

  async function generateSalesWaypointCandidate(args: {
    waypoint: DALCoordinate;
    type: CorridorCandidateType;
    name: string;
    hintType: CorridorCandidateHintType;
    hintLabel: string;
    heuristic?: boolean;
    requestId: number;
  }) {
    if (!engineeringDraft) return;
    try {
      const result = await generateWaypointCorridorCandidate({
        draft: engineeringDraft,
        waypoint: args.waypoint,
        type: args.type,
        name: args.name,
        hintType: args.hintType,
        hintLabel: args.hintLabel,
        heuristic: args.heuristic,
      });
      if (candidateRequestSeqRef.current !== args.requestId) return;
      if ("candidateId" in result) {
        setCandidateGenerationState("IDLE");
        setCandidateFailures([]);
        upsertSalesCandidate(result);
        return;
      }
      setCandidateGenerationState("FAILED");
      setCandidateFailures([result]);
      setSalesCandidateStatus(`OSRM candidate failed: ${result.failureReason}. No straight-line fallback was created.`);
      setStatus("Sales Engineering candidate blocked by OSRM. Commercial Baseline and current revision are unchanged.");
    } catch (error: any) {
      if (candidateRequestSeqRef.current !== args.requestId) return;
      setCandidateGenerationState("FAILED");
      setCandidateFailures([{ name: args.name, candidateType: args.type, failureReason: error?.message ?? String(error), diagnostics: [] }]);
      setSalesCandidateStatus(`OSRM candidate failed: ${error?.message ?? String(error)}. No straight-line fallback was created.`);
      setStatus("Sales Engineering candidate blocked by OSRM runtime failure. Commercial Baseline and current revision are unchanged.");
    }
  }

  function requestSalesWaypointCandidate(args: {
    waypoint: DALCoordinate;
    type: CorridorCandidateType;
    name: string;
    hintType: CorridorCandidateHintType;
    hintLabel: string;
    heuristic?: boolean;
    debounceMs?: number;
  }) {
    if (!engineeringDraft) {
      setSalesCandidateStatus("Sales Engineering requires an active Engineering Draft before corridor candidates can be generated.");
      return;
    }
    if (candidateDebounceRef.current !== null) window.clearTimeout(candidateDebounceRef.current);
    const requestId = candidateRequestSeqRef.current + 1;
    candidateRequestSeqRef.current = requestId;
    setCandidateGenerationState("GENERATING");
    setSalesCandidateStatus("Generating OSRM corridor... A/Z endpoints are fixed and the current revision is preserved until routing succeeds.");
    candidateDebounceRef.current = window.setTimeout(() => {
      candidateDebounceRef.current = null;
      void generateSalesWaypointCandidate({ ...args, requestId });
    }, args.debounceMs ?? 0);
  }

  function generateSalesCorridorCandidate() {
    void generateSalesInitialCandidates("Generating 3-5 OSRM corridor candidates from fixed A/Z endpoints...");
  }

  function moveSalesCorridor() {
    const waypoint = salesWaypoint("W");
    if (!waypoint) return;
    requestSalesWaypointCandidate({
      waypoint,
      type: "DIVERSE_FROM_BASELINE",
      name: "West Moved Corridor",
      hintType: "PREFER_CORRIDOR",
      hintLabel: "Sales Engineering west corridor preference",
      heuristic: true,
    });
  }

  function addSalesCorridorWaypoint() {
    const waypoint = routeMidpoint(activeEngineeringRevision?.geometry ?? []);
    if (!waypoint) return;
    requestSalesWaypointCandidate({
      waypoint,
      type: "USER_WAYPOINT",
      name: "Waypoint Candidate",
      hintType: "WAYPOINT",
      hintLabel: "Sales Engineering waypoint constraint",
    });
  }

  function avoidSalesArea() {
    const waypoint = salesWaypoint("N");
    if (!waypoint) return;
    requestSalesWaypointCandidate({
      waypoint,
      type: "AVOID_AREA",
      name: "Avoid Area Candidate",
      hintType: "AVOID_AREA",
      hintLabel: "Avoid-area heuristic represented as a north detour waypoint",
      heuristic: true,
    });
  }

  function preferSalesCorridor() {
    const waypoint = salesWaypoint("E");
    if (!waypoint) return;
    requestSalesWaypointCandidate({
      waypoint,
      type: "PREFER_HIGHWAY",
      name: "Preferred Corridor Candidate",
      hintType: "PREFER_CORRIDOR",
      hintLabel: "Prefer-corridor heuristic represented as an east bias waypoint",
      heuristic: true,
    });
  }

  function clearSalesHints() {
    setPreviewCorridorCandidateId("");
    setSelectedCorridorCandidateId("");
    setRevisionExplanation("");
    void generateSalesInitialCandidates("Sales Engineering hints cleared. Regenerating initial OSRM candidate set.");
  }

  function createCandidateRevision(candidate: CorridorCandidate, action: "MAKE_CURRENT" | "SAVE_REVISION") {
    if (!engineeringDraft || !activeRoute) return;
    const nextDraft = action === "MAKE_CURRENT"
      ? createCorridorCandidateRevision(engineeringDraft, candidate.geometry, "Sales Engineering", candidateRevisionReason(candidate))
      : saveCorridorCandidateRevision(engineeringDraft, candidate.geometry, "Sales Engineering", candidateRevisionReason(candidate));
    const revision = currentEngineeringRevision(nextDraft);
    const savedRevision = nextDraft.revisions.at(-1);
    syncEngineeringDraft(
      nextDraft,
      action === "MAKE_CURRENT" && revision
        ? `${revision.revisionName}: ${candidate.name} made current.`
        : savedRevision
          ? `${savedRevision.revisionName}: ${candidate.name} saved for comparison. Current Engineering Revision is unchanged.`
        : `${candidate.name} processed.`
    );
    if (action === "MAKE_CURRENT" && revision) {
      setDraftRoute(markGeometryEdited(activeRoute, revision.geometry));
      setSelectedRevisionId(revision.revisionId);
      setSelectedCorridorCandidateId(candidate.candidateId);
      setPreviewCorridorCandidateId(candidate.candidateId);
      setSalesCandidateStatus(`${candidate.name} is now the current Engineering Revision. Commercial Planning can consume the shared draft revision.`);
      setRevisionExplanation(candidate.explanation);
      return;
    }
    if (savedRevision) {
      setSelectedRevisionId(savedRevision.revisionId);
      setSelectedCorridorCandidateId(candidate.candidateId);
      setPreviewCorridorCandidateId(candidate.candidateId);
      setSalesCandidateStatus(`${candidate.name} saved as ${savedRevision.revisionName}. Use Make Current when it should become the active Commercial Planning revision.`);
      setRevisionExplanation(candidate.explanation);
    }
  }

  function saveSalesRevision() {
    if (selectedCorridorCandidate) {
      createCandidateRevision(selectedCorridorCandidate, "SAVE_REVISION");
      return;
    }
    if (!activeEngineeringRevision) return;
    setSalesCandidateStatus(`${activeEngineeringRevision.revisionName} saved in the shared Engineering Draft session. No ScopeVersion authority created.`);
    setStatus(`${activeEngineeringRevision.revisionName} saved for Sales Engineering comparison.`);
  }

  function makeSelectedCandidateCurrent() {
    if (selectedCorridorCandidate) {
      createCandidateRevision(selectedCorridorCandidate, "MAKE_CURRENT");
      return;
    }
    makeSelectedRevisionCurrent();
  }

  function discardSelectedCandidate(candidateId = selectedCorridorCandidate?.candidateId ?? "") {
    if (!candidateId) return;
    const candidate = corridorCandidates.find((item) => item.candidateId === candidateId);
    if (candidate?.source === "OSRM_BASELINE") {
      setSalesCandidateStatus("Commercial Baseline remains preserved and cannot be discarded.");
      return;
    }
    setCorridorCandidates((current) => current.filter((item) => item.candidateId !== candidateId));
    if (selectedCorridorCandidateId === candidateId) setSelectedCorridorCandidateId("");
    if (previewCorridorCandidateId === candidateId) setPreviewCorridorCandidateId("");
    setSalesCandidateStatus("Candidate discarded. Current Engineering Revision is unchanged.");
  }

  function handleSalesCorridorDrop(waypoint: DALCoordinate) {
    requestSalesWaypointCandidate({
      waypoint,
      type: "USER_WAYPOINT",
      name: "Dragged Corridor Candidate",
      hintType: "WAYPOINT",
      hintLabel: "Dropped corridor preference waypoint from Sales Engineering drag",
      debounceMs: 450,
    });
  }

  function handleSalesCorridorCancel() {
    setSalesCandidateStatus("Corridor drag canceled. Current Engineering Revision is unchanged.");
  }

  function makeSelectedRevisionCurrent() {
    if (!selectedRevision) return;
    if (selectedRevision.revisionId === activeEngineeringRevision?.revisionId) {
      setSalesCandidateStatus(`${selectedRevision.revisionName} is already current.`);
      return;
    }
    applyEngineeringAction(`${selectedRevision.revisionName} made current as a new Engineering Revision.`, (draft) =>
      restoreEngineeringRevision(draft, selectedRevision.revisionId, "Sales Engineering", "Make Current from Sales Engineering")
    );
  }

  function explainRevision() {
    if (engineeringMode === "SALES_ENGINEERING" && selectedCorridorCandidate) {
      setRevisionExplanation(selectedCorridorCandidate.explanation);
      setSalesCandidateStatus(selectedCorridorCandidate.explanation);
      return;
    }
    if (!activeEngineeringRevision) return;
    const diff = activeEngineeringRevision.delta.difference;
    const optical = activeEngineeringRevision.opticalPreview;
    const direction = diff.routeMiles > 0 ? "increased" : diff.routeMiles < 0 ? "decreased" : "held";
    setRevisionExplanation(
      `This revision preserves the Commercial Baseline A and Z endpoints while comparing a candidate corridor. ` +
      `Route length ${direction} by ${Math.abs(diff.routeMiles).toLocaleString(undefined, { maximumFractionDigits: 2 })} miles. ` +
      `Construction cost changed by ${signedMoney(diff.constructionCost)}. ` +
      `Optical loss changed by ${signedMetric(diff.opticalLossDb, " dB")}; estimated total route loss is ${fmt(optical.totalRouteLossDb)} dB. ` +
      `Commercial readiness changed by ${signedMetric(diff.commercialReadiness, " pts")} and confidence changed by ${signedMetric(diff.confidence, " pts")}. ` +
      `Unknown constraints remaining across visible engineering segments: ${unknownConstraintCount.toLocaleString()}.`
    );
  }

  function updateRouteMode(routeMode: RouteMode) {
    if (!activeRoute) return;
    setDraftRoute(evaluateRouteAuthority({ ...activeRoute, routeMode }));
  }

  function updateCorridorBasis(corridorBasis: CorridorBasis) {
    if (!activeRoute) return;
    setDraftRoute(evaluateRouteAuthority({ ...activeRoute, corridorBasis }));
  }

  function addEvidenceSnapshot() {
    if (!activeRoute) return;
    const routeGeometryHash = computeRouteGeometryHash(activeRoute.geometry);
    setDraftRoute(
      attachConstraintEvidence(activeRoute, {
        evidenceId: `EV-${activeRoute.certifiedRouteId}-${Date.now()}`,
        evidenceHash: `evidence-${routeGeometryHash}`,
        routeGeometryHash,
        status: "CURRENT",
        summary: activeRoute.crossingSummary,
        constructabilityScore: activeRoute.constructabilityScore || 65,
        riskScore: activeRoute.riskScore || 35,
        permitAuthorities: activeRoute.permitAuthorities,
      })
    );
    setStatus("Current deterministic constraint evidence snapshot attached to route geometry hash.");
  }

  function addMidpointVertex() {
    if (engineeringDraft && selectedEngineeringSegment) {
      applyEngineeringAction("Waypoint inserted; snapped revision and financial delta are current.", (draft) =>
        insertEngineeringWaypoint(draft, selectedEngineeringSegment.segmentId, undefined, engineerName || "Route Engineering", "INSERT_WAYPOINT", editReasonText)
      );
      return;
    }
    if (!activeRoute?.geometry.length || activeRoute.geometry.length < 2) return;
    const geometry = [...activeRoute.geometry];
    const index = typeof selectedVertexIndex === "number" ? Math.min(selectedVertexIndex + 1, geometry.length - 1) : Math.max(1, geometry.length - 1);
    geometry.splice(index, 0, midpoint(geometry[index - 1], geometry[index]));
    updateGeometry(geometry);
    setSelectedVertexIndex(index);
  }

  function moveSelectedSegment(direction: "N" | "S" | "E" | "W") {
    if (!selectedEngineeringSegment) return;
    const offset = 0.0012;
    const delta = {
      N: { lng: 0, lat: offset },
      S: { lng: 0, lat: -offset },
      E: { lng: offset, lat: 0 },
      W: { lng: -offset, lat: 0 },
    }[direction];
    applyEngineeringAction(`Segment moved ${direction}; snap provenance and deltas updated.`, (draft) =>
      moveEngineeringSegment(draft, selectedEngineeringSegment.segmentId, delta, engineerName || "Route Engineering", editReasonText)
    );
  }

  function splitSelectedSegment() {
    if (!selectedEngineeringSegment) return;
    applyEngineeringAction("Segment split into a new snapped waypoint revision.", (draft) =>
      insertEngineeringWaypoint(draft, selectedEngineeringSegment.segmentId, undefined, engineerName || "Route Engineering", "SPLIT_SEGMENT", editReasonText)
    );
  }

  function mergeSelectedSegment() {
    if (!selectedEngineeringSegment) return;
    applyEngineeringAction("Adjacent segment merge recorded as a non-destructive revision.", (draft) =>
      mergeEngineeringSegments(draft, selectedEngineeringSegment.segmentId, engineerName || "Route Engineering", editReasonText)
    );
  }

  function replaceSelectedSegment() {
    if (!selectedEngineeringSegment) return;
    applyEngineeringAction("Selected segment replaced with snapped engineering geometry.", (draft) =>
      replaceEngineeringSegment(draft, selectedEngineeringSegment.segmentId, engineerName || "Route Engineering", editReasonText)
    );
  }

  function regenerateSelectedSegment() {
    if (!selectedEngineeringSegment) return;
    applyEngineeringAction("Selected segment regenerated from preserved commercial baseline.", (draft) =>
      regenerateEngineeringSegment(draft, selectedEngineeringSegment.segmentId, engineerName || "Route Engineering", editReasonText)
    );
  }

  function restoreSelectedSegment() {
    if (!selectedEngineeringSegment) return;
    applyEngineeringAction("Selected segment restored from immutable commercial baseline.", (draft) =>
      restoreEngineeringSegment(draft, selectedEngineeringSegment.segmentId, engineerName || "Route Engineering", editReasonText)
    );
  }

  function regenerateEntireCorridor() {
    applyEngineeringAction("Entire corridor regenerated from immutable commercial baseline.", (draft) =>
      regenerateEngineeringCorridor(draft, engineerName || "Route Engineering", editReasonText)
    );
  }

  function removeSelectedWaypoint() {
    const index = typeof selectedVertexIndex === "number"
      ? selectedVertexIndex
      : selectedEngineeringSegment?.toVertexIndex ?? -1;
    applyEngineeringAction("Waypoint removal recorded as a revision.", (draft) =>
      removeEngineeringWaypoint(draft, index, engineerName || "Route Engineering", editReasonText)
    );
    setSelectedVertexIndex(null);
  }

  function lockSelectedSegment() {
    if (!selectedEngineeringSegment) return;
    applyEngineeringAction("Selected segment locked for construction-sensitive review.", (draft) =>
      lockEngineeringSegment(draft, selectedEngineeringSegment.segmentId, engineerName || "Route Engineering", editReasonText)
    );
  }

  function acceptSelectedSegment() {
    if (!selectedEngineeringSegment) return;
    applyEngineeringAction("Selected segment accepted in the active engineering revision.", (draft) =>
      acceptEngineeringSegment(draft, selectedEngineeringSegment.segmentId, engineerName || "Route Engineering", editReasonText)
    );
  }

  function rejectSelectedSegment() {
    if (!selectedEngineeringSegment) return;
    applyEngineeringAction("Selected segment rejected in the active engineering revision.", (draft) =>
      rejectEngineeringSegment(draft, selectedEngineeringSegment.segmentId, engineerName || "Route Engineering", editReasonText)
    );
  }

  function addSelectedSegmentReason() {
    if (!selectedEngineeringSegment) return;
    applyEngineeringAction("Engineering edit reason recorded on selected segment.", (draft) =>
      recordEngineeringSegmentReason(draft, selectedEngineeringSegment.segmentId, engineerName || "Route Engineering", editReasonText)
    );
  }

  function restoreSelectedRevision() {
    if (!selectedRevision) return;
    applyEngineeringAction(`${selectedRevision.revisionName} restored as a new revision.`, (draft) =>
      restoreEngineeringRevision(draft, selectedRevision.revisionId, engineerName || "Route Engineering", editReasonText)
    );
  }

  function branchSelectedRevision() {
    if (!selectedRevision) return;
    applyEngineeringAction(`${selectedRevision.revisionName} branched as a new revision.`, (draft) =>
      branchEngineeringRevision(draft, selectedRevision.revisionId, engineerName || "Route Engineering", editReasonText)
    );
  }

  function acceptSelectedRevision() {
    if (!engineeringDraft || !selectedRevision) return;
    const nextDraft = acceptEngineeringRevision(engineeringDraft, selectedRevision.revisionId);
    setEngineeringDraft(nextDraft);
    setSelectedRouteEngineeringDraft(nextDraft);
    setStatus(`${selectedRevision.revisionName} accepted as Engineering Draft candidate. No ScopeVersion or Control authority created.`);
  }

  function rejectSelectedRevision() {
    if (!engineeringDraft || !selectedRevision) return;
    const nextDraft = rejectEngineeringRevision(engineeringDraft, selectedRevision.revisionId);
    syncEngineeringDraft(nextDraft, `${selectedRevision.revisionName} rejected. Current geometry restored to a non-rejected revision.`);
  }

  function toggleEngineeringLayer(layerId: EngineeringLayerId) {
    if (!engineeringDraft) return;
    const nextDraft = setEngineeringLayerVisibility(engineeringDraft, layerId, !engineeringDraft.layerVisibility[layerId]);
    setEngineeringDraft(nextDraft);
    setSelectedRouteEngineeringDraft(nextDraft);
  }

  async function saveRoute() {
    if (!activeRoute) return;
    try {
      const saved = activeRoute.certifiedRouteId && certifiedRoutes.some((route) => route.certifiedRouteId === activeRoute.certifiedRouteId)
        ? await updateCertifiedRoute(evaluateRouteAuthority(activeRoute))
        : await createCertifiedRoute(evaluateRouteAuthority(activeRoute));
      setCertifiedRoutes((prev) => [saved, ...prev.filter((route) => route.certifiedRouteId !== saved.certifiedRouteId)]);
      setSelectedCertifiedRouteId(saved.certifiedRouteId);
      setDraftRoute(null);
      setStatus(`CertifiedRoute persisted: ${saved.certifiedRouteId}`);
    } catch (error: any) {
      setStatus(`CertifiedRoute save failed: ${error?.message ?? String(error)}`);
    }
  }

  async function certifyActiveRoute() {
    if (!activeRoute) return;
    try {
      const localCertified = certifyRoute(activeRoute, { name: engineerName, notes: certificationNotes });
      const saved = certifiedRoutes.some((route) => route.certifiedRouteId === localCertified.certifiedRouteId)
        ? await updateCertifiedRoute(localCertified)
        : await createCertifiedRoute(localCertified);
      const serverCertified = await certifyCertifiedRoute(saved.certifiedRouteId, { engineerName, certificationNotes });
      setCertifiedRoutes((prev) => [serverCertified, ...prev.filter((route) => route.certifiedRouteId !== serverCertified.certifiedRouteId)]);
      setSelectedCertifiedRouteId(serverCertified.certifiedRouteId);
      setDraftRoute(null);
      setStatus(`CertifiedRoute certified: ${serverCertified.certifiedRouteId}`);
    } catch (error: any) {
      setStatus(`Certification blocked: ${error?.message ?? String(error)}`);
    }
  }

  async function rejectActiveRoute() {
    if (!activeRoute) return;
    try {
      const rejected = rejectRoute(activeRoute, rejectionReason || "Rejected during Route Engineering review.");
      const saved = certifiedRoutes.some((route) => route.certifiedRouteId === rejected.certifiedRouteId)
        ? await updateCertifiedRoute(rejected)
        : await createCertifiedRoute(rejected);
      const serverRejected = await rejectCertifiedRoute(saved.certifiedRouteId, { reason: rejectionReason || "Rejected during Route Engineering review." });
      setCertifiedRoutes((prev) => [serverRejected, ...prev.filter((route) => route.certifiedRouteId !== serverRejected.certifiedRouteId)]);
      setSelectedCertifiedRouteId(serverRejected.certifiedRouteId);
      setDraftRoute(null);
      setStatus(`CertifiedRoute rejected: ${serverRejected.certifiedRouteId}`);
    } catch (error: any) {
      setStatus(`Route rejection failed: ${error?.message ?? String(error)}`);
    }
  }

  async function approveScopeVersionForControl() {
    if (!approvalScope) {
      setStatus("Select a ScopeVersion to approve for Control.");
      return;
    }
    const routeReference =
      evaluatedRoute && approvalScope.certifiedRouteReference?.certifiedRouteId === evaluatedRoute.certifiedRouteId
        ? referenceFromRoute(evaluatedRoute)
        : approvalScope.certifiedRouteReference;
    const stationCount = Array.isArray(approvalScope.canonicalTruth?.stations) ? approvalScope.canonicalTruth.stations.length : 0;
    const objectCount = Array.isArray(approvalScope.canonicalTruth?.objects) ? approvalScope.canonicalTruth.objects.length : 0;
    const routeAuthorityState = routeReference?.routeAuthorityState ?? "NO_CERTIFIED_ROUTE";
    console.log("[LIFECYCLE_AUTHORITY_CHECK]", {
      check: "routeEngineeringApproveScopeVersion",
      scopeVersionId: approvalScope.scopeVersionId,
      certifiedRouteId: routeReference?.certifiedRouteId ?? "none",
      routeAuthorityState,
      stationCount,
      objectCount,
    });
    if (!routeReference?.certifiedRouteId) {
      setStatus("ScopeVersion approval blocked: CertifiedRoute reference is required.");
      return;
    }
    if (!["CERTIFIED_ROUTE", "PROVISIONALLY_CERTIFIED"].includes(routeAuthorityState)) {
      setStatus(`ScopeVersion approval blocked: route authority must be CERTIFIED_ROUTE or PROVISIONALLY_CERTIFIED, not ${routeAuthorityState}.`);
      return;
    }
    if (!stationCount) {
      setStatus("ScopeVersion approval blocked: stationing is required.");
      return;
    }
    if (!objectCount) {
      setStatus("ScopeVersion approval blocked: objects are required.");
      return;
    }
    const timestamp = new Date().toISOString();
    const approvedScope = transitionScopeVersionLifecycle({
      ...approvalScope,
      certifiedRouteReference: routeReference,
      updatedAt: timestamp,
      canonicalTruth: {
        ...approvalScope.canonicalTruth,
      },
      events: [
        ...approvalScope.events,
        {
          eventId: `event-${Date.now()}-${Math.random().toString(16).slice(2)}`,
          type: "scopeversion.approved",
          entityId: approvalScope.scopeVersionId,
          entityType: "ScopeVersion",
          payload: {
            certifiedRouteId: routeReference.certifiedRouteId,
            routeAuthorityState,
            stationCount,
            objectCount,
          },
          createdAt: timestamp,
        },
      ],
    }, "APPROVED", timestamp);
    const saved = await saveScopeVersion(approvedScope);
    setScopeVersions((prev) => [saved, ...prev.filter((scope) => scope.scopeVersionId !== saved.scopeVersionId)]);
    setSelectedScopeVersion(saved);
    setSelectedScopeVersionId(saved.scopeVersionId);
    setSelectedApprovalScopeId(saved.scopeVersionId);
    setStatus(`ScopeVersion approved for Control: ${saved.scopeVersionId}.`);
  }

  return (
    <section className="dal-workspace wide route-engineering-workspace">
      <div className="dal-panel">
        <div className="dal-panel-title-row">
          <div>
            <h2>Engineering</h2>
            <p>One shared Engineering Draft with Sales Engineering and Route Engineering interfaces.</p>
          </div>
          <div className="engineering-mode-controls" aria-label="Engineering Mode">
            <span>Engineering Mode</span>
            <button
              type="button"
              className={engineeringMode === "SALES_ENGINEERING" ? "active-toggle" : undefined}
              onClick={() => setEngineeringMode("SALES_ENGINEERING")}
            >
              Sales Engineering
            </button>
            <button
              type="button"
              className={engineeringMode === "ROUTE_ENGINEERING" ? "active-toggle" : undefined}
              onClick={() => setEngineeringMode("ROUTE_ENGINEERING")}
            >
              Route Engineering
            </button>
            <button type="button" onClick={refresh}>Refresh DAL API</button>
          </div>
        </div>
        <div className="dal-status">{status}</div>
      </div>

      <div className="route-engineering-map-first">
        <MapKernel
          specs={[...(routeSpec ? [routeSpec] : []), ...candidateRenderSpecs]}
          initialMode="geographic"
          initialBaseLayer="hybrid"
          editableRoute={
            activeRoute
              ? {
                  routeId: activeRoute.certifiedRouteId,
                  geometry: activeRoute.geometry,
                  enabled: activeRoute.routeAuthorityState !== "CERTIFIED_ROUTE",
                  selectedVertexIndex,
                  selectedSegmentIndex: selectedEngineeringSegmentIndex >= 0 ? selectedEngineeringSegmentIndex : null,
                  showVertexHandles: engineeringMode === "ROUTE_ENGINEERING",
                  showSegmentHandles: engineeringMode === "ROUTE_ENGINEERING",
                  showCorridorHandle: engineeringMode === "SALES_ENGINEERING",
                  onGeometryChange: engineeringMode === "ROUTE_ENGINEERING" ? updateGeometry : undefined,
                  onVertexSelect: engineeringMode === "ROUTE_ENGINEERING" ? setSelectedVertexIndex : undefined,
                  onSegmentSelect: (index) => {
                    if (engineeringMode !== "ROUTE_ENGINEERING") return;
                    const segment = typeof index === "number" ? activeEngineeringRevision?.segments[index] : null;
                    setSelectedEngineeringSegmentId(segment?.segmentId ?? "");
                    setSelectedVertexIndex(null);
                  },
                  onSegmentMove: engineeringMode === "ROUTE_ENGINEERING" ? updateSegmentGeometry : undefined,
                  onCorridorDrop: engineeringMode === "SALES_ENGINEERING" ? handleSalesCorridorDrop : undefined,
                  onCorridorCancel: engineeringMode === "SALES_ENGINEERING" ? handleSalesCorridorCancel : undefined,
                }
              : undefined
          }
          height={680}
        />
      </div>

      {engineeringDraft && activeEngineeringRevision ? (
        <>
          <div className="dal-panel route-engineering-baseline-panel">
            <div className="dal-panel-title-row">
              <div>
                <h3>{engineeringMode === "SALES_ENGINEERING" ? "Sales Engineering Corridor Review" : "Route Engineering Segment Editing"}</h3>
                <div className="dal-status">
                  {engineeringMode === "SALES_ENGINEERING"
                    ? "Customer-friendly corridor comparison. A/Z endpoints and Commercial Baseline remain fixed while candidate revisions update shared deltas."
                    : "Commercial Baseline is immutable. Engineering Revision geometry is editable, snapped, versioned, and financially compared back to the baseline."}
                </div>
              </div>
              <div className="dal-actions">
                <select value={compareMode} onChange={(event) => setCompareMode(event.target.value as EngineeringCompareMode)} aria-label="Corridor compare mode">
                  <option value="BASELINE">Commercial Baseline</option>
                  <option value="REVISION">Engineering Revision</option>
                  <option value="DIFFERENCE">Difference</option>
                </select>
              </div>
            </div>
            <div className="teralinx-summary-grid">
              <div><span>Commercial Draft</span><b>{engineeringDraft.commercialDraftId}</b></div>
              <div><span>Engineering Draft</span><b>{engineeringDraft.engineeringDraftId}</b></div>
              <div><span>Current Revision</span><b>{activeEngineeringRevision.revisionName}</b></div>
              <div><span>Revision Status</span><b>{activeEngineeringRevision.status}</b></div>
              <div><span>Baseline Hash</span><b>{engineeringDraft.commercialBaselineGeometryHash}</b></div>
              <div><span>Revision Hash</span><b>{activeEngineeringRevision.geometryHash}</b></div>
              <div><span>Lineage</span><b>{engineeringDraft.scopeVersionLineage.parentScopeVersionId ?? "Future ScopeVersion lineage"}</b></div>
              <div><span>Accepted Revision</span><b>{engineeringDraft.acceptedRevisionId ?? "None"}</b></div>
            </div>
            {engineeringMode === "ROUTE_ENGINEERING" ? (
              <>
                <div className="route-engineering-edit-reason">
                  <label>
                    Edit Reason
                    <select value={editReason} onChange={(event) => setEditReason(event.target.value)} aria-label="Engineering edit reason">
                      {EDIT_REASONS.map((reason) => (
                        <option key={reason} value={reason}>{reason}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Reason Note
                    <input
                      value={editReasonNote}
                      onChange={(event) => setEditReasonNote(event.target.value)}
                      placeholder="Optional note for revision history"
                    />
                  </label>
                  <button type="button" onClick={addSelectedSegmentReason} disabled={!selectedEngineeringSegment}>Add Edit Reason</button>
                </div>
                <div className="dal-actions">
                  <button type="button" onClick={() => moveSelectedSegment("N")} disabled={!selectedEngineeringSegment}>Move North</button>
                  <button type="button" onClick={() => moveSelectedSegment("S")} disabled={!selectedEngineeringSegment}>Move South</button>
                  <button type="button" onClick={() => moveSelectedSegment("E")} disabled={!selectedEngineeringSegment}>Move East</button>
                  <button type="button" onClick={() => moveSelectedSegment("W")} disabled={!selectedEngineeringSegment}>Move West</button>
                  <button type="button" onClick={addMidpointVertex} disabled={!selectedEngineeringSegment}>Insert Waypoint</button>
                  <button type="button" onClick={removeSelectedWaypoint} disabled={!selectedEngineeringSegment || activeEngineeringRevision.geometry.length <= 2}>Delete Waypoint</button>
                  <button type="button" onClick={splitSelectedSegment} disabled={!selectedEngineeringSegment}>Split Segment</button>
                  <button type="button" onClick={mergeSelectedSegment} disabled={!selectedEngineeringSegment || activeEngineeringRevision.geometry.length <= 2}>Merge Segments</button>
                  <button type="button" onClick={replaceSelectedSegment} disabled={!selectedEngineeringSegment}>Replace Segment</button>
                  <button type="button" onClick={regenerateSelectedSegment} disabled={!selectedEngineeringSegment}>Regenerate Segment</button>
                  <button type="button" onClick={restoreSelectedSegment} disabled={!selectedEngineeringSegment}>Restore Segment</button>
                  <button type="button" onClick={lockSelectedSegment} disabled={!selectedEngineeringSegment}>Lock Segment</button>
                  <button type="button" onClick={acceptSelectedSegment} disabled={!selectedEngineeringSegment}>Accept Segment</button>
                  <button type="button" onClick={rejectSelectedSegment} disabled={!selectedEngineeringSegment}>Reject Segment</button>
                  <button type="button" onClick={regenerateEntireCorridor}>Regenerate Corridor</button>
                </div>
              </>
            ) : (
              <div className="dal-actions">
                <button type="button" onClick={generateSalesCorridorCandidate} disabled={candidateGenerationState === "GENERATING"}>Generate Corridor Candidates</button>
                <button type="button" onClick={moveSalesCorridor} disabled={candidateGenerationState === "GENERATING"}>Move Corridor</button>
                <button type="button" onClick={addSalesCorridorWaypoint} disabled={candidateGenerationState === "GENERATING"}>Add Waypoint</button>
                <button type="button" onClick={avoidSalesArea} disabled={candidateGenerationState === "GENERATING"}>Avoid Area</button>
                <button type="button" onClick={preferSalesCorridor} disabled={candidateGenerationState === "GENERATING"}>Prefer Corridor</button>
                <button type="button" onClick={clearSalesHints} disabled={candidateGenerationState === "GENERATING"}>Clear Hints</button>
                <button type="button" onClick={() => setCompareMode("DIFFERENCE")}>Compare to Baseline</button>
                <button type="button" onClick={saveSalesRevision} disabled={!selectedCorridorCandidate && !activeEngineeringRevision}>Save as Revision</button>
                <button type="button" onClick={makeSelectedCandidateCurrent} disabled={!selectedCorridorCandidate && !selectedRevision}>Make Current</button>
                <button type="button" onClick={acceptSelectedRevision} disabled={!selectedRevision}>Accept Revision</button>
                <button type="button" onClick={() => setWorkspace("googleRfp")}>Return to Commercial Planning</button>
                <button type="button" onClick={explainRevision}>Explain Revision</button>
              </div>
            )}
            <div className="dal-status">
              {engineeringMode === "SALES_ENGINEERING"
                ? salesCandidateStatus
                : "Map vertex drag and segment midpoint drag are snap-audited. Button edits create discrete engineering revisions. Manual geometry is recorded only as a last-priority graph object."}
            </div>
          </div>

          {engineeringMode === "SALES_ENGINEERING" ? (
            <>
              <div className="dal-panel sales-corridor-candidates-panel">
                <div className="dal-panel-title-row">
                  <div>
                    <h3>Corridor Candidates</h3>
                    <div className="dal-status">
                      Drag the corridor handle to create a waypoint-based OSRM candidate. A/Z remain fixed and the current revision is unchanged until a candidate is saved.
                    </div>
                  </div>
                  <span className={`dal-badge ${candidateGenerationState === "FAILED" ? "warning" : candidateGenerationState === "GENERATING" ? "warning" : "pass"}`}>
                    {candidateGenerationState === "GENERATING" ? "GENERATING OSRM" : `${corridorCandidates.length.toLocaleString()} CANDIDATES`}
                  </span>
                </div>
                <div className="sales-corridor-candidate-grid">
                  {corridorCandidates.map((candidate) => {
                    const selected = candidate.candidateId === selectedCorridorCandidate?.candidateId;
                    const previewed = candidate.candidateId === previewCorridorCandidate?.candidateId;
                    const current = candidate.geometryHash === currentRevisionGeometryHash;
                    const comparison = buildCorridorCandidateComparison(candidate, activeEngineeringRevision.delta.revision);
                    return (
                      <article
                        key={candidate.candidateId}
                        className={`sales-corridor-candidate-card ${selected ? "selected" : ""} ${current ? "current" : ""}`}
                        onClick={() => selectSalesCandidate(candidate)}
                      >
                        <div className="sales-corridor-candidate-title">
                          <div>
                            <h4>{candidate.name}</h4>
                            <span>{candidate.sourceLabel}</span>
                          </div>
                          <span className={`dal-badge ${current ? "pass" : previewed ? "warning" : "info"}`}>
                            {current ? "CURRENT" : previewed ? "PREVIEW" : candidate.candidateType.replaceAll("_", " ")}
                          </span>
                        </div>
                        {comparison.valid ? (
                          <div className="sales-corridor-candidate-metrics">
                            <div><span>Route Miles</span><b>{miles(comparison.snapshot.routeMiles)}</b></div>
                            <div><span>Construction Cost</span><b>{money(comparison.snapshot.constructionCost)}</b></div>
                            <div><span>Sell</span><b>{money(comparison.snapshot.proposalValue)}</b></div>
                            <div><span>GM</span><b>{money(comparison.grossMargin)} / {formatSnapshotValue(comparison.snapshot.marginPercent, "percent")}</b></div>
                            <div><span>Cost/Mile</span><b>{money(comparison.costPerMile)}</b></div>
                            <div><span>Revenue/Mile</span><b>{money(comparison.revenuePerMile)}</b></div>
                            <div><span>Margin/Mile</span><b>{money(comparison.marginPerMile)}</b></div>
                            <div><span>Optical Loss</span><b>{fmt(comparison.snapshot.opticalLossDb)} dB</b></div>
                            <div><span>Duration</span><b>{comparison.snapshot.durationDays.toLocaleString()} days</b></div>
                            <div><span>Confidence</span><b>{formatSnapshotValue(comparison.snapshot.confidence, "score")}</b></div>
                            <div><span>Unknowns</span><b>{candidate.unknownCount.toLocaleString()}</b></div>
                            <div><span>Estimated Diversity</span><b>{candidate.diversityScore}/100</b></div>
                            <div><span>Commercial Readiness</span><b>{formatSnapshotValue(comparison.snapshot.commercialReadiness, "score")}</b></div>
                            <div><span>Current vs Delta</span><b>{formatDeltaValue(comparison.delta.routeMiles, "miles")} / {formatDeltaValue(comparison.delta.constructionCost, "money")}</b></div>
                            <div><span>Sell Delta</span><b>{formatDeltaValue(comparison.delta.proposalValue, "money")}</b></div>
                            <div><span>GM Delta</span><b>{formatDeltaValue(comparison.delta.grossMargin, "money")}</b></div>
                          </div>
                        ) : (
                          <div className="dal-status warning">Comparison data out of sync. {comparison.reason}</div>
                        )}
                        <div className="sales-corridor-candidate-actions">
                          <button type="button" onClick={(event) => { event.stopPropagation(); selectSalesCandidate(candidate, `${candidate.name} previewed on the map.`); }}>Preview</button>
                          <button type="button" onClick={(event) => { event.stopPropagation(); selectSalesCandidate(candidate, candidate.explanation); setCompareMode("DIFFERENCE"); }} disabled={!comparison.valid}>Compare</button>
                          <button type="button" onClick={(event) => { event.stopPropagation(); createCandidateRevision(candidate, "MAKE_CURRENT"); }} disabled={!comparison.valid}>Make Current</button>
                          <button type="button" onClick={(event) => { event.stopPropagation(); createCandidateRevision(candidate, "SAVE_REVISION"); }} disabled={!comparison.valid}>Save as Revision</button>
                          {candidate.source !== "OSRM_BASELINE" ? (
                            <button type="button" onClick={(event) => { event.stopPropagation(); discardSelectedCandidate(candidate.candidateId); }}>Discard</button>
                          ) : null}
                        </div>
                      </article>
                    );
                  })}
                </div>
                {candidateFailures.length ? (
                  <details className="route-engineering-collapsible">
                    <summary>OSRM Candidate Failures</summary>
                    <div className="dal-list">
                      {candidateFailures.map((failure) => (
                        <div className="dal-list-row" key={`${failure.name}:${failure.failureReason}`}>
                          <b>{failure.name}</b>
                          <span>{failure.failureReason}</span>
                          <small>{failure.diagnostics.join(" ") || "No straight-line fallback was created."}</small>
                        </div>
                      ))}
                    </div>
                  </details>
                ) : null}
              </div>

              <div className="sales-engineering-summary-grid">
                <div className="dal-panel">
                  <h3>Route Delta</h3>
                  <div className="dal-metrics">
                    <span>Baseline: {miles(activeEngineeringRevision.delta.baseline.routeMiles)}</span>
                    <span>Current: {miles(activeEngineeringRevision.delta.revision.routeMiles)}</span>
                    <span>Delta: {formatDeltaValue(activeEngineeringRevision.delta.difference.routeMiles, "miles")}</span>
                    <span>Fiber: {formatDeltaValue(activeEngineeringRevision.delta.difference.fiberFootage, "feet")}</span>
                    <span>Duct: {formatDeltaValue(activeEngineeringRevision.delta.difference.ductFootage, "feet")}</span>
                  </div>
                </div>
                <div className="dal-panel">
                  <h3>Financial Delta</h3>
                  <div className="dal-metrics">
                    <span>Construction: {formatDeltaValue(activeEngineeringRevision.delta.difference.constructionCost, "money")}</span>
                    <span>Labor: {formatDeltaValue(activeEngineeringRevision.delta.difference.labor, "money")}</span>
                    <span>Materials: {formatDeltaValue(activeEngineeringRevision.delta.difference.materials, "money")}</span>
                    <span>Equipment: {formatDeltaValue(activeEngineeringRevision.delta.difference.equipment, "money")}</span>
                    <span>Duration: {formatDeltaValue(activeEngineeringRevision.delta.difference.durationDays, "number")} days</span>
                    <span>Margin: {formatDeltaValue(activeEngineeringRevision.delta.difference.marginPercent, "percent")}</span>
                  </div>
                </div>
                <div className="dal-panel">
                  <h3>Optical Delta</h3>
                  <div className="dal-metrics">
                    <span>Attenuation: {fmt(activeEngineeringRevision.opticalPreview.estimatedAttenuationDb)} dB</span>
                    <span>Splice Loss: {fmt(activeEngineeringRevision.opticalPreview.spliceLossDb)} dB</span>
                    <span>Connector Loss: {fmt(activeEngineeringRevision.opticalPreview.connectorLossDb)} dB</span>
                    <span>Total Loss: {fmt(activeEngineeringRevision.opticalPreview.totalRouteLossDb)} dB</span>
                    <span>Delta: {formatDeltaValue(activeEngineeringRevision.delta.difference.opticalLossDb, "db")}</span>
                  </div>
                </div>
                <div className="dal-panel">
                  <h3>Confidence / Readiness</h3>
                  <div className="dal-metrics">
                    <span>Engineering Confidence: {formatSnapshotValue(activeEngineeringRevision.delta.revision.confidence, "score")}</span>
                    <span>Commercial Readiness: {formatSnapshotValue(activeEngineeringRevision.delta.revision.commercialReadiness, "score")}</span>
                    <span>Unknowns: {unknownConstraintCount.toLocaleString()}</span>
                    <span>API/Synthesis Coverage: {apiCoveragePercent}%</span>
                  </div>
                </div>
              </div>

              <div className="dal-grid two">
                <div className="dal-panel">
                  <div className="dal-panel-title-row">
                    <h3>Corridor Comparison</h3>
                    <span className="dal-badge warning">{compareMode}</span>
                  </div>
                  <div className="teralinx-summary-grid">
                    <div><span>Commercial Baseline</span><b>{engineeringDraft.commercialBaselineGeometryHash}</b></div>
                    <div><span>Current Revision</span><b>{activeEngineeringRevision.revisionName}</b></div>
                    <div><span>Selected Candidate</span><b>{selectedCorridorCandidate?.name ?? "None"}</b></div>
                    <div><span>Revision Status</span><b>{activeEngineeringRevision.status}</b></div>
                    <div><span>OSRM Source</span><b>Existing DAL OSRM</b></div>
                    <div><span>Candidate Source</span><b>{selectedCorridorCandidate?.sourceLabel ?? "n/a"}</b></div>
                    <div><span>Baseline Miles</span><b>{miles(engineeringDraft.commercialBaselineMetrics.routeMiles)}</b></div>
                    <div><span>Current Miles</span><b>{miles(activeEngineeringRevision.delta.revision.routeMiles)}</b></div>
                    <div><span>Candidate Miles</span><b>{selectedCorridorCandidateComparison?.valid ? miles(selectedCorridorCandidateComparison.snapshot.routeMiles) : "n/a"}</b></div>
                    <div><span>Baseline Cost</span><b>{money(engineeringDraft.commercialBaselineMetrics.constructionCost)}</b></div>
                    <div><span>Current Cost</span><b>{money(activeEngineeringRevision.delta.revision.constructionCost)}</b></div>
                    <div><span>Candidate Cost</span><b>{selectedCorridorCandidateComparison?.valid ? money(selectedCorridorCandidateComparison.snapshot.constructionCost) : "n/a"}</b></div>
                    <div><span>Candidate Sell</span><b>{selectedCorridorCandidateComparison?.valid ? money(selectedCorridorCandidateComparison.snapshot.proposalValue) : "n/a"}</b></div>
                    <div><span>Candidate GM</span><b>{selectedCorridorCandidateComparison?.valid ? money(selectedCorridorCandidateComparison.grossMargin) : "n/a"}</b></div>
                    <div><span>Candidate Cost Delta</span><b>{selectedCorridorCandidateComparison?.valid ? formatDeltaValue(selectedCorridorCandidateComparison.delta.constructionCost, "money") : "n/a"}</b></div>
                    <div><span>Candidate Sell Delta</span><b>{selectedCorridorCandidateComparison?.valid ? formatDeltaValue(selectedCorridorCandidateComparison.delta.proposalValue, "money") : "n/a"}</b></div>
                    <div><span>Candidate Duration Delta</span><b>{selectedCorridorCandidateComparison?.valid ? `${formatDeltaValue(selectedCorridorCandidateComparison.delta.durationDays, "number")} days` : "n/a"}</b></div>
                    <div><span>Candidate Optical</span><b>{selectedCorridorCandidateComparison?.valid ? `${fmt(selectedCorridorCandidateComparison.snapshot.opticalLossDb)} dB` : "n/a"}</b></div>
                    <div><span>Candidate Diversity</span><b>{selectedCorridorCandidate ? `${selectedCorridorCandidate.diversityScore}/100` : "n/a"}</b></div>
                    <div><span>Candidate Confidence</span><b>{selectedCorridorCandidateComparison?.valid ? formatSnapshotValue(selectedCorridorCandidateComparison.snapshot.confidence, "score") : "n/a"}</b></div>
                    <div><span>A Endpoint</span><b>{coordinateLabel(engineeringDraft.commercialBaselineGeometry[0])}</b></div>
                    <div><span>Z Endpoint</span><b>{coordinateLabel(engineeringDraft.commercialBaselineGeometry.at(-1))}</b></div>
                  </div>
                  {selectedCorridorCandidateComparison && !selectedCorridorCandidateComparison.valid ? (
                    <div className="dal-status warning">Comparison data out of sync. {selectedCorridorCandidateComparison.reason}</div>
                  ) : null}
                  <div className="dal-status">Corridor Mode keeps A/Z fixed and refuses straight-line fallback if OSRM candidate routing fails.</div>
                </div>
                <div className="dal-panel">
                  <div className="dal-panel-title-row">
                    <h3>Explain Revision</h3>
                    <span className="dal-badge pass">Deterministic</span>
                  </div>
                  <div className="dal-status">
                    {revisionExplanation || "Use Explain Revision to generate a deterministic DAL summary from the active revision deltas. No external AI call is made."}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <>
          <div className="dal-panel">
            <div className="dal-panel-title-row">
              <h3>Live Financial Delta</h3>
              <span className="dal-badge warning">{compareMode}</span>
            </div>
            <div className="dal-metrics">
              {activeEngineeringRevision.delta.executiveSummary.map((line) => (
                <span key={line}>{line}</span>
              ))}
            </div>
            <div className="dal-table-wrap route-engineering-delta-table">
              <table className="dal-table">
                <thead>
                  <tr>
                    <th>Metric</th>
                    <th>Commercial Baseline</th>
                    <th>Engineering Revision</th>
                    <th>Difference</th>
                  </tr>
                </thead>
                <tbody>
                  {DELTA_ROWS.map((row) => {
                    const baseline = snapshotValue(activeEngineeringRevision.delta.baseline, row.key);
                    const revision = snapshotValue(activeEngineeringRevision.delta.revision, row.key);
                    const difference = snapshotValue(activeEngineeringRevision.delta.difference, row.key);
                    return (
                      <tr key={row.key}>
                        <td>{row.label}</td>
                        <td>{formatSnapshotValue(baseline, row.kind)}</td>
                        <td>{formatSnapshotValue(revision, row.kind)}</td>
                        <td>{formatDeltaValue(difference, row.kind)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="dal-grid two">
            <div className="dal-panel">
              <div className="dal-panel-title-row">
                <h3>Segment Editing Panel</h3>
                <span className={`dal-badge ${selectedEngineeringSegment ? segmentStateClass(selectedEngineeringSegment) : "warning"}`}>
                  {selectedEngineeringSegment?.states[0] ?? "NO_SEGMENT"}
                </span>
              </div>
              {selectedEngineeringSegment ? (
                <>
                  <div className="dal-metrics">
                    <span>Segment ID: {selectedEngineeringSegment.segmentId}</span>
                    <span>Length: {feet(selectedEngineeringSegment.intelligence.lengthFeet)}</span>
                    <span>Construction: {selectedEngineeringSegment.intelligence.constructionMethod.value ?? "UNKNOWN"}</span>
                    <span>Civil: {selectedEngineeringSegment.intelligence.civilType.value ?? "UNKNOWN"}</span>
                    <span>Fiber Count: {engineeringDraft.commercialDraft?.transparentEstimate.physicalQuantities.fiberCount ?? "UNKNOWN"}</span>
                    <span>Duct Count: {engineeringDraft.commercialDraft ? 1 : "UNKNOWN"}</span>
                    <span>Expected Production: {engineeringDraft.commercialDraft?.transparentEstimate.controls.production.plowFeetPerDay?.toLocaleString() ?? "UNKNOWN"} ft/day</span>
                    <span>Estimated Labor: {money(activeEngineeringRevision.delta.revision.labor)}</span>
                    <span>Estimated Material: {money(activeEngineeringRevision.delta.revision.materials)}</span>
                    <span>Estimated Equipment: {money(activeEngineeringRevision.delta.revision.equipment)}</span>
                    <span>Estimated Attenuation: {fmt(activeEngineeringRevision.opticalPreview.estimatedAttenuationDb)} dB</span>
                    <span>Estimated Splice Loss: {fmt(activeEngineeringRevision.opticalPreview.spliceLossDb)} dB</span>
                    <span>Estimated Schedule: {activeEngineeringRevision.delta.revision.durationDays.toLocaleString()} days</span>
                    <span>Estimated Cost: {money(activeEngineeringRevision.delta.revision.constructionCost)}</span>
                    <span>Authority Source: {selectedEngineeringSegment.geometryAuthority}</span>
                    <span>Confidence: {selectedEngineeringSegment.intelligence.constructionMethod.confidence}%</span>
                    <span>Dependencies: Snap, constraints, commercial baseline</span>
                  </div>
                  <details className="route-engineering-collapsible">
                    <summary>Full Constraint Table</summary>
                    <div className="dal-table-wrap route-engineering-segment-table">
                      <table className="dal-table">
                        <thead>
                          <tr>
                            <th>Constraint</th>
                            <th>Value</th>
                            <th>Authority</th>
                            <th>Confidence</th>
                            <th>Source</th>
                          </tr>
                        </thead>
                        <tbody>
                          {segmentConstraints(selectedEngineeringSegment).map((constraint) => (
                              <tr key={constraint.key}>
                                <td>{constraint.label}</td>
                                <td>{constraint.value ?? "UNKNOWN"}</td>
                                <td>{constraint.authorityMode}</td>
                                <td>{constraint.confidence}%</td>
                                <td>{constraint.source}</td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  </details>
                </>
              ) : (
                <div className="dal-status">Select a segment.</div>
              )}
            </div>

            <div className="dal-panel">
              <h3>Optical Preview</h3>
              <div className="dal-metrics">
                <span>Total Route Loss: {fmt(activeEngineeringRevision.opticalPreview.totalRouteLossDb)} dB</span>
                <span>Connector Loss: {fmt(activeEngineeringRevision.opticalPreview.connectorLossDb)} dB</span>
                <span>Splice Loss: {fmt(activeEngineeringRevision.opticalPreview.spliceLossDb)} dB</span>
                <span>Estimated Attenuation: {fmt(activeEngineeringRevision.opticalPreview.estimatedAttenuationDb)} dB</span>
                <span>Longest Span: {miles(activeEngineeringRevision.opticalPreview.longestSpanMiles)}</span>
                <span>Average Span: {miles(activeEngineeringRevision.opticalPreview.averageSpanMiles)}</span>
                <span>Recommended ILA Spacing: {miles(activeEngineeringRevision.opticalPreview.recommendedIlaSpacingMiles)}</span>
                <span>Estimated Optical Budget: {fmt(activeEngineeringRevision.opticalPreview.estimatedOpticalBudgetDb)} dB</span>
              </div>
              <div className="dal-status">Engineering preview only. No Layer 2 authority is created.</div>
            </div>
          </div>

          <div className="dal-grid two">
            <div className="dal-panel">
              <h3>Engineering Layers</h3>
              <div className="route-engineering-layer-grid">
                {(Object.keys(ENGINEERING_LAYER_LABELS) as EngineeringLayerId[]).map((layerId) => (
                  <label key={layerId}>
                    <input
                      type="checkbox"
                      checked={engineeringDraft.layerVisibility[layerId]}
                      onChange={() => toggleEngineeringLayer(layerId)}
                    />
                    <span>{ENGINEERING_LAYER_LABELS[layerId]}</span>
                  </label>
                ))}
              </div>
              <div className="dal-status">Future APIs can populate these overlays automatically. Hidden layers do not remove evidence or authority records.</div>
            </div>

            <div className="dal-panel">
              <h3>Geometry Authority</h3>
              <details className="route-engineering-collapsible">
                <summary>Snap Provenance / Geometry Sources</summary>
                <div className="dal-list">
                  {activeEngineeringRevision.geometrySources.map((source) => (
                    <div className="dal-list-row" key={source.sourceId}>
                      <b>{source.authority}</b>
                      <span>{source.label}</span>
                      <small>{source.geometryHash}</small>
                    </div>
                  ))}
                </div>
              </details>
              <div className="dal-status">
                Commercial, OSRM, Engineering, API, Synthesis, Construction, As-Built, and Operational geometry sources are preserved instead of overwritten.
              </div>
            </div>
          </div>

          <details className="dal-panel route-engineering-collapsible">
            <summary>Segment States</summary>
            <div className="dal-panel-title-row">
              <h3>Segment States</h3>
              <span className="dal-badge warning">{activeEngineeringRevision.segments.length.toLocaleString()} selectable segments</span>
            </div>
            <div className="dal-table-wrap route-engineering-segment-state-table">
              <table className="dal-table">
                <thead>
                  <tr>
                    <th>Segment</th>
                    <th>State</th>
                    <th>Length</th>
                    <th>Geometry Authority</th>
                    <th>Snap Object</th>
                    <th>Unknowns</th>
                  </tr>
                </thead>
                <tbody>
                  {activeEngineeringRevision.segments.map((segment) => (
                    <tr
                      key={segment.segmentId}
                      className={selectedEngineeringSegment?.segmentId === segment.segmentId ? "selected" : undefined}
                      onClick={() => setSelectedEngineeringSegmentId(segment.segmentId)}
                    >
                      <td>{segment.label}</td>
                      <td>
                        <span className={`dal-badge ${segmentStateClass(segment)}`}>{segment.states.join(" / ")}</span>
                      </td>
                      <td>{feet(segment.intelligence.lengthFeet)}</td>
                      <td>{segment.geometryAuthority}</td>
                      <td>{segment.snapReferences[0]?.graphObjectId ?? "OSRM/baseline"}</td>
                      <td>{segment.intelligence.unknowns.value ?? "UNKNOWN"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>

          <div className="dal-panel">
            <div className="dal-panel-title-row">
              <h3>Version History</h3>
              <span className="dal-badge warning">No destructive edits</span>
            </div>
            <div className="dal-actions">
              <select value={selectedRevision?.revisionId ?? ""} onChange={(event) => setSelectedRevisionId(event.target.value)} aria-label="Engineering revision">
                {engineeringDraft.revisions.map((revision) => (
                  <option key={revision.revisionId} value={revision.revisionId}>
                    {revision.revisionName} / {revision.status}
                  </option>
                ))}
              </select>
              <button type="button" onClick={restoreSelectedRevision} disabled={!selectedRevision}>Restore</button>
              <button type="button" onClick={branchSelectedRevision} disabled={!selectedRevision}>Branch</button>
              <button type="button" onClick={acceptSelectedRevision} disabled={!selectedRevision}>Accept</button>
              <button type="button" onClick={rejectSelectedRevision} disabled={!selectedRevision}>Reject</button>
            </div>
            <details className="route-engineering-collapsible">
              <summary>Full Audit Trail</summary>
              <div className="dal-table-wrap route-engineering-version-table">
                <table className="dal-table">
                  <thead>
                    <tr>
                      <th>Revision</th>
                      <th>Status</th>
                      <th>Reason</th>
                      <th>Route Delta</th>
                      <th>Cost Delta</th>
                      <th>Optical Delta</th>
                      <th>Edits</th>
                      <th>Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {engineeringDraft.revisions.map((revision) => (
                      <tr
                        key={revision.revisionId}
                        className={selectedRevision?.revisionId === revision.revisionId ? "selected" : undefined}
                        onClick={() => setSelectedRevisionId(revision.revisionId)}
                      >
                        <td>{revision.revisionName}</td>
                        <td>{revision.status}</td>
                        <td>{revision.reason}</td>
                        <td>{formatDeltaValue(revision.delta.difference.routeMiles, "miles")}</td>
                        <td>{formatDeltaValue(revision.delta.difference.constructionCost, "money")}</td>
                        <td>{formatDeltaValue(revision.delta.difference.opticalLossDb, "db")}</td>
                        <td>{revision.editLog.length.toLocaleString()}</td>
                        <td>{revision.createdAt}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          </div>
            </>
          )}
        </>
      ) : (
        <div className="dal-panel">
          <h3>{incomingCommercialDraft ? (activationFailureReason ? "Draft Creation Failed" : "Engineering Draft Activating") : "No Commercial Corridor Draft Selected"}</h3>
          <div className="dal-status">
            {incomingCommercialDraft
              ? activationFailureReason || "Route Engineering is freezing the Commercial Baseline and creating Engineering Revision 1 automatically."
              : "No commercial corridor draft selected. Return to Commercial Planning and use Enter Engineering Mode from a valid Commercial Draft."}
          </div>
          <div className="dal-actions">
            {incomingCommercialDraft ? (
              <button type="button" onClick={() => setActivationRetryNonce((current) => current + 1)}>
                Retry Engineering Activation
              </button>
            ) : null}
            <button type="button" onClick={() => setWorkspace("googleRfp")}>Return to Commercial Planning</button>
          </div>
        </div>
      )}

      {engineeringMode === "ROUTE_ENGINEERING" ? (
        <>
      <div className="dal-panel">
        <h3>Route Render Audit</h3>
        <div className="dal-metrics">
          <span>CertifiedRoute Exists: {routeRenderAudit.certifiedRouteExists ? "TRUE" : "FALSE"}</span>
          <span>Geometry Coordinates: {routeRenderAudit.geometryCoordinateCount.toLocaleString()}</span>
          <span>Rendered Primitives: {routeRenderAudit.renderedPrimitiveCount.toLocaleString()}</span>
          <span>Route Authority Primitives: {routeRenderAudit.routeAuthorityPrimitiveCount.toLocaleString()}</span>
          <span>Fit Route Enabled: {routeRenderAudit.fitRouteEnabled ? "TRUE" : "FALSE"}</span>
          <span>Fit Certified Route Enabled: {routeRenderAudit.fitCertifiedRouteEnabled ? "TRUE" : "FALSE"}</span>
          <span>Render Source Layer: {routeRenderAudit.renderSourceLayer}</span>
          <span>Render Authority ID: {routeRenderAudit.renderAuthorityId}</span>
        </div>
      </div>

      <div className="dal-grid two">
        <div className="dal-panel">
          <h3>Route Inputs</h3>
          <label>
            Inventory
            <select value={selectedInventory?.inventoryId ?? ""} onChange={(event) => setSelectedInventoryId(event.target.value)}>
              {inventories.map((inventory) => (
                <option key={inventory.inventoryId} value={inventory.inventoryId}>
                  {inventory.name} / {inventory.inventoryId}
                </option>
              ))}
            </select>
          </label>
          <label>
            Target Type
            <select value={targetType} onChange={(event) => setTargetType(event.target.value as TargetType)}>
              <option value="opportunity">Opportunity Seed</option>
              <option value="candidate">Candidate Site</option>
            </select>
          </label>
          {targetType === "opportunity" ? (
            <label>
              Opportunity
              <select value={selectedSeed?.id ?? ""} onChange={(event) => setSelectedOpportunitySeedId(event.target.value)}>
                {opportunitySeeds.map((seed) => (
                  <option key={seed.id} value={seed.id}>
                    {seed.siteName ?? seed.id}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <label>
              Candidate
              <select value={selectedCandidate?.candidateId ?? ""} onChange={(event) => setSelectedCandidateSiteId(event.target.value)}>
                {candidateSites.map((candidate) => (
                  <option key={candidate.candidateId} value={candidate.candidateId}>
                    {candidate.companyName}
                  </option>
                ))}
              </select>
            </label>
          )}
          <div className="dal-actions">
            {!incomingCommercialDraft ? (
              <button type="button" onClick={createDraft} disabled={!selectedInventory || !selectedTargetCoordinate}>
                Create Draft Route
              </button>
            ) : (
              <button type="button" disabled>
                Engineering Revision 1 Auto-Created
              </button>
            )}
            <button type="button" onClick={saveRoute} disabled={!activeRoute}>
              Save CertifiedRoute
            </button>
          </div>
          <div className="dal-metrics">
            <span>Target: {targetLabel(selectedTarget, targetType)}</span>
            <span>Candidate Coordinate: {coordinateLabel(selectedTargetCoordinate)}</span>
            <span>Inventory: {selectedInventory?.inventoryId ?? "n/a"}</span>
            <span>Graph: {selectedInventory?.graphId ?? "n/a"}</span>
          </div>
        </div>

        <div className="dal-panel">
          <h3>CertifiedRoute Repository</h3>
          <label>
            Existing CertifiedRoute
            <select
              value={selectedCertifiedRouteId}
              onChange={(event) => {
                setSelectedCertifiedRouteId(event.target.value);
                setDraftRoute(null);
              }}
            >
              <option value="">Draft / none</option>
              {certifiedRoutes.map((route) => (
                <option key={route.certifiedRouteId} value={route.certifiedRouteId}>
                  {route.certifiedRouteId} / {route.routeAuthorityState}
                </option>
              ))}
            </select>
          </label>
          <div className="dal-metrics">
            <span>Total CertifiedRoute Records: {certifiedRoutes.length.toLocaleString()}</span>
            <span>Certified: {certifiedRoutes.filter((route) => route.routeAuthorityState === "CERTIFIED_ROUTE").length.toLocaleString()}</span>
            <span>Direct Fallback: {certifiedRoutes.filter((route) => route.routeAuthorityState === "DIRECT_FALLBACK").length.toLocaleString()}</span>
            <span>Review Required: {certifiedRoutes.filter((route) => route.routeAuthorityState === "ENGINEER_REVIEW_REQUIRED").length.toLocaleString()}</span>
          </div>
        </div>
      </div>

      <div className="dal-grid two">
        <div className="dal-panel">
          <h3>Route Authority Evidence</h3>
          {evaluatedRoute ? (
            <>
              <div className="dal-grid compact">
                <label>
                  Route Mode
                  <select value={evaluatedRoute.routeMode} onChange={(event) => updateRouteMode(event.target.value as RouteMode)}>
                    <option value="DIRECT_FALLBACK">DIRECT_FALLBACK</option>
                    <option value="OSRM_ROUTE">OSRM_ROUTE</option>
                    <option value="ROAD_ROW">ROAD_ROW</option>
                    <option value="UTILITY_EASEMENT">UTILITY_EASEMENT</option>
                    <option value="EXISTING_TELECOM">EXISTING_TELECOM</option>
                    <option value="RAIL_CORRIDOR">RAIL_CORRIDOR</option>
                    <option value="POWER_CORRIDOR">POWER_CORRIDOR</option>
                    <option value="PRIVATE_EASEMENT">PRIVATE_EASEMENT</option>
                    <option value="ENGINEER_DEFINED">ENGINEER_DEFINED</option>
                  </select>
                </label>
                <label>
                  Corridor Basis
                  <select value={evaluatedRoute.corridorBasis} onChange={(event) => updateCorridorBasis(event.target.value as CorridorBasis)}>
                    <option value="REFERENCE_ONLY">REFERENCE_ONLY</option>
                    <option value="CANDIDATE_CORRIDOR">CANDIDATE_CORRIDOR</option>
                    <option value="CERTIFIED_CORRIDOR">CERTIFIED_CORRIDOR</option>
                    <option value="ENGINEER_DEFINED_CORRIDOR">ENGINEER_DEFINED_CORRIDOR</option>
                    <option value="UNKNOWN">UNKNOWN</option>
                  </select>
                </label>
              </div>
              <div className="dal-metrics">
                <span>Authority State: {evaluatedRoute.routeAuthorityState}</span>
                <span>Geometry Hash: {evaluatedRoute.geometryHash}</span>
                <span>Route Feet: {feet(evaluatedRoute.routeFeet)}</span>
                <span>Route Miles: {miles(evaluatedRoute.routeMiles)}</span>
                <span>Crow-Fly Feet: {feet(evaluatedRoute.crowFlyFeet)}</span>
                <span>Route/Crow-Fly Ratio: {fmt(evaluatedRoute.routeToCrowFlyRatio)}</span>
                <span>Constraint Evidence: {evaluatedRoute.constraintEvidenceStatus}</span>
                <span>Constructability: {fmt(evaluatedRoute.constructabilityScore)}</span>
                <span>Risk: {fmt(evaluatedRoute.riskScore)}</span>
                <span>Road Crossings: {evaluatedRoute.crossingSummary.roadCrossings}</span>
                <span>Rail Crossings: {evaluatedRoute.crossingSummary.railCrossings}</span>
                <span>Water Crossings: {evaluatedRoute.crossingSummary.waterCrossings}</span>
                <span>Parcel Crossings: {evaluatedRoute.crossingSummary.parcelCrossings}</span>
                <span>Building Conflicts: {evaluatedRoute.crossingSummary.buildingConflicts}</span>
                <span>Quote Authority: {evaluatedRoute.authority.canGenerateAuthoritativeQuote ? "AUTHORIZED" : "BLOCKED"}</span>
                <span>IOF Package Authority: {evaluatedRoute.authority.canCreateIOFPackage ? "AUTHORIZED" : "BLOCKED"}</span>
                <span>Control Work Authority: {evaluatedRoute.authority.canCreateControlWork ? "AUTHORIZED" : "BLOCKED"}</span>
                <span>Field Work Authority: {evaluatedRoute.authority.canCreateFieldWork ? "AUTHORIZED" : "BLOCKED"}</span>
                <span>Twin Planned State: {evaluatedRoute.authority.canMutateTwinPlannedState ? "AUTHORIZED" : "ADVISORY ONLY"}</span>
              </div>
              <div className="dal-actions">
                <button type="button" onClick={addMidpointVertex} disabled={evaluatedRoute.routeAuthorityState === "CERTIFIED_ROUTE"}>
                  Add Engineering Vertex
                </button>
                <button type="button" onClick={addEvidenceSnapshot}>
                  Attach Current Evidence Snapshot
                </button>
              </div>
            </>
          ) : (
            <div className="dal-status">Create or select a CertifiedRoute.</div>
          )}
        </div>

        <div className="dal-panel">
          <h3>Certification</h3>
          <label>
            ScopeVersion Approval
            <select value={approvalScope?.scopeVersionId ?? ""} onChange={(event) => setSelectedApprovalScopeId(event.target.value)}>
              <option value="">Select ScopeVersion</option>
              {scopeVersions.map((scope) => (
                <option key={scope.scopeVersionId} value={scope.scopeVersionId}>
                  {((scope.canonicalTruth as any)?.sourceCandidate?.name ?? (scope.canonicalTruth as any)?.sourceCandidate?.companyName ?? scope.scopeVersionId)} / {getAuthoritativeLifecycleState(scope)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Engineer
            <input value={engineerName} onChange={(event) => setEngineerName(event.target.value)} />
          </label>
          <label>
            Certification Notes
            <textarea value={certificationNotes} onChange={(event) => setCertificationNotes(event.target.value)} rows={4} />
          </label>
          <label>
            Rejection Reason
            <textarea value={rejectionReason} onChange={(event) => setRejectionReason(event.target.value)} rows={3} />
          </label>
          <div className="dal-actions">
            <button type="button" onClick={certifyActiveRoute} disabled={!evaluatedRoute}>
              Certify Route
            </button>
            <button type="button" onClick={rejectActiveRoute} disabled={!evaluatedRoute}>
              Reject Route
            </button>
            <button type="button" onClick={() => void approveScopeVersionForControl()} disabled={!approvalScope}>
              Approve ScopeVersion
            </button>
          </div>
          {evaluatedRoute ? (
            <div className="dal-callout">
              <strong>Required Actions</strong>
              <ul>
                {evaluatedRoute.authority.requiredActions.map((action) => (
                  <li key={action}>{action}</li>
                ))}
                {!evaluatedRoute.authority.requiredActions.length ? <li>None. Route is authoritative for certified uses.</li> : null}
              </ul>
              <strong>Warnings</strong>
              <ul>
                {evaluatedRoute.authority.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
                {!evaluatedRoute.authority.warnings.length ? <li>None.</li> : null}
              </ul>
            </div>
          ) : null}
        </div>
      </div>

      {evaluatedRoute ? (
        <div className="dal-panel">
          <button type="button" onClick={() => setShowDiagnostics((prev) => !prev)}>
            {showDiagnostics ? "Hide" : "Show"} Advanced Diagnostics
          </button>
          {showDiagnostics ? (
            <pre className="dal-json">{JSON.stringify({ certifiedRoute: evaluatedRoute, scopeVersionReference: referenceFromRoute(evaluatedRoute) }, null, 2)}</pre>
          ) : null}
        </div>
      ) : null}
        </>
      ) : null}
    </section>
  );
}
