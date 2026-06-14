import type {
  IOFStateModel,
  IOFCloseTaxonomy,
  IOFStateDefinition,
} from "./types";

export type IOFStateEvaluation = {
  currentState: string;
  completedStates: string[];
  pendingRequirements: Record<string, string[]>;
};

export function getStateDefinition(
  stateModel: IOFStateModel,
  stateName: string
): IOFStateDefinition | undefined {
  return stateModel.states.find((state) => state.state === stateName);
}

export function evaluateStateModel(
  closeTaxonomy: IOFCloseTaxonomy,
  stateModel: IOFStateModel,
  completedCloseTypes: string[]
): IOFStateEvaluation {
  const completed = new Set(completedCloseTypes || []);
  const completedStates: string[] = [];
  const pendingRequirements: Record<string, string[]> = {};
  let currentState = "unknown";

  for (const state of stateModel.states) {
    const requirements = state.requires || [];
    const missing = requirements.filter((req) => !completed.has(req));

    if (missing.length === 0) {
      completedStates.push(state.state);
      currentState = state.state;
      pendingRequirements[state.state] = [];
    } else {
      pendingRequirements[state.state] = missing;
      break;
    }
  }

  if (currentState === "unknown" && stateModel.states.length > 0) {
    currentState = stateModel.states[0].state;
  }

  return {
    currentState,
    completedStates,
    pendingRequirements,
  };
}

export function getRequiredCloseTypes(
  stateModel: IOFStateModel,
  stateName: string
): string[] {
  return getStateDefinition(stateModel, stateName)?.requires ?? [];
}

export function isStateComplete(
  stateModel: IOFStateModel,
  stateName: string,
  completedCloseTypes: string[]
): boolean {
  const required = getRequiredCloseTypes(stateModel, stateName);
  return required.every((req) => completedCloseTypes.includes(req));
}
