import type { TeralinxRouteIntake, TeralinxRouteIntakeInput } from "./TeralinxRouteIntake";
import type { TeralinxRouteBlocker, TeralinxRouteDiagnostic, TeralinxRouteRequest, TeralinxSite } from "./TeralinxRouteRequest";

function now(value?: string) {
  return value ?? new Date().toISOString();
}

function diagnostic(
  code: TeralinxRouteDiagnostic["code"],
  severity: TeralinxRouteDiagnostic["severity"],
  message: string,
  input: TeralinxRouteIntakeInput,
  details?: Record<string, unknown>,
): TeralinxRouteDiagnostic {
  const entry: TeralinxRouteDiagnostic = {
    diagnosticId: `${code}-${input.routeRequestId}`,
    code,
    severity,
    message,
    timestamp: now(input.evaluatedAt),
    details,
  };
  console.info(`[${code}]`, entry);
  return entry;
}

function siteKey(site: TeralinxSite) {
  return [
    site.facilityName.trim().toLowerCase(),
    site.address?.trim().toLowerCase() ?? "",
    site.latitude?.toFixed(6) ?? "",
    site.longitude?.toFixed(6) ?? "",
  ].join("|");
}

function siteHasLocation(site: TeralinxSite) {
  const hasAddress = Boolean(site.address?.trim());
  const hasCoords = Number.isFinite(site.latitude) && Number.isFinite(site.longitude);
  return hasAddress || hasCoords;
}

export function identifyTeralinxRouteBlockers(input: TeralinxRouteIntakeInput): TeralinxRouteBlocker[] {
  const blockers: TeralinxRouteBlocker[] = [];
  const add = (blocker: TeralinxRouteBlocker) => blockers.push(blocker);

  if (!input.customer.company.trim() || !input.customer.primaryContact.trim()) {
    add({
      blockerId: `${input.routeRequestId}-MISSING-CUSTOMER`,
      blockerType: "MISSING_CUSTOMER",
      message: "Customer company and primary contact are required.",
      requiredAction: "Complete customer fields.",
    });
  }

  if (!input.opportunity.opportunityName.trim() || !input.opportunity.market.trim()) {
    add({
      blockerId: `${input.routeRequestId}-MISSING-OPPORTUNITY`,
      blockerType: "MISSING_OPPORTUNITY",
      message: "Opportunity name and market are required.",
      requiredAction: "Complete opportunity fields.",
    });
  }

  const aSite = input.siteList.find((site) => site.role === "A_SITE");
  const zSite = input.siteList.find((site) => site.role === "Z_SITE");
  if (!aSite || !zSite) {
    add({
      blockerId: `${input.routeRequestId}-MISSING-SITE`,
      blockerType: "MISSING_SITE",
      message: "A Site and Z Site are required.",
      requiredAction: "Add both route endpoints.",
    });
  }

  input.siteList
    .filter((site) => !siteHasLocation(site))
    .forEach((site) => {
      add({
        blockerId: `${input.routeRequestId}-INVALID-ADDRESS-${site.siteId}`,
        blockerType: "INVALID_ADDRESS",
        message: `${site.facilityName || site.siteId} requires an address or latitude/longitude.`,
        requiredAction: "Provide address or coordinates.",
      });
    });

  const seen = new Set<string>();
  input.siteList.forEach((site) => {
    const key = siteKey(site);
    if (seen.has(key)) {
      add({
        blockerId: `${input.routeRequestId}-DUPLICATE-SITE-${site.siteId}`,
        blockerType: "DUPLICATE_SITE",
        message: `${site.facilityName || site.siteId} duplicates another site entry.`,
        requiredAction: "Remove duplicate site or update location.",
      });
    }
    seen.add(key);
  });

  if (!input.intent.networkType || !input.intent.protection || !input.intent.primaryProduct) {
    add({
      blockerId: `${input.routeRequestId}-NO-NETWORK-INTENT`,
      blockerType: "NO_NETWORK_INTENT",
      message: "Network type, protection, and primary product are required.",
      requiredAction: "Select network intent.",
    });
  }

  return blockers;
}

export function evaluateTeralinxRouteReadiness(input: TeralinxRouteIntakeInput) {
  return identifyTeralinxRouteBlockers(input).length ? "BLOCKED" : "READY_FOR_DESIGN";
}

function estimateMilesPlaceholder(input: TeralinxRouteIntakeInput) {
  const endpointFactor = Math.max(1, input.siteList.length - 1);
  if (input.intent.networkType === "METRO") return endpointFactor * 8;
  if (input.intent.networkType === "CAMPUS") return endpointFactor * 1.5;
  if (input.intent.networkType === "MIDDLE_MILE") return endpointFactor * 45;
  if (input.intent.networkType === "LONG_HAUL") return endpointFactor * 180;
  return endpointFactor * 10;
}

export function buildTeralinxRouteRequest(input: TeralinxRouteIntakeInput): TeralinxRouteRequest {
  const blockers = identifyTeralinxRouteBlockers(input);
  const readiness = blockers.length ? "BLOCKED" : "READY_FOR_DESIGN";
  const diagnostics: TeralinxRouteDiagnostic[] = [
    diagnostic("ROUTE_INTAKE_CREATED", "INFO", "Teralinx route intake created.", input),
    diagnostic("CUSTOMER_VALIDATED", input.customer.company && input.customer.primaryContact ? "INFO" : "ERROR", "Customer fields validated.", input),
    diagnostic("OPPORTUNITY_VALIDATED", input.opportunity.opportunityName && input.opportunity.market ? "INFO" : "ERROR", "Opportunity fields validated.", input),
    diagnostic("SITE_VALIDATED", blockers.some((blocker) => blocker.blockerType === "MISSING_SITE" || blocker.blockerType === "INVALID_ADDRESS" || blocker.blockerType === "DUPLICATE_SITE") ? "ERROR" : "INFO", "Site list validated.", input, {
      siteCount: input.siteList.length,
    }),
    diagnostic("INTENT_VALIDATED", input.intent.networkType && input.intent.protection && input.intent.primaryProduct ? "INFO" : "ERROR", "Network intent validated.", input, {
      intent: input.intent,
    }),
    diagnostic(readiness === "READY_FOR_DESIGN" ? "ROUTE_READY_FOR_DESIGN" : "ROUTE_INTAKE_BLOCKED", readiness === "READY_FOR_DESIGN" ? "INFO" : "ERROR", readiness === "READY_FOR_DESIGN" ? "Route request is ready for Design handoff." : "Route request is blocked.", input, {
      blockerCount: blockers.length,
    }),
  ];

  return {
    routeRequestId: input.routeRequestId,
    customer: input.customer,
    opportunity: input.opportunity,
    siteList: input.siteList,
    intent: input.intent,
    protection: input.intent.protection,
    product: input.intent.primaryProduct,
    diagnostics,
    blockers,
    readiness,
    estimatedMilesPlaceholder: estimateMilesPlaceholder(input),
    fixtureOnly: true,
    noPersistence: true,
    noRouting: true,
    noGeometry: true,
    noScopeVersionCreation: true,
    noInventoryMutation: true,
  };
}

export function buildTeralinxRouteIntake(input: TeralinxRouteIntakeInput): TeralinxRouteIntake {
  const routeRequest = buildTeralinxRouteRequest(input);
  return {
    intakeId: `INTAKE-${input.routeRequestId}`,
    title: `Teralinx Route: ${input.opportunity.opportunityName || input.customer.company || input.routeRequestId}`,
    input,
    routeRequest,
    readiness: routeRequest.readiness,
    blockers: routeRequest.blockers,
    diagnostics: routeRequest.diagnostics,
    noPersistence: true,
    noRouting: true,
    noGeometry: true,
    noScopeVersionCreation: true,
  };
}
