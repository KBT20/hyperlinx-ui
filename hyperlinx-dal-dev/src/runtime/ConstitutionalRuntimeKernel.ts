import { scheduleRuntimeAssembly } from "./AssemblyScheduler";
import { getRuntimeDependencyGraphSnapshot } from "./ArtifactDependencyGraph";
import { getArtifactLineage } from "./ArtifactLineageEngine";
import { listRegisteredRuntimeArtifacts, readRegisteredRuntimeArtifact } from "./ArtifactRegistry";
import {
  invalidateRuntimeArtifact,
  invalidateRuntimeArtifactGraph,
  listRuntimeArtifacts,
  readRuntimeArtifact,
} from "./ProjectionCache";
import { getRuntimeDiagnosticsSnapshot } from "./RuntimeDiagnostics";
import {
  getReasoningServiceSnapshot,
  refreshReasoningService,
  startReasoningService,
} from "../kernel/ReasoningServiceManager";
import type { RuntimeArtifactRequest, RuntimeArtifactType } from "./RuntimeContracts";
import type { ConstitutionalArtifactType } from "./ProjectionCache";

export const ConstitutionalRuntimeKernel = {
  requestArtifact<T>(request: RuntimeArtifactRequest<T>) {
    return scheduleRuntimeAssembly(request);
  },
  readArtifact<T = unknown>(artifactType: RuntimeArtifactType, artifactId: string) {
    return readRuntimeArtifact<T>(artifactType as ConstitutionalArtifactType, artifactId);
  },
  readRegisteredArtifact<T = unknown>(artifactType: RuntimeArtifactType, artifactId: string) {
    return readRegisteredRuntimeArtifact<T>(artifactType, artifactId);
  },
  listArtifacts: listRuntimeArtifacts,
  listRegisteredArtifacts: listRegisteredRuntimeArtifacts,
  invalidateArtifact: invalidateRuntimeArtifact,
  invalidateArtifactGraph: invalidateRuntimeArtifactGraph,
  getArtifactLineage,
  getDependencyGraph: getRuntimeDependencyGraphSnapshot,
  getDiagnostics: getRuntimeDiagnosticsSnapshot,
  startReasoningService,
  refreshReasoningService,
  getReasoningService: getReasoningServiceSnapshot,
};

export function requestArtifact<T>(request: RuntimeArtifactRequest<T>) {
  return ConstitutionalRuntimeKernel.requestArtifact(request);
}
