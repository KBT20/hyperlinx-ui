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
type ProjectTab = "Overview" | "Map" | "Proposal" | "Activity";

function money(value: unknown, currency = "USD") {
  return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(Number(value ?? 0));
}

function mapSpec(project: CustomerPortalProject) {
  if (!project.map.coordinates || project.map.coordinates.length < 2) return null;
  const projection: SharedOpportunityMapProjection = {
    authority: "COMMERCIAL_ROUTE_REPOSITORY",
    projectionPurpose: "SHARED_OPPORTUNITY_MAP",
    opportunityId: project.projectId,
    routeRepositoryId: project.map.routeRepositoryId,
    routeRevision: project.map.routeRevision,
    routeGeometryId: project.map.routeGeometryId,
    geometryHash: project.map.geometryHash,
    routeMiles: project.map.routeMiles,
    orientation: "A_TO_Z",
    coordinates: project.map.coordinates,
    endpoints: [
      { role: "A", label: "Site A", coordinate: project.map.coordinates[0], coordinateSource: "COMMERCIAL_ROUTE_REPOSITORY" },
      { role: "Z", label: "Site Z", coordinate: project.map.coordinates.at(-1)!, coordinateSource: "COMMERCIAL_ROUTE_REPOSITORY" },
    ],
    responseProjectionOnly: true,
  };
  return renderSharedOpportunityMapProjection(projection);
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
  const spec = useMemo(() => selected ? mapSpec(selected) : null, [selected]);
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
        </aside>
        <section className="customer-project">
          {selected ? <>
            <div className="customer-project-heading"><div><small>PROJECT</small><h2>{selected.title}</h2><p>{selected.summary}</p></div><span>{selected.status.replaceAll("_", " ")}</span></div>
            {selectedDeal ? <section className="customer-deal-lifecycle" aria-label="Governed deal lifecycle">
              <div className="customer-deal-lifecycle-heading"><div><small>CURRENT GOVERNED STATE</small><strong>{selectedDeal.currentState.replaceAll("_", " ")}</strong></div><span>{accountTwin?.customerTwinId}</span></div>
              <ol>{selectedDeal.lifecycle.map((step) => <li className={step.status.toLowerCase()} key={step.name}><i aria-hidden="true" /><span>{step.name.replaceAll("_", " ")}</span></li>)}</ol>
              <div className="customer-permitted-actions"><small>PERMITTED IN THIS PERSPECTIVE</small>{selectedDeal.permittedActions.map((action) => <span className={action.mutation ? "governed" : "read"} key={action.action}>{action.label}</span>)}</div>
            </section> : null}
            <div className="customer-project-tabs">{(["Overview", "Map", "Proposal", "Activity"] as ProjectTab[]).map((item) => <button className={tab === item ? "active" : ""} onClick={() => setTab(item)} key={item}>{item}</button>)}</div>
            {tab === "Overview" ? <div className="customer-overview-grid">
              <article><small>ROUTE</small><strong>{selected.map.routeMiles?.toFixed(1) ?? "—"} miles</strong><p>Revision {selected.map.routeRevision}</p></article>
              <article><small>PROPOSAL</small><strong>Revision {selected.proposal.proposalRevisionNumber}</strong><p>{selected.proposal.status?.replaceAll("_", " ")}</p></article>
              <article><small>SERVICE ORDER</small><strong>{selected.serviceOrder?.status?.replaceAll("_", " ") ?? "Not available"}</strong><p>{selected.serviceOrder?.signatureStatus?.replaceAll("_", " ")}</p></article>
              <article><small>ENGINEERING</small><strong>{selected.engineering.status.replaceAll("_", " ")}</strong><p>{selected.engineering.customerSafeSummary}</p></article>
              <article className="wide"><small>NEXT STEP</small><strong>{selected.proposal.decision === "APPROVED" ? "Teralinx is preparing the governed technical package." : "Review the route and commercial Proposal."}</strong></article>
            </div> : null}
              {tab === "Map" ? <div className="customer-map-card">{spec ? <MapKernel specs={[spec]} height={560} initialMode="geographic" presentationProfile="commercialPlanner" mapLens="CUSTOMER" /> : <div className="dal-status">The governed route map is not available yet.</div>}</div> : null}
            {tab === "Proposal" ? <div className="customer-proposal-card">
              <div className="customer-proposal-summary"><div><small>EXACT REVISION</small><strong>Revision {selected.proposal.proposalRevisionNumber}</strong><code>{selected.proposal.proposalRevisionId}</code></div><div><small>COMMERCIAL TERMS</small><strong>{money(selected.proposal.commercialTerms?.tcv, selected.proposal.commercialTerms?.currency)}</strong><span>Total contract value</span></div></div>
              <p>{selected.proposal.summary}</p>
              {canReview ? <><label className="customer-message">Comment or requested change<textarea value={message} onChange={(event) => setMessage(event.currentTarget.value)} placeholder="Add context for the Teralinx team" /></label><div className="customer-actions"><button onClick={() => void act("change-requests", { ...exactProposal, comment: message })}>Request change</button><button className="danger" onClick={() => void act("proposal/decline", { ...exactProposal, comment: message })}>Decline</button><button className="primary" onClick={() => void act("proposal/accept", { ...exactProposal, comment: message })}>Accept exact revision</button></div></> : <p className="customer-readonly">Your Viewer role is read-only.</p>}
              {canSign && selected.serviceOrder?.status === "ISSUED" ? <div className="customer-signature"><h3>Service Order signature</h3><p>By signing, you acknowledge authority to accept this exact document revision.</p><button className="primary" onClick={() => void act("service-order/sign", { serviceOrderId: selected.serviceOrder!.serviceOrderId, documentHash: selected.serviceOrder!.documentHash, typedName: session?.user.name, authorityAcknowledged: true })}>Sign Service Order</button></div> : null}
            </div> : null}
            {tab === "Activity" ? <div className="customer-activity">{selected.activity.length ? selected.activity.map((item) => <article key={item.customerPortalActionId}><span>{item.action.replaceAll("_", " ")}</span><p>{item.message}</p><small>{item.actorDisplayName} · {new Date(item.createdAt).toLocaleString()}</small></article>) : <p>No customer activity yet.</p>}</div> : null}
          </> : <div className="customer-empty"><h2>Welcome to your project portal</h2><p>{status}</p></div>}
          {status && selected ? <div className="customer-toast">{status}</div> : null}
        </section>
      </main> : null}
      {section === "Documents" ? <main className="customer-portal-page"><h2>Documents</h2><p>Only governed, customer-authorized documents appear here.</p>{projects.map((project) => <article key={project.projectId}><b>{project.title}</b><span>Proposal Revision {project.proposal.proposalRevisionNumber}</span><code>{project.proposal.proposalRevisionId}</code><div className="customer-actions"><button onClick={() => void downloadRuntimeArtifact(`/api/exports/proposals/${encodeURIComponent(project.proposal.proposalId)}/pdf`)}>Download Proposal PDF</button><button onClick={() => void downloadRuntimeArtifact(`/api/exports/proposals/${encodeURIComponent(project.proposal.proposalId)}/route.kmz`)}>Download Route KMZ</button>{project.serviceOrder ? <button onClick={() => void downloadRuntimeArtifact(`/api/exports/service-orders/${encodeURIComponent(project.serviceOrder!.serviceOrderId)}/pdf`)}>Download Service Order</button> : null}</div></article>)}</main> : null}
      {section === "Account" ? <main className="customer-portal-page"><h2>Account Customer Twin</h2><p>The Account is the persistent parent. Every visible deal below is a read-only projection of governed Commercial, spatial, Engineering, contractual, and ScopeVersion records.</p><article><b>{accountTwin?.account.name ?? context?.customerOrganization.name}</b><span>{accountTwin?.customerTwinId}</span><span>{accountTwin?.dealCount ?? 0} governed deal{accountTwin?.dealCount === 1 ? "" : "s"}</span><span>{context?.role?.replaceAll("_", " ")}</span><small>Authenticated principal: {context?.actorPrincipalId}</small></article>{accountTwin?.deals.map((deal) => <article key={deal.dealId}><b>{deal.title}</b><span>{deal.currentState.replaceAll("_", " ")}</span><code>{deal.opportunityId}</code></article>)}</main> : null}
    </div>
  );
}
