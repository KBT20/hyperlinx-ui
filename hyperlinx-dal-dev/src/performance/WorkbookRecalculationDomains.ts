export type WorkbookExecutionDomain =
  | "ROUTE_CALCULATION"
  | "ESTIMATE_CALCULATION"
  | "WORKBOOK_DISPLAY"
  | "ILA_PLANNING"
  | "PROPOSAL_GENERATION"
  | "ENGINEERING_SUMMARY";

const DOMAIN_DEPENDENCIES: Record<WorkbookExecutionDomain, WorkbookExecutionDomain[]> = {
  ROUTE_CALCULATION: ["ROUTE_CALCULATION", "ESTIMATE_CALCULATION", "WORKBOOK_DISPLAY", "ILA_PLANNING"],
  ESTIMATE_CALCULATION: ["ESTIMATE_CALCULATION", "WORKBOOK_DISPLAY"],
  WORKBOOK_DISPLAY: ["WORKBOOK_DISPLAY"],
  ILA_PLANNING: ["ILA_PLANNING", "WORKBOOK_DISPLAY"],
  PROPOSAL_GENERATION: ["PROPOSAL_GENERATION"],
  ENGINEERING_SUMMARY: ["ENGINEERING_SUMMARY"],
};

export type WorkbookInvalidationInput = {
  changedKey: string;
};

export function workbookExecutionDomainForChange(input: WorkbookInvalidationInput): WorkbookExecutionDomain {
  const key = input.changedKey;
  if (key.startsWith("route.") || key.startsWith("geometry.")) return "ROUTE_CALCULATION";
  if (key.startsWith("ila.")) return "ILA_PLANNING";
  if (key.startsWith("proposal.")) return "PROPOSAL_GENERATION";
  if (key.startsWith("engineering.")) return "ENGINEERING_SUMMARY";
  if (key.startsWith("workbook.display.")) return "WORKBOOK_DISPLAY";
  return "ESTIMATE_CALCULATION";
}

export function affectedWorkbookExecutionDomains(input: WorkbookInvalidationInput) {
  const domain = workbookExecutionDomainForChange(input);
  return DOMAIN_DEPENDENCIES[domain];
}

export function recalculationBoundarySummary(input: WorkbookInvalidationInput) {
  const sourceDomain = workbookExecutionDomainForChange(input);
  const affectedDomains = affectedWorkbookExecutionDomains(input);
  return {
    sourceDomain,
    affectedDomains,
    isolated: !affectedDomains.includes("ROUTE_CALCULATION") || sourceDomain === "ROUTE_CALCULATION",
    noLifecycleMutation: true,
    repositoryTruthUnchanged: true,
  };
}
