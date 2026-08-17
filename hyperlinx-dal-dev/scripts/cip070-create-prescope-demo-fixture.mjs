import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const baseUrl = process.env.CIP070_BASE_URL ?? "http://127.0.0.1:3001";
const password = (await readFile(process.env.CIP070_DEMO_CREDENTIAL_FILE ?? "/home/ubuntu/.hyperlinx-demo-credential", "utf8")).trim();
const accountId = "ACCOUNT-DEMO-BLUE-MESA";
const customerId = "customer-demo-b";
const opportunityId = "OPPORTUNITY-DEMO-CIP070-BLUE-MESA-DRAFT";
const routeRepositoryId = "ROUTE-DEMO-CIP070-BLUE-MESA-DRAFT";
const coordinates = [[-96.797, 32.7767], [-96.732, 32.824], [-96.675, 32.861]];

async function call(pathname, { method = "GET", body, cookie = "", expected = [200, 201] } = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, { method, headers: { ...(body === undefined ? {} : { "Content-Type": "application/json" }), ...(cookie ? { Cookie: cookie } : {}), "X-Hyperlinx-Demo-Persona": "SALES", "X-Hyperlinx-Demo-Customer-Organization": "org-demo-customer-b" }, body: body === undefined ? undefined : JSON.stringify(body) });
  const raw = await response.text();
  let value = {}; try { value = raw ? JSON.parse(raw) : {}; } catch { value = { raw }; }
  assert.ok(expected.includes(response.status), `${pathname} returned ${response.status}: ${raw.slice(0, 500)}`);
  return { value, status: response.status, cookie: String(response.headers.get("set-cookie") ?? "").split(";")[0] };
}

const login = await call("/api/auth/login", { method: "POST", body: { username: "demo", password } });
const cookie = login.cookie;
assert.equal(login.value.user.principalId, "demo-principal");
const existing = await call(`/api/commercial/opportunities/${encodeURIComponent(opportunityId)}`, { cookie, expected: [200, 404] });
let opportunity = existing.value.opportunity ?? null;
let route;
let created = false;
if (!opportunity) {
  const routeResult = await call("/api/commercial/routes", { method: "POST", cookie, body: { commercialRoute: {
    routeRepositoryId, routeId: routeRepositoryId, opportunityId, accountId, customerId,
    organizationId: "org-demo", environment: "DEMO", securityDomain: "DEMO", productionEligible: false,
    routeRevision: 1, commercialGeometry: coordinates, routeFeet: 12672, routeMiles: 2.4,
    routeSource: "CONTROLLED_DEMO_ROUTE", transactionId: "ROUTE-SAVE-DEMO-CIP070-BLUE-MESA-DRAFT",
  } } });
  route = routeResult.value.commercialRoute ?? routeResult.value.route;
  assert.equal(route.routeRepositoryId, routeRepositoryId);
  assert.ok(route.geometryHash);
  const commercialWorkingState = {
    schemaVersion: "CIP-067", opportunityId, accountId, customerId,
    customerTwinId: `CUSTOMER-TWIN-${accountId}`,
    product: { productId: "POINT_TO_POINT_LONG_HAUL_CONDUIT_FIBER", productName: "Point-to-Point Long Haul Conduit & Fiber", productDoctrineId: "DOCTRINE-L1-POINT-TO-POINT-LONG-HAUL-CONDUIT-FIBER", productDoctrineVersion: "20C.1.0", productDoctrineHash: "81c488a6d4bd35183e35eabf1a1c533e53a7c700d38db5d5bf67e8c2b3883bdd" },
    route: { routeRepositoryId, routeRevision: 1, routeGeometryId: route.routeGeometryId, geometryHash: route.geometryHash },
    civilMixCalibration: { plowPercent: 82, dirtPercent: 12, rockPercent: 0, trenchPercent: 6 },
    economics: { currency: "USD", nrc: 0, mrc: 0, termMonths: 0 },
    currentLifecycleState: "DRAFT",
  };
  const opportunityResult = await call("/api/commercial/opportunities", { method: "POST", cookie, body: { opportunity: {
    opportunityId, accountId, customerId, customerTwinId: `CUSTOMER-TWIN-${accountId}`,
    name: "Blue Mesa Customer View Draft", description: "Controlled governed Demo draft used to validate pre-ScopeVersion Customer View rehydration.",
    status: "SAVED", state: "DRAFT", lifecycleState: "ACTIVE", visibility: "ORGANIZATION",
    organizationId: "org-demo", environment: "DEMO", securityDomain: "DEMO", productionEligible: false,
    productId: commercialWorkingState.product.productId, productName: commercialWorkingState.product.productName,
    productDoctrineId: commercialWorkingState.product.productDoctrineId, productDoctrineVersion: commercialWorkingState.product.productDoctrineVersion, productDoctrineHash: commercialWorkingState.product.productDoctrineHash,
    routeRepositoryId, routeRevision: 1, routeGeometryId: route.routeGeometryId, geometryHash: route.geometryHash,
    constructionMixSnapshot: commercialWorkingState.civilMixCalibration, commercialWorkingState,
    transactionId: "OPPORTUNITY-SAVE-DEMO-CIP070-BLUE-MESA-DRAFT",
  } } });
  opportunity = opportunityResult.value.opportunity;
  created = true;
} else {
  route = (await call(`/api/commercial/routes/${encodeURIComponent(routeRepositoryId)}`, { cookie })).value.commercialRoute;
}

assert.equal(opportunity.opportunityId, opportunityId);
assert.equal(opportunity.accountId, accountId);
assert.equal(opportunity.routeRepositoryId, routeRepositoryId);
assert.equal(opportunity.routeGeometryId, route.routeGeometryId);
assert.equal(opportunity.geometryHash, route.geometryHash);
assert.equal(opportunity.status, "SAVED");
assert.equal(opportunity.commercialWorkingState.currentLifecycleState, "DRAFT");
console.log(JSON.stringify({ result: "PASS", created, authorityPath: "Commercial Route Repository → Commercial Opportunity Repository", accountId, customerId, opportunityId, opportunityStateVersion: opportunity.commercialStateVersion, opportunityStateHash: opportunity.commercialStateHash, route: { routeRepositoryId, routeRevision: route.routeRevision, routeGeometryId: route.routeGeometryId, geometryHash: route.geometryHash, routeMiles: route.routeMiles, coordinateCount: route.commercialGeometry.length }, proposalCreated: false, customerReviewCreated: false, scopeVersionCreated: false, productionEligible: false }, null, 2));
