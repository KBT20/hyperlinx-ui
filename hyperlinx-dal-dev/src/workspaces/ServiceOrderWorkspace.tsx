import { useEffect, useMemo, useState } from "react";
import {
  generateServiceOrder,
  downloadRuntimeArtifact,
  listCertifiedIofPackages,
  listProposalDrafts,
  listServiceOrders,
  markServiceOrderReadyForSignature,
  recordServiceOrderSignaturePlaceholder,
  type CertifiedIofPackageRuntime,
  type ProposalRuntimeObject,
  type ServiceOrderRuntime,
} from "../api/teralinxRuntime";
import { useTeralinxAuth } from "../identity/TeralinxAuth";

const ACCEPTED_PROPOSAL_STATUSES = new Set([
  "CUSTOMER_APPROVED",
  "READY_FOR_IOF_PACKAGE",
  "SALES_ENGINEERING_REVIEW",
  "CERTIFIED_IOF_PACKAGE",
  "CUSTOMER_ACCEPTED",
  "APPROVED",
  "ACCEPTED",
]);

function asString(value: unknown, fallback = "n/a") {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function asArray(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function money(value: unknown) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 }) : "placeholder";
}

function statusClass(value: unknown) {
  const status = String(value ?? "").toUpperCase();
  if (status.includes("READY") || status.includes("GENERATED") || status.includes("APPROVED") || status.includes("CERTIFIED")) return "pass";
  if (status.includes("BLOCK") || status.includes("REJECT") || status.includes("FAIL")) return "fail";
  return "warning";
}

function isAcceptedProposal(proposal: ProposalRuntimeObject) {
  return proposal.approvalState === "APPROVED" || ACCEPTED_PROPOSAL_STATUSES.has(String(proposal.status ?? "").toUpperCase());
}

function proposalKey(proposal: ProposalRuntimeObject) {
  return proposal.proposalId ?? proposal.proposalRecordId;
}

function certifiedKey(pkg: CertifiedIofPackageRuntime) {
  return pkg.certifiedPackageId ?? pkg.packageId;
}

function row(label: string, value: unknown) {
  return (
    <>
      <span>{label}</span>
      <b>{String(value ?? "n/a")}</b>
    </>
  );
}

export default function ServiceOrderWorkspace() {
  const { session } = useTeralinxAuth();
  const [proposals, setProposals] = useState<ProposalRuntimeObject[]>([]);
  const [certifiedPackages, setCertifiedPackages] = useState<CertifiedIofPackageRuntime[]>([]);
  const [serviceOrders, setServiceOrders] = useState<ServiceOrderRuntime[]>([]);
  const [selectedProposalId, setSelectedProposalId] = useState("");
  const [selectedCertifiedId, setSelectedCertifiedId] = useState("");
  const [selectedServiceOrderId, setSelectedServiceOrderId] = useState("");
  const [notice, setNotice] = useState("Service Order workspace is waiting for accepted Proposal and Certified Draft IOF Package.");
  const [pending, setPending] = useState(false);

  const acceptedProposals = useMemo(() => proposals.filter(isAcceptedProposal), [proposals]);
  const selectedProposal = useMemo(
    () => acceptedProposals.find((proposal) => proposalKey(proposal) === selectedProposalId) ?? acceptedProposals[0] ?? null,
    [acceptedProposals, selectedProposalId],
  );
  const selectedCertifiedPackage = useMemo(
    () => {
      const direct = certifiedPackages.find((pkg) => certifiedKey(pkg) === selectedCertifiedId);
      if (direct) return direct;
      if (selectedProposal) {
        return certifiedPackages.find((pkg) => pkg.proposalId === selectedProposal.proposalId) ?? certifiedPackages[0] ?? null;
      }
      return certifiedPackages[0] ?? null;
    },
    [certifiedPackages, selectedCertifiedId, selectedProposal],
  );
  const activeServiceOrder = useMemo(
    () => serviceOrders.find((order) => order.serviceOrderId === selectedServiceOrderId) ?? serviceOrders[0] ?? null,
    [selectedServiceOrderId, serviceOrders],
  );

  async function refresh(message?: string) {
    const [proposalRecords, certifiedRecords, serviceOrderRecords] = await Promise.all([
      listProposalDrafts<ProposalRuntimeObject>(session),
      listCertifiedIofPackages(session),
      listServiceOrders(session),
    ]);
    setProposals(proposalRecords);
    setCertifiedPackages(certifiedRecords);
    setServiceOrders(serviceOrderRecords);
    if (!selectedProposalId && proposalRecords.find(isAcceptedProposal)) setSelectedProposalId(proposalKey(proposalRecords.find(isAcceptedProposal)!));
    if (!selectedCertifiedId && certifiedRecords[0]) setSelectedCertifiedId(certifiedKey(certifiedRecords[0]));
    if (!selectedServiceOrderId && serviceOrderRecords[0]) setSelectedServiceOrderId(serviceOrderRecords[0].serviceOrderId);
    setNotice(message ?? "Service Order authority records loaded.");
  }

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      listProposalDrafts<ProposalRuntimeObject>(session),
      listCertifiedIofPackages(session),
      listServiceOrders(session),
    ])
      .then(([proposalRecords, certifiedRecords, serviceOrderRecords]) => {
        if (cancelled) return;
        setProposals(proposalRecords);
        setCertifiedPackages(certifiedRecords);
        setServiceOrders(serviceOrderRecords);
        const firstAccepted = proposalRecords.find(isAcceptedProposal);
        if (firstAccepted) setSelectedProposalId(proposalKey(firstAccepted));
        if (certifiedRecords[0]) setSelectedCertifiedId(certifiedKey(certifiedRecords[0]));
        if (serviceOrderRecords[0]) setSelectedServiceOrderId(serviceOrderRecords[0].serviceOrderId);
        setNotice("Service Order authority records loaded.");
      })
      .catch((error) => {
        if (!cancelled) setNotice(`Service Order records unavailable: ${error instanceof Error ? error.message : String(error)}`);
      });
    return () => {
      cancelled = true;
    };
  }, [session]);

  async function handleGenerateServiceOrder() {
    if (!selectedProposal || !selectedCertifiedPackage) {
      setNotice("Accepted Proposal and Certified Draft IOF Package are required.");
      return;
    }
    setPending(true);
    try {
      const order = await generateServiceOrder({
        proposalId: selectedProposal.proposalId,
        certifiedPackageId: selectedCertifiedPackage.certifiedPackageId,
        customerAcceptance: {
          status: selectedProposal.approvalState,
          acceptedProposalId: selectedProposal.proposalId,
          acceptedAt: selectedProposal.approvedAt,
        },
        commercialTerms: {
          release: "Commercial Release 1",
          legalSectionsDeferredTo: "Commercial Release 2",
        },
      }, session);
      setSelectedServiceOrderId(order.serviceOrderId);
      await refresh(`${order.serviceOrderId} generated from Certified Draft IOF Package. No ScopeVersion created.`);
    } catch (error) {
      setNotice(`Generate Service Order failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setPending(false);
    }
  }

  async function handleMarkReadyForSignature() {
    if (!activeServiceOrder) return;
    setPending(true);
    try {
      const order = await markServiceOrderReadyForSignature(activeServiceOrder.serviceOrderId, session);
      setSelectedServiceOrderId(order.serviceOrderId);
      await refresh(`${order.serviceOrderId} marked ready for signature. ScopeVersion remains blocked until executed Service Order.`);
    } catch (error) {
      setNotice(`Mark Ready for Signature failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setPending(false);
    }
  }

  async function handleRecordSignaturePlaceholder() {
    if (!activeServiceOrder) return;
    setPending(true);
    try {
      const order = await recordServiceOrderSignaturePlaceholder(activeServiceOrder.serviceOrderId, {
        note: "CIP-013A placeholder only. Executed Service Order capture belongs to CIP-014.",
      }, session);
      setSelectedServiceOrderId(order.serviceOrderId);
      await refresh(`${order.serviceOrderId} signature placeholder recorded. It is not an executed Service Order.`);
    } catch (error) {
      setNotice(`Record Signature placeholder failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setPending(false);
    }
  }

  const selectedPricing = activeServiceOrder?.pricingSummary ?? {};
  const selectedRoute = activeServiceOrder?.routeSummary ?? {};
  const selectedObjects = activeServiceOrder?.objectSummary ?? {};

  return (
    <section className="dal-workspace wide service-order-workspace">
      <div className="dal-workspace-header">
        <div>
          <h2>Service Order</h2>
          <p>Commercial authorization from Certified Draft IOF Package, accepted Proposal, Customer Acceptance, and commercial terms.</p>
        </div>
        <span className={`dal-badge ${statusClass(activeServiceOrder?.signatureStatus ?? "PENDING")}`}>
          {activeServiceOrder?.signatureStatus?.replaceAll("_", " ") ?? "No Service Order"}
        </span>
      </div>

      <div className="dal-grid">
        <section className="dal-panel">
          <div className="dal-panel-title-row">
            <h3>Generate From Authority References</h3>
            <span className="dal-badge pass">No engineering recreation</span>
          </div>
          <label>
            Accepted Proposal
            <select value={selectedProposal?.proposalId ?? selectedProposalId} onChange={(event) => setSelectedProposalId(event.currentTarget.value)}>
              {!acceptedProposals.length ? <option value="">No accepted proposal</option> : null}
              {acceptedProposals.map((proposal) => (
                <option key={proposalKey(proposal)} value={proposalKey(proposal)}>
                  {proposal.proposalNumber ?? proposal.proposalId} / Revision {proposal.version ?? 1}
                </option>
              ))}
            </select>
          </label>
          <label>
            Certified Draft IOF Package
            <select value={selectedCertifiedPackage?.certifiedPackageId ?? selectedCertifiedId} onChange={(event) => setSelectedCertifiedId(event.currentTarget.value)}>
              {!certifiedPackages.length ? <option value="">No certified package</option> : null}
              {certifiedPackages.map((pkg) => (
                <option key={certifiedKey(pkg)} value={certifiedKey(pkg)}>
                  {pkg.certifiedPackageId} / {pkg.certifiedDraftIofPackageId ?? pkg.sourcePackageId}
                </option>
              ))}
            </select>
          </label>
          <div className="dal-actions">
            <button type="button" onClick={handleGenerateServiceOrder} disabled={pending || !selectedProposal || !selectedCertifiedPackage}>Generate Service Order</button>
            <button type="button" onClick={() => setNotice("Preview uses the active Service Order panel below.")} disabled={!activeServiceOrder}>Preview Service Order</button>
            <button type="button" onClick={() => window.print()} disabled={!activeServiceOrder}>Print Service Order</button>
            <button type="button" onClick={() => activeServiceOrder && void downloadRuntimeArtifact(`/api/exports/service-orders/${encodeURIComponent(activeServiceOrder.serviceOrderId)}/pdf`, session).then((artifact) => setNotice(`Downloaded ${artifact.filename}.`)).catch((error) => setNotice(`Service Order PDF failed: ${error.message}`))} disabled={!activeServiceOrder}>Download Service Order PDF</button>
          </div>
          <div className="dal-status">{notice}</div>
        </section>

        <section className="dal-panel">
          <div className="dal-panel-title-row">
            <h3>Service Order Selection</h3>
            <span className="dal-badge warning">{serviceOrders.length.toLocaleString()}</span>
          </div>
          <select value={activeServiceOrder?.serviceOrderId ?? ""} onChange={(event) => setSelectedServiceOrderId(event.currentTarget.value)}>
            {!serviceOrders.length ? <option value="">No Service Orders</option> : null}
            {serviceOrders.map((order) => (
              <option key={order.serviceOrderId} value={order.serviceOrderId}>{order.serviceOrderId}</option>
            ))}
          </select>
          <div className="dal-actions">
            <button type="button" onClick={handleMarkReadyForSignature} disabled={pending || !activeServiceOrder}>Mark Ready for Signature</button>
            <button type="button" onClick={handleRecordSignaturePlaceholder} disabled={pending || !activeServiceOrder}>Record Signature Placeholder</button>
          </div>
          <div className="dal-status">
            Record Signature Placeholder does not create executed Service Order evidence and does not trigger ScopeVersion.
          </div>
        </section>
      </div>

      {activeServiceOrder ? (
        <>
          <section className="dal-panel">
            <div className="dal-panel-title-row">
              <div>
                <h3>Authorization References</h3>
                <span>Truth is transferred by reference from the Certified Draft IOF Package.</span>
              </div>
              <span className={`dal-badge ${statusClass(activeServiceOrder.status)}`}>{activeServiceOrder.status.replaceAll("_", " ")}</span>
            </div>
            <div className="teralinx-summary-grid">
              {row("Customer", activeServiceOrder.customerName ?? activeServiceOrder.customer?.customerName)}
              {row("Opportunity", activeServiceOrder.opportunityId)}
              {row("Proposal ID", activeServiceOrder.proposalId)}
              {row("Accepted Proposal Revision", activeServiceOrder.acceptedProposalRevision)}
              {row("Draft IOF ID", activeServiceOrder.draftIofPackageId)}
              {row("Certified Draft IOF ID", activeServiceOrder.certifiedDraftIofPackageId)}
              {row("Engineering Certification ID", activeServiceOrder.engineeringCertificationId)}
              {row("Future ScopeVersion ID", activeServiceOrder.futureScopeVersionId)}
              {row("Execution Order Reference", activeServiceOrder.executionOrderReference)}
              {row("Customer Acceptance", activeServiceOrder.customerAcceptanceId)}
            </div>
          </section>

          <div className="dal-grid">
            <section className="dal-panel">
              <div className="dal-panel-title-row">
                <h3>Product, Route, Pricing</h3>
                <span className="dal-badge pass">Commercial projection</span>
              </div>
              <div className="engineering-certification-kv">
                {row("Product", asString(activeServiceOrder.product?.productName))}
                {row("Doctrine", asString(activeServiceOrder.product?.doctrineId))}
                {row("Route ID", asString(selectedRoute.routeId))}
                {row("Route Feet", Number(selectedRoute.routeLengthFeet ?? 0).toLocaleString())}
                {row("Route Miles", Number(selectedRoute.routeLengthMiles ?? 0).toLocaleString(undefined, { maximumFractionDigits: 2 }))}
                {row("NRC", money(selectedPricing.nrc))}
                {row("MRC", money(selectedPricing.mrc))}
                {row("Term", selectedPricing.termMonths ? `${selectedPricing.termMonths} months` : "placeholder")}
              </div>
            </section>

            <section className="dal-panel">
              <div className="dal-panel-title-row">
                <h3>Technical Source Summary</h3>
                <span className="dal-badge pass">Certified Draft IOF</span>
              </div>
              <div className="engineering-certification-kv">
                {row("Manifest", asString(selectedObjects.manifestId))}
                {row("Unit Count", selectedObjects.unitCount ?? 0)}
                {row("Manifest Objects", selectedObjects.manifestObjectCount ?? 0)}
                {row("Relationships", selectedObjects.manifestRelationshipCount ?? 0)}
                {row("Evidence", selectedObjects.manifestEvidenceCount ?? 0)}
                {row("Stations", selectedObjects.stationCount ?? 0)}
                {row("No Object Duplication", selectedObjects.noEngineeringObjectDuplication === true ? "true" : "n/a")}
                {row("No ScopeVersion Creation", activeServiceOrder.noScopeVersionCreation ? "true" : "false")}
              </div>
            </section>
          </div>

          <div className="dal-grid">
            <section className="dal-panel">
              <div className="dal-panel-title-row">
                <h3>Schedule And Assumptions</h3>
                <span className="dal-badge warning">Release 1</span>
              </div>
              <div className="engineering-certification-kv">
                {row("Requested Service Date", activeServiceOrder.scheduleSummary?.requestedServiceDate ?? "placeholder")}
                {row("Construction Duration", activeServiceOrder.scheduleSummary?.estimatedConstructionDurationDays ?? "placeholder")}
                {row("Milestones", asArray(activeServiceOrder.scheduleSummary?.milestones).length)}
                {row("Assumptions", activeServiceOrder.assumptions.length)}
              </div>
              <div className="dal-list">
                {activeServiceOrder.assumptions.slice(0, 6).map((item, index) => (
                  <div className="dal-list-row teralinx-list-row" key={`${activeServiceOrder.serviceOrderId}-assumption-${index}`}>
                    <b>{String(item)}</b>
                    <span>Commercial assumption</span>
                  </div>
                ))}
                {!activeServiceOrder.assumptions.length ? <div className="dal-status">No commercial assumptions attached.</div> : null}
              </div>
            </section>

            <section className="dal-panel">
              <div className="dal-panel-title-row">
                <h3>Commercial Release 2 Legal Placeholders</h3>
                <span className="dal-badge warning">Placeholder</span>
              </div>
              <div className="dal-list">
                {activeServiceOrder.legalPlaceholders.map((placeholder) => (
                  <div className="dal-list-row teralinx-list-row" key={asString(placeholder.key)}>
                    <b>{asString(placeholder.label)}</b>
                    <span>{asString(placeholder.status)}</span>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <section className="dal-panel">
            <div className="dal-panel-title-row">
              <h3>Signature Readiness</h3>
              <span className={`dal-badge ${statusClass(activeServiceOrder.signatureStatus)}`}>{activeServiceOrder.signatureStatus.replaceAll("_", " ")}</span>
            </div>
            <div className="teralinx-summary-grid">
              {row("Ready for Signature", activeServiceOrder.readyForSignature ? "true" : "false")}
              {row("Signature Status", activeServiceOrder.signatureStatus)}
              {row("Runtime Promotion Allowed", activeServiceOrder.runtimePromotion?.scopeVersionCreationAllowed === true ? "true" : "false")}
              {row("Required Trigger", asString(activeServiceOrder.runtimePromotion?.requiredTrigger))}
              {row("Next CIP", asString(activeServiceOrder.runtimePromotion?.nextCip))}
              {row("Placeholder Only", activeServiceOrder.signature?.placeholderOnly === true ? "true" : "false")}
            </div>
          </section>
        </>
      ) : (
        <section className="dal-panel">
          <h3>No Service Order Selected</h3>
          <div className="dal-status">Generate a Service Order after customer acceptance and Engineering Certification.</div>
        </section>
      )}
    </section>
  );
}
