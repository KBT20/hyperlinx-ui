import { useEffect, useMemo, useState } from "react";
import { listMarketplaceQuotes, listScopeVersions, saveMarketplaceQuote, saveScopeVersion } from "../api/dalClient";
import { applyQuoteToScopeVersion, generatePreliminaryQuote } from "../commercial/quoteEngine";
import { useDALState } from "../dal/DALState";
import type { MarketplaceQuote, ScopeVersion } from "../types/dal";

function fmtMoney(n: number) {
  return n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function fmtPercent(n: number | undefined) {
  return `${Math.round(Number(n || 0) * 100)}%`;
}

export default function MarketplaceWorkspace() {
  const {
    selectedScopeVersion,
    setSelectedScopeVersion,
    setSelectedScopeVersionId,
    setWorkspace,
  } = useDALState();
  const [scopeVersions, setScopeVersions] = useState<ScopeVersion[]>([]);
  const [quotes, setQuotes] = useState<MarketplaceQuote[]>([]);
  const [termMonths, setTermMonths] = useState(36);
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState("Marketplace ready.");

  useEffect(() => {
    void refresh();
  }, []);

  const quoteDraft = useMemo(() => {
    const canonicalScopes = scopeVersions.filter((item) => (item.canonicalTruth as any)?.networkBasis && (item.canonicalTruth as any)?.financialBasis);
    const selectedCanonical =
      selectedScopeVersion && (selectedScopeVersion.canonicalTruth as any)?.networkBasis && (selectedScopeVersion.canonicalTruth as any)?.financialBasis
        ? selectedScopeVersion
        : null;
    const scope = selectedCanonical ?? canonicalScopes.find((item) => (item.canonicalTruth as any)?.decisionType === "PrismSiteDecision") ?? canonicalScopes[0];
    if (!scope) return null;
    const draft = generatePreliminaryQuote(scope, termMonths);
    return notes ? { ...draft, notes } : draft;
  }, [notes, scopeVersions, selectedScopeVersion, termMonths]);
  const quoteScope = quoteDraft
    ? selectedScopeVersion?.scopeVersionId === quoteDraft.scopeVersionId
      ? selectedScopeVersion
      : scopeVersions.find((scope) => scope.scopeVersionId === quoteDraft.scopeVersionId)
    : null;
  const routeAuthorityReference = quoteScope?.certifiedRouteReference;
  const authoritativeQuoteAllowed = routeAuthorityReference?.routeAuthorityState === "CERTIFIED_ROUTE";

  async function refresh() {
    try {
      const [nextQuotes, nextScopes] = await Promise.all([listMarketplaceQuotes(), listScopeVersions()]);
      setQuotes(nextQuotes);
      setScopeVersions(nextScopes);
      setStatus("Marketplace data loaded.");
    } catch (err: any) {
      setStatus(`Marketplace load failed: ${err?.message ?? String(err)}`);
    }
  }

  async function saveQuote() {
    if (!quoteDraft) return;
    const saved = await saveMarketplaceQuote(quoteDraft);
    setQuotes((prev) => [saved, ...prev.filter((item) => item.quoteId !== saved.quoteId)]);
    const scope = selectedScopeVersion ?? scopeVersions.find((item) => item.scopeVersionId === saved.scopeVersionId);
    if (scope) {
      const quotedScope = await saveScopeVersion(applyQuoteToScopeVersion(scope, saved));
      setSelectedScopeVersion(quotedScope);
      setSelectedScopeVersionId(quotedScope.scopeVersionId);
      setScopeVersions((prev) => [quotedScope, ...prev.filter((item) => item.scopeVersionId !== quotedScope.scopeVersionId)]);
    }
    setStatus(`Saved quote ${saved.quoteId}.`);
  }

  return (
    <section className="dal-workspace">
      <div className="dal-workspace-header">
        <div>
          <h2>DAL Marketplace</h2>
          <p>Opportunity quote staging with deterministic DAL v1 NRC/MRC formulas.</p>
        </div>
        <button type="button" onClick={() => void refresh()}>
          Refresh
        </button>
      </div>

      <div className="dal-grid">
        <div className="dal-panel">
          <h3>Quote Draft</h3>
          {quoteDraft ? (
            <>
              <div className="dal-metrics">
                <span>ScopeVersion: {quoteDraft.scopeVersionId ?? "none"}</span>
                <span>Attachment: {quoteDraft.attachmentType?.replaceAll("_", " ") ?? "n/a"}</span>
                <span>Route: {quoteDraft.routeId ?? "n/a"}</span>
                <span>Station: {quoteDraft.stationId ?? "n/a"}</span>
                <span>Build Length: {Math.round(Number(quoteDraft.buildFeet ?? 0)).toLocaleString()} ft</span>
                <span>Construction: {quoteDraft.constructionType ?? "n/a"}</span>
                <span>Risk: {Math.round(Number(quoteDraft.riskScore ?? 0))}</span>
                <span>Cost: {fmtMoney(Number(quoteDraft.estimatedCost ?? 0))}</span>
                <span>Permit Cost: {fmtMoney(Number(quoteDraft.estimatedPermitCost ?? 0))}</span>
                <span>Crossing Cost: {fmtMoney(Number(quoteDraft.estimatedCrossingCost ?? 0))}</span>
                <span>Environmental Cost: {fmtMoney(Number(quoteDraft.estimatedEnvironmentalCost ?? 0))}</span>
                <span>Engineering Cost: {fmtMoney(Number(quoteDraft.estimatedEngineeringCost ?? 0))}</span>
                <span>Constructability: {Math.round(Number((quoteDraft.constructabilityAssessment as any)?.constructabilityScore ?? 0))}</span>
                <span>Quote Source: ScopeVersion geometry / build path / costs</span>
                <span>Route Authority State: {routeAuthorityReference?.routeAuthorityState ?? "NO_CERTIFIED_ROUTE"}</span>
                <span>Route Mode: {routeAuthorityReference?.routeMode ?? "UNKNOWN"}</span>
                <span>Route Feet: {Math.round(Number(routeAuthorityReference?.routeFeet ?? quoteDraft.buildFeet ?? 0)).toLocaleString()} ft</span>
                <span>Crow-Fly Feet: {routeAuthorityReference ? "see CertifiedRoute" : "n/a"}</span>
                <span>Route/Crow-Fly Ratio: {routeAuthorityReference ? "see CertifiedRoute" : "n/a"}</span>
                <span>Constraint Evidence: {routeAuthorityReference?.constraintEvidenceId ?? "MISSING"}</span>
                <span>Quote Authority: {authoritativeQuoteAllowed ? "AUTHORITATIVE" : "PRELIMINARY_ROUTE_NOT_CERTIFIED"}</span>
                <span>NRC: {fmtMoney(quoteDraft.nrc)}</span>
                <span>MRC: {fmtMoney(quoteDraft.mrc)}</span>
                <span>Construction NRC: {fmtMoney(Number(quoteDraft.constructionNrc ?? 0))}</span>
                <span>Engineering NRC: {fmtMoney(Number(quoteDraft.engineeringNrc ?? 0))}</span>
                <span>Permit NRC: {fmtMoney(Number(quoteDraft.permitNrc ?? 0))}</span>
                <span>Crossing NRC: {fmtMoney(Number(quoteDraft.crossingNrc ?? 0))}</span>
                <span>TCV: {fmtMoney(quoteDraft.totalContractValue)}</span>
                <span>Margin: {fmtPercent(quoteDraft.margin)}</span>
                <span>Payback: {Math.round(Number(quoteDraft.paybackMonths ?? 0))} mo</span>
                <span>ROI: {Number(quoteDraft.roi ?? 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}x</span>
              </div>
              <input type="number" min={1} value={termMonths} onChange={(event) => setTermMonths(Number(event.target.value))} />
              <textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Quote notes" />
              <div className="dal-actions">
                <button type="button" onClick={() => void saveQuote()}>
                  {authoritativeQuoteAllowed ? "Save Authoritative Quote" : "Save Preliminary Quote"}
                </button>
                <button type="button" onClick={() => setWorkspace("control")}>
                  Control
                </button>
              </div>
            </>
          ) : (
            <div className="dal-status">Create ranked Opportunity Seeds in Prism.</div>
          )}
          <div className="dal-status">{status}</div>
        </div>

        <div className="dal-panel">
          <h3>ScopeVersion Context</h3>
          <div className="dal-list">
            {scopeVersions.slice(0, 5).map((scope) => (
              <button
                key={scope.scopeVersionId}
                type="button"
                onClick={() => {
                  setSelectedScopeVersion(scope);
                  setSelectedScopeVersionId(scope.scopeVersionId);
                }}
              >
                {scope.scopeVersionId} | {scope.status} | {(scope.canonicalTruth as any)?.site?.companyName ?? (scope.canonicalTruth as any)?.candidateSite?.companyName ?? scope.source}
              </button>
            ))}
          </div>
          <pre className="dal-pre">{JSON.stringify(selectedScopeVersion ?? scopeVersions[0] ?? {}, null, 2)}</pre>
        </div>
      </div>

      <div className="dal-panel">
        <h3>Saved Quotes</h3>
        {quotes.length ? (
          <div className="dal-list">
            {quotes.map((quote) => (
              <div key={quote.quoteId} className="dal-list-row">
                <span>{quote.quoteId}</span>
                <b>{fmtMoney(quote.totalContractValue)}</b>
                <small>{quote.scopeVersionId ?? quote.opportunitySeedId ?? quote.opportunityId}</small>
                <small>{quote.attachmentType?.replaceAll("_", " ") ?? "no attachment"} | {quote.buildFeet ? `${Math.round(quote.buildFeet).toLocaleString()} ft` : "n/a"}</small>
              </div>
            ))}
          </div>
        ) : (
          <div className="dal-status">No quotes yet.</div>
        )}
      </div>
    </section>
  );
}
