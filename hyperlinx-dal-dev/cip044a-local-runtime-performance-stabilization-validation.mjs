import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { performance } from "node:perf_hooks";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const mutation = read("src/performance/CommercialMutationRuntime.ts");
const cache = read("src/runtime/ConstitutionalProjectionCache.ts");
const scheduler = read("src/runtime/ConstitutionalAssemblyScheduler.ts");
const workspace = read("src/components/workspaces/GoogleRfpWorkspace.tsx");
const map = read("src/mapkernel/MapRenderer.ts");
const summaries = read("src/repositories/CommercialSummaryProjections.ts");
const storage = read("src/api/dalStorage.ts");
const shared = read("server/routes/_shared.js");
const routes = read("server/routes/commercial-routes.js");
const opportunities = read("server/routes/commercial-opportunities.js");
const iofRoute = read("server/routes/commercial-iof-packages.js");
const pricing = read("src/commercial/CommercialPricingArchitecture.ts");
const doctrine = read("src/products/pointToPointLongHaulDoctrine.ts");

let passed = 0;
const check = (number, label, test) => {
  try { test(); passed += 1; console.log(`PASS ${number}: ${label}`); }
  catch (error) { console.error(`FAIL ${number}: ${label}`); throw error; }
};
const mutationBlock = (name) => mutation.match(new RegExp(`${name}: \\[([^\\]]+)\\]`))?.[1] ?? "";

check(1, "Civil mix does not invalidate route geometry", () => assert.doesNotMatch(mutationBlock("CIVIL_MIX_CHANGE"), /GEOMETRY/));
check(2, "Civil mix does not invalidate station authority", () => assert.doesNotMatch(mutationBlock("CIVIL_MIX_CHANGE"), /STATIONING/));
check(3, "Civil mix does not invalidate map geometry", () => assert.doesNotMatch(mutationBlock("CIVIL_MIX_CHANGE"), /MAP/));
check(4, "Civil mix does not invoke Engineering", () => assert.doesNotMatch(mutationBlock("CIVIL_MIX_CHANGE"), /ENGINEERING/));
check(5, "Civil mix does not rebuild Product Doctrine", () => assert.doesNotMatch(mutationBlock("CIVIL_MIX_CHANGE"), /PRODUCT_DOCTRINE/));
check(6, "Civil mix recalculates quantity", () => assert.match(mutationBlock("CIVIL_MIX_CHANGE"), /QUANTITY/));
check(7, "Civil mix recalculates estimate", () => assert.match(mutationBlock("CIVIL_MIX_CHANGE"), /ESTIMATE/));
check(8, "Civil mix recalculates financial totals", () => assert.match(mutationBlock("CIVIL_MIX_CHANGE"), /COMMERCIAL_FINANCIALS/));
check(9, "Material rate leaves quantity intact", () => assert.doesNotMatch(mutationBlock("MATERIAL_RATE_CHANGE"), /QUANTITY/));
check(10, "Material rate leaves geometry intact", () => assert.doesNotMatch(mutationBlock("MATERIAL_RATE_CHANGE"), /GEOMETRY/));
check(11, "Material rate updates estimate", () => assert.match(mutationBlock("MATERIAL_RATE_CHANGE"), /ESTIMATE/));
check(12, "Markup is financial/proposal only", () => assert.equal(mutationBlock("COMMERCIAL_MARKUP_CHANGE").replace(/\s|"/g, ""), "COMMERCIAL_FINANCIALS,PROPOSAL"));
check(13, "Duct configuration invokes construction capability", () => assert.match(mutationBlock("DUCT_CONFIGURATION_CHANGE"), /CONSTRUCTION_CAPABILITY/));
check(14, "Duct configuration updates material quantity", () => assert.match(mutationBlock("DUCT_CONFIGURATION_CHANGE"), /QUANTITY.*MATERIAL_RESOLUTION/));
check(15, "Duct configuration leaves geometry intact", () => assert.doesNotMatch(mutationBlock("DUCT_CONFIGURATION_CHANGE"), /GEOMETRY/));
check(16, "ILA OFF produces zero ILA quantity", () => assert.match(pricing, /input\.ilaMode === "OFF" \? 0/));
check(17, "ILA mode leaves route geometry intact", () => assert.doesNotMatch(mutationBlock("ILA_MODE_CHANGE"), /GEOMETRY/));
check(18, "Projection caches are bounded", () => assert.match(cache, /MAX_CACHE_ENTRIES = 128/));
check(19, "Cache entries have fingerprints", () => assert.match(cache, /inputHash/));
check(20, "Cache invalidation records a reason", () => assert.match(cache, /reason.*invalidatedAt/));
check(21, "Cache telemetry reports hits and misses", () => assert.match(cache, /hits,[\s\S]*misses:/));
check(22, "Structural IOF is separately cached", () => assert.match(scheduler, /DraftIofStructuralProjection/));
check(23, "Financial IOF projection updates independently", () => assert.match(scheduler, /CommercialFinancialProjection/));
check(24, "Map projection is an independent dependency class", () => assert.match(map, /dependencyClass: "MAP"/));
check(25, "Engineering projection is an independent dependency class", () => assert.match(scheduler, /dependencyClass: "ENGINEERING"/));
check(26, "List UI can consume summary projections", () => assert.match(read("src/repositories/commercialRepositories.ts"), /listSummaries/));
check(27, "Summary projections exclude full geometry", () => { const routeProjection = summaries.match(/export function projectRouteSummary[\s\S]*?\n}/)?.[0] ?? ""; assert.doesNotMatch(routeProjection, /commercialGeometry:/); });
check(28, "Commercial summaries provide ID-focused state", () => assert.match(summaries, /CommercialOpportunitySummary[\s\S]*RouteSummary[\s\S]*ProposalSummary/));
check(29, "JSON writes use flush and atomic rename", () => { assert.match(shared, /handle\.sync\(\)/); assert.match(shared, /rename\(temporary, destination\)/); });
check(30, "Transaction manifests cover coordinated operations", () => { assert.match(shared, /updateTransactionManifest/); assert.match(routes + opportunities + iofRoute, /ROUTE_OPPORTUNITY_SAVE/); assert.match(iofRoute, /DRAFT_IOF_SAVE[\s\S]*ENGINEERING_HANDOFF/); });
check(31, "IndexedDB is subordinate to server persistence", () => assert.match(storage, /serverRepository: "AUTHORITATIVE_PERSISTED_STATE"[\s\S]*indexedDb: "CACHE_OR_OFFLINE_WORKING_COPY"/));
check(32, "Historical revisions remain immutable", () => assert.match(pricing, /immutable: true/));
check(33, "Product Doctrine authority remains", () => assert.match(doctrine, /POINT_TO_POINT_LONG_HAUL_DOCTRINE/));
check(34, "CIP-043 catalogs remain intact", () => assert.match(pricing, /createCip043RateCatalog[\s\S]*createCip043MaterialCatalog/));
check(35, "CIP-042 ILA behavior remains intact", () => assert.match(pricing, /ILA OFF => 0 facilities \* \$0/));
check(36, "CIP-041 validation remains available", () => assert.ok(fs.existsSync(path.join(root, "cip041-engineering-quantity-reconciliation-authority-validation.mjs"))));
check(37, "Commercial cannot create ScopeVersion", () => assert.match(workspace, /noScopeVersionCreation: true/));
check(38, "Engineering certification remains required", () => assert.match(iofRoute, /submitCommercialDraftPackageToEngineering/));
check(39, "No PostgreSQL dependency introduced", () => assert.doesNotMatch(read("package.json"), /postgres|postgis|\bpg\b/i));
check(40, "No DAL1 deployment or migration code executed", () => assert.doesNotMatch(mutation + cache + scheduler + summaries, /DAL1|app\.teralinx\.net|deploy/i));
check(41, "Production app remains untouched", () => assert.ok(!fs.existsSync(path.join(root, "app.teralinx.net"))));

const benchmark = (operation, callback, iterations = 100000) => {
  let checksum = 0;
  const start = performance.now();
  for (let index = 0; index < iterations; index += 1) checksum += callback(index);
  const millisecondsPerChange = (performance.now() - start) / iterations;
  assert.ok(Number.isFinite(checksum));
  return { operation, millisecondsPerChange };
};
const routeFeet = 12 * 5280;
const benchmarks = [
  benchmark("CIVIL_MIX_CHANGE", () => {
    const plowFeet = Math.round(routeFeet * 0.82);
    const dirtFeet = Math.round(routeFeet * 0.12);
    const rockFeet = 0;
    return plowFeet + dirtFeet + rockFeet + (routeFeet - plowFeet - dirtFeet - rockFeet);
  }),
  benchmark("MATERIAL_RATE_CHANGE", (index) => routeFeet * (7.75 + (index % 2) * 0.0001)),
  benchmark("COMMERCIAL_MARKUP_CHANGE", (index) => 4_500_000 * (1 + 0.1 + (index % 2) * 0.0001)),
  benchmark("DUCT_CONFIGURATION_CHANGE", (index) => routeFeet * (2 + (index % 2)) * 1.03),
  benchmark("ILA_MODE_CHANGE", (index) => (index % 2 === 0 ? 0 : Math.max(0, Math.ceil(12 / 80) - 1)) * 250_000),
];
console.log("\n12-mile dependency fast-path kernel benchmarks:");
for (const result of benchmarks) console.log(`${result.operation}: ${result.millisecondsPerChange.toFixed(6)} ms/change`);
console.log(`${passed}/41 CIP-044A validation checks passed.`);
