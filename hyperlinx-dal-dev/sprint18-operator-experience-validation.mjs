import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));

async function read(relativePath) {
  return readFile(path.join(root, relativePath), "utf8");
}

function assertIncludes(label, text, expected) {
  assert.ok(text.includes(expected), `${label} missing: ${expected}`);
}

function assertOrder(label, text, first, second) {
  const firstIndex = text.indexOf(first);
  const secondIndex = text.indexOf(second);
  assert.ok(firstIndex >= 0, `${label} missing first marker: ${first}`);
  assert.ok(secondIndex >= 0, `${label} missing second marker: ${second}`);
  assert.ok(firstIndex < secondIndex, `${label} order violated: ${first} should precede ${second}`);
}

const report = await read("SPRINT_18_OPERATOR_EXPERIENCE_REPORT.md");
const workspace = await read("src/components/workspaces/GoogleRfpWorkspace.tsx");
const serverIndex = await read("server/index.js");
const runtimeRehydrationValidation = await read("runtime-rehydration-validation.mjs");
const productFulfillmentRoute = await read("server/routes/product-fulfillment.js");

const assertions = [];

function check(name, fn) {
  fn();
  assertions.push(name);
}

check("doctrine:overarching-principle", () => {
  assertIncludes("report", report, "The operator expresses intent. The product defines standards. The Design Engine creates solutions. The Spine becomes governed truth. Every downstream workspace consumes that same truth.");
});

check("doctrine:feature-freeze", () => {
  assertIncludes("report", report, "Do not add Layer 2 or Layer 3 capability during this effort.");
  assertIncludes("report", report, "Do not add new automation, queues, or marketplace execution before the current lifecycle can be operated by a human without losing context.");
});

check("google:golden-path", () => {
  [
    "Create Google account.",
    "Select Protected Dark Fiber IRU.",
    "Enter customer inputs by KMZ, KML, address, or latitude/longitude.",
    "Generate the $29M proposal.",
    "Hand off the same certified truth to Marketplace, Control, Field, and Twin.",
  ].forEach((item) => assertIncludes("report", report, item));
});

check("workflow:linear-commercial-sequence", () => {
  [
    "Step 1 - Select Account",
    "Step 2 - Select Product",
    "Step 3 - Enter Customer Intent",
    "Step 4 - Design Engine",
    "Step 5 - Station the Design",
    "Step 6 - Instantiate the Product",
    "Step 7 - Commit to the Spine",
    "Step 8 - Generate Proposal",
    "Step 9 - Customer Review",
    "Step 10 - Engineering",
    "Step 11 - Marketplace / Control / Field / Twin",
  ].forEach((item) => assertIncludes("report", report, item));
});

check("az:shared-text-resolver", () => {
  assertIncludes("workspace", workspace, "function resolveAzTextInput(slot: AzLocationSlot)");
  assertOrder("workspace", workspace, "function resolveAzTextInput(slot: AzLocationSlot)", "function handleResolveAzTextLocation(slot: AzLocationSlot)");
});

check("az:z-destination-input", () => {
  assertIncludes("workspace", workspace, "return slot === \"A\" ? opportunityScoutAzOrigin : opportunityScoutAzDestination;");
  assertIncludes("workspace", workspace, "const destinationLocation = azDestinationLocation ?? resolveAzTextInput(\"Z\");");
  assertIncludes("workspace", workspace, "setAzDestinationLocation(destinationLocation);");
});

check("az:candidate-created-from-resolved-destination", () => {
  assertIncludes("workspace", workspace, "createAzBuilderScoutCandidateFromResolvedLocations(selectedAccount.accountId, originLocation, destinationLocation)");
});

check("customer-input:kmz-kml-first-class", () => {
  assertIncludes("workspace", workspace, "accept={pendingImportSource === \"CSV\" ? \".csv\" : \".kmz,.kml\"}");
  assertIncludes("workspace", workspace, "Customer Design Request KMZ / KML");
});

check("runtime:rehydration-route-order", () => {
  assertOrder("server/index.js", serverIndex, "handleRuntimeLifecycleBridge,", "handleRuntimeWorkspaceSession,");
  assertOrder("server/index.js", serverIndex, "handleRuntimeWorkspaceSession,", "handleRuntimeFoundation,");
});

check("runtime:rehydration-validation-200", () => {
  assertIncludes("runtime-rehydration-validation", runtimeRehydrationValidation, "expectStatus(\"runtime:rehydrate\", response, 200);");
});

check("product:protected-dark-fiber-iru", () => {
  assertIncludes("product fulfillment route", productFulfillmentRoute, "PRODUCT-L1-PROTECTED-DARK-FIBER-IRU");
  assertIncludes("product fulfillment route", productFulfillmentRoute, "Protected Dark Fiber IRU");
});

const proof = {
  assertions: assertions.length,
  checks: assertions,
  doctrine: "operator-experience",
  goldenPath: "google-protected-dark-fiber-iru",
  phase: "stabilize-current-lifecycle",
  runtimeFoundationLast: true,
  azDestinationResolution: "shared resolver with Z fallback before A/Z seed",
  generatedAt: new Date().toISOString(),
};

const proofDir = path.join(root, ".tmp");
await mkdir(proofDir, { recursive: true });
await writeFile(path.join(proofDir, "sprint18-operator-experience-report.json"), JSON.stringify(proof, null, 2));

console.log(JSON.stringify(proof, null, 2));
