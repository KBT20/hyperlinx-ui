import type { ProviderEvidenceResult } from "../../providers/ProviderContract";
import type { CorridorCandidate } from "../CorridorCandidate";
import type { CorridorClassificationResult } from "../CorridorClassificationEngine";
import { enrichCorridorCandidate } from "../EvidenceEnrichmentEngine";
import type { EnrichedCorridorCandidate } from "../EnrichmentContract";

function candidate(candidateId: string, corridorId: string, name: string): CorridorCandidate {
  return {
    candidateId,
    corridorId,
    candidateType: "PRIMARY",
    candidateSource: "CORRIDOR_CONCEPT",
    corridorClass: "METRO",
    customerType: "HYPERSCALER",
    topologyIntent: "LINEAR",
    name,
    endpointIds: [`${candidateId}-a`, `${candidateId}-z`],
    requirementIds: [`${candidateId}-requirement`],
    geometry: [
      [-96.8, 32.78],
      [-96.7, 32.85],
    ],
    distanceMiles: 12,
    providerIds: [],
    sourceEvidenceIds: [`${candidateId}-source-evidence`],
    preservedCustomerRouteEvidenceIds: [],
    segmentIds: [`${candidateId}-segment-1`],
    attributes: [],
    diversityEvidenceIds: [],
    scorePlaceholder: {
      candidateId,
      scoreModel: "PRISM_PENDING",
      notes: "Fixture only. No scoring performed.",
    },
    promotionEligible: false,
    createdAt: "2026-06-23T00:00:00.000Z",
  };
}

function classification(corridorId: string, networkRole: CorridorClassificationResult["networkRole"]): CorridorClassificationResult {
  return {
    corridorId,
    corridorClass:
      networkRole === "AI_FABRIC"
        ? "AI_CORRIDOR"
        : networkRole === "BACKBONE_INTERCONNECT"
          ? "LONGHAUL"
          : networkRole === "MSA_INTERCONNECT"
            ? "MIDDLE_MILE"
            : networkRole === "INTERCONNECTION"
              ? "INTERCONNECTION"
              : "METRO",
    networkRole,
    msaRelationship: networkRole === "METRO_AGGREGATION" || networkRole === "INTERCONNECTION" ? "SAME_MSA" : "MSA_TO_MSA",
    aggregationRole: {
      aggregationFunction:
        networkRole === "AI_FABRIC"
          ? "AI_COMPUTE_AGGREGATION"
          : networkRole === "BACKBONE_INTERCONNECT"
            ? "TRANSPORT_BACKBONE"
            : networkRole === "INTERCONNECTION"
              ? "INTERCONNECTION_HANDOFF"
              : "LSO_AGGREGATION",
    },
    confidence: 0.9,
    evidenceIds: [`${corridorId}-classification-evidence`],
    warnings: [],
    diagnostics: ["FIXTURE_CLASSIFICATION"],
  };
}

function providerResult(input: {
  resultId: string;
  providerId: string;
  providerType: ProviderEvidenceResult["providerType"];
  capabilities: ProviderEvidenceResult["capabilities"];
  normalizedValue: unknown;
  confidence?: number;
  evidenceIds?: string[];
}): ProviderEvidenceResult {
  return {
    resultId: input.resultId,
    providerId: input.providerId,
    providerType: input.providerType,
    capabilities: input.capabilities,
    normalizedValue: input.normalizedValue,
    confidence: input.confidence ?? 0.82,
    evidenceIds: input.evidenceIds ?? [`${input.resultId}-evidence`],
    diagnostics: [],
    notes: "Synthetic provider evidence fixture. No live API call.",
  };
}

export const metroAggregationEnrichmentFixture = {
  candidate: candidate("enrich-metro-candidate", "enrich-metro", "Metro aggregation with parcel and interconnection evidence"),
  classification: classification("enrich-metro", "METRO_AGGREGATION"),
  providerEvidenceResults: [
    providerResult({
      resultId: "metro-parcel",
      providerId: "provider-parcel",
      providerType: "PARCEL_PROVIDER",
      capabilities: ["PARCEL_LOOKUP", "LAND_OWNERSHIP"],
      normalizedValue: { parcelCount: 14, ownershipMix: "commercial municipal", enrichmentCategories: ["MONETIZATION"] },
    }),
    providerResult({
      resultId: "metro-interconnection",
      providerId: "provider-carrier-hotel",
      providerType: "CARRIER_HOTEL_PROVIDER",
      capabilities: ["CARRIER_HOTEL_LOOKUP", "INTERCONNECTION_LOOKUP"],
      normalizedValue: { carrierHotels: 2, cloudHandoffPotential: true },
    }),
    providerResult({
      resultId: "metro-utility",
      providerId: "provider-utility-gis",
      providerType: "UTILITY_GIS",
      capabilities: ["UTILITY_INFRASTRUCTURE"],
      normalizedValue: { utilityConflictCount: 3, enrichmentCategories: ["MAINTENANCE", "RESTORATION"] },
    }),
  ],
};

export const msaInterconnectEnrichmentFixture = {
  candidate: candidate("enrich-msa-candidate", "enrich-msa", "MSA interconnect with jurisdiction and crossing evidence"),
  classification: classification("enrich-msa", "MSA_INTERCONNECT"),
  providerEvidenceResults: [
    providerResult({
      resultId: "msa-jurisdiction",
      providerId: "provider-dot-gis",
      providerType: "DOT_GIS",
      capabilities: ["JURISDICTION_LOOKUP", "CROSSING_DETECTION"],
      normalizedValue: { jurisdictions: ["TxDOT", "County"], crossings: 6 },
    }),
    providerResult({
      resultId: "msa-power",
      providerId: "provider-transmission",
      providerType: "TRANSMISSION_PROVIDER",
      capabilities: ["POWER_TRANSMISSION"],
      normalizedValue: { transmissionCorridorNearby: true, distanceMiles: 1.4 },
    }),
    providerResult({
      resultId: "msa-restoration",
      providerId: "provider-teralinx-model",
      providerType: "TERALINX_MODEL",
      capabilities: ["CORRIDOR_MODELING"],
      normalizedValue: { enrichmentCategories: ["RESTORATION", "MONETIZATION"], sparePathPotential: "medium" },
    }),
  ],
};

export const backboneEnrichmentFixture = {
  candidate: candidate("enrich-backbone-candidate", "enrich-backbone", "Backbone corridor with power and maintenance evidence"),
  classification: classification("enrich-backbone", "BACKBONE_INTERCONNECT"),
  providerEvidenceResults: [
    providerResult({
      resultId: "backbone-transmission",
      providerId: "provider-transmission",
      providerType: "TRANSMISSION_PROVIDER",
      capabilities: ["POWER_TRANSMISSION"],
      normalizedValue: { transmissionAssets: 4, highVoltageProximity: true },
    }),
    providerResult({
      resultId: "backbone-substation",
      providerId: "provider-substation",
      providerType: "SUBSTATION_PROVIDER",
      capabilities: ["POWER_SUBSTATION"],
      normalizedValue: { substations: 2, expansionPowerSignal: "strong" },
    }),
    providerResult({
      resultId: "backbone-regen-maintenance",
      providerId: "provider-teralinx-model",
      providerType: "TERALINX_MODEL",
      capabilities: ["CORRIDOR_MODELING"],
      normalizedValue: { enrichmentCategories: ["REGEN", "MAINTENANCE"], regenSites: 3 },
    }),
  ],
};

export const aiFabricEnrichmentFixture = {
  candidate: candidate("enrich-ai-candidate", "enrich-ai", "AI fabric with power, data center, and development site evidence"),
  classification: classification("enrich-ai", "AI_FABRIC"),
  providerEvidenceResults: [
    providerResult({
      resultId: "ai-substation",
      providerId: "provider-substation",
      providerType: "SUBSTATION_PROVIDER",
      capabilities: ["POWER_SUBSTATION"],
      normalizedValue: { substations: 5, availableCapacitySignal: "unknown but proximate" },
    }),
    providerResult({
      resultId: "ai-data-center",
      providerId: "provider-data-center",
      providerType: "DATA_CENTER_PROVIDER",
      capabilities: ["DATA_CENTER_LOOKUP", "INTERCONNECTION_LOOKUP"],
      normalizedValue: { dataCenters: 7, hyperscalerDensity: "high" },
    }),
    providerResult({
      resultId: "ai-cloud-onramp",
      providerId: "provider-cloud-onramp",
      providerType: "CLOUD_ONRAMP_PROVIDER",
      capabilities: ["CLOUD_ONRAMP_LOOKUP", "INTERCONNECTION_LOOKUP"],
      normalizedValue: { cloudOnRamps: 3, providers: ["AWS", "Azure"] },
    }),
    providerResult({
      resultId: "ai-development-site",
      providerId: "provider-land",
      providerType: "LAND_PROVIDER",
      capabilities: ["LAND_OWNERSHIP"],
      normalizedValue: { developmentSites: 4, enrichmentCategories: ["EXPANSION"] },
    }),
  ],
};

export const interconnectionEnrichmentFixture = {
  candidate: candidate("enrich-interconnection-candidate", "enrich-interconnection", "Interconnection corridor with carrier hotel and IX evidence"),
  classification: classification("enrich-interconnection", "INTERCONNECTION"),
  providerEvidenceResults: [
    providerResult({
      resultId: "interconnection-carrier-hotel",
      providerId: "provider-carrier-hotel",
      providerType: "CARRIER_HOTEL_PROVIDER",
      capabilities: ["CARRIER_HOTEL_LOOKUP", "INTERCONNECTION_LOOKUP"],
      normalizedValue: { carrierHotels: 1, meetMeAvailable: true },
    }),
    providerResult({
      resultId: "interconnection-ix",
      providerId: "provider-ix",
      providerType: "IX_PROVIDER",
      capabilities: ["IX_LOOKUP", "INTERCONNECTION_LOOKUP"],
      normalizedValue: { ixFacilities: 1, peeringDensity: "high" },
    }),
    providerResult({
      resultId: "interconnection-cloud-onramp",
      providerId: "provider-cloud-onramp",
      providerType: "CLOUD_ONRAMP_PROVIDER",
      capabilities: ["CLOUD_ONRAMP_LOOKUP", "INTERCONNECTION_LOOKUP"],
      normalizedValue: { cloudOnRamps: 2 },
    }),
  ],
};

export const conflictingEvidenceEnrichmentFixture = {
  candidate: candidate("enrich-conflict-candidate", "enrich-conflict", "Conflicting parcel ownership evidence case"),
  classification: classification("enrich-conflict", "METRO_AGGREGATION"),
  providerEvidenceResults: [
    providerResult({
      resultId: "conflict-parcel-county",
      providerId: "provider-parcel",
      providerType: "PARCEL_PROVIDER",
      capabilities: ["PARCEL_LOOKUP", "LAND_OWNERSHIP"],
      normalizedValue: { parcelId: "P-100", ownerType: "Municipal" },
      confidence: 0.78,
      evidenceIds: ["county-parcel-evidence"],
    }),
    providerResult({
      resultId: "conflict-parcel-municipal",
      providerId: "provider-municipal-gis",
      providerType: "MUNICIPAL_GIS",
      capabilities: ["PARCEL_LOOKUP", "GIS_GEOMETRY"],
      normalizedValue: { parcelId: "P-100", ownerType: "Private Commercial" },
      confidence: 0.7,
      evidenceIds: ["municipal-parcel-evidence"],
    }),
  ],
};

export const enrichmentFixtures = [
  metroAggregationEnrichmentFixture,
  msaInterconnectEnrichmentFixture,
  backboneEnrichmentFixture,
  aiFabricEnrichmentFixture,
  interconnectionEnrichmentFixture,
  conflictingEvidenceEnrichmentFixture,
];

export function evaluateEnrichmentFixtures(): EnrichedCorridorCandidate[] {
  return enrichmentFixtures.map((fixture) => enrichCorridorCandidate(fixture));
}

