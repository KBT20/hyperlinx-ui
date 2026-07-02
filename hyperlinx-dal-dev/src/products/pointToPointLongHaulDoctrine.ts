import type { CommercialCorridorSegment } from "../commercial/CommercialCorridorDraftEngine";
import type { DALCoordinate } from "../types/dal";
import type {
  ProductDoctrine,
  ProductDoctrineAssembly,
  ProductDoctrineConduitAssembly,
  ProductDoctrineCrossingAssembly,
  ProductDoctrineFiberAssembly,
  ProductDoctrineObject,
  ProductDoctrineOsrmRoute,
  ProductDoctrinePricingSummary,
  ProductDoctrineQuantitySummary,
  ProductDoctrineRouteSegment,
  ProductDoctrineSite,
  ProductDoctrineSpine,
  ProductDoctrineStation,
  ProductDoctrineStructureAssembly,
  ProductDoctrineValidationCheck,
  ProductDoctrineValidationSummary,
} from "./ProductDoctrineContracts";

export const POINT_TO_POINT_LONG_HAUL_PRODUCT_ID = "POINT_TO_POINT_LONG_HAUL_CONDUIT_FIBER";
export const POINT_TO_POINT_LONG_HAUL_DOCTRINE_ID = "DOCTRINE-L1-POINT-TO-POINT-LONG-HAUL-CONDUIT-FIBER";
export const POINT_TO_POINT_LONG_HAUL_DOCTRINE_VERSION = "19B.1.0";

export const POINT_TO_POINT_LONG_HAUL_DOCTRINE: ProductDoctrine = {
  doctrineId: POINT_TO_POINT_LONG_HAUL_DOCTRINE_ID,
  productId: POINT_TO_POINT_LONG_HAUL_PRODUCT_ID,
  productName: "Point-to-Point Long Haul Conduit & Fiber",
  productVersion: "1.0.0",
  doctrineVersion: POINT_TO_POINT_LONG_HAUL_DOCTRINE_VERSION,
  rules: {
    networkClass: "LONG_HAUL",
    topology: "LINEAR",
    layer: 1,
    opticalTransport: false,
    comparisonAllowed: false,
    reuseRecommendationAllowed: false,
    scopeVersionCreationAllowedFromCommercial: false,
    engineeringCertificationRequired: true,
  },
  requiredInputs: [
    "account/customer",
    "productId",
    "doctrineId",
    "A site",
    "Z site",
    "OSRM centerline",
    "route geometry",
    "pricing summary",
  ],
  assembledArtifacts: [
    "spine",
    "stations",
    "route segments",
    "conduit objects",
    "fiber objects",
    "structures",
    "crossings",
    "quantity summary",
    "pricing inputs",
    "validation summary",
  ],
  readinessChecks: [
    "account/customer exists",
    "productId exists",
    "doctrineId exists",
    "A site exists",
    "Z site exists",
    "OSRM centerline exists",
    "route geometry exists",
    "spine exists",
    "stations count > 0",
    "objects count > 0",
    "quantity summary exists",
    "pricing summary exists",
    "validation PASS",
  ],
};

export interface PointToPointLongHaulDoctrineInput {
  accountId: string;
  customerId: string;
  aSite: ProductDoctrineSite | null;
  zSite: ProductDoctrineSite | null;
  osrmRoute: ProductDoctrineOsrmRoute | null;
  routeSegments?: CommercialCorridorSegment[];
  pricingSummary?: Partial<ProductDoctrinePricingSummary> & Record<string, unknown>;
  stationIntervalFeet?: number;
  conduitCount?: number;
  conduitSizeInches?: number;
  fiberCount?: number;
}

function stableIdPart(value: unknown, fallback = "UNKNOWN") {
  const raw = String(value ?? fallback).trim() || fallback;
  return raw.replace(/[^A-Za-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 120) || fallback;
}

function round(value: number, places = 3) {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

function coordinateAt(centerline: DALCoordinate[], ratio: number): DALCoordinate {
  if (!centerline.length) return [0, 0];
  if (centerline.length === 1) return centerline[0];
  const index = Math.min(centerline.length - 1, Math.max(0, Math.round(ratio * (centerline.length - 1))));
  return centerline[index];
}

function makeSite(role: "A" | "Z", accountId: string, coordinate: DALCoordinate | undefined, fallbackLabel: string): ProductDoctrineSite | null {
  if (!coordinate) return null;
  return {
    siteId: `${POINT_TO_POINT_LONG_HAUL_PRODUCT_ID}:SITE:${role}:${stableIdPart(accountId)}`,
    role,
    label: fallbackLabel,
    coordinate,
    source: "OSRM_CENTERLINE_FALLBACK",
  };
}

function buildStations(spineId: string, centerline: DALCoordinate[], routeFeet: number, stationIntervalFeet: number): ProductDoctrineStation[] {
  if (!centerline.length || routeFeet <= 0) return [];
  const stationCount = Math.max(2, Math.floor(routeFeet / stationIntervalFeet) + 1);
  return Array.from({ length: stationCount }, (_, index) => {
    const ratio = stationCount === 1 ? 0 : index / (stationCount - 1);
    const stationFeet = index === stationCount - 1 ? routeFeet : Math.min(routeFeet, index * stationIntervalFeet);
    return {
      stationId: `${spineId}:STATION:${String(index).padStart(4, "0")}`,
      spineId,
      stationIndex: index,
      stationFeet: Math.round(stationFeet),
      milepost: round(stationFeet / 5280),
      coordinate: coordinateAt(centerline, ratio),
    };
  });
}

function buildSegments(spineId: string, stations: ProductDoctrineStation[], sourceSegments: CommercialCorridorSegment[] | undefined, routeFeet: number): ProductDoctrineRouteSegment[] {
  if (sourceSegments?.length && stations.length) {
    return sourceSegments.map((segment, index) => ({
      segmentId: `${spineId}:SEGMENT:${stableIdPart(segment.segmentId, String(index + 1))}`,
      spineId,
      fromStationId: stations[Math.min(index, stations.length - 1)]?.stationId ?? stations[0].stationId,
      toStationId: stations[Math.min(index + 1, stations.length - 1)]?.stationId ?? stations[stations.length - 1].stationId,
      fromMile: round(segment.fromMile),
      toMile: round(segment.toMile),
      routeMiles: round(segment.routeMiles),
      routeFeet: Math.round(segment.routeMiles * 5280),
    }));
  }
  if (stations.length < 2 || routeFeet <= 0) return [];
  return stations.slice(0, -1).map((station, index) => {
    const next = stations[index + 1];
    const feet = Math.max(0, next.stationFeet - station.stationFeet);
    return {
      segmentId: `${spineId}:SEGMENT:${String(index + 1).padStart(3, "0")}`,
      spineId,
      fromStationId: station.stationId,
      toStationId: next.stationId,
      fromMile: station.milepost,
      toMile: next.milepost,
      routeMiles: round(feet / 5280),
      routeFeet: Math.round(feet),
    };
  });
}

function object(objectId: string, objectType: ProductDoctrineObject["objectType"], label: string, parentId: string | undefined, quantity: number | undefined, unit: string | undefined, metadata: Record<string, unknown>): ProductDoctrineObject {
  return { objectId, objectType, label, parentId, quantity, unit, metadata };
}

function buildConduitAssembly(spineId: string, segments: ProductDoctrineRouteSegment[], conduitCount: number, conduitSizeInches: number): ProductDoctrineConduitAssembly {
  const objects = segments.map((segment) => object(
    `${segment.segmentId}:CONDUIT`,
    "CONDUIT",
    `Conduit ${segment.fromMile}-${segment.toMile}`,
    segment.segmentId,
    Math.round(segment.routeFeet * conduitCount),
    "conduit-foot",
    { conduitCount, conduitSizeInches, routeFeet: segment.routeFeet },
  ));
  return {
    assemblyId: `${spineId}:CONDUIT-ASSEMBLY`,
    conduitCount,
    conduitSizeInches,
    conduitFeet: objects.reduce((sum, item) => sum + Number(item.quantity ?? 0), 0),
    objects,
  };
}

function buildFiberAssembly(spineId: string, segments: ProductDoctrineRouteSegment[], fiberCount: number): ProductDoctrineFiberAssembly {
  const slackFactor = 1.05;
  const objects = segments.map((segment) => object(
    `${segment.segmentId}:FIBER`,
    "FIBER",
    `Fiber ${segment.fromMile}-${segment.toMile}`,
    segment.segmentId,
    Math.round(segment.routeFeet * slackFactor),
    "fiber-foot",
    { fiberCount, slackFactor, routeFeet: segment.routeFeet },
  ));
  return {
    assemblyId: `${spineId}:FIBER-ASSEMBLY`,
    fiberCount,
    fiberFeet: objects.reduce((sum, item) => sum + Number(item.quantity ?? 0), 0),
    objects,
  };
}

function buildStructureAssembly(spineId: string, routeMiles: number): ProductDoctrineStructureAssembly {
  const counts = [
    ["HANDHOLE", Math.max(1, Math.ceil(routeMiles / 2))],
    ["VAULT", Math.max(1, Math.ceil(routeMiles / 10))],
    ["SPLICE_CASE", Math.max(1, Math.ceil(routeMiles / 15))],
    ["ILA", Math.max(0, Math.floor(routeMiles / 60))],
    ["REGENERATION", Math.max(0, Math.floor(routeMiles / 80))],
  ] as const;
  const structures = counts
    .filter(([, count]) => count > 0)
    .map(([type, count]) => object(
      `${spineId}:STRUCTURE:${type}`,
      "STRUCTURE",
      type,
      spineId,
      count,
      "count",
      { structureType: type, formula: "deterministic long-haul doctrine spacing" },
    ));
  return {
    assemblyId: `${spineId}:STRUCTURE-ASSEMBLY`,
    structureCount: structures.reduce((sum, item) => sum + Number(item.quantity ?? 0), 0),
    structures,
  };
}

function buildCrossingAssembly(spineId: string, routeMiles: number): ProductDoctrineCrossingAssembly {
  const estimatedCrossings = Math.max(1, Math.ceil(routeMiles / 25));
  const crossings = [
    object(`${spineId}:CROSSING:AGGREGATE`, "CROSSING", "Aggregate crossing review", spineId, estimatedCrossings, "count", {
      formula: "long-haul preliminary crossing placeholder",
      engineeringReviewRequired: true,
    }),
  ];
  return {
    assemblyId: `${spineId}:CROSSING-ASSEMBLY`,
    crossingCount: estimatedCrossings,
    crossings,
  };
}

function buildPricingSummary(input: PointToPointLongHaulDoctrineInput, quantitySummary: ProductDoctrineQuantitySummary): ProductDoctrinePricingSummary {
  const provided = input.pricingSummary ?? {};
  const budgetCost = Number(provided.budgetCost ?? provided.ospCost ?? Math.max(1, Math.round(quantitySummary.routeFeet * 42)));
  const sellPriceIru = Number(provided.sellPriceIru ?? Math.round(budgetCost * 1.35));
  const nrcRevenue = Number(provided.nrcRevenue ?? sellPriceIru);
  const mrcRevenue = Number(provided.mrcRevenue ?? 0);
  const grossMarginDollars = Number(provided.grossMarginDollars ?? sellPriceIru - budgetCost);
  const grossMarginPercent = Number(provided.grossMarginPercent ?? (sellPriceIru ? Math.round((grossMarginDollars / sellPriceIru) * 10000) / 100 : 0));
  return {
    budgetCost,
    sellPriceIru,
    nrcRevenue,
    mrcRevenue,
    grossMarginDollars,
    grossMarginPercent,
    pricingInputs: {
      routeFeet: quantitySummary.routeFeet,
      conduitFeet: quantitySummary.conduitFeet,
      fiberFeet: quantitySummary.fiberFeet,
      source: provided,
    },
  };
}

function validationCheck(key: string, label: string, pass: boolean): ProductDoctrineValidationCheck {
  return { key, label, status: pass ? "PASS" : "FAIL" };
}

function validateAssembly(args: {
  accountId: string;
  customerId: string;
  productId: string;
  doctrineId: string;
  aSite: ProductDoctrineSite | null;
  zSite: ProductDoctrineSite | null;
  osrmRoute: ProductDoctrineOsrmRoute | null;
  centerline: DALCoordinate[];
  spine: ProductDoctrineSpine | null;
  stations: ProductDoctrineStation[];
  objects: ProductDoctrineObject[];
  quantitySummary: ProductDoctrineQuantitySummary;
  pricingSummary: ProductDoctrinePricingSummary;
}): ProductDoctrineValidationSummary {
  const checks = [
    validationCheck("account-customer", "account/customer exists", Boolean(args.accountId && args.customerId)),
    validationCheck("product-id", "productId exists", args.productId === POINT_TO_POINT_LONG_HAUL_PRODUCT_ID),
    validationCheck("doctrine-id", "doctrineId exists", args.doctrineId === POINT_TO_POINT_LONG_HAUL_DOCTRINE_ID),
    validationCheck("a-site", "A site exists", Boolean(args.aSite)),
    validationCheck("z-site", "Z site exists", Boolean(args.zSite)),
    validationCheck("osrm-centerline", "OSRM centerline exists", Boolean(args.osrmRoute && args.centerline.length > 1)),
    validationCheck("route-geometry", "route geometry exists", args.centerline.length > 1),
    validationCheck("spine", "spine exists", Boolean(args.spine)),
    validationCheck("stations", "stations count > 0", args.stations.length > 0),
    validationCheck("objects", "objects count > 0", args.objects.length > 0),
    validationCheck("quantity-summary", "quantity summary exists", args.quantitySummary.routeFeet > 0 && args.quantitySummary.objectCount > 0),
    validationCheck("pricing-summary", "pricing summary exists", args.pricingSummary.budgetCost > 0 && args.pricingSummary.sellPriceIru > 0),
  ];
  const passCount = checks.filter((check) => check.status === "PASS").length;
  return {
    status: passCount === checks.length ? "PASS" : "FAIL",
    checks,
    readinessScore: Math.round((passCount / checks.length) * 100),
  };
}

export function assemblePointToPointLongHaulDoctrine(input: PointToPointLongHaulDoctrineInput): ProductDoctrineAssembly {
  const centerline = input.osrmRoute?.geometry ?? [];
  const routeFeet = Math.max(0, Math.round(input.osrmRoute?.routeFeet ?? 0));
  const routeMiles = round(input.osrmRoute?.routeMiles ?? routeFeet / 5280);
  const aSite = input.aSite ?? makeSite("A", input.accountId, centerline[0], "A site");
  const zSite = input.zSite ?? makeSite("Z", input.accountId, centerline[centerline.length - 1], "Z site");
  const centerlineId = `${POINT_TO_POINT_LONG_HAUL_PRODUCT_ID}:CENTERLINE:${stableIdPart(input.osrmRoute?.routeId, "OSRM")}`;
  const spine: ProductDoctrineSpine | null = aSite && zSite && centerline.length > 1 && routeFeet > 0
    ? {
      spineId: `${POINT_TO_POINT_LONG_HAUL_PRODUCT_ID}:SPINE:${stableIdPart(input.osrmRoute?.routeId, "OSRM")}`,
      topology: "LINEAR",
      networkClass: "LONG_HAUL",
      aSiteId: aSite.siteId,
      zSiteId: zSite.siteId,
      centerlineId,
      routeMiles,
      routeFeet,
      noScopeVersionCreation: true,
    }
    : null;
  const stations = spine ? buildStations(spine.spineId, centerline, routeFeet, input.stationIntervalFeet ?? 5280) : [];
  const routeSegments = spine ? buildSegments(spine.spineId, stations, input.routeSegments, routeFeet) : [];
  const segmentObjects = routeSegments.map((segment) => object(segment.segmentId, "ROUTE_SEGMENT", `Route segment ${segment.fromMile}-${segment.toMile}`, spine?.spineId, segment.routeFeet, "route-foot", segment as unknown as Record<string, unknown>));
  const spineObject = spine ? [object(spine.spineId, "SPINE", "Point-to-point long-haul spine", undefined, routeFeet, "route-foot", spine as unknown as Record<string, unknown>)] : [];
  const conduitAssembly = spine ? buildConduitAssembly(spine.spineId, routeSegments, input.conduitCount ?? 4, input.conduitSizeInches ?? 2) : { assemblyId: `${POINT_TO_POINT_LONG_HAUL_PRODUCT_ID}:CONDUIT-ASSEMBLY`, conduitCount: input.conduitCount ?? 4, conduitSizeInches: input.conduitSizeInches ?? 2, conduitFeet: 0, objects: [] };
  const fiberAssembly = spine ? buildFiberAssembly(spine.spineId, routeSegments, input.fiberCount ?? 864) : { assemblyId: `${POINT_TO_POINT_LONG_HAUL_PRODUCT_ID}:FIBER-ASSEMBLY`, fiberCount: input.fiberCount ?? 864, fiberFeet: 0, objects: [] };
  const structureAssembly = spine ? buildStructureAssembly(spine.spineId, routeMiles) : { assemblyId: `${POINT_TO_POINT_LONG_HAUL_PRODUCT_ID}:STRUCTURE-ASSEMBLY`, structureCount: 0, structures: [] };
  const crossingAssembly = spine ? buildCrossingAssembly(spine.spineId, routeMiles) : { assemblyId: `${POINT_TO_POINT_LONG_HAUL_PRODUCT_ID}:CROSSING-ASSEMBLY`, crossingCount: 0, crossings: [] };
  const objects = [
    ...spineObject,
    ...segmentObjects,
    ...conduitAssembly.objects,
    ...fiberAssembly.objects,
    ...structureAssembly.structures,
    ...crossingAssembly.crossings,
  ];
  const quantitySummary: ProductDoctrineQuantitySummary = {
    routeMiles,
    routeFeet,
    stationCount: stations.length,
    segmentCount: routeSegments.length,
    objectCount: objects.length,
    conduitFeet: conduitAssembly.conduitFeet,
    conduitCount: conduitAssembly.conduitCount,
    fiberFeet: fiberAssembly.fiberFeet,
    fiberCount: fiberAssembly.fiberCount,
    structureCount: structureAssembly.structureCount,
    crossingCount: crossingAssembly.crossingCount,
  };
  const pricingSummary = buildPricingSummary(input, quantitySummary);
  const validationSummary = validateAssembly({
    accountId: input.accountId,
    customerId: input.customerId,
    productId: POINT_TO_POINT_LONG_HAUL_PRODUCT_ID,
    doctrineId: POINT_TO_POINT_LONG_HAUL_DOCTRINE_ID,
    aSite,
    zSite,
    osrmRoute: input.osrmRoute,
    centerline,
    spine,
    stations,
    objects,
    quantitySummary,
    pricingSummary,
  });
  const assemblyId = `${POINT_TO_POINT_LONG_HAUL_PRODUCT_ID}:ASSEMBLY:${stableIdPart(input.osrmRoute?.routeId, "OSRM")}`;
  return {
    assemblyId,
    doctrineId: POINT_TO_POINT_LONG_HAUL_DOCTRINE_ID,
    productId: POINT_TO_POINT_LONG_HAUL_PRODUCT_ID,
    productDoctrineVersion: POINT_TO_POINT_LONG_HAUL_DOCTRINE_VERSION,
    aSite,
    zSite,
    osrmRoute: input.osrmRoute,
    centerline,
    centerlineId,
    spine,
    stations,
    routeSegments,
    objects,
    conduitAssembly,
    fiberAssembly,
    structureAssembly,
    crossingAssembly,
    quantitySummary,
    pricingSummary,
    validationSummary,
    engineeringManifest: {
      manifestId: `${assemblyId}:ENGINEERING-MANIFEST`,
      packagePath: "Commercial Proposal -> Product Doctrine Assembly -> Draft IOF Package -> Engineering Review",
      requiresEngineeringCertification: true,
      noScopeVersionCreation: true,
      objectIds: objects.map((item) => item.objectId),
      stationIds: stations.map((station) => station.stationId),
      quantityKeys: Object.keys(quantitySummary),
    },
    rules: POINT_TO_POINT_LONG_HAUL_DOCTRINE.rules,
    noScopeVersionCreation: true,
  };
}
