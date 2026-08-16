import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";

const baseUrl = process.env.CIP062_BASE_URL ?? "http://127.0.0.1:3001";
const demoPassword = (await readFile(process.env.CIP062_DEMO_CREDENTIAL_FILE ?? "/home/ubuntu/.hyperlinx-demo-credential", "utf8")).trim();
const trace = [];

async function call(step, pathname, { method = "GET", body, cookie = "", persona = "SALES", customerOrganizationId = "org-demo-customer-a", expected = [200, 201] } = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    method,
    headers: {
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      ...(cookie ? { Cookie: cookie } : {}),
      "X-Hyperlinx-Demo-Persona": persona,
      "X-Hyperlinx-Demo-Customer-Organization": customerOrganizationId,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const raw = await response.text();
  let value;
  try { value = raw ? JSON.parse(raw) : {}; } catch { value = { raw }; }
  trace.push({ step, status: response.status, predicate: value.predicate, error: value.error });
  if (!expected.includes(response.status)) throw Object.assign(new Error(`${step} (${response.status}): ${value.error ?? raw}`), { trace, value });
  return { value, cookie: String(response.headers.get("set-cookie") ?? "").split(";")[0] };
}

const login = await call("Demo login", "/api/auth/login", { method: "POST", body: { username: "demo", password: demoPassword } });
const demoCookie = login.cookie;
assert.equal(login.value.user.principalId, "demo-principal");
assert.equal(login.value.user.organizationId, "org-demo");

await call("Presentation-ready Demo reset", "/api/demo/reset", { method: "POST", body: { scenarioId: "DEMO-SCENARIO-DCI" }, cookie: demoCookie });
const productList = (await call("Resolve governed Product Doctrine", "/api/products", { cookie: demoCookie })).value;
const product = productList.products.find((item) => item.productId === "POINT_TO_POINT_LONG_HAUL_CONDUIT_FIBER");
assert.ok(product?.productDoctrineHash);

const opportunityId = "OPPORTUNITY-DEMO-CIP062-NORTHSTAR";
const routeRepositoryId = "ROUTE-DEMO-CIP062-NORTHSTAR";
const proposalId = "PROPOSAL-DEMO-CIP062-NORTHSTAR";
const packageId = `DRAFT-IOF-${proposalId}`;
const productAuthority = {
  productId: product.productId, productName: product.productName, productDoctrineId: product.productDoctrineId,
  productDoctrineVersion: product.productDoctrineVersion, productDoctrineHash: product.productDoctrineHash,
};

await call("Create Northstar Opportunity", "/api/commercial/opportunities", { method: "POST", cookie: demoCookie, body: { opportunity: {
  opportunityId, accountId: "ACCOUNT-DEMO-NORTHSTAR", customerId: "customer-demo-a", customerOrganizationId: "org-demo-customer-a",
  name: "Northstar Cloud DCI", status: "SAVED", selectedScopeId: "SCOPE-DEMO-CIP062-NORTHSTAR", activeView: "proposal", visibility: "ORGANIZATION", ...productAuthority,
} } });
const route = (await call("Create governed Northstar route", "/api/commercial/routes", { method: "POST", cookie: demoCookie, body: { commercialRoute: {
  routeRepositoryId, routeSnapshotId: `${routeRepositoryId}-v1`, routeGeometryId: `${routeRepositoryId}:GEOMETRY:v1`, opportunityId,
  accountId: "ACCOUNT-DEMO-NORTHSTAR", customerId: "customer-demo-a", customerOrganizationId: "org-demo-customer-a", ...productAuthority,
  routeId: routeRepositoryId, routeName: "Northstar Cloud DCI Route", routeRevision: 1,
  commercialGeometry: [[-97.5164,35.4676],[-97.4125,35.512],[-97.326,35.565]], routeFeet: 5280, routeMiles: 1, routeSource: "COMMERCIAL_DRAWN_ROUTE",
} } })).value.commercialRoute;

const proposalBase = {
  proposalId, proposalRecordId: proposalId, proposalNumber: "DEMO-CIP062-NORTHSTAR", customerId: "customer-demo-a",
  customerOrganizationId: "org-demo-customer-a", customerName: "Northstar Cloud Infrastructure", accountId: "ACCOUNT-DEMO-NORTHSTAR", opportunityId,
  ...productAuthority, routeRepositoryId, routeId: route.routeId, routeRevision: route.routeRevision,
  routeGeometryId: route.routeGeometryId, routeGeometryHash: route.geometryHash,
  routeSnapshot: { routeRepositoryId, routeId: route.routeId, routeRevision: route.routeRevision, routeGeometryId: route.routeGeometryId, geometryHash: route.geometryHash },
  productConfiguration: { ductCount: 3, ductDiameter: 1.25, fiberCount: 288, handholeCount: 2, vaultCount: 1, spliceCaseCount: 1, structurePlanAuthority: "ENGINEERING", spliceArchitectureAuthority: "ENGINEERING" },
  pricingSummary: { routeMiles: 1, routeFeet: 5280, budgetCost: 100000, sellPriceIru: 150000, nrcRevenue: 150000, mrcRevenue: 1000, tcv: 390000, termMonths: 240, grossMarginDollars: 50000, grossMarginPercent: 33.33 },
  title: "Northstar Governed Dark Fiber Proposal", summary: "A fictional Demo-only data center interconnect.", executiveSummary: "Northstar customer-safe DCI proposal.",
  status: "DRAFT", approvalState: "NOT_SUBMITTED", visibility: "SHARED", dealPointIds: ["DEAL-POINT-DEMO-CIP062"],
  runtimeObjectIds: ["RUNTIME-DEMO-CIP062"], runtimeRelationshipIds: [`DERIVED_FROM:${opportunityId}`], existingInventoryReferences: ["INVENTORY-DEMO-CIP062"],
  geometryReferences: [route.routeGeometryId], proposalDocumentReferences: ["Customer proposal", "Governed route map"], saveProposalRevision: true, revisionReason: "CIP-062 immutable R1.",
};
const r1 = (await call("Save Proposal R1", "/api/proposals", { method: "POST", cookie: demoCookie, body: { proposal: proposalBase } })).value.proposal;
const workingR2 = (await call("Clone R1 to R2", `/api/proposals/${proposalId}/revision`, { method: "POST", cookie: demoCookie, body: { basisProposalRevisionId: r1.proposalRevisionId, reason: "Customer presentation revision." } })).value.proposal;
const r2 = (await call("Save exact Proposal R2", "/api/proposals", { method: "POST", cookie: demoCookie, body: { proposal: { ...workingR2, saveProposalRevision: true, revisionReason: "CIP-062 immutable R2." } } })).value.proposal;

const recipients = ["demo-customer-a-viewer", "demo-customer-a-reviewer", "demo-customer-a-signer"];
const submittedR2 = (await call("Submit exact R2 to Northstar", `/api/proposals/${proposalId}/submit-customer`, { method: "POST", cookie: demoCookie, body: { assignedCustomerUsers: recipients, customerOrganizationId: "org-demo-customer-a" } })).value;
assert.equal(submittedR2.customerReviewPackage.proposalRevisionId, r2.proposalRevisionId);
assert.equal(submittedR2.customerReviewPackage.proposalHash, r2.proposalHash);
assert.equal(submittedR2.invitations.length, 3);
const r2ReviewerInvitation = submittedR2.invitations.find((item) => item.principalId === "demo-customer-a-reviewer");

const customerBProjects = (await call("Customer B cannot see Customer A project", "/api/customer-portal/projects", { cookie: demoCookie, persona: "CUSTOMER_VIEWER", customerOrganizationId: "org-demo-customer-b" })).value.projects;
assert.equal(customerBProjects.length, 0);
const viewerProject = (await call("Customer A Viewer reads bounded project", "/api/customer-portal/projects", { cookie: demoCookie, persona: "CUSTOMER_VIEWER" })).value.projects[0];
assert.equal(viewerProject.proposal.proposalRevisionId, r2.proposalRevisionId);
assert.equal("marginSummary" in viewerProject.proposal, false);
await call("Viewer acceptance rejected", `/api/customer-portal/projects/${opportunityId}/proposal/accept`, { method: "POST", cookie: demoCookie, persona: "CUSTOMER_VIEWER", body: { proposalRevisionId: r2.proposalRevisionId, proposalHash: r2.proposalHash }, expected: [403] });
await call("Wrong Proposal hash rejected", `/api/customer-portal/projects/${opportunityId}/proposal/accept`, { method: "POST", cookie: demoCookie, persona: "CUSTOMER_COMMERCIAL_REVIEWER", body: { proposalRevisionId: r2.proposalRevisionId, proposalHash: "WRONG" }, expected: [409] });
await call("Direct internal acceptance endpoint rejected", `/api/proposals/${proposalId}/approve`, { method: "POST", cookie: demoCookie, persona: "CUSTOMER_COMMERCIAL_REVIEWER", body: { comment: "must fail" }, expected: [403] });
await call("Customer question recorded", `/api/customer-portal/projects/${opportunityId}/questions`, { method: "POST", cookie: demoCookie, persona: "CUSTOMER_COMMERCIAL_REVIEWER", body: { question: "Please confirm the endpoint demarcation." } });
await call("Customer requests change against exact R2", `/api/customer-portal/projects/${opportunityId}/change-requests`, { method: "POST", cookie: demoCookie, persona: "CUSTOMER_COMMERCIAL_REVIEWER", body: { proposalRevisionId: r2.proposalRevisionId, proposalHash: r2.proposalHash, comment: "Please clarify delivery timing." } });
const unchangedR2 = (await call("Reload R2 authority", `/api/proposals/${proposalId}`, { cookie: demoCookie })).value.proposal.proposalRevisions.find((item) => item.proposalRevisionId === r2.proposalRevisionId);
assert.equal(unchangedR2.proposalHash, r2.proposalHash);

const workingR3 = (await call("Sales clones R2 to R3", `/api/proposals/${proposalId}/revision`, { method: "POST", cookie: demoCookie, body: { basisProposalRevisionId: r2.proposalRevisionId, reason: "Respond to customer delivery question." } })).value.proposal;
const r3 = (await call("Save exact Proposal R3", "/api/proposals", { method: "POST", cookie: demoCookie, body: { proposal: { ...workingR3, summary: "Northstar DCI with clarified delivery timing.", saveProposalRevision: true, revisionReason: "CIP-062 immutable R3." } } })).value.proposal;
const submittedR3 = (await call("Submit exact R3 to Northstar", `/api/proposals/${proposalId}/submit-customer`, { method: "POST", cookie: demoCookie, body: { assignedCustomerUsers: recipients, customerOrganizationId: "org-demo-customer-a" } })).value;
assert.equal(submittedR3.customerReviewPackage.proposalRevisionId, r3.proposalRevisionId);
await call("Superseded R2 invitation rejected", "/api/customer-portal/invitations/enroll", { method: "POST", body: { token: r2ReviewerInvitation.enrollmentToken, username: "northstar-reviewer", password: `Cip062!${randomBytes(18).toString("base64url")}` }, expected: [410] });

const reviewerInvite = submittedR3.invitations.find((item) => item.principalId === "demo-customer-a-reviewer");
const customerPassword = `Cip062!${randomBytes(18).toString("base64url")}`;
await call("Enroll named Northstar reviewer", "/api/customer-portal/invitations/enroll", { method: "POST", body: { token: reviewerInvite.enrollmentToken, username: "northstar-reviewer", password: customerPassword } });
await call("One-time invitation replay rejected", "/api/customer-portal/invitations/enroll", { method: "POST", body: { token: reviewerInvite.enrollmentToken, username: "northstar-reviewer", password: customerPassword }, expected: [410] });
const customerLogin = await call("Named external reviewer login", "/api/auth/login", { method: "POST", body: { username: "northstar-reviewer", password: customerPassword } });
const customerCookie = customerLogin.cookie;
assert.equal(customerLogin.value.user.organizationId, "org-demo-customer-a");
await call("External customer Product Doctrine access rejected", "/api/products", { cookie: customerCookie, expected: [403] });
await call("External customer Engineering workbench rejected", "/api/engineering/certification/queue", { cookie: customerCookie, expected: [403] });
await call("External customer direct ScopeVersion mutation rejected", "/api/scopeversions", { method: "POST", cookie: customerCookie, body: {}, expected: [403] });
const externalProjects = (await call("External reviewer reloads assigned project", "/api/customer-portal/projects", { cookie: customerCookie, customerOrganizationId: "org-demo-customer-b" })).value.projects;
assert.equal(externalProjects.length, 1);
assert.equal(externalProjects[0].customerOrganizationId, "org-demo-customer-a");

const accepted = (await call("Demo Customer accepts exact R3", `/api/customer-portal/projects/${opportunityId}/proposal/accept`, { method: "POST", cookie: demoCookie, persona: "CUSTOMER_COMMERCIAL_REVIEWER", body: { proposalRevisionId: r3.proposalRevisionId, proposalHash: r3.proposalHash, comment: "Accepted in Customer View." } })).value;
assert.equal(accepted.action.actorPrincipalId, "demo-principal");
assert.equal(accepted.action.demoPersona, "CUSTOMER_COMMERCIAL_REVIEWER");
assert.equal(accepted.project.proposal.proposalRevisionId, r3.proposalRevisionId);
const replay = (await call("Proposal acceptance idempotent replay", `/api/customer-portal/projects/${opportunityId}/proposal/accept`, { method: "POST", cookie: demoCookie, persona: "CUSTOMER_COMMERCIAL_REVIEWER", body: { proposalRevisionId: r3.proposalRevisionId, proposalHash: r3.proposalHash } })).value;
assert.equal(replay.idempotentReplay, true);

const handoffResult = await call("Commercial submits accepted package to Engineering", `/api/commercial/iof-packages/${packageId}/submit-engineering`, { method: "POST", cookie: demoCookie, persona: "SALES", body: {}, expected: [200, 409] });
const handoff = handoffResult.value;
if (!handoff.engineeringPackage) {
  console.log(JSON.stringify({
    result: "STOPPED_AT_GENUINE_ENGINEERING_HANDOFF_PREDICATE",
    exactGitSha: process.env.CIP062_CODE_VERSION ?? "UNKNOWN",
    scenarioId: "DEMO-SCENARIO-DCI",
    actorPrincipalId: "demo-principal",
    customerOrganizationId: "org-demo-customer-a",
    opportunityId, routeRepositoryId, proposalId,
    proposalRevision2Id: r2.proposalRevisionId, proposalRevision2Hash: r2.proposalHash,
    proposalRevision3Id: r3.proposalRevisionId, proposalRevision3Hash: r3.proposalHash,
    stopPredicate: handoff.error,
    missingEngineeringReferences: ["closureLedger", "iofPackageTwin", "executionGraph", "lifecycleGraph", "commercialAudit", "constitutionalState"],
    customerPortalAcceptance: "PASS",
    invitationSecretsReported: false,
    productionEligible: false,
    scopeVersionCreated: false,
    chicagoAccess: "ZERO",
    trace,
  }, null, 2));
  process.exit(0);
}
assert.equal(handoff.engineeringPackage.proposalRevisionId, r3.proposalRevisionId);
assert.equal(handoff.engineeringPackage.proposalHash, r3.proposalHash);
await call("Engineering opens exact governed package", `/api/engineering/certification/draft-packages/${packageId}`, { cookie: demoCookie, persona: "ENGINEERING" });
const engineeringGate = (await call("Engineering certification predicate", `/api/engineering/certification/draft-packages/${packageId}/certify`, { method: "POST", cookie: demoCookie, persona: "ENGINEERING", body: {}, expected: [200, 409] })).value;
let serviceOrderId = null;
let scopeVersionId = null;
if (engineeringGate.certifiedIofPackage) {
  const certified = engineeringGate.certifiedIofPackage;
  const generated = (await call("Sales creates exact Service Order", "/api/service-orders", { method: "POST", cookie: demoCookie, persona: "SALES", body: { proposalId, certifiedPackageId: certified.certifiedPackageId } })).value.serviceOrder;
  serviceOrderId = generated.serviceOrderId;
  const issued = (await call("Sales issues Service Order", `/api/service-orders/${serviceOrderId}/issue`, { method: "POST", cookie: demoCookie, persona: "SALES" })).value.serviceOrder;
  await call("Reviewer cannot sign Service Order", `/api/customer-portal/projects/${opportunityId}/service-order/sign`, { method: "POST", cookie: customerCookie, body: { serviceOrderId, documentHash: issued.documentHash, typedName: customerLogin.value.user.name, authorityAcknowledged: true }, expected: [403] });
  await call("Wrong Service Order hash rejected", `/api/customer-portal/projects/${opportunityId}/service-order/sign`, { method: "POST", cookie: demoCookie, persona: "CUSTOMER_AUTHORIZED_SIGNER", body: { serviceOrderId, documentHash: "WRONG", typedName: login.value.user.name, authorityAcknowledged: true }, expected: [409] });
  const signed = (await call("Demo Customer Authorized Signer signs", `/api/customer-portal/projects/${opportunityId}/service-order/sign`, { method: "POST", cookie: demoCookie, persona: "CUSTOMER_AUTHORIZED_SIGNER", body: { serviceOrderId, documentHash: issued.documentHash, typedName: login.value.user.name, authorityAcknowledged: true } })).value;
  assert.equal(signed.action.demoPersona, "CUSTOMER_AUTHORIZED_SIGNER");
  const countersigned = (await call("Demo Executive countersigns atomically", `/api/service-orders/${serviceOrderId}/countersign`, { method: "POST", cookie: demoCookie, persona: "EXECUTIVE", body: { documentHash: issued.documentHash, authorizationAcknowledged: true } })).value;
  scopeVersionId = countersigned.scopeVersion.scopeVersionId;
  const authorizedProject = (await call("Customer portal shows Authorized", "/api/customer-portal/projects", { cookie: demoCookie, persona: "CUSTOMER_VIEWER" })).value.projects[0];
  assert.equal(authorizedProject.scopeVersion.scopeVersionId, scopeVersionId);
  assert.equal(authorizedProject.status, "AUTHORIZED");
}

console.log(JSON.stringify({
  result: scopeVersionId ? "PASS_TO_SCOPEVERSION" : engineeringGate.certifiedIofPackage ? "STOPPED_AFTER_CERTIFICATION" : "STOPPED_AT_GENUINE_ENGINEERING_PREDICATE",
  exactGitSha: process.env.CIP062_CODE_VERSION ?? "UNKNOWN",
  scenarioId: "DEMO-SCENARIO-DCI",
  actorPrincipalId: "demo-principal",
  customerOrganizationId: "org-demo-customer-a",
  opportunityId, routeRepositoryId, proposalId,
  proposalRevision2Id: r2.proposalRevisionId, proposalRevision2Hash: r2.proposalHash,
  proposalRevision3Id: r3.proposalRevisionId, proposalRevision3Hash: r3.proposalHash,
  engineeringPackageId: handoff.engineeringPackage.engineeringPackageId,
  engineeringPredicate: engineeringGate.predicate ?? engineeringGate.error ?? "PASSED",
  serviceOrderId,
  scopeVersionId,
  invitationSecretsReported: false,
  productionEligible: false,
  scopeVersionCreated: Boolean(scopeVersionId),
  chicagoAccess: "ZERO",
  trace,
}, null, 2));
