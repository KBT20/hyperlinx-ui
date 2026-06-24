import type { WorkPackage } from "../../control/WorkPackage";
import type { WorkPackageGenerationInput } from "../../control/WorkPackageGeneration";
import { generateWorkPackages } from "../../control/WorkPackageGenerationEngine";
import type { ScopeVersionCloseActorRole } from "../../scopeversion/ScopeVersionCloseAuthority";
import type { FieldClosureEvidence, FieldClosureInput, FieldClosureType } from "../FieldClosureEvent";
import {
  evaluateFieldClosure,
  getAllowedFieldClosureTypes,
  validateFieldClosure,
} from "../FieldClosureAuthorityEngine";

const trace = {
  customerId: "CUSTOMER-HYPERSCALER-001",
  opportunityId: "OPP-FIELD-CLOSURE-001",
  corridorId: "CORRIDOR-DALLAS-KANSAS-CITY",
};

function workPackageInput(scopeVersionId: string, overrides: Partial<WorkPackageGenerationInput> = {}): WorkPackageGenerationInput {
  return {
    ...trace,
    scopeVersionId,
    lifecycleState: "CONTROL_ACTIVE",
    controlActivationId: `CONTROL-ACTIVATION-${scopeVersionId}`,
    controlCloseId: `CONTROL-CLOSE-${scopeVersionId}`,
    actorId: "ops-001",
    actorRole: "TERALINX_OPERATIONS",
    approvedPackages: {
      objectPackageReference: `OBJECT-PACKAGE-${scopeVersionId}`,
      stationPackageReference: `STATION-PACKAGE-${scopeVersionId}`,
      segmentPackageReference: `SEGMENT-PACKAGE-${scopeVersionId}`,
      budgetReference: `BUDGET-${scopeVersionId}`,
      executionStrategyReference: `EXECUTION-STRATEGY-${scopeVersionId}`,
      designStandardsReference: `DESIGN-STANDARDS-${scopeVersionId}`,
      referenceArchitecture: `REFERENCE-ARCHITECTURE-${scopeVersionId}`,
      vendorAllocationReferences: [`VENDOR-ALLOCATION-${scopeVersionId}`],
    },
    source: {
      stationIds: ["STA-0000", "STA-0100", "STA-0200"],
      segmentIds: ["SEG-001", "SEG-002"],
      objectIds: ["OBJ-HANDHOLE-001", "OBJ-CONDUIT-001", "OBJ-FIBER-001"],
      vendorIds: ["VENDOR-CONSTRUCTION-001"],
      productIds: ["PRODUCT-DARK-FIBER"],
      disciplines: ["CONSTRUCTION", "MATERIAL", "POWER", "GPU", "DATA_CENTER"],
      quantityReferences: [`QUANTITY-${scopeVersionId}`],
    },
    ...overrides,
  };
}

function firstWorkPackage(scopeVersionId: string, overrides: Partial<WorkPackageGenerationInput> = {}): WorkPackage {
  const result = generateWorkPackages(workPackageInput(scopeVersionId, overrides));
  const workPackage = result.workPackages[0];
  if (!workPackage) throw new Error(`No Work Package generated for ${scopeVersionId}`);
  return workPackage;
}

function evidence(id: string): FieldClosureEvidence[] {
  return [
    {
      evidenceId: `${id}-PHOTO`,
      evidenceType: "PHOTO",
      source: "FieldClosureFixture",
      capturedAt: "2026-06-24T00:00:00.000Z",
      immutable: true,
    },
    {
      evidenceId: `${id}-CREW`,
      evidenceType: "CREW_ATTESTATION",
      source: "FieldClosureFixture",
      capturedAt: "2026-06-24T00:00:00.000Z",
      immutable: true,
    },
  ];
}

function closureInput(
  scopeVersionId: string,
  fieldClosureType: FieldClosureType,
  overrides: Partial<FieldClosureInput> = {},
): FieldClosureInput {
  const workPackage = firstWorkPackage(scopeVersionId);
  return {
    ...trace,
    fieldClosureId: `FIELD-CLOSURE-${scopeVersionId}-${fieldClosureType}`,
    fieldClosureType,
    scopeVersionId,
    lifecycleState: "FIELD_ACTIVE",
    workPackage,
    actorId: "field-001",
    actorRole: "FIELD_OPERATOR" as ScopeVersionCloseActorRole,
    objectIds: workPackage.allocation.objectIds,
    stationIds: workPackage.allocation.stationIds,
    segmentIds: workPackage.allocation.segmentIds,
    disciplineIds: ["CONSTRUCTION"],
    completionReferences: [`COMPLETION-${scopeVersionId}`],
    evidence: evidence(scopeVersionId),
    timestamp: "2026-06-24T00:00:00.000Z",
    ...overrides,
  };
}

export const fieldClosureInputFixtures: readonly FieldClosureInput[] = Object.freeze([
  closureInput("SV-FIELD-CLOSE-LONGHAUL", "SEGMENT_CLOSE"),
  closureInput("SV-FIELD-CLOSE-METRO", "STATION_CLOSE", {
    opportunityId: "OPP-METRO-FIELD-CLOSE",
    corridorId: "CORRIDOR-METRO-001",
  }),
  closureInput("SV-FIELD-CLOSE-AI-POWER", "POWER_CLOSE", {
    opportunityId: "OPP-AI-POWER-CLOSE",
    corridorId: "CORRIDOR-AI-WEST-TEXAS",
    objectIds: ["OBJ-SUBSTATION-001", "OBJ-POWER-FEED-001"],
  }),
  closureInput("SV-FIELD-CLOSE-GPU", "GPU_CLOSE", {
    objectIds: ["OBJ-GPU-FACILITY-001"],
  }),
  closureInput("SV-FIELD-CLOSE-DATA-CENTER", "DATA_CENTER_CLOSE", {
    objectIds: ["OBJ-DATA-CENTER-001"],
  }),
  closureInput("SV-FIELD-CLOSE-COMPOSITE", "COMPOSITE_CLOSE"),
  closureInput("SV-FIELD-CLOSE-MISSING-WP", "WORK_PACKAGE_CLOSE", {
    workPackage: undefined,
  }),
  closureInput("SV-FIELD-CLOSE-MISSING-SCOPE", "OBJECT_CLOSE", {
    scopeVersionId: undefined,
  }),
  closureInput("SV-FIELD-CLOSE-MISSING-EVIDENCE", "OBJECT_CLOSE", {
    evidence: [],
  }),
  closureInput("SV-FIELD-CLOSE-VALIDATED", "OBJECT_CLOSE"),
]);

export const fieldClosureValidationFixtures = Object.freeze(
  fieldClosureInputFixtures.map(validateFieldClosure),
);

export const fieldClosureResultFixtures = Object.freeze(
  fieldClosureInputFixtures.map(evaluateFieldClosure),
);

export function evaluateFieldClosureFixtures() {
  return {
    allowedTypes: getAllowedFieldClosureTypes(),
    fixtureCount: fieldClosureResultFixtures.length,
    validatedCount: fieldClosureResultFixtures.filter((result) => result.status === "VALIDATED").length,
    rejectedCount: fieldClosureResultFixtures.filter((result) => result.status === "REJECTED").length,
    closeIds: fieldClosureResultFixtures.map((result) => result.scopeVersionClose?.closeId).filter(Boolean),
    blockers: fieldClosureResultFixtures.flatMap((result) =>
      result.validation.blockers.map((blocker) => ({
        fieldClosureId: result.fieldClosureId,
        code: blocker.code,
        severity: blocker.severity,
      })),
    ),
  };
}
