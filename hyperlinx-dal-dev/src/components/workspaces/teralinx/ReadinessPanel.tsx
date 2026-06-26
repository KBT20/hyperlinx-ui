import type { TeralinxRouteIntake } from "../../../teralinx/TeralinxRouteIntake";

export default function ReadinessPanel({ intake }: { intake: TeralinxRouteIntake }) {
  return (
    <section className="dal-panel">
      <div className="dal-panel-title-row">
        <h3>Readiness</h3>
        <span className={`dal-badge ${intake.readiness === "READY_FOR_DESIGN" ? "pass" : "fail"}`}>{intake.readiness.replaceAll("_", " ")}</span>
      </div>

      <div className="dal-list">
        {intake.blockers.map((blocker) => (
          <div className="dal-list-row teralinx-list-row" key={blocker.blockerId}>
            <b>{blocker.blockerType.replaceAll("_", " ")}</b>
            <span>BLOCKER</span>
            <small>{blocker.message} Required: {blocker.requiredAction}</small>
          </div>
        ))}
        {!intake.blockers.length && <div className="dal-status">Ready for Design handoff.</div>}
      </div>

      <details>
        <summary>Diagnostics</summary>
        <pre className="dal-pre">{JSON.stringify(intake.diagnostics, null, 2)}</pre>
      </details>
    </section>
  );
}
