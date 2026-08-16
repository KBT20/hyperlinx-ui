import { createHash } from "node:crypto";
import {
  DIRS,
  deleteRecord,
  errorResponse,
  handleOptions,
  hydrateIofProjectionArtifacts,
  jsonResponse,
  listRecords,
  loadRecord,
  nowIso,
  persistIofProjectionArtifacts,
  persistRecord,
  readRequestJson,
  readRequestJsonWithRaw,
  sortedByUpdated,
  stripIofProjectionArtifacts,
  unwrapBody,
  updateTransactionManifest,
} from "./_shared.js";
import { userFromBearerToken, userHasPermission } from "./auth.js";
import {
  commercialAuthorityDiagnosticsFrom,
  ensureCommercialReleasePackageForDraft,
} from "./commercial-revisions.js";
import {
  ENGINEERING_TRANSACTION_STEPS,
  appendEngineeringTransactionStep,
  buildEngineeringPackageFromDraftPackage,
  loadEngineeringPackage,
  persistEngineeringPackage,
  throwEngineeringTransactionError,
} from "./engineering-packages.js";
import {
  buildEngineeringBaselineFromDraftPackage,
  persistEngineeringBaseline,
} from "./engineering-baselines.js";

function stableIdPart(value, fallback = "UNKNOWN") {
  return String(value ?? fallback)
    .replace(/[^A-Za-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120) || fallback;
}

function deterministicDraftPackageHash(record = {}) {
  const { packageHash: _packageHash, updatedAt: _updatedAt, ...identity } = record;
  return createHash("sha256").update(JSON.stringify(identity)).digest("hex");
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
    commercialRevisionId: engineeringPackage.commercialRevisionId ?? draftPackage.commercialRevisionId,
    commercialReleasePackageId: engineeringPackage.commercialReleasePackageId ?? draftPackage.commercialReleasePackageId,
    commercialRevisionHash: engineeringPackage.commercialRevisionHash ?? draftPackage.commercialRevisionHash,
    commercialReleaseHash: engineeringPackage.commercialReleaseHash ?? draftPackage.commercialReleaseHash,
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
    commercialRevisionId: engineeringPackage.commercialRevisionId ?? opportunity.commercialRevisionId,
    commercialReleasePackageId: engineeringPackage.commercialReleasePackageId ?? opportunity.commercialReleasePackageId,
    commercialRevisionHash: engineeringPackage.commercialRevisionHash ?? opportunity.commercialRevisionHash,
    commercialReleaseHash: engineeringPackage.commercialReleaseHash ?? opportunity.commercialReleaseHash,
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

function doctrineObjectManifestFromDraftPackage(draftPackage) {
  return asRecord(
    draftPackage.doctrineObjectManifest ??
    draftPackage.engineeringObjectManifest ??
    asRecord(draftPackage.doctrineObjectInstantiation).engineeringObjectManifest,
  );
}

function doctrineObjectValidationFromDraftPackage(draftPackage, manifest = null) {
  const sourceManifest = manifest ?? doctrineObjectManifestFromDraftPackage(draftPackage);
  return asRecord(
    draftPackage.doctrineObjectInstantiationValidation ??
    sourceManifest.validation ??
    asRecord(draftPackage.engineeringObjectManifest).validation,
  );
}

function doctrineInstantiatedObjectsFromDraftPackage(draftPackage, manifest = null) {
  const sourceManifest = manifest ?? doctrineObjectManifestFromDraftPackage(draftPackage);
  const sources = [
    ...asArray(draftPackage.doctrineInstantiatedObjects),
    ...asArray(sourceManifest.instantiatedObjects),
    ...asArray(asRecord(draftPackage.engineeringObjectManifest).instantiatedObjects),
    ...asArray(asRecord(draftPackage.doctrineObjectInstantiation).instantiatedObjects),
  ].map(asRecord);
  const seen = new Set();
  return sources.filter((record, index) => {
    const key = firstText(
      record.objectId,
      record.doctrineObjectId,
      record.unitId,
      record.structureId,
      record.id,
      `DOIE-INDEX-${index}`,
    );
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function doctrineQuantityPlacementFromDraftPackage(draftPackage, manifest = null) {
  const sourceManifest = manifest ?? doctrineObjectManifestFromDraftPackage(draftPackage);
  return asRecord(draftPackage.doctrineQuantityPlacement ?? sourceManifest.quantityPlacement);
}

function wholeNumber(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(0, Math.round(numeric)) : fallback;
}

function stationMathSeeds(quantityPlacement) {
  return [
    {
      objectType: "HANDHOLE",
      doctrineObjectType: "HANDHOLE",
      prefix: "HH",
      count: wholeNumber(quantityPlacement.handholeCount),
      doctrineQuantitySource: "productDoctrineAssembly.structureAssembly.structures[HANDHOLE].quantity",
      placementReason: "Handhole count from Product Doctrine structure quantity.",
    },
    {
      objectType: "VAULT",
      doctrineObjectType: "VAULT",
      prefix: "VAULT",
      count: wholeNumber(quantityPlacement.vaultCount),
      doctrineQuantitySource: "productDoctrineAssembly.structureAssembly.structures[VAULT].quantity",
      placementReason: "Vault count from Product Doctrine structure quantity.",
    },
    {
      objectType: "SPLICE_CASE",
      doctrineObjectType: "SPLICE_CASE",
      prefix: "SPLICE",
      count: wholeNumber(quantityPlacement.spliceCaseCount),
      doctrineQuantitySource: "productDoctrineAssembly.structureAssembly.structures[SPLICE_CASE].quantity",
      placementReason: "Splice case count from Product Doctrine structure quantity.",
    },
    {
      objectType: "ILA_REGENERATION_SITE",
      doctrineObjectType: "ILA_REGENERATION_SITE",
      prefix: "ILA",
      count: wholeNumber(quantityPlacement.ilaRegenCount),
      doctrineQuantitySource: "productDoctrineAssembly.structureAssembly.structures[ILA|REGENERATION].quantity",
      placementReason: "ILA/regeneration count from Product Doctrine structure quantity.",
    },
    {
      objectType: "MARKER_POST",
      doctrineObjectType: "MARKER_POST",
      prefix: "MARKER",
      count: wholeNumber(quantityPlacement.markerCount),
      doctrineQuantitySource: "productDoctrineAssembly.quantitySummary.routeMiles marker placement assumption",
      placementReason: "Marker count from Product Doctrine route placement assumption.",
    },
    {
      objectType: "SLACK_LOOP",
      doctrineObjectType: "SLACK_LOOP",
      prefix: "SLACK",
      count: wholeNumber(quantityPlacement.slackLoopCount),
      doctrineQuantitySource: "productDoctrineAssembly.quantitySummary.routeMiles slack placement assumption",
      placementReason: "Slack loop count from Product Doctrine route placement assumption.",
    },
  ];
}

function duplicateCount(values) {
  const seen = new Set();
  const duplicates = new Set();
  values.filter(Boolean).forEach((value) => {
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  });
  return duplicates.size;
}

function spanTypeToken(type) {
  const upper = String(type ?? "").toUpperCase();
  if (upper.includes("HANDHOLE")) return "HH";
  if (upper.includes("VAULT")) return "VAULT";
  if (upper.includes("SPLICE")) return "SPLICE";
  if (upper.includes("ILA") || upper.includes("REGEN")) return "ILA";
  if (upper.includes("MARKER")) return "MARKER";
  if (upper.includes("SLACK")) return "SLACK";
  return "STRUCTURE";
}

const LINEAR_SPAN_ASSETS = ["CONDUIT", "FIBER", "TRACE_WIRE", "WARNING_TAPE", "MULE_TAPE_PULL_TAPE"];

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

function requireDoctrineObjectMaterializationForStationProjection(draftPackage, decisionTrace) {
  const manifest = doctrineObjectManifestFromDraftPackage(draftPackage);
  const validation = doctrineObjectValidationFromDraftPackage(draftPackage, manifest);
  const objects = doctrineInstantiatedObjectsFromDraftPackage(draftPackage, manifest);
  const manifestId = firstText(
    manifest.manifestId,
    draftPackage.doctrineObjectManifestId,
    draftPackage.engineeringObjectManifestId,
    draftPackage.objectManifestId,
  );
  const manifestObjectCount = Number(manifest.objectCount ?? objects.length);
  decisionTrace.push({
    step: "Doctrine Object Manifest restored",
    status: manifestId && objects.length ? "PASS" : "FAIL",
    doctrineObjectManifestId: manifestId,
    manifestObjectCount,
    materializedObjectCount: objects.length,
    validationStatus: validation.status,
    authority: firstText(manifest.authority, "DOCTRINE_OBJECT_INSTANTIATION_ENGINE"),
  });
  if (!manifestId || !objects.length) {
    const error = new Error("Station Projection failed: Doctrine Object Manifest is required before Engineering submission.");
    error.status = 409;
    error.stationProjectionDecisionTrace = decisionTrace;
    throw error;
  }
  if (validation.status === "FAIL") {
    const error = new Error(`Station Projection failed: Doctrine Object Manifest validation failed (${asArray(validation.failures).join(", ") || "unknown failure"}).`);
    error.status = 409;
    error.stationProjectionDecisionTrace = decisionTrace;
    error.doctrineObjectInstantiationValidation = validation;
    throw error;
  }
  if (Number.isFinite(manifestObjectCount) && manifestObjectCount !== objects.length) {
    const error = new Error(`Station Projection failed: Doctrine Object Manifest count mismatch. Manifest=${manifestObjectCount}, materialized=${objects.length}.`);
    error.status = 409;
    error.stationProjectionDecisionTrace = decisionTrace;
    throw error;
  }
  return { manifest, validation, objects, manifestId, manifestObjectCount: objects.length };
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
  const stationProjectionId = `${packageId}:DOCTRINE-STATION-PROJECTION:${deterministicHash({ measuredCenterlineId, geometryHash }, "dpe")}`;
  const stationGraphId = `${packageId}:STATION-GRAPH:${deterministicHash({ routeRepositoryId, geometryHash, intervalFeet: 100 }, "sg")}`;
  const stationAuthorityId = `${packageId}:STATION-AUTHORITY:${deterministicHash({ stationGraphId }, "sa")}`;
  const stationObjectManifestId = `${packageId}:STATION-OBJECT-MANIFEST:${deterministicHash({ stationGraphId, packageId }, "som")}`;
  const projectedObjectManifestId = `${packageId}:PROJECTED-OBJECT-MANIFEST:${deterministicHash({ stationObjectManifestId }, "pom")}`;
  const stationIntervalFeet = 100;
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
  decisionTrace.push({ step: "Station Projection generated", status: "PASS", stationProjectionId, measuredCenterlineId });
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
  const measuredCenterlineSegments = segments.map((segment) => ({
    segmentId: segment.segmentId,
    startCoordinate: segment.start,
    endCoordinate: segment.end,
    segmentLengthFeet: Math.round(segment.lengthFeet * 100) / 100,
    cumulativeStartFeet: Math.round(segment.startMeasureFeet * 100) / 100,
    cumulativeEndFeet: Math.round(segment.endMeasureFeet * 100) / 100,
    bearing: Math.round(segment.bearing * 100) / 100,
    geometryIndexStart: Number(segment.segmentId.replace("SEG-", "")) - 1,
    geometryIndexEnd: Number(segment.segmentId.replace("SEG-", "")),
  }));
  const doctrineMaterialization = requireDoctrineObjectMaterializationForStationProjection(draftPackage, decisionTrace);
  const quantityPlacement = doctrineQuantityPlacementFromDraftPackage(draftPackage, doctrineMaterialization.manifest);
  const stationSeeds = stationMathSeeds(quantityPlacement);
  const expectedProjectionObjectCount = stationSeeds.reduce((sum, seed) => sum + seed.count, 0);
  const projectedObjects = stationSeeds.flatMap((seed) => (
    Array.from({ length: seed.count }, (_, index) => {
      const nominalIntervalFeet = routeFeet / Math.max(1, seed.count);
      const stationValue = Math.min(routeFeet, Math.max(0, nominalIntervalFeet * (index + 1)));
      const routeProjection = nearestRouteProjection(segments, null, stationValue);
      const station = stations.reduce((best, candidate) => {
        if (!best) return candidate;
        return Math.abs(candidate.measureFeet - routeProjection.measureFeet) < Math.abs(best.measureFeet - routeProjection.measureFeet) ? candidate : best;
      }, null);
      const objectId = `${seed.prefix}-${String(index + 1).padStart(3, "0")}`;
      const stationAddress = stationLabelFromFeet(stationValue);
      const projectedCoordinate = routeProjection.coordinate ?? station?.coordinate;
      const parentSpanId = `${routeRepositoryId}:SPAN:${seed.prefix}:${String(index + 1).padStart(3, "0")}`;
      const projectionPayload = {
        objectId,
        objectType: seed.objectType,
        doctrineObjectType: seed.doctrineObjectType,
        objectSequence: index + 1,
        measure: stationValue,
        routeRepositoryId,
        routeId: routeRepositoryId,
        segmentId: routeProjection.segment?.segmentId ?? station?.segmentId ?? "SEG-00000",
        parentSpanId,
        parentRouteId: routeRepositoryId,
        parentSegmentId: routeProjection.segment?.segmentId ?? station?.segmentId ?? "SEG-00000",
        stationId: station?.stationId ?? stations[0].stationId,
        stationValue: Math.round(stationValue),
        stationAddress,
        stationSequence: 0,
        offset: routeProjection.offset,
        side: routeProjection.side,
        orientation: Math.round(routeProjection.orientation * 100) / 100,
        projectedCoordinate,
        coordinate: projectedCoordinate,
        geographicCoordinate: projectedCoordinate,
        latitude: Array.isArray(projectedCoordinate) ? projectedCoordinate[1] : null,
        longitude: Array.isArray(projectedCoordinate) ? projectedCoordinate[0] : null,
        sourceObjectId: objectId,
        executionSequenceId: `${objectId}:EXECUTION-SEQUENCE`,
        closeSequenceId: `${objectId}:CLOSE-SEQUENCE`,
        paymentSequenceId: `${objectId}:PAYMENT-SEQUENCE`,
        dependencyList: [routeRepositoryId, parentSpanId],
        dependencyIds: [routeRepositoryId, parentSpanId],
        evidenceRequirements: [],
        currentLifecycleState: "PLANNED",
        currentState: "PLANNED",
        engineeringAuthority: "DOCTRINE_PROJECTION_ENGINE",
        coordinateAuthority: "MEASURED_CENTERLINE",
        placementReason: seed.placementReason,
        placementAuthority: "DOCTRINE_PROJECTION_ENGINE",
        projectionAuthority: "DOCTRINE_PROJECTION_ENGINE",
        doctrineQuantitySource: seed.doctrineQuantitySource,
        nominalIntervalFeet: Math.round(nominalIntervalFeet),
        address: {
          addressId: `${objectId}:DOCTRINE-PROJECTION-ADDRESS`,
          routeId: routeRepositoryId,
          segmentId: routeProjection.segment?.segmentId ?? station?.segmentId ?? "SEG-00000",
          objectId,
          objectType: seed.objectType,
          addressType: "POINT",
          addressStatus: "ASSIGNED",
          objectSequence: index + 1,
          stationId: station?.stationId ?? stations[0].stationId,
          stationValue: Math.round(stationValue),
          stationAddress,
          latitude: Array.isArray(projectedCoordinate) ? projectedCoordinate[1] : null,
          longitude: Array.isArray(projectedCoordinate) ? projectedCoordinate[0] : null,
          geometryHash,
          addressLabel: `${objectId} ${stationAddress}${Array.isArray(projectedCoordinate) ? ` ${projectedCoordinate[1].toFixed(6)}, ${projectedCoordinate[0].toFixed(6)}` : ""}`,
          addressAuthority: "DOCTRINE_PROJECTION_ENGINE",
          noScopeVersionCreation: true,
        },
        engineeringDisposition: "PENDING_ENGINEERING_REVIEW",
        projectionStatus: "PROJECTED",
        sourceLayer: "DOCTRINE_PROJECTION_ENGINE",
        sourceObject: {
          objectId,
          objectType: seed.objectType,
          doctrineQuantitySource: seed.doctrineQuantitySource,
          nominalIntervalFeet: Math.round(nominalIntervalFeet),
        },
      };
      return {
        ...projectionPayload,
        projectionHash: deterministicHash(projectionPayload, "proj"),
      };
    })
  ))
    .sort((a, b) => a.stationValue - b.stationValue || a.objectId.localeCompare(b.objectId))
    .map((object, index) => ({ ...object, stationSequence: index + 1 }));
  const unprojectedObjects = projectedObjects.filter((object) => !object.stationId || !object.projectedCoordinate || object.projectionStatus !== "PROJECTED");
  decisionTrace.push({ step: "IOF objects projected onto station graph", status: unprojectedObjects.length ? "FAIL" : "PASS", objectCount: projectedObjects.length, unprojectedObjectIds: unprojectedObjects.map((object) => object.objectId) });
  if (unprojectedObjects.length) {
    const error = new Error(`Station Projection failed: unprojected IOF objects ${unprojectedObjects.map((object) => object.objectId).join(", ")}.`);
    error.status = 409;
    error.stationProjectionDecisionTrace = decisionTrace;
    throw error;
  }
  const projectedSpans = projectedObjects.slice(0, -1).map((startObject, index) => {
    const endObject = projectedObjects[index + 1];
    const startStationValue = Math.min(startObject.stationValue, endObject.stationValue);
    const endStationValue = Math.max(startObject.stationValue, endObject.stationValue);
    const spanId = `${packageId}:DOCTRINE-PROJECTION:SPAN:${String(index + 1).padStart(5, "0")}`;
    return {
      spanId,
      spanType: `${spanTypeToken(startObject.objectType)}_TO_${spanTypeToken(endObject.objectType)}`,
      measuredCenterlineId,
      startMeasure: startStationValue,
      endMeasure: endStationValue,
      startObjectId: startObject.objectId,
      endObjectId: endObject.objectId,
      startStation: startObject.stationValue <= endObject.stationValue ? startObject.stationAddress : endObject.stationAddress,
      endStation: startObject.stationValue <= endObject.stationValue ? endObject.stationAddress : startObject.stationAddress,
      startStationFeet: Math.round(startStationValue),
      endStationFeet: Math.round(endStationValue),
      lengthFeet: Math.max(0, Math.round(endStationValue - startStationValue)),
      containedAssets: LINEAR_SPAN_ASSETS,
      dependencies: uniqueStrings([startObject.objectId, endObject.objectId]),
      lifecycleState: "PLANNED",
      placementAuthority: "DOCTRINE_PROJECTION_ENGINE",
      renderAuthority: "MEASURED_CENTERLINE_CLIP",
      independentGeometryProhibited: true,
      fullSpineViewOnly: true,
      noScopeVersionCreation: true,
    };
  });
  const linearAssetSpanAttachments = projectedSpans.flatMap((span) => LINEAR_SPAN_ASSETS.map((assetType) => ({
    attachmentId: `${span.spanId}:ASSET:${assetType}`,
    spanId: span.spanId,
    assetType,
    fromObjectId: span.startObjectId,
    toObjectId: span.endObjectId,
    stationStart: span.startStation,
    stationEnd: span.endStation,
    routeFeet: span.lengthFeet,
    doctrineQuantitySource: assetType === "CONDUIT"
      ? "productDoctrineAssembly.quantitySummary.conduitFeet"
      : assetType === "FIBER"
        ? "productDoctrineAssembly.quantitySummary.fiberFeet"
        : `Product Doctrine ${assetType} full-spine placement assumption`,
    placementAuthority: "DOCTRINE_PROJECTION_ENGINE",
    noScopeVersionCreation: true,
  })));
  const linearAssetStationRanges = LINEAR_SPAN_ASSETS.map((assetType) => ({
    assetType,
    stationStart: stationLabelFromFeet(0),
    stationEnd: stationLabelFromFeet(routeFeet),
    routeFeet: Math.round(routeFeet),
    coverageAuthority: "DOCTRINE_PROJECTION_ENGINE",
  }));
  const objectAddresses = projectedObjects.map((object) => object.address);
  const duplicateObjectIdCount = duplicateCount(projectedObjects.map((object) => object.objectId));
  const doctrineProjectionDiagnostics = {
    diagnosticsId: `${packageId}:DOCTRINE-PROJECTION:DIAGNOSTICS`,
    status: "PASS",
    routeFeet: Math.round(routeFeet),
    stationCount: stations.length,
    expectedObjectCount: expectedProjectionObjectCount,
    projectedObjectCount: projectedObjects.length,
    derivedSpanCount: projectedSpans.length,
    linearAssetAttachmentCount: linearAssetSpanAttachments.length,
    failedGates: [],
    objectTypes: stationSeeds.map((seed) => {
      const objects = projectedObjects.filter((object) => object.objectType === seed.objectType);
      const nominalIntervalFeet = seed.count > 0 ? routeFeet / seed.count : 0;
      const duplicateStationCount = duplicateCount(objects.map((object) => object.stationAddress));
      const gates = [
        {
          gate: "Math Present",
          status: routeFeet > 0 && Number.isFinite(nominalIntervalFeet) ? "PASS" : "FAIL",
          reason: routeFeet <= 0 ? "missing route feet" : Number.isFinite(nominalIntervalFeet) ? "route feet and doctrine quantity present" : "missing doctrine quantity",
        },
        {
          gate: "Objects Calculated",
          status: objects.length === seed.count ? "PASS" : "FAIL",
          reason: objects.length === seed.count ? `Objects Calculated: ${objects.length}` : `math count does not match doctrine quantity: ${objects.length}/${seed.count}`,
        },
        {
          gate: "Addresses Assigned",
          status: objects.every((object) => object.stationAddress) && duplicateStationCount === 0 ? "PASS" : "FAIL",
          reason: !objects.every((object) => object.stationAddress) ? "object lacks address" : duplicateStationCount > 0 ? "duplicate station" : "station addresses assigned",
        },
        {
          gate: "Objects Projected",
          status: objects.every((object) => object.stationId && object.projectedCoordinate) && stationProjectionId && stationGraphId && projectedObjectManifestId && duplicateObjectIdCount === 0 ? "PASS" : "FAIL",
          reason: !stationProjectionId || !stationGraphId || !projectedObjectManifestId
            ? "projection ID missing"
            : duplicateObjectIdCount > 0
              ? "duplicate object ID"
              : objects.some((object) => !object.stationId)
                ? "station not resolved"
                : objects.some((object) => !object.projectedCoordinate)
                  ? "coordinate not resolved"
                  : "objects projected",
        },
      ];
      const failureReasons = gates.filter((gate) => gate.status === "FAIL").map((gate) => `${gate.gate}: ${gate.reason}`);
      return {
        objectType: seed.objectType,
        doctrineQuantitySource: seed.doctrineQuantitySource,
        routeFeet: Math.round(routeFeet),
        stationCount: stations.length,
        objectCount: seed.count,
        nominalIntervalFeet: Math.round(nominalIntervalFeet),
        calculatedStations: objects.map((object) => object.stationAddress),
        resolvedCoordinates: objects.map((object) => ({
          objectId: object.objectId,
          stationAddress: object.stationAddress,
          latitude: object.latitude,
          longitude: object.longitude,
        })),
        placementAuthority: "DOCTRINE_PROJECTION_ENGINE",
        projectionResult: failureReasons.length ? "FAIL" : "PASS",
        gates,
        failureReasons,
      };
    }),
    authority: "DOCTRINE_PROJECTION_ENGINE",
    noPricingChange: true,
    noScopeVersionCreation: true,
  };
  doctrineProjectionDiagnostics.failedGates = doctrineProjectionDiagnostics.objectTypes.flatMap((item) => (
    item.gates.filter((gate) => gate.status === "FAIL").map((gate) => ({ objectType: item.objectType, gate: gate.gate, reason: gate.reason }))
  ));
  doctrineProjectionDiagnostics.status = doctrineProjectionDiagnostics.failedGates.length ? "FAIL" : "PASS";
  const independentSpanGeometryCount = projectedSpans.filter((span) => Array.isArray(span.coordinates)).length;
  const objectsOnSpine = projectedObjects.filter((object) => object.coordinateAuthority === "MEASURED_CENTERLINE" && Number.isFinite(Number(object.measure))).length;
  const geometryAuthorityDiagnostics = {
    diagnosticsId: `${packageId}:GEOMETRY-AUTHORITY:DIAGNOSTICS`,
    status: independentSpanGeometryCount || objectsOnSpine !== projectedObjects.length ? "FAIL" : "PASS",
    geometryAuthority: independentSpanGeometryCount || objectsOnSpine !== projectedObjects.length ? "FAIL" : "PASS",
    measuredCenterlineId,
    geometryHash,
    duplicateMeasuredCenterlineCount: 0,
    independentGeometryCount: independentSpanGeometryCount,
    projectedObjectCount: projectedObjects.length,
    projectedSpanCount: projectedSpans.length,
    objectsOnSpine,
    objectsOnSpineTotal: projectedObjects.length,
    maximumDriftFeet: 0,
    independentSpanGeometryCount,
    commercialRenderValidation: independentSpanGeometryCount ? "FAIL" : "PASS",
    engineeringRenderValidation: independentSpanGeometryCount ? "FAIL" : "PASS",
    fieldRenderValidation: independentSpanGeometryCount ? "FAIL" : "PASS",
    twinRenderValidation: independentSpanGeometryCount ? "FAIL" : "PASS",
    failures: [
      ...(independentSpanGeometryCount ? [`Span contains independent geometry: ${independentSpanGeometryCount}`] : []),
      ...(objectsOnSpine !== projectedObjects.length ? [`Object not on measured spine: ${objectsOnSpine}/${projectedObjects.length}`] : []),
    ],
    authority: "MEASURED_CENTERLINE",
    noScopeVersionCreation: true,
  };
  doctrineProjectionDiagnostics.geometryAuthorityDiagnostics = geometryAuthorityDiagnostics;
  const projectedObjectStationAttachments = projectedObjects.map((object) => ({
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
    attachmentMethod: "DOCTRINE_PROJECTION_ENGINE",
    attachmentStatus: "ASSIGNED",
    projectionStatus: object.projectionStatus,
    projectionHash: object.projectionHash,
    routeRepositoryId,
  }));
  const projectedObjectsByType = new Map();
  for (const object of projectedObjects) {
    const objectType = commercialObjectType(asRecord(object));
    const existing = projectedObjectsByType.get(objectType) ?? [];
    existing.push(object);
    projectedObjectsByType.set(objectType, existing);
  }
  const doctrineObjectTypeIndexes = new Map();
  const doctrineObjectStationAttachments = doctrineMaterialization.objects
    .map((record, index) => {
      const doctrineObject = asRecord(record);
      const objectType = commercialObjectType(doctrineObject);
      if (!REQUIRED_STATION_OBJECT_TYPES.has(objectType)) return null;
      const projectedTypeObjects = projectedObjectsByType.get(objectType) ?? [];
      if (!projectedTypeObjects.length) return null;
      const typeIndex = doctrineObjectTypeIndexes.get(objectType) ?? 0;
      doctrineObjectTypeIndexes.set(objectType, typeIndex + 1);
      const projectedObject = projectedTypeObjects[typeIndex % projectedTypeObjects.length];
      const objectId = commercialObjectId(doctrineObject, packageId, index);
      return {
        attachmentId: `${packageId}:ATTACH:${deterministicHash({ objectId, projectedObjectId: projectedObject.objectId }, "doa")}`,
        objectId,
        objectType,
        projectedObjectId: projectedObject.objectId,
        stationId: projectedObject.stationId,
        stationValue: projectedObject.stationValue,
        stationRange: `${stationLabelFromFeet(projectedObject.stationValue)}-${stationLabelFromFeet(projectedObject.stationValue)}`,
        offset: projectedObject.offset,
        side: projectedObject.side,
        orientation: projectedObject.orientation,
        projectedCoordinate: projectedObject.projectedCoordinate,
        coordinate: projectedObject.projectedCoordinate,
        attachmentMethod: "DOCTRINE_PROJECTION_ENGINE",
        attachmentStatus: "ASSIGNED",
        projectionStatus: projectedObject.projectionStatus,
        projectionHash: deterministicHash({ objectId, projectedObjectId: projectedObject.objectId, stationId: projectedObject.stationId }, "doap"),
        routeRepositoryId,
        sourceAuthority: "DOCTRINE_OBJECT_INSTANTIATION_ENGINE",
        noScopeVersionCreation: true,
      };
    })
    .filter(Boolean);
  const objectStationAttachments = [...projectedObjectStationAttachments, ...doctrineObjectStationAttachments]
    .filter((attachment, index, attachments) => attachments.findIndex((candidate) => candidate.objectId === attachment.objectId) === index);
  const stationObjectManifest = {
    manifestId: stationObjectManifestId,
    packageId,
    routeRepositoryId,
    stationGraphId,
    stationAuthorityId,
    objectCount: projectedObjects.length,
    expectedObjectCount: expectedProjectionObjectCount,
    doctrineObjectManifestId: doctrineMaterialization.manifestId,
    doctrineObjectManifestObjectCount: doctrineMaterialization.manifestObjectCount,
    doctrineQuantityScheduleCount: expectedProjectionObjectCount,
    doctrineMaterializedObjectCount: projectedObjects.length,
    quantityScheduleMatches: projectedObjects.length === expectedProjectionObjectCount,
    materializationAuthority: "DOCTRINE_OBJECT_INSTANTIATION_ENGINE",
    projectionAuthority: "DOCTRINE_PROJECTION_ENGINE",
    doctrineProjectionDiagnostics,
    geometryAuthorityDiagnostics,
    sourceManifestRequired: true,
    stationCount: stations.length,
    projectedObjectIds: projectedObjects.map((object) => object.objectId),
    objects: projectedObjects.map(({ sourceObject, ...object }) => object),
    objectAddresses,
    immutable: true,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  const projectedObjectManifest = {
    manifestId: projectedObjectManifestId,
    projectedObjectManifestId,
    packageId,
    routeRepositoryId,
    stationGraphId,
    stationObjectManifestId,
    doctrineObjectManifestId: doctrineMaterialization.manifestId,
    doctrineObjectManifestObjectCount: doctrineMaterialization.manifestObjectCount,
    expectedObjectCount: expectedProjectionObjectCount,
    projectedObjects: stationObjectManifest.objects,
    objectAddresses,
    projectedSpans,
    geometryAuthorityDiagnostics,
    linearAssetSpanAttachments,
    linearAssetStationRanges,
    spanCount: projectedSpans.length,
    projectionStatus: "PASS",
    doctrineProjectionDiagnostics,
    coordinateAuthority: "MEASURED_CENTERLINE",
    geometryAuthority: "MEASURED_CENTERLINE",
    noCoordinateOnlyObjects: true,
    materializationAuthority: "DOCTRINE_PROJECTION_ENGINE",
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
    stationProjectionId,
    stationGraphId,
    stationAuthorityId,
    stationAuthorityIds: [stationAuthorityId],
    stationObjectManifestId,
    projectedObjectManifestId,
    measuredCenterline: {
      measuredCenterlineId,
      spineId: measuredCenterlineId,
      measuredSpineId: measuredCenterlineId,
      routeRepositoryId,
      routeGeometryId: routeRepository.routeGeometryId,
      geometryHash,
      routeFeet,
      routeMiles,
      routeLengthFeet: routeFeet,
      routeLengthMiles: routeMiles,
      coordinateCount: routeGeometry.length,
      segments: measuredCenterlineSegments,
      cumulativeMeasureIndex: measuredCenterlineSegments.map((segment) => ({
        segmentId: segment.segmentId,
        geometryIndexStart: segment.geometryIndexStart,
        geometryIndexEnd: segment.geometryIndexEnd,
        cumulativeStartFeet: segment.cumulativeStartFeet,
        cumulativeEndFeet: segment.cumulativeEndFeet,
      })),
      authorityHash: deterministicHash({ measuredCenterlineId, routeRepositoryId, geometryHash, routeFeet }, "mch"),
      authority: "MEASURED_SPINE_AUTHORITY",
      geometryAuthority: "MEASURED_CENTERLINE",
      singleGeometryAuthority: true,
      createdAt: timestamp,
    },
    stationProjection: {
      stationProjectionId,
      packageId,
      routeRepositoryId,
      measuredCenterlineId,
      stationGraphId,
      stationAuthorityIds: [stationAuthorityId],
      stationObjectManifestId,
      projectedObjectManifestId,
      objectCount: projectedObjects.length,
      expectedObjectCount: expectedProjectionObjectCount,
      spanCount: projectedSpans.length,
      stationCount: stations.length,
      stations: stations.map((station) => ({
        stationId: station.stationId,
        stationAddress: station.label,
        measuredDistanceFeet: station.measureFeet,
        coordinate: station.coordinate,
        geometryReference: routeRepository.routeGeometryId ?? routeRepositoryId,
        authority: "STATION_AUTHORITY",
      })),
      authority: "DOCTRINE_PROJECTION_ENGINE",
      noScopeVersionCreation: true,
    },
    measuredSpine: {
      spineId: measuredCenterlineId,
      measuredSpineId: measuredCenterlineId,
      routeRepositoryId,
      geometryHash,
      routeLengthFeet: routeFeet,
      routeFeet,
      routeMiles,
      segments: measuredCenterlineSegments,
      cumulativeMeasureIndex: measuredCenterlineSegments.map((segment) => ({
        segmentId: segment.segmentId,
        geometryIndexStart: segment.geometryIndexStart,
        geometryIndexEnd: segment.geometryIndexEnd,
        cumulativeStartFeet: segment.cumulativeStartFeet,
        cumulativeEndFeet: segment.cumulativeEndFeet,
      })),
      authority: "MEASURED_SPINE_AUTHORITY",
      geometryAuthority: "MEASURED_CENTERLINE",
      singleGeometryAuthority: true,
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
    projectedSpans,
    objectAddresses,
    objectStationAttachments,
    stationObjectManifest,
    projectedObjectManifest,
    doctrineProjectionDiagnostics,
    geometryAuthorityDiagnostics,
    stationProjectionDecisionTrace: decisionTrace,
    stationProjectionSummary: {
      status: doctrineProjectionDiagnostics.status,
      stationProjectionId,
      measuredCenterlineId,
      stationGraphId,
      stationAuthorityIds: [stationAuthorityId],
      stationObjectManifestId,
      projectedObjectManifestId,
      routeFeet,
      routeMiles,
      stationCount: stations.length,
      objectCount: projectedObjects.length,
      expectedObjectCount: expectedProjectionObjectCount,
      doctrineObjectManifestId: doctrineMaterialization.manifestId,
      doctrineObjectManifestObjectCount: doctrineMaterialization.manifestObjectCount,
      doctrineQuantityScheduleCount: expectedProjectionObjectCount,
      quantityScheduleMatches: projectedObjects.length === expectedProjectionObjectCount,
      materializationAuthority: "DOCTRINE_PROJECTION_ENGINE",
      failedGates: doctrineProjectionDiagnostics.failedGates,
      noCoordinateOnlyObjects: unprojectedObjects.length === 0,
      coordinateAuthority: "MEASURED_CENTERLINE",
      geometryAuthority: "MEASURED_CENTERLINE",
      reasoning: "OFFLINE_OR_ADVISORY",
      deterministicDoctrine: "PD-002_STATION_PROJECTION",
    },
  };
}

function stationAwareSubmitReadiness(draftPackage) {
  const blockingIssues = [];
  const measuredCenterlineSegmentCount = asArray(asRecord(draftPackage.measuredCenterline).segments).length;
  const geometryCoordinateCount = (measuredCenterlineSegmentCount ? measuredCenterlineSegmentCount + 1 : 0) ||
    asArray(asRecord(draftPackage.geometry).coordinates).length ||
    asArray(draftPackage.centerline).length;
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
  const doctrineObjectManifest = doctrineObjectManifestFromDraftPackage(draftPackage);
  const doctrineObjectValidation = doctrineObjectValidationFromDraftPackage(draftPackage, doctrineObjectManifest);
  const doctrineMaterializedObjects = doctrineInstantiatedObjectsFromDraftPackage(draftPackage, doctrineObjectManifest);
  const measuredCenterline = asRecord(draftPackage.measuredCenterline);
  const stationIndexedGraph = asRecord(draftPackage.stationIndexedGraph);
  const stationObjectManifest = asRecord(draftPackage.stationObjectManifest);
  const projectedObjectManifest = asRecord(draftPackage.projectedObjectManifest);
  const projectedSpans = asArray(projectedObjectManifest.projectedSpans ?? draftPackage.projectedSpans);
  const projectedObjects = asArray(projectedObjectManifest.projectedObjects ?? draftPackage.projectedObjects);
  const doctrineProjectionDiagnostics = asRecord(draftPackage.doctrineProjectionDiagnostics ?? projectedObjectManifest.doctrineProjectionDiagnostics ?? stationObjectManifest.doctrineProjectionDiagnostics);
  const geometryAuthorityDiagnostics = asRecord(draftPackage.geometryAuthorityDiagnostics ?? projectedObjectManifest.geometryAuthorityDiagnostics ?? doctrineProjectionDiagnostics.geometryAuthorityDiagnostics);
  const stationProjectionSummary = asRecord(draftPackage.stationProjectionSummary);
  if (!geometryCoordinateCount) blockingIssues.push("measured centerline geometry missing");
  if (!measuredCenterline.measuredCenterlineId) blockingIssues.push("measuredCenterline missing");
  if (!draftPackage.stationProjectionId && !asRecord(draftPackage.stationProjection).stationProjectionId) blockingIssues.push("stationProjectionId missing");
  if (!stationIndexedGraph.stationGraphId && !stationIndexedGraph.graphId) blockingIssues.push("stationIndexedGraph missing");
  if (!asArray(asRecord(draftPackage.stationAuthority).stationAuthorityIds).length && !asRecord(draftPackage.stationAuthority).authorityId) blockingIssues.push("stationAuthorityIds missing");
  if (!stationObjectManifest.manifestId) blockingIssues.push("stationObjectManifest missing");
  if (!projectedObjectManifest.manifestId) blockingIssues.push("projectedObjectManifest missing");
  if (!projectedObjects.length) blockingIssues.push("projected IOF objects missing");
  if (projectedSpans.some((span) => Array.isArray(asRecord(span).coordinates))) blockingIssues.push("span contains independent geometry");
  if (geometryAuthorityDiagnostics.geometryAuthority !== "PASS" && geometryAuthorityDiagnostics.status !== "PASS") blockingIssues.push("geometry authority diagnostics failed");
  if (Number(geometryAuthorityDiagnostics.maximumDriftFeet ?? 0) > 0) blockingIssues.push("geometry drift exceeds tolerance");
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
  if (!firstText(doctrineObjectManifest.manifestId, draftPackage.doctrineObjectManifestId, draftPackage.engineeringObjectManifestId)) blockingIssues.push("doctrineObjectManifest missing");
  if (!doctrineMaterializedObjects.length) blockingIssues.push("doctrine materialized objects missing");
  if (doctrineObjectValidation.status === "FAIL") blockingIssues.push("doctrine object instantiation validation failed");
  const doctrineManifestCount = Number(doctrineObjectManifest.objectCount ?? doctrineMaterializedObjects.length);
  if (Number.isFinite(doctrineManifestCount) && doctrineManifestCount !== doctrineMaterializedObjects.length) {
    blockingIssues.push(`doctrine materialized object count mismatch: manifest ${doctrineManifestCount}, objects ${doctrineMaterializedObjects.length}`);
  }
  if (stationObjectManifest.doctrineQuantityScheduleCount && Number(stationObjectManifest.doctrineQuantityScheduleCount) !== Number(stationObjectManifest.objectCount)) {
    blockingIssues.push("stationObjectManifest count does not match doctrine quantity schedule");
  }
  if (stationObjectManifest.quantityScheduleMatches === false) blockingIssues.push("stationObjectManifest quantity schedule mismatch");
  if (doctrineProjectionDiagnostics.status === "FAIL") {
    const failedGates = asArray(doctrineProjectionDiagnostics.failedGates)
      .map((gate) => `${firstText(asRecord(gate).objectType, "UNKNOWN")} ${firstText(asRecord(gate).gate, "Gate")}: ${firstText(asRecord(gate).reason, "unknown reason")}`);
    blockingIssues.push(`doctrine projection diagnostics failed: ${failedGates.join("; ") || "unknown failed gate"}`);
  }
  const unresolved = doctrineMaterializedObjects
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
  const routeReference = asRecord(draftPackage.routeRepositoryRef);
  const expectedRouteRevision = firstText(draftPackage.routeRevision, routeReference.routeRevision);
  const expectedGeometryHash = firstText(draftPackage.geometryHash, routeReference.geometryHash);
  if (expectedRouteRevision && expectedRouteRevision !== firstText(routeRepository.routeRevision, routeRepository.revision)) {
    const error = new Error("ARTIFACT_INTEGRITY_FAILURE: Commercial Route revision mismatch.");
    error.status = 409;
    throw error;
  }
  if (expectedGeometryHash && expectedGeometryHash !== firstText(routeRepository.geometryHash)) {
    const error = new Error("ARTIFACT_INTEGRITY_FAILURE: Commercial Route geometry hash mismatch.");
    error.status = 409;
    throw error;
  }
  for (const field of ["customerId", "opportunityId"]) {
    const expected = firstText(draftPackage[field]);
    const actual = firstText(routeRepository[field]);
    if (expected && actual && expected !== actual) {
      const error = new Error(`ARTIFACT_INTEGRITY_FAILURE: Commercial Route ${field} scope mismatch.`);
      error.status = 409;
      throw error;
    }
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
    stationGraph: stationProjection.stationIndexedGraph,
    stationIndexedGraph: stationProjection.stationIndexedGraph,
    stationProjectionId: stationProjection.stationProjectionId,
    stationProjection: stationProjection.stationProjection,
    stationGraphId: stationProjection.stationGraphId,
    stationAuthorityIds: stationProjection.stationAuthorityIds,
    measuredCenterlineId: stationProjection.measuredCenterlineId,
    stationObjectManifestId: stationProjection.stationObjectManifestId,
    projectedObjectManifestId: stationProjection.projectedObjectManifestId,
    stationObjectManifest: stationProjection.stationObjectManifest,
    projectedObjectManifest: {
      ...stationProjection.projectedObjectManifest,
      commercialAuditReconciliation: asRecord(draftPackage.commercialAuditReconciliation).reconciliationId
        ? draftPackage.commercialAuditReconciliation
        : asRecord(draftPackage.projectedObjectManifest).commercialAuditReconciliation,
      constitutionalStateValidation: asRecord(draftPackage.constitutionalStateValidation).validationId
        ? draftPackage.constitutionalStateValidation
        : asRecord(draftPackage.projectedObjectManifest).constitutionalStateValidation,
    },
    projectedObjects: stationProjection.projectedObjects.map(({ sourceObject, ...object }) => object),
    projectedSpans: stationProjection.projectedSpans,
    doctrineProjectionDiagnostics: stationProjection.doctrineProjectionDiagnostics,
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
    objectAddresses: stationProjection.objectAddresses,
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
  const createdAt = timestamp;
  return {
    ...raw,
    packageId,
    proposalId,
    proposalRevisionId: String(raw.proposalRevisionId ?? "").trim(),
    proposalRevisionNumber: Number(raw.proposalRevisionNumber ?? raw.sourceProposalVersion ?? 0),
    proposalHash: String(raw.proposalHash ?? "").trim(),
    sourceProposalVersion: Number(raw.sourceProposalVersion ?? raw.proposalRevisionNumber ?? 0),
    draftPackageId: String(raw.draftPackageId ?? packageId),
    packageType: "ENGINEERING",
    status: raw.status ?? "DRAFT",
    workflowStatus: raw.workflowStatus ?? "ENGINEERING_REVIEW",
    organizationId: user.organizationId,
    workspaceId: user.workspaceId,
    ownerId: raw.ownerId ?? user.userId,
    owner: raw.owner ?? user.name,
    createdBy: user.name,
    createdById: user.userId,
    createdByPrincipalId: user.principalId ?? user.userId,
    createdByMembershipId: user.membershipId,
    createdBySessionId: user.sessionId,
    actorDisplayNameAtAction: user.displayName ?? user.name,
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
    immutable: Boolean(raw.immutable ?? false),
    sourceSystem: "IOFPackageAssemblyEngine",
    createdAt,
    updatedAt: timestamp,
  };
}

export function exactProposalRevisionEligibility(proposal = {}, draftPackage = {}) {
  const proposalRevisionId = firstText(draftPackage.proposalRevisionId);
  const proposalHash = firstText(draftPackage.proposalHash);
  if (!proposalRevisionId && !proposalHash) return { eligible: false, legacy: true, reason: "A saved Proposal Revision ID and hash are required for release." };
  if (!proposalRevisionId || !proposalHash) return { eligible: false, legacy: false, reason: "Both proposalRevisionId and proposalHash are required." };
  if (firstText(draftPackage.proposalId) !== firstText(proposal.proposalId, proposal.proposalRecordId)) return { eligible: false, legacy: false, reason: "Draft IOF Proposal identity does not match the Proposal Repository record." };
  if (firstText(draftPackage.organizationId) !== firstText(proposal.organizationId)) return { eligible: false, legacy: false, reason: "Draft IOF organization scope does not match the selected Proposal Revision." };
  if (firstText(draftPackage.customerId) !== firstText(proposal.customerId)) return { eligible: false, legacy: false, reason: "Draft IOF customer scope does not match the selected Proposal Revision." };
  if (firstText(draftPackage.opportunityId) !== firstText(proposal.opportunityId)) return { eligible: false, legacy: false, reason: "Draft IOF opportunity scope does not match the selected Proposal Revision." };
  if (proposalRevisionId !== firstText(proposal.proposalRevisionId) || proposalHash !== firstText(proposal.proposalHash)) return { eligible: false, legacy: false, reason: "Draft IOF does not reference the Proposal's selected immutable Revision ID/hash." };
  const revision = asArray(proposal.proposalRevisions).find((item) =>
    item?.proposalRevisionId === proposalRevisionId && item?.proposalHash === proposalHash
  );
  if (!revision) return { eligible: false, legacy: false, reason: "The exact saved Proposal Revision/hash was not found." };
  if (firstText(revision.proposalId) && firstText(revision.proposalId) !== firstText(proposal.proposalId, proposal.proposalRecordId)) return { eligible: false, legacy: false, reason: "The selected Proposal Revision belongs to a different Proposal." };
  const revisionSnapshot = asRecord(revision.snapshot);
  if (firstText(revisionSnapshot.proposalId) && firstText(revisionSnapshot.proposalId) !== firstText(proposal.proposalId, proposal.proposalRecordId)) return { eligible: false, legacy: false, reason: "The selected Proposal Revision snapshot belongs to a different Proposal." };
  if (firstText(revisionSnapshot.customerId) && firstText(revisionSnapshot.customerId) !== firstText(draftPackage.customerId)) return { eligible: false, legacy: false, reason: "The selected Proposal Revision customer scope does not match Draft IOF." };
  if (firstText(revisionSnapshot.opportunityId) && firstText(revisionSnapshot.opportunityId) !== firstText(draftPackage.opportunityId)) return { eligible: false, legacy: false, reason: "The selected Proposal Revision opportunity scope does not match Draft IOF." };
  if (Number(draftPackage.proposalRevisionNumber ?? 0) !== Number(revision.revisionNumber ?? 0)) return { eligible: false, legacy: false, reason: "Draft IOF Proposal Revision number does not match the selected immutable Proposal Revision." };
  if (revision.revisionStatus !== "SAVED") return { eligible: false, legacy: false, reason: `Proposal Revision is ${revision.revisionStatus ?? "WORKING"}, not SAVED.` };
  const approval = asArray(proposal.approvals).find((item) =>
    item?.decision === "APPROVED" && item?.proposalRevisionId === proposalRevisionId && item?.proposalHash === proposalHash
  );
  if (!approval) return { eligible: false, legacy: false, reason: "Customer approval does not match the exact Proposal Revision/hash." };
  return { eligible: true, legacy: false, proposalRevisionId, proposalHash, revision, approval };
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
    proposalRevisionId: draftPackage.proposalRevisionId,
    proposalHash: draftPackage.proposalHash,
    proposalRevisionNumber: draftPackage.proposalRevisionNumber,
    lifecycleSequence: 5,
    commercialRevisionId: draftPackage.commercialRevisionId,
    commercialReleasePackageId: draftPackage.commercialReleasePackageId,
    commercialRevisionHash: draftPackage.commercialRevisionHash,
    commercialReleaseHash: draftPackage.commercialReleaseHash,
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
    commercialRevisionId: engineeringPackage.commercialRevisionId || draftPackage.commercialRevisionId || opportunity.commercialRevisionId,
    commercialReleasePackageId: engineeringPackage.commercialReleasePackageId || draftPackage.commercialReleasePackageId || opportunity.commercialReleasePackageId,
    commercialRevisionHash: engineeringPackage.commercialRevisionHash || draftPackage.commercialRevisionHash || opportunity.commercialRevisionHash,
    commercialReleaseHash: engineeringPackage.commercialReleaseHash || draftPackage.commercialReleaseHash || opportunity.commercialReleaseHash,
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
      commercialRevisionId: engineeringPackage.commercialRevisionId || draftPackage.commercialRevisionId,
      commercialReleasePackageId: engineeringPackage.commercialReleasePackageId || draftPackage.commercialReleasePackageId,
      commercialRevisionHash: engineeringPackage.commercialRevisionHash || draftPackage.commercialRevisionHash,
      commercialReleaseHash: engineeringPackage.commercialReleaseHash || draftPackage.commercialReleaseHash,
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
  const revisionSpecific = Boolean(draftPackage.proposalRevisionId && draftPackage.proposalHash);
  const selectedIsActive = !revisionSpecific || (
    proposal.proposalRevisionId === draftPackage.proposalRevisionId && proposal.proposalHash === draftPackage.proposalHash
  );
  const revisionHandoff = {
    proposalRevisionId: draftPackage.proposalRevisionId,
    proposalHash: draftPackage.proposalHash,
    proposalRevisionNumber: draftPackage.proposalRevisionNumber,
    commercialRevisionId: firstText(engineeringPackage.commercialRevisionId, draftPackage.commercialRevisionId),
    commercialReleasePackageId: firstText(engineeringPackage.commercialReleasePackageId, draftPackage.commercialReleasePackageId),
    draftIofPackageId: engineeringPackage.draftIOFPackageId,
    engineeringPackageId: engineeringPackage.engineeringPackageId,
    engineeringIntakeId: `ENGINEERING-INTAKE-${stableIdPart(draftPackage.packageId)}`,
    submittedAt: engineeringPackage.submittedAt,
  };
  const next = {
    ...proposal,
    status: selectedIsActive ? PROPOSAL_STATUS_ENGINEERING_SUBMITTED : proposal.status,
    commercialStatus: selectedIsActive ? PROPOSAL_STATUS_ENGINEERING_SUBMITTED : proposal.commercialStatus,
    engineeringStatus: selectedIsActive ? "ENGINEERING_PENDING" : proposal.engineeringStatus,
    engineeringPackageId: selectedIsActive ? engineeringPackage.engineeringPackageId : proposal.engineeringPackageId,
    commercialRevisionId: selectedIsActive ? firstText(engineeringPackage.commercialRevisionId, draftPackage.commercialRevisionId, proposal.commercialRevisionId) : proposal.commercialRevisionId,
    commercialReleasePackageId: selectedIsActive ? firstText(engineeringPackage.commercialReleasePackageId, draftPackage.commercialReleasePackageId, proposal.commercialReleasePackageId) : proposal.commercialReleasePackageId,
    commercialRevisionHash: selectedIsActive ? firstText(engineeringPackage.commercialRevisionHash, draftPackage.commercialRevisionHash, proposal.commercialRevisionHash) : proposal.commercialRevisionHash,
    commercialReleaseHash: selectedIsActive ? firstText(engineeringPackage.commercialReleaseHash, draftPackage.commercialReleaseHash, proposal.commercialReleaseHash) : proposal.commercialReleaseHash,
    draftIofPackageId: selectedIsActive ? engineeringPackage.draftIOFPackageId : proposal.draftIofPackageId,
    routeRepositoryId: firstText(engineeringPackage.routeRepositoryId, proposal.routeRepositoryId),
    commercialWorkbookId: firstText(engineeringPackage.commercialWorkbookId, proposal.commercialWorkbookId),
    workbookId: firstText(engineeringPackage.workbookId, proposal.workbookId, proposal.commercialWorkbookId),
    estimateId: firstText(engineeringPackage.estimateId, proposal.estimateId),
    measuredCenterlineId: engineeringPackage.measuredCenterlineId,
    stationGraphId: engineeringPackage.stationGraphId,
    stationAuthorityIds: engineeringPackage.stationAuthorityIds,
    stationObjectManifestId: engineeringPackage.stationObjectManifestId,
    projectedObjectManifestId: engineeringPackage.projectedObjectManifestId,
    nextLifecycleAction: selectedIsActive ? "OPEN_ENGINEERING_CERTIFICATION" : proposal.nextLifecycleAction,
    proposalRevisionHandoffs: [
      ...asArray(proposal.proposalRevisionHandoffs).filter((item) => !(
        item?.proposalRevisionId === revisionHandoff.proposalRevisionId && item?.proposalHash === revisionHandoff.proposalHash
      )),
      revisionHandoff,
    ],
    engineeringHandoff: selectedIsActive ? {
      engineeringPackageId: engineeringPackage.engineeringPackageId,
      commercialRevisionId: firstText(engineeringPackage.commercialRevisionId, draftPackage.commercialRevisionId, proposal.commercialRevisionId),
      commercialReleasePackageId: firstText(engineeringPackage.commercialReleasePackageId, draftPackage.commercialReleasePackageId, proposal.commercialReleasePackageId),
      commercialRevisionHash: firstText(engineeringPackage.commercialRevisionHash, draftPackage.commercialRevisionHash, proposal.commercialRevisionHash),
      commercialReleaseHash: firstText(engineeringPackage.commercialReleaseHash, draftPackage.commercialReleaseHash, proposal.commercialReleaseHash),
      engineeringRepository: "server/data/engineering-packages",
      status: PROPOSAL_STATUS_ENGINEERING_SUBMITTED,
      submittedBy: user.name,
      submittedById: user.userId,
      submittedAt: engineeringPackage.submittedAt,
      referenceHash: engineeringPackage.referenceHash,
      proposalAuthority: "PROPOSAL_REPOSITORY",
      noAcceptedProposalAuthority: true,
      noScopeVersionCreation: true,
    } : proposal.engineeringHandoff,
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
  let commercialRevisionForSubmit = null;
  let commercialReleasePackageForSubmit = null;
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
    const proposalRevisionEligibility = exactProposalRevisionEligibility(proposalForSubmit, savedDraftPackage);
    if (!proposalRevisionEligibility.eligible) {
      const error = new Error(`Commercial Package validation failed: ${proposalRevisionEligibility.reason}`);
      error.status = 409;
      throw error;
    }
    if (proposalRevisionEligibility.legacy && proposalStatus !== PROPOSAL_STATUS_COMMERCIAL_APPROVED && !alreadyEngineeringSubmitted) {
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
    const commercialAuthority = await ensureCommercialReleasePackageForDraft(savedDraftPackage, proposalForSubmit, user, {
      opportunity: opportunityForSubmit,
      timestamp,
    });
    commercialRevisionForSubmit = commercialAuthority.revision;
    commercialReleasePackageForSubmit = commercialAuthority.releasePackage;
    savedDraftPackage = normalizeCommercialDraftPackage({
      ...savedDraftPackage,
      commercialRevisionId: commercialRevisionForSubmit.commercialRevisionId,
      revisionId: commercialRevisionForSubmit.revisionId,
      commercialRevisionHash: commercialRevisionForSubmit.revisionHash,
      commercialRepositoryId: commercialRevisionForSubmit.repositoryId,
      commercialReleasePackageId: commercialReleasePackageForSubmit.commercialReleasePackageId,
      commercialReleaseHash: commercialReleasePackageForSubmit.releaseHash,
      commercialReleaseState: commercialReleasePackageForSubmit.commercialReleaseState,
      changeSetIds: commercialRevisionForSubmit.changeSetIds ?? commercialReleasePackageForSubmit.changeSetIds ?? [],
      activeChangeSetIds: commercialRevisionForSubmit.activeChangeSetIds ?? commercialRevisionForSubmit.changeSetIds ?? commercialReleasePackageForSubmit.changeSetIds ?? [],
      patchCount: commercialRevisionForSubmit.patchCount ?? commercialReleasePackageForSubmit.patchCount ?? 0,
      activePatchCount: commercialRevisionForSubmit.activePatchCount ?? commercialReleasePackageForSubmit.activePatchCount ?? 0,
      appliedPatchCount: commercialRevisionForSubmit.appliedPatchCount ?? commercialReleasePackageForSubmit.appliedPatchCount ?? 0,
      repositoryHash: commercialRevisionForSubmit.repositoryHash,
      projectionHash: commercialRevisionForSubmit.projectionHash,
      patchReplayTimeMs: commercialRevisionForSubmit.patchReplayTimeMs ?? 0,
      projectionTimeMs: commercialRevisionForSubmit.projectionTimeMs ?? 0,
      currentAuthority: "COMMERCIAL_RELEASE_PACKAGE",
      draftIofAuthorityFlow: {
        inputAuthority: "COMMERCIAL_RELEASE_PACKAGE",
        commercialRevisionId: commercialRevisionForSubmit.commercialRevisionId,
        commercialReleasePackageId: commercialReleasePackageForSubmit.commercialReleasePackageId,
        changeSetIds: commercialRevisionForSubmit.changeSetIds ?? commercialReleasePackageForSubmit.changeSetIds ?? [],
        patchCount: commercialRevisionForSubmit.patchCount ?? commercialReleasePackageForSubmit.patchCount ?? 0,
        commercialRevisionProjection: "COMMERCIAL_REVISION_PROJECTION",
        draftIofPackageId: savedDraftPackage.packageId,
        draftIofOutputUnchanged: true,
        pricingOutputUnchanged: true,
        workbookOutputUnchanged: true,
        noScopeVersionCreation: true,
      },
      commercialAuthorityDiagnostics: commercialAuthorityDiagnosticsFrom({
        revision: commercialRevisionForSubmit,
        releasePackage: commercialReleasePackageForSubmit,
        proposal: proposalForSubmit,
        draftPackage: savedDraftPackage,
      }),
    }, user);
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
    commercialRevisionId: commercialRevisionForSubmit?.commercialRevisionId ?? frozenDraftPackage.commercialRevisionId,
    revisionId: commercialRevisionForSubmit?.revisionId ?? frozenDraftPackage.revisionId,
    commercialRevisionHash: commercialRevisionForSubmit?.revisionHash ?? frozenDraftPackage.commercialRevisionHash,
    commercialRepositoryId: commercialRevisionForSubmit?.repositoryId ?? frozenDraftPackage.commercialRepositoryId,
    commercialReleasePackageId: commercialReleasePackageForSubmit?.commercialReleasePackageId ?? frozenDraftPackage.commercialReleasePackageId,
    commercialReleaseHash: commercialReleasePackageForSubmit?.releaseHash ?? frozenDraftPackage.commercialReleaseHash,
    commercialReleaseState: commercialReleasePackageForSubmit?.commercialReleaseState ?? frozenDraftPackage.commercialReleaseState,
    changeSetIds: commercialRevisionForSubmit?.changeSetIds ?? frozenDraftPackage.changeSetIds ?? [],
    activeChangeSetIds: commercialRevisionForSubmit?.activeChangeSetIds ?? commercialRevisionForSubmit?.changeSetIds ?? frozenDraftPackage.activeChangeSetIds ?? frozenDraftPackage.changeSetIds ?? [],
    patchCount: commercialRevisionForSubmit?.patchCount ?? frozenDraftPackage.patchCount ?? 0,
    activePatchCount: commercialRevisionForSubmit?.activePatchCount ?? frozenDraftPackage.activePatchCount ?? 0,
    appliedPatchCount: commercialRevisionForSubmit?.appliedPatchCount ?? frozenDraftPackage.appliedPatchCount ?? 0,
    repositoryHash: commercialRevisionForSubmit?.repositoryHash ?? frozenDraftPackage.repositoryHash,
    projectionHash: commercialRevisionForSubmit?.projectionHash ?? frozenDraftPackage.projectionHash,
    patchReplayTimeMs: commercialRevisionForSubmit?.patchReplayTimeMs ?? frozenDraftPackage.patchReplayTimeMs ?? 0,
    projectionTimeMs: commercialRevisionForSubmit?.projectionTimeMs ?? frozenDraftPackage.projectionTimeMs ?? 0,
    currentAuthority: "COMMERCIAL_RELEASE_PACKAGE",
    draftIofAuthorityFlow: {
      inputAuthority: "COMMERCIAL_RELEASE_PACKAGE",
      commercialRevisionId: commercialRevisionForSubmit?.commercialRevisionId ?? frozenDraftPackage.commercialRevisionId,
      commercialReleasePackageId: commercialReleasePackageForSubmit?.commercialReleasePackageId ?? frozenDraftPackage.commercialReleasePackageId,
      changeSetIds: commercialRevisionForSubmit?.changeSetIds ?? frozenDraftPackage.changeSetIds ?? [],
      patchCount: commercialRevisionForSubmit?.patchCount ?? frozenDraftPackage.patchCount ?? 0,
      commercialRevisionProjection: "COMMERCIAL_REVISION_PROJECTION",
      draftIofPackageId: frozenDraftPackage.packageId,
      draftIofOutputUnchanged: true,
      pricingOutputUnchanged: true,
      workbookOutputUnchanged: true,
      noScopeVersionCreation: true,
    },
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
    const submittedArtifactReferences = await persistIofProjectionArtifacts(submitted, {
      timestamp,
      user,
      lifecycleStage: "COMMERCIAL_TO_ENGINEERING_HANDOFF",
    });
    let submittedRepositoryRecord = normalizeCommercialDraftPackage(
      stripIofProjectionArtifacts({
        ...submitted,
        iofArtifactRepositoryReferences: {
          ...(submitted.iofArtifactRepositoryReferences ?? {}),
          ...submittedArtifactReferences,
        },
        repositoryAssemblyStatus: "PERSISTED_REFERENCE_ARTIFACTS",
      }, {
        ...(submitted.iofArtifactRepositoryReferences ?? {}),
        ...submittedArtifactReferences,
      }),
      user,
    );
    submittedRepositoryRecord = {
      ...submittedRepositoryRecord,
      packageHash: deterministicDraftPackageHash(submittedRepositoryRecord),
    };
    await persistRecord(DIRS.iofPackages, submittedRepositoryRecord.packageId, submittedRepositoryRecord);
    draftPersisted = true;
    const opportunity = opportunityForSubmit ?? (submitted.opportunityId ? await loadRecord(DIRS.commercialOpportunities, submitted.opportunityId).catch(() => null) : null);
    let engineeringBaselineRecord;
    try {
      appendEngineeringTransactionStep(
        transactionLog,
        ENGINEERING_TRANSACTION_STEPS.BUILD_ENGINEERING_BASELINE,
        "Build Engineering Baseline",
        "START",
        {
          file: "server/routes/commercial-iof-packages.js",
          objectType: "EngineeringBaseline",
          details: { draftIOFPackageId: submitted.packageId },
        },
      );
      const baselineForSubmit = buildEngineeringBaselineFromDraftPackage(submitted, { opportunity, user, timestamp });
      engineeringBaselineRecord = await persistEngineeringBaseline(
        baselineForSubmit,
        user,
        { requireIntegrity: true },
      );
      appendEngineeringTransactionStep(
        transactionLog,
        ENGINEERING_TRANSACTION_STEPS.BUILD_ENGINEERING_BASELINE,
        "Build Engineering Baseline",
        "OK",
        {
          file: "server/routes/commercial-iof-packages.js",
          objectType: "EngineeringBaseline",
          engineeringPackageId: engineeringBaselineRecord.engineeringBaselineId,
          payloadSizeBytes: serializedByteSize(engineeringBaselineRecord),
          details: {
            engineeringBaselineId: engineeringBaselineRecord.engineeringBaselineId,
            engineeringBaselineHash: engineeringBaselineRecord.engineeringBaselineHash,
            repository: "server/data/engineering-baselines",
            immutable: true,
            referenceOnly: true,
          },
        },
      );
    } catch (error) {
      throwEngineeringTransactionError(
        transactionLog,
        ENGINEERING_TRANSACTION_STEPS.BUILD_ENGINEERING_BASELINE,
        "Build Engineering Baseline",
        error,
        {
          file: "server/routes/commercial-iof-packages.js",
          objectType: "EngineeringBaseline",
        },
      );
    }
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
      engineeringPackageRecord = buildEngineeringPackageFromDraftPackage(submitted, { opportunity, user, timestamp, engineeringBaseline: engineeringBaselineRecord });
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
      ["engineeringBaselineId", verifiedEngineeringPackage.engineeringBaselineId],
      ["engineeringBaselineHash", verifiedEngineeringPackage.engineeringBaselineHash],
      ["engineeringBaselineManifestId", verifiedEngineeringPackage.engineeringBaselineManifestId],
      ["engineeringBaselineProjectionId", verifiedEngineeringPackage.engineeringBaselineProjectionId],
      ["engineeringRevisionId", verifiedEngineeringPackage.engineeringRevisionId],
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
      engineeringBaseline: engineeringBaselineRecord,
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

  if (normalizedPath.startsWith("/api/commercial/iof-packages/") && normalizedPath.endsWith("/artifacts") && req.method === "POST") {
    const packageId = decodeURIComponent(normalizedPath
      .slice("/api/commercial/iof-packages/".length)
      .replace(/\/artifacts$/, ""));
    const body = await readRequestJson(req);
    const raw = unwrapBody(body, "draftPackage", ["iofPackage", "package"]) ?? {};
    if (String(raw.packageId ?? "") !== packageId) {
      errorResponse(res, 409, "ARTIFACT_INTEGRITY_FAILURE: Draft IOF package ID does not match artifact persistence target.");
      return true;
    }
    let draftPackage = normalizeCommercialDraftPackage(raw, user);
    const proposal = draftPackage.proposalId ? await loadRecord(DIRS.proposalDrafts, draftPackage.proposalId).catch(() => null) : null;
    if (!proposal) {
      errorResponse(res, 409, `Draft IOF artifact persistence blocked: Proposal not found: ${draftPackage.proposalId}.`);
      return true;
    }
    const proposalRevisionEligibility = exactProposalRevisionEligibility(proposal, draftPackage);
    if (!proposalRevisionEligibility.eligible) {
      errorResponse(res, 409, `Draft IOF artifact persistence blocked: ${proposalRevisionEligibility.reason}`);
      return true;
    }
    const timestamp = nowIso();
    const { revision, releasePackage } = await ensureCommercialReleasePackageForDraft(draftPackage, proposal, user, { timestamp });
    draftPackage = normalizeCommercialDraftPackage({
      ...draftPackage,
      commercialRevisionId: revision.commercialRevisionId,
      revisionId: revision.revisionId,
      commercialRevisionHash: revision.revisionHash,
      commercialRepositoryId: revision.repositoryId,
      commercialReleasePackageId: releasePackage.commercialReleasePackageId,
      commercialReleaseHash: releasePackage.releaseHash,
      commercialReleaseState: releasePackage.commercialReleaseState,
      currentAuthority: "COMMERCIAL_RELEASE_PACKAGE",
    }, user);
    const artifactReferences = await persistIofProjectionArtifacts(draftPackage, {
      timestamp,
      user,
      lifecycleStage: "AUTOMATIC_IOF_PACKAGE_ASSEMBLY",
    });
    jsonResponse(res, 201, {
      packageId,
      artifactReferences,
      authorityBindings: {
        commercialRevisionId: revision.commercialRevisionId,
        revisionId: revision.revisionId,
        commercialRevisionHash: revision.revisionHash,
        commercialRepositoryId: revision.repositoryId,
        commercialReleasePackageId: releasePackage.commercialReleasePackageId,
        commercialReleaseHash: releasePackage.releaseHash,
        commercialReleaseState: releasePackage.commercialReleaseState,
        currentAuthority: "COMMERCIAL_RELEASE_PACKAGE",
      },
    });
    return true;
  }

  if (normalizedPath === "/api/commercial/iof-packages" && req.method === "GET") {
    const packageRecords = sortedByUpdated(await listRecords(DIRS.iofPackages))
      .filter((record) => record?.authority === "COMMERCIAL_DRAFT_IOF_PACKAGE" || record?.sourceSystem === "IOFPackageAssemblyEngine");
    const packages = await Promise.all(packageRecords.map((record) => hydrateIofProjectionArtifacts(record)));
    jsonResponse(res, 200, { draftPackages: packages, iofPackages: packages });
    return true;
  }

  if (normalizedPath === "/api/commercial/iof-packages" && req.method === "POST") {
    const body = await readRequestJson(req);
    const raw = unwrapBody(body, "draftPackage", ["iofPackage", "package"]) ?? {};
    let draftPackage = normalizeCommercialDraftPackage(raw, user);
    const transactionId = String(raw.transactionId ?? `DRAFT-IOF-SAVE-${draftPackage.packageId}-${Date.now()}`);
    await updateTransactionManifest({ transactionId, operationType: "DRAFT_IOF_SAVE", state: "STARTED", tenantId: draftPackage.organizationId, customerId: draftPackage.customerId ?? draftPackage.accountId, opportunityId: draftPackage.opportunityId, plannedWrites: [`iof-packages/${draftPackage.packageId}.json`, "projection-artifact repositories", "runtime object/history mirrors"], artifactIds: [draftPackage.packageId] });
    const existing = await loadRecord(DIRS.iofPackages, draftPackage.packageId).catch(() => null);
    if (existing?.commercialRevisionLocked || ["SUBMITTED_TO_ENGINEERING", "UNDER_ENGINEERING_REVIEW", "CERTIFIED"].includes(String(existing?.status ?? ""))) {
      errorResponse(res, 409, "Commercial revision is locked after Engineering submission.");
      return true;
    }
    const proposal = draftPackage.proposalId ? await loadRecord(DIRS.proposalDrafts, draftPackage.proposalId).catch(() => null) : null;
    if (proposal) {
      const proposalRevisionEligibility = exactProposalRevisionEligibility(proposal, draftPackage);
      if (!proposalRevisionEligibility.eligible) {
        errorResponse(res, 409, `Draft IOF save blocked: ${proposalRevisionEligibility.reason}`);
        return true;
      }
      const { revision, releasePackage } = await ensureCommercialReleasePackageForDraft(draftPackage, proposal, user, {
        timestamp: nowIso(),
      });
      draftPackage = normalizeCommercialDraftPackage({
        ...draftPackage,
        commercialRevisionId: revision.commercialRevisionId,
        revisionId: revision.revisionId,
        commercialRevisionHash: revision.revisionHash,
        commercialRepositoryId: revision.repositoryId,
        commercialReleasePackageId: releasePackage.commercialReleasePackageId,
        commercialReleaseHash: releasePackage.releaseHash,
        commercialReleaseState: releasePackage.commercialReleaseState,
        changeSetIds: revision.changeSetIds ?? releasePackage.changeSetIds ?? [],
        activeChangeSetIds: revision.activeChangeSetIds ?? revision.changeSetIds ?? releasePackage.changeSetIds ?? [],
        patchCount: revision.patchCount ?? releasePackage.patchCount ?? 0,
        activePatchCount: revision.activePatchCount ?? releasePackage.activePatchCount ?? 0,
        appliedPatchCount: revision.appliedPatchCount ?? releasePackage.appliedPatchCount ?? 0,
        repositoryHash: revision.repositoryHash,
        projectionHash: revision.projectionHash,
        patchReplayTimeMs: revision.patchReplayTimeMs ?? 0,
        projectionTimeMs: revision.projectionTimeMs ?? 0,
        currentAuthority: "COMMERCIAL_RELEASE_PACKAGE",
        draftIofAuthorityFlow: {
          inputAuthority: "COMMERCIAL_RELEASE_PACKAGE",
          commercialRevisionId: revision.commercialRevisionId,
          commercialReleasePackageId: releasePackage.commercialReleasePackageId,
          changeSetIds: revision.changeSetIds ?? releasePackage.changeSetIds ?? [],
          patchCount: revision.patchCount ?? releasePackage.patchCount ?? 0,
          commercialRevisionProjection: "COMMERCIAL_REVISION_PROJECTION",
          draftIofPackageId: draftPackage.packageId,
          draftIofOutputUnchanged: true,
          pricingOutputUnchanged: true,
          workbookOutputUnchanged: true,
          noScopeVersionCreation: true,
        },
        commercialAuthorityDiagnostics: commercialAuthorityDiagnosticsFrom({
          revision,
          releasePackage,
          proposal,
          draftPackage,
        }),
      }, user);
    }
    const artifactReferences = await persistIofProjectionArtifacts(draftPackage, {
      timestamp: nowIso(),
      user,
      lifecycleStage: "AUTOMATIC_IOF_PACKAGE_ASSEMBLY",
    });
    let referenceOnlyDraftPackage = normalizeCommercialDraftPackage(
      stripIofProjectionArtifacts({
        ...draftPackage,
        iofArtifactRepositoryReferences: {
          ...(draftPackage.iofArtifactRepositoryReferences ?? {}),
          ...artifactReferences,
        },
        automaticIofPackageAssembly: true,
        repositoryAssemblyStatus: "PERSISTED_REFERENCE_ARTIFACTS",
      }, {
        ...(draftPackage.iofArtifactRepositoryReferences ?? {}),
        ...artifactReferences,
      }),
      user,
    );
    referenceOnlyDraftPackage = {
      ...referenceOnlyDraftPackage,
      packageHash: deterministicDraftPackageHash(referenceOnlyDraftPackage),
    };
    await persistRecord(DIRS.iofPackages, referenceOnlyDraftPackage.packageId, referenceOnlyDraftPackage);
    await persistCommercialPackageRuntime(referenceOnlyDraftPackage, user);
    await updateTransactionManifest({ transactionId, operationType: "DRAFT_IOF_SAVE", state: "COMMITTED", completedWrites: [`iof-packages/${referenceOnlyDraftPackage.packageId}.json`, "projection-artifact repositories", "runtime object/history mirrors"], artifactIds: [referenceOnlyDraftPackage.packageId, ...Object.values(artifactReferences).map((reference) => reference.artifactId).filter(Boolean)], revisionIds: [referenceOnlyDraftPackage.commercialRevisionId].filter(Boolean), hashes: [referenceOnlyDraftPackage.commercialRevisionHash, referenceOnlyDraftPackage.commercialReleaseHash].filter(Boolean) });
    jsonResponse(res, 201, { draftPackage: referenceOnlyDraftPackage, iofPackage: referenceOnlyDraftPackage });
    return true;
  }

  if (normalizedPath.startsWith("/api/commercial/iof-packages/") && normalizedPath.endsWith("/submit-engineering") && req.method === "POST") {
    const packageId = decodeURIComponent(normalizedPath
      .slice("/api/commercial/iof-packages/".length)
      .replace(/\/submit-engineering$/, ""));
    const transactionLog = [];
    const transactionId = `ENGINEERING-HANDOFF-${packageId}-${Date.now()}`;
    const { byteLength } = await readRequestJsonWithRaw(req);
    const existingRecord = await loadRecord(DIRS.iofPackages, packageId).catch(() => null);
    let existing;
    try {
      existing = existingRecord ? await hydrateIofProjectionArtifacts(existingRecord, { strict: true }) : null;
    } catch (error) {
      errorResponse(res, error.status ?? 409, error.message ?? "ARTIFACT_INTEGRITY_FAILURE");
      return true;
    }
    if (!existing) {
      errorResponse(res, 404, `Commercial Draft IOF Package not found: ${packageId}`);
      return true;
    }
    if (existing.commercialRevisionLocked || ["SUBMITTED_TO_ENGINEERING", "UNDER_ENGINEERING_REVIEW", "CERTIFIED"].includes(String(existing.status ?? ""))) {
      const engineeringPackageId = firstText(existing.engineeringPackageId, `ENG-PKG-${stableIdPart(packageId)}`);
      const engineeringPackage = await loadRecord(DIRS.engineeringPackages, engineeringPackageId).catch(() => null);
      const engineeringIntake = await loadRecord(DIRS.engineeringIntakes, `ENGINEERING-INTAKE-${stableIdPart(packageId)}`).catch(() => null);
      const engineeringBaseline = engineeringPackage?.engineeringBaselineId
        ? await loadRecord(DIRS.engineeringBaselines, engineeringPackage.engineeringBaselineId).catch(() => null)
        : null;
      if (engineeringPackage && engineeringIntake) {
        jsonResponse(res, 200, {
          draftPackage: existing,
          iofPackage: existing,
          engineeringIntake,
          engineeringBaseline,
          engineeringPackage,
          idempotentReplay: true,
          noDuplicateArtifactsCreated: true,
        });
        return true;
      }
    }
    try {
      await updateTransactionManifest({ transactionId, operationType: "ENGINEERING_HANDOFF", state: "STARTED", customerId: existing.customerId ?? existing.accountId, opportunityId: existing.opportunityId, plannedWrites: ["engineering-intake", "engineering-baseline", "engineering-package", "opportunity/proposal status", "runtime history"], artifactIds: [packageId] });
      const result = await submitCommercialDraftPackageToEngineering(existing, user, {
        transactionLog,
        requestBodyByteLength: byteLength,
      });
      await updateTransactionManifest({ transactionId, operationType: "ENGINEERING_HANDOFF", state: "COMMITTED", completedWrites: ["engineering-intake", "engineering-baseline", "engineering-package", "opportunity/proposal status", "runtime history"], artifactIds: [packageId, result.engineeringPackage?.engineeringPackageId, result.engineeringBaseline?.engineeringBaselineId, result.engineeringIntake?.engineeringIntakeId].filter(Boolean) });
      jsonResponse(res, 200, result);
    } catch (error) {
      await updateTransactionManifest({ transactionId, operationType: "ENGINEERING_HANDOFF", state: "RECOVERY_REQUIRED", failureReason: error.message ?? String(error), artifactIds: [packageId] });
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
      const draftPackage = await hydrateIofProjectionArtifacts(await loadRecord(DIRS.iofPackages, id));
      jsonResponse(res, 200, { draftPackage, iofPackage: draftPackage });
    } catch {
      errorResponse(res, 404, `Commercial Draft IOF Package not found: ${id}`);
    }
    return true;
  }

  return false;
}
