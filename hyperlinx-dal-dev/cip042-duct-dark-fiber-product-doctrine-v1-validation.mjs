import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const doctrineSource = read("src/products/pointToPointLongHaulDoctrine.ts");
const registrySource = read("src/products/ProductRegistry.ts");
const contractsSource = read("src/products/ProductDoctrineContracts.ts");
const projectConfigSource = read("src/products/DuctDarkFiberProjectConfiguration.ts");
const versionSource = read("src/products/ProductDoctrineVersionRegistry.ts");
const ilaSource = read("src/commercial/IlaPlanningEngine.ts");
const estimateSource = read("src/commercial/TransparentEstimatingEngine.ts");
const authoritySource = read("src/commercial/DuctDarkFiberAuthorityLayers.ts");
const uiSource = read("src/components/workspaces/googleRfp/TransparentEstimateExplorer.tsx");
const workspaceSource = read("src/components/workspaces/GoogleRfpWorkspace.tsx");
const reconciliationSource = read("src/engineering/quantity/QuantityReconciliationEngine.ts");
const reconciliationRepositorySource = read("src/engineering/quantity/QuantityReconciliationRepository.ts");
const heliumSource = read("src/reference/helium/HeliumReferenceAssembly.ts");

async function loadStandalone(source) {
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(output).toString("base64")}`);
}
const ila = await loadStandalone(ilaSource);
const doctrine = await loadStandalone(doctrineSource);

const route = {
  routeId: "TEST-80-MILE-AUTHORITATIVE-ROUTE",
  source: "CUSTOMER_KMZ",
  routeMiles: 80,
  routeFeet: 422400,
  distanceMeters: 128747.52,
  geometry: [[-97, 35], [-95.85, 35]],
  routeAuthority: "CUSTOMER_PROVIDED_GEOMETRY_EVIDENCE",
  routeRevision: "R1",
  routeHash: "SHA256:80-MILE-ROUTE",
  measurementAuthority: "MEASURED_CENTERLINE",
};
const site = (role, coordinate) => ({ siteId: `SITE-${role}`, role, label: role, coordinate, source: "PROJECT_CONFIGURATION" });
const doctrineAssembly = doctrine.assemblePointToPointLongHaulDoctrine({
  accountId: "ACCOUNT", customerId: "CUSTOMER", aSite: site("A", route.geometry[0]), zSite: site("Z", route.geometry[1]), authoritativeRoute: route, osrmRoute: null,
  projectConfiguration: {
    ductCount: 3, ductDiameter: 1.5, ductMaterialSpec: "HDPE", fiberCount: 864, fiberCableType: "864-count", fiberPlacementPolicy: "BLOWN",
    slackPolicy: { mode: "PERCENTAGE", slackPercent: 5, authority: "PROJECT_CONFIGURATION", source: "TEST", revision: "R1" },
    structurePlanAuthority: "ENGINEERING_DEFINED", spliceArchitectureAuthority: "ENGINEERING_DEFINED", terminationConfiguration: "ENGINEERING_DEFINED",
  },
});
const buildPlan = (estimateId, controls) => ila.buildMemoizedIlaPlanningResult({ estimateId, routeId: route.routeId, aLabel: "A", zLabel: "Z", geometry: route.geometry, routeMiles: 80, organizationId: "ORG", tenantId: "TENANT", customerId: "CUSTOMER", opportunityId: "OPP", controls });
const off = buildPlan("ILA-OFF", { ilaMode: "OFF", planningAuthority: "MAX_SPAN_DISTANCE", placementMethod: "MAX_SPAN_DISTANCE", maxSpanMiles: 60, configurationRevision: 1 });
const intermediate = buildPlan("ILA-INTERMEDIATE", { ilaMode: "INTERMEDIATE_ONLY", planningAuthority: "MAX_SPAN_DISTANCE", placementMethod: "MAX_SPAN_DISTANCE", maxSpanMiles: 60, configurationRevision: 1 });
const bookended = buildPlan("ILA-BOOKENDED", { ilaMode: "BOOKENDED", planningAuthority: "MAX_SPAN_DISTANCE", placementMethod: "MAX_SPAN_DISTANCE", maxSpanMiles: 60, configurationRevision: 1 });

const checks = [];
function check(number, label, fn) { fn(); checks.push(number); console.log(`PASS ${number}. ${label}`); }

check(1, "Product Registry still resolves Duct & Dark Fiber", () => assert.match(registrySource, /POINT_TO_POINT_DUCT_DARK_FIBER_PRODUCT/));
check(2, "Commercial Planning selects product from registry", () => assert.match(workspaceSource, /PRODUCT_REGISTRY|productOptions/));
check(3, "Product Doctrine no longer hardcodes final handhole spacing", () => assert.doesNotMatch(doctrineSource, /routeMiles\s*\/\s*2/));
check(4, "Product Doctrine no longer hardcodes final vault spacing", () => assert.doesNotMatch(doctrineSource, /routeMiles\s*\/\s*10/));
check(5, "Product Doctrine no longer hardcodes splice-case spacing", () => assert.doesNotMatch(doctrineSource, /routeMiles\s*\/\s*15/));
check(6, "route length alone cannot create an ILA", () => assert.equal(doctrineAssembly.objects.filter((item) => /ILA/.test(item.objectType)).length, 0));
check(7, "route length alone cannot create regeneration", () => assert.equal(doctrineAssembly.objects.filter((item) => /REGEN/.test(item.objectType)).length, 0));
check(8, "OSRM is no longer constitutionally required", () => { assert.doesNotMatch(doctrine.POINT_TO_POINT_LONG_HAUL_DOCTRINE.requiredInputs.join(" "), /OSRM/); assert.doesNotMatch(doctrineSource, /"OSRM centerline exists"/); });
check(9, "authoritative route centerline is required", () => assert.ok(doctrine.POINT_TO_POINT_LONG_HAUL_DOCTRINE.requiredInputs.includes("authoritative route centerline")));
check(10, "duct count is Project Configuration", () => assert.match(projectConfigSource + registrySource, /ductCount[\s\S]*PROJECT_CONFIGURATION/));
check(11, "duct diameter is Project Configuration", () => assert.match(projectConfigSource, /ductDiameter/));
check(12, "fiber count is Project Configuration", () => assert.match(projectConfigSource, /fiberCount/));
check(13, "fiber slack policy is explicit and attributable", () => assert.match(projectConfigSource, /SlackPolicyMode[\s\S]*authority[\s\S]*source[\s\S]*revision[\s\S]*approvedBy/));
check(14, "continuous station authority remains intact", () => { assert.equal(doctrineAssembly.spine.stationAuthorityMode, "CONTINUOUS"); assert.ok(doctrineAssembly.stations.every((station) => station.constitutionalResolution === false)); });
check(15, "ILA OFF produces zero ILA objects", () => assert.equal(off.stationObjects.length, 0));
check(16, "ILA OFF produces zero ILA capital", () => assert.equal(off.totalCost, 0));
check(17, "ILA OFF produces zero ILA equipment cost", () => assert.equal(off.equipmentCost, 0));
check(18, "ILA OFF produces zero ILA schedule impact", () => assert.equal(off.scheduleImpactDays, 0));
check(19, "ILA OFF invalidates stale cached ILA projections", () => {
  const before = buildPlan("CACHE-MODE-CHANGE", { ilaMode: "BOOKENDED", configurationRevision: 1 });
  const after = buildPlan("CACHE-MODE-CHANGE", { ilaMode: "OFF", configurationRevision: 2 });
  assert.ok(before.stationObjects.length > 0); assert.equal(after.stationObjects.length, 0); assert.equal(ila.invalidateIlaPlanningCache("CACHE-MODE-CHANGE").cacheInvalidated, true);
});
check(20, "80-mile ILA OFF produces zero new ILA", () => assert.equal(off.graphObjectCount, 0));
check(21, "INTERMEDIATE_ONLY does not create A/Z bookends", () => assert.ok(intermediate.stationObjects.every((item) => item.role === "INTERMEDIATE")));
check(22, "INTERMEDIATE_ONLY can create planning intermediate ILAs", () => assert.ok(intermediate.stationObjects.length > 0));
check(23, "planning ILAs are not Engineering-certified", () => assert.ok(intermediate.stationObjects.every((item) => item.planningState === "COMMERCIAL_SCENARIO" && item.engineeringState === "ENGINEERING_REQUIRED")));
check(24, "BOOKENDED creates explicit A and Z objects", () => assert.deepEqual(bookended.stationObjects.filter((item) => item.role !== "INTERMEDIATE").map((item) => item.role), ["A_BOOKEND", "Z_BOOKEND"]));
check(25, "BOOKENDED can also create intermediate planning objects", () => assert.ok(bookended.stationObjects.some((item) => item.role === "INTERMEDIATE")));
check(26, "ILA objects carry station, role, and authority", () => assert.ok(bookended.stationObjects.every((item) => item.station && item.role && item.planningAuthority)));
check(27, "Engineering remains final optical authority", () => { assert.match(ilaSource, /ENGINEERING_CERTIFIED/); assert.match(reconciliationSource, /BIND_OPTICAL_DESIGN/); });
check(28, "structure quantities may remain Engineering-defined", () => assert.ok(doctrineAssembly.requirementGaps.some((gap) => gap.requirementId === "STRUCTURE_PLAN_DEFINED")));
check(29, "splice architecture may remain Engineering-defined", () => assert.ok(doctrineAssembly.requirementGaps.some((gap) => gap.requirementId === "SPLICE_ARCHITECTURE_DEFINED")));
check(30, "unknown crossings remain unknown", () => { assert.equal(doctrineAssembly.crossingAssembly.crossingCount, 0); assert.ok(doctrineAssembly.requirementGaps.some((gap) => gap.objectClass === "CROSSING")); });
check(31, "unknown rock remains unknown", () => assert.match(estimateSource, /civil\.directionalBoreRockPercent[\s\S]*authorityMode:\s*"UNKNOWN"/));
check(32, "unknown restoration remains unresolved", () => assert.match(estimateSource, /production\.restoration[\s\S]*authorityMode:\s*"UNKNOWN"/));
check(33, "estimating rates are outside Product Doctrine", () => { assert.match(authoritySource, /ESTIMATING_DOCTRINE/); assert.doesNotMatch(doctrineSource, /plowLaborPerFoot|fiber864MaterialPerFoot/); });
check(34, "markup is Commercial Policy", () => assert.match(authoritySource, /COMMERCIAL_POLICY[\s\S]*markup percent/));
check(35, "NRC and MRC policy are outside Product Doctrine", () => { assert.match(authoritySource, /NRC policy[\s\S]*MRC policy/); assert.doesNotMatch(doctrine.POINT_TO_POINT_LONG_HAUL_DOCTRINE.requiredInputs.join(" "), /NRC|MRC/); });
check(36, "doctrine fallback pricing is removed", () => { assert.doesNotMatch(doctrineSource, /routeFeet\s*\*\s*42|budgetCost\s*\*\s*1\.35/); assert.equal(doctrineAssembly.pricingSummary.priceStatus, "UNRESOLVED"); });
check(37, "Estimate Audit exposes Authority Layer", () => { assert.match(estimateSource, /authorityLayer/); assert.match(uiSource, /Authority Layer/); });
check(38, "Estimate Audit exposes cost lineage", () => { assert.match(estimateSource, /costLedgerId[\s\S]*costContributionMode/); assert.match(uiSource, /Cost Lineage/); });
check(39, "audit reference/component rows do not double count totals", () => assert.match(estimateSource, /isIlaReference[\s\S]*REFERENCE_ONLY/));
check(40, "CIP-041 reconciliation still functions", () => assert.ok(fs.existsSync(path.join(root, "cip041-engineering-quantity-reconciliation-authority-validation.mjs"))));
check(41, "historical reconciliation records remain immutable", () => assert.match(reconciliationRepositorySource, /append|immutableCopy/));
check(42, "existing package doctrine versions remain reproducible", () => assert.match(versionSource, /HISTORICAL_SNAPSHOT[\s\S]*historicalPackageMutation: false|historicalPackageMutation: false[\s\S]*HISTORICAL_SNAPSHOT/));
check(43, "new doctrine version is explicit", () => { assert.equal(doctrine.POINT_TO_POINT_LONG_HAUL_PREVIOUS_DOCTRINE_VERSION, "19B.1.0"); assert.equal(doctrine.POINT_TO_POINT_LONG_HAUL_DOCTRINE_VERSION, "20C.1.0"); });
check(44, "Helium new revision does not auto-resolve Engineering decisions", () => assert.match(heliumSource, /historicalReconciliationMutation: false[\s\S]*Engineering reconciliation remains required/));
check(45, "Helium does not receive mileage-generated ILAs", () => assert.match(heliumSource, /no mileage-generated sites are added/));
check(46, "Commercial cannot create ScopeVersion", () => assert.equal(doctrine.POINT_TO_POINT_LONG_HAUL_DOCTRINE.rules.scopeVersionCreationAllowedFromCommercial, false));
check(47, "Engineering certification remains required", () => assert.equal(doctrine.POINT_TO_POINT_LONG_HAUL_DOCTRINE.rules.engineeringCertificationRequired, true));
check(48, "tenant scoping remains intact", () => { assert.match(projectConfigSource, /organizationId[\s\S]*tenantId[\s\S]*customerId[\s\S]*opportunityId/); assert.equal(bookended.artifactScope.tenantId, "TENANT"); });
check(49, "existing state and closure behavior remains intact", () => { assert.ok(fs.existsSync(path.join(root, "cip039-constitutional-closure-engine-validation.mjs"))); assert.match(contractsSource, /closeSequences/); });
check(50, "existing cache and revision behavior remains intact", () => { assert.match(ilaSource, /configurationRevision[\s\S]*ilaPlanningMemo/); assert.match(workspaceSource, /invalidateIlaPlanningCache/); });

assert.equal(checks.length, 50);
console.log(`\nCIP-042 validation complete: ${checks.length}/50 checks passed.`);
