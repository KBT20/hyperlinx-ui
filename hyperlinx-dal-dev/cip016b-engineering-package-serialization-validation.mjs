import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { deleteRecord, DIRS } from "./server/routes/_shared.js";
import {
  assertReferenceOnlyEngineeringPackagePayload,
  engineeringPackageRecordForRepository,
  loadEngineeringPackage,
  persistEngineeringPackage,
} from "./server/routes/engineering-packages.js";

const root = process.cwd().endsWith("hyperlinx-dal-dev")
  ? process.cwd()
  : path.join(process.cwd(), "hyperlinx-dal-dev");

const paths = {
  engineeringPackages: path.join(root, "server", "routes", "engineering-packages.js"),
  commercialIofPackages: path.join(root, "server", "routes", "commercial-iof-packages.js"),
  engineeringCertification: path.join(root, "server", "routes", "engineering-certification.js"),
  api: path.join(root, "src", "api", "teralinxRuntime.ts"),
  commercialWorkspace: path.join(root, "src", "components", "workspaces", "GoogleRfpWorkspace.tsx"),
  engineeringWorkspace: path.join(root, "src", "workspaces", "EngineeringCertificationWorkspace.tsx"),
  report: path.join(root, "CIP_016B_ENGINEERING_PACKAGE_SERIALIZATION_REPAIR_REPORT.md"),
};

for (const requiredPath of Object.values(paths)) {
  if (!existsSync(requiredPath)) {
    console.error(`FAIL missing required file: ${path.relative(root, requiredPath)}`);
    process.exit(1);
  }
}

const sources = Object.fromEntries(Object.entries(paths).map(([key, filePath]) => [key, readFileSync(filePath, "utf8")]));
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

const serializerBlock = blockBetween(sources.engineeringPackages, "export function engineeringPackageRecordForRepository", "export function buildEngineeringPackageFromDraftPackage");
const payloadGuardBlock = blockBetween(sources.engineeringPackages, "export function assertReferenceOnlyEngineeringPackagePayload", "export function engineeringPackageRecordForRepository");
const persistBlock = blockBetween(sources.engineeringPackages, "export async function persistEngineeringPackage", "export async function updateEngineeringPackageStatus");
const resolveBlock = blockBetween(sources.engineeringPackages, "export async function resolveEngineeringPackageReferences", "export async function persistEngineeringPackage");
const commercialSubmitBlock = blockBetween(sources.commercialIofPackages, "async function submitCommercialDraftPackageToEngineering", "export async function handleCommercialIofPackages");
const engineeringResolveBlock = blockBetween(sources.engineeringCertification, "async function resolveEngineeringPackageForCertification", "function decorateDraftPackageWithEngineeringPackage");

check("dedicated serializer exists", sources.engineeringPackages.includes("export function engineeringPackageRecordForRepository(input = {})"));
check("serializer explicitly whitelists final schema fields", includesAll(serializerBlock, [
  "engineeringPackageId",
  "customerId",
  "customerTwinId",
  "opportunityId",
  "routeRepositoryId",
  "proposalId",
  "commercialWorkbookId",
  "estimateId",
  "draftIOFPackageId",
  "productDoctrineId",
  "submittedBy",
  "submittedAt",
  "commercialStatus",
  "engineeringStatus",
  "serviceOrderState",
  "scopeVersionState",
  "createdAt",
  "updatedAt",
]));
check("serializer contains future placeholders only", includesAll(serializerBlock, [
  "stationPlanId",
  "futureInventoryManifestId",
  "certifiedIOFPackageId",
  "Next sprint placeholders only",
]));
check("serializer output does not whitelist geometry or embedded bodies", !includesAll(sources.engineeringPackages, [
  "\"commercialGeometry\"",
  "\"convertedRuntimeGeometry\"",
  "\"routeRepositorySnapshot\"",
  "\"proposal\"",
  "\"commercialWorkbook\"",
  "\"commercialEstimate\"",
  "\"draftPackage\"",
]));
check("payload size guard logs keys, byte size, largest fields, offending field", includesAll(payloadGuardBlock, [
  "topLevelKeys",
  "serializedBytes",
  "largestFields",
  "REFERENCE_ONLY_PAYLOAD_LIMIT_BYTES",
  "offendingField",
  "Engineering Package payload exceeds reference-only threshold",
]));
check("persist path saves only serializer output", includesAll(persistBlock, [
  "engineeringPackageRecordForRepository",
  "assertReferenceOnlyEngineeringPackagePayload",
  "persistRecord(DIRS.engineeringPackages",
]) && !persistBlock.includes("...(existing ?? {})"));
check("submit path builds reference-only package and reloads Engineering Package", includesAll(commercialSubmitBlock, [
  "buildEngineeringPackageFromDraftPackage",
  "persistEngineeringPackage",
  "draftIOFPackageId",
  "proposalId",
  "SUBMITTED_TO_ENGINEERING",
]));
check("reference resolver reads repositories by reference", includesAll(resolveBlock, [
  "loadRecord(DIRS.commercialOpportunities",
  "loadRecord(DIRS.iofPackages",
  "record.draftIOFPackageId",
  "loadRecord(DIRS.commercialRoutes",
  "loadRecord(DIRS.proposalDrafts",
  "record.proposalId",
]));
check("Engineering Certification restores from Engineering Package references", includesAll(engineeringResolveBlock, [
  "loadEngineeringPackage(packageReferenceId)",
  "resolveEngineeringPackageReferences(engineeringPackage)",
  "engineeringPackage.draftIOFPackageId",
  "loadDraftPackage(draftPackageId)",
]));
check("ScopeVersion remains blocked and inventory is not created", sources.engineeringPackages.includes("BLOCKED_UNTIL_SIGNED_SERVICE_ORDER") &&
  !sources.engineeringPackages.includes("persistRecord(DIRS.runtimeInventories") &&
  !sources.commercialIofPackages.includes("persistRecord(DIRS.runtimeInventories") &&
  !commercialSubmitBlock.includes("createScopeVersion"));
check("client types know canonical Engineering Package fields", includesAll(sources.api, [
  "draftIOFPackageId",
  "proposalId: string",
  "engineeringStatus",
  "serviceOrderState",
  "scopeVersionState",
  "futureInventoryManifestId",
  "certifiedIOFPackageId",
]));
check("report documents root cause, schema, flows, and validation", includesAll(sources.report, [
  "Invalid string length",
  "Root Cause",
  "Offending Fields Removed",
  "Final Engineering Package Schema",
  "Repository Save Flow",
  "Repository Restore Flow",
  "Payload Size",
  "Validation Results",
]));

const hugeInput = {
  engineeringPackageId: "ENG-PKG-CIP016B-VALIDATION",
  draftPackage: {
    packageId: "DRAFT-IOF-CIP016B-VALIDATION",
    customerId: "CUSTOMER-CIP016B",
    customerTwinReference: "CUSTOMER-TWIN-CIP016B",
    opportunityId: "OPP-CIP016B",
    proposalId: "PROP-CIP016B",
    routeRepositoryId: "ROUTE-REPO-CIP016B",
    commercialWorkbookId: "WORKBOOK-CIP016B",
    estimateId: "ESTIMATE-CIP016B",
    doctrineId: "PD-001",
    commercialGeometry: Array.from({ length: 5000 }, (_, index) => [index, index + 1]),
    stations: Array.from({ length: 1000 }, (_, index) => ({ stationId: `STA-${index}`, geometry: [[index, index]] })),
    proposal: { body: "x".repeat(20000) },
    commercialWorkbook: { body: "y".repeat(20000) },
    commercialEstimate: { body: "z".repeat(20000) },
  },
  opportunity: {
    opportunityId: "OPP-CIP016B",
    routeRepositoryId: "ROUTE-REPO-CIP016B",
    proposalId: "PROP-CIP016B",
  },
  user: { name: "CIP-016B Validation", userId: "cip016b" },
  timestamp: "2026-07-07T00:00:00.000Z",
};

const serialized = engineeringPackageRecordForRepository(hugeInput);
const serializedText = JSON.stringify(serialized);
check("dynamic serializer strips huge geometry/body fields", !serializedText.includes("commercialGeometry") &&
  !serializedText.includes("convertedRuntimeGeometry") &&
  !serializedText.includes("stations") &&
  !serializedText.includes("proposal\":{\"body") &&
  !serializedText.includes("commercialWorkbook\":{\"body") &&
  !serializedText.includes("commercialEstimate\":{\"body"));
check("dynamic serializer output is reference-only sized", Buffer.byteLength(serializedText, "utf8") < 4096, `bytes=${Buffer.byteLength(serializedText, "utf8")}`);
check("payload guard rejects forbidden fields", (() => {
  try {
    assertReferenceOnlyEngineeringPackagePayload({ ...serialized, commercialGeometry: [[1, 2]] });
    return false;
  } catch (error) {
    return String(error?.message ?? "").includes("commercialGeometry");
  }
})());

let persisted = null;
try {
  persisted = await persistEngineeringPackage(serialized, { name: "CIP-016B Validation", userId: "cip016b" }, { requireIntegrity: false });
  const reloaded = await loadEngineeringPackage(serialized.engineeringPackageId);
  check("Engineering Package persists and reloads reference-only JSON", reloaded.engineeringPackageId === serialized.engineeringPackageId &&
    reloaded.draftIOFPackageId === serialized.draftIOFPackageId &&
    !JSON.stringify(reloaded).includes("commercialGeometry"));
} finally {
  if (persisted?.engineeringPackageId) {
    await deleteRecord(DIRS.engineeringPackages, persisted.engineeringPackageId).catch(() => null);
  }
}

const failed = checks.filter((item) => !item.condition);

for (const item of checks) {
  const status = item.condition ? "PASS" : "FAIL";
  console.log(`${status} ${item.name}${item.detail ? ` - ${item.detail}` : ""}`);
}

if (failed.length) {
  console.error(`\n${failed.length} CIP-016B validation check(s) failed.`);
  process.exit(1);
}

console.log("\nCIP-016B Engineering Package serialization validation passed.");
