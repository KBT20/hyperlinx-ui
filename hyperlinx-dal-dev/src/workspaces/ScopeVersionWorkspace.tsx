import { useEffect, useMemo, useState } from "react";
import { listScopeVersions } from "../api/dalClient";
import {
  generateScopeVersionFromCertifiedIofPackage,
  listCertifiedIofPackages,
  type CertifiedIofPackageRuntime,
} from "../api/teralinxRuntime";
import { useDALState } from "../dal/DALState";
import { useTeralinxAuth } from "../identity/TeralinxAuth";
import { MapKernel, renderScopeVersion } from "../mapkernel";
import type { ScopeVersion } from "../types/dal";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function asArray<T = unknown>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function text(value: unknown, fallback = "n/a") {
  const next = String(value ?? "").trim();
  return next || fallback;
}

function numberText(value: unknown) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric.toLocaleString() : "0";
}

function feet(value: unknown) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return "0 ft";
  if (numeric >= 5280) return `${(numeric / 5280).toLocaleString(undefined, { maximumFractionDigits: 2 })} mi`;
  return `${Math.round(numeric).toLocaleString()} ft`;
}

function dateText(value: unknown) {
  if (!value) return "n/a";
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
}

function statusClass(status: unknown) {
  const upper = String(status ?? "").toUpperCase();
  if (upper === "PASS" || upper === "CERTIFIED") return "pass";
  if (upper === "FAIL" || upper === "BLOCKED") return "fail";
  return "warning";
}

function routeLengthFeet(scope: ScopeVersion | null) {
  const truth = asRecord(scope?.canonicalTruth);
  return asRecord(truth.routeLength).feet ?? scope?.routeLengthFeet ?? asRecord(truth.engineeringBasis).buildFeet;
}

function firstReadyScope(scopes: ScopeVersion[], selectedId: string) {
  return scopes.find((scope) => scope.scopeVersionId === selectedId) ?? scopes[0] ?? null;
}

function hasSignedServiceOrder(pkg: CertifiedIofPackageRuntime | null | undefined) {
  const serviceOrder = asRecord(pkg?.serviceOrder);
  return Boolean(
    pkg?.serviceOrderSignatureId ||
      pkg?.customerSignatureId ||
      pkg?.serviceOrderSignedAt ||
      pkg?.customerSignedAt ||
      serviceOrder.serviceOrderSignatureId ||
      serviceOrder.signatureId ||
      serviceOrder.customerSignatureId ||
      serviceOrder.serviceOrderSignedAt ||
      serviceOrder.customerSignedAt ||
      serviceOrder.signedAt ||
      serviceOrder.executedAt ||
      ["SIGNED", "CUSTOMER_SIGNED", "FULLY_SIGNED", "EXECUTED", "FULLY_EXECUTED", "COUNTERSIGNED", "COMPLETE", "COMPLETED"].includes(String(serviceOrder.signatureStatus ?? serviceOrder.customerSignatureStatus ?? serviceOrder.status ?? "").toUpperCase()),
  );
}

export default function ScopeVersionWorkspace() {
  const { session, can } = useTeralinxAuth();
  const {
    selectedScopeVersion,
    selectedScopeVersionId,
    setSelectedScopeVersion,
    setSelectedScopeVersionId,
  } = useDALState();
  const canPromote = Boolean(session && can("scopeversion.authority"));
  const [scopeVersions, setScopeVersions] = useState<ScopeVersion[]>([]);
  const [certifiedPackages, setCertifiedPackages] = useState<CertifiedIofPackageRuntime[]>([]);
  const [selectedCertifiedId, setSelectedCertifiedId] = useState("");
  const [changeSummary, setChangeSummary] = useState("Initial ScopeVersion authority from signed Service Order.");
  const [engineeringReason, setEngineeringReason] = useState("Runtime promoted executed Service Order and Certified Draft IOF Package into the Order for Execution.");
  const [status, setStatus] = useState("ScopeVersion authority workspace ready.");
  const [pending, setPending] = useState(false);
  const [routeTab, setRouteTab] = useState<"ROUTE" | "INFRASTRUCTURE" | "CONDITIONS" | "HISTORY">("ROUTE");

  async function refresh() {
    setPending(true);
    try {
      const [nextScopes, nextCertified] = await Promise.all([
        listScopeVersions(),
        listCertifiedIofPackages(session),
      ]);
      setScopeVersions(nextScopes);
      setCertifiedPackages(nextCertified);
      if (!selectedCertifiedId && nextCertified[0]) setSelectedCertifiedId(nextCertified[0].certifiedPackageId);
      const active = firstReadyScope(nextScopes, selectedScopeVersionId || selectedScopeVersion?.scopeVersionId || "");
      if (active) {
        setSelectedScopeVersion(active);
        setSelectedScopeVersionId(active.scopeVersionId);
      }
    } catch (error) {
      setStatus(`ScopeVersion load failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setPending(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  const activeScope = useMemo(
    () => firstReadyScope(scopeVersions, selectedScopeVersionId || selectedScopeVersion?.scopeVersionId || ""),
    [scopeVersions, selectedScopeVersion?.scopeVersionId, selectedScopeVersionId],
  );
  const truth = asRecord(activeScope?.canonicalTruth);
  const graph = asRecord(truth.graph ?? truth.certifiedGraph);
  const readiness = asArray<Record<string, unknown>>(truth.downstreamReadiness ?? truth.readiness);
  const stations = asArray(truth.stations ?? truth.certifiedStations);
  const objects = asArray(truth.objects ?? truth.certifiedObjects);
  const facilities = asArray(truth.facilityInventory);
  const constraints = asArray(truth.constraints ?? truth.constraintHistory);
  const redlines = asArray(truth.redlineHistory);
  const notes = asArray(truth.engineeringNotes);
  const quantities = asRecord(truth.constructionQuantities);
  const mapSpec = useMemo(() => activeScope ? renderScopeVersion(activeScope) : null, [activeScope]);
  const selectedCertifiedPackage = useMemo(
    () => certifiedPackages.find((pkg) => pkg.certifiedPackageId === selectedCertifiedId) ?? null,
    [certifiedPackages, selectedCertifiedId],
  );
  const selectedCertifiedHasSignature = hasSignedServiceOrder(selectedCertifiedPackage);

  function selectScope(scopeVersionId: string) {
    const scope = scopeVersions.find((item) => item.scopeVersionId === scopeVersionId) ?? null;
    setSelectedScopeVersion(scope);
    setSelectedScopeVersionId(scope?.scopeVersionId ?? "");
  }

  async function promoteCertifiedPackage() {
    if (!selectedCertifiedId) {
      setStatus("Select a Certified Draft IOF Package before promotion.");
      return;
    }
    if (!selectedCertifiedHasSignature) {
      setStatus("Signed Service Order authority is required before ScopeVersion creation.");
      return;
    }
    setPending(true);
    try {
      const result = await generateScopeVersionFromCertifiedIofPackage(selectedCertifiedId, {
        previousScopeVersionId: selectedScopeVersionId || undefined,
        changeSummary,
        engineeringReason,
        approvedBy: session?.user.name,
        approvedTimestamp: new Date().toISOString(),
      }, session);
      const scope = result.scopeVersion as ScopeVersion;
      setSelectedScopeVersion(scope);
      setSelectedScopeVersionId(scope.scopeVersionId);
      setStatus(`${scope.scopeVersionId} created from Certified Draft IOF ${result.certifiedPackage.certifiedDraftIofPackageId ?? result.certifiedPackage.sourcePackageId ?? result.certifiedPackage.certifiedPackageId}.`);
      await refresh();
    } catch (error) {
      setStatus(`ScopeVersion promotion failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="dal-workspace wide scopeversion-workspace">
      <div className="dal-workspace-header">
        <div>
          <div className="dal-kicker">SCOPEVERSION AUTHORITY</div>
          <h2>ScopeVersion</h2>
          <p>Order for Execution created only after signed Service Order authority.</p>
        </div>
        <button type="button" onClick={() => void refresh()} disabled={pending}>Refresh</button>
      </div>

      <div className="dal-grid compact">
        <section className="dal-panel">
          <div className="dal-panel-title-row">
            <h3>Create From Signed Service Order</h3>
            <span className={`dal-badge ${canPromote ? "pass" : "warning"}`}>{canPromote ? "SCOPEVERSION AUTHORITY" : "READ ONLY"}</span>
          </div>
          <label>
            Certified Draft IOF Package
            <select value={selectedCertifiedId} onChange={(event) => setSelectedCertifiedId(event.target.value)}>
              <option value="">Select Certified Package</option>
              {certifiedPackages.map((pkg) => (
                <option key={pkg.certifiedPackageId} value={pkg.certifiedPackageId}>
                  {pkg.certifiedDraftIofPackageId ?? pkg.sourcePackageId ?? pkg.certifiedPackageId} / {pkg.scopeVersionId ? `Promoted ${pkg.scopeVersionId}` : hasSignedServiceOrder(pkg) ? "Signed SO ready" : "Signed SO required"}
                </option>
              ))}
            </select>
          </label>
          <label>
            Change Summary
            <input value={changeSummary} onChange={(event) => setChangeSummary(event.target.value)} />
          </label>
          <label>
            Promotion Reason
            <input value={engineeringReason} onChange={(event) => setEngineeringReason(event.target.value)} />
          </label>
          <button type="button" onClick={() => void promoteCertifiedPackage()} disabled={!canPromote || pending || !selectedCertifiedId || !selectedCertifiedHasSignature}>
            Create ScopeVersion
          </button>
          <div className="dal-status">{status}</div>
        </section>

        <section className="dal-panel">
          <div className="dal-panel-title-row">
            <h3>ScopeVersion Selection</h3>
            <span>{scopeVersions.length.toLocaleString()} versions</span>
          </div>
          <select value={activeScope?.scopeVersionId ?? ""} onChange={(event) => selectScope(event.target.value)}>
            <option value="">Select ScopeVersion</option>
            {scopeVersions.map((scope) => (
              <option key={scope.scopeVersionId} value={scope.scopeVersionId}>
                {scope.scopeVersionId} / {scope.status}
              </option>
            ))}
          </select>
          <div className="dal-list">
            {scopeVersions.slice(0, 8).map((scope) => (
              <button key={scope.scopeVersionId} type="button" className="dal-list-row" onClick={() => selectScope(scope.scopeVersionId)}>
                <b>{scope.scopeVersionId}</b>
                <small>{text(scope.revisionLabel ?? asRecord(scope.canonicalTruth).revisionLabel)} / {scope.status}</small>
              </button>
            ))}
          </div>
        </section>
      </div>

      {activeScope ? (
        <>
          <section className="dal-panel scopeversion-header-panel">
            <div className="dal-panel-title-row">
              <h3>{activeScope.scopeVersionId}</h3>
              <span className={`dal-badge ${statusClass(activeScope.status)}`}>{activeScope.status}</span>
            </div>
            <div className="dal-grid compact">
              <div><span>Revision</span><b>{text(activeScope.revisionLabel ?? truth.revisionLabel)}</b></div>
              <div><span>Customer</span><b>{text(asRecord(truth.customer).name ?? activeScope.customerId)}</b></div>
              <div><span>Opportunity</span><b>{text(asRecord(truth.opportunity).opportunityId ?? activeScope.opportunityId)}</b></div>
              <div><span>Product</span><b>{text(asRecord(truth.product).productName ?? activeScope.productName)}</b></div>
              <div><span>Authority</span><b>{text(truth.constitutionalAuthority)}</b></div>
              <div><span>Certification Date</span><b>{dateText(asRecord(truth.digitalCertificationMetadata).certifiedAt ?? activeScope.createdAt)}</b></div>
            </div>
          </section>

          <section className="dal-panel">
            <div className="dal-panel-title-row">
              <h3>Readiness</h3>
              <span>Engineering PASS / downstream PENDING</span>
            </div>
            <div className="scopeversion-readiness-grid">
              {readiness.map((item) => (
                <div key={String(item.key)} className={`dal-badge ${statusClass(item.status)}`}>
                  {text(item.label ?? item.key)}: {text(item.status)}
                </div>
              ))}
            </div>
          </section>

          <section className="dal-panel">
            <div className="dal-panel-title-row">
              <h3>Certified Route</h3>
              <span>{feet(routeLengthFeet(activeScope))}</span>
            </div>
            {mapSpec ? (
              <MapKernel
                specs={[mapSpec]}
                initialMode="geographic"
                initialBaseLayer="hybrid"
                showStationLabels
                stationDensityFeet={5280}
                height={520}
                presentationContext="TWIN"
              />
            ) : (
              <div className="dal-status">Select a ScopeVersion to render certified geometry.</div>
            )}
          </section>

          <nav className="scopeversion-route-tabs" aria-label="Certified route sections">
            {(["ROUTE", "INFRASTRUCTURE", "CONDITIONS", "HISTORY"] as const).map((tab) => <button type="button" key={tab} className={routeTab === tab ? "active-toggle" : undefined} onClick={() => setRouteTab(tab)}>{tab[0] + tab.slice(1).toLowerCase()}</button>)}
          </nav>

          <div className="dal-grid">
            <section className="dal-panel" hidden={routeTab !== "ROUTE"}>
              <h3>Engineering Summary</h3>
              <div className="dal-grid compact">
                <div><span>Route Length</span><b>{feet(routeLengthFeet(activeScope))}</b></div>
                <div><span>Geometry</span><b>{numberText(asArray(truth.routeGeometry ?? truth.geometry ?? activeScope.geometry).length)} coordinates</b></div>
                <div><span>Spine</span><b>{text(asRecord(truth.spine ?? truth.certifiedSpine).spineId)}</b></div>
                <div><span>Stations</span><b>{stations.length.toLocaleString()}</b></div>
                <div><span>Objects</span><b>{objects.length.toLocaleString()}</b></div>
                <div><span>Facilities</span><b>{facilities.length.toLocaleString()}</b></div>
                <div><span>Validation</span><b>{text(asRecord(asRecord(truth.validationSnapshot).packageValidation).status)}</b></div>
                <div><span>Graph</span><b>{numberText(asArray(graph.nodes).length)} nodes / {numberText(asArray(graph.edges).length)} edges</b></div>
              </div>
            </section>

            <section className="dal-panel" hidden={routeTab !== "INFRASTRUCTURE"}>
              <h3>Certified Quantities</h3>
              <div className="dal-status">{Array.isArray(quantities) ? quantities.length : Object.keys(asRecord(quantities)).length} governed quantity records</div>
              <details><summary>Technical Details</summary><pre className="dal-json">{JSON.stringify(quantities, null, 2)}</pre></details>
            </section>

            <section className="dal-panel" hidden={routeTab !== "INFRASTRUCTURE"}>
              <h3>Doctrine Compliance Snapshot</h3>
              <div className="dal-status">Governed doctrine evidence retained with the certified revision.</div>
              <details><summary>Technical Details</summary><pre className="dal-json">{JSON.stringify(truth.doctrineComplianceSnapshot ?? truth.engineeringDoctrine, null, 2)}</pre></details>
            </section>

            <section className="dal-panel" hidden={routeTab !== "CONDITIONS"}>
              <h3>Constraint Snapshot</h3>
              <div className="dal-list">
                {constraints.slice(0, 12).map((constraint, index) => (
                  <div key={String(asRecord(constraint).constraintId ?? index)} className="dal-list-row">
                    <b>{text(asRecord(constraint).category ?? asRecord(constraint).constraintId, `Constraint ${index + 1}`)}</b>
                    <small>{text(asRecord(constraint).status)} / {text(asRecord(constraint).severity)}</small>
                  </div>
                ))}
                {!constraints.length ? <div className="dal-status">No open constraints in this ScopeVersion snapshot.</div> : null}
              </div>
            </section>

            <section className="dal-panel" hidden={routeTab !== "HISTORY"}>
              <h3>Redline History</h3>
              <div className="dal-status">{redlines.length.toLocaleString()} governed redline records</div>
              <details><summary>Technical Details</summary><pre className="dal-json">{JSON.stringify(redlines, null, 2)}</pre></details>
            </section>

            <section className="dal-panel" hidden={routeTab !== "HISTORY"}>
              <h3>Revision History</h3>
              <details><summary>Technical Details</summary><pre className="dal-json">{JSON.stringify({
                parentScopeVersionId: activeScope.parentScopeVersionId,
                previousRevision: activeScope.previousRevision ?? truth.previousRevision,
                changeSummary: activeScope.changeSummary ?? truth.changeSummary,
                engineeringReason: activeScope.engineeringReason ?? truth.engineeringReason,
                approvedBy: activeScope.approvedBy ?? truth.approvedBy,
                approvedTimestamp: activeScope.approvedTimestamp ?? truth.approvedTimestamp,
              }, null, 2)}</pre></details>
            </section>

            <section className="dal-panel" hidden={routeTab !== "CONDITIONS"}>
              <h3>Engineering Notes</h3>
              <div className="dal-list">
                {notes.map((note, index) => (
                  <div key={index} className="dal-list-row">
                    <b>{String(note)}</b>
                  </div>
                ))}
                {!notes.length ? <div className="dal-status">No engineering notes recorded.</div> : null}
              </div>
            </section>

            <section className="dal-panel" hidden={routeTab !== "INFRASTRUCTURE"}>
              <h3>Graph Summary</h3>
              <details><summary>Technical Details</summary><pre className="dal-json">{JSON.stringify(truth.graphSummary ?? activeScope.graphSummary, null, 2)}</pre></details>
            </section>
          </div>
        </>
      ) : (
        <section className="dal-panel">
          <h3>No ScopeVersion Selected</h3>
          <div className="dal-status">Promote a Certified Draft IOF Package or select an existing ScopeVersion.</div>
        </section>
      )}
    </section>
  );
}
