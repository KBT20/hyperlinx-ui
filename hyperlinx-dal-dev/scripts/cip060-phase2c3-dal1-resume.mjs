import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const base = process.env.CIP060_BASE_URL ?? "http://127.0.0.1:3001";
const password = (await readFile(process.env.CIP060_DEMO_CREDENTIAL_FILE ?? "/home/ubuntu/.hyperlinx-demo-credential", "utf8")).trim();
let cookie = "";
const trace = [];
async function call(step, path, method = "GET", body, expected = [200, 201]) {
  const response = await fetch(`${base}${path}`, { method, headers: { ...(cookie ? { Cookie: cookie } : {}), ...(body === undefined ? {} : { "Content-Type": "application/json" }) }, body: body === undefined ? undefined : JSON.stringify(body) });
  const setCookie = response.headers.get("set-cookie");
  if (setCookie) cookie = setCookie.split(";")[0];
  const text = await response.text();
  let value;
  try { value = text ? JSON.parse(text) : {}; } catch { value = { text }; }
  trace.push({ step, status: response.status, predicate: value.predicate, error: value.error });
  if (!expected.includes(response.status)) throw Object.assign(new Error(`${step} failed (${response.status}): ${value.error ?? text}`), { step, response: value, trace });
  return value;
}

const auth = await call("Demo login", "/api/auth/login", "POST", { username: "demo", password });
assert.equal(auth.user?.principalId, "demo-principal");
assert.equal(auth.user?.organizationId, "org-demo");

const proposalId = "PROPOSAL-DEMO-E2E-20260816-B";
const packageId = `DRAFT-IOF-${proposalId}`;
const proposal = (await call("Reload Proposal B", `/api/proposals/${proposalId}`)).proposal;
assert.equal(proposal.revisionNumber, 2);
assert.equal(proposal.revisionStatus, "SAVED");
assert.equal(proposal.approvalState, "APPROVED");
const r1 = proposal.proposalRevisions.find((item) => item.revisionNumber === 1);
const r2 = proposal.proposalRevisions.find((item) => item.revisionNumber === 2);
assert.ok(r1 && r2);
assert.equal(r1.snapshot.productDoctrineVersion, r2.snapshot.productDoctrineVersion);
assert.equal(r1.snapshot.productDoctrineHash, r2.snapshot.productDoctrineHash);

const draft = (await call("Reload reference-oriented Draft B", `/api/engineering/certification/draft-packages/${packageId}`)).draftPackage;
assert.equal(draft.proposalRevisionId, r2.proposalRevisionId);
assert.equal(draft.proposalHash, r2.proposalHash);
assert.equal(draft.productDoctrineId, r2.snapshot.productDoctrineId);
assert.equal(draft.productDoctrineVersion, r2.snapshot.productDoctrineVersion);
assert.equal(draft.productDoctrineHash, r2.snapshot.productDoctrineHash);
const manifestReference = draft.iofArtifactRepositoryReferences?.engineeringObjectManifest;
assert.ok(manifestReference?.artifactId);

const rawDraft = JSON.parse(await readFile(`server/data-demo/iof-packages/${packageId}.json`, "utf8"));
assert.equal(rawDraft.noEmbeddedManifests, true);
assert.equal(rawDraft.referenceOnly, true);
assert.equal(rawDraft.engineeringObjectManifest, undefined);
assert.equal(rawDraft.doctrineObjectManifest, undefined);
assert.equal(rawDraft.iofArtifactRepositoryReferences.engineeringObjectManifest.artifactId, manifestReference.artifactId);
const rawManifest = JSON.parse(await readFile(`server/data-demo/engineering-object-manifests/${manifestReference.artifactId}.json`, "utf8"));
assert.equal(rawManifest.payload.authority, "DOCTRINE_OBJECT_INSTANTIATION_ENGINE");
assert.equal(rawManifest.payload.productId, proposal.productId);
assert.equal(rawManifest.payload.doctrineId, proposal.productDoctrineId);
assert.equal(rawManifest.payload.doctrineVersion, proposal.productDoctrineVersion);
assert.ok(rawManifest.payload.objectCount > 0);

const retryDraft = (await call("Deterministic Draft IOF retry", "/api/engineering/certification/draft-packages/from-proposal", "POST", { proposalId })).draftPackage;
assert.equal(retryDraft.iofArtifactRepositoryReferences.engineeringObjectManifest.artifactId, manifestReference.artifactId);
assert.equal(retryDraft.iofArtifactRepositoryReferences.engineeringObjectManifest.hash, manifestReference.hash);

const handoff = await call("Commercial to Engineering submission", `/api/commercial/iof-packages/${packageId}/submit-engineering`, "POST", {});
const engineeringPackage = handoff.engineeringPackage;
assert.ok(engineeringPackage?.engineeringPackageId);
assert.equal(engineeringPackage.proposalRevisionId, r2.proposalRevisionId);
assert.equal(engineeringPackage.proposalHash, r2.proposalHash);
assert.equal(engineeringPackage.engineeringObjectManifestId, manifestReference.artifactId);

console.log(JSON.stringify({
  result: "PASS_TO_ENGINEERING",
  codeVersion: process.env.CIP060_CODE_VERSION ?? "UNKNOWN",
  proposalRevision1Id: r1.proposalRevisionId,
  proposalRevision2Id: r2.proposalRevisionId,
  proposalRevision2Hash: r2.proposalHash,
  productDoctrineId: proposal.productDoctrineId,
  productDoctrineVersion: proposal.productDoctrineVersion,
  productDoctrineHash: proposal.productDoctrineHash,
  manifestReference,
  manifestObjectCount: rawManifest.payload.objectCount,
  manifestAuthority: rawManifest.payload.authority,
  referenceOnlyDraft: true,
  deterministicRetry: true,
  engineeringPackageId: engineeringPackage.engineeringPackageId,
  engineeringBaselineId: handoff.engineeringBaseline?.engineeringBaselineId,
  trace,
}, null, 2));
