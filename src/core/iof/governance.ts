import type {
  IOFConstraints,
  IOFObject,
  IOFCloseTaxonomy,
  IOFPackage,
  IOFPackageBuilderOptions,
  IOFStateModel,
  IOFStation,
  NetworkRole,
} from "./types";

export function buildDefaultConstraints(role: NetworkRole): IOFConstraints {
  if (role === "metro") {
    return {
      topology: {
        mustBeDiverse: true,
        allowed: ["ring", "dual_route", "mesh"],
        disallowed: ["single_linear"],
      },
      ductPolicy: {
        transportProtected: true,
        distributionIntrusive: true,
        maintenanceReserved: true,
      },
    };
  }

  if (role === "middlemile") {
    return {
      topology: {
        mustConnectMetros: true,
        allowed: ["triangle", "ladder", "dual_route"],
        disallowed: ["single_chain_only"],
      },
      ductPolicy: {
        transportPrimary: true,
        diverseRequired: true,
      },
    };
  }

  if (role === "longhaul") {
    return {
      topology: {
        allowed: ["linear", "dual_route"],
        aggregationLimited: true,
      },
      ductPolicy: {
        transportFocused: true,
        minimalIntrusion: true,
      },
    };
  }

  return {};
}

export function buildDefaultStateModel(): IOFStateModel {
  return {
    version: "v1",
    derivationMode: "closure_only",
    states: [
      { state: "planned", requires: [] },
      { state: "engineering", requires: ["engineering_complete"] },
      { state: "permitting", requires: ["permit_approved"] },
      { state: "construction", requires: ["construction_complete"] },
      { state: "complete", requires: ["asbuilt_verified"] },
    ],
  };
}

export function buildDefaultCloseTaxonomy(): IOFCloseTaxonomy {
  return {
    engineering: ["engineering_complete"],
    permitting: ["permit_approved"],
    duct_system_placement: ["construction_complete"],
    cable_placement: ["cable_pulled"],
    splicing_and_testing: ["splice_test_complete"],
    as_built: ["asbuilt_verified"],
  };
}

export function buildDefaultObjects(params: {
  role: NetworkRole;
  routeFeet: number;
}): IOFObject[] {
  const lifecycle = [
    "engineering",
    "permitting",
    "duct_system_placement",
    "cable_placement",
    "splicing_and_testing",
    "as_built",
  ];

  return lifecycle.map((step) => ({
    objectId: crypto.randomUUID(),
    objectType: step,
    networkRole: params.role,
    unit: "ft",
    quantity: params.routeFeet,
  }));
}

export function createApprovedScopePackage(
  params: IOFPackageBuilderOptions
): IOFPackage {
  return {
    event: params.event ?? "scope.approved",
    corridorId: params.corridorId,
    segmentId: params.segmentId,
    scopeVersionId: params.scopeVersionId,
    canonicalTruth: {
      route: params.route,
      stations: params.stations,
      objects: buildDefaultObjects({
        role: params.role,
        routeFeet: params.routeFeet,
      }),
      constraints: buildDefaultConstraints(params.role),
      closeTaxonomy: buildDefaultCloseTaxonomy(),
      stateModel: buildDefaultStateModel(),
    },
    timestamp: params.timestamp ?? new Date().toISOString(),
    actor: params.actor,
    context: params.context,
    financialContext: params.financialContext,
  };
}

export function validateIOFPackage(pkg: IOFPackage): string[] {
  const errors: string[] = [];

  if (!pkg.corridorId) {
    errors.push("corridorId is required");
  }

  if (!pkg.segmentId) {
    errors.push("segmentId is required");
  }

  if (!pkg.scopeVersionId) {
    errors.push("scopeVersionId is required");
  }

  if (!pkg.canonicalTruth?.route || pkg.canonicalTruth.route.length < 2) {
    errors.push("canonicalTruth.route must contain at least two points");
  }

  if (!pkg.canonicalTruth?.stations || pkg.canonicalTruth.stations.length === 0) {
    errors.push("canonicalTruth.stations must include at least one station");
  }

  if (!pkg.canonicalTruth?.stateModel) {
    errors.push("canonicalTruth.stateModel is required");
  }

  if (!pkg.canonicalTruth?.closeTaxonomy) {
    errors.push("canonicalTruth.closeTaxonomy is required");
  }

  return errors;
}

export function isScopePackageApproved(pkg: IOFPackage): boolean {
  return pkg.event === "scope.approved";
}
