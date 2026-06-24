import type { OpportunityRequest } from "../opportunity/OpportunityRequest";
import type { NetworkIntent, NetworkType } from "../translate/NetworkIntent";
import type { ProtectionSchema, ProtectionSchemaType } from "../translate/ProtectionSchema";

export type OpportunityLaunchStatus =
  | "DRAFT"
  | "READY_TO_LAUNCH"
  | "LAUNCHED_TO_TRANSLATE"
  | "BLOCKED";

export type OpportunityLaunchDiagnosticCode =
  | "OPPORTUNITY_LAUNCH_EVALUATED"
  | "OPPORTUNITY_LAUNCH_BLOCKER_IDENTIFIED"
  | "READY_TO_LAUNCH"
  | "LAUNCHED_TO_TRANSLATE"
  | "OPPORTUNITY_LAUNCH_BLOCKED";

export interface OpportunityLaunchDiagnostic {
  code: OpportunityLaunchDiagnosticCode;
  severity: "INFO" | "WARNING" | "ERROR" | "CRITICAL";
  customerId?: string;
  opportunityId?: string;
  message: string;
  timestamp: string;
  details?: Record<string, unknown>;
}

export interface OpportunityLaunchBlocker {
  blockerId: string;
  field: string;
  severity: "WARNING" | "ERROR" | "CRITICAL";
  message: string;
  blocksLaunch: boolean;
}

export interface OpportunityLaunch {
  launchId: string;
  customerId: string;
  opportunityId: string;
  networkIntent?: NetworkIntent;
  protectionSchema?: ProtectionSchema;
  status: OpportunityLaunchStatus;
  requestedBy?: string;
  evaluatedAt: string;
  targetWorkspace: "Translate";
  noPersistence: true;
  noStateMutation: true;
  noWorkflowExecution: true;
}

export interface OpportunityLaunchInput {
  launchId?: string;
  opportunity: OpportunityRequest;
  networkIntent?: NetworkIntent;
  protectionSchema?: ProtectionSchema;
  requestedBy?: string;
  evaluatedAt?: string;
}

export interface OpportunityLaunchResult {
  launch: OpportunityLaunch;
  status: OpportunityLaunchStatus;
  blockers: OpportunityLaunchBlocker[];
  diagnostics: OpportunityLaunchDiagnostic[];
  nextWorkspace?: "Translate";
  translateLaunchAllowed: boolean;
  noPersistence: true;
  noStateMutation: true;
}

export interface OpportunityLaunchSummary {
  opportunityId: string;
  opportunityName: string;
  networkType?: NetworkType;
  protectionSchema?: ProtectionSchemaType;
  status: OpportunityLaunchStatus;
  readiness: "READY" | "BLOCKED";
  nextAction: "LAUNCH_TRANSLATE" | "RESOLVE_BLOCKERS";
  blockerCount: number;
  lastUpdated: string;
}
