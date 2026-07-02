import type { DraftIofPackageRuntime, ProposalRuntimeObject } from "../api/teralinxRuntime";
import { assembleDraftIofPackage } from "../commercial/IOFPackageAssemblyEngine";
import type { CommercialCorridorSegment } from "../commercial/CommercialCorridorDraftEngine";
import type { DALCoordinate } from "../types/dal";
import {
  assemblePointToPointLongHaulDoctrine,
  POINT_TO_POINT_LONG_HAUL_DOCTRINE,
  POINT_TO_POINT_LONG_HAUL_PRODUCT_ID,
} from "./pointToPointLongHaulDoctrine";
import type { ProductDoctrineAssembly, ProductDoctrineSite } from "./ProductDoctrineContracts";
import { routeLengthFeet } from "../spine/MeasuredSpineEngine";

export const POINT_TO_POINT_CONFIGURATOR_ID = "PointToPointConfigurator";
export const POINT_TO_POINT_CONFIGURATOR_VERSION = "20D.1";
export const POINT_TO_POINT_PRODUCT_NAME = "Point-to-Point Duct & Dark Fiber";

export interface PointToPointConfiguratorLocation {
  locationId?: string;
  label: string;
  latitude: number;
  longitude: number;
  source?: string;
}

export interface PointToPointConfiguratorInput {
  customer: {
    accountId: string;
    customerId: string;
    customerName: string;
  };
  opportunity?: {
    opportunityId?: string;
    proposalId?: string;
    proposalNumber?: string;
    title?: string;
    summary?: string;
  };
  product?: {
    productId?: string;
    productName?: string;
    defaultTermYears?: number;
    protected?: boolean;
  };
  aLocation: PointToPointConfiguratorLocation;
  zLocation: PointToPointConfiguratorLocation;
  intermediateLocations?: PointToPointConfiguratorLocation[];
  routeGeometry?: DALCoordinate[];
  routeId?: string;
  routeMiles?: number;
  commercialAssumptions?: Record<string, unknown>;
  pricingSummary?: Record<string, unknown>;
  routeSegments?: CommercialCorridorSegment[];
  generatedAt?: string;
  ownerId?: string;
  owner?: string;
  organizationId?: string;
  workspaceId?: string;
}

export interface PointToPointConfiguratorContextInspector {
  customer: string;
  opportunity: string;
  product: string;
  doctrine: string;
  configurator: string;
  routeLength: string;
  measuredSpine: string;
  stationCount: number;
  engineeringObjects: number;
  quantities: string;
  commercialStatus: string;
  draftPackageStatus: string;
}

export interface PointToPointConfiguratorResult {
  configuratorId: typeof POINT_TO_POINT_CONFIGURATOR_ID;
  configuratorVersion: typeof POINT_TO_POINT_CONFIGURATOR_VERSION;
  productId: typeof POINT_TO_POINT_LONG_HAUL_PRODUCT_ID;
  productName: typeof POINT_TO_POINT_PRODUCT_NAME;
  doctrineId: typeof POINT_TO_POINT_LONG_HAUL_DOCTRINE.doctrineId;
  doctrineVersion: typeof POINT_TO_POINT_LONG_HAUL_DOCTRINE.doctrineVersion;
  routeGeometry: DALCoordinate[];
  routeFeet: number;
  routeMiles: number;
  productDoctrineAssembly: ProductDoctrineAssembly;
  draftPackage: DraftIofPackageRuntime;
  contextInspector: PointToPointConfiguratorContextInspector;
  validation: {
    status: "PASS" | "FAIL";
    checks: Array<{ key: string; status: "PASS" | "FAIL"; label: string }>;
  };
  commercialReviewLoaded: boolean;
  noScopeVersionCreation: true;
}

function stableIdPart(value: unknown, fallback = "UNKNOWN") {
  const raw = String(value ?? fallback).trim() || fallback;
  return raw.replace(/[^A-Za-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 120) || fallback;
}

function round(value: number, places = 3) {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

function coordinateFromLocation(location: PointToPointConfiguratorLocation): DALCoordinate {
  return [Number(location.longitude.toFixed(6)), Number(location.latitude.toFixed(6))];
}

function validCoordinate(coordinate: DALCoordinate | undefined): coordinate is DALCoordinate {
  return Boolean(
    coordinate &&
    Number.isFinite(coordinate[0]) &&
    Number.isFinite(coordinate[1]) &&
    Math.abs(coordinate[0]) <= 180 &&
    Math.abs(coordinate[1]) <= 90,
  );
}

function normalizedRouteGeometry(input: PointToPointConfiguratorInput) {
  const supplied = (input.routeGeometry ?? []).filter(validCoordinate);
  if (supplied.length > 1) return supplied;
  return [
    coordinateFromLocation(input.aLocation),
    ...(input.intermediateLocations ?? []).map(coordinateFromLocation),
    coordinateFromLocation(input.zLocation),
  ].filter(validCoordinate);
}

function siteFromLocation(role: "A" | "Z", accountId: string, location: PointToPointConfiguratorLocation, fallbackCoordinate: DALCoordinate): ProductDoctrineSite {
  return {
    siteId: `${POINT_TO_POINT_LONG_HAUL_PRODUCT_ID}:SITE:${role}:${stableIdPart(location.locationId ?? accountId)}`,
    role,
    label: location.label,
    coordinate: coordinateFromLocation(location) ?? fallbackCoordinate,
    source: location.source ?? "POINT_TO_POINT_CONFIGURATOR",
  };
}

function proposalFromInput(input: PointToPointConfiguratorInput, proposalId: string): Partial<ProposalRuntimeObject> & { proposalId: string; customerId: string; opportunityId?: string } {
  const opportunityId = input.opportunity?.opportunityId ?? `${proposalId}:OPPORTUNITY`;
  return {
    proposalId,
    proposalRecordId: proposalId,
    proposalNumber: input.opportunity?.proposalNumber ?? proposalId,
    customerId: input.customer.customerId,
    accountId: input.customer.accountId,
    customerName: input.customer.customerName,
    opportunityId,
    productId: POINT_TO_POINT_LONG_HAUL_PRODUCT_ID,
    productName: POINT_TO_POINT_PRODUCT_NAME,
    title: input.opportunity?.title ?? `${input.customer.customerName} ${POINT_TO_POINT_PRODUCT_NAME}`,
    summary: input.opportunity?.summary ?? "Product-configured commercial design generated by PointToPointConfigurator.",
    executiveSummary: "PD-001 product doctrine generated a Draft IOF Package for Commercial Review.",
    status: "COMMERCIAL_DRAFT",
    approvalState: "NOT_SUBMITTED",
    version: 1,
    pricingSummary: input.pricingSummary,
    commercialAssumptionIds: ["POINT_TO_POINT_CONFIGURATOR_ASSUMPTIONS"],
    runtimeObjectIds: [],
    runtimeRelationshipIds: [],
    runtimeEvidenceIds: [],
    existingInventoryReferences: [],
    customerDesignReferences: [],
    customerTwinReference: `CUSTOMER-TWIN-${input.customer.accountId}`,
    geometryReferences: [],
    createdAt: input.generatedAt ?? "2026-07-02T00:00:00.000Z",
    updatedAt: input.generatedAt ?? "2026-07-02T00:00:00.000Z",
    ownerId: input.ownerId,
    owner: input.owner,
    organizationId: input.organizationId,
    workspaceId: input.workspaceId,
    noScopeVersionCreation: true,
    noInventoryMutation: true,
  };
}

function validationChecks(args: {
  input: PointToPointConfiguratorInput;
  routeGeometry: DALCoordinate[];
  doctrineAssembly: ProductDoctrineAssembly;
  draftPackage: DraftIofPackageRuntime;
}) {
  const checks = [
    ["customer-selected", Boolean(args.input.customer.customerId), "Customer selected"],
    ["product-selected", args.input.product?.productId === POINT_TO_POINT_LONG_HAUL_PRODUCT_ID || !args.input.product?.productId, "Product selected"],
    ["configurator-invoked", true, "Correct configurator invoked"],
    ["pd-001-loaded", args.doctrineAssembly.doctrineId === POINT_TO_POINT_LONG_HAUL_DOCTRINE.doctrineId, "PD-001 loaded"],
    ["az-resolved", validCoordinate(coordinateFromLocation(args.input.aLocation)) && validCoordinate(coordinateFromLocation(args.input.zLocation)), "A/Z resolved"],
    ["route-generated", args.routeGeometry.length > 1, "Route generated"],
    ["measured-spine-generated", Boolean((args.draftPackage as Record<string, unknown>).measuredSpine), "Measured spine generated"],
    ["station-authority-generated", Boolean((args.draftPackage as Record<string, unknown>).stationAuthority), "Station authority generated"],
    ["engineering-objects-generated", args.doctrineAssembly.objects.length > 0, "Engineering objects generated"],
    ["quantities-generated", args.doctrineAssembly.quantitySummary.routeFeet > 0, "Quantities generated"],
    ["draft-package-created", Boolean(args.draftPackage.packageId), "Draft IOF Package created"],
    ["commercial-review-loaded", Boolean((args.draftPackage as Record<string, unknown>).commercialReviewState), "Commercial Review loaded"],
  ] as const;
  return checks.map(([key, passed, label]) => ({
    key,
    label,
    status: passed ? "PASS" as const : "FAIL" as const,
  }));
}

export function productConfiguratorForProduct(productId: string | undefined) {
  return productId === POINT_TO_POINT_LONG_HAUL_PRODUCT_ID || !productId
    ? POINT_TO_POINT_CONFIGURATOR_ID
    : null;
}

export function executePointToPointConfigurator(input: PointToPointConfiguratorInput): PointToPointConfiguratorResult {
  const selectedConfigurator = productConfiguratorForProduct(input.product?.productId);
  if (selectedConfigurator !== POINT_TO_POINT_CONFIGURATOR_ID) {
    throw new Error("Only Point-to-Point Duct & Dark Fiber is supported in Sprint 20D.");
  }
  const routeGeometry = normalizedRouteGeometry(input);
  if (routeGeometry.length < 2) throw new Error("PointToPointConfigurator requires resolved A and Z route geometry.");
  const routeFeet = Math.round(input.routeMiles ? input.routeMiles * 5280 : routeLengthFeet(routeGeometry));
  const routeMiles = round(input.routeMiles ?? routeFeet / 5280, 3);
  const routeId = input.routeId ?? `${POINT_TO_POINT_CONFIGURATOR_ID}:ROUTE:${stableIdPart(input.customer.accountId)}:${stableIdPart(input.opportunity?.opportunityId, "OPPORTUNITY")}`;
  const aSite = siteFromLocation("A", input.customer.accountId, input.aLocation, routeGeometry[0]);
  const zSite = siteFromLocation("Z", input.customer.accountId, input.zLocation, routeGeometry[routeGeometry.length - 1]);
  const doctrineAssembly = assemblePointToPointLongHaulDoctrine({
    accountId: input.customer.accountId,
    customerId: input.customer.customerId,
    aSite,
    zSite,
    osrmRoute: {
      routeId,
      source: "OSRM",
      routeMiles,
      routeFeet,
      distanceMeters: Math.round(routeFeet / 3.28084),
      geometry: routeGeometry,
    },
    routeSegments: input.routeSegments,
    pricingSummary: input.pricingSummary,
    stationIntervalFeet: 5280,
  });
  const proposalId = input.opportunity?.proposalId ?? `PROPOSAL-${stableIdPart(input.customer.accountId)}-${stableIdPart(routeId)}`;
  const draftPackageBase = assembleDraftIofPackage({
    proposal: proposalFromInput(input, proposalId),
    customerName: input.customer.customerName,
    accountId: input.customer.accountId,
    commercialCandidate: {
      geometry: routeGeometry,
      productConfigurator: POINT_TO_POINT_CONFIGURATOR_ID,
      commercialAssumptions: input.commercialAssumptions,
    },
    productDoctrine: POINT_TO_POINT_LONG_HAUL_DOCTRINE,
    productDoctrineAssembly: doctrineAssembly,
    pricing: {
      pricingSummary: doctrineAssembly.pricingSummary,
      commercialAssumptions: input.commercialAssumptions,
    },
    validation: doctrineAssembly.validationSummary.checks.map((check) => [check.label, check.status === "PASS"]),
    assignedEngineerId: input.ownerId,
    assignedEngineer: input.owner,
    priority: "NORMAL",
    generatedAt: input.generatedAt,
    ownerId: input.ownerId,
    owner: input.owner,
    organizationId: input.organizationId,
    workspaceId: input.workspaceId,
  });
  const draftPackage = {
    ...draftPackageBase,
    productName: POINT_TO_POINT_PRODUCT_NAME,
    productConfigurator: POINT_TO_POINT_CONFIGURATOR_ID,
    productConfiguratorVersion: POINT_TO_POINT_CONFIGURATOR_VERSION,
    configuratorVersion: POINT_TO_POINT_CONFIGURATOR_VERSION,
    configuratorLifecycle: "CUSTOMER_PRODUCT_CONFIGURATOR_PD001_COMMERCIAL_DESIGN",
    productInvocationAuthority: "PRODUCT_CONFIGURATOR_EXECUTES_PRODUCT_DOCTRINE",
    engineeringObjectDoctrine: {
      doctrineId: POINT_TO_POINT_LONG_HAUL_DOCTRINE.doctrineId,
      productDoctrineVersion: POINT_TO_POINT_LONG_HAUL_DOCTRINE.doctrineVersion,
      requiredObjectIds: doctrineAssembly.objects.map((object) => object.objectId),
      manualEngineeringAssembly: false,
    },
    engineeringObjects: doctrineAssembly.objects,
    commercialDesign: {
      configuratorId: POINT_TO_POINT_CONFIGURATOR_ID,
      configuratorVersion: POINT_TO_POINT_CONFIGURATOR_VERSION,
      routeId,
      routeGeometry,
      routeFeet,
      routeMiles,
      aLocation: input.aLocation,
      zLocation: input.zLocation,
      intermediateLocations: input.intermediateLocations ?? [],
      commercialAssumptions: input.commercialAssumptions ?? {},
      noManualEngineeringAssembly: true,
      noScopeVersionCreation: true,
    },
    commercialReviewState: {
      status: "COMMERCIAL_REVIEW_LOADED",
      loadedFrom: POINT_TO_POINT_CONFIGURATOR_ID,
      canMoveDoctrineGeneratedObjectsByStation: true,
      canModifyMeasuredSpine: false,
      canModifyStationAuthority: false,
      canCreateRequiredDoctrineObjects: false,
      canCreateScopeVersion: false,
    },
    noScopeVersionCreation: true,
  } as DraftIofPackageRuntime;
  const checks = validationChecks({ input, routeGeometry, doctrineAssembly, draftPackage });
  const validation = {
    status: checks.every((check) => check.status === "PASS") ? "PASS" as const : "FAIL" as const,
    checks,
  };
  const measuredSpine = (draftPackage as Record<string, any>).measuredSpine;
  const stationAuthority = (draftPackage as Record<string, any>).stationAuthority;
  return {
    configuratorId: POINT_TO_POINT_CONFIGURATOR_ID,
    configuratorVersion: POINT_TO_POINT_CONFIGURATOR_VERSION,
    productId: POINT_TO_POINT_LONG_HAUL_PRODUCT_ID,
    productName: POINT_TO_POINT_PRODUCT_NAME,
    doctrineId: POINT_TO_POINT_LONG_HAUL_DOCTRINE.doctrineId,
    doctrineVersion: POINT_TO_POINT_LONG_HAUL_DOCTRINE.doctrineVersion,
    routeGeometry,
    routeFeet,
    routeMiles,
    productDoctrineAssembly: doctrineAssembly,
    draftPackage,
    contextInspector: {
      customer: input.customer.customerName,
      opportunity: input.opportunity?.opportunityId ?? "Opportunity pending",
      product: POINT_TO_POINT_PRODUCT_NAME,
      doctrine: `${POINT_TO_POINT_LONG_HAUL_DOCTRINE.doctrineId} ${POINT_TO_POINT_LONG_HAUL_DOCTRINE.doctrineVersion}`,
      configurator: `${POINT_TO_POINT_CONFIGURATOR_ID} ${POINT_TO_POINT_CONFIGURATOR_VERSION}`,
      routeLength: `${routeMiles.toLocaleString()} mi / ${routeFeet.toLocaleString()} ft`,
      measuredSpine: measuredSpine?.geometryHash ?? "missing",
      stationCount: Number(stationAuthority?.stationCount ?? 0),
      engineeringObjects: doctrineAssembly.objects.length,
      quantities: `${doctrineAssembly.quantitySummary.routeFeet.toLocaleString()} route ft / ${doctrineAssembly.quantitySummary.objectCount.toLocaleString()} objects`,
      commercialStatus: "COMMERCIAL_REVIEW_LOADED",
      draftPackageStatus: draftPackage.status,
    },
    validation,
    commercialReviewLoaded: true,
    noScopeVersionCreation: true,
  };
}
