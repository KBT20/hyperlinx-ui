import { haversineFeet } from "../affinity/geo";
import type { CenterlineRoute } from "../corridor/CenterlineRoute";
import { generateStationedCorridorFromCenterline } from "../corridor/CorridorGenerationEngine";
import type { StationedCorridor } from "../corridor/StationedCorridor";
import type { DesignLaunchSession } from "../design/DesignLaunchSession";
import type { ProposedGraph } from "../proposedGraph/ProposedGraph";
import { routeInventoryExtensionViaOsrm } from "../routing/OsrmLateralRouter";
import type { DALCoordinate } from "../types/dal";
import type { RouteRedline } from "./RouteRedline";
import type { RouteAvoidanceArea, RouteRedlineActionType, RouteRedlineAnchorPoint, RouteRedlineSnapStatus } from "./RouteRedlineAction";
import type { RouteRedlineDiagnostic } from "./RouteRedlineDiagnostics";
import type { RouteRevision } from "./RouteRevision";
import type { RouteRevisionDelta } from "./RouteRevisionDelta";

export interface RouteRevisionBuildResult {
  revision: RouteRevision;
  stationedCorridor: StationedCorridor | null;
  diagnostics: RouteRedlineDiagnostic[];
}

function now() {
  return new Date().toISOString();
}

function diagnostic(code: RouteRedlineDiagnostic["code"], severity: RouteRedlineDiagnostic["severity"], message: string, details?: Record<string, unknown>): RouteRedlineDiagnostic {
  const entry = {
    diagnosticId: `${code}:${Date.now()}`,
    code,
    severity,
    message,
    timestamp: now(),
    details,
  };
  console.info(`[${code}]`, entry);
  return entry;
}

function geometryFeet(geometry: DALCoordinate[]) {
  let feet = 0;
  for (let index = 1; index < geometry.length; index += 1) feet += haversineFeet(geometry[index - 1], geometry[index]);
  return Math.round(feet);
}

function appendCoordinates(target: DALCoordinate[], coordinates: DALCoordinate[]) {
  coordinates.forEach((coordinate) => {
    const last = target.at(-1);
    if (last && Math.abs(last[0] - coordinate[0]) < 0.000001 && Math.abs(last[1] - coordinate[1]) < 0.000001) return;
    target.push(coordinate);
  });
}

function findAffectedEdge(graph: ProposedGraph, affectedSegmentIds?: string[]) {
  const segmentId = affectedSegmentIds?.[0];
  if (!segmentId) return { edge: null, index: -1 };
  const index = graph.edges.findIndex((edge) => edge.segmentId === segmentId || edge.id === segmentId);
  return { edge: index >= 0 ? graph.edges[index] : null, index };
}

function stitchAffectedSegmentRevision(graph: ProposedGraph, replacementGeometry: DALCoordinate[], affectedSegmentIds?: string[]) {
  const { edge, index } = findAffectedEdge(graph, affectedSegmentIds);
  if (!edge || index < 0) return replacementGeometry;
  const stitched: DALCoordinate[] = [];
  graph.edges.slice(0, index).forEach((candidate) => appendCoordinates(stitched, candidate.coordinates));
  appendCoordinates(stitched, replacementGeometry);
  graph.edges.slice(index + 1).forEach((candidate) => appendCoordinates(stitched, candidate.coordinates));
  return stitched.length > 1 ? stitched : replacementGeometry;
}

function takeoffValues(graph: ProposedGraph, corridor?: StationedCorridor | null) {
  const takeoff = corridor?.takeoff ?? graph.takeoff ?? graph.stationedCorridor?.takeoff;
  return {
    miles: takeoff?.routeMiles ?? graph.statistics.totalMiles,
    fiberFeet: takeoff?.fiberFeet ?? graph.statistics.fiberFeet,
    ductFeet: takeoff?.ductFeet ?? graph.statistics.ductFeet,
    estimatedCost: takeoff?.estimatedConstructionCost ?? graph.statistics.estimatedConstructionCost,
    crossings: takeoff
      ? takeoff.roadCrossingCount + takeoff.railCrossingCount + takeoff.waterCrossingCount + takeoff.bridgeCrossingCount + takeoff.unknownConstraintCount
      : graph.statistics.estimatedCrossings,
    vaults: takeoff ? takeoff.vaultCount + takeoff.handholeCount : graph.statistics.estimatedVaults,
    regens: takeoff?.regenSiteCount ?? graph.statistics.estimatedRegenSites,
    confidence: takeoff?.confidence === "HIGH" ? 82 : takeoff?.confidence === "MEDIUM" ? 68 : graph.statistics.confidenceScore,
  };
}

function revisionDelta(graph: ProposedGraph, revisionId: string, revisedGeometry: DALCoordinate[], stationedCorridor: StationedCorridor | null, unresolvedWarningCount = 0): RouteRevisionDelta {
  const original = takeoffValues(graph);
  const revised = takeoffValues(graph, stationedCorridor);
  const revisedMiles = stationedCorridor?.takeoff.routeMiles ?? Number((geometryFeet(revisedGeometry) / 5280).toFixed(2));
  return {
    deltaId: `DELTA-${revisionId}`,
    originalRouteCandidateId: graph.routeCandidateId,
    revisedRouteCandidateId: revisionId,
    originalMiles: original.miles,
    revisedMiles,
    mileDelta: Number((revisedMiles - original.miles).toFixed(2)),
    originalFiberFeet: original.fiberFeet,
    revisedFiberFeet: revised.fiberFeet,
    fiberFeetDelta: revised.fiberFeet - original.fiberFeet,
    originalDuctFeet: original.ductFeet,
    revisedDuctFeet: revised.ductFeet,
    ductFeetDelta: revised.ductFeet - original.ductFeet,
    originalEstimatedCost: original.estimatedCost,
    revisedEstimatedCost: revised.estimatedCost,
    estimatedCostDelta: revised.estimatedCost - original.estimatedCost,
    originalCrossingCount: original.crossings,
    revisedCrossingCount: revised.crossings,
    crossingDelta: revised.crossings - original.crossings,
    originalVaultCount: original.vaults,
    revisedVaultCount: revised.vaults,
    vaultDelta: revised.vaults - original.vaults,
    originalRegenCount: original.regens,
    revisedRegenCount: revised.regens,
    regenDelta: revised.regens - original.regens,
    changedSegments: graph.edges.slice(0, 3).map((edge) => edge.segmentId).filter((segmentId): segmentId is string => Boolean(segmentId)),
    newConstraints: [],
    removedConstraints: [],
    confidenceChange: revised.confidence - original.confidence,
    scheduleDeltaDays: undefined,
    unresolvedWarningCount,
    summary: `Revision changes mileage by ${Number((revisedMiles - original.miles).toFixed(2))} miles and remains pending engineering verification.`,
  };
}

function anchorPoints(graph: ProposedGraph, viaPoints: DALCoordinate[]): RouteRedlineAnchorPoint[] {
  const start = graph.centerlineRoute?.aSite.coordinate ?? graph.centerlineRoute?.geometry[0] ?? graph.edges[0]?.coordinates[0];
  const end = graph.centerlineRoute?.zSite.coordinate ?? graph.centerlineRoute?.geometry.at(-1) ?? graph.edges.at(-1)?.coordinates.at(-1);
  const points: RouteRedlineAnchorPoint[] = [];
  if (start) points.push({ anchorId: "ANCHOR-START", label: "A Site", longitude: start[0], latitude: start[1], role: "START" });
  points.push(...viaPoints.map((point, index) => ({ anchorId: `ANCHOR-VIA-${index + 1}`, label: `Via ${index + 1}`, longitude: point[0], latitude: point[1], role: "VIA" as const })));
  if (end) points.push({ anchorId: "ANCHOR-END", label: "Z Site", longitude: end[0], latitude: end[1], role: "END" });
  return points;
}

export function createRouteRedline(args: {
  graph: ProposedGraph;
  actionType: RouteRedlineActionType;
  actor: string;
  reason: string;
  viaPoints?: DALCoordinate[];
  affectedSegmentIds?: string[];
  protectedSegmentIds?: string[];
  avoidanceAreas?: RouteAvoidanceArea[];
  snapStatus?: RouteRedlineSnapStatus;
  notes?: string[];
}): RouteRedline {
  const redline: RouteRedline = {
    redlineId: `REDLINE-${args.graph.proposedGraphId}-${Date.now()}`,
    sourceRouteCandidateId: args.graph.routeCandidateId,
    sourceCenterlineRouteId: args.graph.centerlineRouteId ?? args.graph.centerlineRoute?.centerlineRouteId ?? "NO_CENTERLINE",
    proposedGraphId: args.graph.proposedGraphId,
    actionType: args.actionType,
    actor: args.actor,
    reason: args.reason,
    createdAt: now(),
    affectedSegmentIds: args.affectedSegmentIds ?? [],
    protectedSegmentIds: args.protectedSegmentIds ?? [],
    anchorPoints: anchorPoints(args.graph, args.viaPoints ?? []),
    avoidanceAreas: args.avoidanceAreas ?? [],
    dragPath: args.viaPoints ?? [],
    snapStatus: args.snapStatus ?? "SNAP_PENDING",
    notes: args.notes ?? [],
  };
  console.info("[REDLINE_ACTION_CREATED]", redline);
  return redline;
}

export function createManualRouteRevision(args: {
  graph: ProposedGraph;
  redline: RouteRedline;
  revisionNumber: number;
  createdBy: string;
  reason: string;
  selectedForProposal?: boolean;
}): RouteRevisionBuildResult {
  const originalGeometry = args.graph.centerlineRoute?.geometry ?? args.graph.edges.flatMap((edge) => edge.coordinates);
  const midpoint = Math.max(1, Math.floor(originalGeometry.length / 2));
  const geometry = [...originalGeometry.slice(0, midpoint), ...args.redline.dragPath, ...originalGeometry.slice(midpoint)];
  const revisionId = `REV-${args.graph.routeCandidateId}-${args.revisionNumber}`;
  const revision: RouteRevision = {
    revisionId,
    parentRouteCandidateId: args.graph.routeCandidateId,
    parentCenterlineRouteId: args.graph.centerlineRouteId ?? "NO_CENTERLINE",
    proposedGraphId: args.graph.proposedGraphId,
    revisionNumber: args.revisionNumber,
    revisionName: `Revision ${args.revisionNumber}`,
    revisionStatus: args.selectedForProposal ? "SELECTED_FOR_PROPOSAL" : "READY_FOR_REVIEW",
    revisionReason: args.reason,
    geometry,
    redlineActions: [args.redline],
    delta: revisionDelta(args.graph, revisionId, geometry, null, args.redline.avoidanceAreas.length),
    createdBy: args.createdBy,
    createdAt: now(),
    selectedForProposal: Boolean(args.selectedForProposal),
    engineeringStatus: "PENDING_ENGINEERING_VERIFICATION",
    snapStatus: args.redline.snapStatus === "SNAP_FAILED" ? "SNAP_FAILED" : "MANUAL_GEOMETRY",
  };
  return { revision, stationedCorridor: null, diagnostics: [diagnostic("ROUTE_REVISION_CREATED", "WARNING", "Manual redline geometry staged. Quote readiness remains blocked until OSRM resnap succeeds.")] };
}

export async function createOsrmRouteRevision(args: {
  graph: ProposedGraph;
  session: DesignLaunchSession;
  viaPoints: DALCoordinate[];
  avoidanceAreas?: RouteAvoidanceArea[];
  protectedSegmentIds?: string[];
  affectedSegmentIds?: string[];
  actor: string;
  reason: string;
  revisionNumber: number;
  selectedForProposal?: boolean;
}): Promise<RouteRevisionBuildResult> {
  const diagnostics = [diagnostic("OSRM_RESNAP_REQUESTED", "INFO", "Attempting OSRM resnap for redlined route revision.", { viaPointCount: args.viaPoints.length })];
  const sourceCenterlineRoute = args.graph.centerlineRoute;
  const start = sourceCenterlineRoute?.aSite.coordinate;
  const end = sourceCenterlineRoute?.zSite.coordinate;
  const redline = createRouteRedline({
    graph: args.graph,
    actionType: args.viaPoints.length ? "ADD_VIA_POINT" : "MARK_REVIEW_REQUIRED",
    actor: args.actor,
    reason: args.reason,
    viaPoints: args.viaPoints,
    affectedSegmentIds: args.affectedSegmentIds,
    avoidanceAreas: args.avoidanceAreas,
    protectedSegmentIds: args.protectedSegmentIds,
    snapStatus: "SNAP_PENDING",
  });
  const { edge: affectedEdge } = findAffectedEdge(args.graph, args.affectedSegmentIds);
  const segmentStart = affectedEdge?.coordinates[0];
  const segmentEnd = affectedEdge?.coordinates.at(-1);
  const revisionStart = segmentStart ?? start;
  const revisionEnd = segmentEnd ?? end;
  if (!sourceCenterlineRoute || !revisionStart || !revisionEnd || !args.viaPoints.length) {
    return createManualRouteRevision({
      graph: args.graph,
      redline: { ...redline, snapStatus: "BLOCKED", notes: ["OSRM resnap requires valid anchors and at least one control point."] },
      revisionNumber: args.revisionNumber,
      createdBy: args.actor,
      reason: args.reason,
      selectedForProposal: false,
    });
  }

  const orderedPoints = [revisionStart, ...args.viaPoints, revisionEnd];
  const replacementGeometry: DALCoordinate[] = [];
  for (let index = 1; index < orderedPoints.length; index += 1) {
    const result = await routeInventoryExtensionViaOsrm({
      attachmentCoordinate: orderedPoints[index - 1],
      candidateCoordinate: orderedPoints[index],
      attachmentId: `${args.graph.routeRequestId}:REVISION:${index}`,
    });
    if (result.routeStatus !== "VALID" || result.geometry.length < 2) {
      const failedRedline = { ...redline, snapStatus: "SNAP_FAILED" as const, notes: [`OSRM segment ${index} failed: ${result.failureReason ?? "UNKNOWN"}`] };
      return {
        ...createManualRouteRevision({
          graph: args.graph,
          redline: failedRedline,
          revisionNumber: args.revisionNumber,
          createdBy: args.actor,
          reason: args.reason,
          selectedForProposal: false,
        }),
        diagnostics: [...diagnostics, diagnostic("OSRM_RESNAP_FAILED", "ERROR", "OSRM resnap failed for at least one redline segment.", { failureReason: result.failureReason })],
      };
    }
    appendCoordinates(replacementGeometry, result.geometry);
  }
  const geometry = stitchAffectedSegmentRevision(args.graph, replacementGeometry, args.affectedSegmentIds);

  const totalFeet = geometryFeet(geometry);
  const revisionId = `REV-${args.graph.routeCandidateId}-${args.revisionNumber}`;
  const centerlineRouteId = `CLR-${revisionId}`;
  const centerlineRoute: CenterlineRoute = {
    centerlineRouteId,
    routeRequestId: args.graph.routeRequestId,
    designDoctrineId: args.graph.designDoctrineId,
    source: "OSRM_EXISTING_DAL",
    status: "CENTERLINE_ROUTE_VERIFIED",
    aSite: sourceCenterlineRoute.aSite,
    zSite: sourceCenterlineRoute.zSite,
    intermediateSites: args.viaPoints.map((point, index) => ({
      siteId: `${revisionId}:VIA:${index + 1}`,
      role: "INTERMEDIATE_SITE",
      facilityName: `Redline Via ${index + 1}`,
      coordinate: point,
    })),
    geometry,
    totalFeet,
    totalMiles: Number((totalFeet / 5280).toFixed(2)),
    confidence: "MEDIUM",
    diagnostics: [],
    noEngineeringCertification: true,
    salesEstimateOnly: true,
  };
  const stationedCorridor = generateStationedCorridorFromCenterline(args.session, centerlineRoute);
  const revision: RouteRevision = {
    revisionId,
    parentRouteCandidateId: args.graph.routeCandidateId,
    parentCenterlineRouteId: args.graph.centerlineRouteId ?? sourceCenterlineRoute.centerlineRouteId,
    proposedGraphId: args.graph.proposedGraphId,
    revisionNumber: args.revisionNumber,
    revisionName: `Revision ${args.revisionNumber}`,
    revisionStatus: args.selectedForProposal ? "SELECTED_FOR_PROPOSAL" : "READY_FOR_REVIEW",
    revisionReason: args.reason,
    geometry,
    centerlineRouteId,
    stationedCorridorId: stationedCorridor.stationedCorridorId,
    takeoffId: stationedCorridor.takeoff.takeoffId,
    redlineActions: [{ ...redline, snapStatus: args.avoidanceAreas?.length ? "SNAP_PENDING" : "OSRM_RESNAPPED", notes: args.avoidanceAreas?.length ? ["Avoidance area stored as unresolved constraint; OSRM public API exclusion was not applied."] : redline.notes }],
    delta: revisionDelta(args.graph, revisionId, geometry, stationedCorridor, args.avoidanceAreas?.length ?? 0),
    createdBy: args.actor,
    createdAt: now(),
    selectedForProposal: Boolean(args.selectedForProposal),
    engineeringStatus: "PENDING_ENGINEERING_VERIFICATION",
    snapStatus: args.avoidanceAreas?.length ? "SNAP_PENDING" : "OSRM_RESNAPPED",
  };
  return {
    revision,
    stationedCorridor,
    diagnostics: [
      ...diagnostics,
      diagnostic("OSRM_RESNAP_SUCCEEDED", "INFO", "OSRM resnap succeeded for redlined route revision.", { vertexCount: geometry.length, totalMiles: centerlineRoute.totalMiles }),
      diagnostic("ROUTE_REVISION_DELTA_CALCULATED", "INFO", "Route revision delta calculated.", { deltaId: revision.delta.deltaId }),
    ],
  };
}
