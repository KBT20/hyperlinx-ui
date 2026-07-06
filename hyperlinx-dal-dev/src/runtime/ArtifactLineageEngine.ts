import type { RuntimeArtifactRecord, RuntimeArtifactReference, RuntimeArtifactType } from "./RuntimeContracts";
import { runtimeArtifactKey } from "./RuntimeContracts";

const lineage = new Map<string, RuntimeArtifactReference[]>();

export function recordArtifactLineage(record: RuntimeArtifactRecord) {
  lineage.set(runtimeArtifactKey(record.artifactType, record.artifactId), [...record.producedFrom]);
}

export function getArtifactLineage(artifactType: RuntimeArtifactType, artifactId: string) {
  return [...(lineage.get(runtimeArtifactKey(artifactType, artifactId)) ?? [])];
}

export function resetArtifactLineage() {
  lineage.clear();
}

