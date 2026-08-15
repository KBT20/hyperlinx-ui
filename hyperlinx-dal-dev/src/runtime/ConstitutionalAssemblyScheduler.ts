import type { DraftIofPackageRuntime } from "../api/teralinxRuntime";
import type { IOFPackageAssemblyInput } from "../commercial/IOFPackageAssemblyEngine";
import { assembleDraftIofPackage } from "../commercial/IOFPackageAssemblyEngine";
import type { ProductDoctrineAssembly } from "../products/ProductDoctrineContracts";
import {
  assemblePointToPointLongHaulDoctrine,
  type PointToPointLongHaulDoctrineInput,
} from "../products/pointToPointLongHaulDoctrine";
import type { EngineeringCertificationProjection } from "../engineering/EngineeringCertificationProjection";
import { buildEngineeringCertificationProjection } from "../engineering/EngineeringCertificationProjection";
import { ConstitutionalRuntimeKernel } from "./ConstitutionalRuntimeKernel";
import type { RuntimeArtifactRecord } from "./RuntimeContracts";
import { markRuntimeDiagnostic, measureRuntime } from "./RuntimeDiagnostics";
import { measureCommercialMutationChild, recordCommercialMutationOperation } from "../performance/CommercialMutationRuntime";
import { constitutionalInputHash } from "./ConstitutionalProjectionCache";

export type ConstitutionalEngineOwnership = {
  engineId: string;
  owner: string;
  inputs: string[];
  outputs: string[];
  consumers: string[];
  trigger: string;
  cacheability: "CACHEABLE" | "REFERENCE_ONLY";
  mutability: "IMMUTABLE_ARTIFACT" | "READ_ONLY_PROJECTION";
  runtimeCost: "LOW" | "MEDIUM" | "HIGH";
};

export const CONSTITUTIONAL_ENGINE_OWNERSHIP: ConstitutionalEngineOwnership[] = [
  {
    engineId: "PD001_PRODUCT_DOCTRINE",
    owner: "Commercial Planning",
    inputs: ["product", "route geometry", "pricing summary", "doctrine version"],
    outputs: ["Product Doctrine Assembly"],
    consumers: ["Draft IOF Package", "Engineering Certification"],
    trigger: "Product, route, pricing, or doctrine version changes",
    cacheability: "CACHEABLE",
    mutability: "IMMUTABLE_ARTIFACT",
    runtimeCost: "HIGH",
  },
  {
    engineId: "DRAFT_IOF_PACKAGE_ASSEMBLY",
    owner: "Commercial Planning",
    inputs: ["approved proposal", "commercial draft", "pricing", "doctrine assembly"],
    outputs: ["Draft IOF Package"],
    consumers: ["Engineering Certification"],
    trigger: "Commercial audit, product, route, pricing, or customer approval changes",
    cacheability: "CACHEABLE",
    mutability: "IMMUTABLE_ARTIFACT",
    runtimeCost: "HIGH",
  },
  {
    engineId: "ENGINEERING_CERTIFICATION_PROJECTION",
    owner: "Engineering Certification",
    inputs: ["Draft IOF Package"],
    outputs: ["Engineering Projection", "Map Spec"],
    consumers: ["Engineering Certification Workspace", "MapKernel"],
    trigger: "Draft IOF Package revision changes",
    cacheability: "CACHEABLE",
    mutability: "READ_ONLY_PROJECTION",
    runtimeCost: "MEDIUM",
  },
  {
    engineId: "MAP_LAYER_PROJECTION",
    owner: "MapKernel",
    inputs: ["render spec", "layer visibility", "style profile", "viewport"],
    outputs: ["visible primitives", "metrics", "authority audit"],
    consumers: ["Commercial", "Engineering", "ScopeVersion", "Twin", "Operational Intelligence"],
    trigger: "source revision, layer visibility, or viewport changes",
    cacheability: "CACHEABLE",
    mutability: "READ_ONLY_PROJECTION",
    runtimeCost: "MEDIUM",
  },
];

export function scheduleProductDoctrineAssembly<T extends ProductDoctrineAssembly | null>(
  artifactId: string,
  input: unknown,
  create: () => T,
): T {
  const record = measureCommercialMutationChild("product-doctrine-cache-lookup-fingerprint-or-assembly", () => ConstitutionalRuntimeKernel.requestArtifact({
    artifactId,
    artifactType: "ProductDoctrine",
    input,
    doctrineVersions: [String((input as Record<string, unknown>)?.["doctrineVersion"] ?? "PD-001")],
    dependencies: ["Product", "Route", "Pricing"],
    producer: "ConstitutionalAssemblyScheduler.scheduleProductDoctrineAssembly",
    dependencyClass: "PRODUCT_DOCTRINE",
    create: () => {
      recordCommercialMutationOperation("doctrineEvaluations");
      return measureRuntime("ProductDoctrineAssembly", "assemblyExecutions", create);
    },
  }));
  return record.value;
}

export function schedulePointToPointLongHaulDoctrineAssembly(
  artifactId: string,
  input: PointToPointLongHaulDoctrineInput,
) {
  const authoritativeRoute = input.authoritativeRoute ?? input.osrmRoute;
  return scheduleProductDoctrineAssembly(
    artifactId,
    {
      productId: "POINT_TO_POINT_LONG_HAUL_DUCT_DARK_FIBER",
      doctrineVersion: "PD-001",
      accountId: input.accountId,
      customerId: input.customerId,
      routeId: authoritativeRoute?.routeId,
      routeFeet: authoritativeRoute?.routeFeet,
      routeRevision: authoritativeRoute?.routeRevision,
      routeHash: authoritativeRoute?.routeHash,
      routeAuthority: authoritativeRoute?.routeAuthority,
      geometry: authoritativeRoute?.geometry,
      aSite: input.aSite,
      zSite: input.zSite,
      routeSegments: (input.routeSegments ?? []).map((segment) => ({
        segmentId: segment.segmentId,
        label: segment.label,
        fromMile: segment.fromMile,
        toMile: segment.toMile,
        routeMiles: segment.routeMiles,
      })),
      stationIntervalFeet: input.stationIntervalFeet,
      projectConfiguration: input.projectConfiguration,
      conduitCount: input.conduitCount,
      conduitSizeInches: input.conduitSizeInches,
      fiberCount: input.fiberCount,
    },
    () => assemblePointToPointLongHaulDoctrine(input),
  );
}

function financialProjection(input: IOFPackageAssemblyInput) {
  return {
    proposalId: input.proposal.proposalId,
    pricing: input.pricing ?? input.proposal.pricingSummary ?? input.commercialDraft?.transparentEstimate ?? input.quickQuote,
    pricingSummary: input.pricing ?? input.proposal.pricingSummary,
    marginSummary: input.proposal.marginSummary,
    commercialAssumptionIds: input.proposal.commercialAssumptionIds,
    generatedAt: input.generatedAt,
  };
}

function structuralReference(value: unknown) {
  if (!value || typeof value !== "object") return value;
  const record = value as Record<string, unknown>;
  return {
    id: record.stationId ?? record.segmentId ?? record.objectId ?? record.networkId ?? record.id,
    type: record.objectType ?? record.networkType ?? record.type,
    revision: record.authorityRevision ?? record.revision ?? record.version,
    fromMile: record.fromMile,
    toMile: record.toMile,
    routeMiles: record.routeMiles,
    geometryHash: record.geometryHash,
    lifecycleState: record.lifecycleState,
  };
}

export function draftIofStructuralProjectionInput(input: IOFPackageAssemblyInput) {
  const structuralSegments = (input.commercialDraft?.routeSegments ?? []).map((segment) => ({
    segmentId: segment.segmentId,
    label: segment.label,
    fromMile: segment.fromMile,
    toMile: segment.toMile,
    routeMiles: segment.routeMiles,
  }));
  return {
    proposal: {
      proposalId: input.proposal.proposalId,
      customerId: input.proposal.customerId,
      opportunityId: input.proposal.opportunityId,
      productId: input.proposal.productId,
      productName: input.proposal.productName,
      runtimeObjectIds: input.proposal.runtimeObjectIds,
      runtimeRelationshipIds: input.proposal.runtimeRelationshipIds,
      runtimeEvidenceIds: input.proposal.runtimeEvidenceIds,
    },
    accountId: input.accountId,
    customerName: input.customerName,
    routeId: input.commercialDraft?.routeId ?? input.quickQuote?.candidateId,
    routeFeet: input.commercialDraft?.routeFeet ?? ((input.quickQuote?.routeMiles ?? 0) * 5280),
    routeGeometryHash: input.routeGeometryHash ?? constitutionalInputHash(input.commercialDraft?.geometry ?? input.quickQuote?.geometry ?? []),
    routeSegments: structuralSegments,
    productDoctrineId: input.productDoctrine?.doctrineId,
    productDoctrineVersion: input.productDoctrine?.doctrineVersion,
    productDoctrineAssemblyId: input.productDoctrineAssembly?.doctrineId,
    stationAuthorityRevision: input.stationAuthorityRevision ?? constitutionalInputHash((input.stationing ?? []).map(structuralReference)),
    objectInventoryAuthorityRevision: input.objectInventoryAuthorityRevision ?? constitutionalInputHash((input.objectInventory ?? []).map(structuralReference)),
    geometryReferences: input.geometryReferences,
    customerTwinReference: input.customerTwinReference,
  };
}

export function draftIofStructuralFingerprint(input: IOFPackageAssemblyInput) {
  return constitutionalInputHash(draftIofStructuralProjectionInput(input));
}

export function diffDraftIofStructuralInputs(before: IOFPackageAssemblyInput, after: IOFPackageAssemblyInput) {
  const left = draftIofStructuralProjectionInput(before) as Record<string, unknown>;
  const right = draftIofStructuralProjectionInput(after) as Record<string, unknown>;
  return [...new Set([...Object.keys(left), ...Object.keys(right)])]
    .filter((field) => constitutionalInputHash(left[field]) !== constitutionalInputHash(right[field]))
    .map((field) => ({ field, before: left[field], after: right[field] }));
}

export function scheduleDraftIofPackageAssembly(input: IOFPackageAssemblyInput): RuntimeArtifactRecord<DraftIofPackageRuntime> {
  const proposalId = input.proposal.proposalId;
  const productDoctrineArtifactId = String(input.productDoctrineAssembly?.doctrineId ?? input.productDoctrine?.doctrineId ?? "PRODUCT-DOCTRINE");
  const structural = measureCommercialMutationChild("draft-iof-structural-cache-lookup-fingerprint-or-assembly", () => ConstitutionalRuntimeKernel.requestArtifact({
    artifactId: `DRAFT-IOF-STRUCTURAL-${proposalId}`,
    artifactType: "DraftIofStructuralProjection",
    input: draftIofStructuralProjectionInput(input),
    doctrineVersions: [
      String(input.productDoctrine?.doctrineVersion ?? input.productDoctrineAssembly?.productDoctrineVersion ?? "PD-001"),
      String(input.productDoctrineAssembly?.doctrineId ?? input.productDoctrine?.doctrineId ?? "DOCTRINE"),
    ],
    producedFrom: [
      {
        artifactType: "ProductDoctrine",
        artifactId: productDoctrineArtifactId,
      },
    ],
    dependencies: ["ProductDoctrine", "CommercialAuditProjection", "ConstitutionalAssembly"],
    producer: "ConstitutionalAssemblyScheduler.scheduleDraftIofStructuralProjection",
    dependencyClass: "DRAFT_IOF",
    create: () => {
      recordCommercialMutationOperation("structuralIofAssemblies");
      return measureCommercialMutationChild("draft-iof-structural-assembly", () => measureRuntime("DraftIofStructuralAssembly", "assemblyExecutions", () => assembleDraftIofPackage(input)));
    },
  }));
  const financial = measureCommercialMutationChild("commercial-financial-cache-lookup-fingerprint-or-projection", () => ConstitutionalRuntimeKernel.requestArtifact({
    artifactId: `COMMERCIAL-FINANCIAL-${proposalId}`,
    artifactType: "CommercialFinancialProjection",
    input: financialProjection(input),
    dependencies: ["ESTIMATE", "COMMERCIAL_FINANCIALS", "PROPOSAL"],
    producer: "ConstitutionalAssemblyScheduler.scheduleCommercialFinancialProjection",
    dependencyClass: "COMMERCIAL_FINANCIALS",
    create: () => {
      recordCommercialMutationOperation("financialProjections");
      return financialProjection(input);
    },
  }));
  const value = {
    ...structural.value,
    pricing: financial.value.pricing,
    pricingSummary: financial.value.pricingSummary,
    commercialSummary: {
      ...((structural.value.commercialSummary as Record<string, unknown> | undefined) ?? {}),
      pricingSummary: financial.value.pricing,
      marginSummary: financial.value.marginSummary,
      commercialAssumptionIds: financial.value.commercialAssumptionIds,
    },
  } as DraftIofPackageRuntime;
  return {
    ...structural,
    artifactId: `DRAFT-IOF-${proposalId}`,
    artifactType: "DraftIofPackage",
    cacheStatus: structural.cacheStatus === "HIT" && financial.cacheStatus === "HIT" ? "HIT" : "MISS",
    generationDurationMs: structural.generationDurationMs + financial.generationDurationMs,
    value,
  };
}

function arrayFromDraft<T = Record<string, unknown>>(draft: DraftIofPackageRuntime, key: string): T[] {
  const value = draft[key];
  return Array.isArray(value) ? value as T[] : [];
}

export function scheduleEngineeringProjection(draft: DraftIofPackageRuntime): EngineeringCertificationProjection {
  const certifiedIofUnits = arrayFromDraft<{ unitId?: string }>(draft, "certifiedIofUnits");
  const proposedIofUnits = arrayFromDraft<{ unitId?: string; status?: string; updatedAt?: string }>(draft, "proposedIofUnits");
  const engineeringConstraints = arrayFromDraft(draft, "engineeringConstraints");
  const doctrineExceptions = arrayFromDraft(draft, "doctrineExceptions");
  const record = ConstitutionalRuntimeKernel.requestArtifact({
    artifactId: `ENGINEERING-PROJECTION-${draft.packageId}`,
    artifactType: "EngineeringProjection",
    input: {
      packageId: draft.packageId,
      packageRevision: draft.packageRevision,
      updatedAt: draft.updatedAt,
      status: draft.status,
      validation: draft.validation,
      readiness: draft.packageReadiness,
      geometryCoordinateCount: (draft as Record<string, unknown>).geometryCoordinateCount,
      certifiedIofUnitIds: certifiedIofUnits.map((unit) => unit.unitId),
      proposedIofUnitIds: proposedIofUnits.map((unit) => `${unit.unitId}:${unit.status}:${unit.updatedAt ?? ""}`),
      constraintState: engineeringConstraints.map((constraint) => ({
        constraintId: String((constraint as Record<string, unknown>).constraintId ?? (constraint as Record<string, unknown>).id ?? ""),
        status: String((constraint as Record<string, unknown>).status ?? "OPEN"),
        disposition: String((constraint as Record<string, unknown>).engineeringDisposition ?? (constraint as Record<string, unknown>).disposition ?? ""),
        station: String((constraint as Record<string, unknown>).station ?? (constraint as Record<string, unknown>).stationId ?? ""),
        objectReference: String((constraint as Record<string, unknown>).objectReference ?? (constraint as Record<string, unknown>).objectId ?? ""),
        updatedAt: String((constraint as Record<string, unknown>).updatedAt ?? ""),
      })),
      exceptionCount: doctrineExceptions.length,
    },
    doctrineVersions: [
      String((draft as Record<string, unknown>).productDoctrineVersion ?? "PD-001"),
      String((draft as Record<string, unknown>).pd002aVersion ?? "PD-002A"),
      String((draft as Record<string, unknown>).pd003Version ?? "PD-003"),
    ],
    producedFrom: [
      {
        artifactType: "DraftIofPackage",
        artifactId: draft.packageId,
        revision: draft.packageRevision ?? 1,
      },
      {
        artifactType: "KernelExecutionGraph",
        artifactId: String((draft as Record<string, unknown>).kernelExecutionGraphId ?? `${draft.packageId}:KEG`),
      },
    ],
    dependencies: ["DraftIofPackage", "PD002AAddressProjection", "SpineObjectInstantiation", "KernelExecutionGraph"],
    producer: "ConstitutionalAssemblyScheduler.scheduleEngineeringProjection",
    dependencyClass: "ENGINEERING",
    create: () => {
      recordCommercialMutationOperation("engineeringProjections");
      markRuntimeDiagnostic("projectionExecutions");
      return measureRuntime("EngineeringProjection", "engineeringProjectionExecutions", () => buildEngineeringCertificationProjection(draft));
    },
  });
  return record.value;
}
