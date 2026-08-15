export const OBJECT_TRANSITION_AUTHORITY = "OBJECT_TRANSITION_ENGINE" as const;
export const CLOSURE_ENGINE_AUTHORITY = "CLOSURE_ENGINE" as const;
export const CLOSURE_LEDGER_AUTHORITY = "CLOSURE_LEDGER" as const;
export const IOF_PACKAGE_TWIN_AUTHORITY = "IOF_PACKAGE_TWIN" as const;

export const CONSTITUTIONAL_LIFECYCLE_STATES = [
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
  "RETIRED",
] as const;

export type ConstitutionalLifecycleState = typeof CONSTITUTIONAL_LIFECYCLE_STATES[number];

export type DomainAuthority =
  | "Commercial"
  | "Engineering"
  | "ScopeVersion"
  | "Marketplace"
  | "Control"
  | "Field"
  | "Twin";

export const DOMAIN_AUTHORITY_MATRIX: Record<ConstitutionalLifecycleState, DomainAuthority> = {
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
  RETIRED: "Twin",
};

const REQUIRED_EVIDENCE_BY_STATE: Record<ConstitutionalLifecycleState, string[]> = {
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
  RETIRED: [],
};

export type ObjectTransitionEvidenceResult = {
  evidenceId: string;
  status: "PASS" | "FAIL";
  reason: string;
};

export type ClosureEvent = {
  closureEventId: string;
  objectId?: string;
  spanId?: string;
  closureSegmentId?: string;
  fromState: ConstitutionalLifecycleState;
  toState: ConstitutionalLifecycleState;
  authority: DomainAuthority;
  actor: string;
  timestamp: string;
  evidenceIds: string[];
  prerequisiteResults: ObjectTransitionEvidenceResult[];
  geometryAuthorityId: string;
  scopeVersionId?: string;
  certifiedIofPackageId?: string;
  reason: string;
  auditHash: string;
};

export type RuntimeStateFields = {
  currentState: ConstitutionalLifecycleState;
  previousState?: ConstitutionalLifecycleState;
  nextState?: ConstitutionalLifecycleState;
  currentAuthority: DomainAuthority;
  nextAuthority?: DomainAuthority;
  allowedTransitions: ConstitutionalLifecycleState[];
  requiredEvidenceForNextTransition: string[];
  blockingDependencies: string[];
  closureEventHistory: ClosureEvent[];
  auditStatus: "OPEN" | "BLOCKED" | "CLOSED";
  domainResponsibilityMatrix: Record<ConstitutionalLifecycleState, DomainAuthority>;
  lifecycleStateMachine: {
    states: ReadonlyArray<ConstitutionalLifecycleState>;
    currentState: ConstitutionalLifecycleState;
    transitionAuthority: typeof OBJECT_TRANSITION_AUTHORITY | typeof CLOSURE_ENGINE_AUTHORITY;
  };
  transitionRules: Array<{
    fromState: ConstitutionalLifecycleState;
    toState: ConstitutionalLifecycleState;
    authority: DomainAuthority;
    requiredEvidence: string[];
  }>;
  auditLedgerHooks: {
    closureLedgerId: string;
    transitionAuthority: typeof OBJECT_TRANSITION_AUTHORITY | typeof CLOSURE_ENGINE_AUTHORITY;
    closureLedgerAuthority: typeof CLOSURE_LEDGER_AUTHORITY;
  };
  twinProjectionMetadata: {
    twinProjectionId: string;
    currentState: ConstitutionalLifecycleState;
    currentAuthority: DomainAuthority;
    projectionAuthority: typeof IOF_PACKAGE_TWIN_AUTHORITY;
  };
};

export type WorkSegmentType =
  | "DIRECTIONAL_BORE"
  | "ROCK_BORE"
  | "PLOW"
  | "OPEN_TRENCH"
  | "FIBER_PULL"
  | "SPLICE"
  | "TESTING"
  | "RESTORATION"
  | "LOCATE"
  | "PERMIT"
  | "CROSSING"
  | "INSPECTION";

export type WorkSegment = RuntimeStateFields & {
  closureSegmentId: string;
  parentSpanId: string;
  measuredCenterlineId: string;
  workType: WorkSegmentType;
  startStation: string;
  endStation: string;
  startMeasure: number;
  endMeasure: number;
  length: number;
  constructionMethod: string;
  crewType: string;
  laborTemplate: string;
  materialTemplate: string;
  requiredEvidence: string[];
  currentState: ConstitutionalLifecycleState;
  closureEventIds: string[];
  paymentEligibility: "NOT_ELIGIBLE_UNTIL_CLOSED";
  productionQuantity: number;
  noIndependentGeometry: true;
};

export type ClosureLedger = {
  closureLedgerId: string;
  packageId: string;
  objectCount: number;
  spanCount: number;
  workSegmentCount: number;
  closureEvents: ClosureEvent[];
  authority: typeof CLOSURE_LEDGER_AUTHORITY;
  transitionAuthority: typeof OBJECT_TRANSITION_AUTHORITY | typeof CLOSURE_ENGINE_AUTHORITY;
  immutableAfterCreation: true;
  noScopeVersionCreation: true;
};

export type IofPackageTwinProjection = {
  twinProjectionId: string;
  packageId: string;
  objectCount: number;
  spanCount: number;
  workSegmentCount: number;
  currentAuthority: typeof IOF_PACKAGE_TWIN_AUTHORITY;
  stateAuthority: typeof OBJECT_TRANSITION_AUTHORITY | typeof CLOSURE_ENGINE_AUTHORITY;
  closureLedgerId: string;
  executionGraphId: string;
  lifecycleGraphId: string;
  domainLenses: {
    commercial: string;
    engineering: string;
    marketplace: string;
    control: string;
    field: string;
    twin: string;
  };
  noScopeVersionCreation: true;
};

export type CommercialAuditReconciliation = {
  reconciliationId: string;
  status: "PASS" | "FAIL";
  expectedObjectCount: number;
  renderedObjectCount: number;
  expectedMaterialObjects: number;
  renderedMaterialObjects: number;
  expectedLaborObjects: number;
  renderedLaborObjects: number;
  stationCount: number;
  spanCount: number;
  paymentSequenceCount: number;
  closeSequenceCount: number;
  failures: Array<{
    objectClass: string;
    expectedCount: number;
    actualCount: number;
    blockingAuthority: DomainAuthority;
  }>;
  authority: "COMMERCIAL_AUDIT_RECONCILIATION";
};

function nowIso() {
  return new Date().toISOString();
}

function stablePart(value: unknown, fallback = "UNKNOWN") {
  const raw = String(value ?? fallback).trim() || fallback;
  return raw.replace(/[^A-Za-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 96) || fallback;
}

function stableHash(value: unknown) {
  const json = JSON.stringify(value);
  let hash = 2166136261;
  for (let index = 0; index < json.length; index += 1) {
    hash ^= json.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `hash-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

export function nextLifecycleState(state: ConstitutionalLifecycleState) {
  const index = CONSTITUTIONAL_LIFECYCLE_STATES.indexOf(state);
  return index >= 0 ? CONSTITUTIONAL_LIFECYCLE_STATES[index + 1] : undefined;
}

export function transitionRuleFor(state: ConstitutionalLifecycleState) {
  const nextState = nextLifecycleState(state);
  return nextState
    ? [{
        fromState: state,
        toState: nextState,
        authority: DOMAIN_AUTHORITY_MATRIX[nextState],
        requiredEvidence: REQUIRED_EVIDENCE_BY_STATE[state],
      }]
    : [];
}

export function initializeLifecycleState<T extends Record<string, unknown>>(entity: T, args: {
  packageId: string;
  entityId: string;
  entityKind: "object" | "span" | "closureSegment";
  closureLedgerId: string;
  initialState?: ConstitutionalLifecycleState;
  blockingDependencies?: string[];
}) {
  const currentState = args.initialState ?? "COMMERCIAL_ASSEMBLED";
  const nextState = nextLifecycleState(currentState);
  const currentAuthority = DOMAIN_AUTHORITY_MATRIX[currentState];
  const nextAuthority = nextState ? DOMAIN_AUTHORITY_MATRIX[nextState] : undefined;
  const rules = transitionRuleFor(currentState);
  return {
    ...entity,
    currentState,
    currentLifecycleState: currentState,
    previousState: undefined,
    nextState,
    currentAuthority,
    nextAuthority,
    allowedTransitions: nextState ? [nextState] : [],
    requiredEvidenceForNextTransition: REQUIRED_EVIDENCE_BY_STATE[currentState],
    blockingDependencies: args.blockingDependencies ?? [],
    closureEventHistory: [],
    auditStatus: "OPEN",
    domainResponsibilityMatrix: DOMAIN_AUTHORITY_MATRIX,
    lifecycleStateMachine: {
      states: CONSTITUTIONAL_LIFECYCLE_STATES,
      currentState,
      transitionAuthority: CLOSURE_ENGINE_AUTHORITY,
    },
    transitionRules: rules,
    auditLedgerHooks: {
      closureLedgerId: args.closureLedgerId,
      transitionAuthority: CLOSURE_ENGINE_AUTHORITY,
      closureLedgerAuthority: CLOSURE_LEDGER_AUTHORITY,
    },
    twinProjectionMetadata: {
      twinProjectionId: `${args.packageId}:TWIN:${args.entityKind.toUpperCase()}:${stablePart(args.entityId)}`,
      currentState,
      currentAuthority,
      projectionAuthority: IOF_PACKAGE_TWIN_AUTHORITY,
    },
  } satisfies T & RuntimeStateFields & { currentLifecycleState: ConstitutionalLifecycleState };
}

export function transitionObjectState<T extends RuntimeStateFields & Record<string, unknown>>(entity: T, args: {
  toState: ConstitutionalLifecycleState;
  authority: DomainAuthority;
  actor: string;
  evidenceIds: string[];
  geometryAuthorityId: string;
  scopeVersionId?: string;
  certifiedIofPackageId?: string;
  reason: string;
}) {
  // Legacy compatibility path from CIP-038. Constitutional state advancement is owned by submitClosure in ClosureEngine.
  if (!entity.allowedTransitions.includes(args.toState)) {
    throw new Error(`ObjectTransitionEngine rejected transition ${entity.currentState} -> ${args.toState}.`);
  }
  const requiredAuthority = DOMAIN_AUTHORITY_MATRIX[args.toState];
  if (requiredAuthority !== args.authority) {
    throw new Error(`ObjectTransitionEngine rejected authority ${args.authority}; ${requiredAuthority} owns ${args.toState}.`);
  }
  const prerequisiteResults = entity.requiredEvidenceForNextTransition.map((evidenceId) => ({
    evidenceId,
    status: args.evidenceIds.length ? "PASS" : "FAIL",
    reason: args.evidenceIds.length ? "evidence supplied" : "evidence missing",
  } satisfies ObjectTransitionEvidenceResult));
  if (prerequisiteResults.some((result) => result.status === "FAIL")) {
    throw new Error("ObjectTransitionEngine rejected transition because required evidence is missing.");
  }
  const timestamp = nowIso();
  const closureEvent: ClosureEvent = {
    closureEventId: `CE-${stableHash({ id: entity.objectId ?? entity.spanId ?? entity.closureSegmentId, from: entity.currentState, to: args.toState, timestamp })}`,
    objectId: typeof entity.objectId === "string" ? entity.objectId : undefined,
    spanId: typeof entity.spanId === "string" ? entity.spanId : undefined,
    closureSegmentId: typeof entity.closureSegmentId === "string" ? entity.closureSegmentId : undefined,
    fromState: entity.currentState,
    toState: args.toState,
    authority: args.authority,
    actor: args.actor,
    timestamp,
    evidenceIds: args.evidenceIds,
    prerequisiteResults,
    geometryAuthorityId: args.geometryAuthorityId,
    scopeVersionId: args.scopeVersionId,
    certifiedIofPackageId: args.certifiedIofPackageId,
    reason: args.reason,
    auditHash: stableHash({ entity, args, timestamp }),
  };
  const nextState = nextLifecycleState(args.toState);
  return {
    ...entity,
    previousState: entity.currentState,
    currentState: args.toState,
    currentLifecycleState: args.toState,
    nextState,
    currentAuthority: DOMAIN_AUTHORITY_MATRIX[args.toState],
    nextAuthority: nextState ? DOMAIN_AUTHORITY_MATRIX[nextState] : undefined,
    allowedTransitions: nextState ? [nextState] : [],
    requiredEvidenceForNextTransition: REQUIRED_EVIDENCE_BY_STATE[args.toState],
    closureEventHistory: [...entity.closureEventHistory, closureEvent],
    auditStatus: args.toState === "RETIRED" ? "CLOSED" : "OPEN",
    twinProjectionMetadata: {
      ...entity.twinProjectionMetadata,
      currentState: args.toState,
      currentAuthority: DOMAIN_AUTHORITY_MATRIX[args.toState],
    },
    lastClosureEventId: closureEvent.closureEventId,
  };
}

export function createClosureSegmentsForSpan(span: Record<string, unknown> & {
  spanId: string;
  measuredCenterlineId: string;
  startStation: string;
  endStation: string;
  startMeasure: number;
  endMeasure: number;
  lengthFeet: number;
}, args: {
  packageId: string;
  closureLedgerId: string;
}) {
  const length = Math.max(0, Number(span.lengthFeet) || Math.max(0, Number(span.endMeasure) - Number(span.startMeasure)));
  const segmentTypes: Array<{ workType: WorkSegmentType; constructionMethod: string; crewType: string; laborTemplate: string; materialTemplate: string; requiredEvidence: string[] }> = [
    { workType: "OPEN_TRENCH", constructionMethod: "OPEN_TRENCH", crewType: "CIVIL_CREW", laborTemplate: "LABOR:TRENCH", materialTemplate: "MATERIAL:CONDUIT", requiredEvidence: ["trench photo", "depth log"] },
    { workType: "FIBER_PULL", constructionMethod: "FIBER_PULL", crewType: "FIBER_CREW", laborTemplate: "LABOR:FIBER_PULL", materialTemplate: "MATERIAL:FIBER", requiredEvidence: ["pull ticket", "fiber reel"] },
    { workType: "TESTING", constructionMethod: "TESTING", crewType: "TEST_CREW", laborTemplate: "LABOR:TESTING", materialTemplate: "MATERIAL:TEST_EQUIPMENT", requiredEvidence: ["OTDR trace", "power meter result"] },
  ];
  return segmentTypes.map((segment, index) => {
    const base = {
      closureSegmentId: `${span.spanId}:CLOSURE-SEGMENT:${segment.workType}`,
      parentSpanId: span.spanId,
      measuredCenterlineId: span.measuredCenterlineId,
      workType: segment.workType,
      startStation: span.startStation,
      endStation: span.endStation,
      startMeasure: span.startMeasure,
      endMeasure: span.endMeasure,
      length,
      constructionMethod: segment.constructionMethod,
      crewType: segment.crewType,
      laborTemplate: segment.laborTemplate,
      materialTemplate: segment.materialTemplate,
      requiredEvidence: segment.requiredEvidence,
      closureEventIds: [],
      paymentEligibility: "NOT_ELIGIBLE_UNTIL_CLOSED" as const,
      productionQuantity: length,
      sequence: index + 1,
      noIndependentGeometry: true as const,
    };
    return initializeLifecycleState(base, {
      packageId: args.packageId,
      entityId: base.closureSegmentId,
      entityKind: "closureSegment",
      closureLedgerId: args.closureLedgerId,
      blockingDependencies: [span.spanId],
    }) satisfies WorkSegment;
  });
}

export function buildClosureLedger(args: {
  packageId: string;
  objects: Array<Record<string, unknown>>;
  spans: Array<Record<string, unknown>>;
  workSegments: WorkSegment[];
}) {
  return {
    closureLedgerId: `${args.packageId}:CLOSURE-LEDGER`,
    packageId: args.packageId,
    objectCount: args.objects.length,
    spanCount: args.spans.length,
    workSegmentCount: args.workSegments.length,
    closureEvents: [],
    authority: CLOSURE_LEDGER_AUTHORITY,
    transitionAuthority: CLOSURE_ENGINE_AUTHORITY,
    immutableAfterCreation: true,
    noScopeVersionCreation: true,
  } satisfies ClosureLedger;
}

export function buildIofPackageTwin(args: {
  packageId: string;
  objects: Array<Record<string, unknown>>;
  spans: Array<Record<string, unknown>>;
  workSegments: WorkSegment[];
  closureLedgerId: string;
}) {
  return {
    twinProjectionId: `${args.packageId}:IOF-PACKAGE-TWIN`,
    packageId: args.packageId,
    objectCount: args.objects.length,
    spanCount: args.spans.length,
    workSegmentCount: args.workSegments.length,
    currentAuthority: IOF_PACKAGE_TWIN_AUTHORITY,
    stateAuthority: CLOSURE_ENGINE_AUTHORITY,
    closureLedgerId: args.closureLedgerId,
    executionGraphId: `${args.packageId}:EXECUTION-GRAPH`,
    lifecycleGraphId: `${args.packageId}:LIFECYCLE-GRAPH`,
    domainLenses: {
      commercial: "What was assembled, proposed, and approved?",
      engineering: "What must be verified and certified?",
      marketplace: "What must be procured, fulfilled, or released?",
      control: "What can be authorized, blocked, or released?",
      field: "What must be installed, evidenced, and closed?",
      twin: "What is current operational truth?",
    },
    noScopeVersionCreation: true,
  } satisfies IofPackageTwinProjection;
}

export function commercialAuditReconciliation(args: {
  packageId: string;
  expectedObjectCount: number;
  renderedObjects: Array<Record<string, unknown>>;
  renderedSpans: Array<Record<string, unknown>>;
  stationCount: number;
}) {
  const renderedMaterialObjects = args.renderedObjects.filter((object) => Boolean(object.materialTemplate || object.materialTemplateId)).length;
  const renderedLaborObjects = args.renderedObjects.filter((object) => Boolean(object.laborTemplate || object.laborTemplateId)).length;
  const paymentSequenceCount = args.renderedObjects.filter((object) => Boolean(object.paymentSequenceId)).length;
  const closeSequenceCount = args.renderedObjects.filter((object) => Boolean(object.closeSequenceId)).length;
  const failures = [
    ...(args.expectedObjectCount === args.renderedObjects.length ? [] : [{
      objectClass: "PROJECTED_OBJECT",
      expectedCount: args.expectedObjectCount,
      actualCount: args.renderedObjects.length,
      blockingAuthority: "Commercial" as DomainAuthority,
    }]),
    ...(renderedMaterialObjects === args.renderedObjects.length ? [] : [{
      objectClass: "MATERIAL_TEMPLATE",
      expectedCount: args.renderedObjects.length,
      actualCount: renderedMaterialObjects,
      blockingAuthority: "Commercial" as DomainAuthority,
    }]),
    ...(renderedLaborObjects === args.renderedObjects.length ? [] : [{
      objectClass: "LABOR_TEMPLATE",
      expectedCount: args.renderedObjects.length,
      actualCount: renderedLaborObjects,
      blockingAuthority: "Commercial" as DomainAuthority,
    }]),
    ...(paymentSequenceCount === args.renderedObjects.length ? [] : [{
      objectClass: "PAYMENT_SEQUENCE",
      expectedCount: args.renderedObjects.length,
      actualCount: paymentSequenceCount,
      blockingAuthority: "Commercial" as DomainAuthority,
    }]),
    ...(closeSequenceCount === args.renderedObjects.length ? [] : [{
      objectClass: "CLOSE_SEQUENCE",
      expectedCount: args.renderedObjects.length,
      actualCount: closeSequenceCount,
      blockingAuthority: "Commercial" as DomainAuthority,
    }]),
  ];
  return {
    reconciliationId: `${args.packageId}:COMMERCIAL-AUDIT-RECONCILIATION`,
    status: failures.length ? "FAIL" : "PASS",
    expectedObjectCount: args.expectedObjectCount,
    renderedObjectCount: args.renderedObjects.length,
    expectedMaterialObjects: args.renderedObjects.length,
    renderedMaterialObjects,
    expectedLaborObjects: args.renderedObjects.length,
    renderedLaborObjects,
    stationCount: args.stationCount,
    spanCount: args.renderedSpans.length,
    paymentSequenceCount,
    closeSequenceCount,
    failures,
    authority: "COMMERCIAL_AUDIT_RECONCILIATION",
  } satisfies CommercialAuditReconciliation;
}

export function validateConstitutionalStateGraph(args: {
  objects: Array<Record<string, unknown>>;
  spans: Array<Record<string, unknown>>;
  workSegments: Array<Record<string, unknown>>;
  commercialAudit: CommercialAuditReconciliation;
  geometryAuthorityStatus?: string;
}) {
  const failures = [
    ...args.objects.filter((object) => !object.currentState).map((object) => `object lifecycle missing: ${object.objectId}`),
    ...args.spans.filter((span) => !span.currentState).map((span) => `span lifecycle missing: ${span.spanId}`),
    ...args.objects.filter((object) => !object.currentAuthority).map((object) => `object authority missing: ${object.objectId}`),
    ...args.spans.filter((span) => !span.currentAuthority).map((span) => `span authority missing: ${span.spanId}`),
    ...args.objects.filter((object) => !Array.isArray(object.allowedTransitions)).map((object) => `object allowed transitions missing: ${object.objectId}`),
    ...args.spans.filter((span) => !Array.isArray(span.allowedTransitions)).map((span) => `span allowed transitions missing: ${span.spanId}`),
    ...args.objects.filter((object) => !object.auditLedgerHooks).map((object) => `object audit hooks missing: ${object.objectId}`),
    ...args.spans.filter((span) => !span.auditLedgerHooks).map((span) => `span audit hooks missing: ${span.spanId}`),
    ...args.workSegments.filter((segment) => !segment.parentSpanId || !segment.measuredCenterlineId).map((segment) => `closure segment reference missing: ${segment.closureSegmentId}`),
    ...(args.commercialAudit.status === "PASS" ? [] : ["commercial audit reconciliation failed"]),
    ...(args.geometryAuthorityStatus === "PASS" ? [] : ["geometry authority is not PASS"]),
  ];
  return {
    validationId: "CONSTITUTIONAL-STATE-AUTHORITY-VALIDATION",
    status: failures.length ? "FAIL" : "PASS",
    objectCount: args.objects.length,
    spanCount: args.spans.length,
    workSegmentCount: args.workSegments.length,
    failures,
    transitionAuthority: CLOSURE_ENGINE_AUTHORITY,
    closureLedgerAuthority: CLOSURE_LEDGER_AUTHORITY,
  };
}
