import { haversineFeet } from "../affinity/geo";
import { routeCommercialCorridorWithOsrm, type CommercialRouteRequest } from "../commercial/CommercialOsrmRoutingEngine";
import type { DALCoordinate } from "../types/dal";
import { createEngineeringPreviewForGeometry, currentEngineeringRevision, engineeringGeometryHash } from "./RouteEngineeringDraftEngine";
import type { EngineeringFinancialSnapshot, EngineeringRevision, RouteEngineeringDraft } from "./RouteEngineeringDraft";

export type CorridorCandidateType =
  | "SHORTEST_PATH"
  | "FASTEST_ROAD_PATH"
  | "DIVERSE_FROM_BASELINE"
  | "PREFER_HIGHWAY"
  | "USER_WAYPOINT"
  | "AVOID_AREA"
  | "LOW_COST_HEURISTIC"
  | "LOW_RISK_HEURISTIC";

export type CorridorCandidateSource =
  | "OSRM"
  | "OSRM_BASELINE"
  | "HEURISTIC_OSRM_INPUT"
  | "USER_WAYPOINT"
  | "SYNTHESIS_PLACEHOLDER";

export type CorridorCandidateHintType = "WAYPOINT" | "AVOID_AREA" | "PREFER_CORRIDOR";

export interface CorridorCandidateHint {
  hintId: string;
  type: CorridorCandidateHintType;
  label: string;
  coordinate?: DALCoordinate;
  heuristic: boolean;
}

export interface CorridorCandidate {
  candidateId: string;
  candidateType: CorridorCandidateType;
  name: string;
  source: CorridorCandidateSource;
  sourceLabel: string;
  geometry: DALCoordinate[];
  geometryHash: string;
  waypoints: DALCoordinate[];
  hints: CorridorCandidateHint[];
  routeMiles: number;
  constructionCost: number;
  labor: number;
  materials: number;
  equipment: number;
  durationDays: number;
  marginPercent: number;
  opticalLossDb: number;
  deltaRouteMiles: number;
  deltaConstructionCost: number;
  deltaDurationDays: number;
  deltaOpticalLossDb: number;
  diversityScore: number;
  confidence: number;
  unknownCount: number;
  osrmVertexCount: number;
  generatedAt: string;
  explanation: string;
  diagnostics: string[];
}

export interface CorridorCandidateFailure {
  name: string;
  candidateType: CorridorCandidateType;
  failureReason: string;
  diagnostics: string[];
}

export interface CorridorCandidateSet {
  candidates: CorridorCandidate[];
  failures: CorridorCandidateFailure[];
}

const FEET_PER_MILE = 5280;

function cloneCoordinate(coordinate: DALCoordinate): DALCoordinate {
  return [Number(coordinate[0]), Number(coordinate[1])];
}

function cloneGeometry(geometry: DALCoordinate[]) {
  return geometry.map(cloneCoordinate);
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

function routeFeet(geometry: DALCoordinate[]) {
  let feet = 0;
  for (let index = 1; index < geometry.length; index += 1) feet += haversineFeet(geometry[index - 1], geometry[index]);
  return feet;
}

function round(value: number, places = 2) {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

function signed(value: number, unit = "") {
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}${unit}`;
}

function money(value: number) {
  return Number(value || 0).toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function midpoint(geometry: DALCoordinate[]) {
  if (geometry.length < 2) return null;
  return cloneCoordinate(geometry[Math.max(1, Math.floor(geometry.length / 2))] ?? geometry[0]);
}

function corridorOffsetDegrees(geometry: DALCoordinate[]) {
  const first = geometry[0];
  const last = geometry.at(-1);
  if (!first || !last) return 0.04;
  const span = Math.max(Math.abs(first[0] - last[0]), Math.abs(first[1] - last[1]));
  return Math.max(0.025, Math.min(0.18, span * 0.22));
}

function offsetCoordinate(coordinate: DALCoordinate, direction: "N" | "S" | "E" | "W", distance: number): DALCoordinate {
  const offset = {
    N: [0, distance],
    S: [0, -distance],
    E: [distance, 0],
    W: [-distance, 0],
  }[direction];
  return [coordinate[0] + offset[0], coordinate[1] + offset[1]];
}

function toRequestPoint(coordinate: DALCoordinate, label: string): CommercialRouteRequest["from"] {
  return {
    latitude: coordinate[1],
    longitude: coordinate[0],
    source: "A_LOCATION",
    label,
  };
}

function sourceLabel(source: CorridorCandidateSource) {
  if (source === "OSRM") return "OSRM";
  if (source === "OSRM_BASELINE") return "Commercial OSRM baseline";
  if (source === "USER_WAYPOINT") return "User waypoint / OSRM";
  if (source === "HEURISTIC_OSRM_INPUT") return "Heuristic waypoint / OSRM";
  return "Synthesis placeholder";
}

function constraintsUnknownCount(revision: EngineeringRevision | null) {
  if (!revision) return 0;
  return revision.segments.reduce((total, segment) => {
    const values = Object.values(segment.intelligence) as Array<{ authorityMode?: unknown; value?: unknown }>;
    return total + values.filter((value) => value.authorityMode === "UNKNOWN" || value.value === null).length;
  }, 0);
}

function diversityScore(geometry: DALCoordinate[], baseline: DALCoordinate[]) {
  if (geometry.length < 2 || baseline.length < 2) return 0;
  const sampleCount = Math.min(20, geometry.length, baseline.length);
  let offsetFeet = 0;
  for (let index = 0; index < sampleCount; index += 1) {
    const geometryIndex = Math.floor((index / Math.max(1, sampleCount - 1)) * (geometry.length - 1));
    const baselineIndex = Math.floor((index / Math.max(1, sampleCount - 1)) * (baseline.length - 1));
    offsetFeet += haversineFeet(geometry[geometryIndex], baseline[baselineIndex]);
  }
  const averageOffsetFeet = offsetFeet / sampleCount;
  const routeDeltaMiles = Math.abs(routeFeet(geometry) - routeFeet(baseline)) / FEET_PER_MILE;
  return Math.max(0, Math.min(100, Math.round(averageOffsetFeet / 400 + routeDeltaMiles * 4)));
}

function candidateId(args: { draft: RouteEngineeringDraft; type: CorridorCandidateType; name: string; geometry: DALCoordinate[] }) {
  return `${args.draft.engineeringDraftId}:CAND:${args.type}:${engineeringGeometryHash(args.geometry)}:${args.name}`
    .replace(/[^a-zA-Z0-9:-]+/g, "-")
    .slice(0, 180);
}

function explanation(args: {
  candidate: Pick<CorridorCandidate, "name" | "sourceLabel" | "deltaRouteMiles" | "deltaConstructionCost" | "deltaOpticalLossDb" | "diversityScore" | "confidence" | "unknownCount">;
}) {
  const routeVerb = args.candidate.deltaRouteMiles > 0 ? "increases" : args.candidate.deltaRouteMiles < 0 ? "decreases" : "holds";
  return (
    `${args.candidate.name} preserves the fixed A/Z endpoints and uses ${args.candidate.sourceLabel}. ` +
    `It ${routeVerb} route length by ${Math.abs(args.candidate.deltaRouteMiles).toLocaleString(undefined, { maximumFractionDigits: 2 })} miles, ` +
    `changes construction cost by ${signed(args.candidate.deltaConstructionCost, " USD")}, and changes optical loss by ${signed(args.candidate.deltaOpticalLossDb, " dB")}. ` +
    `Diversity score is ${args.candidate.diversityScore}/100 with ${args.candidate.confidence}% confidence and ${args.candidate.unknownCount.toLocaleString()} unresolved unknowns.`
  );
}

function createCandidateFromGeometry(args: {
  draft: RouteEngineeringDraft;
  type: CorridorCandidateType;
  name: string;
  source: CorridorCandidateSource;
  geometry: DALCoordinate[];
  waypoints?: DALCoordinate[];
  hints?: CorridorCandidateHint[];
  diagnostics?: string[];
}) {
  const baselineStart = args.draft.commercialBaselineGeometry[0];
  const baselineEnd = args.draft.commercialBaselineGeometry.at(-1);
  const geometry = cloneGeometry(args.geometry).filter(validCoordinate);
  if (geometry.length < 2 || !baselineStart || !baselineEnd) return null;
  geometry[0] = cloneCoordinate(baselineStart);
  geometry[geometry.length - 1] = cloneCoordinate(baselineEnd);
  const preview = createEngineeringPreviewForGeometry(args.draft, geometry);
  const unknownCount = constraintsUnknownCount(currentEngineeringRevision(args.draft));
  const candidateCore = {
    candidateId: candidateId({ draft: args.draft, type: args.type, name: args.name, geometry }),
    candidateType: args.type,
    name: args.name,
    source: args.source,
    sourceLabel: sourceLabel(args.source),
    geometry,
    geometryHash: preview.geometryHash,
    waypoints: (args.waypoints ?? []).map(cloneCoordinate),
    hints: args.hints ?? [],
    routeMiles: preview.snapshot.routeMiles,
    constructionCost: preview.snapshot.constructionCost,
    labor: preview.snapshot.labor,
    materials: preview.snapshot.materials,
    equipment: preview.snapshot.equipment,
    durationDays: preview.snapshot.durationDays,
    marginPercent: preview.snapshot.marginPercent,
    opticalLossDb: preview.opticalPreview.totalRouteLossDb,
    deltaRouteMiles: preview.delta.difference.routeMiles,
    deltaConstructionCost: preview.delta.difference.constructionCost,
    deltaDurationDays: preview.delta.difference.durationDays,
    deltaOpticalLossDb: preview.delta.difference.opticalLossDb,
    diversityScore: diversityScore(geometry, args.draft.commercialBaselineGeometry),
    confidence: Math.round(Math.min(preview.snapshot.confidence, args.source === "OSRM_BASELINE" || args.source === "OSRM" ? 88 : 76)),
    unknownCount,
    osrmVertexCount: geometry.length,
    generatedAt: new Date().toISOString(),
    diagnostics: args.diagnostics ?? [],
  };
  return {
    ...candidateCore,
    explanation: explanation({ candidate: candidateCore }),
  } satisfies CorridorCandidate;
}

async function routeCandidate(args: {
  draft: RouteEngineeringDraft;
  type: CorridorCandidateType;
  name: string;
  source: CorridorCandidateSource;
  waypoints?: DALCoordinate[];
  hints?: CorridorCandidateHint[];
}): Promise<CorridorCandidate | CorridorCandidateFailure> {
  const baseline = args.draft.commercialBaselineGeometry;
  const start = baseline[0];
  const end = baseline.at(-1);
  if (!start || !end) {
    return { name: args.name, candidateType: args.type, failureReason: "MISSING_AZ_ENDPOINTS", diagnostics: ["A/Z endpoints are required for OSRM candidate generation."] };
  }
  const request: CommercialRouteRequest = {
    accountId: args.draft.commercialRouteId,
    from: toRequestPoint(start, "Fixed A endpoint"),
    to: {
      latitude: end[1],
      longitude: end[0],
      source: "Z_LOCATION",
      label: "Fixed Z endpoint",
    },
    waypoints: (args.waypoints ?? []).map((waypoint, index) => ({
      latitude: waypoint[1],
      longitude: waypoint[0],
      label: `Candidate waypoint ${index + 1}`,
    })),
    mode: "AZ_CORRIDOR",
  };
  const result = await routeCommercialCorridorWithOsrm(request);
  if (result.status !== "ROUTED" || !result.geometry?.length) {
    return {
      name: args.name,
      candidateType: args.type,
      failureReason: result.failureReason ?? "OSRM_ROUTE_NOT_FOUND",
      diagnostics: result.diagnostics,
    };
  }
  const geometry = result.geometry.map((coordinate) => [coordinate.longitude, coordinate.latitude] as DALCoordinate);
  return createCandidateFromGeometry({
    draft: args.draft,
    type: args.type,
    name: args.name,
    source: args.source,
    geometry,
    waypoints: args.waypoints,
    hints: args.hints,
    diagnostics: result.diagnostics,
  }) ?? {
    name: args.name,
    candidateType: args.type,
    failureReason: "OSRM_GEOMETRY_INVALID",
    diagnostics: ["OSRM returned geometry, but the candidate failed DAL coordinate validation."],
  };
}

export function createBaselineCorridorCandidate(draft: RouteEngineeringDraft) {
  return createCandidateFromGeometry({
    draft,
    type: "SHORTEST_PATH",
    name: "Commercial Baseline",
    source: "OSRM_BASELINE",
    geometry: draft.commercialBaselineGeometry,
    diagnostics: ["Commercial Baseline is preserved as immutable OSRM corridor evidence."],
  });
}

export async function generateInitialCorridorCandidates(draft: RouteEngineeringDraft): Promise<CorridorCandidateSet> {
  const baseline = createBaselineCorridorCandidate(draft);
  const center = midpoint(draft.commercialBaselineGeometry);
  const offset = corridorOffsetDegrees(draft.commercialBaselineGeometry);
  const requests = [
    routeCandidate({
      draft,
      type: "SHORTEST_PATH",
      name: "Shortest OSRM",
      source: "OSRM",
    }),
    center ? routeCandidate({
      draft,
      type: "DIVERSE_FROM_BASELINE",
      name: "West Diversity Candidate",
      source: "HEURISTIC_OSRM_INPUT",
      waypoints: [offsetCoordinate(center, "W", offset)],
      hints: [{ hintId: "WEST-BIAS", type: "PREFER_CORRIDOR", label: "Western road-network bias waypoint", coordinate: offsetCoordinate(center, "W", offset), heuristic: true }],
    }) : null,
    center ? routeCandidate({
      draft,
      type: "PREFER_HIGHWAY",
      name: "East Highway Candidate",
      source: "HEURISTIC_OSRM_INPUT",
      waypoints: [offsetCoordinate(center, "E", offset)],
      hints: [{ hintId: "EAST-BIAS", type: "PREFER_CORRIDOR", label: "Eastern road-network bias waypoint", coordinate: offsetCoordinate(center, "E", offset), heuristic: true }],
    }) : null,
    center ? routeCandidate({
      draft,
      type: "LOW_RISK_HEURISTIC",
      name: "Low-Risk Heuristic",
      source: "HEURISTIC_OSRM_INPUT",
      waypoints: [offsetCoordinate(center, "N", offset * 0.7)],
      hints: [{ hintId: "LOW-RISK-BIAS", type: "AVOID_AREA", label: "North detour heuristic for unresolved constraints", coordinate: offsetCoordinate(center, "N", offset * 0.7), heuristic: true }],
    }) : null,
  ].filter((request): request is Promise<CorridorCandidate | CorridorCandidateFailure> => Boolean(request));

  const routed = await Promise.all(requests);
  const candidates = [
    ...(baseline ? [baseline] : []),
    ...routed.filter((result): result is CorridorCandidate => "candidateId" in result),
  ];
  const failures = routed.filter((result): result is CorridorCandidateFailure => !("candidateId" in result));
  return {
    candidates: candidates.slice(0, 5),
    failures,
  };
}

export async function generateWaypointCorridorCandidate(args: {
  draft: RouteEngineeringDraft;
  waypoint: DALCoordinate;
  type: CorridorCandidateType;
  name: string;
  hintType: CorridorCandidateHintType;
  hintLabel: string;
  heuristic?: boolean;
}) {
  return routeCandidate({
    draft: args.draft,
    type: args.type,
    name: args.name,
    source: args.heuristic ? "HEURISTIC_OSRM_INPUT" : "USER_WAYPOINT",
    waypoints: [args.waypoint],
    hints: [{
      hintId: `${args.type}:${engineeringGeometryHash([args.waypoint])}`,
      type: args.hintType,
      label: args.hintLabel,
      coordinate: cloneCoordinate(args.waypoint),
      heuristic: Boolean(args.heuristic),
    }],
  });
}

export function candidateRevisionReason(candidate: CorridorCandidate) {
  return `${candidate.name}: ${candidate.explanation}`;
}

export function candidateSnapshot(candidate: CorridorCandidate): EngineeringFinancialSnapshot {
  return {
    routeMiles: candidate.routeMiles,
    fiberFootage: Math.round(candidate.routeMiles * FEET_PER_MILE),
    ductFootage: Math.round(candidate.routeMiles * FEET_PER_MILE),
    labor: candidate.labor,
    equipment: candidate.equipment,
    materials: candidate.materials,
    durationDays: candidate.durationDays,
    crewCount: Math.max(1, Math.ceil(candidate.routeMiles / 20)),
    marginPercent: candidate.marginPercent,
    proposalValue: candidate.constructionCost * (1 + Math.max(0, candidate.marginPercent) / 100),
    recurringRevenue: 0,
    commercialReadiness: candidate.confidence,
    confidence: candidate.confidence,
    constructionCost: candidate.constructionCost,
    handholes: Math.max(2, Math.ceil(candidate.routeMiles * FEET_PER_MILE / 2500)),
    bores: 0,
    opticalLossDb: candidate.opticalLossDb,
  };
}
