import { createHash as ze } from "node:crypto";
const q = "DOCTRINE_OBJECT_INSTANTIATION_ENGINE", Ze = "32.1";
function X(e, n = "UNKNOWN") {
  return (String(e ?? n).trim() || n).replace(/[^A-Za-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 96) || n;
}
function Ve(e) {
  const n = Math.max(0, Math.round(e)), t = Math.floor(n / 100), r = n % 100;
  return `STA ${t}+${String(r).padStart(2, "0")}`;
}
function Xe(e) {
  return {
    stationId: e.stationId,
    stationLabel: Ve(e.stationFeet),
    measureFeet: e.stationFeet,
    coordinate: e.coordinate
  };
}
function _e(e, n) {
  return e.reduce((t, r) => Math.abs(r.measureFeet - n) < Math.abs(t.measureFeet - n) ? r : t, e[0]);
}
function et(e, n, t) {
  if (e.length <= 1) return e[0];
  if (t <= 1) return e[Math.floor(e.length / 2)];
  const r = Math.min(e.length - 1, Math.max(0, Math.round(n / Math.max(1, t - 1) * (e.length - 1))));
  return e[r];
}
function tt(e) {
  return e[0];
}
function nt(e) {
  return e[e.length - 1] ?? e[0];
}
function it(e) {
  const n = e.stations.map(Xe);
  if (n.length) return n;
  const t = e.centerline, r = e.quantitySummary.routeFeet;
  return t.length > 1 ? [
    { stationId: `${e.assemblyId}:STA-A`, stationLabel: "STA 0+00", measureFeet: 0, coordinate: t[0] },
    { stationId: `${e.assemblyId}:STA-Z`, stationLabel: Ve(r), measureFeet: r, coordinate: t[t.length - 1] }
  ] : [
    { stationId: `${e.assemblyId}:STA-UNKNOWN-A`, stationLabel: "STA 0+00", measureFeet: 0, coordinate: [0, 0] },
    { stationId: `${e.assemblyId}:STA-UNKNOWN-Z`, stationLabel: "STA 0+01", measureFeet: 1, coordinate: [0, 0] }
  ];
}
function rt(e, n) {
  const t = new Map(n.map((o) => [o.stationId, o])), r = e.routeSegments.map((o, c) => ({
    segmentId: o.segmentId,
    stationStart: t.get(o.fromStationId) ?? _e(n, o.fromMile * 5280),
    stationEnd: t.get(o.toStationId) ?? _e(n, o.toMile * 5280),
    addressKind: "LINEAR",
    index: c
  }));
  return r.length ? r : [{
    segmentId: `${e.assemblyId}:SEGMENT:FULL-ROUTE`,
    stationStart: tt(n),
    stationEnd: nt(n),
    addressKind: "LINEAR"
  }];
}
function ot(e, n, t, r) {
  return {
    paymentSequenceId: `${n}:PAYMENT-SEQUENCE`,
    objectId: n,
    billableTrigger: r.billableTrigger,
    paymentTrigger: r.paymentTrigger,
    capitalCashFlowTrigger: r.capitalCashFlowTrigger ?? "Capital/cash-flow trigger follows accepted close sequence.",
    paymentEligible: !1,
    sequenceIndex: t,
    noScopeVersionCreation: !0
  };
}
function oe(e, n) {
  const t = new Set(n);
  return e.filter((r) => r.requiredFor.some((o) => t.has(o)));
}
function ce(e, n, t) {
  return e.find((r) => r.appliesTo === n && r.appliesToId === t) ?? null;
}
function se(e, n, t) {
  return e.find((r) => r.appliesTo === n && r.appliesToId === t) ?? null;
}
function ct(e) {
  const n = e.target.pointStation, t = n?.stationLabel ?? e.target.stationStart.stationLabel, r = n?.stationLabel ?? e.target.stationEnd.stationLabel, o = n?.measureFeet ?? e.target.stationStart.measureFeet, c = n?.measureFeet ?? e.target.stationEnd.measureFeet, i = t === r ? t : `${t} to ${r}`, d = n?.coordinate, a = [
    e.scopeVersionCandidateId,
    X(e.target.segmentId),
    e.objectType,
    i,
    d ? `${d[1]}, ${d[0]}` : ""
  ].filter(Boolean).join(" / ");
  return {
    scopeVersionCandidateId: e.scopeVersionCandidateId,
    routeId: e.routeId,
    segmentId: e.target.segmentId,
    stationStart: t,
    stationEnd: r,
    stationStartFeet: o,
    stationEndFeet: c,
    objectType: e.objectType,
    objectSequence: e.objectSequence,
    parentObjectId: e.parentObjectId,
    geometryHash: e.geometryHash,
    jurisdiction: e.jurisdiction,
    latitude: d?.[1],
    longitude: d?.[0],
    stationRange: i,
    addressLabel: a,
    addressKind: e.target.addressKind,
    noScopeVersionCreation: !0
  };
}
function st(e, n) {
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
function at(e) {
  const n = e.toUpperCase();
  return n.includes("BORE") ? "DIRECTIONAL_BORE" : n.includes("TRENCH") ? "OPEN_TRENCH" : n.includes("FIBER") ? "FIBER_PLACEMENT" : n.includes("SPLICE") ? "SPLICING" : n.includes("TEST") ? "TESTING" : n.includes("CONDUIT") || n.includes("DUCT") ? "CONDUIT_PLACEMENT" : "ENGINEERING_PLACEMENT";
}
function ae(e) {
  const n = `${e.packageId}:DOIE:${e.objectGroup}:${X(e.objectType)}:${String(e.objectSequence).padStart(5, "0")}`, t = e.evidenceRequirements.length ? e.evidenceRequirements : e.lifecycle.requiredEvidence.map((p, I) => ({
    evidenceRequirementId: `${n}:EVIDENCE:${String(I + 1).padStart(3, "0")}`,
    evidenceType: X(p).toUpperCase(),
    label: p,
    requiredFor: [n, e.objectType],
    requiredAtState: "EVIDENCE_CAPTURED",
    acceptanceCriteria: e.lifecycle.acceptanceCriteria,
    responsibleRole: e.lifecycle.responsibleRole,
    blocksRelease: !1,
    blocksClose: !0
  })), r = ct({
    scopeVersionCandidateId: e.scopeVersionCandidateId,
    routeId: e.routeId,
    objectType: e.objectType,
    objectSequence: e.objectSequence,
    parentObjectId: e.parentObjectId,
    geometryHash: e.geometryHash,
    jurisdiction: e.jurisdiction,
    target: e.target
  }), o = ot(e.packageId, n, e.objectSequence, e.lifecycle), c = st(r, e.target), i = e.lifecycle, d = String(
    i.serviceId ?? i.assetId ?? i.engineeringObjectType ?? e.objectType
  ), a = e.lifecycle.prerequisiteDependencies.map((p) => `${n}:DEP:${X(p)}`), E = t.filter((p) => p.evidenceType.includes("INSPECTION") || p.label.toLowerCase().includes("inspection"));
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
    stationStart: r.stationStart,
    stationEnd: r.stationEnd,
    stationAddress: r.addressKind === "POINT" ? r.stationStart : r.stationRange,
    stationSequence: e.objectSequence,
    geographicCoordinate: e.target.pointStation?.coordinate ?? e.target.stationStart.coordinate,
    parentSpanId: e.target.segmentId,
    parentRouteId: e.routeId,
    parentSegmentId: e.target.segmentId,
    doctrineQuantitySource: d,
    geometry: c,
    hierarchy: {
      hierarchyPath: e.parentObjectId === "ROOT" ? [n] : [e.parentObjectId, n],
      parentObjectId: e.parentObjectId,
      childObjectIds: [],
      level: e.parentObjectId === "ROOT" ? 0 : 1
    },
    requiredServices: e.requiredServices,
    requiredAssets: e.requiredAssets,
    constructionMethod: at(e.objectType),
    placementStrategy: e.target.pointStation ? "POINT_STATION_ADDRESS" : "LINEAR_STATION_RANGE",
    executionSequence: e.executionSequence,
    executionSequenceId: e.executionSequence?.sequenceId ?? `${n}:EXECUTION-SEQUENCE`,
    closeSequence: e.closeSequence,
    closeSequenceId: e.closeSequence?.closeSequenceId ?? `${n}:CLOSE-SEQUENCE`,
    paymentSequence: o,
    paymentSequenceId: o.paymentSequenceId,
    evidenceRequirements: t,
    inspectionRequirements: E,
    acceptanceCriteria: e.lifecycle.acceptanceCriteria,
    dependencyIds: a,
    dependencyList: a,
    address: r,
    visibilityProfile: {
      engineering: "VISIBLE",
      marketplace: "PROJECTED_AFTER_SCOPEVERSION",
      control: "PROJECTED_AFTER_SCOPEVERSION",
      field: "PROJECTED_AFTER_SCOPEVERSION",
      twin: "PROJECTED_AFTER_ACCEPTED_CLOSURE"
    },
    currentState: "PLANNED",
    currentLifecycleState: "PLANNED",
    authority: q,
    engineeringAuthority: q,
    noScopeVersionCreation: !0
  };
}
function k(e) {
  const n = Number(e);
  return Number.isFinite(n) ? Math.max(0, Math.ceil(n)) : 0;
}
function K(e, ...n) {
  const t = n.map((r) => r.toUpperCase());
  return e.structureAssembly.structures.filter((r) => {
    const o = String(r.metadata.structureType ?? r.label ?? r.objectId).toUpperCase();
    return t.some((c) => o.includes(c));
  }).reduce((r, o) => r + k(o.quantity), 0);
}
function dt(e, n) {
  const t = Math.max(1, Math.ceil(n.quantitySummary.routeMiles / 5)), r = Math.max(1, Math.ceil(n.quantitySummary.routeMiles / 5));
  return {
    quantityPlacementId: `${e}:DOIE:QUANTITY-PLACEMENT`,
    quantitySource: "PRODUCT_DOCTRINE_ASSEMBLY",
    placementAssumptionSource: "PRODUCT_DOCTRINE_ASSEMBLY_PLACEMENT_ASSUMPTIONS",
    handholeCount: K(n, "HANDHOLE"),
    vaultCount: K(n, "VAULT"),
    spliceCaseCount: K(n, "SPLICE"),
    ilaRegenCount: K(n, "ILA") + K(n, "REGEN"),
    markerCount: t,
    slackLoopCount: r,
    conduitFeet: k(n.quantitySummary.conduitFeet),
    fiberFeet: k(n.quantitySummary.fiberFeet),
    stationCount: k(n.quantitySummary.stationCount),
    routeFeet: k(n.quantitySummary.routeFeet),
    noNewQuantityLogic: !0,
    authority: q,
    noScopeVersionCreation: !0
  };
}
const ut = /* @__PURE__ */ new Map([
  ["ASSET:HANDHOLES", "HANDHOLE_PLAN_DEFINED"],
  ["ASSET:VAULTS", "VAULT_PLAN_DEFINED"],
  ["ASSET:SPLICE-CASES", "SPLICE_ARCHITECTURE_DEFINED"],
  ["ASSET:ILA-REGEN-FACILITIES", "ILA_CONFIGURATION_DEFINED"]
]);
function Et(e, n) {
  const t = n.projectConfiguration, r = e.assetType.toUpperCase();
  if (r.includes("HANDHOLE")) return t?.handholeCount;
  if (r.includes("VAULT")) return t?.vaultCount;
  if (r.includes("SPLICE")) return t?.spliceCaseCount;
}
function lt(e, n, t, r) {
  const o = e.assetType.toUpperCase();
  if (o.includes("HANDHOLE")) return t.handholeCount;
  if (o.includes("VAULT")) return t.vaultCount;
  if (o.includes("SPLICE")) return t.spliceCaseCount;
  if (o.includes("ILA") || o.includes("REGEN")) return t.ilaRegenCount;
  if (o.includes("MARKER")) return t.markerCount;
  if (o.includes("SLACK")) return t.slackLoopCount;
  if (o.includes("CONDUIT") || o.includes("FIBER") || o.includes("WIRE") || o.includes("TAPE")) return Math.max(1, r);
  if (o.includes("LIU") || o.includes("TERMINATION")) {
    const c = String(n.projectConfiguration?.terminationConfiguration ?? "").toUpperCase();
    return c && !["UNKNOWN", "ENGINEERING_DEFINED", "NONE", "NOT_APPLICABLE"].includes(c) ? 2 : 0;
  }
  return e.requiredWhen ? 0 : 1;
}
function It(e, n) {
  const t = ut.get(e.assetId) ?? "", r = n.requirementPolicies?.find((o) => o.requirementId === t);
  return {
    requirementId: t || `${e.assetId}:REQUIRED`,
    requirement: r?.requirement ?? (e.requiredWhen ? "CONDITIONAL" : "REQUIRED"),
    quantityAuthority: r?.quantityAuthority ?? "UNKNOWN",
    resolutionRequired: r?.resolutionRequired ?? !!e.requiredWhen
  };
}
function pt(e) {
  switch (e.assetId) {
    case "ASSET:HANDHOLES":
      return {
        cause: "A governed source or Engineering structure plan identifies a handhole access, pull, or maintenance event.",
        quantity: "Count of handhole events in the governed structure plan; route mileage alone creates none.",
        placement: "Exact governed station assigned by the structure plan; a count-only legacy plan remains an Engineering review projection."
      };
    case "ASSET:VAULTS":
      return {
        cause: "A governed source or Engineering structure plan identifies a vault functional location.",
        quantity: "Count of vault functional locations in the governed structure plan; route mileage alone creates none.",
        placement: "Exact governed station assigned by the structure plan; a count-only legacy plan remains an Engineering review projection."
      };
    case "ASSET:SPLICE-CASES":
      return {
        cause: "A governed splice architecture identifies a splice, branch, transition, or other splice-case event.",
        quantity: "Count of governed splice events; route mileage and display stations create none.",
        placement: "Exact governed station of each splice event from the splice architecture."
      };
    case "ASSET:ILA-REGEN-FACILITIES":
      return {
        cause: "A governed optical design or explicit project configuration requires an ILA or regeneration facility.",
        quantity: "Count of governed optical facility decisions; route length alone creates none.",
        placement: "Exact governed optical-design station with site and power authority."
      };
    case "ASSET:LIU-TERMINATION-HARDWARE":
      return {
        cause: "A governed customer handoff or termination configuration requires LIU hardware.",
        quantity: "Quantity from the governed termination configuration.",
        placement: "Governed A/Z or other termination point identified by the termination configuration."
      };
    default:
      return {
        cause: e.requiredWhen ?? "Product Doctrine requires this asset for the selected product.",
        quantity: "Quantity derives from the Product Doctrine Assembly and governed project configuration.",
        placement: "Placement derives from the governed spine and Product Doctrine placement projection."
      };
  }
}
function St(e, n, t, r) {
  return e.requiredAssets.map((o) => {
    const c = It(o, e), i = lt(o, n, t, r), d = Et(o, n), a = n.projectConfiguration, E = Number.isFinite(Number(d)) && Number(d) === 0, p = o.assetId === "ASSET:ILA-REGEN-FACILITIES" && a?.intermediateIlaEnabled === !1 && a?.bookendIlaEnabled === !1, I = i > 0 ? "APPLICABLE" : c.requirement === "REQUIRED" ? "ENGINEERING_REVIEW_REQUIRED" : E || p ? "NOT_APPLICABLE" : "ENGINEERING_REVIEW_REQUIRED", C = pt(o);
    return {
      assetId: o.assetId,
      assetType: o.assetType,
      requirement: c.requirement,
      requirementId: c.requirementId,
      quantityAuthority: c.quantityAuthority,
      resolutionRequired: c.resolutionRequired,
      applicability: I,
      instantiatedQuantity: i,
      existenceCause: C.cause,
      quantityRule: C.quantity,
      placementRule: C.placement,
      routeLengthCreatesAsset: !1,
      noScopeVersionCreation: !0
    };
  });
}
function Pe(e, n, t, r, o) {
  switch (e.engineeringObjectType) {
    case "STATION":
      return t.length;
    case "ROUTE_SEGMENT":
    case "CONDUIT_SEGMENT":
    case "FIBER_SEGMENT":
      return r.length;
    case "STRUCTURE":
      return k(o.quantitySummary.structureCount);
    case "CROSSING":
      return k(o.quantitySummary.crossingCount);
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
function de(e, n, t, r, o) {
  const c = e.toUpperCase(), i = o[Math.min(o.length - 1, Math.max(0, n % Math.max(1, o.length)))] ?? o[0], d = et(r, n, t);
  return c.includes("STATION") || c.includes("HANDHOLE") || c.includes("VAULT") || c.includes("SPLICE") || c.includes("ILA") || c.includes("REGEN") || c.includes("TERMINATION") || c.includes("MARKER") || c.includes("EVIDENCE") || c.includes("LIU") ? {
    segmentId: i.segmentId,
    stationStart: d,
    stationEnd: d,
    pointStation: d,
    addressKind: c.includes("EVIDENCE") ? "EVIDENCE" : "POINT"
  } : c.includes("SERVICE") ? { ...i, addressKind: "SERVICE" } : i;
}
function Tt(e) {
  const n = new Map(e.map((t) => [t.objectId, t]));
  return e.forEach((t) => {
    const r = n.get(t.parentObjectId);
    r && (r.childObjectIds.push(t.objectId), r.hierarchy.childObjectIds.push(t.objectId));
  }), e;
}
function Ct(e, n) {
  const t = n.map((d) => ({
    nodeId: `${d.objectId}:NODE`,
    objectId: d.objectId,
    objectType: d.objectType,
    objectGroup: d.objectGroup,
    addressLabel: d.address.addressLabel
  })), r = n.slice(0, -1).map((d, a) => ({
    edgeId: `${e}:DOIE:EDGE:SEQUENCE:${String(a + 1).padStart(5, "0")}`,
    fromObjectId: d.objectId,
    toObjectId: n[a + 1].objectId,
    dependencyType: "SEQUENCE",
    reason: "Deterministic Product Doctrine execution sequence."
  })), o = n.filter((d) => d.parentObjectId !== "ROOT").map((d, a) => ({
    edgeId: `${e}:DOIE:EDGE:HIERARCHY:${String(a + 1).padStart(5, "0")}`,
    fromObjectId: d.parentObjectId,
    toObjectId: d.objectId,
    dependencyType: "HIERARCHY",
    reason: "Child object inherits constitutional parent."
  })), c = n.filter((d) => d.dependencyIds.length).map((d, a) => ({
    edgeId: `${e}:DOIE:EDGE:PREREQUISITE:${String(a + 1).padStart(5, "0")}`,
    fromObjectId: d.objectId,
    toObjectId: d.objectId,
    dependencyType: "PREREQUISITE",
    reason: d.dependencyIds[0]
  })), i = [...r, ...o, ...c];
  return {
    graphId: `${e}:DOIE:DEPENDENCY-GRAPH`,
    nodeCount: t.length,
    edgeCount: i.length,
    nodes: t,
    edges: i,
    authority: q,
    noScopeVersionCreation: !0
  };
}
function mt(e, n, t) {
  const r = t.requiredServices.map((i) => i.serviceId), o = t.requiredAssets.map((i) => i.assetId), c = t.evidenceRequirements.map((i) => i.evidenceRequirementId);
  return n.map((i) => ({
    stationLifecycleRuleId: `${e}:DOIE:STATION-LIFECYCLE:${X(i.stationId)}`,
    stationId: i.stationId,
    stationLabel: i.stationLabel,
    requiredServiceIds: r,
    requiredAssetIds: o,
    prerequisiteDependencies: [
      "permit approved",
      "traffic control released",
      "materials delivered",
      "utility locate complete",
      "engineering exceptions resolved"
    ],
    releaseStatus: "BLOCKED_UNTIL_DEPENDENCIES_RELEASED",
    blockedReason: "Station release depends on permit, traffic control, material, locate, and exception gates.",
    evidenceRequired: c,
    closeEligibility: "ELIGIBLE_AFTER_CLOSE_SEQUENCE_ACCEPTED",
    paymentEligibility: "ELIGIBLE_AFTER_ACCEPTANCE_AND_BILLABLE_TRIGGER",
    twinStateTransition: "PLANNED_RELEASED_INSTALLED_INSPECTED_VALIDATED_ACCEPTED_OPERATIONAL",
    authority: q,
    noScopeVersionCreation: !0
  }));
}
function Rt(e) {
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
function Nt(e) {
  return Rt(e.quantityPlacement).flatMap((t) => Array.from({ length: t.count }, (r, o) => {
    const c = de(t.objectType, o, t.count, e.stations, e.targets), i = c.pointStation ?? c.stationStart;
    return {
      objectId: `${t.prefix}-${String(o + 1).padStart(3, "0")}`,
      objectType: t.objectType,
      stationAddress: i.stationLabel,
      stationSequence: 0,
      stationFeet: i.measureFeet,
      parentRouteId: e.routeId,
      parentSegmentId: c.segmentId,
      placementReason: t.placementReason,
      placementAuthority: q,
      doctrineQuantitySource: t.doctrineQuantitySource,
      originalDoctrineStation: i.stationLabel,
      currentEngineeringStation: i.stationLabel,
      movementCreatesEngineeringChangeSet: !0,
      noScopeVersionCreation: !0
    };
  })).sort((t, r) => t.stationFeet - r.stationFeet || t.objectId.localeCompare(r.objectId)).map((t, r) => ({ ...t, stationSequence: r + 1 }));
}
function At(e) {
  return e.map((n, t) => ({
    ...n,
    sequenceId: `${n.parentRouteId}:DOIE:ACTION-SEQUENCE:${String(t + 1).padStart(5, "0")}`,
    previousObjectId: e[t - 1]?.objectId,
    nextObjectId: e[t + 1]?.objectId
  }));
}
function je(e) {
  const n = e.toUpperCase();
  return n.includes("HANDHOLE") ? "HH" : n.includes("VAULT") ? "VAULT" : n.includes("SPLICE") ? "SPLICE" : n.includes("ILA") || n.includes("REGEN") ? "ILA" : n.includes("MARKER") ? "MARKER" : n.includes("SLACK") ? "SLACK" : "STRUCTURE";
}
function Ot(e, n) {
  return n.slice(0, -1).map((t, r) => {
    const o = n[r + 1], c = Math.min(t.stationFeet, o.stationFeet), i = Math.max(t.stationFeet, o.stationFeet);
    return {
      spanId: `${e}:DOIE:SPAN:${String(r + 1).padStart(5, "0")}`,
      spanType: `${je(t.objectType)}_TO_${je(o.objectType)}`,
      fromObjectId: t.objectId,
      toObjectId: o.objectId,
      stationStart: c === t.stationFeet ? t.stationAddress : o.stationAddress,
      stationEnd: i === o.stationFeet ? o.stationAddress : t.stationAddress,
      stationStartFeet: c,
      stationEndFeet: i,
      parentRouteId: t.parentRouteId,
      parentSegmentId: t.parentSegmentId === o.parentSegmentId ? t.parentSegmentId : `${t.parentSegmentId}->${o.parentSegmentId}`,
      routeFeet: Math.max(0, i - c),
      spanAuthority: q,
      closureBoundary: "VIEW_ONLY_NOT_CLOSURE_LIMIT",
      preservesContinuousStationClosure: !0,
      noScopeVersionCreation: !0
    };
  });
}
const $e = [
  ["CONDUIT", "productDoctrineAssembly.quantitySummary.conduitFeet"],
  ["FIBER", "productDoctrineAssembly.quantitySummary.fiberFeet"],
  ["TRACE_WIRE", "Product Doctrine locate wire asset attached to every station span"],
  ["WARNING_TAPE", "Product Doctrine warning tape asset attached to every station span"],
  ["MULE_TAPE_PULL_TAPE", "Product Doctrine conduit placement assumption attaches pull tape to every station span"]
];
function gt(e) {
  return e.flatMap((n) => $e.map(([t, r]) => ({
    attachmentId: `${n.spanId}:ASSET:${t}`,
    spanId: n.spanId,
    assetType: t,
    fromObjectId: n.fromObjectId,
    toObjectId: n.toObjectId,
    stationStart: n.stationStart,
    stationEnd: n.stationEnd,
    routeFeet: n.routeFeet,
    doctrineQuantitySource: r,
    placementAuthority: q,
    noScopeVersionCreation: !0
  })));
}
function bt(e) {
  return {
    policyId: `${e}:DOIE:ENGINEERING-MOVEMENT-POLICY`,
    movementCreatesEngineeringChangeSet: !0,
    requiredPatchType: "MOVE_OBJECT",
    requiredFields: ["originalDoctrineStation", "newEngineeringStation", "delta", "rationale"],
    authority: q,
    noScopeVersionCreation: !0
  };
}
function ht(e) {
  return /* @__PURE__ */ new Map([
    ["HANDHOLE", e.handholeCount],
    ["VAULT", e.vaultCount],
    ["SPLICE_CASE", e.spliceCaseCount],
    ["ILA_REGENERATION_SITE", e.ilaRegenCount],
    ["MARKER_POST", e.markerCount],
    ["SLACK_LOOP", e.slackLoopCount]
  ]);
}
function yt(e) {
  const n = /* @__PURE__ */ new Set(), t = /* @__PURE__ */ new Set();
  return e.forEach((r) => {
    n.has(r) && t.add(r), n.add(r);
  }), t.size;
}
function Dt(e, n, t, r, o, c, i, d, a, E) {
  const p = new Set(t.map((s) => s.objectType)), I = new Set(t.filter((s) => s.objectGroup === "REQUIRED_SERVICE").map((s) => s.requiredServices[0])), C = new Set(t.filter((s) => s.objectGroup === "REQUIRED_ASSET").map((s) => s.requiredAssets[0])), R = o.filter((s) => s.applicability === "APPLICABLE"), T = ht(r), m = c.reduce((s, l) => (s.set(l.objectType, (s.get(l.objectType) ?? 0) + 1), s), /* @__PURE__ */ new Map()), h = [...T.entries()].filter(([, s]) => s > 0).filter(([s, l]) => (m.get(s) ?? 0) !== l).map(([s, l]) => `Doctrine station object count mismatch for ${s}: expected ${l}, placed ${m.get(s) ?? 0}.`), g = c.filter((s) => !s.stationAddress || !s.stationSequence).map((s) => `Station object ${s.objectId} is missing station address or sequence.`), A = c.filter((s, l) => s.stationSequence !== l + 1).map((s, l) => `Station object ${s.objectId} has sequence ${s.stationSequence}; expected ${l + 1}.`), y = yt(c.map((s) => s.objectId)) ? ["Station object index contains duplicate object IDs."] : [], D = [
    ...i.length > 1 && !d.length ? ["Sequenced action objects exist but span derivation produced no spans."] : [],
    ...d.filter((s) => s.stationEndFeet < s.stationStartFeet).map((s) => `Derived span ${s.spanId} has invalid station order.`)
  ], f = /* @__PURE__ */ new Map();
  a.forEach((s) => {
    const l = f.get(s.spanId) ?? /* @__PURE__ */ new Set();
    l.add(s.assetType), f.set(s.spanId, l);
  });
  const _ = d.flatMap((s) => {
    const l = f.get(s.spanId) ?? /* @__PURE__ */ new Set();
    return $e.filter(([G]) => !l.has(G)).map(([G]) => `Derived span ${s.spanId} is missing ${G} attachment.`);
  }), P = [
    ...t.filter((s) => !s.address.addressLabel || !s.address.stationRange).map((s) => `Object ${s.objectId} is missing deterministic address.`),
    ...t.filter((s) => !s.paymentSequence.paymentSequenceId).map((s) => `Object ${s.objectId} is missing payment sequence.`),
    ...t.filter((s) => !s.closeSequence?.closeSequenceId).map((s) => `Object ${s.objectId} is missing close sequence.`),
    ...t.filter((s) => !s.evidenceRequirements.length && s.objectGroup !== "EVIDENCE_OBJECT").map((s) => `Object ${s.objectId} is missing evidence requirements.`),
    ...n.requiredServices.filter((s) => !I.has(s.serviceId)).map((s) => `Required service ${s.serviceId} was not instantiated.`),
    ...R.filter((s) => !C.has(s.assetId)).map((s) => `Required asset ${s.assetId} was not instantiated.`),
    ...E.filter((s) => !p.has(s)).map((s) => `Engineering object type ${s} was not instantiated.`),
    ...h,
    ...g,
    ...A,
    ...y,
    ...D,
    ..._
  ];
  return {
    validationId: `${e}:DOIE:VALIDATION`,
    status: P.length ? "FAIL" : "PASS",
    checkedObjectCount: t.length,
    missingAddressCount: t.filter((s) => !s.address.addressLabel || !s.address.stationRange).length,
    missingRequiredServiceCount: n.requiredServices.filter((s) => !I.has(s.serviceId)).length,
    missingRequiredAssetCount: R.filter((s) => !C.has(s.assetId)).length,
    missingEngineeringObjectTypeCount: E.filter((s) => !p.has(s)).length,
    missingPaymentSequenceCount: t.filter((s) => !s.paymentSequence.paymentSequenceId).length,
    missingCloseSequenceCount: t.filter((s) => !s.closeSequence?.closeSequenceId).length,
    missingEvidenceRequirementCount: t.filter((s) => !s.evidenceRequirements.length && s.objectGroup !== "EVIDENCE_OBJECT").length,
    quantityMismatchCount: h.length,
    missingStationAddressCount: g.length,
    sequenceGapCount: A.length,
    duplicateObjectIdCount: y.length,
    spanDerivationFailureCount: D.length,
    unattachedLinearAssetCount: _.length,
    failures: P,
    authority: q,
    noScopeVersionCreation: !0
  };
}
function Lt(e) {
  const { packageId: n, productDoctrine: t, productDoctrineAssembly: r } = e, o = e.routeId ?? r.osrmRoute?.routeId ?? r.centerlineId, c = e.scopeVersionCandidateId ?? `${n}:SCOPEVERSION-CANDIDATE`, i = e.geometryHash ?? r.centerlineId, d = e.jurisdiction ?? "UNRESOLVED_JURISDICTION", a = it(r), E = rt(r, a), p = dt(n, r), I = St(t, r, p, E.length), C = [];
  let R = 0;
  const T = E[0], m = t.engineeringObjects.find((u) => u.engineeringObjectType === "SPINE") ?? t.engineeringObjects[0], h = oe(t.evidenceRequirements, ["ENGINEERING_OBJECT:SPINE", m?.engineeringObjectType ?? "SPINE"]), g = ae({
    packageId: n,
    productDoctrine: t,
    objectGroup: "ENGINEERING_OBJECT",
    objectType: "SPINE",
    objectSequence: ++R,
    parentObjectId: "ROOT",
    target: T,
    scopeVersionCandidateId: c,
    routeId: o,
    geometryHash: i,
    jurisdiction: d,
    requiredServices: m?.requiredServiceIds ?? [],
    requiredAssets: m?.requiredAssetIds ?? [],
    lifecycle: m,
    executionSequence: se(t.executionSequences, "ENGINEERING_OBJECT", "SPINE"),
    closeSequence: ce(t.closeSequences, "ENGINEERING_OBJECT", "SPINE"),
    evidenceRequirements: h
  });
  C.push(g), t.engineeringObjects.filter((u) => u.engineeringObjectType !== "SPINE").forEach((u) => {
    const V = Pe(u, p, a, E, r);
    Array.from({ length: V }, (S, O) => {
      const x = de(u.engineeringObjectType, O, V, a, E), me = [`ENGINEERING_OBJECT:${u.engineeringObjectType}`, u.engineeringObjectType, ...u.requiredServiceIds, ...u.requiredAssetIds];
      C.push(ae({
        packageId: n,
        productDoctrine: t,
        objectGroup: u.engineeringObjectType === "EVIDENCE_OBJECT" ? "EVIDENCE_OBJECT" : "ENGINEERING_OBJECT",
        objectType: u.engineeringObjectType,
        objectSequence: ++R,
        parentObjectId: g.objectId,
        target: x,
        scopeVersionCandidateId: c,
        routeId: o,
        geometryHash: i,
        jurisdiction: d,
        requiredServices: u.requiredServiceIds,
        requiredAssets: u.requiredAssetIds,
        lifecycle: u,
        executionSequence: se(t.executionSequences, "ENGINEERING_OBJECT", u.engineeringObjectType),
        closeSequence: ce(t.closeSequences, "ENGINEERING_OBJECT", u.engineeringObjectType),
        evidenceRequirements: oe(t.evidenceRequirements, me)
      }));
    });
  }), t.requiredServices.forEach((u, V) => {
    const S = de(`${u.serviceType}_SERVICE`, V, t.requiredServices.length, a, E), O = [u.serviceId, `SERVICE:${u.serviceName.toUpperCase().replaceAll(" ", "-")}`];
    C.push(ae({
      packageId: n,
      productDoctrine: t,
      objectGroup: "REQUIRED_SERVICE",
      objectType: u.serviceType,
      objectSequence: ++R,
      parentObjectId: g.objectId,
      target: { ...S, addressKind: "SERVICE" },
      scopeVersionCandidateId: c,
      routeId: o,
      geometryHash: i,
      jurisdiction: d,
      requiredServices: [u.serviceId],
      requiredAssets: [],
      lifecycle: u,
      executionSequence: se(t.executionSequences, "SERVICE", u.serviceId),
      closeSequence: ce(t.closeSequences, "SERVICE", u.serviceId),
      evidenceRequirements: oe(t.evidenceRequirements, O)
    }));
  }), t.requiredAssets.forEach((u, V) => {
    const S = I.find((O) => O.assetId === u.assetId)?.instantiatedQuantity ?? 0;
    Array.from({ length: S }, (O, x) => {
      const me = de(u.assetType, x + V, S, a, E), Ke = [u.assetId, `ASSET:${u.assetType}`, u.assetType];
      C.push(ae({
        packageId: n,
        productDoctrine: t,
        objectGroup: "REQUIRED_ASSET",
        objectType: u.assetType,
        objectSequence: ++R,
        parentObjectId: g.objectId,
        target: me,
        scopeVersionCandidateId: c,
        routeId: o,
        geometryHash: i,
        jurisdiction: d,
        requiredServices: [],
        requiredAssets: [u.assetId],
        lifecycle: u,
        executionSequence: se(t.executionSequences, "ASSET", u.assetId),
        closeSequence: ce(t.closeSequences, "ASSET", u.assetId),
        evidenceRequirements: oe(t.evidenceRequirements, Ke)
      }));
    });
  });
  const A = Tt(C), y = Ct(n, A), D = A.map((u) => u.paymentSequence), f = mt(n, a, t), _ = Nt({
    routeId: o,
    quantityPlacement: p,
    stations: a,
    targets: E
  }), P = At(_), s = Ot(n, P), l = gt(s), G = bt(n), Ce = t.engineeringObjects.filter((u) => u.engineeringObjectType === "SPINE" || Pe(u, p, a, E, r) > 0).map((u) => u.engineeringObjectType), Q = Dt(
    n,
    t,
    A,
    p,
    I,
    _,
    P,
    s,
    l,
    Ce
  );
  return {
    engineeringObjectManifest: {
      manifestId: `${n}:DOCTRINE-ENGINEERING-OBJECT-MANIFEST`,
      manifestVersion: Ze,
      packageId: n,
      productId: t.productId,
      doctrineId: t.doctrineId,
      doctrineVersion: t.doctrineVersion,
      scopeVersionCandidateId: c,
      objectCount: A.length,
      requiredServiceCount: t.requiredServices.length,
      requiredAssetCount: t.requiredAssets.length,
      engineeringObjectTypeCount: t.engineeringObjects.length,
      instantiatedObjects: A,
      dependencyGraph: y,
      executionSequence: t.executionSequences,
      closeSequence: t.closeSequences,
      paymentSequence: D,
      evidenceRequirements: t.evidenceRequirements,
      stationLifecycleRules: f,
      scopeVersionReadinessRequirements: t.scopeVersionReadinessRequirements,
      quantityPlacement: p,
      requiredAssetModel: I,
      stationObjectIndex: _,
      sequencedActionObjects: P,
      derivedSpans: s,
      linearAssetSpanAttachments: l,
      engineeringMovementPolicy: G,
      continuousStationClosure: !0,
      marketplaceProjection: {
        requiredAssetIds: I.filter((u) => u.applicability === "APPLICABLE").map((u) => u.assetId),
        requiredServiceIds: t.requiredServices.map((u) => u.serviceId),
        vendorQualifications: ["qualified OSP contractor", "fiber splicing vendor", "traffic control provider", "survey provider"],
        deliveryDatePolicy: "Delivery dates are projected after ScopeVersion work packaging.",
        procurementStatus: "PENDING_SCOPEVERSION"
      },
      controlProjection: {
        executionSequenceIds: t.executionSequences.map((u) => u.sequenceId),
        dependencyGraphId: y.graphId,
        releaseGatePolicy: "CONTROL_RELEASES_AFTER_SCOPEVERSION",
        workReleaseStatus: "BLOCKED_UNTIL_SCOPEVERSION"
      },
      fieldProjection: {
        addressedObjectIds: A.map((u) => u.objectId),
        evidenceRequirementIds: t.evidenceRequirements.map((u) => u.evidenceRequirementId),
        closurePolicy: "FIELD_CLOSES_AGAINST_ADDRESSED_OBJECTS"
      },
      twinProjection: {
        stateSequence: ["Planned", "Released", "Installed", "Inspected", "Validated", "Accepted", "Operational"],
        stateAuthority: "ACCEPTED_CLOSURES_AND_EVIDENCE"
      },
      validation: Q,
      currentState: "PLANNED",
      authority: q,
      noScopeVersionCreation: !0
    },
    instantiatedObjects: A,
    dependencyGraph: y,
    executionSequence: t.executionSequences,
    closeSequence: t.closeSequences,
    paymentSequence: D,
    evidenceRequirements: t.evidenceRequirements,
    stationLifecycleRules: f,
    quantityPlacement: p,
    requiredAssetModel: I,
    stationObjectIndex: _,
    sequencedActionObjects: P,
    derivedSpans: s,
    linearAssetSpanAttachments: l,
    engineeringMovementPolicy: G,
    validation: Q,
    summary: {
      summaryId: `${n}:DOIE:SUMMARY`,
      packageId: n,
      objectCount: A.length,
      addressCount: A.filter((u) => u.address.addressLabel).length,
      paymentSequenceCount: D.length,
      closeSequenceCount: t.closeSequences.length,
      stationLifecycleRuleCount: f.length,
      stationObjectIndexCount: _.length,
      derivedSpanCount: s.length,
      linearAssetAttachmentCount: l.length,
      status: Q.status,
      authority: q,
      noScopeVersionCreation: !0
    },
    noScopeVersionCreation: !0
  };
}
function qe(e, n = 3) {
  const t = 10 ** n;
  return Math.round(e * t) / t;
}
function ft(e, n) {
  const t = Math.max(0, Math.min(e.routeLengthFeet, n)), r = e.segments.find((a) => t >= a.cumulativeStartFeet && t <= a.cumulativeEndFeet) ?? e.segments[e.segments.length - 1], o = Math.max(1e-6, r.cumulativeEndFeet - r.cumulativeStartFeet), c = Math.max(0, Math.min(1, (t - r.cumulativeStartFeet) / o)), i = r.startCoordinate[0] + (r.endCoordinate[0] - r.startCoordinate[0]) * c, d = r.startCoordinate[1] + (r.endCoordinate[1] - r.startCoordinate[1]) * c;
  return {
    coordinate: [qe(i, 7), qe(d, 7)],
    segmentId: r.segmentId
  };
}
const te = "CLOSURE_ENGINE", De = "CLOSURE_LEDGER", ke = "IOF_PACKAGE_TWIN", Ne = [
  "COMMERCIAL_ASSEMBLED",
  "COMMERCIAL_REVIEW",
  "COMMERCIAL_APPROVED",
  "CUSTOMER_ACCEPTED",
  "SUBMITTED_TO_ENGINEERING",
  "ENGINEERING_REVIEW",
  "ENGINEERING_CERTIFIED",
  "RETURNED_TO_COMMERCIAL",
  "SERVICE_ORDER_CREATED",
  "CUSTOMER_SIGNED",
  "SCOPEVERSION_CREATED",
  "MARKETPLACE_PROJECTED",
  "MARKETPLACE_RELEASED",
  "CONTROL_READY",
  "CONTROL_RELEASED",
  "FIELD_ASSIGNED",
  "FIELD_STARTED",
  "FIELD_INSTALLED",
  "FIELD_CLOSED",
  "AS_BUILT_VERIFIED",
  "TWIN_SYNCHRONIZED",
  "OPERATIONAL",
  "MAINTAINED",
  "MODIFIED",
  "RETIRED"
], ue = {
  COMMERCIAL_ASSEMBLED: "Commercial",
  COMMERCIAL_REVIEW: "Commercial",
  COMMERCIAL_APPROVED: "Commercial",
  CUSTOMER_ACCEPTED: "Commercial",
  SUBMITTED_TO_ENGINEERING: "Engineering",
  ENGINEERING_REVIEW: "Engineering",
  ENGINEERING_CERTIFIED: "Engineering",
  RETURNED_TO_COMMERCIAL: "Commercial",
  SERVICE_ORDER_CREATED: "Commercial",
  CUSTOMER_SIGNED: "Commercial",
  SCOPEVERSION_CREATED: "ScopeVersion",
  MARKETPLACE_PROJECTED: "Marketplace",
  MARKETPLACE_RELEASED: "Marketplace",
  CONTROL_READY: "Control",
  CONTROL_RELEASED: "Control",
  FIELD_ASSIGNED: "Field",
  FIELD_STARTED: "Field",
  FIELD_INSTALLED: "Field",
  FIELD_CLOSED: "Field",
  AS_BUILT_VERIFIED: "Twin",
  TWIN_SYNCHRONIZED: "Twin",
  OPERATIONAL: "Twin",
  MAINTAINED: "Twin",
  MODIFIED: "Twin",
  RETIRED: "Twin"
}, He = {
  COMMERCIAL_ASSEMBLED: ["commercial review evidence"],
  COMMERCIAL_REVIEW: ["commercial approval evidence"],
  COMMERCIAL_APPROVED: ["customer acceptance evidence"],
  CUSTOMER_ACCEPTED: ["engineering handoff evidence"],
  SUBMITTED_TO_ENGINEERING: ["engineering intake evidence"],
  ENGINEERING_REVIEW: ["engineering certification evidence"],
  ENGINEERING_CERTIFIED: ["service order package evidence"],
  RETURNED_TO_COMMERCIAL: ["commercial revision evidence"],
  SERVICE_ORDER_CREATED: ["customer signature evidence"],
  CUSTOMER_SIGNED: ["ScopeVersion creation evidence"],
  SCOPEVERSION_CREATED: ["marketplace projection evidence"],
  MARKETPLACE_PROJECTED: ["marketplace release evidence"],
  MARKETPLACE_RELEASED: ["control readiness evidence"],
  CONTROL_READY: ["control release evidence"],
  CONTROL_RELEASED: ["field assignment evidence"],
  FIELD_ASSIGNED: ["field start evidence"],
  FIELD_STARTED: ["field installation evidence"],
  FIELD_INSTALLED: ["field close evidence"],
  FIELD_CLOSED: ["as-built verification evidence"],
  AS_BUILT_VERIFIED: ["twin synchronization evidence"],
  TWIN_SYNCHRONIZED: ["operational acceptance evidence"],
  OPERATIONAL: ["maintenance event evidence"],
  MAINTAINED: ["modification authorization evidence"],
  MODIFIED: ["retirement authorization evidence"],
  RETIRED: []
};
function _t(e, n = "UNKNOWN") {
  return (String(e ?? n).trim() || n).replace(/[^A-Za-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 96) || n;
}
function xe(e) {
  const n = Ne.indexOf(e);
  return n >= 0 ? Ne[n + 1] : void 0;
}
function Pt(e) {
  const n = xe(e);
  return n ? [{
    fromState: e,
    toState: n,
    authority: ue[n],
    requiredEvidence: He[e]
  }] : [];
}
function Le(e, n) {
  const t = n.initialState ?? "COMMERCIAL_ASSEMBLED", r = xe(t), o = ue[t], c = r ? ue[r] : void 0, i = Pt(t);
  return {
    ...e,
    currentState: t,
    currentLifecycleState: t,
    previousState: void 0,
    nextState: r,
    currentAuthority: o,
    nextAuthority: c,
    allowedTransitions: r ? [r] : [],
    requiredEvidenceForNextTransition: He[t],
    blockingDependencies: n.blockingDependencies ?? [],
    closureEventHistory: [],
    auditStatus: "OPEN",
    domainResponsibilityMatrix: ue,
    lifecycleStateMachine: {
      states: Ne,
      currentState: t,
      transitionAuthority: te
    },
    transitionRules: i,
    auditLedgerHooks: {
      closureLedgerId: n.closureLedgerId,
      transitionAuthority: te,
      closureLedgerAuthority: De
    },
    twinProjectionMetadata: {
      twinProjectionId: `${n.packageId}:TWIN:${n.entityKind.toUpperCase()}:${_t(n.entityId)}`,
      currentState: t,
      currentAuthority: o,
      projectionAuthority: ke
    }
  };
}
function jt(e, n) {
  const t = Math.max(0, Number(e.lengthFeet) || Math.max(0, Number(e.endMeasure) - Number(e.startMeasure)));
  return [
    { workType: "OPEN_TRENCH", constructionMethod: "OPEN_TRENCH", crewType: "CIVIL_CREW", laborTemplate: "LABOR:TRENCH", materialTemplate: "MATERIAL:CONDUIT", requiredEvidence: ["trench photo", "depth log"] },
    { workType: "FIBER_PULL", constructionMethod: "FIBER_PULL", crewType: "FIBER_CREW", laborTemplate: "LABOR:FIBER_PULL", materialTemplate: "MATERIAL:FIBER", requiredEvidence: ["pull ticket", "fiber reel"] },
    { workType: "TESTING", constructionMethod: "TESTING", crewType: "TEST_CREW", laborTemplate: "LABOR:TESTING", materialTemplate: "MATERIAL:TEST_EQUIPMENT", requiredEvidence: ["OTDR trace", "power meter result"] }
  ].map((o, c) => {
    const i = {
      closureSegmentId: `${e.spanId}:CLOSURE-SEGMENT:${o.workType}`,
      parentSpanId: e.spanId,
      measuredCenterlineId: e.measuredCenterlineId,
      workType: o.workType,
      startStation: e.startStation,
      endStation: e.endStation,
      startMeasure: e.startMeasure,
      endMeasure: e.endMeasure,
      length: t,
      constructionMethod: o.constructionMethod,
      crewType: o.crewType,
      laborTemplate: o.laborTemplate,
      materialTemplate: o.materialTemplate,
      requiredEvidence: o.requiredEvidence,
      closureEventIds: [],
      paymentEligibility: "NOT_ELIGIBLE_UNTIL_CLOSED",
      productionQuantity: t,
      sequence: c + 1,
      noIndependentGeometry: !0
    };
    return Le(i, {
      packageId: n.packageId,
      entityId: i.closureSegmentId,
      entityKind: "closureSegment",
      closureLedgerId: n.closureLedgerId,
      blockingDependencies: [e.spanId]
    });
  });
}
function qt(e) {
  return {
    closureLedgerId: `${e.packageId}:CLOSURE-LEDGER`,
    packageId: e.packageId,
    objectCount: e.objects.length,
    spanCount: e.spans.length,
    workSegmentCount: e.workSegments.length,
    closureEvents: [],
    authority: De,
    transitionAuthority: te,
    immutableAfterCreation: !0,
    noScopeVersionCreation: !0
  };
}
function vt(e) {
  return {
    twinProjectionId: `${e.packageId}:IOF-PACKAGE-TWIN`,
    packageId: e.packageId,
    objectCount: e.objects.length,
    spanCount: e.spans.length,
    workSegmentCount: e.workSegments.length,
    currentAuthority: ke,
    stateAuthority: te,
    closureLedgerId: e.closureLedgerId,
    executionGraphId: `${e.packageId}:EXECUTION-GRAPH`,
    lifecycleGraphId: `${e.packageId}:LIFECYCLE-GRAPH`,
    domainLenses: {
      commercial: "What was assembled, proposed, and approved?",
      engineering: "What must be verified and certified?",
      marketplace: "What must be procured, fulfilled, or released?",
      control: "What can be authorized, blocked, or released?",
      field: "What must be installed, evidenced, and closed?",
      twin: "What is current operational truth?"
    },
    noScopeVersionCreation: !0
  };
}
function Mt(e) {
  const n = e.renderedObjects.filter((i) => !!(i.materialTemplate || i.materialTemplateId)).length, t = e.renderedObjects.filter((i) => !!(i.laborTemplate || i.laborTemplateId)).length, r = e.renderedObjects.filter((i) => !!i.paymentSequenceId).length, o = e.renderedObjects.filter((i) => !!i.closeSequenceId).length, c = [
    ...e.expectedObjectCount === e.renderedObjects.length ? [] : [{
      objectClass: "PROJECTED_OBJECT",
      expectedCount: e.expectedObjectCount,
      actualCount: e.renderedObjects.length,
      blockingAuthority: "Commercial"
    }],
    ...n === e.renderedObjects.length ? [] : [{
      objectClass: "MATERIAL_TEMPLATE",
      expectedCount: e.renderedObjects.length,
      actualCount: n,
      blockingAuthority: "Commercial"
    }],
    ...t === e.renderedObjects.length ? [] : [{
      objectClass: "LABOR_TEMPLATE",
      expectedCount: e.renderedObjects.length,
      actualCount: t,
      blockingAuthority: "Commercial"
    }],
    ...r === e.renderedObjects.length ? [] : [{
      objectClass: "PAYMENT_SEQUENCE",
      expectedCount: e.renderedObjects.length,
      actualCount: r,
      blockingAuthority: "Commercial"
    }],
    ...o === e.renderedObjects.length ? [] : [{
      objectClass: "CLOSE_SEQUENCE",
      expectedCount: e.renderedObjects.length,
      actualCount: o,
      blockingAuthority: "Commercial"
    }]
  ];
  return {
    reconciliationId: `${e.packageId}:COMMERCIAL-AUDIT-RECONCILIATION`,
    status: c.length ? "FAIL" : "PASS",
    expectedObjectCount: e.expectedObjectCount,
    renderedObjectCount: e.renderedObjects.length,
    expectedMaterialObjects: e.renderedObjects.length,
    renderedMaterialObjects: n,
    expectedLaborObjects: e.renderedObjects.length,
    renderedLaborObjects: t,
    stationCount: e.stationCount,
    spanCount: e.renderedSpans.length,
    paymentSequenceCount: r,
    closeSequenceCount: o,
    failures: c,
    authority: "COMMERCIAL_AUDIT_RECONCILIATION"
  };
}
function Gt(e) {
  const n = [
    ...e.objects.filter((t) => !t.currentState).map((t) => `object lifecycle missing: ${t.objectId}`),
    ...e.spans.filter((t) => !t.currentState).map((t) => `span lifecycle missing: ${t.spanId}`),
    ...e.objects.filter((t) => !t.currentAuthority).map((t) => `object authority missing: ${t.objectId}`),
    ...e.spans.filter((t) => !t.currentAuthority).map((t) => `span authority missing: ${t.spanId}`),
    ...e.objects.filter((t) => !Array.isArray(t.allowedTransitions)).map((t) => `object allowed transitions missing: ${t.objectId}`),
    ...e.spans.filter((t) => !Array.isArray(t.allowedTransitions)).map((t) => `span allowed transitions missing: ${t.spanId}`),
    ...e.objects.filter((t) => !t.auditLedgerHooks).map((t) => `object audit hooks missing: ${t.objectId}`),
    ...e.spans.filter((t) => !t.auditLedgerHooks).map((t) => `span audit hooks missing: ${t.spanId}`),
    ...e.workSegments.filter((t) => !t.parentSpanId || !t.measuredCenterlineId).map((t) => `closure segment reference missing: ${t.closureSegmentId}`),
    ...e.commercialAudit.status === "PASS" ? [] : ["commercial audit reconciliation failed"],
    ...e.geometryAuthorityStatus === "PASS" ? [] : ["geometry authority is not PASS"]
  ];
  return {
    validationId: "CONSTITUTIONAL-STATE-AUTHORITY-VALIDATION",
    status: n.length ? "FAIL" : "PASS",
    objectCount: e.objects.length,
    spanCount: e.spans.length,
    workSegmentCount: e.workSegments.length,
    failures: n,
    transitionAuthority: te,
    closureLedgerAuthority: De
  };
}
const b = "DOCTRINE_PROJECTION_ENGINE", Ft = "37.0", Te = [
  "CONDUIT",
  "FIBER",
  "TRACE_WIRE",
  "WARNING_TAPE",
  "MULE_TAPE_PULL_TAPE"
];
function Z(e, n = "UNKNOWN") {
  return (String(e ?? n).trim() || n).replace(/[^A-Za-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 96) || n;
}
function Ae(e, n = 0) {
  const t = Number(e);
  return Number.isFinite(t) ? t : n;
}
function B(e, n = 0) {
  return Math.max(0, Math.round(Ae(e, n)));
}
function Oe(e) {
  const n = Math.max(0, Math.round(e));
  return `${Math.floor(n / 100)}+${String(n % 100).padStart(2, "0")}`;
}
function Ut(e, n) {
  return e.stations.reduce((t, r) => Math.abs(r.measureFeet - n) < Math.abs(t.measureFeet - n) ? r : t, e.stations[0]);
}
function Be(e) {
  return new Set(e.filter(Boolean)).size;
}
function Se(e) {
  return Math.max(0, e.filter(Boolean).length - Be(e));
}
function Vt(e) {
  return e.quantityPlacement;
}
function ve(e, ...n) {
  const t = n.map((r) => r.toUpperCase());
  return (e.instantiatedObjects ?? []).filter((r) => {
    const o = String(r.objectType ?? r.doctrineObjectType ?? "").toUpperCase();
    return t.some((c) => o.includes(c));
  }).length;
}
function we(e, n) {
  const t = [
    {
      objectType: "HANDHOLE",
      doctrineObjectType: "HANDHOLE",
      prefix: "HH",
      count: B(e.handholeCount),
      doctrineQuantitySource: "productDoctrineAssembly.structureAssembly.structures[HANDHOLE].quantity",
      placementReason: "Handhole count from Product Doctrine structure quantity."
    },
    {
      objectType: "VAULT",
      doctrineObjectType: "VAULT",
      prefix: "VAULT",
      count: B(e.vaultCount),
      doctrineQuantitySource: "productDoctrineAssembly.structureAssembly.structures[VAULT].quantity",
      placementReason: "Vault count from Product Doctrine structure quantity."
    },
    {
      objectType: "SPLICE_CASE",
      doctrineObjectType: "SPLICE_CASE",
      prefix: "SPLICE",
      count: B(e.spliceCaseCount),
      doctrineQuantitySource: "productDoctrineAssembly.structureAssembly.structures[SPLICE_CASE].quantity",
      placementReason: "Splice case count from Product Doctrine structure quantity."
    },
    {
      objectType: "ILA_REGENERATION_SITE",
      doctrineObjectType: "ILA_REGENERATION_SITE",
      prefix: "ILA",
      count: B(e.ilaRegenCount),
      doctrineQuantitySource: "productDoctrineAssembly.structureAssembly.structures[ILA|REGENERATION].quantity",
      placementReason: "ILA/regeneration count from Product Doctrine structure quantity."
    },
    {
      objectType: "MARKER_POST",
      doctrineObjectType: "MARKER_POST",
      prefix: "MARKER",
      count: B(e.markerCount),
      doctrineQuantitySource: "productDoctrineAssembly.quantitySummary.routeMiles marker placement assumption",
      placementReason: "Marker count from Product Doctrine route placement assumption."
    },
    {
      objectType: "SLACK_LOOP",
      doctrineObjectType: "SLACK_LOOP",
      prefix: "SLACK",
      count: B(e.slackLoopCount),
      doctrineQuantitySource: "productDoctrineAssembly.quantitySummary.routeMiles slack placement assumption",
      placementReason: "Slack loop count from Product Doctrine route placement assumption."
    }
  ], r = ve(n, "CROSSING");
  r > 0 && t.push({
    objectType: "CROSSING",
    doctrineObjectType: "CROSSING",
    prefix: "CROSSING",
    count: r,
    doctrineQuantitySource: "doctrineObjectManifest.instantiatedObjects[CROSSING].length",
    placementReason: "Crossing count from existing Doctrine Object Manifest."
  });
  const o = ve(n, "TERMINATION");
  return o > 0 && t.push({
    objectType: "TERMINATION_POINT",
    doctrineObjectType: "TERMINATION_POINT",
    prefix: "TERM",
    count: o,
    doctrineQuantitySource: "doctrineObjectManifest.instantiatedObjects[TERMINATION_POINT].length",
    placementReason: "Termination count from existing Doctrine Object Manifest."
  }), t;
}
function $t(e, n, t) {
  return n <= 0 || e <= 0 ? 0 : Math.min(e, Math.max(0, e / n * (t + 1)));
}
function kt(e, n, t) {
  return `${e}:SPAN:${Z(n)}:${String(t).padStart(3, "0")}`;
}
function Ht(e) {
  const n = $t(e.routeFeet, e.seed.count, e.seedIndex), t = ft(e.measuredSpine, n), r = Ut(e.stationAuthority, n), o = t.coordinate, c = Oe(n), i = `${e.seed.prefix}-${String(e.seedIndex + 1).padStart(3, "0")}`, d = kt(e.routeRepositoryId, e.seed.objectType, e.seedIndex + 1), a = e.seedIndex + 1, E = {
    addressId: `${i}:DOCTRINE-PROJECTION-ADDRESS`,
    routeId: e.routeRepositoryId,
    segmentId: t.segmentId,
    objectId: i,
    objectType: e.seed.objectType,
    addressType: "POINT",
    addressStatus: "ASSIGNED",
    objectSequence: a,
    stationId: r.stationId,
    stationValue: Math.round(n),
    stationAddress: c,
    latitude: o[1],
    longitude: o[0],
    geometryHash: e.geometryHash,
    addressLabel: `${i} ${c} ${o[1].toFixed(6)}, ${o[0].toFixed(6)}`,
    addressAuthority: b,
    noScopeVersionCreation: !0
  }, p = {
    objectId: i,
    objectType: e.seed.objectType,
    doctrineObjectType: e.seed.doctrineObjectType,
    objectSequence: a,
    measure: n,
    stationAddress: c,
    stationId: r.stationId,
    stationSequence: e.globalIndex + 1,
    stationFeet: n,
    coordinate: o,
    geographicCoordinate: o,
    latitude: o[1],
    longitude: o[0],
    parentSpanId: d,
    parentRouteId: e.routeRepositoryId,
    parentSegmentId: t.segmentId,
    routeId: e.routeRepositoryId,
    segmentId: t.segmentId,
    address: E,
    placementAuthority: b,
    projectionAuthority: b,
    engineeringAuthority: b,
    coordinateAuthority: "MEASURED_CENTERLINE",
    placementReason: e.seed.placementReason,
    doctrineQuantitySource: e.seed.doctrineQuantitySource,
    executionSequenceId: `${i}:EXECUTION-SEQUENCE`,
    closeSequenceId: `${i}:CLOSE-SEQUENCE`,
    paymentSequenceId: `${i}:PAYMENT-SEQUENCE`,
    laborTemplate: `LABOR:${e.seed.objectType}`,
    materialTemplate: `MATERIAL:${e.seed.objectType}`,
    evidenceTemplate: `EVIDENCE:${e.seed.objectType}`,
    dependencyList: [e.routeRepositoryId, d],
    evidenceRequirements: [`EVIDENCE:${e.seed.objectType}:PLACEMENT`, `EVIDENCE:${e.seed.objectType}:CLOSE`],
    currentLifecycleState: "COMMERCIAL_ASSEMBLED",
    sourceDoctrineObjectId: i,
    sourceObject: {
      objectId: i,
      objectType: e.seed.objectType,
      doctrineQuantitySource: e.seed.doctrineQuantitySource,
      nominalIntervalFeet: e.routeFeet / Math.max(1, e.seed.count),
      placementAuthority: b
    },
    noScopeVersionCreation: !0
  };
  return Le(p, {
    packageId: e.packageId,
    entityId: i,
    entityKind: "object",
    closureLedgerId: e.closureLedgerId,
    blockingDependencies: [e.routeRepositoryId, d]
  });
}
function xt(e) {
  const n = Ae(e.measuredSpine.routeLengthFeet, Ae(e.quantityPlacement.routeFeet)), t = e.measuredSpine.geometryHash, r = we(e.quantityPlacement, e.doctrineObjectManifest), o = r.map((i) => ({
    seed: i,
    nominalIntervalFeet: i.count > 0 ? n / i.count : 0,
    objects: Array.from({ length: i.count }, (d, a) => Ht({
      packageId: e.packageId,
      closureLedgerId: e.closureLedgerId,
      seed: i,
      seedIndex: a,
      globalIndex: 0,
      routeFeet: n,
      measuredSpine: e.measuredSpine,
      stationAuthority: e.stationAuthority,
      routeRepositoryId: e.routeRepositoryId,
      geometryHash: t
    }))
  })), c = o.flatMap((i) => i.objects).sort((i, d) => i.stationFeet - d.stationFeet || i.objectId.localeCompare(d.objectId)).map((i, d) => ({
    ...i,
    stationSequence: d + 1
  }));
  return { seeds: r, byType: o, projectedObjects: c, routeFeet: n };
}
function Me(e) {
  const n = e.toUpperCase();
  return n.includes("HANDHOLE") ? "HH" : n.includes("VAULT") ? "VAULT" : n.includes("SPLICE") ? "SPLICE" : n.includes("ILA") || n.includes("REGEN") ? "ILA" : n.includes("MARKER") ? "MARKER" : n.includes("SLACK") ? "SLACK" : "STRUCTURE";
}
function Bt(e, n, t, r) {
  return r.slice(0, -1).map((o, c) => {
    const i = r[c + 1], d = o.stationFeet <= i.stationFeet ? o : i, a = o.stationFeet <= i.stationFeet ? i : o, E = `${e}:DOCTRINE-PROJECTION:SPAN:${String(c + 1).padStart(5, "0")}`, p = {
      spanId: `${e}:DOCTRINE-PROJECTION:SPAN:${String(c + 1).padStart(5, "0")}`,
      spanType: `${Me(o.objectType)}_TO_${Me(i.objectType)}`,
      measuredCenterlineId: n,
      startMeasure: d.measure,
      endMeasure: a.measure,
      startObjectId: d.objectId,
      endObjectId: a.objectId,
      startStation: d.stationAddress,
      endStation: a.stationAddress,
      startStationFeet: d.stationFeet,
      endStationFeet: a.stationFeet,
      lengthFeet: Math.max(0, a.stationFeet - d.stationFeet),
      containedAssets: [...Te],
      dependencies: [d.objectId, a.objectId],
      lifecycleState: "COMMERCIAL_ASSEMBLED",
      laborTemplate: "LABOR:ASSET_SPAN",
      materialTemplate: "MATERIAL:LINEAR_ASSETS",
      evidenceTemplate: "EVIDENCE:SPAN_CLOSE",
      executionSequenceId: `${E}:EXECUTION-SEQUENCE`,
      closeSequenceId: `${E}:CLOSE-SEQUENCE`,
      paymentSequenceId: `${E}:PAYMENT-SEQUENCE`,
      requiredEvidence: ["span placement evidence", "linear asset closure evidence"],
      closureSegments: [],
      openClosureSegments: [],
      closedClosureSegments: [],
      percentComplete: 0,
      blockedStationRanges: [],
      nextClosableSegment: void 0,
      placementAuthority: b,
      renderAuthority: "MEASURED_CENTERLINE_CLIP",
      independentGeometryProhibited: !0,
      fullSpineViewOnly: !0,
      noScopeVersionCreation: !0
    }, I = jt(p, { packageId: e, closureLedgerId: t });
    return Le({
      ...p,
      closureSegments: I,
      openClosureSegments: I.map((C) => C.closureSegmentId),
      closedClosureSegments: [],
      nextClosableSegment: I[0]?.closureSegmentId
    }, {
      packageId: e,
      entityId: E,
      entityKind: "span",
      closureLedgerId: t,
      blockingDependencies: [d.objectId, a.objectId]
    });
  });
}
function wt(e) {
  return e.flatMap((n) => Te.map((t) => ({
    attachmentId: `${n.spanId}:ASSET:${t}`,
    spanId: n.spanId,
    assetType: t,
    fromObjectId: n.startObjectId,
    toObjectId: n.endObjectId,
    stationStart: n.startStation,
    stationEnd: n.endStation,
    routeFeet: n.lengthFeet,
    doctrineQuantitySource: t === "CONDUIT" ? "productDoctrineAssembly.quantitySummary.conduitFeet" : t === "FIBER" ? "productDoctrineAssembly.quantitySummary.fiberFeet" : `Product Doctrine ${t} full-spine placement assumption`,
    placementAuthority: b,
    noScopeVersionCreation: !0
  })));
}
function Wt(e) {
  return Te.map((n) => ({
    assetType: n,
    stationStart: Oe(0),
    stationEnd: Oe(e),
    routeFeet: e,
    coverageAuthority: b
  }));
}
function Yt(e) {
  const n = Se(e.projectedObjects.map((t) => t.objectId));
  return e.byType.map(({ seed: t, nominalIntervalFeet: r, objects: o }) => {
    const c = Se(o.map((a) => a.stationAddress)), i = [
      {
        gate: "Math Present",
        status: e.routeFeet > 0 && t.count >= 0 && Number.isFinite(r) ? "PASS" : "FAIL",
        reason: e.routeFeet <= 0 ? "missing route feet" : Number.isFinite(r) ? "route feet and doctrine quantity present" : "missing doctrine quantity"
      },
      {
        gate: "Objects Calculated",
        status: o.length === t.count ? "PASS" : "FAIL",
        reason: o.length === t.count ? `Objects Calculated: ${o.length}` : `math count does not match doctrine quantity: ${o.length}/${t.count}`
      },
      {
        gate: "Addresses Assigned",
        status: o.every((a) => a.stationAddress) && c === 0 ? "PASS" : "FAIL",
        reason: o.every((a) => a.stationAddress) ? c > 0 ? "duplicate station" : "station addresses assigned" : "object lacks address"
      },
      {
        gate: "Objects Projected",
        status: o.every((a) => a.coordinate && a.stationId) && e.stationAuthorityIds.length > 0 && e.stationProjectionId && e.stationGraphId && e.projectedObjectManifestId && n === 0 ? "PASS" : "FAIL",
        reason: !e.stationProjectionId || !e.stationGraphId || !e.projectedObjectManifestId ? "projection ID missing" : n > 0 ? "duplicate object ID" : o.some((a) => !a.stationId) ? "station not resolved" : o.some((a) => !a.coordinate) ? "coordinate not resolved" : "objects projected"
      }
    ], d = i.filter((a) => a.status === "FAIL").map((a) => `${a.gate}: ${a.reason}`);
    return {
      objectType: t.objectType,
      doctrineQuantitySource: t.doctrineQuantitySource,
      routeFeet: Math.round(e.routeFeet),
      stationCount: e.stationCount,
      objectCount: t.count,
      nominalIntervalFeet: Math.round(r),
      calculatedStations: o.map((a) => a.stationAddress),
      resolvedCoordinates: o.map((a) => ({
        objectId: a.objectId,
        stationAddress: a.stationAddress,
        latitude: a.latitude,
        longitude: a.longitude
      })),
      placementAuthority: b,
      projectionResult: d.length ? "FAIL" : "PASS",
      gates: i,
      failureReasons: d
    };
  });
}
function Jt(e) {
  const n = e.projectedObjects.filter((i) => i.objectId.includes("ROUTE-CENTERLINE") || i.objectType === "PROJECTED_IOF_OBJECT" || i.objectType === "AUDIT_OBJECT").length, t = Se(e.projectedObjects.map((i) => i.objectId)), r = e.diagnostics.objectTypes.reduce((i, d) => i + (d.gates.some((a) => a.reason === "duplicate station") ? 1 : 0), 0), o = e.projectedSpans.reduce((i, d) => {
    const a = new Set(e.linearAssetSpanAttachments.filter((E) => E.spanId === d.spanId).map((E) => E.assetType));
    return i + Te.filter((E) => !a.has(E)).length;
  }, 0), c = [
    ...e.expectedObjectCount <= 0 ? ["zero object count"] : [],
    ...e.projectedObjects.length !== e.expectedObjectCount ? [`math count does not match doctrine quantity: ${e.projectedObjects.length}/${e.expectedObjectCount}`] : [],
    ...e.projectedObjects.filter((i) => !i.stationAddress).map((i) => `object lacks address: ${i.objectId}`),
    ...e.projectedObjects.filter((i) => !i.coordinate).map((i) => `coordinate not resolved: ${i.objectId}`),
    ...e.projectedObjects.filter((i) => !i.stationId).map((i) => `station not resolved: ${i.objectId}`),
    ...e.projectedObjects.filter((i) => !i.parentSpanId).map((i) => `Projected object ${i.objectId} is missing parent span.`),
    ...e.projectedObjects.filter((i) => !i.executionSequenceId).map((i) => `Projected object ${i.objectId} is missing execution sequence.`),
    ...e.projectedObjects.filter((i) => !i.closeSequenceId).map((i) => `Projected object ${i.objectId} is missing close sequence.`),
    ...e.projectedObjects.filter((i) => !i.paymentSequenceId).map((i) => `Projected object ${i.objectId} is missing payment sequence.`),
    ...e.projectedSpans.filter((i) => !i.startStation || !i.endStation || i.lengthFeet < 0 || !Number.isFinite(i.startMeasure) || !Number.isFinite(i.endMeasure) || !i.measuredCenterlineId).map((i) => `span cannot be derived: ${i.spanId}`),
    ...o ? [`required linear assets are not attached: ${o}`] : [],
    ...e.diagnostics.geometryAuthorityDiagnostics.failures,
    ...e.stationAuthorityIds.length ? [] : ["station not resolved: Station Authority IDs are missing."],
    ...t ? [`duplicate object ID: ${t}`] : [],
    ...r ? [`duplicate station: ${r}`] : [],
    ...n ? [`Projected manifest contains ${n} placeholder or synthetic audit object(s).`] : [],
    ...e.diagnostics.failedGates.map((i) => `${i.objectType} ${i.gate}: ${i.reason}`)
  ];
  return {
    validationId: `${e.packageId}:DOCTRINE-PROJECTION:VALIDATION`,
    status: c.length ? "FAIL" : "PASS",
    projectedObjectCount: e.projectedObjects.length,
    expectedObjectCount: e.expectedObjectCount,
    doctrineObjectCount: e.manifest.instantiatedObjects.length,
    stationAuthorityCount: e.stationAuthorityIds.length,
    missingStationAddressCount: e.projectedObjects.filter((i) => !i.stationAddress).length,
    missingCoordinateCount: e.projectedObjects.filter((i) => !i.coordinate).length,
    missingStationAuthorityCount: e.projectedObjects.filter((i) => !i.stationId).length,
    missingParentSpanCount: e.projectedObjects.filter((i) => !i.parentSpanId).length,
    missingExecutionSequenceCount: e.projectedObjects.filter((i) => !i.executionSequenceId).length,
    missingCloseSequenceCount: e.projectedObjects.filter((i) => !i.closeSequenceId).length,
    missingPaymentSequenceCount: e.projectedObjects.filter((i) => !i.paymentSequenceId).length,
    invalidSpanCount: e.projectedSpans.filter((i) => !i.startStation || !i.endStation || i.lengthFeet < 0 || !Number.isFinite(i.startMeasure) || !Number.isFinite(i.endMeasure) || !i.measuredCenterlineId).length,
    missingLinearAssetAttachmentCount: o,
    duplicateObjectIdCount: t,
    duplicateStationCount: r,
    placeholderObjectCount: n,
    failures: c,
    authority: b,
    noScopeVersionCreation: !0
  };
}
function Qt(e) {
  const n = Se(e.projectedSpans.map((d) => d.measuredCenterlineId)) > 0 ? Be(e.projectedSpans.map((d) => d.measuredCenterlineId)) - 1 : 0, t = e.projectedSpans.filter((d) => Array.isArray(d.coordinates)).length, r = t, o = e.projectedObjects.filter((d) => d.coordinateAuthority === "MEASURED_CENTERLINE" && Number.isFinite(d.measure)).length, c = [
    ...e.measuredCenterlineId ? [] : ["Measured Centerline ID missing."],
    ...n ? [`Duplicate measured centerline detected: ${n}`] : [],
    ...t ? [`Span contains independent geometry: ${t}`] : [],
    ...o !== e.projectedObjects.length ? [`Object not on measured spine: ${o}/${e.projectedObjects.length}`] : []
  ], i = c.length ? "FAIL" : "PASS";
  return {
    diagnosticsId: `${e.packageId}:GEOMETRY-AUTHORITY:DIAGNOSTICS`,
    status: i,
    geometryAuthority: i,
    measuredCenterlineId: e.measuredCenterlineId,
    geometryHash: e.geometryHash,
    duplicateMeasuredCenterlineCount: n,
    independentGeometryCount: r,
    projectedObjectCount: e.projectedObjects.length,
    projectedSpanCount: e.projectedSpans.length,
    objectsOnSpine: o,
    objectsOnSpineTotal: e.projectedObjects.length,
    maximumDriftFeet: 0,
    independentSpanGeometryCount: t,
    commercialRenderValidation: i,
    engineeringRenderValidation: i,
    fieldRenderValidation: i,
    twinRenderValidation: i,
    failures: c,
    authority: "MEASURED_CENTERLINE",
    noScopeVersionCreation: !0
  };
}
function Kt(e) {
  const n = Vt(e.doctrineObjectManifest), t = `${e.packageId}:DOCTRINE-STATION-PROJECTION:${Z(e.measuredSpine.geometryHash)}`, r = `${e.packageId}:MEASURED-CENTERLINE:${Z(e.measuredSpine.geometryHash)}`, o = `${e.packageId}:DOCTRINE-STATION-GRAPH:${Z(e.measuredSpine.geometryHash)}`, c = `${e.packageId}:DOCTRINE-PROJECTED-OBJECT-MANIFEST`, i = `${e.packageId}:CLOSURE-LEDGER`, d = `${e.packageId}:EXECUTION-GRAPH`, a = `${e.packageId}:LIFECYCLE-GRAPH`, E = [e.stationAuthority.authorityId].filter(Boolean), { byType: p, projectedObjects: I, routeFeet: C } = xt({
    packageId: e.packageId,
    closureLedgerId: i,
    quantityPlacement: n,
    doctrineObjectManifest: e.doctrineObjectManifest,
    measuredSpine: e.measuredSpine,
    stationAuthority: e.stationAuthority,
    routeRepositoryId: e.routeRepositoryId
  }), R = we(n, e.doctrineObjectManifest).reduce((S, O) => S + O.count, 0), T = Bt(e.packageId, r, i, I), m = T.flatMap((S) => S.closureSegments), h = wt(T), g = I.map((S) => S.address), A = Mt({
    packageId: e.packageId,
    expectedObjectCount: R,
    renderedObjects: I,
    renderedSpans: T,
    stationCount: e.stationAuthority.stations.length
  }), y = qt({
    packageId: e.packageId,
    objects: I,
    spans: T,
    workSegments: m
  }), D = vt({
    packageId: e.packageId,
    objects: I,
    spans: T,
    workSegments: m,
    closureLedgerId: y.closureLedgerId
  }), f = Yt({
    byType: p,
    routeFeet: C,
    stationCount: e.stationAuthority.stations.length,
    projectedObjects: I,
    stationAuthorityIds: E,
    stationProjectionId: t,
    stationGraphId: o,
    projectedObjectManifestId: c
  }), _ = f.flatMap((S) => S.gates.filter((O) => O.status === "FAIL").map((O) => ({ objectType: S.objectType, gate: O.gate, reason: O.reason }))), P = Qt({
    packageId: e.packageId,
    measuredCenterlineId: r,
    geometryHash: e.measuredSpine.geometryHash,
    projectedObjects: I,
    projectedSpans: T
  }), s = {
    diagnosticsId: `${e.packageId}:DOCTRINE-PROJECTION:DIAGNOSTICS`,
    status: _.length ? "FAIL" : "PASS",
    routeFeet: Math.round(C),
    stationCount: e.stationAuthority.stations.length,
    expectedObjectCount: R,
    projectedObjectCount: I.length,
    derivedSpanCount: T.length,
    linearAssetAttachmentCount: h.length,
    failedGates: _,
    objectTypes: f,
    geometryAuthorityDiagnostics: P,
    authority: b,
    noPricingChange: !0,
    noScopeVersionCreation: !0
  }, l = Jt({
    packageId: e.packageId,
    expectedObjectCount: R,
    manifest: e.doctrineObjectManifest,
    projectedObjects: I,
    projectedSpans: T,
    linearAssetSpanAttachments: h,
    stationAuthorityIds: E,
    diagnostics: s
  }), G = Gt({
    objects: I,
    spans: T,
    workSegments: m,
    commercialAudit: A,
    geometryAuthorityStatus: P.status
  }), Ce = {
    stationProjectionId: t,
    packageId: e.packageId,
    productDoctrineId: e.productDoctrine.doctrineId,
    doctrineObjectManifestId: e.doctrineObjectManifest.manifestId,
    measuredCenterlineId: r,
    stationGraphId: o,
    stationAuthorityIds: E,
    routeRepositoryId: e.routeRepositoryId,
    routeGeometryId: e.routeGeometryId,
    geometryHash: e.measuredSpine.geometryHash,
    objectCount: I.length,
    spanCount: T.length,
    stationCount: e.stationAuthority.stations.length,
    stations: e.stationAuthority.stations.map((S) => ({
      stationId: S.stationId,
      stationAddress: S.stationLabel,
      measuredDistanceFeet: S.measureFeet,
      coordinate: S.coordinate,
      geometryReference: e.routeGeometryId ?? e.measuredSpine.sourceGeometryRef,
      authority: "STATION_AUTHORITY"
    })),
    authority: b,
    noScopeVersionCreation: !0
  }, Q = I.reduce((S, O) => {
    const x = S.get(O.stationId) ?? [];
    return x.push(O.objectId), S.set(O.stationId, x), S;
  }, /* @__PURE__ */ new Map()), fe = {
    ...e.stationIndexedGraph,
    graphId: o,
    stationGraphId: o,
    previousNextStationReferences: e.stationAuthority.stations.map((S, O) => ({
      stationId: S.stationId,
      previousStationId: e.stationAuthority.stations[O - 1]?.stationId,
      nextStationId: e.stationAuthority.stations[O + 1]?.stationId,
      objectReferences: Q.get(S.stationId) ?? []
    })),
    engineeringSpans: T,
    projectionAuthority: b
  }, u = {
    manifestId: c,
    projectedObjectManifestId: c,
    packageId: e.packageId,
    productDoctrineId: e.productDoctrine.doctrineId,
    doctrineObjectManifestId: e.doctrineObjectManifest.manifestId,
    stationProjectionId: t,
    stationGraphId: o,
    stationAuthorityIds: E,
    objectCount: I.length,
    expectedObjectCount: R,
    projectedObjects: I,
    objectAddresses: g,
    spanCount: T.length,
    projectedSpans: T,
    geometryAuthorityDiagnostics: P,
    commercialAuditReconciliation: A,
    constitutionalStateValidation: G,
    executionGraphId: d,
    lifecycleGraphId: a,
    closureLedgerId: y.closureLedgerId,
    iofPackageTwinId: D.twinProjectionId,
    closureLedger: y,
    iofPackageTwin: D,
    workSegments: m,
    linearAssetSpanAttachments: h,
    linearAssetStationRanges: Wt(C),
    materializationAuthority: b,
    placeholderObjectsProhibited: !0,
    syntheticAuditObjectsProhibited: !0,
    noScopeVersionCreation: !0
  }, V = I.map((S) => ({
    attachmentId: `${e.packageId}:DOCTRINE-PROJECTION:ATTACH:${Z(S.objectId)}`,
    objectId: S.objectId,
    objectType: S.objectType,
    stationId: S.stationId,
    stationValue: S.stationFeet,
    stationAddress: S.stationAddress,
    projectedCoordinate: S.coordinate,
    coordinate: S.coordinate,
    parentSpanId: S.parentSpanId,
    routeRepositoryId: e.routeRepositoryId,
    attachmentMethod: "DOCTRINE_PROJECTION_ENGINE",
    attachmentStatus: "ASSIGNED",
    projectionAuthority: b,
    engineeringAuthority: b,
    noScopeVersionCreation: !0
  }));
  return {
    projectionId: t,
    packageId: e.packageId,
    doctrineProjectionVersion: Ft,
    productDoctrineId: e.productDoctrine.doctrineId,
    doctrineObjectManifestId: e.doctrineObjectManifest.manifestId,
    projectedObjectManifestId: c,
    measuredCenterline: {
      measuredCenterlineId: r,
      measuredSpineId: e.measuredSpine.spineId,
      spineId: e.measuredSpine.spineId,
      routeRepositoryId: e.routeRepositoryId,
      routeGeometryId: e.routeGeometryId,
      geometryHash: e.measuredSpine.geometryHash,
      routeFeet: e.measuredSpine.routeLengthFeet,
      routeMiles: e.measuredSpine.routeLengthMiles,
      routeLengthFeet: e.measuredSpine.routeLengthFeet,
      routeLengthMiles: e.measuredSpine.routeLengthMiles,
      coordinateCount: e.measuredSpine.coordinateCount,
      segments: e.measuredSpine.segments,
      cumulativeMeasureIndex: e.measuredSpine.cumulativeMeasureIndex,
      sourceGeometryRef: e.measuredSpine.sourceGeometryRef,
      authority: "MEASURED_SPINE_AUTHORITY",
      geometryAuthority: "MEASURED_CENTERLINE",
      singleGeometryAuthority: !0,
      projectionAuthority: b,
      noScopeVersionCreation: !0
    },
    stationProjection: Ce,
    stationGraph: fe,
    stationAuthorities: [e.stationAuthority],
    stationAuthorityIds: E,
    projectedObjectManifest: u,
    stationObjectManifest: u,
    projectedObjects: I,
    projectedSpans: T,
    objectAddresses: g,
    geometryAuthorityDiagnostics: P,
    commercialAuditReconciliation: A,
    constitutionalStateValidation: G,
    executionGraphId: d,
    lifecycleGraphId: a,
    closureLedgerId: y.closureLedgerId,
    iofPackageTwinId: D.twinProjectionId,
    closureLedger: y,
    iofPackageTwin: D,
    workSegments: m,
    objectStationAttachments: V,
    doctrineProjectionDiagnostics: s,
    validation: l,
    summary: {
      summaryId: `${e.packageId}:DOCTRINE-PROJECTION:SUMMARY`,
      status: l.status,
      objectCount: I.length,
      expectedObjectCount: R,
      spanCount: T.length,
      stationCount: e.stationAuthority.stations.length,
      authority: b,
      noScopeVersionCreation: !0
    },
    noScopeVersionCreation: !0
  };
}
const j = "POINT_TO_POINT_LONG_HAUL_CONDUIT_FIBER", U = "DOCTRINE-L1-POINT-TO-POINT-LONG-HAUL-CONDUIT-FIBER", We = "19B.1.0", ne = "20C.1.0", Ye = "81c488a6d4bd35183e35eabf1a1c533e53a7c700d38db5d5bf67e8c2b3883bdd", Je = "Separate Product Doctrine requirements from Project Configuration, source evidence, estimating assumptions, Commercial Policy, and Engineering authority; remove mileage-generated infrastructure.", zt = "Point-to-Point Duct & Dark Fiber", Zt = "Point-to-Point Long-Haul Conduit & Fiber", Xt = [
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
], en = [
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
function tn(e = {}) {
  return {
    lifecycleStates: Xt,
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
function nn(e = {}) {
  return {
    lifecycleStates: en,
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
function rn(e = {}) {
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
function L(e, n, t, r = {}) {
  return {
    serviceId: e,
    serviceName: n,
    serviceType: t,
    serviceVsAssetRule: "SERVICE_NOT_ASSET",
    consumes: ["LABOR", "EQUIPMENT", "SUBCONTRACTOR", "PROFESSIONAL_EFFORT"],
    stationLevelProjection: !0,
    ...tn(r)
  };
}
function v(e, n, t, r = {}) {
  return {
    assetId: e,
    assetName: n,
    assetType: t,
    tangibleInfrastructure: !0,
    representedInTwin: !0,
    ...nn(r)
  };
}
function M(e, n, t, r, o = !0, c = {}) {
  return {
    engineeringObjectType: e,
    label: n,
    stationLevelProjection: o,
    requiredServiceIds: t,
    requiredAssetIds: r,
    ...rn(c)
  };
}
function Ee(e, n, t) {
  return {
    sequenceId: `${U}:EXECUTION:${e}:${n}`,
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
function Re(e, n, t) {
  return {
    ...Ee(e, n, t),
    closeSequenceId: `${U}:CLOSE:${e}:${n}`,
    closeStates: t.lifecycleStates.slice(Math.max(0, t.lifecycleStates.length - 5)),
    closeEligibility: t.acceptanceCriteria,
    paymentEligibility: [t.billableTrigger, t.paymentTrigger]
  };
}
const Qe = {
  alias: "PD-001",
  canonicalDoctrineId: U,
  productId: j,
  businessProductName: zt,
  technicalDoctrineName: Zt,
  doctrineVersion: ne,
  active: !0
}, Y = [
  L("SERVICE:ENGINEERING", "engineering", "PROFESSIONAL_ENGINEERING", {
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
  L("SERVICE:SURVEY", "survey", "FIELD_SURVEY", {
    responsibleRole: "SURVEY",
    requiredEvidence: ["survey control", "GPS station evidence", "field notes"],
    acceptanceCriteria: ["A/Z and station evidence captured", "survey exceptions documented", "engineering acceptance recorded"]
  }),
  L("SERVICE:PERMITTING", "permitting", "PERMITTING", {
    responsibleRole: "PERMITTING",
    lifecycleStates: ["DEFINED", "JURISDICTIONS_IDENTIFIED", "SUBMITTED", "APPROVED", "RELEASED", "CLOSED"],
    releaseGates: ["jurisdiction identified", "permit approval received"],
    blockedReasons: ["permit not approved", "jurisdiction unknown", "permit condition unresolved"],
    requiredEvidence: ["permit approval", "permit conditions", "release authorization"],
    acceptanceCriteria: ["permit approved for station range", "permit conditions attached to release gates"]
  }),
  L("SERVICE:UTILITY-LOCATE", "utility locate", "UTILITY_LOCATE", {
    responsibleRole: "CONSTRUCTION",
    lifecycleStates: ["DEFINED", "TICKET_CREATED", "LOCATE_SCHEDULED", "LOCATE_COMPLETE", "VALID_WINDOW_ACTIVE", "CLOSED"],
    releaseGates: ["valid locate ticket", "locate complete"],
    blockedReasons: ["locate incomplete", "ticket expired", "utility conflict unresolved"],
    requiredEvidence: ["locate ticket", "locate completion evidence", "conflict notes"],
    acceptanceCriteria: ["valid locate window active", "conflicts documented"]
  }),
  L("SERVICE:TRAFFIC-CONTROL", "traffic control", "TRAFFIC_CONTROL", {
    responsibleRole: "CONTROL",
    lifecycleStates: ["DEFINED", "PLAN_APPROVED", "CREW_SCHEDULED", "RELEASED", "DEMOBILIZED", "CLOSED"],
    releaseGates: ["traffic control plan approved", "permit conditions satisfied"],
    blockedReasons: ["traffic control not released", "lane closure unavailable"],
    requiredEvidence: ["traffic control plan", "release record", "demobilization record"],
    acceptanceCriteria: ["traffic control released for station range", "demobilization complete"]
  }),
  L("SERVICE:DIRECTIONAL-BORE", "directional bore", "CIVIL_CONSTRUCTION", {
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
  L("SERVICE:PLOWING", "plowing", "CIVIL_CONSTRUCTION", {
    prerequisiteDependencies: ["utility locate complete", "ROW release", "conduit material received"],
    releaseGates: ["ROW released", "locate complete", "materials ready"],
    blockedReasons: ["ROW not released", "locate incomplete", "material unavailable"],
    requiredEvidence: ["plow log", "GPS evidence", "photo evidence", "engineering acceptance"]
  }),
  L("SERVICE:OPEN-TRENCH", "open trench", "CIVIL_CONSTRUCTION", {
    prerequisiteDependencies: ["utility locate complete", "permit release", "restoration plan"],
    releaseGates: ["permit released", "locate complete", "restoration plan approved"],
    blockedReasons: ["permit blocked", "locate incomplete", "restoration plan missing"],
    requiredEvidence: ["trench log", "conduit placement evidence", "restoration evidence"]
  }),
  L("SERVICE:CONDUIT-PLACEMENT", "conduit placement", "ASSET_PLACEMENT", {
    prerequisiteDependencies: ["civil path released", "conduit material received"],
    releaseGates: ["civil method released", "conduit allocated"],
    blockedReasons: ["conduit material not received", "civil path not released"],
    requiredEvidence: ["conduit proof", "installation photo", "GPS evidence"]
  }),
  L("SERVICE:HANDHOLE-VAULT-PLACEMENT", "handhole/vault placement", "STRUCTURE_PLACEMENT", {
    prerequisiteDependencies: ["structure material received", "station released", "excavation released"],
    releaseGates: ["structure allocated", "station released"],
    blockedReasons: ["structure is not installed", "GPS evidence is missing", "photo evidence is missing", "inspection is incomplete", "engineering acceptance is missing"],
    requiredEvidence: ["structure photo", "GPS evidence", "inspection record", "engineering acceptance"],
    acceptanceCriteria: ["structure installed at assigned station", "GPS/photo evidence accepted", "inspection complete", "engineering acceptance recorded"]
  }),
  L("SERVICE:FIBER-PLACEMENT", "fiber placement", "FIBER_PLACEMENT", {
    prerequisiteDependencies: ["conduit path accepted", "handholes/vaults accepted", "fiber material received", "splice plan approved"],
    releaseGates: ["conduit path accepted", "structure path accepted", "fiber allocated"],
    blockedReasons: ["conduit path is not accepted", "handholes/vaults are not accepted", "fiber material is not received", "splice plan is not approved"],
    requiredEvidence: ["pull log", "fiber reel evidence", "slack loop evidence", "engineering acceptance"]
  }),
  L("SERVICE:SPLICING", "splicing", "FIBER_SPLICING", {
    prerequisiteDependencies: ["fiber installed", "splice case installed", "splice plan approved"],
    releaseGates: ["fiber path released", "splice plan approved"],
    blockedReasons: ["fiber is not installed", "splice evidence is missing", "OTDR/testing is incomplete", "labeling is incomplete"],
    requiredEvidence: ["splice record", "splice photo", "labeling evidence", "engineering acceptance"]
  }),
  L("SERVICE:OTDR-TESTING", "OTDR testing", "FIBER_TESTING", {
    prerequisiteDependencies: ["fiber installed", "splicing complete"],
    releaseGates: ["splice complete", "test plan approved"],
    blockedReasons: ["splice incomplete", "test result missing", "loss threshold failed"],
    requiredEvidence: ["OTDR trace", "loss report", "test acceptance"],
    acceptanceCriteria: ["OTDR trace passed", "loss report within threshold", "engineering acceptance recorded"]
  }),
  L("SERVICE:RESTORATION", "restoration", "RESTORATION", {
    prerequisiteDependencies: ["civil work complete", "surface restoration required"],
    releaseGates: ["construction complete", "restoration method approved"],
    blockedReasons: ["restoration incomplete", "surface condition rejected"],
    requiredEvidence: ["restoration photo", "inspection signoff", "customer/municipal acceptance when required"]
  }),
  L("SERVICE:AS-BUILT-DOCUMENTATION", "as-built documentation", "DOCUMENTATION", {
    responsibleRole: "ENGINEERING",
    lifecycleStates: ["DEFINED", "FIELD_DATA_RECEIVED", "AS_BUILT_DRAFTED", "ENGINEERING_REVIEWED", "ACCEPTED", "CLOSED"],
    prerequisiteDependencies: ["station/object evidence captured", "field redlines received"],
    releaseGates: ["field evidence accepted", "redlines reviewed"],
    blockedReasons: ["field evidence missing", "redline unresolved"],
    requiredEvidence: ["as-built drawing", "station evidence", "object inventory reference"],
    acceptanceCriteria: ["as-built complete", "engineering acceptance recorded"]
  }),
  L("SERVICE:INSPECTION", "inspection", "INSPECTION", {
    responsibleRole: "INSPECTION",
    lifecycleStates: ["DEFINED", "SCHEDULED", "INSPECTED", "PUNCHLIST_CREATED", "PUNCHLIST_RESOLVED", "ACCEPTED", "CLOSED"],
    prerequisiteDependencies: ["service or asset ready for inspection"],
    releaseGates: ["inspection scheduled", "evidence available"],
    blockedReasons: ["inspection incomplete", "punchlist unresolved"],
    requiredEvidence: ["inspection checklist", "photo evidence", "punchlist resolution"],
    acceptanceCriteria: ["inspection accepted", "punchlist resolved"]
  })
], J = [
  v("ASSET:CONDUIT", "conduit", "CONDUIT", {
    lifecycleStates: ["DEFINED", "PROCURED", "RECEIVED", "ALLOCATED", "INSTALLED", "GPS_VERIFIED", "EVIDENCE_CAPTURED", "ENGINEERING_ACCEPTED", "CERTIFIED", "OPERATIONAL"],
    prerequisiteDependencies: ["conduit placement service", "civil path released"],
    requiredEvidence: ["material receipt", "conduit proof", "GPS evidence", "photo evidence"]
  }),
  v("ASSET:FIBER", "fiber", "FIBER", {
    lifecycleStates: ["DEFINED", "RECEIVED", "PULLED", "SLACK_INSTALLED", "SPLICED", "OTDR_PASSED", "EVIDENCE_CAPTURED", "ENGINEERING_ACCEPTED", "CERTIFIED", "OPERATIONAL"],
    prerequisiteDependencies: ["conduit path accepted", "handholes/vaults accepted", "fiber placement service", "splicing service", "OTDR testing"],
    releaseGates: ["conduit path accepted", "fiber material received", "splice plan approved"],
    blockedReasons: ["conduit path not accepted", "fiber material missing", "OTDR failed"],
    requiredEvidence: ["fiber reel evidence", "pull log", "slack loop evidence", "splice record", "OTDR trace"],
    acceptanceCriteria: ["fiber installed", "slack installed", "splice accepted", "OTDR passed"]
  }),
  v("ASSET:HANDHOLES", "handholes", "HANDHOLE", {
    prerequisiteDependencies: ["handhole/vault placement service", "station released"],
    blockedReasons: ["structure is not installed", "GPS evidence is missing", "photo evidence is missing", "inspection is incomplete", "engineering acceptance is missing"]
  }),
  v("ASSET:VAULTS", "vaults", "VAULT", {
    prerequisiteDependencies: ["handhole/vault placement service", "station released"],
    blockedReasons: ["vault not installed", "GPS evidence missing", "inspection incomplete"]
  }),
  v("ASSET:SPLICE-CASES", "splice cases", "SPLICE_CASE", {
    prerequisiteDependencies: ["fiber installed", "splice plan approved"],
    requiredEvidence: ["splice case photo", "splice record", "labeling evidence"]
  }),
  v("ASSET:MARKER-POSTS", "marker posts", "MARKER_POST", {
    prerequisiteDependencies: ["route segment released", "marker placement plan"],
    requiredEvidence: ["marker photo", "GPS evidence"]
  }),
  v("ASSET:WARNING-TAPE", "warning tape", "WARNING_TAPE", {
    prerequisiteDependencies: ["open trench or plow service", "material received"],
    requiredEvidence: ["installation photo", "station range evidence"]
  }),
  v("ASSET:LOCATE-WIRE", "locate wire", "LOCATE_WIRE", {
    prerequisiteDependencies: ["conduit placement", "material received"],
    requiredEvidence: ["continuity evidence", "installation photo"]
  }),
  v("ASSET:SLACK-LOOPS", "slack loops", "SLACK_LOOP", {
    prerequisiteDependencies: ["fiber placement", "structure placement"],
    requiredEvidence: ["slack loop photo", "fiber inventory evidence"]
  }),
  v("ASSET:ILA-REGEN-FACILITIES", "ILA/regeneration facilities where required", "ILA_REGENERATION_FACILITY", {
    requiredWhen: "Route span length or optical budget requires amplification/regeneration.",
    prerequisiteDependencies: ["engineering optical review", "site/power availability", "structure allocation"],
    releaseGates: ["engineering optical requirement confirmed", "site and power released"],
    requiredEvidence: ["facility layout", "power availability evidence", "engineering acceptance"]
  }),
  v("ASSET:LIU-TERMINATION-HARDWARE", "LIU/termination hardware where required", "LIU_TERMINATION_HARDWARE", {
    requiredWhen: "Customer handoff, POP termination, or termination point requires LIU hardware.",
    prerequisiteDependencies: ["termination point defined", "fiber assignment approved"],
    releaseGates: ["termination point released", "hardware allocated"],
    requiredEvidence: ["termination photo", "labeling evidence", "handoff acceptance"]
  })
], ie = [
  M("SPINE", "spine", ["SERVICE:ENGINEERING", "SERVICE:SURVEY"], ["ASSET:CONDUIT", "ASSET:FIBER"], !0),
  M("ROUTE_SEGMENT", "route segment", ["SERVICE:ENGINEERING", "SERVICE:SURVEY", "SERVICE:PERMITTING"], ["ASSET:CONDUIT", "ASSET:FIBER"], !0),
  M("STATION", "station", ["SERVICE:SURVEY", "SERVICE:INSPECTION"], [], !0),
  M("CONDUIT_SEGMENT", "conduit segment", ["SERVICE:CONDUIT-PLACEMENT"], ["ASSET:CONDUIT", "ASSET:WARNING-TAPE", "ASSET:LOCATE-WIRE"], !0),
  M("FIBER_SEGMENT", "fiber segment", ["SERVICE:FIBER-PLACEMENT", "SERVICE:OTDR-TESTING"], ["ASSET:FIBER", "ASSET:SLACK-LOOPS"], !0),
  M("STRUCTURE", "structure", ["SERVICE:HANDHOLE-VAULT-PLACEMENT", "SERVICE:INSPECTION"], ["ASSET:HANDHOLES", "ASSET:VAULTS"], !0),
  M("CROSSING", "crossing", ["SERVICE:PERMITTING", "SERVICE:DIRECTIONAL-BORE", "SERVICE:INSPECTION"], ["ASSET:CONDUIT"], !0),
  M("SPLICE_CASE", "splice case", ["SERVICE:SPLICING", "SERVICE:OTDR-TESTING"], ["ASSET:SPLICE-CASES", "ASSET:FIBER"], !0),
  M("ILA_REGENERATION_SITE", "ILA/regeneration site", ["SERVICE:ENGINEERING", "SERVICE:INSPECTION"], ["ASSET:ILA-REGEN-FACILITIES"], !0),
  M("TERMINATION_POINT", "termination point", ["SERVICE:ENGINEERING", "SERVICE:SPLICING", "SERVICE:OTDR-TESTING"], ["ASSET:LIU-TERMINATION-HARDWARE"], !0),
  M("EVIDENCE_OBJECT", "evidence object", ["SERVICE:AS-BUILT-DOCUMENTATION", "SERVICE:INSPECTION"], [], !1)
], ge = [
  ...Y.map((e) => Ee("SERVICE", e.serviceId, e)),
  ...J.map((e) => Ee("ASSET", e.assetId, e)),
  ...ie.map((e) => Ee("ENGINEERING_OBJECT", e.engineeringObjectType, e))
], le = [
  ...Y.map((e) => Re("SERVICE", e.serviceId, e)),
  ...J.map((e) => Re("ASSET", e.assetId, e)),
  ...ie.map((e) => Re("ENGINEERING_OBJECT", e.engineeringObjectType, e))
], Ie = [
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
], be = {
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
}, he = {
  projectionId: `${U}:STATION-LIFECYCLE-PROJECTION`,
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
}, pe = [
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
], H = {
  doctrineId: U,
  productId: j,
  productName: "Point-to-Point Long Haul Conduit & Fiber",
  productVersion: "1.0.0",
  doctrineVersion: ne,
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
  registry: Qe,
  requiredServices: Y,
  requiredAssets: J,
  engineeringObjects: ie,
  executionSequences: ge,
  closeSequences: le,
  evidenceRequirements: Ie,
  certificationRules: be,
  stationLevelLifecycleProjection: he,
  scopeVersionReadinessRequirements: pe,
  requirementPolicies: [
    { requirementId: "HANDHOLE_PLAN_DEFINED", requirement: "CONDITIONAL", quantityAuthority: "ENGINEERING_DESIGN", resolutionRequired: !0 },
    { requirementId: "VAULT_PLAN_DEFINED", requirement: "CONDITIONAL", quantityAuthority: "ENGINEERING_DESIGN", resolutionRequired: !0 },
    { requirementId: "SPLICE_ARCHITECTURE_DEFINED", requirement: "CONDITIONAL", quantityAuthority: "ENGINEERING_DESIGN", resolutionRequired: !0 },
    { requirementId: "ILA_CONFIGURATION_DEFINED", requirement: "CONDITIONAL", quantityAuthority: "PROJECT_CONFIGURATION", resolutionRequired: !0 },
    { requirementId: "REGENERATION_REQUIREMENT_DEFINED", requirement: "CONDITIONAL", quantityAuthority: "OPTICAL_ENGINEERING_DEFINED", resolutionRequired: !0 },
    { requirementId: "FIBER_PLACEMENT_ALLOWANCE_DEFINED", requirement: "REQUIRED", quantityAuthority: "PROJECT_CONFIGURATION", resolutionRequired: !0 },
    { requirementId: "APPLICABLE_CONSTRAINTS_EVALUATED", requirement: "REQUIRED", quantityAuthority: "ENGINEERING_DESIGN", resolutionRequired: !0 }
  ],
  previousDoctrineVersion: We,
  changeReason: Je
};
function ee(e, n = "UNKNOWN") {
  return (String(e ?? n).trim() || n).replace(/[^A-Za-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 120) || n;
}
function W(e, n = 3) {
  const t = 10 ** n;
  return Math.round(e * t) / t;
}
function on(e, n) {
  if (!e.length) return [0, 0];
  if (e.length === 1) return e[0];
  const t = Math.min(e.length - 1, Math.max(0, Math.round(n * (e.length - 1))));
  return e[t];
}
function Ge(e, n, t, r) {
  return t ? {
    siteId: `${j}:SITE:${e}:${ee(n)}`,
    role: e,
    label: r,
    coordinate: t,
    source: "AUTHORITATIVE_ROUTE_ENDPOINT"
  } : null;
}
function cn(e, n, t, r) {
  if (!n.length || t <= 0) return [];
  const o = Math.max(2, Math.floor(t / r) + 1);
  return Array.from({ length: o }, (c, i) => {
    const d = o === 1 ? 0 : i / (o - 1), a = i === o - 1 ? t : Math.min(t, i * r);
    return {
      stationId: `${e}:STATION:${String(i).padStart(4, "0")}`,
      spineId: e,
      stationIndex: i,
      stationFeet: Math.round(a),
      milepost: W(a / 5280),
      coordinate: on(n, d),
      stationRole: "DISPLAY_INDEX",
      constitutionalResolution: !1
    };
  });
}
function sn(e, n, t, r) {
  return t?.length && n.length ? t.map((o, c) => ({
    segmentId: `${e}:SEGMENT:${ee(o.segmentId, String(c + 1))}`,
    spineId: e,
    fromStationId: n[Math.min(c, n.length - 1)]?.stationId ?? n[0].stationId,
    toStationId: n[Math.min(c + 1, n.length - 1)]?.stationId ?? n[n.length - 1].stationId,
    fromMile: W(o.fromMile),
    toMile: W(o.toMile),
    routeMiles: W(o.routeMiles),
    routeFeet: Math.round(o.routeMiles * 5280)
  })) : n.length < 2 || r <= 0 ? [] : n.slice(0, -1).map((o, c) => {
    const i = n[c + 1], d = Math.max(0, i.stationFeet - o.stationFeet);
    return {
      segmentId: `${e}:SEGMENT:${String(c + 1).padStart(3, "0")}`,
      spineId: e,
      fromStationId: o.stationId,
      toStationId: i.stationId,
      fromMile: o.milepost,
      toMile: i.milepost,
      routeMiles: W(d / 5280),
      routeFeet: Math.round(d)
    };
  });
}
function re(e, n, t, r, o, c, i) {
  return { objectId: e, objectType: n, label: t, parentId: r, quantity: o, unit: c, metadata: i };
}
function an(e, n, t, r) {
  const o = n.map((c) => re(
    `${c.segmentId}:CONDUIT`,
    "CONDUIT",
    `Conduit ${c.fromMile}-${c.toMile}`,
    c.segmentId,
    Math.round(c.routeFeet * t),
    "conduit-foot",
    { conduitCount: t, conduitSizeInches: r, routeFeet: c.routeFeet }
  ));
  return {
    assemblyId: `${e}:CONDUIT-ASSEMBLY`,
    conduitCount: t,
    conduitSizeInches: r,
    conduitFeet: o.reduce((c, i) => c + Number(i.quantity ?? 0), 0),
    objects: o
  };
}
function dn(e, n, t, r) {
  const o = r?.mode === "PERCENTAGE" && Number.isFinite(r.slackPercent) ? 1 + Number(r.slackPercent) / 100 : 1, c = n.map((i) => re(
    `${i.segmentId}:FIBER`,
    "FIBER",
    `Fiber ${i.fromMile}-${i.toMile}`,
    i.segmentId,
    Math.round(i.routeFeet * o),
    "fiber-foot",
    { fiberCount: t, slackFactor: o, slackPolicy: r ?? { mode: "ENGINEERING_DEFINED", authority: "UNKNOWN", source: "UNRESOLVED", revision: "UNRESOLVED" }, routeFeet: i.routeFeet }
  ));
  return {
    assemblyId: `${e}:FIBER-ASSEMBLY`,
    fiberCount: t,
    fiberFeet: c.reduce((i, d) => i + Number(d.quantity ?? 0), 0),
    objects: c
  };
}
function un(e, n) {
  const r = [
    ["HANDHOLE", n?.handholeCount, n?.structurePlanAuthority],
    ["VAULT", n?.vaultCount, n?.structurePlanAuthority],
    ["SPLICE_CASE", n?.spliceCaseCount, n?.spliceArchitectureAuthority]
  ].filter(([, o]) => Number.isFinite(o) && Number(o) > 0).map(([o, c, i]) => re(
    `${e}:STRUCTURE:${o}`,
    "STRUCTURE",
    o,
    e,
    Number(c),
    "count",
    { structureType: o, quantityAuthority: i ?? "UNKNOWN", source: "PROJECT_CONFIGURATION_OR_SOURCE_EVIDENCE" }
  ));
  return {
    assemblyId: `${e}:STRUCTURE-ASSEMBLY`,
    structureCount: r.reduce((o, c) => o + Number(c.quantity ?? 0), 0),
    structures: r
  };
}
function En(e) {
  const n = [];
  return {
    assemblyId: `${e}:CROSSING-ASSEMBLY`,
    crossingCount: 0,
    crossings: n
  };
}
function ln(e, n) {
  const t = e.pricingSummary ?? {}, r = Number.isFinite(Number(t.budgetCost ?? t.ospCost)), o = Number.isFinite(Number(t.sellPriceIru ?? t.nrcRevenue)), c = r ? Number(t.budgetCost ?? t.ospCost) : 0, i = o ? Number(t.sellPriceIru ?? t.nrcRevenue) : 0, d = Number(t.nrcRevenue ?? i), a = Number(t.mrcRevenue ?? 0), E = Number(t.grossMarginDollars ?? i - c), p = Number(t.grossMarginPercent ?? (i ? Math.round(E / i * 1e4) / 100 : 0));
  return {
    budgetCost: c,
    sellPriceIru: i,
    nrcRevenue: d,
    mrcRevenue: a,
    grossMarginDollars: E,
    grossMarginPercent: p,
    pricingInputs: {
      routeFeet: n.routeFeet,
      conduitFeet: n.conduitFeet,
      fiberFeet: n.fiberFeet,
      source: t
    },
    priceStatus: r && o ? "AUTHORIZED" : "UNRESOLVED",
    authorityLayer: r || o ? "COMMERCIAL_POLICY" : "UNKNOWN"
  };
}
function N(e, n, t) {
  return { key: e, label: n, status: t ? "PASS" : "FAIL" };
}
function In(e) {
  const n = [
    N("account-customer", "account/customer exists", !!(e.accountId && e.customerId)),
    N("product-id", "productId exists", e.productId === j),
    N("doctrine-id", "doctrineId exists", e.doctrineId === U),
    N("a-site", "A site exists", !!e.aSite),
    N("z-site", "Z site exists", !!e.zSite),
    N("authoritative-route-centerline", "Authoritative route centerline exists", !!(e.osrmRoute && e.centerline.length > 1)),
    N("route-authority", "Route measurement authority is explicit", !!(e.osrmRoute?.routeAuthority || e.osrmRoute?.source)),
    N("spine", "spine exists", !!e.spine),
    N("stations", "stations count > 0", e.stations.length > 0),
    N("objects", "objects count > 0", e.objects.length > 0),
    N("quantity-summary", "quantity summary exists", e.quantitySummary.routeFeet > 0 && e.quantitySummary.objectCount > 0),
    N("pricing-authority", "Pricing authority is explicit or unresolved", ["AUTHORIZED", "UNRESOLVED", "COMMERCIAL_PLANNING_ASSUMPTION"].includes(e.pricingSummary.priceStatus ?? "UNRESOLVED")),
    N("required-services", "required services exist", e.requiredServices.length > 0),
    N("required-assets", "required assets exist", e.requiredAssets.length > 0),
    N("engineering-objects", "engineering objects exist", e.engineeringObjects.length > 0),
    N("execution-sequences", "execution sequences exist", e.executionSequences.length > 0),
    N("close-sequences", "close sequences exist", e.closeSequences.length > 0),
    N("evidence-requirements", "evidence requirements exist", e.evidenceRequirements.length > 0),
    N("certification-rules", "certification rules exist", e.certificationRules.mustContain.length > 0),
    N("station-lifecycle-projection", "station-level lifecycle projection exists", !!e.stationLevelLifecycleProjection.projectionId),
    N("scopeversion-readiness", "ScopeVersion readiness requirements exist", e.scopeVersionReadinessRequirements.length > 0)
  ], t = n.filter((r) => r.status === "PASS").length;
  return {
    status: t === n.length ? "PASS" : "FAIL",
    checks: n,
    readinessScore: Math.round(t / n.length * 100)
  };
}
function pn(e) {
  const n = e.authoritativeRoute ?? e.osrmRoute, t = n?.geometry ?? [], r = Math.max(0, Math.round(n?.routeFeet ?? 0)), o = W(n?.routeMiles ?? r / 5280), c = e.aSite ?? Ge("A", e.accountId, t[0], "A site"), i = e.zSite ?? Ge("Z", e.accountId, t[t.length - 1], "Z site"), d = `${j}:CENTERLINE:${ee(n?.routeId, "AUTHORITATIVE-ROUTE")}`, a = c && i && t.length > 1 && r > 0 ? {
    spineId: `${j}:SPINE:${ee(n?.routeId, "AUTHORITATIVE-ROUTE")}`,
    topology: "LINEAR",
    networkClass: "LONG_HAUL",
    aSiteId: c.siteId,
    zSiteId: i.siteId,
    centerlineId: d,
    routeMiles: o,
    routeFeet: r,
    stationAuthorityMode: "CONTINUOUS",
    routeSource: n?.source,
    routeAuthority: n?.routeAuthority ?? n?.source,
    routeRevision: n?.routeRevision ?? "UNSPECIFIED",
    routeHash: n?.routeHash ?? "UNSPECIFIED",
    measurementAuthority: n?.measurementAuthority ?? "MEASURED_CENTERLINE",
    noScopeVersionCreation: !0
  } : null, E = a ? cn(a.spineId, t, r, e.stationIntervalFeet ?? 5280) : [], p = a ? sn(a.spineId, E, e.routeSegments, r) : [], I = p.map((l) => re(l.segmentId, "ROUTE_SEGMENT", `Route segment ${l.fromMile}-${l.toMile}`, a?.spineId, l.routeFeet, "route-foot", l)), C = a ? [re(a.spineId, "SPINE", "Point-to-point long-haul spine", void 0, r, "route-foot", a)] : [], R = e.projectConfiguration?.ductCount ?? e.conduitCount ?? 0, T = e.projectConfiguration?.ductDiameter ?? e.conduitSizeInches ?? 0, m = e.projectConfiguration?.fiberCount ?? e.fiberCount ?? 0, h = a && R > 0 && T > 0 ? an(a.spineId, p, R, T) : { assemblyId: `${j}:CONDUIT-ASSEMBLY`, conduitCount: R, conduitSizeInches: T, conduitFeet: 0, objects: [] }, g = a && m > 0 ? dn(a.spineId, p, m, e.projectConfiguration?.slackPolicy) : { assemblyId: `${j}:FIBER-ASSEMBLY`, fiberCount: m, fiberFeet: 0, objects: [] }, A = a ? un(a.spineId, e.projectConfiguration) : { assemblyId: `${j}:STRUCTURE-ASSEMBLY`, structureCount: 0, structures: [] }, y = a ? En(a.spineId) : { assemblyId: `${j}:CROSSING-ASSEMBLY`, crossingCount: 0, crossings: [] }, D = [
    ...C,
    ...I,
    ...h.objects,
    ...g.objects,
    ...A.structures,
    ...y.crossings
  ], f = {
    routeMiles: o,
    routeFeet: r,
    stationCount: E.length,
    segmentCount: p.length,
    objectCount: D.length,
    conduitFeet: h.conduitFeet,
    conduitCount: h.conduitCount,
    fiberFeet: g.fiberFeet,
    fiberCount: g.fiberCount,
    structureCount: A.structureCount,
    crossingCount: y.crossingCount
  }, _ = ln(e, f), P = In({
    accountId: e.accountId,
    customerId: e.customerId,
    productId: j,
    doctrineId: U,
    aSite: c,
    zSite: i,
    osrmRoute: n,
    centerline: t,
    spine: a,
    stations: E,
    objects: D,
    quantitySummary: f,
    pricingSummary: _,
    requiredServices: Y,
    requiredAssets: J,
    engineeringObjects: ie,
    executionSequences: ge,
    closeSequences: le,
    evidenceRequirements: Ie,
    certificationRules: be,
    stationLevelLifecycleProjection: he,
    scopeVersionReadinessRequirements: pe
  }), s = `${j}:ASSEMBLY:${ee(n?.routeId, "AUTHORITATIVE-ROUTE")}`;
  return {
    assemblyId: s,
    doctrineId: U,
    productId: j,
    productDoctrineVersion: ne,
    projectConfiguration: e.projectConfiguration,
    aSite: c,
    zSite: i,
    authoritativeRoute: n,
    osrmRoute: n,
    centerline: t,
    centerlineId: d,
    spine: a,
    stations: E,
    routeSegments: p,
    objects: D,
    conduitAssembly: h,
    fiberAssembly: g,
    structureAssembly: A,
    crossingAssembly: y,
    quantitySummary: f,
    pricingSummary: _,
    validationSummary: P,
    engineeringManifest: {
      manifestId: `${s}:ENGINEERING-MANIFEST`,
      packagePath: "Commercial Proposal -> Product Doctrine Assembly -> Draft IOF Package -> Engineering Review",
      requiresEngineeringCertification: !0,
      noScopeVersionCreation: !0,
      objectIds: D.map((l) => l.objectId),
      stationIds: E.map((l) => l.stationId),
      quantityKeys: Object.keys(f),
      serviceIds: Y.map((l) => l.serviceId),
      assetIds: J.map((l) => l.assetId),
      evidenceRequirementIds: Ie.map((l) => l.evidenceRequirementId),
      closeSequenceIds: le.map((l) => l.closeSequenceId),
      scopeVersionReadinessRequirementIds: pe.map((l) => l.requirementId)
    },
    rules: H.rules,
    registry: Qe,
    requiredServices: Y,
    requiredAssets: J,
    engineeringObjects: ie,
    executionSequences: ge,
    closeSequences: le,
    evidenceRequirements: Ie,
    certificationRules: be,
    stationLevelLifecycleProjection: he,
    scopeVersionReadinessRequirements: pe,
    requirementGaps: [
      ...!e.projectConfiguration?.structurePlanAuthority || e.projectConfiguration.structurePlanAuthority === "UNKNOWN" || !Number.isFinite(e.projectConfiguration.handholeCount) && !Number.isFinite(e.projectConfiguration.vaultCount) ? [{ requirementId: "STRUCTURE_PLAN_DEFINED", objectClass: "STRUCTURE", status: "ENGINEERING_REVIEW_REQUIRED", authority: "ENGINEERING", reason: "Access and structure quantities require source evidence or an Engineering-defined structure plan." }] : [],
      ...!e.projectConfiguration?.spliceArchitectureAuthority || e.projectConfiguration.spliceArchitectureAuthority === "UNKNOWN" || !Number.isFinite(e.projectConfiguration.spliceCaseCount) ? [{ requirementId: "SPLICE_ARCHITECTURE_DEFINED", objectClass: "SPLICE_CASE", status: "ENGINEERING_REVIEW_REQUIRED", authority: "ENGINEERING", reason: "Splice architecture is not defined by route length." }] : [],
      { requirementId: "APPLICABLE_CONSTRAINTS_EVALUATED", objectClass: "CROSSING", status: "UNKNOWN", authority: "ENGINEERING", reason: "Crossing and environmental constraint counts remain unknown until evaluated." }
    ],
    doctrineMigration: { previousDoctrineVersion: We, newDoctrineVersion: ne, changeReason: Je },
    noScopeVersionCreation: !0
  };
}
function $(e) {
  return e && typeof e == "object" && !Array.isArray(e) ? e : {};
}
function Fe(e) {
  return Array.isArray(e) ? e : [];
}
function F(...e) {
  for (const n of e) {
    const t = String(n ?? "").trim();
    if (t) return t;
  }
  return "";
}
function z(...e) {
  for (const n of e) {
    const t = Number(n);
    if (Number.isFinite(t)) return t;
  }
  return 0;
}
function ye(e) {
  return Array.isArray(e) ? `[${e.map(ye).join(",")}]` : e && typeof e == "object" ? `{${Object.keys(e).sort().map((n) => `${JSON.stringify(n)}:${ye(e[n])}`).join(",")}}` : JSON.stringify(e ?? null);
}
const Ue = ze("sha256").update(ye(H)).digest("hex");
if (Ue !== Ye)
  throw new Error(`PRODUCT_DOCTRINE_HASH_REGISTRY_MISMATCH: ${Ue}`);
const Sn = Ye, w = Object.freeze({
  productId: j,
  productDoctrineId: U,
  productDoctrineVersion: ne,
  productDoctrineHash: Sn,
  productName: H.productName,
  doctrineAlias: H.registry.alias,
  status: "ACTIVE",
  immutable: !0,
  authority: "PRODUCT_DOCTRINE_REGISTRY"
});
function Cn(e = {}) {
  const n = F(e.productId), t = F(e.productDoctrineId, e.doctrineId), r = F(e.productDoctrineVersion, e.doctrineVersion), o = F(e.productDoctrineHash, e.doctrineHash);
  return !n || !t || !r || !o || n !== w.productId || t !== w.productDoctrineId || r !== w.productDoctrineVersion || o !== w.productDoctrineHash ? null : w;
}
function mn(e) {
  const n = $(e.proposal), t = $(e.route), r = $(n.geometry), o = $(n.centerlineRoute), c = Fe(
    t.commercialGeometry ?? t.geometry ?? n.routeGeometry ?? n.centerline ?? o.geometry ?? r.coordinates
  ), i = z(t.routeMiles, n.routeMiles, $(n.pricingSummary).routeMiles, $(n.productConfiguration).routeMiles), d = z(t.routeFeet, n.routeFeet, i * 5280), a = F(t.routeRepositoryId, t.routeId, n.routeId, o.routeId, Fe(n.geometryReferences)[0], e.packageId), E = F(t.routeRevision, t.revision, n.routeRevision, "1"), p = F(t.geometryHash, n.routeGeometryHash, n.geometryHash, a), I = c.length > 1 && d > 0 ? {
    routeId: a,
    source: "COMMERCIAL_ROUTE_REPOSITORY",
    routeMiles: i || d / 5280,
    routeFeet: d,
    distanceMeters: d * 0.3048,
    geometry: c,
    routeAuthority: "COMMERCIAL_ROUTE_REPOSITORY",
    routeRevision: E,
    routeHash: p,
    measurementAuthority: "MEASURED_CENTERLINE"
  } : null, C = $(n.productConfiguration ?? n.projectConfiguration), R = pn({
    accountId: F(n.accountId, n.customerId),
    customerId: F(n.customerId),
    aSite: null,
    zSite: null,
    osrmRoute: I,
    authoritativeRoute: I,
    projectConfiguration: C,
    pricingSummary: $(n.pricingSummary),
    conduitCount: z(C.ductCount, C.conduitCount),
    conduitSizeInches: z(C.ductDiameter, C.conduitSizeInches),
    fiberCount: z(C.fiberCount)
  });
  if (R.validationSummary.status !== "PASS") {
    const m = R.validationSummary.checks.filter((g) => g.status !== "PASS").map((g) => g.key), h = new Error(`PRODUCT_DOCTRINE_ASSEMBLY_FAILED: ${m.join(", ")}`);
    throw Object.assign(h, { code: "PRODUCT_DOCTRINE_ASSEMBLY_FAILED", status: 409, failures: m }), h;
  }
  const T = Lt({
    packageId: e.packageId,
    productDoctrine: H,
    productDoctrineAssembly: R,
    routeId: a,
    scopeVersionCandidateId: `${e.packageId}:SCOPEVERSION-CANDIDATE`,
    geometryHash: p
  });
  if (T.validation.status !== "PASS") {
    const m = new Error(`DOCTRINE_OBJECT_INSTANTIATION_FAILED: ${T.validation.failures.join("; ")}`);
    throw Object.assign(m, { code: "DOCTRINE_OBJECT_INSTANTIATION_FAILED", status: 409, failures: T.validation.failures }), m;
  }
  return {
    authority: w,
    productDoctrine: H,
    productDoctrineAssembly: R,
    doctrineObjectInstantiation: T,
    engineeringObjectManifest: T.engineeringObjectManifest
  };
}
function Rn(e) {
  return Kt({
    packageId: e.packageId,
    productDoctrine: H,
    doctrineObjectManifest: e.doctrineObjectManifest,
    measuredSpine: e.measuredSpine,
    stationAuthority: e.stationAuthority,
    stationIndexedGraph: e.stationIndexedGraph,
    routeRepositoryId: e.routeRepositoryId,
    routeGeometryId: e.routeGeometryId,
    commercialReleasePackageId: e.commercialReleasePackageId
  });
}
export {
  w as PRODUCT_DOCTRINE_AUTHORITY,
  Sn as PRODUCT_DOCTRINE_HASH,
  mn as assembleProductDoctrineArtifacts,
  Rn as projectProductDoctrineToStationSpine,
  Cn as resolveProductDoctrineAuthority
};
