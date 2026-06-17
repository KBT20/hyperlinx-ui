import { haversineFeet } from "../affinity/geo";
import type { DALCoordinate } from "../types/dal";
import { analyzeRouteConstraints, type ConstraintAnalysisResult, type ReferenceLayerSet } from "./ConstraintAnalysisEngine";
import { pathLengthFeet } from "../serviceability/streetPathEngine";

export type RoutingPreference = "LOWEST_DISTANCE" | "LOWEST_CONFLICT" | "LOWEST_COST" | "ENGINEER_ASSISTED";
export type AttachmentAwareRoutingMode = "ATTACHMENT_DIRECT" | "CONSTRAINT_AWARE_DOGLEG" | "REFERENCE_LAYER_ASSISTED" | "ENGINEER_EDITED";

export type AttachmentAwareRouteInput = {
  parentScopeVersionId: string;
  candidateSiteId: string;
  attachmentAuthority: import("../attachment/AttachmentAuthorityEngine").AttachmentAuthorityResult;
  attachmentCoordinate: { lat: number; lon: number };
  candidateCoordinate: { lat: number; lon: number };
  referenceLayers: ReferenceLayerSet;
  routingPreference: RoutingPreference;
};

export type AttachmentAwareRouteResult = {
  routeId: string;
  routingMode: AttachmentAwareRoutingMode;
  routingPreference: RoutingPreference;
  geometry: DALCoordinate[];
  distanceFeet: number;
  avoidedConstraints: string[];
  unresolvedConstraints: string[];
  constraintAnalysis: ConstraintAnalysisResult;
  confidence: number;
  requiresHumanReview: boolean;
  estimatedCostImpact: number;
  note: string;
};

function createId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return `${prefix}-${crypto.randomUUID()}`;
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function asCoordinate(value: { lat: number; lon: number }): DALCoordinate {
  return [value.lon, value.lat];
}

function midpoint(a: DALCoordinate, b: DALCoordinate): DALCoordinate {
  return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
}

function doglegGeometry(attachment: DALCoordinate, candidate: DALCoordinate): DALCoordinate[] {
  const elbow: DALCoordinate = [attachment[0], candidate[1]];
  if (haversineFeet(attachment, elbow) < 3 || haversineFeet(elbow, candidate) < 3) return [attachment, candidate];
  return [attachment, elbow, candidate];
}

function offsetGeometry(attachment: DALCoordinate, candidate: DALCoordinate, direction: 1 | -1): DALCoordinate[] {
  const mid = midpoint(attachment, candidate);
  const lonDelta = candidate[0] - attachment[0];
  const latDelta = candidate[1] - attachment[1];
  const magnitude = Math.sqrt(lonDelta ** 2 + latDelta ** 2) || 1;
  const offset = Math.min(0.0048, Math.max(0.0009, magnitude * 0.2));
  const normal: DALCoordinate = [(-latDelta / magnitude) * offset * direction, (lonDelta / magnitude) * offset * direction];
  return [attachment, [mid[0] + normal[0], mid[1] + normal[1]], candidate];
}

function confidenceFor(mode: AttachmentAwareRoutingMode, analysis: ConstraintAnalysisResult) {
  const base = mode === "ATTACHMENT_DIRECT" ? 0.48 : mode === "CONSTRAINT_AWARE_DOGLEG" ? 0.56 : mode === "REFERENCE_LAYER_ASSISTED" ? 0.62 : 0.78;
  const penalty = Math.min(0.32, analysis.unresolvedConstraints.length * 0.045);
  return Math.max(0.22, Math.min(0.86, Number((base + analysis.constructabilityScore / 600 - penalty).toFixed(2))));
}

function costImpact(distanceFeet: number, analysis: ConstraintAnalysisResult) {
  const summary = analysis.summary;
  const constraintCost =
    summary.buildingConflicts * 50000 +
    summary.railroadCrossings * 35000 +
    summary.waterCrossings * 30000 +
    summary.parcelCrossings * 2500 +
    summary.roadCrossings * 1200 +
    summary.terrainFlags * 7500;
  return Math.round(distanceFeet * 22 + constraintCost);
}

function makeRoute(args: {
  input: AttachmentAwareRouteInput;
  geometry: DALCoordinate[];
  mode: AttachmentAwareRoutingMode;
  preference: RoutingPreference;
  note: string;
}): AttachmentAwareRouteResult {
  const constraintAnalysis = analyzeRouteConstraints({
    parentScopeVersionId: args.input.parentScopeVersionId,
    candidateSiteId: args.input.candidateSiteId,
    attachmentAuthority: args.input.attachmentAuthority,
    candidateCoordinate: args.input.candidateCoordinate,
    proposedGeometry: args.geometry,
    referenceLayers: args.input.referenceLayers,
    routeGeometrySource: args.mode === "ENGINEER_EDITED" ? "ENGINEER_EDITED" : "SERVICEABILITY_PROPOSED",
    analysisMode: args.mode === "ENGINEER_EDITED" ? "ENGINEER_EDITED" : args.mode === "CONSTRAINT_AWARE_DOGLEG" ? "CONSTRAINT_AWARE_DOGLEG" : "REFERENCE_LAYER_ASSISTED",
  });
  const distanceFeet = Math.round(pathLengthFeet(args.geometry));
  return {
    routeId: createId(`aar-${args.preference.toLowerCase()}`),
    routingMode: args.mode,
    routingPreference: args.preference,
    geometry: args.geometry,
    distanceFeet,
    avoidedConstraints: [],
    unresolvedConstraints: constraintAnalysis.unresolvedConstraints,
    constraintAnalysis,
    confidence: confidenceFor(args.mode, constraintAnalysis),
    requiresHumanReview: true,
    estimatedCostImpact: costImpact(distanceFeet, constraintAnalysis),
    note: args.note,
  };
}

function uniqueByGeometry(routes: AttachmentAwareRouteResult[]) {
  const seen = new Set<string>();
  return routes.filter((route) => {
    const key = route.geometry.map((coordinate) => `${coordinate[0].toFixed(7)},${coordinate[1].toFixed(7)}`).join("|");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function generateAttachmentAwareRouteAlternatives(input: AttachmentAwareRouteInput): AttachmentAwareRouteResult[] {
  const attachment = asCoordinate(input.attachmentCoordinate);
  const candidate = asCoordinate(input.candidateCoordinate);
  const alternatives = [
    makeRoute({
      input,
      geometry: [attachment, candidate],
      mode: "ATTACHMENT_DIRECT",
      preference: "LOWEST_DISTANCE",
      note: "Direct attachment-to-candidate segment. This is not road-network routing.",
    }),
    makeRoute({
      input,
      geometry: doglegGeometry(attachment, candidate),
      mode: "CONSTRAINT_AWARE_DOGLEG",
      preference: "LOWEST_CONFLICT",
      note: "Deterministic dogleg shaped by attachment and candidate geometry. This is not shortest-path routing.",
    }),
    makeRoute({
      input,
      geometry: offsetGeometry(attachment, candidate, 1),
      mode: "REFERENCE_LAYER_ASSISTED",
      preference: "ENGINEER_ASSISTED",
      note: "Offset engineer-assisted alternative for visual review against reference layers. No routable street graph is available.",
    }),
    makeRoute({
      input,
      geometry: offsetGeometry(attachment, candidate, -1),
      mode: "REFERENCE_LAYER_ASSISTED",
      preference: "LOWEST_COST",
      note: "Offset low-cost candidate based on deterministic geometry and constraint penalties.",
    }),
  ];

  const ranked = [...alternatives].sort((a, b) => {
    if (input.routingPreference === "LOWEST_DISTANCE") return a.distanceFeet - b.distanceFeet;
    if (input.routingPreference === "LOWEST_COST") return a.estimatedCostImpact - b.estimatedCostImpact;
    if (input.routingPreference === "LOWEST_CONFLICT") return a.unresolvedConstraints.length - b.unresolvedConstraints.length || b.constraintAnalysis.constructabilityScore - a.constraintAnalysis.constructabilityScore;
    return b.confidence - a.confidence;
  });

  return uniqueByGeometry(ranked).slice(0, 3);
}

export function generateAttachmentAwareRoute(input: AttachmentAwareRouteInput): AttachmentAwareRouteResult {
  return generateAttachmentAwareRouteAlternatives(input)[0];
}
