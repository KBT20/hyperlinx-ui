import type { IOFPackage, IOFStationReplayState, IOFObjectReplayState, IOFScopeReplayState } from "./types";
import type { IOFEvent } from "./eventTypes";
import type { IOFCloseRecord } from "./closeHelpers";
import { isCloseEvent } from "./eventTypes";
import { evaluateStateModel } from "./stateMachine";
import {
  buildCloseActivationMap,
  buildLatestStationCloseMap,
  getCloseType,
  getCloseTimestamp,
  getCloseStationId,
  getNextCloseTypeForObject,
  normalizeId,
} from "./closeHelpers";

function deriveTwinStatus(closeType?: string, isActivated?: boolean): string {
  if (!closeType) {
    return isActivated ? "in_progress" : "planned";
  }
  const type = closeType.toLowerCase();

  if (type.includes("pricing")) return "priced";
  if (type.includes("engineering")) return "engineering";
  if (type.includes("permit")) return "permitting";
  if (type.includes("construction")) return "build";
  if (type.includes("splice")) return "testing";
  if (type.includes("asbuilt")) return "complete";

  return "in_progress";
}

export type IOFReplayStep = {
  event: IOFEvent;
  completedCloseTypes: string[];
  stateEvaluation: ReturnType<typeof evaluateStateModel>;
};

export type IOFReplayResult = {
  initialState: ReturnType<typeof evaluateStateModel>;
  steps: IOFReplayStep[];
  finalState: ReturnType<typeof evaluateStateModel>;
};

export function replayIOFEvents(
  scopePackage: IOFPackage,
  events: IOFEvent[]
): IOFReplayResult {
  const completedCloseTypes: string[] = [];
  const steps: IOFReplayStep[] = [];

  const initialState = evaluateStateModel(
    scopePackage.canonicalTruth.closeTaxonomy,
    scopePackage.canonicalTruth.stateModel,
    []
  );

  for (const event of events) {
    if (isCloseEvent(event) && event.payload?.closeType) {
      const closeType = String(event.payload.closeType);
      if (!completedCloseTypes.includes(closeType)) {
        completedCloseTypes.push(closeType);
      }
    }

    const stateEvaluation = evaluateStateModel(
      scopePackage.canonicalTruth.closeTaxonomy,
      scopePackage.canonicalTruth.stateModel,
      completedCloseTypes
    );

    steps.push({
      event,
      completedCloseTypes: [...completedCloseTypes],
      stateEvaluation,
    });
  }

  return {
    initialState,
    steps,
    finalState: steps.length > 0 ? steps[steps.length - 1].stateEvaluation : initialState,
  };
}

export function computeScopeReplayState(
  scopePackage: IOFPackage,
  closes: IOFCloseRecord[]
): IOFScopeReplayState {
  const activationMap = buildCloseActivationMap(closes);
  const executionMap = buildLatestStationCloseMap(closes, {
    ignorePricing: true,
    ignoreWorkActivated: true,
  });

  const stations = new Map<string, IOFStationReplayState>();
  const objects = new Map<string, IOFObjectReplayState>();
  const stationObjects = new Map<string, IOFObjectReplayState[]>();

  // Compute object states first so station completion can be derived from object progress.
  for (const obj of scopePackage.canonicalTruth.objects) {
    const objectId = normalizeId(obj.id);
    const stationId = normalizeId(obj.stationId);
    const nextCloseType = getNextCloseTypeForObject(
      objectId,
      stationId,
      obj.type,
      closes,
      scopePackage.canonicalTruth.closeTaxonomy
    );
    const isEligible = !!nextCloseType;

    const objectState = {
      objectId,
      nextCloseType: nextCloseType || undefined,
      isEligible,
    };

    objects.set(objectId, objectState);

    if (!stationObjects.has(stationId)) {
      stationObjects.set(stationId, []);
    }
    stationObjects.get(stationId)?.push(objectState);
  }

  // Compute station states
  for (const station of scopePackage.canonicalTruth.stations) {
    const stationId = normalizeId(station.id);
    const isActivated = activationMap.get(stationId) || false;
    const latestClose = executionMap.get(stationId);
    const latestCloseType = latestClose ? getCloseType(latestClose) : undefined;
    const latestCloseTime = latestClose ? getCloseTimestamp(latestClose) : undefined;
    const closeCount = closes.filter(c => normalizeId(getCloseStationId(c)) === stationId).length;

    const stationObjectStates = stationObjects.get(stationId) || [];
    const allObjectsComplete =
      stationObjectStates.length > 0 &&
      stationObjectStates.every((objState) => !objState.nextCloseType);

    let status = "pending";
    if (allObjectsComplete) {
      status = "complete";
    } else if (isActivated) {
      status = "in-progress";
    }
    // Override with TwinMode-specific status derivation
    status = deriveTwinStatus(latestCloseType, isActivated);
    stations.set(stationId, {
      stationId,
      isActivated,
      latestCloseType,
      latestCloseTime,
      closeCount,
      status,
    });
  }

  // Compute overall state
  const completedCloseTypes = closes.map(c => getCloseType(c)).filter(Boolean) as string[];
  const overallState = evaluateStateModel(
    scopePackage.canonicalTruth.closeTaxonomy,
    scopePackage.canonicalTruth.stateModel,
    completedCloseTypes
  );

  return {
    stations,
    objects,
    activationMap,
    executionMap,
    overallState,
  };
}
