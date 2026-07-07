import { readFileSync } from "node:fs";

const workspace = readFileSync("src/components/workspaces/GoogleRfpWorkspace.tsx", "utf8");
const styles = readFileSync("src/styles.css", "utf8");

const checks = [
  {
    name: "map-first workspace shell is present",
    pass: workspace.includes('commercial-orchestrator-shell commercial-map-first-workspace'),
  },
  {
    name: "map-first workspace is ordered ahead of legacy panels",
    pass: styles.includes(".commercial-map-first-workspace") && styles.includes("order: -2;"),
  },
  {
    name: "estimate sidebar shows required commercial metrics",
    pass: [
      "Construction Cost",
      "Monthly Revenue",
      "Lifecycle Value",
      "Commercial Review",
      "commercial-estimate-sidebar-grid",
    ].every((needle) => workspace.includes(needle)),
  },
  {
    name: "proposal progress replaces lifecycle bridge for commercial users",
    pass: workspace.includes("commercialProposalProgressSteps") &&
      workspace.includes("Proposal Progress") &&
      !workspace.includes("Runtime Lifecycle Opportunity") &&
      !workspace.includes("Runtime Restore"),
  },
  {
    name: "runtime dashboard is removed from the rendered surface",
    pass: workspace.includes("{false ? (") &&
      workspace.includes('className="runtime-workspace-dashboard"') &&
      styles.includes(".dal-workspace > .runtime-workspace-dashboard") &&
      styles.includes("display: none;"),
  },
  {
    name: "intake panels are collapsed drawers",
    pass: [
      'details className="account-workspace-dashboard commercial-intake-drawer"',
      'details className="existing-inventory-runtime-section commercial-intake-drawer"',
      'details className="customer-design-request-section commercial-intake-drawer"',
    ].every((needle) => workspace.includes(needle)),
  },
  {
    name: "customer twin reloads and warns on opportunity open",
    pass: workspace.includes("customerTwinLoadWarning") &&
      workspace.includes("Customer Twin failed to load") &&
      workspace.includes("setInventoryRefreshNonce((nonce) => nonce + 1);"),
  },
  {
    name: "duplicate text keys are not used for warnings or summary items",
    pass: !workspace.includes("key={warning}") &&
      !workspace.includes("key={item}") &&
      workspace.includes("key={`${activeFinancialDraft.routeId}-warning-${index}`}") &&
      workspace.includes("key={`${item}-${index}`}"),
  },
  {
    name: "visible proposal terminology is business-facing",
    pass: workspace.includes("Commercial Proposal Dashboard") &&
      workspace.includes("Save Proposal") &&
      workspace.includes("Visible Commercial Proposals") &&
      !workspace.includes("Proposal Runtime Dashboard") &&
      !workspace.includes("Engineering Objects"),
  },
];

const failed = checks.filter((check) => !check.pass);

for (const check of checks) {
  console.log(`${check.pass ? "PASS" : "FAIL"} ${check.name}`);
}

if (failed.length) {
  console.error(`\n${failed.length} CIP-013B validation check(s) failed.`);
  process.exit(1);
}

console.log("\nCIP-013B map-first validation passed.");
