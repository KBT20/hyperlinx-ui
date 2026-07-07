import { readFileSync } from "node:fs";

const workspace = readFileSync("src/components/workspaces/GoogleRfpWorkspace.tsx", "utf8");
const styles = readFileSync("src/styles.css", "utf8");
const estimateExplorer = readFileSync("src/components/workspaces/googleRfp/TransparentEstimateExplorer.tsx", "utf8");

const workbookSections = [
  "1. Proposal Summary",
  "2. Estimate Detail",
  "3. Commercial Economics",
  "4. Construction Mix",
  "5. Product Doctrine Assumptions",
  "6. Human Overrides",
  "7. Quantities",
  "8. Object Manifest Summary",
  "9. Production Forecast",
  "10. Commercial Validation",
  "11. Risks / Unknowns",
  "12. Draft IOF Package Preview",
  "13. Service Order Preview",
  "14. Runtime / Diagnostics",
];

const checks = [
  {
    name: "Commercial Planning has map-first layout",
    pass: workspace.includes("commercial-map-first-workspace") &&
      styles.includes(".commercial-map-first-workspace") &&
      styles.includes("order: -2;"),
  },
  {
    name: "Commercial Workbook exists visually below map",
    pass: workspace.includes('className="commercial-workbook-shell"') &&
      styles.includes(".commercial-workbook-shell") &&
      styles.includes("order: -1;"),
  },
  {
    name: "Commercial Workbook contains required sections",
    pass: workbookSections.every((section) => workspace.includes(section)),
  },
  {
    name: "workbook sections are collapsible and lazy where practical",
    pass: workspace.includes("commercialWorkbookOpenSections") &&
      workspace.includes('isCommercialWorkbookSectionOpen("estimate-detail") && activeFinancialDraft') &&
      workspace.includes('isCommercialWorkbookSectionOpen("commercial-validation")') &&
      workspace.includes('isCommercialWorkbookSectionOpen("draft-iof-preview")'),
  },
  {
    name: "Estimate sidebar exists beside map with route/economic metrics",
    pass: workspace.includes("commercial-estimate-sidebar") &&
      ["Route Length", "Cost / Mile", "Revenue / Mile", "Construction Mix", "Unknowns"].every((needle) => workspace.includes(needle)),
  },
  {
    name: "Doctrine Value and Commercial Override fields exist",
    pass: workspace.includes("commercialDoctrineOverrideRows") &&
      workspace.includes("Doctrine Value") &&
      workspace.includes("Current Commercial Value") &&
      workspace.includes("Engineering Actual"),
  },
  {
    name: "override reason/owner/timestamp model exists",
    pass: ["assumptionId", "doctrineValue", "commercialValue", "overrideReason", "owner", "timestamp", "source", "confidence"].every((needle) => workspace.includes(needle)),
  },
  {
    name: "Service Order readiness references required commercial artifacts",
    pass: workspace.includes("serviceOrderReadinessRows") &&
      ["Accepted Proposal", "Certified Draft IOF Package", "Commercial Estimate", "Doctrine Assumptions", "Human Overrides", "Product Summary", "Route Summary", "Pricing Summary", "Legal / Business Terms"].every((needle) => workspace.includes(needle)),
  },
  {
    name: "Engineering map and Station-Aware Object Review are not mounted in Commercial Planning",
    pass: !workspace.includes("StationAwareObjectReviewPanel") &&
      !workspace.includes("<RouteEngineeringWorkspace") &&
      !workspace.includes("Engineering map"),
  },
  {
    name: "Runtime diagnostics collapsed by default",
    pass: workspace.includes("commercial-runtime-diagnostics") &&
      workspace.includes("Collapsed by default") &&
      !workspace.includes('open={isCommercialWorkbookSectionOpen("runtime-diagnostics")}'),
  },
  {
    name: "duplicate estimate/labor keys corrected",
    pass: !estimateExplorer.includes("key={line.lineItemId}") &&
      !estimateExplorer.includes("key={entry.auditId}") &&
      estimateExplorer.includes("key={`${line.lineItemId}-${index}`}") &&
      estimateExplorer.includes("key={`${entry.auditId}-${index}`}") &&
      !workspace.includes("key={warning}") &&
      !workspace.includes("key={item}"),
  },
];

const failed = checks.filter((check) => !check.pass);

for (const check of checks) {
  console.log(`${check.pass ? "PASS" : "FAIL"} ${check.name}`);
}

if (failed.length) {
  console.error(`\n${failed.length} CIP-013C validation check(s) failed.`);
  process.exit(1);
}

console.log("\nCIP-013C commercial workbook validation passed.");
