import type {
  CorridorAggregationRole,
  CorridorClass,
  CorridorCustomerType,
  CorridorEndpointType,
  CorridorMsaRelationship,
  CorridorNetworkRole,
  CorridorProductType,
  CorridorTopology,
} from "./corridorTypes";

export interface CorridorClassificationInput {
  corridorId?: string;
  corridorName?: string;
  corridorClassHint?: CorridorClass;
  networkRoleHint?: CorridorNetworkRole;
  customerType?: CorridorCustomerType;
  topology?: CorridorTopology;
  endpointTypes?: CorridorEndpointType[];
  endpointLabels?: string[];
  objectLabels?: string[];
  serviceIntent?: string;
  commercialProduct?: CorridorProductType | string;
  distanceMiles?: number;
  msaContext?: {
    aMsa?: string;
    zMsa?: string;
    sameMsa?: boolean;
    msaRelationship?: CorridorMsaRelationship;
  };
  aggregationPointIds?: string[];
  evidenceIds?: string[];
}

export interface CorridorClassificationResult {
  corridorId?: string;
  corridorClass: CorridorClass;
  underlyingCorridorClass?: CorridorClass;
  networkRole: CorridorNetworkRole;
  msaRelationship: CorridorMsaRelationship;
  aggregationRole: CorridorAggregationRole;
  confidence: number;
  evidenceIds: string[];
  warnings: string[];
  diagnostics: string[];
}

const METRO_AGGREGATION_TERMS = [
  "LSO",
  "LOCAL SERVING OFFICE",
  "CENTRAL OFFICE",
  "CARRIER HOTEL",
  "DATA CENTER",
  "IX",
  "INTERNET EXCHANGE",
  "ENTERPRISE",
  "WIRELESS",
  "MUNICIPAL",
  "UTILITY",
  "AGGREGATION",
];

const BACKBONE_TERMS = [
  "BACKBONE",
  "LONG HAUL",
  "LONGHAUL",
  "TRANSPORT BACKBONE",
  "REGIONAL POP",
  "POP",
  "DWDM",
  "WAVE",
  "TRANSPORT",
  "TERABIT",
  "INTERCITY",
];

const AI_TERMS = [
  "AI",
  "GPU",
  "HYPERSCALER",
  "NEOCLOUD",
  "POWER",
  "SUBSTATION",
  "TRANSMISSION",
  "AI COMPUTE",
  "AI FABRIC",
];

const CAMPUS_TERMS = ["CAMPUS", "BUILDING", "FACILITY", "MEET-ME", "MMR", "INTERNAL", "ENTRANCE"];

const INTERCONNECTION_TERMS = [
  "CLOUD ONRAMP",
  "CLOUD ON-RAMP",
  "IX",
  "INTERNET EXCHANGE",
  "MEET-ME",
  "MEET ME",
  "CARRIER HOTEL",
  "HANDOFF",
  "CROSS CONNECT",
];

function textForInput(input: CorridorClassificationInput): string {
  return [
    input.corridorName,
    input.serviceIntent,
    input.commercialProduct,
    input.customerType,
    input.topology,
    ...(input.endpointTypes ?? []),
    ...(input.endpointLabels ?? []),
    ...(input.objectLabels ?? []),
  ]
    .filter(Boolean)
    .join(" ")
    .toUpperCase();
}

function hasAny(text: string, terms: string[]): boolean {
  return terms.some((term) => text.includes(term));
}

function hasStrongInterconnectionSignal(text: string): boolean {
  return hasAny(text, [
    "CLOUD ONRAMP",
    "CLOUD ON-RAMP",
    "IX",
    "INTERNET EXCHANGE",
    "CARRIER HOTEL",
    "HANDOFF",
    "CROSS CONNECT",
  ]);
}

function addUniqueDiagnostic(diagnostics: string[], diagnostic: string): void {
  if (!diagnostics.includes(diagnostic)) {
    diagnostics.push(diagnostic);
  }
}

function classFromRelationship(msaRelationship: CorridorMsaRelationship): CorridorClass {
  if (msaRelationship === "SAME_MSA") return "METRO";
  if (msaRelationship === "MSA_TO_MSA") return "MIDDLE_MILE";
  if (msaRelationship === "INTERREGIONAL") return "LONGHAUL";
  return "REGIONAL";
}

export function inferMsaRelationship(input: CorridorClassificationInput): CorridorMsaRelationship {
  const explicit = input.msaContext?.msaRelationship;
  if (explicit && explicit !== "UNKNOWN") {
    return explicit;
  }

  if (input.msaContext?.sameMsa === true) {
    return "SAME_MSA";
  }

  const aMsa = input.msaContext?.aMsa?.trim().toUpperCase();
  const zMsa = input.msaContext?.zMsa?.trim().toUpperCase();

  if (aMsa && zMsa && aMsa === zMsa) {
    return "SAME_MSA";
  }

  if (aMsa && zMsa && aMsa !== zMsa) {
    return "MSA_TO_MSA";
  }

  if (aMsa || zMsa) {
    return "REGIONAL_TO_MSA";
  }

  return "UNKNOWN";
}

export function inferAggregationRole(input: CorridorClassificationInput): CorridorAggregationRole {
  const text = textForInput(input);

  if (hasAny(text, ["LSO", "LOCAL SERVING OFFICE", "CENTRAL OFFICE"])) {
    return {
      aggregationFunction: "LSO_AGGREGATION",
      aggregationPointIds: input.aggregationPointIds,
    };
  }

  if (hasAny(text, ["AI", "GPU", "HYPERSCALER", "NEOCLOUD"])) {
    return {
      aggregationFunction: "AI_COMPUTE_AGGREGATION",
      aggregationPointIds: input.aggregationPointIds,
    };
  }

  if (hasStrongInterconnectionSignal(text)) {
    return {
      aggregationFunction: "INTERCONNECTION_HANDOFF",
      aggregationPointIds: input.aggregationPointIds,
    };
  }

  if (hasAny(text, CAMPUS_TERMS)) {
    return {
      aggregationFunction: "CAMPUS_DISTRIBUTION",
      aggregationPointIds: input.aggregationPointIds,
    };
  }

  if (hasAny(text, ["DATA CENTER", "COLO", "COLOCATION"])) {
    return {
      aggregationFunction: "DATA_CENTER_AGGREGATION",
      aggregationPointIds: input.aggregationPointIds,
    };
  }

  if (hasAny(text, ["REGIONAL POP", "POP"])) {
    return {
      aggregationFunction: "REGIONAL_POP_AGGREGATION",
      aggregationPointIds: input.aggregationPointIds,
    };
  }

  if (hasAny(text, BACKBONE_TERMS)) {
    return {
      aggregationFunction: "TRANSPORT_BACKBONE",
      aggregationPointIds: input.aggregationPointIds,
    };
  }

  return {
    aggregationFunction: "UNKNOWN",
    aggregationPointIds: input.aggregationPointIds,
  };
}

export function classifyCorridorRole(input: CorridorClassificationInput): CorridorClassificationResult {
  const diagnostics: string[] = [];
  const warnings: string[] = [];

  console.log("[CORRIDOR_CLASSIFICATION_STARTED]", {
    corridorId: input.corridorId,
    corridorName: input.corridorName,
  });

  const text = textForInput(input);
  const msaRelationship = inferMsaRelationship(input);
  const aggregationRole = inferAggregationRole(input);

  console.log("[CORRIDOR_MSA_RELATIONSHIP_INFERRED]", {
    corridorId: input.corridorId,
    msaRelationship,
  });
  console.log("[CORRIDOR_AGGREGATION_ROLE_INFERRED]", {
    corridorId: input.corridorId,
    aggregationRole,
  });

  const hasMetroAggregationSignal = hasAny(text, METRO_AGGREGATION_TERMS);
  const hasBackboneSignal = hasAny(text, BACKBONE_TERMS);
  const hasAiSignal = hasAny(text, AI_TERMS);
  const hasCampusSignal = hasAny(text, CAMPUS_TERMS);
  const hasInterconnectionSignal = hasStrongInterconnectionSignal(text) || (hasAny(text, INTERCONNECTION_TERMS) && !hasCampusSignal);

  let corridorClass: CorridorClass = input.corridorClassHint ?? classFromRelationship(msaRelationship);
  let underlyingCorridorClass: CorridorClass | undefined;
  let networkRole: CorridorNetworkRole =
    input.networkRoleHint ??
    (msaRelationship === "SAME_MSA"
      ? "METRO_AGGREGATION"
      : msaRelationship === "MSA_TO_MSA"
        ? "MSA_INTERCONNECT"
        : "REGIONAL_AGGREGATION");

  if (input.networkRoleHint) {
    addUniqueDiagnostic(diagnostics, "NETWORK_ROLE_HINT_USED");
  } else if (hasCampusSignal && msaRelationship !== "MSA_TO_MSA") {
    networkRole = "CAMPUS";
    corridorClass = "CAMPUS";
    addUniqueDiagnostic(diagnostics, "CAMPUS_SIGNAL_USED");
  } else if (hasInterconnectionSignal) {
    networkRole = "INTERCONNECTION";
    corridorClass = "INTERCONNECTION";
    addUniqueDiagnostic(diagnostics, "INTERCONNECTION_SIGNAL_USED");
  } else if (hasAiSignal) {
    underlyingCorridorClass = corridorClass;
    networkRole = "AI_FABRIC";
    corridorClass = "AI_CORRIDOR";
    addUniqueDiagnostic(diagnostics, "AI_FABRIC_OVERLAY_USED");
  } else if (hasBackboneSignal && msaRelationship !== "SAME_MSA") {
    networkRole = "BACKBONE_INTERCONNECT";
    corridorClass = "LONGHAUL";
    addUniqueDiagnostic(diagnostics, "BACKBONE_SIGNAL_USED");
  } else if (msaRelationship === "SAME_MSA" && hasMetroAggregationSignal) {
    networkRole = "METRO_AGGREGATION";
    corridorClass = "METRO";
    addUniqueDiagnostic(diagnostics, "SAME_MSA_AGGREGATION_SIGNAL_USED");
  } else if (msaRelationship === "MSA_TO_MSA") {
    networkRole = "MSA_INTERCONNECT";
    corridorClass = "MIDDLE_MILE";
    addUniqueDiagnostic(diagnostics, "MSA_TO_MSA_SIGNAL_USED");
  } else if (msaRelationship === "REGIONAL_TO_MSA") {
    networkRole = "REGIONAL_AGGREGATION";
    corridorClass = "REGIONAL";
    addUniqueDiagnostic(diagnostics, "REGIONAL_TO_MSA_SIGNAL_USED");
  } else {
    addUniqueDiagnostic(diagnostics, "DEFAULT_REGIONAL_CLASSIFICATION_USED");
  }

  if (
    input.distanceMiles !== undefined &&
    input.distanceMiles > 100 &&
    msaRelationship === "SAME_MSA" &&
    corridorClass === "METRO"
  ) {
    const warning = "DISTANCE_ADVISORY_ONLY_SINGLE_MSA_METRO_PRESERVED";
    warnings.push(warning);
    console.warn("[CORRIDOR_CLASSIFICATION_WARNING]", {
      corridorId: input.corridorId,
      warning,
      distanceMiles: input.distanceMiles,
    });
  }

  if (!input.evidenceIds?.length) {
    const warning = "NO_EVIDENCE_IDS_SUPPLIED";
    warnings.push(warning);
    console.warn("[CORRIDOR_CLASSIFICATION_WARNING]", {
      corridorId: input.corridorId,
      warning,
    });
  }

  let confidence = 0.55;
  if (input.corridorClassHint || input.networkRoleHint) confidence += 0.12;
  if (msaRelationship !== "UNKNOWN") confidence += 0.14;
  if (hasMetroAggregationSignal || hasBackboneSignal || hasAiSignal || hasCampusSignal || hasInterconnectionSignal) {
    confidence += 0.14;
  }
  if (input.evidenceIds?.length) confidence += 0.08;
  if (input.distanceMiles !== undefined) confidence += 0.04;
  confidence = Math.min(0.97, Number(confidence.toFixed(2)));

  console.log("[CORRIDOR_ROLE_INFERRED]", {
    corridorId: input.corridorId,
    corridorClass,
    networkRole,
    underlyingCorridorClass,
  });

  const result: CorridorClassificationResult = {
    corridorId: input.corridorId,
    corridorClass,
    underlyingCorridorClass,
    networkRole,
    msaRelationship,
    aggregationRole,
    confidence,
    evidenceIds: input.evidenceIds ?? [],
    warnings,
    diagnostics,
  };

  console.log("[CORRIDOR_CLASSIFICATION_COMPLETE]", result);

  return result;
}
