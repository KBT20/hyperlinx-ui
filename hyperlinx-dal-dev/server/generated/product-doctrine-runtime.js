import { createHash as qe } from "node:crypto";
const _ = "DOCTRINE_OBJECT_INSTANTIATION_ENGINE", he = "32.1";
function J(e, n = "UNKNOWN") {
  return (String(e ?? n).trim() || n).replace(/[^A-Za-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 96) || n;
}
function me(e) {
  const n = Math.max(0, Math.round(e)), t = Math.floor(n / 100), i = n % 100;
  return `STA ${t}+${String(i).padStart(2, "0")}`;
}
function ye(e) {
  return {
    stationId: e.stationId,
    stationLabel: me(e.stationFeet),
    measureFeet: e.stationFeet,
    coordinate: e.coordinate
  };
}
function Se(e, n) {
  return e.reduce((t, i) => Math.abs(i.measureFeet - n) < Math.abs(t.measureFeet - n) ? i : t, e[0]);
}
function ve(e, n, t) {
  if (e.length <= 1) return e[0];
  if (t <= 1) return e[Math.floor(e.length / 2)];
  const i = Math.min(e.length - 1, Math.max(0, Math.round(n / Math.max(1, t - 1) * (e.length - 1))));
  return e[i];
}
function Pe(e) {
  return e[0];
}
function Ge(e) {
  return e[e.length - 1] ?? e[0];
}
function Ue(e) {
  const n = e.stations.map(ye);
  if (n.length) return n;
  const t = e.centerline, i = e.quantitySummary.routeFeet;
  return t.length > 1 ? [
    { stationId: `${e.assemblyId}:STA-A`, stationLabel: "STA 0+00", measureFeet: 0, coordinate: t[0] },
    { stationId: `${e.assemblyId}:STA-Z`, stationLabel: me(i), measureFeet: i, coordinate: t[t.length - 1] }
  ] : [
    { stationId: `${e.assemblyId}:STA-UNKNOWN-A`, stationLabel: "STA 0+00", measureFeet: 0, coordinate: [0, 0] },
    { stationId: `${e.assemblyId}:STA-UNKNOWN-Z`, stationLabel: "STA 0+01", measureFeet: 1, coordinate: [0, 0] }
  ];
}
function Ve(e, n) {
  const t = new Map(n.map((r) => [r.stationId, r])), i = e.routeSegments.map((r, s) => ({
    segmentId: r.segmentId,
    stationStart: t.get(r.fromStationId) ?? Se(n, r.fromMile * 5280),
    stationEnd: t.get(r.toStationId) ?? Se(n, r.toMile * 5280),
    addressKind: "LINEAR",
    index: s
  }));
  return i.length ? i : [{
    segmentId: `${e.assemblyId}:SEGMENT:FULL-ROUTE`,
    stationStart: Pe(n),
    stationEnd: Ge(n),
    addressKind: "LINEAR"
  }];
}
function je(e, n, t, i) {
  return {
    paymentSequenceId: `${n}:PAYMENT-SEQUENCE`,
    objectId: n,
    billableTrigger: i.billableTrigger,
    paymentTrigger: i.paymentTrigger,
    capitalCashFlowTrigger: i.capitalCashFlowTrigger ?? "Capital/cash-flow trigger follows accepted close sequence.",
    paymentEligible: !1,
    sequenceIndex: t,
    noScopeVersionCreation: !0
  };
}
function Z(e, n) {
  const t = new Set(n);
  return e.filter((i) => i.requiredFor.some((r) => t.has(r)));
}
function X(e, n, t) {
  return e.find((i) => i.appliesTo === n && i.appliesToId === t) ?? null;
}
function ee(e, n, t) {
  return e.find((i) => i.appliesTo === n && i.appliesToId === t) ?? null;
}
function Fe(e) {
  const n = e.target.pointStation, t = n?.stationLabel ?? e.target.stationStart.stationLabel, i = n?.stationLabel ?? e.target.stationEnd.stationLabel, r = n?.measureFeet ?? e.target.stationStart.measureFeet, s = n?.measureFeet ?? e.target.stationEnd.measureFeet, c = t === i ? t : `${t} to ${i}`, u = n?.coordinate, d = [
    e.scopeVersionCandidateId,
    J(e.target.segmentId),
    e.objectType,
    c,
    u ? `${u[1]}, ${u[0]}` : ""
  ].filter(Boolean).join(" / ");
  return {
    scopeVersionCandidateId: e.scopeVersionCandidateId,
    routeId: e.routeId,
    segmentId: e.target.segmentId,
    stationStart: t,
    stationEnd: i,
    stationStartFeet: r,
    stationEndFeet: s,
    objectType: e.objectType,
    objectSequence: e.objectSequence,
    parentObjectId: e.parentObjectId,
    geometryHash: e.geometryHash,
    jurisdiction: e.jurisdiction,
    latitude: u?.[1],
    longitude: u?.[0],
    stationRange: c,
    addressLabel: d,
    addressKind: e.target.addressKind,
    noScopeVersionCreation: !0
  };
}
function Me(e, n) {
  const t = n.pointStation;
  return t ? {
    geometryType: "POINT",
    coordinates: [t.coordinate],
    geometryHash: e.geometryHash
  } : {
    geometryType: "LINESTRING",
    coordinates: [n.stationStart.coordinate, n.stationEnd.coordinate],
    geometryHash: e.geometryHash
  };
}
function He(e) {
  const n = e.toUpperCase();
  return n.includes("BORE") ? "DIRECTIONAL_BORE" : n.includes("TRENCH") ? "OPEN_TRENCH" : n.includes("FIBER") ? "FIBER_PLACEMENT" : n.includes("SPLICE") ? "SPLICING" : n.includes("TEST") ? "TESTING" : n.includes("CONDUIT") || n.includes("DUCT") ? "CONDUIT_PLACEMENT" : "ENGINEERING_PLACEMENT";
}
function te(e) {
  const n = `${e.packageId}:DOIE:${e.objectGroup}:${J(e.objectType)}:${String(e.objectSequence).padStart(5, "0")}`, t = e.evidenceRequirements.length ? e.evidenceRequirements : e.lifecycle.requiredEvidence.map((E, R) => ({
    evidenceRequirementId: `${n}:EVIDENCE:${String(R + 1).padStart(3, "0")}`,
    evidenceType: J(E).toUpperCase(),
    label: E,
    requiredFor: [n, e.objectType],
    requiredAtState: "EVIDENCE_CAPTURED",
    acceptanceCriteria: e.lifecycle.acceptanceCriteria,
    responsibleRole: e.lifecycle.responsibleRole,
    blocksRelease: !1,
    blocksClose: !0
  })), i = Fe({
    scopeVersionCandidateId: e.scopeVersionCandidateId,
    routeId: e.routeId,
    objectType: e.objectType,
    objectSequence: e.objectSequence,
    parentObjectId: e.parentObjectId,
    geometryHash: e.geometryHash,
    jurisdiction: e.jurisdiction,
    target: e.target
  }), r = je(e.packageId, n, e.objectSequence, e.lifecycle), s = Me(i, e.target), c = e.lifecycle, u = String(
    c.serviceId ?? c.assetId ?? c.engineeringObjectType ?? e.objectType
  ), d = e.lifecycle.prerequisiteDependencies.map((E) => `${n}:DEP:${J(E)}`), l = t.filter((E) => E.evidenceType.includes("INSPECTION") || E.label.toLowerCase().includes("inspection"));
  return {
    objectId: n,
    objectType: e.objectType,
    doctrineObjectType: e.objectType,
    objectGroup: e.objectGroup,
    productId: e.productDoctrine.productId,
    doctrineId: e.productDoctrine.doctrineId,
    revision: e.productDoctrine.doctrineVersion,
    parentObjectId: e.parentObjectId,
    childObjectIds: [],
    stationStart: i.stationStart,
    stationEnd: i.stationEnd,
    stationAddress: i.addressKind === "POINT" ? i.stationStart : i.stationRange,
    stationSequence: e.objectSequence,
    geographicCoordinate: e.target.pointStation?.coordinate ?? e.target.stationStart.coordinate,
    parentSpanId: e.target.segmentId,
    parentRouteId: e.routeId,
    parentSegmentId: e.target.segmentId,
    doctrineQuantitySource: u,
    geometry: s,
    hierarchy: {
      hierarchyPath: e.parentObjectId === "ROOT" ? [n] : [e.parentObjectId, n],
      parentObjectId: e.parentObjectId,
      childObjectIds: [],
      level: e.parentObjectId === "ROOT" ? 0 : 1
    },
    requiredServices: e.requiredServices,
    requiredAssets: e.requiredAssets,
    constructionMethod: He(e.objectType),
    placementStrategy: e.target.pointStation ? "POINT_STATION_ADDRESS" : "LINEAR_STATION_RANGE",
    executionSequence: e.executionSequence,
    executionSequenceId: e.executionSequence?.sequenceId ?? `${n}:EXECUTION-SEQUENCE`,
    closeSequence: e.closeSequence,
    closeSequenceId: e.closeSequence?.closeSequenceId ?? `${n}:CLOSE-SEQUENCE`,
    paymentSequence: r,
    paymentSequenceId: r.paymentSequenceId,
    evidenceRequirements: t,
    inspectionRequirements: l,
    acceptanceCriteria: e.lifecycle.acceptanceCriteria,
    dependencyIds: d,
    dependencyList: d,
    address: i,
    visibilityProfile: {
      engineering: "VISIBLE",
      marketplace: "PROJECTED_AFTER_SCOPEVERSION",
      control: "PROJECTED_AFTER_SCOPEVERSION",
      field: "PROJECTED_AFTER_SCOPEVERSION",
      twin: "PROJECTED_AFTER_ACCEPTED_CLOSURE"
    },
    currentState: "PLANNED",
    currentLifecycleState: "PLANNED",
    authority: _,
    engineeringAuthority: _,
    noScopeVersionCreation: !0
  };
}
function V(e) {
  const n = Number(e);
  return Number.isFinite(n) ? Math.max(0, Math.ceil(n)) : 0;
}
function x(e, ...n) {
  const t = n.map((i) => i.toUpperCase());
  return e.structureAssembly.structures.filter((i) => {
    const r = String(i.metadata.structureType ?? i.label ?? i.objectId).toUpperCase();
    return t.some((s) => r.includes(s));
  }).reduce((i, r) => i + V(r.quantity), 0);
}
function Be(e, n) {
  const t = Math.max(1, Math.ceil(n.quantitySummary.routeMiles / 5)), i = Math.max(1, Math.ceil(n.quantitySummary.routeMiles / 5));
  return {
    quantityPlacementId: `${e}:DOIE:QUANTITY-PLACEMENT`,
    quantitySource: "PRODUCT_DOCTRINE_ASSEMBLY",
    placementAssumptionSource: "PRODUCT_DOCTRINE_ASSEMBLY_PLACEMENT_ASSUMPTIONS",
    handholeCount: x(n, "HANDHOLE"),
    vaultCount: x(n, "VAULT"),
    spliceCaseCount: x(n, "SPLICE"),
    ilaRegenCount: x(n, "ILA") + x(n, "REGEN"),
    markerCount: t,
    slackLoopCount: i,
    conduitFeet: V(n.quantitySummary.conduitFeet),
    fiberFeet: V(n.quantitySummary.fiberFeet),
    stationCount: V(n.quantitySummary.stationCount),
    routeFeet: V(n.quantitySummary.routeFeet),
    noNewQuantityLogic: !0,
    authority: _,
    noScopeVersionCreation: !0
  };
}
function $e(e, n, t, i) {
  const r = e.assetType.toUpperCase();
  return r.includes("HANDHOLE") ? t.handholeCount : r.includes("VAULT") ? t.vaultCount : r.includes("SPLICE") ? t.spliceCaseCount : r.includes("ILA") || r.includes("REGEN") ? Math.max(1, t.ilaRegenCount) : r.includes("MARKER") ? t.markerCount : r.includes("SLACK") ? t.slackLoopCount : r.includes("CONDUIT") || r.includes("FIBER") || r.includes("WIRE") || r.includes("TAPE") ? Math.max(1, i) : r.includes("LIU") || r.includes("TERMINATION") ? 2 : 1;
}
function Te(e, n, t, i, r) {
  switch (e.engineeringObjectType) {
    case "STATION":
      return t.length;
    case "ROUTE_SEGMENT":
    case "CONDUIT_SEGMENT":
    case "FIBER_SEGMENT":
      return i.length;
    case "STRUCTURE":
      return V(r.quantitySummary.structureCount);
    case "CROSSING":
      return V(r.quantitySummary.crossingCount);
    case "SPLICE_CASE":
      return n.spliceCaseCount;
    case "ILA_REGENERATION_SITE":
      return n.ilaRegenCount;
    case "TERMINATION_POINT":
      return 2;
    case "EVIDENCE_OBJECT":
      return 1;
    default:
      return 1;
  }
}
function ne(e, n, t, i, r) {
  const s = e.toUpperCase(), c = r[Math.min(r.length - 1, Math.max(0, n % Math.max(1, r.length)))] ?? r[0], u = ve(i, n, t);
  return s.includes("STATION") || s.includes("HANDHOLE") || s.includes("VAULT") || s.includes("SPLICE") || s.includes("ILA") || s.includes("REGEN") || s.includes("TERMINATION") || s.includes("MARKER") || s.includes("EVIDENCE") || s.includes("LIU") ? {
    segmentId: c.segmentId,
    stationStart: u,
    stationEnd: u,
    pointStation: u,
    addressKind: s.includes("EVIDENCE") ? "EVIDENCE" : "POINT"
  } : s.includes("SERVICE") ? { ...c, addressKind: "SERVICE" } : c;
}
function ke(e) {
  const n = new Map(e.map((t) => [t.objectId, t]));
  return e.forEach((t) => {
    const i = n.get(t.parentObjectId);
    i && (i.childObjectIds.push(t.objectId), i.hierarchy.childObjectIds.push(t.objectId));
  }), e;
}
function xe(e, n) {
  const t = n.map((u) => ({
    nodeId: `${u.objectId}:NODE`,
    objectId: u.objectId,
    objectType: u.objectType,
    objectGroup: u.objectGroup,
    addressLabel: u.address.addressLabel
  })), i = n.slice(0, -1).map((u, d) => ({
    edgeId: `${e}:DOIE:EDGE:SEQUENCE:${String(d + 1).padStart(5, "0")}`,
    fromObjectId: u.objectId,
    toObjectId: n[d + 1].objectId,
    dependencyType: "SEQUENCE",
    reason: "Deterministic Product Doctrine execution sequence."
  })), r = n.filter((u) => u.parentObjectId !== "ROOT").map((u, d) => ({
    edgeId: `${e}:DOIE:EDGE:HIERARCHY:${String(d + 1).padStart(5, "0")}`,
    fromObjectId: u.parentObjectId,
    toObjectId: u.objectId,
    dependencyType: "HIERARCHY",
    reason: "Child object inherits constitutional parent."
  })), s = n.filter((u) => u.dependencyIds.length).map((u, d) => ({
    edgeId: `${e}:DOIE:EDGE:PREREQUISITE:${String(d + 1).padStart(5, "0")}`,
    fromObjectId: u.objectId,
    toObjectId: u.objectId,
    dependencyType: "PREREQUISITE",
    reason: u.dependencyIds[0]
  })), c = [...i, ...r, ...s];
  return {
    graphId: `${e}:DOIE:DEPENDENCY-GRAPH`,
    nodeCount: t.length,
    edgeCount: c.length,
    nodes: t,
    edges: c,
    authority: _,
    noScopeVersionCreation: !0
  };
}
function we(e, n, t) {
  const i = t.requiredServices.map((c) => c.serviceId), r = t.requiredAssets.map((c) => c.assetId), s = t.evidenceRequirements.map((c) => c.evidenceRequirementId);
  return n.map((c) => ({
    stationLifecycleRuleId: `${e}:DOIE:STATION-LIFECYCLE:${J(c.stationId)}`,
    stationId: c.stationId,
    stationLabel: c.stationLabel,
    requiredServiceIds: i,
    requiredAssetIds: r,
    prerequisiteDependencies: [
      "permit approved",
      "traffic control released",
      "materials delivered",
      "utility locate complete",
      "engineering exceptions resolved"
    ],
    releaseStatus: "BLOCKED_UNTIL_DEPENDENCIES_RELEASED",
    blockedReason: "Station release depends on permit, traffic control, material, locate, and exception gates.",
    evidenceRequired: s,
    closeEligibility: "ELIGIBLE_AFTER_CLOSE_SEQUENCE_ACCEPTED",
    paymentEligibility: "ELIGIBLE_AFTER_ACCEPTANCE_AND_BILLABLE_TRIGGER",
    twinStateTransition: "PLANNED_RELEASED_INSTALLED_INSPECTED_VALIDATED_ACCEPTED_OPERATIONAL",
    authority: _,
    noScopeVersionCreation: !0
  }));
}
function Je(e) {
  return [
    {
      objectType: "HANDHOLE",
      prefix: "HH",
      count: e.handholeCount,
      placementReason: "Handhole count from Product Doctrine structure quantity.",
      doctrineQuantitySource: "productDoctrineAssembly.structureAssembly.structures[HANDHOLE].quantity"
    },
    {
      objectType: "VAULT",
      prefix: "VAULT",
      count: e.vaultCount,
      placementReason: "Vault count from Product Doctrine structure quantity.",
      doctrineQuantitySource: "productDoctrineAssembly.structureAssembly.structures[VAULT].quantity"
    },
    {
      objectType: "SPLICE_CASE",
      prefix: "SPLICE",
      count: e.spliceCaseCount,
      placementReason: "Splice case count from Product Doctrine structure quantity.",
      doctrineQuantitySource: "productDoctrineAssembly.structureAssembly.structures[SPLICE_CASE].quantity"
    },
    {
      objectType: "ILA_REGENERATION_SITE",
      prefix: "ILA",
      count: e.ilaRegenCount,
      placementReason: "ILA/regeneration count from Product Doctrine structure quantity.",
      doctrineQuantitySource: "productDoctrineAssembly.structureAssembly.structures[ILA|REGENERATION].quantity"
    },
    {
      objectType: "MARKER_POST",
      prefix: "MARKER",
      count: e.markerCount,
      placementReason: "Marker count from Product Doctrine route placement assumption.",
      doctrineQuantitySource: "productDoctrineAssembly.quantitySummary.routeMiles marker placement assumption"
    },
    {
      objectType: "SLACK_LOOP",
      prefix: "SLACK",
      count: e.slackLoopCount,
      placementReason: "Slack loop count from Product Doctrine route placement assumption.",
      doctrineQuantitySource: "productDoctrineAssembly.quantitySummary.routeMiles slack placement assumption"
    }
  ];
}
function Ye(e) {
  return Je(e.quantityPlacement).flatMap((t) => Array.from({ length: t.count }, (i, r) => {
    const s = ne(t.objectType, r, t.count, e.stations, e.targets), c = s.pointStation ?? s.stationStart;
    return {
      objectId: `${t.prefix}-${String(r + 1).padStart(3, "0")}`,
      objectType: t.objectType,
      stationAddress: c.stationLabel,
      stationSequence: 0,
      stationFeet: c.measureFeet,
      parentRouteId: e.routeId,
      parentSegmentId: s.segmentId,
      placementReason: t.placementReason,
      placementAuthority: _,
      doctrineQuantitySource: t.doctrineQuantitySource,
      originalDoctrineStation: c.stationLabel,
      currentEngineeringStation: c.stationLabel,
      movementCreatesEngineeringChangeSet: !0,
      noScopeVersionCreation: !0
    };
  })).sort((t, i) => t.stationFeet - i.stationFeet || t.objectId.localeCompare(i.objectId)).map((t, i) => ({ ...t, stationSequence: i + 1 }));
}
function We(e) {
  return e.map((n, t) => ({
    ...n,
    sequenceId: `${n.parentRouteId}:DOIE:ACTION-SEQUENCE:${String(t + 1).padStart(5, "0")}`,
    previousObjectId: e[t - 1]?.objectId,
    nextObjectId: e[t + 1]?.objectId
  }));
}
function Ce(e) {
  const n = e.toUpperCase();
  return n.includes("HANDHOLE") ? "HH" : n.includes("VAULT") ? "VAULT" : n.includes("SPLICE") ? "SPLICE" : n.includes("ILA") || n.includes("REGEN") ? "ILA" : n.includes("MARKER") ? "MARKER" : n.includes("SLACK") ? "SLACK" : "STRUCTURE";
}
function Ke(e, n) {
  return n.slice(0, -1).map((t, i) => {
    const r = n[i + 1], s = Math.min(t.stationFeet, r.stationFeet), c = Math.max(t.stationFeet, r.stationFeet);
    return {
      spanId: `${e}:DOIE:SPAN:${String(i + 1).padStart(5, "0")}`,
      spanType: `${Ce(t.objectType)}_TO_${Ce(r.objectType)}`,
      fromObjectId: t.objectId,
      toObjectId: r.objectId,
      stationStart: s === t.stationFeet ? t.stationAddress : r.stationAddress,
      stationEnd: c === r.stationFeet ? r.stationAddress : t.stationAddress,
      stationStartFeet: s,
      stationEndFeet: c,
      parentRouteId: t.parentRouteId,
      parentSegmentId: t.parentSegmentId === r.parentSegmentId ? t.parentSegmentId : `${t.parentSegmentId}->${r.parentSegmentId}`,
      routeFeet: Math.max(0, c - s),
      spanAuthority: _,
      closureBoundary: "VIEW_ONLY_NOT_CLOSURE_LIMIT",
      preservesContinuousStationClosure: !0,
      noScopeVersionCreation: !0
    };
  });
}
const Ae = [
  ["CONDUIT", "productDoctrineAssembly.quantitySummary.conduitFeet"],
  ["FIBER", "productDoctrineAssembly.quantitySummary.fiberFeet"],
  ["TRACE_WIRE", "Product Doctrine locate wire asset attached to every station span"],
  ["WARNING_TAPE", "Product Doctrine warning tape asset attached to every station span"],
  ["MULE_TAPE_PULL_TAPE", "Product Doctrine conduit placement assumption attaches pull tape to every station span"]
];
function Qe(e) {
  return e.flatMap((n) => Ae.map(([t, i]) => ({
    attachmentId: `${n.spanId}:ASSET:${t}`,
    spanId: n.spanId,
    assetType: t,
    fromObjectId: n.fromObjectId,
    toObjectId: n.toObjectId,
    stationStart: n.stationStart,
    stationEnd: n.stationEnd,
    routeFeet: n.routeFeet,
    doctrineQuantitySource: i,
    placementAuthority: _,
    noScopeVersionCreation: !0
  })));
}
function ze(e) {
  return {
    policyId: `${e}:DOIE:ENGINEERING-MOVEMENT-POLICY`,
    movementCreatesEngineeringChangeSet: !0,
    requiredPatchType: "MOVE_OBJECT",
    requiredFields: ["originalDoctrineStation", "newEngineeringStation", "delta", "rationale"],
    authority: _,
    noScopeVersionCreation: !0
  };
}
function Ze(e) {
  return /* @__PURE__ */ new Map([
    ["HANDHOLE", e.handholeCount],
    ["VAULT", e.vaultCount],
    ["SPLICE_CASE", e.spliceCaseCount],
    ["ILA_REGENERATION_SITE", e.ilaRegenCount],
    ["MARKER_POST", e.markerCount],
    ["SLACK_LOOP", e.slackLoopCount]
  ]);
}
function Xe(e) {
  const n = /* @__PURE__ */ new Set(), t = /* @__PURE__ */ new Set();
  return e.forEach((i) => {
    n.has(i) && t.add(i), n.add(i);
  }), t.size;
}
function et(e, n, t, i, r, s, c, u, d) {
  const l = new Set(t.map((o) => o.objectType)), E = new Set(t.filter((o) => o.objectGroup === "REQUIRED_SERVICE").map((o) => o.requiredServices[0])), R = new Set(t.filter((o) => o.objectGroup === "REQUIRED_ASSET").map((o) => o.requiredAssets[0])), O = Ze(i), D = r.reduce((o, I) => (o.set(I.objectType, (o.get(I.objectType) ?? 0) + 1), o), /* @__PURE__ */ new Map()), C = [...O.entries()].filter(([, o]) => o > 0).filter(([o, I]) => (D.get(o) ?? 0) !== I).map(([o, I]) => `Doctrine station object count mismatch for ${o}: expected ${I}, placed ${D.get(o) ?? 0}.`), A = r.filter((o) => !o.stationAddress || !o.stationSequence).map((o) => `Station object ${o.objectId} is missing station address or sequence.`), m = r.filter((o, I) => o.stationSequence !== I + 1).map((o, I) => `Station object ${o.objectId} has sequence ${o.stationSequence}; expected ${I + 1}.`), S = Xe(r.map((o) => o.objectId)) ? ["Station object index contains duplicate object IDs."] : [], v = [
    ...s.length > 1 && !c.length ? ["Sequenced action objects exist but span derivation produced no spans."] : [],
    ...c.filter((o) => o.stationEndFeet < o.stationStartFeet).map((o) => `Derived span ${o.spanId} has invalid station order.`)
  ], L = /* @__PURE__ */ new Map();
  u.forEach((o) => {
    const I = L.get(o.spanId) ?? /* @__PURE__ */ new Set();
    I.add(o.assetType), L.set(o.spanId, I);
  });
  const f = c.flatMap((o) => {
    const I = L.get(o.spanId) ?? /* @__PURE__ */ new Set();
    return Ae.filter(([q]) => !I.has(q)).map(([q]) => `Derived span ${o.spanId} is missing ${q} attachment.`);
  }), b = [
    ...t.filter((o) => !o.address.addressLabel || !o.address.stationRange).map((o) => `Object ${o.objectId} is missing deterministic address.`),
    ...t.filter((o) => !o.paymentSequence.paymentSequenceId).map((o) => `Object ${o.objectId} is missing payment sequence.`),
    ...t.filter((o) => !o.closeSequence?.closeSequenceId).map((o) => `Object ${o.objectId} is missing close sequence.`),
    ...t.filter((o) => !o.evidenceRequirements.length && o.objectGroup !== "EVIDENCE_OBJECT").map((o) => `Object ${o.objectId} is missing evidence requirements.`),
    ...n.requiredServices.filter((o) => !E.has(o.serviceId)).map((o) => `Required service ${o.serviceId} was not instantiated.`),
    ...n.requiredAssets.filter((o) => !R.has(o.assetId)).map((o) => `Required asset ${o.assetId} was not instantiated.`),
    ...d.filter((o) => !l.has(o)).map((o) => `Engineering object type ${o} was not instantiated.`),
    ...C,
    ...A,
    ...m,
    ...S,
    ...v,
    ...f
  ];
  return {
    validationId: `${e}:DOIE:VALIDATION`,
    status: b.length ? "FAIL" : "PASS",
    checkedObjectCount: t.length,
    missingAddressCount: t.filter((o) => !o.address.addressLabel || !o.address.stationRange).length,
    missingRequiredServiceCount: n.requiredServices.filter((o) => !E.has(o.serviceId)).length,
    missingRequiredAssetCount: n.requiredAssets.filter((o) => !R.has(o.assetId)).length,
    missingEngineeringObjectTypeCount: d.filter((o) => !l.has(o)).length,
    missingPaymentSequenceCount: t.filter((o) => !o.paymentSequence.paymentSequenceId).length,
    missingCloseSequenceCount: t.filter((o) => !o.closeSequence?.closeSequenceId).length,
    missingEvidenceRequirementCount: t.filter((o) => !o.evidenceRequirements.length && o.objectGroup !== "EVIDENCE_OBJECT").length,
    quantityMismatchCount: C.length,
    missingStationAddressCount: A.length,
    sequenceGapCount: m.length,
    duplicateObjectIdCount: S.length,
    spanDerivationFailureCount: v.length,
    unattachedLinearAssetCount: f.length,
    failures: b,
    authority: _,
    noScopeVersionCreation: !0
  };
}
function tt(e) {
  const { packageId: n, productDoctrine: t, productDoctrineAssembly: i } = e, r = e.routeId ?? i.osrmRoute?.routeId ?? i.centerlineId, s = e.scopeVersionCandidateId ?? `${n}:SCOPEVERSION-CANDIDATE`, c = e.geometryHash ?? i.centerlineId, u = e.jurisdiction ?? "UNRESOLVED_JURISDICTION", d = Ue(i), l = Ve(i, d), E = Be(n, i), R = [];
  let O = 0;
  const D = l[0], C = t.engineeringObjects.find((a) => a.engineeringObjectType === "SPINE") ?? t.engineeringObjects[0], A = Z(t.evidenceRequirements, ["ENGINEERING_OBJECT:SPINE", C?.engineeringObjectType ?? "SPINE"]), m = te({
    packageId: n,
    productDoctrine: t,
    objectGroup: "ENGINEERING_OBJECT",
    objectType: "SPINE",
    objectSequence: ++O,
    parentObjectId: "ROOT",
    target: D,
    scopeVersionCandidateId: s,
    routeId: r,
    geometryHash: c,
    jurisdiction: u,
    requiredServices: C?.requiredServiceIds ?? [],
    requiredAssets: C?.requiredAssetIds ?? [],
    lifecycle: C,
    executionSequence: ee(t.executionSequences, "ENGINEERING_OBJECT", "SPINE"),
    closeSequence: X(t.closeSequences, "ENGINEERING_OBJECT", "SPINE"),
    evidenceRequirements: A
  });
  R.push(m), t.engineeringObjects.filter((a) => a.engineeringObjectType !== "SPINE").forEach((a) => {
    const j = Te(a, E, d, l, i);
    Array.from({ length: j }, (k, z) => {
      const ae = ne(a.engineeringObjectType, z, j, d, l), ue = [`ENGINEERING_OBJECT:${a.engineeringObjectType}`, a.engineeringObjectType, ...a.requiredServiceIds, ...a.requiredAssetIds];
      R.push(te({
        packageId: n,
        productDoctrine: t,
        objectGroup: a.engineeringObjectType === "EVIDENCE_OBJECT" ? "EVIDENCE_OBJECT" : "ENGINEERING_OBJECT",
        objectType: a.engineeringObjectType,
        objectSequence: ++O,
        parentObjectId: m.objectId,
        target: ae,
        scopeVersionCandidateId: s,
        routeId: r,
        geometryHash: c,
        jurisdiction: u,
        requiredServices: a.requiredServiceIds,
        requiredAssets: a.requiredAssetIds,
        lifecycle: a,
        executionSequence: ee(t.executionSequences, "ENGINEERING_OBJECT", a.engineeringObjectType),
        closeSequence: X(t.closeSequences, "ENGINEERING_OBJECT", a.engineeringObjectType),
        evidenceRequirements: Z(t.evidenceRequirements, ue)
      }));
    });
  }), t.requiredServices.forEach((a, j) => {
    const k = ne(`${a.serviceType}_SERVICE`, j, t.requiredServices.length, d, l), z = [a.serviceId, `SERVICE:${a.serviceName.toUpperCase().replaceAll(" ", "-")}`];
    R.push(te({
      packageId: n,
      productDoctrine: t,
      objectGroup: "REQUIRED_SERVICE",
      objectType: a.serviceType,
      objectSequence: ++O,
      parentObjectId: m.objectId,
      target: { ...k, addressKind: "SERVICE" },
      scopeVersionCandidateId: s,
      routeId: r,
      geometryHash: c,
      jurisdiction: u,
      requiredServices: [a.serviceId],
      requiredAssets: [],
      lifecycle: a,
      executionSequence: ee(t.executionSequences, "SERVICE", a.serviceId),
      closeSequence: X(t.closeSequences, "SERVICE", a.serviceId),
      evidenceRequirements: Z(t.evidenceRequirements, z)
    }));
  }), t.requiredAssets.forEach((a, j) => {
    const k = $e(a, i, E, l.length);
    Array.from({ length: k }, (z, ae) => {
      const ue = ne(a.assetType, ae + j, k, d, l), fe = [a.assetId, `ASSET:${a.assetType}`, a.assetType];
      R.push(te({
        packageId: n,
        productDoctrine: t,
        objectGroup: "REQUIRED_ASSET",
        objectType: a.assetType,
        objectSequence: ++O,
        parentObjectId: m.objectId,
        target: ue,
        scopeVersionCandidateId: s,
        routeId: r,
        geometryHash: c,
        jurisdiction: u,
        requiredServices: [],
        requiredAssets: [a.assetId],
        lifecycle: a,
        executionSequence: ee(t.executionSequences, "ASSET", a.assetId),
        closeSequence: X(t.closeSequences, "ASSET", a.assetId),
        evidenceRequirements: Z(t.evidenceRequirements, fe)
      }));
    });
  });
  const S = ke(R), v = xe(n, S), L = S.map((a) => a.paymentSequence), f = we(n, d, t), b = Ye({
    routeId: r,
    quantityPlacement: E,
    stations: d,
    targets: l
  }), o = We(b), I = Ke(n, o), q = Qe(I), p = ze(n), Le = t.engineeringObjects.filter((a) => a.engineeringObjectType === "SPINE" || Te(a, E, d, l, i) > 0).map((a) => a.engineeringObjectType), se = et(
    n,
    t,
    S,
    E,
    b,
    o,
    I,
    q,
    Le
  );
  return {
    engineeringObjectManifest: {
      manifestId: `${n}:DOCTRINE-ENGINEERING-OBJECT-MANIFEST`,
      manifestVersion: he,
      packageId: n,
      productId: t.productId,
      doctrineId: t.doctrineId,
      doctrineVersion: t.doctrineVersion,
      scopeVersionCandidateId: s,
      objectCount: S.length,
      requiredServiceCount: t.requiredServices.length,
      requiredAssetCount: t.requiredAssets.length,
      engineeringObjectTypeCount: t.engineeringObjects.length,
      instantiatedObjects: S,
      dependencyGraph: v,
      executionSequence: t.executionSequences,
      closeSequence: t.closeSequences,
      paymentSequence: L,
      evidenceRequirements: t.evidenceRequirements,
      stationLifecycleRules: f,
      scopeVersionReadinessRequirements: t.scopeVersionReadinessRequirements,
      quantityPlacement: E,
      stationObjectIndex: b,
      sequencedActionObjects: o,
      derivedSpans: I,
      linearAssetSpanAttachments: q,
      engineeringMovementPolicy: p,
      continuousStationClosure: !0,
      marketplaceProjection: {
        requiredAssetIds: t.requiredAssets.map((a) => a.assetId),
        requiredServiceIds: t.requiredServices.map((a) => a.serviceId),
        vendorQualifications: ["qualified OSP contractor", "fiber splicing vendor", "traffic control provider", "survey provider"],
        deliveryDatePolicy: "Delivery dates are projected after ScopeVersion work packaging.",
        procurementStatus: "PENDING_SCOPEVERSION"
      },
      controlProjection: {
        executionSequenceIds: t.executionSequences.map((a) => a.sequenceId),
        dependencyGraphId: v.graphId,
        releaseGatePolicy: "CONTROL_RELEASES_AFTER_SCOPEVERSION",
        workReleaseStatus: "BLOCKED_UNTIL_SCOPEVERSION"
      },
      fieldProjection: {
        addressedObjectIds: S.map((a) => a.objectId),
        evidenceRequirementIds: t.evidenceRequirements.map((a) => a.evidenceRequirementId),
        closurePolicy: "FIELD_CLOSES_AGAINST_ADDRESSED_OBJECTS"
      },
      twinProjection: {
        stateSequence: ["Planned", "Released", "Installed", "Inspected", "Validated", "Accepted", "Operational"],
        stateAuthority: "ACCEPTED_CLOSURES_AND_EVIDENCE"
      },
      validation: se,
      currentState: "PLANNED",
      authority: _,
      noScopeVersionCreation: !0
    },
    instantiatedObjects: S,
    dependencyGraph: v,
    executionSequence: t.executionSequences,
    closeSequence: t.closeSequences,
    paymentSequence: L,
    evidenceRequirements: t.evidenceRequirements,
    stationLifecycleRules: f,
    quantityPlacement: E,
    stationObjectIndex: b,
    sequencedActionObjects: o,
    derivedSpans: I,
    linearAssetSpanAttachments: q,
    engineeringMovementPolicy: p,
    validation: se,
    summary: {
      summaryId: `${n}:DOIE:SUMMARY`,
      packageId: n,
      objectCount: S.length,
      addressCount: S.filter((a) => a.address.addressLabel).length,
      paymentSequenceCount: L.length,
      closeSequenceCount: t.closeSequences.length,
      stationLifecycleRuleCount: f.length,
      stationObjectIndexCount: b.length,
      derivedSpanCount: I.length,
      linearAssetAttachmentCount: q.length,
      status: se.status,
      authority: _,
      noScopeVersionCreation: !0
    },
    noScopeVersionCreation: !0
  };
}
const g = "POINT_TO_POINT_LONG_HAUL_CONDUIT_FIBER", G = "DOCTRINE-L1-POINT-TO-POINT-LONG-HAUL-CONDUIT-FIBER", ge = "19B.1.0", W = "20C.1.0", De = "81c488a6d4bd35183e35eabf1a1c533e53a7c700d38db5d5bf67e8c2b3883bdd", be = "Separate Product Doctrine requirements from Project Configuration, source evidence, estimating assumptions, Commercial Policy, and Engineering authority; remove mileage-generated infrastructure.", nt = "Point-to-Point Duct & Dark Fiber", it = "Point-to-Point Long-Haul Conduit & Fiber", rt = [
  "DEFINED",
  "SCHEDULED",
  "PREREQUISITES_RELEASED",
  "MOBILIZED",
  "WORK_COMPLETED",
  "EVIDENCE_CAPTURED",
  "ENGINEERING_ACCEPTED",
  "BILLABLE",
  "PAYMENT_ELIGIBLE",
  "CLOSED"
], ot = [
  "DEFINED",
  "PROCURED",
  "RECEIVED",
  "ALLOCATED",
  "INSTALLED",
  "GPS_VERIFIED",
  "EVIDENCE_CAPTURED",
  "ENGINEERING_ACCEPTED",
  "CERTIFIED",
  "OPERATIONAL"
];
function ct(e = {}) {
  return {
    lifecycleStates: rt,
    prerequisiteDependencies: ["commercial release package", "draft IOF package", "station projection"],
    releaseGates: ["engineering station release", "permit release when applicable", "materials release when applicable"],
    blockedReasons: ["missing prerequisite", "unresolved engineering exception", "missing evidence"],
    requiredEvidence: ["work completion evidence", "station evidence", "engineering acceptance"],
    acceptanceCriteria: ["scope completed at required station or range", "required evidence accepted", "engineering review accepted"],
    responsibleRole: "CONSTRUCTION",
    billableTrigger: "Engineering acceptance recorded for completed service.",
    paymentTrigger: "Close sequence accepted and billing eligibility released.",
    capitalCashFlowTrigger: "Service cost accrues when work is completed and accepted.",
    twinStateTransition: "SERVICE_CLOSED_PROJECTS_TO_TWIN_ACTIVITY",
    ...e
  };
}
function st(e = {}) {
  return {
    lifecycleStates: ot,
    prerequisiteDependencies: ["commercial release package", "draft IOF package", "station projection"],
    releaseGates: ["engineering asset release", "material availability", "station/object release"],
    blockedReasons: ["material not received", "station not released", "missing evidence"],
    requiredEvidence: ["material receipt", "installation evidence", "GPS/photo evidence", "engineering acceptance"],
    acceptanceCriteria: ["asset installed or allocated as defined", "asset evidence accepted", "engineering acceptance recorded"],
    responsibleRole: "CONSTRUCTION",
    billableTrigger: "Asset installed and accepted by Engineering.",
    paymentTrigger: "Asset close sequence accepted.",
    capitalCashFlowTrigger: "Capitalized asset value starts when installed and accepted.",
    twinStateTransition: "ASSET_OPERATIONAL_PROJECTS_TO_TWIN_STATE",
    ...e
  };
}
function at(e = {}) {
  return {
    lifecycleStates: ["DEFINED", "STATIONED", "DEPENDENCIES_RELEASED", "PLACED", "EVIDENCE_CAPTURED", "ENGINEERING_ACCEPTED", "CERTIFIED"],
    prerequisiteDependencies: ["engineering baseline", "station projection", "dependency graph"],
    releaseGates: ["station release", "object dependency release", "engineering review"],
    blockedReasons: ["missing station", "dependency unresolved", "evidence missing"],
    requiredEvidence: ["object placement evidence", "dependency evidence", "engineering acceptance"],
    acceptanceCriteria: ["object has station or station range", "dependencies resolved", "evidence accepted"],
    responsibleRole: "ENGINEERING",
    billableTrigger: "Object accepted into certified engineering definition.",
    paymentTrigger: "Object close sequence or related service/asset close is accepted.",
    capitalCashFlowTrigger: "Object contributes to capital plan after certification.",
    twinStateTransition: "CERTIFIED_OBJECT_PROJECTS_TO_TWIN",
    ...e
  };
}
function N(e, n, t, i = {}) {
  return {
    serviceId: e,
    serviceName: n,
    serviceType: t,
    serviceVsAssetRule: "SERVICE_NOT_ASSET",
    consumes: ["LABOR", "EQUIPMENT", "SUBCONTRACTOR", "PROFESSIONAL_EFFORT"],
    stationLevelProjection: !0,
    ...ct(i)
  };
}
function h(e, n, t, i = {}) {
  return {
    assetId: e,
    assetName: n,
    assetType: t,
    tangibleInfrastructure: !0,
    representedInTwin: !0,
    ...st(i)
  };
}
function y(e, n, t, i, r = !0, s = {}) {
  return {
    engineeringObjectType: e,
    label: n,
    stationLevelProjection: r,
    requiredServiceIds: t,
    requiredAssetIds: i,
    ...at(s)
  };
}
function ie(e, n, t) {
  return {
    sequenceId: `${G}:EXECUTION:${e}:${n}`,
    appliesTo: e,
    appliesToId: n,
    lifecycleStates: t.lifecycleStates,
    prerequisiteDependencies: t.prerequisiteDependencies,
    releaseGates: t.releaseGates,
    blockedReasons: t.blockedReasons,
    requiredEvidence: t.requiredEvidence,
    acceptanceCriteria: t.acceptanceCriteria,
    responsibleRole: t.responsibleRole,
    billableTrigger: t.billableTrigger,
    paymentTrigger: t.paymentTrigger,
    capitalCashFlowTrigger: t.capitalCashFlowTrigger,
    twinStateTransition: t.twinStateTransition
  };
}
function de(e, n, t) {
  return {
    ...ie(e, n, t),
    closeSequenceId: `${G}:CLOSE:${e}:${n}`,
    closeStates: t.lifecycleStates.slice(Math.max(0, t.lifecycleStates.length - 5)),
    closeEligibility: t.acceptanceCriteria,
    paymentEligibility: [t.billableTrigger, t.paymentTrigger]
  };
}
const _e = {
  alias: "PD-001",
  canonicalDoctrineId: G,
  productId: g,
  businessProductName: nt,
  technicalDoctrineName: it,
  doctrineVersion: W,
  active: !0
}, H = [
  N("SERVICE:ENGINEERING", "engineering", "PROFESSIONAL_ENGINEERING", {
    responsibleRole: "ENGINEERING",
    lifecycleStates: ["DEFINED", "ASSIGNED", "REVIEWING", "STATIONED", "OBJECTS_DEFINED", "DEPENDENCIES_VALIDATED", "CERTIFICATION_READY", "CLOSED"],
    prerequisiteDependencies: ["customer accepted proposal", "commercial release package", "draft IOF package"],
    releaseGates: ["draft IOF package complete", "engineering baseline created"],
    requiredEvidence: ["engineering review notes", "quantity confirmation", "exception rationale when required"],
    acceptanceCriteria: ["product doctrine compliance confirmed", "customer technical requirements translated", "dependencies and exceptions documented"],
    billableTrigger: "Engineering review accepted for certification.",
    paymentTrigger: "Engineering review close sequence accepted.",
    twinStateTransition: "ENGINEERING_ACCEPTANCE_PROJECTS_TO_TWIN_DESIGN_STATE"
  }),
  N("SERVICE:SURVEY", "survey", "FIELD_SURVEY", {
    responsibleRole: "SURVEY",
    requiredEvidence: ["survey control", "GPS station evidence", "field notes"],
    acceptanceCriteria: ["A/Z and station evidence captured", "survey exceptions documented", "engineering acceptance recorded"]
  }),
  N("SERVICE:PERMITTING", "permitting", "PERMITTING", {
    responsibleRole: "PERMITTING",
    lifecycleStates: ["DEFINED", "JURISDICTIONS_IDENTIFIED", "SUBMITTED", "APPROVED", "RELEASED", "CLOSED"],
    releaseGates: ["jurisdiction identified", "permit approval received"],
    blockedReasons: ["permit not approved", "jurisdiction unknown", "permit condition unresolved"],
    requiredEvidence: ["permit approval", "permit conditions", "release authorization"],
    acceptanceCriteria: ["permit approved for station range", "permit conditions attached to release gates"]
  }),
  N("SERVICE:UTILITY-LOCATE", "utility locate", "UTILITY_LOCATE", {
    responsibleRole: "CONSTRUCTION",
    lifecycleStates: ["DEFINED", "TICKET_CREATED", "LOCATE_SCHEDULED", "LOCATE_COMPLETE", "VALID_WINDOW_ACTIVE", "CLOSED"],
    releaseGates: ["valid locate ticket", "locate complete"],
    blockedReasons: ["locate incomplete", "ticket expired", "utility conflict unresolved"],
    requiredEvidence: ["locate ticket", "locate completion evidence", "conflict notes"],
    acceptanceCriteria: ["valid locate window active", "conflicts documented"]
  }),
  N("SERVICE:TRAFFIC-CONTROL", "traffic control", "TRAFFIC_CONTROL", {
    responsibleRole: "CONTROL",
    lifecycleStates: ["DEFINED", "PLAN_APPROVED", "CREW_SCHEDULED", "RELEASED", "DEMOBILIZED", "CLOSED"],
    releaseGates: ["traffic control plan approved", "permit conditions satisfied"],
    blockedReasons: ["traffic control not released", "lane closure unavailable"],
    requiredEvidence: ["traffic control plan", "release record", "demobilization record"],
    acceptanceCriteria: ["traffic control released for station range", "demobilization complete"]
  }),
  N("SERVICE:DIRECTIONAL-BORE", "directional bore", "CIVIL_CONSTRUCTION", {
    lifecycleStates: [
      "DEFINED",
      "SCHEDULED",
      "MATERIALS_READY",
      "PERMITS_RELEASED",
      "LOCATE_COMPLETE",
      "TRAFFIC_CONTROL_RELEASED",
      "MOBILIZED",
      "BORE_COMPLETED",
      "CONDUIT_VERIFIED",
      "EVIDENCE_CAPTURED",
      "ENGINEERING_ACCEPTED",
      "BILLABLE",
      "CLOSED"
    ],
    prerequisiteDependencies: ["permit approval", "conduit material received", "traffic control released", "utility locate complete", "engineering exceptions resolved"],
    releaseGates: ["permit released", "locate complete", "traffic control released", "materials ready"],
    blockedReasons: ["permit is not approved", "conduit material is not received", "traffic control is not released", "locate is not complete", "engineering exception is unresolved"],
    requiredEvidence: ["bore log", "conduit proof", "photo evidence", "station GPS evidence", "engineering acceptance"],
    acceptanceCriteria: ["bore completed within approved station range", "conduit verified", "evidence captured and accepted"]
  }),
  N("SERVICE:PLOWING", "plowing", "CIVIL_CONSTRUCTION", {
    prerequisiteDependencies: ["utility locate complete", "ROW release", "conduit material received"],
    releaseGates: ["ROW released", "locate complete", "materials ready"],
    blockedReasons: ["ROW not released", "locate incomplete", "material unavailable"],
    requiredEvidence: ["plow log", "GPS evidence", "photo evidence", "engineering acceptance"]
  }),
  N("SERVICE:OPEN-TRENCH", "open trench", "CIVIL_CONSTRUCTION", {
    prerequisiteDependencies: ["utility locate complete", "permit release", "restoration plan"],
    releaseGates: ["permit released", "locate complete", "restoration plan approved"],
    blockedReasons: ["permit blocked", "locate incomplete", "restoration plan missing"],
    requiredEvidence: ["trench log", "conduit placement evidence", "restoration evidence"]
  }),
  N("SERVICE:CONDUIT-PLACEMENT", "conduit placement", "ASSET_PLACEMENT", {
    prerequisiteDependencies: ["civil path released", "conduit material received"],
    releaseGates: ["civil method released", "conduit allocated"],
    blockedReasons: ["conduit material not received", "civil path not released"],
    requiredEvidence: ["conduit proof", "installation photo", "GPS evidence"]
  }),
  N("SERVICE:HANDHOLE-VAULT-PLACEMENT", "handhole/vault placement", "STRUCTURE_PLACEMENT", {
    prerequisiteDependencies: ["structure material received", "station released", "excavation released"],
    releaseGates: ["structure allocated", "station released"],
    blockedReasons: ["structure is not installed", "GPS evidence is missing", "photo evidence is missing", "inspection is incomplete", "engineering acceptance is missing"],
    requiredEvidence: ["structure photo", "GPS evidence", "inspection record", "engineering acceptance"],
    acceptanceCriteria: ["structure installed at assigned station", "GPS/photo evidence accepted", "inspection complete", "engineering acceptance recorded"]
  }),
  N("SERVICE:FIBER-PLACEMENT", "fiber placement", "FIBER_PLACEMENT", {
    prerequisiteDependencies: ["conduit path accepted", "handholes/vaults accepted", "fiber material received", "splice plan approved"],
    releaseGates: ["conduit path accepted", "structure path accepted", "fiber allocated"],
    blockedReasons: ["conduit path is not accepted", "handholes/vaults are not accepted", "fiber material is not received", "splice plan is not approved"],
    requiredEvidence: ["pull log", "fiber reel evidence", "slack loop evidence", "engineering acceptance"]
  }),
  N("SERVICE:SPLICING", "splicing", "FIBER_SPLICING", {
    prerequisiteDependencies: ["fiber installed", "splice case installed", "splice plan approved"],
    releaseGates: ["fiber path released", "splice plan approved"],
    blockedReasons: ["fiber is not installed", "splice evidence is missing", "OTDR/testing is incomplete", "labeling is incomplete"],
    requiredEvidence: ["splice record", "splice photo", "labeling evidence", "engineering acceptance"]
  }),
  N("SERVICE:OTDR-TESTING", "OTDR testing", "FIBER_TESTING", {
    prerequisiteDependencies: ["fiber installed", "splicing complete"],
    releaseGates: ["splice complete", "test plan approved"],
    blockedReasons: ["splice incomplete", "test result missing", "loss threshold failed"],
    requiredEvidence: ["OTDR trace", "loss report", "test acceptance"],
    acceptanceCriteria: ["OTDR trace passed", "loss report within threshold", "engineering acceptance recorded"]
  }),
  N("SERVICE:RESTORATION", "restoration", "RESTORATION", {
    prerequisiteDependencies: ["civil work complete", "surface restoration required"],
    releaseGates: ["construction complete", "restoration method approved"],
    blockedReasons: ["restoration incomplete", "surface condition rejected"],
    requiredEvidence: ["restoration photo", "inspection signoff", "customer/municipal acceptance when required"]
  }),
  N("SERVICE:AS-BUILT-DOCUMENTATION", "as-built documentation", "DOCUMENTATION", {
    responsibleRole: "ENGINEERING",
    lifecycleStates: ["DEFINED", "FIELD_DATA_RECEIVED", "AS_BUILT_DRAFTED", "ENGINEERING_REVIEWED", "ACCEPTED", "CLOSED"],
    prerequisiteDependencies: ["station/object evidence captured", "field redlines received"],
    releaseGates: ["field evidence accepted", "redlines reviewed"],
    blockedReasons: ["field evidence missing", "redline unresolved"],
    requiredEvidence: ["as-built drawing", "station evidence", "object inventory reference"],
    acceptanceCriteria: ["as-built complete", "engineering acceptance recorded"]
  }),
  N("SERVICE:INSPECTION", "inspection", "INSPECTION", {
    responsibleRole: "INSPECTION",
    lifecycleStates: ["DEFINED", "SCHEDULED", "INSPECTED", "PUNCHLIST_CREATED", "PUNCHLIST_RESOLVED", "ACCEPTED", "CLOSED"],
    prerequisiteDependencies: ["service or asset ready for inspection"],
    releaseGates: ["inspection scheduled", "evidence available"],
    blockedReasons: ["inspection incomplete", "punchlist unresolved"],
    requiredEvidence: ["inspection checklist", "photo evidence", "punchlist resolution"],
    acceptanceCriteria: ["inspection accepted", "punchlist resolved"]
  })
], B = [
  h("ASSET:CONDUIT", "conduit", "CONDUIT", {
    lifecycleStates: ["DEFINED", "PROCURED", "RECEIVED", "ALLOCATED", "INSTALLED", "GPS_VERIFIED", "EVIDENCE_CAPTURED", "ENGINEERING_ACCEPTED", "CERTIFIED", "OPERATIONAL"],
    prerequisiteDependencies: ["conduit placement service", "civil path released"],
    requiredEvidence: ["material receipt", "conduit proof", "GPS evidence", "photo evidence"]
  }),
  h("ASSET:FIBER", "fiber", "FIBER", {
    lifecycleStates: ["DEFINED", "RECEIVED", "PULLED", "SLACK_INSTALLED", "SPLICED", "OTDR_PASSED", "EVIDENCE_CAPTURED", "ENGINEERING_ACCEPTED", "CERTIFIED", "OPERATIONAL"],
    prerequisiteDependencies: ["conduit path accepted", "handholes/vaults accepted", "fiber placement service", "splicing service", "OTDR testing"],
    releaseGates: ["conduit path accepted", "fiber material received", "splice plan approved"],
    blockedReasons: ["conduit path not accepted", "fiber material missing", "OTDR failed"],
    requiredEvidence: ["fiber reel evidence", "pull log", "slack loop evidence", "splice record", "OTDR trace"],
    acceptanceCriteria: ["fiber installed", "slack installed", "splice accepted", "OTDR passed"]
  }),
  h("ASSET:HANDHOLES", "handholes", "HANDHOLE", {
    prerequisiteDependencies: ["handhole/vault placement service", "station released"],
    blockedReasons: ["structure is not installed", "GPS evidence is missing", "photo evidence is missing", "inspection is incomplete", "engineering acceptance is missing"]
  }),
  h("ASSET:VAULTS", "vaults", "VAULT", {
    prerequisiteDependencies: ["handhole/vault placement service", "station released"],
    blockedReasons: ["vault not installed", "GPS evidence missing", "inspection incomplete"]
  }),
  h("ASSET:SPLICE-CASES", "splice cases", "SPLICE_CASE", {
    prerequisiteDependencies: ["fiber installed", "splice plan approved"],
    requiredEvidence: ["splice case photo", "splice record", "labeling evidence"]
  }),
  h("ASSET:MARKER-POSTS", "marker posts", "MARKER_POST", {
    prerequisiteDependencies: ["route segment released", "marker placement plan"],
    requiredEvidence: ["marker photo", "GPS evidence"]
  }),
  h("ASSET:WARNING-TAPE", "warning tape", "WARNING_TAPE", {
    prerequisiteDependencies: ["open trench or plow service", "material received"],
    requiredEvidence: ["installation photo", "station range evidence"]
  }),
  h("ASSET:LOCATE-WIRE", "locate wire", "LOCATE_WIRE", {
    prerequisiteDependencies: ["conduit placement", "material received"],
    requiredEvidence: ["continuity evidence", "installation photo"]
  }),
  h("ASSET:SLACK-LOOPS", "slack loops", "SLACK_LOOP", {
    prerequisiteDependencies: ["fiber placement", "structure placement"],
    requiredEvidence: ["slack loop photo", "fiber inventory evidence"]
  }),
  h("ASSET:ILA-REGEN-FACILITIES", "ILA/regeneration facilities where required", "ILA_REGENERATION_FACILITY", {
    requiredWhen: "Route span length or optical budget requires amplification/regeneration.",
    prerequisiteDependencies: ["engineering optical review", "site/power availability", "structure allocation"],
    releaseGates: ["engineering optical requirement confirmed", "site and power released"],
    requiredEvidence: ["facility layout", "power availability evidence", "engineering acceptance"]
  }),
  h("ASSET:LIU-TERMINATION-HARDWARE", "LIU/termination hardware where required", "LIU_TERMINATION_HARDWARE", {
    requiredWhen: "Customer handoff, POP termination, or termination point requires LIU hardware.",
    prerequisiteDependencies: ["termination point defined", "fiber assignment approved"],
    releaseGates: ["termination point released", "hardware allocated"],
    requiredEvidence: ["termination photo", "labeling evidence", "handoff acceptance"]
  })
], K = [
  y("SPINE", "spine", ["SERVICE:ENGINEERING", "SERVICE:SURVEY"], ["ASSET:CONDUIT", "ASSET:FIBER"], !0),
  y("ROUTE_SEGMENT", "route segment", ["SERVICE:ENGINEERING", "SERVICE:SURVEY", "SERVICE:PERMITTING"], ["ASSET:CONDUIT", "ASSET:FIBER"], !0),
  y("STATION", "station", ["SERVICE:SURVEY", "SERVICE:INSPECTION"], [], !0),
  y("CONDUIT_SEGMENT", "conduit segment", ["SERVICE:CONDUIT-PLACEMENT"], ["ASSET:CONDUIT", "ASSET:WARNING-TAPE", "ASSET:LOCATE-WIRE"], !0),
  y("FIBER_SEGMENT", "fiber segment", ["SERVICE:FIBER-PLACEMENT", "SERVICE:OTDR-TESTING"], ["ASSET:FIBER", "ASSET:SLACK-LOOPS"], !0),
  y("STRUCTURE", "structure", ["SERVICE:HANDHOLE-VAULT-PLACEMENT", "SERVICE:INSPECTION"], ["ASSET:HANDHOLES", "ASSET:VAULTS"], !0),
  y("CROSSING", "crossing", ["SERVICE:PERMITTING", "SERVICE:DIRECTIONAL-BORE", "SERVICE:INSPECTION"], ["ASSET:CONDUIT"], !0),
  y("SPLICE_CASE", "splice case", ["SERVICE:SPLICING", "SERVICE:OTDR-TESTING"], ["ASSET:SPLICE-CASES", "ASSET:FIBER"], !0),
  y("ILA_REGENERATION_SITE", "ILA/regeneration site", ["SERVICE:ENGINEERING", "SERVICE:INSPECTION"], ["ASSET:ILA-REGEN-FACILITIES"], !0),
  y("TERMINATION_POINT", "termination point", ["SERVICE:ENGINEERING", "SERVICE:SPLICING", "SERVICE:OTDR-TESTING"], ["ASSET:LIU-TERMINATION-HARDWARE"], !0),
  y("EVIDENCE_OBJECT", "evidence object", ["SERVICE:AS-BUILT-DOCUMENTATION", "SERVICE:INSPECTION"], [], !1)
], Ee = [
  ...H.map((e) => ie("SERVICE", e.serviceId, e)),
  ...B.map((e) => ie("ASSET", e.assetId, e)),
  ...K.map((e) => ie("ENGINEERING_OBJECT", e.engineeringObjectType, e))
], re = [
  ...H.map((e) => de("SERVICE", e.serviceId, e)),
  ...B.map((e) => de("ASSET", e.assetId, e)),
  ...K.map((e) => de("ENGINEERING_OBJECT", e.engineeringObjectType, e))
], oe = [
  {
    evidenceRequirementId: "EVIDENCE:ENGINEERING-APPROVAL",
    evidenceType: "ENGINEERING_REVIEW",
    label: "Engineering approval and exception rationale",
    requiredFor: ["SERVICE:ENGINEERING", "ENGINEERING_OBJECT:SPINE", "ENGINEERING_OBJECT:ROUTE_SEGMENT"],
    requiredAtState: "ENGINEERING_ACCEPTED",
    acceptanceCriteria: ["reviewer identified", "exception rationale attached when required", "approval timestamp recorded"],
    responsibleRole: "ENGINEERING",
    blocksRelease: !0,
    blocksClose: !0
  },
  {
    evidenceRequirementId: "EVIDENCE:SURVEY-GPS",
    evidenceType: "GPS_SURVEY",
    label: "Survey/GPS station evidence",
    requiredFor: ["SERVICE:SURVEY", "ENGINEERING_OBJECT:STATION", "ASSET:HANDHOLES", "ASSET:VAULTS"],
    requiredAtState: "GPS_VERIFIED",
    acceptanceCriteria: ["station coordinate captured", "station range identified", "survey source recorded"],
    responsibleRole: "SURVEY",
    blocksRelease: !1,
    blocksClose: !0
  },
  {
    evidenceRequirementId: "EVIDENCE:PERMIT-APPROVAL",
    evidenceType: "PERMIT",
    label: "Permit approval and conditions",
    requiredFor: ["SERVICE:PERMITTING", "SERVICE:DIRECTIONAL-BORE", "SERVICE:OPEN-TRENCH", "ENGINEERING_OBJECT:CROSSING"],
    requiredAtState: "PERMITS_RELEASED",
    acceptanceCriteria: ["permit approved", "station range covered", "conditions attached to release gates"],
    responsibleRole: "PERMITTING",
    blocksRelease: !0,
    blocksClose: !0
  },
  {
    evidenceRequirementId: "EVIDENCE:UTILITY-LOCATE",
    evidenceType: "UTILITY_LOCATE",
    label: "Utility locate ticket and completion evidence",
    requiredFor: ["SERVICE:UTILITY-LOCATE", "SERVICE:DIRECTIONAL-BORE", "SERVICE:PLOWING", "SERVICE:OPEN-TRENCH"],
    requiredAtState: "LOCATE_COMPLETE",
    acceptanceCriteria: ["ticket valid", "locate complete", "conflicts documented"],
    responsibleRole: "CONSTRUCTION",
    blocksRelease: !0,
    blocksClose: !0
  },
  {
    evidenceRequirementId: "EVIDENCE:TRAFFIC-CONTROL",
    evidenceType: "TRAFFIC_CONTROL",
    label: "Traffic control release",
    requiredFor: ["SERVICE:TRAFFIC-CONTROL", "SERVICE:DIRECTIONAL-BORE"],
    requiredAtState: "TRAFFIC_CONTROL_RELEASED",
    acceptanceCriteria: ["plan approved", "release window valid"],
    responsibleRole: "CONTROL",
    blocksRelease: !0,
    blocksClose: !1
  },
  {
    evidenceRequirementId: "EVIDENCE:MATERIAL-RECEIPT",
    evidenceType: "MATERIAL_RECEIPT",
    label: "Material receipt and allocation",
    requiredFor: ["ASSET:CONDUIT", "ASSET:FIBER", "ASSET:SPLICE-CASES", "ASSET:LIU-TERMINATION-HARDWARE"],
    requiredAtState: "RECEIVED",
    acceptanceCriteria: ["material received", "material allocated to station/range", "quantity recorded"],
    responsibleRole: "MARKETPLACE",
    blocksRelease: !0,
    blocksClose: !0
  },
  {
    evidenceRequirementId: "EVIDENCE:BORE-LOG",
    evidenceType: "BORE_LOG",
    label: "Directional bore log and conduit verification",
    requiredFor: ["SERVICE:DIRECTIONAL-BORE", "ASSET:CONDUIT"],
    requiredAtState: "CONDUIT_VERIFIED",
    acceptanceCriteria: ["bore completed", "conduit verified", "station range documented"],
    responsibleRole: "CONSTRUCTION",
    blocksRelease: !1,
    blocksClose: !0
  },
  {
    evidenceRequirementId: "EVIDENCE:PHOTO-GPS",
    evidenceType: "PHOTO_GPS",
    label: "Photo and GPS close evidence",
    requiredFor: ["ASSET:HANDHOLES", "ASSET:VAULTS", "ASSET:MARKER-POSTS", "SERVICE:RESTORATION"],
    requiredAtState: "EVIDENCE_CAPTURED",
    acceptanceCriteria: ["photo attached", "GPS coordinate attached", "station/object reference attached"],
    responsibleRole: "FIELD",
    blocksRelease: !1,
    blocksClose: !0
  },
  {
    evidenceRequirementId: "EVIDENCE:SPLICE-RECORD",
    evidenceType: "SPLICE_RECORD",
    label: "Splice record and labeling evidence",
    requiredFor: ["SERVICE:SPLICING", "ENGINEERING_OBJECT:SPLICE_CASE"],
    requiredAtState: "EVIDENCE_CAPTURED",
    acceptanceCriteria: ["splice record complete", "labeling complete", "splice case reference attached"],
    responsibleRole: "CONSTRUCTION",
    blocksRelease: !1,
    blocksClose: !0
  },
  {
    evidenceRequirementId: "EVIDENCE:OTDR-TRACE",
    evidenceType: "OTDR_TRACE",
    label: "OTDR trace and loss report",
    requiredFor: ["SERVICE:OTDR-TESTING", "ASSET:FIBER", "ENGINEERING_OBJECT:FIBER_SEGMENT"],
    requiredAtState: "OTDR_PASSED",
    acceptanceCriteria: ["trace attached", "loss report within threshold", "engineering acceptance recorded"],
    responsibleRole: "CONSTRUCTION",
    blocksRelease: !1,
    blocksClose: !0
  },
  {
    evidenceRequirementId: "EVIDENCE:INSPECTION-SIGNOFF",
    evidenceType: "INSPECTION",
    label: "Inspection signoff",
    requiredFor: ["SERVICE:INSPECTION", "SERVICE:RESTORATION", "ASSET:HANDHOLES", "ASSET:VAULTS"],
    requiredAtState: "ENGINEERING_ACCEPTED",
    acceptanceCriteria: ["inspection complete", "punchlist resolved", "signoff recorded"],
    responsibleRole: "INSPECTION",
    blocksRelease: !1,
    blocksClose: !0
  },
  {
    evidenceRequirementId: "EVIDENCE:AS-BUILT",
    evidenceType: "AS_BUILT",
    label: "As-built documentation",
    requiredFor: ["SERVICE:AS-BUILT-DOCUMENTATION", "ENGINEERING_OBJECT:EVIDENCE_OBJECT"],
    requiredAtState: "ACCEPTED",
    acceptanceCriteria: ["as-built drawing attached", "station/object refs attached", "engineering acceptance recorded"],
    responsibleRole: "ENGINEERING",
    blocksRelease: !1,
    blocksClose: !0
  }
], le = {
  certificationAuthority: "ENGINEERING",
  engineeringCertifies: [
    "product doctrine compliance",
    "customer technical requirements",
    "material, technical, and placement changes",
    "quantities",
    "stationing",
    "object definitions",
    "dependencies",
    "evidence requirements",
    "close sequences",
    "exceptions and rationale"
  ],
  engineeringDoesNotCertify: [
    "pricing",
    "margin",
    "commercial terms",
    "finance/admin reporting"
  ],
  mustContain: [
    "required services",
    "required assets",
    "required engineering objects",
    "station-level lifecycle projection",
    "close sequences",
    "evidence requirements",
    "acceptance criteria",
    "dependency graph",
    "billing/payment triggers",
    "ScopeVersion readiness requirements"
  ],
  failureConditions: [
    "missing required service definition",
    "missing required asset definition",
    "missing engineering object definition",
    "missing station-level lifecycle projection",
    "missing close sequence",
    "missing evidence requirement",
    "missing acceptance criteria",
    "missing dependency graph",
    "missing billing/payment trigger",
    "missing ScopeVersion readiness requirement"
  ],
  noScopeVersionCreationBeforeSignedServiceOrder: !0
}, Ie = {
  projectionId: `${G}:STATION-LIFECYCLE-PROJECTION`,
  derivesFor: ["station", "station-attached object", "service", "asset", "engineering object"],
  projectedFields: [
    "required service",
    "required asset",
    "prerequisite dependencies",
    "release status",
    "blocked reason",
    "evidence required",
    "close eligibility",
    "payment eligibility",
    "Twin state transition"
  ],
  releaseBlockedWhen: [
    "permit is not approved",
    "conduit material is not received",
    "traffic control is not released",
    "locate is not complete",
    "engineering exception is unresolved",
    "conduit path is not accepted",
    "handholes/vaults are not accepted",
    "fiber material is not received",
    "splice plan is not approved"
  ],
  closeBlockedWhen: [
    "structure is not installed",
    "GPS evidence is missing",
    "photo evidence is missing",
    "inspection is incomplete",
    "engineering acceptance is missing",
    "splice evidence is missing",
    "OTDR/testing is incomplete",
    "labeling is incomplete"
  ],
  paymentEligibleWhen: [
    "close sequence accepted",
    "billable trigger fired",
    "payment trigger released"
  ],
  twinStateTransitions: [
    "SERVICE_CLOSED_PROJECTS_TO_TWIN_ACTIVITY",
    "ASSET_OPERATIONAL_PROJECTS_TO_TWIN_STATE",
    "CERTIFIED_OBJECT_PROJECTS_TO_TWIN"
  ]
}, ce = [
  { requirementId: "SCOPEVERSION-READINESS:CERTIFIED-IOF", label: "Certified IOF Package exists.", sourceArtifact: "Certified IOF Package", required: !0 },
  { requirementId: "SCOPEVERSION-READINESS:SERVICE-ORDER", label: "Service Order executed.", sourceArtifact: "Service Order", required: !0 },
  { requirementId: "SCOPEVERSION-READINESS:CUSTOMER-SIGNATURE", label: "Customer signature received.", sourceArtifact: "Customer Acceptance / Service Order", required: !0 },
  { requirementId: "SCOPEVERSION-READINESS:REQUIRED-SERVICES", label: "Required services are present as ScopeVersion-ready references.", sourceArtifact: "Product Doctrine", required: !0 },
  { requirementId: "SCOPEVERSION-READINESS:REQUIRED-ASSETS", label: "Required assets are present as ScopeVersion-ready references.", sourceArtifact: "Product Doctrine", required: !0 },
  { requirementId: "SCOPEVERSION-READINESS:ENGINEERING-OBJECTS", label: "Engineering objects are certified.", sourceArtifact: "Engineering Certification", required: !0 },
  { requirementId: "SCOPEVERSION-READINESS:STATION-LIFECYCLE", label: "Station-level lifecycle projection exists.", sourceArtifact: "Product Doctrine Assembly", required: !0 },
  { requirementId: "SCOPEVERSION-READINESS:CLOSE-SEQUENCES", label: "Close sequence references exist.", sourceArtifact: "Product Doctrine", required: !0 },
  { requirementId: "SCOPEVERSION-READINESS:EVIDENCE", label: "Evidence requirements and evidence references exist.", sourceArtifact: "Certification Evidence Manifest", required: !0 },
  { requirementId: "SCOPEVERSION-READINESS:DEPENDENCY-GRAPH", label: "Dependency graph exists.", sourceArtifact: "Draft IOF Package / Engineering Revision", required: !0 }
], $ = {
  doctrineId: G,
  productId: g,
  productName: "Point-to-Point Long Haul Conduit & Fiber",
  productVersion: "1.0.0",
  doctrineVersion: W,
  rules: {
    networkClass: "LONG_HAUL",
    topology: "LINEAR",
    layer: 1,
    opticalTransport: !1,
    comparisonAllowed: !1,
    reuseRecommendationAllowed: !1,
    scopeVersionCreationAllowedFromCommercial: !1,
    engineeringCertificationRequired: !0
  },
  requiredInputs: [
    "account/customer",
    "productId",
    "doctrineId",
    "A site",
    "Z site",
    "authoritative route centerline",
    "route authority and measurement provenance",
    "project configuration"
  ],
  assembledArtifacts: [
    "spine",
    "stations",
    "route segments",
    "conduit objects",
    "fiber objects",
    "structures",
    "crossings",
    "required services",
    "required assets",
    "engineering object definitions",
    "execution sequences",
    "close sequences",
    "evidence requirements",
    "station-level lifecycle projection",
    "quantity summary",
    "pricing inputs",
    "validation summary"
  ],
  readinessChecks: [
    "account/customer exists",
    "productId exists",
    "doctrineId exists",
    "A site exists",
    "Z site exists",
    "authoritative route centerline exists",
    "route authority and measurement provenance exist",
    "spine exists",
    "stations count > 0",
    "objects count > 0",
    "quantity summary exists",
    "pricing authority is explicit or unresolved",
    "required services exist",
    "required assets exist",
    "engineering objects exist",
    "execution sequences exist",
    "close sequences exist",
    "evidence requirements exist",
    "certification rules exist",
    "station-level lifecycle projection exists",
    "ScopeVersion readiness requirements exist",
    "validation PASS"
  ],
  registry: _e,
  requiredServices: H,
  requiredAssets: B,
  engineeringObjects: K,
  executionSequences: Ee,
  closeSequences: re,
  evidenceRequirements: oe,
  certificationRules: le,
  stationLevelLifecycleProjection: Ie,
  scopeVersionReadinessRequirements: ce,
  requirementPolicies: [
    { requirementId: "HANDHOLE_PLAN_DEFINED", requirement: "CONDITIONAL", quantityAuthority: "ENGINEERING_DESIGN", resolutionRequired: !0 },
    { requirementId: "VAULT_PLAN_DEFINED", requirement: "CONDITIONAL", quantityAuthority: "ENGINEERING_DESIGN", resolutionRequired: !0 },
    { requirementId: "SPLICE_ARCHITECTURE_DEFINED", requirement: "CONDITIONAL", quantityAuthority: "ENGINEERING_DESIGN", resolutionRequired: !0 },
    { requirementId: "ILA_CONFIGURATION_DEFINED", requirement: "CONDITIONAL", quantityAuthority: "PROJECT_CONFIGURATION", resolutionRequired: !0 },
    { requirementId: "REGENERATION_REQUIREMENT_DEFINED", requirement: "CONDITIONAL", quantityAuthority: "OPTICAL_ENGINEERING_DEFINED", resolutionRequired: !0 },
    { requirementId: "FIBER_PLACEMENT_ALLOWANCE_DEFINED", requirement: "REQUIRED", quantityAuthority: "PROJECT_CONFIGURATION", resolutionRequired: !0 },
    { requirementId: "APPLICABLE_CONSTRAINTS_EVALUATED", requirement: "REQUIRED", quantityAuthority: "ENGINEERING_DESIGN", resolutionRequired: !0 }
  ],
  previousDoctrineVersion: ge,
  changeReason: be
};
function Y(e, n = "UNKNOWN") {
  return (String(e ?? n).trim() || n).replace(/[^A-Za-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 120) || n;
}
function M(e, n = 3) {
  const t = 10 ** n;
  return Math.round(e * t) / t;
}
function ut(e, n) {
  if (!e.length) return [0, 0];
  if (e.length === 1) return e[0];
  const t = Math.min(e.length - 1, Math.max(0, Math.round(n * (e.length - 1))));
  return e[t];
}
function Ne(e, n, t, i) {
  return t ? {
    siteId: `${g}:SITE:${e}:${Y(n)}`,
    role: e,
    label: i,
    coordinate: t,
    source: "AUTHORITATIVE_ROUTE_ENDPOINT"
  } : null;
}
function dt(e, n, t, i) {
  if (!n.length || t <= 0) return [];
  const r = Math.max(2, Math.floor(t / i) + 1);
  return Array.from({ length: r }, (s, c) => {
    const u = r === 1 ? 0 : c / (r - 1), d = c === r - 1 ? t : Math.min(t, c * i);
    return {
      stationId: `${e}:STATION:${String(c).padStart(4, "0")}`,
      spineId: e,
      stationIndex: c,
      stationFeet: Math.round(d),
      milepost: M(d / 5280),
      coordinate: ut(n, u),
      stationRole: "DISPLAY_INDEX",
      constitutionalResolution: !1
    };
  });
}
function Et(e, n, t, i) {
  return t?.length && n.length ? t.map((r, s) => ({
    segmentId: `${e}:SEGMENT:${Y(r.segmentId, String(s + 1))}`,
    spineId: e,
    fromStationId: n[Math.min(s, n.length - 1)]?.stationId ?? n[0].stationId,
    toStationId: n[Math.min(s + 1, n.length - 1)]?.stationId ?? n[n.length - 1].stationId,
    fromMile: M(r.fromMile),
    toMile: M(r.toMile),
    routeMiles: M(r.routeMiles),
    routeFeet: Math.round(r.routeMiles * 5280)
  })) : n.length < 2 || i <= 0 ? [] : n.slice(0, -1).map((r, s) => {
    const c = n[s + 1], u = Math.max(0, c.stationFeet - r.stationFeet);
    return {
      segmentId: `${e}:SEGMENT:${String(s + 1).padStart(3, "0")}`,
      spineId: e,
      fromStationId: r.stationId,
      toStationId: c.stationId,
      fromMile: r.milepost,
      toMile: c.milepost,
      routeMiles: M(u / 5280),
      routeFeet: Math.round(u)
    };
  });
}
function Q(e, n, t, i, r, s, c) {
  return { objectId: e, objectType: n, label: t, parentId: i, quantity: r, unit: s, metadata: c };
}
function lt(e, n, t, i) {
  const r = n.map((s) => Q(
    `${s.segmentId}:CONDUIT`,
    "CONDUIT",
    `Conduit ${s.fromMile}-${s.toMile}`,
    s.segmentId,
    Math.round(s.routeFeet * t),
    "conduit-foot",
    { conduitCount: t, conduitSizeInches: i, routeFeet: s.routeFeet }
  ));
  return {
    assemblyId: `${e}:CONDUIT-ASSEMBLY`,
    conduitCount: t,
    conduitSizeInches: i,
    conduitFeet: r.reduce((s, c) => s + Number(c.quantity ?? 0), 0),
    objects: r
  };
}
function It(e, n, t, i) {
  const r = i?.mode === "PERCENTAGE" && Number.isFinite(i.slackPercent) ? 1 + Number(i.slackPercent) / 100 : 1, s = n.map((c) => Q(
    `${c.segmentId}:FIBER`,
    "FIBER",
    `Fiber ${c.fromMile}-${c.toMile}`,
    c.segmentId,
    Math.round(c.routeFeet * r),
    "fiber-foot",
    { fiberCount: t, slackFactor: r, slackPolicy: i ?? { mode: "ENGINEERING_DEFINED", authority: "UNKNOWN", source: "UNRESOLVED", revision: "UNRESOLVED" }, routeFeet: c.routeFeet }
  ));
  return {
    assemblyId: `${e}:FIBER-ASSEMBLY`,
    fiberCount: t,
    fiberFeet: s.reduce((c, u) => c + Number(u.quantity ?? 0), 0),
    objects: s
  };
}
function pt(e, n) {
  const i = [
    ["HANDHOLE", n?.handholeCount, n?.structurePlanAuthority],
    ["VAULT", n?.vaultCount, n?.structurePlanAuthority],
    ["SPLICE_CASE", n?.spliceCaseCount, n?.spliceArchitectureAuthority]
  ].filter(([, r]) => Number.isFinite(r) && Number(r) > 0).map(([r, s, c]) => Q(
    `${e}:STRUCTURE:${r}`,
    "STRUCTURE",
    r,
    e,
    Number(s),
    "count",
    { structureType: r, quantityAuthority: c ?? "UNKNOWN", source: "PROJECT_CONFIGURATION_OR_SOURCE_EVIDENCE" }
  ));
  return {
    assemblyId: `${e}:STRUCTURE-ASSEMBLY`,
    structureCount: i.reduce((r, s) => r + Number(s.quantity ?? 0), 0),
    structures: i
  };
}
function St(e) {
  const n = [];
  return {
    assemblyId: `${e}:CROSSING-ASSEMBLY`,
    crossingCount: 0,
    crossings: n
  };
}
function Tt(e, n) {
  const t = e.pricingSummary ?? {}, i = Number.isFinite(Number(t.budgetCost ?? t.ospCost)), r = Number.isFinite(Number(t.sellPriceIru ?? t.nrcRevenue)), s = i ? Number(t.budgetCost ?? t.ospCost) : 0, c = r ? Number(t.sellPriceIru ?? t.nrcRevenue) : 0, u = Number(t.nrcRevenue ?? c), d = Number(t.mrcRevenue ?? 0), l = Number(t.grossMarginDollars ?? c - s), E = Number(t.grossMarginPercent ?? (c ? Math.round(l / c * 1e4) / 100 : 0));
  return {
    budgetCost: s,
    sellPriceIru: c,
    nrcRevenue: u,
    mrcRevenue: d,
    grossMarginDollars: l,
    grossMarginPercent: E,
    pricingInputs: {
      routeFeet: n.routeFeet,
      conduitFeet: n.conduitFeet,
      fiberFeet: n.fiberFeet,
      source: t
    },
    priceStatus: i && r ? "AUTHORIZED" : "UNRESOLVED",
    authorityLayer: i || r ? "COMMERCIAL_POLICY" : "UNKNOWN"
  };
}
function T(e, n, t) {
  return { key: e, label: n, status: t ? "PASS" : "FAIL" };
}
function Ct(e) {
  const n = [
    T("account-customer", "account/customer exists", !!(e.accountId && e.customerId)),
    T("product-id", "productId exists", e.productId === g),
    T("doctrine-id", "doctrineId exists", e.doctrineId === G),
    T("a-site", "A site exists", !!e.aSite),
    T("z-site", "Z site exists", !!e.zSite),
    T("authoritative-route-centerline", "Authoritative route centerline exists", !!(e.osrmRoute && e.centerline.length > 1)),
    T("route-authority", "Route measurement authority is explicit", !!(e.osrmRoute?.routeAuthority || e.osrmRoute?.source)),
    T("spine", "spine exists", !!e.spine),
    T("stations", "stations count > 0", e.stations.length > 0),
    T("objects", "objects count > 0", e.objects.length > 0),
    T("quantity-summary", "quantity summary exists", e.quantitySummary.routeFeet > 0 && e.quantitySummary.objectCount > 0),
    T("pricing-authority", "Pricing authority is explicit or unresolved", ["AUTHORIZED", "UNRESOLVED", "COMMERCIAL_PLANNING_ASSUMPTION"].includes(e.pricingSummary.priceStatus ?? "UNRESOLVED")),
    T("required-services", "required services exist", e.requiredServices.length > 0),
    T("required-assets", "required assets exist", e.requiredAssets.length > 0),
    T("engineering-objects", "engineering objects exist", e.engineeringObjects.length > 0),
    T("execution-sequences", "execution sequences exist", e.executionSequences.length > 0),
    T("close-sequences", "close sequences exist", e.closeSequences.length > 0),
    T("evidence-requirements", "evidence requirements exist", e.evidenceRequirements.length > 0),
    T("certification-rules", "certification rules exist", e.certificationRules.mustContain.length > 0),
    T("station-lifecycle-projection", "station-level lifecycle projection exists", !!e.stationLevelLifecycleProjection.projectionId),
    T("scopeversion-readiness", "ScopeVersion readiness requirements exist", e.scopeVersionReadinessRequirements.length > 0)
  ], t = n.filter((i) => i.status === "PASS").length;
  return {
    status: t === n.length ? "PASS" : "FAIL",
    checks: n,
    readinessScore: Math.round(t / n.length * 100)
  };
}
function Nt(e) {
  const n = e.authoritativeRoute ?? e.osrmRoute, t = n?.geometry ?? [], i = Math.max(0, Math.round(n?.routeFeet ?? 0)), r = M(n?.routeMiles ?? i / 5280), s = e.aSite ?? Ne("A", e.accountId, t[0], "A site"), c = e.zSite ?? Ne("Z", e.accountId, t[t.length - 1], "Z site"), u = `${g}:CENTERLINE:${Y(n?.routeId, "AUTHORITATIVE-ROUTE")}`, d = s && c && t.length > 1 && i > 0 ? {
    spineId: `${g}:SPINE:${Y(n?.routeId, "AUTHORITATIVE-ROUTE")}`,
    topology: "LINEAR",
    networkClass: "LONG_HAUL",
    aSiteId: s.siteId,
    zSiteId: c.siteId,
    centerlineId: u,
    routeMiles: r,
    routeFeet: i,
    stationAuthorityMode: "CONTINUOUS",
    routeSource: n?.source,
    routeAuthority: n?.routeAuthority ?? n?.source,
    routeRevision: n?.routeRevision ?? "UNSPECIFIED",
    routeHash: n?.routeHash ?? "UNSPECIFIED",
    measurementAuthority: n?.measurementAuthority ?? "MEASURED_CENTERLINE",
    noScopeVersionCreation: !0
  } : null, l = d ? dt(d.spineId, t, i, e.stationIntervalFeet ?? 5280) : [], E = d ? Et(d.spineId, l, e.routeSegments, i) : [], R = E.map((p) => Q(p.segmentId, "ROUTE_SEGMENT", `Route segment ${p.fromMile}-${p.toMile}`, d?.spineId, p.routeFeet, "route-foot", p)), O = d ? [Q(d.spineId, "SPINE", "Point-to-point long-haul spine", void 0, i, "route-foot", d)] : [], D = e.projectConfiguration?.ductCount ?? e.conduitCount ?? 0, C = e.projectConfiguration?.ductDiameter ?? e.conduitSizeInches ?? 0, A = e.projectConfiguration?.fiberCount ?? e.fiberCount ?? 0, m = d && D > 0 && C > 0 ? lt(d.spineId, E, D, C) : { assemblyId: `${g}:CONDUIT-ASSEMBLY`, conduitCount: D, conduitSizeInches: C, conduitFeet: 0, objects: [] }, S = d && A > 0 ? It(d.spineId, E, A, e.projectConfiguration?.slackPolicy) : { assemblyId: `${g}:FIBER-ASSEMBLY`, fiberCount: A, fiberFeet: 0, objects: [] }, v = d ? pt(d.spineId, e.projectConfiguration) : { assemblyId: `${g}:STRUCTURE-ASSEMBLY`, structureCount: 0, structures: [] }, L = d ? St(d.spineId) : { assemblyId: `${g}:CROSSING-ASSEMBLY`, crossingCount: 0, crossings: [] }, f = [
    ...O,
    ...R,
    ...m.objects,
    ...S.objects,
    ...v.structures,
    ...L.crossings
  ], b = {
    routeMiles: r,
    routeFeet: i,
    stationCount: l.length,
    segmentCount: E.length,
    objectCount: f.length,
    conduitFeet: m.conduitFeet,
    conduitCount: m.conduitCount,
    fiberFeet: S.fiberFeet,
    fiberCount: S.fiberCount,
    structureCount: v.structureCount,
    crossingCount: L.crossingCount
  }, o = Tt(e, b), I = Ct({
    accountId: e.accountId,
    customerId: e.customerId,
    productId: g,
    doctrineId: G,
    aSite: s,
    zSite: c,
    osrmRoute: n,
    centerline: t,
    spine: d,
    stations: l,
    objects: f,
    quantitySummary: b,
    pricingSummary: o,
    requiredServices: H,
    requiredAssets: B,
    engineeringObjects: K,
    executionSequences: Ee,
    closeSequences: re,
    evidenceRequirements: oe,
    certificationRules: le,
    stationLevelLifecycleProjection: Ie,
    scopeVersionReadinessRequirements: ce
  }), q = `${g}:ASSEMBLY:${Y(n?.routeId, "AUTHORITATIVE-ROUTE")}`;
  return {
    assemblyId: q,
    doctrineId: G,
    productId: g,
    productDoctrineVersion: W,
    projectConfiguration: e.projectConfiguration,
    aSite: s,
    zSite: c,
    authoritativeRoute: n,
    osrmRoute: n,
    centerline: t,
    centerlineId: u,
    spine: d,
    stations: l,
    routeSegments: E,
    objects: f,
    conduitAssembly: m,
    fiberAssembly: S,
    structureAssembly: v,
    crossingAssembly: L,
    quantitySummary: b,
    pricingSummary: o,
    validationSummary: I,
    engineeringManifest: {
      manifestId: `${q}:ENGINEERING-MANIFEST`,
      packagePath: "Commercial Proposal -> Product Doctrine Assembly -> Draft IOF Package -> Engineering Review",
      requiresEngineeringCertification: !0,
      noScopeVersionCreation: !0,
      objectIds: f.map((p) => p.objectId),
      stationIds: l.map((p) => p.stationId),
      quantityKeys: Object.keys(b),
      serviceIds: H.map((p) => p.serviceId),
      assetIds: B.map((p) => p.assetId),
      evidenceRequirementIds: oe.map((p) => p.evidenceRequirementId),
      closeSequenceIds: re.map((p) => p.closeSequenceId),
      scopeVersionReadinessRequirementIds: ce.map((p) => p.requirementId)
    },
    rules: $.rules,
    registry: _e,
    requiredServices: H,
    requiredAssets: B,
    engineeringObjects: K,
    executionSequences: Ee,
    closeSequences: re,
    evidenceRequirements: oe,
    certificationRules: le,
    stationLevelLifecycleProjection: Ie,
    scopeVersionReadinessRequirements: ce,
    requirementGaps: [
      ...!e.projectConfiguration?.structurePlanAuthority || e.projectConfiguration.structurePlanAuthority === "UNKNOWN" || !Number.isFinite(e.projectConfiguration.handholeCount) && !Number.isFinite(e.projectConfiguration.vaultCount) ? [{ requirementId: "STRUCTURE_PLAN_DEFINED", objectClass: "STRUCTURE", status: "ENGINEERING_REVIEW_REQUIRED", authority: "ENGINEERING", reason: "Access and structure quantities require source evidence or an Engineering-defined structure plan." }] : [],
      ...!e.projectConfiguration?.spliceArchitectureAuthority || e.projectConfiguration.spliceArchitectureAuthority === "UNKNOWN" || !Number.isFinite(e.projectConfiguration.spliceCaseCount) ? [{ requirementId: "SPLICE_ARCHITECTURE_DEFINED", objectClass: "SPLICE_CASE", status: "ENGINEERING_REVIEW_REQUIRED", authority: "ENGINEERING", reason: "Splice architecture is not defined by route length." }] : [],
      { requirementId: "APPLICABLE_CONSTRAINTS_EVALUATED", objectClass: "CROSSING", status: "UNKNOWN", authority: "ENGINEERING", reason: "Crossing and environmental constraint counts remain unknown until evaluated." }
    ],
    doctrineMigration: { previousDoctrineVersion: ge, newDoctrineVersion: W, changeReason: be },
    noScopeVersionCreation: !0
  };
}
function U(e) {
  return e && typeof e == "object" && !Array.isArray(e) ? e : {};
}
function Re(e) {
  return Array.isArray(e) ? e : [];
}
function P(...e) {
  for (const n of e) {
    const t = String(n ?? "").trim();
    if (t) return t;
  }
  return "";
}
function w(...e) {
  for (const n of e) {
    const t = Number(n);
    if (Number.isFinite(t)) return t;
  }
  return 0;
}
function pe(e) {
  return Array.isArray(e) ? `[${e.map(pe).join(",")}]` : e && typeof e == "object" ? `{${Object.keys(e).sort().map((n) => `${JSON.stringify(n)}:${pe(e[n])}`).join(",")}}` : JSON.stringify(e ?? null);
}
const Oe = qe("sha256").update(pe($)).digest("hex");
if (Oe !== De)
  throw new Error(`PRODUCT_DOCTRINE_HASH_REGISTRY_MISMATCH: ${Oe}`);
const Rt = De, F = Object.freeze({
  productId: g,
  productDoctrineId: G,
  productDoctrineVersion: W,
  productDoctrineHash: Rt,
  productName: $.productName,
  doctrineAlias: $.registry.alias,
  status: "ACTIVE",
  immutable: !0,
  authority: "PRODUCT_DOCTRINE_REGISTRY"
});
function At(e = {}) {
  const n = P(e.productId), t = P(e.productDoctrineId, e.doctrineId), i = P(e.productDoctrineVersion, e.doctrineVersion), r = P(e.productDoctrineHash, e.doctrineHash);
  return !n || !t || !i || !r || n !== F.productId || t !== F.productDoctrineId || i !== F.productDoctrineVersion || r !== F.productDoctrineHash ? null : F;
}
function gt(e) {
  const n = U(e.proposal), t = U(e.route), i = U(n.geometry), r = U(n.centerlineRoute), s = Re(
    t.commercialGeometry ?? t.geometry ?? n.routeGeometry ?? n.centerline ?? r.geometry ?? i.coordinates
  ), c = w(t.routeMiles, n.routeMiles, U(n.pricingSummary).routeMiles, U(n.productConfiguration).routeMiles), u = w(t.routeFeet, n.routeFeet, c * 5280), d = P(t.routeRepositoryId, t.routeId, n.routeId, r.routeId, Re(n.geometryReferences)[0], e.packageId), l = P(t.routeRevision, t.revision, n.routeRevision, "1"), E = P(t.geometryHash, n.routeGeometryHash, n.geometryHash, d), R = s.length > 1 && u > 0 ? {
    routeId: d,
    source: "COMMERCIAL_ROUTE_REPOSITORY",
    routeMiles: c || u / 5280,
    routeFeet: u,
    distanceMeters: u * 0.3048,
    geometry: s,
    routeAuthority: "COMMERCIAL_ROUTE_REPOSITORY",
    routeRevision: l,
    routeHash: E,
    measurementAuthority: "MEASURED_CENTERLINE"
  } : null, O = U(n.productConfiguration ?? n.projectConfiguration), D = Nt({
    accountId: P(n.accountId, n.customerId),
    customerId: P(n.customerId),
    aSite: null,
    zSite: null,
    osrmRoute: R,
    authoritativeRoute: R,
    projectConfiguration: O,
    pricingSummary: U(n.pricingSummary),
    conduitCount: w(O.ductCount, O.conduitCount),
    conduitSizeInches: w(O.ductDiameter, O.conduitSizeInches),
    fiberCount: w(O.fiberCount)
  });
  if (D.validationSummary.status !== "PASS") {
    const A = D.validationSummary.checks.filter((S) => S.status !== "PASS").map((S) => S.key), m = new Error(`PRODUCT_DOCTRINE_ASSEMBLY_FAILED: ${A.join(", ")}`);
    throw Object.assign(m, { code: "PRODUCT_DOCTRINE_ASSEMBLY_FAILED", status: 409, failures: A }), m;
  }
  const C = tt({
    packageId: e.packageId,
    productDoctrine: $,
    productDoctrineAssembly: D,
    routeId: d,
    scopeVersionCandidateId: `${e.packageId}:SCOPEVERSION-CANDIDATE`,
    geometryHash: E
  });
  if (C.validation.status !== "PASS") {
    const A = new Error(`DOCTRINE_OBJECT_INSTANTIATION_FAILED: ${C.validation.failures.join("; ")}`);
    throw Object.assign(A, { code: "DOCTRINE_OBJECT_INSTANTIATION_FAILED", status: 409, failures: C.validation.failures }), A;
  }
  return {
    authority: F,
    productDoctrine: $,
    productDoctrineAssembly: D,
    doctrineObjectInstantiation: C,
    engineeringObjectManifest: C.engineeringObjectManifest
  };
}
export {
  F as PRODUCT_DOCTRINE_AUTHORITY,
  Rt as PRODUCT_DOCTRINE_HASH,
  gt as assembleProductDoctrineArtifacts,
  At as resolveProductDoctrineAuthority
};
