import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { hydrateIofProjectionArtifacts } from "./server/routes/_shared.js";
import { resolveEngineeringPackageReferences } from "./server/routes/engineering-packages.js";

const PACKAGE_ID = "DRAFT-IOF-PROP-DEMO-OPPORTUNITY-3SWR-v2";
const ENGINEERING_PACKAGE_ID = `ENG-PKG-${PACKAGE_ID}`;
const root = process.cwd();
const readJson = (path) => JSON.parse(readFileSync(join(root, path), "utf8"));
const encodedRecordPath = (repositoryPath, id) => join(root, repositoryPath, `${encodeURIComponent(String(id))}.json`);
const sha256Json = (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const compactBytes = (value) => Buffer.byteLength(JSON.stringify(value), "utf8");
let passed = 0;
let failed = 0;
function check(label, condition, detail = "") {
  if (condition) {
    passed += 1;
    console.log(`PASS ${label}${detail ? ` — ${detail}` : ""}`);
  } else {
    failed += 1;
    console.error(`FAIL ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

const draftPath = `server/data/iof-packages/${encodeURIComponent(PACKAGE_ID)}.json`;
const engineeringPackagePath = `server/data/engineering-packages/${encodeURIComponent(ENGINEERING_PACKAGE_ID)}.json`;
const draft = readJson(draftPath);
const engineeringPackage = readJson(engineeringPackagePath);
const route = readJson(`server/data/commercial-routes/${encodeURIComponent(draft.routeRepositoryId)}.json`);
const proposal = readJson(`server/data/proposal-drafts/${encodeURIComponent(draft.proposalId)}.json`);
const commercialRevision = readJson(`server/data/commercial-revisions/${encodeURIComponent(draft.commercialRevisionId)}.json`);
const commercialRelease = readJson(`server/data/commercial-release-packages/${encodeURIComponent(draft.commercialReleasePackageId)}.json`);
const serverSource = readFileSync(join(root, "server/routes/commercial-iof-packages.js"), "utf8");
const engineeringSource = readFileSync(join(root, "server/routes/engineering-packages.js"), "utf8");
const clientSource = readFileSync(join(root, "src/components/workspaces/GoogleRfpWorkspace.tsx"), "utf8");
const runtimeClientSource = readFileSync(join(root, "src/api/teralinxRuntime.ts"), "utf8");

check("1. Exact original 409 branch identified", serverSource.includes("Doctrine Object Manifest validation failed") && serverSource.includes("requireDoctrineObjectMaterializationForStationProjection"), "requireDoctrineObjectMaterializationForStationProjection");
check("2. Exact original response captured in a recovery transaction", readdirSync(join(root, "server/data/transaction-manifests")).some((name) => {
  if (!name.startsWith(`ENGINEERING-HANDOFF-${PACKAGE_ID}-`)) return false;
  const record = readJson(`server/data/transaction-manifests/${name}`);
  return String(record.failureReason ?? "").includes("Required asset ASSET:HANDHOLES was not instantiated");
}));
check("3. Exact failing authority identified as producer materialization", serverSource.includes("doctrineObjectStationAttachments") && serverSource.includes("DOCTRINE_OBJECT_INSTANTIATION_ENGINE"));
check("4. Same Draft IOF reached Engineering", draft.status === "SUBMITTED_TO_ENGINEERING" && engineeringPackage.draftIOFPackageId === PACKAGE_ID);
check("5. Draft IOF remains reference-only", draft.referenceOnly === true && draft.noEmbeddedManifests === true && draft.noEmbeddedGeometry === true);

const refs = draft.iofArtifactRepositoryReferences ?? {};
const requiredReferenceKeys = [
  "engineeringObjectManifest",
  "stationProjection",
  "stationGraph",
  "stationObjectManifest",
  "measuredCenterline",
  "projectedObjectManifest",
  "closureLedger",
  "iofPackageTwin",
  "productDoctrineAssembly",
  "projectConfiguration",
  "quantityReconciliation",
];
const referenceMatrix = [];
for (const key of requiredReferenceKeys) {
  const reference = refs[key] ?? {};
  const path = reference.artifactId && reference.repositoryPath ? encodedRecordPath(reference.repositoryPath, reference.artifactId) : "";
  const artifact = path && existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : null;
  const hashMatches = Boolean(artifact && sha256Json(artifact.payload ?? artifact) === reference.hash);
  const revisionMatches = Boolean(artifact && String(artifact.revision) === String(reference.revision));
  const organizationMatches = Boolean(artifact && artifact.organizationId === draft.organizationId);
  const tenantMatches = Boolean(artifact && artifact.tenantId === (draft.tenantId ?? draft.organizationId));
  const customerMatches = Boolean(artifact && artifact.customerId === draft.customerId);
  const opportunityMatches = Boolean(artifact && artifact.opportunityId === draft.opportunityId);
  const persistedBeforeDraft = Boolean(artifact && statSync(path).mtimeMs <= statSync(join(root, draftPath)).mtimeMs);
  referenceMatrix.push({ key, reference, artifact, path, hashMatches, revisionMatches, organizationMatches, tenantMatches, customerMatches, opportunityMatches, persistedBeforeDraft });
}
check("6. Every required artifact reference inspected", referenceMatrix.length === requiredReferenceKeys.length && referenceMatrix.every((row) => row.artifact));
check("7. No floating latest references", referenceMatrix.every((row) => row.reference.artifactId && row.reference.revision && row.reference.hash && !String(row.reference.artifactId).toLowerCase().includes("latest")));
check("8. Route revision/hash validated", String(draft.routeRevision) === String(route.routeRevision) && draft.geometryHash === route.geometryHash, `revision ${route.routeRevision}; ${route.geometryHash}`);
check("9. Object Manifest revision/hash validated", referenceMatrix.find((row) => row.key === "engineeringObjectManifest")?.hashMatches === true);
check("10. Station authority revision/hash validated", ["stationProjection", "stationGraph", "stationObjectManifest"].every((key) => {
  const row = referenceMatrix.find((candidate) => candidate.key === key);
  return row?.revisionMatches && row?.hashMatches;
}));
check("11. Doctrine assembly revision/hash validated", referenceMatrix.find((row) => row.key === "productDoctrineAssembly")?.hashMatches === true);
check("12. Project Configuration revision/hash validated", referenceMatrix.find((row) => row.key === "projectConfiguration")?.hashMatches === true);
const exactProposalRevision = (proposal.proposalRevisions ?? []).find((revision) => revision.proposalRevisionId === draft.proposalRevisionId && revision.proposalHash === draft.proposalHash);
check("13. Proposal Revision/hash validated", Boolean(exactProposalRevision), `${draft.proposalRevisionId}; ${draft.proposalHash}`);
check("14. Commercial Release validated", commercialRelease.commercialReleasePackageId === draft.commercialReleasePackageId && commercialRelease.releaseHash === draft.commercialReleaseHash);
check("15. Tenant scope validated", referenceMatrix.every((row) => row.tenantMatches));
check("16. Customer scope validated", referenceMatrix.every((row) => row.customerMatches));
check("17. Opportunity scope validated", referenceMatrix.every((row) => row.opportunityMatches));
check("18. Artifacts were durable before the reference-only Draft", referenceMatrix.every((row) => row.persistedBeforeDraft));

const missingReferenceDraft = structuredClone(draft);
missingReferenceDraft.iofArtifactRepositoryReferences.engineeringObjectManifest.artifactId = "MISSING-CIP045C1-OBJECT-MANIFEST";
let missingFailsClosed = false;
try {
  await hydrateIofProjectionArtifacts(missingReferenceDraft, { strict: true });
} catch (error) {
  missingFailsClosed = String(error.message).includes("ARTIFACT_INTEGRITY_FAILURE");
}
check("19. Missing artifact fails closed", missingFailsClosed);

const hashMismatchDraft = structuredClone(draft);
hashMismatchDraft.iofArtifactRepositoryReferences.stationProjection.hash = "0".repeat(64);
let hashMismatchFailsClosed = false;
try {
  await hydrateIofProjectionArtifacts(hashMismatchDraft, { strict: true });
} catch (error) {
  hashMismatchFailsClosed = String(error.message).includes("hash mismatch");
}
check("20. Hash mismatch fails closed", hashMismatchFailsClosed);

const reconstructedDraft = await hydrateIofProjectionArtifacts(draft, { strict: true });
check("21. Valid references reconstruct exact artifacts", requiredReferenceKeys.every((key) => refs[key]) && reconstructedDraft.stationIndexedGraph?.graphId === engineeringPackage.stationGraphId && reconstructedDraft.engineeringObjectManifest?.manifestId === engineeringPackage.engineeringObjectManifestId);
const engineeringResolution = await resolveEngineeringPackageReferences(engineeringPackage);
check("22. Reloaded Engineering Package integrity passes", engineeringResolution.ok && Object.values(engineeringResolution.checks).every(Boolean));

const tamperedEngineeringPackage = { ...engineeringPackage, stationGraphId: "MISSING-CIP045C1-STATION-GRAPH" };
const tamperedEngineeringResolution = await resolveEngineeringPackageReferences(tamperedEngineeringPackage);
check("23. Engineering gate remains fail-closed", !tamperedEngineeringResolution.ok && tamperedEngineeringResolution.missing.includes("stationGraph"));
check("24. Payload guard remains 4 MiB", runtimeClientSource.includes("DRAFT_IOF_REFERENCE_ONLY_MAX_BYTES = 4 * 1024 * 1024"));
check("25. Reasoning is outside deterministic handoff", !serverSource.includes("/api/reasoning") && !engineeringSource.includes("/api/reasoning"));
check("26. Duplicate revision React keys eliminated", clientSource.includes("`${opportunity.opportunityId}:${String(revision.revisionId ?? revision.revision") && !clientSource.includes("id: String(revision.revision ??"));
const targetToken = draft.opportunityId;
const serviceOrderRecords = readdirSync(join(root, "server/data/service-orders")).filter((name) => name.endsWith(".json")).map((name) => readJson(`server/data/service-orders/${name}`));
const scopeVersionRecords = readdirSync(join(root, "server/data/scopeversions")).filter((name) => name.endsWith(".json")).map((name) => readJson(`server/data/scopeversions/${name}`));
check("27. No Service Order created", !serviceOrderRecords.some((record) => JSON.stringify(record).includes(targetToken)));
check("28. No ScopeVersion created", !scopeVersionRecords.some((record) => JSON.stringify(record).includes(targetToken)) && engineeringPackage.scopeVersionState === "BLOCKED_UNTIL_SIGNED_SERVICE_ORDER");
check("29. No deployment path added", !serverSource.includes("DAL1") && !clientSource.includes("app.teralinx.net"));
check("30. All artifact revisions and scopes match", referenceMatrix.every((row) => row.revisionMatches && row.hashMatches && row.organizationMatches && row.tenantMatches && row.customerMatches && row.opportunityMatches));
check("31. Quantity authority revision/hash validated", referenceMatrix.find((row) => row.key === "quantityReconciliation")?.hashMatches === true);
check("32. Commercial Revision validated", commercialRevision.commercialRevisionId === draft.commercialRevisionId && commercialRevision.revisionHash === draft.commercialRevisionHash);
check("33. Successful Engineering Package is reference-only", engineeringPackage.referenceOnly === true && compactBytes(engineeringPackage) < 16 * 1024);

const bannedInlineFields = ["engineeringObjectManifest", "doctrineObjectManifest", "stationProjection", "stationGraph", "stationIndexedGraph", "stationAuthority", "stations", "spineAuditProjection", "spineObjectCatalogEntries", "instantiatedSpineObjects", "auditObjectManifestEntries", "objects", "spineReviewObjects", "linearAssetSpanAttachments", "doctrineLinearAssetSpanAttachments", "customerTwin", "sourceKmz", "sourceKMZ"];
check("34. Large artifacts and source KMZ are not embedded", bannedInlineFields.every((field) => !(field in draft)));
const inlineSizes = Object.entries(draft)
  .map(([key, value]) => ({ key, bytes: compactBytes(value) }))
  .sort((a, b) => b.bytes - a.bytes)
  .slice(0, 10);
const draftSerializedBytes = compactBytes(draft);
check("35. Draft IOF stays below 4 MiB", draftSerializedBytes < 4 * 1024 * 1024, `${draftSerializedBytes} bytes`);

const sourceEvidence = (route.importedEvidence ?? [])[0] ?? null;
const sourceEvidencePath = sourceEvidence?.repositoryLocation ? join(root, sourceEvidence.repositoryLocation) : "";
const sourceEvidenceFileExists = Boolean(sourceEvidencePath && existsSync(sourceEvidencePath));
const sourceEvidenceFileHashMatches = sourceEvidenceFileExists
  ? createHash("sha256").update(readFileSync(sourceEvidencePath)).digest("hex") === sourceEvidence.checksum
  : false;

console.log("\nREFERENCE RESOLUTION MATRIX");
for (const row of referenceMatrix) {
  console.log(JSON.stringify({
    artifact: row.key,
    artifactId: row.reference.artifactId,
    repository: row.reference.repositoryPath,
    status: row.artifact && row.revisionMatches && row.hashMatches && row.organizationMatches && row.tenantMatches && row.customerMatches && row.opportunityMatches ? "RESOLVED" : "MISMATCH",
    revision: row.reference.revision,
    hash: row.reference.hash,
    persistedBeforeDraft: row.persistedBeforeDraft,
  }));
}
console.log(JSON.stringify({
  route: { status: "RESOLVED", routeRepositoryId: route.routeRepositoryId, routeRevision: route.routeRevision, geometryHash: route.geometryHash, sourceFileHash: route.sourceFileHash },
  proposalRevision: { status: exactProposalRevision ? "RESOLVED" : "MISSING", proposalRevisionId: draft.proposalRevisionId, proposalHash: draft.proposalHash },
  commercialRevision: { status: commercialRevision.revisionHash === draft.commercialRevisionHash ? "RESOLVED" : "HASH_MISMATCH", commercialRevisionId: draft.commercialRevisionId, hash: draft.commercialRevisionHash },
  commercialRelease: { status: commercialRelease.releaseHash === draft.commercialReleaseHash ? "RESOLVED" : "HASH_MISMATCH", commercialReleasePackageId: draft.commercialReleasePackageId, hash: draft.commercialReleaseHash },
  sourceEvidence: { status: sourceEvidenceFileExists && sourceEvidenceFileHashMatches ? "RESOLVED" : "MISSING", evidenceId: sourceEvidence?.evidenceId, checksum: sourceEvidence?.checksum, repositoryLocation: sourceEvidence?.repositoryLocation, metadataPersistedInRouteRepository: Boolean(sourceEvidence), sourceFileExists: sourceEvidenceFileExists },
  engineeringPackage: { status: engineeringResolution.ok ? "RESOLVED" : "MISMATCH", engineeringPackageId: engineeringPackage.engineeringPackageId, referenceHash: engineeringPackage.referenceHash },
}, null, 2));
console.log("\nDRAFT IOF SIZE PROOF");
console.log(JSON.stringify({ draftSerializedBytes, persistedPrettyPrintedBytes: statSync(join(root, draftPath)).size, referenceCount: Object.keys(refs).length, largestInlineFields: inlineSizes }, null, 2));
console.log(`\nCIP-045C.1 validation: ${passed} passed, ${failed} failed`);
if (failed) process.exitCode = 1;
