import type { BidPackage, BidPackageStatus } from "./BidPackage";
import { estimateBidPackageTotal } from "./BidPackage";
import type { BidPackageItem } from "./BidPackageItem";
import type {
  BidPackageObjectReference,
  CategoryAllocation,
  SegmentAllocation,
  StationAllocation,
} from "./BidPackageStationAllocation";
import type { VendorPriceBook } from "./VendorPriceBookRegistry";

export type BudgetStatus =
  | "DRAFT"
  | "UNDER_REVIEW"
  | "CANDIDATE"
  | "LOCKED"
  | "SUPERSEDED";

export type BudgetConfidence =
  | "VERY_LOW"
  | "LOW"
  | "MEDIUM"
  | "HIGH"
  | "VERIFIED";

export type BudgetDiagnosticCode =
  | "BUDGET_CANDIDATE_CREATED"
  | "BUDGET_COMPARISON_COMPLETE"
  | "BUDGET_VARIANCE_CALCULATED"
  | "BUDGET_LOCK_READY"
  | "BUDGET_LOCK_CREATED";

export interface BudgetDiagnostic {
  code: BudgetDiagnosticCode;
  entityId: string;
  severity: "INFO" | "WARNING";
  message: string;
  details?: Record<string, unknown>;
}

export interface BudgetVendorResponseLineItem {
  responseLineItemId: string;
  bidPackageId: string;
  bidPackageItemId: string;
  vendorId: string;
  unitPrice: number;
  quantity: number;
  totalPrice: number;
  notes?: string;
}

export interface BudgetVendorResponse {
  responseId: string;
  vendorId: string;
  bidPackageId: string;
  status: "DRAFT" | "SUBMITTED" | "CLARIFICATION_REQUIRED" | "WITHDRAWN";
  totalCost: number;
  lineItems: BudgetVendorResponseLineItem[];
  scheduleDays?: number;
  coveragePercent?: number;
  capacitySummary?: string;
  assumptions: string[];
  risks: string[];
  confidence: BudgetConfidence;
  receivedAt: string;
}

export interface BudgetLineItem {
  lineItemId: string;
  bidPackageId: string;
  bidPackageItemId: string;
  vendorResponseId?: string;
  vendorId?: string;
  objectReference: BidPackageObjectReference;
  stationAllocations: StationAllocation[];
  segmentAllocations: SegmentAllocation[];
  categoryAllocations: CategoryAllocation[];
  estimatedCost: number;
  candidateCost: number;
  varianceAmount: number;
  notes?: string;
}

export interface BudgetCandidate {
  candidateId: string;
  scopeVersionId: string;
  status: BudgetStatus;
  vendorResponses: BudgetVendorResponse[];
  bidPackageIds: string[];
  totalCost: number;
  lineItems: BudgetLineItem[];
  confidence: BudgetConfidence;
  risks: string[];
  assumptions: string[];
  createdAt: string;
  diagnostics: BudgetDiagnostic[];
}

export interface CreateBudgetCandidateInput {
  candidateId: string;
  scopeVersionId: string;
  bidPackages: readonly BidPackage[];
  vendorResponses: readonly BudgetVendorResponse[];
  priceBooks?: readonly VendorPriceBook[];
  confidence?: BudgetConfidence;
  risks?: string[];
  assumptions?: string[];
  createdAt?: string;
}

export function createBudgetDiagnostic(
  code: BudgetDiagnosticCode,
  entityId: string,
  message: string,
  details?: Record<string, unknown>,
): BudgetDiagnostic {
  return {
    code,
    entityId,
    severity: "INFO",
    message,
    details,
  };
}

export function createBudgetCandidate(input: CreateBudgetCandidateInput): BudgetCandidate {
  const lineItems = buildBudgetLineItems(input.bidPackages, input.vendorResponses);
  const responseTotal = input.vendorResponses.reduce((total, response) => total + response.totalCost, 0);
  const estimatedTotal = input.bidPackages.reduce((total, bidPackage) => total + estimateBidPackageTotal(bidPackage), 0);
  const totalCost = responseTotal || estimatedTotal;

  return {
    candidateId: input.candidateId,
    scopeVersionId: input.scopeVersionId,
    status: "CANDIDATE",
    vendorResponses: [...input.vendorResponses],
    bidPackageIds: input.bidPackages.map((bidPackage) => bidPackage.packageId),
    totalCost,
    lineItems,
    confidence: input.confidence ?? deriveCandidateConfidence(input.vendorResponses),
    risks: input.risks ?? input.vendorResponses.flatMap((response) => response.risks),
    assumptions: input.assumptions ?? input.vendorResponses.flatMap((response) => response.assumptions),
    createdAt: input.createdAt ?? new Date().toISOString(),
    diagnostics: [
      createBudgetDiagnostic("BUDGET_CANDIDATE_CREATED", input.candidateId, `${input.candidateId} created.`, {
        scopeVersionId: input.scopeVersionId,
        bidPackageCount: input.bidPackages.length,
        vendorResponseCount: input.vendorResponses.length,
        totalCost,
      }),
    ],
  };
}

function buildBudgetLineItems(
  bidPackages: readonly BidPackage[],
  vendorResponses: readonly BudgetVendorResponse[],
): BudgetLineItem[] {
  return bidPackages.flatMap((bidPackage) =>
    bidPackage.items.map((item) => {
      const responseLineItem = findResponseLineItem(item, bidPackage.packageId, vendorResponses);
      const estimatedCost = item.quantity.estimatedTotal ?? 0;
      const candidateCost = responseLineItem?.totalPrice ?? estimatedCost;

      return {
        lineItemId: `BLI-${bidPackage.packageId}-${item.itemId}`,
        bidPackageId: bidPackage.packageId,
        bidPackageItemId: item.itemId,
        vendorResponseId: responseLineItem ? responseLineItem.responseLineItemId.split(":")[0] : undefined,
        vendorId: responseLineItem?.vendorId,
        objectReference: item.objectReference,
        stationAllocations: item.stationAllocations,
        segmentAllocations: item.segmentAllocations,
        categoryAllocations: item.categoryAllocations,
        estimatedCost,
        candidateCost,
        varianceAmount: candidateCost - estimatedCost,
      };
    }),
  );
}

function findResponseLineItem(
  item: BidPackageItem,
  bidPackageId: string,
  vendorResponses: readonly BudgetVendorResponse[],
): BudgetVendorResponseLineItem | undefined {
  return vendorResponses
    .flatMap((response) => response.lineItems)
    .find((lineItem) => lineItem.bidPackageId === bidPackageId && lineItem.bidPackageItemId === item.itemId);
}

function deriveCandidateConfidence(vendorResponses: readonly BudgetVendorResponse[]): BudgetConfidence {
  if (!vendorResponses.length) return "VERY_LOW";
  if (vendorResponses.every((response) => response.confidence === "VERIFIED")) return "VERIFIED";
  if (vendorResponses.some((response) => response.confidence === "HIGH" || response.confidence === "VERIFIED")) return "HIGH";
  if (vendorResponses.some((response) => response.confidence === "MEDIUM")) return "MEDIUM";
  return "LOW";
}

export function summarizeBidPackageReadiness(bidPackage: BidPackage): {
  packageId: string;
  status: BidPackageStatus;
  itemCount: number;
  measurable: boolean;
} {
  return {
    packageId: bidPackage.packageId,
    status: bidPackage.status,
    itemCount: bidPackage.items.length,
    measurable: bidPackage.items.every((item) => item.quantity.quantity > 0 && Boolean(item.objectReference.objectId)),
  };
}

