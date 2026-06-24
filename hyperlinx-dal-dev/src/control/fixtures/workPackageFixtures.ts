import type { ScopeVersionState } from "../../scopeversion/ScopeVersionLifecycle";
import type { WorkPackageGenerationInput } from "../WorkPackageGeneration";
import {
  generateWorkPackages,
  validateWorkPackageAuthority,
} from "../WorkPackageGenerationEngine";

const trace = {
  customerId: "CUSTOMER-HYPERSCALER-001",
  opportunityId: "OPP-WORK-PACKAGE-001",
  corridorId: "CORRIDOR-DALLAS-KANSAS-CITY",
};

function baseInput(
  scopeVersionId: string,
  lifecycleState: ScopeVersionState = "CONTROL_ACTIVE",
  overrides: Partial<WorkPackageGenerationInput> = {},
): WorkPackageGenerationInput {
  return {
    ...trace,
    scopeVersionId,
    lifecycleState,
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
      objectIds: ["OBJ-HANDHOLE-001", "OBJ-CONDUIT-001"],
      vendorIds: ["VENDOR-CONSTRUCTION-001"],
      productIds: ["PRODUCT-DARK-FIBER"],
      disciplines: ["ENGINEERING", "CONSTRUCTION", "MATERIAL"],
      quantityReferences: [`QUANTITY-${scopeVersionId}`],
    },
    ...overrides,
  };
}

export const workPackageGenerationInputFixtures: readonly WorkPackageGenerationInput[] = Object.freeze([
  baseInput("SV-WP-HYPERSCALER-LONGHAUL", "CONTROL_ACTIVE", {
    requestedPackageTypes: ["SEGMENT_WORK_PACKAGE", "ENGINEERING_WORK_PACKAGE", "CONSTRUCTION_WORK_PACKAGE", "MATERIAL_WORK_PACKAGE"],
  }),
  baseInput("SV-WP-METRO-AGGREGATION", "CONTROL_ACTIVE", {
    opportunityId: "OPP-METRO-AGGREGATION-001",
    corridorId: "CORRIDOR-METRO-001",
    source: {
      stationIds: ["LSO-001", "LSO-002", "LSO-003"],
      segmentIds: ["METRO-SEG-001"],
      objectIds: ["OBJ-LSO-001", "OBJ-FIBER-001"],
      vendorIds: ["VENDOR-METRO-001"],
      productIds: ["PRODUCT-METRO-AGGREGATION"],
      disciplines: ["CONSTRUCTION", "ENGINEERING"],
      quantityReferences: ["QUANTITY-METRO-001"],
    },
    requestedPackageTypes: ["STATION_WORK_PACKAGE", "CONSTRUCTION_WORK_PACKAGE", "ENGINEERING_WORK_PACKAGE"],
  }),
  baseInput("SV-WP-AI-CORRIDOR", "CONTROL_ACTIVE", {
    opportunityId: "OPP-AI-CORRIDOR-001",
    corridorId: "CORRIDOR-AI-WEST-TEXAS",
    source: {
      stationIds: ["AI-STA-001", "AI-STA-002"],
      segmentIds: ["AI-SEG-001", "AI-SEG-002"],
      objectIds: ["OBJ-SUBSTATION-001", "OBJ-GPU-001", "OBJ-TRANSPORT-001"],
      vendorIds: ["VENDOR-POWER-001", "VENDOR-GPU-001"],
      productIds: ["PRODUCT-AI-CORRIDOR"],
      disciplines: ["POWER", "GPU", "FACILITY", "TRANSPORT"],
      quantityReferences: ["QUANTITY-AI-001"],
    },
    requestedPackageTypes: ["POWER_WORK_PACKAGE", "GPU_WORK_PACKAGE", "FACILITY_WORK_PACKAGE", "TRANSPORT_WORK_PACKAGE"],
  }),
  baseInput("SV-WP-DATA-CENTER-CAMPUS", "CONTROL_ACTIVE", {
    source: {
      stationIds: ["DC-STA-001"],
      segmentIds: ["DC-SEG-001"],
      objectIds: ["OBJ-DATA-CENTER-001", "OBJ-POWER-FEED-001"],
      vendorIds: ["VENDOR-DATA-CENTER-001"],
      productIds: ["PRODUCT-DATA-CENTER-CAMPUS"],
      disciplines: ["DATA_CENTER", "POWER", "FACILITY"],
      quantityReferences: ["QUANTITY-DC-001"],
    },
    requestedPackageTypes: ["DATA_CENTER_WORK_PACKAGE", "POWER_WORK_PACKAGE", "FACILITY_WORK_PACKAGE"],
  }),
  baseInput("SV-WP-CARRIER-HOTEL-INTERCONNECT", "CONTROL_ACTIVE", {
    source: {
      stationIds: ["CH-STA-001", "CH-STA-002"],
      segmentIds: ["CH-SEG-001"],
      objectIds: ["OBJ-CARRIER-HOTEL-001", "OBJ-TRANSPORT-001"],
      vendorIds: ["VENDOR-TRANSPORT-001"],
      productIds: ["PRODUCT-INTERCONNECT"],
      disciplines: ["TRANSPORT", "ENGINEERING"],
      quantityReferences: ["QUANTITY-CH-001"],
    },
    requestedPackageTypes: ["TRANSPORT_WORK_PACKAGE", "ENGINEERING_WORK_PACKAGE"],
  }),
  baseInput("SV-WP-ENTERPRISE-ACCESS", "CONTROL_ACTIVE", {
    source: {
      stationIds: ["ENT-STA-0000", "ENT-STA-0100"],
      segmentIds: ["ENT-SEG-001"],
      objectIds: ["OBJ-NID-001", "OBJ-LATERAL-001"],
      vendorIds: ["VENDOR-ACCESS-001"],
      productIds: ["PRODUCT-ENTERPRISE-ACCESS"],
      disciplines: ["CONSTRUCTION", "MATERIAL"],
      quantityReferences: ["QUANTITY-ENT-001"],
    },
    requestedPackageTypes: ["STATION_WORK_PACKAGE", "CONSTRUCTION_WORK_PACKAGE", "MATERIAL_WORK_PACKAGE"],
  }),
  baseInput("SV-WP-MISSING-CONTROL-ACTIVE", "CONTRACT_EXECUTED"),
  baseInput("SV-WP-MISSING-STATION-PACKAGE", "CONTROL_ACTIVE", {
    approvedPackages: {
      ...baseInput("SV-WP-MISSING-STATION-PACKAGE").approvedPackages,
      stationPackageReference: undefined,
    },
  }),
  baseInput("SV-WP-MISSING-BUDGET", "CONTROL_ACTIVE", {
    approvedPackages: {
      ...baseInput("SV-WP-MISSING-BUDGET").approvedPackages,
      budgetReference: undefined,
    },
  }),
  baseInput("SV-WP-COMPOSITE-APPROVED", "CONTROL_ACTIVE", {
    source: {
      stationIds: ["COMP-STA-001", "COMP-STA-002", "COMP-STA-003"],
      segmentIds: ["COMP-SEG-001", "COMP-SEG-002"],
      objectIds: ["OBJ-COMP-FIBER-001", "OBJ-COMP-POWER-001", "OBJ-COMP-GPU-001"],
      vendorIds: ["VENDOR-COMP-001", "VENDOR-COMP-002"],
      productIds: ["PRODUCT-COMPOSITE-AI"],
      disciplines: ["COMPOSITE"],
      quantityReferences: ["QUANTITY-COMP-001"],
    },
    requestedPackageTypes: ["COMPOSITE_WORK_PACKAGE"],
  }),
]);

export const workPackageAuthorityValidationFixtures = Object.freeze(
  workPackageGenerationInputFixtures.map(validateWorkPackageAuthority),
);

export const workPackageGenerationResultFixtures = Object.freeze(
  workPackageGenerationInputFixtures.map(generateWorkPackages),
);

export function evaluateWorkPackageFixtures() {
  return {
    fixtureCount: workPackageGenerationResultFixtures.length,
    generatedCount: workPackageGenerationResultFixtures.filter((result) => result.status === "GENERATED").length,
    rejectedCount: workPackageGenerationResultFixtures.filter((result) => result.status === "REJECTED").length,
    packageCount: workPackageGenerationResultFixtures.reduce((sum, result) => sum + result.workPackages.length, 0),
    blockers: workPackageGenerationResultFixtures.flatMap((result) =>
      result.blockers.map((blocker) => ({
        scopeVersionId: result.scopeVersionId,
        code: blocker.code,
        severity: blocker.severity,
      })),
    ),
  };
}
