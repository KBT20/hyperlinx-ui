import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";

const root = path.dirname(fileURLToPath(import.meta.url));
const tempDir = path.join(root, ".tmp", "sprint24d1-runtime-stabilization");
const checks = [];

function read(relativePath) {
  return readFileSync(path.join(root, relativePath), "utf8");
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
  checks.push(message);
}

function toProjectPath(value) {
  return value.replace(/\\/g, "/");
}

function outPath(relativePath) {
  return path.join(tempDir, relativePath).replace(/\.tsx?$/, ".mjs");
}

function resolveRelativeImport(fromPath, specifier) {
  const base = toProjectPath(path.join(path.dirname(fromPath), specifier));
  const candidates = [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    `${base}.js`,
    `${base}.jsx`,
    toProjectPath(path.join(base, "index.ts")),
    toProjectPath(path.join(base, "index.tsx")),
  ];
  return candidates.find((candidate) => existsSync(path.join(root, candidate)));
}

const transpiledFiles = new Set();

function transpile(relativePath) {
  const normalizedPath = toProjectPath(relativePath);
  if (transpiledFiles.has(normalizedPath)) return outPath(normalizedPath);
  transpiledFiles.add(normalizedPath);
  const source = read(normalizedPath);
  for (const match of source.matchAll(/from\s+["'](\.{1,2}\/[^"']+)["']/g)) {
    const dependency = resolveRelativeImport(normalizedPath, match[1]);
    if (dependency?.endsWith(".ts") || dependency?.endsWith(".tsx")) transpile(dependency);
  }
  const output = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ES2022,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      jsx: ts.JsxEmit.ReactJSX,
      importsNotUsedAsValues: ts.ImportsNotUsedAsValues.Remove,
      esModuleInterop: true,
    },
    fileName: normalizedPath,
  }).outputText.replace(/from "(\.{1,2}\/[^"]+)";/g, (_match, specifier) => {
    return `from "${specifier.endsWith(".js") ? specifier.replace(/\.js$/, ".mjs") : `${specifier}.mjs`}";`;
  });
  const outputFile = outPath(normalizedPath);
  mkdirSync(path.dirname(outputFile), { recursive: true });
  writeFileSync(outputFile, output);
  return outputFile;
}

rmSync(tempDir, { recursive: true, force: true });
mkdirSync(tempDir, { recursive: true });

const requiredFiles = [
  "src/runtime/ConstitutionalProjectionCache.ts",
  "src/runtime/ConstitutionalAssemblyScheduler.ts",
  "src/runtime/RuntimeDiagnostics.ts",
  "src/runtime/RuntimeDebug.ts",
  "src/mapkernel/MapLayerRegistry.ts",
  "src/mapkernel/MapRenderer.ts",
  "src/components/RuntimeDiagnosticsPanel.tsx",
  "SPRINT_24D1_RUNTIME_STABILIZATION_REPORT.md",
  "CONSTITUTIONAL_FOUNDATION_V1_0.md",
  "docs/cip/CONSTITUTIONAL_FOUNDATION_V1_0.md",
  "RUNTIME_PROJECTION_CACHE_DESIGN.md",
  "ASSEMBLY_SCHEDULER_DESIGN.md",
  "WORKSPACE_RATIONALIZATION_IMPLEMENTATION.md",
  "MAP_LAYER_ARCHITECTURE.md",
  "RUNTIME_DIAGNOSTICS_GUIDE.md",
];

requiredFiles.forEach((relativePath) => {
  assert(existsSync(path.join(root, relativePath)), `${relativePath} exists.`);
});

const cacheSource = read("src/runtime/ConstitutionalProjectionCache.ts");
const schedulerSource = read("src/runtime/ConstitutionalAssemblyScheduler.ts");
const diagnosticsSource = read("src/runtime/RuntimeDiagnostics.ts");
const googleWorkspace = read("src/components/workspaces/GoogleRfpWorkspace.tsx");
const engineeringWorkspace = read("src/workspaces/EngineeringCertificationWorkspace.tsx");
const mapRendererSource = read("src/mapkernel/MapRenderer.ts");
const mapRegistrySource = read("src/mapkernel/MapLayerRegistry.ts");
const mapKernelSource = read("src/mapkernel/MapKernel.tsx");
const dalNavigationSource = read("src/dal/DALNavigation.tsx");
const dalAppSource = read("src/dal/DALApp.tsx");
const dalApiSource = read("src/config/dalApi.ts");
const scopeRendererSource = read("src/mapkernel/ScopeVersionRenderer.ts");

[
  "artifactId",
  "artifactType",
  "inputHash",
  "revision",
  "timestamp",
  "sourceDoctrineVersions",
  "dependencies",
  "generationDurationMs",
  "cacheStatus",
  "producer",
].forEach((field) => {
  assert(cacheSource.includes(field), `Projection cache records ${field}.`);
});

[
  '"ProductDoctrine"',
  '"DraftIofPackage"',
  '"EngineeringProjection"',
  '"MapLayerProjection"',
  '"SpineObjectInstantiation"',
].forEach((artifactType) => {
  assert(cacheSource.includes(artifactType), `Projection cache supports ${artifactType}.`);
});

[
  "scheduleProductDoctrineAssembly",
  "scheduleDraftIofPackageAssembly",
  "scheduleEngineeringProjection",
  "CONSTITUTIONAL_ENGINE_OWNERSHIP",
  "measureRuntime",
].forEach((symbol) => {
  assert(schedulerSource.includes(symbol), `Assembly scheduler includes ${symbol}.`);
});

[
  "assemblyExecutions",
  "cacheHits",
  "cacheMisses",
  "projectionExecutions",
  "engineeringProjectionExecutions",
  "mapRebuilds",
].forEach((counter) => {
  assert(diagnosticsSource.includes(counter), `Runtime diagnostics includes ${counter}.`);
});

assert(!googleWorkspace.includes("assembleDraftIofPackage("), "Commercial workspace does not assemble Draft IOF directly during render.");
assert(googleWorkspace.includes("scheduleDraftIofPackageAssembly"), "Commercial workspace schedules Draft IOF assembly.");
assert(googleWorkspace.includes("schedulePointToPointLongHaulDoctrineAssembly"), "Commercial workspace schedules Product Doctrine assembly.");
assert(!engineeringWorkspace.includes("buildEngineeringCertificationProjection("), "Engineering workspace does not build projections directly.");
assert(engineeringWorkspace.includes("scheduleEngineeringProjection"), "Engineering workspace consumes cached Engineering projections.");
assert(mapRendererSource.includes("buildCachedMapRenderProjection"), "Map renderer exposes cached projection builder.");
assert(mapRendererSource.includes('"MapLayerProjection"'), "Map renderer stores projections as MapLayerProjection artifacts.");
assert(mapRendererSource.includes("shouldProjectMapLayer"), "Map renderer gates hidden layers before projection.");
assert(mapKernelSource.includes("buildCachedMapRenderProjection"), "MapKernel consumes a single cached render projection.");
assert(!mapKernelSource.includes("renderMapKernelPrimitives(specs"), "MapKernel no longer runs a separate primitive pass.");
assert(mapRegistrySource.includes("CONSTITUTIONAL_MAP_LAYER_REGISTRY"), "Shared map layer registry exists.");
[
  "spineObjects",
  "stations",
  "handholes",
  "manholes",
  "vaults",
  "spliceCases",
  "ilas",
  "regens",
  "pops",
  "conduit",
  "fiber",
  "constructionSegments",
  "paymentSegments",
  "reviewObjects",
  "engineeringDeltas",
].forEach((layerId) => {
  assert(mapRegistrySource.includes(layerId), `Map layer registry includes ${layerId}.`);
});

[
  "Evidence Intake",
  "Commercial",
  "Discovery",
  "Decision",
  "Engineering",
  "Constitutional Truth",
  "Execution",
  "Operations",
  "System",
].forEach((group) => {
  assert(dalNavigationSource.includes(group), `Navigation includes ${group} group.`);
});
assert(dalAppSource.includes("lazy(() => import"), "Workspace bodies are lazy loaded.");
assert(dalAppSource.includes("<Suspense"), "Workspace outlet uses Suspense fallback.");
assert(dalAppSource.includes("RuntimeDiagnosticsPanel"), "DAL shell renders runtime diagnostics.");
assert(!dalApiSource.includes("console.log("), "DAL API startup logs are gated.");
assert(!scopeRendererSource.includes("console.log("), "ScopeVersion station render logs are gated.");
assert(scopeRendererSource.includes("runtimeDebugLog(\"[RENDER_AUTHORITY_STATIONS]\""), "Station render diagnostics remain available through debug gate.");

transpile("src/runtime/ConstitutionalProjectionCache.ts");
transpile("src/runtime/RuntimeDiagnostics.ts");
transpile("src/mapkernel/MapRenderer.ts");

const cacheModule = await import(pathToFileURL(outPath("src/runtime/ConstitutionalProjectionCache.ts")).href);
const diagnosticsModule = await import(pathToFileURL(outPath("src/runtime/RuntimeDiagnostics.ts")).href);
const mapRendererModule = await import(pathToFileURL(outPath("src/mapkernel/MapRenderer.ts")).href);

diagnosticsModule.resetRuntimeDiagnostics();
cacheModule.resetConstitutionalProjectionCache();

let instantiationExecutions = 0;
const firstInstantiation = cacheModule.getOrCreateConstitutionalArtifact({
  artifactId: "SPINE-INSTANTIATION-VALIDATION",
  artifactType: "SpineObjectInstantiation",
  input: { packageId: "PKG-1", objectCount: 2 },
  sourceDoctrineVersions: ["PD-003"],
  dependencies: ["DraftIofPackage:PKG-1"],
  producer: "sprint24d1-validation",
  create: () => {
    instantiationExecutions += 1;
    return { objectCount: 2 };
  },
});
const secondInstantiation = cacheModule.getOrCreateConstitutionalArtifact({
  artifactId: "SPINE-INSTANTIATION-VALIDATION",
  artifactType: "SpineObjectInstantiation",
  input: { objectCount: 2, packageId: "PKG-1" },
  sourceDoctrineVersions: ["PD-003"],
  dependencies: ["DraftIofPackage:PKG-1"],
  producer: "sprint24d1-validation",
  create: () => {
    instantiationExecutions += 1;
    return { objectCount: 99 };
  },
});
const changedInstantiation = cacheModule.getOrCreateConstitutionalArtifact({
  artifactId: "SPINE-INSTANTIATION-VALIDATION",
  artifactType: "SpineObjectInstantiation",
  input: { packageId: "PKG-1", objectCount: 3 },
  sourceDoctrineVersions: ["PD-003"],
  dependencies: ["DraftIofPackage:PKG-1"],
  producer: "sprint24d1-validation",
  create: () => {
    instantiationExecutions += 1;
    return { objectCount: 3 };
  },
});

assert(instantiationExecutions === 2, "Spine object instantiation is not recreated without input hash change.");
assert(firstInstantiation.inputHash === secondInstantiation.inputHash, "Stable input hash is order independent.");
assert(firstInstantiation.revision === secondInstantiation.revision, "Cached instantiation keeps revision stable on hit.");
assert(changedInstantiation.revision === 2, "Instantiation revision increments when input hash changes.");

const cacheSnapshot = diagnosticsModule.getRuntimeDiagnosticsSnapshot();
assert(cacheSnapshot.counters.cacheHits >= 1, "Projection cache records cache hits.");
assert(cacheSnapshot.counters.cacheMisses >= 2, "Projection cache records cache misses.");

diagnosticsModule.resetRuntimeDiagnostics();
cacheModule.resetConstitutionalProjectionCache();

const specs = [
  {
    specId: "MAP-SPEC-1",
    sourceType: "IOFPackage",
    sourceId: "PKG-1",
    metadata: { sourceRevision: 1, packageRevision: 1 },
    primitives: [
      {
        id: "PKG-1:route",
        layerId: "iofPackage",
        kind: "line",
        ref: { kind: "IOFPackage", id: "PKG-1" },
        coordinates: [[-97.75, 30.25], [-97.74, 30.26]],
        metadata: { sourceLayer: "iofPackage" },
      },
      {
        id: "PKG-1:station:5280",
        layerId: "station",
        kind: "point",
        ref: { kind: "Station", id: "STA-5280", stationId: "STA-5280" },
        coordinate: [-97.745, 30.255],
        metadata: { sourceLayer: "station", stationFeet: 5280 },
      },
    ],
  },
];

const hiddenStationProjection = mapRendererModule.buildCachedMapRenderProjection(specs, {
  layerVisibility: { station: false },
  stationDensityFeet: 5280,
  showStationLabels: true,
});
const hiddenStationReplay = mapRendererModule.buildCachedMapRenderProjection(specs, {
  layerVisibility: { station: false },
  stationDensityFeet: 5280,
  showStationLabels: true,
});
const visibleStationProjection = mapRendererModule.buildCachedMapRenderProjection(specs, {
  layerVisibility: { station: true },
  stationDensityFeet: 5280,
  showStationLabels: true,
});

assert(hiddenStationProjection.primitives.every((primitive) => primitive.layerId !== "station"), "Hidden station layer does not project.");
assert(hiddenStationReplay.primitives.length === hiddenStationProjection.primitives.length, "Repeated map projection returns stable primitive count.");
assert(visibleStationProjection.primitives.some((primitive) => primitive.layerId === "station"), "Visible station layer projects when enabled.");

const mapSnapshot = diagnosticsModule.getRuntimeDiagnosticsSnapshot();
assert(mapSnapshot.counters.mapRebuilds === 2, "Map layers rebuild only for distinct projection inputs.");
assert(mapSnapshot.counters.cacheHits === 1, "Repeated map projection uses cache hit.");

console.log(`Sprint 24D1 runtime stabilization validation passed (${checks.length} checks).`);
