import { getObjectDesignStandards } from "../corridor/CorridorDesignStandards";
import type { CorridorLensObjectType } from "../corridor/CorridorLens";
import type { ArchitectureSelection, ReferenceArchitectureId } from "./ArchitectureSelection";
import type {
  BaselineNetworkCandidate,
  BaselineNetworkDiagnostic,
  BaselineNetworkReadinessStatus,
  BaselineNetworkSynthesisViewModel,
} from "./BaselineNetworkCandidate";
import type { BaselineNetworkObject, BaselineNetworkObjectRole } from "./BaselineNetworkObject";
import type { CustomerContext, NetworkIntent, NetworkType, OpportunityContext } from "./NetworkIntent";
import type { ProtectionSchema, ProtectionSchemaType } from "./ProtectionSchema";

export interface BaselineNetworkSynthesisInput {
  candidateId?: string;
  customerContext: CustomerContext;
  opportunityContext: OpportunityContext;
  selectedIntent?: NetworkIntent;
  selectedProtection?: ProtectionSchema;
  corridorId?: string;
  scopeVersionId?: string;
  requestedAt?: string;
}

export interface BaselineNetworkReadiness {
  status: BaselineNetworkReadinessStatus;
  blockers: string[];
  diagnostics: BaselineNetworkDiagnostic[];
}

interface BaselineObjectTemplate {
  objectType: CorridorLensObjectType;
  objectName: string;
  objectRole: BaselineNetworkObjectRole;
  quantity: number;
  notes: string;
}

const ARCHITECTURE_NAMES: Record<string, string> = {
  METRO_RING_REFERENCE_ARCHITECTURE: "Metro Ring Reference Architecture",
  METRO_DIVERSE_REFERENCE_ARCHITECTURE: "Metro Diverse Reference Architecture",
  METRO_LINEAR_REFERENCE_ARCHITECTURE: "Metro Linear Reference Architecture",
  METRO_MESH_REFERENCE_ARCHITECTURE: "Metro Mesh Reference Architecture",
  MIDDLE_MILE_LINEAR_REFERENCE_ARCHITECTURE: "Middle Mile Linear Reference Architecture",
  MIDDLE_MILE_DIVERSE_REFERENCE_ARCHITECTURE: "Middle Mile Diverse Reference Architecture",
  MIDDLE_MILE_RING_REFERENCE_ARCHITECTURE: "Middle Mile Ring Reference Architecture",
  MIDDLE_MILE_MESH_REFERENCE_ARCHITECTURE: "Middle Mile Mesh Reference Architecture",
  LONG_HAUL_LINEAR_REFERENCE_ARCHITECTURE: "Long Haul Linear Reference Architecture",
  LONG_HAUL_DIVERSE_REFERENCE_ARCHITECTURE: "Long Haul Diverse Reference Architecture",
  LONG_HAUL_RING_REFERENCE_ARCHITECTURE: "Long Haul Ring Reference Architecture",
  LONG_HAUL_MESH_REFERENCE_ARCHITECTURE: "Long Haul Mesh Reference Architecture",
  AI_CORRIDOR_DIVERSE_REFERENCE_ARCHITECTURE: "AI Corridor Diverse Reference Architecture",
  AI_CORRIDOR_LINEAR_REFERENCE_ARCHITECTURE: "AI Corridor Linear Reference Architecture",
  AI_CORRIDOR_RING_REFERENCE_ARCHITECTURE: "AI Corridor Ring Reference Architecture",
  AI_CORRIDOR_MESH_REFERENCE_ARCHITECTURE: "AI Corridor Mesh Reference Architecture",
  DATA_CENTER_INTERCONNECT_LINEAR_REFERENCE_ARCHITECTURE: "Data Center Interconnect Linear Reference Architecture",
  DATA_CENTER_INTERCONNECT_DIVERSE_REFERENCE_ARCHITECTURE: "Data Center Interconnect Diverse Reference Architecture",
  DATA_CENTER_INTERCONNECT_RING_REFERENCE_ARCHITECTURE: "Data Center Interconnect Ring Reference Architecture",
  DATA_CENTER_INTERCONNECT_MESH_REFERENCE_ARCHITECTURE: "Data Center Interconnect Mesh Reference Architecture",
  ENTERPRISE_ACCESS_LINEAR_REFERENCE_ARCHITECTURE: "Enterprise Access Linear Reference Architecture",
  ENTERPRISE_ACCESS_DIVERSE_REFERENCE_ARCHITECTURE: "Enterprise Access Diverse Reference Architecture",
  ENTERPRISE_ACCESS_RING_REFERENCE_ARCHITECTURE: "Enterprise Access Ring Reference Architecture",
  ENTERPRISE_ACCESS_MESH_REFERENCE_ARCHITECTURE: "Enterprise Access Mesh Reference Architecture",
  WIRELESS_BACKHAUL_LINEAR_REFERENCE_ARCHITECTURE: "Wireless Backhaul Linear Reference Architecture",
  WIRELESS_BACKHAUL_DIVERSE_REFERENCE_ARCHITECTURE: "Wireless Backhaul Diverse Reference Architecture",
  WIRELESS_BACKHAUL_RING_REFERENCE_ARCHITECTURE: "Wireless Backhaul Ring Reference Architecture",
  WIRELESS_BACKHAUL_MESH_REFERENCE_ARCHITECTURE: "Wireless Backhaul Mesh Reference Architecture",
  CUSTOM_LINEAR_REFERENCE_ARCHITECTURE: "Custom Linear Reference Architecture",
  CUSTOM_DIVERSE_REFERENCE_ARCHITECTURE: "Custom Diverse Reference Architecture",
  CUSTOM_RING_REFERENCE_ARCHITECTURE: "Custom Ring Reference Architecture",
  CUSTOM_MESH_REFERENCE_ARCHITECTURE: "Custom Mesh Reference Architecture",
};

const BASELINE_OBJECT_TEMPLATES: Record<NetworkType, BaselineObjectTemplate[]> = {
  METRO: [
    { objectType: "AGGREGATION_NODE", objectName: "Aggregation Node", objectRole: "AGGREGATION", quantity: 2, notes: "Metro aggregation endpoints for review." },
    { objectType: "CARRIER_HOTEL", objectName: "Carrier Hotel", objectRole: "INTERCONNECTION", quantity: 1, notes: "Interconnection anchor for metro handoff context." },
    { objectType: "ENTERPRISE_BUILDING", objectName: "Enterprise Access Object", objectRole: "ACCESS", quantity: 4, notes: "Customer or building access candidates." },
    { objectType: "CONDUIT", objectName: "Metro Segment", objectRole: "SEGMENT", quantity: 4, notes: "Segment placeholders for later engineering validation." },
  ],
  MIDDLE_MILE: [
    { objectType: "AGGREGATION_NODE", objectName: "Aggregation Site", objectRole: "AGGREGATION", quantity: 2, notes: "Regional collection or handoff site." },
    { objectType: "POP", objectName: "Regional POP", objectRole: "TRANSPORT", quantity: 2, notes: "Regional POP or transport facility candidate." },
    { objectType: "BACKBONE_NODE", objectName: "Transport Facility", objectRole: "BACKBONE", quantity: 2, notes: "Backbone or transport facility placeholder." },
    { objectType: "FIBER", objectName: "Middle Mile Segment", objectRole: "SEGMENT", quantity: 3, notes: "Middle-mile segment placeholder." },
  ],
  LONG_HAUL: [
    { objectType: "ADM_SITE", objectName: "ADM Object", objectRole: "TRANSPORT", quantity: 2, notes: "Add/drop review point for transport design." },
    { objectType: "REGEN_SITE", objectName: "Regen Object", objectRole: "TRANSPORT", quantity: 3, notes: "Regen review placeholders; placement is not authoritative." },
    { objectType: "INTERCONNECT_FACILITY", objectName: "Interconnect Facility", objectRole: "INTERCONNECTION", quantity: 2, notes: "Handoff or interconnect facility context." },
    { objectType: "FIBER", objectName: "Long Haul Segment", objectRole: "SEGMENT", quantity: 4, notes: "Long-haul segment placeholder." },
  ],
  AI_CORRIDOR: [
    { objectType: "GPU_ARRAY", objectName: "GPU Facility", objectRole: "POWER_CONTEXT", quantity: 2, notes: "AI demand and facility context." },
    { objectType: "SUBSTATION", objectName: "Substation", objectRole: "POWER_CONTEXT", quantity: 2, notes: "Power proximity evidence placeholder." },
    { objectType: "POWER_FEED", objectName: "Power Object", objectRole: "POWER_CONTEXT", quantity: 2, notes: "Power feed or power context object." },
    { objectType: "CARRIER_HOTEL", objectName: "Carrier Hotel", objectRole: "INTERCONNECTION", quantity: 1, notes: "Interconnection density context." },
    { objectType: "DATA_CENTER", objectName: "Data Center", objectRole: "INTERCONNECTION", quantity: 2, notes: "Data center context." },
    { objectType: "INTERCONNECT_FACILITY", objectName: "Interconnect Facility", objectRole: "INTERCONNECTION", quantity: 2, notes: "Interconnect facility placeholder." },
    { objectType: "FIBER", objectName: "Long Haul Connectivity Object", objectRole: "SEGMENT", quantity: 4, notes: "Connectivity object for future route engineering." },
  ],
  DATA_CENTER_INTERCONNECT: [
    { objectType: "DATA_CENTER", objectName: "Data Center Endpoint", objectRole: "INTERCONNECTION", quantity: 2, notes: "Interconnection endpoint candidates." },
    { objectType: "CARRIER_HOTEL", objectName: "Carrier Hotel", objectRole: "INTERCONNECTION", quantity: 1, notes: "Optional carrier hotel handoff context." },
    { objectType: "CLOUD_ONRAMP", objectName: "Cloud On-Ramp", objectRole: "INTERCONNECTION", quantity: 1, notes: "Cloud access context." },
    { objectType: "FIBER", objectName: "Interconnect Segment", objectRole: "SEGMENT", quantity: 2, notes: "Interconnect segment placeholder." },
  ],
  ENTERPRISE_ACCESS: [
    { objectType: "ENTERPRISE_BUILDING", objectName: "Enterprise Access Object", objectRole: "ACCESS", quantity: 2, notes: "Customer building or access candidate." },
    { objectType: "HANDHOLE", objectName: "Access Structure", objectRole: "ACCESS", quantity: 2, notes: "Access structure placeholder." },
    { objectType: "CONDUIT", objectName: "Enterprise Lateral Segment", objectRole: "SEGMENT", quantity: 2, notes: "Lateral segment placeholder." },
  ],
  WIRELESS_BACKHAUL: [
    { objectType: "WIRELESS_SITE", objectName: "Wireless Site", objectRole: "WIRELESS", quantity: 2, notes: "Wireless backhaul endpoint context." },
    { objectType: "AGGREGATION_NODE", objectName: "Aggregation Node", objectRole: "AGGREGATION", quantity: 1, notes: "Backhaul aggregation context." },
    { objectType: "FIBER", objectName: "Backhaul Segment", objectRole: "SEGMENT", quantity: 2, notes: "Backhaul segment placeholder." },
  ],
  CUSTOM: [
    { objectType: "CONSTRAINT", objectName: "Custom Review Object", objectRole: "CUSTOM", quantity: 1, notes: "Custom architecture requires human review before Prism." },
  ],
};

function timestamp(value?: string): string {
  return value ?? new Date().toISOString();
}

function diagnostic(input: Omit<BaselineNetworkDiagnostic, "timestamp"> & { timestamp?: string }): BaselineNetworkDiagnostic {
  const entry = {
    ...input,
    timestamp: timestamp(input.timestamp),
  };
  console.info(`[${entry.code}]`, entry);
  return entry;
}

function toReferenceArchitectureId(networkType: NetworkType, protectionSchema: ProtectionSchemaType): ReferenceArchitectureId {
  return `${networkType}_${protectionSchema}_REFERENCE_ARCHITECTURE`;
}

function unique<T>(items: T[]): T[] {
  return Array.from(new Set(items));
}

export function selectArchitecture(intent: NetworkIntent, protection: ProtectionSchema): ArchitectureSelection {
  const referenceArchitectureId = toReferenceArchitectureId(intent.networkType, protection.schemaType);
  const objectCatalogTypes = unique(BASELINE_OBJECT_TEMPLATES[intent.networkType].map((template) => template.objectType));
  const designStandardIds = unique(objectCatalogTypes.flatMap((objectType) => getObjectDesignStandards(objectType).map((standard) => standard.standardId)));

  diagnostic({
    code: "INTENT_SELECTED",
    severity: "INFO",
    customerId: intent.customerId,
    opportunityId: intent.opportunityId,
    message: `Network intent selected: ${intent.networkType}`,
    details: { intentId: intent.intentId, networkType: intent.networkType },
  });

  diagnostic({
    code: "PROTECTION_SELECTED",
    severity: "INFO",
    customerId: protection.customerId,
    opportunityId: protection.opportunityId,
    message: `Protection schema selected: ${protection.schemaType}`,
    details: { protectionSchemaId: protection.protectionSchemaId, protectionSchema: protection.schemaType },
  });

  diagnostic({
    code: "ARCHITECTURE_SELECTED",
    severity: "INFO",
    customerId: intent.customerId,
    opportunityId: intent.opportunityId,
    message: `Reference architecture selected: ${referenceArchitectureId}`,
    details: { referenceArchitectureId, objectCatalogTypes, designStandardIds },
  });

  return {
    selectionId: `ARCH-${intent.intentId}-${protection.protectionSchemaId}`,
    networkType: intent.networkType,
    protectionSchema: protection.schemaType,
    referenceArchitectureId,
    referenceArchitectureName: ARCHITECTURE_NAMES[referenceArchitectureId] ?? referenceArchitectureId.replaceAll("_", " "),
    designStandardIds,
    objectCatalogTypes,
    selectedAt: timestamp(),
    selectionBasis: [
      `networkType=${intent.networkType}`,
      `protectionSchema=${protection.schemaType}`,
      "Translate synthesis only; human engineering review remains authoritative.",
    ],
    humanReviewRequired: true,
    nonAuthoritative: true,
  };
}

export function generateCandidateObjects(selection: ArchitectureSelection, input: BaselineNetworkSynthesisInput): BaselineNetworkObject[] {
  const templates = BASELINE_OBJECT_TEMPLATES[selection.networkType];
  return templates.map((template, index) => {
    const designStandardIds = getObjectDesignStandards(template.objectType).map((standard) => standard.standardId);
    return {
      objectId: `${selection.referenceArchitectureId}:OBJECT:${String(index + 1).padStart(2, "0")}`,
      objectType: template.objectType,
      objectName: template.objectName,
      objectRole: template.objectRole,
      status: "REVIEW_REQUIRED",
      quantity: template.quantity,
      designStandardIds,
      objectCatalogReferences: [template.objectType],
      evidenceIds: [],
      traceability: {
        customerId: input.customerContext.customerId,
        opportunityId: input.opportunityContext.opportunityId,
        corridorId: input.corridorId,
        scopeVersionId: input.scopeVersionId,
        architectureId: selection.referenceArchitectureId,
      },
      notes: template.notes,
      nonAuthoritative: true,
    };
  });
}

export function evaluateReviewReadiness(candidate: BaselineNetworkCandidate): BaselineNetworkReadiness {
  const blockers: string[] = [];
  if (!candidate.customerContext.customerId) blockers.push("CUSTOMER_REQUIRED");
  if (!candidate.opportunityContext.opportunityId) blockers.push("OPPORTUNITY_REQUIRED");
  if (!candidate.selectedIntent?.networkType) blockers.push("NETWORK_TYPE_REQUIRED");
  if (!candidate.selectedProtection?.schemaType) blockers.push("PROTECTION_SCHEMA_REQUIRED");
  if (!candidate.architectureSelection?.referenceArchitectureId) blockers.push("REFERENCE_ARCHITECTURE_REQUIRED");
  if (candidate.candidateObjects.length < 1) blockers.push("BASELINE_OBJECTS_REQUIRED");

  const status: BaselineNetworkReadinessStatus = blockers.length === 0 ? "READY_FOR_SCOPE_REVIEW" : "BLOCKED";
  const diagnostics = [
    diagnostic({
      code: status === "READY_FOR_SCOPE_REVIEW" ? "READY_FOR_SCOPE_REVIEW" : "BASELINE_SYNTHESIS_BLOCKED",
      severity: status === "READY_FOR_SCOPE_REVIEW" ? "INFO" : "ERROR",
      customerId: candidate.customerContext.customerId,
      opportunityId: candidate.opportunityContext.opportunityId,
      candidateId: candidate.candidateId,
      message: status === "READY_FOR_SCOPE_REVIEW" ? "Baseline network candidate is ready for Scope Review." : "Baseline network candidate is blocked.",
      details: { blockers },
    }),
  ];

  return { status, blockers, diagnostics };
}

export function generateArchitectureDiagnostics(candidate: BaselineNetworkCandidate): BaselineNetworkDiagnostic[] {
  return [
    diagnostic({
      code: "BASELINE_SYNTHESIZED",
      severity: candidate.status === "READY_FOR_SCOPE_REVIEW" ? "INFO" : "WARNING",
      customerId: candidate.customerContext.customerId,
      opportunityId: candidate.opportunityContext.opportunityId,
      candidateId: candidate.candidateId,
      message: "Baseline network candidate generated for review.",
      details: {
        objectCount: candidate.candidateObjects.length,
        referenceArchitecture: candidate.referenceArchitecture,
        readiness: candidate.status,
      },
    }),
  ];
}

export function generateBaselineNetwork(input: BaselineNetworkSynthesisInput): BaselineNetworkCandidate {
  const candidateId = input.candidateId ?? `BNC-${input.customerContext.customerId || "UNKNOWN"}-${input.opportunityContext.opportunityId || "UNKNOWN"}`;
  const selection = input.selectedIntent && input.selectedProtection ? selectArchitecture(input.selectedIntent, input.selectedProtection) : undefined;
  const candidateObjects = selection ? generateCandidateObjects(selection, input) : [];
  const candidate: BaselineNetworkCandidate = {
    candidateId,
    customerContext: input.customerContext,
    opportunityContext: input.opportunityContext,
    selectedIntent: input.selectedIntent,
    selectedProtection: input.selectedProtection,
    architectureSelection: selection,
    referenceArchitecture: selection?.referenceArchitectureId,
    candidateObjects,
    status: "BLOCKED",
    blockers: [],
    diagnostics: [],
    traceability: {
      customerId: input.customerContext.customerId,
      opportunityId: input.opportunityContext.opportunityId,
      corridorId: input.corridorId,
      scopeVersionId: input.scopeVersionId,
      intentId: input.selectedIntent?.intentId,
      protectionSchemaId: input.selectedProtection?.protectionSchemaId,
      architectureSelectionId: selection?.selectionId,
    },
    generatedAt: timestamp(input.requestedAt),
    noRouting: true,
    noEngineering: true,
    noScopeVersionCreation: true,
    nonAuthoritative: true,
  };

  const readiness = evaluateReviewReadiness(candidate);
  const architectureDiagnostics = generateArchitectureDiagnostics({ ...candidate, status: readiness.status, blockers: readiness.blockers });

  return {
    ...candidate,
    status: readiness.status,
    blockers: readiness.blockers,
    diagnostics: [...readiness.diagnostics, ...architectureDiagnostics],
  };
}

export function createBaselineNetworkSynthesisViewModel(candidate: BaselineNetworkCandidate): BaselineNetworkSynthesisViewModel {
  return {
    intentSelector: {
      modelId: "NETWORK_INTENT_SELECTOR",
      selectedNetworkType: candidate.selectedIntent?.networkType,
    },
    protectionSelector: {
      modelId: "PROTECTION_SELECTOR",
      selectedProtectionSchema: candidate.selectedProtection?.schemaType,
    },
    architectureSummary: candidate.architectureSelection
      ? {
          modelId: "ARCHITECTURE_SUMMARY_CARD",
          referenceArchitecture: candidate.architectureSelection.referenceArchitectureId,
        }
      : undefined,
    baselineNetworkSummary: {
      modelId: "BASELINE_NETWORK_SUMMARY_CARD",
      candidateId: candidate.candidateId,
      networkType: candidate.selectedIntent?.networkType,
      protectionSchema: candidate.selectedProtection?.schemaType,
      objectCount: candidate.candidateObjects.length,
      referenceArchitecture: candidate.referenceArchitecture,
      noAuthorityCreated: true,
    },
    scopeReviewReadiness: {
      modelId: "SCOPE_REVIEW_READINESS_CARD",
      status: candidate.status,
      blockers: candidate.blockers,
      nextWorkspace: "Scope Review",
    },
  };
}
