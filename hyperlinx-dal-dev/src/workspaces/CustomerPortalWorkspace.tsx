import { useEffect, useMemo, useState } from "react";
import {
  customerPortalProjectAction, listCustomerPortalProjects, loadCustomerPortalContext,
  downloadRuntimeArtifact, loadCustomerPortalAccountTwin,
  type AccountCustomerTwin, type CustomerPortalProject,
} from "../api/teralinxRuntime";
import { useTeralinxAuth } from "../identity/TeralinxAuth";
import MapKernel from "../mapkernel/MapKernel";
import { renderSharedOpportunityMapProjection, type SharedOpportunityMapProjection } from "../mapkernel/SharedOpportunityMapProjection";

type PortalSection = "Projects" | "Documents" | "Account";
type ProjectTab = "Overview" | "Proposal" | "Service Order" | "Specifications" | "Documents" | "Activity";
type AccountDeal = AccountCustomerTwin["deals"][number];

function money(value: unknown, currency = "USD") {
  return value == null ? "Not provided" : new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(Number(value));
}

function mapSpec(deal: AccountDeal | null) {
  const route = deal?.customerSafe.route;
  if (!route || deal?.customerSafe.lineage.status !== "PASS" || route.coordinates.length < 2) return null;
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

function textList(values: string[], empty = "Not provided in the governed commercial record") {
  return values.length ? <ul>{values.map((value, index) => <li key={`${value}-${index}`}>{value}</li>)}</ul> : <p className="customer-unavailable">{empty}</p>;
}

export default function CustomerPortalWorkspace() {
  const { session, logout } = useTeralinxAuth();
  const [section, setSection] = useState<PortalSection>("Projects");
  const [tab, setTab] = useState<ProjectTab>("Overview");
  const [context, setContext] = useState<Awaited<ReturnType<typeof loadCustomerPortalContext>> | null>(null);
  const [projects, setProjects] = useState<CustomerPortalProject[]>([]);
  const [accountTwin, setAccountTwin] = useState<AccountCustomerTwin | null>(null);
  const [selectedId, setSelectedId] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState("Loading your projects...");
  const selected = projects.find((item) => item.projectId === selectedId) ?? projects[0] ?? null;
  const selectedDeal = accountTwin?.deals.find((item) => item.opportunityId === selected?.projectId) ?? null;
  const spec = useMemo(() => mapSpec(selectedDeal), [selectedDeal]);
  const canReview = context?.role === "CUSTOMER_COMMERCIAL_REVIEWER" || context?.role === "CUSTOMER_AUTHORIZED_SIGNER";
  const canSign = context?.role === "CUSTOMER_AUTHORIZED_SIGNER";

  async function refresh() {
    try {
      const [nextContext, nextProjects, nextTwin] = await Promise.all([loadCustomerPortalContext(), listCustomerPortalProjects(), loadCustomerPortalAccountTwin()]);
      setContext(nextContext); setProjects(nextProjects); setAccountTwin(nextTwin);
      setSelectedId((current) => nextProjects.some((item) => item.projectId === current) ? current : nextProjects[0]?.projectId ?? "");
      setStatus(nextProjects.length ? "" : "No customer projects have been assigned yet.");
    } catch (error) { setStatus(error instanceof Error ? error.message : String(error)); }
  }

  useEffect(() => { void refresh(); }, []);

  async function act(action: Parameters<typeof customerPortalProjectAction>[1], input: Record<string, unknown>) {
    if (!selected) return;
    setStatus("Recording governed customer action...");
    try {
      await customerPortalProjectAction(selected.projectId, action, input);
      setMessage(""); await refresh(); setStatus("Action recorded.");
    } catch (error) { setStatus(error instanceof Error ? error.message : String(error)); }
  }

  const exactProposal = selected ? { proposalRevisionId: selected.proposal.proposalRevisionId, proposalHash: selected.proposal.proposalHash } : {};
  return (
    <div className="customer-portal-shell">
      <header className="customer-portal-header">
        <div><div className="dal-kicker">TERALINX CUSTOMER TWIN</div><h1>{accountTwin?.account.name ?? context?.customerOrganization.name ?? "Customer Portal"}</h1><small>Governed Deal Room</small></div>
        <nav aria-label="Customer Portal">
          {(["Projects", "Documents", "Account"] as PortalSection[]).map((item) => <button className={section === item ? "active" : ""} key={item} onClick={() => setSection(item)}>{item}</button>)}
        </nav>
        <div className="customer-account"><span>{session?.user.name}</span><small>{context?.role?.replaceAll("_", " ")}</small><button onClick={() => void logout()}>Sign out</button></div>
      </header>
      <div className="customer-portal-demo-banner">DEMO ENVIRONMENT · CUSTOMER VIEW · NOT PRODUCTION ELIGIBLE</div>

      {section === "Projects" ? <main className="customer-portal-main">
        <aside className="customer-project-list">
          <div><span>Projects</span><b>{projects.length}</b></div>
          {projects.map((project) => <button key={project.projectId} className={selected?.projectId === project.projectId ? "active" : ""} onClick={() => { setSelectedId(project.projectId); setTab("Overview"); }}><b>{project.title}</b><span>{project.status.replaceAll("_", " ")}</span></button>)}
          {accountTwin?.tasks.length ? <div className="customer-account-tasks"><small>YOUR ACCOUNT ACTIONS</small>{accountTwin.tasks.map((task) => <button key={task.taskType} onClick={() => { if (task.dealIds[0]) setSelectedId(task.dealIds[0]); }}><b>{task.count}</b><span>{task.label}</span></button>)}</div> : null}
        </aside>
        <section className="customer-project">
          {selected ? <>
            <div className="customer-project-heading"><div><small>{accountTwin?.account.name} · GOVERNED DEAL</small><h2>{selected.title}</h2><p>{selected.summary}</p></div><span>{selectedDeal?.currentState.replaceAll("_", " ") ?? selected.status.replaceAll("_", " ")}</span></div>
            {selectedDeal ? <section className="customer-deal-lifecycle" aria-label="Governed deal lifecycle">
              <div className="customer-deal-lifecycle-heading"><div><small>CURRENT GOVERNED STATE</small><strong>{selectedDeal.currentState.replaceAll("_", " ")}</strong></div><span>{accountTwin?.customerTwinId}</span></div>
              <ol>{selectedDeal.lifecycle.map((step) => <li className={step.status.toLowerCase()} key={step.name}><i aria-hidden="true" /><span>{step.name.replaceAll("_", " ")}</span></li>)}</ol>
              <div className="customer-permitted-actions"><small>PERMITTED IN THIS PERSPECTIVE</small>{selectedDeal.permittedActions.map((action) => <span className={action.mutation ? "governed" : "read"} key={action.action}>{action.label}</span>)}</div>
            </section> : null}
            {selectedDeal ? <section className="customer-map-centerpiece">
              <div className="customer-map-state"><div><small>GOVERNED SPINE</small><strong>{selectedDeal.currentState === "AUTHORIZED" ? "AUTHORIZED" : selectedDeal.currentState === "CERTIFIED" || selectedDeal.currentState === "SERVICE_ORDER" || selectedDeal.currentState === "CUSTOMER_SIGNED" || selectedDeal.currentState === "COUNTERSIGNED" ? "CERTIFIED SCOPE" : selectedDeal.currentState === "ENGINEERING" || selectedDeal.currentState === "ACCEPTED" ? "ACCEPTED SPINE" : "PROPOSED"}</strong><span>Proposal Revision {selected.proposal.proposalRevisionNumber}</span></div><span className={`dal-badge ${selectedDeal.customerSafe.lineage.status === "PASS" ? "pass" : "fail"}`}>{selectedDeal.customerSafe.lineage.status === "PASS" ? "EXACT GOVERNED ROUTE" : "MAP BLOCKED · LINEAGE MISMATCH"}</span></div>
              <div className="customer-map-card">{spec ? <MapKernel specs={[spec]} height={500} initialMode="geographic" presentationProfile="commercialPlanner" mapLens="CUSTOMER" /> : <div className="dal-status warning">The exact Proposal-bound governed spine is unavailable. Customer map rendering is blocked rather than substituting geometry.</div>}</div>
              <div className="customer-map-economics">
                <span>Route<strong>{selectedDeal.customerSafe.route.routeMiles != null ? `${selectedDeal.customerSafe.route.routeMiles.toFixed(2)} mi` : "Not provided"}</strong><small>{selectedDeal.customerSafe.route.routeFeet != null ? `${Math.round(selectedDeal.customerSafe.route.routeFeet).toLocaleString()} ft` : ""}</small></span>
                <span>Product<strong>{selectedDeal.customerSafe.product.name}</strong><small>{String(selectedDeal.customerSafe.specifications.fiberCount ?? "")} {selectedDeal.customerSafe.specifications.fiberCount ? "fibers" : ""}</small></span>
                <span>Economics<strong>{money(selectedDeal.customerSafe.economics.tcv, selectedDeal.customerSafe.economics.currency)}</strong><small>{selectedDeal.customerSafe.economics.nrc != null ? `${money(selectedDeal.customerSafe.economics.nrc, selectedDeal.customerSafe.economics.currency)} NRC` : "TCV not provided"}</small></span>
                <span>Delivery<strong>{selectedDeal.customerSafe.delivery.durationMonths != null ? `${selectedDeal.customerSafe.delivery.durationMonths} months` : selectedDeal.customerSafe.delivery.targetDate ?? "Not provided"}</strong><small>{selectedDeal.customerSafe.delivery.facilityCount != null ? `${selectedDeal.customerSafe.delivery.facilityCount} facilities` : ""}</small></span>
              </div>
            </section> : null}
            <div className="customer-project-tabs">{(["Overview", "Proposal", "Service Order", "Specifications", "Documents", "Activity"] as ProjectTab[]).map((item) => <button className={tab === item ? "active" : ""} onClick={() => setTab(item)} key={item}>{item}</button>)}</div>
            {tab === "Overview" ? <div className="customer-overview-grid">
              <article><small>PROPOSAL</small><strong>Revision {selected.proposal.proposalRevisionNumber}</strong><p>{selected.proposal.decision === "APPROVED" ? "ACCEPTED" : selected.proposal.status?.replaceAll("_", " ")}</p></article>
              <article><small>ENGINEERING</small><strong>{selected.engineering.status.replaceAll("_", " ")}</strong><p>{selected.engineering.customerSafeSummary}</p></article>
              <article><small>SERVICE ORDER</small><strong>{selected.serviceOrder?.status?.replaceAll("_", " ") ?? "Not available"}</strong><p>{selected.serviceOrder?.signatureStatus?.replaceAll("_", " ")}</p></article>
              <article><small>SCOPEVERSION</small><strong>{selected.scopeVersion?.scopeVersionId ? "AUTHORIZED" : "NOT YET AUTHORIZED"}</strong><p>{selected.scopeVersion?.scopeVersionId ?? "Requires complete signature chain"}</p></article>
              <article className="wide"><small>NEXT GOVERNED STEP</small><strong>{selectedDeal?.permittedActions.find((action) => action.mutation)?.label ?? (selectedDeal?.currentState === "AUTHORIZED" ? "Authorized project available for review." : "Teralinx is advancing the governed workflow.")}</strong></article>
            </div> : null}
            {tab === "Proposal" && selectedDeal ? <article className="customer-governed-document customer-proposal-card">
              <header><div><small>TERALINX · GOVERNED PROPOSAL</small><h3>{selected.title}</h3><span>{accountTwin?.account.name}</span></div><div><b>Revision {selected.proposal.proposalRevisionNumber}</b><span>{selected.proposal.decision === "APPROVED" ? "ACCEPTED" : selectedDeal.currentState.replaceAll("_", " ")}</span></div></header>
              <div className="customer-document-actions"><button onClick={() => window.print()}>Print Proposal</button><button className="primary" onClick={() => void downloadRuntimeArtifact(`/api/exports/proposals/${encodeURIComponent(selected.proposal.proposalId)}/revisions/${encodeURIComponent(selected.proposal.proposalRevisionId)}/pdf`)}>Download Proposal PDF</button></div>
              <section><h4>Executive / Deal Summary</h4><p>{selected.proposal.summary || "No additional summary is present in this governed revision."}</p></section>
              <section><h4>Product Description</h4><b>{selectedDeal.customerSafe.product.name}</b><p>{selectedDeal.customerSafe.product.description ?? "No customer-facing product description is present."}</p></section>
              <section><h4>Route Overview</h4><div className="customer-document-grid"><span>Route<strong>{selectedDeal.customerSafe.route.routeMiles != null ? `${selectedDeal.customerSafe.route.routeMiles.toFixed(2)} miles` : "Not provided"}</strong></span><span>Route revision<strong>{selectedDeal.customerSafe.route.routeRevision ?? "Not provided"}</strong></span><span>A endpoint<strong>{String((selectedDeal.customerSafe.route.endpointA as { siteName?: string; label?: string } | null)?.siteName ?? (selectedDeal.customerSafe.route.endpointA as { label?: string } | null)?.label ?? "Governed endpoint A")}</strong></span><span>Z endpoint<strong>{String((selectedDeal.customerSafe.route.endpointZ as { siteName?: string; label?: string } | null)?.siteName ?? (selectedDeal.customerSafe.route.endpointZ as { label?: string } | null)?.label ?? "Governed endpoint Z")}</strong></span></div></section>
              <section><h4>Commercial Pricing</h4><div className="customer-document-grid"><span>NRC<strong>{money(selectedDeal.customerSafe.economics.nrc, selectedDeal.customerSafe.economics.currency)}</strong></span><span>MRC<strong>{money(selectedDeal.customerSafe.economics.mrc, selectedDeal.customerSafe.economics.currency)}</strong></span><span>Term<strong>{selectedDeal.customerSafe.economics.termMonths != null ? `${selectedDeal.customerSafe.economics.termMonths} months` : "Not provided"}</strong></span><span>TCV / Lifecycle Value<strong>{money(selectedDeal.customerSafe.economics.tcv, selectedDeal.customerSafe.economics.currency)}</strong></span></div></section>
              <section><h4>Scope, Specifications, and Delivery</h4><div className="customer-document-grid"><span>Fiber count<strong>{String(selectedDeal.customerSafe.specifications.fiberCount ?? "Not provided")}</strong></span><span>Conduit<strong>{selectedDeal.customerSafe.specifications.ductCount ? `${selectedDeal.customerSafe.specifications.ductCount} × ${selectedDeal.customerSafe.specifications.ductDiameter ?? "—"} in` : "Not provided"}</strong></span><span>Delivery<strong>{selectedDeal.customerSafe.delivery.targetDate ?? (selectedDeal.customerSafe.delivery.durationMonths != null ? `${selectedDeal.customerSafe.delivery.durationMonths} months` : "Not provided")}</strong></span><span>Diversity<strong>{String(selectedDeal.customerSafe.specifications.diversity ?? "Not provided")}</strong></span></div></section>
              <section><h4>Deal Points</h4><div className="customer-document-grid"><span>Payment structure<strong>{selectedDeal.customerSafe.dealPoints.paymentStructure ?? "Not provided"}</strong></span><span>Target delivery<strong>{selectedDeal.customerSafe.delivery.targetDate ?? (selectedDeal.customerSafe.delivery.durationMonths != null ? `${selectedDeal.customerSafe.delivery.durationMonths} months` : "Not provided")}</strong></span></div><h5>Customer responsibilities</h5>{textList(selectedDeal.customerSafe.dealPoints.customerResponsibilities)}<h5>Teralinx responsibilities</h5>{textList(selectedDeal.customerSafe.dealPoints.teralinxResponsibilities)}<h5>Assumptions</h5>{textList(selectedDeal.customerSafe.dealPoints.assumptions)}<h5>Exclusions</h5>{textList(selectedDeal.customerSafe.dealPoints.exclusions)}</section>
              {selectedDeal.currentState === "CUSTOMER_REVIEW" && canReview ? <><label className="customer-message">Question, comment, or requested change<textarea value={message} onChange={(event) => setMessage(event.currentTarget.value)} placeholder="Add context for the Teralinx team" /></label><div className="customer-actions"><button onClick={() => void act("questions", { message })}>Ask Question</button><button onClick={() => void act("change-requests", { ...exactProposal, comment: message })}>Request Change</button><button className="danger" onClick={() => void act("proposal/decline", { ...exactProposal, comment: message })}>Decline</button><button className="primary" onClick={() => void act("proposal/accept", { ...exactProposal, comment: message })}>Accept Proposal</button></div></> : <p className="customer-readonly">{selected.proposal.decision === "APPROVED" ? "This exact Proposal Revision was accepted and is retained as historical truth." : "This perspective is read-only."}</p>}
            </article> : null}
            {tab === "Service Order" ? selected.serviceOrder && selectedDeal ? <article className="customer-governed-document customer-proposal-card">
              <header><div><small>GOVERNED SERVICE ORDER</small><h3>{selected.title}</h3><span>{selectedDeal.customerSafe.contracting.mode.replaceAll("_", " ")}</span></div><div><b>Revision {selected.serviceOrder.documentRevision}</b><span>{selected.serviceOrder.status.replaceAll("_", " ")}</span></div></header>
              {selectedDeal.customerSafe.contracting.demoLegalClassification ? <div className="customer-demo-legal">DEMO PLACEHOLDER · NOT APPROVED TERALINX LEGAL TERMS · NOT PRODUCTION ELIGIBLE</div> : null}
              <div className="customer-document-actions"><button onClick={() => window.print()}>Print Service Order</button><button className="primary" onClick={() => void downloadRuntimeArtifact(`/api/exports/service-orders/${encodeURIComponent(selected.serviceOrder!.serviceOrderId)}/pdf`)}>Download Service Order PDF</button></div>
              <section><h4>Scope of Work</h4><p>{String(selected.serviceOrder.serviceDescription?.productName ?? selectedDeal.customerSafe.product.description ?? selectedDeal.customerSafe.product.name)}</p></section>
              <section><h4>Pricing and Term</h4><div className="customer-document-grid"><span>NRC<strong>{money(selectedDeal.customerSafe.economics.nrc, selectedDeal.customerSafe.economics.currency)}</strong></span><span>MRC<strong>{money(selectedDeal.customerSafe.economics.mrc, selectedDeal.customerSafe.economics.currency)}</strong></span><span>Term<strong>{selectedDeal.customerSafe.economics.termMonths != null ? `${selectedDeal.customerSafe.economics.termMonths} months` : "Not provided"}</strong></span><span>Payment<strong>{selectedDeal.customerSafe.dealPoints.paymentStructure ?? "Not provided"}</strong></span></div></section>
              <section><h4>Contract and Terms Reference</h4><p>{selectedDeal.customerSafe.contracting.governingTermsReference ?? "No governing agreement reference is present."}</p>{selectedDeal.customerSafe.contracting.mode === "CUSTOMER_PAPER" ? <p>Customer-provided paper is associated as external governed evidence; Hyperlinx is not its author.</p> : null}</section>
              <section><h4>Responsibilities, Assumptions, and Exclusions</h4><h5>Customer responsibilities</h5>{textList(selectedDeal.customerSafe.dealPoints.customerResponsibilities)}<h5>Teralinx responsibilities</h5>{textList(selectedDeal.customerSafe.dealPoints.teralinxResponsibilities)}<h5>Assumptions</h5>{textList(selectedDeal.customerSafe.dealPoints.assumptions)}<h5>Exclusions</h5>{textList(selectedDeal.customerSafe.dealPoints.exclusions)}</section>
              <section><h4>Signature Status</h4><div className="customer-document-grid"><span>Customer<strong>{selected.serviceOrder.signatureStatus.replaceAll("_", " ")}</strong></span><span>Teralinx<strong>{selected.serviceOrder.status === "COUNTERSIGNED" ? "COUNTERSIGNED" : "PENDING"}</strong></span><span>ScopeVersion<strong>{selected.scopeVersion?.scopeVersionId ?? "NOT YET AUTHORIZED"}</strong></span></div></section>
              {canSign && selectedDeal.currentState === "SERVICE_ORDER" && selected.serviceOrder.status === "ISSUED" ? <div className="customer-signature"><h3>Sign Service Order</h3><p>Your signature binds to this exact governed Service Order revision and document hash.</p><button className="primary" onClick={() => void act("service-order/sign", { serviceOrderId: selected.serviceOrder!.serviceOrderId, documentHash: selected.serviceOrder!.documentHash, typedName: session?.user.name, authorityAcknowledged: true })}>Sign Service Order</button></div> : <p className="customer-readonly">No Service Order signature action is available to this perspective in the current state.</p>}
            </article> : <div className="customer-proposal-card"><h3>Service Order</h3><p>The governed Service Order is not yet available. It will appear only after the existing lifecycle makes it legitimate.</p></div> : null}
            {tab === "Specifications" && selectedDeal ? <div className="customer-proposal-card"><h3>Customer-Facing Specifications</h3><p>These values are disclosed from the selected Proposal configuration; internal Product Doctrine remains protected.</p><div className="customer-document-grid">{Object.entries(selectedDeal.customerSafe.specifications).map(([key, value]) => <span key={key}>{key.replaceAll(/([A-Z])/g, " $1").replaceAll("_", " ")}<strong>{Array.isArray(value) ? value.join(", ") || "Not provided" : value == null || value === "" ? "Not provided" : String(value)}</strong></span>)}</div></div> : null}
            {tab === "Documents" && selectedDeal ? <div className="customer-proposal-card"><h3>Governed Document History</h3>{selectedDeal.documentHistory.map((document) => <article className="customer-history-document" key={document.documentId}><div><b>{document.documentType.replaceAll("_", " ")} · Revision {document.revision ?? "—"}</b><span>{document.status.replaceAll("_", " ")}</span><code>{document.documentId}</code></div>{document.documentType === "PROPOSAL" ? <button onClick={() => void downloadRuntimeArtifact(`/api/exports/proposals/${encodeURIComponent(selected.proposal.proposalId)}/revisions/${encodeURIComponent(document.documentId)}/pdf`)}>Download PDF</button> : selected.serviceOrder ? <button onClick={() => void downloadRuntimeArtifact(`/api/exports/service-orders/${encodeURIComponent(selected.serviceOrder!.serviceOrderId)}/pdf`)}>Download PDF</button> : null}</article>)}</div> : null}
            {tab === "Activity" ? <div className="customer-activity">{selected.activity.length ? selected.activity.map((item) => <article key={item.customerPortalActionId}><span>{item.action.replaceAll("_", " ")}</span><p>{item.message}</p><small>{item.actorDisplayName} · {new Date(item.createdAt).toLocaleString()}</small></article>) : <p>No customer activity yet.</p>}</div> : null}
          </> : <div className="customer-empty"><h2>Welcome to your project portal</h2><p>{status}</p></div>}
          {status && selected ? <div className="customer-toast">{status}</div> : null}
        </section>
      </main> : null}
      {section === "Documents" ? <main className="customer-portal-page"><h2>Documents</h2><p>Only governed, customer-authorized documents appear here.</p>{projects.map((project) => <article key={project.projectId}><b>{project.title}</b><span>Proposal Revision {project.proposal.proposalRevisionNumber}</span><code>{project.proposal.proposalRevisionId}</code><div className="customer-actions"><button onClick={() => void downloadRuntimeArtifact(`/api/exports/proposals/${encodeURIComponent(project.proposal.proposalId)}/pdf`)}>Download Proposal PDF</button><button onClick={() => void downloadRuntimeArtifact(`/api/exports/proposals/${encodeURIComponent(project.proposal.proposalId)}/route.kmz`)}>Download Route KMZ</button>{project.serviceOrder ? <button onClick={() => void downloadRuntimeArtifact(`/api/exports/service-orders/${encodeURIComponent(project.serviceOrder!.serviceOrderId)}/pdf`)}>Download Service Order</button> : null}</div></article>)}</main> : null}
      {section === "Account" ? <main className="customer-portal-page"><h2>Account Customer Twin</h2><p>The Account is the persistent parent. Every visible deal below is a read-only projection of governed Commercial, spatial, Engineering, contractual, and ScopeVersion records.</p><article><b>{accountTwin?.account.name ?? context?.customerOrganization.name}</b><span>{accountTwin?.customerTwinId}</span><span>{accountTwin?.dealCount ?? 0} governed deal{accountTwin?.dealCount === 1 ? "" : "s"}</span><span>{context?.role?.replaceAll("_", " ")}</span><small>Authenticated principal: {context?.actorPrincipalId}</small></article>{accountTwin?.tasks.map((task) => <article key={task.taskType}><b>{task.count} · {task.label}</b><span>Derived from current governed deal state</span></article>)}{accountTwin?.deals.map((deal) => <article key={deal.dealId}><b>{deal.title}</b><span>{deal.currentState.replaceAll("_", " ")}</span><code>{deal.opportunityId}</code></article>)}</main> : null}
    </div>
  );
}
