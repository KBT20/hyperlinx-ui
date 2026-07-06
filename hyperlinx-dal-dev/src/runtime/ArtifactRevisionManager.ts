import type { RuntimeArtifactRecord, RuntimeArtifactType } from "./RuntimeContracts";
import { runtimeArtifactKey } from "./RuntimeContracts";

const revisions = new Map<string, number>();

export function nextArtifactRevision(
  artifactType: RuntimeArtifactType,
  artifactId: string,
  existing?: RuntimeArtifactRecord,
) {
  const key = runtimeArtifactKey(artifactType, artifactId);
  const nextRevision = existing ? existing.revision + 1 : (revisions.get(key) ?? 0) + 1;
  revisions.set(key, nextRevision);
  return nextRevision;
}

export function recordArtifactRevision(record: RuntimeArtifactRecord) {
  revisions.set(runtimeArtifactKey(record.artifactType, record.artifactId), record.revision);
}

export function getArtifactRevision(artifactType: RuntimeArtifactType, artifactId: string) {
  return revisions.get(runtimeArtifactKey(artifactType, artifactId)) ?? 0;
}

export function resetArtifactRevisionManager() {
  revisions.clear();
}

