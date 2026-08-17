import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const baseUrl = process.env.CIP071_BASE_URL ?? "http://127.0.0.1:3001";
const scopeVersionId = "ScopeVersion-0001-CERT-IOF-DRAFT-IOF-PROPOSAL-DEMO-CIP067-NORTHSTAR-PERSISTENCE";
const password = (await readFile(process.env.CIP071_DEMO_CREDENTIAL_FILE ?? "/home/ubuntu/.hyperlinx-demo-credential", "utf8")).trim();

let cookie = "";
async function request(path, { method = "GET", body, expected = 200 } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { ...(body ? { "content-type": "application/json" } : {}), ...(cookie ? { cookie } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const setCookie = response.headers.get("set-cookie");
  if (setCookie) cookie = setCookie.split(";", 1)[0];
  const text = await response.text();
  const value = text ? JSON.parse(text) : {};
  assert.equal(response.status, expected, `${method} ${path}: ${text}`);
  return value;
}

const login = await request("/api/auth/login", { method: "POST", body: { username: "demo", password } });
assert.equal(login.user?.principalId, "demo-principal");
assert.equal(login.user?.organizationId, "org-demo");

const path = `/api/operational-baselines/${encodeURIComponent(scopeVersionId)}`;
const first = (await request(path)).operationalBaseline;
const second = (await request(path)).operationalBaseline;
assert.deepEqual(second, first, "Repeated bootstrap must be byte-equivalent JSON authority.");
assert.equal(first.executionAuthority.scopeVersionId, scopeVersionId);
assert.equal(first.executionAuthority.state, "AUTHORIZED");
assert.equal(first.executionAuthority.immutable, true);
assert.equal(first.initialState.realized, false);
assert.equal(first.initialState.physicallyComplete, false);
assert.equal(first.authorityCensus.closureEvents, 0);
assert.equal(first.closeBoundary.mutationAuthority, "GOVERNED_CLOSE_ONLY");

const lensIds = ["MARKETPLACE", "CONTROL", "FIELD", "TWIN"];
const projections = {};
for (const lensId of lensIds) {
  const projection = (await request(`${path}/lenses/${lensId}`)).operationalProjection;
  projections[lensId] = projection;
  assert.equal(projection.executionAuthority.scopeVersionId, scopeVersionId);
  assert.deepEqual(projection.route, first.route);
  assert.deepEqual(projection.identities, first.identities);
  assert.equal(projection.lens.mutatesSpine, false);
  assert.equal(projection.lens.createsCloseAuthority, false);
  assert.equal(projection.projectionOnly, true);
}
assert.equal(projections.FIELD.lens.completionAuthority, "NOT_CLOSE_AUTHORITY");
assert.equal(projections.TWIN.lens.mutationAuthority, "NONE");

const missing = await request("/api/operational-baselines/ScopeVersion-DEMO-MISSING", { expected: 409 });
assert.equal(missing.error, "SCOPEVERSION_NOT_FOUND");
await request(path, { method: "POST", body: {}, expected: 405 });

console.log(JSON.stringify({
  result: "PASS",
  actorPrincipalId: login.user.principalId,
  organizationId: login.user.organizationId,
  scopeVersionId,
  baselineIdentity: first.baselineIdentity,
  project: first.project,
  lineage: first.lineage,
  references: first.references,
  route: first.route,
  authorityCensus: first.authorityCensus,
  identities: Object.fromEntries(Object.entries(first.identities).map(([key, values]) => [key, { count: values.length, hash: first.hashes[key === "stationIds" ? "stationAuthorityHash" : key === "objectIds" ? "objectManifestHash" : key === "workSegmentIds" ? "executionGraphHash" : "lifecycleGraphHash"] }])),
  initialState: first.initialState,
  lensParity: Object.fromEntries(lensIds.map((lensId) => [lensId, {
    scopeVersionId: projections[lensId].executionAuthority.scopeVersionId,
    route: projections[lensId].route,
    authorityCensus: projections[lensId].authorityCensus,
    mutatesSpine: projections[lensId].lens.mutatesSpine,
    createsCloseAuthority: projections[lensId].lens.createsCloseAuthority,
  }])),
  idempotent: true,
  missingScopeVersion: "REJECTED",
  baselineMutationMethod: "REJECTED",
  closeBoundary: first.closeBoundary,
}, null, 2));
