import type { DALCoordinate } from "../types/dal";
import CertificationAuthorityStrip from "./CertificationAuthorityStrip";
import type { AttachmentAwareRouteResult, AttachmentAwareRoutingMode } from "../routing/AttachmentAwareRouteEngine";
import type { ConstraintAnalysisResult } from "../routing/ConstraintAnalysisEngine";
import ConstraintEvidenceStrip from "./ConstraintEvidenceStrip";
import {
  canCreateScopeVersionFromRoute,
  createRouteCertificationSnapshot,
  routeMetricsForGeometry,
  type RouteCertificationSnapshot,
  type RouteCertificationState,
} from "../serviceability/routeCertification";

type RouteEngineeringPanelProps = {
  title: string;
  candidateLabel?: string;
  routeLabel?: string;
  stationLabel?: string;
  nodeLabel?: string;
  attachmentLabel?: string;
  geometry: DALCoordinate[];
  originalGeometry?: DALCoordinate[];
  selectedVertexIndex?: number | null;
  certificationState: RouteCertificationState;
  certification?: RouteCertificationSnapshot;
  engineerName: string;
  certificationNotes: string;
  metricHints?: Parameters<typeof routeMetricsForGeometry>[1];
  routingMode?: AttachmentAwareRoutingMode;
  constraintAnalysis?: ConstraintAnalysisResult | null;
  routeAlternatives?: AttachmentAwareRouteResult[];
  selectedRouteAlternativeId?: string;
  onGeometryChange: (geometry: DALCoordinate[]) => void;
  onVertexSelect?: (index: number | null) => void;
  onStateChange: (state: RouteCertificationState) => void;
  onEngineerNameChange: (value: string) => void;
  onCertificationNotesChange: (value: string) => void;
  onPromoteRouteAlternative?: (route: AttachmentAwareRouteResult) => void;
  onCertify: (snapshot: RouteCertificationSnapshot) => void;
  onReject: (snapshot: RouteCertificationSnapshot) => void;
};

function money(value: number | undefined) {
  return Number(value || 0).toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function feet(value: number | undefined) {
  return `${Math.round(Number(value || 0)).toLocaleString()} ft`;
}

function constraintCountLabel(analysis: ConstraintAnalysisResult | null | undefined, key: keyof ConstraintAnalysisResult["summary"]) {
  if (!analysis) return "UNKNOWN";
  if (analysis.unknownCounts?.[key]) return "UNKNOWN";
  return Number(analysis.summary[key] || 0).toLocaleString();
}

function copyGeometry(geometry: DALCoordinate[]) {
  return geometry.map((coordinate) => [Number(coordinate[0]), Number(coordinate[1])] as DALCoordinate);
}

function midpoint(a: DALCoordinate, b: DALCoordinate): DALCoordinate {
  return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
}

export default function RouteEngineeringPanel({
  title,
  candidateLabel = "n/a",
  routeLabel = "n/a",
  stationLabel = "n/a",
  nodeLabel = "n/a",
  attachmentLabel = "n/a",
  geometry,
  originalGeometry,
  selectedVertexIndex,
  certificationState,
  certification,
  engineerName,
  certificationNotes,
  metricHints,
  routingMode,
  constraintAnalysis,
  routeAlternatives = [],
  selectedRouteAlternativeId,
  onGeometryChange,
  onVertexSelect,
  onStateChange,
  onEngineerNameChange,
  onCertificationNotesChange,
  onPromoteRouteAlternative,
  onCertify,
  onReject,
}: RouteEngineeringPanelProps) {
  const metrics = certification ?? createRouteCertificationSnapshot({
    geometry,
    originalGeometry,
    status: certificationState,
    engineerName,
    certificationNotes,
    metrics: metricHints,
    routingMode,
    constraintAnalysis: constraintAnalysis ?? undefined,
  });
  const authority = certification?.certificationAuthority ?? metrics.certificationAuthority;
  const readiness = constraintAnalysis?.certificationReadiness ?? "READY";
  const evidenceStale = Boolean(constraintAnalysis && metrics.certifiedGeometryHash && constraintAnalysis.routeGeometryHash !== metrics.certifiedGeometryHash);
  const completeness = constraintAnalysis?.constraintRegistrySnapshot.completeness;
  const incompleteConstraintEvidence = Boolean(constraintAnalysis && !completeness?.usableForCertification);
  const notesRequired = readiness === "REVIEW_REQUIRED" || incompleteConstraintEvidence;
  const noteMeetsReviewGate = !notesRequired || certificationNotes.trim().length >= 12;
  const canCertify =
    geometry.length >= 2 &&
    engineerName.trim().length > 0 &&
    certificationNotes.trim().length > 0 &&
    authority?.state !== "BLOCKED" &&
    authority?.evidenceStatus === "CURRENT" &&
    noteMeetsReviewGate &&
    !evidenceStale &&
    Boolean(constraintAnalysis);
  const canCreateChild = Boolean(authority?.canCreateChildScopeVersion && canCreateScopeVersionFromRoute(certification));

  function updateVertex(index: number, axis: 0 | 1, value: string) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return;
    const next = copyGeometry(geometry);
    next[index] = axis === 0 ? [numeric, next[index][1]] : [next[index][0], numeric];
    onGeometryChange(next);
    onStateChange("ENGINEER_REVIEW_REQUIRED");
    onVertexSelect?.(index);
  }

  function addVertex() {
    if (!geometry.length) return;
    const next = copyGeometry(geometry);
    const insertAt = typeof selectedVertexIndex === "number" ? Math.min(selectedVertexIndex + 1, next.length - 1) : Math.max(1, next.length - 1);
    const before = next[Math.max(0, insertAt - 1)];
    const after = next[Math.min(next.length - 1, insertAt)];
    next.splice(insertAt, 0, midpoint(before, after));
    onGeometryChange(next);
    onStateChange("ENGINEER_REVIEW_REQUIRED");
    onVertexSelect?.(insertAt);
  }

  function removeVertex(index: number) {
    if (geometry.length <= 2) return;
    const next = copyGeometry(geometry);
    next.splice(index, 1);
    onGeometryChange(next);
    onStateChange("ENGINEER_REVIEW_REQUIRED");
    onVertexSelect?.(Math.min(index, next.length - 1));
  }

  function certify() {
    if (!canCertify) return;
    onCertify(
      createRouteCertificationSnapshot({
        geometry,
        originalGeometry,
        status: "CERTIFIED_ROUTE",
        engineerName,
        certificationNotes,
        metrics: metricHints,
        routingMode,
        constraintAnalysis: constraintAnalysis ?? undefined,
      })
    );
  }

  function reject() {
    onReject(
      createRouteCertificationSnapshot({
        geometry,
        originalGeometry,
        status: "REJECTED_ROUTE",
        engineerName: engineerName.trim() || "Unassigned Engineer",
        certificationNotes: certificationNotes.trim() || "Rejected during route engineering review.",
        metrics: metricHints,
        routingMode,
        constraintAnalysis: constraintAnalysis ?? undefined,
      })
    );
  }

  return (
    <div className="dal-panel">
      <h3>{title}</h3>
      <div className="dal-metrics">
        <span>State: {authority?.state ?? certificationState}</span>
        <span>Child ScopeVersion Gate: {canCreateChild ? authority?.state : "BLOCKED"}</span>
        <span>Candidate: {candidateLabel}</span>
        <span>Route: {routeLabel}</span>
        <span>Station: {stationLabel}</span>
        <span>Node: {nodeLabel}</span>
        <span>Attachment: {attachmentLabel}</span>
        <span>Routing Mode: {routingMode ?? certification?.routingMode ?? "ENGINEER_EDITED"}</span>
        <span>Vertices: {geometry.length.toLocaleString()}</span>
        <span>Build Feet: {feet(metrics.lengthFeet)}</span>
        <span>Build Miles: {Number(metrics.buildMiles || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
        <span>Crossings: {metrics.crossingEstimate.crossings}</span>
        <span>Constructability: {metrics.constructabilityEstimate.constructabilityScore}</span>
        <span>Certification Readiness: {readiness}</span>
        <span>Constraint Completeness: {completeness ? `${completeness.completenessPercent}%` : "UNKNOWN"}</span>
        <span>Missing Constraint Layers: {completeness?.missingLayers.join(", ") || "none recorded"}</span>
        <span>Constraint Evidence Grade: {authority?.evidenceGrade ?? (incompleteConstraintEvidence ? "INCOMPLETE_CONSTRAINT_EVIDENCE" : constraintAnalysis ? "COMPLETE_CONSTRAINT_EVIDENCE" : "MISSING")}</span>
        <span>Certification Notes Required: {notesRequired ? "YES" : "NO"}</span>
        <span>Evidence ID: {constraintAnalysis?.evidenceId ?? certification?.constraintEvidenceId ?? "missing"}</span>
        <span>Route Geometry Hash: {constraintAnalysis?.routeGeometryHash ?? metrics.certifiedGeometryHash}</span>
        <span>Evidence Status: {evidenceStale ? "STALE CONSTRAINT EVIDENCE" : constraintAnalysis ? "CURRENT" : "MISSING"}</span>
        <span>Building Conflicts: {constraintCountLabel(constraintAnalysis, "buildingConflicts")}</span>
        <span>Parcel Crossings: {constraintCountLabel(constraintAnalysis, "parcelCrossings")}</span>
        <span>Railroad Crossings: {constraintCountLabel(constraintAnalysis, "railroadCrossings")}</span>
        <span>Water Crossings: {constraintCountLabel(constraintAnalysis, "waterCrossings")}</span>
        <span>Road Crossings: {constraintCountLabel(constraintAnalysis, "roadCrossings")}</span>
        <span>Terrain Flags: {constraintCountLabel(constraintAnalysis, "terrainFlags")}</span>
        <span>Water Layer Loaded: {constraintAnalysis?.waterCrossingAudit.waterLayerLoaded ? "TRUE" : "FALSE"}</span>
        <span>Water Feature Count: {constraintAnalysis?.waterCrossingAudit.waterFeatureCount ?? 0}</span>
        <span>Water Intersections Found: {constraintAnalysis?.waterCrossingAudit.waterIntersectionsFound ?? 0}</span>
        <span>Water Analysis: {constraintAnalysis?.waterCrossingAudit.analysisMethod ?? "UNKNOWN"}</span>
        <span>Unresolved Constraints: {constraintAnalysis?.unresolvedConstraints.length ?? 0}</span>
        <span>Construction Cost: {money(metrics.costEstimate.constructionCost)}</span>
        <span>NRC: {money(metrics.costEstimate.NRC)}</span>
        <span>MRC: {money(metrics.costEstimate.MRC)}</span>
        <span>TCV: {money(metrics.costEstimate.TCV)}</span>
        <span>Certification ID: {certification?.routeCertificationId ?? "not certified"}</span>
        <span>Engineer: {certification?.engineerName || engineerName || "required"}</span>
        <span>Certified At: {certification?.certifiedAt ?? "n/a"}</span>
      </div>
      <CertificationAuthorityStrip title="Route Certification Authority" decision={authority} />
      <ConstraintEvidenceStrip evidence={constraintAnalysis ?? certification?.constraintEvidencePackage} currentGeometry={geometry} title="Route Engineering Constraint Evidence" />
      <div className="dal-grid compact">
        <input value={engineerName} onChange={(event) => onEngineerNameChange(event.target.value)} placeholder="Engineer name" />
        <input value={certificationNotes} onChange={(event) => onCertificationNotesChange(event.target.value)} placeholder="Certification notes" />
      </div>
      <div className="dal-actions">
        <button type="button" onClick={() => onStateChange("ENGINEER_REVIEW_REQUIRED")} disabled={!geometry.length}>
          Engineer Review
        </button>
        <button type="button" onClick={addVertex} disabled={geometry.length < 2}>
          Add Vertex
        </button>
        <button type="button" onClick={certify} disabled={!canCertify}>
          Certify / Provisionally Certify Route
        </button>
        <button type="button" onClick={reject} disabled={!geometry.length}>
          Reject Route
        </button>
      </div>
      {routeAlternatives.length ? (
        <div className="dal-table-wrap">
          <table className="dal-table">
            <thead>
              <tr>
                <th>Alternative</th>
                <th>Mode</th>
                <th>Distance</th>
                <th>Constraints</th>
                <th>Buildable</th>
                <th>Cost Impact</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {routeAlternatives.map((alternative) => (
                <tr key={alternative.routeId} className={selectedRouteAlternativeId === alternative.routeId ? "selected" : undefined}>
                  <td>{alternative.routingPreference.replaceAll("_", " ")}</td>
                  <td>{alternative.routingMode}</td>
                  <td>{feet(alternative.distanceFeet)}</td>
                  <td>{alternative.unresolvedConstraints.length}</td>
                  <td>{alternative.constraintAnalysis.constructabilityScore} / {alternative.constraintAnalysis.certificationReadiness}</td>
                  <td>{money(alternative.estimatedCostImpact)}</td>
                  <td>
                    <button type="button" onClick={() => onPromoteRouteAlternative?.(alternative)} disabled={!onPromoteRouteAlternative}>
                      Promote
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      {constraintAnalysis?.constraints.length ? (
        <div className="dal-table-wrap">
          <table className="dal-table">
            <thead>
              <tr>
                <th>Constraint</th>
                <th>Severity</th>
                <th>Action</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody>
              {constraintAnalysis.constraints.map((constraint) => (
                <tr key={constraint.constraintId}>
                  <td>{constraint.constraintType.replaceAll("_", " ")}</td>
                  <td>{constraint.severity}</td>
                  <td>{constraint.recommendedAction}</td>
                  <td>{constraint.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      <div className="dal-table-wrap">
        <table className="dal-table">
          <thead>
            <tr>
              <th>Vertex</th>
              <th>Longitude</th>
              <th>Latitude</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {geometry.map((coordinate, index) => (
              <tr key={`${index}-${coordinate[0]}-${coordinate[1]}`} className={selectedVertexIndex === index ? "selected" : undefined}>
                <td>
                  <button type="button" onClick={() => onVertexSelect?.(index)}>
                    {index + 1}
                  </button>
                </td>
                <td>
                  <input value={coordinate[0]} onChange={(event) => updateVertex(index, 0, event.target.value)} />
                </td>
                <td>
                  <input value={coordinate[1]} onChange={(event) => updateVertex(index, 1, event.target.value)} />
                </td>
                <td>
                  <button type="button" onClick={() => removeVertex(index)} disabled={geometry.length <= 2}>
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="dal-status">
        A generated route is never authoritative. Attachment authority determines origin; constraint analysis determines constructability. BLOCKED routes cannot be certified. REVIEW_REQUIRED or incomplete constraint evidence routes require engineer notes and are marked INCOMPLETE_CONSTRAINT_EVIDENCE.
      </div>
    </div>
  );
}
