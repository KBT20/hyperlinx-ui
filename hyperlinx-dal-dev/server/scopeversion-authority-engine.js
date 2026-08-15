import { createHash } from "node:crypto";

export const SCOPEVERSION_AUTHORITY_READINESS = [
  { key: "engineering", label: "Engineering", status: "PASS" },
  { key: "business", label: "Business", status: "PENDING" },
  { key: "legal", label: "Legal", status: "PENDING" },
  { key: "serviceOrder", label: "Service Order", status: "PENDING" },
  { key: "customerSignature", label: "Customer Signature", status: "PENDING" },
  { key: "control", label: "Control", status: "PENDING" },
  { key: "marketplace", label: "Marketplace", status: "PENDING" },
  { key: "field", label: "Field", status: "PENDING" },
  { key: "operationalTwin", label: "Operational Twin", status: "PENDING" },
];

export const SCOPEVERSION_CERTIFIED_DRAFT_IOF_AUTHORITY = "SCOPEVERSION_FROM_CERTIFIED_DRAFT_IOF_PACKAGE";
export const SCOPEVERSION_LEGACY_CERTIFIED_IOF_AUTHORITY = "SCOPEVERSION_FROM_CERTIFIED_IOF_PACKAGE";
export const SCOPEVERSION_ORDER_FOR_EXECUTION_AUTHORITY = "SCOPEVERSION_ORDER_FOR_EXECUTION";

function asRecord(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function asArray(value) {
  if (Array.isArray(value)) return value;
  if (value === undefined || value === null || value === "") return [];
  return [value];
}

function unique(values) {
  return [...new Set(asArray(values).flatMap((value) => asArray(value)).filter(Boolean).map(String))];
}

function numeric(value, fallback = 0) {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
}

function stableIdPart(value, fallback = "UNKNOWN") {
  return String(value ?? fallback)
    .replace(/[^A-Za-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120) || fallback;
}

function nowIso() {
  return new Date().toISOString();
}

function sortForHash(value) {
  if (Array.isArray(value)) return value.map(sortForHash);
  if (!value || typeof value !== "object") return value;
  return Object.keys(value).sort().reduce((next, key) => {
    next[key] = sortForHash(value[key]);
    return next;
  }, {});
}

function hashPayload(value) {
  return createHash("sha256").update(JSON.stringify(sortForHash(value))).digest("hex");
}

function normalizeCoordinate(value) {
  if (!Array.isArray(value) || value.length < 2) return undefined;
  const first = Number(value[0]);
  const second = Number(value[1]);
  if (!Number.isFinite(first) || !Number.isFinite(second)) return undefined;
  const lonLatValid = Math.abs(first) <= 180 && Math.abs(second) <= 90;
  const latLonValid = Math.abs(first) <= 90 && Math.abs(second) <= 180;
  if (lonLatValid) return [first, second];
  if (latLonValid) return [second, first];
  return undefined;
}

function coordinateFrom(value) {
  const normalized = normalizeCoordinate(value);
  if (normalized) return normalized;
  const record = asRecord(value);
  const direct = record.coordinate ?? record.coordinates ?? record.location ?? record.point;
  if (direct !== undefined && direct !== value) {
    const nested = coordinateFrom(direct);
    if (nested) return nested;
  }
  const lon = Number(record.lon ?? record.lng ?? record.longitude ?? record.x);
  const lat = Number(record.lat ?? record.latitude ?? record.y);
  return normalizeCoordinate([lon, lat]);
}

function coordinatesFrom(value) {
  const normalized = normalizeCoordinate(value);
  if (normalized) return [normalized];
  if (!Array.isArray(value)) {
    const record = asRecord(value);
    const geometry = asRecord(record.geometry);
    const centerline = asRecord(record.centerline);
    const candidates = [
      record.coordinates,
      geometry.coordinates,
      record.geometry,
      record.routeGeometry,
      record.centerline,
      centerline.coordinates,
      centerline.geometry,
      record.path,
      record.points,
      ...(String(record.type ?? "") === "FeatureCollection" ? asArray(record.features) : []),
    ].filter((candidate) => candidate !== undefined && candidate !== value);
    for (const candidate of candidates) {
      const coordinates = coordinatesFrom(candidate);
      if (coordinates.length > 1) return coordinates;
    }
    const coordinate = coordinateFrom(value);
    return coordinate ? [coordinate] : [];
  }
  if (value.every((entry) => normalizeCoordinate(entry))) {
    return value.map(normalizeCoordinate).filter(Boolean);
  }
  const nested = value.flatMap((entry) => coordinatesFrom(entry));
  if (nested.length > 1) return nested;
  return value.map(coordinateFrom).filter(Boolean);
}

function firstCoordinateList(...values) {
  for (const value of values) {
    const coordinates = coordinatesFrom(value);
    if (coordinates.length > 1) return coordinates;
  }
  return [];
}

function geometryReferencesCoordinates(values) {
  return asArray(values).flatMap((value) => {
    const embedded = coordinatesFrom(value);
    if (embedded.length) return embedded;
    return [...String(value ?? "").matchAll(/(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/g)]
      .map((match) => normalizeCoordinate([Number(match[1]), Number(match[2])]))
      .filter(Boolean);
  });
}

export function routeCoordinatesFromCertifiedPackage(certifiedPackage = {}) {
  const doctrineAssembly = asRecord(certifiedPackage.productDoctrineAssembly);
  const routeEntries = asArray(certifiedPackage.route);
  const routeGeometry = routeEntries
    .map((entry) => firstCoordinateList(asRecord(entry).geometry, asRecord(entry).coordinates, asRecord(entry).routeGeometry))
    .find((coordinates) => coordinates.length > 1) ?? [];
  const routeSegmentGeometry = asArray(certifiedPackage.routeSegments)
    .flatMap((segment) => firstCoordinateList(
      asRecord(segment).geometry,
      asRecord(segment).coordinates,
      asRecord(segment).routeGeometry,
      asRecord(segment).centerline,
    ));
  return firstCoordinateList(
    asRecord(certifiedPackage.geometry).coordinates,
    asRecord(asRecord(certifiedPackage.geometry).geometry).coordinates,
    certifiedPackage.geometry,
    asRecord(certifiedPackage.centerline).coordinates,
    asRecord(certifiedPackage.centerline).geometry,
    certifiedPackage.centerline,
    asRecord(certifiedPackage.centerlineRoute).coordinates,
    asRecord(asRecord(certifiedPackage.centerlineRoute).geometry).coordinates,
    asRecord(certifiedPackage.centerlineRoute).geometry,
    certifiedPackage.centerlineRoute,
    asRecord(certifiedPackage.osrmRoute).coordinates,
    asRecord(asRecord(certifiedPackage.osrmRoute).geometry).coordinates,
    asRecord(certifiedPackage.osrmRoute).geometry,
    certifiedPackage.osrmRoute,
    asRecord(doctrineAssembly.osrmRoute).coordinates,
    asRecord(doctrineAssembly.osrmRoute).geometry,
    doctrineAssembly.centerline,
    asRecord(certifiedPackage.spine).coordinates,
    asRecord(certifiedPackage.spine).geometry,
    asRecord(certifiedPackage.spine).centerline,
    routeGeometry,
    routeSegmentGeometry,
    geometryReferencesCoordinates(certifiedPackage.geometryReferences),
  );
}

function routeLengthFeetFromPackage(certifiedPackage = {}) {
  return numeric(
    asRecord(certifiedPackage.quantitySummary).routeFeet ??
      asRecord(certifiedPackage.commercialSummary).routeFeet ??
      asRecord(certifiedPackage.centerlineRoute).routeFeet ??
      asRecord(certifiedPackage.osrmRoute).routeFeet ??
      asRecord(certifiedPackage.spine).routeFeet ??
      certifiedPackage.routeFeet,
    0,
  );
}

function routeMilesFromPackage(certifiedPackage = {}, routeLengthFeet = 0) {
  return numeric(
    asRecord(certifiedPackage.quantitySummary).routeMiles ??
      asRecord(certifiedPackage.commercialSummary).routeMiles ??
      asRecord(certifiedPackage.centerlineRoute).routeMiles ??
      asRecord(certifiedPackage.osrmRoute).routeMiles ??
      asRecord(certifiedPackage.spine).routeMiles ??
      certifiedPackage.routeMiles,
    routeLengthFeet ? routeLengthFeet / 5280 : 0,
  );
}

function certifiedSpine(certifiedPackage, routeCoordinates, routeLengthFeet, routeMiles) {
  const source = asRecord(certifiedPackage.spine);
  const coordinates = firstCoordinateList(source.coordinates, source.geometry, source.centerline, routeCoordinates);
  return {
    ...source,
    spineId: String(source.spineId ?? source.id ?? `${certifiedPackage.certifiedPackageId ?? certifiedPackage.packageId}:SPINE`),
    centerlineId: String(source.centerlineId ?? certifiedPackage.centerlineId ?? `${certifiedPackage.certifiedPackageId ?? certifiedPackage.packageId}:CENTERLINE`),
    routeFeet: numeric(source.routeFeet, routeLengthFeet),
    routeMiles: numeric(source.routeMiles, routeMiles),
    coordinates,
    geometry: {
      type: "LineString",
      coordinates,
    },
    source: "CERTIFIED_DRAFT_IOF_PACKAGE",
    authority: "SCOPEVERSION",
  };
}

function stationLabel(station, measureFeet) {
  const explicit = station.label ?? station.stationLabel ?? station.stationId ?? station.id;
  if (explicit) return String(explicit);
  return `${Math.floor(measureFeet / 100)}+${Math.round(measureFeet % 100).toString().padStart(2, "0")}`;
}

function certifiedStations(certifiedPackage, scopeVersionId, routeId, timestamp) {
  const stationProjection = asRecord(certifiedPackage.stationProjection);
  const stationGraph = asRecord(certifiedPackage.stationGraph ?? certifiedPackage.stationIndexedGraph);
  const sources = [
    ...asArray(certifiedPackage.stations),
    ...asArray(stationProjection.stations),
    ...asArray(stationProjection.stationObjects),
    ...asArray(stationGraph.stations),
    ...asArray(stationGraph.nodes),
  ];
  const seen = new Set();
  return sources
    .filter((station, index) => {
      const value = asRecord(station);
      const identity = String(value.stationId ?? value.id ?? `${value.measureFeet ?? value.stationFeet ?? index}:${JSON.stringify(coordinateFrom(value.coordinate ?? value.geometry) ?? null)}`);
      if (seen.has(identity)) return false;
      seen.add(identity);
      return true;
    })
    .map((station, index) => {
      const record = asRecord(station);
      const coordinate = coordinateFrom(record.coordinate ?? record.projectedCoordinate ?? record.geographicCoordinate ?? record.geometry ?? record);
      if (!coordinate) return null;
      const measureFeet = numeric(record.measureFeet ?? record.stationFeet ?? record.feet, index * 5280);
      const stationId = String(record.stationId ?? record.id ?? `${scopeVersionId}:STATION:${String(index + 1).padStart(4, "0")}`);
      return {
        ...record,
        stationId,
        scopeVersionId,
        certifiedRouteId: String(certifiedPackage.certifiedPackageId ?? certifiedPackage.packageId ?? scopeVersionId),
        routeId,
        measureFeet,
        stationFeet: measureFeet,
        stationLabel: stationLabel(record, measureFeet),
        coordinate,
        stationState: "PLANNED",
        createdAt: timestamp,
        updatedAt: timestamp,
      };
    })
    .filter(Boolean);
}

function objectType(record) {
  const metadata = asRecord(record.metadata);
  return String(metadata.structureType ?? record.structureType ?? record.objectType ?? record.unitType ?? record.type ?? "IOF_OBJECT").toUpperCase();
}

function stationForObject(stations, record) {
  const metadata = asRecord(record.metadata);
  const stationRef = String(record.stationId ?? record.station ?? metadata.stationId ?? metadata.station ?? "");
  if (!stationRef) return undefined;
  return stations.find((station) => station.stationId === stationRef || station.stationLabel === stationRef);
}

function certifiedObjects(certifiedPackage, scopeVersionId, stations, timestamp) {
  const projectedObjectManifest = asRecord(certifiedPackage.projectedObjectManifest);
  const stationObjectManifest = asRecord(certifiedPackage.stationObjectManifest);
  const sources = [
    ...asArray(certifiedPackage.projectedObjects),
    ...asArray(projectedObjectManifest.projectedObjects),
    ...asArray(stationObjectManifest.objects),
    ...asArray(certifiedPackage.objects),
    ...asArray(certifiedPackage.structures),
  ];
  const sourceObjects = sources.length ? sources : asArray(certifiedPackage.certifiedIofUnits);
  const seen = new Set();
  return sourceObjects.filter((object, index) => {
    const value = asRecord(object);
    const identity = String(value.objectId ?? value.unitId ?? value.structureId ?? value.id ?? `${objectType(value)}:${value.stationId ?? value.station ?? index}`);
    if (seen.has(identity)) return false;
    seen.add(identity);
    return true;
  }).map((object, index) => {
    const record = asRecord(object);
    const metadata = asRecord(record.metadata);
    const station = stationForObject(stations, record);
    const coordinate = coordinateFrom(record.coordinate ?? record.geometry ?? metadata.coordinate) ?? station?.coordinate;
    const measureFeet = numeric(record.measureFeet ?? record.stationFeet ?? metadata.measureFeet ?? station?.measureFeet, 0);
    const type = objectType(record);
    const objectId = String(record.objectId ?? record.unitId ?? record.structureId ?? record.id ?? `${scopeVersionId}:OBJECT:${String(index + 1).padStart(4, "0")}`);
    return {
      ...record,
      objectId,
      scopeVersionId,
      stationId: String(record.stationId ?? station?.stationId ?? ""),
      objectCategory: String(record.objectCategory ?? metadata.objectCategory ?? "INFRASTRUCTURE"),
      objectType: type,
      objectState: "PLANNED",
      label: String(record.label ?? record.name ?? type),
      coordinate,
      measureFeet,
      quantity: numeric(record.quantity ?? record.engineeringQuantity ?? record.commercialQuantity ?? metadata.quantity, 1),
      unit: String(record.unit ?? metadata.unit ?? "EA"),
      specification: String(record.specification ?? metadata.specification ?? record.constructionMethod ?? "Certified Draft IOF Package object"),
      createdAt: timestamp,
      updatedAt: timestamp,
    };
  });
}

function certifiedFacilities(objects) {
  return objects.filter((object) => /ILA|REGEN|FACILITY|HUT|VAULT|SHELTER/i.test(String(object.objectType ?? object.label ?? "")));
}

function certifiedGraph(certifiedPackage, routeCoordinates) {
  const graph = asRecord(certifiedPackage.dependencyGraph);
  const routeSegments = asArray(certifiedPackage.routeSegments);
  return {
    graphId: String(graph.graphId ?? `${certifiedPackage.certifiedPackageId ?? certifiedPackage.packageId}:GRAPH`),
    source: "CERTIFIED_DRAFT_IOF_PACKAGE",
    nodes: asArray(graph.nodes),
    edges: asArray(graph.edges),
    routeSegments,
    routeCoordinateCount: routeCoordinates.length,
    summary: {
      ...(asRecord(graph.summary)),
      nodeCount: asArray(graph.nodes).length,
      edgeCount: asArray(graph.edges).length,
      routeSegmentCount: routeSegments.length,
      routeCoordinateCount: routeCoordinates.length,
    },
  };
}

function revisionNumber(previousScopeVersion, certifiedPackage) {
  if (previousScopeVersion) return numeric(previousScopeVersion.revision ?? previousScopeVersion.canonicalTruth?.revision, 1) + 1;
  return Math.max(1, numeric(certifiedPackage.scopeVersionRevision ?? certifiedPackage.revision, 1));
}

function revisionLabel(revision) {
  return `ScopeVersion-${String(revision).padStart(4, "0")}`;
}

function scopeVersionId(certifiedPackage, revision, previousScopeVersion) {
  const explicit = certifiedPackage.proposedScopeVersionId ?? certifiedPackage.scopeVersionAuthorityId;
  if (explicit) return String(explicit);
  return `${revisionLabel(revision)}-${stableIdPart(certifiedPackage.certifiedPackageId ?? certifiedPackage.packageId ?? "CERTIFIED-IOF")}`;
}

function certifiedDraftIofPackageId(certifiedPackage = {}) {
  return String(
    certifiedPackage.certifiedDraftIofPackageId ??
      certifiedPackage.technicalSourcePackageId ??
      certifiedPackage.sourceDraftPackageId ??
      certifiedPackage.sourcePackageId ??
      certifiedPackage.draftIofPackageId ??
      certifiedPackage.draftPackageId ??
      "",
  );
}

function certifiedPackageRecordId(certifiedPackage = {}) {
  return String(certifiedPackage.certifiedPackageId ?? certifiedPackage.packageId ?? certifiedDraftIofPackageId(certifiedPackage) ?? "");
}

function readinessSnapshot(options = {}) {
  return SCOPEVERSION_AUTHORITY_READINESS.map((item) => ({
    ...item,
    status:
      ["serviceOrder", "customerSignature"].includes(item.key) && options.signedServiceOrder
        ? "PASS"
        : item.status,
    authority:
      item.key === "engineering"
        ? "CERTIFIED_DRAFT_IOF_PACKAGE"
        : ["serviceOrder", "customerSignature"].includes(item.key) && options.signedServiceOrder
          ? "SIGNED_SERVICE_ORDER"
          : "DOWNSTREAM_PENDING",
  }));
}

function acceptedStatus(value) {
  return ["ACCEPTED", "CUSTOMER_ACCEPTED", "APPROVED", "PASS", "READY"].includes(String(value ?? "").toUpperCase());
}

function authorizedStatus(value) {
  return ["PASS", "READY", "CREATED", "APPROVED", "AUTHORIZED", "EXECUTED", "ACCEPTED", "COMPLETE", "COMPLETED"].includes(String(value ?? "").toUpperCase());
}

function signedStatus(value) {
  return ["SIGNED", "CUSTOMER_SIGNED", "FULLY_SIGNED", "EXECUTED", "FULLY_EXECUTED", "COUNTERSIGNED", "COMPLETE", "COMPLETED"].includes(String(value ?? "").toUpperCase());
}

function customerAcceptanceArtifact(certifiedPackage = {}, options = {}) {
  return asRecord(
    options.customerAcceptance ??
      certifiedPackage.customerAcceptance ??
      certifiedPackage.acceptedProposal ??
      certifiedPackage.proposalAcceptance ??
      certifiedPackage.customerApproval,
  );
}

function serviceOrderArtifact(certifiedPackage = {}, options = {}) {
  return asRecord(
    options.serviceOrder ??
      certifiedPackage.serviceOrder ??
      certifiedPackage.serviceOrderReference ??
      certifiedPackage.serviceOrderArtifact,
  );
}

function customerAcceptanceId(certifiedPackage = {}, acceptance = {}, serviceOrder = {}) {
  return String(
    acceptance.customerAcceptanceId ??
      acceptance.customerAcceptanceCloseId ??
      acceptance.acceptedProposalId ??
      certifiedPackage.customerAcceptanceId ??
      certifiedPackage.customerAcceptanceCloseId ??
      certifiedPackage.acceptedProposalId ??
      serviceOrder.customerAcceptanceId ??
      serviceOrder.customerAcceptanceCloseId ??
      serviceOrder.acceptedProposalId ??
      "",
  );
}

function serviceOrderId(certifiedPackage = {}, serviceOrder = {}) {
  return String(
    serviceOrder.serviceOrderId ??
      serviceOrder.serviceOrderArtifactId ??
      serviceOrder.orderId ??
      serviceOrder.id ??
      certifiedPackage.serviceOrderId ??
      certifiedPackage.serviceOrderArtifactId ??
      "",
  );
}

function serviceOrderSignatureId(certifiedPackage = {}, serviceOrder = {}) {
  return String(
    serviceOrder.serviceOrderSignatureId ??
      serviceOrder.signatureId ??
      serviceOrder.customerSignatureId ??
      certifiedPackage.serviceOrderSignatureId ??
      certifiedPackage.customerSignatureId ??
      "",
  );
}

function serviceOrderSignedAt(certifiedPackage = {}, serviceOrder = {}) {
  return String(
    serviceOrder.serviceOrderSignedAt ??
      serviceOrder.customerSignedAt ??
      serviceOrder.signedAt ??
      serviceOrder.executedAt ??
      certifiedPackage.serviceOrderSignedAt ??
      certifiedPackage.customerSignedAt ??
      certifiedPackage.signedAt ??
      "",
  );
}

function assertConstitutionalLayerIntegrityForScopeVersion(certifiedPackage = {}, options = {}) {
  const acceptance = customerAcceptanceArtifact(certifiedPackage, options);
  const serviceOrder = serviceOrderArtifact(certifiedPackage, options);
  const acceptanceId = customerAcceptanceId(certifiedPackage, acceptance, serviceOrder);
  const orderId = serviceOrderId(certifiedPackage, serviceOrder);
  const signatureId = serviceOrderSignatureId(certifiedPackage, serviceOrder);
  const signedAt = serviceOrderSignedAt(certifiedPackage, serviceOrder);
  const hasCustomerAcceptance = Boolean(
    acceptanceId ||
      acceptance.acceptedAt ||
      certifiedPackage.customerAcceptedAt ||
      certifiedPackage.proposalAcceptedAt ||
      acceptedStatus(acceptance.status ?? certifiedPackage.customerAcceptanceStatus),
  );
  const hasServiceOrder = Boolean(
    orderId ||
      serviceOrder.createdAt ||
      serviceOrder.authorizedAt ||
      authorizedStatus(serviceOrder.status ?? serviceOrder.authorizationStatus ?? certifiedPackage.serviceOrderStatus),
  );
  const hasSignedServiceOrder = Boolean(
    signatureId ||
      signedAt ||
      signedStatus(serviceOrder.signatureStatus ?? serviceOrder.customerSignatureStatus ?? serviceOrder.status ?? certifiedPackage.serviceOrderSignatureStatus),
  );

  if (!hasCustomerAcceptance) {
    throw new Error("CONSTITUTIONAL_LAYER_INTEGRITY_BLOCKED: Service Order requires Customer Acceptance. Missing validated CUSTOMER_ACCEPTANCE_CLOSE or accepted proposal artifact. Next legal action: record and validate Customer Acceptance.");
  }
  if (!hasServiceOrder) {
    throw new Error("CONSTITUTIONAL_LAYER_INTEGRITY_BLOCKED: ScopeVersion cannot be created before Service Order. Missing Service Order artifact. Next legal action: create or attach Service Order authority, then request ScopeVersion creation.");
  }
  if (!hasSignedServiceOrder) {
    throw new Error("CONSTITUTIONAL_LAYER_INTEGRITY_BLOCKED: ScopeVersion cannot be created before signed Service Order. Missing customer signature evidence. Next legal action: capture customer signature on the Service Order, then request ScopeVersion creation.");
  }

  return { acceptance, serviceOrder, acceptanceId, serviceOrderId: orderId, serviceOrderSignatureId: signatureId, serviceOrderSignedAt: signedAt };
}

function graphSummary(graph, stations, objects) {
  return {
    nodeCount: asArray(graph.nodes).length,
    edgeCount: asArray(graph.edges).length,
    stationCount: stations.length,
    routeCount: graph.routeCoordinateCount > 1 ? 1 : 0,
  };
}

function geometryAuthorityDiagnosticsFromPackage(certifiedPackage = {}) {
  const projectedObjectManifest = asRecord(certifiedPackage.projectedObjectManifest);
  const doctrineProjectionDiagnostics = asRecord(certifiedPackage.doctrineProjectionDiagnostics);
  return asRecord(
    certifiedPackage.geometryAuthorityDiagnostics ??
      projectedObjectManifest.geometryAuthorityDiagnostics ??
      doctrineProjectionDiagnostics.geometryAuthorityDiagnostics,
  );
}

export function createScopeVersionFromCertifiedPackage(certifiedPackage = {}, options = {}) {
  if (String(certifiedPackage.status ?? "").toUpperCase() !== "CERTIFIED") {
    throw new Error("Only Certified Draft IOF Packages may be promoted to ScopeVersion authority.");
  }
  const timestamp = options.createdAt ?? nowIso();
  const previousScopeVersion = options.previousScopeVersion;
  const revision = revisionNumber(previousScopeVersion, certifiedPackage);
  const scopeVersionIdValue = scopeVersionId(certifiedPackage, revision, previousScopeVersion);
  const routeCoordinates = routeCoordinatesFromCertifiedPackage(certifiedPackage);
  if (routeCoordinates.length < 2) {
    throw new Error("Certified Draft IOF Package cannot create ScopeVersion without certified route geometry.");
  }
  const routeLengthFeet = routeLengthFeetFromPackage(certifiedPackage);
  const routeMiles = routeMilesFromPackage(certifiedPackage, routeLengthFeet);
  const routeId = String(certifiedPackage.routeId ?? certifiedPackage.centerlineId ?? `${scopeVersionIdValue}:ROUTE`);
  const spine = certifiedSpine(certifiedPackage, routeCoordinates, routeLengthFeet, routeMiles);
  const stations = certifiedStations(certifiedPackage, scopeVersionIdValue, routeId, timestamp);
  const objects = certifiedObjects(certifiedPackage, scopeVersionIdValue, stations, timestamp);
  const facilities = certifiedFacilities(objects);
  const graph = certifiedGraph(certifiedPackage, routeCoordinates);
  const constraints = [
    ...asArray(certifiedPackage.constraintsReviewed),
    ...asArray(certifiedPackage.engineeringConstraints),
    ...asArray(certifiedPackage.constraints),
  ];
  const redlineHistory = [
    ...asArray(certifiedPackage.redlineHistory),
    ...asArray(certifiedPackage.redlineRevisionHistory),
  ];
  const objectMoveHistory = asArray(certifiedPackage.objectMoveHistory);
  const engineeringNotes = unique([
    certifiedPackage.notes,
    ...asArray(certifiedPackage.engineeringNotes),
    asRecord(certifiedPackage.engineeringChecklist).engineeringNotes,
  ]);
  const certificate = asRecord(options.certificate);
  const user = asRecord(options.user);
  const approvedBy = String(options.approvedBy ?? user.name ?? "Runtime");
  const approvedTimestamp = String(options.approvedTimestamp ?? timestamp);
  const parentScopeVersionId = previousScopeVersion?.scopeVersionId ?? options.parentScopeVersionId ?? certifiedPackage.parentScopeVersionId;
  const rootScopeVersionId = previousScopeVersion?.rootScopeVersionId ?? previousScopeVersion?.scopeVersionId ?? parentScopeVersionId ?? scopeVersionIdValue;
  const previousRevision = previousScopeVersion
    ? {
        scopeVersionId: previousScopeVersion.scopeVersionId,
        revision: previousScopeVersion.revision ?? previousScopeVersion.canonicalTruth?.revision,
        revisionLabel: previousScopeVersion.revisionLabel ?? previousScopeVersion.canonicalTruth?.revisionLabel,
      }
    : undefined;
  const productDoctrine = {
    doctrineId: certifiedPackage.doctrineId ?? certifiedPackage.productDoctrine?.doctrineId,
    productDoctrineVersion: certifiedPackage.productDoctrineVersion ?? certifiedPackage.doctrineVersion,
    productDoctrineRules: certifiedPackage.productDoctrineRules,
    productDoctrineAssembly: certifiedPackage.productDoctrineAssembly,
  };
  const geometryAuthorityDiagnostics = geometryAuthorityDiagnosticsFromPackage(certifiedPackage);
  if (geometryAuthorityDiagnostics.geometryAuthority !== "PASS" || geometryAuthorityDiagnostics.status !== "PASS") {
    throw new Error("CONSTITUTIONAL_LAYER_INTEGRITY_BLOCKED: ScopeVersion cannot be created until Geometry Authority is PASS.");
  }
  const closureLedgerId = String(certifiedPackage.closureLedgerId ?? certifiedPackage.closureLedger?.closureLedgerId ?? "");
  const iofPackageTwinId = String(certifiedPackage.iofPackageTwinId ?? certifiedPackage.iofPackageTwin?.twinProjectionId ?? "");
  const executionGraphId = String(certifiedPackage.executionGraphId ?? certifiedPackage.iofPackageTwin?.executionGraphId ?? "");
  const lifecycleGraphId = String(certifiedPackage.lifecycleGraphId ?? certifiedPackage.iofPackageTwin?.lifecycleGraphId ?? "");
  const commercialAuditStatus = String(certifiedPackage.commercialAuditStatus ?? certifiedPackage.commercialAuditReconciliation?.status ?? "");
  const constitutionalStateValidationStatus = String(certifiedPackage.constitutionalStateValidationStatus ?? certifiedPackage.constitutionalStateValidation?.status ?? "");
  if (!closureLedgerId || !iofPackageTwinId || !executionGraphId || !lifecycleGraphId) {
    throw new Error("CONSTITUTIONAL_LAYER_INTEGRITY_BLOCKED: ScopeVersion requires Closure Ledger, IOF Package Twin, Execution Graph, and Lifecycle Graph references.");
  }
  if (commercialAuditStatus !== "PASS" || constitutionalStateValidationStatus !== "PASS") {
    throw new Error("CONSTITUTIONAL_LAYER_INTEGRITY_BLOCKED: ScopeVersion requires Commercial Audit and Constitutional State Authority validation to be PASS.");
  }
  const layerIntegrityAuthority = assertConstitutionalLayerIntegrityForScopeVersion(certifiedPackage, options);
  const certifiedPackageId = certifiedPackageRecordId(certifiedPackage);
  const certifiedDraftPackageId = certifiedDraftIofPackageId(certifiedPackage);
  const certifiedIofUnitIds = asArray(certifiedPackage.certifiedIofUnits).map((unit) => unit.unitId);
  const engineeringDoctrine = {
    doctrineStatus: certifiedPackage.doctrineStatus,
    engineeringChecklist: certifiedPackage.engineeringChecklist,
    approvedExceptions: certifiedPackage.approvedExceptions ?? certifiedPackage.exceptionsApproved,
    doctrineExceptions: certifiedPackage.doctrineExceptions,
  };
  const validationSnapshot = {
    packageValidation: certifiedPackage.validation,
    packageReadiness: certifiedPackage.packageReadiness,
    readiness: certifiedPackage.readiness,
    engineeringReadiness: certifiedPackage.engineeringReadiness,
  };
  const doctrineComplianceSnapshot = {
    doctrineStatus: certifiedPackage.doctrineStatus,
    validation: certifiedPackage.validation,
    compliance: certifiedPackage.compliance,
    exceptionsApproved: certifiedPackage.approvedExceptions ?? certifiedPackage.exceptionsApproved,
  };
  const digitalCertificationMetadata = {
    certificateId: certificate.certificateId,
    scopeVersionId: scopeVersionIdValue,
    certifiedIofPackageId: certifiedPackageId,
    certifiedDraftIofPackageId: certifiedDraftPackageId,
    technicalSourcePackageId: certifiedDraftPackageId,
    sourceDraftPackageId: certifiedDraftPackageId,
    certifiedAt: certifiedPackage.certifiedAt ?? certifiedPackage.certificationDate,
    certifiedBy: certifiedPackage.certifiedBy ?? certifiedPackage.engineer,
    certifiedById: certifiedPackage.certifiedById ?? certifiedPackage.engineerId,
    engineeringApprover: certificate.engineeringApprover ?? approvedBy,
    engineeringApproverId: certificate.engineeringApproverId ?? user.userId,
    certificationConfidence: certificate.certificationConfidence ?? certifiedPackage.certificationConfidence,
  };
  const assemblyFingerprint = hashPayload({
    scopeVersionId: scopeVersionIdValue,
    certifiedIofPackageId: certifiedPackageId,
    certifiedDraftIofPackageId: certifiedDraftPackageId,
    routeCoordinates,
    spine,
    stations,
    objects,
    constraints,
    redlineHistory,
    doctrineComplianceSnapshot,
    validationSnapshot,
    digitalCertificationMetadata,
  });
  digitalCertificationMetadata.assemblyFingerprint = assemblyFingerprint;
  const downstreamReadiness = readinessSnapshot({ signedServiceOrder: true });
  const canonicalTruth = {
    lifecycleState: "CERTIFIED",
    lifecycleTimestamp: timestamp,
    constitutionalAuthority: SCOPEVERSION_CERTIFIED_DRAFT_IOF_AUTHORITY,
    authority: SCOPEVERSION_ORDER_FOR_EXECUTION_AUTHORITY,
    canonicalDefinition: "ScopeVersion is the Order for Execution.",
    orderForExecution: true,
    executionBeginsAtScopeVersion: true,
    preScopeVersionArtifactsArePlanningOnly: true,
    downstreamExecutionRequiresScopeVersion: true,
    nonExecutableArtifacts: ["PROPOSAL", "SERVICE_ORDER", "DRAFT_IOF_PACKAGE"],
    executionConsumers: ["MARKETPLACE", "CONTROL", "FIELD", "CLOSURE", "OPERATIONAL_TWIN", "OPERATIONAL_INTELLIGENCE"],
    immutable: true,
    parentCertifiedPackageId: certifiedPackageId,
    certifiedIofPackageId: certifiedPackageId,
    certifiedDraftIofPackageId: certifiedDraftPackageId,
    technicalSourcePackageId: certifiedDraftPackageId,
    sourceDraftPackageId: certifiedDraftPackageId,
    engineeringTruthAuthority: "CERTIFIED_DRAFT_IOF_PACKAGE",
    singleEngineeringTruth: true,
    noEngineeringRecreation: true,
    noAdditionalEngineeringReviewAfterSignature: true,
    executionAuthorizationCertificateId: certificate.certificateId,
    customerAcceptanceId: layerIntegrityAuthority.acceptanceId,
    customerAcceptance: layerIntegrityAuthority.acceptance,
    serviceOrderId: layerIntegrityAuthority.serviceOrderId,
    serviceOrderSignatureId: layerIntegrityAuthority.serviceOrderSignatureId,
    serviceOrderSignedAt: layerIntegrityAuthority.serviceOrderSignedAt,
    customerSignatureId: layerIntegrityAuthority.serviceOrderSignatureId,
    serviceOrder: layerIntegrityAuthority.serviceOrder,
    proposalId: certifiedPackage.proposalId,
    accountId: certifiedPackage.accountId,
    customerId: certifiedPackage.customerId,
    opportunityId: certifiedPackage.opportunityId,
    productId: certifiedPackage.productId,
    productName: certifiedPackage.productName,
    fulfillmentPlanId: certifiedPackage.fulfillmentPlanId,
    fulfillmentStrategy: certifiedPackage.fulfillmentStrategy,
    proposalRecipientContactIds: unique(certifiedPackage.proposalRecipientContactIds),
    customerReviewContactIds: unique(certifiedPackage.customerReviewContactIds),
    approvalAuthorityContactIds: unique(certifiedPackage.approvalAuthorityContactIds),
    sofRecipientContactIds: unique(certifiedPackage.sofRecipientContactIds),
    customerContactEmails: unique(certifiedPackage.customerContactEmails),
    runtimeObjectIds: unique(certifiedPackage.runtimeObjectIds),
    runtimeRelationshipIds: unique(certifiedPackage.runtimeRelationshipIds),
    runtimeEvidenceIds: unique(certifiedPackage.runtimeEvidenceIds),
    certifiedIofUnitIds,
    revision,
    revisionLabel: revisionLabel(revision),
    parentScopeVersionId,
    rootScopeVersionId,
    previousRevision,
    changeSummary: options.changeSummary ?? certifiedPackage.changeSummary ?? (previousScopeVersion ? "Engineering revision promoted from Certified Draft IOF Package." : "Initial ScopeVersion authority from Certified Draft IOF Package."),
    engineeringReason: options.engineeringReason ?? certifiedPackage.engineeringReason ?? "Authorized Teralinx countersignature atomically created the ScopeVersion Order for Execution from the exact Service Order and Certified Draft IOF Package.",
    approvedBy,
    approvedTimestamp,
    customer: {
      customerId: certifiedPackage.customerId,
      name: certifiedPackage.customerSummary?.name ?? certifiedPackage.customerName ?? certifiedPackage.customerId,
    },
    account: {
      accountId: certifiedPackage.accountId,
      name: certifiedPackage.accountName ?? certifiedPackage.customerSummary?.accountName,
    },
    opportunity: {
      opportunityId: certifiedPackage.opportunityId,
      proposalId: certifiedPackage.proposalId,
    },
    product: {
      productId: certifiedPackage.productId,
      productName: certifiedPackage.productName,
      fulfillmentPlanId: certifiedPackage.fulfillmentPlanId,
      fulfillmentStrategy: certifiedPackage.fulfillmentStrategy,
    },
    productDoctrine,
    engineeringDoctrine,
    measuredCenterlineId: certifiedPackage.measuredCenterlineId ?? geometryAuthorityDiagnostics.measuredCenterlineId,
    projectedObjectManifestId: certifiedPackage.projectedObjectManifestId,
    stationGraphId: certifiedPackage.stationGraphId,
    stationAuthorityIds: unique(certifiedPackage.stationAuthorityIds),
    closureLedgerId,
    iofPackageTwinId,
    executionGraphId,
    lifecycleGraphId,
    commercialAuditStatus,
    constitutionalStateValidationStatus,
    geometryAuthority: "MEASURED_CENTERLINE",
    geometryAuthorityDiagnostics,
    singleGeometryAuthority: true,
    noIndependentSpanGeometry: true,
    routeGeometry: routeCoordinates,
    geometry: routeCoordinates,
    certifiedGeometry: {
      type: "LineString",
      coordinates: routeCoordinates,
    },
    certifiedSpine: spine,
    spine,
    certifiedStations: stations,
    stations,
    certifiedGraph: graph,
    graph,
    certifiedObjects: objects,
    objects,
    facilityInventory: facilities,
    constructionQuantities: certifiedPackage.quantitySummary ?? certifiedPackage.commercialSummary?.quantitySummary ?? {},
    routeLength: {
      feet: routeLengthFeet,
      miles: routeMiles,
      source: "CERTIFIED_DRAFT_IOF_PACKAGE",
    },
    constraintHistory: constraints,
    constraints,
    constraintSummary: certifiedPackage.constraintSummary,
    redlineHistory,
    objectMoveHistory,
    engineeringNotes,
    doctrineComplianceSnapshot,
    validationSnapshot,
    validation: validationSnapshot,
    digitalCertificationMetadata,
    downstreamReadiness,
    readiness: downstreamReadiness,
    executionGate: {
      businessApproval: "PENDING",
      legalApproval: "PENDING",
      serviceOrder: "PASS",
      customerSignature: "PASS",
      control: "PENDING",
      marketplace: "PENDING",
      field: "PENDING",
      operationalTwin: "PENDING",
      engineering: "PASS",
    },
    graphSummary: graphSummary(graph, stations, objects),
    networkBasis: {
      routeId,
      routeName: String(certifiedPackage.routeName ?? certifiedPackage.centerlineId ?? routeId),
      nodeId: "",
      stationId: stations[0]?.stationId ?? "",
      attachmentPoint: routeCoordinates[0],
      attachmentCoordinates: routeCoordinates[0],
      certificationStatus: "CERTIFIED",
    },
    geographicBasis: {
      candidateLatitude: numeric(routeCoordinates[0]?.[1], 0),
      candidateLongitude: numeric(routeCoordinates[0]?.[0], 0),
      geometry: routeCoordinates,
      routeGeometry: routeCoordinates,
      certifiedGeometry: routeCoordinates,
      spineGeometry: spine.coordinates,
      buildPath: {
        source: "CERTIFIED_DRAFT_IOF_PACKAGE",
        coordinates: routeCoordinates,
      },
    },
    engineeringBasis: {
      buildFeet: routeLengthFeet,
      buildMiles: routeMiles,
      routeStatus: "VALID",
      certificationReadiness: "SCOPEVERSION_ORDER_FOR_EXECUTION_CREATED",
      certifiedGeometrySnapshot: routeCoordinates,
      certifiedGeometryHash: hashPayload(routeCoordinates),
      constraints,
      constraintSummary: certifiedPackage.constraintSummary,
      redlineHistory,
      objectMoveHistory,
      engineeringNotes,
      doctrineComplianceSnapshot,
      validationSnapshot,
    },
    authorityModel: {
      commercial: "ENDED_AT_DRAFT_IOF_PACKAGE",
      engineering: "ENDED_AT_CERTIFIED_DRAFT_IOF_PACKAGE",
      engineeringTruth: "CERTIFIED_DRAFT_IOF_PACKAGE",
      proposal: "COMMERCIAL_PROJECTION_OF_CERTIFIED_DRAFT_IOF_PACKAGE",
      serviceOrder: "COMMERCIAL_AUTHORIZATION_REFERENCING_CERTIFIED_DRAFT_IOF_PACKAGE",
      runtimePromotion: "TERALINX_COUNTERSIGNATURE_ATOMIC_SCOPEVERSION_CREATION",
      scopeVersion: "ORDER_FOR_EXECUTION",
      downstreamExecution: "EXECUTES_ONLY_AGAINST_SCOPEVERSION",
      business: "MAY_AUTHORIZE_WITHOUT_ENGINEERING_MUTATION",
      legal: "MAY_AUTHORIZE_WITHOUT_ENGINEERING_MUTATION",
      noAdditionalEngineeringReviewAfterSignature: true,
    },
  };
  return {
    scopeVersionId: scopeVersionIdValue,
    type: "SCOPEVERSION_AUTHORITY",
    source: "CertifiedIofPackage",
    status: "CERTIFIED",
    certificationState: "CERTIFIED",
    canonicalDefinition: "ScopeVersion is the Order for Execution.",
    orderForExecution: true,
    executionBeginsAtScopeVersion: true,
    downstreamExecutionRequiresScopeVersion: true,
    isImmutable: true,
    immutable: true,
    revision,
    revisionLabel: revisionLabel(revision),
    parentScopeVersionId,
    rootScopeVersionId,
    relationshipType: parentScopeVersionId ? "AMENDMENT" : "ROOT",
    previousRevision,
    changeSummary: canonicalTruth.changeSummary,
    engineeringReason: canonicalTruth.engineeringReason,
    approvedBy,
    approvedTimestamp,
    certifiedIofPackageId: certifiedPackageId,
    certifiedDraftIofPackageId: certifiedDraftPackageId,
    technicalSourcePackageId: certifiedDraftPackageId,
    parentCertifiedPackageId: certifiedPackageId,
    executionAuthorizationCertificateId: certificate.certificateId,
    customerAcceptanceId: layerIntegrityAuthority.acceptanceId,
    serviceOrderId: layerIntegrityAuthority.serviceOrderId,
    serviceOrderSignatureId: layerIntegrityAuthority.serviceOrderSignatureId,
    serviceOrderSignedAt: layerIntegrityAuthority.serviceOrderSignedAt,
    proposalId: certifiedPackage.proposalId,
    productId: certifiedPackage.productId,
    productName: certifiedPackage.productName,
    fulfillmentPlanId: certifiedPackage.fulfillmentPlanId,
    fulfillmentStrategy: certifiedPackage.fulfillmentStrategy,
    accountId: certifiedPackage.accountId,
    customerId: certifiedPackage.customerId,
    opportunityId: certifiedPackage.opportunityId,
    organizationId: user.organizationId ?? certifiedPackage.organizationId,
    workspaceId: user.workspaceId ?? certifiedPackage.workspaceId,
    createdBy: approvedBy,
    user: approvedBy,
    routeLengthFeet,
    routeMiles,
    geometry: routeCoordinates,
    graphSummary: canonicalTruth.graphSummary,
    certifiedRouteReference: {
      certifiedRouteId: certifiedPackageId,
      sourceCertifiedPackageId: certifiedPackageId,
      certifiedDraftIofPackageId: certifiedDraftPackageId,
      routeAuthorityState: "CERTIFIED_ROUTE",
      certifiedAt: certifiedPackage.certifiedAt ?? certifiedPackage.certificationDate ?? timestamp,
      certifiedBy: certifiedPackage.certifiedBy ?? certifiedPackage.engineer ?? approvedBy,
    },
    iofPackageIds: unique([certifiedDraftPackageId, certifiedPackageId]),
    runtimeObjectIds: unique(certifiedPackage.runtimeObjectIds),
    runtimeRelationshipIds: unique(certifiedPackage.runtimeRelationshipIds),
    runtimeEvidenceIds: unique(certifiedPackage.runtimeEvidenceIds),
    certifiedIofUnitIds,
    measuredCenterlineId: certifiedPackage.measuredCenterlineId ?? geometryAuthorityDiagnostics.measuredCenterlineId,
    projectedObjectManifestId: certifiedPackage.projectedObjectManifestId,
    stationGraphId: certifiedPackage.stationGraphId,
    stationAuthorityIds: unique(certifiedPackage.stationAuthorityIds),
    closureLedgerId,
    iofPackageTwinId,
    executionGraphId,
    lifecycleGraphId,
    commercialAuditStatus,
    constitutionalStateValidationStatus,
    geometryAuthority: "MEASURED_CENTERLINE",
    geometryAuthorityDiagnostics,
    singleGeometryAuthority: true,
    noIndependentSpanGeometry: true,
    decisionTimestamp: timestamp,
    canonicalTruth,
    createdAt: timestamp,
    updatedAt: timestamp,
    events: [{
      eventId: `event-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      type: "scopeversion.created_from_authorized_teralinx_countersignature",
      entityId: scopeVersionIdValue,
      entityType: "ScopeVersion",
      payload: {
        certifiedIofPackageId: certifiedPackageId,
        certifiedDraftIofPackageId: certifiedDraftPackageId,
        serviceOrderId: layerIntegrityAuthority.serviceOrderId,
        serviceOrderSignatureId: layerIntegrityAuthority.serviceOrderSignatureId,
        executionAuthorizationCertificateId: certificate.certificateId,
        revision,
        revisionLabel: revisionLabel(revision),
        parentScopeVersionId,
        authority: "SCOPEVERSION",
      },
      createdAt: timestamp,
    }],
  };
}

export function markCertifiedPackagePromoted(certifiedPackage, scopeVersion, certificate) {
  const timestamp = nowIso();
  const truth = asRecord(scopeVersion.canonicalTruth);
  return {
    ...certifiedPackage,
    certifiedDraftIofPackageId: certifiedPackage.certifiedDraftIofPackageId ?? truth.certifiedDraftIofPackageId ?? certifiedDraftIofPackageId(certifiedPackage),
    technicalSourcePackageId: certifiedPackage.technicalSourcePackageId ?? truth.technicalSourcePackageId ?? certifiedDraftIofPackageId(certifiedPackage),
    singleEngineeringTruth: true,
    noEngineeringRecreation: true,
    noAdditionalEngineeringReviewAfterSignature: true,
    scopeVersionId: scopeVersion.scopeVersionId,
    scopeVersionRevision: scopeVersion.revision,
    scopeVersionCreated: true,
    scopeVersionCreatedAt: timestamp,
    executionAuthorizationCertificateId: certificate.certificateId,
    customerAcceptanceId: scopeVersion.customerAcceptanceId ?? truth.customerAcceptanceId,
    serviceOrderId: scopeVersion.serviceOrderId ?? truth.serviceOrderId,
    serviceOrderSignatureId: scopeVersion.serviceOrderSignatureId ?? truth.serviceOrderSignatureId,
    serviceOrderSignedAt: scopeVersion.serviceOrderSignedAt ?? truth.serviceOrderSignedAt,
    executionAuthorized: true,
    engineeringCertificationLocked: true,
    engineeringReadOnly: true,
    immutable: true,
    readiness: {
      ...(certifiedPackage.readiness ?? {}),
      status: "SCOPEVERSION_AUTHORITY_CREATED",
      readyForScopeVersionCreation: false,
      scopeVersionCreated: true,
      scopeVersionId: scopeVersion.scopeVersionId,
    },
    updatedAt: timestamp,
  };
}

export function validateScopeVersionAuthority(scopeVersion = {}) {
  const truth = asRecord(scopeVersion.canonicalTruth);
  const failures = [];
  const requireValue = (condition, message) => {
    if (!condition) failures.push(message);
  };
  requireValue(scopeVersion.scopeVersionId, "ScopeVersion ID is required.");
  requireValue(scopeVersion.certifiedDraftIofPackageId || truth.certifiedDraftIofPackageId || scopeVersion.certifiedIofPackageId || truth.certifiedIofPackageId, "Certified Draft IOF Package reference is required.");
  requireValue(scopeVersion.customerAcceptanceId || truth.customerAcceptanceId || asRecord(truth.customerAcceptance).acceptedProposalId, "Customer Acceptance reference is required before ScopeVersion authority.");
  requireValue(scopeVersion.serviceOrderId || truth.serviceOrderId || asRecord(truth.serviceOrder).serviceOrderId, "Service Order reference is required before ScopeVersion authority.");
  requireValue(
    scopeVersion.serviceOrderSignatureId ||
      truth.serviceOrderSignatureId ||
      truth.customerSignatureId ||
      truth.serviceOrderSignedAt ||
      truth.customerSignedAt ||
      asRecord(truth.serviceOrder).serviceOrderSignatureId ||
      asRecord(truth.serviceOrder).signatureId ||
      asRecord(truth.serviceOrder).customerSignatureId ||
      asRecord(truth.serviceOrder).signedAt ||
      asRecord(truth.serviceOrder).customerSignedAt ||
      asRecord(truth.serviceOrder).executedAt,
    "Signed Service Order reference is required before ScopeVersion authority.",
  );
  const legacyOperationalBaseline = truth.authority === "SCOPEVERSION_OPERATIONAL_BASELINE";
  requireValue(scopeVersion.isImmutable === true || scopeVersion.immutable === true || truth.immutable === true, "ScopeVersion must be immutable.");
  requireValue(scopeVersion.orderForExecution === true || truth.orderForExecution === true || legacyOperationalBaseline, "ScopeVersion must be the Order for Execution.");
  requireValue(truth.authority === SCOPEVERSION_ORDER_FOR_EXECUTION_AUTHORITY || truth.authority === "SCOPEVERSION_OPERATIONAL_BASELINE", "ScopeVersion authority must mark the Order for Execution.");
  requireValue(truth.downstreamExecutionRequiresScopeVersion === true || legacyOperationalBaseline, "Downstream execution must require ScopeVersion.");
  requireValue(
    truth.constitutionalAuthority === SCOPEVERSION_CERTIFIED_DRAFT_IOF_AUTHORITY ||
      truth.constitutionalAuthority === SCOPEVERSION_LEGACY_CERTIFIED_IOF_AUTHORITY,
    "ScopeVersion authority must derive from Certified Draft IOF Package.",
  );
  requireValue(truth.singleEngineeringTruth === true || Boolean(truth.certifiedDraftIofPackageId), "ScopeVersion must preserve the Certified Draft IOF Package as single engineering truth.");
  requireValue(truth.noAdditionalEngineeringReviewAfterSignature === true, "Runtime promotion must not require additional Engineering review after signature.");
  const geometryAuthorityDiagnostics = asRecord(truth.geometryAuthorityDiagnostics ?? scopeVersion.geometryAuthorityDiagnostics);
  requireValue((truth.geometryAuthority === "MEASURED_CENTERLINE" || scopeVersion.geometryAuthority === "MEASURED_CENTERLINE" || legacyOperationalBaseline), "ScopeVersion geometry authority must be MeasuredCenterline.");
  requireValue((geometryAuthorityDiagnostics.geometryAuthority === "PASS" && geometryAuthorityDiagnostics.status === "PASS") || legacyOperationalBaseline, "Geometry Authority must be PASS before ScopeVersion authority.");
  requireValue(truth.measuredCenterlineId || scopeVersion.measuredCenterlineId || legacyOperationalBaseline, "Measured Centerline reference is required before ScopeVersion authority.");
  requireValue(truth.projectedObjectManifestId || scopeVersion.projectedObjectManifestId || legacyOperationalBaseline, "Projected Object Manifest reference is required before ScopeVersion authority.");
  requireValue(truth.stationGraphId || scopeVersion.stationGraphId || legacyOperationalBaseline, "Station Graph reference is required before ScopeVersion authority.");
  requireValue(asArray(truth.stationAuthorityIds ?? scopeVersion.stationAuthorityIds).length > 0 || legacyOperationalBaseline, "Station Authority references are required before ScopeVersion authority.");
  requireValue(truth.closureLedgerId || scopeVersion.closureLedgerId || legacyOperationalBaseline, "Closure Ledger reference is required before ScopeVersion authority.");
  requireValue(truth.iofPackageTwinId || scopeVersion.iofPackageTwinId || legacyOperationalBaseline, "IOF Package Twin reference is required before ScopeVersion authority.");
  requireValue(truth.executionGraphId || scopeVersion.executionGraphId || legacyOperationalBaseline, "Execution Graph reference is required before ScopeVersion authority.");
  requireValue(truth.lifecycleGraphId || scopeVersion.lifecycleGraphId || legacyOperationalBaseline, "Lifecycle Graph reference is required before ScopeVersion authority.");
  requireValue((truth.commercialAuditStatus === "PASS" || scopeVersion.commercialAuditStatus === "PASS" || legacyOperationalBaseline), "Commercial Audit must be PASS before ScopeVersion authority.");
  requireValue((truth.constitutionalStateValidationStatus === "PASS" || scopeVersion.constitutionalStateValidationStatus === "PASS" || legacyOperationalBaseline), "Constitutional State Authority validation must be PASS before ScopeVersion authority.");
  requireValue(coordinatesFrom(truth.routeGeometry ?? truth.geometry ?? scopeVersion.geometry).length > 1, "Certified geometry is required.");
  requireValue(asRecord(truth.spine ?? truth.certifiedSpine).spineId, "Certified spine is required.");
  requireValue(asArray(truth.stations ?? truth.certifiedStations).length > 0, "Certified stations are required.");
  requireValue(asArray(asRecord(truth.graph ?? truth.certifiedGraph).nodes).length >= 0 && asRecord(truth.graph ?? truth.certifiedGraph).graphId, "Certified graph is required.");
  requireValue(asArray(truth.objects ?? truth.certifiedObjects).length > 0, "Certified objects are required.");
  requireValue(asArray(truth.constraints ?? truth.constraintHistory).length >= 0, "Constraint history must be present.");
  requireValue(numeric(asRecord(truth.routeLength).feet) > 0, "Route length is required.");
  requireValue(Object.keys(asRecord(truth.productDoctrine)).length > 0, "Product doctrine snapshot is required.");
  requireValue(Object.keys(asRecord(truth.engineeringDoctrine)).length > 0, "Engineering doctrine snapshot is required.");
  requireValue(Object.keys(asRecord(truth.validationSnapshot)).length > 0, "Validation snapshot is required.");
  const readiness = asArray(truth.downstreamReadiness);
  requireValue(readiness.some((item) => item.key === "engineering" && item.status === "PASS"), "Engineering readiness must be PASS.");
  requireValue(readiness.some((item) => item.key === "serviceOrder" && item.status === "PASS"), "Service Order readiness must be PASS.");
  requireValue(readiness.some((item) => item.key === "customerSignature" && item.status === "PASS"), "Customer Signature readiness must be PASS.");
  requireValue(readiness.filter((item) => !["engineering", "serviceOrder", "customerSignature"].includes(item.key)).every((item) => item.status === "PENDING"), "Downstream readiness after signed Service Order must be PENDING.");
  return {
    status: failures.length ? "FAIL" : "PASS",
    failures,
  };
}
