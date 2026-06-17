import { estimateBuriedConstructionCost } from "../engineering/constructionModel";
import type { DALCoordinate } from "../types/dal";
import type { AttachmentAwareRoutingMode } from "../routing/AttachmentAwareRouteEngine";
import {
  deriveRouteCertificationState,
  type CertificationAuthorityDecision,
  type EvidenceGrade,
  type RouteCertificationState,
} from "../certification/CertificationAuthority";
import {
  hashRouteGeometry,
  type CertificationReadiness,
  type ConstraintAnalysisResult,
  type ConstraintEvidencePackage,
  type ConstraintSummary,
  type RouteConstraint,
} from "../routing/ConstraintAnalysisEngine";
import { pathLengthFeet } from "./streetPathEngine";

export type { RouteCertificationState };

export type RouteCertificationSnapshot = {
  routeCertificationId: string;
  status: RouteCertificationState;
  routeGeometry: DALCoordinate[];
  certifiedGeometrySnapshot: DALCoordinate[];
  certifiedGeometryHash: string;
  engineerName: string;
  certifiedBy: string;
  certifiedAt?: string;
  certificationTimestamp?: string;
  certificationNotes: string;
  engineerNotes: string;
  edited: boolean;
  lengthFeet: number;
  buildMiles: number;
  crossingEstimate: {
    crossings: number;
    roadCrossings: number;
    railCrossings: number;
    waterCrossings: number;
  };
  constructabilityEstimate: {
    constructabilityScore: number;
    constructionDifficulty: number;
    permitRisk: number;
    crossingRisk: number;
    environmentalRisk: number;
  };
  costEstimate: {
    trenchCost: number;
    boreCost: number;
    crossingCost: number;
    restorationCost: number;
    constructionCost: number;
    NRC: number;
    MRC: number;
    TCV: number;
    margin: number;
    payback: number;
    ROI: number;
  };
  financialModel: {
    buildFeet: number;
    buildMiles: number;
    constructionCost: number;
    NRC: number;
    MRC: number;
    TCV: number;
    margin: number;
    payback: number;
    ROI: number;
  };
  routingMode?: AttachmentAwareRoutingMode;
  constraintSummary?: ConstraintSummary;
  constraints?: RouteConstraint[];
  unresolvedConstraints?: string[];
  recommendedActions?: string[];
  certificationReadiness?: CertificationReadiness;
  constraintAnalysis?: ConstraintAnalysisResult;
  constraintEvidenceId?: string;
  constraintEvidencePackage?: ConstraintEvidencePackage;
  constraintEvidenceStatus?: "CURRENT" | "STALE" | "MISSING" | "INCOMPLETE_CONSTRAINT_EVIDENCE";
  certificationAuthority?: CertificationAuthorityDecision;
  evidenceGrade?: EvidenceGrade;
  missingConstraintLayers?: string[];
  provisional?: boolean;
};

function createId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return `${prefix}-${crypto.randomUUID()}`;
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function routeGeometryEquals(a: DALCoordinate[] = [], b: DALCoordinate[] = []) {
  if (a.length !== b.length) return false;
  return a.every((coordinate, index) => Math.abs(coordinate[0] - b[index][0]) < 0.0000001 && Math.abs(coordinate[1] - b[index][1]) < 0.0000001);
}

export function routeMetricsForGeometry(
  geometry: DALCoordinate[],
  options: {
    roadCrossings?: number;
    railCrossings?: number;
    waterCrossings?: number;
    constructabilityScore?: number;
    permitRisk?: number;
    environmentalRisk?: number;
  } = {}
) {
  const lengthFeet = Math.round(pathLengthFeet(geometry));
  const roadCrossings = Math.max(0, Math.round(Number(options.roadCrossings ?? 0)));
  const railCrossings = Math.max(0, Math.round(Number(options.railCrossings ?? 0)));
  const waterCrossings = Math.max(0, Math.round(Number(options.waterCrossings ?? 0)));
  const crossings = roadCrossings + railCrossings + waterCrossings;
  const cost = estimateBuriedConstructionCost({ buildFeet: lengthFeet, crossings });
  const NRC = Math.round(cost.totalCost * 1.32 + 8500);
  const MRC = Math.round(750 + lengthFeet * 0.72);
  const TCV = NRC + MRC * 36;
  const grossCost = cost.totalCost + MRC * 36 * 0.28;
  const margin = Math.round(((TCV - grossCost) / Math.max(TCV, 1)) * 100);
  const payback = MRC > 0 ? Math.round(NRC / MRC) : 0;
  const ROI = Math.round(((TCV - cost.totalCost) / Math.max(cost.totalCost, 1)) * 100);
  const permitRisk = Math.max(0, Math.min(100, Number(options.permitRisk ?? crossings * 12)));
  const crossingRisk = Math.max(0, Math.min(100, crossings * 18));
  const environmentalRisk = Math.max(0, Math.min(100, Number(options.environmentalRisk ?? waterCrossings * 24)));
  const constructionDifficulty = Math.max(0, Math.min(100, Math.round(lengthFeet / 180 + crossingRisk * 0.35 + permitRisk * 0.25)));
  const constructabilityScore = Math.max(0, Math.min(100, Math.round(Number(options.constructabilityScore ?? 100 - constructionDifficulty))));

  return {
    lengthFeet,
    buildMiles: lengthFeet / 5280,
    crossingEstimate: { crossings, roadCrossings, railCrossings, waterCrossings },
    constructabilityEstimate: {
      constructabilityScore,
      constructionDifficulty,
      permitRisk,
      crossingRisk,
      environmentalRisk,
    },
    costEstimate: {
      trenchCost: cost.trenchCost,
      boreCost: cost.boreCost,
      crossingCost: cost.crossingCost,
      restorationCost: cost.restorationCost,
      constructionCost: cost.totalCost,
      NRC,
      MRC,
      TCV,
      margin,
      payback,
      ROI,
    },
    financialModel: {
      buildFeet: lengthFeet,
      buildMiles: lengthFeet / 5280,
      constructionCost: cost.totalCost,
      NRC,
      MRC,
      TCV,
      margin,
      payback,
      ROI,
    },
  };
}

function metricsFromConstraintAnalysis(analysis?: ConstraintAnalysisResult): Parameters<typeof routeMetricsForGeometry>[1] {
  if (!analysis) return {};
  const summary = analysis.summary;
  return {
    roadCrossings: summary.roadCrossings,
    railCrossings: summary.railroadCrossings,
    waterCrossings: summary.waterCrossings,
    constructabilityScore: analysis.constructabilityScore,
    permitRisk: Math.min(100, summary.parcelCrossings * 7 + summary.railroadCrossings * 20 + summary.waterCrossings * 16),
    environmentalRisk: Math.min(100, summary.waterCrossings * 24 + summary.terrainFlags * 12),
  };
}

function evidencePackageFromAnalysis(analysis?: ConstraintAnalysisResult): ConstraintEvidencePackage | undefined {
  if (!analysis) return undefined;
  const {
    evidenceId,
    routeGeometryHash,
    routeGeometrySource,
    sourceScopeVersionId,
    candidateSiteId,
    routeCertificationId,
    generatedAt,
    generatedBy,
    summary,
    constraints,
    constructabilityScore,
    certificationReadiness,
    diagnostics,
    provenance,
    constraintRegistrySnapshot,
    waterCrossingAudit,
    unknownCounts,
  } = analysis;
  return {
    evidenceId,
    routeGeometryHash,
    routeGeometrySource,
    sourceScopeVersionId,
    candidateSiteId,
    routeCertificationId,
    generatedAt,
    generatedBy,
    summary,
    constraints,
    constructabilityScore,
    certificationReadiness,
    diagnostics,
    provenance,
    constraintRegistrySnapshot,
    waterCrossingAudit,
    unknownCounts,
  };
}

function evidenceStatusFor(packageValue: ConstraintEvidencePackage | undefined, certifiedGeometryHash: string) {
  if (!packageValue) return "MISSING" as const;
  if (packageValue.routeGeometryHash !== certifiedGeometryHash) return "STALE" as const;
  if (!packageValue.constraintRegistrySnapshot?.completeness.usableForCertification || packageValue.certificationReadiness === "UNKNOWN") {
    return "INCOMPLETE_CONSTRAINT_EVIDENCE" as const;
  }
  return "CURRENT" as const;
}

export function createRouteCertificationSnapshot(args: {
  geometry: DALCoordinate[];
  originalGeometry?: DALCoordinate[];
  status: RouteCertificationState;
  engineerName: string;
  certificationNotes: string;
  routeCertificationId?: string;
  certifiedAt?: string;
  metrics?: Parameters<typeof routeMetricsForGeometry>[1];
  routingMode?: AttachmentAwareRoutingMode;
  constraintAnalysis?: ConstraintAnalysisResult;
}): RouteCertificationSnapshot {
  const certifiedGeometryHash = hashRouteGeometry(args.geometry);
  const constraintEvidencePackage = evidencePackageFromAnalysis(args.constraintAnalysis);
  const constraintEvidenceStatus = evidenceStatusFor(constraintEvidencePackage, certifiedGeometryHash);
  const metrics = routeMetricsForGeometry(args.geometry, { ...args.metrics, ...metricsFromConstraintAnalysis(args.constraintAnalysis) });
  const certificationAuthority = deriveRouteCertificationState({
    routeGeometryHash: certifiedGeometryHash,
    constraintEvidencePackage,
    engineerApproval: {
      approved: args.status === "CERTIFIED_ROUTE" || args.status === "PROVISIONALLY_CERTIFIED",
      rejected: args.status === "REJECTED_ROUTE",
      notes: args.certificationNotes,
      certifiedBy: args.engineerName,
      certifiedAt: args.certifiedAt,
    },
  });
  const status = args.status === "REJECTED_ROUTE" ? "REJECTED_ROUTE" : certificationAuthority.state;
  const timestamp =
    status === "CERTIFIED_ROUTE" || status === "PROVISIONALLY_CERTIFIED" || status === "REJECTED_ROUTE"
      ? args.certifiedAt ?? new Date().toISOString()
      : undefined;
  return {
    routeCertificationId: args.routeCertificationId ?? createId("route-cert"),
    status,
    routeGeometry: args.geometry,
    certifiedGeometrySnapshot:
      status === "CERTIFIED_ROUTE" || status === "PROVISIONALLY_CERTIFIED" ? args.geometry.map((coordinate) => [coordinate[0], coordinate[1]] as DALCoordinate) : [],
    certifiedGeometryHash,
    engineerName: args.engineerName,
    certifiedBy: args.engineerName,
    certifiedAt: timestamp,
    certificationTimestamp: timestamp,
    certificationNotes: args.certificationNotes,
    engineerNotes: args.certificationNotes,
    edited: !routeGeometryEquals(args.geometry, args.originalGeometry ?? args.geometry),
    ...metrics,
    routingMode: args.routingMode,
    constraintSummary: args.constraintAnalysis?.summary,
    constraints: args.constraintAnalysis?.constraints,
    unresolvedConstraints: args.constraintAnalysis?.unresolvedConstraints,
    recommendedActions: args.constraintAnalysis?.recommendedActions,
    certificationReadiness: args.constraintAnalysis?.certificationReadiness,
    constraintAnalysis: args.constraintAnalysis,
    constraintEvidenceId: constraintEvidencePackage?.evidenceId,
    constraintEvidencePackage,
    constraintEvidenceStatus,
    certificationAuthority: {
      ...certificationAuthority,
      state: status,
    },
    evidenceGrade: certificationAuthority.evidenceGrade,
    missingConstraintLayers: certificationAuthority.missingConstraintLayers,
    provisional: certificationAuthority.provisional,
  };
}

export function canCreateScopeVersionFromRoute(snapshot: RouteCertificationSnapshot | null | undefined) {
  if (!snapshot) return false;
  const authority =
    snapshot.certificationAuthority ??
    deriveRouteCertificationState({
      routeGeometryHash: snapshot.certifiedGeometryHash,
      constraintEvidencePackage: snapshot.constraintEvidencePackage,
      engineerApproval: {
        approved: snapshot.status === "CERTIFIED_ROUTE" || snapshot.status === "PROVISIONALLY_CERTIFIED",
        rejected: snapshot.status === "REJECTED_ROUTE",
        notes: snapshot.certificationNotes,
        certifiedBy: snapshot.engineerName,
        certifiedAt: snapshot.certifiedAt,
      },
    });
  return Boolean(
    authority.canCreateChildScopeVersion &&
      (snapshot.status === "CERTIFIED_ROUTE" || snapshot.status === "PROVISIONALLY_CERTIFIED") &&
      snapshot.certifiedGeometrySnapshot.length >= 2 &&
      snapshot.engineerName.trim() &&
      snapshot.certificationNotes.trim() &&
      snapshot.constraintEvidencePackage &&
      snapshot.constraintEvidencePackage.routeGeometryHash === snapshot.certifiedGeometryHash
  );
}
