import { createBudgetCandidate, type BudgetCandidate, type BudgetVendorResponse } from "../BudgetCandidate";
import {
  compareBudgetCandidates,
  compareCandidateToLockedBudget,
  compareEstimatedToCandidate,
  type BudgetComparison,
  type BudgetVariance,
} from "../BudgetComparison";
import { createBudgetLock, evaluateBudgetLockReadiness, type BudgetLock, type BudgetLockReadiness } from "../BudgetLock";
import type { BidPackage } from "../BidPackage";
import { bidPackageFixtures } from "./bidPackageFixtures";

function getPackage(packageId: string): BidPackage {
  const bidPackage = bidPackageFixtures.find((candidatePackage) => candidatePackage.packageId === packageId);
  if (!bidPackage) throw new Error(`Bid package fixture not found: ${packageId}`);
  return bidPackage;
}

function responseForPackage(input: {
  responseId: string;
  vendorId: string;
  bidPackage: BidPackage;
  multiplier: number;
  scheduleDays: number;
  coveragePercent: number;
  capacitySummary: string;
  confidence: BudgetVendorResponse["confidence"];
  assumptions?: string[];
  risks?: string[];
}): BudgetVendorResponse {
  const lineItems = input.bidPackage.items.map((item) => {
    const estimatedTotal = item.quantity.estimatedTotal ?? item.quantity.quantity * (item.quantity.estimatedUnitCost ?? 0);
    const totalPrice = Number((estimatedTotal * input.multiplier).toFixed(2));
    return {
      responseLineItemId: `${input.responseId}:${item.itemId}`,
      bidPackageId: input.bidPackage.packageId,
      bidPackageItemId: item.itemId,
      vendorId: input.vendorId,
      unitPrice: item.quantity.quantity ? Number((totalPrice / item.quantity.quantity).toFixed(2)) : totalPrice,
      quantity: item.quantity.quantity,
      totalPrice,
      notes: "Fixture response line item. Advisory only.",
    };
  });

  return {
    responseId: input.responseId,
    vendorId: input.vendorId,
    bidPackageId: input.bidPackage.packageId,
    status: "SUBMITTED",
    totalCost: lineItems.reduce((total, lineItem) => total + lineItem.totalPrice, 0),
    lineItems,
    scheduleDays: input.scheduleDays,
    coveragePercent: input.coveragePercent,
    capacitySummary: input.capacitySummary,
    assumptions: input.assumptions ?? ["Fixture vendor response. No award or contract created."],
    risks: input.risks ?? ["Pricing is advisory and requires commercial review."],
    confidence: input.confidence,
    receivedAt: "2026-06-23",
  };
}

const fullProject = getPackage("BIDPKG-DKC-FULL");
const mp0Mp50 = getPackage("BIDPKG-MP0-MP50");
const stationGroup = getPackage("BIDPKG-STATIONS-100-150");
const fiberPlacement = getPackage("BIDPKG-FIBER-PLACEMENT");
const splicing = getPackage("BIDPKG-SPLICING");
const conduitFiberHybrid = getPackage("BIDPKG-CONDUIT-FIBER-HYBRID");
const aiCorridor = getPackage("BIDPKG-AI-CORRIDOR");
const metroAggregation = getPackage("BIDPKG-METRO-AGGREGATION");

export const budgetVendorResponses: readonly BudgetVendorResponse[] = Object.freeze([
  responseForPackage({
    responseId: "VR-HYPERSCALER-FBL",
    vendorId: "VENDOR-FIBERLIGHT",
    bidPackage: fullProject,
    multiplier: 0.98,
    scheduleDays: 180,
    coveragePercent: 92,
    capacitySummary: "Long-haul fiber and transport coverage with review-required availability.",
    confidence: "HIGH",
  }),
  responseForPackage({
    responseId: "VR-HYPERSCALER-ZAYO",
    vendorId: "VENDOR-ZAYO",
    bidPackage: fullProject,
    multiplier: 1.04,
    scheduleDays: 165,
    coveragePercent: 86,
    capacitySummary: "Competitive long-haul option with interconnection strengths.",
    confidence: "MEDIUM",
  }),
  responseForPackage({
    responseId: "VR-METRO-FIBERLIGHT",
    vendorId: "VENDOR-FIBERLIGHT",
    bidPackage: metroAggregation,
    multiplier: 0.94,
    scheduleDays: 75,
    coveragePercent: 95,
    capacitySummary: "Metro aggregation coverage using existing network evidence.",
    confidence: "HIGH",
  }),
  responseForPackage({
    responseId: "VR-METRO-CARRIER-HOTEL",
    vendorId: "VENDOR-CARRIER-HOTEL",
    bidPackage: metroAggregation,
    multiplier: 1.1,
    scheduleDays: 60,
    coveragePercent: 80,
    capacitySummary: "Interconnection-heavy response.",
    confidence: "MEDIUM",
  }),
  responseForPackage({
    responseId: "VR-AI-DUOS",
    vendorId: "VENDOR-DUOS-EDGE",
    bidPackage: aiCorridor,
    multiplier: 1.08,
    scheduleDays: 120,
    coveragePercent: 72,
    capacitySummary: "GPU hosting capacity requires facility review.",
    confidence: "LOW",
    risks: ["GPU capacity and power availability require review."],
  }),
  responseForPackage({
    responseId: "VR-AI-LUMEN",
    vendorId: "VENDOR-LUMEN",
    bidPackage: aiCorridor,
    multiplier: 0.97,
    scheduleDays: 110,
    coveragePercent: 76,
    capacitySummary: "Transport coverage with no GPU hosting commitment.",
    confidence: "MEDIUM",
  }),
  responseForPackage({
    responseId: "VR-DARK-FIBER-FBL",
    vendorId: "VENDOR-FIBERLIGHT",
    bidPackage: conduitFiberHybrid,
    multiplier: 0.96,
    scheduleDays: 90,
    coveragePercent: 90,
    capacitySummary: "Dark fiber IRU candidate response.",
    confidence: "HIGH",
  }),
  responseForPackage({
    responseId: "VR-DUCT-HDD",
    vendorId: "VENDOR-REGIONAL-HDD",
    bidPackage: mp0Mp50,
    multiplier: 1.02,
    scheduleDays: 100,
    coveragePercent: 88,
    capacitySummary: "Civil duct construction response.",
    confidence: "HIGH",
  }),
  responseForPackage({
    responseId: "VR-ENTERPRISE-FIBER",
    vendorId: "VENDOR-REGIONAL-FIBER",
    bidPackage: stationGroup,
    multiplier: 0.9,
    scheduleDays: 30,
    coveragePercent: 100,
    capacitySummary: "Enterprise access station group fiber and splicing response.",
    confidence: "HIGH",
  }),
  responseForPackage({
    responseId: "VR-ENTERPRISE-SPLICING",
    vendorId: "VENDOR-REGIONAL-FIBER",
    bidPackage: splicing,
    multiplier: 0.88,
    scheduleDays: 20,
    coveragePercent: 100,
    capacitySummary: "Splicing-only enterprise access response.",
    confidence: "VERIFIED",
  }),
  responseForPackage({
    responseId: "VR-FIBER-PLACEMENT",
    vendorId: "VENDOR-REGIONAL-FIBER",
    bidPackage: fiberPlacement,
    multiplier: 0.92,
    scheduleDays: 45,
    coveragePercent: 100,
    capacitySummary: "Fiber placement package response.",
    confidence: "HIGH",
  }),
]);

export const budgetCandidates: readonly BudgetCandidate[] = Object.freeze([
  createBudgetCandidate({
    candidateId: "BC-HYPERSCALER-LONG-HAUL-FBL",
    scopeVersionId: "SV-DAL-HYPERSCALER-LONG-HAUL",
    bidPackages: [fullProject],
    vendorResponses: [budgetVendorResponses[0]],
    assumptions: ["Hyperscaler long-haul candidate based on full-project package response."],
  }),
  createBudgetCandidate({
    candidateId: "BC-HYPERSCALER-LONG-HAUL-ZAYO",
    scopeVersionId: "SV-DAL-HYPERSCALER-LONG-HAUL",
    bidPackages: [fullProject],
    vendorResponses: [budgetVendorResponses[1]],
    assumptions: ["Competing long-haul carrier response."],
  }),
  createBudgetCandidate({
    candidateId: "BC-METRO-AGGREGATION",
    scopeVersionId: "SV-DAL-METRO-AGGREGATION",
    bidPackages: [metroAggregation],
    vendorResponses: [budgetVendorResponses[2], budgetVendorResponses[3]],
  }),
  createBudgetCandidate({
    candidateId: "BC-AI-CORRIDOR",
    scopeVersionId: "SV-DAL-AI-CORRIDOR",
    bidPackages: [aiCorridor],
    vendorResponses: [budgetVendorResponses[4], budgetVendorResponses[5]],
    risks: ["AI corridor requires GPU capacity, power review, and transport validation."],
  }),
  createBudgetCandidate({
    candidateId: "BC-DARK-FIBER-IRU",
    scopeVersionId: "SV-DAL-DARK-FIBER-IRU",
    bidPackages: [conduitFiberHybrid],
    vendorResponses: [budgetVendorResponses[6]],
  }),
  createBudgetCandidate({
    candidateId: "BC-DUCT-SALE",
    scopeVersionId: "SV-DAL-DUCT-SALE",
    bidPackages: [mp0Mp50],
    vendorResponses: [budgetVendorResponses[7]],
  }),
  createBudgetCandidate({
    candidateId: "BC-ENTERPRISE-ACCESS",
    scopeVersionId: "SV-DAL-ENTERPRISE-ACCESS",
    bidPackages: [stationGroup, splicing, fiberPlacement],
    vendorResponses: [budgetVendorResponses[8], budgetVendorResponses[9], budgetVendorResponses[10]],
  }),
]);

export const budgetComparisons: readonly BudgetComparison[] = Object.freeze([
  compareBudgetCandidates([budgetCandidates[0], budgetCandidates[1]]),
  compareBudgetCandidates([budgetCandidates[2]]),
  compareBudgetCandidates([budgetCandidates[3]]),
  compareBudgetCandidates([budgetCandidates[4], budgetCandidates[5]]),
  compareBudgetCandidates([budgetCandidates[6]]),
]);

export const budgetVariances: readonly BudgetVariance[] = Object.freeze([
  ...budgetCandidates.flatMap((candidate) => compareEstimatedToCandidate(candidate)),
  compareCandidateToLockedBudget(budgetCandidates[0], 7_250_000),
]);

export const budgetLockReadinessExamples: readonly BudgetLockReadiness[] = Object.freeze([
  evaluateBudgetLockReadiness({
    candidate: budgetCandidates[0],
    bidPackages: [fullProject],
    engineeringApprovalPackageId: "ENG-APPROVAL-HYPERSCALER-LONG-HAUL",
    requiredCategories: ["CONDUIT", "FIBER", "SPLICING", "OPTICAL", "CIVIL"],
    requiredStandards: ["ENGINEERING_APPROVED_SCOPE", "STATION_ALLOCATIONS_PRESENT", "OBJECT_REFERENCES_PRESENT"],
  }),
  evaluateBudgetLockReadiness({
    candidate: budgetCandidates[3],
    bidPackages: [aiCorridor],
    engineeringApprovalPackageId: "ENG-APPROVAL-AI-CORRIDOR",
    requiredCategories: ["GPU_CAPACITY", "TRANSPORT", "INTERCONNECTION"],
    requiredStandards: ["POWER_REVIEW_REQUIRED", "GPU_CAPACITY_REVIEW_REQUIRED"],
  }),
]);

export const budgetLocks: readonly BudgetLock[] = Object.freeze([
  createBudgetLock({
    budgetLockId: "BL-HYPERSCALER-LONG-HAUL",
    candidate: budgetCandidates[0],
    bidPackages: [fullProject],
    engineeringApprovalPackageId: "ENG-APPROVAL-HYPERSCALER-LONG-HAUL",
    requiredCategories: ["CONDUIT", "FIBER", "SPLICING", "OPTICAL", "CIVIL"],
    requiredStandards: ["ENGINEERING_APPROVED_SCOPE", "STATION_ALLOCATIONS_PRESENT", "OBJECT_REFERENCES_PRESENT"],
    notes: "Fixture lock. Commercial truth example only; no contract or execution authority.",
  }),
  createBudgetLock({
    budgetLockId: "BL-METRO-AGGREGATION",
    candidate: budgetCandidates[2],
    bidPackages: [metroAggregation],
    engineeringApprovalPackageId: "ENG-APPROVAL-METRO-AGGREGATION",
    requiredCategories: ["FIBER", "SPLICING", "TRANSPORT", "INTERCONNECTION"],
    requiredStandards: ["ENGINEERING_APPROVED_SCOPE", "MARKETPLACE_PRICE_REVIEW"],
  }),
  createBudgetLock({
    budgetLockId: "BL-DARK-FIBER-IRU",
    candidate: budgetCandidates[4],
    bidPackages: [conduitFiberHybrid],
    engineeringApprovalPackageId: "ENG-APPROVAL-DARK-FIBER-IRU",
    requiredCategories: ["CONDUIT", "FIBER"],
    requiredStandards: ["ENGINEERING_APPROVED_SCOPE", "IRU_COMMERCIAL_REVIEW_REQUIRED"],
  }),
]);

export function evaluateBudgetLockFixtures() {
  return {
    candidateCount: budgetCandidates.length,
    responseCount: budgetVendorResponses.length,
    comparisonCount: budgetComparisons.length,
    varianceCount: budgetVariances.length,
    lockCount: budgetLocks.length,
    lockReadiness: budgetLockReadinessExamples.map((readiness) => ({
      ready: readiness.ready,
      failedChecks: readiness.checks.filter((check) => check.status === "FAIL").map((check) => check.label),
    })),
  };
}

