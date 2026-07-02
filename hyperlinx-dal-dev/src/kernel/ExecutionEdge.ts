import type {
  ExecutionAuthority,
  ExecutionDependencyClass,
  ExecutionEdge,
  ExecutionEdgeType,
  ExecutionGraphProjectionLayer,
} from "./ExecutionGraphContracts";

function stableIdPart(value: unknown, fallback = "UNKNOWN") {
  const raw = String(value ?? fallback).trim() || fallback;
  return raw.replace(/[^A-Za-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 160) || fallback;
}

export function executionEdgeIdentity(input: {
  packageId: string;
  edgeType: ExecutionEdgeType;
  fromNodeId: string;
  toNodeId: string;
  sourceArtifactId: string;
}) {
  return [
    input.packageId,
    "EXECUTION-EDGE",
    input.edgeType,
    input.fromNodeId,
    input.toNodeId,
    input.sourceArtifactId,
  ].map((part) => stableIdPart(part)).join(":");
}

export function createExecutionEdge(input: {
  packageId: string;
  fromNodeId: string;
  toNodeId: string;
  edgeType: ExecutionEdgeType;
  dependencyClass: ExecutionDependencyClass;
  authority: ExecutionAuthority;
  projectionLayers: ExecutionGraphProjectionLayer[];
  required?: boolean;
  sequence?: number;
  fromStationId?: string;
  toStationId?: string;
  fromMeasureFeet?: number;
  toMeasureFeet?: number;
  sourceArtifact: string;
  sourceArtifactId: string;
  metadata?: Record<string, unknown>;
}): ExecutionEdge {
  const stableKey = executionEdgeIdentity(input);
  return {
    edgeId: stableKey,
    stableKey,
    packageId: input.packageId,
    fromNodeId: input.fromNodeId,
    toNodeId: input.toNodeId,
    edgeType: input.edgeType,
    dependencyClass: input.dependencyClass,
    authority: input.authority,
    projectionLayers: Array.from(new Set(input.projectionLayers)),
    required: input.required ?? true,
    sequence: input.sequence,
    fromStationId: input.fromStationId,
    toStationId: input.toStationId,
    fromMeasureFeet: input.fromMeasureFeet,
    toMeasureFeet: input.toMeasureFeet,
    sourceArtifact: input.sourceArtifact,
    sourceArtifactId: input.sourceArtifactId,
    acyclic: true,
    immutableIdentity: true,
    noScopeVersionCreation: true,
    metadata: input.metadata ?? {},
  };
}
