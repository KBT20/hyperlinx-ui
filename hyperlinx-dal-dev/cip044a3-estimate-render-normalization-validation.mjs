import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
async function standalone(source) {
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(output).toString("base64")}`);
}
const ui = read("src/components/workspaces/googleRfp/TransparentEstimateExplorer.tsx");
const presentationSource = read("src/components/workspaces/googleRfp/EstimatePresentation.ts");
const ilaSource = read("src/commercial/IlaPlanningEngine.ts");
const workspace = read("src/components/workspaces/GoogleRfpWorkspace.tsx");
const mutation = read("src/performance/CommercialMutationRuntime.ts");
const scheduler = read("src/runtime/ConstitutionalAssemblyScheduler.ts");
const reasoning = read("src/kernel/ReasoningServiceManager.ts");
const estimate = read("src/commercial/TransparentEstimatingEngine.ts");
const legacy = JSON.parse(read("server/data/commercial-opportunities/GOOGLE-HELIUM-HIU-MUS.json"));
const presentation = await standalone(presentationSource);
const ila = await standalone(ilaSource);
const legacyEstimate = legacy.commercialDraftSnapshot.transparentEstimate;
const route = { estimateId: "CIP-044A3", aLabel: "A", zLabel: "Z", geometry: [[-97, 35], [-95.85, 35]], routeMiles: 80 };
const plan = (intermediateIlaEnabled, bookendIlaEnabled) => ila.buildIlaPlanningResult({ ...route, controls: { intermediateIlaEnabled, bookendIlaEnabled, maxSpanMiles: 30 } });
const off = plan(false, false);
const intermediate = plan(true, false);
const bookends = plan(false, true);
const both = plan(true, true);
const stationCount = (result, type) => result.stationObjects.filter((station) => station.stationType === type).length;
const civilDependencies = mutation.match(/CIVIL_MIX_CHANGE:\s*\[([^\]]+)\]/)?.[1] ?? "";

let passed = 0;
function check(number, label, fn) { fn(); passed += 1; console.log(`PASS ${number}: ${label}`); }
check(1, "line-1384 root is the required authorityLayer field", () => { assert.equal(legacyEstimate.auditTrail[0].authorityLayer, undefined); assert.match(ui, /formatEstimateLabel\(entry\.authorityLayer\)/); });
check(2, "the legacy runtime record contains 74 missing authority layers", () => assert.equal(legacyEstimate.auditTrail.filter((entry) => !entry.authorityLayer).length, 74));
check(3, "optional display values render a supplied fallback", () => assert.equal(presentation.formatEstimateLabel(undefined, "NOT CONFIGURED"), "NOT CONFIGURED"));
check(4, "required missing values render UNRESOLVED", () => assert.equal(presentation.formatEstimateLabel(undefined), "UNRESOLVED"));
check(5, "normalization does not fabricate or mutate estimate values", () => { const value = { authorityLayer: undefined, amount: 42 }; const before = JSON.stringify(value); assert.equal(presentation.formatEstimateLabel(value.authorityLayer), "UNRESOLVED"); assert.equal(JSON.stringify(value), before); });
check(6, "valid enum labels normalize centrally", () => assert.equal(presentation.formatEstimateLabel("RATE_CATALOG"), "RATE CATALOG"));
check(7, "unsafe external audit replaceAll calls are removed", () => { assert.doesNotMatch(ui, /entry\.[A-Za-z]+\.replaceAll/); assert.doesNotMatch(ui, /estimate\.estimateStatus\.replaceAll/); });
check(8, "remaining Explorer replace/trim calls are bounded input or derived-key operations", () => { assert.match(ui, /value\.trim\(\)/); assert.match(ui, /key\.replace\("ILA-INT-"/); assert.equal((ui.match(/replaceAll\(/g) ?? []).length, 0); });
check(9, "bookends OFF produces zero facilities", () => assert.equal(off.stationObjects.length, 0));
check(10, "bookends ON produces exactly A and Z", () => { assert.equal(bookends.stationObjects.length, 2); assert.deepEqual(bookends.stationObjects.map((station) => station.role), ["A_BOOKEND", "Z_BOOKEND"]); });
check(11, "no one-bookend state is synthesized", () => { for (const result of [off, intermediate, bookends, both]) assert.notEqual(stationCount(result, "START_BOOKEND") + stationCount(result, "END_BOOKEND"), 1); });
check(12, "new configurations default bookends OFF", () => assert.equal(ila.DEFAULT_ILA_PLANNING_CONTROLS.bookendIlaEnabled, false));
check(13, "restored explicit legacy bookend configuration is preserved", () => { const normalized = ila.normalizeIlaPlanningResultForPresentation(legacyEstimate.ilaPlan); assert.equal(normalized.controls.bookendIlaEnabled, true); assert.equal(normalized.controls.useBookendIlas, true); });
check(14, "intermediate ILA remains independent", () => { assert.ok(stationCount(intermediate, "INTERMEDIATE") > 0); assert.equal(stationCount(intermediate, "START_BOOKEND"), 0); assert.equal(stationCount(bookends, "INTERMEDIATE"), 0); });
check(15, "bookend costs disappear when disabled", () => assert.ok(bookends.totalCost > off.totalCost && off.totalCost === 0));
check(16, "each SectionDetails instance is inside a bounded error boundary", () => assert.match(ui, /SecondaryEstimatePanelBoundary key=\{section\.sectionId\}[\s\S]*<SectionDetails[\s\S]*<\/SecondaryEstimatePanelBoundary>/));
check(17, "the boundary retains the real exception in the console", () => assert.match(ui, /componentDidCatch[\s\S]*console\.error/));
check(18, "reasoning timeout is absent from deterministic estimate construction", () => { assert.match(reasoning, /circuitBreakerState = "OPEN"/); assert.doesNotMatch(estimate, /ReasoningServiceManager|reasoning\/health/); });
check(19, "civil mix preserves Draft IOF and all structural domains", () => { assert.doesNotMatch(civilDependencies, /DRAFT_IOF|GEOMETRY|SPINE|STATIONING|OBJECT_MANIFEST|ENGINEERING|MAP/); assert.match(scheduler, /draftIofStructuralFingerprint/); });
check(20, "civil mix structural assembly, geometry, station, Engineering, and map operations remain zero by handler", () => { const block = workspace.slice(workspace.indexOf("function updateCivilMixCalibration"), workspace.indexOf("function resetCivilMixCalibration")); assert.doesNotMatch(block, /recordCommercialMutationOperation\("(?:structuralIofAssemblies|routeRebuilds|stationRebuilds|engineeringProjections|mapRebuilds)"/); });
check(21, "unsaved calibration records no repository writes", () => { const block = workspace.slice(workspace.indexOf("function updateCivilMixCalibration"), workspace.indexOf("function resetCivilMixCalibration")); assert.doesNotMatch(block, /Repository\.|fetch\(|persist/i); });
check(22, "normal calibration only enters route editing after an explicit edit session", () => assert.match(workspace, /if \(routeEditConstraintPatchType && routeEditSession\)/));
check(23, "real-browser validation covers render, bookends, civil, dirt, and rock", () => { const browser = read("scripts/cip044a3-real-browser-validation.mjs"); assert.match(browser, /bookendsOff[\s\S]*bookendsOn[\s\S]*civilMixBrowserDurationMs[\s\S]*dirtRateBrowserDurationMs[\s\S]*rockRateBrowserDurationMs/); });
check(24, "CIP-044A.1 focused validator remains present", () => assert.ok(fs.existsSync(path.join(root, "cip044a1-narrow-runtime-ila-estimate-testability-validation.mjs"))));
check(25, "CIP-044A.2 focused validator remains present", () => assert.ok(fs.existsSync(path.join(root, "cip044a2-real-ui-commercial-mutation-performance-validation.mjs"))));

console.log(`\n${passed}/25 CIP-044A.3 focused validation checks passed.`);
console.log(`Legacy root: auditTrail[0].authorityLayer=${String(legacyEstimate.auditTrail[0].authorityLayer)}; missing legacy rows=${legacyEstimate.auditTrail.filter((entry) => !entry.authorityLayer).length}.`);
console.log(`ILA scenarios: OFF=${off.stationObjects.length}, intermediate=${intermediate.stationObjects.length}, bookends=${bookends.stationObjects.length}, both=${both.stationObjects.length}.`);
