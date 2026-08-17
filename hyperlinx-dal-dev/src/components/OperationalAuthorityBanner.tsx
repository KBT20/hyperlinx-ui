import { useEffect, useState } from "react";
import { loadOperationalProjection, type OperationalLensId, type OperationalProjection } from "../api/operationalBaseline";

type Props = { scopeVersionId?: string; lensId: OperationalLensId };

export default function OperationalAuthorityBanner({ scopeVersionId, lensId }: Props) {
  const [projection, setProjection] = useState<OperationalProjection | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setProjection(null);
    setError("");
    if (!scopeVersionId) return () => { active = false; };
    void loadOperationalProjection(scopeVersionId, lensId)
      .then((next) => { if (active) setProjection(next); })
      .catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : String(reason)); });
    return () => { active = false; };
  }, [lensId, scopeVersionId]);

  if (!scopeVersionId) return <div className="dal-status warning">Select an authorized ScopeVersion to enter {lensId}.</div>;
  if (error) return <div className="dal-status fail">Execution authority unavailable: {error}</div>;
  if (!projection) return <div className="dal-status">Resolving server-authoritative Operational Baseline…</div>;
  return (
    <div className="dal-panel operational-authority-banner" aria-label={`${lensId} execution authority`}>
      <div className="dal-panel-title-row">
        <div><span className="engineering-review-eyebrow">{lensId} · Order for Execution</span><h3>{projection.project.accountName || projection.project.customerId || "Authorized project"}</h3><small>{projection.project.opportunityName || projection.project.opportunityId}</small></div>
        <span className="dal-badge pass">AUTHORIZED FOR EXECUTION</span>
      </div>
      <div className="dal-metrics">
        <span>ScopeVersion: {projection.executionAuthority.scopeVersionId}</span>
        <span>Route: {projection.route.id} · R{projection.route.revision}</span>
        <span>Stations: {projection.authorityCensus.stations.toLocaleString()}</span>
        <span>Objects: {projection.authorityCensus.objects.toLocaleString()}</span>
        <span>Work segments: {projection.authorityCensus.workSegments.toLocaleString()}</span>
        <span>State: AUTHORIZED · NOT REALIZED</span>
      </div>
      <small>Baseline {projection.baselineIdentity.operationalBaselineHash.slice(0, 16)} · governed Close is the only realized-spine mutation authority.</small>
    </div>
  );
}
