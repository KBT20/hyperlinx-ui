import { readFileSync } from "node:fs";

function read(path) {
  return readFileSync(path, "utf8");
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function includesAll(source, tokens, label) {
  const missing = tokens.filter((token) => !source.includes(token));
  assert(!missing.length, `${label} missing: ${missing.join(", ")}`);
}

const doie = read("src/products/DoctrineObjectInstantiationEngine.ts");
const commercialIof = read("server/routes/commercial-iof-packages.js");
const engineeringPackages = read("server/routes/engineering-packages.js");
const engineeringProjection = read("src/engineering/EngineeringCertificationProjection.ts");
const spineCatalog = read("src/components/engineering/SpineObjectCatalogPanel.tsx");
const engineeringCertification = read("server/routes/engineering-certification.js");

includesAll(doie, [
  "export interface DoctrineInstantiatedObject",
  "doctrineObjectType: string",
  "stationAddress: string",
  "stationSequence: number",
  "geographicCoordinate: DALCoordinate",
  "parentSpanId: string",
  "parentRouteId: string",
  "executionSequenceId: string",
  "closeSequenceId: string",
  "paymentSequenceId: string",
  "dependencyList: string[]",
  "doctrineQuantitySource: string",
  "currentLifecycleState: \"PLANNED\"",
  "engineeringAuthority: typeof DOCTRINE_OBJECT_INSTANTIATION_AUTHORITY",
], "Doctrine instantiated object contract");

includesAll(doie, [
  "doctrineQuantitySource",
  "geographicCoordinate",
  "parentSpanId: args.target.segmentId",
  "parentRouteId: args.routeId",
  "executionSequenceId:",
  "closeSequenceId:",
  "paymentSequenceId:",
  "dependencyList: dependencyIds",
], "Doctrine Object Instantiation Engine materialization");

includesAll(commercialIof, [
  "function requireDoctrineObjectMaterializationForStationProjection",
  "Doctrine Object Manifest is required before Engineering submission",
  "doctrineInstantiatedObjectsFromDraftPackage",
  "doctrineObjectManifestId",
  "doctrineObjectManifestObjectCount",
  "doctrineQuantityScheduleCount",
  "doctrineMaterializedObjectCount",
  "quantityScheduleMatches",
  "materializationAuthority: \"DOCTRINE_OBJECT_INSTANTIATION_ENGINE\"",
  "stationObjectManifest count does not match doctrine quantity schedule",
], "Draft IOF station projection manifest authority");

assert(
  !commercialIof.includes("function sourceObjectsForStationProjection"),
  "Commercial station projection still has legacy mixed source object fallback.",
);

includesAll(engineeringPackages, [
  "\"doctrineObjectManifestId\"",
  "\"engineeringObjectManifestId\"",
  "\"doctrineMaterializedObjectCount\"",
  "\"stationObjectManifestCount\"",
  "\"doctrineQuantityScheduleCount\"",
  "doctrineObjectManifest:",
  "engineeringObjectManifest:",
  "doctrineMaterializedObjectCount:",
  "stationObjectManifestCount:",
  "doctrineQuantityScheduleCount:",
], "Engineering Package reference-only manifest metadata");

includesAll(engineeringProjection, [
  "function doctrineInstantiatedObjectsFromPackage",
  "doctrineObjectManifest.instantiatedObjects",
  "Projection Validation missing required property",
  "return []",
  "packageSource: \"Doctrine Object Manifest\"",
  "record.geographicCoordinate",
  "record.parentSpanId",
  "record.dependencyList",
  "record.currentLifecycleState",
], "Engineering Certification projection manifest source");

const normalizeObjectsStart = engineeringProjection.indexOf("function normalizeObjects");
const normalizeObjectsEnd = engineeringProjection.indexOf("function normalizeConstraint", normalizeObjectsStart);
const normalizeObjectsBlock = engineeringProjection.slice(normalizeObjectsStart, normalizeObjectsEnd);
assert(
  !normalizeObjectsBlock.includes("draft.proposedIofUnits"),
  "Engineering object projection still falls back to proposed IOF units instead of waiting for Doctrine Object Manifest.",
);

includesAll(spineCatalog, [
  "looseDraft.doctrineObjectManifest",
  "doctrineInstantiatedObjects",
  "Instantiated Doctrine Objects",
  "object.geographicCoordinate",
  "object.parentSpanId",
  "object.engineeringAuthority",
  "manifestEntries = doctrineInstantiatedObjects.length ? []",
], "Spine Object Catalog materialized object display");

includesAll(engineeringCertification, [
  "doctrineObjectManifest",
  "doctrineObjectValidation",
  "doctrineStationObjectIndex",
  "doctrineDerivedSpans",
  "doctrineLinearAssetSpanAttachments",
  "Doctrine Object Manifest is required before Engineering certification.",
  "Doctrine quantity placement, station sequencing, span derivation, and linear asset attachments are required before Engineering certification.",
  "Doctrine station sequencing validation failed",
], "Engineering certification manifest blocking");

console.log("CIP-033A Doctrine Manifest Materialization Validation: PASS");
