import type { CorridorClass, CorridorNetworkRole } from "./corridorTypes";
import type { CorridorLensObjectType, CorridorLensType } from "./CorridorLens";
import {
  REFERENCE_ARCHITECTURE_CATALOG,
  type ReferenceArchitecture,
  type ReferenceArchitectureDiagnostic,
  type ReferenceArchitectureDiagnosticCode,
  type ReferenceArchitectureFit,
  type ReferenceArchitectureFitLevel,
  type ReferenceArchitectureToolRequirement,
  type ReferenceArchitectureToolType,
  type ReferenceArchitectureValidationFinding,
} from "./CorridorReferenceArchitecture";

export interface ReferenceArchitectureFitInput {
  lensTypes?: CorridorLensType[];
  networkRoles?: CorridorNetworkRole[];
  corridorClasses?: CorridorClass[];
  customerAsk?: string;
  availableObjectTypes?: CorridorLensObjectType[];
  availableToolEvidence?: ReferenceArchitectureToolType[];
}

function diagnostic(input: {
  code: ReferenceArchitectureDiagnosticCode;
  architectureId?: string;
  message: string;
  severity?: ReferenceArchitectureDiagnostic["severity"];
  details?: Record<string, unknown>;
}): ReferenceArchitectureDiagnostic {
  const result: ReferenceArchitectureDiagnostic = {
    code: input.code,
    architectureId: input.architectureId,
    message: input.message,
    severity: input.severity ?? "INFO",
    timestamp: new Date().toISOString(),
    details: input.details,
  };
  console.log(`[${result.code}]`, {
    architectureId: result.architectureId,
    message: result.message,
    severity: result.severity,
    details: result.details,
  });
  return result;
}

function intersection<T>(left: readonly T[] = [], right: readonly T[] = []): T[] {
  const rightSet = new Set(right);
  return left.filter((item) => rightSet.has(item));
}

function missing<T>(required: readonly T[] = [], available: readonly T[] = []): T[] {
  const availableSet = new Set(available);
  return required.filter((item) => !availableSet.has(item));
}

function patternMatches(patterns: readonly string[], customerAsk?: string): string[] {
  if (!customerAsk) return [];
  const normalizedAsk = customerAsk.toLowerCase();
  return patterns.filter((pattern) => normalizedAsk.includes(pattern.toLowerCase()));
}

function fitLevelFor(input: {
  lensMatches: number;
  roleMatches: number;
  classMatches: number;
  askMatches: number;
}): ReferenceArchitectureFitLevel {
  const evidenceMatches = input.lensMatches + input.roleMatches + input.classMatches + input.askMatches;
  if (evidenceMatches >= 4 && input.lensMatches > 0) return "STRONG";
  if (evidenceMatches >= 3) return "MODERATE";
  if (evidenceMatches >= 1) return "WEAK";
  return "NOT_APPLICABLE";
}

function finding(input: Omit<ReferenceArchitectureValidationFinding, "findingId"> & { architectureId: string; suffix: string }): ReferenceArchitectureValidationFinding {
  return {
    findingId: `${input.architectureId}-${input.suffix}`,
    severity: input.severity,
    message: input.message,
    relatedObjects: input.relatedObjects,
    relatedTools: input.relatedTools,
    relatedStandards: input.relatedStandards,
  };
}

export function getRequiredToolsForArchitecture(architectureId: string): ReferenceArchitectureToolRequirement[] {
  return REFERENCE_ARCHITECTURE_CATALOG.find((architecture) => architecture.architectureId === architectureId)?.requiredTools ?? [];
}

export function getRequiredObjectsForArchitecture(architectureId: string): CorridorLensObjectType[] {
  return REFERENCE_ARCHITECTURE_CATALOG.find((architecture) => architecture.architectureId === architectureId)?.requiredObjects ?? [];
}

export function getRequiredStandardsForArchitecture(architectureId: string): string[] {
  return REFERENCE_ARCHITECTURE_CATALOG.find((architecture) => architecture.architectureId === architectureId)?.requiredDesignStandards ?? [];
}

export function evaluateReferenceArchitectureFit(
  architecture: ReferenceArchitecture,
  input: ReferenceArchitectureFitInput,
): ReferenceArchitectureFit {
  const matchedLensTypes = intersection(architecture.applicableLensTypes, input.lensTypes);
  const matchedNetworkRoles = intersection(architecture.applicableNetworkRoles, input.networkRoles);
  const matchedCorridorClasses = intersection(architecture.applicableCorridorClasses, input.corridorClasses);
  const matchedCustomerAskPatterns = patternMatches(architecture.customerAskPatterns, input.customerAsk);
  const missingObjects = missing(architecture.requiredObjects, input.availableObjectTypes);
  const missingToolTypes = missing(
    architecture.requiredTools.filter((tool) => tool.required).map((tool) => tool.toolType),
    input.availableToolEvidence,
  );
  const missingToolEvidence = architecture.requiredTools.filter((tool) => missingToolTypes.includes(tool.toolType));
  const fitLevel = fitLevelFor({
    lensMatches: matchedLensTypes.length,
    roleMatches: matchedNetworkRoles.length,
    classMatches: matchedCorridorClasses.length,
    askMatches: matchedCustomerAskPatterns.length,
  });
  const warnings: string[] = [];
  const diagnostics: ReferenceArchitectureValidationFinding[] = [];

  if (fitLevel === "NOT_APPLICABLE") {
    warnings.push("No lens, role, class, or ask-pattern match was found.");
    diagnostics.push(
      finding({
        architectureId: architecture.architectureId,
        suffix: "not-applicable",
        severity: "INFO",
        message: "Reference architecture is not applicable to the supplied context.",
      }),
    );
  }

  if (missingObjects.length > 0) {
    warnings.push(`${missingObjects.length} required object type(s) are not present as evidence.`);
    diagnostics.push(
      finding({
        architectureId: architecture.architectureId,
        suffix: "missing-objects",
        severity: "WARNING",
        message: "Required architecture objects are missing from supplied evidence.",
        relatedObjects: missingObjects,
      }),
    );
  }

  if (missingToolEvidence.length > 0) {
    warnings.push(`${missingToolEvidence.length} required tool evidence item(s) are missing.`);
    diagnostics.push(
      finding({
        architectureId: architecture.architectureId,
        suffix: "missing-tools",
        severity: "WARNING",
        message: "Required architecture tool evidence is missing.",
        relatedTools: missingToolEvidence.map((tool) => tool.toolType),
      }),
    );
  }

  diagnostics.push(
    finding({
      architectureId: architecture.architectureId,
      suffix: "standards-required",
      severity: "INFO",
      message: "Reference architecture requires design standards context before Route Engineering review.",
      relatedStandards: architecture.requiredDesignStandards,
    }),
  );

  return {
    architectureId: architecture.architectureId,
    fitLevel,
    matchedLensTypes,
    matchedNetworkRoles,
    matchedCorridorClasses,
    matchedCustomerAskPatterns,
    requiredObjects: architecture.requiredObjects,
    missingObjects,
    requiredTools: architecture.requiredTools,
    missingToolEvidence,
    requiredStandards: architecture.requiredDesignStandards,
    engineeringReviewRequired: architecture.engineeringReviewRequired,
    warnings,
    diagnostics,
  };
}

export function matchReferenceArchitectures(input: ReferenceArchitectureFitInput): ReferenceArchitectureFit[] {
  diagnostic({
    code: "REFERENCE_ARCHITECTURE_MATCH_STARTED",
    message: "Reference architecture matching started.",
    details: {
      lensTypes: input.lensTypes ?? [],
      networkRoles: input.networkRoles ?? [],
      corridorClasses: input.corridorClasses ?? [],
      hasCustomerAsk: Boolean(input.customerAsk),
    },
  });

  const fits = REFERENCE_ARCHITECTURE_CATALOG.map((architecture) => {
    const fit = evaluateReferenceArchitectureFit(architecture, input);
    if (fit.fitLevel !== "NOT_APPLICABLE") {
      diagnostic({
        code: "REFERENCE_ARCHITECTURE_MATCHED",
        architectureId: architecture.architectureId,
        message: `${architecture.architectureName} matched at ${fit.fitLevel} fit.`,
        details: {
          matchedLensTypes: fit.matchedLensTypes,
          matchedNetworkRoles: fit.matchedNetworkRoles,
          matchedCorridorClasses: fit.matchedCorridorClasses,
          matchedCustomerAskPatterns: fit.matchedCustomerAskPatterns,
        },
      });
      fit.requiredTools.forEach((requiredTool) => {
        diagnostic({
          code: "REFERENCE_ARCHITECTURE_TOOL_REQUIRED",
          architectureId: architecture.architectureId,
          message: `${requiredTool.toolType} is required architecture tooling context.`,
          details: { ...requiredTool },
        });
      });
      fit.requiredObjects.forEach((requiredObject) => {
        diagnostic({
          code: "REFERENCE_ARCHITECTURE_OBJECT_REQUIRED",
          architectureId: architecture.architectureId,
          message: `${requiredObject} is required architecture object context.`,
          details: { objectType: requiredObject },
        });
      });
      fit.requiredStandards.forEach((requiredStandard) => {
        diagnostic({
          code: "REFERENCE_ARCHITECTURE_STANDARD_REQUIRED",
          architectureId: architecture.architectureId,
          message: `${requiredStandard} is required design standards context.`,
          details: { standardId: requiredStandard },
        });
      });
    }
    fit.warnings.forEach((warning) => {
      diagnostic({
        code: "REFERENCE_ARCHITECTURE_WARNING",
        architectureId: architecture.architectureId,
        message: warning,
        severity: "WARNING",
      });
    });
    return fit;
  });

  diagnostic({
    code: "REFERENCE_ARCHITECTURE_FIT_COMPLETE",
    message: "Reference architecture fit evaluation complete.",
    details: {
      fitCount: fits.length,
      applicableCount: fits.filter((fit) => fit.fitLevel !== "NOT_APPLICABLE").length,
    },
  });

  return fits;
}
