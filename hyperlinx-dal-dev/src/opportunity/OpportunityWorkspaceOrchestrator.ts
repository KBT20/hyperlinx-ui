import { evaluateOpportunityLaunchReadiness } from "../customer/OpportunityLaunchEngine";
import type { BaselineNetworkCandidate } from "../translate/BaselineNetworkCandidate";
import type {
  OpportunityDetailWorkspace,
  OpportunityDetailWorkspaceInput,
  OpportunityStageSignal,
  OpportunitySummary,
  OpportunityWorkspaceDiagnostic,
  OpportunityWorkspaceStatus,
} from "./OpportunityDetailWorkspace";
import { createOpportunityNextAction, type OpportunityNextAction, type OpportunityNextActionType } from "./OpportunityNextAction";
import { createOpportunityStatusCard, type OpportunityStatusCard, type OpportunityStatusCardState } from "./OpportunityStatusCard";

const WORKSPACE_SECTIONS: OpportunityDetailWorkspace["sections"] = [
  "CUSTOMER_SUMMARY",
  "OPPORTUNITY_SUMMARY",
  "NETWORK_INTENT",
  "PROTECTION_SCHEMA",
  "LOCATIONS",
  "ATTACHMENTS",
  "TRANSLATE_STATUS",
  "BASELINE_NETWORK_SUMMARY",
  "SCOPE_REVIEW_STATUS",
  "PRISM_STATUS",
  "PRELIMINARY_QUOTE_STATUS",
  "NEXT_ACTION",
  "DIAGNOSTICS",
];

function now(value?: string): string {
  return value ?? new Date().toISOString();
}

function diagnostic(
  code: OpportunityWorkspaceDiagnostic["code"],
  severity: OpportunityWorkspaceDiagnostic["severity"],
  message: string,
  input: OpportunityDetailWorkspaceInput,
  details?: Record<string, unknown>,
): OpportunityWorkspaceDiagnostic {
  const entry: OpportunityWorkspaceDiagnostic = {
    code,
    severity,
    customerId: input.opportunity.customerId,
    opportunityId: input.opportunity.opportunityId,
    message,
    timestamp: now(input.evaluatedAt),
    details,
  };
  console.info(`[${code}]`, entry);
  return entry;
}

function signalToCardState(signal?: OpportunityStageSignal): OpportunityStatusCardState {
  if (!signal) return "NOT_STARTED";
  return signal === "READY" ? "READY" : signal;
}

function reviewSignal(input: OpportunityDetailWorkspaceInput): OpportunityStageSignal {
  const status = input.stageContext?.scopeReviewStatus;
  if (!status) return "NOT_STARTED";
  if (status === "APPROVED_FOR_PRISM" || status === "REVIEW_COMPLETE") return "COMPLETE";
  if (status === "BLOCKED") return "BLOCKED";
  if (status === "UNDER_REVIEW" || status === "REVISION_REQUESTED") return "IN_PROGRESS";
  return "READY";
}

function hasBaselineReady(baseline?: BaselineNetworkCandidate): boolean {
  return baseline?.status === "READY_FOR_SCOPE_REVIEW";
}

export function identifyWorkspaceBlockers(input: OpportunityDetailWorkspaceInput): string[] {
  const blockers: string[] = [];
  const add = (message: string) => {
    blockers.push(message);
    diagnostic("OPPORTUNITY_WORKSPACE_BLOCKER_IDENTIFIED", "WARNING", message, input);
  };

  if (!input.opportunity.customerId || !input.opportunity.opportunityId) add("Customer and opportunity are required.");
  if (!input.networkIntent?.networkType || !input.protectionSchema?.schemaType) add("Network type and protection schema must be selected.");
  if (!input.opportunity.locations.length) add("At least one location is required.");
  const launch = input.stageContext?.launchResult ?? evaluateOpportunityLaunchReadiness({
    opportunity: input.opportunity,
    networkIntent: input.networkIntent,
    protectionSchema: input.protectionSchema,
    evaluatedAt: input.evaluatedAt,
  });
  launch.blockers.filter((blocker) => blocker.blocksLaunch).forEach((blocker) => add(blocker.message));
  if (input.stageContext?.baselineNetwork?.status === "BLOCKED") {
    input.stageContext.baselineNetwork.blockers.forEach((blocker) => add(`Baseline blocked: ${blocker}`));
  }
  if (input.stageContext?.scopeReviewStatus === "BLOCKED") add("Scope Review is blocked.");
  if (input.stageContext?.prismStatus === "BLOCKED") add("Prism is blocked.");
  if (input.stageContext?.preliminaryQuoteStatus === "BLOCKED") add("Preliminary Quote is blocked.");

  return Array.from(new Set(blockers));
}

export function determineOpportunityStatus(input: OpportunityDetailWorkspaceInput): OpportunityWorkspaceStatus {
  const blockers = identifyWorkspaceBlockers(input);
  const translateStatus = input.stageContext?.translateStatus;
  const baselineReady = hasBaselineReady(input.stageContext?.baselineNetwork);
  const review = reviewSignal(input);
  const prismStatus = input.stageContext?.prismStatus;
  const quoteStatus = input.stageContext?.preliminaryQuoteStatus;
  const launch = input.stageContext?.launchResult ?? evaluateOpportunityLaunchReadiness({
    opportunity: input.opportunity,
    networkIntent: input.networkIntent,
    protectionSchema: input.protectionSchema,
    evaluatedAt: input.evaluatedAt,
  });

  let status: OpportunityWorkspaceStatus;
  if (blockers.length) status = "BLOCKED";
  else if (quoteStatus === "READY" || quoteStatus === "COMPLETE") status = "QUOTE_READY";
  else if (prismStatus === "COMPLETE") status = "PRISM_COMPLETE";
  else if (review === "COMPLETE") status = "READY_FOR_PRISM";
  else if (review === "IN_PROGRESS") status = "SCOPE_REVIEW_IN_PROGRESS";
  else if (baselineReady) status = "SCOPE_REVIEW_READY";
  else if (translateStatus === "COMPLETE") status = "BASELINE_READY";
  else if (translateStatus === "IN_PROGRESS") status = "TRANSLATE_IN_PROGRESS";
  else if (launch.translateLaunchAllowed) status = "READY_TO_LAUNCH_TRANSLATE";
  else if (input.opportunity.customerId && input.opportunity.opportunityId) status = "INTAKE_READY";
  else status = "DRAFT";

  diagnostic("OPPORTUNITY_STATUS_DETERMINED", status === "BLOCKED" ? "WARNING" : "INFO", `Opportunity status determined: ${status}`, input, {
    status,
    blockerCount: blockers.length,
  });
  return status;
}

export function determineNextAction(input: OpportunityDetailWorkspaceInput): OpportunityNextAction {
  const blockers = identifyWorkspaceBlockers(input);
  const status = determineOpportunityStatus(input);
  let actionType: OpportunityNextActionType;
  let reason: string;

  if (!input.opportunity.customerId || !input.opportunity.opportunityId) {
    actionType = "COMPLETE_INTAKE";
    reason = "Customer and opportunity context must be completed.";
  } else if (!input.networkIntent?.networkType) {
    actionType = "SELECT_INTENT";
    reason = "Network type must be selected.";
  } else if (!input.protectionSchema?.schemaType) {
    actionType = "SELECT_PROTECTION";
    reason = "Protection schema must be selected.";
  } else if (!input.opportunity.locations.length) {
    actionType = "ADD_LOCATIONS";
    reason = "At least one location is required.";
  } else if (status === "READY_TO_LAUNCH_TRANSLATE" || status === "INTAKE_READY") {
    actionType = "LAUNCH_TRANSLATE";
    reason = "Opportunity is ready to launch Translate.";
  } else if (status === "BASELINE_READY") {
    actionType = "GENERATE_BASELINE";
    reason = "Translate evidence is complete and the Baseline Network Candidate should be generated.";
  } else if (status === "SCOPE_REVIEW_READY") {
    actionType = "OPEN_SCOPE_REVIEW";
    reason = "Baseline Network Candidate is ready for Scope Review.";
  } else if (status === "READY_FOR_PRISM") {
    actionType = "RUN_PRISM";
    reason = "Scope Review is complete and ready for Prism.";
  } else if (status === "PRISM_COMPLETE") {
    actionType = "GENERATE_PRELIMINARY_QUOTE";
    reason = "Prism is complete and preliminary quote can be generated.";
  } else if (status === "QUOTE_READY") {
    actionType = "PREPARE_CUSTOMER_DISCUSSION";
    reason = "Preliminary quote is ready for customer discussion.";
  } else {
    actionType = "RESOLVE_BLOCKERS";
    reason = blockers[0] ?? "Resolve blockers before progressing.";
  }

  const nextAction = createOpportunityNextAction(input.opportunity.opportunityId || input.opportunity.requestId, actionType, reason, blockers.length);
  diagnostic("OPPORTUNITY_NEXT_ACTION_DETERMINED", blockers.length ? "WARNING" : "INFO", `Next action determined: ${nextAction.actionType}`, input, {
    nextAction: nextAction.actionType,
    status,
  });
  return nextAction;
}

export function buildOpportunityStatusCards(input: OpportunityDetailWorkspaceInput): OpportunityStatusCard[] {
  const status = determineOpportunityStatus(input);
  const nextAction = determineNextAction(input);
  const baseline = input.stageContext?.baselineNetwork;
  const review = reviewSignal(input);
  const translateStatus = input.stageContext?.translateStatus ?? (status === "READY_TO_LAUNCH_TRANSLATE" ? "READY" : "NOT_STARTED");

  return [
    createOpportunityStatusCard({
      cardId: `${input.opportunity.opportunityId}-CARD-INTAKE`,
      cardType: "INTAKE",
      status: status === "BLOCKED" ? "BLOCKED" : "COMPLETE",
      summary: "Customer, opportunity, products, locations, and attachments are summarized for launch.",
      blockers: identifyWorkspaceBlockers(input).filter((item) => item.includes("Customer") || item.includes("location") || item.includes("Network")),
      nextAction,
      lastUpdated: input.opportunity.updatedAt,
    }),
    createOpportunityStatusCard({
      cardId: `${input.opportunity.opportunityId}-CARD-TRANSLATE`,
      cardType: "TRANSLATE",
      status: signalToCardState(translateStatus),
      summary: "Translate normalizes evidence and prepares baseline synthesis inputs.",
      blockers: [],
      nextAction: nextAction.targetWorkspace === "Translate" ? nextAction : undefined,
      lastUpdated: input.evaluatedAt ?? input.opportunity.updatedAt,
    }),
    createOpportunityStatusCard({
      cardId: `${input.opportunity.opportunityId}-CARD-BASELINE`,
      cardType: "BASELINE_NETWORK",
      status: baseline ? (baseline.status === "READY_FOR_SCOPE_REVIEW" ? "READY" : "BLOCKED") : "NOT_STARTED",
      summary: baseline?.referenceArchitecture ?? "Baseline Network Candidate has not been synthesized.",
      blockers: baseline?.blockers ?? [],
      nextAction: nextAction.actionType === "OPEN_SCOPE_REVIEW" ? nextAction : undefined,
      lastUpdated: baseline?.generatedAt ?? input.opportunity.updatedAt,
    }),
    createOpportunityStatusCard({
      cardId: `${input.opportunity.opportunityId}-CARD-SCOPE-REVIEW`,
      cardType: "SCOPE_REVIEW",
      status: signalToCardState(review),
      summary: input.stageContext?.scopeReviewStatus ?? "Scope Review has not started.",
      blockers: input.stageContext?.scopeReviewStatus === "BLOCKED" ? ["Scope Review is blocked."] : [],
      nextAction: nextAction.actionType === "RUN_PRISM" || nextAction.actionType === "OPEN_SCOPE_REVIEW" ? nextAction : undefined,
      lastUpdated: input.evaluatedAt ?? input.opportunity.updatedAt,
    }),
    createOpportunityStatusCard({
      cardId: `${input.opportunity.opportunityId}-CARD-PRISM`,
      cardType: "PRISM",
      status: signalToCardState(input.stageContext?.prismStatus),
      summary: input.stageContext?.prismStatus === "COMPLETE" ? "Prism scoring is complete." : "Prism has not completed.",
      blockers: input.stageContext?.prismStatus === "BLOCKED" ? ["Prism is blocked."] : [],
      nextAction: nextAction.actionType === "GENERATE_PRELIMINARY_QUOTE" ? nextAction : undefined,
      lastUpdated: input.evaluatedAt ?? input.opportunity.updatedAt,
    }),
    createOpportunityStatusCard({
      cardId: `${input.opportunity.opportunityId}-CARD-QUOTE`,
      cardType: "PRELIMINARY_QUOTE",
      status: signalToCardState(input.stageContext?.preliminaryQuoteStatus),
      summary: input.stageContext?.preliminaryQuoteStatus === "READY" || input.stageContext?.preliminaryQuoteStatus === "COMPLETE"
        ? "Preliminary quote is ready."
        : "Preliminary quote has not been generated.",
      blockers: input.stageContext?.preliminaryQuoteStatus === "BLOCKED" ? ["Preliminary quote is blocked."] : [],
      nextAction: nextAction.actionType === "PREPARE_CUSTOMER_DISCUSSION" ? nextAction : undefined,
      lastUpdated: input.evaluatedAt ?? input.opportunity.updatedAt,
    }),
  ];
}

function buildSummary(input: OpportunityDetailWorkspaceInput, status: OpportunityWorkspaceStatus, nextAction: OpportunityNextAction): OpportunitySummary {
  return {
    customerId: input.opportunity.customerId,
    customerName: input.opportunity.customerName,
    opportunityId: input.opportunity.opportunityId,
    opportunityName: input.opportunity.opportunityName,
    accountOwner: input.opportunity.accountOwner,
    businessSponsor: input.opportunity.businessSponsor,
    networkType: input.networkIntent?.networkType,
    protectionSchema: input.protectionSchema?.schemaType,
    requestedProducts: input.opportunity.requestedProducts,
    requestedServices: input.opportunity.requestedServices,
    locationCount: input.opportunity.locations.length,
    attachmentCount: input.opportunity.attachments.length,
    currentStatus: status,
    nextAction,
  };
}

export function generateWorkspaceDiagnostics(input: OpportunityDetailWorkspaceInput): OpportunityWorkspaceDiagnostic[] {
  const status = determineOpportunityStatus(input);
  return [
    diagnostic("OPPORTUNITY_WORKSPACE_BUILT", "INFO", "Opportunity Detail Workspace built.", input, {
      status,
      opportunityId: input.opportunity.opportunityId,
    }),
    diagnostic("OPPORTUNITY_WORKSPACE_READY", status === "BLOCKED" ? "WARNING" : "INFO", status === "BLOCKED" ? "Opportunity Detail Workspace has blockers." : "Opportunity Detail Workspace is ready.", input, {
      status,
    }),
  ];
}

export function buildOpportunityDetailWorkspace(input: OpportunityDetailWorkspaceInput): OpportunityDetailWorkspace {
  const blockers = identifyWorkspaceBlockers(input);
  const status = determineOpportunityStatus(input);
  const nextAction = determineNextAction(input);
  const statusCards = buildOpportunityStatusCards(input);

  return {
    workspaceId: "OPPORTUNITY_DETAIL",
    title: `Opportunity Detail: ${input.opportunity.opportunityName}`,
    opportunity: input.opportunity,
    networkIntent: input.networkIntent,
    protectionSchema: input.protectionSchema,
    summary: buildSummary(input, status, nextAction),
    status,
    sections: WORKSPACE_SECTIONS,
    statusCards,
    nextAction,
    blockers,
    diagnostics: generateWorkspaceDiagnostics(input),
    stageContext: input.stageContext ?? {},
    noPersistence: true,
    noServerRoutes: true,
    noProductionUiWiring: true,
    noReactImplementation: true,
  };
}
