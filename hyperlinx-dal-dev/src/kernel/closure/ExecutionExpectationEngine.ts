import type { ExecutionNode, ExecutionNodeType, KernelExecutionGraph } from "../ExecutionGraphContracts";
import {
  CONSTITUTIONAL_CLOSURE_AUTHORITY,
  type ConstitutionalCloseType,
  type ExecutionExpectation,
  type ExpectedMeasurement,
  type ExpectedQuantity,
} from "./ClosureContracts";

const EXECUTION_OBJECT_TYPES = new Set<ExecutionNodeType>([
  "STATION_RANGE",
  "ENGINEERING_OBJECT",
  "HANDHOLE",
  "VAULT",
  "SPLICE_CASE",
  "MARKER",
  "PULL_POINT",
  "CONDUIT_SEGMENT",
  "FIBER_SEGMENT",
  "ILA",
  "REGEN",
  "STATIONED_EXPECTATION",
  "COMMERCIAL_REVIEW_OBJECT",
  "AUDIT_REVIEW_OBJECT",
  "CLOSURE_EXPECTATION",
  "MARKETPLACE_PACKAGE",
  "CONTROL_RELEASE",
  "FIELD_CLOSURE",
  "OPERATIONAL_ASSET",
  "LIFECYCLE_OBLIGATION",
]);

function asNumber(value: unknown, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function asString(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function asArray<T = unknown>(value: unknown): T[] {
  return Array.isArray(value) ? value as T[] : [];
}

function quantityForNode(node: ExecutionNode): ExpectedQuantity[] {
  const expectedQuantity = asNumber(node.metadata.expectedQuantity ?? node.metadata.quantityFeet ?? node.metadata.edgeLengthFeet, 0);
  const unit = asString(node.metadata.quantityUnit, node.nodeType === "STATION_RANGE" ? "feet" : "count");
  return expectedQuantity > 0 ? [{
    quantityId: `${node.nodeId}:EXPECTED-QUANTITY`,
    label: `${node.label} expected quantity`,
    value: expectedQuantity,
    unit,
    tolerancePercent: 5,
  }] : [];
}

function measurementsForNode(node: ExecutionNode): ExpectedMeasurement[] {
  const base: ExpectedMeasurement[] = [
    { measurementId: `${node.nodeId}:MEASURE:STATION`, label: "Station reference", unit: "station", required: true },
  ];
  if (node.nodeType === "STATION_RANGE" || node.nodeType === "CONDUIT_SEGMENT" || node.nodeType === "FIBER_SEGMENT") {
    base.push({ measurementId: `${node.nodeId}:MEASURE:FOOTAGE`, label: "Installed footage", unit: "feet", required: true, tolerance: 5 });
  }
  if (node.nodeType === "HANDHOLE" || node.nodeType === "VAULT" || node.nodeType === "SPLICE_CASE") {
    base.push({ measurementId: `${node.nodeId}:MEASURE:DEPTH`, label: "Placement depth", unit: "feet", required: true, tolerance: 1 });
  }
  return base;
}

export function isExecutionObjectNode(node: ExecutionNode) {
  return EXECUTION_OBJECT_TYPES.has(node.nodeType);
}

export function expectedCloseSequenceForNode(node: ExecutionNode): ConstitutionalCloseType[] {
  if (node.nodeType === "CONDUIT_SEGMENT" || node.nodeType === "STATION_RANGE") {
    return ["CONSTRUCTION_CLOSE", "PLACEMENT_CLOSE", "INSPECTION_CLOSE", "ACCEPTANCE_CLOSE"];
  }
  if (node.nodeType === "FIBER_SEGMENT") {
    return ["FIBER_PLACEMENT_CLOSE", "TESTING_CLOSE", "ACCEPTANCE_CLOSE"];
  }
  if (node.nodeType === "SPLICE_CASE") {
    return ["SPLICE_CLOSE", "TESTING_CLOSE", "ACCEPTANCE_CLOSE"];
  }
  if (node.nodeType === "COMMERCIAL_REVIEW_OBJECT" || node.nodeType === "AUDIT_REVIEW_OBJECT") {
    return ["ENGINEERING_CLOSE", "ENGINEERING_ACCEPTANCE_CLOSE"];
  }
  if (node.nodeType === "CLOSURE_EXPECTATION" || node.nodeType === "STATIONED_EXPECTATION") {
    return ["CONSTRUCTION_CLOSE", "INSPECTION_CLOSE", "ACCEPTANCE_CLOSE"];
  }
  if (node.nodeType === "OPERATIONAL_ASSET" || node.nodeType === "LIFECYCLE_OBLIGATION") {
    return ["OPERATIONAL_CLOSE", "MAINTENANCE_CLOSE"];
  }
  return ["CONSTRUCTION_CLOSE", "INSPECTION_CLOSE", "ACCEPTANCE_CLOSE"];
}

export function expectedEvidenceForNode(node: ExecutionNode) {
  const explicit = asArray<string>(node.metadata.requiredEvidence);
  const evidence = explicit.length ? explicit : ["GPS", "PHOTO", "MEASUREMENT", "ACTOR_ATTESTATION"];
  return Array.from(new Set(evidence));
}

export function createExecutionExpectation(node: ExecutionNode, graph?: Pick<KernelExecutionGraph, "graphId">): ExecutionExpectation | undefined {
  if (!isExecutionObjectNode(node)) return undefined;
  const expectedCloseSequence = expectedCloseSequenceForNode(node);
  return {
    expectationId: `${node.nodeId}:EXECUTION-EXPECTATION`,
    executionObjectId: node.sourceArtifactId,
    spineObjectId: node.sourceArtifactId,
    spineObjectType: node.nodeType,
    nodeId: node.nodeId,
    nodeType: node.nodeType,
    stationId: node.stationId ?? node.parentStationId ?? node.fromStationId,
    stationLabel: node.stationLabel,
    measureFeet: node.measureFeet ?? node.fromMeasureFeet,
    coordinate: node.coordinate,
    expectedWork: [node.label, asString(node.metadata.expectedWork, "")].filter(Boolean),
    expectedMaterials: asArray<string>(node.metadata.expectedMaterials),
    expectedQuantities: quantityForNode(node),
    expectedEvidence: expectedEvidenceForNode(node),
    expectedMeasurements: measurementsForNode(node),
    expectedTolerance: {
      stationFeet: 100,
      coordinateFeet: 50,
      quantityPercent: 5,
      measurementPercent: 5,
    },
    expectedDoctrine: [
      {
        doctrineId: asString(node.metadata.doctrineId, "KERNEL_EXECUTION_GRAPH"),
        authority: node.authority,
        source: graph?.graphId ?? node.packageId,
      },
    ],
    expectedDependencies: [...node.dependencies],
    expectedAcceptanceCriteria: [
      "Execution object reference is valid.",
      "Spine Object reference is valid.",
      "Station reference is valid.",
      "Required evidence is attached.",
      "Required measurements are supplied.",
      "Previous required close exists when sequence requires it.",
      "Payment is not eligible until validated Closes satisfy the Spine Object and segment acceptance can be derived.",
    ],
    expectedCloseSequence,
    legalCloseSequence: expectedCloseSequence,
    dependencyGraphNotSchedule: true,
    paymentEligibilityRule: "NO_CLOSE_NO_VALIDATION_NO_PAYMENT",
    immutable: true,
    authority: CONSTITUTIONAL_CLOSURE_AUTHORITY,
    noScopeVersionCreation: true,
  };
}

export function createExecutionExpectations(graph: KernelExecutionGraph) {
  return graph.nodes
    .map((node) => createExecutionExpectation(node, graph))
    .filter((expectation): expectation is ExecutionExpectation => Boolean(expectation));
}
