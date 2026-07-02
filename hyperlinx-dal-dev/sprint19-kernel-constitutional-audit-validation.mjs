import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));

async function read(relativePath) {
  return readFile(path.join(root, relativePath), "utf8");
}

function includes(label, text, expected) {
  assert.ok(text.includes(expected), `${label} missing expected text: ${expected}`);
}

function order(label, text, first, second) {
  const firstIndex = text.indexOf(first);
  const secondIndex = text.indexOf(second);
  assert.ok(firstIndex >= 0, `${label} missing first marker: ${first}`);
  assert.ok(secondIndex >= 0, `${label} missing second marker: ${second}`);
  assert.ok(firstIndex < secondIndex, `${label} order violated: ${first} should precede ${second}`);
}

const audit = await read("SPRINT_19_KERNEL_CONSTITUTIONAL_AUDIT.md");
const kernelInvariant = await read("src/kernel/KernelInvariantEngine.ts");
const completionEngine = await read("src/kernel/CompletionEngine.ts");
const stateRegistry = await read("src/kernel/KernelStateRegistry.ts");
const serverCompletion = await read("server/kernel/completion-engine.js");
const twinRoute = await read("server/routes/twin-state.js");
const scopeRoute = await read("server/routes/scopeversions.js");

const checks = [];

function check(name, fn) {
  fn();
  checks.push(name);
}

check("audit:foundation-conclusion", () => {
  includes("audit", audit, "The Kernel is ready to become Hyperlinx's permanent constitutional validation and eligibility engine");
  includes("audit", audit, "Runtime owns mutable operational state. ScopeVersion owns constitutional truth.");
});

check("audit:required-deliverables", () => {
  [
    "## 1. Kernel Architecture Audit",
    "## 2. Kernel Responsibility Matrix",
    "## 3. Authority Matrix",
    "## 4. Runtime Relationship Audit",
    "## 5. ScopeVersion Audit",
    "## 6. Opportunity Interaction Matrix",
    "## 7. Design Compiler Relationship Audit",
    "## 8. Product Policy Relationship Audit",
    "## 9. Guided Operator Experience Audit",
    "## 10. Twin Audit",
    "## 11. Architectural Principles",
    "## 12. Future Kernel Roadmap",
    "## 13. Recommended Refactoring Plan",
    "## 14. Risks",
    "## 15. Technical Debt",
    "## 16. Validation Plan",
    "## 17. Sprint Recommendations",
  ].forEach((heading) => includes("audit", audit, heading));
});

check("audit:non-mutating-kernel-doctrine", () => {
  includes("audit", audit, "Kernel validates; it does not mutate.");
  includes("audit", audit, "Kernel determines eligibility; it does not certify authority.");
  includes("audit", audit, "Kernel cannot create directly.");
});

check("audit:constitutional-principles", () => {
  [
    "Opportunity is the unit of work.",
    "Runtime owns continuity.",
    "Kernel governs invariants.",
    "ScopeVersion owns constitutional truth.",
    "Products define policy.",
    "Design is compiled.",
    "Humans certify.",
    "AI advises.",
    "Twin projects.",
    "Every transition is replayable.",
  ].forEach((principle) => includes("audit", audit, principle));
});

check("audit:design-and-product-diagrams", () => {
  includes("audit", audit, "### Design Compiler Relationship Diagram");
  includes("audit", audit, "### Product Policy Relationship Diagram");
  includes("audit", audit.replace(/\r\n/g, "\n"), "Product Policy + Customer Intent + Inventory + Constraints\n  -> Design Compiler");
});

check("audit:runtime-object-matrix", () => {
  [
    "| Account | Runtime Account Library",
    "| Opportunity | Runtime Opportunity Library",
    "| CustomerIntent | Future Runtime object",
    "| DesignCandidate | Future Design Compiler artifact",
    "| SpineCommit | Future Runtime object",
    "| ScopeVersion | ScopeVersion service",
    "| TwinProjection | Twin service",
  ].forEach((row) => includes("audit", audit, row));
});

check("kernel:current-implementation-present", () => {
  includes("KernelInvariantEngine", kernelInvariant, "export function checkKernelInvariants");
  includes("CompletionEngine", completionEngine, "export function calculateCompletionProjection");
  includes("KernelStateRegistry", stateRegistry, "export function normalizeKernelState");
  includes("server completion", serverCompletion, "export function calculateCompletionProjection");
});

check("kernel:current-consumers-present", () => {
  includes("twin route", twinRoute, "calculateCompletionProjection");
  includes("scopeversions route", scopeRoute, "calculateCompletionProjection");
});

check("audit:readiness-verdict", () => {
  includes("audit", audit, "The current Kernel is sufficient as a foundation for constitutional validation, completion projection, and invariant checking.");
  includes("audit", audit, "It is not yet sufficient as the complete permanent execution engine");
});

const proof = {
  assertions: checks.length,
  checks,
  document: "SPRINT_19_KERNEL_CONSTITUTIONAL_AUDIT.md",
  doctrine: "kernel-validates-runtime-mutates-scopeversion-owns-truth",
  generatedAt: new Date().toISOString(),
};

await mkdir(path.join(root, ".tmp"), { recursive: true });
await writeFile(path.join(root, ".tmp", "sprint19-kernel-constitutional-audit-report.json"), JSON.stringify(proof, null, 2));

console.log(JSON.stringify(proof, null, 2));
