import type { DALCoordinate } from "../types/dal";
import { canUseSnapForRoute, createSnapCertificationSnapshot, updateSnapAuthorityCoordinate } from "../street/SnapAuthorityEngine";
import type { SnapAuthorityResult, SnapCertificationSnapshot, SnapCertificationState } from "../street/streetTypes";

type SnapAuthorityPanelProps = {
  title?: string;
  snapAuthority?: SnapAuthorityResult | null;
  certification?: SnapCertificationSnapshot | null;
  certificationState: SnapCertificationState;
  engineerName: string;
  certificationNotes: string;
  onSnapAuthorityChange: (snapAuthority: SnapAuthorityResult) => void;
  onStateChange: (state: SnapCertificationState) => void;
  onEngineerNameChange: (value: string) => void;
  onCertificationNotesChange: (value: string) => void;
  onCertify: (snapshot: SnapCertificationSnapshot) => void;
  onReject: (snapshot: SnapCertificationSnapshot) => void;
};

function coordinateLabel(coordinate?: DALCoordinate) {
  if (!coordinate) return "n/a";
  return `${coordinate[1].toFixed(6)}, ${coordinate[0].toFixed(6)}`;
}

function feet(value?: number) {
  return `${Math.round(Number(value || 0)).toLocaleString()} ft`;
}

function snapCandidates(value: unknown) {
  return Array.isArray(value) ? (value as Array<Record<string, any>>) : [];
}

export default function SnapAuthorityPanel({
  title = "Constructability-Aware Snap",
  snapAuthority,
  certification,
  certificationState,
  engineerName,
  certificationNotes,
  onSnapAuthorityChange,
  onStateChange,
  onEngineerNameChange,
  onCertificationNotesChange,
  onCertify,
  onReject,
}: SnapAuthorityPanelProps) {
  const effective = certification ?? snapAuthority ?? null;
  const canCertify = Boolean(snapAuthority && engineerName.trim() && certificationNotes.trim());
  const canGenerateRoute = canUseSnapForRoute(certification);
  const candidates = snapCandidates(effective?.attachmentCandidates);

  function updateCoordinate(axis: 0 | 1, value: string) {
    if (!snapAuthority) return;
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return;
    const nextCoordinate: DALCoordinate = axis === 0 ? [numeric, snapAuthority.snappedCoordinate[1]] : [snapAuthority.snappedCoordinate[0], numeric];
    onSnapAuthorityChange(updateSnapAuthorityCoordinate(snapAuthority, nextCoordinate));
    onStateChange("REVIEW_SNAP");
  }

  function certify() {
    if (!snapAuthority || !canCertify) return;
    onCertify(
      createSnapCertificationSnapshot({
        snapAuthority,
        status: "CERTIFIED_SNAP",
        engineerName,
        certificationNotes,
        manuallyRelocated: certificationState === "REVIEW_SNAP",
      })
    );
  }

  function reject() {
    if (!snapAuthority) return;
    onReject(
      createSnapCertificationSnapshot({
        snapAuthority,
        status: "REJECTED_SNAP",
        engineerName: engineerName.trim() || "Unassigned Engineer",
        certificationNotes: certificationNotes.trim() || "Rejected during street snap reference review.",
        manuallyRelocated: certificationState === "REVIEW_SNAP",
      })
    );
  }

  return (
    <div className="dal-panel">
      <h3>{title}</h3>
      {effective ? (
        <>
          <div className="dal-metrics">
            <span>State: {certification?.status ?? certificationState}</span>
            <span>Route Gate: {canGenerateRoute ? "CERTIFIED_SNAP" : "BLOCKED"}</span>
            <span>Snap Reference: {effective.snapAuthority}</span>
            <span>Method: {effective.snapMethod}</span>
            <span>Confidence: {Math.round(effective.snapConfidence * 100)}%</span>
            <span>Snap ID: {effective.snapId ?? "draft"}</span>
            <span>Constructability: {effective.constructabilityScore === undefined ? "n/a" : `${effective.constructabilityScore}/100`}</span>
            <span>Selected Alternative: {effective.selectedAlternative ?? "n/a"}</span>
            <span>Selected Candidate: {effective.selectedCandidateType ?? "n/a"}</span>
            <span>Street: {effective.streetName ?? "n/a"}</span>
            <span>Street Class: {effective.streetClass ?? "n/a"}</span>
            <span>Snapped Coordinate: {coordinateLabel(effective.snappedCoordinate)}</span>
            <span>Attachment Coordinate: {coordinateLabel(effective.attachmentCoordinate)}</span>
            <span>Distance To Street: {effective.distanceToStreetFeet === undefined ? "n/a" : feet(effective.distanceToStreetFeet)}</span>
            <span>Distance To Attachment: {feet(effective.distanceToAttachmentFeet)}</span>
            <span>Certification ID: {certification?.snapCertificationId ?? "not certified"}</span>
          </div>
          {candidates.length ? (
            <div className="dal-table compact">
              <div className="dal-table-row header">
                <span>Candidate</span>
                <span>Score</span>
                <span>Distance</span>
                <span>Impacts</span>
              </div>
              {candidates.slice(0, 6).map((candidate) => {
                const impacts = candidate.impacts ?? {};
                const score = candidate.scores?.constructabilityScore;
                const impactCount =
                  Number(impacts.waterCrossings ?? 0) +
                  Number(impacts.railCrossings ?? 0) +
                  Number(impacts.parcelImpacts ?? 0) +
                  Number(impacts.buildingImpacts ?? 0) +
                  Number(impacts.roadImpacts ?? 0) +
                  Number(impacts.terrainImpacts ?? 0);
                return (
                  <div className="dal-table-row" key={String(candidate.candidateId ?? candidate.label)}>
                    <span>{String(candidate.candidateType ?? candidate.label ?? "Attachment")}</span>
                    <span>{score === undefined ? "n/a" : `${Math.round(Number(score))}/100`}</span>
                    <span>{feet(Number(candidate.distanceFeet ?? 0))}</span>
                    <span>{impactCount.toLocaleString()}</span>
                  </div>
                );
              })}
            </div>
          ) : null}
          <div className="dal-grid compact">
            <input value={snapAuthority?.snappedCoordinate[0] ?? ""} onChange={(event) => updateCoordinate(0, event.target.value)} placeholder="Snapped longitude" />
            <input value={snapAuthority?.snappedCoordinate[1] ?? ""} onChange={(event) => updateCoordinate(1, event.target.value)} placeholder="Snapped latitude" />
            <input value={engineerName} onChange={(event) => onEngineerNameChange(event.target.value)} placeholder="Engineer name" />
            <input value={certificationNotes} onChange={(event) => onCertificationNotesChange(event.target.value)} placeholder="Snap certification notes" />
          </div>
          <div className="dal-actions">
            <button type="button" onClick={() => onStateChange("REVIEW_SNAP")} disabled={!snapAuthority}>
              Review Snap
            </button>
            <button type="button" onClick={certify} disabled={!canCertify}>
              Certify Snap
            </button>
            <button type="button" onClick={reject} disabled={!snapAuthority}>
              Reject Snap
            </button>
          </div>
        </>
      ) : (
        <div className="dal-status">No constructability-aware snap available. Geocode and certified inventory attachment authority are required before snap review.</div>
      )}
      <div className="dal-status">Candidate {"->"} Attachment Candidates {"->"} Selected Attachment {"->"} Constraint Evidence {"->"} Certified Snap must be visible before route geometry can be certified. Attachment authority comes only from certified network truth.</div>
    </div>
  );
}
