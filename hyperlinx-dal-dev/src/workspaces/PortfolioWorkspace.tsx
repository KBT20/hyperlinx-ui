import { useEffect, useMemo, useState } from "react";
import { listCandidateSites, listOpportunitySeeds, saveScopeVersion } from "../api/dalClient";
import { useDALState } from "../dal/DALState";
import { generateDeploymentPlan } from "../portfolio/phasePlanner";
import { createScopeVersionFromOpportunitySeed } from "../scopeversion/scopeVersionUtils";
import type { CandidateSite } from "../types/candidateSite";
import type { CandidateType, OpportunitySeed, PortfolioPhasePlan, PortfolioScenarioSize } from "../types/portfolio";

type SortKey =
  | "rank"
  | "siteName"
  | "candidateType"
  | "facilityType"
  | "marketSegment"
  | "distanceFeet"
  | "buildCost"
  | "estimatedRevenueAnnual"
  | "estimatedNRC"
  | "estimatedMRC"
  | "estimatedTCV"
  | "paybackMonths"
  | "strategicScore"
  | "financialScore"
  | "engineeringScore"
  | "overallScore"
  | "networkAffinityScore"
  | "riskScore"
  | "constructabilityScore"
  | "permitScore"
  | "crossingScore"
  | "roadAccessScore"
  | "environmentalRisk"
  | "roi"
  | "buildMiles";

type DistanceFilter = "all" | "under1000" | "under2500" | "under5000" | "under10000";
type RiskFilter = "all" | "low" | "medium" | "high";
type BuildabilityFilter = "all" | "buildable" | "constrained" | "highRisk";

function fmt(n: number | undefined) {
  return Number(n || 0).toLocaleString();
}

function money(n: number | undefined) {
  return Number(n || 0).toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function avg(items: OpportunitySeed[], value: (item: OpportunitySeed) => number) {
  return items.reduce((sum, item) => sum + value(item), 0) / Math.max(items.length, 1);
}

function riskBand(score: number | undefined): RiskFilter {
  const value = Number(score ?? 0);
  if (value <= 35) return "low";
  if (value <= 65) return "medium";
  return "high";
}

function distanceThreshold(filter: DistanceFilter) {
  if (filter === "under1000") return 1000;
  if (filter === "under2500") return 2500;
  if (filter === "under5000") return 5000;
  if (filter === "under10000") return 10000;
  return Infinity;
}

function scenarioPhasePlans(seeds: OpportunitySeed[], size: PortfolioScenarioSize): PortfolioPhasePlan[] {
  const selected = seeds.slice(0, size);
  const phaseSize = Math.ceil(selected.length / 3);
  return (["Phase 1", "Phase 2", "Phase 3"] as const).map((phase, index) => {
    const phaseSeeds = selected.slice(index * phaseSize, (index + 1) * phaseSize);
    return {
      phase,
      opportunityIds: phaseSeeds.map((seed) => seed.id),
      opportunityCount: phaseSeeds.length,
      capex: phaseSeeds.reduce((sum, seed) => sum + seed.buildCost, 0),
      revenueAnnual: phaseSeeds.reduce((sum, seed) => sum + seed.estimatedRevenueAnnual, 0),
      tcv: phaseSeeds.reduce((sum, seed) => sum + seed.estimatedTCV, 0),
      averagePaybackMonths: avg(phaseSeeds, (seed) => seed.paybackMonths),
      averageScore: avg(phaseSeeds, (seed) => seed.overallScore),
    };
  });
}

export default function PortfolioWorkspace() {
  const {
    selectedOpportunitySeed,
    setSelectedOpportunitySeed,
    setSelectedOpportunitySeedId,
    setSelectedScopeVersion,
    setSelectedScopeVersionId,
    setWorkspace,
  } = useDALState();
  const [seeds, setSeeds] = useState<OpportunitySeed[]>([]);
  const [candidateSites, setCandidateSites] = useState<CandidateSite[]>([]);
  const [typeFilter, setTypeFilter] = useState<"all" | CandidateType>("all");
  const [facilityFilter, setFacilityFilter] = useState("all");
  const [marketFilter, setMarketFilter] = useState("all");
  const [distanceFilter, setDistanceFilter] = useState<DistanceFilter>("all");
  const [riskFilter, setRiskFilter] = useState<RiskFilter>("all");
  const [buildabilityFilter, setBuildabilityFilter] = useState<BuildabilityFilter>("all");
  const [query, setQuery] = useState("");
  const [scenarioSize, setScenarioSize] = useState<PortfolioScenarioSize>(25);
  const [budget, setBudget] = useState(1500000);
  const [sortKey, setSortKey] = useState<SortKey>("overallScore");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [status, setStatus] = useState("Portfolio ready.");

  useEffect(() => {
    void refresh();
  }, []);

  async function refresh() {
    try {
      const [nextSites, nextSeeds] = await Promise.all([listCandidateSites(), listOpportunitySeeds()]);
      setCandidateSites(nextSites);
      setSeeds(nextSeeds.map((seed, index) => ({ ...seed, rank: seed.rank ?? index + 1 })));
      setStatus("Portfolio loaded.");
    } catch (err: any) {
      setStatus(`Portfolio load failed: ${err?.message ?? String(err)}`);
    }
  }

  const filteredSeeds = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = seeds.filter((seed) => {
      const matchesType = typeFilter === "all" || seed.candidateType === typeFilter;
      const matchesFacility = facilityFilter === "all" || seed.facilityType === facilityFilter;
      const matchesMarket = marketFilter === "all" || seed.marketSegment === marketFilter;
      const matchesDistance = Number(seed.buildPath?.buildFeet ?? seed.distanceFeet ?? 0) <= distanceThreshold(distanceFilter);
      const matchesRisk = riskFilter === "all" || riskBand(seed.riskScore ?? seed.buildPath?.riskScore) === riskFilter;
      const buildableStatus = seed.constructabilityAssessment?.buildableStatus;
      const matchesBuildability =
        buildabilityFilter === "all" ||
        (buildabilityFilter === "buildable" && buildableStatus === "BUILDABLE") ||
        (buildabilityFilter === "constrained" && buildableStatus === "CONSTRAINED") ||
        (buildabilityFilter === "highRisk" && buildableStatus === "HIGH_RISK");
      const matchesQuery = !q || [seed.id, seed.siteName, seed.candidateSiteId, seed.nearestRouteId, seed.nearestNodeId, seed.nearestStationId, seed.facilityType, seed.marketSegment].some((value) => String(value ?? "").toLowerCase().includes(q));
      return matchesType && matchesFacility && matchesMarket && matchesDistance && matchesRisk && matchesBuildability && matchesQuery;
    });
    return filtered.sort((a, b) => {
      const av = a[sortKey] ?? "";
      const bv = b[sortKey] ?? "";
      const delta = typeof av === "number" && typeof bv === "number" ? av - bv : String(av).localeCompare(String(bv));
      return sortDir === "asc" ? delta : -delta;
    });
  }, [buildabilityFilter, distanceFilter, facilityFilter, marketFilter, query, riskFilter, seeds, sortDir, sortKey, typeFilter]);

  const selectedScenario = useMemo(() => filteredSeeds.slice(0, scenarioSize), [filteredSeeds, scenarioSize]);
  const plans = useMemo(() => scenarioPhasePlans(filteredSeeds, scenarioSize), [filteredSeeds, scenarioSize]);
  const budgetPlan = useMemo(() => generateDeploymentPlan(filteredSeeds, budget), [budget, filteredSeeds]);
  const facilityTypes = useMemo(() => Array.from(new Set(seeds.map((seed) => seed.facilityType).filter(Boolean))).sort() as string[], [seeds]);
  const marketSegments = useMemo(() => Array.from(new Set(seeds.map((seed) => seed.marketSegment).filter(Boolean))).sort() as string[], [seeds]);

  async function createScopeVersion(seed = selectedOpportunitySeed) {
    if (!seed) {
      setStatus("Select an Opportunity Seed first.");
      return;
    }
    const scope = await saveScopeVersion(createScopeVersionFromOpportunitySeed(seed));
    setSelectedScopeVersion(scope);
    setSelectedScopeVersionId(scope.scopeVersionId);
    setStatus(`Created ScopeVersion ${scope.scopeVersionId} from ${seed.id}.`);
  }

  function selectSeed(seed: OpportunitySeed) {
    setSelectedOpportunitySeed(seed);
    setSelectedOpportunitySeedId(seed.id);
  }

  function changeSort(next: SortKey) {
    if (next === sortKey) setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    else {
      setSortKey(next);
      setSortDir("desc");
    }
  }

  const columns: Array<{ key: SortKey; label: string; render: (seed: OpportunitySeed) => string }> = [
    { key: "rank", label: "Rank", render: (seed) => String(seed.rank ?? "-") },
    { key: "siteName", label: "Site", render: (seed) => seed.siteName ?? seed.id },
    { key: "candidateType", label: "Type", render: (seed) => seed.candidateType },
    { key: "facilityType", label: "Facility", render: (seed) => seed.facilityType ?? "n/a" },
    { key: "marketSegment", label: "Market", render: (seed) => seed.marketSegment ?? "n/a" },
    { key: "distanceFeet", label: "Distance", render: (seed) => `${fmt(Math.round(seed.distanceFeet))} ft` },
    { key: "buildMiles", label: "Build Miles", render: (seed) => `${Number(seed.buildMiles ?? seed.buildPath?.buildMiles ?? 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}` },
    { key: "buildCost", label: "Build Cost", render: (seed) => money(seed.buildCost) },
    { key: "estimatedNRC", label: "NRC", render: (seed) => money(seed.estimatedNRC) },
    { key: "estimatedMRC", label: "MRC", render: (seed) => money(seed.estimatedMRC) },
    { key: "estimatedTCV", label: "TCV", render: (seed) => money(seed.estimatedTCV) },
    { key: "paybackMonths", label: "Payback", render: (seed) => `${fmt(Math.round(seed.paybackMonths))} mo` },
    { key: "strategicScore", label: "Strategic", render: (seed) => fmt(Math.round(seed.strategicScore)) },
    { key: "financialScore", label: "Financial", render: (seed) => fmt(Math.round(seed.financialScore)) },
    { key: "engineeringScore", label: "Engineering", render: (seed) => fmt(Math.round(seed.engineeringScore)) },
    { key: "networkAffinityScore", label: "Affinity", render: (seed) => fmt(Math.round(seed.networkAffinityScore ?? seed.networkAffinity?.affinityScore ?? 0)) },
    { key: "constructabilityScore", label: "Buildable", render: (seed) => fmt(Math.round(seed.constructabilityScore ?? 0)) },
    { key: "permitScore", label: "Permit", render: (seed) => fmt(Math.round(seed.permitScore ?? 0)) },
    { key: "crossingScore", label: "Crossing", render: (seed) => fmt(Math.round(seed.crossingScore ?? 0)) },
    { key: "roadAccessScore", label: "Access", render: (seed) => fmt(Math.round(seed.roadAccessScore ?? 0)) },
    { key: "riskScore", label: "Risk", render: (seed) => fmt(Math.round(seed.riskScore ?? seed.buildPath?.riskScore ?? 0)) },
    { key: "roi", label: "ROI", render: (seed) => `${Number(seed.roi ?? seed.estimatedTCV / Math.max(seed.buildCost, 1)).toLocaleString(undefined, { maximumFractionDigits: 2 })}x` },
    { key: "overallScore", label: "Overall", render: (seed) => fmt(Math.round(seed.overallScore)) },
  ];

  return (
    <section className="dal-workspace wide">
      <div className="dal-workspace-header">
        <div>
          <h2>DAL Portfolio</h2>
          <p>Ranked investment portfolio generation from Opportunity Seeds. Portfolio outputs advisory capital plans, not inventory graph mutations.</p>
        </div>
        <button type="button" onClick={() => void refresh()}>
          Refresh
        </button>
      </div>

      <div className="dal-panel">
        <div className="dal-status">{status}</div>
        <div className="dal-metrics">
          <span>Total Opportunities: {fmt(filteredSeeds.length)}</span>
          <span>Sites Imported: {fmt(candidateSites.length)}</span>
          <span>Sites Geocoded: {fmt(candidateSites.filter((site) => Number.isFinite(site.latitude) && Number.isFinite(site.longitude)).length)}</span>
          <span>Sites Evaluated: {fmt(candidateSites.filter((site) => site.status === "ANALYZED" || site.status === "QUALIFIED").length)}</span>
          <span>Qualified Opportunities: {fmt(candidateSites.filter((site) => site.status === "QUALIFIED").length)}</span>
          <span>Total Revenue: {money(filteredSeeds.reduce((sum, seed) => sum + seed.estimatedRevenueAnnual, 0))}</span>
          <span>Total Capex: {money(filteredSeeds.reduce((sum, seed) => sum + seed.buildCost, 0))}</span>
          <span>Average Payback: {fmt(Math.round(avg(filteredSeeds, (seed) => seed.paybackMonths)))} mo</span>
          <span>Buildable Opportunities: {fmt(filteredSeeds.filter((seed) => seed.constructabilityAssessment?.buildableStatus === "BUILDABLE").length)}</span>
          <span>Permit-Constrained: {fmt(filteredSeeds.filter((seed) => Number(seed.permitScore ?? 100) < 55).length)}</span>
          <span>High Crossing Risk: {fmt(filteredSeeds.filter((seed) => Number(seed.crossingScore ?? 100) < 55).length)}</span>
          <span>Average Score: {fmt(Math.round(avg(filteredSeeds, (seed) => seed.overallScore)))}</span>
        </div>
      </div>

      <div className="dal-grid">
        <div className="dal-panel">
          <h3>Filters</h3>
          <div className="dal-grid compact">
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Filter by site, seed, route, node, station" />
            <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value as "all" | CandidateType)}>
              <option value="all">All Types</option>
              <option value="enterprise">Enterprise</option>
              <option value="tower">Tower</option>
              <option value="data_center">Data Center</option>
              <option value="wireless">Wireless</option>
              <option value="carrier">Carrier</option>
              <option value="hyperscaler">Hyperscaler</option>
              <option value="residential_cluster">Residential Cluster</option>
            </select>
            <select value={facilityFilter} onChange={(event) => setFacilityFilter(event.target.value)}>
              <option value="all">All Facilities</option>
              {facilityTypes.map((facilityType) => (
                <option key={facilityType} value={facilityType}>
                  {facilityType}
                </option>
              ))}
            </select>
            <select value={marketFilter} onChange={(event) => setMarketFilter(event.target.value)}>
              <option value="all">All Markets</option>
              {marketSegments.map((marketSegment) => (
                <option key={marketSegment} value={marketSegment}>
                  {marketSegment}
                </option>
              ))}
            </select>
            <select value={distanceFilter} onChange={(event) => setDistanceFilter(event.target.value as DistanceFilter)}>
              <option value="all">All Build Lengths</option>
              <option value="under1000">Under 1000 ft</option>
              <option value="under2500">Under 2500 ft</option>
              <option value="under5000">Under 5000 ft</option>
              <option value="under10000">Under 10000 ft</option>
            </select>
            <select value={riskFilter} onChange={(event) => setRiskFilter(event.target.value as RiskFilter)}>
              <option value="all">All Risk</option>
              <option value="low">Low Risk</option>
              <option value="medium">Medium Risk</option>
              <option value="high">High Risk</option>
            </select>
            <select value={buildabilityFilter} onChange={(event) => setBuildabilityFilter(event.target.value as BuildabilityFilter)}>
              <option value="all">All Buildability</option>
              <option value="buildable">Buildable</option>
              <option value="constrained">Constrained</option>
              <option value="highRisk">High Risk</option>
            </select>
            <select
              value={`${sortKey}:${sortDir}`}
              onChange={(event) => {
                const [nextSort, nextDir] = event.target.value.split(":") as [SortKey, "asc" | "desc"];
                setSortKey(nextSort);
                setSortDir(nextDir);
              }}
            >
              <option value="estimatedRevenueAnnual:desc">Top Revenue</option>
              <option value="paybackMonths:asc">Fastest Payback</option>
              <option value="buildCost:asc">Lowest Cost</option>
              <option value="strategicScore:desc">Highest Strategic Score</option>
              <option value="financialScore:desc">Highest Financial Score</option>
              <option value="engineeringScore:desc">Highest Engineering Score</option>
              <option value="networkAffinityScore:desc">Highest Network Affinity</option>
              <option value="constructabilityScore:desc">Highest Constructability</option>
              <option value="permitScore:desc">Lowest Permit Risk</option>
              <option value="crossingScore:desc">Lowest Crossing Risk</option>
              <option value="roadAccessScore:desc">Highest Utility Access</option>
              <option value="environmentalRisk:asc">Lowest Environmental Risk</option>
              <option value="riskScore:asc">Lowest Risk</option>
              <option value="roi:desc">Highest ROI</option>
              <option value="buildMiles:asc">Shortest Build Miles</option>
              <option value="overallScore:desc">Highest Overall Score</option>
            </select>
          </div>
        </div>

        <div className="dal-panel">
          <h3>Portfolio Scenarios</h3>
          <div className="dal-actions">
            {([10, 25, 50, 100] as PortfolioScenarioSize[]).map((size) => (
              <button key={size} type="button" className={scenarioSize === size ? "active-toggle" : ""} onClick={() => setScenarioSize(size)}>
                Top {size}
              </button>
            ))}
          </div>
          <div className="dal-metrics">
            <span>Scenario TCV: {money(selectedScenario.reduce((sum, seed) => sum + seed.estimatedTCV, 0))}</span>
            <span>Scenario Capex: {money(selectedScenario.reduce((sum, seed) => sum + seed.buildCost, 0))}</span>
            <span>Scenario Payback: {fmt(Math.round(avg(selectedScenario, (seed) => seed.paybackMonths)))} mo</span>
          </div>
          <input type="number" min={10000} step={50000} value={budget} onChange={(event) => setBudget(Number(event.target.value))} />
          <div className="dal-status">Budget phase planner selects {fmt(budgetPlan.selectedOpportunityIds.length)} opportunities within {money(budgetPlan.budget)}.</div>
        </div>
      </div>

      <div className="dal-grid">
        <div className="dal-panel">
          <h3>Network Affinity Context</h3>
          <div className="dal-metrics">
            <span>Selected Attachment: {selectedOpportunitySeed?.attachmentStrategy?.attachmentType?.replaceAll("_", " ") ?? "n/a"}</span>
            <span>Affinity Score: {fmt(Math.round(selectedOpportunitySeed?.networkAffinityScore ?? selectedOpportunitySeed?.networkAffinity?.affinityScore ?? 0))}</span>
            <span>Route: {selectedOpportunitySeed?.buildPath?.routeId ?? selectedOpportunitySeed?.nearestRouteId ?? "n/a"}</span>
            <span>Station: {selectedOpportunitySeed?.buildPath?.stationId ?? selectedOpportunitySeed?.nearestStationId ?? "n/a"}</span>
            <span>Build Feet: {fmt(Math.round(selectedOpportunitySeed?.buildPath?.buildFeet ?? selectedOpportunitySeed?.distanceFeet ?? 0))}</span>
            <span>Build Miles: {Number(selectedOpportunitySeed?.buildMiles ?? selectedOpportunitySeed?.buildPath?.buildMiles ?? 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
            <span>Construction: {selectedOpportunitySeed?.constructionType ?? selectedOpportunitySeed?.buildPath?.constructionType ?? "n/a"}</span>
            <span>Risk: {fmt(Math.round(selectedOpportunitySeed?.riskScore ?? selectedOpportunitySeed?.buildPath?.riskScore ?? 0))}</span>
            <span>Constructability: {fmt(Math.round(selectedOpportunitySeed?.constructabilityScore ?? 0))}</span>
            <span>Permits: {selectedOpportunitySeed?.constructabilityAssessment?.permitting.authorities.join(", ") ?? "n/a"}</span>
            <span>Crossing Score: {fmt(Math.round(selectedOpportunitySeed?.crossingScore ?? 0))}</span>
            <span>ROI: {Number(selectedOpportunitySeed?.roi ?? 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}x</span>
            <span>Capacity: {selectedOpportunitySeed?.capacityStatus ?? "n/a"}</span>
          </div>
          <button type="button" onClick={() => setWorkspace("networkAffinity")}>
            Network Affinity
          </button>
        </div>
      </div>

      <div className="dal-panel">
        <div className="dal-panel-title-row">
          <h3>Opportunity Grid</h3>
          <div className="dal-actions">
            <button type="button" onClick={() => void createScopeVersion()}>
              Create ScopeVersion
            </button>
            <button type="button" onClick={() => setWorkspace("marketplace")}>
              Marketplace
            </button>
          </div>
        </div>
        <div className="dal-table-wrap">
          <table className="dal-table">
            <thead>
              <tr>
                {columns.map((column) => (
                  <th key={column.key}>
                    <button type="button" onClick={() => changeSort(column.key)}>
                      {column.label}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredSeeds.map((seed) => (
                <tr key={seed.id} className={selectedOpportunitySeed?.id === seed.id ? "selected-row" : ""} onClick={() => selectSeed(seed)}>
                  {columns.map((column) => (
                    <td key={column.key}>{column.render(seed)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="dal-grid">
        {plans.map((plan) => (
          <div key={plan.phase} className="dal-panel">
            <h3>{plan.phase}</h3>
            <div className="dal-metrics">
              <span>Opportunities: {fmt(plan.opportunityCount)}</span>
              <span>Capex: {money(plan.capex)}</span>
              <span>Revenue: {money(plan.revenueAnnual)}</span>
              <span>TCV: {money(plan.tcv)}</span>
              <span>Payback: {fmt(Math.round(plan.averagePaybackMonths))} mo</span>
              <span>Score: {fmt(Math.round(plan.averageScore))}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="dal-grid">
        {budgetPlan.phases.map((plan) => (
          <div key={`budget-${plan.phase}`} className="dal-panel">
            <h3>Budget {plan.phase}</h3>
            <div className="dal-metrics">
              <span>Opportunities: {fmt(plan.opportunityCount)}</span>
              <span>Capex: {money(plan.capex)}</span>
              <span>Revenue: {money(plan.revenueAnnual)}</span>
              <span>TCV: {money(plan.tcv)}</span>
              <span>Payback: {fmt(Math.round(plan.averagePaybackMonths))} mo</span>
              <span>Score: {fmt(Math.round(plan.averageScore))}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
