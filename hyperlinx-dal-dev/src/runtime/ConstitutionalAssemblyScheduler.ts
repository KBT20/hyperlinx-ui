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
  const record = ConstitutionalRuntimeKernel.requestArtifact({
    artifactId,
    artifactType: "ProductDoctrine",
    input,
    doctrineVersions: [String((input as Record<string, unknown>)?.["doctrineVersion"] ?? "PD-001")],
    dependencies: ["Product", "Route", "Pricing"],
    producer: "ConstitutionalAssemblyScheduler.scheduleProductDoctrineAssembly",
    create: () => measureRuntime("ProductDoctrineAssembly", "assemblyExecutions", create),
  });
  return record.value;
}

export function schedulePointToPointLongHaulDoctrineAssembly(
  artifactId: string,
  input: PointToPointLongHaulDoctrineInput,
) {
  return scheduleProductDoctrineAssembly(
    artifactId,
    input,
    () => assemblePointToPointLongHaulDoctrine(input),
  );
}

export function scheduleDraftIofPackageAssembly(input: IOFPackageAssemblyInput): RuntimeArtifactRecord<DraftIofPackageRuntime> {
  const proposalId = input.proposal.proposalId;
  const productDoctrineArtifactId = String(input.productDoctrineAssembly?.doctrineId ?? input.productDoctrine?.doctrineId ?? "PRODUCT-DOCTRINE");
  return ConstitutionalRuntimeKernel.requestArtifact({
    artifactId: `DRAFT-IOF-${proposalId}`,
    artifactType: "DraftIofPackage",
    input,
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
    producer: "ConstitutionalAssemblyScheduler.scheduleDraftIofPackageAssembly",
    create: () => measureRuntime("DraftIofPackageAssembly", "assemblyExecutions", () => assembleDraftIofPackage(input)),
  });
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
      constraintCount: engineeringConstraints.length,
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
    create: () => {
      markRuntimeDiagnostic("projectionExecutions");
      return measureRuntime("EngineeringProjection", "engineeringProjectionExecutions", () => buildEngineeringCertificationProjection(draft));
    },
  });
  return record.value;
}
