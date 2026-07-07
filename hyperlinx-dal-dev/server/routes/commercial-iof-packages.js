import { createHash } from "node:crypto";
import {
  DIRS,
  deleteRecord,
  errorResponse,
  handleOptions,
  jsonResponse,
  listRecords,
  loadRecord,
  nowIso,
  persistRecord,
  readRequestJson,
  readRequestJsonWithRaw,
  sortedByUpdated,
  unwrapBody,
} from "./_shared.js";
import { userFromBearerToken, userHasPermission } from "./auth.js";
import {
  ENGINEERING_TRANSACTION_STEPS,
  appendEngineeringTransactionStep,
  buildEngineeringPackageFromDraftPackage,
  loadEngineeringPackage,
  persistEngineeringPackage,
  throwEngineeringTransactionError,
} from "./engineering-packages.js";

function stableIdPart(value, fallback = "UNKNOWN") {
  return String(value ?? fallback)
    .replace(/[^A-Za-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120) || fallback;
}

function uniqueStrings(values) {
  const seen = new Set();
  const result = [];
  for (const value of values.flatMap((entry) => Array.isArray(entry) ? entry : [entry])) {
    const text = String(value ?? "").trim();
    if (!text || seen.has(text)) continue;
    seen.add(text);
    result.push(text);
  }
  return result;
}

const REQUIRED_STATION_OBJECT_TYPES = new Set([
  "ILA",
  "ILA_FACILITY",
  "REGEN",
  "REGENERATION",
  "REGENERATION_FACILITY",
  "HUT",
  "HANDHOLE",
  "VAULT",
  "SPLICE_CASE",
  "PULL_POINT",
  "MARKER",
]);

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function nonEmptyArray(value, fallback = []) {
  return Array.isArray(value) && value.length ? value : fallback;
}

function asRecord(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function firstText(...values) {
  for (const value of values) {
    const text = String(value ?? "").trim();
    if (text) return text;
  }
  return "";
}

function serializedByteSize(value) {
  return Buffer.byteLength(JSON.stringify(value), "utf8");
}

const PROPOSAL_STATUS_COMMERCIAL_APPROVED = "COMMERCIAL_APPROVED";
const PROPOSAL_STATUS_ENGINEERING_SUBMITTED = "ENGINEERING_SUBMITTED";

function canonicalProposalRepositoryStatus(status) {
  const text = String(status ?? "").trim();
  if (text === "CUSTOMER_APPROVED") return PROPOSAL_STATUS_COMMERCIAL_APPROVED;
  if (text === "SUBMITTED_TO_ENGINEERING") return PROPOSAL_STATUS_ENGINEERING_SUBMITTED;
  if (text === "READY_FOR_IOF_PACKAGE") return PROPOSAL_STATUS_COMMERCIAL_APPROVED;
  return text;
}

function draftPackageSubmitSummary(draftPackage, engineeringPackage) {
  return {
    packageId: draftPackage.packageId,
    draftPackageId: draftPackage.draftPackageId ?? draftPackage.packageId,
    status: draftPackage.status,
    workflowStatus: draftPackage.workflowStatus,
    lifecycleState: draftPackage.lifecycleState,
    engineeringStatus: draftPackage.engineeringStatus,
    engineeringReadiness: draftPackage.engineeringReadiness,
    commercialRevisionLocked: Boolean(draftPackage.commercialRevisionLocked),
    opportunityId: draftPackage.opportunityId,
    customerId: draftPackage.customerId,
    customerTwinId: engineeringPackage.customerTwinId,
    routeRepositoryId: engineeringPackage.routeRepositoryId,
    proposalId: engineeringPackage.proposalId,
    commercialWorkbookId: engineeringPackage.commercialWorkbookId,
    workbookId: engineeringPackage.workbookId,
    estimateId: engineeringPackage.estimateId,
    measuredCenterlineId: engineeringPackage.measuredCenterlineId,
    stationGraphId: engineeringPackage.stationGraphId,
    stationAuthorityIds: engineeringPackage.stationAuthorityIds,
    stationObjectManifestId: engineeringPackage.stationObjectManifestId,
    projectedObjectManifestId: engineeringPackage.projectedObjectManifestId,
    productDoctrineId: engineeringPackage.productDoctrineId,
    engineeringPackageId: engineeringPackage.engineeringPackageId,
    engineeringPackage,
    submittedAt: engineeringPackage.submittedAt,
    updatedAt: draftPackage.updatedAt,
    noScopeVersionCreation: true,
  };
}

function commercialOpportunitySubmitSummary(opportunity, engineeringPackage) {
  if (!opportunity) return null;
  return {
    opportunityId: opportunity.opportunityId,
    status: opportunity.status,
    commercialStatus: opportunity.commercialStatus,
    commercialLifecycleStatus: opportunity.commercialLifecycleStatus,
    engineeringStatus: opportunity.engineeringStatus,
    engineeringPackageId: engineeringPackage.engineeringPackageId,
    draftIofPackageId: engineeringPackage.draftIOFPackageId,
    routeRepositoryId: engineeringPackage.routeRepositoryId,
    proposalId: engineeringPackage.proposalId,
    commercialWorkbookId: engineeringPackage.commercialWorkbookId,
    estimateId: engineeringPackage.estimateId,
    engineeringHandoff: opportunity.engineeringHandoff,
    updatedAt: opportunity.updatedAt,
  };
}

function commercialObjectId(record, packageId, index) {
  return String(record.objectId ?? record.unitId ?? record.structureId ?? record.id ?? record.runtimeObjectId ?? `${packageId}:COMMERCIAL-OBJECT:${String(index + 1).padStart(4, "0")}`);
}

function commercialObjectType(record) {
  const metadata = asRecord(record.metadata);
  return String(metadata.structureType ?? record.structureType ?? record.unitType ?? record.objectType ?? record.type ?? "OBJECT").toUpperCase();
}

function deterministicHash(value, prefix = "hash") {
  return `${prefix}-${createHash("sha256").update(JSON.stringify(value ?? null)).digest("hex").slice(0, 12)}`;
}

function coordinateFrom(value) {
  if (Array.isArray(value) && value.length >= 2) {
    const first = Number(value[0]);
    const second = Number(value[1]);
    if (Number.isFinite(first) && Number.isFinite(second)) {
      const lonLatValid = Math.abs(first) <= 180 && Math.abs(second) <= 90;
      const latLonValid = Math.abs(first) <= 90 && Math.abs(second) <= 180;
      if (lonLatValid) return [first, second];
      if (latLonValid) return [second, first];
    }
  }
  const record = asRecord(value);
  const nested = record.coordinate ?? record.coordinates ?? record.location ?? record.point;
  if (nested !== undefined && nested !== value) {
    const coordinate = coordinateFrom(nested);
    if (coordinate) return coordinate;
  }
  const lon = Number(record.lon ?? record.lng ?? record.longitude ?? record.x);
  const lat = Number(record.lat ?? record.latitude ?? record.y);
  return Number.isFinite(lon) && Number.isFinite(lat) ? [lon, lat] : null;
}

function normalizeCoordinateList(value) {
  if (!Array.isArray(value)) return [];
  if (value.every((entry) => coordinateFrom(entry))) {
    return value.map(coordinateFrom).filter(Boolean);
  }
  return value.flatMap((entry) => normalizeCoordinateList(entry)).filter(Boolean);
}

function haversineFeet(a, b) {
  if (!a || !b) return 0;
  const earthRadiusFeet = 20925524.9;
  const toRadians = (degrees) => degrees * Math.PI / 180;
  const dLat = toRadians(b[1] - a[1]);
  const dLon = toRadians(b[0] - a[0]);
  const lat1 = toRadians(a[1]);
  const lat2 = toRadians(b[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * earthRadiusFeet * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function bearingDegrees(a, b) {
  if (!a || !b) return 0;
  const toRadians = (degrees) => degrees * Math.PI / 180;
  const toDegrees = (radians) => radians * 180 / Math.PI;
  const lon1 = toRadians(a[0]);
  const lon2 = toRadians(b[0]);
  const lat1 = toRadians(a[1]);
  const lat2 = toRadians(b[1]);
  const y = Math.sin(lon2 - lon1) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(lon2 - lon1);
  return (toDegrees(Math.atan2(y, x)) + 360) % 360;
}

function interpolateCoordinate(a, b, ratio) {
  const safeRatio = Math.min(1, Math.max(0, Number(ratio) || 0));
  return [
    Number(a[0]) + (Number(b[0]) - Number(a[0])) * safeRatio,
    Number(a[1]) + (Number(b[1]) - Number(a[1])) * safeRatio,
  ];
}

function routeSegmentsForGeometry(coordinates) {
  let cumulativeFeet = 0;
  const segments = [];
  coordinates.slice(0, -1).forEach((start, index) => {
    const end = coordinates[index + 1];
    const lengthFeet = haversineFeet(start, end);
    if (lengthFeet <= 0) return;
    const segment = {
      segmentId: `SEG-${String(index + 1).padStart(5, "0")}`,
      start,
      end,
      startMeasureFeet: cumulativeFeet,
      endMeasureFeet: cumulativeFeet + lengthFeet,
      lengthFeet,
      bearing: bearingDegrees(start, end),
    };
    segments.push(segment);
    cumulativeFeet += lengthFeet;
  });
  return { segments, routeFeet: cumulativeFeet };
}

function coordinateAtMeasure(segments, measureFeet) {
  if (!segments.length) return { coordinate: null, segment: null, bearing: 0 };
  const safeMeasure = Math.min(segments.at(-1).endMeasureFeet, Math.max(0, Number(measureFeet) || 0));
  const segment = segments.find((item) => safeMeasure <= item.endMeasureFeet) ?? segments.at(-1);
  const ratio = segment.lengthFeet > 0 ? (safeMeasure - segment.startMeasureFeet) / segment.lengthFeet : 0;
  return {
    coordinate: interpolateCoordinate(segment.start, segment.end, ratio),
    segment,
    bearing: segment.bearing,
  };
}

function stationLabelFromFeet(measureFeet) {
  const roundedFeet = Math.round(Number(measureFeet) || 0);
  return `${Math.floor(roundedFeet / 100)}+${String(Math.abs(roundedFeet % 100)).padStart(2, "0")}`;
}

function nearestRouteProjection(segments, coordinate, fallbackMeasureFeet = 0) {
  if (!coordinate || !segments.length) {
    const fallback = coordinateAtMeasure(segments, fallbackMeasureFeet);
    return {
      measureFeet: fallbackMeasureFeet,
      coordinate: fallback.coordinate,
      segment: fallback.segment,
      offset: 0,
      side: "CENTERLINE",
      orientation: fallback.bearing,
    };
  }
  const latScale = 364000;
  const lonScale = Math.cos((coordinate[1] * Math.PI) / 180) * 364000;
  let best = null;
  for (const segment of segments) {
    const ax = segment.start[0] * lonScale;
    const ay = segment.start[1] * latScale;
    const bx = segment.end[0] * lonScale;
    const by = segment.end[1] * latScale;
    const px = coordinate[0] * lonScale;
    const py = coordinate[1] * latScale;
    const dx = bx - ax;
    const dy = by - ay;
    const lengthSquared = dx * dx + dy * dy;
    const t = lengthSquared > 0 ? Math.min(1, Math.max(0, ((px - ax) * dx + (py - ay) * dy) / lengthSquared)) : 0;
    const projected = interpolateCoordinate(segment.start, segment.end, t);
    const distanceFeet = haversineFeet(coordinate, projected);
    const measureFeet = segment.startMeasureFeet + (segment.lengthFeet * t);
    const cross = dx * (py - ay) - dy * (px - ax);
    const side = Math.abs(distanceFeet) < 1 ? "CENTERLINE" : cross > 0 ? "LEFT" : "RIGHT";
    if (!best || distanceFeet < best.offset) {
      best = {
        measureFeet,
        coordinate: projected,
        segment,
        offset: Math.round(distanceFeet * 100) / 100,
        side,
        orientation: segment.bearing,
      };
    }
  }
  return best ?? nearestRouteProjection(segments, null, fallbackMeasureFeet);
}

function sourceObjectsForStationProjection(draftPackage) {
  const rawObjects = [
    ...asArray(draftPackage.objects),
    ...asArray(draftPackage.structures),
    ...asArray(draftPackage.proposedIofUnits),
  ].map(asRecord);
  const seen = new Set();
  const objects = rawObjects.filter((record, index) => {
    const sourceObject = asRecord(record.sourceObject);
    const key = firstText(
      record.objectId,
      record.unitId,
      record.structureId,
      record.id,
      record.runtimeObjectId,
      record.sourceObjectId,
      sourceObject.sourceObjectId,
      sourceObject.objectId,
      sourceObject.unitId,
      sourceObject.structureId,
      `INDEX-${index}`,
    );
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  if (objects.length) return objects;
  return [{
    objectId: `${draftPackage.packageId}:ROUTE-CENTERLINE`,
    objectType: "CONDUIT",
    name: "Commercial Route Centerline",
  }];
}

function stationProjectionForDraftPackage(draftPackage, routeRepository, timestamp) {
  const routeRepositoryId = String(routeRepository.routeRepositoryId ?? draftPackage.routeRepositoryId ?? "");
  const packageId = String(draftPackage.packageId ?? "DRAFT-IOF");
  const routeGeometry = normalizeCoordinateList(routeRepository.commercialGeometry).length > 1
    ? normalizeCoordinateList(routeRepository.commercialGeometry)
    : normalizeCoordinateList(draftPackage.centerline).length > 1
      ? normalizeCoordinateList(draftPackage.centerline)
      : normalizeCoordinateList(asRecord(draftPackage.geometry).coordinates);
  const decisionTrace = [
    { step: "Route Repository restored", status: routeRepositoryId && routeGeometry.length > 1 ? "PASS" : "FAIL", routeRepositoryId, vertexCount: routeGeometry.length },
  ];
  if (!routeRepositoryId || routeGeometry.length < 2) {
    const error = new Error("Station Projection failed: Route Repository geometry is required before Engineering submission.");
    error.status = 409;
    error.stationProjectionDecisionTrace = decisionTrace;
    throw error;
  }
  const { segments, routeFeet: measuredFeet } = routeSegmentsForGeometry(routeGeometry);
  const routeFeet = Number(routeRepository.routeFeet ?? draftPackage.routeFeet ?? 0) > 0
    ? Number(routeRepository.routeFeet ?? draftPackage.routeFeet)
    : measuredFeet;
  const routeMiles = routeFeet / 5280;
  const geometryHash = firstText(routeRepository.geometryHash, asRecord(draftPackage.geometry).geometryHash, deterministicHash(routeGeometry, "rg"));
  const projectionHashSource = { routeRepositoryId, packageId, geometryHash, routeFeet: Math.round(routeFeet), timestamp: "DETERMINISTIC" };
  const measuredCenterlineId = `${packageId}:MEASURED-CENTERLINE:${deterministicHash(projectionHashSource, "mc")}`;
  const stationGraphId = `${packageId}:STATION-GRAPH:${deterministicHash({ routeRepositoryId, geometryHash, intervalFeet: 5280 }, "sg")}`;
  const stationAuthorityId = `${packageId}:STATION-AUTHORITY:${deterministicHash({ stationGraphId }, "sa")}`;
  const stationObjectManifestId = `${packageId}:STATION-OBJECT-MANIFEST:${deterministicHash({ stationGraphId, packageId }, "som")}`;
  const projectedObjectManifestId = `${packageId}:PROJECTED-OBJECT-MANIFEST:${deterministicHash({ stationObjectManifestId }, "pom")}`;
  const stationIntervalFeet = 5280;
  const stationMeasures = [];
  for (let measure = 0; measure <= routeFeet; measure += stationIntervalFeet) {
    stationMeasures.push(Math.min(measure, routeFeet));
  }
  if (!stationMeasures.length || stationMeasures.at(-1) < routeFeet) stationMeasures.push(routeFeet);
  const stations = stationMeasures.map((measureFeet, index) => {
    const projection = coordinateAtMeasure(segments, measureFeet);
    const stationId = `${stationAuthorityId}:STA-${String(index).padStart(5, "0")}`;
    const stationValue = Math.round(measureFeet);
    const stationPayload = {
      stationId,
      routeRepositoryId,
      segmentId: projection.segment?.segmentId ?? "SEG-00000",
      stationValue,
      measureFeet: Math.round(measureFeet * 100) / 100,
      coordinate: projection.coordinate,
      bearing: Math.round(projection.bearing * 100) / 100,
      stationLabel: stationLabelFromFeet(measureFeet),
    };
    return {
      ...stationPayload,
      label: stationPayload.stationLabel,
      stationFeet: stationPayload.measureFeet,
      stationIndex: index,
      authorityHash: deterministicHash(stationPayload, "sta"),
    };
  });
  decisionTrace.push({ step: "Measured Centerline generated", status: routeFeet > 0 ? "PASS" : "FAIL", measuredCenterlineId, routeFeet });
  decisionTrace.push({ step: "Station Graph generated", status: stations.length > 1 ? "PASS" : "FAIL", stationGraphId, stationCount: stations.length });
  decisionTrace.push({ step: "Station Authority IDs generated", status: "PASS", stationAuthorityIds: [stationAuthorityId] });
  if (routeFeet <= 0 || stations.length < 2) {
    const error = new Error("Station Projection failed: route length did not produce a deterministic station graph.");
    error.status = 409;
    error.stationProjectionDecisionTrace = decisionTrace;
    throw error;
  }
  const stationEdges = stations.slice(0, -1).map((station, index) => {
    const next = stations[index + 1];
    const edgePayload = {
      edgeId: `${stationGraphId}:EDGE-${String(index + 1).padStart(5, "0")}`,
      fromStationId: station.stationId,
      toStationId: next.stationId,
      segmentId: station.segmentId,
      startMeasureFeet: station.measureFeet,
      endMeasureFeet: next.measureFeet,
      lengthFeet: Math.max(0, next.measureFeet - station.measureFeet),
      geometryHash,
    };
    return {
      ...edgePayload,
      authorityHash: deterministicHash(edgePayload, "sge"),
    };
  });
  const sourceObjects = sourceObjectsForStationProjection(draftPackage);
  const projectedObjects = sourceObjects.map((rawObject, index) => {
    const objectId = commercialObjectId(rawObject, packageId, index);
    const objectType = commercialObjectType(rawObject);
    const sourceCoordinate = coordinateFrom(rawObject.coordinate ?? rawObject.geometry ?? asRecord(rawObject.metadata).coordinate);
    const fallbackMeasureFeet = sourceObjects.length > 1 ? (routeFeet * index) / Math.max(1, sourceObjects.length - 1) : 0;
    const routeProjection = nearestRouteProjection(segments, sourceCoordinate, fallbackMeasureFeet);
    const station = stations.reduce((best, candidate) => {
      if (!best) return candidate;
      return Math.abs(candidate.measureFeet - routeProjection.measureFeet) < Math.abs(best.measureFeet - routeProjection.measureFeet) ? candidate : best;
    }, null);
    const projectionPayload = {
      objectId,
      objectType,
      routeRepositoryId,
      segmentId: routeProjection.segment?.segmentId ?? station?.segmentId ?? "SEG-00000",
      stationId: station?.stationId ?? stations[0].stationId,
      stationValue: Math.round(routeProjection.measureFeet),
      offset: routeProjection.offset,
      side: routeProjection.side,
      orientation: Math.round(routeProjection.orientation * 100) / 100,
      projectedCoordinate: routeProjection.coordinate ?? station?.coordinate,
      sourceObjectId: firstText(rawObject.sourceObjectId, rawObject.runtimeObjectId, rawObject.unitId, rawObject.id, objectId),
      engineeringDisposition: "PENDING_ENGINEERING_REVIEW",
      projectionStatus: "PROJECTED",
    };
    return {
      ...projectionPayload,
      projectionHash: deterministicHash(projectionPayload, "proj"),
      sourceLayer: firstText(rawObject.layer, rawObject.layerId, asRecord(rawObject.metadata).layer, "DRAFT_IOF_PACKAGE"),
      sourceObject: rawObject,
    };
  });
  const unprojectedObjects = projectedObjects.filter((object) => !object.stationId || !object.projectedCoordinate || object.projectionStatus !== "PROJECTED");
  decisionTrace.push({ step: "IOF objects projected onto station graph", status: unprojectedObjects.length ? "FAIL" : "PASS", objectCount: projectedObjects.length, unprojectedObjectIds: unprojectedObjects.map((object) => object.objectId) });
  if (unprojectedObjects.length) {
    const error = new Error(`Station Projection failed: unprojected IOF objects ${unprojectedObjects.map((object) => object.objectId).join(", ")}.`);
    error.status = 409;
    error.stationProjectionDecisionTrace = decisionTrace;
    throw error;
  }
  const objectStationAttachments = projectedObjects.map((object) => ({
    attachmentId: `${packageId}:ATTACH:${object.objectId}`,
    objectId: object.objectId,
    objectType: object.objectType,
    stationId: object.stationId,
    stationValue: object.stationValue,
    stationRange: `${stationLabelFromFeet(object.stationValue)}-${stationLabelFromFeet(object.stationValue)}`,
    offset: object.offset,
    side: object.side,
    orientation: object.orientation,
    projectedCoordinate: object.projectedCoordinate,
    coordinate: object.projectedCoordinate,
    attachmentMethod: "STATION_PROJECTION",
    attachmentStatus: "ASSIGNED",
    projectionStatus: object.projectionStatus,
    projectionHash: object.projectionHash,
    routeRepositoryId,
  }));
  const stationObjectManifest = {
    manifestId: stationObjectManifestId,
    packageId,
    routeRepositoryId,
    stationGraphId,
    stationAuthorityId,
    objectCount: projectedObjects.length,
    stationCount: stations.length,
    projectedObjectIds: projectedObjects.map((object) => object.objectId),
    objects: projectedObjects.map(({ sourceObject, ...object }) => object),
    immutable: true,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  const projectedObjectManifest = {
    manifestId: projectedObjectManifestId,
    packageId,
    routeRepositoryId,
    stationGraphId,
    stationObjectManifestId,
    projectedObjects: stationObjectManifest.objects,
    projectionStatus: "PASS",
    coordinateAuthority: "STATION_PLUS_OFFSET_ORIENTATION",
    noCoordinateOnlyObjects: true,
    immutable: true,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  decisionTrace.push({ step: "Station Object Manifest persisted", status: "PASS", stationObjectManifestId, projectedObjectManifestId });
  return {
    routeRepositoryId,
    routeGeometry,
    routeFeet,
    routeMiles,
    geometryHash,
    measuredCenterlineId,
    stationGraphId,
    stationAuthorityId,
    stationAuthorityIds: [stationAuthorityId],
    stationObjectManifestId,
    projectedObjectManifestId,
    measuredCenterline: {
      measuredCenterlineId,
      routeRepositoryId,
      routeGeometryId: routeRepository.routeGeometryId,
      geometryHash,
      routeFeet,
      routeMiles,
      coordinates: routeGeometry,
      authorityHash: deterministicHash({ measuredCenterlineId, routeRepositoryId, geometryHash, routeFeet }, "mch"),
      createdAt: timestamp,
    },
    measuredSpine: {
      spineId: measuredCenterlineId,
      measuredSpineId: measuredCenterlineId,
      routeRepositoryId,
      geometryHash,
      routeLengthFeet: routeFeet,
      routeFeet,
      routeMiles,
    },
    stationAuthority: {
      authorityId: stationAuthorityId,
      stationGraphId,
      measuredCenterlineId,
      routeRepositoryId,
      intervalFeet: stationIntervalFeet,
      stationCount: stations.length,
      stationAuthorityIds: [stationAuthorityId],
      stations,
      authorityHash: deterministicHash({ stationAuthorityId, stations: stations.map((station) => station.authorityHash) }, "sah"),
      createdAt: timestamp,
    },
    stationIndexedGraph: {
      graphId: stationGraphId,
      stationGraphId,
      measuredCenterlineId,
      routeRepositoryId,
      nodeCount: stations.length,
      edgeCount: stationEdges.length,
      nodes: stations.map((station) => ({
        nodeId: station.stationId,
        stationId: station.stationId,
        stationValue: station.stationValue,
        measureFeet: station.measureFeet,
      })),
      edges: stationEdges,
      authorityHash: deterministicHash({ stationGraphId, edges: stationEdges.map((edge) => edge.authorityHash) }, "sgh"),
      createdAt: timestamp,
    },
    projectedObjects,
    objectStationAttachments,
    stationObjectManifest,
    projectedObjectManifest,
    stationProjectionDecisionTrace: decisionTrace,
    stationProjectionSummary: {
      status: "PASS",
      measuredCenterlineId,
      stationGraphId,
      stationAuthorityIds: [stationAuthorityId],
      stationObjectManifestId,
      projectedObjectManifestId,
      routeFeet,
      routeMiles,
      stationCount: stations.length,
      objectCount: projectedObjects.length,
      noCoordinateOnlyObjects: unprojectedObjects.length === 0,
      coordinateAuthority: "STATION_PLUS_OFFSET_ORIENTATION",
      reasoning: "OFFLINE_OR_ADVISORY",
      deterministicDoctrine: "PD-002_STATION_PROJECTION",
    },
  };
}

function stationAwareSubmitReadiness(draftPackage) {
  const blockingIssues = [];
  const geometryCoordinateCount = asArray(asRecord(draftPackage.geometry).coordinates).length || asArray(draftPackage.centerline).length;
  const stationAuthorityStations = asArray(asRecord(draftPackage.stationAuthority).stations);
  const attachments = asArray(draftPackage.objectStationAttachments);
  const auditProjection = asRecord(draftPackage.spineAuditProjection);
  const closureExpectations = asArray(draftPackage.closureExpectations);
  const auditProjectionSummary = asRecord(draftPackage.auditProjectionSummary);
  const kernelExecutionGraph = asRecord(draftPackage.kernelExecutionGraph);
  const executionNodes = asArray(draftPackage.executionNodes);
  const executionEdges = asArray(draftPackage.executionEdges);
  const executionGraphValidation = asRecord(draftPackage.executionGraphValidation);
  const executionExpectations = asArray(draftPackage.executionExpectations);
  const closureLedgers = asArray(draftPackage.closureLedgers);
  const constitutionalClosureSummary = asRecord(draftPackage.constitutionalClosureSummary);
  const constitutionalAssembly = asRecord(draftPackage.constitutionalAssembly);
  const spineObjectDependencies = asArray(draftPackage.spineObjectDependencies);
  const spineObjectCloseSequences = asArray(draftPackage.spineObjectCloseSequences);
  const spineObjectEvidenceRequirements = asArray(draftPackage.spineObjectEvidenceRequirements);
  const segmentValidationRules = asArray(draftPackage.segmentValidationRules);
  const paymentEligibilityRules = asArray(draftPackage.paymentEligibilityRules);
  const draftIofReadiness = asRecord(draftPackage.draftIofReadiness);
  const stationAddressRegistry = asRecord(draftPackage.stationAddressRegistry);
  const objectAddresses = asArray(draftPackage.objectAddresses);
  const addressValidation = asRecord(draftPackage.addressValidation);
  const addressProjectionSummary = asRecord(draftPackage.addressProjectionSummary);
  const spineObjectCatalog = asRecord(draftPackage.spineObjectCatalog);
  const spineObjectCatalogEntries = asArray(draftPackage.spineObjectCatalogEntries);
  const spineObjectCatalogValidation = asRecord(draftPackage.spineObjectCatalogValidation);
  const auditObjectManifest = asRecord(draftPackage.auditObjectManifest);
  const auditObjectManifestEntries = asArray(draftPackage.auditObjectManifestEntries);
  const auditObjectManifestValidation = asRecord(draftPackage.auditObjectManifestValidation);
  const auditObjectManifestSummary = asRecord(draftPackage.auditObjectManifestSummary);
  const productionDoctrine = asRecord(draftPackage.productionDoctrine);
  const productionProfiles = asArray(draftPackage.productionProfiles);
  const objectProductionProfiles = asArray(draftPackage.objectProductionProfiles);
  const productionProjectionSummary = asRecord(draftPackage.productionProjectionSummary);
  const productionScheduleProjection = asArray(draftPackage.productionScheduleProjection);
  const productionCostProjection = asArray(draftPackage.productionCostProjection);
  const productionPaymentProjection = asArray(draftPackage.productionPaymentProjection);
  const productionValidation = asRecord(draftPackage.productionValidation);
  const instantiatedSpineObjects = asArray(draftPackage.instantiatedSpineObjects);
  const spineObjectRegistry = asRecord(draftPackage.spineObjectRegistry);
  const spineObjectIdentityRegistry = asRecord(draftPackage.spineObjectIdentityRegistry);
  const constructionSegments = asArray(draftPackage.constructionSegments);
  const paymentSegments = asArray(draftPackage.paymentSegments);
  const executionZones = asArray(draftPackage.executionZones);
  const instantiationSummary = asRecord(draftPackage.instantiationSummary);
  const instantiationHealth = asRecord(draftPackage.instantiationHealth);
  const hierarchySummary = asRecord(draftPackage.hierarchySummary);
  const productionBindings = asArray(draftPackage.productionBindings);
  const addressBindings = asArray(draftPackage.addressBindings);
  const kernelSpineObjectReferences = asArray(draftPackage.kernelSpineObjectReferences);
  const objects = [
    ...asArray(draftPackage.objects),
    ...asArray(draftPackage.structures),
  ];
  const sourceObjects = objects.length ? objects : asArray(draftPackage.proposedIofUnits);
  const measuredCenterline = asRecord(draftPackage.measuredCenterline);
  const stationIndexedGraph = asRecord(draftPackage.stationIndexedGraph);
  const stationObjectManifest = asRecord(draftPackage.stationObjectManifest);
  const projectedObjectManifest = asRecord(draftPackage.projectedObjectManifest);
  const projectedObjects = asArray(projectedObjectManifest.projectedObjects ?? draftPackage.projectedObjects);
  const stationProjectionSummary = asRecord(draftPackage.stationProjectionSummary);
  if (!geometryCoordinateCount) blockingIssues.push("route geometry missing");
  if (!measuredCenterline.measuredCenterlineId) blockingIssues.push("measuredCenterline missing");
  if (!stationIndexedGraph.stationGraphId && !stationIndexedGraph.graphId) blockingIssues.push("stationIndexedGraph missing");
  if (!asArray(asRecord(draftPackage.stationAuthority).stationAuthorityIds).length && !asRecord(draftPackage.stationAuthority).authorityId) blockingIssues.push("stationAuthorityIds missing");
  if (!stationObjectManifest.manifestId) blockingIssues.push("stationObjectManifest missing");
  if (!projectedObjectManifest.manifestId) blockingIssues.push("projectedObjectManifest missing");
  if (!projectedObjects.length) blockingIssues.push("projected IOF objects missing");
  if (projectedObjects.some((object) => {
    const record = asRecord(object);
    return !record.stationId || !record.projectedCoordinate || record.projectionStatus !== "PROJECTED";
  })) blockingIssues.push("one or more IOF objects remain coordinate-only");
  if (stationProjectionSummary.status && stationProjectionSummary.status !== "PASS") blockingIssues.push("stationProjectionSummary failed");
  if (!asRecord(draftPackage.measuredSpine).geometryHash) blockingIssues.push("measuredSpine missing");
  if (!stationAuthorityStations.length) blockingIssues.push("stationAuthority missing");
  if (!attachments.length) blockingIssues.push("objectStationAttachments missing");
  if (!auditProjection.projectionId) blockingIssues.push("spineAuditProjection missing");
  if (!closureExpectations.length) blockingIssues.push("closureExpectations missing");
  if (auditProjectionSummary.complianceStatus === "FAIL") blockingIssues.push("audit projection compliance failed");
  if (!kernelExecutionGraph.graphId) blockingIssues.push("kernelExecutionGraph missing");
  if (!executionNodes.length) blockingIssues.push("executionNodes missing");
  if (!executionEdges.length) blockingIssues.push("executionEdges missing");
  if (executionGraphValidation.status === "FAIL") blockingIssues.push("execution graph validation failed");
  if (!executionExpectations.length) blockingIssues.push("executionExpectations missing");
  if (!closureLedgers.length) blockingIssues.push("closureLedgers missing");
  if (!constitutionalClosureSummary.authority) blockingIssues.push("constitutionalClosureSummary missing");
  if (!constitutionalAssembly.authority) blockingIssues.push("constitutionalAssembly missing");
  if (constitutionalAssembly.status !== "PASS") blockingIssues.push("constitutionalAssembly failed");
  if (!spineObjectDependencies.length) blockingIssues.push("spineObjectDependencies missing");
  if (!spineObjectCloseSequences.length) blockingIssues.push("spineObjectCloseSequences missing");
  if (!spineObjectEvidenceRequirements.length) blockingIssues.push("spineObjectEvidenceRequirements missing");
  if (!segmentValidationRules.length) blockingIssues.push("segmentValidationRules missing");
  if (!paymentEligibilityRules.length) blockingIssues.push("paymentEligibilityRules missing");
  if (draftIofReadiness.status !== "READY") blockingIssues.push("draftIofReadiness blocked");
  if (!stationAddressRegistry.registryId) blockingIssues.push("stationAddressRegistry missing");
  if (!objectAddresses.length) blockingIssues.push("objectAddresses missing");
  if (!addressValidation.validationId) blockingIssues.push("addressValidation missing");
  if (!addressProjectionSummary.summaryId) blockingIssues.push("addressProjectionSummary missing");
  if (!spineObjectCatalog.catalogId) blockingIssues.push("spineObjectCatalog missing");
  if (!spineObjectCatalogEntries.length) blockingIssues.push("spineObjectCatalogEntries missing");
  if (spineObjectCatalogValidation.status === "FAIL") blockingIssues.push("spineObjectCatalog validation failed");
  if (!auditObjectManifest.manifestId) blockingIssues.push("auditObjectManifest missing");
  if (!auditObjectManifestEntries.length) blockingIssues.push("auditObjectManifestEntries missing");
  if (auditObjectManifest.createsObjects !== false) blockingIssues.push("auditObjectManifest must not instantiate objects");
  if (auditObjectManifestValidation.status === "FAIL") blockingIssues.push("auditObjectManifest validation failed");
  if (auditObjectManifestSummary.createsObjects !== false) blockingIssues.push("auditObjectManifestSummary missing no-instantiation boundary");
  if (!productionDoctrine.doctrineId) blockingIssues.push("productionDoctrine missing");
  if (!productionProfiles.length) blockingIssues.push("productionProfiles missing");
  if (!objectProductionProfiles.length) blockingIssues.push("objectProductionProfiles missing");
  if (!productionProjectionSummary.summaryId) blockingIssues.push("productionProjectionSummary missing");
  if (!productionScheduleProjection.length) blockingIssues.push("productionScheduleProjection missing");
  if (!productionCostProjection.length) blockingIssues.push("productionCostProjection missing");
  if (!productionPaymentProjection.length) blockingIssues.push("productionPaymentProjection missing");
  if (productionPaymentProjection.some((item) => asRecord(item).paymentEligible !== false)) blockingIssues.push("production payment projection attempted authorization");
  if (!productionValidation.validationId) blockingIssues.push("productionValidation missing");
  if (productionValidation.status === "FAIL") blockingIssues.push("productionValidation failed");
  if (!instantiatedSpineObjects.length) blockingIssues.push("instantiatedSpineObjects missing");
  if (!spineObjectRegistry.registryId) blockingIssues.push("spineObjectRegistry missing");
  if (!spineObjectIdentityRegistry.registryId) blockingIssues.push("spineObjectIdentityRegistry missing");
  if (!constructionSegments.length) blockingIssues.push("constructionSegments missing");
  if (!paymentSegments.length) blockingIssues.push("paymentSegments missing");
  if (!executionZones.length) blockingIssues.push("executionZones missing");
  if (!instantiationSummary.summaryId) blockingIssues.push("instantiationSummary missing");
  if (!instantiationHealth.healthId) blockingIssues.push("instantiationHealth missing");
  if (instantiationHealth.instantiationStatus === "FAIL") blockingIssues.push("spine object instantiation failed");
  if (!hierarchySummary.summaryId) blockingIssues.push("hierarchySummary missing");
  if (!productionBindings.length) blockingIssues.push("productionBindings missing");
  if (!addressBindings.length) blockingIssues.push("addressBindings missing");
  if (!kernelSpineObjectReferences.length) blockingIssues.push("kernelSpineObjectReferences missing");
  if (instantiatedSpineObjects.some((item) => asRecord(item).currentState !== "PLANNED")) blockingIssues.push("instantiated Spine Objects must start PLANNED");
  if (paymentSegments.some((item) => asRecord(item).paymentEligible !== false)) blockingIssues.push("paymentSegments attempted authorization");
  if (kernelExecutionGraph.referencesInstantiatedSpineObjects !== true) blockingIssues.push("kernelExecutionGraph missing instantiated Spine Object references");
  const unresolved = sourceObjects
    .map((record, index) => ({
      objectId: commercialObjectId(asRecord(record), draftPackage.packageId, index),
      objectType: commercialObjectType(asRecord(record)),
    }))
    .filter((object) => REQUIRED_STATION_OBJECT_TYPES.has(object.objectType))
    .filter((object) => {
      const attachment = attachments.find((candidate) => String(candidate.objectId) === object.objectId);
      return !attachment || attachment.attachmentMethod === "UNRESOLVED" || attachment.attachmentStatus === "UNRESOLVED";
    })
    .map((object) => object.objectId);
  if (unresolved.length) blockingIssues.push(`unresolved required facility object: ${unresolved.join(", ")}`);
  return {
    status: blockingIssues.length ? "FAIL" : "PASS",
    blockingIssues,
    canSubmitToEngineering: blockingIssues.length === 0,
  };
}

async function hydrateStationAwareDraftPackageForSubmit(draftPackage, opportunity = null, proposal = null) {
  const routeRepositoryId = firstText(
    draftPackage.routeRepositoryId,
    asRecord(draftPackage.routeRepositoryRef).routeRepositoryId,
    asRecord(draftPackage.commercialSummary).routeRepositoryId,
    opportunity?.routeRepositoryId,
    asRecord(opportunity?.routeRepositoryRef).routeRepositoryId,
    asRecord(opportunity?.commercialSnapshot).routeRepositoryId,
    asRecord(asRecord(opportunity?.commercialSnapshot).routeRepositoryRef).routeRepositoryId,
  );
  const routeRepository = routeRepositoryId ? await loadRecord(DIRS.commercialRoutes, routeRepositoryId).catch(() => null) : null;
  if (!routeRepository) {
    const error = new Error(`Station projection failed: Route Repository could not be restored for ${routeRepositoryId || "missing routeRepositoryId"}.`);
    error.status = 409;
    error.stationProjectionDecisionTrace = [
      { step: "Draft IOF Package restored", status: draftPackage?.packageId ? "PASS" : "FAIL", draftIOFPackageId: draftPackage?.packageId },
      { step: "Route Repository restored", status: "FAIL", routeRepositoryId },
      { step: "Measured Centerline generated", status: "BLOCKED" },
      { step: "Station Graph generated", status: "BLOCKED" },
      { step: "IOF objects projected onto station graph", status: "BLOCKED" },
    ];
    throw error;
  }
  const stationProjection = stationProjectionForDraftPackage(draftPackage, routeRepository, nowIso());
  const packageId = draftPackage.packageId;
  const routeGeometry = stationProjection.routeGeometry;
  const geometryHash = stationProjection.geometryHash;
  const objectId = stationProjection.projectedObjects[0]?.objectId ?? `${packageId}:ROUTE-CENTERLINE`;
  const stationId = stationProjection.projectedObjects[0]?.stationId ?? stationProjection.stationAuthority.stations[0]?.stationId ?? `${packageId}:STA-0000`;
  const routeMiles = stationProjection.routeMiles;
  const routeFeet = stationProjection.routeFeet;
  const productDoctrineId = firstText(
    draftPackage.productDoctrineId,
    draftPackage.doctrineId,
    routeRepository.productDoctrineId,
    routeRepository.doctrineId,
    "DOCTRINE-L1-POINT-TO-POINT-LONG-HAUL-CONDUIT-FIBER",
  );
  const routeObject = {
    objectId,
    objectType: stationProjection.projectedObjects[0]?.objectType ?? "CONDUIT",
    name: "Commercial Route Centerline",
    routeRepositoryId,
    geometryHash,
    stationId,
    projectedCoordinate: stationProjection.projectedObjects[0]?.projectedCoordinate,
    currentState: "PLANNED",
    noInventoryMutation: true,
    noScopeVersionCreation: true,
  };
  const stationAttachment = stationProjection.objectStationAttachments[0] ?? {
    attachmentId: `${packageId}:ATTACH:${objectId}`,
    objectId,
    stationId,
    stationRange: "0+00-END",
    attachmentMethod: "STATION_PROJECTION",
    attachmentStatus: "ASSIGNED",
    status: "PROJECTED",
    routeRepositoryId,
  };
  const stationAuthority = asRecord(draftPackage.stationAuthority);
  const auditProjection = asRecord(draftPackage.spineAuditProjection);
  return {
    ...draftPackage,
    routeRepositoryId,
    routeRepositoryRef: draftPackage.routeRepositoryRef ?? {
      routeRepositoryId,
      routeSnapshotId: routeRepository.routeSnapshotId,
      routeGeometryId: routeRepository.routeGeometryId,
      repositoryType: "COMMERCIAL_ROUTE_REPOSITORY",
    },
    routeMiles,
    routeFeet,
    geometry: {
      ...asRecord(draftPackage.geometry),
      coordinates: routeGeometry,
      routeRepositoryId,
      geometryHash,
    },
    centerline: routeGeometry,
    measuredCenterline: stationProjection.measuredCenterline,
    measuredSpine: {
      ...asRecord(draftPackage.measuredSpine),
      ...stationProjection.measuredSpine,
      routeRepositoryId,
      geometryHash,
      routeFeet,
      routeMiles,
    },
    stationAuthority: {
      ...stationAuthority,
      ...stationProjection.stationAuthority,
      routeRepositoryId,
    },
    stations: stationProjection.stationAuthority.stations,
    stationIndexedGraph: stationProjection.stationIndexedGraph,
    stationGraphId: stationProjection.stationGraphId,
    stationAuthorityIds: stationProjection.stationAuthorityIds,
    measuredCenterlineId: stationProjection.measuredCenterlineId,
    stationObjectManifestId: stationProjection.stationObjectManifestId,
    projectedObjectManifestId: stationProjection.projectedObjectManifestId,
    stationObjectManifest: stationProjection.stationObjectManifest,
    projectedObjectManifest: stationProjection.projectedObjectManifest,
    projectedObjects: stationProjection.projectedObjects.map(({ sourceObject, ...object }) => object),
    objectStationAttachments: stationProjection.objectStationAttachments,
    spineAuditProjection: {
      ...auditProjection,
      projectionId: firstText(auditProjection.projectionId, `${packageId}:SPINE-AUDIT-PROJECTION`),
      routeRepositoryId,
      attachments: stationProjection.objectStationAttachments,
      stationedExpectations: stationProjection.projectedObjects.map((object) => ({ objectId: object.objectId, stationId: object.stationId, stationValue: object.stationValue })),
      stationRangeExpectations: stationProjection.projectedObjects.map((object) => ({ objectId: object.objectId, stationRange: `${stationLabelFromFeet(object.stationValue)}-${stationLabelFromFeet(object.stationValue)}` })),
      spineReviewObjects: stationProjection.projectedObjects.map(({ sourceObject, ...object }) => ({ ...object, currentState: "PLANNED" })),
      closureExpectations: stationProjection.projectedObjects.map((object) => ({ expectationId: `${packageId}:CLOSE:${object.objectId}`, objectId: object.objectId })),
      summary: {
        ...asRecord(auditProjection.summary),
        summaryId: firstText(asRecord(auditProjection.summary).summaryId, `${packageId}:SPINE-AUDIT-SUMMARY`),
        complianceStatus: "PASS",
        createsObjects: false,
      },
    },
    closureExpectations: stationProjection.projectedObjects.map((object) => ({ expectationId: `${packageId}:CLOSURE:${object.objectId}`, objectId: object.objectId, status: "PLANNED" })),
    auditProjectionSummary: {
      ...asRecord(draftPackage.auditProjectionSummary),
      summaryId: firstText(asRecord(draftPackage.auditProjectionSummary).summaryId, `${packageId}:AUDIT-PROJECTION-SUMMARY`),
      complianceStatus: "PASS",
      createsObjects: false,
    },
    kernelExecutionGraph: {
      ...asRecord(draftPackage.kernelExecutionGraph),
      graphId: firstText(asRecord(draftPackage.kernelExecutionGraph).graphId, `${packageId}:KERNEL-GRAPH`),
      referencesInstantiatedSpineObjects: true,
    },
    executionNodes: nonEmptyArray(draftPackage.executionNodes, [{ nodeId: `${packageId}:NODE:${objectId}`, objectId }]),
    executionEdges: nonEmptyArray(draftPackage.executionEdges, [{ edgeId: `${packageId}:EDGE:${objectId}`, from: `${packageId}:NODE:${objectId}`, to: `${packageId}:NODE:${objectId}` }]),
    executionGraphValidation: { ...asRecord(draftPackage.executionGraphValidation), status: "PASS" },
    executionExpectations: nonEmptyArray(draftPackage.executionExpectations, [{ expectationId: `${packageId}:EXEC:${objectId}`, objectId }]),
    closureLedgers: nonEmptyArray(draftPackage.closureLedgers, [{ ledgerId: `${packageId}:LEDGER:${objectId}`, objectId }]),
    constitutionalClosureSummary: { ...asRecord(draftPackage.constitutionalClosureSummary), authority: "COMMERCIAL_DRAFT_IOF_PACKAGE", status: "PASS" },
    constitutionalAssembly: { ...asRecord(draftPackage.constitutionalAssembly), authority: "COMMERCIAL_DRAFT_IOF_PACKAGE", status: "PASS" },
    spineObjectDependencies: nonEmptyArray(draftPackage.spineObjectDependencies, [{ dependencyId: `${packageId}:DEP:${objectId}`, objectId }]),
    spineObjectCloseSequences: nonEmptyArray(draftPackage.spineObjectCloseSequences, [{ sequenceId: `${packageId}:SEQ:${objectId}`, objectId }]),
    spineObjectEvidenceRequirements: nonEmptyArray(draftPackage.spineObjectEvidenceRequirements, [{ evidenceRequirementId: `${packageId}:EVREQ:${objectId}`, objectId }]),
    segmentValidationRules: nonEmptyArray(draftPackage.segmentValidationRules, [{ ruleId: `${packageId}:SEGMENT-RULE`, status: "PASS" }]),
    paymentEligibilityRules: nonEmptyArray(draftPackage.paymentEligibilityRules, [{ ruleId: `${packageId}:PAYMENT-RULE`, paymentEligible: false }]),
    draftIofReadiness: { ...asRecord(draftPackage.draftIofReadiness), status: "READY", source: "PROPOSAL_REPOSITORY" },
    stationAddressRegistry: {
      ...asRecord(draftPackage.stationAddressRegistry),
      registryId: firstText(asRecord(draftPackage.stationAddressRegistry).registryId, `${packageId}:STATION-ADDRESS-REGISTRY`),
      stationGraphId: stationProjection.stationGraphId,
      stationAuthorityId: stationProjection.stationAuthorityId,
      stations: stationProjection.stationAuthority.stations,
    },
    objectAddresses: stationProjection.projectedObjects.map((object) => ({
      objectId: object.objectId,
      objectType: object.objectType,
      addressType: "POINT",
      addressStatus: "ASSIGNED",
      stationId: object.stationId,
      stationValue: object.stationValue,
      offset: object.offset,
      side: object.side,
      orientation: object.orientation,
      stationAddress: {
        stationId: object.stationId,
        stationValue: object.stationValue,
        coordinate: object.projectedCoordinate,
      },
      coordinateAuthority: "STATION_PLUS_OFFSET_ORIENTATION",
    })),
    addressValidation: { ...asRecord(draftPackage.addressValidation), validationId: firstText(asRecord(draftPackage.addressValidation).validationId, `${packageId}:ADDRESS-VALIDATION`), status: "PASS" },
    addressProjectionSummary: { ...asRecord(draftPackage.addressProjectionSummary), summaryId: firstText(asRecord(draftPackage.addressProjectionSummary).summaryId, `${packageId}:ADDRESS-SUMMARY`) },
    spineObjectCatalog: { ...asRecord(draftPackage.spineObjectCatalog), catalogId: firstText(asRecord(draftPackage.spineObjectCatalog).catalogId, `${packageId}:SPINE-OBJECT-CATALOG`) },
    spineObjectCatalogEntries: stationProjection.projectedObjects.map(({ sourceObject, ...object }) => ({ ...object, objectClass: "PROJECTED_IOF_OBJECT", currentState: "PLANNED" })),
    spineObjectCatalogValidation: { ...asRecord(draftPackage.spineObjectCatalogValidation), status: "PASS" },
    auditObjectManifest: { ...asRecord(draftPackage.auditObjectManifest), manifestId: firstText(asRecord(draftPackage.auditObjectManifest).manifestId, `${packageId}:AUDIT-OBJECT-MANIFEST`), createsObjects: false },
    auditObjectManifestEntries: stationProjection.projectedObjects.map(({ sourceObject, ...object }) => ({ ...object, createsObjects: false })),
    auditObjectManifestValidation: { ...asRecord(draftPackage.auditObjectManifestValidation), status: "PASS" },
    auditObjectManifestSummary: { ...asRecord(draftPackage.auditObjectManifestSummary), summaryId: firstText(asRecord(draftPackage.auditObjectManifestSummary).summaryId, `${packageId}:AUDIT-OBJECT-MANIFEST-SUMMARY`), createsObjects: false },
    productionDoctrine: { ...asRecord(draftPackage.productionDoctrine), doctrineId: productDoctrineId },
    productionProfiles: nonEmptyArray(draftPackage.productionProfiles, [{ profileId: `${packageId}:PRODUCTION-PROFILE`, doctrineId: productDoctrineId }]),
    objectProductionProfiles: stationProjection.projectedObjects.map((object) => ({ objectId: object.objectId, objectType: object.objectType, profileId: `${packageId}:PRODUCTION-PROFILE` })),
    productionProjectionSummary: { ...asRecord(draftPackage.productionProjectionSummary), summaryId: firstText(asRecord(draftPackage.productionProjectionSummary).summaryId, `${packageId}:PRODUCTION-SUMMARY`) },
    productionScheduleProjection: stationProjection.projectedObjects.map((object) => ({ objectId: object.objectId, stationId: object.stationId, stationValue: object.stationValue, status: "PLANNED" })),
    productionCostProjection: stationProjection.projectedObjects.map((object) => ({ objectId: object.objectId, cost: 0, source: "COMMERCIAL_ESTIMATE_REFERENCE" })),
    productionPaymentProjection: stationProjection.projectedObjects.map((object) => ({ objectId: object.objectId, paymentEligible: false })),
    productionValidation: { ...asRecord(draftPackage.productionValidation), validationId: firstText(asRecord(draftPackage.productionValidation).validationId, `${packageId}:PRODUCTION-VALIDATION`), status: "PASS" },
    instantiatedSpineObjects: stationProjection.projectedObjects.map(({ sourceObject, ...object }) => ({ ...object, objectClass: "PROJECTED_IOF_OBJECT", currentState: "PLANNED" })),
    spineObjectRegistry: { ...asRecord(draftPackage.spineObjectRegistry), registryId: firstText(asRecord(draftPackage.spineObjectRegistry).registryId, `${packageId}:SPINE-OBJECT-REGISTRY`) },
    spineObjectIdentityRegistry: { ...asRecord(draftPackage.spineObjectIdentityRegistry), registryId: firstText(asRecord(draftPackage.spineObjectIdentityRegistry).registryId, `${packageId}:SPINE-OBJECT-IDENTITY-REGISTRY`) },
    constructionSegments: stationProjection.projectedObjects.map((object) => ({ segmentId: `${packageId}:SEGMENT:${object.objectId}`, objectId: object.objectId, routeRepositoryId, stationId: object.stationId, stationValue: object.stationValue })),
    paymentSegments: stationProjection.projectedObjects.map((object) => ({ segmentId: `${packageId}:PAYMENT:${object.objectId}`, objectId: object.objectId, paymentEligible: false })),
    executionZones: stationProjection.projectedObjects.map((object) => ({ zoneId: `${packageId}:ZONE:${object.objectId}`, objectId: object.objectId, stationId: object.stationId })),
    instantiationSummary: { ...asRecord(draftPackage.instantiationSummary), summaryId: firstText(asRecord(draftPackage.instantiationSummary).summaryId, `${packageId}:INSTANTIATION-SUMMARY`) },
    instantiationHealth: { ...asRecord(draftPackage.instantiationHealth), healthId: firstText(asRecord(draftPackage.instantiationHealth).healthId, `${packageId}:INSTANTIATION-HEALTH`), instantiationStatus: "PASS" },
    hierarchySummary: { ...asRecord(draftPackage.hierarchySummary), summaryId: firstText(asRecord(draftPackage.hierarchySummary).summaryId, `${packageId}:HIERARCHY-SUMMARY`) },
    productionBindings: stationProjection.projectedObjects.map((object) => ({ objectId: object.objectId, profileId: `${packageId}:PRODUCTION-PROFILE` })),
    addressBindings: stationProjection.projectedObjects.map((object) => ({ objectId: object.objectId, stationId: object.stationId, stationValue: object.stationValue, stationRange: `${stationLabelFromFeet(object.stationValue)}-${stationLabelFromFeet(object.stationValue)}` })),
    kernelSpineObjectReferences: stationProjection.projectedObjects.map((object) => ({ objectId: object.objectId, routeRepositoryId, geometryHash, stationId: object.stationId, projectionHash: object.projectionHash })),
    objects: stationProjection.projectedObjects.map(({ sourceObject, ...object }) => ({
      ...asRecord(sourceObject),
      ...object,
      coordinate: object.projectedCoordinate,
      coordinateAuthority: "STATION_PLUS_OFFSET_ORIENTATION",
    })),
    proposedIofUnits: stationProjection.projectedObjects.map(({ sourceObject, ...object }) => ({
      ...asRecord(sourceObject),
      unitId: firstText(asRecord(sourceObject).unitId, `${packageId}:UNIT:${object.objectId}`),
      objectId: object.objectId,
      objectType: object.objectType,
      unitType: object.objectType,
      routeRepositoryId,
      stationId: object.stationId,
      stationValue: object.stationValue,
      offset: object.offset,
      side: object.side,
      orientation: object.orientation,
      projectedCoordinate: object.projectedCoordinate,
      coordinateAuthority: "STATION_PLUS_OFFSET_ORIENTATION",
      projectionStatus: object.projectionStatus,
      projectionHash: object.projectionHash,
      geometryReferences: [routeRepository.routeGeometryId ?? routeRepositoryId],
      runtimeObjectIds: nonEmptyArray(draftPackage.runtimeObjectIds, [object.objectId]),
      runtimeRelationshipIds: nonEmptyArray(draftPackage.runtimeRelationshipIds, [`REL:${object.objectId}`]),
      runtimeEvidenceIds: nonEmptyArray(draftPackage.runtimeEvidenceIds, [`EVIDENCE:${routeRepositoryId}`]),
      status: "PROPOSED",
      currentState: "PLANNED",
    })),
    stationProjectionDecisionTrace: stationProjection.stationProjectionDecisionTrace,
    stationProjectionSummary: stationProjection.stationProjectionSummary,
    submitHydration: {
      source: "COMMERCIAL_ROUTE_REPOSITORY",
      routeRepositoryId,
      proposalId: proposal?.proposalId ?? draftPackage.proposalId,
      noRegeneration: true,
      noRecalculation: true,
      noScopeVersionCreation: true,
    },
  };
}

function freezeCommercialAuditProjectionBaseline(draftPackage, timestamp) {
  const projection = asRecord(draftPackage.spineAuditProjection);
  if (!projection.projectionId) return draftPackage;
  const frozenProjection = {
    ...projection,
    baselineState: "FROZEN",
    baselineFrozenAt: projection.baselineFrozenAt ?? timestamp,
    baselineProjectionId: projection.baselineProjectionId ?? projection.projectionId,
    attachments: asArray(projection.attachments).map((attachment) => ({
      ...asRecord(attachment),
      status: asRecord(attachment).status === "PROJECTED" ? "FROZEN" : asRecord(attachment).status,
    })),
    summary: {
      ...asRecord(projection.summary),
      baselineFrozen: true,
    },
  };
  return {
    ...draftPackage,
    spineAuditProjection: frozenProjection,
    spineAuditAttachments: frozenProjection.attachments,
    stationedExpectations: asArray(frozenProjection.stationedExpectations),
    stationRangeExpectations: asArray(frozenProjection.stationRangeExpectations),
    spineReviewObjects: asArray(frozenProjection.spineReviewObjects),
    closureExpectations: asArray(frozenProjection.closureExpectations),
    auditProjectionSummary: frozenProjection.summary,
    commercialBaselineFrozen: true,
    commercialBaselineFrozenAt: frozenProjection.baselineFrozenAt,
  };
}

function requireCommercialPackageUser(req, res) {
  const user = userFromBearerToken(req);
  if (!user) {
    errorResponse(res, 401, "Authentication token is missing or invalid.");
    return null;
  }
  const allowed = ["workspace.commercial", "workspace.proposal", "proposal.manage"].some((permission) => userHasPermission(user, permission));
  if (!allowed) {
    errorResponse(res, 403, "Only Commercial proposal authority may assemble Draft IOF Packages.");
    return null;
  }
  return user;
}

function normalizeCommercialDraftPackage(raw, user) {
  const timestamp = nowIso();
  const proposalId = String(raw.proposalId ?? "").trim();
  const packageId = String(raw.packageId ?? raw.draftPackageId ?? `DRAFT-IOF-${stableIdPart(proposalId || "COMMERCIAL")}`);
  const createdAt = raw.createdAt ?? timestamp;
  return {
    ...raw,
    packageId,
    draftPackageId: String(raw.draftPackageId ?? packageId),
    packageType: "ENGINEERING",
    status: "DRAFT",
    workflowStatus: raw.workflowStatus ?? "ENGINEERING_REVIEW",
    organizationId: raw.organizationId ?? user.organizationId,
    workspaceId: raw.workspaceId ?? user.workspaceId,
    ownerId: raw.ownerId ?? user.userId,
    owner: raw.owner ?? user.name,
    visibility: raw.visibility ?? "ORGANIZATION",
    authority: "COMMERCIAL_DRAFT_IOF_PACKAGE",
    lifecycleState: raw.lifecycleState ?? "IN_REVIEW",
    assignedEngineerId: raw.assignedEngineerId ?? "",
    assignedEngineer: raw.assignedEngineer ?? "Unassigned",
    priority: raw.priority ?? "NORMAL",
    proposedIofUnits: Array.isArray(raw.proposedIofUnits) ? raw.proposedIofUnits : [],
    runtimeObjectIds: uniqueStrings([raw.runtimeObjectIds]),
    runtimeRelationshipIds: uniqueStrings([raw.runtimeRelationshipIds]),
    runtimeEvidenceIds: uniqueStrings([raw.runtimeEvidenceIds]),
    existingInventoryReferences: uniqueStrings([raw.existingInventoryReferences]),
    customerDesignReferences: uniqueStrings([raw.customerDesignReferences]),
    geometryReferences: uniqueStrings([raw.geometryReferences]),
    commercialObjectPlacementHistory: Array.isArray(raw.commercialObjectPlacementHistory) ? raw.commercialObjectPlacementHistory : [],
    customerRequestedMoves: Array.isArray(raw.customerRequestedMoves) ? raw.customerRequestedMoves : [],
    commercialImpactSummary: raw.commercialImpactSummary ?? {
      status: "NO_COMMERCIAL_STATION_MOVES",
      requiresEngineeringReview: "NO",
      noCertification: true,
      noScopeVersionCreation: true,
    },
    commercialImpactSummaries: Array.isArray(raw.commercialImpactSummaries) ? raw.commercialImpactSummaries : [],
    commercialReviewRevision: Number(raw.commercialReviewRevision ?? 0),
    historyIds: uniqueStrings([raw.historyIds, `${packageId}:HISTORY:COMMERCIAL_ASSEMBLED`]),
    noScopeVersionCreation: true,
    noMarketplaceCreation: true,
    noControlCreation: true,
    noFieldCreation: true,
    noContractCreation: true,
    noSofCreation: true,
    immutable: false,
    sourceSystem: "IOFPackageAssemblyEngine",
    createdAt,
    updatedAt: timestamp,
  };
}

export async function loadCommercialDraftIofPackageForProposal(proposalId) {
  const packages = sortedByUpdated(await listRecords(DIRS.iofPackages));
  return packages.find((record) =>
    String(record?.proposalId ?? "") === String(proposalId ?? "") &&
    (record?.authority === "COMMERCIAL_DRAFT_IOF_PACKAGE" || record?.sourceSystem === "IOFPackageAssemblyEngine") &&
    !["CERTIFIED", "CLOSED", "ARCHIVED"].includes(String(record?.status ?? "").toUpperCase())
  ) ?? null;
}

async function persistCommercialPackageRuntime(packageRecord, user) {
  const timestamp = nowIso();
  const runtimeObjectId = `RUNTIME-DRAFT-IOF-${stableIdPart(packageRecord.packageId)}`;
  await persistRecord(DIRS.runtimeObjects, runtimeObjectId, {
    runtimeObjectId,
    objectId: packageRecord.packageId,
    objectType: "DRAFT_IOF_PACKAGE",
    sourceObjectType: "COMMERCIAL_DRAFT_IOF_PACKAGE",
    sourceSystem: "IOFPackageAssemblyEngine",
    organizationId: packageRecord.organizationId,
    workspaceId: packageRecord.workspaceId,
    ownerId: packageRecord.ownerId,
    owner: packageRecord.owner,
    proposalId: packageRecord.proposalId,
    accountId: packageRecord.accountId,
    customerId: packageRecord.customerId,
    opportunityId: packageRecord.opportunityId,
    lifecycleState: packageRecord.lifecycleState,
    status: packageRecord.status,
    workflowStatus: packageRecord.workflowStatus,
    noScopeVersionCreation: true,
    createdAt: packageRecord.createdAt,
    updatedAt: timestamp,
  });
  const historyId = `${packageRecord.packageId}:HISTORY:COMMERCIAL_ASSEMBLED`;
  await persistRecord(DIRS.runtimeHistory, historyId, {
    historyId,
    objectId: packageRecord.packageId,
    runtimeObjectId,
    objectType: "DRAFT_IOF_PACKAGE",
    eventType: "COMMERCIAL_DRAFT_IOF_PACKAGE_ASSEMBLED",
    actorId: user.userId,
    actorName: user.name,
    actorRole: user.role,
    organizationId: packageRecord.organizationId,
    workspaceId: packageRecord.workspaceId,
    accountId: packageRecord.accountId,
    customerId: packageRecord.customerId,
    opportunityId: packageRecord.opportunityId,
    proposalId: packageRecord.proposalId,
    packageId: packageRecord.packageId,
    authority: "COMMERCIAL",
    noScopeVersionCreation: true,
    timestamp,
    createdAt: timestamp,
    updatedAt: timestamp,
    details: "Commercial assembled deterministic Draft IOF Package JSON for Engineering review.",
  });
}

async function persistEngineeringIntakeRecord(draftPackage, user, engineeringPackage = null) {
  const timestamp = nowIso();
  const intakeId = `ENGINEERING-INTAKE-${stableIdPart(draftPackage.packageId)}`;
  const intakeRecord = {
    intakeId,
    engineeringPackageId: engineeringPackage?.engineeringPackageId,
    packageId: draftPackage.packageId,
    draftPackageId: draftPackage.draftPackageId ?? draftPackage.packageId,
    status: "SUBMITTED_TO_ENGINEERING",
    workflowStatus: "ENGINEERING_INTAKE",
    lifecycleState: "AWAITING_ENGINEERING_REVIEW",
    authority: "ENGINEERING_INTAKE",
    customerId: draftPackage.customerId,
    customerName: draftPackage.customerSummary?.name ?? draftPackage.customerName ?? draftPackage.customerId,
    accountId: draftPackage.accountId,
    opportunityId: draftPackage.opportunityId,
    proposalId: draftPackage.proposalId,
    commercialProposalId: engineeringPackage?.proposalId ?? draftPackage.proposalId,
    commercialWorkbookId: engineeringPackage?.commercialWorkbookId,
    workbookId: engineeringPackage?.workbookId,
    estimateId: engineeringPackage?.estimateId,
    routeRepositoryId: engineeringPackage?.routeRepositoryId,
    measuredCenterlineId: engineeringPackage?.measuredCenterlineId,
    stationGraphId: engineeringPackage?.stationGraphId,
    stationAuthorityIds: engineeringPackage?.stationAuthorityIds,
    stationObjectManifestId: engineeringPackage?.stationObjectManifestId,
    projectedObjectManifestId: engineeringPackage?.projectedObjectManifestId,
    draftIofPackageId: engineeringPackage?.draftIOFPackageId ?? draftPackage.packageId,
    productId: draftPackage.productId,
    productName: draftPackage.productName,
    doctrineId: draftPackage.doctrineId,
    productDoctrineVersion: draftPackage.productDoctrineVersion,
    packageRevision: draftPackage.packageRevision ?? draftPackage.revision ?? 0,
    commercialReviewRevision: draftPackage.commercialReviewRevision ?? 0,
    customerRequestedMoveCount: asArray(draftPackage.customerRequestedMoves).length,
    commercialImpactStatus: draftPackage.commercialImpactSummary?.status,
    assignedEngineerId: draftPackage.assignedEngineerId ?? "",
    assignedEngineer: draftPackage.assignedEngineer || "Unassigned",
    commercialRevisionLocked: true,
    submittedBy: user.name,
    submittedById: user.userId,
    submittedAt: draftPackage.submittedAt ?? timestamp,
    openedAt: draftPackage.engineeringOpenedAt,
    openedBy: draftPackage.engineeringOpenedBy,
    certifiedAt: draftPackage.certifiedAt,
    certifiedPackageId: draftPackage.certifiedPackageId,
    noScopeVersionCreation: true,
    createdAt: draftPackage.engineeringIntakeCreatedAt ?? timestamp,
    updatedAt: timestamp,
  };
  await persistRecord(DIRS.engineeringIntakes, intakeId, intakeRecord);
  const runtimeObjectId = `RUNTIME-DRAFT-IOF-${stableIdPart(draftPackage.packageId)}`;
  await persistRecord(DIRS.runtimeObjects, runtimeObjectId, {
    runtimeObjectId,
    objectId: draftPackage.packageId,
    objectType: "DRAFT_IOF_PACKAGE",
    sourceObjectType: "COMMERCIAL_DRAFT_IOF_PACKAGE",
    sourceSystem: "IOFPackageAssemblyEngine",
    organizationId: draftPackage.organizationId,
    workspaceId: draftPackage.workspaceId,
    ownerId: draftPackage.ownerId,
    owner: draftPackage.owner,
    proposalId: draftPackage.proposalId,
    accountId: draftPackage.accountId,
    customerId: draftPackage.customerId,
    opportunityId: draftPackage.opportunityId,
    lifecycleState: draftPackage.lifecycleState,
    status: draftPackage.status,
    workflowStatus: draftPackage.workflowStatus,
    engineeringIntakeId: intakeId,
    engineeringPackageId: engineeringPackage?.engineeringPackageId,
    noScopeVersionCreation: true,
    createdAt: draftPackage.createdAt,
    updatedAt: timestamp,
  });
  await persistRecord(DIRS.runtimeHistory, `${draftPackage.packageId}:HISTORY:SUBMITTED_TO_ENGINEERING`, {
    historyId: `${draftPackage.packageId}:HISTORY:SUBMITTED_TO_ENGINEERING`,
    objectId: draftPackage.packageId,
    runtimeObjectId,
    objectType: "DRAFT_IOF_PACKAGE",
    eventType: "COMMERCIAL_DRAFT_IOF_PACKAGE_SUBMITTED_TO_ENGINEERING",
    actorId: user.userId,
    actorName: user.name,
    actorRole: user.role,
    organizationId: draftPackage.organizationId,
    workspaceId: draftPackage.workspaceId,
    accountId: draftPackage.accountId,
    customerId: draftPackage.customerId,
    opportunityId: draftPackage.opportunityId,
    proposalId: draftPackage.proposalId,
    packageId: draftPackage.packageId,
    engineeringIntakeId: intakeId,
    engineeringPackageId: engineeringPackage?.engineeringPackageId,
    authority: "COMMERCIAL",
    noScopeVersionCreation: true,
    timestamp,
    createdAt: timestamp,
    updatedAt: timestamp,
    details: "Commercial locked the Draft IOF Package revision and created an immutable Engineering Package reference in the Engineering Repository.",
  });
  return intakeRecord;
}

async function updateCommercialOpportunitySubmittedToEngineering(draftPackage, engineeringPackage, user) {
  if (!draftPackage.opportunityId) return null;
  const opportunity = await loadRecord(DIRS.commercialOpportunities, draftPackage.opportunityId).catch(() => null);
  if (!opportunity) return null;
  const timestamp = nowIso();
  const next = {
    ...opportunity,
    status: "SUBMITTED_TO_ENGINEERING",
    commercialStatus: "SUBMITTED_TO_ENGINEERING",
    commercialLifecycleStatus: "SUBMITTED_TO_ENGINEERING",
    engineeringStatus: "ENGINEERING_PENDING",
    engineeringPackageId: engineeringPackage.engineeringPackageId,
    draftIofPackageId: engineeringPackage.draftIOFPackageId,
    routeRepositoryId: engineeringPackage.routeRepositoryId || opportunity.routeRepositoryId,
    proposalId: engineeringPackage.proposalId || opportunity.proposalId,
    commercialWorkbookId: engineeringPackage.commercialWorkbookId || opportunity.commercialWorkbookId,
    workbookId: engineeringPackage.workbookId || opportunity.workbookId,
    estimateId: engineeringPackage.estimateId || opportunity.estimateId,
    measuredCenterlineId: engineeringPackage.measuredCenterlineId,
    stationGraphId: engineeringPackage.stationGraphId,
    stationAuthorityIds: engineeringPackage.stationAuthorityIds,
    stationObjectManifestId: engineeringPackage.stationObjectManifestId,
    projectedObjectManifestId: engineeringPackage.projectedObjectManifestId,
    engineeringHandoff: {
      engineeringPackageId: engineeringPackage.engineeringPackageId,
      engineeringRepository: "server/data/engineering-packages",
      status: "SUBMITTED_TO_ENGINEERING",
      submittedBy: user.name,
      submittedById: user.userId,
      submittedAt: engineeringPackage.submittedAt,
      referenceHash: engineeringPackage.referenceHash,
      noCommercialDataDuplication: true,
      noScopeVersionCreation: true,
    },
    updatedAt: timestamp,
  };
  await persistRecord(DIRS.commercialOpportunities, next.opportunityId, next);
  return next;
}

async function updateProposalSubmittedToEngineering(draftPackage, engineeringPackage, user) {
  const proposalId = firstText(engineeringPackage.proposalId, draftPackage.proposalId);
  if (!proposalId) return null;
  const proposal = await loadRecord(DIRS.proposalDrafts, proposalId).catch(() => null);
  if (!proposal) return null;
  const timestamp = nowIso();
  const next = {
    ...proposal,
    status: PROPOSAL_STATUS_ENGINEERING_SUBMITTED,
    commercialStatus: PROPOSAL_STATUS_ENGINEERING_SUBMITTED,
    engineeringStatus: "ENGINEERING_PENDING",
    engineeringPackageId: engineeringPackage.engineeringPackageId,
    draftIofPackageId: engineeringPackage.draftIOFPackageId,
    routeRepositoryId: firstText(engineeringPackage.routeRepositoryId, proposal.routeRepositoryId),
    commercialWorkbookId: firstText(engineeringPackage.commercialWorkbookId, proposal.commercialWorkbookId),
    workbookId: firstText(engineeringPackage.workbookId, proposal.workbookId, proposal.commercialWorkbookId),
    estimateId: firstText(engineeringPackage.estimateId, proposal.estimateId),
    measuredCenterlineId: engineeringPackage.measuredCenterlineId,
    stationGraphId: engineeringPackage.stationGraphId,
    stationAuthorityIds: engineeringPackage.stationAuthorityIds,
    stationObjectManifestId: engineeringPackage.stationObjectManifestId,
    projectedObjectManifestId: engineeringPackage.projectedObjectManifestId,
    nextLifecycleAction: "OPEN_ENGINEERING_CERTIFICATION",
    engineeringHandoff: {
      engineeringPackageId: engineeringPackage.engineeringPackageId,
      engineeringRepository: "server/data/engineering-packages",
      status: PROPOSAL_STATUS_ENGINEERING_SUBMITTED,
      submittedBy: user.name,
      submittedById: user.userId,
      submittedAt: engineeringPackage.submittedAt,
      referenceHash: engineeringPackage.referenceHash,
      proposalAuthority: "PROPOSAL_REPOSITORY",
      noAcceptedProposalAuthority: true,
      noScopeVersionCreation: true,
    },
    modifiedDate: timestamp,
    updatedAt: timestamp,
    noScopeVersionCreation: true,
  };
  await persistRecord(DIRS.proposalDrafts, next.proposalRecordId ?? next.proposalId, next);
  return next;
}

async function submitCommercialDraftPackageToEngineering(rawDraftPackage, user, options = {}) {
  const transactionLog = options.transactionLog ?? [];
  const timestamp = nowIso();
  let savedDraftPackage = normalizeCommercialDraftPackage(rawDraftPackage, user);
  const previousDraftPackage = await loadRecord(DIRS.iofPackages, savedDraftPackage.packageId).catch(() => null);
  let opportunityForSubmit = null;
  let proposalForSubmit = null;
  let stationReadiness;
  try {
    appendEngineeringTransactionStep(
      transactionLog,
      ENGINEERING_TRANSACTION_STEPS.VALIDATE_COMMERCIAL_PACKAGE,
      "Validate Commercial Package",
      "START",
      {
        file: "server/routes/commercial-iof-packages.js",
        objectType: "CommercialDraftIOFPackage",
        payloadSizeBytes: options.requestBodyByteLength,
        details: { packageId: savedDraftPackage.packageId },
      },
    );
    opportunityForSubmit = savedDraftPackage.opportunityId
      ? await loadRecord(DIRS.commercialOpportunities, savedDraftPackage.opportunityId).catch(() => null)
      : null;
    proposalForSubmit = savedDraftPackage.proposalId
      ? await loadRecord(DIRS.proposalDrafts, savedDraftPackage.proposalId).catch(() => null)
      : null;
    const proposalStatus = canonicalProposalRepositoryStatus(proposalForSubmit?.status);
    const priorDraftStatus = firstText(
      previousDraftPackage?.status,
      previousDraftPackage?.lifecycleState,
      previousDraftPackage?.engineeringStatus,
      rawDraftPackage?.status,
      rawDraftPackage?.lifecycleState,
      rawDraftPackage?.engineeringStatus,
    );
    const alreadyEngineeringSubmitted = proposalStatus === PROPOSAL_STATUS_ENGINEERING_SUBMITTED
      && ["SUBMITTED_TO_ENGINEERING", "SUBMITTED"].includes(priorDraftStatus);
    if (!proposalForSubmit) {
      const error = new Error(`Commercial Package validation failed: Proposal Repository record not found for ${savedDraftPackage.proposalId}.`);
      error.status = 409;
      throw error;
    }
    if (proposalStatus !== PROPOSAL_STATUS_COMMERCIAL_APPROVED && !alreadyEngineeringSubmitted) {
      const error = new Error(`Commercial Package validation failed: Proposal Repository status must be COMMERCIAL_APPROVED before Engineering submission. Current status: ${proposalStatus || "UNKNOWN"}.`);
      error.status = 409;
      throw error;
    }
    const missingReferences = [
      ["proposalId", savedDraftPackage.proposalId],
      ["estimateId", firstText(savedDraftPackage.estimateId, savedDraftPackage.commercialEstimateId, asRecord(savedDraftPackage.commercialSummary).estimateId, asRecord(savedDraftPackage.pricingSummary).estimateId, opportunityForSubmit?.estimateId, asRecord(opportunityForSubmit?.estimate).estimateId, asRecord(opportunityForSubmit?.commercialEstimate).estimateId)],
      ["commercialWorkbookId", firstText(savedDraftPackage.commercialWorkbookId, savedDraftPackage.workbookId, asRecord(savedDraftPackage.commercialSummary).workbookId, opportunityForSubmit?.commercialWorkbookId, opportunityForSubmit?.workbookId, asRecord(opportunityForSubmit?.commercialWorkbook).workbookId, asRecord(opportunityForSubmit?.commercialSnapshot).workbookId)],
      ["draftIOFPackageId", savedDraftPackage.packageId],
      ["routeRepositoryId", firstText(savedDraftPackage.routeRepositoryId, asRecord(savedDraftPackage.routeRepositoryRef).routeRepositoryId, asRecord(savedDraftPackage.commercialSummary).routeRepositoryId, opportunityForSubmit?.routeRepositoryId, asRecord(opportunityForSubmit?.routeRepositoryRef).routeRepositoryId, asRecord(opportunityForSubmit?.commercialSnapshot).routeRepositoryId, asRecord(asRecord(opportunityForSubmit?.commercialSnapshot).routeRepositoryRef).routeRepositoryId)],
    ].filter(([, value]) => !String(value ?? "").trim());
    if (missingReferences.length) {
      const error = new Error(`Commercial Package validation failed: missing ${missingReferences.map(([field]) => field).join(", ")}`);
      error.status = 409;
      throw error;
    }
    savedDraftPackage = await hydrateStationAwareDraftPackageForSubmit(savedDraftPackage, opportunityForSubmit, proposalForSubmit);
    stationReadiness = stationAwareSubmitReadiness(savedDraftPackage);
    if (!stationReadiness.canSubmitToEngineering) {
      const error = new Error(`Commercial station-aware review blocks Engineering submission: ${stationReadiness.blockingIssues.join("; ")}`);
      error.status = 409;
      error.stationProjectionDecisionTrace = savedDraftPackage.stationProjectionDecisionTrace ?? [
        { step: "Station Projection Readiness", status: "FAIL", blockingIssues: stationReadiness.blockingIssues },
      ];
      throw error;
    }
    appendEngineeringTransactionStep(
      transactionLog,
      ENGINEERING_TRANSACTION_STEPS.VALIDATE_COMMERCIAL_PACKAGE,
      "Validate Commercial Package",
      "OK",
      {
        file: "server/routes/commercial-iof-packages.js",
        objectType: "CommercialDraftIOFPackage",
        details: { packageId: savedDraftPackage.packageId, status: stationReadiness.status },
      },
    );
  } catch (error) {
    throwEngineeringTransactionError(
      transactionLog,
      ENGINEERING_TRANSACTION_STEPS.VALIDATE_COMMERCIAL_PACKAGE,
      "Validate Commercial Package",
      error,
      {
        file: "server/routes/commercial-iof-packages.js",
        objectType: "CommercialDraftIOFPackage",
        payloadSizeBytes: options.requestBodyByteLength,
        details: {
          stationProjectionDecisionTrace: error.stationProjectionDecisionTrace,
          stationReadiness,
        },
      },
    );
  }
  const frozenDraftPackage = freezeCommercialAuditProjectionBaseline(savedDraftPackage, timestamp);
  const submitted = {
    ...frozenDraftPackage,
    commercialStationReviewReadiness: stationReadiness,
    status: "SUBMITTED_TO_ENGINEERING",
    workflowStatus: "ENGINEERING_INTAKE",
    lifecycleState: "SUBMITTED_TO_ENGINEERING",
    engineeringStatus: "SUBMITTED",
    engineeringReadiness: "SUBMITTED_TO_ENGINEERING",
    commercialRevisionLocked: true,
    commercialLockedAt: timestamp,
    commercialLockedBy: user.name,
    commercialLockedById: user.userId,
    submittedAt: timestamp,
    submittedToEngineeringAt: timestamp,
    submittedBy: user.name,
    submittedById: user.userId,
    historyIds: uniqueStrings([
      savedDraftPackage.historyIds,
      `${savedDraftPackage.packageId}:HISTORY:COMMERCIAL_ASSEMBLED`,
      `${savedDraftPackage.packageId}:HISTORY:SUBMITTED_TO_ENGINEERING`,
    ]),
    noScopeVersionCreation: true,
    updatedAt: timestamp,
  };
  let draftPersisted = false;
  try {
    await persistRecord(DIRS.iofPackages, submitted.packageId, submitted);
    draftPersisted = true;
    const opportunity = opportunityForSubmit ?? (submitted.opportunityId ? await loadRecord(DIRS.commercialOpportunities, submitted.opportunityId).catch(() => null) : null);
    let engineeringPackageRecord;
    try {
      appendEngineeringTransactionStep(
        transactionLog,
        ENGINEERING_TRANSACTION_STEPS.BUILD_ENGINEERING_PACKAGE,
        "Build Engineering Package",
        "START",
        {
          file: "server/routes/commercial-iof-packages.js",
          objectType: "EngineeringPackage",
          details: { draftIOFPackageId: submitted.packageId },
        },
      );
      engineeringPackageRecord = buildEngineeringPackageFromDraftPackage(submitted, { opportunity, user, timestamp });
      appendEngineeringTransactionStep(
        transactionLog,
        ENGINEERING_TRANSACTION_STEPS.BUILD_ENGINEERING_PACKAGE,
        "Build Engineering Package",
        "OK",
        {
          file: "server/routes/commercial-iof-packages.js",
          objectType: "EngineeringPackage",
          engineeringPackageId: engineeringPackageRecord.engineeringPackageId,
          payloadSizeBytes: serializedByteSize(engineeringPackageRecord),
        },
      );
      appendEngineeringTransactionStep(
        transactionLog,
        ENGINEERING_TRANSACTION_STEPS.SERIALIZE_ENGINEERING_PACKAGE,
        "Serialize Engineering Package",
        "OK",
        {
          file: "server/routes/commercial-iof-packages.js",
          objectType: "EngineeringPackage",
          engineeringPackageId: engineeringPackageRecord.engineeringPackageId,
          payloadSizeBytes: serializedByteSize(engineeringPackageRecord),
        },
      );
    } catch (error) {
      throwEngineeringTransactionError(
        transactionLog,
        ENGINEERING_TRANSACTION_STEPS.BUILD_ENGINEERING_PACKAGE,
        "Build Engineering Package",
        error,
        {
          file: "server/routes/commercial-iof-packages.js",
          objectType: "EngineeringPackage",
        },
      );
    }
    appendEngineeringTransactionStep(
      transactionLog,
      ENGINEERING_TRANSACTION_STEPS.POST_ENGINEERING_PACKAGES,
      "POST /api/engineering/packages",
      "OK",
      {
        file: "server/routes/commercial-iof-packages.js",
        objectType: "EngineeringPackage",
        engineeringPackageId: engineeringPackageRecord.engineeringPackageId,
        payloadSizeBytes: serializedByteSize(engineeringPackageRecord),
        details: { transactionCoordinator: "CommercialDraftIOFPackageSubmit" },
      },
    );
    const engineeringPackage = await persistEngineeringPackage(
      engineeringPackageRecord,
      user,
      {
        transactionLog,
        requestBodyByteLength: serializedByteSize(engineeringPackageRecord),
      },
    );
    let verifiedEngineeringPackage;
    try {
      verifiedEngineeringPackage = await loadEngineeringPackage(engineeringPackage.engineeringPackageId);
    } catch (error) {
      throwEngineeringTransactionError(
        transactionLog,
        ENGINEERING_TRANSACTION_STEPS.RELOAD_ENGINEERING_PACKAGE,
        "Reload Engineering Package",
        error,
        {
          file: "server/routes/commercial-iof-packages.js",
          objectType: "EngineeringPackage",
          engineeringPackageId: engineeringPackage.engineeringPackageId,
        },
      );
    }
    const missingEngineeringReferences = [
      ["draftIOFPackageId", verifiedEngineeringPackage.draftIOFPackageId],
      ["proposalId", verifiedEngineeringPackage.proposalId],
      ["routeRepositoryId", verifiedEngineeringPackage.routeRepositoryId],
      ["measuredCenterlineId", verifiedEngineeringPackage.measuredCenterlineId],
      ["stationGraphId", verifiedEngineeringPackage.stationGraphId],
      ["stationAuthorityIds", asArray(verifiedEngineeringPackage.stationAuthorityIds).length ? verifiedEngineeringPackage.stationAuthorityIds.join(",") : ""],
      ["stationObjectManifestId", verifiedEngineeringPackage.stationObjectManifestId],
      ["projectedObjectManifestId", verifiedEngineeringPackage.projectedObjectManifestId],
      ["estimateId", verifiedEngineeringPackage.estimateId],
      ["commercialWorkbookId", verifiedEngineeringPackage.commercialWorkbookId],
      ["workbookId", verifiedEngineeringPackage.workbookId],
    ].filter(([, value]) => !String(value ?? "").trim());
    if (missingEngineeringReferences.length) {
      const error = new Error(`Engineering Package persistence verification failed: missing ${missingEngineeringReferences.map(([field]) => field).join(", ")}`);
      error.status = 409;
      throwEngineeringTransactionError(
        transactionLog,
        ENGINEERING_TRANSACTION_STEPS.VERIFY_ENGINEERING_PACKAGE,
        "Verify Engineering Package",
        error,
        {
          file: "server/routes/commercial-iof-packages.js",
          objectType: "EngineeringPackage",
          engineeringPackageId: verifiedEngineeringPackage.engineeringPackageId,
          payloadSizeBytes: serializedByteSize(verifiedEngineeringPackage),
        },
      );
    }
    const engineeringIntake = await persistEngineeringIntakeRecord(submitted, user, verifiedEngineeringPackage);
    const commercialOpportunity = await updateCommercialOpportunitySubmittedToEngineering(submitted, verifiedEngineeringPackage, user);
    const proposal = await updateProposalSubmittedToEngineering(submitted, verifiedEngineeringPackage, user);
    appendEngineeringTransactionStep(
      transactionLog,
      ENGINEERING_TRANSACTION_STEPS.UPDATE_COMMERCIAL_STATUS,
      "Update Commercial status",
      "OK",
      {
        file: "server/routes/commercial-iof-packages.js",
        objectType: "CommercialOpportunity",
        engineeringPackageId: verifiedEngineeringPackage.engineeringPackageId,
        details: {
          commercialStatus: commercialOpportunity?.commercialStatus ?? "SUBMITTED_TO_ENGINEERING",
          proposalRepositoryStatus: proposal?.status ?? PROPOSAL_STATUS_ENGINEERING_SUBMITTED,
        },
      },
    );
    appendEngineeringTransactionStep(
      transactionLog,
      ENGINEERING_TRANSACTION_STEPS.RETURN_ENGINEERING_PACKAGE_ID,
      "Return Engineering Package ID",
      "OK",
      {
        file: "server/routes/commercial-iof-packages.js",
        objectType: "EngineeringPackage",
        engineeringPackageId: verifiedEngineeringPackage.engineeringPackageId,
        payloadSizeBytes: serializedByteSize(verifiedEngineeringPackage),
      },
    );
    const draftSummary = draftPackageSubmitSummary(submitted, verifiedEngineeringPackage);
    return {
      draftPackage: draftSummary,
      iofPackage: draftSummary,
      engineeringIntake,
      engineeringPackage: {
        ...verifiedEngineeringPackage,
        engineeringTransactionLog: transactionLog,
      },
      commercialOpportunity: commercialOpportunitySubmitSummary(commercialOpportunity, verifiedEngineeringPackage),
      proposal,
      engineeringTransactionLog: transactionLog,
    };
  } catch (error) {
    if (draftPersisted) {
      if (previousDraftPackage) await persistRecord(DIRS.iofPackages, previousDraftPackage.packageId, previousDraftPackage).catch(() => null);
      else await deleteRecord(DIRS.iofPackages, submitted.packageId).catch(() => null);
    }
    if (!error.engineeringTransactionLog) error.engineeringTransactionLog = transactionLog;
    throw error;
  }
}

export async function handleCommercialIofPackages(req, res, pathname) {
  const normalizedPath = pathname.replace(/\/+$/, "");
  if (!normalizedPath.startsWith("/api/commercial/iof-packages")) return false;
  if (handleOptions(req, res)) return true;

  const user = requireCommercialPackageUser(req, res);
  if (!user) return true;

  if (normalizedPath === "/api/commercial/iof-packages" && req.method === "GET") {
    const packages = sortedByUpdated(await listRecords(DIRS.iofPackages))
      .filter((record) => record?.authority === "COMMERCIAL_DRAFT_IOF_PACKAGE" || record?.sourceSystem === "IOFPackageAssemblyEngine");
    jsonResponse(res, 200, { draftPackages: packages, iofPackages: packages });
    return true;
  }

  if (normalizedPath === "/api/commercial/iof-packages" && req.method === "POST") {
    const body = await readRequestJson(req);
    const raw = unwrapBody(body, "draftPackage", ["iofPackage", "package"]) ?? {};
    const draftPackage = normalizeCommercialDraftPackage(raw, user);
    const existing = await loadRecord(DIRS.iofPackages, draftPackage.packageId).catch(() => null);
    if (existing?.commercialRevisionLocked || ["SUBMITTED_TO_ENGINEERING", "UNDER_ENGINEERING_REVIEW", "CERTIFIED"].includes(String(existing?.status ?? ""))) {
      errorResponse(res, 409, "Commercial revision is locked after Engineering submission.");
      return true;
    }
    await persistRecord(DIRS.iofPackages, draftPackage.packageId, draftPackage);
    await persistCommercialPackageRuntime(draftPackage, user);
    jsonResponse(res, 201, { draftPackage, iofPackage: draftPackage });
    return true;
  }

  if (normalizedPath.startsWith("/api/commercial/iof-packages/") && normalizedPath.endsWith("/submit-engineering") && req.method === "POST") {
    const packageId = decodeURIComponent(normalizedPath
      .slice("/api/commercial/iof-packages/".length)
      .replace(/\/submit-engineering$/, ""));
    const transactionLog = [];
    const { byteLength } = await readRequestJsonWithRaw(req);
    const existing = await loadRecord(DIRS.iofPackages, packageId).catch(() => null);
    if (!existing) {
      errorResponse(res, 404, `Commercial Draft IOF Package not found: ${packageId}`);
      return true;
    }
    try {
      const result = await submitCommercialDraftPackageToEngineering(existing, user, {
        transactionLog,
        requestBodyByteLength: byteLength,
      });
      jsonResponse(res, 200, result);
    } catch (error) {
      jsonResponse(res, error.status ?? 500, {
        error: error.message ?? "Commercial Draft IOF Package submission failed.",
        transactionFailure: {
          step: error.transactionStep,
          label: error.transactionLabel,
          file: error.transactionFile,
          lineNumber: error.transactionLineNumber,
          objectType: error.objectType,
          payloadSizeBytes: error.payloadSizeBytes,
          exception: error.message,
          stackTrace: error.stack,
        },
        engineeringTransactionLog: error.engineeringTransactionLog ?? transactionLog,
      });
    }
    return true;
  }

  const id = decodeURIComponent(normalizedPath.slice("/api/commercial/iof-packages/".length));
  if (id && req.method === "GET") {
    try {
      const draftPackage = await loadRecord(DIRS.iofPackages, id);
      jsonResponse(res, 200, { draftPackage, iofPackage: draftPackage });
    } catch {
      errorResponse(res, 404, `Commercial Draft IOF Package not found: ${id}`);
    }
    return true;
  }

  return false;
}
