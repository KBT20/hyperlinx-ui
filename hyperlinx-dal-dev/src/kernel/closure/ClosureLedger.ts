import type { ExecutionNode, KernelExecutionGraph } from "../ExecutionGraphContracts";
import { stableKernelHash } from "../KernelExecutionGraph";
import {
  CONSTITUTIONAL_CLOSURE_AUTHORITY,
  type ClosureLedger,
  type ConstitutionalClose,
  type ExecutionExpectation,
} from "./ClosureContracts";

function sortCloses(closes: ConstitutionalClose[]) {
  return [...closes].sort((a, b) => `${a.timestamp}:${a.closeId}`.localeCompare(`${b.timestamp}:${b.closeId}`));
}

export function ledgerHashFor(input: {
  graphId: string;
  nodeId: string;
  expectationId?: string;
  closes: ConstitutionalClose[];
}) {
  return stableKernelHash({
    graphId: input.graphId,
    nodeId: input.nodeId,
    expectationId: input.expectationId,
    closes: sortCloses(input.closes).map((close) => ({
      closeId: close.closeId,
      closeType: close.closeType,
      accepted: close.accepted,
      validationStatus: close.validationResult.status,
      timestamp: close.timestamp,
      previousCloseId: close.previousCloseId,
    })),
  });
}

export function createClosureLedger(input: {
  graph: Pick<KernelExecutionGraph, "graphId" | "packageId">;
  node: ExecutionNode;
  expectation?: ExecutionExpectation;
  closes?: ConstitutionalClose[];
}): ClosureLedger {
  const closes = sortCloses(input.closes ?? []).filter((close) => (
    close.nodeId === input.node.nodeId ||
    close.executionObjectId === input.node.sourceArtifactId ||
    close.spineObjectId === input.node.sourceArtifactId ||
    close.spineObjectIds?.includes(input.node.sourceArtifactId)
  ));
  const validatedCloses = closes.filter((close) => close.accepted);
  const rejectedCloses = closes.filter((close) => close.validationResult.status === "REJECTED");
  const pendingCloses = closes.filter((close) => !close.accepted && close.validationResult.status !== "REJECTED");
  const ledgerHash = ledgerHashFor({
    graphId: input.graph.graphId,
    nodeId: input.node.nodeId,
    expectationId: input.expectation?.expectationId,
    closes,
  });
  return {
    ledgerId: `${input.node.nodeId}:CLOSURE-LEDGER`,
    packageId: input.graph.packageId,
    graphId: input.graph.graphId,
    executionObjectId: input.node.sourceArtifactId,
    spineObjectId: input.node.sourceArtifactId,
    nodeId: input.node.nodeId,
    expectationId: input.expectation?.expectationId,
    closes,
    validatedCloses,
    rejectedCloses,
    pendingCloses,
    acceptedCloseCount: validatedCloses.length,
    rejectedCloseCount: rejectedCloses.length,
    pendingCloseCount: pendingCloses.length,
    ledgerHash,
    immutable: true,
    authority: CONSTITUTIONAL_CLOSURE_AUTHORITY,
    noScopeVersionCreation: true,
  };
}

export function appendCloseToLedger(ledger: ClosureLedger, close: ConstitutionalClose): ClosureLedger {
  return createClosureLedger({
    graph: { graphId: ledger.graphId, packageId: ledger.packageId },
    node: {
      nodeId: ledger.nodeId,
      sourceArtifactId: ledger.executionObjectId,
      packageId: ledger.packageId,
    } as ExecutionNode,
    expectation: ledger.expectationId ? { expectationId: ledger.expectationId } as ExecutionExpectation : undefined,
    closes: [...ledger.closes, close],
  });
}
