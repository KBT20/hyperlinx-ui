import { normalizeNetworkClass } from "../designDoctrine/NetworkClass";
import { formatProtectionClass } from "../designDoctrine/ProtectionClass";
import type { ProposedInventory } from "./ProposedInventory";

export interface ProposedInventorySummary {
  proposalId: string;
  customerId: string;
  opportunityId: string;
  networkSummary: string;
  estimatedRoute: string;
  estimatedMileage: number;
  estimatedFootage: number;
  estimatedSegments: number;
  estimatedStations: number;
  estimatedCrossings: number;
  estimatedVaults: number;
  primaryProduct: ProposedInventory["primaryProduct"];
  constructionSummary: string;
}

export function summarizeProposedInventory(inventory: ProposedInventory): ProposedInventorySummary {
  const estimatedFootage = Math.round(inventory.estimatedMileage * 5280);
  return {
    proposalId: inventory.proposalId,
    customerId: inventory.customerId,
    opportunityId: inventory.opportunityId,
    networkSummary: `${inventory.networkType.replaceAll("_", " ")} / ${formatProtectionClass(inventory.protection, normalizeNetworkClass(inventory.networkType))}`,
    estimatedRoute: `${inventory.estimatedMileage.toLocaleString()} estimated miles`,
    estimatedMileage: inventory.estimatedMileage,
    estimatedFootage,
    estimatedSegments: inventory.estimatedSegments,
    estimatedStations: inventory.estimatedStations,
    estimatedCrossings: inventory.estimatedCrossings,
    estimatedVaults: inventory.estimatedVaults,
    primaryProduct: inventory.primaryProduct,
    constructionSummary: `${inventory.estimatedConstructionType} construction estimate; ${inventory.estimatedVaults} vaults; ${inventory.estimatedCrossings} crossings`,
  };
}
