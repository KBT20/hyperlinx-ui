import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const baseUrl = process.env.CIP062_BASE_URL ?? "http://127.0.0.1:3001";
const password = (await readFile(process.env.CIP062_DEMO_CREDENTIAL_FILE ?? "/home/ubuntu/.hyperlinx-demo-credential", "utf8")).trim();

async function request(pathname, options = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    method: options.method ?? "GET",
    headers: {
      ...(options.cookie ? { Cookie: options.cookie } : {}),
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      "X-Hyperlinx-Demo-Persona": options.persona ?? "CUSTOMER_COMMERCIAL_REVIEWER",
      "X-Hyperlinx-Demo-Customer-Organization": options.customerOrganizationId ?? "org-demo-customer-a",
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const body = await response.json();
  if (!response.ok) throw new Error(`${pathname} returned ${response.status}: ${body.error}`);
  return { body, cookie: String(response.headers.get("set-cookie") ?? "").split(";")[0] };
}

const login = await request("/api/auth/login", { method: "POST", body: { username: "demo", password }, persona: "SALES" });
const projects = (await request("/api/customer-portal/projects", { cookie: login.cookie })).body.projects;
assert.equal(projects.length, 1);
const project = projects[0];
assert.equal(project.projectId, "OPPORTUNITY-DEMO-CIP062-NORTHSTAR");
assert.equal(project.proposal.proposalRevisionId, "PROPOSAL-DEMO-CIP062-NORTHSTAR-revision-3");
assert.equal(project.proposal.proposalHash, "0b6ad2866098cc520cc1c92d34c5fd089a79735c17a58cef4a0ff5a34b7eaf5f");
assert.equal(project.proposal.decision, "APPROVED");
assert.ok(project.activity.some((item) => item.action === "ACCEPT"));
const customerB = (await request("/api/customer-portal/projects", { cookie: login.cookie, persona: "CUSTOMER_VIEWER", customerOrganizationId: "org-demo-customer-b" })).body.projects;
assert.equal(customerB.length, 0);

console.log(JSON.stringify({
  result: "PASS",
  exactGitSha: process.env.CIP062_CODE_VERSION ?? "UNKNOWN",
  restartPersistence: true,
  proposalRevisionId: project.proposal.proposalRevisionId,
  proposalHash: project.proposal.proposalHash,
  customerAcceptancePersisted: true,
  customerBIsolationPersisted: true,
  productionEligible: false,
}, null, 2));
