import type { ExecutionNode, KernelExecutionGraph } from "../ExecutionGraphContracts";
import { stableKernelHash } from "../KernelExecutionGraph";
import {
  CONSTITUTIONAL_ASSEMBLY_AUTHORITY,
  CLOSE_AUTHORITY_BY_TYPE,
  CLOSE_WORKSPACE_BY_TYPE,
  CONSTITUTIONAL_CLOSURE_AUTHORITY,
  type ClosureGraphEnrichmentSummary,
  type ConstitutionalAssemblyResult,
  type ConstitutionalClose,
  type ConstitutionalCloseType,
  type ExecutionExpectation,
} from "./ClosureContracts";
import { createClosureLedger, ledgerHashFor } from "./ClosureLedger";
import { replayGraph, replayObject, getNextDeterministicClose } from "./ClosureReplayEngine";
import { validateConstitutionalClose } from "./ClosureValidationEngine";
import { createExecutionExpectation, createExecutionExpectations } from "./ExecutionExpectationEngine";

export { getNextDeterministicClose } from "./ClosureReplayEngine";

function closeIdFor(input: {
  nodeId: string;
  closeType: ConstitutionalCloseType;
  timestamp: string;
  actor: string;
  previousCloseId?: string;
}) {
  return stableKernelHash(input).replace(/^KEG-/, "CLOSE-");
}

function closesForNode(closes: ConstitutionalClose[], node: ExecutionNode) {
  return closes.filter((close) => (
    close.nodeId === node.nodeId ||
    close.executionObjectId === node.sourceArtifactId ||
    close.spineObjectId === node.sourceArtifactId ||
    close.spineObjectIds?.includes(node.sourceArtifactId)
  ));
}

export function validateConstitutionalAssembly(input: {
  graph: Pick<KernelExecutionGraph, "graphId" | "packageId">;
  expectations: ExecutionExpectation[];
  validatedAt?: string;
}): ConstitutionalAssemblyResult {
  const blockingIssues: string[] = [];
  const expectations = input.expectations;
  const doctrineCount = expectations.filter((expectation) => expectation.expectedDoctrine.length > 0).length;
  const dependencyGraphCount = expectations.filter((expectation) => Array.isArray(expectation.expectedDependencies) && expectation.dependencyGraphNotSchedule === true).length;
  const legalCloseSequenceCount = expectations.filter((expectation) => expectation.legalCloseSequence.length > 0).length;
  const evidenceRequirementCount = expectations.filter((expectation) => expectation.expectedEvidence.length > 0).length;
  const paymentValidationRelationshipCount = expectations.filter((expectation) => expectation.paymentEligibilityRule === "NO_CLOSE_NO_VALIDATION_NO_PAYMENT").length;
  if (!expectations.length) blockingIssues.push("no Spine Objects assembled");
  expectations.forEach((expectation) => {
    if (!expectation.spineObjectId) blockingIssues.push(`Spine Object missing: ${expectation.expectationId}`);
    if (!expectation.expectedDoctrine.length) blockingIssues.push(`doctrine missing: ${expectation.spineObjectId}`);
    if (!Array.isArray(expectation.expectedDependencies) || expectation.dependencyGraphNotSchedule !== true) blockingIssues.push(`dependency graph missing: ${expectation.spineObjectId}`);
    if (!expectation.legalCloseSequence.length) blockingIssues.push(`legal Close sequence missing: ${expectation.spineObjectId}`);
    if (!expectation.expectedEvidence.length) blockingIssues.push(`evidence requirements missing: ${expectation.spineObjectId}`);
    if (expectation.paymentEligibilityRule !== "NO_CLOSE_NO_VALIDATION_NO_PAYMENT") blockingIssues.push(`payment validation relationship missing: ${expectation.spineObjectId}`);
  });
  return {
    assemblyId: `${input.graph.packageId}:CONSTITUTIONAL-ASSEMBLY`,
    packageId: input.graph.packageId,
    graphId: input.graph.graphId,
    status: blockingIssues.length ? "FAIL" : "PASS",
    spineObjectCount: expectations.length,
    doctrineCount,
    dependencyGraphCount,
    legalCloseSequenceCount,
    evidenceRequirementCount,
    paymentValidationRelationshipCount,
    blockingIssues,
    validatedAt: input.validatedAt ?? new Date().toISOString(),
    authority: CONSTITUTIONAL_ASSEMBLY_AUTHORITY,
    draftIofApprovalProhibitedUntilPass: true,
    noScopeVersionCreation: true,
    noServiceOrderCreation: true,
    noMarketplaceCreation: true,
    noControlCreation: true,
  };
}

export function createConstitutionalClose(input: {
  graph: KernelExecutionGraph;
  nodeId: string;
  closeType: ConstitutionalCloseType;
  actor: string;
  timestamp: string;
  reason?: string;
  evidenceReference?: string[];
  attachments?: string[];
  gpsEvidence?: ConstitutionalClose["gpsEvidence"];
  photoEvidence?: ConstitutionalClose["photoEvidence"];
  notes?: string;
  previousCloseId?: string;
  existingCloses?: ConstitutionalClose[];
  redline?: ConstitutionalClose["redline"];
  requiresScopeVersionDelta?: boolean;
}): ConstitutionalClose {
  const node = input.graph.nodes.find((candidate) => candidate.nodeId === input.nodeId);
  if (!node) throw new Error(`Execution Object not found: ${input.nodeId}`);
  const expectation = createExecutionExpectation(node, input.graph);
  const ledger = createClosureLedger({
    graph: input.graph,
    node,
    expectation,
    closes: input.existingCloses ?? [],
  });
  const closeId = closeIdFor({
    nodeId: node.nodeId,
    closeType: input.closeType,
    timestamp: input.timestamp,
    actor: input.actor,
    previousCloseId: input.previousCloseId ?? ledger.validatedCloses[ledger.validatedCloses.length - 1]?.closeId,
  });
  const draftValidation = {
    status: "REJECTED" as const,
    accepted: false,
    blockers: ["Close not validated."],
    warnings: [],
    validatedAt: input.timestamp,
    authority: CONSTITUTIONAL_CLOSURE_AUTHORITY,
  };
  const draftClose: ConstitutionalClose = {
    closeId,
    executionObjectId: node.sourceArtifactId,
    spineObjectId: node.sourceArtifactId,
    spineObjectIds: [node.sourceArtifactId],
    nodeId: node.nodeId,
    stationId: node.stationId ?? node.parentStationId ?? node.fromStationId,
    stationLabel: node.stationLabel,
    measureFeet: node.measureFeet ?? node.fromMeasureFeet,
    coordinate: node.coordinate,
    closeType: input.closeType,
    workspace: CLOSE_WORKSPACE_BY_TYPE[input.closeType],
    authority: CLOSE_AUTHORITY_BY_TYPE[input.closeType],
    actor: input.actor,
    timestamp: input.timestamp,
    expectationReference: expectation?.expectationId ?? "",
    evidenceReference: input.evidenceReference ?? [],
    validationResult: draftValidation,
    accepted: false,
    reason: input.reason ?? "",
    attachments: input.attachments ?? [],
    gpsEvidence: input.gpsEvidence ?? [],
    photoEvidence: input.photoEvidence ?? [],
    notes: input.notes ?? "",
    previousCloseId: input.previousCloseId ?? ledger.validatedCloses[ledger.validatedCloses.length - 1]?.closeId,
    ledgerHash: "",
    immutable: true,
    redline: input.redline,
    requiresScopeVersionDelta: input.requiresScopeVersionDelta,
    noScopeVersionCreation: true,
    noServiceOrderCreation: true,
    noMarketplaceCreation: true,
    noControlCreation: true,
  };
  const validationResult = validateConstitutionalClose({
    graph: input.graph,
    node,
    expectation,
    ledger,
    close: draftClose,
    validatedAt: input.timestamp,
  });
  const ledgerHash = ledgerHashFor({
    graphId: input.graph.graphId,
    nodeId: node.nodeId,
    expectationId: expectation?.expectationId,
    closes: [{ ...draftClose, validationResult, accepted: validationResult.accepted }],
  });
  return {
    ...draftClose,
    validationResult,
    accepted: validationResult.accepted,
    ledgerHash,
  };
}

export function enrichKernelExecutionGraphWithClosures(input: {
  graph: KernelExecutionGraph;
  closes?: ConstitutionalClose[];
  generatedAt?: string;
}): KernelExecutionGraph {
  const closes = input.closes ?? [];
  const originalNodeCount = input.graph.nodes.length;
  const originalEdgeCount = input.graph.edges.length;
  const nodes = input.graph.nodes.map((node) => {
    const expectation = createExecutionExpectation(node, input.graph);
    if (!expectation) {
      return {
        ...node,
        executionObject: undefined,
        closureLedger: undefined,
        expectation: undefined,
        validatedCloses: [],
        pendingCloses: [],
        rejectedCloses: [],
        currentTruth: undefined,
        lastClose: undefined,
        nextExpectedClose: undefined,
        dependencyStatus: "NOT_EXECUTION_OBJECT",
      };
    }
    const ledger = createClosureLedger({
      graph: input.graph,
      node,
      expectation,
      closes: closesForNode(closes, node),
    });
    const replay = replayObject({
      node,
      expectation,
      ledger,
      graph: input.graph,
      replayedAt: input.generatedAt,
    });
    return {
      ...node,
      executionObject: {
        identity: node.identity,
        nodeId: node.nodeId,
        executionObjectId: node.sourceArtifactId,
        spineObjectId: node.sourceArtifactId,
        stationId: node.stationId ?? node.parentStationId ?? node.fromStationId,
        measureFeet: node.measureFeet ?? node.fromMeasureFeet,
        coordinate: node.coordinate,
      },
      closureLedger: ledger,
      expectation,
      validatedCloses: ledger.validatedCloses,
      pendingCloses: ledger.pendingCloses,
      rejectedCloses: ledger.rejectedCloses,
      currentTruth: replay.currentTruth,
      lastClose: ledger.validatedCloses[ledger.validatedCloses.length - 1],
      nextExpectedClose: replay.nextDeterministicClose,
      dependencyStatus: replay.nextDeterministicClose.readiness,
    };
  });
  const expectations = createExecutionExpectations({ ...input.graph, nodes });
  const ledgers = nodes.map((node) => node.closureLedger).filter(Boolean);
  const constitutionalAssembly = validateConstitutionalAssembly({
    graph: input.graph,
    expectations,
    validatedAt: input.generatedAt,
  });
  const summary: ClosureGraphEnrichmentSummary = {
    graphId: input.graph.graphId,
    packageId: input.graph.packageId,
    expectationCount: expectations.length,
    ledgerCount: ledgers.length,
    validatedCloseCount: ledgers.reduce((sum, ledger: any) => sum + ledger.acceptedCloseCount, 0),
    rejectedCloseCount: ledgers.reduce((sum, ledger: any) => sum + ledger.rejectedCloseCount, 0),
    pendingCloseCount: ledgers.reduce((sum, ledger: any) => sum + ledger.pendingCloseCount, 0),
    topologyNodeCountUnchanged: originalNodeCount,
    topologyEdgeCountUnchanged: originalEdgeCount,
    authority: CONSTITUTIONAL_CLOSURE_AUTHORITY,
    noScopeVersionCreation: true,
    noServiceOrderCreation: true,
    noMarketplaceCreation: true,
    noControlCreation: true,
  };
  return {
    ...input.graph,
    nodes,
    closureLedgers: ledgers,
    executionExpectations: expectations,
    closureReplaySummary: replayGraph({ ...input.graph, nodes }),
    constitutionalClosureSummary: summary,
    constitutionalAssembly,
  };
}
