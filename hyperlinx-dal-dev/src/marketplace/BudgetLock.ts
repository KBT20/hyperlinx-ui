import type { BidPackage } from "./BidPackage";
import type { BidPackageItemCategory } from "./BidPackageItem";
import type { BudgetCandidate, BudgetDiagnostic } from "./BudgetCandidate";
import { createBudgetDiagnostic } from "./BudgetCandidate";

export interface BudgetLockReadiness {
  ready: boolean;
  checks: Array<{
    label: string;
    status: "PASS" | "FAIL";
    detail: string;
  }>;
}

export interface BudgetLock {
  budgetLockId: string;
  scopeVersionId: string;
  candidateId: string;
  status: "LOCKED";
  lockedTotalCost: number;
  lockedLineItemCount: number;
  lockedAt: string;
  engineeringApprovalPackageId: string;
  assumptions: string[];
  risks: string[];
  diagnostics: BudgetDiagnostic[];
  notes?: string;
}

export interface CreateBudgetLockInput {
  budgetLockId: string;
  candidate: BudgetCandidate;
  bidPackages: readonly BidPackage[];
  engineeringApprovalPackageId: string;
  requiredCategories: readonly BidPackageItemCategory[];
  requiredStandards: readonly string[];
  notes?: string;
}

export function evaluateBudgetLockReadiness(input: Omit<CreateBudgetLockInput, "budgetLockId" | "notes">): BudgetLockReadiness {
  const candidate = input.candidate;
  const allItems = input.bidPackages.flatMap((bidPackage) => bidPackage.items);
  const categories = new Set(allItems.map((item) => item.itemCategory));
  const objectIds = allItems.map((item) => item.objectReference.objectId).filter(Boolean);
  const hasRequiredCategories = input.requiredCategories.every((category) => categories.has(category));

  const checks: BudgetLockReadiness["checks"] = [
    {
      label: "Vendor Responses",
      status: candidate.vendorResponses.length > 0 ? "PASS" : "FAIL",
      detail: `${candidate.vendorResponses.length} vendor responses included.`,
    },
    {
      label: "Budget Candidate",
      status: candidate.status === "CANDIDATE" || candidate.status === "UNDER_REVIEW" ? "PASS" : "FAIL",
      detail: `Candidate status is ${candidate.status}.`,
    },
    {
      label: "Required Quantities",
      status: allItems.every((item) => item.quantity.quantity > 0) ? "PASS" : "FAIL",
      detail: `${allItems.length} package items checked.`,
    },
    {
      label: "Required Categories",
      status: hasRequiredCategories ? "PASS" : "FAIL",
      detail: `${input.requiredCategories.join(", ") || "No required categories supplied."}`,
    },
    {
      label: "Required Objects",
      status: objectIds.length === allItems.length && objectIds.length > 0 ? "PASS" : "FAIL",
      detail: `${objectIds.length} object references found for ${allItems.length} items.`,
    },
    {
      label: "Required Standards",
      status: input.requiredStandards.length > 0 ? "PASS" : "FAIL",
      detail: `${input.requiredStandards.length} standards supplied.`,
    },
    {
      label: "Engineering Approval Package",
      status: input.engineeringApprovalPackageId ? "PASS" : "FAIL",
      detail: input.engineeringApprovalPackageId || "Engineering approval package missing.",
    },
  ];

  return {
    ready: checks.every((check) => check.status === "PASS"),
    checks,
  };
}

export function createBudgetLock(input: CreateBudgetLockInput): BudgetLock {
  const readiness = evaluateBudgetLockReadiness(input);
  if (!readiness.ready) {
    throw new Error("Budget Lock readiness failed. Commercial truth cannot be locked.");
  }

  return {
    budgetLockId: input.budgetLockId,
    scopeVersionId: input.candidate.scopeVersionId,
    candidateId: input.candidate.candidateId,
    status: "LOCKED",
    lockedTotalCost: input.candidate.totalCost,
    lockedLineItemCount: input.candidate.lineItems.length,
    lockedAt: new Date().toISOString(),
    engineeringApprovalPackageId: input.engineeringApprovalPackageId,
    assumptions: input.candidate.assumptions,
    risks: input.candidate.risks,
    diagnostics: [
      createBudgetDiagnostic("BUDGET_LOCK_READY", input.budgetLockId, `${input.budgetLockId} ready.`, {
        checks: readiness.checks,
      }),
      createBudgetDiagnostic("BUDGET_LOCK_CREATED", input.budgetLockId, `${input.budgetLockId} created.`, {
        candidateId: input.candidate.candidateId,
        lockedTotalCost: input.candidate.totalCost,
      }),
    ],
    notes: input.notes,
  };
}
