import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";

const root = path.dirname(fileURLToPath(import.meta.url));
const tempDir = path.join(root, ".tmp", "constitutional-layer-integrity-validation");

function read(relativePath) {
  return readFileSync(path.join(root, relativePath), "utf8");
}

function outPath(relativePath) {
  return path.join(tempDir, relativePath).replace(/\.tsx?$/, ".mjs");
}

function toProjectPath(value) {
  return value.replace(/\\/g, "/");
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

transpile("src/scopeversion/ConstitutionalLayerIntegrity.ts");
transpile("src/scopeversion/ScopeVersionTransitionAuthorityEngine.ts");

const integrityModule = await import(pathToFileURL(outPath("src/scopeversion/ConstitutionalLayerIntegrity.ts")).href);
const transitionModule = await import(pathToFileURL(outPath("src/scopeversion/ScopeVersionTransitionAuthorityEngine.ts")).href);

function executionScope(overrides = {}) {
  const timestamp = "2026-07-04T00:00:00.000Z";
  return {
    scopeVersionId: "SV-LAYER-INTEGRITY-001",
    type: "SCOPEVERSION_AUTHORITY",
    source: "CertifiedIofPackage",
    status: "CERTIFIED",
    certificationState: "CERTIFIED",
    certifiedIofPackageId: "CERT-LAYER-INTEGRITY-001",
    orderForExecution: true,
    createdAt: timestamp,
    updatedAt: timestamp,
    createdBy: "validation",
    decisionTimestamp: timestamp,
    canonicalTruth: {
      lifecycleState: "CERTIFIED",
      constitutionalAuthority: "SCOPEVERSION_FROM_CERTIFIED_DRAFT_IOF_PACKAGE",
      authority: "SCOPEVERSION_ORDER_FOR_EXECUTION",
      canonicalDefinition: "ScopeVersion is the Order for Execution.",
      orderForExecution: true,
      downstreamExecutionRequiresScopeVersion: true,
      objects: [{ objectId: "OBJ-IN-SCOPE", objectState: "PLANNED", objectType: "DUCT", stationId: "STA-001" }],
      stations: [{ stationId: "STA-001", stationState: "PLANNED", routeId: "ROUTE-001", coordinate: [-97.7, 30.2], measureFeet: 0 }],
      ...overrides.canonicalTruth,
    },
    events: [],
    ...overrides,
  };
}

function codes(result) {
  return result.blockers.map((blocker) => blocker.code);
}

let result = integrityModule.validateConstitutionalLayerIntegrity({ scopeVersion: executionScope() });
assert.equal(result.allowed, false);
assert.ok(codes(result).includes("MISSING_CUSTOMER_ACCEPTANCE_AUTHORITY"));
assert.ok(codes(result).includes("SCOPEVERSION_WITHOUT_SERVICE_ORDER"));

result = integrityModule.validateConstitutionalLayerIntegrity({
  scopeVersion: executionScope({
    canonicalTruth: {
      customerAcceptanceId: "CUST-ACCEPT-001",
      customerAcceptance: { customerAcceptanceId: "CUST-ACCEPT-001", status: "ACCEPTED" },
    },
  }),
});
assert.ok(codes(result).includes("CUSTOMER_ACCEPTANCE_DIRECT_EXECUTION_TRUTH"));

result = integrityModule.validateConstitutionalLayerIntegrity({
  scopeVersion: executionScope({
    canonicalTruth: {
      customerAcceptanceId: "CUST-ACCEPT-001",
      serviceOrderId: "SO-001",
      customerAcceptance: { customerAcceptanceId: "CUST-ACCEPT-001", status: "ACCEPTED" },
      serviceOrder: { serviceOrderId: "SO-001", status: "AUTHORIZED" },
    },
  }),
});
assert.equal(result.allowed, false);
assert.ok(codes(result).includes("SCOPEVERSION_WITHOUT_SIGNED_SERVICE_ORDER"));

result = integrityModule.validateConstitutionalLayerIntegrity({
  scopeVersion: executionScope({
    canonicalTruth: {
      customerAcceptanceId: "CUST-ACCEPT-001",
      serviceOrderId: "SO-001",
      serviceOrderSignatureId: "SO-SIG-001",
      customerAcceptance: { customerAcceptanceId: "CUST-ACCEPT-001", status: "ACCEPTED" },
      serviceOrder: { serviceOrderId: "SO-001", status: "SIGNED", signedAt: "2026-07-04T00:00:30.000Z" },
    },
  }),
});
assert.equal(result.allowed, true);

result = integrityModule.validateConstitutionalLayerIntegrity({
  scopeVersion: executionScope({
    canonicalTruth: {
      customerAcceptanceId: "CUST-ACCEPT-001",
      serviceOrderId: "SO-001",
      serviceOrderSignatureId: "SO-SIG-001",
      customerAcceptance: { customerAcceptanceId: "CUST-ACCEPT-001", status: "ACCEPTED" },
      serviceOrder: { serviceOrderId: "SO-001", status: "SIGNED", signedAt: "2026-07-04T00:00:30.000Z" },
    },
  }),
  closures: [{
    closureId: "CLOSE-OUTSIDE-SCOPE",
    scopeVersionId: "SV-LAYER-INTEGRITY-001",
    objectIds: ["OBJ-NOT-IN-SCOPE"],
    closureType: "OBJECT_STATE_TRANSITION",
    authority: "FIELD",
    createdAt: "2026-07-04T00:01:00.000Z",
  }],
});
assert.ok(codes(result).includes("FIELD_CLOSE_OUTSIDE_SCOPEVERSION"));

result = integrityModule.validateConstitutionalLayerIntegrity({
  scopeVersion: executionScope({
    canonicalTruth: {
      customerAcceptanceId: "CUST-ACCEPT-001",
      serviceOrderId: "SO-001",
      serviceOrderSignatureId: "SO-SIG-001",
      customerAcceptance: { customerAcceptanceId: "CUST-ACCEPT-001", status: "ACCEPTED" },
      serviceOrder: { serviceOrderId: "SO-001", status: "SIGNED", signedAt: "2026-07-04T00:00:30.000Z" },
      paymentSegments: [{ paymentSegmentId: "PAY-001", paymentEligible: true }],
    },
  }),
});
assert.ok(codes(result).includes("PAYMENT_ELIGIBLE_WITHOUT_VALIDATED_CLOSE"));

result = integrityModule.validateConstitutionalLayerIntegrity({
  scopeVersion: executionScope({
    canonicalTruth: {
      customerAcceptanceId: "CUST-ACCEPT-001",
      serviceOrderId: "SO-001",
      serviceOrderSignatureId: "SO-SIG-001",
      customerAcceptance: { customerAcceptanceId: "CUST-ACCEPT-001", status: "ACCEPTED" },
      serviceOrder: { serviceOrderId: "SO-001", status: "SIGNED", signedAt: "2026-07-04T00:00:30.000Z" },
      paymentSegments: [{ paymentSegmentId: "PAY-001", paymentEligible: true }],
    },
  }),
  closeEvents: [{
    closeId: "CLOSE-VALIDATED-PAYMENT",
    scopeVersionId: "SV-LAYER-INTEGRITY-001",
    customerId: "CUSTOMER-001",
    opportunityId: "OPP-001",
    corridorId: "CORRIDOR-001",
    closeType: "COMPLETION_CLOSE",
    authority: {},
    actorId: "ops-001",
    actorRole: "TERALINX_OPERATIONS",
    evidenceIds: ["EV-CLOSE"],
    inputReferences: [],
    constraintReferences: [],
    outcome: { status: "ACCEPTED" },
    createdAt: "2026-07-04T00:02:00.000Z",
    validatedAt: "2026-07-04T00:03:00.000Z",
    immutable: true,
  }],
});
assert.equal(result.allowed, true);

let transition = transitionModule.evaluateTransition({
  scopeVersionId: "SV-LAYER-INTEGRITY-001",
  previousState: "CONTRACT_EXECUTED",
  requestedState: "CONTROL_READY",
  actorId: "ops-001",
  actorRole: "TERALINX_OPERATIONS",
  closes: [],
});
assert.equal(transition.approved, false);
assert.ok(transition.diagnostics.some((diagnostic) => diagnostic.message.includes("NO LAYER SKIP")));

transition = transitionModule.evaluateTransition({
  scopeVersionId: "SV-LAYER-INTEGRITY-001",
  previousState: "CONTRACT_EXECUTED",
  requestedState: "SERVICE_ORDER",
  actorId: "ops-001",
  actorRole: "TERALINX_OPERATIONS",
  closes: [],
});
assert.equal(transition.approved, false);
assert.ok(transition.missingCloseTypes.includes("SERVICE_ORDER_CLOSE"));

console.log("Constitutional Layer Integrity validation passed.");
