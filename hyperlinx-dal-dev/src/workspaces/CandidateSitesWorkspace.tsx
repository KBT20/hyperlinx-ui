import { useEffect, useMemo, useState } from "react";
import {
  listCandidateSites,
  listOpportunitySeeds,
  loadInventoryGraph,
  saveCandidateSites,
  saveOpportunitySeeds,
} from "../api/dalClient";
import { batchGeocodeCandidateSites } from "../geocoding/geocodeEngine";
import { importCandidateSitesFromCsv } from "../import/candidateSiteImporter";
import { generateOpportunitySeedsForCandidates } from "../prism/opportunityGenerator";
import { useDALState } from "../dal/DALState";
import type { CandidateSite } from "../types/candidateSite";
import type { OpportunitySeed } from "../types/portfolio";

type SiteFilter = "all" | "imported" | "geocoding" | "geocoded" | "failed_geocode" | "verified" | "analyzed" | "qualified";
type BatchSize = 10 | 25 | 50 | 100 | 400 | "all";

function fmt(n: number | undefined) {
  return Number(n || 0).toLocaleString();
}

function money(n: number | undefined) {
  return Number(n || 0).toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
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
  const [status, setStatus] = useState("Candidate Sites ready.");

  useEffect(() => {
    void refresh();
  }, []);

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
    const imported = importCandidateSitesFromCsv(csvText);
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
    setStatus(`Imported ${saved.length.toLocaleString()} CandidateSite records.`);
  }

  async function geocodeSites(force = false) {
    const geocodingSites = sites.map((site) =>
      force || !Number.isFinite(site.latitude) || !Number.isFinite(site.longitude)
        ? ({ ...site, status: "GEOCODING", geocodeStatus: "GEOCODING" } as CandidateSite)
        : site
    );
    setSites(geocodingSites);
    setStatus(`${force ? "Re-geocoding" : "Geocoding"} ${geocodingSites.length.toLocaleString()} sites...`);
    const geocoded = await batchGeocodeCandidateSites(geocodingSites, undefined, { force });
    const saved = await saveCandidateSites(geocoded);
    setSites(saved);
    const geocodedCount = saved.filter((site) => Number.isFinite(site.latitude) && Number.isFinite(site.longitude)).length;
    const failedCount = saved.filter((site) => site.status === "FAILED_GEOCODE" || site.geocodeStatus === "FAILED" || site.geocodeStatus === "FAILED_GEOCODE").length;
    setStatus(`${force ? "Re-geocoded" : "Geocoded"} ${geocodedCount.toLocaleString()} sites. Failures: ${failedCount.toLocaleString()}.`);
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
    const geocodedCandidates = filteredSites.filter((site) => Number.isFinite(site.latitude) && Number.isFinite(site.longitude));
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

  return (
    <section className="dal-workspace wide">
      <div className="dal-workspace-header">
        <div>
          <h2>DAL Candidate Sites</h2>
          <p>Import Texas 400 CSV records, classify facilities, deterministically geocode candidates, and generate OpportunitySeeds against the selected inventory graph.</p>
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
            <span>Filtered Sites: {fmt(filteredSites.length)}</span>
            <span>Geocoded: {fmt(filteredSites.filter((site) => Number.isFinite(site.latitude) && Number.isFinite(site.longitude)).length)}</span>
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
          <h3>Candidate Site Metrics</h3>
          <div className="dal-metrics">
            <span>Imported: {fmt(sites.filter((site) => site.status === "IMPORTED").length)}</span>
            <span>Geocoding: {fmt(sites.filter((site) => site.status === "GEOCODING").length)}</span>
            <span>Geocoded: {fmt(sites.filter((site) => Number.isFinite(site.latitude) && Number.isFinite(site.longitude)).length)}</span>
            <span>Verified: {fmt(sites.filter((site) => site.status === "VERIFIED").length)}</span>
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
                <th>Latitude</th>
                <th>Longitude</th>
                <th>Geocoder</th>
                <th>Confidence</th>
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
                  <td>{site.latitude?.toFixed(5) ?? "n/a"}</td>
                  <td>{site.longitude?.toFixed(5) ?? "n/a"}</td>
                  <td>{site.geocodeProvider ?? site.geocodeStatus ?? "n/a"}</td>
                  <td>{site.geocodeConfidence ? `${Math.round(site.geocodeConfidence * 100)}%` : "n/a"}</td>
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
