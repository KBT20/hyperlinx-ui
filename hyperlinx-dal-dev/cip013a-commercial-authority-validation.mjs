import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createScopeVersionFromCertifiedPackage } from "./server/scopeversion-authority-engine.js";

const root = path.dirname(fileURLToPath(import.meta.url));

function read(relativePath) {
  return readFileSync(path.join(root, relativePath), "utf8");
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function count(source, pattern) {
  return (source.match(new RegExp(pattern, "g")) ?? []).length;
}

const files = {
  commercialPlanning: "src/components/workspaces/GoogleRfpWorkspace.tsx",
  commercialDesign: "src/components/workspaces/DesignWorkspace.tsx",
  proposalReadiness: "src/components/workspaces/PreliminaryProposalWorkspace.tsx",
  engineeringCertification: "src/workspaces/EngineeringCertificationWorkspace.tsx",
  serviceOrderWorkspace: "src/workspaces/ServiceOrderWorkspace.tsx",
  serviceOrderRoute: "server/routes/service-orders.js",
  api: "src/api/teralinxRuntime.ts",
  shared: "server/routes/_shared.js",
  server: "server/index.js",
  dalState: "src/dal/DALState.tsx",
  dalApp: "src/dal/DALApp.tsx",
  dalNav: "src/dal/DALNavigation.tsx",
};

Object.values(files).forEach((relativePath) => {
  assert(existsSync(path.join(root, relativePath)), `${relativePath} is missing.`);
});

const commercialPlanning = read(files.commercialPlanning);
const commercialDesign = read(files.commercialDesign);
const proposalReadiness = read(files.proposalReadiness);
const engineeringCertification = read(files.engineeringCertification);
const serviceOrderWorkspace = read(files.serviceOrderWorkspace);
const serviceOrderRoute = read(files.serviceOrderRoute);
const api = read(files.api);
const shared = read(files.shared);
const server = read(files.server);
const appWiring = `${read(files.dalState)}\n${read(files.dalApp)}\n${read(files.dalNav)}`;

assert(appWiring.includes('"serviceOrder"'), "Service Order workspace must be part of DAL workspace state and shell wiring.");
assert(appWiring.includes("ServiceOrderWorkspace"), "DAL shell must lazy-load ServiceOrderWorkspace.");
assert(appWiring.includes("Preview / Future / Advanced"), "Discovery, Decision, and Network Preview must be grouped behind Preview / Future / Advanced.");
assert(appWiring.includes("collapsed: true"), "Preview / Future / Advanced navigation must be collapsed by default.");
assert(appWiring.includes("RuntimeDiagnosticsDisclosure"), "Runtime Diagnostics must be behind a collapsed disclosure.");
assert(appWiring.includes("{open ? <RuntimeDiagnosticsPanel /> : null}"), "Runtime Diagnostics should not mount until opened.");

assert(!commercialPlanning.includes("import StationAwareObjectReviewPanel"), "Commercial Planning must not import Station-Aware Object Review.");
assert(!commercialPlanning.includes("<StationAwareObjectReviewPanel"), "Commercial Planning must not render Station-Aware Object Review.");
assert(!commercialPlanning.includes("<ConstitutionalAssemblyReviewPanel"), "Commercial Planning must not mount Constitutional Assembly Review.");
assert(commercialPlanning.includes("evaluateConstitutionalAssemblyReview"), "Commercial Planning may keep the lightweight Draft IOF gate evaluation.");

assert(commercialDesign.includes("<h2>Commercial Design</h2>"), "Commercial Design workspace must be explicit.");
assert(!commercialDesign.includes("MapKernel"), "Commercial Design must not mount the Engineering map renderer.");
assert(!commercialDesign.includes("StationAwareObjectReviewPanel"), "Commercial Design must not mount station-aware engineering review.");
assert(commercialDesign.includes("Create Proposal"), "Commercial Design must expose Create Proposal action.");
assert(commercialDesign.includes("Create Draft IOF Source"), "Commercial Design must expose Create Draft IOF Source action.");

assert(proposalReadiness.includes("<h2>Proposal Readiness</h2>"), "Proposal workspace must be Proposal Readiness.");
assert(!proposalReadiness.includes("MapKernel"), "Proposal Readiness must not mount a map renderer.");
assert(!proposalReadiness.includes("StationAwareObjectReviewPanel"), "Proposal Readiness must not mount station editing.");
assert(proposalReadiness.includes("Customer Acceptance"), "Proposal Readiness must expose Customer Acceptance.");

assert(engineeringCertification.includes("<ConstitutionalAssemblyReviewPanel"), "Engineering Certification must own Constitutional Assembly Review.");
assert(engineeringCertification.includes("Station-Aware Object Review"), "Engineering Certification must own Station-Aware Object Review.");
assert(engineeringCertification.includes("Engineering Discipline Lenses"), "Engineering Certification must expose discipline lenses over the same Draft IOF.");
assert(count(engineeringCertification, "<MapKernel") === 1, "Engineering Certification must mount exactly one heavy map renderer.");
assert(engineeringCertification.includes("No duplicate engineering truth is created."), "Discipline lenses must not duplicate engineering truth.");

assert(shared.includes("serviceOrders: path.join(DATA_ROOT, \"service-orders\")"), "Runtime DIRS must include service-orders.");
assert(server.includes("handleServiceOrders"), "Runtime server must register Service Order route.");
assert(server.includes("serviceOrders: true"), "Runtime health must expose Service Orders.");
assert(api.includes("export type ServiceOrderRuntime"), "API must expose ServiceOrderRuntime.");
assert(api.includes("generateServiceOrder"), "API must expose Service Order generation.");
assert(api.includes("markServiceOrderReadyForSignature"), "API must expose ready-for-signature action.");
assert(api.includes("recordServiceOrderSignaturePlaceholder"), "API must expose signature placeholder action.");

assert(serviceOrderWorkspace.includes("Generate Service Order"), "Service Order workspace must generate Service Orders.");
assert(serviceOrderWorkspace.includes("Preview Service Order"), "Service Order workspace must preview Service Orders.");
assert(serviceOrderWorkspace.includes("Print Service Order"), "Service Order workspace must print Service Orders.");
assert(serviceOrderWorkspace.includes("Export PDF Placeholder"), "Service Order workspace must expose PDF placeholder.");
assert(serviceOrderWorkspace.includes("Mark Ready for Signature"), "Service Order workspace must mark readiness for signature.");
assert(serviceOrderWorkspace.includes("Record Signature Placeholder"), "Service Order workspace must record a placeholder only.");
assert(!serviceOrderWorkspace.includes("generateScopeVersion"), "Service Order workspace must not generate ScopeVersion.");

assert(serviceOrderRoute.includes("Accepted Proposal is required before Service Order generation."), "Service Order route must require accepted Proposal.");
assert(serviceOrderRoute.includes("Certified Draft IOF Package is required before Service Order generation."), "Service Order route must require Certified Draft IOF Package.");
assert(serviceOrderRoute.includes("Customer Acceptance is required before Service Order generation."), "Service Order route must require Customer Acceptance.");
assert(serviceOrderRoute.includes("noScopeVersionCreation: true"), "Service Order route must mark no ScopeVersion creation.");
assert(serviceOrderRoute.includes("noEngineeringRecreation: true"), "Service Order route must mark no engineering recreation.");
assert(serviceOrderRoute.includes("noEngineeringObjectsPersisted: true"), "Service Order route must not persist engineering object arrays.");
assert(serviceOrderRoute.includes("PLACEHOLDER_ONLY_NOT_EXECUTED"), "Signature placeholder must not be an executed Service Order.");
assert(!serviceOrderRoute.includes("generateScopeVersion"), "Service Order route must not call ScopeVersion generation.");
assert(!serviceOrderRoute.includes("persistScopeVersion"), "Service Order route must not persist ScopeVersion.");
assert(!serviceOrderRoute.includes("scopeversion-authority-engine"), "Service Order route must not import the ScopeVersion Authority engine.");
["Prism", "candidateSites", "networkAffinity", "siteDecision"].forEach((token) => {
  assert(!serviceOrderWorkspace.includes(token), `Product 1 Service Order workspace must not depend on ${token}.`);
  assert(!serviceOrderRoute.includes(token), `Product 1 Service Order route must not depend on ${token}.`);
});

let unsignedServiceOrderBlocked = false;
try {
  createScopeVersionFromCertifiedPackage({
    certifiedPackageId: "CERT-IOF-CIP013A-001",
    packageId: "CERT-IOF-CIP013A-001",
    sourcePackageId: "DRAFT-IOF-CIP013A-001",
    certifiedDraftIofPackageId: "DRAFT-IOF-CIP013A-001",
    status: "CERTIFIED",
    proposalId: "PROPOSAL-CIP013A-001",
    customerId: "customer-google",
    opportunityId: "OPP-CIP013A-001",
    productId: "PRODUCT-POINT-TO-POINT-DUCT-DARK-FIBER",
    productName: "Point-to-Point Duct and Dark Fiber Construction",
    certifiedAt: "2026-07-06T12:00:00.000Z",
    certifiedBy: "Engineering",
    certifiedById: "engineering-user",
    geometry: {
      type: "LineString",
      coordinates: [
        [-97.7431, 30.2672],
        [-97.7331, 30.2772],
      ],
    },
    routeFeet: 5280,
    routeMiles: 1,
    customerAcceptance: {
      customerAcceptanceId: "CUST-ACCEPT-CIP013A-001",
      acceptedProposalId: "PROPOSAL-CIP013A-001",
      status: "ACCEPTED",
      acceptedAt: "2026-07-06T12:10:00.000Z",
    },
    serviceOrder: {
      serviceOrderId: "SOF-CIP013A-001",
      customerAcceptanceId: "CUST-ACCEPT-CIP013A-001",
      status: "SIGNATURE_READY_SERVICE_ORDER",
      signatureStatus: "READY_FOR_SIGNATURE",
      createdAt: "2026-07-06T12:20:00.000Z",
    },
    certifiedIofUnits: [],
    runtimeObjectIds: [],
    runtimeRelationshipIds: [],
    runtimeEvidenceIds: [],
  });
} catch (error) {
  unsignedServiceOrderBlocked = String(error?.message ?? error).includes("signed Service Order");
}
assert(unsignedServiceOrderBlocked, "ScopeVersion promotion must remain blocked until executed/signed Service Order evidence exists.");

console.log("CIP-013A Commercial Authority UI decomposition validation passed.");
