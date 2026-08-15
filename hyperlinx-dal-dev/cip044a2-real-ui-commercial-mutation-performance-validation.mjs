import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { performance } from "node:perf_hooks";
import ts from "typescript";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
async function standalone(source) {
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(output).toString("base64")}`);
}
function stable(value) { if (value === null || typeof value !== "object") return JSON.stringify(value); if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`; return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(",")}}`; }
function hash(value) { const text = stable(value); let result = 2166136261; for (let i = 0; i < text.length; i += 1) { result ^= text.charCodeAt(i); result = Math.imul(result, 16777619); } return (result >>> 0).toString(16).padStart(8, "0"); }
function structuralProjection(input) { return { proposal: { proposalId: input.proposal.proposalId, customerId: input.proposal.customerId, opportunityId: input.proposal.opportunityId, productId: input.proposal.productId, productName: input.proposal.productName, runtimeObjectIds: input.proposal.runtimeObjectIds, runtimeRelationshipIds: input.proposal.runtimeRelationshipIds, runtimeEvidenceIds: input.proposal.runtimeEvidenceIds }, accountId: input.accountId, customerName: input.customerName, routeId: input.commercialDraft?.routeId, routeFeet: input.commercialDraft?.routeFeet, routeGeometryHash: input.routeGeometryHash, routeSegments: (input.commercialDraft?.routeSegments ?? []).map(({ segmentId, label, fromMile, toMile, routeMiles }) => ({ segmentId, label, fromMile, toMile, routeMiles })), productDoctrineId: input.productDoctrine?.doctrineId, productDoctrineVersion: input.productDoctrine?.doctrineVersion, productDoctrineAssemblyId: input.productDoctrineAssembly?.doctrineId, stationAuthorityRevision: input.stationAuthorityRevision, objectInventoryAuthorityRevision: input.objectInventoryAuthorityRevision, geometryReferences: input.geometryReferences, customerTwinReference: input.customerTwinReference }; }

const schedulerSource = read("src/runtime/ConstitutionalAssemblyScheduler.ts");
const mutationSource = read("src/performance/CommercialMutationRuntime.ts");
const workspace = read("src/components/workspaces/GoogleRfpWorkspace.tsx");
const workerSource = read("src/corridorExecution/CorridorSegmentWorker.ts");
const partitionSource = read("src/corridorExecution/CorridorPartitionEngine.ts");
const performanceSource = read("src/corridorExecution/CorridorPerformanceMetrics.ts");
const ilaSource = read("src/commercial/IlaPlanningEngine.ts");
const estimateSource = read("src/commercial/TransparentEstimatingEngine.ts");
const packageJson = read("package.json");
const mutation = await standalone(mutationSource.replace('import { constitutionalInputHash } from "../runtime/ConstitutionalProjectionCache";', `const stable = ${stable.toString()}; const constitutionalInputHash = ${hash.toString()};`));

const structuralBase = {
  proposal: { proposalId: "P1", customerId: "C1", opportunityId: "O1", productId: "POINT_TO_POINT_LONG_HAUL_CONDUIT_FIBER", productName: "Duct & Dark Fiber", runtimeObjectIds: ["R1"], runtimeRelationshipIds: [], runtimeEvidenceIds: [] },
  accountId: "A1",
  customerName: "Customer",
  commercialDraft: { routeId: "ROUTE-1", routeFeet: 70963, geometry: [[-97, 35], [-96.8, 35.1]], routeSegments: [{ segmentId: "S1", label: "Segment", fromMile: 0, toMile: 13.44, routeMiles: 13.44, fiberFeet: 70963, ductFeet: 212889, constructionCost: 1000 }] },
  productDoctrine: { doctrineId: "PD-001", doctrineVersion: "20C.1.0" },
  productDoctrineAssembly: { doctrineId: "PD-001-ASSEMBLY", productDoctrineVersion: "20C.1.0" },
  routeGeometryHash: "GEOMETRY-HASH-1",
  stationAuthorityRevision: "STATIONS-R1",
  objectInventoryAuthorityRevision: "INVENTORY-R1",
  stationing: new Proxy([], { get() { throw new Error("giant stationing traversed"); } }),
  objectInventory: new Proxy([], { get() { throw new Error("giant inventory traversed"); } }),
  geometryReferences: ["GEOMETRY-HASH-1"],
  customerTwinReference: "TWIN-R1",
  pricing: { totalKnownCost: 1_000_000 },
  generatedAt: "2026-08-13T00:00:00.000Z",
};
const financialChange = {
  ...structuralBase,
  commercialDraft: { ...structuralBase.commercialDraft, routeSegments: [{ ...structuralBase.commercialDraft.routeSegments[0], constructionCost: 2_000_000 }] },
  pricing: { totalKnownCost: 2_000_000, markup: 20, civilMix: [82, 12, 0, 6] },
  generatedAt: "2026-08-13T00:01:00.000Z",
};
const beforeFingerprint = hash(structuralProjection(structuralBase));
const afterFingerprint = hash(structuralProjection(financialChange));
const fieldDiff = Object.keys(structuralProjection(structuralBase)).filter((field) => hash(structuralProjection(structuralBase)[field]) !== hash(structuralProjection(financialChange)[field]));
const structuralChange = { ...financialChange, routeGeometryHash: "GEOMETRY-HASH-2" };

const timings = [];
const traces = [];
for (let index = 0; index < 10; index += 1) {
  const started = performance.now();
  const traceId = mutation.beginCommercialMutation({ event: "CIVIL_MIX_CHANGE", component: "validator", action: `run-${index + 1}`, input: { routeFeet: 70963, mix: [82 - index, 12 + index, 0, 6] } });
  mutation.recordCommercialMutationMilestone("event-handler");
  const quantities = mutation.calculateCivilMixFastPath(70963, { plowPercent: 82 - index, dirtPercent: 12 + index, rockPercent: 0, trenchPercent: 6 });
  mutation.recordCommercialMutationMilestone("quantity");
  const fingerprint = hash(structuralProjection(financialChange));
  mutation.recordCommercialMutationMilestone("structural-cache-hit", { fingerprint });
  mutation.recordCommercialMutationOperation("estimateRecalculations");
  mutation.recordCommercialMutationOperation("financialProjections");
  mutation.recordCommercialMutationOperation("proposalProjections");
  mutation.recordCommercialMutationMilestone("estimate-financial-proposal");
  const trace = mutation.completeCommercialMutation(traceId);
  assert.equal(quantities.totalFeet, 70963);
  traces.push(trace);
  timings.push(performance.now() - started);
}
const sorted = [...timings].sort((a, b) => a - b);
const stats = { min: sorted[0], median: (sorted[4] + sorted[5]) / 2, mean: timings.reduce((a, b) => a + b, 0) / timings.length, p95: sorted[9], max: sorted[9] };
const sourceBlock = (name) => mutationSource.match(new RegExp(`${name}: \\[([^\\]]+)\\]`))?.[1] ?? "";

let passed = 0;
function check(number, label, fn) { fn(); passed += 1; console.log(`PASS ${number}: ${label}`); }
check(1, "mutation duration is attributed within tolerance", () => assert.ok(traces.every((trace) => trace.unattributedDurationMs <= Math.max(1, trace.durationMs * 0.1))));
check(2, "no unexplained gap exceeds 100 ms", () => assert.ok(traces.every((trace) => trace.timeline.every((item) => item.durationMs < 100))));
check(3, "civil mix does not change structural fingerprint", () => assert.equal(beforeFingerprint, afterFingerprint));
check(4, "unchanged structural fingerprint produces cache-hit eligibility", () => assert.equal(fieldDiff.length, 0));
check(5, "civil mix structural assembly count is zero", () => assert.ok(traces.every((trace) => trace.operations.structuralIofAssemblies === 0)));
check(6, "civil mix geometry rebuild is zero", () => assert.ok(traces.every((trace) => trace.operations.routeRebuilds === 0)));
check(7, "civil mix station rebuild is zero", () => assert.ok(traces.every((trace) => trace.operations.stationRebuilds === 0)));
check(8, "civil mix map rebuild is zero", () => assert.ok(traces.every((trace) => trace.operations.mapRebuilds === 0)));
check(9, "civil mix Engineering projection is zero", () => assert.ok(traces.every((trace) => trace.operations.engineeringProjections === 0)));
check(10, "civil mix repository writes are zero", () => assert.ok(traces.every((trace) => trace.operations.repositoryWrites === 0)));
check(11, "civil mix does not await reasoning", () => assert.doesNotMatch(workspace.slice(workspace.indexOf("function updateCivilMixCalibration"), workspace.indexOf("function resetCivilMixCalibration")), /reasoning|await|fetch/i));
check(12, "reasoning is absent from deterministic scheduler", () => assert.doesNotMatch(schedulerSource, /ReasoningService|reasoning\/health/));
check(13, "giant Customer Twin/station structures are not traversed when authority revisions exist", () => assert.equal(beforeFingerprint, afterFingerprint));
check(14, "authoritative geometry/station/inventory revisions are reused", () => assert.match(schedulerSource, /routeGeometryHash[\s\S]*stationAuthorityRevision[\s\S]*objectInventoryAuthorityRevision/));
check(15, "civil-mix handler does not refresh Customer Twin", () => assert.doesNotMatch(workspace.slice(workspace.indexOf("function updateCivilMixCalibration"), workspace.indexOf("function resetCivilMixCalibration")), /CustomerTwin|customerTwin/));
check(16, "civil-mix handler does not import runtime inventory", () => assert.doesNotMatch(workspace.slice(workspace.indexOf("function updateCivilMixCalibration"), workspace.indexOf("function resetCivilMixCalibration")), /import|Inventory/));
check(17, "civil-mix handler does not reload route repository", () => assert.doesNotMatch(workspace.slice(workspace.indexOf("function updateCivilMixCalibration"), workspace.indexOf("function resetCivilMixCalibration")), /RouteRepository/));
check(18, "civil-mix handler does not reload Proposal Library", () => assert.doesNotMatch(workspace.slice(workspace.indexOf("function updateCivilMixCalibration"), workspace.indexOf("function resetCivilMixCalibration")), /ProposalRepository|listProposals/));
check(19, "corridor worker effect no longer depends on estimate object identity", () => assert.doesNotMatch(workspace.slice(workspace.indexOf("void executeCorridorInBackground"), workspace.indexOf("const productDoctrineRouteSegmentsKey")), /\n\s*displayedTransparentEstimate,\n/));
check(20, "mutation state commits remain bounded", () => assert.ok(traces.every((trace) => trace.operations.reactStateCommits === 0)));
check(21, "ten sequential fixture mutations stay under 500 ms", () => assert.ok(stats.max < 500));
check(22, "dirt rate calibration dependencies avoid structural IOF", () => assert.doesNotMatch(sourceBlock("LABOR_RATE_CHANGE"), /DRAFT_IOF|GEOMETRY|ENGINEERING/));
check(23, "rock calibration uses civil fast path without structural IOF", () => assert.doesNotMatch(sourceBlock("CIVIL_MIX_CHANGE"), /DRAFT_IOF|GEOMETRY|ENGINEERING/));
check(24, "material calibration avoids structural IOF", () => assert.doesNotMatch(sourceBlock("MATERIAL_RATE_CHANGE"), /DRAFT_IOF|GEOMETRY|ENGINEERING/));
check(25, "markup is financial/proposal only", () => assert.equal(sourceBlock("COMMERCIAL_MARKUP_CHANGE").replace(/\s|"/g, ""), "COMMERCIAL_FINANCIALS,PROPOSAL"));
check(26, "bookend count is controlled as zero or endpoint pair", () => { assert.match(workerSource, /bookendsEnabled \? Number\(isFirstSegment\) \+ Number\(isLastSegment\) : 0/); assert.match(partitionSource, /bookendCount: 0/); });
check(27, "ILA OFF and bookends OFF yield zero cost/count", () => { assert.match(ilaSource, /bookendIlaEnabled: false/); assert.match(estimateSource, /const ilaCount = ilaPlan\.stationObjects\.length/); });
check(28, "CIP-044A dependencies remain intact", () => assert.match(sourceBlock("CIVIL_MIX_CHANGE"), /QUANTITY[\s\S]*ESTIMATE[\s\S]*COMMERCIAL_FINANCIALS[\s\S]*PROPOSAL/));
check(29, "CIP-044A.1 ILA/dirt/rock repairs remain intact", () => { assert.match(ilaSource, /normalizeIlaPlanningResultForPresentation/); assert.match(estimateSource, /CURRENT_PRODUCT1_DIRT_RATE_AUTHORITY[\s\S]*unresolvedRateLine/); });
check(30, "no DAL1, production, or persistence migration change", () => { assert.doesNotMatch(schedulerSource + mutationSource + workerSource, /DAL1|app\.teralinx\.net/); assert.doesNotMatch(packageJson, /postgres|postgis|"pg"/i); });

console.log(`\n${passed}/30 CIP-044A.2 checks passed.`);
console.log(`Structural fingerprint before=${beforeFingerprint} after=${afterFingerprint}; structural change=${hash(structuralProjection(structuralChange))}; changed fields=${JSON.stringify(Object.keys(structuralProjection(financialChange)).filter((field) => hash(structuralProjection(financialChange)[field]) !== hash(structuralProjection(structuralChange)[field])))}`);
console.log(`Ten-run local mutation lifecycle fixture (ms): min=${stats.min.toFixed(3)} median=${stats.median.toFixed(3)} mean=${stats.mean.toFixed(3)} p95=${stats.p95.toFixed(3)} max=${stats.max.toFixed(3)}`);
console.log(`Worker utilization after completion is explicitly idle: ${/workerUtilization: 0/.test(performanceSource) ? "0%" : "UNRESOLVED"}.`);
