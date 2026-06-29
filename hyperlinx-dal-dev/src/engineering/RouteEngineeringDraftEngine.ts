import { haversineFeet } from "../affinity/geo";
import { createConstraintValue, type ConstraintAuthorityMode } from "../commercial/ConstraintAuthority";
import type { CommercialCorridorDraft } from "../commercial/CommercialCorridorDraftEngine";
import type { DALCoordinate } from "../types/dal";
import type {
  EngineeringEditRecord,
  EngineeringEditType,
  EngineeringFinancialDelta,
  EngineeringFinancialSnapshot,
  EngineeringGeometrySource,
  EngineeringLayerId,
  EngineeringOpticalPreview,
  EngineeringRevision,
  EngineeringSegment,
  EngineeringSegmentState,
  GeometryAuthorityState,
  RouteEngineeringDraft,
  SegmentIntelligence,
  SnapCandidate,
  SnapPriority,
  SnapResult,
} from "./RouteEngineeringDraft";

const FEET_PER_MILE = 5280;
const DEFAULT_ILA_SPACING_MILES = 45;
const SNAP_PRIORITY_RANK: Record<SnapPriority, number> = {
  CUSTOMER_TWIN_ROUTE_GEOMETRY: 1,
  EXISTING_BACKBONE: 2,
  EXISTING_DUCT: 3,
  EXISTING_CONDUIT: 4,
  EXISTING_FIBER: 5,
  EXISTING_ROAD_CENTERLINE: 6,
  OSRM_GEOMETRY: 7,
  MANUAL_GEOMETRY: 8,
};

const DEFAULT_LAYER_VISIBILITY: Record<EngineeringLayerId, boolean> = {
  ROADS: true,
  PARCELS: false,
  RAIL: true,
  HYDROLOGY: true,
  ELEVATION: false,
  SLOPE: false,
  EXISTING_BACKBONE: true,
  CUSTOMER_TWIN: true,
  FIBER: false,
  CONDUIT: false,
  STATIONS: true,
  REGENERATION_SITES: true,
  HANDHOLES: true,
  STRUCTURES: true,
  CONSTRUCTION_METHODS: true,
};

function now() {
  return new Date().toISOString();
}

function createId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return `${prefix}-${crypto.randomUUID()}`;
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function round(value: number, places = 2) {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

function money(value: number) {
  return Math.round(Number.isFinite(value) ? value : 0);
}

function cloneCoordinate(coordinate: DALCoordinate): DALCoordinate {
  return [Number(coordinate[0]), Number(coordinate[1])];
}

function cloneGeometry(geometry: DALCoordinate[]) {
  return geometry.map(cloneCoordinate);
}

function normalizeGeometry(geometry: DALCoordinate[]) {
  return geometry
    .filter((coordinate) => (
      Array.isArray(coordinate) &&
      coordinate.length >= 2 &&
      Number.isFinite(Number(coordinate[0])) &&
      Number.isFinite(Number(coordinate[1])) &&
      Math.abs(Number(coordinate[0])) <= 180 &&
      Math.abs(Number(coordinate[1])) <= 90
    ))
    .map(cloneCoordinate);
}

export function engineeringGeometryHash(geometry: DALCoordinate[]) {
  const normalized = normalizeGeometry(geometry)
    .map(([lon, lat]) => `${lon.toFixed(7)},${lat.toFixed(7)}`)
    .join("|");
  let hash = 2166136261;
  for (let index = 0; index < normalized.length; index += 1) {
    hash ^= normalized.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `eng-fnv1a-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function geometryFeet(geometry: DALCoordinate[]) {
  let feet = 0;
  for (let index = 1; index < geometry.length; index += 1) feet += haversineFeet(geometry[index - 1], geometry[index]);
  return feet;
}

function candidateFromCoordinate(args: {
  prefix: string;
  index: number;
  coordinate: DALCoordinate;
  priority: SnapPriority;
  label: string;
  authorityMode: ConstraintAuthorityMode;
}): SnapCandidate {
  return {
    candidateId: `${args.prefix}:${args.index}`,
    priority: args.priority,
    graphObjectId: `${args.priority}:${args.prefix}:${args.index}`,
    label: `${args.label} ${args.index + 1}`,
    coordinate: cloneCoordinate(args.coordinate),
    authorityMode: args.authorityMode,
  };
}

function manualSnapCandidate(coordinate: DALCoordinate): SnapCandidate {
  const rounded: DALCoordinate = [Number(coordinate[0].toFixed(7)), Number(coordinate[1].toFixed(7))];
  return {
    candidateId: `MANUAL:${rounded[0]}:${rounded[1]}`,
    priority: "MANUAL_GEOMETRY",
    graphObjectId: `MANUAL_GEOMETRY:${rounded[0]}:${rounded[1]}`,
    label: "Manual geometry anchor",
    coordinate: rounded,
    authorityMode: "HUMAN",
  };
}

function buildSnapCandidates(args: {
  baselineGeometry: DALCoordinate[];
  revisionGeometry?: DALCoordinate[];
  extraCandidates?: SnapCandidate[];
}) {
  const baseline = args.baselineGeometry.map((coordinate, index) => candidateFromCoordinate({
    prefix: "OSRM_BASELINE",
    index,
    coordinate,
    priority: "OSRM_GEOMETRY",
    label: "Commercial OSRM vertex",
    authorityMode: "API",
  }));
  const revision = (args.revisionGeometry ?? []).map((coordinate, index) => candidateFromCoordinate({
    prefix: "ENGINEERING_REVISION",
    index,
    coordinate,
    priority: "MANUAL_GEOMETRY",
    label: "Engineering revision vertex",
    authorityMode: "HUMAN",
  }));
  return [...(args.extraCandidates ?? []), ...baseline, ...revision];
}

export function snapEngineeringCoordinate(args: {
  coordinate: DALCoordinate;
  candidates: SnapCandidate[];
  maxSnapFeet?: number;
}): SnapResult {
  const requested = cloneCoordinate(args.coordinate);
  const maxSnapFeet = args.maxSnapFeet ?? 180;
  const ranked = args.candidates
    .map((candidate) => ({
      candidate,
      distanceFeet: haversineFeet(requested, candidate.coordinate),
      rank: SNAP_PRIORITY_RANK[candidate.priority],
    }))
    .filter((item) => item.distanceFeet <= maxSnapFeet)
    .sort((a, b) => a.rank - b.rank || a.distanceFeet - b.distanceFeet);
  const selected = ranked[0]?.candidate ?? manualSnapCandidate(requested);
  const distanceFeet = haversineFeet(requested, selected.coordinate);
  return {
    snapId: createId("SNAP"),
    priority: selected.priority,
    priorityRank: SNAP_PRIORITY_RANK[selected.priority],
    graphObjectId: selected.graphObjectId,
    label: selected.label,
    coordinate: cloneCoordinate(selected.coordinate),
    requestedCoordinate: requested,
    distanceFeet: Math.round(distanceFeet),
    authorityMode: selected.authorityMode,
    validGraphObject: true,
  };
}

function constraintText(args: {
  key: string;
  label: string;
  value: string | null;
  authorityMode: ConstraintAuthorityMode;
  source: string;
  affectsCost?: boolean;
  affectsSchedule?: boolean;
}) {
  return createConstraintValue<string>({
    key: args.key,
    label: args.label,
    value: args.value,
    authorityMode: args.authorityMode,
    source: args.source,
    affectsCost: args.affectsCost,
    affectsSchedule: args.affectsSchedule,
  });
}

function constraintNumber(args: {
  key: string;
  label: string;
  value: number | null;
  unit?: string;
  authorityMode: ConstraintAuthorityMode;
  source: string;
  affectsCost?: boolean;
  affectsSchedule?: boolean;
}) {
  return createConstraintValue<number>({
    key: args.key,
    label: args.label,
    value: args.value,
    unit: args.unit,
    authorityMode: args.authorityMode,
    source: args.source,
    affectsCost: args.affectsCost,
    affectsSchedule: args.affectsSchedule,
  });
}

function segmentIntelligence(args: {
  segmentId: string;
  lengthFeet: number;
  draft?: CommercialCorridorDraft;
  states: EngineeringSegmentState[];
  snappedToExisting: boolean;
}): SegmentIntelligence {
  const commercialMix = args.draft?.constructionMix.label ?? "Commercial civil mix";
  const modified = args.states.includes("ENGINEERING_MODIFIED") || args.states.includes("HUMAN_MODIFIED");
  const source = modified ? "Route Engineering edit" : "Commercial baseline";
  return {
    lengthFeet: Math.round(args.lengthFeet),
    lengthMiles: round(args.lengthFeet / FEET_PER_MILE, 3),
    constructionMethod: constraintText({
      key: `${args.segmentId}.constructionMethod`,
      label: "Construction method",
      value: commercialMix,
      authorityMode: "ALGORITHM",
      source,
      affectsCost: true,
      affectsSchedule: true,
    }),
    civilType: constraintText({
      key: `${args.segmentId}.civilType`,
      label: "Civil type",
      value: args.draft?.constructionMix.hddPercent ? "Mixed OSP civil" : null,
      authorityMode: args.draft ? "ALGORITHM" : "UNKNOWN",
      source,
      affectsCost: true,
      affectsSchedule: true,
    }),
    surface: constraintText({ key: `${args.segmentId}.surface`, label: "Surface", value: null, authorityMode: "UNKNOWN", source: "Surface API pending", affectsCost: true, affectsSchedule: true }),
    rockProbability: constraintNumber({ key: `${args.segmentId}.rockProbability`, label: "Rock probability", value: null, unit: "%", authorityMode: "UNKNOWN", source: "Geotechnical evidence pending", affectsCost: true, affectsSchedule: true }),
    utilityConflicts: constraintText({ key: `${args.segmentId}.utilityConflicts`, label: "Utility conflicts", value: null, authorityMode: "UNKNOWN", source: "Utility evidence pending", affectsCost: true, affectsSchedule: true }),
    railroad: constraintText({ key: `${args.segmentId}.railroad`, label: "Railroad", value: null, authorityMode: "UNKNOWN", source: "Rail reference layer pending", affectsCost: true, affectsSchedule: true }),
    waterCrossing: constraintText({ key: `${args.segmentId}.waterCrossing`, label: "Water crossing", value: null, authorityMode: "UNKNOWN", source: "Hydrology reference layer pending", affectsCost: true, affectsSchedule: true }),
    bridgeAttachment: constraintText({ key: `${args.segmentId}.bridgeAttachment`, label: "Bridge attachment", value: null, authorityMode: "UNKNOWN", source: "Bridge attachment evidence pending", affectsCost: true, affectsSchedule: true }),
    poleAttachment: constraintText({ key: `${args.segmentId}.poleAttachment`, label: "Pole attachment", value: null, authorityMode: "UNKNOWN", source: "Pole attachment evidence pending", affectsCost: true, affectsSchedule: true }),
    existingConduit: constraintText({ key: `${args.segmentId}.existingConduit`, label: "Existing conduit", value: args.snappedToExisting ? "Snapped context" : null, authorityMode: args.snappedToExisting ? "API" : "UNKNOWN", source: "Snap engine", affectsCost: true, affectsSchedule: true }),
    existingFiber: constraintText({ key: `${args.segmentId}.existingFiber`, label: "Existing fiber", value: args.snappedToExisting ? "Snapped context" : null, authorityMode: args.snappedToExisting ? "API" : "UNKNOWN", source: "Snap engine", affectsCost: true, affectsSchedule: true }),
    existingDuct: constraintText({ key: `${args.segmentId}.existingDuct`, label: "Existing duct", value: args.snappedToExisting ? "Snapped context" : null, authorityMode: args.snappedToExisting ? "API" : "UNKNOWN", source: "Snap engine", affectsCost: true, affectsSchedule: true }),
    permitRequirements: constraintText({ key: `${args.segmentId}.permitRequirements`, label: "Permit requirements", value: null, authorityMode: "UNKNOWN", source: "Permit authority review pending", affectsCost: true, affectsSchedule: true }),
    environmental: constraintText({ key: `${args.segmentId}.environmental`, label: "Environmental", value: null, authorityMode: "UNKNOWN", source: "Environmental review pending", affectsCost: true, affectsSchedule: true }),
    unknowns: constraintText({ key: `${args.segmentId}.unknowns`, label: "Unknowns", value: "Unverified engineering constraints remain UNKNOWN.", authorityMode: "UNKNOWN", source: "Route Engineering", affectsCost: false, affectsSchedule: false }),
  };
}

function similarCoordinate(a: DALCoordinate | undefined, b: DALCoordinate | undefined, toleranceFeet = 30) {
  if (!a || !b) return false;
  return haversineFeet(a, b) <= toleranceFeet;
}

function baselineSegmentForIndex(draft: CommercialCorridorDraft | undefined, index: number) {
  if (!draft?.routeSegments.length) return undefined;
  const mappedIndex = Math.min(draft.routeSegments.length - 1, index);
  return draft.routeSegments[mappedIndex];
}

function buildSegments(args: {
  draftId: string;
  geometry: DALCoordinate[];
  baselineGeometry: DALCoordinate[];
  commercialDraft?: CommercialCorridorDraft;
  snapResults?: SnapResult[];
  accepted?: boolean;
  rejected?: boolean;
}) {
  const segments: EngineeringSegment[] = [];
  for (let index = 1; index < args.geometry.length; index += 1) {
    const from = args.geometry[index - 1];
    const to = args.geometry[index];
    const baselineFrom = args.baselineGeometry[index - 1];
    const baselineTo = args.baselineGeometry[index];
    const baselineLike = similarCoordinate(from, baselineFrom) && similarCoordinate(to, baselineTo);
    const commercialSegment = baselineSegmentForIndex(args.commercialDraft, index - 1);
    const states: EngineeringSegmentState[] = baselineLike
      ? ["COMMERCIAL_BASELINE", "OSRM_GENERATED"]
      : ["ENGINEERING_MODIFIED", "HUMAN_MODIFIED"];
    if (args.accepted) states.push("ACCEPTED");
    if (args.rejected) states.push("REJECTED");
    const segmentSnaps = (args.snapResults ?? []).filter((snap) => similarCoordinate(snap.coordinate, from, 5) || similarCoordinate(snap.coordinate, to, 5));
    const snappedToExisting = segmentSnaps.some((snap) => ["EXISTING_BACKBONE", "EXISTING_DUCT", "EXISTING_CONDUIT", "EXISTING_FIBER", "CUSTOMER_TWIN_ROUTE_GEOMETRY"].includes(snap.priority));
    const segmentId = `${args.draftId}:SEG-${String(index).padStart(4, "0")}`;
    const lengthFeet = haversineFeet(from, to);
    segments.push({
      segmentId,
      commercialSegmentId: commercialSegment?.segmentId,
      label: commercialSegment?.label ?? `Engineering segment ${index}`,
      sequence: index,
      fromVertexIndex: index - 1,
      toVertexIndex: index,
      geometry: [cloneCoordinate(from), cloneCoordinate(to)],
      states,
      geometryAuthority: baselineLike ? "OSRM" : "ENGINEERING",
      snapReferences: segmentSnaps,
      intelligence: segmentIntelligence({
        segmentId,
        lengthFeet,
        draft: args.commercialDraft,
        states,
        snappedToExisting,
      }),
    });
  }
  return segments;
}

function snapshotFromGeometry(args: {
  geometry: DALCoordinate[];
  commercialDraft?: CommercialCorridorDraft;
  baseline?: EngineeringFinancialSnapshot;
}) {
  const routeFeet = geometryFeet(args.geometry);
  const routeMiles = round(routeFeet / FEET_PER_MILE, 3);
  const baseline = args.baseline;
  const draft = args.commercialDraft;
  const baseRouteFeet = baseline ? Math.max(1, baseline.routeMiles * FEET_PER_MILE) : Math.max(1, draft?.routeFeet ?? routeFeet);
  const ratio = routeFeet / baseRouteFeet;
  const constructionCost = baseline
    ? money(baseline.constructionCost * ratio)
    : money(draft?.constructionCost ?? routeFeet * 9.25);
  const proposalValue = baseline
    ? money(baseline.proposalValue * ratio)
    : money(draft?.sellPrice ?? constructionCost * 1.18);
  const marginPercent = proposalValue > 0
    ? round(((proposalValue - constructionCost) / proposalValue) * 100, 1)
    : draft?.grossMarginPercent ?? 0;
  const handholes = Math.max(2, Math.ceil(routeFeet / 2500));
  const bores = Math.max(0, Math.round(routeFeet * ((draft?.constructionMix.hddPercent ?? 28) / 100) / 500));
  const spliceCases = Math.max(2, Math.ceil(routeFeet / 10000));
  const attenuationDb = round(routeMiles * 1.609344 * 0.25, 2);
  return {
    routeMiles,
    fiberFootage: Math.round((baseline?.fiberFootage ?? draft?.fiberFeet ?? routeFeet) * ratio),
    ductFootage: Math.round((baseline?.ductFootage ?? draft?.ductFeet ?? routeFeet) * ratio),
    labor: money(constructionCost * 0.46),
    equipment: money(constructionCost * 0.16),
    materials: money(constructionCost * 0.28),
    durationDays: Math.max(1, Math.ceil((baseline?.durationDays ?? draft?.transparentEstimate.controls.targetDurationDays ?? Math.max(1, routeMiles * 3)) * ratio)),
    crewCount: Math.max(1, Math.ceil(routeMiles / 20)),
    marginPercent,
    proposalValue,
    recurringRevenue: money((draft?.transparentEstimate.mrc ?? baseline?.recurringRevenue ?? routeMiles * 100) * ratio),
    commercialReadiness: Math.max(0, Math.min(100, Math.round((baseline?.commercialReadiness ?? draft?.transparentEstimate.commercialReadiness.score ?? 72) - Math.max(0, ratio - 1) * 8))),
    confidence: Math.max(0, Math.min(100, Math.round((baseline?.confidence ?? draft?.transparentEstimate.confidence.score ?? 68) - Math.abs(1 - ratio) * 10))),
    constructionCost,
    handholes,
    bores,
    opticalLossDb: round(attenuationDb + spliceCases * 0.05 + 1, 2),
  } satisfies EngineeringFinancialSnapshot;
}

function subtractSnapshot(a: EngineeringFinancialSnapshot, b: EngineeringFinancialSnapshot): EngineeringFinancialSnapshot {
  return {
    routeMiles: round(a.routeMiles - b.routeMiles, 3),
    fiberFootage: a.fiberFootage - b.fiberFootage,
    ductFootage: a.ductFootage - b.ductFootage,
    labor: a.labor - b.labor,
    equipment: a.equipment - b.equipment,
    materials: a.materials - b.materials,
    durationDays: a.durationDays - b.durationDays,
    crewCount: a.crewCount - b.crewCount,
    marginPercent: round(a.marginPercent - b.marginPercent, 1),
    proposalValue: a.proposalValue - b.proposalValue,
    recurringRevenue: a.recurringRevenue - b.recurringRevenue,
    commercialReadiness: a.commercialReadiness - b.commercialReadiness,
    confidence: a.confidence - b.confidence,
    constructionCost: a.constructionCost - b.constructionCost,
    handholes: a.handholes - b.handholes,
    bores: a.bores - b.bores,
    opticalLossDb: round(a.opticalLossDb - b.opticalLossDb, 2),
  };
}

function signed(value: number, unit = "") {
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}${unit}`;
}

function reasonWithContext(defaultReason: string, editReason?: string) {
  const trimmed = editReason?.trim();
  return trimmed ? `${trimmed}: ${defaultReason}` : defaultReason;
}

function financialDelta(baseline: EngineeringFinancialSnapshot, revision: EngineeringFinancialSnapshot): EngineeringFinancialDelta {
  const difference = subtractSnapshot(revision, baseline);
  return {
    baseline,
    revision,
    difference,
    executiveSummary: [
      `${signed(difference.routeMiles)} miles`,
      `${signed(difference.constructionCost, " USD")} construction cost`,
      `${signed(difference.durationDays)} production days`,
      `${signed(difference.handholes)} handholes`,
      `${signed(difference.bores)} bores`,
      `${signed(difference.opticalLossDb, " dB")} optical loss`,
      `${signed(difference.proposalValue, " USD")} proposal value`,
    ],
  };
}

function opticalPreview(geometry: DALCoordinate[], snapshot: EngineeringFinancialSnapshot): EngineeringOpticalPreview {
  const routeMiles = snapshot.routeMiles;
  const routeKm = routeMiles * 1.609344;
  const spliceLossDb = round(Math.max(2, Math.ceil((routeMiles * FEET_PER_MILE) / 10000)) * 0.05, 2);
  const connectorLossDb = 1;
  const estimatedAttenuationDb = round(routeKm * 0.25, 2);
  const spanCount = Math.max(1, Math.ceil(routeMiles / DEFAULT_ILA_SPACING_MILES));
  const spanMiles = routeMiles / spanCount;
  return {
    totalRouteLossDb: round(estimatedAttenuationDb + spliceLossDb + connectorLossDb, 2),
    connectorLossDb,
    spliceLossDb,
    estimatedAttenuationDb,
    longestSpanMiles: round(spanMiles * 1.08, 2),
    averageSpanMiles: round(spanMiles, 2),
    recommendedIlaSpacingMiles: DEFAULT_ILA_SPACING_MILES,
    estimatedOpticalBudgetDb: round(28 - (estimatedAttenuationDb + spliceLossDb + connectorLossDb), 2),
    engineeringPreviewOnly: true,
  };
}

function geometrySource(args: {
  sourceId: string;
  authority: GeometryAuthorityState;
  label: string;
  geometry: DALCoordinate[];
}): EngineeringGeometrySource {
  return {
    sourceId: args.sourceId,
    authority: args.authority,
    label: args.label,
    geometryHash: engineeringGeometryHash(args.geometry),
    preserved: true,
    createdAt: now(),
  };
}

function createRevision(args: {
  draftId: string;
  revisionNumber: number;
  createdBy: string;
  reason: string;
  geometry: DALCoordinate[];
  baselineGeometry: DALCoordinate[];
  baselineMetrics: EngineeringFinancialSnapshot;
  commercialDraft?: CommercialCorridorDraft;
  parentRevisionId?: string;
  branchOfRevisionId?: string;
  editLog?: EngineeringEditRecord[];
  snapResults?: SnapResult[];
  accepted?: boolean;
  rejected?: boolean;
  status?: EngineeringRevision["status"];
  geometrySources?: EngineeringGeometrySource[];
}): EngineeringRevision {
  const geometry = normalizeGeometry(args.geometry);
  const snapshot = snapshotFromGeometry({ geometry, commercialDraft: args.commercialDraft, baseline: args.baselineMetrics });
  const delta = financialDelta(args.baselineMetrics, snapshot);
  const revisionId = `${args.draftId}:REV-${args.revisionNumber}`;
  const status = args.status ?? (args.accepted ? "ACCEPTED" : args.rejected ? "REJECTED" : "CURRENT");
  return {
    revisionId,
    revisionNumber: args.revisionNumber,
    revisionName: `Engineering Revision ${args.revisionNumber}`,
    status,
    parentRevisionId: args.parentRevisionId,
    branchOfRevisionId: args.branchOfRevisionId,
    createdAt: now(),
    createdBy: args.createdBy,
    reason: args.reason,
    geometry,
    geometryHash: engineeringGeometryHash(geometry),
    segments: buildSegments({
      draftId: args.draftId,
      geometry,
      baselineGeometry: args.baselineGeometry,
      commercialDraft: args.commercialDraft,
      snapResults: args.snapResults,
      accepted: args.accepted,
      rejected: args.rejected,
    }),
    editLog: args.editLog ?? [],
    delta,
    opticalPreview: opticalPreview(geometry, snapshot),
    geometrySources: args.geometrySources ?? [
      geometrySource({ sourceId: `${revisionId}:COMMERCIAL`, authority: "COMMERCIAL", label: "Commercial baseline", geometry: args.baselineGeometry }),
      geometrySource({ sourceId: `${revisionId}:ENGINEERING`, authority: "ENGINEERING", label: `Engineering revision ${args.revisionNumber}`, geometry }),
    ],
  };
}

function firstAndLast(geometry: DALCoordinate[]) {
  return {
    first: geometry[0],
    last: geometry[geometry.length - 1],
  };
}

export function createEngineeringDraftFromCommercialDraft(args: {
  commercialDraft: CommercialCorridorDraft;
  createdBy?: string;
  parentScopeVersionId?: string;
  rootScopeVersionId?: string;
  extraSnapCandidates?: SnapCandidate[];
}): RouteEngineeringDraft {
  const baselineGeometry = normalizeGeometry(args.commercialDraft.geometry);
  const baselineMetrics = snapshotFromGeometry({ geometry: baselineGeometry, commercialDraft: args.commercialDraft });
  const engineeringDraftId = `ENG-DRAFT-${args.commercialDraft.routeId}`;
  const snapCandidates = buildSnapCandidates({ baselineGeometry, extraCandidates: args.extraSnapCandidates });
  const revision = createRevision({
    draftId: engineeringDraftId,
    revisionNumber: 1,
    createdBy: args.createdBy ?? "Route Engineering",
    reason: "Engineering Draft created from immutable Commercial Baseline.",
    geometry: baselineGeometry,
    baselineGeometry,
    baselineMetrics,
    commercialDraft: args.commercialDraft,
    snapResults: baselineGeometry.map((coordinate) => snapEngineeringCoordinate({ coordinate, candidates: snapCandidates })),
  });
  return {
    engineeringDraftId,
    commercialDraftId: args.commercialDraft.candidateId,
    commercialRouteId: args.commercialDraft.routeId,
    commercialBaselineSource: "COMMERCIAL_CORRIDOR_DRAFT",
    commercialBaselineGeometry: baselineGeometry,
    commercialBaselineGeometryHash: engineeringGeometryHash(baselineGeometry),
    commercialBaselineMetrics: baselineMetrics,
    commercialDraft: args.commercialDraft,
    scopeVersionLineage: {
      commercialDraftId: args.commercialDraft.candidateId,
      engineeringDraftId,
      parentScopeVersionId: args.parentScopeVersionId,
      rootScopeVersionId: args.rootScopeVersionId,
      note: "Commercial Draft and Engineering Draft remain separate records in the same future ScopeVersion lineage.",
    },
    currentRevisionId: revision.revisionId,
    revisions: [revision],
    snapCandidates,
    layerVisibility: { ...DEFAULT_LAYER_VISIBILITY },
    noScopeVersionCreation: true,
    noInventoryMutation: true,
  };
}

export function createEngineeringDraftFromRoute(args: {
  routeId: string;
  label: string;
  geometry: DALCoordinate[];
  createdBy?: string;
  baselineSource?: RouteEngineeringDraft["commercialBaselineSource"];
  extraSnapCandidates?: SnapCandidate[];
}): RouteEngineeringDraft {
  const baselineGeometry = normalizeGeometry(args.geometry);
  const baselineMetrics = snapshotFromGeometry({ geometry: baselineGeometry });
  const engineeringDraftId = `ENG-DRAFT-${args.routeId}`;
  const snapCandidates = buildSnapCandidates({ baselineGeometry, extraCandidates: args.extraSnapCandidates });
  const revision = createRevision({
    draftId: engineeringDraftId,
    revisionNumber: 1,
    createdBy: args.createdBy ?? "Route Engineering",
    reason: "Engineering Draft created from selected route geometry.",
    geometry: baselineGeometry,
    baselineGeometry,
    baselineMetrics,
    snapResults: baselineGeometry.map((coordinate) => snapEngineeringCoordinate({ coordinate, candidates: snapCandidates })),
  });
  return {
    engineeringDraftId,
    commercialDraftId: args.routeId,
    commercialRouteId: args.routeId,
    commercialBaselineSource: args.baselineSource ?? "CERTIFIED_ROUTE_SELECTION",
    commercialBaselineGeometry: baselineGeometry,
    commercialBaselineGeometryHash: engineeringGeometryHash(baselineGeometry),
    commercialBaselineMetrics: baselineMetrics,
    scopeVersionLineage: {
      commercialDraftId: args.routeId,
      engineeringDraftId,
      note: `${args.label} is treated as an immutable commercial baseline for engineering edit history.`,
    },
    currentRevisionId: revision.revisionId,
    revisions: [revision],
    snapCandidates,
    layerVisibility: { ...DEFAULT_LAYER_VISIBILITY },
    noScopeVersionCreation: true,
    noInventoryMutation: true,
  };
}

export function currentEngineeringRevision(draft: RouteEngineeringDraft | null | undefined) {
  if (!draft) return null;
  return draft.revisions.find((revision) => revision.revisionId === draft.currentRevisionId) ?? draft.revisions.at(-1) ?? null;
}

function currentGeometry(draft: RouteEngineeringDraft) {
  return cloneGeometry(currentEngineeringRevision(draft)?.geometry ?? draft.commercialBaselineGeometry);
}

function segmentIndexForId(revision: EngineeringRevision, segmentId: string | undefined) {
  if (!segmentId) return -1;
  return revision.segments.findIndex((segment) => segment.segmentId === segmentId);
}

function changedVertexIndex(previous: DALCoordinate[], next: DALCoordinate[]) {
  const limit = Math.min(previous.length, next.length);
  for (let index = 0; index < limit; index += 1) {
    if (haversineFeet(previous[index], next[index]) > 1) return index;
  }
  return -1;
}

function nextRevisionNumber(draft: RouteEngineeringDraft) {
  return Math.max(0, ...draft.revisions.map((revision) => revision.revisionNumber)) + 1;
}

function commitRevision(args: {
  draft: RouteEngineeringDraft;
  geometry: DALCoordinate[];
  editType: EngineeringEditType;
  actor: string;
  reason: string;
  segmentId?: string;
  vertexIndex?: number;
  snapResult?: SnapResult | null;
  parentRevision?: EngineeringRevision;
  branchOfRevisionId?: string;
  makeCurrent?: boolean;
  revisionStatus?: EngineeringRevision["status"];
}) {
  const parentRevision = args.parentRevision ?? currentEngineeringRevision(args.draft);
  const makeCurrent = args.makeCurrent ?? true;
  const previousHash = parentRevision?.geometryHash ?? args.draft.commercialBaselineGeometryHash;
  const revisionNumber = nextRevisionNumber(args.draft);
  const nextHash = engineeringGeometryHash(args.geometry);
  const snapshot = snapshotFromGeometry({ geometry: args.geometry, commercialDraft: args.draft.commercialDraft, baseline: args.draft.commercialBaselineMetrics });
  const delta = financialDelta(args.draft.commercialBaselineMetrics, snapshot);
  const edit: EngineeringEditRecord = {
    editId: createId("ENG-EDIT"),
    editType: args.editType,
    segmentId: args.segmentId,
    vertexIndex: args.vertexIndex,
    actor: args.actor,
    reason: args.reason,
    createdAt: now(),
    fromGeometryHash: previousHash,
    toGeometryHash: nextHash,
    snapResult: args.snapResult ?? null,
    financialDelta: delta,
  };
  const snapCandidates = buildSnapCandidates({
    baselineGeometry: args.draft.commercialBaselineGeometry,
    revisionGeometry: args.geometry,
    extraCandidates: args.draft.snapCandidates.filter((candidate) => !candidate.candidateId.startsWith("OSRM_BASELINE") && !candidate.candidateId.startsWith("ENGINEERING_REVISION")),
  });
  const revision = createRevision({
    draftId: args.draft.engineeringDraftId,
    revisionNumber,
    createdBy: args.actor,
    reason: args.reason,
    geometry: args.geometry,
    baselineGeometry: args.draft.commercialBaselineGeometry,
    baselineMetrics: args.draft.commercialBaselineMetrics,
    commercialDraft: args.draft.commercialDraft,
    parentRevisionId: parentRevision?.revisionId,
    branchOfRevisionId: args.branchOfRevisionId,
    editLog: [...(parentRevision?.editLog ?? []), edit],
    snapResults: args.snapResult ? [args.snapResult] : [],
    status: args.revisionStatus ?? (makeCurrent ? undefined : "BRANCHED"),
  });
  return {
    ...args.draft,
    currentRevisionId: makeCurrent ? revision.revisionId : args.draft.currentRevisionId,
    revisions: [
      ...args.draft.revisions.map((candidate) => (
        makeCurrent && candidate.status === "CURRENT" ? { ...candidate, status: "SUPERSEDED" as const } : candidate
      )),
      revision,
    ],
    snapCandidates,
  };
}

export function applyGeometryChangeAsRevision(draft: RouteEngineeringDraft, nextGeometry: DALCoordinate[], actor = "Route Engineering", editReason?: string) {
  const previousGeometry = currentGeometry(draft);
  const vertexIndex = changedVertexIndex(previousGeometry, nextGeometry);
  if (vertexIndex < 0) return draft;
  const candidates = buildSnapCandidates({
    baselineGeometry: draft.commercialBaselineGeometry,
    revisionGeometry: previousGeometry,
    extraCandidates: draft.snapCandidates,
  });
  const snapResult = snapEngineeringCoordinate({ coordinate: nextGeometry[vertexIndex], candidates });
  const snappedGeometry = cloneGeometry(previousGeometry);
  snappedGeometry[vertexIndex] = snapResult.coordinate;
  return commitRevision({
    draft,
    geometry: snappedGeometry,
    editType: "MOVE_VERTEX",
    actor,
    reason: reasonWithContext(`Moved vertex ${vertexIndex + 1}; snap priority ${snapResult.priority}.`, editReason),
    vertexIndex,
    segmentId: currentEngineeringRevision(draft)?.segments.find((segment) => segment.fromVertexIndex === vertexIndex || segment.toVertexIndex === vertexIndex)?.segmentId,
    snapResult,
  });
}

export function applySegmentGeometryChangeAsRevision(
  draft: RouteEngineeringDraft,
  segmentIndex: number,
  nextGeometry: DALCoordinate[],
  actor = "Route Engineering",
  editReason?: string,
) {
  const revision = currentEngineeringRevision(draft);
  if (!revision) return draft;
  const segment = revision.segments[segmentIndex];
  if (!segment) return draft;
  const geometry = currentGeometry(draft);
  const proposedGeometry = normalizeGeometry(nextGeometry);
  const proposedFrom = proposedGeometry[segment.fromVertexIndex];
  const proposedTo = proposedGeometry[segment.toVertexIndex];
  if (!proposedFrom || !proposedTo) return draft;
  const candidates = buildSnapCandidates({ baselineGeometry: draft.commercialBaselineGeometry, revisionGeometry: geometry, extraCandidates: draft.snapCandidates });
  const snapA = snapEngineeringCoordinate({ coordinate: proposedFrom, candidates });
  const snapB = snapEngineeringCoordinate({ coordinate: proposedTo, candidates });
  geometry[segment.fromVertexIndex] = snapA.coordinate;
  geometry[segment.toVertexIndex] = snapB.coordinate;
  return commitRevision({
    draft,
    geometry,
    editType: "MOVE_SEGMENT",
    actor,
    reason: reasonWithContext(`Moved ${segment.label} from midpoint handle; both vertices snapped.`, editReason),
    segmentId: segment.segmentId,
    snapResult: snapB,
  });
}

export function moveEngineeringVertex(draft: RouteEngineeringDraft, vertexIndex: number, target: DALCoordinate, actor = "Route Engineering", editReason?: string) {
  const geometry = currentGeometry(draft);
  if (vertexIndex < 0 || vertexIndex >= geometry.length) return draft;
  const candidates = buildSnapCandidates({ baselineGeometry: draft.commercialBaselineGeometry, revisionGeometry: geometry, extraCandidates: draft.snapCandidates });
  const snapResult = snapEngineeringCoordinate({ coordinate: target, candidates });
  geometry[vertexIndex] = snapResult.coordinate;
  return commitRevision({
    draft,
    geometry,
    editType: "MOVE_VERTEX",
    actor,
    reason: reasonWithContext(`Moved vertex ${vertexIndex + 1}; snap priority ${snapResult.priority}.`, editReason),
    vertexIndex,
    snapResult,
  });
}

export function moveEngineeringSegment(draft: RouteEngineeringDraft, segmentId: string, delta: { lng: number; lat: number }, actor = "Route Engineering", editReason?: string) {
  const revision = currentEngineeringRevision(draft);
  if (!revision) return draft;
  const segmentIndex = segmentIndexForId(revision, segmentId);
  const segment = revision.segments[segmentIndex];
  if (!segment) return draft;
  const geometry = currentGeometry(draft);
  const candidates = buildSnapCandidates({ baselineGeometry: draft.commercialBaselineGeometry, revisionGeometry: geometry, extraCandidates: draft.snapCandidates });
  const movedA: DALCoordinate = [geometry[segment.fromVertexIndex][0] + delta.lng, geometry[segment.fromVertexIndex][1] + delta.lat];
  const movedB: DALCoordinate = [geometry[segment.toVertexIndex][0] + delta.lng, geometry[segment.toVertexIndex][1] + delta.lat];
  const snapA = snapEngineeringCoordinate({ coordinate: movedA, candidates });
  const snapB = snapEngineeringCoordinate({ coordinate: movedB, candidates });
  geometry[segment.fromVertexIndex] = snapA.coordinate;
  geometry[segment.toVertexIndex] = snapB.coordinate;
  return commitRevision({
    draft,
    geometry,
    editType: "MOVE_SEGMENT",
    actor,
    reason: reasonWithContext(`Moved ${segment.label}; both vertices snapped.`, editReason),
    segmentId,
    snapResult: snapB,
  });
}

function midpoint(a: DALCoordinate, b: DALCoordinate): DALCoordinate {
  return [round((a[0] + b[0]) / 2, 7), round((a[1] + b[1]) / 2, 7)];
}

function bendPoint(a: DALCoordinate, b: DALCoordinate, magnitude = 0.01): DALCoordinate {
  const mid = midpoint(a, b);
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const length = Math.hypot(dx, dy) || 1;
  return [round(mid[0] - (dy / length) * magnitude, 7), round(mid[1] + (dx / length) * magnitude, 7)];
}

export function insertEngineeringWaypoint(
  draft: RouteEngineeringDraft,
  segmentId: string,
  target?: DALCoordinate,
  actor = "Route Engineering",
  editType: EngineeringEditType = "INSERT_WAYPOINT",
  editReason?: string,
) {
  const revision = currentEngineeringRevision(draft);
  if (!revision) return draft;
  const segment = revision.segments[segmentIndexForId(revision, segmentId)];
  if (!segment) return draft;
  const geometry = currentGeometry(draft);
  const candidates = buildSnapCandidates({ baselineGeometry: draft.commercialBaselineGeometry, revisionGeometry: geometry, extraCandidates: draft.snapCandidates });
  const targetCoordinate = target ?? midpoint(geometry[segment.fromVertexIndex], geometry[segment.toVertexIndex]);
  const snapResult = snapEngineeringCoordinate({ coordinate: targetCoordinate, candidates });
  geometry.splice(segment.toVertexIndex, 0, snapResult.coordinate);
  return commitRevision({
    draft,
    geometry,
    editType,
    actor,
    reason: reasonWithContext(`${editType.replaceAll("_", " ")} on ${segment.label}; waypoint snapped to ${snapResult.priority}.`, editReason),
    segmentId,
    vertexIndex: segment.toVertexIndex,
    snapResult,
  });
}

export function removeEngineeringWaypoint(draft: RouteEngineeringDraft, vertexIndex: number, actor = "Route Engineering", editReason?: string) {
  const geometry = currentGeometry(draft);
  if (geometry.length <= 2 || vertexIndex <= 0 || vertexIndex >= geometry.length - 1) return draft;
  geometry.splice(vertexIndex, 1);
  return commitRevision({
    draft,
    geometry,
    editType: "REMOVE_WAYPOINT",
    actor,
    reason: reasonWithContext(`Removed waypoint ${vertexIndex + 1}.`, editReason),
    vertexIndex,
  });
}

export function mergeEngineeringSegments(draft: RouteEngineeringDraft, segmentId: string, actor = "Route Engineering", editReason?: string) {
  const revision = currentEngineeringRevision(draft);
  if (!revision) return draft;
  const segment = revision.segments[segmentIndexForId(revision, segmentId)];
  if (!segment) return draft;
  return removeEngineeringWaypoint(draft, segment.toVertexIndex, actor, editReason);
}

export function replaceEngineeringSegment(draft: RouteEngineeringDraft, segmentId: string, actor = "Route Engineering", editReason?: string) {
  const revision = currentEngineeringRevision(draft);
  if (!revision) return draft;
  const segment = revision.segments[segmentIndexForId(revision, segmentId)];
  if (!segment) return draft;
  return insertEngineeringWaypoint(draft, segmentId, bendPoint(segment.geometry[0], segment.geometry[1]), actor, "REPLACE_SEGMENT", editReason);
}

export function regenerateEngineeringSegment(draft: RouteEngineeringDraft, segmentId: string, actor = "Route Engineering", editReason?: string) {
  const revision = currentEngineeringRevision(draft);
  if (!revision) return draft;
  const segment = revision.segments[segmentIndexForId(revision, segmentId)];
  if (!segment) return draft;
  const geometry = currentGeometry(draft);
  const baselineFrom = draft.commercialBaselineGeometry[segment.fromVertexIndex];
  const baselineTo = draft.commercialBaselineGeometry[segment.toVertexIndex];
  if (!baselineFrom || !baselineTo) return draft;
  geometry[segment.fromVertexIndex] = cloneCoordinate(baselineFrom);
  geometry[segment.toVertexIndex] = cloneCoordinate(baselineTo);
  return commitRevision({
    draft,
    geometry,
    editType: "REGENERATE_SEGMENT",
    actor,
    reason: reasonWithContext(`Regenerated ${segment.label} from preserved OSRM commercial baseline.`, editReason),
    segmentId,
  });
}

export function restoreEngineeringSegment(draft: RouteEngineeringDraft, segmentId: string, actor = "Route Engineering", editReason?: string) {
  const revision = currentEngineeringRevision(draft);
  if (!revision) return draft;
  const segment = revision.segments[segmentIndexForId(revision, segmentId)];
  if (!segment) return draft;
  const geometry = currentGeometry(draft);
  const baselineFrom = draft.commercialBaselineGeometry[segment.fromVertexIndex];
  const baselineTo = draft.commercialBaselineGeometry[segment.toVertexIndex];
  if (!baselineFrom || !baselineTo) return draft;
  geometry[segment.fromVertexIndex] = cloneCoordinate(baselineFrom);
  geometry[segment.toVertexIndex] = cloneCoordinate(baselineTo);
  return commitRevision({
    draft,
    geometry,
    editType: "RESTORE_SEGMENT",
    actor,
    reason: reasonWithContext(`Restored ${segment.label} from immutable Commercial Baseline.`, editReason),
    segmentId,
  });
}

export function regenerateEngineeringCorridor(draft: RouteEngineeringDraft, actor = "Route Engineering", editReason?: string) {
  return commitRevision({
    draft,
    geometry: cloneGeometry(draft.commercialBaselineGeometry),
    editType: "REGENERATE_CORRIDOR",
    actor,
    reason: reasonWithContext("Regenerated entire Engineering Revision from immutable Commercial Baseline.", editReason),
  });
}

export function createEngineeringPreviewForGeometry(draft: RouteEngineeringDraft, geometry: DALCoordinate[]) {
  const normalizedGeometry = normalizeGeometry(geometry);
  const snapshot = snapshotFromGeometry({
    geometry: normalizedGeometry,
    commercialDraft: draft.commercialDraft,
    baseline: draft.commercialBaselineMetrics,
  });
  return {
    geometry: normalizedGeometry,
    geometryHash: engineeringGeometryHash(normalizedGeometry),
    snapshot,
    delta: financialDelta(draft.commercialBaselineMetrics, snapshot),
    opticalPreview: opticalPreview(normalizedGeometry, snapshot),
  };
}

export function createCorridorCandidateRevision(
  draft: RouteEngineeringDraft,
  geometry: DALCoordinate[],
  actor = "Sales Engineering",
  editReason?: string,
) {
  const candidate = normalizeGeometry(geometry);
  const baselineStart = draft.commercialBaselineGeometry[0];
  const baselineEnd = draft.commercialBaselineGeometry.at(-1);
  if (candidate.length < 2 || !baselineStart || !baselineEnd) return draft;
  candidate[0] = cloneCoordinate(baselineStart);
  candidate[candidate.length - 1] = cloneCoordinate(baselineEnd);
  return commitRevision({
    draft,
    geometry: candidate,
    editType: "REGENERATE_CORRIDOR",
    actor,
    reason: reasonWithContext("Corridor candidate generated with fixed A/Z endpoints from the immutable Commercial Baseline.", editReason),
  });
}

export function saveCorridorCandidateRevision(
  draft: RouteEngineeringDraft,
  geometry: DALCoordinate[],
  actor = "Sales Engineering",
  editReason?: string,
) {
  const candidate = normalizeGeometry(geometry);
  const baselineStart = draft.commercialBaselineGeometry[0];
  const baselineEnd = draft.commercialBaselineGeometry.at(-1);
  if (candidate.length < 2 || !baselineStart || !baselineEnd) return draft;
  candidate[0] = cloneCoordinate(baselineStart);
  candidate[candidate.length - 1] = cloneCoordinate(baselineEnd);
  return commitRevision({
    draft,
    geometry: candidate,
    editType: "REGENERATE_CORRIDOR",
    actor,
    reason: reasonWithContext("Corridor candidate saved for comparison with fixed A/Z endpoints; it is not current until promoted.", editReason),
    makeCurrent: false,
    revisionStatus: "BRANCHED",
  });
}

export function restoreEngineeringRevision(draft: RouteEngineeringDraft, revisionId: string, actor = "Route Engineering", editReason?: string) {
  const revision = draft.revisions.find((candidate) => candidate.revisionId === revisionId);
  if (!revision) return draft;
  return commitRevision({
    draft,
    geometry: cloneGeometry(revision.geometry),
    editType: "REGENERATE_CORRIDOR",
    actor,
    reason: reasonWithContext(`Restored ${revision.revisionName}.`, editReason),
    parentRevision: revision,
  });
}

export function branchEngineeringRevision(draft: RouteEngineeringDraft, revisionId: string, actor = "Route Engineering", editReason?: string) {
  const revision = draft.revisions.find((candidate) => candidate.revisionId === revisionId);
  if (!revision) return draft;
  return commitRevision({
    draft,
    geometry: cloneGeometry(revision.geometry),
    editType: "REGENERATE_CORRIDOR",
    actor,
    reason: reasonWithContext(`Branched from ${revision.revisionName}.`, editReason),
    parentRevision: revision,
    branchOfRevisionId: revision.revisionId,
  });
}

function commitSegmentStateRevision(args: {
  draft: RouteEngineeringDraft;
  segmentId: string;
  editType: EngineeringEditType;
  actor: string;
  reason: string;
  addState?: EngineeringSegmentState;
}) {
  const parentRevision = currentEngineeringRevision(args.draft);
  if (!parentRevision) return args.draft;
  const segment = parentRevision.segments.find((candidate) => candidate.segmentId === args.segmentId);
  if (!segment) return args.draft;
  const revisionNumber = nextRevisionNumber(args.draft);
  const revisionId = `${args.draft.engineeringDraftId}:REV-${revisionNumber}`;
  const edit: EngineeringEditRecord = {
    editId: createId("ENG-EDIT"),
    editType: args.editType,
    segmentId: args.segmentId,
    actor: args.actor,
    reason: args.reason,
    createdAt: now(),
    fromGeometryHash: parentRevision.geometryHash,
    toGeometryHash: parentRevision.geometryHash,
    snapResult: null,
    financialDelta: parentRevision.delta,
  };
  const revision: EngineeringRevision = {
    ...parentRevision,
    revisionId,
    revisionNumber,
    revisionName: `Engineering Revision ${revisionNumber}`,
    status: "CURRENT",
    parentRevisionId: parentRevision.revisionId,
    branchOfRevisionId: undefined,
    createdAt: now(),
    createdBy: args.actor,
    reason: args.reason,
    editLog: [...parentRevision.editLog, edit],
    segments: parentRevision.segments.map((candidate) => (
      candidate.segmentId === args.segmentId && args.addState
        ? { ...candidate, states: Array.from(new Set([...candidate.states, args.addState])) }
        : candidate
    )),
  };
  return {
    ...args.draft,
    currentRevisionId: revision.revisionId,
    revisions: [
      ...args.draft.revisions.map((candidate) => (
        candidate.status === "CURRENT" ? { ...candidate, status: "SUPERSEDED" as const } : candidate
      )),
      revision,
    ],
  };
}

export function lockEngineeringSegment(draft: RouteEngineeringDraft, segmentId: string, actor = "Route Engineering", editReason?: string) {
  return commitSegmentStateRevision({
    draft,
    segmentId,
    editType: "LOCK_SEGMENT",
    actor,
    reason: reasonWithContext("Locked selected segment for construction-sensitive review.", editReason),
    addState: "CONSTRUCTION_LOCKED",
  });
}

export function acceptEngineeringSegment(draft: RouteEngineeringDraft, segmentId: string, actor = "Route Engineering", editReason?: string) {
  return commitSegmentStateRevision({
    draft,
    segmentId,
    editType: "ACCEPT_SEGMENT",
    actor,
    reason: reasonWithContext("Accepted selected segment in the active Engineering Revision.", editReason),
    addState: "ACCEPTED",
  });
}

export function rejectEngineeringSegment(draft: RouteEngineeringDraft, segmentId: string, actor = "Route Engineering", editReason?: string) {
  return commitSegmentStateRevision({
    draft,
    segmentId,
    editType: "REJECT_SEGMENT",
    actor,
    reason: reasonWithContext("Rejected selected segment in the active Engineering Revision.", editReason),
    addState: "REJECTED",
  });
}

export function recordEngineeringSegmentReason(draft: RouteEngineeringDraft, segmentId: string, actor = "Route Engineering", editReason?: string) {
  return commitSegmentStateRevision({
    draft,
    segmentId,
    editType: "ADD_EDIT_REASON",
    actor,
    reason: reasonWithContext("Recorded engineering edit reason on selected segment.", editReason),
  });
}

export function acceptEngineeringRevision(draft: RouteEngineeringDraft, revisionId: string) {
  return {
    ...draft,
    acceptedRevisionId: revisionId,
    revisions: draft.revisions.map((revision) => (
      revision.revisionId === revisionId
        ? {
            ...revision,
            status: "ACCEPTED" as const,
            segments: revision.segments.map((segment) => ({
              ...segment,
              states: Array.from(new Set([...segment.states, "ACCEPTED" as const])),
            })),
          }
        : revision.status === "ACCEPTED"
          ? { ...revision, status: "SUPERSEDED" as const }
          : revision
    )),
  };
}

export function rejectEngineeringRevision(draft: RouteEngineeringDraft, revisionId: string) {
  const nextRevisions = draft.revisions.map((revision) => (
    revision.revisionId === revisionId
      ? {
          ...revision,
          status: "REJECTED" as const,
          segments: revision.segments.map((segment) => ({
            ...segment,
            states: Array.from(new Set([...segment.states, "REJECTED" as const])),
          })),
        }
      : revision
  ));
  const currentStillValid = nextRevisions.some((revision) => revision.revisionId === draft.currentRevisionId && revision.status !== "REJECTED");
  const fallback = [...nextRevisions].reverse().find((revision) => revision.status !== "REJECTED") ?? nextRevisions[0];
  return {
    ...draft,
    acceptedRevisionId: draft.acceptedRevisionId === revisionId ? undefined : draft.acceptedRevisionId,
    currentRevisionId: currentStillValid ? draft.currentRevisionId : fallback.revisionId,
    revisions: nextRevisions,
  };
}

export function setEngineeringLayerVisibility(draft: RouteEngineeringDraft, layerId: EngineeringLayerId, visible: boolean): RouteEngineeringDraft {
  return {
    ...draft,
    layerVisibility: {
      ...draft.layerVisibility,
      [layerId]: visible,
    },
  };
}

export function geometryEndpoints(geometry: DALCoordinate[]) {
  const { first, last } = firstAndLast(geometry);
  return { first, last };
}
