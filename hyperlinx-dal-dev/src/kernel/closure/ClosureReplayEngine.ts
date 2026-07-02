import type { ExecutionNode, KernelExecutionGraph } from "../ExecutionGraphContracts";
import {
  CLOSE_AUTHORITY_BY_TYPE,
  CONSTITUTIONAL_CLOSURE_AUTHORITY,
  type ClosureLedger,
  type ClosureReplayResult,
  type ConstitutionalCloseType,
  type DerivedCurrentTruth,
  type ExecutionExpectation,
  type NextDeterministicClose,
} from "./ClosureContracts";

function acceptedCloseTypes(ledger: ClosureLedger) {
  return ledger.validatedCloses.map((close) => close.closeType);
}

export function getNextDeterministicClose(input: {
  node: ExecutionNode;
  expectation?: ExecutionExpectation;
  ledger: ClosureLedger;
  graph?: KernelExecutionGraph;
}): NextDeterministicClose {
  const expectation = input.expectation;
  if (!expectation) {
    return {
      executionObjectId: input.node.sourceArtifactId,
      spineObjectId: input.node.sourceArtifactId,
      nodeId: input.node.nodeId,
      requiredEvidence: [],
      requiredDependencies: [],
      requiredDoctrine: [],
      blockingIssues: ["execution expectation missing"],
      readiness: "BLOCKED",
      authority: CONSTITUTIONAL_CLOSURE_AUTHORITY,
      noScopeVersionCreation: true,
    };
  }
  const accepted = new Set(acceptedCloseTypes(input.ledger));
  const expectedClose = expectation.expectedCloseSequence.find((closeType) => !accepted.has(closeType));
  if (!expectedClose) {
    return {
      executionObjectId: expectation.executionObjectId,
      spineObjectId: expectation.spineObjectId,
      nodeId: expectation.nodeId,
      requiredEvidence: [],
      requiredDependencies: [],
      requiredDoctrine: expectation.expectedDoctrine,
      blockingIssues: [],
      readiness: "COMPLETE",
      authority: CONSTITUTIONAL_CLOSURE_AUTHORITY,
      noScopeVersionCreation: true,
    };
  }
  const dependencyIssues = expectation.expectedDependencies.filter((dependencyId) => {
    const dependency = input.graph?.nodes.find((node) => node.nodeId === dependencyId);
    const truth = dependency?.currentTruth as DerivedCurrentTruth | undefined;
    return truth && !["PROVEN", "OPERATIONAL", "RETIRED"].includes(truth.status);
  }).map((dependencyId) => `dependency not proven: ${dependencyId}`);
  return {
    executionObjectId: expectation.executionObjectId,
    spineObjectId: expectation.spineObjectId,
    nodeId: expectation.nodeId,
    expectedClose,
    requiredAuthority: CLOSE_AUTHORITY_BY_TYPE[expectedClose],
    requiredEvidence: expectation.expectedEvidence,
    requiredDependencies: expectation.expectedDependencies,
    requiredDoctrine: expectation.expectedDoctrine,
    blockingIssues: dependencyIssues,
    readiness: dependencyIssues.length ? "BLOCKED" : "READY",
    authority: CONSTITUTIONAL_CLOSURE_AUTHORITY,
    noScopeVersionCreation: true,
  };
}

export function replayObject(input: {
  node: ExecutionNode;
  expectation?: ExecutionExpectation;
  ledger: ClosureLedger;
  graph?: KernelExecutionGraph;
  replayedAt?: string;
}): ClosureReplayResult {
  const validated = input.ledger.validatedCloses;
  const acceptedTypes = acceptedCloseTypes(input.ledger);
  const lastClose = validated[validated.length - 1];
  const allExpectedSatisfied = input.expectation
    ? input.expectation.expectedCloseSequence.every((closeType) => acceptedTypes.includes(closeType))
    : false;
  const redlineCount = validated.filter((close) => close.closeType === "FIELD_REDLINE_CLOSE").length;
  const requiresScopeVersionDelta = validated.some((close) => close.requiresScopeVersionDelta === true);
  const status: DerivedCurrentTruth["status"] = !validated.length
    ? "NO_CLOSES"
    : validated.some((close) => close.closeType === "RETIREMENT_CLOSE")
      ? "RETIRED"
      : validated.some((close) => close.closeType === "OPERATIONAL_CLOSE")
        ? "OPERATIONAL"
        : allExpectedSatisfied
          ? "PROVEN"
          : redlineCount
            ? "REDLINED"
            : "PARTIAL";
  const next = getNextDeterministicClose(input);
  const currentTruth: DerivedCurrentTruth = {
    executionObjectId: input.node.sourceArtifactId,
    spineObjectId: input.node.sourceArtifactId,
    nodeId: input.node.nodeId,
    status,
    derivedFromCloseIds: validated.map((close) => close.closeId),
    rejectedCloseIds: input.ledger.rejectedCloses.map((close) => close.closeId),
    lastCloseId: lastClose?.closeId,
    lastCloseType: lastClose?.closeType,
    nextExpectedClose: next.expectedClose,
    acceptedCloseTypes: acceptedTypes,
    evidenceIds: Array.from(new Set(validated.flatMap((close) => close.evidenceReference))),
    redlineCount,
    requiresScopeVersionDelta,
    derivedAt: input.replayedAt ?? new Date().toISOString(),
    mutableStateStored: false,
    derivedStateRule: "STATE_DERIVED_ONLY_FROM_VALIDATED_CLOSE_REPLAY",
    paymentEligibility: ["PROVEN", "OPERATIONAL", "RETIRED"].includes(status) ? "ELIGIBLE_AFTER_SEGMENT_ACCEPTANCE" : "NOT_ELIGIBLE",
    revenueRealization: ["PROVEN", "OPERATIONAL", "RETIRED"].includes(status) ? "ELIGIBLE_AFTER_VALIDATED_PAYMENT" : "NOT_REALIZED",
    authority: CONSTITUTIONAL_CLOSURE_AUTHORITY,
  };
  return {
    executionObjectId: input.node.sourceArtifactId,
    spineObjectId: input.node.sourceArtifactId,
    nodeId: input.node.nodeId,
    expectation: input.expectation,
    ledger: input.ledger,
    currentTruth,
    nextDeterministicClose: next,
  };
}

export function replayStation(graph: KernelExecutionGraph, stationId: string) {
  const stationObjects = graph.nodes.filter((node) => node.stationId === stationId || node.parentStationId === stationId || node.fromStationId === stationId);
  return {
    stationId,
    executionObjectCount: stationObjects.length,
    currentTruth: stationObjects.map((node) => node.currentTruth).filter(Boolean),
  };
}

export function replayCorridor(graph: KernelExecutionGraph) {
  return replayGraph(graph);
}

export function replayPackage(graph: KernelExecutionGraph) {
  return replayGraph(graph);
}

export function replayGraph(graph: KernelExecutionGraph) {
  const truths = graph.nodes
    .map((node) => node.currentTruth as DerivedCurrentTruth | undefined)
    .filter((truth): truth is DerivedCurrentTruth => Boolean(truth));
  return {
    graphId: graph.graphId,
    packageId: graph.packageId,
    executionObjectCount: truths.length,
    provenCount: truths.filter((truth) => truth.status === "PROVEN").length,
    redlineCount: truths.reduce((sum, truth) => sum + truth.redlineCount, 0),
    requiresScopeVersionDelta: truths.some((truth) => truth.requiresScopeVersionDelta),
    derivedFromValidatedCloseCount: truths.reduce((sum, truth) => sum + truth.derivedFromCloseIds.length, 0),
    mutableStateStored: false,
    authority: CONSTITUTIONAL_CLOSURE_AUTHORITY,
  };
}
