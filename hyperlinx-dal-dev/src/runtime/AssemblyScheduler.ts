import { getOrCreateRuntimeArtifact } from "./ProjectionCache";
import type { RuntimeArtifactRecord, RuntimeArtifactRequest } from "./RuntimeContracts";

export function scheduleRuntimeAssembly<T>(request: RuntimeArtifactRequest<T>): RuntimeArtifactRecord<T> {
  return getOrCreateRuntimeArtifact(request as Parameters<typeof getOrCreateRuntimeArtifact<T>>[0]) as RuntimeArtifactRecord<T>;
}

export const AssemblyScheduler = {
  schedule: scheduleRuntimeAssembly,
};
