import type { TeralinxRouteIntake } from "../../../teralinx/TeralinxRouteIntake";
import { formatProtectionClass } from "../../../designDoctrine/ProtectionClass";

export default function NetworkIntentPanel({ intake }: { intake: TeralinxRouteIntake }) {
  const { intent } = intake.routeRequest;

  return (
    <section className="dal-panel">
      <h3>Network Intent</h3>
      <div className="teralinx-facts">
        <span>Network Type</span>
        <b>{intent.networkType || "Missing"}</b>
        <span>Protection</span>
        <b>{intent.protection ? formatProtectionClass(intent.protection, intent.networkType) : "Missing"}</b>
        <span>Primary Product</span>
        <b>{intent.primaryProduct || "Missing"}</b>
      </div>
    </section>
  );
}
