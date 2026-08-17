import { useEffect, useMemo, useState } from "react";
import { listGovernedAccounts, type GovernedAccount } from "../api/accountLibrary";
import { downloadRuntimeArtifact, loadAccountCustomerTwin, type AccountCustomerTwin } from "../api/teralinxRuntime";
import { useDALState } from "../dal/DALState";
import { useTeralinxAuth } from "../identity/TeralinxAuth";
import MapKernel from "../mapkernel/MapKernel";
import { renderSharedOpportunityMapProjection, type SharedOpportunityMapProjection } from "../mapkernel/SharedOpportunityMapProjection";

type Deal = AccountCustomerTwin["deals"][number];
type DealTab = "Overview" | "Proposal" | "Service Order" | "Specifications" | "Documents" | "Activity";

function money(value: unknown, currency = "USD") {
  return value == null ? "Not provided" : new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(Number(value));
}

function governedMapSpec(deal: Deal | null) {
  const route = deal?.customerSafe.route;
  if (!deal || !route || deal.customerSafe.lineage.status !== "PASS" || route.coordinates.length < 2) return null;
  const projection: SharedOpportunityMapProjection = {
    authority: "COMMERCIAL_ROUTE_REPOSITORY",
    projectionPurpose: "SHARED_OPPORTUNITY_MAP",
    opportunityId: deal.opportunityId,
    routeRepositoryId: String(route.routeRepositoryId),
    routeRevision: Number(route.routeRevision),
    routeGeometryId: String(route.routeGeometryId),
    geometryHash: String(route.geometryHash),
    routeMiles: Number(route.routeMiles),
    orientation: "A_TO_Z",
    coordinates: route.coordinates,
    endpoints: [
      { role: "A", label: "Site A", coordinate: route.coordinates[0], coordinateSource: "COMMERCIAL_ROUTE_REPOSITORY" },
      { role: "Z", label: "Site Z", coordinate: route.coordinates.at(-1)!, coordinateSource: "COMMERCIAL_ROUTE_REPOSITORY" },
    ],
    responseProjectionOnly: true,
  };
  return renderSharedOpportunityMapProjection(projection);
}

function replaceCustomerLocation(accountId: string, opportunityId = "") {
  const url = new URL(window.location.href);
  url.searchParams.set("workspace", "customerView");
  if (accountId) url.searchParams.set("accountId", accountId); else url.searchParams.delete("accountId");
  if (opportunityId) url.searchParams.set("opportunityId", opportunityId); else url.searchParams.delete("opportunityId");
  window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
}

export default function CustomerWorkspace() {
  const { session } = useTeralinxAuth();
  const { setWorkspace } = useDALState();
  const initial = useMemo(() => new URLSearchParams(window.location.search), []);
  const [accounts, setAccounts] = useState<GovernedAccount[]>([]);
  const [accountId, setAccountId] = useState(initial.get("accountId") ?? "");
  const [opportunityId, setOpportunityId] = useState(initial.get("opportunityId") ?? "");
  const [twin, setTwin] = useState<AccountCustomerTwin | null>(null);
  const [tab, setTab] = useState<DealTab>("Overview");
  const [status, setStatus] = useState("Loading governed Accounts...");
  const selectedAccount = accounts.find((account) => account.accountId === accountId) ?? null;
  const selectedDeal = twin?.deals.find((deal) => deal.opportunityId === opportunityId) ?? null;
  const mapSpec = useMemo(() => governedMapSpec(selectedDeal), [selectedDeal]);

  useEffect(() => {
    let cancelled = false;
    listGovernedAccounts().then((records) => {
      if (cancelled) return;
      setAccounts(records);
      setStatus(records.length ? "Select an Account to open its persistent Customer Twin." : "No governed Accounts are available to this identity.");
      if (accountId && !records.some((account) => account.accountId === accountId)) {
        setAccountId(""); setOpportunityId(""); replaceCustomerLocation("");
      }
    }).catch((error) => { if (!cancelled) setStatus(error instanceof Error ? error.message : String(error)); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!accountId) { setTwin(null); return; }
    let cancelled = false;
    setStatus("Resolving Account Customer Twin from governed repositories...");
    loadAccountCustomerTwin(accountId, session).then((projection) => {
      if (cancelled) return;
      setTwin(projection);
      if (opportunityId && !projection.deals.some((deal) => deal.opportunityId === opportunityId)) {
        setOpportunityId(""); replaceCustomerLocation(accountId);
      }
      setStatus(projection.dealCount ? "" : "This Account has no persisted governed Opportunities yet.");
    }).catch((error) => { if (!cancelled) { setTwin(null); setStatus(error instanceof Error ? error.message : String(error)); } });
    return () => { cancelled = true; };
  }, [accountId, session?.session?.sessionId]);

  function selectAccount(nextAccountId: string) {
    setAccountId(nextAccountId); setOpportunityId(""); setTwin(null); setTab("Overview");
    replaceCustomerLocation(nextAccountId);
  }

  function selectDeal(nextOpportunityId: string) {
    setOpportunityId(nextOpportunityId); setTab("Overview");
    replaceCustomerLocation(accountId, nextOpportunityId);
  }

  function startOpportunity() {
    const url = new URL(window.location.href);
    url.searchParams.set("accountId", accountId);
    url.searchParams.delete("opportunityId");
    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
    setWorkspace("googleRfp");
  }

  const groupedDeals = twin ? twin.lifecycleStates.map((state) => ({ state, deals: twin.deals.filter((deal) => deal.currentState === state) })).filter((group) => group.deals.length) : [];
  const proposalDocuments = selectedDeal?.documentHistory.filter((document) => document.documentType === "PROPOSAL") ?? [];

  return <div className="customer-portal-shell internal-customer-workspace">
    <header className="customer-portal-header">
      <div><div className="dal-kicker">TERALINX CUSTOMER TWIN</div><h1>Customer View</h1><small>Account-centric governed Deal Room</small></div>
      <label className="customer-account-selector"><span>Account</span><select aria-label="Select Customer Account" value={accountId} onChange={(event) => selectAccount(event.currentTarget.value)}><option value="">Select Account</option>{accounts.map((account) => <option key={account.accountId} value={account.accountId}>{account.name}</option>)}</select></label>
      <div className="customer-account"><span>{session?.user.name}</span><small>Internal customer perspective</small></div>
    </header>
    <div className="customer-internal-banner">INTERNAL CUSTOMER VIEW · NO CUSTOMER AUTHORITY · READS GOVERNED SERVER AUTHORITY</div>
    {!selectedAccount ? <main className="customer-portal-page customer-account-entry"><h2>Select an Account</h2><p>Customer View begins with the governed Account. No customer or deal is inferred from browser history or recency.</p>{status ? <div className="dal-status">{status}</div> : null}</main> :
      <main className="customer-portal-main">
        <aside className="customer-project-list">
          <div><span>{selectedAccount.name}</span><b>{twin?.dealCount ?? 0}</b></div>
          {groupedDeals.map((group) => <section className="customer-deal-group" key={group.state}><small>{group.state.replaceAll("_", " ")}</small>{group.deals.map((deal) => <button className={selectedDeal?.dealId === deal.dealId ? "active" : ""} key={deal.dealId} onClick={() => selectDeal(deal.opportunityId)}><b>{deal.title}</b><span>{deal.customerSafe.product.name}</span><code>{deal.opportunityId}</code></button>)}</section>)}
          <button className="customer-new-opportunity" type="button" onClick={startOpportunity}>+ New Opportunity</button>
          {status ? <div className="dal-status">{status}</div> : null}
        </aside>
        <section className="customer-project">
          {!selectedDeal ? <div className="customer-empty"><h2>{twin?.customerTwinId}</h2><p>Select an existing Opportunity to rehydrate its exact governed customer-facing lineage.</p></div> : <>
            <div className="customer-project-heading"><div><small>{selectedAccount.name} · {selectedDeal.opportunityId}</small><h2>{selectedDeal.title}</h2><p>{selectedDeal.summary}</p></div><span>{selectedDeal.currentState.replaceAll("_", " ")}</span></div>
            <section className="customer-deal-lifecycle"><div className="customer-deal-lifecycle-heading"><div><small>CURRENT GOVERNED STATE</small><strong>{selectedDeal.currentState.replaceAll("_", " ")}</strong></div><span>{twin?.customerTwinId}</span></div><ol>{selectedDeal.lifecycle.map((step) => <li className={step.status.toLowerCase()} key={step.name}><i /><span>{step.name.replaceAll("_", " ")}</span></li>)}</ol></section>
            <section className="customer-map-centerpiece"><div className="customer-map-state"><div><small>GOVERNED SPINE</small><strong>{selectedDeal.currentState === "AUTHORIZED" ? "AUTHORIZED" : selectedDeal.currentState.replaceAll("_", " ")}</strong><span>Route Revision {selectedDeal.customerSafe.route.routeRevision ?? "unresolved"}</span></div><span className={`dal-badge ${selectedDeal.customerSafe.lineage.status === "PASS" ? "pass" : "fail"}`}>{selectedDeal.customerSafe.lineage.status === "PASS" ? "EXACT GOVERNED ROUTE" : "MAP BLOCKED · LINEAGE MISMATCH"}</span></div><div className="customer-map-card">{mapSpec ? <MapKernel specs={[mapSpec]} height={500} initialMode="geographic" presentationProfile="commercialPlanner" mapLens="CUSTOMER" /> : <div className="dal-status warning">The exact governed route revision, geometry ID, and geometry hash could not be resolved. No substitute route is displayed.</div>}</div><div className="customer-map-economics"><span>Route repository<strong>{selectedDeal.customerSafe.route.routeRepositoryId ?? "Unresolved"}</strong></span><span>Geometry ID<strong>{selectedDeal.customerSafe.route.routeGeometryId ?? "Unresolved"}</strong></span><span>Geometry hash<strong>{selectedDeal.customerSafe.route.geometryHash ?? "Unresolved"}</strong></span><span>Distance<strong>{selectedDeal.customerSafe.route.routeMiles != null ? `${selectedDeal.customerSafe.route.routeMiles.toFixed(2)} miles` : "Not provided"}</strong></span></div></section>
            <nav className="customer-project-tabs">{(["Overview", "Proposal", "Service Order", "Specifications", "Documents", "Activity"] as DealTab[]).map((item) => <button className={tab === item ? "active" : ""} key={item} onClick={() => setTab(item)}>{item}</button>)}</nav>
            {tab === "Overview" ? <div className="customer-overview-grid"><article><small>PRODUCT</small><strong>{selectedDeal.customerSafe.product.name}</strong><span>{selectedDeal.customerSafe.product.description ?? "No governed description"}</span></article><article><small>COMMERCIAL</small><strong>{money(selectedDeal.customerSafe.economics.nrc, selectedDeal.customerSafe.economics.currency)} NRC</strong><span>{money(selectedDeal.customerSafe.economics.mrc, selectedDeal.customerSafe.economics.currency)} MRC · {selectedDeal.customerSafe.economics.termMonths ?? "—"} months</span></article><article><small>CURRENT ACTION</small><strong>{selectedDeal.permittedActions.find((action) => action.mutation)?.label ?? "No internal action pending"}</strong><span>Customer authority is unavailable in this workspace.</span></article><article className="wide"><small>EXACT LINEAGE</small><div className="customer-document-grid"><span>Opportunity state<strong>v{selectedDeal.workingOpportunity.stateVersion ?? "—"}</strong></span><span>Proposal revision<strong>{selectedDeal.commercial.proposalRevisionId ?? "Not created"}</strong></span><span>Certified IOF<strong>{selectedDeal.engineering.certifiedPackageId ?? "Not certified"}</strong></span><span>ScopeVersion<strong>{selectedDeal.contractual.scopeVersionId ?? "Not authorized"}</strong></span></div></article></div> : null}
            {tab === "Proposal" ? <article className="customer-governed-document customer-proposal-card"><header><div><small>IMMUTABLE PROPOSAL REVISION</small><h3>{selectedDeal.title}</h3></div><div><b>Revision {selectedDeal.commercial.proposalRevisionNumber ?? "—"}</b><span>{selectedDeal.currentState === "AUTHORIZED" ? "HISTORICAL · ACCEPTED" : selectedDeal.currentState.replaceAll("_", " ")}</span></div></header><div className="customer-document-actions"><button onClick={() => window.print()}>Print Proposal</button>{selectedDeal.commercial.proposalId && selectedDeal.commercial.proposalRevisionId ? <button className="primary" onClick={() => void downloadRuntimeArtifact(`/api/exports/proposals/${encodeURIComponent(selectedDeal.commercial.proposalId!)}/revisions/${encodeURIComponent(selectedDeal.commercial.proposalRevisionId!)}/pdf`)}>Download Proposal PDF</button> : null}</div><div className="customer-document-grid"><span>Proposal Revision ID<strong>{selectedDeal.commercial.proposalRevisionId ?? "Unresolved"}</strong></span><span>Proposal Hash<strong>{selectedDeal.commercial.proposalHash ?? "Unresolved"}</strong></span><span>Bound Route Revision<strong>{selectedDeal.customerSafe.route.routeRevision ?? "Unresolved"}</strong></span><span>Bound Geometry Hash<strong>{selectedDeal.customerSafe.route.geometryHash ?? "Unresolved"}</strong></span></div><h4>Revision history</h4>{proposalDocuments.map((document) => <div className="customer-history-document" key={document.documentId}><div><b>Proposal Revision {document.revision ?? "—"}</b><span>{document.status.replaceAll("_", " ")}</span><code>{document.documentId}</code></div><code>{document.authorityHash}</code></div>)}</article> : null}
            {tab === "Service Order" ? selectedDeal.contractual.serviceOrderId ? <article className="customer-governed-document customer-proposal-card"><header><div><small>GOVERNED SERVICE ORDER</small><h3>{selectedDeal.title}</h3></div><div><b>{selectedDeal.contractual.serviceOrderStatus?.replaceAll("_", " ")}</b></div></header>{selectedDeal.customerSafe.contracting.demoLegalClassification ? <div className="customer-demo-legal">DEMO PLACEHOLDER · NOT APPROVED TERALINX LEGAL TERMS · NOT PRODUCTION ELIGIBLE</div> : null}<div className="customer-document-actions"><button onClick={() => window.print()}>Print Service Order</button><button className="primary" onClick={() => void downloadRuntimeArtifact(`/api/exports/service-orders/${encodeURIComponent(selectedDeal.contractual.serviceOrderId!)}/pdf`)}>Download Service Order PDF</button></div><div className="customer-document-grid"><span>Service Order ID<strong>{selectedDeal.contractual.serviceOrderId}</strong></span><span>Document hash<strong>{selectedDeal.contractual.documentHash ?? "Unresolved"}</strong></span><span>Contract mode<strong>{selectedDeal.customerSafe.contracting.mode.replaceAll("_", " ")}</strong></span><span>ScopeVersion<strong>{selectedDeal.contractual.scopeVersionId ?? "Not authorized"}</strong></span></div></article> : <div className="customer-proposal-card"><h3>Service Order</h3><p>No governed Service Order exists for this Opportunity.</p></div> : null}
            {tab === "Specifications" ? <div className="customer-proposal-card"><h3>Customer-Facing Specifications</h3><div className="customer-document-grid">{Object.entries(selectedDeal.customerSafe.specifications).map(([key, value]) => <span key={key}>{key.replaceAll(/([A-Z])/g, " $1").replaceAll("_", " ")}<strong>{Array.isArray(value) ? value.join(", ") || "Not provided" : value == null || value === "" ? "Not provided" : String(value)}</strong></span>)}</div><h4>Product Doctrine lineage</h4><div className="customer-document-grid"><span>Doctrine ID<strong>{selectedDeal.customerSafe.doctrineLineage.productDoctrineId ?? "Not exposed"}</strong></span><span>Version<strong>{selectedDeal.customerSafe.doctrineLineage.productDoctrineVersion ?? "Not exposed"}</strong></span><span>Hash<strong>{selectedDeal.customerSafe.doctrineLineage.productDoctrineHash ?? "Not exposed"}</strong></span></div></div> : null}
            {tab === "Documents" ? <div className="customer-proposal-card"><h3>Governed Documents and References</h3>{selectedDeal.documentHistory.map((document) => <article className="customer-history-document" key={`${document.documentType}:${document.documentId}`}><div><b>{document.documentType.replaceAll("_", " ")} · Revision {document.revision ?? "—"}</b><span>{document.status.replaceAll("_", " ")}</span><code>{document.documentId}</code></div><code>{document.authorityHash}</code></article>)}{selectedDeal.customerSafe.contracting.customerPaperReferences.map((reference, index) => <article className="customer-history-document" key={`customer-paper-${index}`}><div><b>Customer-provided agreement/reference</b><code>{JSON.stringify(reference)}</code></div></article>)}</div> : null}
            {tab === "Activity" ? <div className="customer-proposal-card"><h3>Governed activity</h3><p>Current state and last governed modification are derived from repository evidence.</p><div className="customer-document-grid"><span>Last governed modification<strong>{selectedDeal.updatedAt ? new Date(selectedDeal.updatedAt).toLocaleString() : "Not provided"}</strong></span><span>Modified by<strong>{selectedDeal.workingOpportunity.modifiedBy ?? "Not provided"}</strong></span><span>Opportunity state hash<strong>{selectedDeal.workingOpportunity.stateHash ?? "Not provided"}</strong></span><span>Projection authority<strong>{twin?.projectionAuthority}</strong></span></div></div> : null}
          </>}
        </section>
      </main>}
  </div>;
}
