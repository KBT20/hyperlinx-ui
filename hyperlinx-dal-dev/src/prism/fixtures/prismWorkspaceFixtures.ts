import {
  carrierLongHaulWorkspace,
  googleOklahomaAiExpansionWorkspace,
  googleTexasAiExpansionWorkspace,
  metaCampusExpansionWorkspace,
  metroRingWorkspace,
  middleMileDiverseWorkspace,
  oracleGpuExpansionWorkspace,
  quoteReadyWorkspace,
  blockedMissingLocationWorkspace,
} from "../../opportunity/fixtures/opportunityDetailWorkspaceFixtures";
import {
  carrierLongHaulReviewWorkspace,
  googleDiversityRequestWorkspace,
  googleTexasAiExpansionReviewWorkspace,
  metaCampusExpansionReviewWorkspace,
  oracleGpuExpansionReviewWorkspace,
  readyForPrismReviewWorkspace,
} from "../../review/fixtures/scopeReviewWorkspaceFixtures";
import { marketplaceAssetFixtures } from "../../marketplace/fixtures/marketplaceAssetFixtures";
import type { PrismWorkspaceInput, PrismRouteAlternative } from "../PrismWorkspace";
import { buildPrismWorkspace } from "../PrismWorkspaceOrchestrator";

const evaluatedAt = "2026-06-24T00:00:00.000Z";

const texasAiRouteAlternatives: readonly PrismRouteAlternative[] = Object.freeze([
  {
    alternativeId: "PRISM-ALT-GOOGLE-TX-PRIMARY",
    label: "Texas AI primary corridor",
    routeType: "PRIMARY",
    summary: "Preserve the synthesized baseline as primary advisory route evidence.",
    evidenceIds: ["EV-GOOGLE-TX-AI-PRIMARY"],
    advisoryOnly: true,
  },
  {
    alternativeId: "PRISM-ALT-GOOGLE-TX-DIVERSE",
    label: "Texas AI diverse corridor",
    routeType: "DIVERSE",
    summary: "Evaluate shared ROW and crossing exposure before preliminary quote reliance.",
    evidenceIds: ["EV-GOOGLE-TX-AI-DIVERSE"],
    advisoryOnly: true,
  },
]);

export const prismWorkspaceFixtureInputs: readonly PrismWorkspaceInput[] = Object.freeze([
  {
    opportunityWorkspace: googleTexasAiExpansionWorkspace,
    scopeReviewWorkspace: googleTexasAiExpansionReviewWorkspace,
    marketplaceAssets: marketplaceAssetFixtures,
    candidateSites: ["Texas AI Campus", "Dallas Interconnect"],
    routeAlternatives: texasAiRouteAlternatives,
    evaluatedAt,
  },
  {
    opportunityWorkspace: googleOklahomaAiExpansionWorkspace,
    scopeReviewWorkspace: googleDiversityRequestWorkspace,
    marketplaceAssets: marketplaceAssetFixtures.filter((asset) => asset.serviceAreas.some((area) => area.states?.includes("TX"))),
    candidateSites: ["Oklahoma AI Campus", "Tulsa Interconnect"],
    evaluatedAt,
  },
  {
    opportunityWorkspace: metaCampusExpansionWorkspace,
    scopeReviewWorkspace: metaCampusExpansionReviewWorkspace,
    marketplaceAssets: marketplaceAssetFixtures.filter((asset) => asset.assetType === "DATA_CENTER" || asset.assetType === "CARRIER_HOTEL"),
    candidateSites: ["Meta DFW", "Meta Atlanta"],
    evaluatedAt,
  },
  {
    opportunityWorkspace: oracleGpuExpansionWorkspace,
    scopeReviewWorkspace: oracleGpuExpansionReviewWorkspace,
    marketplaceAssets: marketplaceAssetFixtures.filter((asset) => asset.assetType === "GPU_FACILITY" || asset.assetType === "POWER_FEED"),
    candidateSites: ["Oracle GPU Expansion Site"],
    evaluatedAt,
  },
  {
    opportunityWorkspace: carrierLongHaulWorkspace,
    scopeReviewWorkspace: carrierLongHaulReviewWorkspace,
    marketplaceAssets: marketplaceAssetFixtures.filter((asset) => asset.assetType === "TRANSPORT_CAPABILITY" || asset.assetType === "CARRIER_HOTEL"),
    candidateSites: ["Carrier POP A", "Carrier POP Z"],
    evaluatedAt,
  },
  {
    opportunityWorkspace: metroRingWorkspace,
    marketplaceAssets: marketplaceAssetFixtures.filter((asset) => asset.serviceAreas.some((area) => area.markets?.length)),
    candidateSites: ["Metro aggregation node", "Metro interconnect"],
    evaluatedAt,
  },
  {
    opportunityWorkspace: middleMileDiverseWorkspace,
    marketplaceAssets: marketplaceAssetFixtures.filter((asset) => asset.assetType === "CONSTRUCTION_CAPABILITY" || asset.assetType === "LABOR_CAPABILITY"),
    candidateSites: ["Middle mile origin", "Middle mile destination"],
    evaluatedAt,
  },
  {
    opportunityWorkspace: googleTexasAiExpansionWorkspace,
    scopeReviewWorkspace: readyForPrismReviewWorkspace,
    marketplaceAssets: marketplaceAssetFixtures,
    candidateSites: ["Texas AI Campus", "Dallas Interconnect"],
    routeAlternatives: texasAiRouteAlternatives,
    evaluatedAt,
  },
  {
    opportunityWorkspace: blockedMissingLocationWorkspace,
    marketplaceAssets: [],
    candidateSites: [],
    evaluatedAt,
  },
  {
    opportunityWorkspace: quoteReadyWorkspace,
    scopeReviewWorkspace: readyForPrismReviewWorkspace,
    marketplaceAssets: marketplaceAssetFixtures,
    candidateSites: ["Texas AI Campus", "Dallas Interconnect"],
    routeAlternatives: texasAiRouteAlternatives,
    evaluatedAt,
  },
]);

export const prismWorkspaceFixtures = Object.freeze(prismWorkspaceFixtureInputs.map(buildPrismWorkspace));

export const googleTexasAiExpansionPrismWorkspace = prismWorkspaceFixtures[0];
export const googleOklahomaAiExpansionPrismWorkspace = prismWorkspaceFixtures[1];
export const metaCampusExpansionPrismWorkspace = prismWorkspaceFixtures[2];
export const oracleGpuExpansionPrismWorkspace = prismWorkspaceFixtures[3];
export const carrierLongHaulPrismWorkspace = prismWorkspaceFixtures[4];
export const metroRingPrismWorkspace = prismWorkspaceFixtures[5];
export const middleMileDiversePrismWorkspace = prismWorkspaceFixtures[6];
export const aiCorridorDiversePrismWorkspace = prismWorkspaceFixtures[7];
export const blockedPrismWorkspace = prismWorkspaceFixtures[8];
export const readyForQuotePrismWorkspace = prismWorkspaceFixtures[9];

export function evaluatePrismWorkspaceFixtures() {
  return prismWorkspaceFixtures;
}
