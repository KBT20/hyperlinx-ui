import { commercialKmzRouteEvidenceAdapter } from "../../commercial/CommercialKmzRouteEvidenceAdapter";
import {
  commercialWorkbookEvidenceAdapter,
  type TenantArtifactScope,
} from "../../commercial/CommercialWorkbookEvidenceAdapter";
import {
  PRODUCT_REGISTRY,
  reconcileQuantity,
  type ProductCloseSequence,
  type ProductDefinition,
  type QuantityReconciliationStatus,
} from "../../products/ProductRegistry";
import {
  assemblePointToPointLongHaulDoctrine,
  POINT_TO_POINT_LONG_HAUL_DOCTRINE_CHANGE_REASON,
  POINT_TO_POINT_LONG_HAUL_DOCTRINE_VERSION,
  POINT_TO_POINT_LONG_HAUL_PREVIOUS_DOCTRINE_VERSION,
  POINT_TO_POINT_LONG_HAUL_PRODUCT_ID,
} from "../../products/pointToPointLongHaulDoctrine";
import { createCommercialSourceWarnings } from "../../engineering/quantity";

export const HELIUM_REFERENCE_ADAPTER_ID = "GOOGLE_STILLWATER_HELIUM_REFERENCE_ADAPTER";

type ReferenceObject = TenantArtifactScope & {
  objectId: string;
  objectClass: string;
  stationStartFeet: number;
  stationEndFeet: number;
  quantity: number;
  quantityUnit: string;
  constructionMethod?: string;
  productDoctrine: string;
  objectDoctrine: string;
  dependencies: string[];
  currentState: string;
  nextLegalStates: string[];
  closeSequence: string[];
  evidenceRequirements: string[];
  paymentEligibility: string;
  authority: string;
  sourceAuthority: "PRODUCT_DOCTRINE_PLUS_PROJECT_EVIDENCE";
  sourceHash: string;
  sourceEvidence: string[];
  engineeringNotes: string[];
  constraintLinks: string[];
  auditState: "READY_FOR_ENGINEERING_REVIEW";
  noScopeVersionCreation: true;
};

export type QuantityReconciliation = {
  normalizedField: string;
  sourceValue?: number;
  doctrineValue?: number;
  status: QuantityReconciliationStatus;
  sourceEvidence: string;
  resolution: string;
};

function numericConduitSize(value: string | undefined) {
  if (!value) return 2;
  const mixed = /^(\d+)\s+(\d+)\/(\d+)/.exec(value);
  if (mixed) return Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3]);
  const fraction = /^(\d+)\/(\d+)/.exec(value);
  if (fraction) return Number(fraction[1]) / Number(fraction[2]);
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 2;
}

function closeSequence(product: ProductDefinition, objectClass: string): ProductCloseSequence | undefined {
  return product.closeSequences.find((sequence) => sequence.objectClass === objectClass)
    ?? (objectClass === "ROUTE_SEGMENT" ? product.closeSequences.find((sequence) => sequence.objectClass === "SPINE") : undefined);
}

function evidenceFor(product: ProductDefinition, objectClass: string) {
  return product.evidenceProfile.rules
    .filter((rule) => rule.requiredFor.some((target) => target === objectClass || target === "STRUCTURES" && ["HANDHOLE", "MANHOLE", "VAULT"].includes(objectClass)))
    .map((rule) => rule.evidenceType);
}

function objectAt(args: {
  scope: TenantArtifactScope;
  product: ProductDefinition;
  objectClass: string;
  index: number;
  count: number;
  routeFeet: number;
  quantity?: number;
  unit?: string;
  dependencies?: string[];
  sourceEvidence: string[];
}): ReferenceObject {
  const sequence = closeSequence(args.product, args.objectClass);
  const stationStartFeet = args.count <= 1 ? 0 : args.routeFeet * args.index / args.count;
  const stationEndFeet = ["SPINE", "ROUTE_SEGMENT", "CONDUIT", "FIBER"].includes(args.objectClass)
    ? args.routeFeet * (args.index + 1) / Math.max(1, args.count)
    : stationStartFeet;
  return {
    ...args.scope,
    objectId: `${args.scope.opportunityId}:${args.objectClass}:${String(args.index + 1).padStart(4, "0")}`,
    objectClass: args.objectClass,
    stationStartFeet,
    stationEndFeet,
    quantity: args.quantity ?? 1,
    quantityUnit: args.unit ?? "each",
    productDoctrine: args.product.doctrineId,
    objectDoctrine: `${args.product.doctrineId}:OBJECT:${args.objectClass}`,
    dependencies: args.dependencies ?? sequence?.dependencies ?? ["SPINE engineered"],
    currentState: sequence?.states[0] ?? "PLANNED",
    nextLegalStates: sequence?.states.slice(1, 2) ?? [],
    closeSequence: sequence?.states ?? [],
    evidenceRequirements: evidenceFor(args.product, args.objectClass),
    paymentEligibility: args.product.paymentPolicy.constitutionalRule,
    authority: "PRODUCT_DOCTRINE_PLUS_PROJECT_EVIDENCE",
    sourceAuthority: "PRODUCT_DOCTRINE_PLUS_PROJECT_EVIDENCE",
    sourceHash: args.sourceEvidence.join(":"),
    sourceEvidence: args.sourceEvidence,
    engineeringNotes: [],
    constraintLinks: [],
    auditState: "READY_FOR_ENGINEERING_REVIEW",
    noScopeVersionCreation: true,
  };
}

function manyObjects(args: Omit<Parameters<typeof objectAt>[0], "index">) {
  return Array.from({ length: Math.max(0, Math.floor(args.count)) }, (_, index) => objectAt({ ...args, index }));
}

export async function assembleHeliumReferencePackage(args: {
  workbook: ArrayBuffer | Uint8Array;
  kmz: ArrayBuffer | Uint8Array;
  scope: Omit<TenantArtifactScope, "productId" | "productVersion" | "doctrineId" | "doctrineVersion">;
  workbookFileName?: string;
  kmzFileName?: string;
  extractedAt?: string;
}) {
  const resolved = PRODUCT_REGISTRY.require(POINT_TO_POINT_LONG_HAUL_PRODUCT_ID);
  const scope: TenantArtifactScope = {
    ...args.scope,
    productId: resolved.definition.productId,
    productVersion: resolved.definition.productVersion,
    doctrineId: resolved.definition.doctrineId,
    doctrineVersion: resolved.definition.doctrineVersion,
  };
  const [workbookEvidence, routeEvidence] = await Promise.all([
    commercialWorkbookEvidenceAdapter.normalize({
      workbook: args.workbook,
      sourceFile: args.workbookFileName ?? "commercial-project-evidence.xlsx",
      scope,
      extractedAt: args.extractedAt,
    }),
    commercialKmzRouteEvidenceAdapter.normalize({
      kmz: args.kmz,
      sourceFile: args.kmzFileName ?? "customer-route-evidence.kmz",
      scope,
      extractedAt: args.extractedAt,
    }),
  ]);

  const doctrineAssembly = assemblePointToPointLongHaulDoctrine({
    accountId: scope.customerId,
    customerId: scope.customerId,
    aSite: null,
    zSite: null,
    osrmRoute: {
      routeId: routeEvidence.measuredCenterlineId,
      source: "CUSTOMER_KMZ",
      routeMiles: routeEvidence.routeMiles,
      routeFeet: routeEvidence.routeFeet,
      distanceMeters: routeEvidence.routeMeters,
      geometry: routeEvidence.geometry,
      routeAuthority: routeEvidence.sourceAuthority,
      routeRevision: routeEvidence.extractedAt,
      routeHash: routeEvidence.sourceHash,
      measurementAuthority: routeEvidence.authorityMode,
    },
    pricingSummary: {
      budgetCost: workbookEvidence.constructionCost,
      sellPriceIru: workbookEvidence.NRC,
      nrcRevenue: workbookEvidence.NRC,
      mrcRevenue: workbookEvidence.MRC,
    },
    conduitCount: workbookEvidence.conduitCount,
    conduitSizeInches: numericConduitSize(workbookEvidence.conduitSize),
    fiberCount: workbookEvidence.fiberCount,
    projectConfiguration: {
      ductCount: workbookEvidence.conduitCount,
      ductDiameter: numericConduitSize(workbookEvidence.conduitSize),
      ductMaterialSpec: "HDPE",
      fiberCount: workbookEvidence.fiberCount,
      fiberCableType: workbookEvidence.fiberType ?? "SOURCE_DEFINED",
      fiberPlacementPolicy: "SOURCE_DEFINED",
      slackPolicy: { mode: "PERCENTAGE", slackPercent: 5, authority: "PROJECT_CONFIGURATION", source: "Helium commercial planning configuration", revision: "CIP-042-NEW-REVISION" },
      structurePlanAuthority: "UNKNOWN",
      spliceArchitectureAuthority: "UNKNOWN",
      ilaConfigurationId: `${scope.opportunityId}:ILA-CONFIG:SOURCE-EVIDENCE`,
      terminationConfiguration: "ENGINEERING_DEFINED",
    },
  });
  const doctrineHandholeCount = Number(
    doctrineAssembly.structureAssembly.structures.find((object) => object.label === "HANDHOLE")?.quantity,
  );

  const quantityReconciliation: QuantityReconciliation[] = [
    {
      normalizedField: "routeFeet",
      sourceValue: workbookEvidence.routeFeet,
      doctrineValue: routeEvidence.routeFeet,
      status: reconcileQuantity(workbookEvidence.routeFeet, routeEvidence.routeFeet),
      sourceEvidence: `${workbookEvidence.sourceFile}:Assumptions`,
      resolution: "Measured spine is route authority; workbook mismatch requires source disposition.",
    },
    {
      normalizedField: "conduitFeet",
      sourceValue: workbookEvidence.conduitFeet,
      doctrineValue: doctrineAssembly.quantitySummary.conduitFeet,
      status: reconcileQuantity(workbookEvidence.conduitFeet, doctrineAssembly.quantitySummary.conduitFeet),
      sourceEvidence: `${workbookEvidence.sourceFile}:Materials_Labor_Units`,
      resolution: "Approve source factor or retain doctrine-derived route feet times conduit count.",
    },
    {
      normalizedField: "fiberFeet",
      sourceValue: workbookEvidence.fiberFeet,
      doctrineValue: doctrineAssembly.quantitySummary.fiberFeet,
      status: reconcileQuantity(workbookEvidence.fiberFeet, doctrineAssembly.quantitySummary.fiberFeet),
      sourceEvidence: `${workbookEvidence.sourceFile}:Materials_Labor_Units`,
      resolution: "Approve placement/slack factor or retain measured-spine quantity.",
    },
    {
      normalizedField: "handholeCount",
      sourceValue: workbookEvidence.handholeCount,
      doctrineValue: Number.isFinite(doctrineHandholeCount) ? doctrineHandholeCount : undefined,
      status: reconcileQuantity(workbookEvidence.handholeCount, Number.isFinite(doctrineHandholeCount) ? doctrineHandholeCount : undefined),
      sourceEvidence: `${workbookEvidence.sourceFile}:Materials_Labor_Units`,
      resolution: "Engineering must approve BOM count versus spacing doctrine.",
    },
    {
      normalizedField: "spliceCaseCount",
      sourceValue: workbookEvidence.spliceCaseCount,
      doctrineValue: undefined,
      status: reconcileQuantity(workbookEvidence.spliceCaseCount, undefined),
      sourceEvidence: `${workbookEvidence.sourceFile}:Materials_Labor_Units`,
      resolution: "Engineering splice architecture is required.",
    },
    {
      normalizedField: "ILACount",
      sourceValue: workbookEvidence.ILACount,
      doctrineValue: undefined,
      status: reconcileQuantity(workbookEvidence.ILACount, undefined),
      sourceEvidence: `${workbookEvidence.sourceFile}:Route_ILA`,
      resolution: "Engineering optical design must certify each ILA site; distance alone is not authority.",
    },
  ];

  const sourceEvidence = [workbookEvidence.evidencePackageId, routeEvidence.routeEvidenceId];
  const productObjects: ReferenceObject[] = [
    ...manyObjects({ scope, product: resolved.definition, objectClass: "SPINE", count: 1, routeFeet: routeEvidence.routeFeet, quantity: routeEvidence.routeFeet, unit: "route-foot", sourceEvidence }),
    ...manyObjects({ scope, product: resolved.definition, objectClass: "ROUTE_SEGMENT", count: doctrineAssembly.routeSegments.length, routeFeet: routeEvidence.routeFeet, quantity: routeEvidence.routeFeet / Math.max(1, doctrineAssembly.routeSegments.length), unit: "route-foot", sourceEvidence }),
    ...manyObjects({ scope, product: resolved.definition, objectClass: "CONDUIT", count: workbookEvidence.conduitCount ?? 1, routeFeet: routeEvidence.routeFeet, quantity: routeEvidence.routeFeet, unit: "conduit-foot", sourceEvidence }),
    ...manyObjects({ scope, product: resolved.definition, objectClass: "FIBER", count: 1, routeFeet: routeEvidence.routeFeet, quantity: workbookEvidence.fiberFeet ?? routeEvidence.routeFeet, unit: "fiber-cable-foot", sourceEvidence }),
    ...manyObjects({ scope, product: resolved.definition, objectClass: "HANDHOLE", count: workbookEvidence.handholeCount ?? 0, routeFeet: routeEvidence.routeFeet, sourceEvidence }),
    ...manyObjects({ scope, product: resolved.definition, objectClass: "SPLICE_CASE", count: workbookEvidence.spliceCaseCount ?? 0, routeFeet: routeEvidence.routeFeet, sourceEvidence }),
    ...manyObjects({ scope, product: resolved.definition, objectClass: "TERMINATION_POINT", count: 2, routeFeet: routeEvidence.routeFeet, sourceEvidence }),
    ...manyObjects({ scope, product: resolved.definition, objectClass: "DEMARCATION_POINT", count: 2, routeFeet: routeEvidence.routeFeet, sourceEvidence }),
    ...manyObjects({ scope, product: resolved.definition, objectClass: "ILA_SITE", count: workbookEvidence.ILACount ?? 0, routeFeet: routeEvidence.routeFeet, sourceEvidence }),
  ];

  const gates = {
    productDoctrine: resolved.doctrine.doctrineId === resolved.definition.doctrineId ? "PASS" : "FAIL",
    objectDoctrine: productObjects.every((object) => object.objectDoctrine && object.closeSequence.length) ? "PASS" : "FAIL",
    quantityReconciliation: quantityReconciliation.every((item) => item.status === "MATCH") ? "PASS" : "FAIL",
    dependencies: productObjects.every((object) => object.dependencies.length > 0) ? "PASS" : "FAIL",
    closeSequences: productObjects.every((object) => object.closeSequence.length > 0) ? "PASS" : "FAIL",
    evidenceRequirements: productObjects.every((object) => object.evidenceRequirements.length > 0) ? "PASS" : "FAIL",
    paymentRules: productObjects.every((object) => object.paymentEligibility === "NO_CLOSE_NO_VALIDATION_NO_PAYMENT") ? "PASS" : "FAIL",
  } as const;
  const constitutionalAssemblyStatus = Object.values(gates).every((status) => status === "PASS") ? "PASS" : "FAIL";
  const referencePackageId = `${scope.opportunityId}:REFERENCE:${routeEvidence.sourceHash.slice(0, 12)}`;
  const commercialSourceWarnings = createCommercialSourceWarnings({
    scope: { ...scope, packageId: referencePackageId },
    sourceHash: workbookEvidence.sourceHash,
    validation: workbookEvidence.workbookValidation,
  });

  return {
    ...scope,
    referenceAdapterId: HELIUM_REFERENCE_ADAPTER_ID,
    referencePackageId,
    sourceAuthority: "PROJECT_EVIDENCE_RECONCILED_WITH_PRODUCT_DOCTRINE",
    sourceHash: `${workbookEvidence.sourceHash}:${routeEvidence.sourceHash}`,
    product: resolved.definition,
    doctrine: resolved.doctrine,
    workbookEvidence,
    routeEvidence,
    measuredSpine: doctrineAssembly.spine,
    stations: doctrineAssembly.stations,
    objectManifest: productObjects,
    quantityReconciliation,
    commercialSourceWarnings,
    doctrineMigration: {
      previousDoctrineVersion: POINT_TO_POINT_LONG_HAUL_PREVIOUS_DOCTRINE_VERSION,
      newDoctrineVersion: POINT_TO_POINT_LONG_HAUL_DOCTRINE_VERSION,
      changeReason: POINT_TO_POINT_LONG_HAUL_DOCTRINE_CHANGE_REASON,
      historicalReconciliationMutation: false,
    },
    heliumDoctrineComparison: {
      routeAuthority: "Measured KMZ remains route authority candidate; OSRM is not constitutionally required.",
      conduitQuantity: "Measured route x explicitly configured 3 ducts; Engineering reconciliation remains required.",
      fiberQuantity: "Measured route x explicit attributable 5% placement policy; Engineering reconciliation remains required.",
      handholeQuantity: "Legacy mileage projection removed; source 334 remains evidence pending governed structure-plan authority.",
      spliceArchitecture: "No mileage projection; source 34 remains evidence pending Engineering splice architecture.",
      ilaConfiguration: "Two source-defined ILA sites are preserved pending BIND_OPTICAL_DESIGN; no mileage-generated sites are added.",
    },
    constitutionalAssemblyReview: {
      status: constitutionalAssemblyStatus,
      gates,
      blockers: quantityReconciliation.filter((item) => item.status !== "MATCH").map((item) => `${item.normalizedField}: ${item.status}`),
    },
    draftIofReadiness: constitutionalAssemblyStatus === "PASS" ? "READY" : "BLOCKED",
    engineeringCertificationRequired: true,
    engineeringCertificationTarget: "DRAFT_IOF_PACKAGE",
    commercialScopeVersionCreationAllowed: false,
    noScopeVersionCreation: true,
    noExecutionAuthorization: true,
  };
}
