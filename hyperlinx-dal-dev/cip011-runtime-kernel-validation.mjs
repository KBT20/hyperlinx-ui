import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";

const root = path.dirname(fileURLToPath(import.meta.url));
const tempDir = path.join(root, ".tmp", "cip011-runtime-kernel-validation");
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
  for (const match of source.matchAll(/(?:from|import)\s+["'](\.{1,2}\/[^"']+)["']/g)) {
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
  }).replace(/import\("(\.{1,2}\/[^"]+)"\)/g, (_match, specifier) => {
    return `import("${specifier.endsWith(".js") ? specifier.replace(/\.js$/, ".mjs") : `${specifier}.mjs`}")`;
  });
  const outputFile = outPath(normalizedPath);
  mkdirSync(path.dirname(outputFile), { recursive: true });
  writeFileSync(outputFile, output);
  return outputFile;
}

function collectSourceFiles(relativeDir) {
  const absoluteDir = path.join(root, relativeDir);
  if (!existsSync(absoluteDir)) return [];
  return readdirSync(absoluteDir).flatMap((entry) => {
    const absolute = path.join(absoluteDir, entry);
    const relative = toProjectPath(path.join(relativeDir, entry));
    if (statSync(absolute).isDirectory()) return collectSourceFiles(relative);
    return /\.(ts|tsx)$/.test(entry) ? [relative] : [];
  });
}

rmSync(tempDir, { recursive: true, force: true });
mkdirSync(tempDir, { recursive: true });

const requiredFiles = [
  "src/runtime/ConstitutionalRuntimeKernel.ts",
  "src/runtime/ArtifactRegistry.ts",
  "src/runtime/ArtifactDependencyGraph.ts",
  "src/runtime/ProjectionCache.ts",
  "src/runtime/AssemblyScheduler.ts",
  "src/runtime/ArtifactRevisionManager.ts",
  "src/runtime/ArtifactLineageEngine.ts",
  "src/runtime/RuntimeDiagnostics.ts",
  "src/runtime/RuntimeContracts.ts",
  "docs/runtime/CONSTITUTIONAL_RUNTIME_KERNEL.md",
  "docs/runtime/ARTIFACT_REGISTRY.md",
  "docs/runtime/ARTIFACT_LINEAGE.md",
  "docs/runtime/PROJECTION_CACHE.md",
  "docs/runtime/ASSEMBLY_SCHEDULER.md",
  "docs/runtime/DEPENDENCY_GRAPH.md",
  "docs/runtime/RUNTIME_DIAGNOSTICS.md",
  "docs/runtime/CONSTITUTIONAL_RUNTIME_ARCHITECTURE.md",
  "CIP_011_CONSTITUTIONAL_RUNTIME_KERNEL_REPORT.md",
];

requiredFiles.forEach((relativePath) => {
  assert(existsSync(path.join(root, relativePath)), `${relativePath} exists.`);
});

const kernelSource = read("src/runtime/ConstitutionalRuntimeKernel.ts");
const registrySource = read("src/runtime/ArtifactRegistry.ts");
const cacheSource = read("src/runtime/ConstitutionalProjectionCache.ts");
const schedulerSource = read("src/runtime/ConstitutionalAssemblyScheduler.ts");
const dependencySource = read("src/runtime/ArtifactDependencyGraph.ts");
const lineageSource = read("src/runtime/ArtifactLineageEngine.ts");
const revisionSource = read("src/runtime/ArtifactRevisionManager.ts");
const mapRendererSource = read("src/mapkernel/MapRenderer.ts");

[
  "requestArtifact",
  "invalidateArtifactGraph",
  "getArtifactLineage",
  "getDependencyGraph",
  "getDiagnostics",
].forEach((symbol) => {
  assert(kernelSource.includes(symbol), `Runtime Kernel exposes ${symbol}.`);
});

[
  "artifactId",
  "artifactType",
  "revision",
  "inputHash",
  "timestamp",
  "producer",
  "dependencies",
  "producedFrom",
  "doctrineVersions",
  "generationDurationMs",
  "cacheStatus",
  "validationStatus",
].forEach((field) => {
  assert(cacheSource.includes(field), `Artifact records include ${field}.`);
});

assert(registrySource.includes("registerRuntimeArtifact"), "Artifact Registry registers runtime artifacts.");
assert(dependencySource.includes("resolveDependencyInvalidationOrder"), "Dependency graph resolves invalidation order.");
assert(lineageSource.includes("recordArtifactLineage"), "Lineage engine records artifact lineage.");
assert(revisionSource.includes("nextArtifactRevision"), "Revision manager increments revisions.");
assert(schedulerSource.includes("ConstitutionalRuntimeKernel.requestArtifact"), "Specialized assembly scheduler routes through Runtime Kernel.");
assert(schedulerSource.includes("schedulePointToPointLongHaulDoctrineAssembly"), "Point-to-point Product Doctrine assembly is scheduler-owned.");
assert(mapRendererSource.includes("ConstitutionalRuntimeKernel.requestArtifact"), "Map projection routes through Runtime Kernel.");

const workspaceFiles = [
  ...collectSourceFiles("src/workspaces"),
  ...collectSourceFiles("src/components/workspaces"),
];
const forbiddenWorkspaceCalls = [
  "assembleDraftIofPackage(",
  "assemblePointToPointLongHaulDoctrine(",
  "createObjectAddressing(",
  "createPD003ProductionArtifacts(",
  "instantiateSpineObjects(",
  "buildKernelExecutionGraph(",
  "buildEngineeringCertificationProjection(",
];

workspaceFiles.forEach((relativePath) => {
  const source = read(relativePath);
  forbiddenWorkspaceCalls.forEach((pattern) => {
    assert(!source.includes(pattern), `${relativePath} does not directly create constitutional artifacts with ${pattern}.`);
  });
});

transpile("src/runtime/ConstitutionalRuntimeKernel.ts");
transpile("src/runtime/ConstitutionalProjectionCache.ts");
transpile("src/runtime/RuntimeDiagnostics.ts");
transpile("src/mapkernel/MapRenderer.ts");

const { ConstitutionalRuntimeKernel } = await import(pathToFileURL(outPath("src/runtime/ConstitutionalRuntimeKernel.ts")).href);
const cacheModule = await import(pathToFileURL(outPath("src/runtime/ConstitutionalProjectionCache.ts")).href);
const diagnosticsModule = await import(pathToFileURL(outPath("src/runtime/RuntimeDiagnostics.ts")).href);
const mapRendererModule = await import(pathToFileURL(outPath("src/mapkernel/MapRenderer.ts")).href);

diagnosticsModule.resetRuntimeDiagnostics();
cacheModule.resetConstitutionalProjectionCache();

let reuseExecutions = 0;
const reuseFirst = ConstitutionalRuntimeKernel.requestArtifact({
  artifactId: "ART-REUSE-001",
  artifactType: "ProductDoctrine",
  input: { route: "A-Z", version: 1 },
  doctrineVersions: ["PD-001:v8"],
  producer: "cip011-validation",
  create: () => {
    reuseExecutions += 1;
    return { status: "CREATED" };
  },
});
const reuseHit = ConstitutionalRuntimeKernel.requestArtifact({
  artifactId: "ART-REUSE-001",
  artifactType: "ProductDoctrine",
  input: { version: 1, route: "A-Z" },
  doctrineVersions: ["PD-001:v8"],
  producer: "cip011-validation",
  create: () => {
    reuseExecutions += 1;
    return { status: "SHOULD_NOT_RUN" };
  },
});
const reuseChanged = ConstitutionalRuntimeKernel.requestArtifact({
  artifactId: "ART-REUSE-001",
  artifactType: "ProductDoctrine",
  input: { route: "A-Z", version: 2 },
  doctrineVersions: ["PD-001:v8"],
  producer: "cip011-validation",
  create: () => {
    reuseExecutions += 1;
    return { status: "CHANGED" };
  },
});

assert(reuseExecutions === 2, "Artifacts are reused without regeneration when inputs are unchanged.");
assert(reuseFirst.revision === reuseHit.revision, "Cache hits preserve revision.");
assert(reuseChanged.revision === reuseFirst.revision + 1, "Revisions increment when input hash changes.");
assert(reuseHit.cacheStatus === "HIT", "Unchanged input returns cache hit.");

const product = ConstitutionalRuntimeKernel.requestArtifact({
  artifactId: "ART-PRODUCT-001",
  artifactType: "ProductDoctrine",
  input: { product: "P2P", doctrine: "PD-001" },
  doctrineVersions: ["PD-001:v8"],
  producer: "cip011-validation",
  create: () => ({ productDoctrine: true }),
});
const audit = ConstitutionalRuntimeKernel.requestArtifact({
  artifactId: "ART-AUDIT-001",
  artifactType: "CommercialAuditProjection",
  input: { audit: "commercial", productRevision: product.revision },
  doctrineVersions: ["PD-001:v8"],
  producedFrom: [{ artifactType: product.artifactType, artifactId: product.artifactId, revision: product.revision, inputHash: product.inputHash }],
  producer: "cip011-validation",
  create: () => ({ audit: true }),
});
const manifest = ConstitutionalRuntimeKernel.requestArtifact({
  artifactId: "ART-MANIFEST-001",
  artifactType: "AuditObjectManifest",
  input: { manifest: "objects", auditRevision: audit.revision },
  doctrineVersions: ["PD-002A:v1"],
  producedFrom: [{ artifactType: audit.artifactType, artifactId: audit.artifactId, revision: audit.revision, inputHash: audit.inputHash }],
  producer: "cip011-validation",
  create: () => ({ manifest: true }),
});
const draft = ConstitutionalRuntimeKernel.requestArtifact({
  artifactId: "ART-DRAFTIOF-001",
  artifactType: "DraftIofPackage",
  input: { draft: "iof", productRevision: product.revision, auditRevision: audit.revision, manifestRevision: manifest.revision },
  doctrineVersions: ["PD-001:v8", "PD-002A:v1", "PD-003:v4"],
  producedFrom: [
    { artifactType: product.artifactType, artifactId: product.artifactId, revision: product.revision, inputHash: product.inputHash },
    { artifactType: audit.artifactType, artifactId: audit.artifactId, revision: audit.revision, inputHash: audit.inputHash },
    { artifactType: manifest.artifactType, artifactId: manifest.artifactId, revision: manifest.revision, inputHash: manifest.inputHash },
  ],
  producer: "cip011-validation",
  create: () => ({ draft: true }),
});

const draftLineage = ConstitutionalRuntimeKernel.getArtifactLineage("DraftIofPackage", "ART-DRAFTIOF-001");
assert(draftLineage.length === 3, "Lineage is preserved for Draft IOF Package.");
assert(draftLineage.some((reference) => reference.artifactId === "ART-PRODUCT-001"), "Draft lineage includes Product Doctrine.");
assert(draftLineage.some((reference) => reference.artifactId === "ART-AUDIT-001"), "Draft lineage includes Commercial Audit.");
assert(draftLineage.some((reference) => reference.artifactId === "ART-MANIFEST-001"), "Draft lineage includes Audit Object Manifest.");

const invalidationOrder = ConstitutionalRuntimeKernel.invalidateArtifactGraph("ProductDoctrine", "ART-PRODUCT-001");
assert(invalidationOrder[0] === "ProductDoctrine:ART-PRODUCT-001", "Dependency invalidation starts with changed artifact.");
assert(invalidationOrder.indexOf("CommercialAuditProjection:ART-AUDIT-001") > invalidationOrder.indexOf("ProductDoctrine:ART-PRODUCT-001"), "Commercial Audit invalidates after Product Doctrine.");
assert(invalidationOrder.indexOf("AuditObjectManifest:ART-MANIFEST-001") > invalidationOrder.indexOf("CommercialAuditProjection:ART-AUDIT-001"), "Audit Manifest invalidates after Commercial Audit.");
assert(invalidationOrder.indexOf("DraftIofPackage:ART-DRAFTIOF-001") > invalidationOrder.indexOf("AuditObjectManifest:ART-MANIFEST-001"), "Draft IOF invalidates after Audit Manifest.");
assert(!ConstitutionalRuntimeKernel.readArtifact("DraftIofPackage", "ART-DRAFTIOF-001"), "Invalidated dependent artifact is removed from cache.");

const productAfterInvalidation = ConstitutionalRuntimeKernel.requestArtifact({
  artifactId: "ART-PRODUCT-001",
  artifactType: "ProductDoctrine",
  input: { product: "P2P", doctrine: "PD-001" },
  doctrineVersions: ["PD-001:v8"],
  producer: "cip011-validation",
  create: () => ({ productDoctrine: true }),
});
assert(productAfterInvalidation.revision === product.revision + 1, "Immutable artifact identity receives a new revision after invalidation.");

const specs = [
  {
    specId: "MAP-SPEC-1",
    sourceType: "IOFPackage",
    sourceId: "ART-DRAFTIOF-001",
    metadata: { sourceRevision: draft.revision, packageRevision: draft.revision },
    primitives: [
      {
        id: "ART-DRAFTIOF-001:route",
        layerId: "iofPackage",
        kind: "line",
        ref: { kind: "IOFPackage", id: "ART-DRAFTIOF-001" },
        coordinates: [[-97.75, 30.25], [-97.74, 30.26]],
        metadata: { sourceLayer: "iofPackage" },
      },
      {
        id: "ART-DRAFTIOF-001:station",
        layerId: "station",
        kind: "point",
        ref: { kind: "Station", id: "STA-1", stationId: "STA-1" },
        coordinate: [-97.745, 30.255],
        metadata: { sourceLayer: "station", stationFeet: 5280 },
      },
    ],
  },
];

diagnosticsModule.resetRuntimeDiagnostics();
const hiddenProjection = mapRendererModule.buildCachedMapRenderProjection(specs, { layerVisibility: { station: false } });
const hiddenProjectionReplay = mapRendererModule.buildCachedMapRenderProjection(specs, { layerVisibility: { station: false } });
const visibleProjection = mapRendererModule.buildCachedMapRenderProjection(specs, { layerVisibility: { station: true } });

assert(hiddenProjection.primitives.every((primitive) => primitive.layerId !== "station"), "Hidden map layers do not project.");
assert(hiddenProjectionReplay.primitives.length === hiddenProjection.primitives.length, "Map layer replay returns stable cached projection.");
assert(visibleProjection.primitives.some((primitive) => primitive.layerId === "station"), "Visible map layers project when enabled.");

const diagnostics = diagnosticsModule.getRuntimeDiagnosticsSnapshot();
assert(diagnostics.counters.cacheHits >= 1, "Runtime diagnostics record cache hits.");
assert(diagnostics.counters.cacheMisses >= 2, "Runtime diagnostics record cache misses.");
assert(diagnostics.counters.mapRebuilds === 2, "Map layers rebuild only for distinct inputs.");

console.log(`CIP-011 runtime kernel validation passed (${checks.length} checks).`);

