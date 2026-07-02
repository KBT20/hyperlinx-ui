import type { ExecutionNode, KernelExecutionGraph } from "../ExecutionGraphContracts";
import {
  CLOSE_AUTHORITY_BY_TYPE,
  CLOSE_WORKSPACE_BY_TYPE,
  CONSTITUTIONAL_CLOSURE_AUTHORITY,
  SUPPORTED_CLOSE_TYPES,
  type CloseValidationResult,
  type ClosureLedger,
  type ConstitutionalClose,
  type ExecutionExpectation,
} from "./ClosureContracts";

function hasEvidence(close: ConstitutionalClose, evidence: string) {
  const target = evidence.toUpperCase();
  if (target.includes("GPS")) return close.gpsEvidence.length > 0 || close.evidenceReference.some((item) => item.toUpperCase().includes("GPS"));
  if (target.includes("PHOTO")) return close.photoEvidence.length > 0 || close.evidenceReference.some((item) => item.toUpperCase().includes("PHOTO"));
  if (target.includes("MEASUREMENT")) return close.attachments.some((item) => item.toUpperCase().includes("MEASURE")) || close.evidenceReference.some((item) => item.toUpperCase().includes("MEASURE"));
  if (target.includes("ATTESTATION")) return Boolean(close.notes.trim()) || close.evidenceReference.some((item) => item.toUpperCase().includes("ATTEST"));
  return close.evidenceReference.some((item) => item.toUpperCase().includes(target)) ||
    close.attachments.some((item) => item.toUpperCase().includes(target));
}

function previousCloseSatisfied(close: ConstitutionalClose, expectation: ExecutionExpectation, ledger: ClosureLedger) {
  const index = expectation.expectedCloseSequence.indexOf(close.closeType);
  if (index <= 0) return true;
  const previousCloseType = expectation.expectedCloseSequence[index - 1];
  return ledger.validatedCloses.some((candidate) => candidate.closeType === previousCloseType);
}

export function validateConstitutionalClose(input: {
  graph: KernelExecutionGraph;
  node?: ExecutionNode;
  expectation?: ExecutionExpectation;
  ledger: ClosureLedger;
  close: ConstitutionalClose;
  validatedAt?: string;
}): CloseValidationResult {
  const blockers: string[] = [];
  const warnings: string[] = [];
  const node = input.node ?? input.graph.nodes.find((candidate) => candidate.nodeId === input.close.nodeId);
  if (!node) blockers.push("Execution Object does not exist.");
  if (!input.expectation) blockers.push("Expectation does not exist.");
  if (!SUPPORTED_CLOSE_TYPES.includes(input.close.closeType)) blockers.push("Close type is not supported.");
  if (input.close.authority !== CLOSE_AUTHORITY_BY_TYPE[input.close.closeType]) blockers.push("Authority is not valid for close type.");
  if (input.close.workspace !== CLOSE_WORKSPACE_BY_TYPE[input.close.closeType]) blockers.push("Workspace is not valid for close type.");
  if (node && input.close.executionObjectId !== node.sourceArtifactId) blockers.push("Object reference is invalid.");
  if (node && input.close.spineObjectId !== node.sourceArtifactId) blockers.push("Spine Object reference is invalid.");
  if (node && !input.close.spineObjectIds.includes(node.sourceArtifactId)) blockers.push("Close must attach to one or more Spine Objects.");
  if (node && input.close.nodeId !== node.nodeId) blockers.push("Execution node reference is invalid.");
  if (node && (node.stationId || node.parentStationId || node.fromStationId) && !input.close.stationId) blockers.push("Station reference is missing.");
  if (input.close.stationId && !input.graph.nodes.some((candidate) => candidate.nodeType === "STATION" && candidate.stationId === input.close.stationId)) {
    blockers.push("Station reference is invalid.");
  }
  if (input.expectation && !previousCloseSatisfied(input.close, input.expectation, input.ledger)) {
    blockers.push("Previous required Close does not exist.");
  }
  if (input.expectation) {
    input.expectation.expectedEvidence
      .filter((evidence) => !hasEvidence(input.close, evidence))
      .forEach((evidence) => blockers.push(`Required evidence missing: ${evidence}`));
    input.expectation.expectedMeasurements
      .filter((measurement) => measurement.required && !hasEvidence(input.close, measurement.label))
      .forEach((measurement) => blockers.push(`Required measurement missing: ${measurement.label}`));
  }
  if (input.close.closeType === "FIELD_REDLINE_CLOSE") {
    const redline = input.close.redline ?? {};
    if (!input.close.notes.trim()) blockers.push("Field Redline Close requires notes.");
    if (!input.close.gpsEvidence.length) blockers.push("Field Redline Close requires gps evidence.");
    if (!input.close.photoEvidence.length) blockers.push("Field Redline Close requires photo evidence.");
    if (!Object.values(redline).some((value) => value !== undefined && value !== "")) blockers.push("Field Redline Close requires redline detail.");
  }
  if (input.close.closeType === "ENGINEERING_ACCEPTANCE_CLOSE" && input.close.requiresScopeVersionDelta) {
    warnings.push("Engineering Acceptance Close indicates a future ScopeVersion delta but does not create one.");
  }
  if (Object.prototype.hasOwnProperty.call(input.close, "scopeVersionId")) blockers.push("Close cannot modify or create ScopeVersion.");
  return {
    status: blockers.length ? "REJECTED" : "ACCEPTED",
    accepted: blockers.length === 0,
    blockers,
    warnings,
    validatedAt: input.validatedAt ?? input.close.timestamp,
    authority: CONSTITUTIONAL_CLOSURE_AUTHORITY,
  };
}
