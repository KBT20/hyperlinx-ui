import type {
  AuthorizedStation,
  MeasuredSpine,
  ObjectStationAttachment,
  StationAuthority,
  StationIndexedGraph,
  StationIndex,
  StationToCoordinateMap,
} from "../spine/SpineAuthorityContracts";
import type {
  ClosureExpectation,
  SpineAuditProjection,
  SpineReviewObject,
  StationedExpectation,
  StationRangeExpectation,
} from "../spine/SpineAuditProjectionContracts";
import { createExecutionEdge } from "./ExecutionEdge";
import { createExecutionNode } from "./ExecutionNode";
import { enrichKernelExecutionGraphWithClosures } from "./closure/ClosureEngine";
import {
  EXECUTION_GRAPH_PROJECTION_LAYERS,
  type ExecutionEdge,
  type ExecutionGraphProjectionLayer,
  type ExecutionGraphValidationResult,
  type ExecutionNode,
  type ExecutionNodeType,
} from "./ExecutionGraphContracts";
import { buildKernelExecutionGraphProjections } from "./ExecutionGraphProjection";
import { createKernelExecutionGraph } from "./KernelExecutionGraph";

type JsonObject = Record<string, unknown>;

export type KernelExecutionGraphBuilderInput = {
  packageId: string;
  measuredSpine: MeasuredSpine;
  stationAuthority: StationAuthority;
  stationIndex?: StationIndex;
  stationToCoordinateMap?: StationToCoordinateMap;
  stationIndexedGraph?: StationIndexedGraph | null;
  engineeringObjects?: unknown[];
  objectStationAttachments?: ObjectStationAttachment[];
  spineAuditProjection?: SpineAuditProjection | null;
  closureExpectations?: ClosureExpectation[];
  generatedAt?: string;
};

function asRecord(value: unknown): JsonObject {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : {};
}

function asString(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function objectIdFor(object: unknown, packageId: string, index: number) {
  const record = asRecord(object);
  return asString(
    record.objectId ?? record.unitId ?? record.structureId ?? record.segmentId ?? record.id ?? record.runtimeObjectId,
    `${packageId}:OBJECT:${String(index + 1).padStart(6, "0")}`,
  );
}

function objectTypeFor(object: unknown): string {
  const record = asRecord(object);
  const metadata = asRecord(record.metadata);
  return asString(record.objectType ?? record.unitType ?? record.structureType ?? metadata.objectType, "ENGINEERING_OBJECT").toUpperCase();
}

function executionTypeForObject(objectType: string): ExecutionNodeType {
  if (objectType.includes("HANDHOLE")) return "HANDHOLE";
  if (objectType.includes("VAULT")) return "VAULT";
  if (objectType.includes("SPLICE")) return "SPLICE_CASE";
  if (objectType.includes("MARKER")) return "MARKER";
  if (objectType.includes("PULL")) return "PULL_POINT";
  if (objectType.includes("CONDUIT")) return "CONDUIT_SEGMENT";
  if (objectType.includes("FIBER")) return "FIBER_SEGMENT";
  if (objectType.includes("ILA")) return "ILA";
  if (objectType.includes("REGEN")) return "REGEN";
  return "ENGINEERING_OBJECT";
}

function objectLabelFor(object: unknown, objectId: string) {
  const record = asRecord(object);
  return asString(record.label ?? record.name ?? record.unitType ?? record.objectType ?? record.structureType, objectId);
}

function stationNodeId(stationId: string, packageId: string) {
  return `${packageId}:EXECUTION-NODE:STATION:${stationId.replace(/[^A-Za-z0-9_-]+/g, "-")}`;
}

function nodeIdBySource(nodes: ExecutionNode[]) {
  const bySource = new Map<string, string>();
  nodes.forEach((node) => {
    bySource.set(node.sourceArtifactId, node.nodeId);
    if (node.stationId) bySource.set(node.stationId, node.nodeId);
  });
  return bySource;
}

function nodeLayersForObject(): ExecutionGraphProjectionLayer[] {
  return ["COMMERCIAL", "ENGINEERING", "EXECUTION", "MARKETPLACE", "CONTROL", "FIELD", "OPERATIONAL", "LIFECYCLE"];
}

function attachmentQueuesByObjectId(attachments: ObjectStationAttachment[]) {
  return attachments.reduce<Map<string, ObjectStationAttachment[]>>((queues, attachment) => {
    queues.set(attachment.objectId, [...(queues.get(attachment.objectId) ?? []), attachment]);
    return queues;
  }, new Map());
}

function nextAttachmentForObject(queues: Map<string, ObjectStationAttachment[]>, objectId: string) {
  const queue = queues.get(objectId) ?? [];
  const next = queue.shift();
  queues.set(objectId, queue);
  return next;
}

function pushNode(nodes: Map<string, ExecutionNode>, node: ExecutionNode) {
  if (!nodes.has(node.nodeId)) nodes.set(node.nodeId, node);
}

function pushEdge(edges: Map<string, ExecutionEdge>, edge: ExecutionEdge) {
  if (edge.fromNodeId === edge.toNodeId) return;
  if (!edges.has(edge.edgeId)) edges.set(edge.edgeId, edge);
}

function stationNode(station: AuthorizedStation): ExecutionNode {
  return createExecutionNode({
    packageId: station.packageId,
    nodeType: "STATION",
    label: station.stationLabel,
    authority: "STATION_AUTHORITY",
    sourceArtifact: "stationAuthority.stations",
    sourceArtifactId: station.stationId,
    projectionLayers: ["PHYSICAL", "COMMERCIAL", "STATIONS", "ENGINEERING", "EXECUTION", "CONTROL", "FIELD", "OPERATIONAL", "LIFECYCLE"],
    stationId: station.stationId,
    stationLabel: station.stationLabel,
    measureFeet: station.measureFeet,
    coordinate: station.coordinate,
    geometryHash: station.geometryHash,
    lifecycleState: {
      marketplace: "ELIGIBLE",
      control: "READY",
      field: "READY",
      operational: "READY",
      revenue: "CONTRACT_BASELINE_READY",
    },
    metadata: {
      routeId: station.routeId,
      spineId: station.spineId,
      stationIndex: station.stationIndex,
      segmentId: station.segmentId,
      stationClass: station.stationClass,
    },
  });
}

function createStationRangeNode(input: {
  packageId: string;
  expectation: StationRangeExpectation;
  fromStation?: AuthorizedStation;
  toStation?: AuthorizedStation;
  geometryHash: string;
}) {
  return createExecutionNode({
    packageId: input.packageId,
    nodeType: "STATION_RANGE",
    label: `${input.expectation.expectationType} ${input.expectation.fromStationLabel} to ${input.expectation.toStationLabel}`,
    authority: "SPINE_AUDIT_PROJECTION_AUTHORITY",
    sourceArtifact: "spineAuditProjection.stationRangeExpectations",
    sourceArtifactId: input.expectation.expectationId,
    projectionLayers: ["COMMERCIAL", "ENGINEERING", "EXECUTION", "CONTROL", "FIELD", "OPERATIONAL", "LIFECYCLE"],
    parentStationId: input.expectation.fromStationId,
    fromStationId: input.expectation.fromStationId,
    toStationId: input.expectation.toStationId,
    fromMeasureFeet: input.expectation.fromMeasureFeet,
    toMeasureFeet: input.expectation.toMeasureFeet,
    coordinate: input.fromStation?.coordinate,
    geometryHash: input.geometryHash,
    lifecycleState: {
      marketplace: "ELIGIBLE",
      control: "READY",
      field: "READY",
      operational: "READY",
      revenue: "CONTRACT_BASELINE_READY",
    },
    metadata: {
      expectationType: input.expectation.expectationType,
      quantityFeet: input.expectation.quantityFeet,
      auditEntryIds: input.expectation.auditEntryIds,
      toCoordinate: input.toStation?.coordinate,
    },
  });
}

function createStationedExpectationNode(input: {
  packageId: string;
  expectation: StationedExpectation;
  geometryHash: string;
}) {
  return createExecutionNode({
    packageId: input.packageId,
    nodeType: "STATIONED_EXPECTATION",
    label: input.expectation.expectedWork.join(", ") || input.expectation.expectationId,
    authority: "SPINE_AUDIT_PROJECTION_AUTHORITY",
    sourceArtifact: "spineAuditProjection.stationedExpectations",
    sourceArtifactId: input.expectation.expectationId,
    projectionLayers: ["COMMERCIAL", "ENGINEERING", "EXECUTION", "CONTROL", "FIELD", "OPERATIONAL", "LIFECYCLE"],
    parentStationId: input.expectation.stationId,
    stationId: input.expectation.stationId,
    stationLabel: input.expectation.stationLabel,
    measureFeet: input.expectation.measureFeet,
    coordinate: input.expectation.coordinate,
    geometryHash: input.geometryHash,
    lifecycleState: {
      marketplace: "ELIGIBLE",
      control: "READY",
      field: "READY",
      operational: "READY",
      revenue: "CONTRACT_BASELINE_READY",
    },
    metadata: {
      objectId: input.expectation.objectId,
      objectType: input.expectation.objectType,
      auditEntryIds: input.expectation.auditEntryIds,
      requiredEvidence: input.expectation.requiredEvidence,
      closureRequired: input.expectation.closureRequired,
    },
  });
}

function createReviewNode(input: {
  packageId: string;
  reviewObject: SpineReviewObject;
  fallbackStation?: AuthorizedStation;
  geometryHash: string;
}) {
  return createExecutionNode({
    packageId: input.packageId,
    nodeType: input.reviewObject.reviewType === "COMMERCIAL_REVIEW" ? "COMMERCIAL_REVIEW_OBJECT" : "AUDIT_REVIEW_OBJECT",
    label: input.reviewObject.label,
    authority: "SPINE_AUDIT_PROJECTION_AUTHORITY",
    sourceArtifact: "spineAuditProjection.spineReviewObjects",
    sourceArtifactId: input.reviewObject.reviewObjectId,
    projectionLayers: ["COMMERCIAL", "ENGINEERING", "EXECUTION", "CONTROL", "FIELD", "LIFECYCLE"],
    parentStationId: input.reviewObject.stationId ?? input.reviewObject.fromStationId,
    stationId: input.reviewObject.stationId,
    stationLabel: input.reviewObject.stationLabel,
    measureFeet: input.reviewObject.measureFeet,
    fromStationId: input.reviewObject.fromStationId,
    toStationId: input.reviewObject.toStationId,
    fromMeasureFeet: input.reviewObject.fromMeasureFeet,
    toMeasureFeet: input.reviewObject.toMeasureFeet,
    coordinate: input.reviewObject.coordinate ?? input.fallbackStation?.coordinate,
    geometryHash: input.geometryHash,
    lifecycleState: {
      engineering: "REVIEW_REQUIRED",
      control: "READY",
      field: "READY",
    },
    metadata: {
      reviewType: input.reviewObject.reviewType,
      auditEntryId: input.reviewObject.auditEntryId,
      requiredBeforeEngineeringCertification: input.reviewObject.requiredBeforeEngineeringCertification,
      reason: input.reviewObject.reason,
      status: input.reviewObject.status,
    },
  });
}

function createClosureNode(input: {
  packageId: string;
  closure: ClosureExpectation;
  fallbackStation?: AuthorizedStation;
  geometryHash: string;
}) {
  return createExecutionNode({
    packageId: input.packageId,
    nodeType: "CLOSURE_EXPECTATION",
    label: input.closure.expectedWork,
    authority: "SPINE_AUDIT_PROJECTION_AUTHORITY",
    sourceArtifact: "spineAuditProjection.closureExpectations",
    sourceArtifactId: input.closure.closureExpectationId,
    projectionLayers: ["COMMERCIAL", "EXECUTION", "CONTROL", "FIELD", "OPERATIONAL", "LIFECYCLE"],
    parentStationId: input.closure.stationId ?? input.closure.fromStationId,
    stationId: input.closure.stationId,
    stationLabel: input.closure.stationLabel,
    fromStationId: input.closure.fromStationId,
    toStationId: input.closure.toStationId,
    coordinate: input.fallbackStation?.coordinate,
    geometryHash: input.geometryHash,
    lifecycleState: {
      control: "READY",
      field: "READY",
      operational: "READY",
      revenue: "CONTRACT_BASELINE_READY",
    },
    metadata: {
      expectationKind: input.closure.expectationKind,
      objectId: input.closure.objectId,
      objectType: input.closure.objectType,
      auditEntryIds: input.closure.auditEntryIds,
      requiredEvidence: input.closure.requiredEvidence,
      expectedQuantity: input.closure.expectedQuantity,
      quantityUnit: input.closure.quantityUnit,
      currentStatus: input.closure.currentStatus,
    },
  });
}

function hasCycle(nodes: ExecutionNode[], edges: ExecutionEdge[]) {
  const nodeIds = new Set(nodes.map((node) => node.nodeId));
  const incoming = new Map<string, number>();
  const outgoing = new Map<string, string[]>();
  nodeIds.forEach((nodeId) => {
    incoming.set(nodeId, 0);
    outgoing.set(nodeId, []);
  });
  edges.forEach((edge) => {
    if (!nodeIds.has(edge.fromNodeId) || !nodeIds.has(edge.toNodeId)) return;
    outgoing.set(edge.fromNodeId, [...(outgoing.get(edge.fromNodeId) ?? []), edge.toNodeId]);
    incoming.set(edge.toNodeId, (incoming.get(edge.toNodeId) ?? 0) + 1);
  });
  const queue = Array.from(incoming.entries()).filter(([, count]) => count === 0).map(([nodeId]) => nodeId);
  let visited = 0;
  while (queue.length) {
    const nodeId = queue.shift() as string;
    visited += 1;
    (outgoing.get(nodeId) ?? []).forEach((nextId) => {
      const nextCount = (incoming.get(nextId) ?? 0) - 1;
      incoming.set(nextId, nextCount);
      if (nextCount === 0) queue.push(nextId);
    });
  }
  return visited !== nodeIds.size;
}

function nodesWithRelationships(nodes: ExecutionNode[], edges: ExecutionEdge[]) {
  const byId = new Map(nodes.map((node) => [
    node.nodeId,
    {
      ...node,
      children: [] as string[],
      parents: [] as string[],
      dependencies: [] as string[],
    },
  ]));
  edges.forEach((edge) => {
    const from = byId.get(edge.fromNodeId);
    const to = byId.get(edge.toNodeId);
    if (from && !from.children.includes(edge.toNodeId)) from.children.push(edge.toNodeId);
    if (to && !to.parents.includes(edge.fromNodeId)) to.parents.push(edge.fromNodeId);
    if (to && edge.required && !to.dependencies.includes(edge.fromNodeId)) to.dependencies.push(edge.fromNodeId);
  });
  return Array.from(byId.values());
}

function validateGraph(args: {
  stationAuthority: StationAuthority;
  nodes: ExecutionNode[];
  edges: ExecutionEdge[];
  projections: { layer: ExecutionGraphProjectionLayer }[];
  objectStationAttachments: ObjectStationAttachment[];
}) {
  const stationNodeCount = args.nodes.filter((node) => node.nodeType === "STATION").length;
  const objectNodeCount = args.nodes.filter((node) => node.parentStationId && node.nodeType !== "STATION" && node.nodeType !== "CLOSURE_EXPECTATION").length;
  const closureExpectationNodeCount = args.nodes.filter((node) => node.nodeType === "CLOSURE_EXPECTATION").length;
  const auditProjectionNodeCount = args.nodes.filter((node) => node.authority === "SPINE_AUDIT_PROJECTION_AUTHORITY").length;
  const cycleDetected = hasCycle(args.nodes, args.edges);
  const attachedObjectsMissingParent = args.objectStationAttachments.filter((attachment) => (
    attachment.attachmentStatus === "ATTACHED" &&
    attachment.stationId &&
    !args.nodes.some((node) => node.sourceArtifactId === attachment.objectId && node.parentStationId === attachment.stationId)
  ));
  const warnings: string[] = [];
  const failures: string[] = [];
  if (stationNodeCount !== args.stationAuthority.stationCount) failures.push("every authorized station must exist as a first-class execution node");
  if (attachedObjectsMissingParent.length) failures.push("attached objects must be child nodes of their parent station");
  if (cycleDetected) failures.push("execution dependencies must be acyclic");
  if (!args.projections.length) failures.push("execution graph projections were not created");
  const missingLayers = EXECUTION_GRAPH_PROJECTION_LAYERS.filter((layer) => !args.projections.some((projection) => projection.layer === layer));
  if (missingLayers.length) failures.push(`missing projection layers: ${missingLayers.join(", ")}`);
  if (!closureExpectationNodeCount) warnings.push("no closure expectation nodes exist");
  const validation: ExecutionGraphValidationResult = {
    status: failures.length ? "FAIL" : warnings.length ? "WARNING" : "PASS",
    stationNodeCount,
    objectNodeCount,
    closureExpectationNodeCount,
    auditProjectionNodeCount,
    edgeCount: args.edges.length,
    acyclic: !cycleDetected,
    immutableIdentity: args.nodes.every((node) => node.immutableIdentity) && args.edges.every((edge) => edge.immutableIdentity),
    projectionLayers: [...EXECUTION_GRAPH_PROJECTION_LAYERS],
    warnings,
    failures,
  };
  return validation;
}

function stationById(stations: AuthorizedStation[]) {
  return new Map(stations.map((station) => [station.stationId, station]));
}

export function buildKernelExecutionGraph(input: KernelExecutionGraphBuilderInput) {
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const packageId = input.packageId;
  const nodes = new Map<string, ExecutionNode>();
  const edges = new Map<string, ExecutionEdge>();
  const stations = input.stationAuthority.stations;
  const stationsById = stationById(stations);

  const spineNode = createExecutionNode({
    packageId,
    nodeType: "MEASURED_SPINE",
    label: "Measured Spine",
    authority: "MEASURED_SPINE_AUTHORITY",
    sourceArtifact: "measuredSpine",
    sourceArtifactId: input.measuredSpine.spineId,
    projectionLayers: ["PHYSICAL", "COMMERCIAL", "EXECUTION", "LIFECYCLE"],
    geometryHash: input.measuredSpine.geometryHash,
    lifecycleState: {
      marketplace: "ELIGIBLE",
      control: "READY",
      field: "READY",
      operational: "READY",
      revenue: "CONTRACT_BASELINE_READY",
    },
    metadata: {
      routeId: input.measuredSpine.routeId,
      routeLengthFeet: input.measuredSpine.routeLengthFeet,
      routeLengthMiles: input.measuredSpine.routeLengthMiles,
      coordinateCount: input.measuredSpine.coordinateCount,
      stationIndexId: input.stationIndex?.indexId ?? input.stationAuthority.stationIndex.indexId,
      stationCoordinateMapId: input.stationToCoordinateMap?.mapId ?? input.stationAuthority.stationToCoordinateMap.mapId,
    },
  });
  pushNode(nodes, spineNode);

  stations.forEach((station, index) => {
    const node = stationNode(station);
    pushNode(nodes, node);
    pushEdge(edges, createExecutionEdge({
      packageId,
      fromNodeId: spineNode.nodeId,
      toNodeId: node.nodeId,
      edgeType: "CONTAINS",
      dependencyClass: "STATION_PARENTAGE",
      authority: "STATION_AUTHORITY",
      projectionLayers: ["PHYSICAL", "COMMERCIAL", "STATIONS", "EXECUTION", "LIFECYCLE"],
      sequence: index,
      fromStationId: stations[index - 1]?.stationId,
      toStationId: station.stationId,
      toMeasureFeet: station.measureFeet,
      sourceArtifact: "stationAuthority.stations",
      sourceArtifactId: station.stationId,
    }));
  });

  const sourceNodeIds = nodeIdBySource(Array.from(nodes.values()));
  input.stationIndexedGraph?.edges.forEach((edge, index) => {
    const fromNodeId = sourceNodeIds.get(edge.fromStationId);
    const toNodeId = sourceNodeIds.get(edge.toStationId);
    if (!fromNodeId || !toNodeId) return;
    pushEdge(edges, createExecutionEdge({
      packageId,
      fromNodeId,
      toNodeId,
      edgeType: "SEQUENCE",
      dependencyClass: "PHYSICAL_ORDER",
      authority: "STATION_INDEXED_GRAPH_AUTHORITY",
      projectionLayers: ["PHYSICAL", "COMMERCIAL", "STATIONS", "ENGINEERING", "EXECUTION", "FIELD", "OPERATIONAL"],
      sequence: index,
      fromStationId: edge.fromStationId,
      toStationId: edge.toStationId,
      fromMeasureFeet: edge.fromMeasureFeet,
      toMeasureFeet: edge.toMeasureFeet,
      sourceArtifact: "stationIndexedGraph.edges",
      sourceArtifactId: edge.edgeId,
      metadata: {
        segmentId: edge.segmentId,
        edgeLengthFeet: edge.edgeLengthFeet,
      },
    }));
  });

  const attachmentQueues = attachmentQueuesByObjectId(input.objectStationAttachments ?? []);
  (input.engineeringObjects ?? []).forEach((object, index) => {
    const objectId = objectIdFor(object, packageId, index);
    const objectType = objectTypeFor(object);
    const attachment = nextAttachmentForObject(attachmentQueues, objectId);
    const parentStation = attachment?.stationId ? stationsById.get(attachment.stationId) : undefined;
    const parentNodeId = parentStation ? sourceNodeIds.get(parentStation.stationId) ?? stationNodeId(parentStation.stationId, packageId) : undefined;
    const node = createExecutionNode({
      packageId,
      nodeType: executionTypeForObject(objectType),
      label: objectLabelFor(object, objectId),
      authority: attachment ? "OBJECT_STATION_ATTACHMENT_AUTHORITY" : "KERNEL_EXECUTION_GRAPH_AUTHORITY",
      sourceArtifact: "engineeringObjects",
      sourceArtifactId: objectId,
      projectionLayers: nodeLayersForObject(),
      parentNodeId,
      parentStationId: attachment?.stationId,
      stationId: attachment?.stationId,
      stationLabel: attachment?.stationLabel,
      measureFeet: attachment?.measureFeet,
      coordinate: attachment?.coordinate,
      geometryHash: attachment?.geometryHash ?? input.measuredSpine.geometryHash,
      lifecycleState: {
        marketplace: "ELIGIBLE",
        control: "READY",
        field: "READY",
        operational: "READY",
        revenue: "CONTRACT_BASELINE_READY",
      },
      metadata: {
        objectType,
        attachmentMethod: attachment?.attachmentMethod ?? "UNRESOLVED",
        attachmentStatus: attachment?.attachmentStatus ?? "UNRESOLVED",
        raw: asRecord(object),
      },
    });
    pushNode(nodes, node);
    if (parentNodeId) {
      pushEdge(edges, createExecutionEdge({
        packageId,
        fromNodeId: parentNodeId,
        toNodeId: node.nodeId,
        edgeType: "CONTAINS",
        dependencyClass: "OBJECT_ATTACHMENT",
        authority: "OBJECT_STATION_ATTACHMENT_AUTHORITY",
        projectionLayers: ["COMMERCIAL", "ENGINEERING", "EXECUTION", "MARKETPLACE", "CONTROL", "FIELD", "OPERATIONAL", "LIFECYCLE"],
        fromStationId: parentStation?.stationId,
        toStationId: attachment?.stationId,
        fromMeasureFeet: parentStation?.measureFeet,
        toMeasureFeet: attachment?.measureFeet,
        sourceArtifact: "objectStationAttachments",
        sourceArtifactId: attachment?.attachmentId ?? objectId,
      }));
    }
  });

  const refreshedSourceNodeIds = () => nodeIdBySource(Array.from(nodes.values()));
  const projection = input.spineAuditProjection;
  projection?.stationRangeExpectations.forEach((expectation) => {
    const fromStation = stationsById.get(expectation.fromStationId);
    const toStation = stationsById.get(expectation.toStationId);
    const node = createStationRangeNode({
      packageId,
      expectation,
      fromStation,
      toStation,
      geometryHash: input.measuredSpine.geometryHash,
    });
    pushNode(nodes, node);
    const sourceNodes = refreshedSourceNodeIds();
    const fromNodeId = sourceNodes.get(expectation.fromStationId);
    const toNodeId = sourceNodes.get(expectation.toStationId);
    if (fromNodeId) {
      pushEdge(edges, createExecutionEdge({
        packageId,
        fromNodeId,
        toNodeId: node.nodeId,
        edgeType: "PROJECTS_TO",
        dependencyClass: "AUDIT_PROJECTION",
        authority: "SPINE_AUDIT_PROJECTION_AUTHORITY",
        projectionLayers: ["COMMERCIAL", "ENGINEERING", "EXECUTION", "CONTROL", "FIELD", "OPERATIONAL"],
        fromStationId: expectation.fromStationId,
        toStationId: expectation.toStationId,
        fromMeasureFeet: expectation.fromMeasureFeet,
        toMeasureFeet: expectation.toMeasureFeet,
        sourceArtifact: "spineAuditProjection.stationRangeExpectations",
        sourceArtifactId: expectation.expectationId,
      }));
    }
    if (toNodeId) {
      pushEdge(edges, createExecutionEdge({
        packageId,
        fromNodeId: node.nodeId,
        toNodeId,
        edgeType: "PROJECTS_TO",
        dependencyClass: "AUDIT_PROJECTION",
        authority: "SPINE_AUDIT_PROJECTION_AUTHORITY",
        projectionLayers: ["COMMERCIAL", "ENGINEERING", "EXECUTION", "CONTROL", "FIELD", "OPERATIONAL"],
        fromStationId: expectation.fromStationId,
        toStationId: expectation.toStationId,
        fromMeasureFeet: expectation.fromMeasureFeet,
        toMeasureFeet: expectation.toMeasureFeet,
        sourceArtifact: "spineAuditProjection.stationRangeExpectations",
        sourceArtifactId: `${expectation.expectationId}:TO-STATION`,
      }));
    }
  });

  projection?.stationedExpectations.forEach((expectation) => {
    const node = createStationedExpectationNode({
      packageId,
      expectation,
      geometryHash: input.measuredSpine.geometryHash,
    });
    pushNode(nodes, node);
    const sourceNodes = refreshedSourceNodeIds();
    const stationParent = sourceNodes.get(expectation.stationId);
    const objectParent = expectation.objectId ? sourceNodes.get(expectation.objectId) : undefined;
    const fromNodeId = objectParent ?? stationParent;
    if (fromNodeId) {
      pushEdge(edges, createExecutionEdge({
        packageId,
        fromNodeId,
        toNodeId: node.nodeId,
        edgeType: "PROJECTS_TO",
        dependencyClass: "AUDIT_PROJECTION",
        authority: "SPINE_AUDIT_PROJECTION_AUTHORITY",
        projectionLayers: ["COMMERCIAL", "ENGINEERING", "EXECUTION", "CONTROL", "FIELD", "OPERATIONAL"],
        fromStationId: expectation.stationId,
        toStationId: expectation.stationId,
        fromMeasureFeet: expectation.measureFeet,
        toMeasureFeet: expectation.measureFeet,
        sourceArtifact: "spineAuditProjection.stationedExpectations",
        sourceArtifactId: expectation.expectationId,
      }));
    }
  });

  projection?.spineReviewObjects.forEach((reviewObject) => {
    const fallbackStation = reviewObject.stationId
      ? stationsById.get(reviewObject.stationId)
      : reviewObject.fromStationId
        ? stationsById.get(reviewObject.fromStationId)
        : undefined;
    const node = createReviewNode({
      packageId,
      reviewObject,
      fallbackStation,
      geometryHash: input.measuredSpine.geometryHash,
    });
    pushNode(nodes, node);
    const sourceNodes = refreshedSourceNodeIds();
    const parentNodeId = reviewObject.stationId
      ? sourceNodes.get(reviewObject.stationId)
      : reviewObject.fromStationId
        ? sourceNodes.get(reviewObject.fromStationId)
        : spineNode.nodeId;
    pushEdge(edges, createExecutionEdge({
      packageId,
      fromNodeId: parentNodeId ?? spineNode.nodeId,
      toNodeId: node.nodeId,
      edgeType: "REQUIRES_REVIEW",
      dependencyClass: "REVIEW_REQUIREMENT",
      authority: "SPINE_AUDIT_PROJECTION_AUTHORITY",
      projectionLayers: ["COMMERCIAL", "ENGINEERING", "EXECUTION", "CONTROL", "FIELD", "LIFECYCLE"],
      fromStationId: reviewObject.fromStationId ?? reviewObject.stationId,
      toStationId: reviewObject.toStationId ?? reviewObject.stationId,
      fromMeasureFeet: reviewObject.fromMeasureFeet ?? reviewObject.measureFeet,
      toMeasureFeet: reviewObject.toMeasureFeet ?? reviewObject.measureFeet,
      sourceArtifact: "spineAuditProjection.spineReviewObjects",
      sourceArtifactId: reviewObject.reviewObjectId,
    }));
  });

  const closureExpectations = input.closureExpectations?.length
    ? input.closureExpectations
    : projection?.closureExpectations ?? [];
  closureExpectations.forEach((closure) => {
    const fallbackStation = closure.stationId
      ? stationsById.get(closure.stationId)
      : closure.fromStationId
        ? stationsById.get(closure.fromStationId)
        : undefined;
    const node = createClosureNode({
      packageId,
      closure,
      fallbackStation,
      geometryHash: input.measuredSpine.geometryHash,
    });
    pushNode(nodes, node);
    const sourceNodes = refreshedSourceNodeIds();
    const stationParent = closure.stationId ? sourceNodes.get(closure.stationId) : closure.fromStationId ? sourceNodes.get(closure.fromStationId) : undefined;
    const objectParent = closure.objectId ? sourceNodes.get(closure.objectId) : undefined;
    const reviewParent = sourceNodes.get(String(closure.closureExpectationId).replace(/:REVIEW$/, ""));
    const fromNodeId = objectParent ?? stationParent ?? reviewParent ?? spineNode.nodeId;
    pushEdge(edges, createExecutionEdge({
      packageId,
      fromNodeId,
      toNodeId: node.nodeId,
      edgeType: closure.reviewRequired ? "REQUIRES_REVIEW" : "REQUIRES_CLOSURE",
      dependencyClass: closure.reviewRequired ? "REVIEW_REQUIREMENT" : "CLOSURE_REQUIREMENT",
      authority: "SPINE_AUDIT_PROJECTION_AUTHORITY",
      projectionLayers: ["COMMERCIAL", "EXECUTION", "CONTROL", "FIELD", "OPERATIONAL", "LIFECYCLE"],
      fromStationId: closure.fromStationId ?? closure.stationId,
      toStationId: closure.toStationId ?? closure.stationId,
      sourceArtifact: "spineAuditProjection.closureExpectations",
      sourceArtifactId: closure.closureExpectationId,
      metadata: {
        expectedWork: closure.expectedWork,
        requiredEvidence: closure.requiredEvidence,
        currentStatus: closure.currentStatus,
      },
    }));
  });

  const graphSeed = {
    graphId: `${packageId}:KERNEL-EXECUTION-GRAPH:${input.measuredSpine.geometryHash}`,
    packageId,
    nodes: nodesWithRelationships(Array.from(nodes.values()), Array.from(edges.values())),
    edges: Array.from(edges.values()),
  };
  const projections = buildKernelExecutionGraphProjections(graphSeed, generatedAt);
  const validation = validateGraph({
    stationAuthority: input.stationAuthority,
    nodes: graphSeed.nodes,
    edges: graphSeed.edges,
    projections,
    objectStationAttachments: input.objectStationAttachments ?? [],
  });
  const graph = createKernelExecutionGraph({
    packageId,
    measuredSpineId: input.measuredSpine.spineId,
    stationAuthorityId: input.stationAuthority.authorityId,
    stationIndexedGraphId: input.stationIndexedGraph?.graphId,
    spineAuditProjectionId: input.spineAuditProjection?.projectionId,
    geometryHash: input.measuredSpine.geometryHash,
    generatedAt,
    nodes: graphSeed.nodes,
    edges: graphSeed.edges,
    projections,
    validation,
  });
  return enrichKernelExecutionGraphWithClosures({ graph, generatedAt });
}

export function executionNodeStationParent(node: ExecutionNode) {
  return node.parentStationId ?? node.stationId ?? "";
}

export function executionGraphSourceArtifactCounts(graph: { nodes: ExecutionNode[] }) {
  return graph.nodes.reduce<Record<string, number>>((counts, node) => {
    counts[node.sourceArtifact] = (counts[node.sourceArtifact] ?? 0) + 1;
    return counts;
  }, {});
}

export function executionGraphClosureExpectationCount(graph: { nodes: ExecutionNode[] }) {
  return graph.nodes.filter((node) => node.nodeType === "CLOSURE_EXPECTATION").length;
}

export function executionGraphAcyclic(graph: { nodes: ExecutionNode[]; edges: ExecutionEdge[] }) {
  return !hasCycle(graph.nodes, graph.edges);
}
