import { useEffect, useMemo, useState } from "react";
import {
  dispositionQuantity,
  quantityReconciliationFromDraft,
  quantityReconciliationRepository,
  quantityScopeFromDraft,
  type QuantityDispositionType,
  type QuantityEvidenceReference,
  type QuantityReconciliation,
} from "../../engineering/quantity";

type Props = {
  draftPackage: Record<string, unknown>;
  reviewer: string;
  canWrite: boolean;
  constitutionalAssemblyStatus: string;
  engineeringConstraintCount: number;
  onChange?: (reconciliation: QuantityReconciliation) => void;
  onRequestCommercialRevision?: (reason: string) => void;
};

const DISPOSITIONS: QuantityDispositionType[] = [
  "ACCEPT_SOURCE",
  "ACCEPT_DERIVED",
  "CORRECT_SOURCE",
  "APPROVE_DOCTRINE_EXCEPTION",
  "REQUEST_COMMERCIAL_REVISION",
  "REQUIRE_ADDITIONAL_EVIDENCE",
  "DEFINE_SPLICE_ARCHITECTURE",
  "BIND_OPTICAL_DESIGN",
];

const REASON_CATEGORIES = [
  "ROUTE_GEOMETRY_REVISION",
  "SLACK_OR_PLACEMENT_FACTOR",
  "VERTICAL_FOOTAGE",
  "FACILITY_ENTRANCE_OR_LATERAL",
  "CROSSING_OR_TURN",
  "SPLICE_ARCHITECTURE",
  "ILA_ACCESS_OR_OPTICAL_DESIGN",
  "JURISDICTIONAL_REQUIREMENT",
  "MAINTENANCE_ACCESS",
  "CUSTOMER_DESIGN",
  "SOURCE_WORKBOOK_REVISION",
  "QUANTITY_ERROR",
  "OTHER_DOCUMENTED_REASON",
];

function text(value: unknown, fallback = "n/a") {
  const result = String(value ?? "").trim();
  return result || fallback;
}

function quantity(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number.toLocaleString(undefined, { maximumFractionDigits: 3 }) : "missing";
}

function percent(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? `${number >= 0 ? "+" : ""}${number.toLocaleString(undefined, { maximumFractionDigits: 2 })}%` : "n/a";
}

function statusClass(value: unknown) {
  const status = String(value ?? "").toUpperCase();
  if (["PASS", "MATCH", "RESOLVED", "READY_FOR_ENGINEERING_CERTIFICATION"].includes(status)) return "pass";
  if (["FAIL", "BLOCKED", "MISSING_DOCTRINE", "MISSING_SOURCE", "SOURCE_OVERRIDE_REQUIRES_AUTHORITY", "DOCTRINE_EXCEPTION_REQUIRED"].includes(status)) return "fail";
  return "warning";
}

export function EngineeringQuantityReconciliationPanel({
  draftPackage,
  reviewer,
  canWrite,
  constitutionalAssemblyStatus,
  engineeringConstraintCount,
  onChange,
  onRequestCommercialRevision,
}: Props) {
  const initial = useMemo(() => quantityReconciliationFromDraft(draftPackage), [draftPackage]);
  const [reconciliation, setReconciliation] = useState<QuantityReconciliation | null>(initial);
  const [selectedItemId, setSelectedItemId] = useState(initial?.items.find((item) => item.status !== "MATCH")?.reconciliationItemId ?? initial?.items[0]?.reconciliationItemId ?? "");
  const [disposition, setDisposition] = useState<QuantityDispositionType>("REQUIRE_ADDITIONAL_EVIDENCE");
  const [reasonCategory, setReasonCategory] = useState("OTHER_DOCUMENTED_REASON");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [evidenceRef, setEvidenceRef] = useState("");
  const [evidenceHash, setEvidenceHash] = useState("");
  const [approvedQuantity, setApprovedQuantity] = useState("");
  const [expectedCondition, setExpectedCondition] = useState("");
  const [actualCondition, setActualCondition] = useState("");
  const [impactSummary, setImpactSummary] = useState("");
  const [designStation, setDesignStation] = useState("");
  const [designMilepost, setDesignMilepost] = useState("");
  const [designSpanLength, setDesignSpanLength] = useState("");
  const [designOpticalLoss, setDesignOpticalLoss] = useState("");
  const [designFacilityClass, setDesignFacilityClass] = useState("");
  const [powerRequirement, setPowerRequirement] = useState("");
  const [powerEvidenceRef, setPowerEvidenceRef] = useState("");
  const [designEvidenceRef, setDesignEvidenceRef] = useState("");
  const [notice, setNotice] = useState("Select an unresolved item and inspect both authorities before disposition.");

  useEffect(() => {
    if (!initial) {
      setReconciliation(null);
      return;
    }
    const scope = quantityScopeFromDraft(draftPackage);
    const restored = quantityReconciliationRepository.latest(scope);
    const next = restored ?? quantityReconciliationRepository.saveInitial(initial);
    setReconciliation(next);
    setSelectedItemId((current) => next.items.some((item) => item.reconciliationItemId === current)
      ? current
      : next.items.find((item) => item.status !== "MATCH")?.reconciliationItemId ?? next.items[0]?.reconciliationItemId ?? "");
  }, [initial?.reconciliationId, initial?.sourceHash, draftPackage]);

  const reviewItems = useMemo(
    () => (reconciliation?.items ?? []).filter((item) => item.status !== "MATCH"),
    [reconciliation],
  );
  const selected = reviewItems.find((item) => item.reconciliationItemId === selectedItemId) ?? reviewItems[0] ?? null;
  const summary = useMemo(() => {
    const items = reconciliation?.items ?? [];
    return {
      total: items.length,
      matched: items.filter((item) => item.status === "MATCH").length,
      review: items.filter((item) => !["MATCH", "RESOLVED", "SUPERSEDED"].includes(item.status)).length,
      exceptions: reconciliation?.exceptionIds.length ?? 0,
      resolved: items.filter((item) => item.status === "RESOLVED").length,
      blocked: items.filter((item) => item.required && !["MATCH", "RESOLVED", "SUPERSEDED"].includes(item.status)).length,
    };
  }, [reconciliation]);

  useEffect(() => {
    if (!selected) return;
    const sourceEvidence = selected.sourceCandidate?.evidenceRefs[0];
    setEvidenceRef(sourceEvidence?.evidenceRef ?? "");
    setEvidenceHash(sourceEvidence?.sourceHash ?? selected.sourceHash ?? "");
    setApprovedQuantity("");
  }, [selected?.reconciliationItemId]);

  function submitDisposition() {
    if (!reconciliation || !selected) return;
    const evidence: QuantityEvidenceReference = {
      evidenceRef: evidenceRef.trim(),
      sourceFile: selected.sourceCandidate?.evidenceRefs[0]?.sourceFile,
      worksheet: selected.sourceCandidate?.evidenceRefs[0]?.worksheet,
      sourceLocation: selected.sourceCandidate?.evidenceRefs[0]?.sourceLocation,
      sourceHash: evidenceHash.trim(),
      sourceAuthority: "ENGINEERING_REVIEW_EVIDENCE",
      authorityMode: "HUMAN_APPROVED",
    };
    try {
      const result = dispositionQuantity({
        reconciliation,
        reconciliationItemId: selected.reconciliationItemId,
        type: disposition,
        reviewer,
        engineeringAuthority: "ENGINEERING",
        reason: `${reasonCategory}: ${reason.trim()}`,
        notes,
        evidenceRefs: [evidence],
        approvedQuantity: approvedQuantity === "" ? undefined : Number(approvedQuantity),
        doctrineRule: selected.derivedCandidate?.doctrineRule,
        expectedCondition,
        actualCondition,
        impactSummary,
        engineeringDesignBinding: disposition === "BIND_OPTICAL_DESIGN" ? {
          station: designStation,
          milepost: designMilepost === "" ? undefined : Number(designMilepost),
          spanLength: designSpanLength === "" ? undefined : Number(designSpanLength),
          opticalLoss: designOpticalLoss === "" ? undefined : Number(designOpticalLoss),
          facilityClass: designFacilityClass,
          powerRequirement,
          powerEvidenceRef,
          designEvidenceRef,
        } : undefined,
      });
      quantityReconciliationRepository.saveDisposition(result);
      setReconciliation(result.reconciliation);
      onChange?.(result.reconciliation);
      if (result.commercialRevisionRequested) onRequestCommercialRevision?.(result.item.dispositionReason ?? reason);
      setNotice(`${selected.quantityType} recorded as ${result.item.status}. Audit event ${result.auditEvent.auditEventId} persisted.`);
      setReason("");
      setNotes("");
    } catch (error) {
      setNotice(`Disposition blocked: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  if (!reconciliation) {
    return (
      <section className="dal-panel engineering-quantity-reconciliation-panel">
        <h3>Engineering Quantity Reconciliation</h3>
        <div className="dal-status">No formal quantity reconciliation is attached to this Draft IOF Package.</div>
      </section>
    );
  }

  const product = draftPackage.product as Record<string, unknown> | undefined;
  const certificationReady = reconciliation.status === "PASS" && constitutionalAssemblyStatus === "PASS";
  return (
    <section className="dal-panel engineering-quantity-reconciliation-panel" data-engineering-quantity-reconciliation="governed">
      <div className="dal-panel-title-row">
        <div>
          <h3>Engineering Quantity Reconciliation</h3>
          <span>Observed and derived facts remain independent until attributable Engineering disposition.</span>
        </div>
        <span className={`dal-badge ${statusClass(reconciliation.status)}`}>{reconciliation.status}</span>
      </div>

      <div className="teralinx-summary-grid">
        <div><span>Total Items</span><b>{summary.total}</b></div>
        <div><span>Matched</span><b>{summary.matched}</b></div>
        <div><span>Review Required</span><b>{summary.review}</b></div>
        <div><span>Exceptions</span><b>{summary.exceptions}</b></div>
        <div><span>Resolved</span><b>{summary.resolved}</b></div>
        <div><span>Blocked</span><b>{summary.blocked}</b></div>
      </div>

      <div className="engineering-certification-list">
        {reviewItems.map((item) => (
          <button type="button" className={item.reconciliationItemId === selected?.reconciliationItemId ? "active-toggle" : "secondary"} key={item.reconciliationItemId} onClick={() => setSelectedItemId(item.reconciliationItemId)}>
            {item.objectClass} / {item.quantityType} — {item.status.replaceAll("_", " ")}
          </button>
        ))}
        {!reviewItems.length ? <div className="dal-status">Commercial and Engineering quantities match. No manual acknowledgement is required.</div> : null}
      </div>

      {summary.matched ? <details className="engineering-quantity-matched"><summary>{summary.matched} matching quantities</summary><div className="dal-status">Matching quantities remain governed and available for audit; they require no human disposition.</div></details> : null}

      {selected ? (
        <div className="engineering-quantity-comparison">
          <div className="teralinx-summary-grid">
            <div>
              <span>Source / Observed</span>
              <b>{quantity(selected.sourceQuantity)} {selected.unit}</b>
              <small>{selected.sourceCandidate?.evidenceRefs[0]?.sourceFile ?? "source file missing"} / {selected.sourceCandidate?.evidenceRefs[0]?.worksheet ?? "worksheet missing"} / {selected.sourceCandidate?.evidenceRefs[0]?.sourceLocation ?? selected.sourceEvidenceRef ?? "location missing"}</small>
              <small>{selected.sourceAuthority}</small>
            </div>
            <div>
              <span>Derived</span>
              <b>{quantity(selected.derivedQuantity)} {selected.unit}</b>
              <small>{selected.derivedCandidate?.formula ?? selected.derivationMethod}</small>
              <small>{selected.derivedCandidate?.doctrineRule ?? selected.derivationAuthority} / {selected.derivedCandidate?.geometryAuthority ?? "no geometry dependency"}</small>
            </div>
            <div><span>Delta</span><b>{quantity(selected.deltaAbsolute)} {selected.unit}</b><small>{percent(selected.deltaPercent)}</small></div>
            <div><span>Status</span><b className={`dal-badge ${statusClass(selected.status)}`}>{selected.status.replaceAll("_", " ")}</b></div>
          </div>

          <div className="engineering-quantity-derivation" aria-label="Quantity derivation graph">
            <div><span>Input Authority</span><b>{selected.derivedCandidate?.geometryAuthority ?? selected.derivationAuthority}</b><small>{selected.derivedCandidate?.quantity === undefined ? "Engineering design missing" : `${quantity(selected.derivedCandidate.quantity)} ${selected.unit}`}</small></div>
            <span>↓</span>
            <div><span>Derivation</span><b>{selected.derivedCandidate?.formula ?? selected.derivationMethod}</b></div>
            <span>↓</span>
            <div><span>Derived Quantity</span><b>{quantity(selected.derivedQuantity)} {selected.unit}</b></div>
            <div><span>Source Quantity</span><b>{quantity(selected.sourceQuantity)} {selected.unit}</b></div>
            <div><span>Delta / Review</span><b>{quantity(selected.deltaAbsolute)} {selected.unit}</b><small>{selected.status.replaceAll("_", " ")}</small></div>
          </div>

          <div className="engineering-certification-form-grid">
            <label>Engineering Disposition<select value={disposition} onChange={(event) => setDisposition(event.currentTarget.value as QuantityDispositionType)}>{DISPOSITIONS.map((item) => <option key={item} value={item}>{item.replaceAll("_", " ")}</option>)}</select></label>
            <label>Reason Category<select value={reasonCategory} onChange={(event) => setReasonCategory(event.currentTarget.value)}>{REASON_CATEGORIES.map((item) => <option key={item} value={item}>{item.replaceAll("_", " ")}</option>)}</select></label>
            <label>Approved Quantity<input type="number" value={approvedQuantity} onChange={(event) => setApprovedQuantity(event.currentTarget.value)} placeholder="Required for design/exception actions" /></label>
            <label>Supporting Evidence<input value={evidenceRef} onChange={(event) => setEvidenceRef(event.currentTarget.value)} placeholder="Repository evidence reference" /></label>
            <label>Evidence Hash<input value={evidenceHash} onChange={(event) => setEvidenceHash(event.currentTarget.value)} placeholder="Immutable evidence hash" /></label>
            <label>Reviewer<input value={reviewer} readOnly /></label>
          </div>
          <textarea value={reason} onChange={(event) => setReason(event.currentTarget.value)} placeholder="Attributable Engineering reason (required)" />
          <textarea value={notes} onChange={(event) => setNotes(event.currentTarget.value)} placeholder="Engineering notes" />
          {disposition === "APPROVE_DOCTRINE_EXCEPTION" ? (
            <div className="engineering-certification-form-grid">
              <label>Expected Condition<input value={expectedCondition} onChange={(event) => setExpectedCondition(event.currentTarget.value)} /></label>
              <label>Actual Condition<input value={actualCondition} onChange={(event) => setActualCondition(event.currentTarget.value)} /></label>
              <label>Impact Summary<input value={impactSummary} onChange={(event) => setImpactSummary(event.currentTarget.value)} /></label>
            </div>
          ) : null}
          {disposition === "BIND_OPTICAL_DESIGN" ? (
            <div className="engineering-certification-form-grid">
              <label>ILA Station<input value={designStation} onChange={(event) => setDesignStation(event.currentTarget.value)} placeholder="Station authority reference" /></label>
              <label>Milepost<input type="number" value={designMilepost} onChange={(event) => setDesignMilepost(event.currentTarget.value)} /></label>
              <label>Span Length<input type="number" value={designSpanLength} onChange={(event) => setDesignSpanLength(event.currentTarget.value)} /></label>
              <label>Optical Loss<input type="number" value={designOpticalLoss} onChange={(event) => setDesignOpticalLoss(event.currentTarget.value)} /></label>
              <label>Facility Class<input value={designFacilityClass} onChange={(event) => setDesignFacilityClass(event.currentTarget.value)} /></label>
              <label>Power Requirement<input value={powerRequirement} onChange={(event) => setPowerRequirement(event.currentTarget.value)} /></label>
              <label>Power Evidence<input value={powerEvidenceRef} onChange={(event) => setPowerEvidenceRef(event.currentTarget.value)} /></label>
              <label>Design Evidence<input value={designEvidenceRef} onChange={(event) => setDesignEvidenceRef(event.currentTarget.value)} /></label>
            </div>
          ) : null}
          <button type="button" onClick={submitDisposition} disabled={!canWrite}>Record Governed Disposition</button>
          <div className="dal-status">{notice}</div>
        </div>
      ) : null}

      <section className="constitutional-review-section" aria-label="Project readiness view">
        <h3>Project Readiness</h3>
        <div className="teralinx-summary-grid">
          <div><span>Product</span><b>{text(product?.displayName ?? draftPackage.productName)}</b></div>
          <div><span>Product Doctrine</span><b>{text(draftPackage.doctrineId, "PD-001")}</b></div>
          <div><span>Route Geometry</span><b>{draftPackage.measuredSpine ? "LOADED / MEASURED AUTHORITY" : "MISSING"}</b></div>
          <div><span>Workbook Evidence</span><b>{draftPackage.workbookEvidence || draftPackage.sourceHash ? "LOADED / SOURCE EVIDENCE" : "MISSING"}</b></div>
          <div><span>Quantity Reconciliation</span><b>{reconciliation.resolvedCount}/{reconciliation.requiredCount} resolved / {reconciliation.status}</b></div>
          <div><span>Doctrine Exceptions</span><b>{reconciliation.exceptionIds.length}</b></div>
          <div><span>Engineering Constraints</span><b>{engineeringConstraintCount}</b></div>
          <div><span>Constitutional Assembly</span><b>{constitutionalAssemblyStatus}</b></div>
          <div><span>Engineering Certification</span><b>{certificationReady ? "READY" : "BLOCKED"}</b></div>
          <div><span>Service Order</span><b>{certificationReady ? "READY AFTER CERTIFICATION" : "NOT READY"}</b></div>
          <div><span>ScopeVersion</span><b>FUTURE AFTER SIGNATURE</b></div>
        </div>
      </section>
    </section>
  );
}
