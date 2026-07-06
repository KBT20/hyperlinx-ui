import type { RuntimeArtifactRecord, RuntimeArtifactType } from "./RuntimeContracts";
import { runtimeArtifactKey } from "./RuntimeContracts";

const registry = new Map<string, RuntimeArtifactRecord>();

export function registerRuntimeArtifact(record: RuntimeArtifactRecord) {
  registry.set(runtimeArtifactKey(record.artifactType, record.artifactId), record);
  return record;
}

export function readRegisteredRuntimeArtifact<T = unknown>(artifactType: RuntimeArtifactType, artifactId: string) {
  return registry.get(runtimeArtifactKey(artifactType, artifactId)) as RuntimeArtifactRecord<T> | undefined;
}

export function listRegisteredRuntimeArtifacts() {
  return Array.from(registry.values());
}

export function resetArtifactRegistry() {
  registry.clear();
}

