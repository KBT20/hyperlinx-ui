import type { BudgetAssumptionState } from "./BudgetAssumptionState";
import { buildCommercialFinancialAuthority, type CommercialFinancialAuthority } from "./CommercialFinancialAuthority";
import type { CommercialRouteResult } from "./CommercialOsrmRoutingEngine";
import type { OpportunityScoutCandidate } from "./OpportunityScoutEngine";
import type { CustomerDesignImport, ImportedCustomerRoute } from "../translate/CustomerDesignImport";
import {
  buildTransparentCorridorEstimate,
  type TransparentCorridorEstimate,
  type TransparentEstimateControls,
  type TransparentEstimateLineItem,
  type TransparentIlaFacility,
  type TransparentUnknownQuantity,
} from "./TransparentEstimatingEngine";
import type { DALCoordinate } from "../types/dal";

export type CommercialDraftType = "NEW_GRAPH_CORRIDOR" | "EXISTING_GRAPH_EXTENSION";

export interface CommercialCorridorSegment {
  segmentId: string;
  label: string;
  fromMile: number;
  toMile: number;
  routeMiles: number;
  fiberFeet: number;
  ductFeet: number;
  constructionCost: number;
}

export interface CommercialCorridorLineItem {
  itemId: string;
  category: "BOM" | "LABOR" | "MATERIAL" | "OSP" | "ILA_REGEN";
  description: string;
  quantity: number;
  unit: string;
  unitCost: number;
  extendedCost: number;
  source?: string;
  workbook?: string;
  formula?: string;
  status?: string;
}

export interface CommercialCorridorDraft {
  draftType: "NEW_GRAPH_CORRIDOR";
  candidateId: string;
  routeId: string;
  aLabel: string;
  zLabel: string;
  geometry: DALCoordinate[];
  routeMiles: number;
  routeFeet: number;
  routeSegments: CommercialCorridorSegment[];
  stationCount: number;
  stationIntervalFeet: number;
  regenCount: number;
  ilaCount: number;
  spliceCaseCount: number;
  vaultCount: number;
  handholeCount: number;
  fiberFeet: number;
  ductFeet: number;
  highwayCrossings: TransparentUnknownQuantity;
  railCrossings: TransparentUnknownQuantity;
  waterCrossings: TransparentUnknownQuantity;
  unknownQuantities: TransparentUnknownQuantity[];
  constructionMix: {
    hddPercent: number;
    plowPercent: number;
    openCutPercent: number;
    label: string;
  };
  ilaFacilities: TransparentIlaFacility[];
  transparentEstimate: TransparentCorridorEstimate;
  bom: CommercialCorridorLineItem[];
  labor: CommercialCorridorLineItem[];
  materials: CommercialCorridorLineItem[];
  ospLineItems: CommercialCorridorLineItem[];
  ilaRegenLineItems: CommercialCorridorLineItem[];
  constructionCost: number;
  totalCost: number;
  financialAuthority: CommercialFinancialAuthority;
  grossMarginDollars: number;
  nrcRevenue: number;
  mrcRevenue: number;
  lifecycleRevenue: number;
  costPerMile: number;
  costPerFoot: number;
  revenuePerMile: number;
  revenuePerFoot: number;
  marginPerMile: number;
  sellPerFoot: number;
  sellPrice: number;
  nrc: number;
  iruSellPrice: number;
  grossMarginPercent: number;
  financialValidationWarnings: string[];
  vendorResponsePreview: string[];
  supportingInformation: string[];
  diagnostics: string[];
  noScopeVersionCreation: true;
  noInventoryMutation: true;
}

function money(value: number) {
  return Math.round(value);
}

function round(value: number, places = 2) {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

function routeGeometry(routeResult: CommercialRouteResult): DALCoordinate[] {
  return (routeResult.geometry ?? []).map((coordinate) => [coordinate.longitude, coordinate.latitude] as DALCoordinate);
}

function lineItem(
  category: CommercialCorridorLineItem["category"],
  itemId: string,
  description: string,
  quantity: number,
  unit: string,
  unitCost: number,
): CommercialCorridorLineItem {
  return {
    itemId,
    category,
    description,
    quantity: round(quantity, unit === "MILE" ? 2 : 0),
    unit,
    unitCost,
    extendedCost: money(quantity * unitCost),
  };
}

function lineItemFromEstimate(category: CommercialCorridorLineItem["category"], line: TransparentEstimateLineItem): CommercialCorridorLineItem {
  return {
    itemId: line.lineItemId,
    category,
    description: line.description,
    quantity: line.quantity.value ?? 0,
    unit: line.quantity.display.replace(String(line.quantity.value?.toLocaleString() ?? ""), "").trim() || "EA",
    unitCost: line.unitCost.value ?? 0,
    extendedCost: line.extendedCost.value ?? 0,
    source: line.source,
    workbook: line.workbook,
    formula: line.formula,
    status: line.extendedCost.status,
  };
}

function sum(items: CommercialCorridorLineItem[]) {
  return items.reduce((total, item) => total + item.extendedCost, 0);
}

function labelForEndpoint(candidate: OpportunityScoutCandidate, endpoint: "A" | "Z") {
  return endpoint === "A"
    ? candidate.originLocation?.label ?? candidate.origin?.label ?? "A Location"
    : candidate.destinationLocation?.label ?? candidate.destination?.label ?? "Z Location";
}

function buildSegments(candidateId: string, routeMiles: number, fiberFeet: number, ductFeet: number, weightedCivilCostPerFoot: number): CommercialCorridorSegment[] {
  const targetSegmentMiles = 10;
  const segmentCount = Math.max(1, Math.ceil(routeMiles / targetSegmentMiles));
  return Array.from({ length: segmentCount }, (_, index) => {
    const fromMile = round(index * (routeMiles / segmentCount), 2);
    const toMile = round((index + 1) * (routeMiles / segmentCount), 2);
    const segmentMiles = Math.max(0.01, toMile - fromMile);
    const ratio = segmentMiles / Math.max(routeMiles, 0.01);
    return {
      segmentId: `${candidateId}-SEG-${String(index + 1).padStart(3, "0")}`,
      label: `Commercial segment ${index + 1}`,
      fromMile,
      toMile,
      routeMiles: segmentMiles,
      fiberFeet: Math.round(fiberFeet * ratio),
      ductFeet: Math.round(ductFeet * ratio),
      constructionCost: money(segmentMiles * 5280 * weightedCivilCostPerFoot),
    };
  });
}

export function buildCommercialCorridorDraft(args: {
  candidate: OpportunityScoutCandidate;
  routeResult: CommercialRouteResult | null;
  assumptionState: BudgetAssumptionState;
  estimateControls?: TransparentEstimateControls;
}): CommercialCorridorDraft | null {
  if (args.candidate.mode !== "AZ_BUILDER") return null;
  if (args.routeResult?.status !== "ROUTED" || !args.routeResult.routeMiles || !args.routeResult.geometry?.length) return null;
  const geometry = routeGeometry(args.routeResult);
  if (geometry.length < 2) return null;

  const routeMiles = round(args.routeResult.routeMiles, 2);
  const routeFeet = Math.round(routeMiles * 5280);
  const constructionMix = args.assumptionState.civilMix;
  const weightedCivilCostPerFoot =
    (constructionMix.plowPercent / 100) * 5 +
    (constructionMix.hddPercent / 100) * 11 +
    (constructionMix.openCutPercent / 100) * 38;
  const routeSegments = buildSegments(args.candidate.candidateId, routeMiles, routeFeet, routeFeet, weightedCivilCostPerFoot);
  const aLabel = labelForEndpoint(args.candidate, "A");
  const zLabel = labelForEndpoint(args.candidate, "Z");
  const routeId = args.routeResult.routeId ?? `${args.candidate.candidateId}-OSRM-CORRIDOR`;
  const transparentEstimate = buildTransparentCorridorEstimate({
    estimateId: `${args.candidate.candidateId}-TRANSPARENT-ESTIMATE`,
    routeId,
    scopeVersionLineage: `Commercial Draft / ${routeId}`,
    aLabel,
    zLabel,
    geometry,
    routeMiles,
    routeFeet,
    segmentCount: routeSegments.length,
    assumptionState: args.assumptionState,
    controls: args.estimateControls,
  });
  const quantities = transparentEstimate.physicalQuantities;
  const bom = transparentEstimate.materialLineItems.map((item) => lineItemFromEstimate("BOM", item));
  const labor = transparentEstimate.laborLineItems.filter((item) => (item.extendedCost.value ?? 0) > 0).map((item) => lineItemFromEstimate("LABOR", item));
  const materials = transparentEstimate.materialLineItems.map((item) => lineItemFromEstimate("MATERIAL", item));
  const ospLineItems = transparentEstimate.ospLineItems.map((item) => lineItemFromEstimate("OSP", item));
  const ilaRegenLineItems = [
    lineItem(
      "ILA_REGEN",
      `${args.candidate.candidateId}-ILA-FACILITIES`,
      "Hyperlinx-managed ILA facilities",
      transparentEstimate.ilaFacilities.length,
      "EA",
      transparentEstimate.ilaFacilities[0]?.total.value ?? 0,
    ),
  ];
  ilaRegenLineItems[0].source = "Transparent Estimating Engine";
  ilaRegenLineItems[0].workbook = transparentEstimate.ilaFacilities[0]?.workbook;
  ilaRegenLineItems[0].formula = "Bookend ILA sites + intermediate regen ILA sites x selected workbook facility profile.";
  const constructionCost = transparentEstimate.financialModel.constructionCost.value ?? 0;
  const totalCost = transparentEstimate.totalKnownCost;
  const sellPrice = transparentEstimate.sellPrice;
  const grossMarginPercent = transparentEstimate.grossMarginPercent;
  const financialAuthority = buildCommercialFinancialAuthority({
    constructionCost: totalCost,
    sellPrice,
    routeMiles,
    routeFeet,
    transparentEstimate,
  });
  const highwayCrossings = transparentEstimate.unknownQuantities.find((item) => item.unknownId === "DOT-CROSSINGS") ?? transparentEstimate.unknownQuantities[0]!;
  const railCrossings = transparentEstimate.unknownQuantities.find((item) => item.unknownId === "RAILROAD-CROSSINGS") ?? transparentEstimate.unknownQuantities[0]!;
  const waterCrossings = transparentEstimate.unknownQuantities.find((item) => item.unknownId === "WATER-CROSSINGS") ?? transparentEstimate.unknownQuantities[0]!;

  return {
    draftType: "NEW_GRAPH_CORRIDOR",
    candidateId: args.candidate.candidateId,
    routeId,
    aLabel,
    zLabel,
    geometry,
    routeMiles,
    routeFeet,
    routeSegments,
    stationCount: quantities.stationCount,
    stationIntervalFeet: quantities.stationSpacingFeet,
    regenCount: quantities.regenCount,
    ilaCount: quantities.ilaCount,
    spliceCaseCount: quantities.spliceCaseCount,
    vaultCount: quantities.vaultCount,
    handholeCount: quantities.handholeCount,
    fiberFeet: quantities.purchasedFiberFeet,
    ductFeet: quantities.conduitFeet,
    highwayCrossings,
    railCrossings,
    waterCrossings,
    unknownQuantities: transparentEstimate.unknownQuantities,
    constructionMix: {
      hddPercent: transparentEstimate.civilMix.directionalBoreDirtPercent + transparentEstimate.civilMix.directionalBoreRockPercent,
      plowPercent: transparentEstimate.civilMix.plowPercent,
      openCutPercent: transparentEstimate.civilMix.openTrenchPercent,
      label: `${transparentEstimate.civilMix.plowPercent}% plow / ${transparentEstimate.civilMix.directionalBoreDirtPercent}% dirt bore / ${transparentEstimate.civilMix.directionalBoreRockPercent}% rock bore / ${transparentEstimate.civilMix.openTrenchPercent}% open trench`,
    },
    ilaFacilities: transparentEstimate.ilaFacilities,
    transparentEstimate,
    bom,
    labor,
    materials,
    ospLineItems,
    ilaRegenLineItems,
    constructionCost: financialAuthority.constructionCost,
    totalCost,
    financialAuthority,
    grossMarginDollars: financialAuthority.grossMarginDollars,
    nrcRevenue: financialAuthority.nrcRevenue,
    mrcRevenue: financialAuthority.mrcRevenue,
    lifecycleRevenue: financialAuthority.lifecycleRevenue,
    costPerMile: financialAuthority.costPerMile,
    costPerFoot: financialAuthority.costPerFoot,
    revenuePerMile: financialAuthority.revenuePerMile,
    revenuePerFoot: financialAuthority.revenuePerFoot,
    marginPerMile: financialAuthority.marginPerMile,
    sellPerFoot: financialAuthority.sellPerFoot,
    sellPrice,
    nrc: sellPrice,
    iruSellPrice: sellPrice,
    grossMarginPercent,
    financialValidationWarnings: financialAuthority.validationWarnings,
    vendorResponsePreview: [
      `A/Z corridor: ${aLabel} to ${zLabel}`,
      `${routeMiles.toLocaleString()} route miles with ${routeSegments.length.toLocaleString()} commercial segments.`,
      `${quantities.ilaCount.toLocaleString()} Hyperlinx-managed ILA sites, ${quantities.spliceCaseCount.toLocaleString()} splice cases, ${quantities.vaultCount.toLocaleString()} vaults, ${quantities.handholeCount.toLocaleString()} handholes.`,
      `Budget ${money(totalCost).toLocaleString()} / Sell ${sellPrice.toLocaleString()} / GM ${grossMarginPercent}%.`,
      `Commercial readiness ${transparentEstimate.commercialReadiness.score}% (${transparentEstimate.commercialReadiness.level}); estimate status ${transparentEstimate.estimateStatus.replaceAll("_", " ")}.`,
      `Layer 1 lifecycle MRC ${transparentEstimate.financialModel.mrc.display}; optional recurring opportunities remain unselected.`,
      `Estimate confidence ${transparentEstimate.confidence.score}% (${transparentEstimate.confidence.level}); unknown constraints affect confidence only.`,
    ],
    supportingInformation: [
      "Create New Graph corridor does not attach to or mutate Customer Twin inventory.",
      "Customer Twin may be used for diversity and avoidance review only.",
      "OSRM geometry is the commercial corridor basis until Engineering accepts the handoff.",
      "Railroad, water, DOT, utility, environmental, bridge, rock, and restoration quantities are UNKNOWN until reviewed; they do not add automatic cost.",
      "BOM, labor, material, ILA, production, financial, confidence, and audit details are exposed by the Transparent Estimating Engine.",
    ],
    diagnostics: [
      "New Graph corridor built from A/Z OSRM geometry.",
      "Attachment engine was not invoked for this corridor draft.",
      ...args.routeResult.diagnostics,
    ],
    noScopeVersionCreation: true,
    noInventoryMutation: true,
  };
}

export function buildCommercialCorridorDraftFromImportedRoute(args: {
  importRecord: CustomerDesignImport;
  importedRoute: ImportedCustomerRoute;
  assumptionState: BudgetAssumptionState;
  estimateControls?: TransparentEstimateControls;
}): CommercialCorridorDraft | null {
  if (!args.importedRoute.pricingEligible) return null;
  const geometry = args.importedRoute.dalGeometry?.length
    ? args.importedRoute.dalGeometry
    : (args.importedRoute.geometry ?? []).map((coordinate) => [coordinate.longitude, coordinate.latitude] as DALCoordinate);
  if (geometry.length < 2) return null;

  const routeMiles = round(args.importedRoute.routeMiles || args.importedRoute.routeFeet / 5280, 2);
  const routeFeet = Math.round(args.importedRoute.routeFeet || routeMiles * 5280);
  if (!routeMiles || !routeFeet) return null;

  const candidateId = `IMPORTED-${args.importRecord.importId}-${args.importedRoute.routeId}`.replace(/[^a-zA-Z0-9-]/g, "-");
  const routeId = `COMMERCIAL-DRAFT-${args.importedRoute.routeId}`.replace(/[^a-zA-Z0-9-]/g, "-");
  const constructionMix = args.assumptionState.civilMix;
  const weightedCivilCostPerFoot =
    (constructionMix.plowPercent / 100) * 5 +
    (constructionMix.hddPercent / 100) * 11 +
    (constructionMix.openCutPercent / 100) * 38;
  const routeSegments = buildSegments(candidateId, routeMiles, routeFeet, routeFeet, weightedCivilCostPerFoot);
  const aLabel = `${args.importedRoute.name} A`;
  const zLabel = `${args.importedRoute.name} Z`;
  const transparentEstimate = buildTransparentCorridorEstimate({
    estimateId: `${routeId}-TRANSPARENT-ESTIMATE`,
    routeId,
    scopeVersionLineage: `Customer Design Import / ${args.importRecord.designId}`,
    aLabel,
    zLabel,
    geometry,
    routeMiles,
    routeFeet,
    segmentCount: routeSegments.length,
    assumptionState: args.assumptionState,
    controls: args.estimateControls,
  });
  const quantities = transparentEstimate.physicalQuantities;
  const bom = transparentEstimate.materialLineItems.map((item) => lineItemFromEstimate("BOM", item));
  const labor = transparentEstimate.laborLineItems.filter((item) => (item.extendedCost.value ?? 0) > 0).map((item) => lineItemFromEstimate("LABOR", item));
  const materials = transparentEstimate.materialLineItems.map((item) => lineItemFromEstimate("MATERIAL", item));
  const ospLineItems = transparentEstimate.ospLineItems.map((item) => lineItemFromEstimate("OSP", item));
  const ilaRegenLineItems = [
    lineItem(
      "ILA_REGEN",
      `${candidateId}-ILA-FACILITIES`,
      "Hyperlinx-managed ILA facilities",
      transparentEstimate.ilaFacilities.length,
      "EA",
      transparentEstimate.ilaFacilities[0]?.total.value ?? 0,
    ),
  ];
  ilaRegenLineItems[0].source = "Transparent Estimating Engine";
  ilaRegenLineItems[0].workbook = transparentEstimate.ilaFacilities[0]?.workbook;
  ilaRegenLineItems[0].formula = "Bookend ILA sites + intermediate regen ILA sites x selected workbook facility profile.";
  const constructionCost = transparentEstimate.financialModel.constructionCost.value ?? 0;
  const totalCost = transparentEstimate.totalKnownCost;
  const sellPrice = transparentEstimate.sellPrice;
  const grossMarginPercent = transparentEstimate.grossMarginPercent;
  const financialAuthority = buildCommercialFinancialAuthority({
    constructionCost: totalCost,
    sellPrice,
    routeMiles,
    routeFeet,
    transparentEstimate,
  });
  const highwayCrossings = transparentEstimate.unknownQuantities.find((item) => item.unknownId === "DOT-CROSSINGS") ?? transparentEstimate.unknownQuantities[0]!;
  const railCrossings = transparentEstimate.unknownQuantities.find((item) => item.unknownId === "RAILROAD-CROSSINGS") ?? transparentEstimate.unknownQuantities[0]!;
  const waterCrossings = transparentEstimate.unknownQuantities.find((item) => item.unknownId === "WATER-CROSSINGS") ?? transparentEstimate.unknownQuantities[0]!;

  return {
    draftType: "NEW_GRAPH_CORRIDOR",
    candidateId,
    routeId,
    aLabel,
    zLabel,
    geometry,
    routeMiles,
    routeFeet,
    routeSegments,
    stationCount: quantities.stationCount,
    stationIntervalFeet: quantities.stationSpacingFeet,
    regenCount: quantities.regenCount,
    ilaCount: quantities.ilaCount,
    spliceCaseCount: quantities.spliceCaseCount,
    vaultCount: quantities.vaultCount,
    handholeCount: quantities.handholeCount,
    fiberFeet: quantities.purchasedFiberFeet,
    ductFeet: quantities.conduitFeet,
    highwayCrossings,
    railCrossings,
    waterCrossings,
    unknownQuantities: transparentEstimate.unknownQuantities,
    constructionMix: {
      hddPercent: transparentEstimate.civilMix.directionalBoreDirtPercent + transparentEstimate.civilMix.directionalBoreRockPercent,
      plowPercent: transparentEstimate.civilMix.plowPercent,
      openCutPercent: transparentEstimate.civilMix.openTrenchPercent,
      label: `${transparentEstimate.civilMix.plowPercent}% plow / ${transparentEstimate.civilMix.directionalBoreDirtPercent}% dirt bore / ${transparentEstimate.civilMix.directionalBoreRockPercent}% rock bore / ${transparentEstimate.civilMix.openTrenchPercent}% open trench`,
    },
    ilaFacilities: transparentEstimate.ilaFacilities,
    transparentEstimate,
    bom,
    labor,
    materials,
    ospLineItems,
    ilaRegenLineItems,
    constructionCost: financialAuthority.constructionCost,
    totalCost,
    financialAuthority,
    grossMarginDollars: financialAuthority.grossMarginDollars,
    nrcRevenue: financialAuthority.nrcRevenue,
    mrcRevenue: financialAuthority.mrcRevenue,
    lifecycleRevenue: financialAuthority.lifecycleRevenue,
    costPerMile: financialAuthority.costPerMile,
    costPerFoot: financialAuthority.costPerFoot,
    revenuePerMile: financialAuthority.revenuePerMile,
    revenuePerFoot: financialAuthority.revenuePerFoot,
    marginPerMile: financialAuthority.marginPerMile,
    sellPerFoot: financialAuthority.sellPerFoot,
    sellPrice,
    nrc: sellPrice,
    iruSellPrice: sellPrice,
    grossMarginPercent,
    financialValidationWarnings: financialAuthority.validationWarnings,
    vendorResponsePreview: [
      `Imported customer design: ${args.importRecord.customerName} / ${args.importedRoute.name}`,
      `${routeMiles.toLocaleString()} route miles from ${args.importRecord.sourceType} ${args.importRecord.sourceFileName}.`,
      `${quantities.ilaCount.toLocaleString()} Hyperlinx-managed ILA sites, ${quantities.spliceCaseCount.toLocaleString()} splice cases, ${quantities.vaultCount.toLocaleString()} vaults, ${quantities.handholeCount.toLocaleString()} handholes.`,
      `Budget ${money(totalCost).toLocaleString()} / Sell ${sellPrice.toLocaleString()} / GM ${grossMarginPercent}%.`,
      `Cost/mi ${money(totalCost / Math.max(routeMiles, 0.01)).toLocaleString()} / Cost/ft ${round(totalCost / Math.max(routeFeet, 1), 2).toLocaleString()}.`,
      `Revenue/mi ${money(sellPrice / Math.max(routeMiles, 0.01)).toLocaleString()} / Margin/mi ${money((sellPrice - totalCost) / Math.max(routeMiles, 0.01)).toLocaleString()}.`,
      `Estimate confidence ${transparentEstimate.confidence.score}% (${transparentEstimate.confidence.level}); imported customer geometry remains non-authoritative until Engineering validates it.`,
    ],
    supportingInformation: [
      "Imported customer route is treated as customer design evidence, not production inventory.",
      "Commercial pricing uses the Transparent Estimating Engine with the selected commercial assumptions.",
      "Opening this route in Engineering creates an immutable customer baseline for review.",
      "No ScopeVersion, CertifiedRoute, or Customer Twin mutation is created by pricing this imported route.",
      `Source folder: ${args.importedRoute.folderPath.join(" / ") || "Root"}.`,
      `Source style: ${args.importedRoute.sourceStyle ?? "None supplied"}.`,
      `Source description: ${args.importedRoute.sourceDescription ?? "None supplied"}.`,
    ],
    diagnostics: [
      "Commercial Draft built from imported customer design geometry.",
      "Imported customer geometry is immutable in Engineering until promoted through governed review.",
      "Attachment engine was not invoked for this imported route draft.",
      `Customer design state: ${args.importedRoute.designState}.`,
      `Import authority mode: ${args.importedRoute.provenance.authorityMode}.`,
    ],
    noScopeVersionCreation: true,
    noInventoryMutation: true,
  };
}
