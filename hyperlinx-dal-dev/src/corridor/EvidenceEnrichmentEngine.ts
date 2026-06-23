import type { ProviderCapability, ProviderEvidenceResult } from "../providers/ProviderContract";
import type { CorridorCandidate } from "./CorridorCandidate";
import type { CorridorClassificationResult } from "./CorridorClassificationEngine";
import type {
  EnrichedCorridorCandidate,
  EnrichmentCategory,
  EnrichmentDiagnostic,
  EnrichmentFinding,
  EnrichmentRequest,
  EnrichmentResult,
  EnrichmentStatus,
  EnrichmentSummary,
  EnrichmentTarget,
  EnrichmentWarning,
} from "./EnrichmentContract";

const ALL_ENRICHMENT_CATEGORIES: EnrichmentCategory[] = [
  "POWER",
  "SUBSTATION",
  "TRANSMISSION",
  "GENERATION",
  "DATA_CENTER",
  "CARRIER_HOTEL",
  "IX",
  "CLOUD_ONRAMP",
  "PARCEL",
  "DEVELOPMENT_SITE",
  "JURISDICTION",
  "CROSSING",
  "CONSTRAINT",
  "UTILITY",
  "MONETIZATION",
  "RESTORATION",
  "MAINTENANCE",
  "INTERCONNECTION",
  "REGEN",
  "EXPANSION",
];

const TARGETS_BY_ROLE: Record<string, EnrichmentCategory[]> = {
  METRO_AGGREGATION: [
    "PARCEL",
    "DEVELOPMENT_SITE",
    "JURISDICTION",
    "CROSSING",
    "UTILITY",
    "INTERCONNECTION",
    "MONETIZATION",
    "RESTORATION",
    "MAINTENANCE",
  ],
  MSA_INTERCONNECT: [
    "JURISDICTION",
    "CROSSING",
    "POWER",
    "SUBSTATION",
    "TRANSMISSION",
    "UTILITY",
    "RESTORATION",
    "MONETIZATION",
  ],
  BACKBONE_INTERCONNECT: [
    "TRANSMISSION",
    "SUBSTATION",
    "GENERATION",
    "REGEN",
    "JURISDICTION",
    "CROSSING",
    "RESTORATION",
    "MAINTENANCE",
  ],
  AI_FABRIC: [
    "POWER",
    "SUBSTATION",
    "TRANSMISSION",
    "GENERATION",
    "DATA_CENTER",
    "CLOUD_ONRAMP",
    "IX",
    "CARRIER_HOTEL",
    "PARCEL",
    "DEVELOPMENT_SITE",
    "INTERCONNECTION",
    "EXPANSION",
    "MONETIZATION",
  ],
  INTERCONNECTION: ["DATA_CENTER", "CARRIER_HOTEL", "IX", "CLOUD_ONRAMP", "INTERCONNECTION", "PARCEL", "JURISDICTION"],
  CAMPUS: ["PARCEL", "DEVELOPMENT_SITE", "UTILITY", "INTERCONNECTION", "MAINTENANCE", "RESTORATION"],
  REGIONAL_AGGREGATION: ["JURISDICTION", "CROSSING", "UTILITY", "PARCEL", "TRANSMISSION", "RESTORATION", "MONETIZATION"],
};

const CATEGORY_BY_CAPABILITY: Partial<Record<ProviderCapability, EnrichmentCategory>> = {
  POWER_SUBSTATION: "SUBSTATION",
  POWER_TRANSMISSION: "TRANSMISSION",
  POWER_GENERATION: "GENERATION",
  DATA_CENTER_LOOKUP: "DATA_CENTER",
  CARRIER_HOTEL_LOOKUP: "CARRIER_HOTEL",
  IX_LOOKUP: "IX",
  CLOUD_ONRAMP_LOOKUP: "CLOUD_ONRAMP",
  PARCEL_LOOKUP: "PARCEL",
  LAND_OWNERSHIP: "DEVELOPMENT_SITE",
  JURISDICTION_LOOKUP: "JURISDICTION",
  CROSSING_DETECTION: "CROSSING",
  CONSTRAINT_GEOMETRY: "CONSTRAINT",
  UTILITY_INFRASTRUCTURE: "UTILITY",
  INTERCONNECTION_LOOKUP: "INTERCONNECTION",
  CORRIDOR_MODELING: "MONETIZATION",
};

function now(): string {
  return new Date().toISOString();
}

function diagnostic(
  code: EnrichmentDiagnostic["code"],
  message: string,
  input?: {
    candidateId?: string;
    category?: EnrichmentCategory;
    severity?: EnrichmentDiagnostic["severity"];
    details?: Record<string, unknown>;
  },
): EnrichmentDiagnostic {
  const result: EnrichmentDiagnostic = {
    code,
    candidateId: input?.candidateId,
    category: input?.category,
    message,
    severity: input?.severity ?? "INFO",
    timestamp: now(),
    details: input?.details,
  };

  const logPayload = {
    candidateId: result.candidateId,
    category: result.category,
    message: result.message,
    severity: result.severity,
    details: result.details,
  };

  if (result.severity === "ERROR") {
    console.error(`[${code}]`, logPayload);
  } else if (result.severity === "WARNING") {
    console.warn(`[${code}]`, logPayload);
  } else {
    console.log(`[${code}]`, logPayload);
  }

  return result;
}

function emptyCategoryCounts(): Record<EnrichmentCategory, number> {
  return Object.fromEntries(ALL_ENRICHMENT_CATEGORIES.map((category) => [category, 0])) as Record<EnrichmentCategory, number>;
}

function categoriesForProviderResult(result: ProviderEvidenceResult): EnrichmentCategory[] {
  const explicitCategories = explicitCategoriesFromNormalizedValue(result.normalizedValue);
  const categories = result.capabilities
    .map((capability) => CATEGORY_BY_CAPABILITY[capability])
    .filter((category): category is EnrichmentCategory => Boolean(category));

  if (
    result.capabilities.some((capability) =>
      ["POWER_SUBSTATION", "POWER_TRANSMISSION", "POWER_GENERATION"].includes(capability),
    )
  ) {
    categories.push("POWER");
  }

  if (explicitCategories.length > 0 || categories.length > 0) {
    return [...new Set([...explicitCategories, ...categories])];
  }

  if (result.geometry?.length) {
    return ["CONSTRAINT"];
  }

  return ["INTERCONNECTION"];
}

function isEnrichmentCategory(value: unknown): value is EnrichmentCategory {
  return typeof value === "string" && ALL_ENRICHMENT_CATEGORIES.includes(value as EnrichmentCategory);
}

function explicitCategoriesFromNormalizedValue(value: unknown): EnrichmentCategory[] {
  if (!value || typeof value !== "object") return [];
  const record = value as Record<string, unknown>;
  const categories = [
    record.enrichmentCategory,
    ...(Array.isArray(record.enrichmentCategories) ? record.enrichmentCategories : []),
  ].filter(isEnrichmentCategory);
  return [...new Set(categories)];
}

function valuesConflict(a: unknown, b: unknown): boolean {
  if (a === undefined || b === undefined) return false;
  if (typeof a !== typeof b) return true;

  if (typeof a === "string" || typeof a === "number" || typeof a === "boolean") {
    return a !== b;
  }

  const aJson = JSON.stringify(a);
  const bJson = JSON.stringify(b);
  return aJson !== bJson;
}

function findingValue(result: ProviderEvidenceResult): unknown {
  return result.normalizedValue ?? result.geometry ?? result.notes ?? null;
}

function rawReferenceFromProviderResult(result: ProviderEvidenceResult): unknown {
  if (!result.normalizedValue || typeof result.normalizedValue !== "object") return undefined;
  return (result.normalizedValue as Record<string, unknown>).rawReference;
}

function warning(
  warningId: string,
  message: string,
  input?: {
    category?: EnrichmentCategory;
    evidenceIds?: string[];
    providerIds?: string[];
  },
): EnrichmentWarning {
  return {
    warningId,
    category: input?.category,
    message,
    evidenceIds: input?.evidenceIds ?? [],
    providerIds: input?.providerIds ?? [],
  };
}

export function createEnrichmentRequest(input: {
  requestId: string;
  candidates: CorridorCandidate[];
  classifications: CorridorClassificationResult[];
  providerEvidenceResults: ProviderEvidenceResult[];
  createdAt?: string;
}): EnrichmentRequest {
  const targetsByCategory = new Map<EnrichmentCategory, EnrichmentTarget>();

  input.classifications.forEach((classification) => {
    const categories = TARGETS_BY_ROLE[classification.networkRole] ?? ["JURISDICTION", "CONSTRAINT"];
    categories.forEach((category) => {
      targetsByCategory.set(category, {
        category,
        required: true,
        reason: `${classification.networkRole} requires ${category} enrichment context.`,
      });
      diagnostic("EVIDENCE_ENRICHMENT_TARGET_SELECTED", "Selected enrichment target from classification.", {
        candidateId: classification.corridorId,
        category,
        details: {
          networkRole: classification.networkRole,
        },
      });
    });
  });

  const request: EnrichmentRequest = {
    requestId: input.requestId,
    candidateIds: input.candidates.map((candidate) => candidate.candidateId),
    targets: [...targetsByCategory.values()],
    providerEvidenceResults: input.providerEvidenceResults,
    createdAt: input.createdAt ?? now(),
  };

  diagnostic("EVIDENCE_ENRICHMENT_STARTED", "Created enrichment request.", {
    details: {
      requestId: request.requestId,
      candidateIds: request.candidateIds,
      targetCount: request.targets.length,
      providerEvidenceCount: request.providerEvidenceResults.length,
    },
  });

  return request;
}

export function mergeProviderEvidence(input: {
  candidate: CorridorCandidate;
  providerEvidenceResults: ProviderEvidenceResult[];
  targets: EnrichmentTarget[];
}): {
  findings: EnrichmentFinding[];
  warnings: EnrichmentWarning[];
  diagnostics: EnrichmentDiagnostic[];
} {
  const findings: EnrichmentFinding[] = [];
  const warnings: EnrichmentWarning[] = [];
  const diagnostics: EnrichmentDiagnostic[] = [];

  input.providerEvidenceResults.forEach((result) => {
    const categories = categoriesForProviderResult(result);
    categories.forEach((category) => {
      const existingConflicts = findings.filter(
        (finding) => finding.category === category && valuesConflict(finding.value, findingValue(result)),
      );
      const findingId = `${input.candidate.candidateId}-${category.toLowerCase()}-${findings.length + 1}`;
      const finding: EnrichmentFinding = {
        findingId,
        candidateId: input.candidate.candidateId,
        category,
        providerId: result.providerId,
        providerType: result.providerType,
        sourceResultId: result.resultId,
        confidence: result.confidence,
        evidenceIds: [...result.evidenceIds],
        rawReference: rawReferenceFromProviderResult(result),
        value: findingValue(result),
        notes: result.notes,
        conflictsWithFindingIds: existingConflicts.map((conflict) => conflict.findingId),
      };

      existingConflicts.forEach((conflict) => {
        conflict.conflictsWithFindingIds = [...new Set([...conflict.conflictsWithFindingIds, finding.findingId])];
      });

      findings.push(finding);
      diagnostics.push(
        diagnostic("EVIDENCE_ENRICHMENT_FINDING_CREATED", "Created enrichment finding from provider evidence.", {
          candidateId: input.candidate.candidateId,
          category,
          details: {
            providerId: result.providerId,
            sourceResultId: result.resultId,
          },
        }),
      );

      if (existingConflicts.length > 0) {
        const conflictWarning = warning("ENRICHMENT_CONFLICT", `Conflicting ${category} evidence preserved.`, {
          category,
          evidenceIds: [...new Set([...existingConflicts.flatMap((conflict) => conflict.evidenceIds), ...finding.evidenceIds])],
          providerIds: [...new Set([...existingConflicts.map((conflict) => conflict.providerId), finding.providerId])],
        });
        warnings.push(conflictWarning);
        diagnostics.push(
          diagnostic("EVIDENCE_ENRICHMENT_CONFLICT", conflictWarning.message, {
            candidateId: input.candidate.candidateId,
            category,
            severity: "WARNING",
            details: {
              conflictsWithFindingIds: finding.conflictsWithFindingIds,
            },
          }),
        );
      }
    });

    diagnostics.push(
      diagnostic("EVIDENCE_ENRICHMENT_PROVIDER_EVIDENCE_MERGED", "Merged provider evidence result.", {
        candidateId: input.candidate.candidateId,
        details: {
          providerId: result.providerId,
          resultId: result.resultId,
          categories,
        },
      }),
    );
  });

  input.targets.forEach((target) => {
    if (!findings.some((finding) => finding.category === target.category)) {
      const missingWarning = warning("ENRICHMENT_MISSING_CATEGORY", `Missing ${target.category} enrichment evidence.`, {
        category: target.category,
      });
      warnings.push(missingWarning);
      diagnostics.push(
        diagnostic("EVIDENCE_ENRICHMENT_MISSING_CATEGORY", missingWarning.message, {
          candidateId: input.candidate.candidateId,
          category: target.category,
          severity: "WARNING",
          details: {
            reason: target.reason,
          },
        }),
      );
    }
  });

  return {
    findings,
    warnings,
    diagnostics,
  };
}

export function summarizeEnrichmentFindings(input: {
  targets: EnrichmentTarget[];
  findings: EnrichmentFinding[];
  warnings: EnrichmentWarning[];
}): EnrichmentSummary {
  const targetCategories = emptyCategoryCounts();
  const findingCountsByCategory = emptyCategoryCounts();

  input.targets.forEach((target) => {
    targetCategories[target.category] += 1;
  });
  input.findings.forEach((finding) => {
    findingCountsByCategory[finding.category] += 1;
  });

  const missingCategories = input.targets
    .map((target) => target.category)
    .filter((category, index, categories) => categories.indexOf(category) === index)
    .filter((category) => findingCountsByCategory[category] === 0);

  const conflictCount = input.findings.filter((finding) => finding.conflictsWithFindingIds.length > 0).length;
  const confidenceTotal = input.findings.reduce((sum, finding) => sum + finding.confidence, 0);
  const averageConfidence = input.findings.length > 0 ? Number((confidenceTotal / input.findings.length).toFixed(2)) : 0;

  let status: EnrichmentStatus = "NOT_AVAILABLE";
  if (input.findings.length > 0 && missingCategories.length === 0 && conflictCount === 0) {
    status = "ENRICHED";
  } else if (input.findings.length > 0) {
    status = "PARTIAL";
  } else if (input.targets.length > 0) {
    status = "REQUESTED";
  }

  return {
    status,
    targetCategories,
    findingCountsByCategory,
    missingCategories,
    conflictCount,
    averageConfidence: conflictCount > 0 ? Number((averageConfidence * 0.85).toFixed(2)) : averageConfidence,
    powerAssets: findingCountsByCategory.POWER,
    substations: findingCountsByCategory.SUBSTATION,
    transmissionAssets: findingCountsByCategory.TRANSMISSION,
    dataCenters: findingCountsByCategory.DATA_CENTER,
    carrierHotels: findingCountsByCategory.CARRIER_HOTEL,
    cloudOnRamps: findingCountsByCategory.CLOUD_ONRAMP,
    parcels: findingCountsByCategory.PARCEL,
    developmentSites: findingCountsByCategory.DEVELOPMENT_SITE,
    jurisdictions: findingCountsByCategory.JURISDICTION,
    crossings: findingCountsByCategory.CROSSING,
    constraints: findingCountsByCategory.CONSTRAINT,
    monetizationOpportunities: findingCountsByCategory.MONETIZATION,
    maintenanceFindings: findingCountsByCategory.MAINTENANCE,
    restorationFindings: findingCountsByCategory.RESTORATION,
  };
}

export function enrichCorridorCandidate(input: {
  candidate: CorridorCandidate;
  classification: CorridorClassificationResult;
  providerEvidenceResults: ProviderEvidenceResult[];
}): EnrichedCorridorCandidate {
  const request = createEnrichmentRequest({
    requestId: `enrichment-${input.candidate.candidateId}`,
    candidates: [input.candidate],
    classifications: [input.classification],
    providerEvidenceResults: input.providerEvidenceResults,
  });

  const merged = mergeProviderEvidence({
    candidate: input.candidate,
    providerEvidenceResults: input.providerEvidenceResults,
    targets: request.targets,
  });
  const enrichmentSummary = summarizeEnrichmentFindings({
    targets: request.targets,
    findings: merged.findings,
    warnings: merged.warnings,
  });

  const completeDiagnostic = diagnostic("EVIDENCE_ENRICHMENT_COMPLETE", "Completed corridor candidate enrichment.", {
    candidateId: input.candidate.candidateId,
    details: {
      status: enrichmentSummary.status,
      findingCount: merged.findings.length,
      warningCount: merged.warnings.length,
    },
  });

  return {
    candidate: input.candidate,
    classification: input.classification,
    enrichmentFindings: merged.findings,
    enrichmentSummary,
    warnings: merged.warnings,
    diagnostics: [...merged.diagnostics, completeDiagnostic],
  };
}

export function enrichCorridorCandidates(input: {
  candidates: CorridorCandidate[];
  classifications: CorridorClassificationResult[];
  providerEvidenceResults: ProviderEvidenceResult[];
}): EnrichmentResult & { enrichedCandidates: EnrichedCorridorCandidate[] } {
  const enrichedCandidates = input.candidates.map((candidate) => {
    const classification =
      input.classifications.find((item) => item.corridorId === candidate.corridorId || item.corridorId === candidate.candidateId) ??
      input.classifications[0];

    return enrichCorridorCandidate({
      candidate,
      classification,
      providerEvidenceResults: input.providerEvidenceResults,
    });
  });

  const findings = enrichedCandidates.flatMap((candidate) => candidate.enrichmentFindings);
  const warnings = enrichedCandidates.flatMap((candidate) => candidate.warnings);
  const diagnostics = enrichedCandidates.flatMap((candidate) => candidate.diagnostics);
  const targets = input.classifications.flatMap((classification) =>
    (TARGETS_BY_ROLE[classification.networkRole] ?? ["JURISDICTION", "CONSTRAINT"]).map((category) => ({
      category,
      required: true,
      reason: `${classification.networkRole} requires ${category} enrichment context.`,
    })),
  );

  const summary = summarizeEnrichmentFindings({
    targets,
    findings,
    warnings,
  });

  return {
    requestId: `enrichment-batch-${input.candidates.length}`,
    status: summary.status,
    findings,
    summary,
    warnings,
    diagnostics,
    enrichedCandidates,
  };
}
