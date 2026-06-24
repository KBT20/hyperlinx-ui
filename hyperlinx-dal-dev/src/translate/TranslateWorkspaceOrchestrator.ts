import { generateBaselineNetwork } from "./BaselineNetworkSynthesisEngine";
import type { BaselineNetworkCandidate } from "./BaselineNetworkCandidate";
import type {
  TranslateWorkspace,
  TranslateWorkspaceBlocker,
  TranslateWorkspaceDiagnostic,
  TranslateWorkspaceInput,
} from "./TranslateWorkspace";
import {
  summarizeBaselineCandidate,
  type ArchitectureSummaryCardModel,
  type BaselineSummaryCardModel,
  type TranslateWorkspaceSummary,
} from "./TranslateWorkspaceSummary";
import {
  createTranslateWorkspaceNextAction,
  type TranslateWorkspaceNextAction,
  type TranslateWorkspaceNextActionType,
  type TranslateWorkspaceStatus,
} from "./TranslateWorkspaceStatus";

function now(value?: string): string {
  return value ?? new Date().toISOString();
}

function blocker(input: Omit<TranslateWorkspaceBlocker, "blockerId"> & { opportunityId: string }): TranslateWorkspaceBlocker {
  const entry: TranslateWorkspaceBlocker = {
    blockerId: `TRANSLATE-BLOCKER-${input.opportunityId}-${input.field}`.replace(/[^A-Z0-9-]+/gi, "-").toUpperCase(),
    field: input.field,
    severity: input.severity,
    message: input.message,
    blocksScopeReview: input.blocksScopeReview,
  };
  console.info("[TRANSLATE_BLOCKED]", entry);
  return entry;
}

function diagnostic(
  code: TranslateWorkspaceDiagnostic["code"],
  severity: TranslateWorkspaceDiagnostic["severity"],
  message: string,
  input: TranslateWorkspaceInput,
  details?: Record<string, unknown>,
): TranslateWorkspaceDiagnostic {
  const entry: TranslateWorkspaceDiagnostic = {
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

function resolveBaselineCandidate(input: TranslateWorkspaceInput): BaselineNetworkCandidate | undefined {
  if (input.baselineNetworkCandidate) return input.baselineNetworkCandidate;
  if (!input.networkIntent || !input.protectionSchema) return undefined;

  return generateBaselineNetwork({
    candidateId: `BNC-${input.opportunity.opportunityId}`,
    customerContext: {
      customerId: input.opportunity.customerId,
      customerName: input.opportunity.customerName,
      customerType: input.opportunity.customerType,
    },
    opportunityContext: {
      opportunityId: input.opportunity.opportunityId,
      opportunityName: input.opportunity.opportunityName,
      opportunityDescription: input.opportunity.narrative,
    },
    selectedIntent: input.networkIntent,
    selectedProtection: input.protectionSchema,
    corridorId: `CORRIDOR-${input.opportunity.opportunityId}`,
    requestedAt: input.evaluatedAt,
  });
}

export function identifyTranslateBlockers(input: TranslateWorkspaceInput): TranslateWorkspaceBlocker[] {
  const baseline = resolveBaselineCandidate(input);
  const blockers: TranslateWorkspaceBlocker[] = [];
  const add = (field: string, message: string, severity: TranslateWorkspaceBlocker["severity"] = "ERROR", blocksScopeReview = true) =>
    blockers.push(blocker({ opportunityId: input.opportunity.opportunityId || input.opportunity.requestId, field, message, severity, blocksScopeReview }));

  if (!input.opportunity.customerId) add("customerId", "Customer ID is required.", "CRITICAL");
  if (!input.opportunity.opportunityId) add("opportunityId", "Opportunity ID is required.", "CRITICAL");
  if (!input.networkIntent?.networkType) add("networkType", "Network Type must be selected.");
  if (!input.protectionSchema?.schemaType) add("protectionSchema", "Protection Schema must be selected.");
  if (input.networkIntent && input.networkIntent.customerId !== input.opportunity.customerId) {
    add("networkIntent.customerId", "Network Intent customer does not match opportunity customer.");
  }
  if (input.networkIntent && input.networkIntent.opportunityId !== input.opportunity.opportunityId) {
    add("networkIntent.opportunityId", "Network Intent opportunity does not match opportunity.");
  }
  if (input.protectionSchema && input.protectionSchema.customerId !== input.opportunity.customerId) {
    add("protectionSchema.customerId", "Protection Schema customer does not match opportunity customer.");
  }
  if (input.protectionSchema && input.protectionSchema.opportunityId !== input.opportunity.opportunityId) {
    add("protectionSchema.opportunityId", "Protection Schema opportunity does not match opportunity.");
  }
  if (input.networkIntent && input.protectionSchema && !baseline?.architectureSelection) {
    add("architecture", "Reference Architecture must be selected.");
  }
  if (baseline && baseline.candidateObjects.length < 1) add("baselineObjects", "At least one Baseline Network object is required.");
  if (baseline?.status === "BLOCKED") {
    baseline.blockers.forEach((item) => add(`baseline.${item}`, `Baseline synthesis blocker: ${item}`));
  }

  return Array.from(new Map(blockers.map((item) => [item.blockerId, item])).values());
}

export function evaluateTranslateReadiness(input: TranslateWorkspaceInput): {
  readiness: "READY_FOR_SCOPE_REVIEW" | "BLOCKED";
  blockers: TranslateWorkspaceBlocker[];
} {
  const blockers = identifyTranslateBlockers(input).filter((item) => item.blocksScopeReview);
  return {
    readiness: blockers.length ? "BLOCKED" : "READY_FOR_SCOPE_REVIEW",
    blockers,
  };
}

export function evaluateTranslateStatus(input: TranslateWorkspaceInput): TranslateWorkspaceStatus {
  const baseline = resolveBaselineCandidate(input);
  const readiness = evaluateTranslateReadiness({ ...input, baselineNetworkCandidate: baseline });

  let status: TranslateWorkspaceStatus;
  if (readiness.blockers.some((item) => item.severity === "CRITICAL")) status = "BLOCKED";
  else if (readiness.readiness === "READY_FOR_SCOPE_REVIEW") status = "READY_FOR_SCOPE_REVIEW";
  else if (baseline?.candidateObjects.length) status = "BASELINE_SYNTHESIZED";
  else if (baseline?.architectureSelection) status = "ARCHITECTURE_SELECTED";
  else if (input.protectionSchema?.schemaType) status = "PROTECTION_SELECTED";
  else if (input.networkIntent?.networkType) status = "INTENT_SELECTED";
  else status = input.opportunity.customerId && input.opportunity.opportunityId ? "INTAKE" : "BLOCKED";

  return status;
}

function determineTranslateNextAction(input: TranslateWorkspaceInput, status: TranslateWorkspaceStatus, blockers: readonly TranslateWorkspaceBlocker[]): TranslateWorkspaceNextAction {
  let actionType: TranslateWorkspaceNextActionType;
  let reason: string;

  if (blockers.some((item) => item.severity === "CRITICAL")) {
    actionType = "RESOLVE_BLOCKERS";
    reason = blockers[0]?.message ?? "Resolve blockers before continuing.";
  } else if (!input.networkIntent?.networkType) {
    actionType = "SELECT_NETWORK_TYPE";
    reason = "Select Network Type before architecture selection.";
  } else if (!input.protectionSchema?.schemaType) {
    actionType = "SELECT_PROTECTION";
    reason = "Select Protection Schema before architecture selection.";
  } else if (status === "READY_FOR_SCOPE_REVIEW") {
    actionType = "OPEN_SCOPE_REVIEW";
    reason = "Baseline Network Candidate is ready for Scope Review.";
  } else if (status === "ARCHITECTURE_SELECTED" || status === "PROTECTION_SELECTED" || status === "INTENT_SELECTED" || status === "INTAKE") {
    actionType = "GENERATE_BASELINE";
    reason = "Generate Baseline Network Candidate from selected architecture.";
  } else {
    actionType = "RESOLVE_BLOCKERS";
    reason = blockers[0]?.message ?? "Resolve blockers before continuing.";
  }

  return createTranslateWorkspaceNextAction(input.opportunity.opportunityId || input.opportunity.requestId, actionType, reason, blockers.length);
}

export function buildBaselineSummary(input: TranslateWorkspaceInput): BaselineSummaryCardModel {
  const baseline = resolveBaselineCandidate(input);
  const readiness = evaluateTranslateReadiness({ ...input, baselineNetworkCandidate: baseline });
  const baselineSummary = summarizeBaselineCandidate(baseline);
  return {
    modelId: "BASELINE_SUMMARY_CARD",
    networkType: input.networkIntent?.networkType,
    protectionSchema: input.protectionSchema?.schemaType,
    referenceArchitecture: baselineSummary.referenceArchitecture,
    candidateObjectCount: baselineSummary.candidateObjectCount,
    candidateFacilityCount: baselineSummary.candidateFacilityCount,
    candidateSegmentCount: baselineSummary.candidateSegmentCount,
    readiness: readiness.readiness,
    blockers: readiness.blockers.map((item) => item.message),
  };
}

function buildArchitectureSummary(input: TranslateWorkspaceInput, baseline?: BaselineNetworkCandidate): ArchitectureSummaryCardModel {
  return {
    modelId: "TRANSLATE_ARCHITECTURE_SUMMARY_CARD",
    referenceArchitecture: baseline?.architectureSelection?.referenceArchitectureId,
    designStandardCount: baseline?.architectureSelection?.designStandardIds.length ?? 0,
    objectCatalogTypeCount: baseline?.architectureSelection?.objectCatalogTypes.length ?? 0,
    humanReviewRequired: Boolean(baseline?.architectureSelection?.humanReviewRequired),
  };
}

function buildSummary(
  input: TranslateWorkspaceInput,
  baseline: BaselineNetworkCandidate | undefined,
  nextAction: TranslateWorkspaceNextAction,
  blockers: readonly TranslateWorkspaceBlocker[],
): TranslateWorkspaceSummary {
  const baselineSummary = summarizeBaselineCandidate(baseline);
  return {
    customerId: input.opportunity.customerId,
    customerName: input.opportunity.customerName,
    opportunityId: input.opportunity.opportunityId,
    opportunityName: input.opportunity.opportunityName,
    networkType: input.networkIntent?.networkType,
    protectionSchema: input.protectionSchema?.schemaType,
    referenceArchitecture: baselineSummary.referenceArchitecture,
    candidateObjectCount: baselineSummary.candidateObjectCount,
    candidateFacilityCount: baselineSummary.candidateFacilityCount,
    candidateSegmentCount: baselineSummary.candidateSegmentCount,
    readiness: blockers.length ? "BLOCKED" : "READY_FOR_SCOPE_REVIEW",
    nextAction,
    blockers: blockers.map((item) => item.message),
  };
}

export function generateTranslateDiagnostics(input: TranslateWorkspaceInput): TranslateWorkspaceDiagnostic[] {
  const baseline = resolveBaselineCandidate(input);
  const status = evaluateTranslateStatus({ ...input, baselineNetworkCandidate: baseline });
  const blockers = identifyTranslateBlockers({ ...input, baselineNetworkCandidate: baseline });
  const diagnostics: TranslateWorkspaceDiagnostic[] = [
    diagnostic("TRANSLATE_WORKSPACE_CREATED", "INFO", "Translate Workspace created.", input, { status }),
  ];

  if (input.networkIntent?.networkType) {
    diagnostics.push(diagnostic("INTENT_CONFIRMED", "INFO", `Intent confirmed: ${input.networkIntent.networkType}`, input));
  }
  if (input.protectionSchema?.schemaType) {
    diagnostics.push(diagnostic("PROTECTION_CONFIRMED", "INFO", `Protection confirmed: ${input.protectionSchema.schemaType}`, input));
  }
  if (baseline?.architectureSelection) {
    diagnostics.push(diagnostic("ARCHITECTURE_SELECTED", "INFO", `Architecture selected: ${baseline.architectureSelection.referenceArchitectureId}`, input));
  }
  if (baseline?.candidateObjects.length) {
    diagnostics.push(diagnostic("BASELINE_SYNTHESIZED", "INFO", "Baseline Network Candidate synthesized.", input, {
      objectCount: baseline.candidateObjects.length,
    }));
  }
  diagnostics.push(
    diagnostic(
      blockers.length ? "TRANSLATE_BLOCKED" : "READY_FOR_SCOPE_REVIEW",
      blockers.length ? "ERROR" : "INFO",
      blockers.length ? "Translate Workspace is blocked." : "Translate Workspace is ready for Scope Review.",
      input,
      { blockerCount: blockers.length },
    ),
  );

  return diagnostics;
}

export function buildTranslateWorkspace(input: TranslateWorkspaceInput): TranslateWorkspace {
  const baseline = resolveBaselineCandidate(input);
  const normalizedInput: TranslateWorkspaceInput = { ...input, baselineNetworkCandidate: baseline };
  const status = evaluateTranslateStatus(normalizedInput);
  const blockers = identifyTranslateBlockers(normalizedInput);
  const nextAction = determineTranslateNextAction(normalizedInput, status, blockers);
  const baselineSummary = buildBaselineSummary(normalizedInput);
  const architectureSummary = buildArchitectureSummary(normalizedInput, baseline);

  return {
    workspaceId: "TRANSLATE_WORKSPACE",
    title: `Translate: ${input.opportunity.opportunityName}`,
    opportunity: input.opportunity,
    networkIntent: input.networkIntent,
    protectionSchema: input.protectionSchema,
    baselineNetworkCandidate: baseline,
    status,
    summary: buildSummary(normalizedInput, baseline, nextAction, blockers),
    blockers,
    diagnostics: generateTranslateDiagnostics(normalizedInput),
    nextAction,
    cards: {
      baselineSummary,
      architectureSummary,
      readiness: {
        modelId: "TRANSLATE_READINESS_CARD",
        readiness: blockers.length ? "BLOCKED" : "READY_FOR_SCOPE_REVIEW",
        nextWorkspace: blockers.length ? undefined : "Scope Review",
        blockers: blockers.map((item) => item.message),
      },
      blockers: {
        modelId: "TRANSLATE_BLOCKER_PANEL",
        blockerCount: blockers.length,
        blockers: blockers.map((item) => item.message),
      },
      nextAction: {
        modelId: "TRANSLATE_NEXT_ACTION_PANEL",
        nextAction,
      },
    },
    noPersistence: true,
    noServerRoutes: true,
    noReactImplementation: true,
    noScopeVersionCreation: true,
    noRouting: true,
    noEngineering: true,
  };
}
