import type { DesignLaunchRequest } from "./DesignLaunchRequest";
import type { DesignLaunchResult } from "./DesignLaunchResult";
import type {
  DesignLaunchBlocker,
  DesignLaunchDiagnostic,
  DesignLaunchDiagnosticCode,
  DesignLaunchEstimatedMetrics,
  DesignLaunchSession,
} from "./DesignLaunchSession";
import { resolveDesignDoctrine } from "../designDoctrine/DesignDoctrineEngine";

const supportedNetworkTypes = new Set(["METRO", "MIDDLE_MILE", "LONG_HAUL", "CAMPUS"]);
const supportedProtections = new Set(["LINEAR", "DIVERSE", "RING", "NONE", "PATH_PROTECTED", "RING_PROTECTED", "MESH_PROTECTED"]);
const supportedProducts = new Set(["DUCT", "FIBER", "DUCT_PLUS_FIBER"]);

function diagnostic(
  code: DesignLaunchDiagnosticCode,
  severity: DesignLaunchDiagnostic["severity"],
  message: string,
  request: DesignLaunchRequest,
  details?: Record<string, unknown>,
): DesignLaunchDiagnostic {
  const entry: DesignLaunchDiagnostic = {
    diagnosticId: `${code}-${request.launchRequestId}`,
    code,
    severity,
    message,
    timestamp: request.requestedAt,
    details,
  };
  console.info(`[${code}]`, entry);
  return entry;
}

function requiredCustomerId(request: DesignLaunchRequest) {
  return request.customer.existingCustomerId || `CUSTOMER-${request.customer.company.trim().toUpperCase().replaceAll(/[^A-Z0-9]+/g, "-")}`;
}

function requiredOpportunityId(request: DesignLaunchRequest) {
  return `OPP-${request.opportunity.opportunityName.trim().toUpperCase().replaceAll(/[^A-Z0-9]+/g, "-") || request.launchRequestId}`;
}

export function identifyDesignLaunchBlockers(request: DesignLaunchRequest): DesignLaunchBlocker[] {
  const blockers: DesignLaunchBlocker[] = [];
  const customerExists = Boolean(request.customer.company.trim() && request.customer.primaryContact.trim());
  const opportunityExists = Boolean(request.opportunity.opportunityName.trim() && request.opportunity.market.trim());
  const minimumSites = request.siteList.length >= 2;
  const networkType = request.networkIntent.networkType;
  const protection = request.protection ?? request.networkIntent.protection;
  const product = request.primaryProduct ?? request.networkIntent.primaryProduct;

  if (!customerExists) {
    blockers.push({
      blockerId: `${request.launchRequestId}-MISSING-CUSTOMER`,
      blockerType: "MISSING_CUSTOMER",
      message: "Customer company and primary contact are required before launching Design.",
      requiredAction: "Complete customer intake.",
    });
  }

  if (!opportunityExists) {
    blockers.push({
      blockerId: `${request.launchRequestId}-MISSING-OPPORTUNITY`,
      blockerType: "MISSING_OPPORTUNITY",
      message: "Opportunity name and market are required before launching Design.",
      requiredAction: "Complete opportunity intake.",
    });
  }

  if (!minimumSites) {
    blockers.push({
      blockerId: `${request.launchRequestId}-MISSING-SITES`,
      blockerType: "MISSING_SITES",
      message: "At least two sites are required for A/Z design handoff.",
      requiredAction: "Add A Site and Z Site.",
    });
  }

  if (!networkType || !supportedNetworkTypes.has(networkType)) {
    blockers.push({
      blockerId: `${request.launchRequestId}-UNSUPPORTED-NETWORK-TYPE`,
      blockerType: "UNSUPPORTED_NETWORK_TYPE",
      message: "Network type must be Metro, Middle Mile, Long Haul, or Campus.",
      requiredAction: "Select a supported network type.",
    });
  }

  if (!protection || !supportedProtections.has(protection)) {
    blockers.push({
      blockerId: `${request.launchRequestId}-INVALID-PROTECTION`,
      blockerType: "INVALID_PROTECTION",
      message: "Protection must resolve to None, Path Protected, Ring Protected, or Mesh Protected.",
      requiredAction: "Select a supported protection schema.",
    });
  }

  if (!product || !supportedProducts.has(product)) {
    blockers.push({
      blockerId: `${request.launchRequestId}-MISSING-PRODUCT`,
      blockerType: "MISSING_PRODUCT",
      message: "Primary product must be Duct, Fiber, or Duct + Fiber.",
      requiredAction: "Select a primary product.",
    });
  }

  return blockers;
}

export function evaluateDesignLaunchStatus(request: DesignLaunchRequest) {
  return identifyDesignLaunchBlockers(request).length ? "BLOCKED" : "READY";
}

export function estimateDesignLaunchMetrics(request: DesignLaunchRequest): DesignLaunchEstimatedMetrics {
  const sitePairCount = Math.max(1, request.siteList.length - 1);
  const networkType = request.networkIntent.networkType;
  const estimatedMileage =
    networkType === "LONG_HAUL" ? sitePairCount * 180 : networkType === "MIDDLE_MILE" ? sitePairCount * 45 : networkType === "CAMPUS" ? sitePairCount * 1.5 : sitePairCount * 8;

  return {
    estimatedMileage,
    estimatedNodeCount: Math.max(2, sitePairCount * 3),
    estimatedStations: Math.max(2, Math.round(estimatedMileage * 5)),
    estimatedSegments: Math.max(1, sitePairCount * 4),
    estimatedObjects: Math.max(4, sitePairCount * 12),
    placeholderOnly: true,
  };
}

export function buildDesignLaunchRequestFromRouteRequest(request: {
  routeRequestId: string;
  customer: DesignLaunchRequest["customer"];
  opportunity: DesignLaunchRequest["opportunity"];
  siteList: DesignLaunchRequest["siteList"];
  intent: DesignLaunchRequest["networkIntent"];
  protection?: DesignLaunchRequest["protection"];
  product?: DesignLaunchRequest["primaryProduct"];
}): DesignLaunchRequest {
  return {
    launchRequestId: `DESIGN-${request.routeRequestId}`,
    customer: request.customer,
    opportunity: request.opportunity,
    siteList: request.siteList,
    networkIntent: request.intent,
    protection: request.protection ?? request.intent.protection,
    primaryProduct: request.product ?? request.intent.primaryProduct,
    requestedAt: new Date().toISOString(),
  };
}

export function createDesignLaunchSession(request: DesignLaunchRequest): DesignLaunchResult {
  const blockers = identifyDesignLaunchBlockers(request);
  const status = blockers.length ? "BLOCKED" : "READY";
  const diagnostics = [
    diagnostic("DESIGN_LAUNCH_REQUESTED", "INFO", "Design launch requested from Teralinx Route intake.", request),
    diagnostic("DESIGN_CUSTOMER_VALIDATED", request.customer.company && request.customer.primaryContact ? "INFO" : "ERROR", "Customer launch fields validated.", request),
    diagnostic("DESIGN_OPPORTUNITY_VALIDATED", request.opportunity.opportunityName && request.opportunity.market ? "INFO" : "ERROR", "Opportunity launch fields validated.", request),
    diagnostic("DESIGN_SITES_VALIDATED", request.siteList.length >= 2 ? "INFO" : "ERROR", "A/Z site list validated for Design handoff.", request, {
      siteCount: request.siteList.length,
    }),
    diagnostic(
      "DESIGN_INTENT_VALIDATED",
      request.networkIntent.networkType && request.protection && request.primaryProduct ? "INFO" : "ERROR",
      "Network intent, protection, and primary product validated.",
      request,
      {
        networkType: request.networkIntent.networkType,
        protection: request.protection,
        primaryProduct: request.primaryProduct,
      },
    ),
    diagnostic(status === "READY" ? "DESIGN_LAUNCH_READY" : "DESIGN_LAUNCH_BLOCKED", status === "READY" ? "INFO" : "ERROR", status === "READY" ? "Design launch session is ready." : "Design launch session is blocked.", request, {
      blockerCount: blockers.length,
    }),
  ];

  if (status === "BLOCKED") {
    return {
      status,
      blockers,
      diagnostics,
      nextWorkspace: "DESIGN",
    };
  }

  const estimatedMetrics = estimateDesignLaunchMetrics(request);
  const appliedDoctrine = resolveDesignDoctrine({
    networkClass: request.networkIntent.networkType,
    protection: request.protection ?? request.networkIntent.protection,
    siteList: request.siteList,
    opportunityMarket: request.opportunity.market || request.opportunity.opportunityName,
  });
  const session: DesignLaunchSession = {
    launchId: `DESIGN-LAUNCH-${request.launchRequestId}`,
    status,
    customerId: requiredCustomerId(request),
    opportunityId: requiredOpportunityId(request),
    customerName: request.customer.company,
    opportunityName: request.opportunity.opportunityName,
    siteList: request.siteList,
    networkIntent: request.networkIntent,
    protection: request.protection,
    designDoctrineId: appliedDoctrine.doctrine.designDoctrineId,
    networkClass: appliedDoctrine.networkClass,
    topology: appliedDoctrine.topology,
    protectionClass: appliedDoctrine.protection,
    primaryProduct: request.primaryProduct,
    estimatedMileage: estimatedMetrics.estimatedMileage,
    estimatedNodeCount: estimatedMetrics.estimatedNodeCount,
    estimatedStations: estimatedMetrics.estimatedStations,
    estimatedSegments: estimatedMetrics.estimatedSegments,
    estimatedObjects: estimatedMetrics.estimatedObjects,
    estimatedMetrics,
    diagnostics,
    blockers,
    nextWorkspace: "DESIGN",
    readOnly: true,
    noPersistence: true,
    noRouting: true,
    noGeometry: true,
    noScopeVersionCreation: true,
    noInventoryMutation: true,
    createdAt: request.requestedAt,
  };

  return {
    status,
    session,
    blockers,
    diagnostics,
    nextWorkspace: "DESIGN",
  };
}
