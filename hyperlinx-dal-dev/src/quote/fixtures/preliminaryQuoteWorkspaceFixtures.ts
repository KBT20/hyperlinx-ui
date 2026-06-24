import {
  aiCorridorDiversePrismWorkspace,
  blockedPrismWorkspace,
  carrierLongHaulPrismWorkspace,
  googleOklahomaAiExpansionPrismWorkspace,
  googleTexasAiExpansionPrismWorkspace,
  metaCampusExpansionPrismWorkspace,
  metroRingPrismWorkspace,
  middleMileDiversePrismWorkspace,
  oracleGpuExpansionPrismWorkspace,
  readyForQuotePrismWorkspace,
} from "../../prism/fixtures/prismWorkspaceFixtures";
import type { PreliminaryQuoteWorkspaceInput } from "../PreliminaryQuoteWorkspace";
import { buildQuoteWorkspace } from "../PreliminaryQuoteWorkspaceOrchestrator";

const evaluatedAt = "2026-06-24T00:00:00.000Z";

export const preliminaryQuoteWorkspaceFixtureInputs: readonly PreliminaryQuoteWorkspaceInput[] = Object.freeze([
  {
    prismWorkspace: googleTexasAiExpansionPrismWorkspace,
    estimatedNrc: 840000,
    estimatedMrc: 118000,
    estimatedTermMonths: 60,
    evaluatedAt,
  },
  {
    prismWorkspace: googleOklahomaAiExpansionPrismWorkspace,
    estimatedNrc: 620000,
    estimatedMrc: 95000,
    estimatedTermMonths: 60,
    evaluatedAt,
  },
  {
    prismWorkspace: metaCampusExpansionPrismWorkspace,
    estimatedNrc: 410000,
    estimatedMrc: 76000,
    estimatedTermMonths: 48,
    evaluatedAt,
  },
  {
    prismWorkspace: oracleGpuExpansionPrismWorkspace,
    estimatedNrc: 365000,
    estimatedMrc: 132000,
    estimatedTermMonths: 36,
    evaluatedAt,
  },
  {
    prismWorkspace: carrierLongHaulPrismWorkspace,
    recommendedProducts: ["DARK_FIBER", "WAVELENGTH", "LONG_HAUL"],
    estimatedNrc: 1250000,
    estimatedMrc: 88000,
    estimatedTermMonths: 84,
    evaluatedAt,
  },
  {
    prismWorkspace: metroRingPrismWorkspace,
    recommendedProducts: ["METRO_ACCESS", "ETHERNET", "MANAGED_INFRASTRUCTURE"],
    estimatedNrc: 290000,
    estimatedMrc: 43000,
    estimatedTermMonths: 36,
    evaluatedAt,
  },
  {
    prismWorkspace: middleMileDiversePrismWorkspace,
    recommendedProducts: ["MIDDLE_MILE", "DARK_FIBER", "MANAGED_INFRASTRUCTURE"],
    estimatedNrc: 575000,
    estimatedMrc: 52000,
    estimatedTermMonths: 60,
    evaluatedAt,
  },
  {
    prismWorkspace: aiCorridorDiversePrismWorkspace,
    estimatedNrc: 780000,
    estimatedMrc: 124000,
    estimatedTermMonths: 60,
    evaluatedAt,
  },
  {
    prismWorkspace: blockedPrismWorkspace,
    estimatedNrc: 0,
    estimatedMrc: 0,
    estimatedTermMonths: 0,
    evaluatedAt,
  },
  {
    prismWorkspace: readyForQuotePrismWorkspace,
    estimatedNrc: 910000,
    estimatedMrc: 145000,
    estimatedTermMonths: 60,
    quoteGenerated: true,
    evaluatedAt,
  },
]);

export const preliminaryQuoteWorkspaceFixtures = Object.freeze(preliminaryQuoteWorkspaceFixtureInputs.map(buildQuoteWorkspace));

export const googleTexasAiExpansionQuoteWorkspace = preliminaryQuoteWorkspaceFixtures[0];
export const googleOklahomaAiExpansionQuoteWorkspace = preliminaryQuoteWorkspaceFixtures[1];
export const metaCampusExpansionQuoteWorkspace = preliminaryQuoteWorkspaceFixtures[2];
export const oracleGpuExpansionQuoteWorkspace = preliminaryQuoteWorkspaceFixtures[3];
export const carrierLongHaulQuoteWorkspace = preliminaryQuoteWorkspaceFixtures[4];
export const metroRingQuoteWorkspace = preliminaryQuoteWorkspaceFixtures[5];
export const middleMileDiverseQuoteWorkspace = preliminaryQuoteWorkspaceFixtures[6];
export const aiCorridorQuoteWorkspace = preliminaryQuoteWorkspaceFixtures[7];
export const blockedQuoteWorkspace = preliminaryQuoteWorkspaceFixtures[8];
export const readyForCustomerDiscussionQuoteWorkspace = preliminaryQuoteWorkspaceFixtures[9];

export function evaluatePreliminaryQuoteWorkspaceFixtures() {
  return preliminaryQuoteWorkspaceFixtures;
}
