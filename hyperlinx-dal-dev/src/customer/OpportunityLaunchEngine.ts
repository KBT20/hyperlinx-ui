import { evaluateTranslateReadiness } from "../opportunity/OpportunityIntakeEngine";
import type { OpportunityRequest } from "../opportunity/OpportunityRequest";
import type { NetworkIntent } from "../translate/NetworkIntent";
import type { ProtectionSchema } from "../translate/ProtectionSchema";
import type { Customer } from "./CustomerContract";
import type { CustomerOpportunityStage, CustomerOpportunitySummary, CustomerWorkspace } from "./CustomerWorkspace";
import { createCustomerSummary } from "./CustomerWorkspace";
import type {
  OpportunityLaunch,
  OpportunityLaunchBlocker,
  OpportunityLaunchDiagnostic,
  OpportunityLaunchDiagnosticCode,
  OpportunityLaunchInput,
  OpportunityLaunchResult,
  OpportunityLaunchStatus,
  OpportunityLaunchSummary,
} from "./OpportunityLaunch";

export interface CustomerWorkspaceInputOpportunity {
  opportunity: OpportunityRequest;
  networkIntent?: NetworkIntent;
  protectionSchema?: ProtectionSchema;
  stage?: CustomerOpportunityStage;
}

function now(value?: string): string {
  return value ?? new Date().toISOString();
}

function blocker(input: Omit<OpportunityLaunchBlocker, "blockerId"> & { opportunityId: string }): OpportunityLaunchBlocker {
  const entry: OpportunityLaunchBlocker = {
    blockerId: `LAUNCH-BLOCKER-${input.opportunityId}-${input.field}`.replace(/[^A-Z0-9-]+/gi, "-").toUpperCase(),
    field: input.field,
    severity: input.severity,
    message: input.message,
    blocksLaunch: input.blocksLaunch,
  };
  console.info("[OPPORTUNITY_LAUNCH_BLOCKER_IDENTIFIED]", entry);
  return entry;
}

function diagnostic(
  code: OpportunityLaunchDiagnosticCode,
  severity: OpportunityLaunchDiagnostic["severity"],
  message: string,
  opportunity: OpportunityRequest,
  details?: Record<string, unknown>,
  timestamp?: string,
): OpportunityLaunchDiagnostic {
  const entry: OpportunityLaunchDiagnostic = {
    code,
    severity,
    customerId: opportunity.customerId,
    opportunityId: opportunity.opportunityId,
    message,
    timestamp: now(timestamp),
    details,
  };
  console.info(`[${code}]`, entry);
  return entry;
}

export function identifyLaunchBlockers(input: OpportunityLaunchInput): OpportunityLaunchBlocker[] {
  const { opportunity, networkIntent, protectionSchema } = input;
  const translateReadiness = evaluateTranslateReadiness(opportunity);
  const blockers: OpportunityLaunchBlocker[] = [];
  const add = (field: string, message: string, severity: OpportunityLaunchBlocker["severity"] = "CRITICAL", blocksLaunch = true) =>
    blockers.push(blocker({ opportunityId: opportunity.opportunityId || opportunity.requestId, field, message, severity, blocksLaunch }));

  if (!opportunity.customerId) add("customerId", "Customer ID is required.");
  if (!opportunity.opportunityId) add("opportunityId", "Opportunity ID is required.");
  if (!networkIntent?.networkType) add("networkType", "Network type must be selected before Translate launch.");
  if (!protectionSchema?.schemaType) add("protectionSchema", "Protection schema must be selected before Translate launch.");
  if (!opportunity.locations.length) add("locations", "At least one opportunity location is required.");
  if (networkIntent && networkIntent.customerId !== opportunity.customerId) {
    add("networkIntent.customerId", "Network intent customer does not match opportunity customer.");
  }
  if (networkIntent && networkIntent.opportunityId !== opportunity.opportunityId) {
    add("networkIntent.opportunityId", "Network intent opportunity does not match opportunity.");
  }
  if (protectionSchema && protectionSchema.customerId !== opportunity.customerId) {
    add("protectionSchema.customerId", "Protection schema customer does not match opportunity customer.");
  }
  if (protectionSchema && protectionSchema.opportunityId !== opportunity.opportunityId) {
    add("protectionSchema.opportunityId", "Protection schema opportunity does not match opportunity.");
  }
  if (translateReadiness.status !== "READY_FOR_TRANSLATE") {
    translateReadiness.blockers.forEach((gap) => add(`translate.${gap.field}`, gap.message, gap.severity, true));
  }
  translateReadiness.blockers
    .filter((gap) => gap.severity === "CRITICAL")
    .forEach((gap) => add(`critical.${gap.field}`, `Critical intake blocker: ${gap.message}`, "CRITICAL", true));

  return blockers;
}

export function generateOpportunityLaunchDiagnostics(
  input: OpportunityLaunchInput,
  blockers: readonly OpportunityLaunchBlocker[],
  status: OpportunityLaunchStatus,
): OpportunityLaunchDiagnostic[] {
  const { opportunity } = input;
  const diagnostics: OpportunityLaunchDiagnostic[] = [
    diagnostic("OPPORTUNITY_LAUNCH_EVALUATED", blockers.length ? "WARNING" : "INFO", "Opportunity launch readiness evaluated.", opportunity, {
      networkType: input.networkIntent?.networkType,
      protectionSchema: input.protectionSchema?.schemaType,
      blockerCount: blockers.length,
    }, input.evaluatedAt),
    ...blockers.map((item) =>
      diagnostic("OPPORTUNITY_LAUNCH_BLOCKER_IDENTIFIED", item.severity, item.message, opportunity, {
        blockerId: item.blockerId,
        field: item.field,
      }, input.evaluatedAt),
    ),
  ];

  diagnostics.push(
    diagnostic(
      status === "READY_TO_LAUNCH" ? "READY_TO_LAUNCH" : status === "LAUNCHED_TO_TRANSLATE" ? "LAUNCHED_TO_TRANSLATE" : "OPPORTUNITY_LAUNCH_BLOCKED",
      status === "BLOCKED" ? "ERROR" : "INFO",
      status === "READY_TO_LAUNCH"
        ? "Opportunity is ready to launch Translate."
        : status === "LAUNCHED_TO_TRANSLATE"
          ? "Opportunity launch result targets Translate."
          : "Opportunity launch is blocked.",
      opportunity,
      { status },
      input.evaluatedAt,
    ),
  );

  return diagnostics;
}

function createLaunch(input: OpportunityLaunchInput, status: OpportunityLaunchStatus): OpportunityLaunch {
  const evaluatedAt = now(input.evaluatedAt);
  return {
    launchId: input.launchId ?? `LAUNCH-${input.opportunity.opportunityId || input.opportunity.requestId}`,
    customerId: input.opportunity.customerId,
    opportunityId: input.opportunity.opportunityId,
    networkIntent: input.networkIntent,
    protectionSchema: input.protectionSchema,
    status,
    requestedBy: input.requestedBy,
    evaluatedAt,
    targetWorkspace: "Translate",
    noPersistence: true,
    noStateMutation: true,
    noWorkflowExecution: true,
  };
}

export function evaluateOpportunityLaunchReadiness(input: OpportunityLaunchInput): OpportunityLaunchResult {
  const blockers = identifyLaunchBlockers(input);
  const status: OpportunityLaunchStatus = blockers.some((item) => item.blocksLaunch) ? "BLOCKED" : "READY_TO_LAUNCH";
  const diagnostics = generateOpportunityLaunchDiagnostics(input, blockers, status);
  return {
    launch: createLaunch(input, status),
    status,
    blockers,
    diagnostics,
    nextWorkspace: status === "READY_TO_LAUNCH" ? "Translate" : undefined,
    translateLaunchAllowed: status === "READY_TO_LAUNCH",
    noPersistence: true,
    noStateMutation: true,
  };
}

export function launchOpportunityToTranslate(input: OpportunityLaunchInput): OpportunityLaunchResult {
  const readiness = evaluateOpportunityLaunchReadiness(input);
  if (!readiness.translateLaunchAllowed) return readiness;

  const status: OpportunityLaunchStatus = "LAUNCHED_TO_TRANSLATE";
  const diagnostics = generateOpportunityLaunchDiagnostics(input, [], status);
  return {
    launch: createLaunch(input, status),
    status,
    blockers: [],
    diagnostics,
    nextWorkspace: "Translate",
    translateLaunchAllowed: true,
    noPersistence: true,
    noStateMutation: true,
  };
}

export function createOpportunityLaunchSummary(result: OpportunityLaunchResult, opportunity: OpportunityRequest): OpportunityLaunchSummary {
  return {
    opportunityId: opportunity.opportunityId,
    opportunityName: opportunity.opportunityName,
    networkType: result.launch.networkIntent?.networkType,
    protectionSchema: result.launch.protectionSchema?.schemaType,
    status: result.status,
    readiness: result.translateLaunchAllowed ? "READY" : "BLOCKED",
    nextAction: result.translateLaunchAllowed ? "LAUNCH_TRANSLATE" : "RESOLVE_BLOCKERS",
    blockerCount: result.blockers.length,
    lastUpdated: result.launch.evaluatedAt,
  };
}

export function createCustomerOpportunitySummary(input: CustomerWorkspaceInputOpportunity): CustomerOpportunitySummary {
  const readiness = evaluateOpportunityLaunchReadiness({
    opportunity: input.opportunity,
    networkIntent: input.networkIntent,
    protectionSchema: input.protectionSchema,
    evaluatedAt: input.opportunity.updatedAt,
  });
  const launchSummary = createOpportunityLaunchSummary(readiness, input.opportunity);
  const stage = input.stage ?? (readiness.translateLaunchAllowed ? "READY_FOR_TRANSLATE" : "BLOCKED");
  return {
    opportunityId: input.opportunity.opportunityId,
    opportunityName: input.opportunity.opportunityName,
    networkType: input.networkIntent?.networkType,
    protectionSchema: input.protectionSchema?.schemaType,
    stage,
    status: readiness.status,
    requestedProducts: input.opportunity.requestedProducts,
    locations: input.opportunity.locations,
    attachments: input.opportunity.attachments,
    readiness: readiness.translateLaunchAllowed ? "READY_TO_LAUNCH" : "BLOCKED",
    nextAction: readiness.translateLaunchAllowed
      ? "LAUNCH_TRANSLATE"
      : !input.networkIntent?.networkType
        ? "SELECT_NETWORK_TYPE"
        : !input.protectionSchema?.schemaType
          ? "SELECT_PROTECTION_SCHEMA"
          : !input.opportunity.locations.length
            ? "ADD_LOCATION"
            : "RESOLVE_BLOCKERS",
    lastUpdated: input.opportunity.updatedAt,
    launchSummary,
  };
}

export function createCustomerWorkspace(customer: Customer, opportunities: readonly CustomerWorkspaceInputOpportunity[]): CustomerWorkspace {
  const summaries = opportunities.map(createCustomerOpportunitySummary);
  return {
    workspaceId: "CUSTOMER_WORKSPACE",
    customer: createCustomerSummary(customer),
    opportunities: summaries,
    activeOpportunities: summaries.filter((item) => item.stage !== "BLOCKED" && item.stage !== "OPERATIONAL").length,
    blockedOpportunities: summaries.filter((item) => item.stage === "BLOCKED").length,
    readyForTranslateOpportunities: summaries.filter((item) => item.stage === "READY_FOR_TRANSLATE").length,
    inReviewOpportunities: summaries.filter((item) => item.stage === "SCOPE_REVIEW").length,
    inPrismOpportunities: summaries.filter((item) => item.stage === "PRISM").length,
    inMarketplaceOpportunities: summaries.filter((item) => item.stage === "MARKETPLACE").length,
    contractedOpportunities: summaries.filter((item) => item.stage === "CONTRACTED").length,
    operationalOpportunities: summaries.filter((item) => item.stage === "OPERATIONAL").length,
    noPersistence: true,
    noProductionUiWiring: true,
  };
}
