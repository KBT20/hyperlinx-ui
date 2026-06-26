import type { EngineeringHandoffCandidate, PreliminaryQuotePackage } from "../../../proposal/PreliminaryQuotePackage";
import type { QuoteReadiness } from "../../../proposal/QuoteReadiness";

export default function ProposalReadinessPanel({
  quotePackage,
  readiness,
  handoffCandidate,
}: {
  quotePackage: PreliminaryQuotePackage | null;
  readiness: QuoteReadiness;
  handoffCandidate: EngineeringHandoffCandidate | null;
}) {
  return (
    <section className="dal-panel">
      <div className="dal-panel-title-row">
        <h3>Quote Readiness</h3>
        <span className={`dal-badge ${readiness === "READY_FOR_CUSTOMER" || readiness === "CUSTOMER_ACCEPTED" ? "pass" : readiness === "BLOCKED" ? "fail" : "warning"}`}>
          {readiness.replaceAll("_", " ")}
        </span>
      </div>

      {!quotePackage ? (
        <div className="dal-status">Generate a preliminary quote to evaluate customer readiness.</div>
      ) : quotePackage.blockers.length ? (
        <div className="dal-list">
          {quotePackage.blockers.map((blocker) => (
            <div className="dal-list-row teralinx-list-row" key={blocker.blockerId}>
              <b>{blocker.blockerType.replaceAll("_", " ")}</b>
              <span>BLOCKER</span>
              <small>
                {blocker.message} Required: {blocker.requiredAction}
              </small>
            </div>
          ))}
        </div>
      ) : (
        <div className="dal-status">Proposal is ready for customer review. Engineering handoff remains blocked until customer acceptance.</div>
      )}

      {handoffCandidate && (
        <details>
          <summary>Engineering handoff candidate</summary>
          <pre className="dal-pre">{JSON.stringify(handoffCandidate, null, 2)}</pre>
        </details>
      )}

      <details>
        <summary>Quote diagnostics</summary>
        <pre className="dal-pre">{JSON.stringify(quotePackage?.diagnostics ?? [], null, 2)}</pre>
      </details>
    </section>
  );
}
