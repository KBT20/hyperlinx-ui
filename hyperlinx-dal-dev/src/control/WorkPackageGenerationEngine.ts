import type {
  WorkPackage,
  WorkPackageAllocation,
  WorkPackageAudit,
  WorkPackageDependency,
  WorkPackageDiagnostic,
  WorkPackageType,
} from "./WorkPackage";
import {
  WORK_PACKAGE_GENERATION_REQUIREMENTS,
  type WorkPackageAuthorityValidation,
  type WorkPackageBlockerCode,
  type WorkPackageBlockerSeverity,
  type WorkPackageGenerationBlocker,
  type WorkPackageGenerationInput,
  type WorkPackageGenerationRequirement,
  type WorkPackageGenerationResult,
} from "./WorkPackageGeneration";

function nowIso() {
  return new Date().toISOString();
}

function diagnostic(
  code: WorkPackageDiagnostic["code"],
  severity: WorkPackageDiagnostic["severity"],
  message: string,
  details?: Record<string, unknown>,
): WorkPackageDiagnostic {
  return { code, severity, message, details };
}

export function generateWorkPackages(input: WorkPackageGenerationInput): WorkPackageGenerationResult {
  const started = diagnostic("WORK_PACKAGE_GENERATION_STARTED", "INFO", "Work Package generation started.", {
    scopeVersionId: input.scopeVersionId,
    lifecycleState: input.lifecycleState,
  });
  console.info("[WORK_PACKAGE_GENERATION_STARTED]", {
    scopeVersionId: input.scopeVersionId,
    lifecycleState: input.lifecycleState,
  });

  const validation = validateWorkPackageAuthority(input);
  if (!validation.valid) {
    const diagnostics = [
      started,
      ...validation.diagnostics,
      diagnostic("WORK_PACKAGE_REJECTED", "ERROR", "Work Package generation rejected.", {
        blockerCount: validation.blockers.length,
      }),
    ];
    const audit = createWorkPackageAudit(input, [], validation.blockers, diagnostics);

    console.info("[WORK_PACKAGE_REJECTED]", {
      scopeVersionId: input.scopeVersionId,
      blockerCount: validation.blockers.length,
    });

    return {
      scopeVersionId: input.scopeVersionId ?? "",
      status: "REJECTED",
      workPackages: [],
      blockers: validation.blockers,
      audit,
      diagnostics: [...diagnostics, ...audit.diagnostics],
    };
  }

  const workPackages = [
    ...generateStationWorkPackages(input),
    ...generateSegmentWorkPackages(input),
    ...generateDisciplineWorkPackages(input),
  ];
  const diagnostics = [
    started,
    ...validation.diagnostics,
    ...workPackages.flatMap((workPackage) => workPackage.diagnostics),
    diagnostic("WORK_PACKAGE_VALIDATED", "INFO", "Generated Work Packages validated.", {
      packageCount: workPackages.length,
    }),
  ];
  const audit = createWorkPackageAudit(input, workPackages, [], diagnostics);

  console.info("[WORK_PACKAGE_VALIDATED]", {
    scopeVersionId: input.scopeVersionId,
    packageCount: workPackages.length,
  });

  return {
    scopeVersionId: input.scopeVersionId ?? "",
    status: "GENERATED",
    workPackages,
    blockers: [],
    audit,
    diagnostics: [...diagnostics, ...audit.diagnostics],
  };
}

export function generateStationWorkPackages(input: WorkPackageGenerationInput): WorkPackage[] {
  if (!input.source.stationIds.length) return [];
  if (!shouldGenerate(input, "STATION_WORK_PACKAGE")) return [];

  const workPackage = createWorkPackage(input, {
    type: "STATION_WORK_PACKAGE",
    suffix: "STATIONS",
    name: "Station Work Package",
    description: "Station-based controlled decomposition of ScopeVersion truth.",
    stationIds: input.source.stationIds,
    segmentIds: [],
    objectIds: input.source.objectIds,
  });
  return [workPackage];
}

export function generateSegmentWorkPackages(input: WorkPackageGenerationInput): WorkPackage[] {
  if (!input.source.segmentIds.length) return [];
  if (!shouldGenerate(input, "SEGMENT_WORK_PACKAGE")) return [];

  return input.source.segmentIds.map((segmentId, index) =>
    createWorkPackage(input, {
      type: "SEGMENT_WORK_PACKAGE",
      suffix: `SEGMENT-${index + 1}`,
      name: `Segment Work Package ${index + 1}`,
      description: `Segment package for ${segmentId}.`,
      stationIds: input.source.stationIds,
      segmentIds: [segmentId],
      objectIds: input.source.objectIds,
    }),
  );
}

export function generateDisciplineWorkPackages(input: WorkPackageGenerationInput): WorkPackage[] {
  if (!input.source.disciplines.length) return [];

  return input.source.disciplines
    .map((discipline) => disciplineWorkPackageType(discipline))
    .filter((type): type is WorkPackageType => Boolean(type))
    .filter((type) => shouldGenerate(input, type))
    .map((type) =>
      createWorkPackage(input, {
        type,
        suffix: type.replace("_WORK_PACKAGE", ""),
        name: titleFromWorkPackageType(type),
        description: `${titleFromWorkPackageType(type)} generated from approved ScopeVersion planning inputs.`,
        stationIds: input.source.stationIds,
        segmentIds: input.source.segmentIds,
        objectIds: input.source.objectIds,
      }),
    );
}

export function validateWorkPackageAuthority(input: WorkPackageGenerationInput): WorkPackageAuthorityValidation {
  const blockers = identifyWorkPackageBlockers(input);
  const missingRequirementIds = blockerRequirementIds(blockers);
  const diagnostics = [
    diagnostic("WORK_PACKAGE_VALIDATED", blockers.length ? "WARNING" : "INFO", "Work Package authority validation completed.", {
      valid: blockers.length === 0,
      blockerCount: blockers.length,
    }),
    ...blockerDiagnostics(blockers),
  ];

  return {
    valid: blockers.length === 0,
    blockers,
    satisfiedRequirementIds: WORK_PACKAGE_GENERATION_REQUIREMENTS.map((requirement) => requirement.requirementId).filter(
      (requirementId) => !missingRequirementIds.includes(requirementId),
    ),
    missingRequirementIds,
    diagnostics,
  };
}

export function createWorkPackageAudit(
  input: WorkPackageGenerationInput,
  workPackages: readonly WorkPackage[],
  blockers: readonly WorkPackageGenerationBlocker[] = identifyWorkPackageBlockers(input),
  diagnostics: readonly WorkPackageDiagnostic[] = [],
): WorkPackageAudit {
  const audit = {
    auditId: `WORK-PACKAGE-AUDIT-${input.scopeVersionId ?? "UNKNOWN"}-${Date.now()}`,
    scopeVersionId: input.scopeVersionId ?? "",
    customerId: input.customerId ?? "",
    opportunityId: input.opportunityId ?? "",
    corridorId: input.corridorId ?? "",
    generatedPackageIds: workPackages.map((workPackage) => workPackage.workPackageId),
    rejectedPackageIds: [],
    blockerIds: blockers.map((blocker) => blocker.blockerId),
    actor: {
      actorId: input.actorId,
      actorRole: input.actorRole,
    },
    createdAt: nowIso(),
    diagnostics: [
      ...diagnostics,
      diagnostic("WORK_PACKAGE_AUDIT_CREATED", "INFO", "Work Package audit created.", {
        packageCount: workPackages.length,
        blockerCount: blockers.length,
      }),
    ],
  } satisfies WorkPackageAudit;

  console.info("[WORK_PACKAGE_AUDIT_CREATED]", {
    auditId: audit.auditId,
    scopeVersionId: audit.scopeVersionId,
    packageCount: audit.generatedPackageIds.length,
    blockerCount: audit.blockerIds.length,
  });

  return audit;
}

export function identifyWorkPackageBlockers(input: WorkPackageGenerationInput): WorkPackageGenerationBlocker[] {
  const blockers: WorkPackageGenerationBlocker[] = [];

  for (const requirement of WORK_PACKAGE_GENERATION_REQUIREMENTS) {
    if (!isRequirementSatisfied(input, requirement)) {
      blockers.push(createRequirementBlocker(input, requirement));
    }
  }

  if (input.riskContext?.unresolvedAuthorityRisks?.length) {
    blockers.push(createRuntimeBlocker(input, "UNRESOLVED_AUTHORITY_RISK", "CRITICAL", "Unresolved authority risks prevent Work Package generation."));
  }

  if (input.riskContext?.aiAdvisoryOnlyRecommendation) {
    blockers.push(createRuntimeBlocker(input, "AI_ADVISORY_ONLY_RECOMMENDATION", "CRITICAL", "AI advisory output cannot generate Work Packages."));
  }

  const deduped = dedupeBlockers(blockers);
  for (const blocker of deduped) {
    console.info("[WORK_PACKAGE_BLOCKER_IDENTIFIED]", {
      scopeVersionId: input.scopeVersionId,
      code: blocker.code,
      severity: blocker.severity,
    });
  }

  return deduped;
}

function createWorkPackage(
  input: WorkPackageGenerationInput,
  options: {
    type: WorkPackageType;
    suffix: string;
    name: string;
    description: string;
    stationIds: string[];
    segmentIds: string[];
    objectIds: string[];
  },
): WorkPackage {
  const workPackageId = `WP-${input.scopeVersionId ?? "UNKNOWN"}-${options.suffix}`;
  const allocation = createAllocation(input, options.stationIds, options.segmentIds, options.objectIds);
  const workPackage = {
    workPackageId,
    workPackageType: options.type,
    status: "PLANNED",
    scopeVersionId: input.scopeVersionId ?? "",
    customerId: input.customerId ?? "",
    opportunityId: input.opportunityId ?? "",
    corridorId: input.corridorId ?? "",
    name: options.name,
    description: options.description,
    allocation,
    dependencies: createDependencies(workPackageId, input),
    authorityReferences: {
      controlActivationId: input.controlActivationId,
      controlCloseId: input.controlCloseId,
      lifecycleState: "CONTROL_ACTIVE",
    },
    createdAt: nowIso(),
    diagnostics: [
      diagnostic("WORK_PACKAGE_GENERATED", "INFO", `${options.name} generated.`, {
        workPackageId,
        workPackageType: options.type,
      }),
    ],
  } satisfies WorkPackage;

  console.info("[WORK_PACKAGE_GENERATED]", {
    workPackageId,
    workPackageType: options.type,
    scopeVersionId: workPackage.scopeVersionId,
  });

  return workPackage;
}

function createAllocation(
  input: WorkPackageGenerationInput,
  stationIds: string[],
  segmentIds: string[],
  objectIds: string[],
): WorkPackageAllocation {
  return {
    scopeVersionId: input.scopeVersionId ?? "",
    customerId: input.customerId ?? "",
    opportunityId: input.opportunityId ?? "",
    corridorId: input.corridorId ?? "",
    stationIds,
    segmentIds,
    objectIds,
    vendorIds: input.source.vendorIds,
    budgetReferences: [input.approvedPackages.budgetReference].filter((reference): reference is string => Boolean(reference)),
    quantityReferences: input.source.quantityReferences,
    dependencyReferences: [
      input.approvedPackages.objectPackageReference,
      input.approvedPackages.stationPackageReference,
      input.approvedPackages.segmentPackageReference,
      input.approvedPackages.executionStrategyReference,
      input.approvedPackages.referenceArchitecture,
      input.approvedPackages.designStandardsReference,
      input.approvedPackages.vendorAllocationReferences?.join(","),
    ].filter((reference): reference is string => Boolean(reference)),
  };
}

function createDependencies(workPackageId: string, input: WorkPackageGenerationInput): WorkPackageDependency[] {
  const dependencies: WorkPackageDependency[] = [];
  if (input.approvedPackages.designStandardsReference) {
    dependencies.push({
      dependencyId: `${workPackageId}-ENGINEERING`,
      dependencyType: "ENGINEERING",
      sourceWorkPackageId: input.approvedPackages.designStandardsReference,
      targetWorkPackageId: workPackageId,
      description: "Requires approved design standards.",
      blocking: true,
    });
  }
  if (input.approvedPackages.vendorAllocationReferences?.length) {
    dependencies.push({
      dependencyId: `${workPackageId}-VENDOR`,
      dependencyType: "VENDOR",
      sourceWorkPackageId: input.approvedPackages.vendorAllocationReferences.join(","),
      targetWorkPackageId: workPackageId,
      description: "Requires approved vendor allocation references.",
      blocking: true,
    });
  }
  return dependencies;
}

function shouldGenerate(input: WorkPackageGenerationInput, type: WorkPackageType) {
  return !input.requestedPackageTypes?.length || input.requestedPackageTypes.includes(type);
}

function disciplineWorkPackageType(discipline: string): WorkPackageType | undefined {
  const key = discipline.trim().toUpperCase();
  const map: Record<string, WorkPackageType> = {
    MATERIAL: "MATERIAL_WORK_PACKAGE",
    CONSTRUCTION: "CONSTRUCTION_WORK_PACKAGE",
    ENGINEERING: "ENGINEERING_WORK_PACKAGE",
    POWER: "POWER_WORK_PACKAGE",
    FACILITY: "FACILITY_WORK_PACKAGE",
    TRANSPORT: "TRANSPORT_WORK_PACKAGE",
    GPU: "GPU_WORK_PACKAGE",
    DATA_CENTER: "DATA_CENTER_WORK_PACKAGE",
    COMPOSITE: "COMPOSITE_WORK_PACKAGE",
  };
  return map[key] ?? "DISCIPLINE_WORK_PACKAGE";
}

function titleFromWorkPackageType(type: WorkPackageType) {
  return type
    .replace("_WORK_PACKAGE", "")
    .split("_")
    .map((part) => `${part.slice(0, 1)}${part.slice(1).toLowerCase()}`)
    .join(" ");
}

function isRequirementSatisfied(input: WorkPackageGenerationInput, requirement: WorkPackageGenerationRequirement): boolean {
  switch (requirement.blockerCode) {
    case "MISSING_SCOPEVERSION_ID":
      return Boolean(input.scopeVersionId);
    case "MISSING_CUSTOMER_ID":
      return Boolean(input.customerId);
    case "MISSING_OPPORTUNITY_ID":
      return Boolean(input.opportunityId);
    case "MISSING_CORRIDOR_ID":
      return Boolean(input.corridorId);
    case "CONTROL_ACTIVE_REQUIRED":
      return input.lifecycleState === "CONTROL_ACTIVE";
    case "MISSING_OBJECT_PACKAGE":
      return Boolean(input.approvedPackages.objectPackageReference);
    case "MISSING_STATION_PACKAGE":
      return Boolean(input.approvedPackages.stationPackageReference);
    case "MISSING_SEGMENT_PACKAGE":
      return Boolean(input.approvedPackages.segmentPackageReference);
    case "MISSING_BUDGET":
      return Boolean(input.approvedPackages.budgetReference);
    case "MISSING_EXECUTION_STRATEGY":
      return Boolean(input.approvedPackages.executionStrategyReference);
    case "MISSING_DESIGN_STANDARDS":
      return Boolean(input.approvedPackages.designStandardsReference);
    case "MISSING_REFERENCE_ARCHITECTURE":
      return Boolean(input.approvedPackages.referenceArchitecture);
    case "MISSING_VENDOR_ALLOCATIONS":
      return Boolean(input.approvedPackages.vendorAllocationReferences?.length);
    default:
      return true;
  }
}

function createRequirementBlocker(
  input: WorkPackageGenerationInput,
  requirement: WorkPackageGenerationRequirement,
): WorkPackageGenerationBlocker {
  return {
    blockerId: `WP-BLOCKER-${input.scopeVersionId ?? "UNKNOWN"}-${requirement.blockerCode}`,
    code: requirement.blockerCode,
    severity: requirement.severity,
    message: requirement.description,
    requirementId: requirement.requirementId,
    resolved: false,
  };
}

function createRuntimeBlocker(
  input: WorkPackageGenerationInput,
  code: WorkPackageBlockerCode,
  severity: WorkPackageBlockerSeverity,
  message: string,
): WorkPackageGenerationBlocker {
  return {
    blockerId: `WP-BLOCKER-${input.scopeVersionId ?? "UNKNOWN"}-${code}`,
    code,
    severity,
    message,
    resolved: false,
  };
}

function blockerDiagnostics(blockers: readonly WorkPackageGenerationBlocker[]): WorkPackageDiagnostic[] {
  return blockers.map((blocker) =>
    diagnostic("WORK_PACKAGE_BLOCKER_IDENTIFIED", blocker.severity === "CRITICAL" || blocker.severity === "HIGH" ? "ERROR" : "WARNING", blocker.message, {
      blockerId: blocker.blockerId,
      code: blocker.code,
      severity: blocker.severity,
    }),
  );
}

function blockerRequirementIds(blockers: readonly WorkPackageGenerationBlocker[]): string[] {
  return [...new Set(blockers.map((blocker) => blocker.requirementId).filter((requirementId): requirementId is string => Boolean(requirementId)))];
}

function dedupeBlockers(blockers: readonly WorkPackageGenerationBlocker[]): WorkPackageGenerationBlocker[] {
  const seen = new Set<string>();
  return blockers.filter((blocker) => {
    const key = `${blocker.code}:${blocker.requirementId ?? ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
