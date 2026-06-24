import {
  isRegisteredOpportunityAttachmentType,
  type OpportunityAttachment,
  type OpportunityAttachmentType,
} from "./OpportunityAttachment";
import type { OpportunityObjective } from "./OpportunityObjective";
import type {
  OpportunityCustomerType,
  OpportunityDiagnostic,
  OpportunityLocation,
  OpportunityRequest,
  OpportunitySource,
  OpportunityStatus,
} from "./OpportunityRequest";
import type { OpportunityPackageCandidate } from "./OpportunityPackageCandidate";
import type {
  AttachmentSummaryModel,
  OpportunityIntakeViewModel,
  OpportunityReadinessCardModel,
  OpportunitySummaryCardModel,
  TranslateReadinessCardModel,
} from "./OpportunityIntake";

export interface CreateOpportunityRequestInput {
  requestId: string;
  customerId: string;
  customerName: string;
  customerType: OpportunityCustomerType;
  opportunityId: string;
  opportunityName: string;
  accountOwner: string;
  businessSponsor?: string;
  requestedDate: string;
  source: OpportunitySource;
  objectives?: OpportunityObjective[];
  locations?: OpportunityLocation[];
  attachments?: OpportunityAttachment[];
  narrative?: string;
}

export interface OpportunityGap {
  gapId: string;
  severity: "WARNING" | "ERROR" | "CRITICAL";
  field: string;
  message: string;
  blocksTranslate: boolean;
}

export interface TranslateReadiness {
  status: "READY_FOR_TRANSLATE" | "BLOCKED";
  blockers: OpportunityGap[];
  diagnostics: OpportunityDiagnostic[];
}

export function createOpportunityRequest(input: CreateOpportunityRequestInput): OpportunityRequest {
  const timestamp = new Date().toISOString();
  const objectives = input.objectives ?? [];
  return {
    requestId: input.requestId,
    customerId: input.customerId,
    customerName: input.customerName,
    customerType: input.customerType,
    opportunityId: input.opportunityId,
    opportunityName: input.opportunityName,
    accountOwner: input.accountOwner,
    businessSponsor: input.businessSponsor,
    requestedDate: input.requestedDate,
    source: input.source,
    status: "INTAKE",
    objectives,
    requestedProducts: Array.from(new Set(objectives.flatMap((objective) => objective.requestedProducts))),
    requestedServices: Array.from(new Set(objectives.flatMap((objective) => objective.requestedServices))),
    locations: input.locations ?? [],
    attachments: input.attachments ?? [],
    narrative: input.narrative,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export function validateOpportunityRequest(request: OpportunityRequest): TranslateReadiness {
  const gaps = identifyOpportunityGaps(request);
  const diagnostics = generateOpportunityDiagnostics(request, gaps);
  const ready = gaps.every((gap) => !gap.blocksTranslate);
  return {
    status: ready ? "READY_FOR_TRANSLATE" : "BLOCKED",
    blockers: gaps.filter((gap) => gap.blocksTranslate),
    diagnostics: [
      ...diagnostics,
      diagnostic(ready ? "READY_FOR_TRANSLATE" : "TRANSLATE_BLOCKED", ready ? "INFO" : "ERROR", ready ? "Opportunity is ready for Translate." : "Opportunity is blocked from Translate.", request, {
        blockerCount: gaps.filter((gap) => gap.blocksTranslate).length,
      }),
    ],
  };
}

export function identifyOpportunityGaps(request: OpportunityRequest): OpportunityGap[] {
  const gaps: OpportunityGap[] = [];
  const add = (field: string, message: string, severity: OpportunityGap["severity"] = "CRITICAL", blocksTranslate = true) => {
    gaps.push({
      gapId: `OPPORTUNITY-GAP-${request.opportunityId || request.requestId}-${field}`.replace(/[^A-Z0-9-]+/gi, "-"),
      severity,
      field,
      message,
      blocksTranslate,
    });
  };

  if (!request.customerId) add("customerId", "Customer ID is required.");
  if (!request.customerName) add("customerName", "Customer name is required.");
  if (!request.customerType) add("customerType", "Customer type is required.");
  if (!request.opportunityId) add("opportunityId", "Opportunity ID is required.");
  if (!request.opportunityName) add("opportunityName", "Opportunity name is required.");
  if (!request.accountOwner) add("accountOwner", "Account owner is required.", "ERROR");
  if (!request.locations.length) add("locations", "At least one location is required.");
  if (!request.objectives.length) add("objectives", "At least one opportunity objective is required.");
  if (!request.attachments.length && !request.narrative) {
    add("attachments", "At least one attachment or narrative is recommended.", "WARNING", false);
  }
  request.attachments.forEach((attachment) => {
    if (!isRegisteredOpportunityAttachmentType(attachment.attachmentType)) {
      add(`attachment:${attachment.attachmentId}`, `Attachment type ${attachment.attachmentType} is not registered.`, "ERROR");
    }
  });
  request.locations.forEach((location) => {
    const hasCoordinates = typeof location.latitude === "number" && typeof location.longitude === "number";
    if (!hasCoordinates && !location.address) {
      add(`location:${location.locationId}`, "Location requires coordinates or address.", "ERROR");
    }
  });

  return gaps;
}

export function generateOpportunityDiagnostics(request: OpportunityRequest, gaps: readonly OpportunityGap[] = identifyOpportunityGaps(request)): OpportunityDiagnostic[] {
  const diagnostics: OpportunityDiagnostic[] = [
    diagnostic("OPPORTUNITY_CREATED", "INFO", "Opportunity request created.", request, {
      source: request.source,
    }),
    diagnostic(gaps.length ? "OPPORTUNITY_GAP_IDENTIFIED" : "OPPORTUNITY_VALIDATED", gaps.length ? maxGapSeverity(gaps) : "INFO", gaps.length ? "Opportunity gaps identified." : "Opportunity request validated.", request, {
      gapCount: gaps.length,
      gaps,
    }),
    ...request.attachments.map((attachment) =>
      diagnostic("OPPORTUNITY_ATTACHMENT_REGISTERED", "INFO", "Opportunity attachment registered.", request, {
        attachmentId: attachment.attachmentId,
        attachmentType: attachment.attachmentType,
      }),
    ),
    ...request.locations.map((location) =>
      diagnostic("OPPORTUNITY_LOCATION_REGISTERED", "INFO", "Opportunity location registered.", request, {
        locationId: location.locationId,
        role: location.role,
        siteName: location.siteName,
      }),
    ),
  ];
  return diagnostics;
}

export function evaluateTranslateReadiness(request: OpportunityRequest): TranslateReadiness {
  return validateOpportunityRequest(request);
}

export function createOpportunityPackage(request: OpportunityRequest): OpportunityPackageCandidate {
  const readiness = evaluateTranslateReadiness(request);
  const status: OpportunityStatus = readiness.status;
  return {
    packageCandidateId: `OPP-PKG-${request.opportunityId}`,
    status,
    customerContext: {
      customerId: request.customerId,
      customerName: request.customerName,
      customerType: request.customerType,
      accountOwner: request.accountOwner,
      businessSponsor: request.businessSponsor,
    },
    opportunityContext: {
      opportunityId: request.opportunityId,
      opportunityName: request.opportunityName,
      requestedDate: request.requestedDate,
      source: request.source,
      narrative: request.narrative,
    },
    attachments: request.attachments,
    locations: request.locations,
    objectives: request.objectives,
    requestedProducts: request.requestedProducts,
    requestedServices: request.requestedServices,
    diagnostics: readiness.diagnostics,
    traceability: {
      customerId: request.customerId,
      opportunityId: request.opportunityId,
      futureCorridorId: undefined,
      futureScopeVersionId: undefined,
    },
  };
}

export function createOpportunityIntakeViewModel(request: OpportunityRequest): OpportunityIntakeViewModel {
  const readiness = evaluateTranslateReadiness(request);
  const blockers = readiness.blockers.map((gap) => gap.message);
  const summaryCard: OpportunitySummaryCardModel = {
    customerName: request.customerName,
    opportunityName: request.opportunityName,
    customerType: request.customerType,
    accountOwner: request.accountOwner,
    status: readiness.status,
  };
  const attachmentSummary: AttachmentSummaryModel = {
    attachmentCount: request.attachments.length,
    attachmentTypes: Array.from(new Set(request.attachments.map((attachment) => attachment.attachmentType))),
    attachments: request.attachments,
  };
  const readinessCard: OpportunityReadinessCardModel = {
    locationCount: request.locations.length,
    objectiveCount: request.objectives.length,
    attachmentCount: request.attachments.length,
    blockers,
  };
  const translateReadinessCard: TranslateReadinessCardModel = {
    status: readiness.status,
    reason: readiness.status === "READY_FOR_TRANSLATE" ? "Customer, opportunity, location, and objective are present." : blockers.join(" "),
    nextWorkspace: "Translate",
  };

  return {
    workspace: {
      workspaceId: "OPPORTUNITY_INTAKE",
      title: "Opportunity Intake",
      supportedCustomerTypes: [
        "HYPERSCALER",
        "NEOCLOUD",
        "CARRIER",
        "ISP",
        "ENTERPRISE",
        "UTILITY",
        "DATA_CENTER",
        "GOVERNMENT",
        "EDUCATION",
        "OTHER",
      ],
      supportedAttachmentTypes: [
        "KMZ",
        "KML",
        "SHP",
        "GEOJSON",
        "CSV",
        "XLSX",
        "PDF",
        "DOCX",
        "ADDRESS_LIST",
        "COORDINATE_LIST",
        "TEXT_DESCRIPTION",
        "RFP_PACKAGE",
      ] satisfies OpportunityAttachmentType[],
      supportedObjectives: request.objectives.map((objective) => objective.objectiveType),
      noPersistence: true,
      noScopeVersionCreation: true,
      noCorridorCreation: true,
    },
    summaryCard,
    attachmentSummary,
    readinessCard,
    translateReadinessCard,
    locations: request.locations,
    objectives: request.objectives,
  };
}

function diagnostic(
  code: OpportunityDiagnostic["code"],
  severity: OpportunityDiagnostic["severity"],
  message: string,
  request: OpportunityRequest,
  details?: Record<string, unknown>,
): OpportunityDiagnostic {
  console.info(`[${code}]`, {
    customerId: request.customerId,
    opportunityId: request.opportunityId,
    details,
  });
  return {
    code,
    severity,
    customerId: request.customerId,
    opportunityId: request.opportunityId,
    message,
    timestamp: new Date().toISOString(),
    details,
  };
}

function maxGapSeverity(gaps: readonly OpportunityGap[]): OpportunityDiagnostic["severity"] {
  if (gaps.some((gap) => gap.severity === "CRITICAL")) return "CRITICAL";
  if (gaps.some((gap) => gap.severity === "ERROR")) return "ERROR";
  if (gaps.some((gap) => gap.severity === "WARNING")) return "WARNING";
  return "INFO";
}
