import { useEffect, useState } from "react";
import { loadAccountCustomerTwin, type AccountCustomerTwin } from "../../../api/teralinxRuntime";
import { useTeralinxAuth } from "../../../identity/TeralinxAuth";

export default function AccountDealRoomPanel({ accountId }: { accountId: string }) {
  const { session } = useTeralinxAuth();
  const [twin, setTwin] = useState<AccountCustomerTwin | null>(null);
  const [status, setStatus] = useState("Loading governed deals...");
  async function refresh() {
    if (!accountId) return;
    try { setTwin(await loadAccountCustomerTwin(accountId, session)); setStatus(""); }
    catch (error) { setTwin(null); setStatus(error instanceof Error ? error.message : String(error)); }
  }
  useEffect(() => { void refresh(); }, [accountId, session?.session?.sessionId]);
  return <section className="dal-panel account-deal-room" aria-label="Account Customer Twin governed deal room">
    <div className="dal-panel-title-row"><div><h3>Governed Deal Room</h3><small>Account → Customer Twin → governed deals</small></div><button type="button" onClick={() => void refresh()}>Refresh</button></div>
    {twin ? <>
      <div className="account-deal-room-summary"><span>Customer Twin<b>{twin.customerTwinId}</b></span><span>Account<b>{twin.account.name}</b></span><span>Deals<b>{twin.dealCount}</b></span><span>Authority<b>Read-only projection</b></span></div>
      <div className="account-deal-room-list">{twin.deals.length ? twin.deals.map((deal) => <article key={deal.dealId}>
        <header><div><small>OPPORTUNITY</small><h4>{deal.title}</h4><code>{deal.opportunityId}</code></div><span className="dal-badge pass">{deal.currentState.replaceAll("_", " ")}</span></header>
        <div className="account-deal-room-progress">{deal.lifecycle.map((step) => <span className={step.status.toLowerCase()} title={step.name.replaceAll("_", " ")} key={step.name} />)}</div>
        <div className="account-deal-room-facts"><span>Proposal<b>{deal.commercial.proposalRevisionId ?? "Not created"}</b></span><span>Route<b>{deal.spatial.routeRepositoryId ?? "Not governed"}</b></span><span>Engineering<b>{deal.engineering.certifiedPackageId ?? deal.engineering.engineeringPackageId ?? "Not started"}</b></span><span>Contract<b>{deal.contractual.scopeVersionId ?? deal.contractual.serviceOrderId ?? "Not created"}</b></span></div>
        <div className="customer-permitted-actions"><small>PERMITTED NOW</small>{deal.permittedActions.map((action) => <span className={action.mutation ? "governed" : "read"} key={action.action}>{action.label}</span>)}</div>
      </article>) : <div className="dal-status">No governed deals are associated with this Account yet.</div>}</div>
    </> : <div className="dal-status">{status}</div>}
  </section>;
}
