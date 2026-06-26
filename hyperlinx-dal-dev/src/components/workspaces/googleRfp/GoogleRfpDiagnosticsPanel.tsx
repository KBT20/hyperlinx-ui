import type { GoogleRfpBidPlan } from "../../../rfp/GoogleRfpBidPlan";
import { googleHeliumRfpDoctrine } from "../../../rfp/GoogleRfpDoctrine";

export default function GoogleRfpDiagnosticsPanel({ bidPlan }: { bidPlan: GoogleRfpBidPlan }) {
  return (
    <section className="dal-panel">
      <div className="dal-panel-title-row">
        <h3>Diagnostics</h3>
        <span className="dal-badge warning">Collapsed</span>
      </div>
      <details>
        <summary>Doctrine and artifact structure</summary>
        <pre className="dal-pre">{JSON.stringify(googleHeliumRfpDoctrine, null, 2)}</pre>
      </details>
      <details>
        <summary>Bid plan diagnostics</summary>
        <pre className="dal-pre">{JSON.stringify(bidPlan, null, 2)}</pre>
      </details>
    </section>
  );
}
