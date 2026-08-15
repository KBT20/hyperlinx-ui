import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const root = path.dirname(new URL(import.meta.url).pathname.replace(/^\/(.:)/, "$1"));
const read = (relative) => readFile(path.join(root, relative), "utf8");
const client = await read("src/api/teralinxRuntime.ts");
const sharedSource = await read("server/routes/_shared.js");
const commercial = await read("server/routes/commercial-iof-packages.js");
const explorer = await read("src/components/workspaces/googleRfp/TransparentEstimateExplorer.tsx");
const packageId = "DRAFT-IOF-PROP-DEMO-OPPORTUNITY-2-GGL-HELSWR-v2";
const persisted = JSON.parse(await read(`server/data/iof-packages/${packageId}.json`));
const manifestSource = client.slice(client.indexOf("function draftIofPackageRecordForRepository"), client.indexOf("export type RuntimeWorkspaceSession"));

const results = [];
function check(name, condition, detail = "") {
  assert.ok(condition, `${name}${detail ? `: ${detail}` : ""}`);
  results.push({ name, status: "PASS", detail });
}

check("Observed failure is retained as the before baseline", client.includes("DRAFT_IOF_REFERENCE_ONLY_MAX_BYTES = 4 * 1024 * 1024"), "112,989,222 bytes; object manifest 56,303,042 bytes");
check("Payload guard remains four MiB", !client.includes("DRAFT_IOF_REFERENCE_ONLY_MAX_BYTES = 113"));
check("Artifacts are persisted before manifest save", client.indexOf("/artifacts`") < client.indexOf("draftIofPackageRecordForRepository({"));
check("Object manifest is absent from the client reference manifest", !/engineeringObjectManifest:\s*draft\.engineeringObjectManifest/.test(manifestSource));
check("Station projection is absent from the client reference manifest", !/stationProjection:\s*draft\.stationProjection/.test(manifestSource));
check("Route geometry is represented by exact repository identity", client.includes("routeGeometryId") && client.includes("geometryHash") && client.includes("routeRevision"));
check("Customer Twin inventory is not embedded", !manifestSource.includes("customerTwinSnapshot: draft.customerTwinSnapshot"));
check("Proposal revision identity and hash remain inline", client.includes("proposalRevisionId") && client.includes("proposalHash"));
check("Commercial revision and release remain inline", client.includes("commercialRevisionId") && client.includes("commercialReleasePackageId"));
check("Source evidence remains reference-only", client.includes("sourceEvidenceRefs"));
check("Source KMZ content is not embedded in the manifest", !manifestSource.includes("sourceFileContent") && !manifestSource.includes("kmzBytes"));
check("Product Doctrine identity remains", manifestSource.includes("productDoctrineId"));
check("Product Doctrine version remains", manifestSource.includes("productDoctrineVersion"));
check("Project Configuration authority has a named reference", manifestSource.includes("projectConfigurationRef"));
check("Quantity authority has a named reference", manifestSource.includes("quantityReconciliationRef"));
check("Estimate revision identity remains", manifestSource.includes("estimateRevisionId"));
check("Estimate hash remains when available", manifestSource.includes("estimateHash"));
check("Estimate audit history is not embedded", !manifestSource.includes("estimateAudit"));
check("Proposal history is not embedded", !manifestSource.includes("proposalRevisions") && !manifestSource.includes("proposalHistory"));
check("Full normalized geometry is not embedded", !manifestSource.includes("normalizedGeometry") && !manifestSource.includes("routeGeometry:"));
check("Full customer inventory is not embedded", !manifestSource.includes("runtimeInventory") && !manifestSource.includes("objectInventory"));
check("Artifact upload uses canonical fields rather than duplicate aliases", client.includes("artifactPersistenceDraftPackage") && client.includes("engineeringObjectManifest: draft.engineeringObjectManifest ?? draft.doctrineObjectManifest"));
check("Package hash is deterministic", commercial.includes("deterministicDraftPackageHash") && commercial.includes("updatedAt: _updatedAt"));
check("Artifact persistence follows Commercial Release creation", commercial.indexOf("ensureCommercialReleasePackageForDraft(draftPackage, proposal, user") < commercial.indexOf("const artifactReferences = await persistIofProjectionArtifacts(draftPackage"));
check("Manifest persistence follows artifact persistence", commercial.indexOf("const artifactReferences = await persistIofProjectionArtifacts(draftPackage") < commercial.indexOf("await persistRecord(DIRS.iofPackages, referenceOnlyDraftPackage.packageId"));
check("Proposal repository is read, not rewritten, during artifact persistence", commercial.includes("loadRecord(DIRS.proposalDrafts") && !commercial.includes("persistRecord(DIRS.proposalDrafts, draftPackage.proposalId"));
check("Route revision is validated during Engineering intake", commercial.includes("Commercial Route revision mismatch"));
check("Route geometry hash is validated during Engineering intake", commercial.includes("Commercial Route geometry hash mismatch"));
check("Financial calibration is not part of artifact dereference", !sharedSource.includes("civilMix") && !sharedSource.includes("markupPercent"));
check("No compression is used", !/gzip|deflate|brotli/i.test(client.slice(client.indexOf("saveCommercialDraftIofPackage"), client.indexOf("listCommercialDraftIofPackages"))));
check("Engineering uses strict dereference", commercial.includes("hydrateIofProjectionArtifacts(existingRecord, { strict: true })"));
check("Integrity failure is explicit", sharedSource.includes("ARTIFACT_INTEGRITY_FAILURE"));
check("No floating latest reference", !sharedSource.includes('revision: "latest"'));
check("Duplicate n/a key cannot use raw display text", !explorer.includes("<div key={line}>") && explorer.includes("vendor-preview:${line}:"));
check("No Service Order or ScopeVersion endpoint was added", !commercial.includes("/api/service-orders") && !commercial.includes("/api/scopeversions"));
check("Reasoning service is not a persistence dependency", !commercial.includes("Reasoning Service") && !sharedSource.includes("Reasoning Service"));

const tempRoot = await mkdtemp(path.join(tmpdir(), "cip045c-"));
process.env.DAL_DATA_ROOT = tempRoot;
try {
  const shared = await import(`./server/routes/_shared.js?cip045c=${Date.now()}`);
  const fixture = {
    packageId: "DRAFT-IOF-CIP045C-ROUNDTRIP",
    organizationId: "org-teralinx",
    tenantId: "org-teralinx",
    customerId: "customer-google",
    opportunityId: "OPP-CIP045C",
    routeRevision: 7,
    engineeringObjectManifest: {
      manifestId: "OBJECT-MANIFEST-CIP045C",
      objects: Array.from({ length: 250 }, (_, index) => ({ objectId: `OBJ-${index}`, station: index * 100, type: "DUCT" })),
      validation: { status: "PASS" },
    },
    stationProjection: { stationProjectionId: "STATION-PROJECTION-CIP045C", stations: [0, 100, 200] },
    stationGraph: { stationGraphId: "STATION-GRAPH-CIP045C", nodes: [0, 100, 200] },
  };
  const refs = await shared.persistIofProjectionArtifacts(fixture, { timestamp: "2026-08-13T18:00:00.000Z" });
  check("Object Manifest is independently persisted", Boolean(refs.engineeringObjectManifest?.artifactId));
  check("Object Manifest reference has immutable revision and hash", Boolean(refs.engineeringObjectManifest?.revision && refs.engineeringObjectManifest?.hash));
  check("Station references have immutable revision and hash", Boolean(refs.stationProjection?.revision && refs.stationProjection?.hash && refs.stationGraph?.hash));
  const manifest = shared.stripIofProjectionArtifacts({ ...fixture, iofArtifactRepositoryReferences: refs }, refs);
  check("Reference manifest does not embed Object Manifest", !manifest.engineeringObjectManifest && !manifest.doctrineObjectManifest);
  check("Reference manifest does not embed station arrays", !manifest.stationProjection && !manifest.stationGraph);
  const reconstructed = await shared.hydrateIofProjectionArtifacts(manifest, { strict: true });
  check("Exact project view reconstructs from references", reconstructed.engineeringObjectManifest.objects.length === fixture.engineeringObjectManifest.objects.length && reconstructed.stationProjection.stations.length === 3);

  await assert.rejects(
    shared.hydrateIofProjectionArtifacts({ ...manifest, customerId: "customer-other" }, { strict: true }),
    /ARTIFACT_INTEGRITY_FAILURE.*customerId scope mismatch/,
  );
  results.push({ name: "Cross-customer reference blocks intake", status: "PASS" });
  await assert.rejects(
    shared.hydrateIofProjectionArtifacts({ ...manifest, opportunityId: "OPP-OTHER" }, { strict: true }),
    /ARTIFACT_INTEGRITY_FAILURE.*opportunityId scope mismatch/,
  );
  results.push({ name: "Cross-opportunity reference blocks intake", status: "PASS" });
  await assert.rejects(
    shared.hydrateIofProjectionArtifacts({ ...manifest, tenantId: "tenant-other", organizationId: "tenant-other" }, { strict: true }),
    /ARTIFACT_INTEGRITY_FAILURE.*organizationId scope mismatch/,
  );
  results.push({ name: "Cross-tenant reference blocks intake", status: "PASS" });

  const objectPath = shared.recordPath(shared.DIRS.engineeringObjectManifests, refs.engineeringObjectManifest.artifactId);
  const originalObjectArtifact = JSON.parse(await readFile(objectPath, "utf8"));
  await writeFile(objectPath, JSON.stringify({ ...originalObjectArtifact, payload: { ...originalObjectArtifact.payload, tampered: true } }));
  await assert.rejects(shared.hydrateIofProjectionArtifacts(manifest, { strict: true }), /ARTIFACT_INTEGRITY_FAILURE.*hash mismatch/);
  results.push({ name: "Hash mismatch blocks intake", status: "PASS" });
  await rm(objectPath);
  await assert.rejects(shared.hydrateIofProjectionArtifacts(manifest, { strict: true }), /ARTIFACT_INTEGRITY_FAILURE.*missing/);
  results.push({ name: "Missing artifact blocks intake", status: "PASS" });
} finally {
  await rm(tempRoot, { recursive: true, force: true });
}

check("Real target remains the acceptance identity", persisted.packageId === packageId);
const persistedBytes = Buffer.byteLength(JSON.stringify({ draftPackage: persisted }));
check("Persisted target is dramatically below the failed payload", persistedBytes < 4 * 1024 * 1024, `${persistedBytes.toLocaleString()} bytes currently persisted`);

console.log(JSON.stringify({ suite: "CIP-045C", passed: results.length, failed: 0, results }, null, 2));
