import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd().endsWith("hyperlinx-dal-dev")
  ? process.cwd()
  : path.join(process.cwd(), "hyperlinx-dal-dev");

const paths = {
  api: path.join(root, "src", "api", "teralinxRuntime.ts"),
  workspace: path.join(root, "src", "components", "workspaces", "GoogleRfpWorkspace.tsx"),
  serverIof: path.join(root, "server", "routes", "commercial-iof-packages.js"),
};

for (const requiredPath of Object.values(paths)) {
  if (!existsSync(requiredPath)) {
    console.error(`FAIL missing required file: ${path.relative(root, requiredPath)}`);
    process.exit(1);
  }
}

const api = readFileSync(paths.api, "utf8");
const workspace = readFileSync(paths.workspace, "utf8");
const serverIof = readFileSync(paths.serverIof, "utf8");
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

function appearsBefore(source, first, second) {
  const firstIndex = source.indexOf(first);
  const secondIndex = source.indexOf(second);
  return firstIndex >= 0 && secondIndex >= 0 && firstIndex < secondIndex;
}

const serializerBlock = blockBetween(api, "function draftIofPackageRecordForRepository", "export type RuntimeLifecycleProgressItem");
const auditBlock = blockBetween(api, "function draftIofSavePayloadSizeAudit", "function draftIofPackageRecordForRepository");
const saveBlock = blockBetween(api, "export async function saveCommercialDraftIofPackage", "export async function submitDraftIofPackageToEngineering");
const previewBlock = blockBetween(workspace, "const commercialDraftIofPackagePreview = useMemo", "function handleBuildProductCommercialDesign");
const submitHandler = blockBetween(workspace, "async function handleSubmitCommercialDraftIofToEngineering", "async function handleOpenEngineeringDraftPackage");
const serverSubmitBlock = blockBetween(serverIof, "async function submitCommercialDraftPackageToEngineering", "if (normalizedPath.startsWith(\"/api/commercial/iof-packages/\")");

check("Draft IOF save has payload size audit helpers", includesAll(api, [
  "type DraftIofSavePayloadSizeAudit",
  "DRAFT_IOF_REFERENCE_ONLY_MAX_BYTES",
  "DRAFT_IOF_OFFENDING_FIELD_THRESHOLD_BYTES",
  "approximatePayloadBytes",
  "draftIofSavePayloadSizeAudit",
]));
check("payload audit logs required size categories", includesAll(auditBlock, [
  "route geometry",
  "workbook",
  "proposal",
  "estimate",
  "customer twin/runtime inventory",
  "station graph",
  "object manifest",
  "commercial revision",
  "commercial release package",
  "offendingField",
]));
check("Draft IOF repository serializer explicitly whitelists reference fields", includesAll(serializerBlock, [
  "routeRepositoryId",
  "routeGeometryId",
  "geometryHash",
  "workbookId",
  "commercialWorkbookId",
  "estimateId",
  "proposalId",
  "commercialRevisionId",
  "commercialReleasePackageId",
  "stationProjectionId",
  "objectManifestId",
]));
check("serializer blocks missing required references with operator-readable error", includesAll(serializerBlock, [
  "Draft IOF reference-only save blocked: missing",
  "[\"proposalId\", proposalId]",
  "[\"routeRepositoryId\", routeRepositoryId]",
  "[\"workbookId\", workbookId || commercialWorkbookId]",
  "[\"estimateId\", estimateId]",
  "[\"commercialRevisionId\", commercialRevisionId]",
]));
check("serializer marks forbidden large payloads as stripped", includesAll(serializerBlock, [
  "noEmbeddedRouteGeometry: true",
  "noEmbeddedWorkbookRows: true",
  "noEmbeddedProposalBody: true",
  "noEmbeddedRuntimeInventory: true",
  "noEmbeddedMapObjects: true",
  "referenceOnly: true",
]));
check("serializer does not persist heavy top-level bodies", !serializerBlock.includes("commercialGeometry:") &&
  !serializerBlock.includes("convertedRuntimeGeometry:") &&
  !serializerBlock.includes("commercialWorkbook:") &&
  !serializerBlock.includes("commercialWorkbookSections:") &&
  !serializerBlock.includes("proposalBody:") &&
  !serializerBlock.includes("runtimeInventory:") &&
  !serializerBlock.includes("objectInventory:") &&
  !serializerBlock.includes("stationIndexedGraph:") &&
  !serializerBlock.includes("auditObjectManifestEntries:") &&
  !serializerBlock.includes("instantiatedSpineObjects:"));
check("saveCommercialDraftIofPackage serializes only reference-only payload", includesAll(saveBlock, [
  "const referenceOnlyDraftPackage = draftIofPackageRecordForRepository(draftPackage)",
  "const payloadAudit = draftIofSavePayloadSizeAudit(draftPackage, referenceOnlyDraftPackage)",
  "console.info(\"[Draft IOF Save] payload size audit\"",
  "JSON.stringify({ draftPackage: referenceOnlyDraftPackage })",
]) && !saveBlock.includes("JSON.stringify({ draftPackage })"));
check("save logs offending source field before serialization", includesAll(saveBlock, [
  "payloadAudit.offendingField",
  "large embedded source field stripped before serialization",
  "referenceOnlyBytes",
]));
check("Commercial preview stamps references before save", includesAll(previewBlock, [
  "const routeRepositoryId = String(",
  "const routeGeometryIdValue = String(",
  "const geometryHash = String(",
  "const estimateId = String(",
  "const workbookId = String(",
  "const commercialRevisionId = String(",
  "routeRepositoryRef",
  "commercialSummary: {",
]));
check("handoff handler saves before submit-engineering API call", includesAll(submitHandler, [
  "saveCommercialDraftIofPackage(draftSource, session)",
  "submitDraftIofPackageToEngineering(savedDraft.packageId",
  "[HANDOFF] Draft IOF saved; calling commercial handoff endpoint",
]) && appearsBefore(submitHandler, "saveCommercialDraftIofPackage(draftSource, session)", "submitDraftIofPackageToEngineering(savedDraft.packageId"));
check("server submit restores route/station truth from repositories after save", includesAll(serverSubmitBlock, [
  "hydrateStationAwareDraftPackageForSubmit",
  "ensureCommercialReleasePackageForDraft",
  "persistEngineeringBaseline",
  "persistEngineeringPackage",
  "commercialRevisionLocked: true",
  "noScopeVersionCreation: true",
]));
check("ScopeVersion creation remains absent from handoff path", !saveBlock.includes("createScopeVersion") &&
  !submitHandler.includes("createScopeVersion") &&
  !serverSubmitBlock.includes("createScopeVersion"));

const failed = checks.filter((item) => !item.condition);

for (const item of checks) {
  const status = item.condition ? "PASS" : "FAIL";
  console.log(`${status} ${item.name}${item.detail ? ` - ${item.detail}` : ""}`);
}

if (failed.length) {
  console.error(`\n${failed.length} CIP-030B validation check(s) failed.`);
  process.exit(1);
}

console.log("\nCIP-030B Draft IOF save payload size validation passed.");
