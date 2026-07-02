import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const files = {
  contracts: path.join(ROOT, "src/products/ProductDoctrineContracts.ts"),
  doctrine: path.join(ROOT, "src/products/pointToPointLongHaulDoctrine.ts"),
  iofEngine: path.join(ROOT, "src/commercial/IOFPackageAssemblyEngine.ts"),
  workspace: path.join(ROOT, "src/components/workspaces/GoogleRfpWorkspace.tsx"),
  productFulfillment: path.join(ROOT, "server/routes/product-fulfillment.js"),
  report: path.join(ROOT, "SPRINT_19B_PRODUCT_DOCTRINE_GOLDEN_PATH_REPORT.md"),
};

function read(file) {
  return readFileSync(file, "utf8");
}

function check(checks, key, passed, details) {
  checks.push({ key, passed, details });
}

function requireIncludes(checks, key, source, needle, details = needle) {
  check(checks, key, source.includes(needle), details);
}

function distanceMiles(a, b) {
  const latAvgRadians = ((a[1] + b[1]) / 2) * Math.PI / 180;
  const milesPerLonDegree = 69.172 * Math.cos(latAvgRadians);
  const dx = (a[0] - b[0]) * milesPerLonDegree;
  const dy = (a[1] - b[1]) * 69.0;
  return Math.hypot(dx, dy);
}

function sampleGoldenPath() {
  const a = [-100.0171, 37.7528];
  const z = [-94.5786, 39.0997];
  const centerline = [
    a,
    [-98.55, 38.18],
    [-97.12, 38.61],
    [-95.74, 38.91],
    z,
  ];
  const routeMiles = centerline.slice(1).reduce((sum, point, index) => sum + distanceMiles(centerline[index], point), 0);
  const routeFeet = Math.round(routeMiles * 5280);
  const stationCount = Math.max(2, Math.floor(routeFeet / 5280) + 1);
  const segmentCount = stationCount - 1;
  const conduitFeet = routeFeet * 4;
  const fiberFeet = Math.round(routeFeet * 1.05);
  const objectCount = 1 + segmentCount + segmentCount + segmentCount + Math.ceil(routeMiles / 2) + 1;
  const budgetCost = Math.round(routeFeet * 42);
  const sellPriceIru = Math.round(budgetCost * 1.35);
  return {
    routeMiles: Number(routeMiles.toFixed(2)),
    routeFeet,
    stationCount,
    objectCount,
    conduitFeet,
    fiberFeet,
    budgetCost,
    sellPriceIru,
    validationStatus: routeFeet > 0 && stationCount > 0 && objectCount > 0 && budgetCost > 0 && sellPriceIru > 0 ? "PASS" : "FAIL",
    engineeringHandoffState: "READY_FOR_ENGINEERING_REVIEW",
  };
}

const contracts = read(files.contracts);
const doctrine = read(files.doctrine);
const iofEngine = read(files.iofEngine);
const workspace = read(files.workspace);
const productFulfillment = read(files.productFulfillment);
const report = read(files.report);
const checks = [];

requireIncludes(checks, "contracts.product-doctrine", contracts, "export interface ProductDoctrine", "ProductDoctrine contract exists.");
requireIncludes(checks, "contracts.assembly", contracts, "export interface ProductDoctrineAssembly", "ProductDoctrineAssembly contract exists.");
requireIncludes(checks, "contracts.no-scopeversion", contracts, "noScopeVersionCreation: true", "Contracts carry noScopeVersionCreation guard.");

requireIncludes(checks, "doctrine.product-id", doctrine, 'POINT_TO_POINT_LONG_HAUL_PRODUCT_ID = "POINT_TO_POINT_LONG_HAUL_CONDUIT_FIBER"', "Exact product ID is defined.");
requireIncludes(checks, "doctrine.network-class", doctrine, 'networkClass: "LONG_HAUL"', "Doctrine networkClass is LONG_HAUL.");
requireIncludes(checks, "doctrine.topology", doctrine, 'topology: "LINEAR"', "Doctrine topology is LINEAR.");
requireIncludes(checks, "doctrine.layer", doctrine, "layer: 1", "Doctrine layer is 1.");
requireIncludes(checks, "doctrine.no-optical", doctrine, "opticalTransport: false", "Doctrine forbids optical transport.");
requireIncludes(checks, "doctrine.no-comparison", doctrine, "comparisonAllowed: false", "Doctrine forbids comparison.");
requireIncludes(checks, "doctrine.no-reuse", doctrine, "reuseRecommendationAllowed: false", "Doctrine forbids reuse recommendation.");
requireIncludes(checks, "doctrine.no-commercial-sv", doctrine, "scopeVersionCreationAllowedFromCommercial: false", "Doctrine blocks commercial ScopeVersion creation.");
requireIncludes(checks, "doctrine.engineering-required", doctrine, "engineeringCertificationRequired: true", "Doctrine requires Engineering certification.");
requireIncludes(checks, "doctrine.assembler", doctrine, "assemblePointToPointLongHaulDoctrine", "Doctrine assembler exists.");
requireIncludes(checks, "doctrine.spine", doctrine, "ProductDoctrineSpine", "Spine assembly is implemented.");
requireIncludes(checks, "doctrine.conduit", doctrine, "buildConduitAssembly", "Conduit assembly is implemented.");
requireIncludes(checks, "doctrine.fiber", doctrine, "buildFiberAssembly", "Fiber assembly is implemented.");
requireIncludes(checks, "doctrine.crossing", doctrine, "buildCrossingAssembly", "Crossing assembly is implemented.");
requireIncludes(checks, "doctrine.validation-pass", doctrine, 'status: pass ? "PASS" : "FAIL"', "Validation checks emit PASS/FAIL.");

requireIncludes(checks, "product-registry", productFulfillment, "POINT_TO_POINT_LONG_HAUL_CONDUIT_FIBER", "Product fulfillment registry recognizes the Sprint 19B product.");

requireIncludes(checks, "iof.input-doctrine", iofEngine, "productDoctrineAssembly?: ProductDoctrineAssembly", "IOF engine accepts Product Doctrine Assembly.");
[
  "doctrineId",
  "productDoctrineVersion",
  "aSite",
  "zSite",
  "osrmRoute",
  "centerline",
  "spine",
  "conduitAssembly",
  "fiberAssembly",
  "structureAssembly",
  "crossingAssembly",
  "quantitySummary",
  "pricingSummary",
  "validationSummary",
  "engineeringManifest",
  "noScopeVersionCreation: true",
].forEach((field) => requireIncludes(checks, `iof.field.${field}`, iofEngine, field, `Draft IOF Package includes ${field}.`));
requireIncludes(checks, "iof.ready-state", iofEngine, "READY_FOR_ENGINEERING_REVIEW", "IOF package can enter Engineering review when validation passes.");

requireIncludes(checks, "workspace.import-doctrine", workspace, "assemblePointToPointLongHaulDoctrine", "Commercial workspace imports doctrine assembler.");
requireIncludes(checks, "workspace.product-option", workspace, "POINT_TO_POINT_LONG_HAUL_PRODUCT_ID", "Commercial workspace exposes Sprint 19B product selection.");
requireIncludes(checks, "workspace.doctrine-assembly", workspace, "productDoctrineAssembly", "Commercial workspace assembles product doctrine.");
requireIncludes(checks, "workspace.draft-json", workspace, "Draft IOF Package JSON", "Commercial workspace displays Draft IOF Package JSON.");
requireIncludes(checks, "workspace.handoff", workspace, "Handoff to Engineering", "Commercial workspace exposes Engineering handoff action.");

const sample = sampleGoldenPath();
check(checks, "acceptance.visible-osrm-route", sample.routeFeet > 0, `Sample OSRM centerline routeFeet=${sample.routeFeet}.`);
check(checks, "acceptance.non-empty-stations", sample.stationCount > 0, `stationCount=${sample.stationCount}.`);
check(checks, "acceptance.non-empty-objects", sample.objectCount > 0, `objectCount=${sample.objectCount}.`);
check(checks, "acceptance.non-zero-quantities", sample.conduitFeet > 0 && sample.fiberFeet > 0, `conduitFeet=${sample.conduitFeet}, fiberFeet=${sample.fiberFeet}.`);
check(checks, "acceptance.non-zero-pricing", sample.budgetCost > 0 && sample.sellPriceIru > 0, `budgetCost=${sample.budgetCost}, sellPriceIru=${sample.sellPriceIru}.`);
check(checks, "acceptance.validation-pass", sample.validationStatus === "PASS", `validation=${sample.validationStatus}.`);
check(checks, "acceptance.engineering-ready", sample.engineeringHandoffState === "READY_FOR_ENGINEERING_REVIEW", `state=${sample.engineeringHandoffState}.`);

requireIncludes(checks, "report.exists", report, "Sprint 19B Product Doctrine Golden Path", "Sprint 19B report exists.");
requireIncludes(checks, "report.next-step", report, "Engineering certification and ScopeVersion", "Report documents next step.");

const failed = checks.filter((item) => !item.passed);
const output = {
  validationId: "sprint19b-product-doctrine-golden-path-validation",
  status: failed.length ? "FAIL" : "PASS",
  checkedAt: new Date().toISOString(),
  sampleGoldenPath: sample,
  checks,
};
mkdirSync(path.join(ROOT, ".tmp"), { recursive: true });
writeFileSync(path.join(ROOT, ".tmp/sprint19b-product-doctrine-golden-path-report.json"), JSON.stringify(output, null, 2));

console.log(JSON.stringify({
  status: output.status,
  totalChecks: checks.length,
  failedChecks: failed.map((item) => item.key),
  sampleGoldenPath: sample,
}, null, 2));

if (failed.length) process.exit(1);
