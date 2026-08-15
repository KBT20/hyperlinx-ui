import { runtimeDiagnosticsLog } from "../performance/RuntimeDiagnostics";

export type ProposalAuthorityRecord = {
  proposalId?: string | null;
  status?: string | null;
  approvalState?: string | null;
};

export type ProposalCustomerReviewState =
  | "NOT_STARTED"
  | "IN_REVIEW"
  | "CUSTOMER_DRAFT"
  | "ACCEPTED"
  | "REJECTED";

export type ProposalEngineeringEligibility = "ELIGIBLE" | "BLOCKED";

export type ProposalAuthorityState = {
  proposalId: string;
  repositoryStatus: string;
  approvalState: string;
  customerReviewState: ProposalCustomerReviewState;
  commercialStatus: string;
  dashboardStatus: string;
  engineeringEligibility: ProposalEngineeringEligibility;
};

export function canonicalProposalRepositoryStatus(status: string | undefined | null) {
  const text = String(status ?? "");
  if (text === "CUSTOMER_APPROVED") return "COMMERCIAL_APPROVED";
  if (text === "CUSTOMER_COMMENTS" || text === "IN_CUSTOMER_REVIEW") return "CUSTOMER_REVIEW";
  if (text === "COMMERCIAL_DRAFT") return "DRAFT";
  if (text === "SUBMITTED_TO_ENGINEERING") return "ENGINEERING_SUBMITTED";
  return text;
}

export function proposalRepositoryReportsCommercialApproved(record: ProposalAuthorityRecord | null | undefined) {
  return canonicalProposalRepositoryStatus(record?.status) === "COMMERCIAL_APPROVED";
}

export function proposalCustomerReviewStateFromRepository(record: ProposalAuthorityRecord | null | undefined): ProposalCustomerReviewState {
  const status = canonicalProposalRepositoryStatus(record?.status);
  if (status === "COMMERCIAL_APPROVED" || record?.approvalState === "APPROVED") return "ACCEPTED";
  if (["WAITING_CUSTOMER_REVIEW", "CUSTOMER_REVIEW"].includes(status)) return "IN_REVIEW";
  if (status === "CUSTOMER_CHANGES_REQUESTED") return "CUSTOMER_DRAFT";
  if (status === "CUSTOMER_REJECTED") return "REJECTED";
  return "NOT_STARTED";
}

export function evaluateProposalAuthorityState(
  record: ProposalAuthorityRecord | null | undefined,
  dashboardStatus = "",
): ProposalAuthorityState {
  const repositoryStatus = canonicalProposalRepositoryStatus(record?.status);
  const customerReviewState = proposalCustomerReviewStateFromRepository(record);
  return {
    proposalId: String(record?.proposalId ?? ""),
    repositoryStatus,
    approvalState: String(record?.approvalState ?? ""),
    customerReviewState,
    commercialStatus: repositoryStatus,
    dashboardStatus: dashboardStatus || repositoryStatus,
    engineeringEligibility: repositoryStatus === "COMMERCIAL_APPROVED" ? "ELIGIBLE" : "BLOCKED",
  };
}

export function logProposalAuthorityStateHydration(
  source: string,
  record: ProposalAuthorityRecord | null | undefined,
  dashboardStatus = "",
) {
  runtimeDiagnosticsLog("ProposalStateAuthority:Kernel", {
    source,
    ...evaluateProposalAuthorityState(record, dashboardStatus),
  });
}
