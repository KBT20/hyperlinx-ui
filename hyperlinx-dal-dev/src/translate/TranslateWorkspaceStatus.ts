export type TranslateWorkspaceStatus =
  | "INTAKE"
  | "INTENT_SELECTED"
  | "PROTECTION_SELECTED"
  | "ARCHITECTURE_SELECTED"
  | "BASELINE_SYNTHESIZED"
  | "READY_FOR_SCOPE_REVIEW"
  | "BLOCKED";

export type TranslateWorkspaceNextActionType =
  | "SELECT_NETWORK_TYPE"
  | "SELECT_PROTECTION"
  | "GENERATE_BASELINE"
  | "OPEN_SCOPE_REVIEW"
  | "RESOLVE_BLOCKERS";

export interface TranslateWorkspaceNextAction {
  actionId: string;
  actionType: TranslateWorkspaceNextActionType;
  label: string;
  targetWorkspace: "Translate" | "Scope Review";
  reason: string;
  blockerCount: number;
  noExecution: true;
  noPersistence: true;
}

export function createTranslateWorkspaceNextAction(
  opportunityId: string,
  actionType: TranslateWorkspaceNextActionType,
  reason: string,
  blockerCount = 0,
): TranslateWorkspaceNextAction {
  const labels: Record<TranslateWorkspaceNextActionType, string> = {
    SELECT_NETWORK_TYPE: "Select Network Type",
    SELECT_PROTECTION: "Select Protection",
    GENERATE_BASELINE: "Generate Baseline",
    OPEN_SCOPE_REVIEW: "Open Scope Review",
    RESOLVE_BLOCKERS: "Resolve Blockers",
  };

  return {
    actionId: `TRANSLATE-NEXT-${opportunityId}-${actionType}`,
    actionType,
    label: labels[actionType],
    targetWorkspace: actionType === "OPEN_SCOPE_REVIEW" ? "Scope Review" : "Translate",
    reason,
    blockerCount,
    noExecution: true,
    noPersistence: true,
  };
}
