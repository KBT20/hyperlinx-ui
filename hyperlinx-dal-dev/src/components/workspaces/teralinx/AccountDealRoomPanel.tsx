import { useEffect, useMemo, useState } from "react";
import { loadAccountCustomerTwin, type AccountCustomerTwin } from "../../../api/teralinxRuntime";
import { useTeralinxAuth } from "../../../identity/TeralinxAuth";
import { MapKernel, renderSharedOpportunityMapProjection, type SharedOpportunityMapProjection } from "../../../mapkernel";

export default function AccountDealRoomPanel({ accountId }: { accountId: string }) {
  const { session } = useTeralinxAuth();
  const [twin, setTwin] = useState<AccountCustomerTwin | null>(null);
  const [status, setStatus] = useState("Loading governed deals...");
  const [selectedDealId, setSelectedDealId] = useState("");
  const [previewCustomerView, setPreviewCustomerView] = useState(false);
  const selectedDeal = twin?.deals.find((deal) => deal.dealId === selectedDealId) ?? twin?.deals[0] ?? null;
  const previewSpec = useMemo(() => {
    const route = selectedDeal?.customerSafe.route;
    if (!selectedDeal || !route || selectedDeal.customerSafe.lineage.status !== "PASS" || route.coordinates.length < 2) return null;
    const projection: SharedOpportunityMapProjection = { authority: "COMMERCIAL_ROUTE_REPOSITORY", projectionPurpose: "SHARED_OPPORTUNITY_MAP", opportunityId: selectedDeal.opportunityId, routeRepositoryId: String(route.routeRepositoryId), routeRevision: Number(route.routeRevision), routeGeometryId: String(route.routeGeometryId), geometryHash: String(route.geometryHash), routeMiles: Number(route.routeMiles), orientation: "A_TO_Z", coordinates: route.coordinates, endpoints: [{ role: "A", label: "Site A", coordinate: route.coordinates[0], coordinateSource: "COMMERCIAL_ROUTE_REPOSITORY" }, { role: "Z", label: "Site Z", coordinate: route.coordinates.at(-1)!, coordinateSource: "COMMERCIAL_ROUTE_REPOSITORY" }], responseProjectionOnly: true };
    return renderSharedOpportunityMapProjection(projection);
  }, [selectedDeal]);
  async function refresh() {
    if (!accountId) return;
    try { setTwin(await loadAccountCustomerTwin(accountId, session)); setStatus(""); }
    catch (error) { setTwin(null); setStatus(error instanceof Error ? error.message : String(error)); }
  }
  useEffect(() => { void refresh(); }, [accountId, session?.session?.sessionId]);
  return <section className="dal-panel account-deal-room" aria-label="Account Customer Twin governed deal room">
    <div className="dal-panel-title-row"><div><h3>Governed Deal Room</h3><small>Account → Customer Twin → governed deals</small></div><div className="dal-actions"><button type="button" onClick={() => setPreviewCustomerView((value) => !value)}>{previewCustomerView ? "Close Customer Preview" : "Preview Customer View"}</button><button type="button" onClick={() => void refresh()}>Refresh</button></div></div>
    {twin ? <>
      <div className="account-deal-room-summary"><span>Customer Twin<b>{twin.customerTwinId}</b></span><span>Account<b>{twin.account.name}</b></span><span>Deals<b>{twin.dealCount}</b></span><span>Authority<b>Read-only projection</b></span></div>
      {twin.tasks.length ? <div className="account-deal-room-tasks">{twin.tasks.map((task) => <button type="button" key={task.taskType} onClick={() => task.dealIds[0] && setSelectedDealId(task.dealIds[0])}><b>{task.count}</b><span>{task.label}</span></button>)}</div> : null}
      <div className="account-deal-room-list">{twin.deals.length ? twin.deals.map((deal) => <article key={deal.dealId}>
        <header><div><small>OPPORTUNITY</small><h4>{deal.title}</h4><code>{deal.opportunityId}</code></div><span className="dal-badge pass">{deal.currentState.replaceAll("_", " ")}</span></header>
        <div className="account-deal-room-progress">{deal.lifecycle.map((step) => <span className={step.status.toLowerCase()} title={step.name.replaceAll("_", " ")} key={step.name} />)}</div>
        <div className="account-deal-room-facts"><span>Proposal<b>{deal.commercial.proposalRevisionId ?? "Not created"}</b></span><span>Route<b>{deal.spatial.routeRepositoryId ?? "Not governed"}</b></span><span>Engineering<b>{deal.engineering.certifiedPackageId ?? deal.engineering.engineeringPackageId ?? "Not started"}</b></span><span>Contract<b>{deal.contractual.scopeVersionId ?? deal.contractual.serviceOrderId ?? "Not created"}</b></span></div>
        <div className="customer-permitted-actions"><small>PERMITTED NOW</small>{deal.permittedActions.map((action) => <span className={action.mutation ? "governed" : "read"} key={action.action}>{action.label}</span>)}</div>
        <button type="button" onClick={() => { setSelectedDealId(deal.dealId); setPreviewCustomerView(true); }}>Open Deal Room</button>
      </article>) : <div className="dal-status">No governed deals are associated with this Account yet.</div>}</div>
      {previewCustomerView && selectedDeal ? <section className="internal-customer-preview"><header><div><small>READ-ONLY CUSTOMER PERSPECTIVE PREVIEW</small><h4>{selectedDeal.title}</h4></div><span className="dal-badge warning">NO CUSTOMER AUTHORITY</span></header><p>The authenticated internal actor remains {session?.user.name}. Customer-only actions are intentionally unavailable.</p>{previewSpec ? <MapKernel specs={[previewSpec]} height={480} initialMode="geographic" presentationProfile="commercialPlanner" mapLens="CUSTOMER" /> : <div className="dal-status warning">Exact Proposal-bound spine unavailable; preview map is blocked.</div>}<div className="account-deal-room-facts"><span>State<b>{selectedDeal.currentState.replaceAll("_", " ")}</b></span><span>Product<b>{selectedDeal.customerSafe.product.name}</b></span><span>Route<b>{selectedDeal.customerSafe.route.routeMiles != null ? `${selectedDeal.customerSafe.route.routeMiles.toFixed(2)} miles` : "Not provided"}</b></span><span>Proposal<b>{selectedDeal.commercial.proposalRevisionId ?? "Not created"}</b></span></div></section> : null}
    </> : <div className="dal-status">{status}</div>}
  </section>;
}
