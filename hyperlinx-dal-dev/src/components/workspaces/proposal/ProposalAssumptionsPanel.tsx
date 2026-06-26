import type { PreliminaryQuotePackage } from "../../../proposal/PreliminaryQuotePackage";

export default function ProposalAssumptionsPanel({ quotePackage }: { quotePackage: PreliminaryQuotePackage | null }) {
  return (
    <section className="dal-panel">
      <div className="dal-panel-title-row">
        <h3>Assumptions & Disclaimers</h3>
        <span className="dal-badge warning">Non-contractual</span>
      </div>
      {!quotePackage ? (
        <div className="dal-status">Assumptions appear after preliminary quote generation.</div>
      ) : (
        <>
          <div className="dal-list">
            {quotePackage.assumptions.map((assumption) => (
              <div className="dal-list-row teralinx-list-row" key={assumption}>
                <b>Assumption</b>
                <small>{assumption}</small>
              </div>
            ))}
          </div>
          <details>
            <summary>Disclaimers</summary>
            <pre className="dal-pre">{JSON.stringify(quotePackage.disclaimers, null, 2)}</pre>
          </details>
        </>
      )}
    </section>
  );
}
