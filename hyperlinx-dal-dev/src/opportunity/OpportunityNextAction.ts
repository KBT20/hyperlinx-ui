export type OpportunityNextActionType =
  | "COMPLETE_INTAKE"
  | "SELECT_INTENT"
  | "SELECT_PROTECTION"
  | "ADD_LOCATIONS"
  | "LAUNCH_TRANSLATE"
  | "GENERATE_BASELINE"
  | "OPEN_SCOPE_REVIEW"
  | "RUN_PRISM"
  | "GENERATE_PRELIMINARY_QUOTE"
  | "PREPARE_CUSTOMER_DISCUSSION"
  | "RESOLVE_BLOCKERS";

export interface OpportunityNextAction {
  actionId: string;
  actionType: OpportunityNextActionType;
  label: string;
  targetWorkspace:
    | "Opportunity Detail"
    | "Opportunity Intake"
    | "Translate"
    | "Scope Review"
    | "Prism"
    | "Preliminary Quote"
    | "Customer Discussion";
  reason: string;
  blockerCount: number;
  noExecution: true;
  noPersistence: true;
}

export function createOpportunityNextAction(
  opportunityId: string,
  actionType: OpportunityNextActionType,
  reason: string,
  blockerCount = 0,
): OpportunityNextAction {
  const labels: Record<OpportunityNextActionType, string> = {
    COMPLETE_INTAKE: "Complete Intake",
    SELECT_INTENT: "Select Intent",
    SELECT_PROTECTION: "Select Protection",
    ADD_LOCATIONS: "Add Locations",
    LAUNCH_TRANSLATE: "Launch Translate",
    GENERATE_BASELINE: "Generate Baseline",
    OPEN_SCOPE_REVIEW: "Open Scope Review",
    RUN_PRISM: "Run Prism",
    GENERATE_PRELIMINARY_QUOTE: "Generate Preliminary Quote",
    PREPARE_CUSTOMER_DISCUSSION: "Prepare Customer Discussion",
    RESOLVE_BLOCKERS: "Resolve Blockers",
  };
  const targets: Record<OpportunityNextActionType, OpportunityNextAction["targetWorkspace"]> = {
    COMPLETE_INTAKE: "Opportunity Intake",
    SELECT_INTENT: "Opportunity Detail",
    SELECT_PROTECTION: "Opportunity Detail",
    ADD_LOCATIONS: "Opportunity Intake",
    LAUNCH_TRANSLATE: "Translate",
    GENERATE_BASELINE: "Translate",
    OPEN_SCOPE_REVIEW: "Scope Review",
    RUN_PRISM: "Prism",
    GENERATE_PRELIMINARY_QUOTE: "Preliminary Quote",
    PREPARE_CUSTOMER_DISCUSSION: "Customer Discussion",
    RESOLVE_BLOCKERS: "Opportunity Detail",
  };

  return {
    actionId: `NEXT-${opportunityId}-${actionType}`,
    actionType,
    label: labels[actionType],
    targetWorkspace: targets[actionType],
    reason,
    blockerCount,
    noExecution: true,
    noPersistence: true,
  };
}
