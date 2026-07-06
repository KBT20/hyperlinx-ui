import type { RuntimeArtifactRecord, RuntimeArtifactType } from "./RuntimeContracts";
import { runtimeArtifactKey, runtimeArtifactReferenceKey } from "./RuntimeContracts";

const dependencyGraph = new Map<string, Set<string>>();
const dependentGraph = new Map<string, Set<string>>();

function normalizeDependencyKey(value: string) {
  return value.trim();
}

export function registerArtifactDependencies(record: RuntimeArtifactRecord) {
  const artifactKey = runtimeArtifactKey(record.artifactType, record.artifactId);
  const dependencies = new Set([
    ...record.dependencies.map(normalizeDependencyKey),
    ...record.producedFrom.map(runtimeArtifactReferenceKey),
  ].filter(Boolean));

  dependencyGraph.set(artifactKey, dependencies);
  dependencies.forEach((dependencyKey) => {
    const dependents = dependentGraph.get(dependencyKey) ?? new Set<string>();
    dependents.add(artifactKey);
    dependentGraph.set(dependencyKey, dependents);
  });
}

export function resolveDependencyInvalidationOrder(artifactType: RuntimeArtifactType, artifactId: string) {
  const startKey = runtimeArtifactKey(artifactType, artifactId);
  const visited = new Set<string>();
  const order: string[] = [];

  function visit(key: string) {
    if (visited.has(key)) return;
    visited.add(key);
    order.push(key);
    Array.from(dependentGraph.get(key) ?? [])
      .sort()
      .forEach(visit);
  }

  visit(startKey);
  return order;
}

export function getRuntimeDependencyGraphSnapshot() {
  return {
    dependencies: Object.fromEntries(Array.from(dependencyGraph.entries()).map(([key, values]) => [key, Array.from(values).sort()])),
    dependents: Object.fromEntries(Array.from(dependentGraph.entries()).map(([key, values]) => [key, Array.from(values).sort()])),
  };
}

export function resetArtifactDependencyGraph() {
  dependencyGraph.clear();
  dependentGraph.clear();
}

