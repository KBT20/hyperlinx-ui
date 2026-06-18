import { haversineFeet } from "../affinity/geo";
import type { DALCoordinate } from "../types/dal";
import { analyzeRouteConstraints, type ConstraintAnalysisResult, type ReferenceLayerSet } from "./ConstraintAnalysisEngine";
import { pathLengthFeet } from "../serviceability/streetPathEngine";
import { buildDeterministicStreetDrivewayRoute } from "./DeterministicStreetDrivewayRouting";

export type RoutingPreference = "LOWEST_DISTANCE" | "LOWEST_CONFLICT" | "LOWEST_COST" | "ENGINEER_ASSISTED";
export type AttachmentAwareRoutingMode =
  | "ATTACHMENT_DIRECT"
  | "CONSTRAINT_AWARE_DOGLEG"
  | "REFERENCE_LAYER_ASSISTED"
  | "REFERENCE_CENTERLINE_ROUTING"
  | "DETERMINISTIC_STREET_DRIVEWAY"
  | "DIRECT_FALLBACK"
  | "ENGINEER_EDITED";

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
  pathConfidence?: "LOW" | "MEDIUM" | "HIGH";
  roadSegmentCount?: number;
  roadNamesTraversed?: string[];
  roadClassesTraversed?: string[];
  attachmentMethod?: string;
};

function createId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return `${prefix}-${crypto.randomUUID()}`;
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function asCoordinate(value: { lat: number; lon: number }): DALCoordinate {
  return [value.lon, value.lat];
}

function confidenceFor(mode: AttachmentAwareRoutingMode, analysis: ConstraintAnalysisResult) {
  const base =
    mode === "ATTACHMENT_DIRECT" || mode === "DIRECT_FALLBACK"
      ? 0.38
      : mode === "REFERENCE_CENTERLINE_ROUTING"
        ? 0.78
        : mode === "DETERMINISTIC_STREET_DRIVEWAY"
          ? 0.66
          : mode === "CONSTRAINT_AWARE_DOGLEG"
            ? 0.56
            : mode === "REFERENCE_LAYER_ASSISTED"
              ? 0.62
              : 0.78;
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
  pathConfidence?: AttachmentAwareRouteResult["pathConfidence"];
  roadSegmentCount?: number;
  roadNamesTraversed?: string[];
  roadClassesTraversed?: string[];
  attachmentMethod?: string;
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
    pathConfidence: args.pathConfidence,
    roadSegmentCount: args.roadSegmentCount,
    roadNamesTraversed: args.roadNamesTraversed,
    roadClassesTraversed: args.roadClassesTraversed,
    attachmentMethod: args.attachmentMethod,
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
  const streetCenterlines = input.referenceLayers.streets ?? [];
  const routeFor = (preference: RoutingPreference, variant: string) => {
    const routed = buildDeterministicStreetDrivewayRoute({
      candidateCoordinate: candidate,
      attachmentCoordinate: attachment,
      streetCenterlines,
      variant,
    });
    return makeRoute({
      input,
      geometry: routed.geometry.length >= 2 ? routed.geometry : [candidate, attachment],
      mode: routed.routingMode === "DIRECT_FALLBACK" ? "DIRECT_FALLBACK" : routed.routingMode,
      preference,
      note:
        routed.routingMode === "REFERENCE_CENTERLINE_ROUTING"
          ? "Deterministic route uses available street centerline reference geometry with driveway and station handoff points."
          : routed.routingMode === "DETERMINISTIC_STREET_DRIVEWAY"
            ? "Deterministic route uses inferred building entrance, driveway, parking access, local street, station, and inventory attachment points."
            : "Direct fallback is visible for review because no usable network reference path could be formed.",
      pathConfidence: routed.pathConfidence,
      roadSegmentCount: routed.roadSegmentCount,
      roadNamesTraversed: routed.roadNamesTraversed,
      roadClassesTraversed: routed.roadClassesTraversed,
      attachmentMethod: routed.attachmentMethod,
    });
  };
  const alternatives = [
    routeFor("LOWEST_CONFLICT", "avoid-conflict"),
    routeFor("ENGINEER_ASSISTED", "engineer-preferred"),
    routeFor("LOWEST_COST", "low-cost"),
    routeFor("LOWEST_DISTANCE", "short-access"),
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
