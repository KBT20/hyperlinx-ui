import { useEffect, useMemo, useState } from "react";
import { listGovernedAccounts, type GovernedAccount } from "../api/accountLibrary";
import { assembleDraftIofPackageFromProposal, downloadRuntimeArtifact, loadAccountCustomerTwin, submitDraftIofPackageToEngineering, type AccountCustomerTwin } from "../api/teralinxRuntime";
import { useDALState } from "../dal/DALState";
import { useTeralinxAuth } from "../identity/TeralinxAuth";
import MapKernel from "../mapkernel/MapKernel";
import { renderSharedOpportunityMapProjection, type SharedOpportunityMapProjection } from "../mapkernel/SharedOpportunityMapProjection";

type Deal = AccountCustomerTwin["deals"][number];
type DealTab = "Overview" | "Proposal" | "Engineering" | "Service Order" | "Documents" | "Activity";

function money(value: unknown, currency = "USD") {
  return value == null ? "Not provided" : new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(Number(value));
}

function label(value: unknown, fallback = "Not created") {
  const result = String(value ?? "").trim();
  return result ? result.replaceAll("_", " ") : fallback;
}

function humanizeGovernedError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  if (/CUSTOMER_ACCEPTANCE_REQUIRED|customer-approved Proposal/i.test(message)) return "The customer has not accepted the current Proposal. Engineering cannot begin yet.";
  if (/STALE_PROPOSAL|no longer represents|opportunityStateHash/i.test(message)) return "This Proposal no longer represents the current commercial Opportunity. Create a new Proposal Revision before continuing.";
  if (/routeRevision|geometryHash|route.*stale/i.test(message)) return "The governed route changed after this Proposal was created. Review the route and create the required Proposal Revision.";
  if (/Product Doctrine|doctrine/i.test(message)) return "Product Doctrine Assembly is incomplete. Open Technical Details for the governing predicate.";
  return message;
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

function replaceCommercialLocation(accountId: string, opportunityId: string) {
  const url = new URL(window.location.href);
  url.searchParams.set("workspace", "googleRfp");
  url.searchParams.set("accountId", accountId);
  url.searchParams.set("opportunityId", opportunityId);
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
    }).catch((error) => { if (!cancelled) setStatus(humanizeGovernedError(error)); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!accountId) { setTwin(null); return; }
    let cancelled = false;
    setStatus("Loading the governed Customer Twin...");
    loadAccountCustomerTwin(accountId, session).then((projection) => {
      if (cancelled) return;
      setTwin(projection);
      if (opportunityId && !projection.deals.some((deal) => deal.opportunityId === opportunityId)) {
        setOpportunityId(""); replaceCustomerLocation(accountId);
      }
      setStatus(projection.dealCount ? "" : "This Account has no persisted governed Opportunities yet.");
    }).catch((error) => { if (!cancelled) { setTwin(null); setStatus(humanizeGovernedError(error)); } });
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

  function continueCommercial() {
    if (!selectedDeal) return;
    replaceCommercialLocation(accountId, selectedDeal.opportunityId);
    setWorkspace("googleRfp");
  }

  async function sendToEngineering() {
    if (!selectedDeal?.commercial.proposalId || selectedDeal.currentState !== "ACCEPTED" || selectedDeal.artifactStates.customerAcceptance.state !== "COMPLETE") return;
    setStatus("Sending the exact accepted Proposal through the governed Engineering handoff...");
    try {
      const draft = await assembleDraftIofPackageFromProposal({ proposalId: selectedDeal.commercial.proposalId }, session);
      if (!draft.packageId) throw new Error("Draft IOF assembly returned no governed package identity.");
      await submitDraftIofPackageToEngineering(draft.packageId, {}, session);
      setTwin(await loadAccountCustomerTwin(accountId, session));
      setTab("Engineering");
      setStatus("The accepted commercial package was sent to Engineering.");
    } catch (error) {
      setStatus(`Unable to send to Engineering. ${humanizeGovernedError(error)}`);
    }
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
    {!selectedAccount ? <main className="customer-portal-page customer-account-entry"><h2>Select an Account</h2><p>Choose an Account to see every governed deal and its current lifecycle state.</p>{status ? <div className="dal-status">{status}</div> : null}</main> :
      <main className="customer-portal-main">
        <aside className="customer-project-list">
          <div><span>{selectedAccount.name}</span><b>{twin?.dealCount ?? 0} Deals</b></div>
          {groupedDeals.map((group) => <section className="customer-deal-group" key={group.state}><small>{label(group.state)}</small>{group.deals.map((deal) => <button className={selectedDeal?.dealId === deal.dealId ? "active" : ""} key={deal.dealId} onClick={() => selectDeal(deal.opportunityId)}><b>{deal.title}</b><span>{deal.customerSafe.product.name}</span></button>)}</section>)}
          <button className="customer-new-opportunity" type="button" onClick={startOpportunity}>+ New Opportunity</button>
        </aside>
        <section className="customer-project">
          {!selectedDeal ? <div className="customer-empty"><h2>{selectedAccount.name}</h2><p>Select a deal to open its governed route, commercial artifacts, and lifecycle.</p>{status ? <div className="dal-status">{status}</div> : null}</div> : <>
            <div className="customer-project-heading"><div><small>{selectedAccount.name} · GOVERNED DEAL</small><h2>{selectedDeal.title}</h2><p>{selectedDeal.summary}</p></div><span>{label(selectedDeal.currentState)}</span></div>
            <section className="customer-authority-header" aria-label="Deal authority summary">
              <span><small>DEAL STATE</small><strong>{label(selectedDeal.currentState)}</strong></span>
              <span><small>PROPOSAL</small><strong>R{selectedDeal.commercial.proposalRevisionNumber ?? "—"} · {label(selectedDeal.artifactStates.proposal.state)}</strong></span>
              <span><small>CUSTOMER</small><strong>{selectedDeal.artifactStates.customerAcceptance.state === "COMPLETE" ? "ACCEPTED" : label(selectedDeal.artifactStates.customerAcceptance.state)}</strong></span>
              <span><small>ENGINEERING</small><strong>{label(selectedDeal.artifactStates.engineering.eligibility)}</strong></span>
              <span><small>SERVICE ORDER</small><strong>{label(selectedDeal.artifactStates.serviceOrder.state)}</strong></span>
              <span><small>SCOPEVERSION</small><strong>{label(selectedDeal.artifactStates.scopeVersion.state)}</strong></span>
            </section>
            <section className="customer-deal-lifecycle"><div className="customer-deal-lifecycle-heading"><div><small>CURRENT GOVERNED STATE</small><strong>{label(selectedDeal.currentState)}</strong></div></div><ol>{selectedDeal.lifecycle.map((step) => <li className={step.status.toLowerCase()} key={step.name}><i /><span>{label(step.name)}</span></li>)}</ol></section>
            <section className="customer-map-centerpiece">
              <div className="customer-map-state"><div><small>GOVERNED ROUTE / SPINE</small><strong>{selectedDeal.customerSafe.route.routeMiles != null ? `${selectedDeal.customerSafe.route.routeMiles.toFixed(2)} miles` : "Route distance unavailable"}</strong><span>Route Revision {selectedDeal.customerSafe.route.routeRevision ?? "unresolved"} · Current</span></div><span className={`dal-badge ${selectedDeal.customerSafe.lineage.status === "PASS" ? "pass" : "fail"}`}>{selectedDeal.customerSafe.lineage.status === "PASS" ? "EXACT GOVERNED ROUTE" : "MAP BLOCKED · LINEAGE MISMATCH"}</span></div>
              <div className="customer-map-card">{mapSpec ? <MapKernel specs={[mapSpec]} height={500} initialMode="geographic" presentationProfile="commercialPlanner" mapLens="CUSTOMER" /> : <div className="dal-status warning">The exact governed route revision, geometry ID, and geometry hash could not be reconciled. No substitute route is displayed.</div>}</div>
              <div className="customer-map-economics"><span>Product<strong>{selectedDeal.customerSafe.product.name}</strong></span><span>NRC<strong>{money(selectedDeal.customerSafe.economics.nrc, selectedDeal.customerSafe.economics.currency)}</strong></span><span>MRC<strong>{money(selectedDeal.customerSafe.economics.mrc, selectedDeal.customerSafe.economics.currency)}</strong></span><span>Term<strong>{selectedDeal.customerSafe.economics.termMonths != null ? `${selectedDeal.customerSafe.economics.termMonths} months` : "Not provided"}</strong></span></div>
              <details className="customer-technical-details"><summary>Technical Details / Lineage</summary><div className="customer-document-grid"><span>Opportunity state<strong>v{selectedDeal.workingOpportunity.stateVersion ?? "—"}</strong><code>{selectedDeal.workingOpportunity.stateHash}</code></span><span>Proposal revision<strong>{selectedDeal.commercial.proposalRevisionId}</strong><code>{selectedDeal.commercial.proposalHash}</code></span><span>Route repository<strong>{selectedDeal.customerSafe.route.routeRepositoryId}</strong><code>Revision {selectedDeal.customerSafe.route.routeRevision}</code></span><span>Geometry<strong>{selectedDeal.customerSafe.route.routeGeometryId}</strong><code>{selectedDeal.customerSafe.route.geometryHash}</code></span></div></details>
            </section>
            <nav className="customer-project-tabs">{(["Overview", "Proposal", "Engineering", "Service Order", "Documents", "Activity"] as DealTab[]).map((item) => <button className={tab === item ? "active" : ""} key={item} onClick={() => setTab(item)}>{item}</button>)}</nav>
            {status ? <div className="customer-workflow-notice">{status}</div> : null}
            {tab === "Overview" ? <div className="customer-overview-grid">
              <article><small>PRODUCT</small><strong>{selectedDeal.customerSafe.product.name}</strong><span>{selectedDeal.customerSafe.product.description ?? "No governed description"}</span></article>
              <article><small>COMMERCIAL</small><strong>{money(selectedDeal.customerSafe.economics.nrc, selectedDeal.customerSafe.economics.currency)} NRC</strong><span>{money(selectedDeal.customerSafe.economics.mrc, selectedDeal.customerSafe.economics.currency)} MRC · {selectedDeal.customerSafe.economics.termMonths ?? "—"} months</span></article>
              <article><small>NEXT GOVERNED STEP</small><strong>{selectedDeal.currentState === "ACCEPTED" ? "Accepted — Engineering handoff underway" : selectedDeal.permittedActions.find((action) => action.mutation)?.label ?? (selectedDeal.currentState === "AUTHORIZED" ? "View ScopeVersion" : "No action required in this perspective")}</strong>{selectedDeal.currentState === "DRAFT" || selectedDeal.currentState === "PROPOSED" ? <button className="primary" type="button" onClick={continueCommercial}>Continue Commercial</button> : null}{selectedDeal.permittedActions.some((action) => action.action === "OPEN_COUNTERSIGNATURE") ? <button className="primary" type="button" onClick={() => setWorkspace("twin")}>Review Countersignature</button> : null}{selectedDeal.currentState === "AUTHORIZED" ? <button className="primary" type="button" onClick={() => setWorkspace("scopeVersion")}>View ScopeVersion</button> : null}</article>
              <article className="wide"><small>CUSTOMER-FACING SPECIFICATIONS</small><div className="customer-document-grid">{Object.entries(selectedDeal.customerSafe.specifications).map(([key, value]) => <span key={key}>{key.replaceAll(/([A-Z])/g, " $1").replaceAll("_", " ")}<strong>{Array.isArray(value) ? value.join(", ") || "Not provided" : value == null || value === "" ? "Not provided" : String(value)}</strong></span>)}</div></article>
            </div> : null}
            {tab === "Proposal" ? <article className="customer-governed-document customer-proposal-card"><header><div><small>GOVERNED PROPOSAL</small><h3>Proposal R{selectedDeal.commercial.proposalRevisionNumber ?? "—"}</h3><span>{selectedAccount.name} · {selectedDeal.title}</span></div><div><b>{label(selectedDeal.artifactStates.proposal.state)}</b></div></header><div className="customer-document-actions"><button onClick={() => window.print()}>Print / Save PDF</button>{selectedDeal.commercial.proposalId && selectedDeal.commercial.proposalRevisionId ? <button className="primary" onClick={() => void downloadRuntimeArtifact(`/api/exports/proposals/${encodeURIComponent(selectedDeal.commercial.proposalId!)}/revisions/${encodeURIComponent(selectedDeal.commercial.proposalRevisionId!)}/pdf`)}>View / Download Proposal</button> : null}</div><div className="customer-document-grid"><span>Product<strong>{selectedDeal.customerSafe.product.name}</strong></span><span>Route<strong>{selectedDeal.customerSafe.route.routeMiles?.toFixed(2) ?? "—"} miles</strong></span><span>NRC<strong>{money(selectedDeal.customerSafe.economics.nrc, selectedDeal.customerSafe.economics.currency)}</strong></span><span>MRC<strong>{money(selectedDeal.customerSafe.economics.mrc, selectedDeal.customerSafe.economics.currency)}</strong></span><span>Term<strong>{selectedDeal.customerSafe.economics.termMonths ?? "—"} months</strong></span></div><h4>Revision History</h4>{proposalDocuments.map((document) => <div className="customer-history-document" key={document.documentId}><div><b>Proposal R{document.revision ?? "—"}</b><span>{label(document.status)}</span></div><details><summary>Technical lineage</summary><code>{document.documentId}</code><code>{document.authorityHash}</code></details></div>)}</article> : null}
            {tab === "Engineering" ? <article className="customer-proposal-card"><h3>Engineering</h3><div className="customer-document-grid"><span>Status<strong>{label(selectedDeal.artifactStates.engineering.state)}</strong></span><span>Eligibility<strong>{label(selectedDeal.artifactStates.engineering.eligibility)}</strong></span><span>Certified IOF<strong>{label(selectedDeal.artifactStates.certifiedIof.state, "Not certified")}</strong></span></div>{selectedDeal.currentState === "ACCEPTED" ? <p>Accepted — Engineering handoff underway.</p> : null}{selectedDeal.currentState === "ENGINEERING" ? <button type="button" onClick={() => setWorkspace("routeEngineering")}>View Engineering Status</button> : null}<details className="customer-technical-details"><summary>Technical Details / Lineage</summary><code>{selectedDeal.engineering.engineeringPackageId ?? "No Engineering Package"}</code><code>{selectedDeal.engineering.certifiedPackageId ?? "No Certified IOF"}</code></details></article> : null}
            {tab === "Service Order" ? selectedDeal.contractual.serviceOrderId ? <article className="customer-governed-document customer-proposal-card"><header><div><small>GOVERNED SERVICE ORDER</small><h3>{selectedDeal.title}</h3></div><div><b>{label(selectedDeal.contractual.serviceOrderStatus)}</b></div></header><div className="customer-document-actions"><button onClick={() => window.print()}>Print Service Order</button><button className="primary" onClick={() => void downloadRuntimeArtifact(`/api/exports/service-orders/${encodeURIComponent(selectedDeal.contractual.serviceOrderId!)}/pdf`)}>Download Service Order PDF</button></div><p>Contract source: {label(selectedDeal.customerSafe.contracting.mode)}</p><details className="customer-technical-details"><summary>Technical Details / Lineage</summary><code>{selectedDeal.contractual.serviceOrderId}</code><code>{selectedDeal.contractual.documentHash}</code></details></article> : <div className="customer-proposal-card"><h3>Service Order</h3><p>No governed Service Order exists for this Opportunity. This artifact will appear here after Engineering certification makes it legitimate.</p><p>Supported future contract sources: Teralinx Service Order, Customer Paper, Master Agreement + SOW, or governed external contract reference.</p></div> : null}
            {tab === "Documents" ? <div className="customer-proposal-card"><h3>Governed Documents</h3>{selectedDeal.documentHistory.map((document) => <article className="customer-history-document" key={`${document.documentType}:${document.documentId}`}><div><b>{label(document.documentType)} · Revision {document.revision ?? "—"}</b><span>{label(document.status)}</span></div><details><summary>Technical lineage</summary><code>{document.documentId}</code><code>{document.authorityHash}</code></details></article>)}</div> : null}
            {tab === "Activity" ? <div className="customer-activity"><h3>Governed Activity</h3>{selectedDeal.activity.length ? selectedDeal.activity.map((item) => <article key={item.evidenceId}><span>{item.title}</span>{item.detail ? <p>{item.detail}</p> : null}<small>{item.actor} · {new Date(item.timestamp).toLocaleString()}</small></article>) : <p>No persisted activity evidence is available for this deal.</p>}</div> : null}
          </>}
        </section>
      </main>}
  </div>;
}
