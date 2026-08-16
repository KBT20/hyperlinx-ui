import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  assembleProductDoctrineArtifacts,
  projectProductDoctrineToStationSpine,
} from "../server/generated/product-doctrine-runtime.js";

const packageId = "DRAFT-IOF-DEMO-CIP063-BOUNDARY";
const routeRepositoryId = "ROUTE-DEMO-CIP063-BOUNDARY";
const routeFeet = 528000;
const start = [-97.1, 36.1];
const end = [-97.08, 36.1];
const geometryHash = "cip063-governed-geometry-hash";
const artifacts = assembleProductDoctrineArtifacts({
  packageId,
  proposal: {
    customerId: "CUSTOMER-DEMO-CIP063",
    productId: "POINT_TO_POINT_LONG_HAUL_CONDUIT_FIBER",
    routeMiles: 100,
    routeFeet,
    productConfiguration: {
      ductCount: 3,
      ductDiameter: 1.25,
      fiberCount: 288,
      handholeCount: 2,
      vaultCount: 1,
      spliceCaseCount: 1,
      structurePlanAuthority: "ENGINEERING",
      spliceArchitectureAuthority: "ENGINEERING",
    },
    pricingSummary: { routeMiles: 100 },
  },
  route: {
    routeRepositoryId,
    routeFeet,
    routeMiles: 100,
    commercialGeometry: [start, end],
    geometryHash,
    routeRevision: 1,
  },
});

const segment = {
  segmentId: "SEG-00001",
  startCoordinate: start,
  endCoordinate: end,
  segmentLengthFeet: routeFeet,
  cumulativeStartFeet: 0,
  cumulativeEndFeet: routeFeet,
  bearing: 90,
  geometryIndexStart: 0,
  geometryIndexEnd: 1,
};
const measures = [];
for (let measure = 0; measure < routeFeet; measure += 100) measures.push(measure);
measures.push(routeFeet);
const stations = measures.map((measureFeet, index) => {
  const ratio = measureFeet / routeFeet;
  const coordinate = [start[0] + ((end[0] - start[0]) * ratio), start[1]];
  return {
    stationId: `STA-DEMO-CIP063-${String(index).padStart(4, "0")}`,
    spineId: `${packageId}:SPINE`,
    routeId: routeRepositoryId,
    packageId,
    measureFeet,
    stationFeet: measureFeet,
    stationLabel: `${Math.floor(measureFeet / 100)}+${String(Math.round(measureFeet % 100)).padStart(2, "0")}`,
    stationIndex: index,
    coordinate,
    lat: coordinate[1],
    lng: coordinate[0],
    segmentId: segment.segmentId,
    cumulativeMeasureFeet: measureFeet,
    stationClass: "ENGINEERING",
    authority: "STATION_AUTHORITY",
    geometryHash,
  };
});
const projection = projectProductDoctrineToStationSpine({
  packageId,
  doctrineObjectManifest: artifacts.engineeringObjectManifest,
  measuredSpine: {
    spineId: `${packageId}:SPINE`, packageId, routeId: routeRepositoryId, geometryHash,
    sourceGeometryRef: routeRepositoryId, originSiteId: `${packageId}:A`, terminalSiteId: `${packageId}:Z`,
    routeLengthFeet: routeFeet, routeLengthMiles: 100, coordinateCount: 2,
    segments: [segment], cumulativeMeasureIndex: [segment], authority: "MEASURED_SPINE_AUTHORITY",
  },
  stationAuthority: {
    authorityId: `${packageId}:STATION-AUTHORITY`, packageId, spineId: `${packageId}:SPINE`,
    routeId: routeRepositoryId, geometryHash, intervalFeet: 100, stationClass: "ENGINEERING",
    stationCount: stations.length, stations, stationIndex: {}, stationToCoordinateMap: {}, authority: "STATION_AUTHORITY",
  },
  stationIndexedGraph: {
    graphId: `${packageId}:STATION-GRAPH`, packageId, spineId: `${packageId}:SPINE`, routeId: routeRepositoryId,
    geometryHash, stationCount: stations.length, edgeCount: stations.length - 1, edges: [], authority: "STATION_INDEXED_GRAPH_AUTHORITY",
  },
  routeRepositoryId,
});

assert.ok(projection.closureLedgerId);
assert.ok(projection.iofPackageTwinId);
assert.ok(projection.executionGraphId);
assert.ok(projection.lifecycleGraphId);
assert.equal(projection.commercialAuditReconciliation.status, "PASS");
assert.equal(projection.constitutionalStateValidation.status, "PASS");
assert.equal(projection.closureLedger.closureEvents.length, 0);
assert.equal(projection.closureLedger.workSegmentCount, projection.workSegments.length);
assert.equal(projection.iofPackageTwin.noScopeVersionCreation, true);
assert.ok(projection.projectedObjects.every((object) => object.currentState === "COMMERCIAL_ASSEMBLED"));
assert.ok(projection.projectedObjects.every((object) => object.auditLedgerHooks?.closureLedgerId === projection.closureLedgerId));
assert.ok(projection.projectedSpans.every((span) => span.auditLedgerHooks?.closureLedgerId === projection.closureLedgerId));

const engineeringPackagesSource = await readFile(new URL("../server/routes/engineering-packages.js", import.meta.url), "utf8");
const certificationSource = await readFile(new URL("../server/routes/engineering-certification.js", import.meta.url), "utf8");
const scopeVersionSource = await readFile(new URL("../server/scopeversion-authority-engine.js", import.meta.url), "utf8");
for (const reference of ["closureLedgerId", "iofPackageTwinId", "executionGraphId", "lifecycleGraphId"]) {
  assert.ok(engineeringPackagesSource.includes(reference), `Engineering intake must retain ${reference} validation`);
  assert.ok(certificationSource.includes(reference), `Certification must retain ${reference} validation`);
  assert.ok(scopeVersionSource.includes(reference), `ScopeVersion must retain ${reference} validation`);
}
assert.ok(engineeringPackagesSource.includes('commercialAuditStatus === "PASS"'));
assert.ok(engineeringPackagesSource.includes('constitutionalStateValidationStatus === "PASS"'));
assert.ok(certificationSource.includes('commercialAuditReconciliation.status !== "PASS"'));
assert.ok(certificationSource.includes('constitutionalStateValidation.status !== "PASS"'));

console.log(JSON.stringify({
  result: "PASS",
  packageId,
  objectCount: projection.projectedObjects.length,
  spanCount: projection.projectedSpans.length,
  workSegmentCount: projection.workSegments.length,
  references: {
    closureLedgerId: projection.closureLedgerId,
    iofPackageTwinId: projection.iofPackageTwinId,
    executionGraphId: projection.executionGraphId,
    lifecycleGraphId: projection.lifecycleGraphId,
    commercialAudit: projection.commercialAuditReconciliation.status,
    constitutionalState: projection.constitutionalStateValidation.status,
  },
  lifecycleAuthority: {
    commercialProjection: "NON_EXECUTABLE",
    certificationTwinMaterialization: "DEFERRED",
    scopeVersionExecutionAuthority: "DEFERRED",
    operationalTransitions: "DEFERRED",
  },
}, null, 2));
