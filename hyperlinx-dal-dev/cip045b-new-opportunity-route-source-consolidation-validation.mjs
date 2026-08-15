import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const workspace = read("src/components/workspaces/GoogleRfpWorkspace.tsx");
const endpointSource = read("src/commercial/CommercialRouteEndpointAuthority.ts");
const repository = read("src/repositories/commercialRepositories.ts");
const asyncImport = read("src/performance/AsyncCustomerDesignImport.ts");
const importModel = read("src/translate/CustomerDesignImport.ts");
const proposalServer = read("server/routes/proposal-drafts.js");
const assemblyScheduler = read("src/runtime/ConstitutionalAssemblyScheduler.ts");
const endpointModule = await import(`data:text/javascript;base64,${Buffer.from(ts.transpileModule(endpointSource, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText).toString("base64")}`);

const sourceGeometry = [[-97.038903, 36.1719], [-97.0, 36.2], [-96.95, 36.25]];
const sourceCopy = structuredClone(sourceGeometry);
const authority = endpointModule.deriveImportedRouteEndpointAuthority({
  sourceGeometry,
  sourceFileHash: "f".repeat(64),
  sourceGeometryId: "IMPORT-1:ROUTE-1",
  routeRevision: 3,
  geometryHash: "g".repeat(64),
});
const reversed = endpointModule.reverseImportedRouteEndpointAuthority(authority);
const oriented = endpointModule.orientedImportedRouteGeometry(sourceGeometry, reversed.orientation);
const enriched = endpointModule.enrichImportedEndpointSite(authority.aSite, {
  siteName: "Stillwater",
  customerSiteId: "SITE-001",
  address: "100 Main Street",
  city: "Stillwater",
  state: "OK",
  facilityType: "Data Center",
  notes: "Customer entrance",
});

const checks = [
  ["New Opportunity exposes a single Route Source control", () => assert.match(workspace, /Route Source/)],
  ["Create or Draw Route is a route-source choice", () => assert.match(workspace, /Create \/ Draw Route/)],
  ["Import Route File is a route-source choice", () => assert.match(workspace, /Import Route File/)],
  ["Existing Route is a route-source choice", () => assert.match(workspace, /Existing Route/)],
  ["route repository formally recognizes existing-route reuse", () => assert.match(repository, /EXISTING_ROUTE/)],
  ["import uses the established repository parser", () => assert.match(workspace, /ImportRepository\.parseRouteImport/)],
  ["supported file input includes KMZ", () => assert.match(workspace, /\.kmz/)],
  ["supported file input includes KML", () => assert.match(workspace, /\.kml/)],
  ["supported file input includes GeoJSON", () => assert.match(workspace, /\.geojson/)],
  ["supported file input includes CSV", () => assert.match(workspace, /\.csv/)],
  ["file hashing is asynchronous", () => assert.match(asyncImport, /crypto\.subtle\.digest/)],
  ["file hash is SHA-256", () => assert.match(asyncImport, /SHA-256/)],
  ["import model carries source file hash", () => assert.match(importModel, /sourceFileHash\?: string/)],
  ["import model carries parser version", () => assert.match(importModel, /parserVersion\?: string/)],
  ["a valid single centerline derives endpoint authority", () => assert.equal(authority.orientation, "SOURCE_START_TO_END")],
  ["source start becomes candidate A", () => assert.deepEqual(authority.aSite.coordinate, sourceGeometry[0])],
  ["source end becomes candidate Z", () => assert.deepEqual(authority.zSite.coordinate, sourceGeometry.at(-1))],
  ["candidate A is marked imported-route sourced", () => assert.equal(authority.aSite.coordinateSource, "IMPORTED_ROUTE")],
  ["candidate Z is marked imported-route sourced", () => assert.equal(authority.zSite.coordinateSource, "IMPORTED_ROUTE")],
  ["candidate A retains source file hash", () => assert.equal(authority.aSite.sourceFileHash, "f".repeat(64))],
  ["candidate Z retains source file hash", () => assert.equal(authority.zSite.sourceFileHash, "f".repeat(64))],
  ["candidate A retains source geometry ID", () => assert.equal(authority.aSite.sourceGeometryId, "IMPORT-1:ROUTE-1")],
  ["candidate Z retains route revision", () => assert.equal(authority.zSite.routeRevision, 3)],
  ["candidate endpoints retain geometry hash", () => assert.equal(authority.aSite.geometryHash, "g".repeat(64))],
  ["original source orientation is explicit", () => assert.equal(authority.originalSourceOrientation, "START_TO_END")],
  ["reverse changes the commercial orientation", () => assert.equal(reversed.orientation, "SOURCE_END_TO_START")],
  ["reverse assigns source end to A", () => assert.deepEqual(reversed.aSite.coordinate, sourceGeometry.at(-1))],
  ["reverse assigns source start to Z", () => assert.deepEqual(reversed.zSite.coordinate, sourceGeometry[0])],
  ["reverse retains original start evidence", () => assert.deepEqual(reversed.sourceStartCoordinate, sourceGeometry[0])],
  ["reverse retains original end evidence", () => assert.deepEqual(reversed.sourceEndCoordinate, sourceGeometry.at(-1))],
  ["reverse does not mutate caller geometry", () => assert.deepEqual(sourceGeometry, sourceCopy)],
  ["governed reversed geometry begins at commercial A", () => assert.deepEqual(oriented[0], sourceGeometry.at(-1))],
  ["governed reversed geometry ends at commercial Z", () => assert.deepEqual(oriented.at(-1), sourceGeometry[0])],
  ["orientation helper returns a new array", () => assert.notEqual(oriented, sourceGeometry)],
  ["site enrichment stores site name", () => assert.equal(enriched.siteName, "Stillwater")],
  ["site enrichment stores customer site ID", () => assert.equal(enriched.customerSiteId, "SITE-001")],
  ["site enrichment stores address", () => assert.equal(enriched.address, "100 Main Street")],
  ["site enrichment stores city and state", () => assert.deepEqual([enriched.city, enriched.state], ["Stillwater", "OK"])],
  ["site enrichment stores facility type", () => assert.equal(enriched.facilityType, "Data Center")],
  ["site enrichment stores notes", () => assert.equal(enriched.notes, "Customer entrance")],
  ["site enrichment cannot change coordinates", () => assert.deepEqual(enriched.coordinate, authority.aSite.coordinate)],
  ["site enrichment returns a defensive coordinate copy", () => assert.notEqual(enriched.coordinate, authority.aSite.coordinate)],
  ["exact coordinates compare as MATCH", () => assert.equal(endpointModule.compareEndpointCoordinate(sourceGeometry[0], sourceGeometry[0]).relationship, "MATCH")],
  ["nearby coordinates compare as NEAR", () => assert.equal(endpointModule.compareEndpointCoordinate(sourceGeometry[0], [-97.038, 36.1719]).relationship, "NEAR")],
  ["distant coordinates compare as MISMATCH", () => assert.equal(endpointModule.compareEndpointCoordinate(sourceGeometry[0], [-96, 35]).relationship, "MISMATCH")],
  ["missing coordinates compare as UNRESOLVED", () => assert.equal(endpointModule.compareEndpointCoordinate(null, sourceGeometry[0]).relationship, "UNRESOLVED")],
  ["multiple candidate lines are staged before derivation", () => assert.match(workspace, /routeCandidates\.length > 1[\s\S]*setPendingRouteImport\(\{ \.\.\.imported, activeRouteId: undefined, previewGeometry: \[\] \}\)/)],
  ["multiple candidate lines do not stage the first route", () => assert.doesNotMatch(workspace.match(/if \(routeCandidates\.length > 1\)[\s\S]*?return;/)?.[0] ?? "", /stageSelectedImportedRoute/)],
  ["candidate selector explicitly stages the chosen route", () => assert.match(workspace, /stageSelectedImportedRoute\(pendingRouteImport, event\.currentTarget\.value\)/)],
  ["unrelated non-line objects cannot become endpoint candidates", () => assert.match(workspace, /route\.dalGeometry\.length > 1/)],
  ["single candidate is staged automatically", () => assert.match(workspace, /stageSelectedImportedRoute\(imported, routeCandidates\[0\]\.routeId\)/)],
  ["import does not require A/Z pre-entry", () => assert.doesNotMatch(workspace.match(/async function handleRouteImportFile[\s\S]*?function handleImportExistingNetwork/)?.[0] ?? "", /azOriginLocation\s*&&\s*azDestinationLocation/)],
  ["empty A/Z are populated from imported endpoints", () => assert.match(workspace, /if \(!azOriginLocation && !azDestinationLocation\)[\s\S]*setAzOriginLocation[\s\S]*setAzDestinationLocation/)],
  ["existing A/Z are not automatically replaced", () => assert.match(workspace, /if \(!azOriginLocation && !azDestinationLocation\) \{[\s\S]*setAzOriginLocation[\s\S]*setAzDestinationLocation[\s\S]*\}/)],
  ["existing A/Z replacement requires confirmation", () => assert.match(workspace, /importedEndpointsNeedConfirmation/)],
  ["replacement confirmation is an explicit UI action", () => assert.match(workspace, /Confirm Imported A\/Z Coordinates/)],
  ["UI exposes Accept Start as A", () => assert.match(workspace, />Accept Start as A</)],
  ["UI exposes Reverse A/Z", () => assert.match(workspace, />Reverse A \/ Z</)],
  ["UI exposes endpoint relationship state", () => assert.match(workspace, /importedAEndpointComparison\?\.relationship/)],
  ["UI exposes endpoint source hash", () => assert.match(workspace, /Source Hash/)],
  ["UI exposes endpoint route revision", () => assert.match(workspace, /Route Revision/)],
  ["UI exposes endpoint geometry hash", () => assert.match(workspace, /Geometry Hash/)],
  ["route repository persists endpoint authority", () => assert.match(repository, /endpointAuthority\?: ImportedRouteEndpointAuthority/)],
  ["route repository persists source file hash", () => assert.match(repository, /sourceFileHash\?: string/)],
  ["route repository persists source geometry ID", () => assert.match(repository, /sourceGeometryId\?: string/)],
  ["route repository persists route revision", () => assert.match(repository, /routeRevision\?: number/)],
  ["route replacement records parent route repository", () => assert.match(repository, /parentRouteRepositoryId\?: string/)],
  ["existing route selection creates a new repository identity", () => assert.match(workspace, /routeRepositoryIdForOpportunity\(opportunityId, `\$\{source\.routeId\}-revision-\$\{routeRevision\}`\)/)],
  ["existing route selection records parent identity", () => assert.match(workspace, /parentRouteRepositoryId: source\.routeRepositoryId/)],
  ["existing route selection does not mutate the source record", () => assert.match(workspace, /routeSnapshotWithIntegrity\(\{[\s\S]*\.\.\.source,[\s\S]*routeRepositoryId,/)],
  ["opportunity stores route revision", () => assert.match(workspace, /routeRevision: routeRepositorySnapshot\?\.routeRevision/)],
  ["opportunity stores geometry hash", () => assert.match(workspace, /geometryHash: routeRepositorySnapshot\?\.geometryHash/)],
  ["opportunity stores A endpoint site authority", () => assert.match(workspace, /aSite: routeRepositorySnapshot\?\.endpointAuthority\?\.aSite/)],
  ["opportunity stores Z endpoint site authority", () => assert.match(workspace, /zSite: routeRepositorySnapshot\?\.endpointAuthority\?\.zSite/)],
  ["proposal binds route repository ID", () => assert.match(workspace, /routeRepositoryId: proposalRouteAuthority\?\.routeRepositoryId/)],
  ["proposal binds route revision", () => assert.match(workspace, /routeRevision: proposalRouteAuthority\?\.routeRevision/)],
  ["proposal binds route geometry ID", () => assert.match(workspace, /routeGeometryId: proposalRouteAuthority\?\.routeGeometryId/)],
  ["proposal binds route geometry hash", () => assert.match(workspace, /routeGeometryHash: proposalRouteAuthority\?\.geometryHash/)],
  ["proposal snapshot allowlist retains route revision", () => assert.match(proposalServer, /"routeRevision"/)],
  ["proposal snapshot allowlist retains geometry hash", () => assert.match(proposalServer, /"routeGeometryHash"/)],
  ["proposal snapshot allowlist retains A/Z sites", () => assert.match(proposalServer, /"aSite", "zSite"/)],
  ["Product Doctrine consumes the accepted financial route geometry", () => assert.match(workspace, /const centerline = activeFinancialDraft\?\.geometry/)],
  ["Product Doctrine receives Commercial Route Repository authority", () => assert.match(workspace, /"COMMERCIAL_ROUTE_REPOSITORY" as const/)],
  ["Product Doctrine receives exact route revision", () => assert.match(workspace, /routeRevision: String\(activeCommercialOpportunity\?\.routeRevision/)],
  ["Product Doctrine receives exact route hash", () => assert.match(workspace, /routeHash: activeCommercialOpportunity\?\.geometryHash/)],
  ["the shared assembly scheduler fingerprints route revision", () => assert.match(assemblyScheduler, /routeRevision: authoritativeRoute\?\.routeRevision/)],
  ["the shared assembly scheduler fingerprints route hash", () => assert.match(assemblyScheduler, /routeHash: authoritativeRoute\?\.routeHash/)],
  ["the shared assembly scheduler receives station interval", () => assert.match(assemblyScheduler, /stationIntervalFeet: input\.stationIntervalFeet/)],
];

assert.ok(checks.length >= 60, "CIP-045B requires at least 60 focused checks.");
let passed = 0;
checks.forEach(([label, run], index) => {
  run();
  passed += 1;
  console.log(`PASS ${index + 1}: ${label}`);
});
console.log(`\n${passed}/${checks.length} CIP-045B validations passed.`);
