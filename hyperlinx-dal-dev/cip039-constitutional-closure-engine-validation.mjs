import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const root = process.cwd().endsWith("hyperlinx-dal-dev")
  ? process.cwd()
  : path.join(process.cwd(), "hyperlinx-dal-dev");

const paths = {
  stateRegistry: path.join(root, "src", "state", "StateRegistry.ts"),
  domainProjection: path.join(root, "src", "state", "DomainProjectionEngine.ts"),
  closureLedger: path.join(root, "src", "state", "ClosureLedger.ts"),
  closureEngine: path.join(root, "src", "state", "ClosureEngine.ts"),
  closureReplay: path.join(root, "src", "state", "ClosureReplayEngine.ts"),
  objectTransition: path.join(root, "src", "state", "ObjectTransitionEngine.ts"),
  commercialMap: path.join(root, "src", "components", "workspaces", "proposednetwork", "ProposedNetworkMapPanel.tsx"),
  engineeringProjection: path.join(root, "src", "engineering", "EngineeringCertificationProjection.ts"),
  doctrineProjection: path.join(root, "src", "products", "DoctrineProjectionEngine.ts"),
  scopeVersionAuthority: path.join(root, "server", "scopeversion-authority-engine.js"),
};

for (const filePath of Object.values(paths)) {
  if (!existsSync(filePath)) {
    console.error(`FAIL missing required file: ${path.relative(root, filePath)}`);
    process.exit(1);
  }
}

const sources = Object.fromEntries(
  Object.entries(paths).map(([key, filePath]) => [key, readFileSync(filePath, "utf8")]),
);

const checks = [];

function check(name, condition, detail = "") {
  checks.push({ name, condition: Boolean(condition), detail });
}

function includesAll(source, terms) {
  return terms.every((term) => source.includes(term));
}

function walkFiles(dir) {
  const entries = readdirSync(dir);
  return entries.flatMap((entry) => {
    const filePath = path.join(dir, entry);
    const stat = statSync(filePath);
    if (stat.isDirectory()) {
      if (["node_modules", "dist", "dist-dal", ".git"].includes(entry)) return [];
      return walkFiles(filePath);
    }
    return filePath;
  });
}

const sourceFiles = [
  ...walkFiles(path.join(root, "src")),
  ...walkFiles(path.join(root, "server")),
].filter((filePath) => /\.(ts|tsx|js|mjs)$/.test(filePath));

const directTransitionCalls = sourceFiles
  .filter((filePath) => !filePath.endsWith(path.join("src", "state", "ObjectTransitionEngine.ts")))
  .flatMap((filePath) => {
    const source = readFileSync(filePath, "utf8");
    return source.includes("transitionObjectState(") ? [path.relative(root, filePath)] : [];
  });

const newStateServices = [
  sources.stateRegistry,
  sources.domainProjection,
  sources.closureLedger,
  sources.closureEngine,
  sources.closureReplay,
].join("\n");
const newStateServiceImports = newStateServices
  .split(/\r?\n/)
  .filter((line) => line.trim().startsWith("import "))
  .join("\n");

check("State Registry defines the constitutional state authority model", includesAll(sources.stateRegistry, [
  "export const STATE_REGISTRY_AUTHORITY = \"STATE_REGISTRY\"",
  "export type ConstitutionalStateDefinition",
  "stateId",
  "domain",
  "authority",
  "visibleLens",
  "allowedTransitions",
  "requiredEvidence",
  "requiredDiagnostics",
  "requiredAuditChecks",
  "nextStates",
  "blockingStates",
  "renderStyle",
  "icon",
  "color",
  "hoverTemplate",
  "CONSTITUTIONAL_STATE_REGISTRY",
]));

check("State Registry covers Commercial through Twin lifecycle states", includesAll(sources.stateRegistry, [
  "CUSTOMER_ACCEPTED",
  "SUBMITTED_TO_ENGINEERING",
  "ENGINEERING_CERTIFIED",
  "SERVICE_ORDER_CREATED",
  "CUSTOMER_SIGNED",
  "SCOPEVERSION_CREATED",
  "MARKETPLACE_RELEASED",
  "CONTROL_RELEASED",
  "FIELD_CLOSED",
  "TWIN_SYNCHRONIZED",
  "OPERATIONAL",
]));

check("Domain Projection derives workspace behavior solely from current state", includesAll(sources.domainProjection, [
  "export const DOMAIN_PROJECTION_AUTHORITY = \"DOMAIN_PROJECTION_ENGINE\"",
  "deriveDomainProjection",
  "stateDefinitionFor(currentState)",
  "currentDomain: definition.domain",
  "currentAuthority: definition.authority",
  "visibleActions",
  "visibleDiagnostics",
  "visibleAuditChecks",
  "visibleToolbarActions",
  "visibleCloseActions",
  "derivedFromStateOnly: true",
  "noStoredCurrentDomain: true",
]) && !sources.domainProjection.includes("workspace ===") && !sources.domainProjection.includes("window."));

check("Closure Ledger records immutable replayable closure events", includesAll(sources.closureLedger, [
  "export const CONSTITUTIONAL_CLOSURE_LEDGER_AUTHORITY = \"CLOSURE_LEDGER\"",
  "closureId",
  "timestamp",
  "objectId",
  "spanId",
  "closureSegmentId",
  "fromState",
  "toState",
  "domain",
  "authority",
  "actor",
  "evidence",
  "geometryAuthorityId",
  "scopeVersionId",
  "reason",
  "auditHash",
  "immutable: true",
  "appendOnly: true",
  "replayable: true",
  "appendClosureEvent",
  "validateClosureLedgerImmutability",
]));

check("Closure Engine is the state mutation authority and validates transitions", includesAll(sources.closureEngine, [
  "export const CLOSURE_ENGINE_AUTHORITY = \"CLOSURE_ENGINE\"",
  "export function submitClosure",
  "allowedTransitions.includes(input.requestedState)",
  "requestedDefinition.authority === input.authority",
  "required evidence missing",
  "blockedDependencies",
  "appendClosureEvent",
  "advancedEntity",
  "deriveDomainProjection(input.requestedState)",
  "twinRefresh",
  "operationalIntelligenceRefresh",
  "stateMutationAuthority: CLOSURE_ENGINE_AUTHORITY",
]));

check("Closure Replay reconstructs the IOF Package Twin from assembly graph plus ledger", includesAll(sources.closureReplay, [
  "export const CLOSURE_REPLAY_AUTHORITY = \"CLOSURE_REPLAY_ENGINE\"",
  "Assembly Graph + Closure Ledger",
  "closureEventsForEntity",
  "deriveObjectDomainProjection",
  "currentStateByEntity",
  "domainProjectionByEntity",
  "iofPackageTwin",
  "noStoredCurrentDomain: true",
  "noMutableWorkspaceState: true",
  "export const reconstructIofPackageTwin = replayClosureLedger",
]));

check("ObjectTransitionEngine metadata now points future state advancement to ClosureEngine", includesAll(sources.objectTransition, [
  "export const CLOSURE_ENGINE_AUTHORITY = \"CLOSURE_ENGINE\"",
  "transitionAuthority: CLOSURE_ENGINE_AUTHORITY",
  "stateAuthority: CLOSURE_ENGINE_AUTHORITY",
  "Legacy compatibility path from CIP-038",
]));

check("No active source calls legacy transitionObjectState outside its compatibility module", directTransitionCalls.length === 0, directTransitionCalls.join(", "));

check("Commercial projection hover derives domain from DomainProjectionEngine", includesAll(sources.commercialMap, [
  "deriveObjectDomainProjection",
  "commercialIofStateProjection",
  "commercialIofNextAuthority",
  "Domain Responsibility",
  "commercialIofStateProjection(commercialIofHover.object).currentDomain",
  "commercialIofStateProjection(commercialIofHover.span).currentDomain",
]) && !sources.commercialMap.includes("domainResponsibilityMatrix?.["));

check("Engineering projection derives object owner from DomainProjectionEngine", includesAll(sources.engineeringProjection, [
  "deriveObjectDomainProjection",
  "const stateProjection = deriveObjectDomainProjection(record)",
  "currentAuthority: asString(record.currentAuthority, stateProjection.currentAuthority)",
  "domainOwner: stateProjection.currentDomain",
]));

check("ScopeVersion authority remains unchanged by state service implementation", !sources.scopeVersionAuthority.includes("ClosureEngine") &&
  !sources.scopeVersionAuthority.includes("submitClosure") &&
  sources.scopeVersionAuthority.includes("Product doctrine snapshot is required."));

check("New state services do not import restricted doctrine, geometry, pricing, or domain authorities", !/ProductDoctrine|DoctrineProjectionEngine|MeasuredSpineRenderer|ProjectedSpanRenderer|pricing|Marketplace|ControlWorkspace|FieldWorkspace|scopeversion-authority-engine/.test(newStateServiceImports));

check("Closure Engine can advance ScopeVersion only through validated closure state", includesAll(sources.stateRegistry, [
  "CUSTOMER_SIGNED: [\"ScopeVersion creation evidence\"]",
  "Submit ScopeVersion Closure",
]) && includesAll(sources.closureEngine, [
  "requestedDefinition.authority",
  "scopeVersionId",
  "geometryAuthorityId",
]));

const failed = checks.filter((item) => !item.condition);

for (const item of checks) {
  console.log(`${item.condition ? "PASS" : "FAIL"} ${item.name}${item.detail ? ` - ${item.detail}` : ""}`);
}

if (failed.length) {
  console.error(`\n${failed.length} CIP-039 validation check(s) failed.`);
  process.exit(1);
}

console.log("\nCIP-039 Constitutional Closure Engine validation passed.");
