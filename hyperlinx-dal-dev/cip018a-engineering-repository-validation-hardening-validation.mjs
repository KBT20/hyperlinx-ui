import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { handleEngineeringCertification } from "./server/routes/engineering-certification.js";
import { handleInventoryGraphs } from "./server/routes/inventory-graphs.js";

const root = process.cwd().endsWith("hyperlinx-dal-dev")
  ? process.cwd()
  : path.join(process.cwd(), "hyperlinx-dal-dev");

const paths = {
  workspace: path.join(root, "src", "workspaces", "EngineeringCertificationWorkspace.tsx"),
  certificationRoutes: path.join(root, "server", "routes", "engineering-certification.js"),
  inventoryGraphs: path.join(root, "server", "routes", "inventory-graphs.js"),
  dalConnectivity: path.join(root, "src", "api", "dalConnectivity.ts"),
  engineeringPackage: path.join(root, "server", "data", "engineering-packages", "ENG-PKG-DRAFT-IOF-ACCEPTED-PROPOSAL-google-1783379652948.json"),
};

for (const requiredPath of Object.values(paths)) {
  if (!existsSync(requiredPath)) {
    console.error(`FAIL missing required file: ${path.relative(root, requiredPath)}`);
    process.exit(1);
  }
}

const workspace = readFileSync(paths.workspace, "utf8");
const certificationRoutes = readFileSync(paths.certificationRoutes, "utf8");
const inventoryGraphs = readFileSync(paths.inventoryGraphs, "utf8");
const dalConnectivity = readFileSync(paths.dalConnectivity, "utf8");
const checks = [];

function check(name, condition, detail = "") {
  checks.push({ name, condition: Boolean(condition), detail });
}

function includesAll(source, terms) {
  return terms.every((term) => source.includes(term));
}

function blockBetween(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  if (start < 0) return "";
  const end = source.indexOf(endMarker, start + startMarker.length);
  return end < 0 ? source.slice(start) : source.slice(start, end);
}

function tokenForKyle() {
  return Buffer.from(JSON.stringify({
    sub: "teralinx-user-kyle",
    username: "kyle",
    role: "ADMINISTRATOR_COO",
    iat: new Date().toISOString(),
  })).toString("base64url");
}

async function invoke(handler, method, pathname) {
  let statusCode = 0;
  let body = "";
  const req = {
    method,
    headers: {
      authorization: `Bearer ${tokenForKyle()}`,
    },
  };
  const res = {
    writeHead(status) {
      statusCode = status;
    },
    end(payload = "") {
      body += payload;
    },
  };
  const handled = await handler(req, res, pathname);
  let json = null;
  try {
    json = body ? JSON.parse(body) : null;
  } catch {
    json = null;
  }
  return { handled, statusCode, json, body };
}

const safeProjectionBlock = blockBetween(workspace, "function safeScheduleEngineeringProjection", "function buildEngineeringReadinessReport");
const readinessBlock = blockBetween(workspace, "function buildEngineeringReadinessReport", "function routeRepositoryIdForDraft");
const renderBlock = blockBetween(workspace, "function EngineeringReadinessReportPanel", "function stationDensity");
const baselineBlock = blockBetween(dalConnectivity, "export async function testBaselineGraphConnectivity", "\n}");

check("workspace wraps projection in recoverable constitutional boundary", includesAll(workspace, [
  "class EngineeringProjectionErrorBoundary",
  "Projection Validation Failure",
  "Repository state remains intact",
  "<EngineeringProjectionErrorBoundary resetKey={renderEngineeringPackageId}>",
]));
check("projection scheduler is guarded before render", includesAll(safeProjectionBlock, [
  "try",
  "scheduleEngineeringProjection(draft)",
  "validateEngineeringProjectionObjects(draft, projection)",
  "failure:",
  "Projection Validation Failure",
]));
check("projection object validation emits missing-field warnings", includesAll(workspace, [
  "Missing Object Type",
  "Object:",
  "Layer:",
  "Continuing certification.",
  "Missing Object Layer",
]));
check("readiness report covers required repositories and gates", includesAll(readinessBlock + renderBlock, [
  "Engineering Package",
  "Route Repository",
  "Proposal",
  "Estimate",
  "Workbook",
  "Draft IOF Package",
  "Object Validation",
  "Repository Integrity",
  "Ready for Station Planning",
  "Ready for Certification",
]));
check("Engineering Certification does not require reasoning endpoints", !workspace.includes("reasoningRegistry") &&
  !workspace.includes("/v1/models") &&
  !workspace.includes("/api/reasoning/health") &&
  workspace.includes("Reasoning Unavailable. Using deterministic doctrine."));
check("baseline graph connectivity is optional and non-throwing", inventoryGraphs.includes("/api/baseline-graphs") &&
  inventoryGraphs.includes("baselineGraphs") &&
  baselineBlock.includes("Baseline Graph API is optional for Engineering Certification") &&
  !baselineBlock.includes("throw new Error"));
check("server decorates restore with repository validation report", includesAll(certificationRoutes, [
  "buildEngineeringRepositoryValidationReport",
  "engineeringRepositoryValidation",
  "baselineGraphRequired: false",
  "reasoningRequired: false",
  "deterministicDoctrineFallback: true",
]));
check("workspace avoids direct Engineering projection dependencies on baseline or reasoning APIs", !workspace.includes("testBaselineGraphConnectivity") &&
  !workspace.includes("loadReasoningRegistryHealth") &&
  !workspace.includes("requestReasoningWithFailover"));
check("ScopeVersion remains blocked by this hardening", !workspace.includes("createScopeVersion") &&
  !inventoryGraphs.includes("createScopeVersion") &&
  !dalConnectivity.includes("createScopeVersion"));

const packageResponse = await invoke(
  handleEngineeringCertification,
  "GET",
  "/api/engineering/certification/draft-packages",
);
const draftPackage = (packageResponse.json?.draftPackages ?? []).find(
  (item) => item.engineeringPackageId === "ENG-PKG-DRAFT-IOF-ACCEPTED-PROPOSAL-google-1783379652948",
);
const repositoryValidation = draftPackage?.engineeringRepositoryValidation;
const validationLabels = Array.isArray(repositoryValidation?.checks)
  ? repositoryValidation.checks.map((item) => item.label)
  : [];
const requiredFailures = Array.isArray(repositoryValidation?.checks)
  ? repositoryValidation.checks.filter((item) => item.required && item.status !== "PASS")
  : [];

check("Google DFW Route 12 Engineering Package restores through API handler", packageResponse.handled &&
  packageResponse.statusCode === 200 &&
  draftPackage?.engineeringPackageId === "ENG-PKG-DRAFT-IOF-ACCEPTED-PROPOSAL-google-1783379652948",
  `status=${packageResponse.statusCode}`);
check("Google DFW Route 12 repository validation passes required references", requiredFailures.length === 0 &&
  ["Engineering Package", "Draft IOF Package", "Proposal", "Workbook", "Estimate", "Route Repository"].every((label) => validationLabels.includes(label)),
  `requiredFailures=${requiredFailures.map((item) => item.label).join(",")}`);
check("Google DFW Route 12 restore remains reference-backed and non-regenerating", draftPackage?.engineeringPackage?.referenceOnly === true &&
  draftPackage?.engineeringRepositoryRestore?.repositoryAuthority === "ENGINEERING_REPOSITORY" &&
  draftPackage?.noRouteRegeneration === true &&
  draftPackage?.noScopeVersionCreation === true);

const baselineResponse = await invoke(handleInventoryGraphs, "GET", "/api/baseline-graphs");
check("/api/baseline-graphs compatibility endpoint returns JSON", baselineResponse.handled &&
  baselineResponse.statusCode === 200 &&
  Array.isArray(baselineResponse.json?.baselineGraphs),
  `status=${baselineResponse.statusCode}`);

for (const item of checks) {
  const status = item.condition ? "PASS" : "FAIL";
  console.log(`${status} ${item.name}${item.detail ? ` - ${item.detail}` : ""}`);
}

const failed = checks.filter((item) => !item.condition);
if (failed.length) {
  console.error(`\n${failed.length} CIP-018A validation check(s) failed.`);
  process.exit(1);
}

console.log("\nCIP-018A engineering repository validation and projection hardening passed.");
