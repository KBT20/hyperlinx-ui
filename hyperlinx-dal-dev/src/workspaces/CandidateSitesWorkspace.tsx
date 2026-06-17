import { useEffect, useMemo, useState } from "react";
import {
  listCandidateSites,
  listOpportunitySeeds,
  loadInventoryGraph,
  saveCandidateSites,
  saveOpportunitySeeds,
} from "../api/dalClient";
import { batchGeocodeCandidateSitesViaServer, geocodeCandidateSiteViaServer, isValidGeocodeCoordinate } from "../geocoding/geocodeEngine";
import { importCandidateSitesFromCsv } from "../import/candidateSiteImporter";
import { generateOpportunitySeedsForCandidates } from "../prism/opportunityGenerator";
import { useDALState } from "../dal/DALState";
import type { CandidateSite } from "../types/candidateSite";
import type { OpportunitySeed } from "../types/portfolio";

type SiteFilter = "all" | "imported" | "geocoding" | "geocoded" | "failed_geocode" | "verified" | "analyzed" | "qualified";
type BatchSize = 10 | 25 | 50 | 100 | 400 | "all";
type DatasetCertificationState = "DRAFT" | "PARTIAL" | "CERTIFIED" | "REJECTED";

function fmt(n: number | undefined) {
  return Number(n || 0).toLocaleString();
}

function money(n: number | undefined) {
  return Number(n || 0).toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function siteIsCertified(site: CandidateSite) {
  return site.geocodeStatus === "CERTIFIED" || site.geocodeMethod === "HUMAN_APPROVED";
}

function datasetCertification(sites: CandidateSite[]) {
  const total = sites.length;
  const certified = sites.filter(siteIsCertified).length;
  const geocoded = sites.filter((site) => Number.isFinite(site.latitude) && Number.isFinite(site.longitude)).length;
  const ambiguous = sites.filter((site) => site.geocodeStatus === "AMBIGUOUS" || site.status === "AMBIGUOUS_GEOCODE").length;
  const failed = sites.filter((site) => site.status === "FAILED_GEOCODE" || site.geocodeStatus === "FAILED" || site.geocodeStatus === "FAILED_GEOCODE").length;
  const rate = total ? certified / total : 0;
  const state: DatasetCertificationState = total === 0 ? "DRAFT" : rate === 1 ? "CERTIFIED" : rate >= 0.9 ? "PARTIAL" : "REJECTED";
  return { total, certified, geocoded, ambiguous, failed, rate, state };
}

export default function CandidateSitesWorkspace() {
  const {
    selectedGraph,
    selectedInventoryId,
    selectedCandidateSite,
    setSelectedCandidateSite,
    setSelectedCandidateSiteId,
    setSelectedGraph,
    setSelectedOpportunitySeed,
    setSelectedOpportunitySeedId,
    setWorkspace,
  } = useDALState();
  const [sites, setSites] = useState<CandidateSite[]>([]);
  const [seeds, setSeeds] = useState<OpportunitySeed[]>([]);
  const [csvText, setCsvText] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<SiteFilter>("all");
  const [facilityFilter, setFacilityFilter] = useState("all");
  const [marketFilter, setMarketFilter] = useState("all");
  const [batchSize, setBatchSize] = useState<BatchSize>("all");
  const [reviewAddress, setReviewAddress] = useState("");
  const [manualLat, setManualLat] = useState("");
  const [manualLon, setManualLon] = useState("");
  const [status, setStatus] = useState("Candidate Sites ready.");

  useEffect(() => {
    void refresh();
  }, []);

  useEffect(() => {
    const site = selectedCandidateSite ?? sites[0];
    setReviewAddress(site?.address ?? "");
    setManualLat(site?.latitude ? String(site.latitude) : "");
    setManualLon(site?.longitude ? String(site.longitude) : "");
  }, [selectedCandidateSite, sites]);

  async function refresh() {
    try {
      const [nextSites, nextSeeds] = await Promise.all([listCandidateSites(), listOpportunitySeeds()]);
      setSites(nextSites);
      setSeeds(nextSeeds);
      setStatus("Candidate site data loaded.");
    } catch (err: any) {
      setStatus(`Candidate site load failed: ${err?.message ?? String(err)}`);
    }
  }

  async function handleFile(file: File | null) {
    if (!file) return;
    setCsvText(await file.text());
  }

  async function importCsv() {
    const sourceDatasetId = `dataset-texas-400-${Date.now().toString(36)}`;
    const imported = importCandidateSitesFromCsv(csvText).map((site) => ({
      ...site,
      sourceDatasetId,
      classification: site.marketSegment ?? site.facilityType ?? "Opportunity Dataset",
    }));
    if (!imported.length) {
      setStatus("No candidate sites found in CSV.");
      return;
    }
    const saved = await saveCandidateSites(imported);
    setSites((prev) => {
      const byId = new Map(prev.map((site) => [site.candidateId, site]));
      saved.forEach((site) => byId.set(site.candidateId, site));
      return Array.from(byId.values());
    });
    setSelectedCandidateSite(saved[0] ?? null);
    setSelectedCandidateSiteId(saved[0]?.candidateId ?? "");
    setStatus(`Imported ${saved.length.toLocaleString()} CandidateSite records into Opportunity Dataset ${sourceDatasetId}.`);
  }

  async function geocodeSites(force = false) {
    const geocodingSites = sites.map((site) =>
      force || !Number.isFinite(site.latitude) || !Number.isFinite(site.longitude)
        ? ({ ...site, status: "GEOCODING", geocodeStatus: "GEOCODING" } as CandidateSite)
        : site
    );
    setSites(geocodingSites);
    setStatus(`${force ? "Re-geocoding" : "Geocoding"} ${geocodingSites.length.toLocaleString()} sites...`);
    const geocoded = await batchGeocodeCandidateSitesViaServer(geocodingSites, { force });
    const saved = await saveCandidateSites(geocoded);
    setSites(saved);
    const geocodedCount = saved.filter((site) => Number.isFinite(site.latitude) && Number.isFinite(site.longitude)).length;
    const failedCount = saved.filter((site) => site.status === "FAILED_GEOCODE" || site.geocodeStatus === "FAILED" || site.geocodeStatus === "FAILED_GEOCODE").length;
    const certification = datasetCertification(saved);
    const rawSuccesses = saved.filter((site) => site.geocodeStatus === "CERTIFIED" && site.geocodeMethod === "SERVER_PROXY").length;
    const normalizedSuccesses = saved.filter((site) => site.geocodeStatus === "CERTIFIED" && site.geocodeMethod === "NORMALIZED_ADDRESS").length;
    const manualReviewRequired = saved.filter((site) => site.geocodeStatus === "AMBIGUOUS" || site.status === "AMBIGUOUS_GEOCODE").length;
    setStatus(
      `${force ? "Re-geocoded" : "Geocoded"} ${geocodedCount.toLocaleString()} sites through DAL server geocoder. Total: ${saved.length.toLocaleString()}. Raw successes: ${rawSuccesses.toLocaleString()}. Normalized successes: ${normalizedSuccesses.toLocaleString()}. Manual review required: ${manualReviewRequired.toLocaleString()}. Failed after all attempts: ${failedCount.toLocaleString()}. Dataset: ${certification.state}.`
    );
  }

  async function persistSiteUpdate(nextSite: CandidateSite) {
    const saved = await saveCandidateSites(sites.map((site) => (site.candidateId === nextSite.candidateId ? nextSite : site)));
    setSites(saved);
    const selected = saved.find((site) => site.candidateId === nextSite.candidateId) ?? nextSite;
    setSelectedCandidateSite(selected);
    setSelectedCandidateSiteId(selected.candidateId);
    return selected;
  }

  async function rerunSelectedGeocode() {
    const site = selectedCandidateSite ?? filteredSites[0];
    if (!site) return;
    const candidate = reviewAddress.trim() ? { ...site, address: reviewAddress.trim(), status: "GEOCODING" as const, geocodeStatus: "GEOCODING" as const } : site;
    setStatus(`Re-running DAL server geocode for ${candidate.companyName}...`);
    const geocoded = await geocodeCandidateSiteViaServer(candidate, { force: true });
    await persistSiteUpdate(geocoded);
    setStatus(`Geocode review updated ${geocoded.companyName}: ${geocoded.geocodeStatus ?? geocoded.status}.`);
  }

  async function approveSelectedLocation(candidateIndex?: number) {
    const site = selectedCandidateSite ?? filteredSites[0];
    if (!site) return;
    const candidate = typeof candidateIndex === "number" ? site.geocodeCandidates?.[candidateIndex] : undefined;
    const lat = candidate?.lat ?? site.latitude;
    const lon = candidate?.lon ?? site.longitude;
    if (!isValidGeocodeCoordinate(lat, lon)) {
      setStatus("Cannot approve location without valid coordinates.");
      return;
    }
    const timestamp = new Date().toISOString();
    const nextSite: CandidateSite = {
      ...site,
      latitude: Number(lat),
      longitude: Number(lon),
      normalizedAddress: candidate?.normalizedAddress ?? site.normalizedAddress,
      geocodeProvider: candidate?.provider ?? site.geocodeProvider ?? "human-approved",
      geocodeConfidence: candidate?.confidence ?? site.geocodeConfidence ?? 1,
      geocodeStatus: "CERTIFIED",
      geocodeMethod: "HUMAN_APPROVED",
      status: "VERIFIED",
      certifiedBy: "DAL Operator",
      certifiedAt: timestamp,
      geocodeTimestamp: timestamp,
      geocodedAt: timestamp,
    };
    await persistSiteUpdate(nextSite);
    setStatus(`Human-approved geocode for ${nextSite.companyName}.`);
  }

  async function manualPinSelectedLocation() {
    const site = selectedCandidateSite ?? filteredSites[0];
    if (!site) return;
    const lat = Number(manualLat);
    const lon = Number(manualLon);
    if (!isValidGeocodeCoordinate(lat, lon)) {
      setStatus("Manual pin requires valid latitude and longitude.");
      return;
    }
    const timestamp = new Date().toISOString();
    await persistSiteUpdate({
      ...site,
      latitude: lat,
      longitude: lon,
      geocodeProvider: "human-manual-pin",
      geocodeConfidence: 1,
      geocodeStatus: "CERTIFIED",
      geocodeMethod: "HUMAN_APPROVED",
      status: "VERIFIED",
      certifiedBy: "DAL Operator",
      certifiedAt: timestamp,
      geocodeTimestamp: timestamp,
      geocodedAt: timestamp,
    });
    setStatus(`Manual pin approved for ${site.companyName}.`);
  }

  async function ensureGraph() {
    if (selectedGraph) return selectedGraph;
    if (!selectedInventoryId) return null;
    const graph = await loadInventoryGraph(selectedInventoryId);
    setSelectedGraph(graph);
    return graph;
  }

  async function generateOpportunities() {
    const graph = await ensureGraph();
    if (!graph) {
      setStatus("Select or load an inventory graph before generating opportunities.");
      return;
    }
    const geocodedCandidates = filteredSites.filter(siteIsCertified);
    const candidates = batchSize === "all" ? geocodedCandidates : geocodedCandidates.slice(0, batchSize);
    if (!candidates.length) {
      setStatus("Geocode candidate sites before generating opportunities.");
      return;
    }
    setStatus(`Analyzing ${candidates.length.toLocaleString()} candidate sites against ${graph.metadata.name}...`);
    const generated = generateOpportunitySeedsForCandidates(graph, candidates);
    const analyzedSites = sites.map((site) => {
      const seed = generated.find((item) => item.candidateSiteId === site.candidateId);
      return seed ? { ...site, status: seed.overallScore >= 70 ? "QUALIFIED" : "ANALYZED" } : site;
    }) as CandidateSite[];
    const [savedSeeds, savedSites] = await Promise.all([saveOpportunitySeeds(generated), saveCandidateSites(analyzedSites)]);
    setSeeds(savedSeeds);
    setSites(savedSites);
    if (savedSeeds[0]) {
      setSelectedOpportunitySeed(savedSeeds[0]);
      setSelectedOpportunitySeedId(savedSeeds[0].id);
    }
    setStatus(`Generated ${savedSeeds.length.toLocaleString()} OpportunitySeeds.`);
  }

  const facilityTypes = useMemo(() => Array.from(new Set(sites.map((site) => site.facilityType).filter(Boolean))).sort() as string[], [sites]);
  const marketSegments = useMemo(() => Array.from(new Set(sites.map((site) => site.marketSegment).filter(Boolean))).sort() as string[], [sites]);

  const filteredSites = useMemo(() => {
    const q = query.trim().toLowerCase();
    return sites.filter((site) => {
      const matchesStatus = filter === "all" || site.status.toLowerCase() === filter;
      const matchesFacility = facilityFilter === "all" || site.facilityType === facilityFilter;
      const matchesMarket = marketFilter === "all" || site.marketSegment === marketFilter;
      const matchesQuery =
        !q ||
        [site.candidateId, site.companyName, site.address, site.city, site.state, site.zipCode, site.county, site.facilityType, site.marketSegment]
          .some((value) => String(value ?? "").toLowerCase().includes(q));
      return matchesStatus && matchesFacility && matchesMarket && matchesQuery;
    });
  }, [facilityFilter, filter, marketFilter, query, sites]);

  const siteSeeds = useMemo(() => {
    const ids = new Set(filteredSites.map((site) => site.candidateId));
    return seeds.filter((seed) => seed.candidateSiteId && ids.has(seed.candidateSiteId));
  }, [filteredSites, seeds]);

  const certification = useMemo(() => datasetCertification(filteredSites), [filteredSites]);
  const selectedReviewSite = selectedCandidateSite ?? filteredSites[0] ?? null;

  return (
    <section className="dal-workspace wide">
      <div className="dal-workspace-header">
        <div>
          <h2>DAL Candidate Sites</h2>
          <p>Import Texas 400 CSV records, certify locations through the DAL server geocode proxy, and generate OpportunitySeeds only from analysis-ready sites.</p>
        </div>
        <button type="button" onClick={() => void refresh()}>
          Refresh
        </button>
      </div>

      <div className="dal-grid">
        <div className="dal-panel">
          <h3>Import CSV</h3>
          <input type="file" accept=".csv,.txt" onChange={(event) => void handleFile(event.target.files?.[0] ?? null)} />
          <textarea
            value={csvText}
            onChange={(event) => setCsvText(event.target.value)}
            placeholder="Expected columns: company_name, location_address, location_city, location_state, location_zip_code__5"
          />
          <div className="dal-actions">
            <button type="button" onClick={() => void importCsv()}>
              Import Candidate Sites
            </button>
            <button type="button" onClick={() => void geocodeSites()} disabled={!sites.length}>
              Batch Geocode
            </button>
            <button type="button" onClick={() => void geocodeSites(true)} disabled={!sites.length}>
              Re-Geocode
            </button>
          </div>
          <div className="dal-status">{status}</div>
        </div>

        <div className="dal-panel">
          <h3>Generate Opportunities</h3>
          <div className="dal-metrics">
            <span>Inventory: {(selectedGraph?.inventoryId ?? selectedInventoryId) || "none"}</span>
            <span>Datasets: {fmt(new Set(sites.map((site) => site.sourceDatasetId).filter(Boolean)).size)}</span>
            <span>Filtered Sites: {fmt(filteredSites.length)}</span>
            <span>Certified: {fmt(certification.certified)}</span>
            <span>Seeds: {fmt(siteSeeds.length)}</span>
          </div>
          <div className="dal-actions">
            {([10, 25, 50, 100, 400, "all"] as BatchSize[]).map((size) => (
              <button key={size} type="button" className={batchSize === size ? "active-toggle" : ""} onClick={() => setBatchSize(size)}>
                {size === "all" ? "All" : size}
              </button>
            ))}
          </div>
          <div className="dal-actions">
            <button type="button" onClick={() => void generateOpportunities()}>
              Generate Opportunities
            </button>
            <button type="button" onClick={() => setWorkspace("networkAffinity")}>
              Network Affinity
            </button>
          </div>
        </div>
      </div>

      <div className="dal-panel">
        <h3>Site Filters</h3>
        <div className="dal-grid compact">
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search company, address, city, ZIP, facility, market" />
          <select value={filter} onChange={(event) => setFilter(event.target.value as SiteFilter)}>
            <option value="all">All Statuses</option>
            <option value="imported">Imported</option>
            <option value="geocoding">Geocoding</option>
            <option value="geocoded">Geocoded</option>
            <option value="failed_geocode">Failed Geocode</option>
            <option value="verified">Verified</option>
            <option value="analyzed">Analyzed</option>
            <option value="qualified">Qualified</option>
          </select>
          <select value={facilityFilter} onChange={(event) => setFacilityFilter(event.target.value)}>
            <option value="all">All Facility Types</option>
            {facilityTypes.map((facilityType) => (
              <option key={facilityType} value={facilityType}>
                {facilityType}
              </option>
            ))}
          </select>
          <select value={marketFilter} onChange={(event) => setMarketFilter(event.target.value)}>
            <option value="all">All Market Segments</option>
            {marketSegments.map((marketSegment) => (
              <option key={marketSegment} value={marketSegment}>
                {marketSegment}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="dal-grid">
        <div className="dal-panel">
          <h3>Geocode Certification</h3>
          <div className="dal-metrics">
            <span>Total Texas 400 Sites: {fmt(certification.total)}</span>
            <span>Geocoded: {fmt(certification.geocoded)}</span>
            <span>Certified: {fmt(certification.certified)}</span>
            <span>Raw Successes: {fmt(filteredSites.filter((site) => site.geocodeStatus === "CERTIFIED" && site.geocodeMethod === "SERVER_PROXY").length)}</span>
            <span>Normalized Successes: {fmt(filteredSites.filter((site) => site.geocodeStatus === "CERTIFIED" && site.geocodeMethod === "NORMALIZED_ADDRESS").length)}</span>
            <span>Ambiguous: {fmt(certification.ambiguous)}</span>
            <span>Failed: {fmt(certification.failed)}</span>
            <span>Provider Success Rate: {Math.round(certification.rate * 100)}%</span>
            <span>Dataset Certification State: {certification.state}</span>
            <span>Ready For Analysis: {certification.state === "CERTIFIED" || certification.state === "PARTIAL" ? "CERTIFIED SITES ONLY" : "NO"}</span>
          </div>
        </div>

        <div className="dal-panel">
          <h3>Manual Geocode Review</h3>
          {selectedReviewSite ? (
            <>
              <div className="dal-grid compact">
                <input value={reviewAddress} onChange={(event) => setReviewAddress(event.target.value)} placeholder="Edit address" />
                <input value={manualLat} onChange={(event) => setManualLat(event.target.value)} placeholder="Manual latitude" />
                <input value={manualLon} onChange={(event) => setManualLon(event.target.value)} placeholder="Manual longitude" />
              </div>
              <div className="dal-actions">
                <button type="button" onClick={() => void rerunSelectedGeocode()}>
                  Re-Run Geocode
                </button>
                <button type="button" onClick={() => void approveSelectedLocation()}>
                  Approve Current Location
                </button>
                <button type="button" onClick={() => void manualPinSelectedLocation()}>
                  Approve Manual Pin
                </button>
              </div>
              <div className="dal-metrics">
                <span>Raw Address: {selectedReviewSite.rawAddress ?? [selectedReviewSite.address, selectedReviewSite.city, selectedReviewSite.state, selectedReviewSite.zipCode].filter(Boolean).join(", ")}</span>
                <span>Normalized Address: {selectedReviewSite.normalizedAddress ?? "n/a"}</span>
                <span>Suite Detail: {selectedReviewSite.suiteDetail ?? "none"}</span>
                <span>Issue Flags: {(selectedReviewSite.addressIssueFlags ?? []).join(", ") || "none"}</span>
                <span>Suite Stripping Improved Match: {selectedReviewSite.suiteStrippingImprovedMatch ? "YES" : "NO"}</span>
                <span>Failure Reason: {selectedReviewSite.geocodeFailureReason ?? "n/a"}</span>
              </div>
              <div className="dal-table-wrap">
                <table className="dal-table">
                  <thead>
                    <tr>
                      <th>Variant</th>
                      <th>Provider</th>
                      <th>Provider URL</th>
                      <th>Status</th>
                      <th>Confidence</th>
                      <th>Failure Reason</th>
                      <th>Response Summary</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(selectedReviewSite.geocodeAttempts ?? []).map((attempt, index) => (
                      <tr key={`${attempt.provider}-${attempt.addressVariant ?? "variant"}-${index}`}>
                        <td>{attempt.addressVariant ?? "n/a"}</td>
                        <td>{attempt.provider}</td>
                        <td>{attempt.providerUrl ?? "n/a"}</td>
                        <td>{attempt.responseStatus ?? "n/a"}</td>
                        <td>{attempt.confidence ? `${Math.round(attempt.confidence * 100)}%` : "n/a"}</td>
                        <td>{attempt.failureReason ?? "n/a"}</td>
                        <td>{attempt.responseBodySummary ?? "n/a"}</td>
                      </tr>
                    ))}
                    {!(selectedReviewSite.geocodeAttempts ?? []).length ? (
                      <tr>
                        <td colSpan={7}>No provider attempts stored yet. Re-run geocode to populate diagnostics.</td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
              <div className="dal-table-wrap">
                <table className="dal-table">
                  <thead>
                    <tr>
                      <th>Candidate</th>
                      <th>Provider</th>
                      <th>Confidence</th>
                      <th>Latitude</th>
                      <th>Longitude</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(selectedReviewSite.geocodeCandidates ?? []).slice(0, 5).map((candidate, index) => (
                      <tr key={`${candidate.provider ?? "candidate"}-${index}`}>
                        <td>{candidate.normalizedAddress ?? "Candidate result"}</td>
                        <td>{candidate.provider ?? "n/a"}</td>
                        <td>{candidate.confidence ? `${Math.round(candidate.confidence * 100)}%` : "n/a"}</td>
                        <td>{candidate.lat?.toFixed(6) ?? "n/a"}</td>
                        <td>{candidate.lon?.toFixed(6) ?? "n/a"}</td>
                        <td>
                          <button type="button" onClick={() => void approveSelectedLocation(index)}>
                            Select
                          </button>
                        </td>
                      </tr>
                    ))}
                    {!(selectedReviewSite.geocodeCandidates ?? []).length ? (
                      <tr>
                        <td colSpan={6}>No candidate results yet. Re-run geocode or manually pin.</td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div className="dal-status">Select an ambiguous or failed site for review.</div>
          )}
        </div>
      </div>

      <div className="dal-grid">
        <div className="dal-panel">
          <h3>Candidate Site Metrics</h3>
          <div className="dal-metrics">
            <span>Imported: {fmt(sites.filter((site) => site.status === "IMPORTED").length)}</span>
            <span>Geocoding: {fmt(sites.filter((site) => site.status === "GEOCODING").length)}</span>
            <span>Geocoded: {fmt(sites.filter((site) => Number.isFinite(site.latitude) && Number.isFinite(site.longitude)).length)}</span>
            <span>Verified: {fmt(sites.filter((site) => site.status === "VERIFIED").length)}</span>
            <span>Certified: {fmt(sites.filter(siteIsCertified).length)}</span>
            <span>Ambiguous: {fmt(sites.filter((site) => site.status === "AMBIGUOUS_GEOCODE" || site.geocodeStatus === "AMBIGUOUS").length)}</span>
            <span>Failed: {fmt(sites.filter((site) => site.status === "FAILED_GEOCODE" || site.geocodeStatus === "FAILED" || site.geocodeStatus === "FAILED_GEOCODE").length)}</span>
            <span>Sites Evaluated: {fmt(sites.filter((site) => site.status === "ANALYZED" || site.status === "QUALIFIED").length)}</span>
            <span>Qualified: {fmt(sites.filter((site) => site.status === "QUALIFIED").length)}</span>
            <span>Seed TCV: {money(siteSeeds.reduce((sum, seed) => sum + seed.estimatedTCV, 0))}</span>
          </div>
        </div>

        <div className="dal-panel">
          <h3>Selected Site</h3>
          <pre className="dal-pre">{JSON.stringify(selectedCandidateSite ?? filteredSites[0] ?? {}, null, 2)}</pre>
        </div>
      </div>

      <div className="dal-panel">
        <h3>View Sites</h3>
        <div className="dal-table-wrap">
          <table className="dal-table">
            <thead>
              <tr>
                <th>Company</th>
                <th>Address</th>
                <th>City</th>
                <th>ZIP</th>
                <th>Facility</th>
                <th>Market</th>
                <th>Status</th>
                <th>Dataset</th>
                <th>Classification</th>
                <th>Latitude</th>
                <th>Longitude</th>
                <th>Geocoder</th>
                <th>Method</th>
                <th>Normalized Address</th>
                <th>Address Flags</th>
                <th>Confidence</th>
                <th>Certified</th>
                <th>Geocode Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {filteredSites.map((site) => (
                <tr
                  key={site.candidateId}
                  className={selectedCandidateSite?.candidateId === site.candidateId ? "selected-row" : ""}
                  onClick={() => {
                    setSelectedCandidateSite(site);
                    setSelectedCandidateSiteId(site.candidateId);
                  }}
                >
                  <td>{site.companyName}</td>
                  <td>{site.address}</td>
                  <td>{site.city}</td>
                  <td>{site.zipCode}</td>
                  <td>{site.facilityType ?? "n/a"}</td>
                  <td>{site.marketSegment ?? "n/a"}</td>
                  <td>{site.status}</td>
                  <td>{site.sourceDatasetId ?? "n/a"}</td>
                  <td>{site.classification ?? site.marketSegment ?? site.facilityType ?? "n/a"}</td>
                  <td>{site.latitude?.toFixed(5) ?? "n/a"}</td>
                  <td>{site.longitude?.toFixed(5) ?? "n/a"}</td>
                  <td>{site.geocodeProvider ?? site.geocodeStatus ?? "n/a"}</td>
                  <td>{site.geocodeMethod ?? "n/a"}</td>
                  <td>{site.normalizedAddress ?? "n/a"}</td>
                  <td>{(site.addressIssueFlags ?? []).join(", ") || "n/a"}</td>
                  <td>{site.geocodeConfidence ? `${Math.round(site.geocodeConfidence * 100)}%` : "n/a"}</td>
                  <td>{siteIsCertified(site) ? `${site.certifiedBy ?? "provider"} ${site.certifiedAt ?? ""}` : "NO"}</td>
                  <td>{site.geocodeTimestamp ?? site.geocodedAt ?? "n/a"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
