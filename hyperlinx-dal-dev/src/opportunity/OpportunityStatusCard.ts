import type { OpportunityNextAction } from "./OpportunityNextAction";

export type OpportunityStatusCardType =
  | "INTAKE"
  | "TRANSLATE"
  | "BASELINE_NETWORK"
  | "SCOPE_REVIEW"
  | "PRISM"
  | "PRELIMINARY_QUOTE";

export type OpportunityStatusCardState =
  | "NOT_STARTED"
  | "READY"
  | "IN_PROGRESS"
  | "COMPLETE"
  | "BLOCKED";

export interface OpportunityStatusCard {
  cardId: string;
  cardType: OpportunityStatusCardType;
  status: OpportunityStatusCardState;
  summary: string;
  blockers: string[];
  nextAction?: OpportunityNextAction;
  lastUpdated: string;
}

export function createOpportunityStatusCard(input: OpportunityStatusCard): OpportunityStatusCard {
  return input;
}
