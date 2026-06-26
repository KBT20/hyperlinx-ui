import type { CorridorTakeoff } from "../corridor/CorridorTakeoff";
import { createDefaultBudgetAssumptionState, type BudgetAssumptionState } from "./BudgetAssumptionState";
import { applyCostPlusPricing } from "./CostPlusPricingModel";
import type { FiberRoutePricingSummary } from "./FiberRoutePricingSummary";
import type { IlaRegenPricing, IlaRegenPricingProfile, IlaRegenSitePricing } from "./IlaRegenPricing";
import type { OspSegmentPricing, OspSegmentPricingLine } from "./OspSegmentPricing";
import { GOOGLE_DOBSON_REFERENCE_PRICING_PROFILE, type HyperscalerReferencePricingProfile } from "./fixtures/googleDobsonReferencePricingProfile";

export interface HyperscalerRoutePricingInput {
  segmentId: string;
  segmentName: string;
  aLocation: string;
  zLocation: string;
  fiberCount: number;
  takeoff: CorridorTakeoff;
}

export interface HyperscalerPricingResult {
  pricingId: string;
  profileId: string;
  routes: OspSegmentPricing[];
  ilaRegenPricing: IlaRegenPricing;
  fiberSummary: FiberRoutePricingSummary;
  diagnostics: string[];
  noProductionPricing: true;
  noBudgetLock: true;
  noExecutionAuthority: true;
}

export interface SplicingFormulaOutput {
  fiberRouteFeet: number;
  purchasedFiberFeet: number;
  reelLengthFeet: number;
  reelCount: number;
  fieldSpliceLocations: number;
  fiberCount: number;
  buttSplices: number;
  splicingUnitRate: number;
  splicingLaborTotal: number;
  formula: string;
}

function money(value: number) {
  return Math.round(value);
}

function safeUnit(value: number, denominator: number) {
  return denominator > 0 ? Number((value / denominator).toFixed(2)) : 0;
}

function line(args: Omit<OspSegmentPricingLine, "extendedCost" | "referenceDerived" | "developmentSeed" | "productionApproved">): OspSegmentPricingLine {
  return {
    ...args,
    extendedCost: money(args.quantity * args.unitRate),
    referenceDerived: true,
    developmentSeed: true,
    productionApproved: false,
  };
}

function sum(lines: Array<{ extendedCost: number }>) {
  return lines.reduce((total, item) => total + item.extendedCost, 0);
}

function lineId(segmentId: string, key: string) {
  return `${segmentId}:${key}`;
}

function defaultAssumptionState() {
  return createDefaultBudgetAssumptionState();
}

function materialSummaryForTakeoff(args: {
  takeoff: CorridorTakeoff;
  assumptionState: BudgetAssumptionState;
  spliceCaseEach: number;
  spliceCaseInstallationEach: number;
  fiberCount: number;
  splicingUnitRate: number;
}) {
  const { takeoff, assumptionState } = args;
  const fiberRouteFeet = Math.round(takeoff.fiberFeet);
  const vaultSlackFeet = takeoff.vaultCount * assumptionState.slack.vaultSlackFeet;
  const handholeSlackFeet = takeoff.handholeCount * assumptionState.slack.handholeSlackFeet;
  const fiberBeforeWaste = fiberRouteFeet + vaultSlackFeet + handholeSlackFeet;
  const fiberWasteFeet = Math.round(fiberBeforeWaste * (assumptionState.waste.fiberWastePercent / 100));
  const purchasedFiberFeet = fiberBeforeWaste + fiberWasteFeet;
  const routeConduitFeet = Math.round(takeoff.routeFeet);
  const standardDuctPackageConduitCount = assumptionState.materials.standardDuctPackageConduitCount;
  const standardDuctPackageFeet = routeConduitFeet * standardDuctPackageConduitCount;
  const routeInnerductFeet = assumptionState.materials.futurePathEnabled
    ? Math.round(takeoff.routeFeet * assumptionState.materials.futurePathMultiplier)
    : 0;
  const innerductWasteFeet = assumptionState.materials.futurePathEnabled
    ? Math.round(routeInnerductFeet * (assumptionState.waste.innerductWastePercent / 100))
    : 0;
  const splicing = calculateSplicingFormula({
    purchasedFiberFeet,
    reelLengthFeet: assumptionState.splicing.reelLengthFeet,
    fiberCount: args.fiberCount,
    splicingUnitRate: args.splicingUnitRate,
  });
  const spliceCases = splicing.fieldSpliceLocations;
  return {
    fiber: {
      routeFiberFeet: fiberRouteFeet,
      vaultSlackFeet,
      handholeSlackFeet,
      wasteFeet: fiberWasteFeet,
      purchasedFiberFeet,
      installedFiberFeet: fiberBeforeWaste + fiberWasteFeet,
      wastePercent: assumptionState.waste.fiberWastePercent,
    },
    conduit: {
      routeConduitFeet,
      standardDuctPackageConduitCount,
      standardDuctPackageFeet,
      vaultSlackFeet: 0,
      wasteFeet: 0,
      installedConduitFeet: standardDuctPackageFeet,
      wastePercent: assumptionState.waste.conduitWastePercent,
    },
    innerduct: {
      enabled: assumptionState.materials.futurePathEnabled,
      routeInnerductFeet,
      wasteFeet: innerductWasteFeet,
      installedInnerductFeet: routeInnerductFeet + innerductWasteFeet,
      wastePercent: assumptionState.waste.innerductWastePercent,
    },
    splicing: {
      ...splicing,
      spliceCases,
      spliceCaseMaterialCost: money(spliceCases * args.spliceCaseEach),
      spliceCaseInstallationCost: money(spliceCases * args.spliceCaseInstallationEach),
    },
  };
}

export function calculateSplicingFormula(args: {
  purchasedFiberFeet: number;
  reelLengthFeet: number;
  fiberCount: number;
  splicingUnitRate: number;
}): SplicingFormulaOutput {
  const reelCount = Math.max(1, Math.ceil(args.purchasedFiberFeet / args.reelLengthFeet));
  const fieldSpliceLocations = Math.max(0, reelCount - 1);
  const buttSplices = fieldSpliceLocations;
  return {
    fiberRouteFeet: Math.round(args.purchasedFiberFeet),
    purchasedFiberFeet: Math.round(args.purchasedFiberFeet),
    reelLengthFeet: args.reelLengthFeet,
    reelCount,
    fieldSpliceLocations,
    fiberCount: args.fiberCount,
    buttSplices,
    splicingUnitRate: args.splicingUnitRate,
    splicingLaborTotal: money(buttSplices * args.splicingUnitRate),
    formula: "Purchased fiber feet / reel length = reel count; reel count - 1 = field butt splice locations; each field butt splice location requires one splice case; field butt splice locations x unit rate = splicing labor.",
  };
}

export function priceOspSegment(
  input: HyperscalerRoutePricingInput,
  profile: HyperscalerReferencePricingProfile = GOOGLE_DOBSON_REFERENCE_PRICING_PROFILE,
  assumptionState: BudgetAssumptionState = defaultAssumptionState(),
): OspSegmentPricing {
  const rates = profile.ospRates;
  const takeoff = input.takeoff;
  const routeFeet = Math.round(takeoff.routeFeet);
  const boreFeet = Math.round(routeFeet * (assumptionState.civilMix.hddPercent / 100));
  const openCutFeet = Math.round(routeFeet * (assumptionState.civilMix.openCutPercent / 100));
  const plowFeet = Math.max(0, routeFeet - boreFeet - openCutFeet);
  const rockBorePercentage = Math.max(0, Math.min(100, Math.round(assumptionState.borePricing.rockBorePercent)));
  const dirtBorePercentage = 100 - rockBorePercentage;
  const rockFeet = Math.round(boreFeet * (rockBorePercentage / 100));
  const dirtOnlyBoreFeet = Math.max(0, boreFeet - rockFeet);
  const handholeCount = takeoff.handholeCount > 0 ? takeoff.handholeCount : Math.ceil(routeFeet / rates.handholeSpacingFeet);
  const materialSummary = materialSummaryForTakeoff({
    takeoff,
    assumptionState,
    spliceCaseEach: rates.spliceCaseEach,
    spliceCaseInstallationEach: rates.spliceCaseInstallationEach,
    fiberCount: input.fiberCount,
    splicingUnitRate: assumptionState.splicing.buttSpliceUnitRate,
  });
  const splicing = materialSummary.splicing;
  const bridgeWaterwayCount = takeoff.waterCrossingCount + takeoff.bridgeCrossingCount;

  const baseLines = [
    line({
      lineId: lineId(input.segmentId, "PLOW-LABOR"),
      category: "PLOW_LABOR",
      description: "Plow labor",
      quantity: plowFeet,
      unit: "FOOT",
      unitRate: rates.plowLaborPerFoot,
      sourceQuantity: "Route Feet x Plow %",
      costBasis: "$5 / ft reference-derived development seed",
      assumption: "Plow percentage is explicit and calculated from route feet.",
    }),
    line({
      lineId: lineId(input.segmentId, "BORE-LABOR"),
      category: "BORE_LABOR",
      description: "Base dirt bore labor",
      quantity: boreFeet,
      unit: "FOOT",
      unitRate: assumptionState.borePricing.baseBoreLaborPerFoot,
      sourceQuantity: "Route Feet x Dirt Bore %",
      costBasis: "$15 / LF base dirt bore reference-derived development seed",
      assumption: "Dirt Bore is a construction method. Base dirt bore labor applies to all Dirt Bore footage.",
    }),
    line({
      lineId: lineId(input.segmentId, "ROCK-ADDER"),
      category: "ROCK_ADDER",
      description: "Rock adder",
      quantity: rockFeet,
      unit: "FOOT",
      unitRate: assumptionState.borePricing.rockAdderPerFoot,
      sourceQuantity: "Dirt Bore Feet x Rock %",
      costBasis: "+$30 / ft rock adder; total rock bore $45 / ft",
      assumption: `${rockBorePercentage}% of Dirt Bore feet receive geology rock adder. Dirt % is derived at ${dirtBorePercentage}%.`,
    }),
    line({
      lineId: lineId(input.segmentId, "OPEN-CUT-LABOR"),
      category: "OPEN_CUT_LABOR",
      description: "Open cut labor",
      quantity: openCutFeet,
      unit: "FOOT",
      unitRate: rates.openCutLaborPerFoot,
      sourceQuantity: "Route Feet x Open Cut %",
      costBasis: "Explicit open cut development seed rate",
      assumption: "Open cut percentage is explicit and included in construction strategy total.",
    }),
    line({
      lineId: lineId(input.segmentId, "BRIDGE-WATERWAY"),
      category: "BRIDGE_WATERWAY_ALLOWANCE",
      description: "Bridge / waterway bore allowance",
      quantity: bridgeWaterwayCount,
      unit: "EACH",
      unitRate: rates.bridgeWaterwayBoreAllowanceEach,
      sourceQuantity: "CorridorTakeoff.waterCrossingCount + bridgeCrossingCount",
      costBasis: "Explicit each allowance; pending engineering crossing review",
      assumption: "Water and bridge crossings are not hidden in contingency.",
    }),
    line({
      lineId: lineId(input.segmentId, "CONDUIT"),
      category: "CONDUIT_MATERIAL",
      description: "Standard Duct Package (3 x 1.25\")",
      quantity: materialSummary.conduit.installedConduitFeet,
      unit: "FOOT",
      unitRate: rates.conduitMaterialPerFoot,
      sourceQuantity: "Route Feet x 3 standard 1.25\" HDPE conduits",
      costBasis: "Development seed material rate",
      assumption: "Standard duct package is 3 x 1.25\" HDPE conduit; one occupied, two retained for future inventory.",
    }),
    line({
      lineId: lineId(input.segmentId, "FUTUREPATH"),
      category: "INNERDUCT_FUTUREPATH",
      description: "FuturePath (Optional)",
      quantity: materialSummary.innerduct.installedInnerductFeet,
      unit: "FOOT",
      unitRate: rates.innerductFuturePathPerFoot,
      sourceQuantity: "Optional FuturePath route feet + innerduct waste",
      costBasis: "Development seed material rate",
      assumption: `FuturePath is optional and currently ${assumptionState.materials.futurePathEnabled ? "enabled" : "disabled"}; when enabled it is priced separately from the standard duct package.`,
    }),
    line({
      lineId: lineId(input.segmentId, "FIBER-MATERIAL"),
      category: "FIBER_MATERIAL",
      description: "Fiber material",
      quantity: materialSummary.fiber.installedFiberFeet,
      unit: "FOOT",
      unitRate: rates.fiberMaterialPerFoot,
      sourceQuantity: "Purchased Fiber = Route Fiber + Vault Slack + Handhole Slack + Waste",
      costBasis: "Development seed material rate",
      assumption: `Route fiber + ${assumptionState.slack.vaultSlackFeet} ft/vault + ${assumptionState.slack.handholeSlackFeet} ft/handhole + ${assumptionState.waste.fiberWastePercent}% waste.`,
    }),
    line({
      lineId: lineId(input.segmentId, "FIBER-PLACEMENT"),
      category: "FIBER_PLACEMENT_LABOR",
      description: "Fiber blowing / pulling labor",
      quantity: materialSummary.fiber.installedFiberFeet,
      unit: "FOOT",
      unitRate: rates.fiberPlacementLaborPerFoot,
      sourceQuantity: "Purchased Fiber",
      costBasis: "Development seed labor rate",
      assumption: "Placement labor is separate from material.",
    }),
    line({
      lineId: lineId(input.segmentId, "HANDHOLE-LABOR"),
      category: "HANDHOLE_LABOR",
      description: "Handhole labor",
      quantity: handholeCount,
      unit: "EACH",
      unitRate: rates.handholeLaborEach,
      sourceQuantity: "Spacing Assumption",
      costBasis: "$315 each reference-derived development seed",
      assumption: `Handhole spacing basis: 1 per ${rates.handholeSpacingFeet.toLocaleString()} ft.`,
    }),
    line({
      lineId: lineId(input.segmentId, "HANDHOLE-MATERIAL"),
      category: "HANDHOLE_MATERIAL",
      description: "Handhole material",
      quantity: handholeCount,
      unit: "EACH",
      unitRate: rates.handholeMaterialEach,
      sourceQuantity: "Spacing Assumption",
      costBasis: "$900 each reference-derived development seed",
      assumption: "Handhole material is explicit.",
    }),
    line({
      lineId: lineId(input.segmentId, "VAULT"),
      category: "VAULT_ALLOWANCE",
      description: "Vault allowance",
      quantity: takeoff.vaultCount,
      unit: "EACH",
      unitRate: rates.vaultAllowanceEach,
      sourceQuantity: "Spacing Assumption",
      costBasis: "Development seed each allowance",
      assumption: "Vaults are explicit if generated by takeoff.",
    }),
    line({
      lineId: lineId(input.segmentId, "SPLICE-CASE"),
      category: "SPLICE_CASE",
      description: "Splice case",
      quantity: materialSummary.splicing.spliceCases,
      unit: "EACH",
      unitRate: rates.spliceCaseEach,
      sourceQuantity: "Butt Splice Locations",
      costBasis: "$850 each reference-derived development seed",
      assumption: "Each field butt splice location requires one splice case.",
    }),
    line({
      lineId: lineId(input.segmentId, "SPLICE-CASE-INSTALL"),
      category: "SPLICING_LABOR",
      description: "Splice case installation",
      quantity: materialSummary.splicing.spliceCases,
      unit: "EACH",
      unitRate: rates.spliceCaseInstallationEach,
      sourceQuantity: "Butt Splice Locations",
      costBasis: "$315 each development seed installation allowance",
      assumption: "Splice case installation derives automatically from field butt splice locations.",
    }),
    line({
      lineId: lineId(input.segmentId, "SPLICING-LABOR"),
      category: "SPLICING_LABOR",
      description: "Splicing labor",
      quantity: splicing.fieldSpliceLocations,
      unit: "EACH",
      unitRate: rates.buttSpliceUnitRate,
      sourceQuantity: "Butt Splice Locations",
      costBasis: "Derived butt-splice location labor from purchased fiber reel-length formula",
      assumption: splicing.formula,
    }),
    line({
      lineId: lineId(input.segmentId, "ENGINEERING-PERMITTING"),
      category: "ENGINEERING_PERMITTING",
      description: "Engineering / permitting",
      quantity: routeFeet,
      unit: "FOOT",
      unitRate: rates.engineeringPermittingPerFoot,
      sourceQuantity: "CorridorTakeoff.routeFeet",
      costBasis: "$0.75 / ft reference-derived development seed",
      assumption: "Engineering and permitting are explicit per-foot costs.",
    }),
  ].filter((item) => item.quantity > 0);

  const subtotalBeforeProjectManagement = sum(baseLines);
  const projectManagementLine = rates.projectManagementPercent > 0
    ? line({
        lineId: lineId(input.segmentId, "PROJECT-MANAGEMENT"),
        category: "PROJECT_MANAGEMENT",
        description: "Project management",
        quantity: subtotalBeforeProjectManagement,
        unit: "PERCENT",
        unitRate: rates.projectManagementPercent / 100,
        sourceQuantity: "OSP segment subtotal before project management",
        costBasis: `${rates.projectManagementPercent}% explicit development seed`,
        assumption: "Project management is decomposed as an explicit line, not hidden General Conditions.",
      })
    : null;

  const linesBeforeContingency = projectManagementLine ? [...baseLines, projectManagementLine] : baseLines;
  const segmentSubtotal = sum(linesBeforeContingency);
  const contingencyAmount = money(segmentSubtotal * (rates.contingencyPercent / 100));
  const contingencyLine = line({
    lineId: lineId(input.segmentId, "CONTINGENCY"),
    category: "CONTINGENCY",
    description: "Segment contingency",
    quantity: segmentSubtotal,
    unit: "PERCENT",
    unitRate: rates.contingencyPercent / 100,
    sourceQuantity: "OSP segment subtotal",
    costBasis: `${rates.contingencyPercent}% explicit configurable contingency`,
    assumption: rates.contingencyReason,
  });
  const lineItems = [...linesBeforeContingency, contingencyLine];
  const segmentTotal = segmentSubtotal + contingencyAmount;

  return {
    segmentId: input.segmentId,
    segmentName: input.segmentName,
    aLocation: input.aLocation,
    zLocation: input.zLocation,
    routeMiles: takeoff.routeMiles,
    totalRouteFeet: routeFeet,
    borePercentage: assumptionState.civilMix.hddPercent,
    plowPercentage: assumptionState.civilMix.plowPercent,
    openCutPercentage: assumptionState.civilMix.openCutPercent,
    rockBorePercentage,
    dirtBorePercentage,
    boreFeet,
    dirtOnlyBoreFeet,
    rockBoreFeet: rockFeet,
    plowFeet,
    openCutFeet,
    baseBoreCost: money(boreFeet * assumptionState.borePricing.baseBoreLaborPerFoot),
    rockAdderCost: money(rockFeet * assumptionState.borePricing.rockAdderPerFoot),
    totalRockBoreCost: money(boreFeet * assumptionState.borePricing.baseBoreLaborPerFoot + rockFeet * assumptionState.borePricing.rockAdderPerFoot),
    totalDirtBoreCost: money(boreFeet * assumptionState.borePricing.baseBoreLaborPerFoot + rockFeet * assumptionState.borePricing.rockAdderPerFoot),
    lineItems,
    segmentSubtotal,
    contingency: {
      percentage: rates.contingencyPercent,
      appliedTo: "SEGMENT_SUBTOTAL",
      reason: rates.contingencyReason,
      amount: contingencyAmount,
    },
    segmentTotal,
    costPerFoot: safeUnit(segmentTotal, routeFeet),
    costPerMile: safeUnit(segmentTotal, takeoff.routeMiles),
    diagnostics: [
      `[OSP_SEGMENT_PRICED] segmentId=${input.segmentId}`,
      `constructionStrategy=dirtBore:${assumptionState.civilMix.hddPercent},plow:${assumptionState.civilMix.plowPercent},openCut:${assumptionState.civilMix.openCutPercent}`,
      `geology=rock:${rockBorePercentage},dirt:${dirtBorePercentage},rockAdderAppliesToFeet:${rockFeet}`,
      `installedFiberFeet=${materialSummary.fiber.installedFiberFeet}`,
      `splicingLabor=${splicing.splicingLaborTotal} buttSplices=${splicing.buttSplices} reelLengthFeet=${splicing.reelLengthFeet}`,
      `contingency=${rates.contingencyPercent}% appliedTo=SEGMENT_SUBTOTAL reason=${rates.contingencyReason}`,
      "No unexplained General Conditions included.",
    ],
  };
}

function profileCost(profile: IlaRegenPricingProfile) {
  return sum(profile.lineItems);
}

export function priceIlaRegenSites(args: {
  routeInputs: HyperscalerRoutePricingInput[];
  profile?: HyperscalerReferencePricingProfile;
}): IlaRegenPricing {
  const profile = args.profile ?? GOOGLE_DOBSON_REFERENCE_PRICING_PROFILE;
  const selected = profile.ilaProfiles.find((candidate) => candidate.profileId === profile.selectedIlaProfileId) ?? profile.ilaProfiles[0];
  const siteCount = args.routeInputs.reduce((count, route) => count + route.takeoff.regenSiteCount, 0);
  const sitePricings: IlaRegenSitePricing[] = Array.from({ length: siteCount }, (_, index) => {
    const costPlus = applyCostPlusPricing({
      budgetCost: profileCost(selected),
      markup: profile.markup,
      traceability: [
        "Dobson ILA Cost Summary 27 vs 36 Racks.xlsx",
        selected.profileId,
        "IlaRegenSitePricing.budgetCost",
      ],
    });
    return {
      siteId: `ILA-REGEN-${index + 1}`,
      siteName: `Regen / ILA ${String(index + 1).padStart(2, "0")}`,
      profileId: selected.profileId,
      rackCount: selected.rackCount,
      lineItems: selected.lineItems,
      budgetCost: profileCost(selected),
      costPlus,
      engineeringValidationRequired: true,
    };
  });
  return {
    pricingId: `ILA-REGEN-${profile.profileId}`,
    selectedProfileId: selected.profileId,
    siteCount,
    sitePricings,
    totalBudgetCost: sitePricings.reduce((total, site) => total + site.budgetCost, 0),
    totalSellPrice: sitePricings.reduce((total, site) => total + site.costPlus.sellPrice, 0),
    sourceReferences: profile.sourceReferences,
    referenceDerived: true,
    developmentSeed: true,
    productionApproved: false,
  };
}

function lineCost(routes: OspSegmentPricing[], category: string) {
  return routes.flatMap((route) => route.lineItems).filter((item) => item.category === category).reduce((total, item) => total + item.extendedCost, 0);
}

export function priceHyperscalerRoutes(args: {
  pricingId: string;
  routes: HyperscalerRoutePricingInput[];
  profile?: HyperscalerReferencePricingProfile;
  assumptionState?: BudgetAssumptionState;
}): HyperscalerPricingResult {
  const profile = args.profile ?? GOOGLE_DOBSON_REFERENCE_PRICING_PROFILE;
  const assumptionState = args.assumptionState ?? defaultAssumptionState();
  const routes = args.routes.map((route) => priceOspSegment(route, profile, assumptionState));
  const aggregateTakeoff = args.routes.reduce((summary, route) => ({
    routeFiberFeet: summary.routeFiberFeet + route.takeoff.fiberFeet,
    routeConduitFeet: summary.routeConduitFeet + route.takeoff.routeFeet,
    vaultCount: summary.vaultCount + route.takeoff.vaultCount,
    handholeCount: summary.handholeCount + route.takeoff.handholeCount,
  }), {
    routeFiberFeet: 0,
    routeConduitFeet: 0,
    vaultCount: 0,
    handholeCount: 0,
  });
  const vaultSlackFeet = aggregateTakeoff.vaultCount * assumptionState.slack.vaultSlackFeet;
  const handholeSlackFeet = aggregateTakeoff.handholeCount * assumptionState.slack.handholeSlackFeet;
  const fiberBeforeWaste = aggregateTakeoff.routeFiberFeet + vaultSlackFeet + handholeSlackFeet;
  const fiberWasteFeet = Math.round(fiberBeforeWaste * (assumptionState.waste.fiberWastePercent / 100));
  const purchasedFiberFeet = fiberBeforeWaste + fiberWasteFeet;
  const standardDuctPackageFeet = aggregateTakeoff.routeConduitFeet * assumptionState.materials.standardDuctPackageConduitCount;
  const routeInnerductFeet = assumptionState.materials.futurePathEnabled
    ? Math.round(aggregateTakeoff.routeConduitFeet * assumptionState.materials.futurePathMultiplier)
    : 0;
  const innerductWasteFeet = assumptionState.materials.futurePathEnabled
    ? Math.round(routeInnerductFeet * (assumptionState.waste.innerductWastePercent / 100))
    : 0;
  const splicing = calculateSplicingFormula({
    purchasedFiberFeet,
    reelLengthFeet: assumptionState.splicing.reelLengthFeet,
    fiberCount: args.routes[0]?.fiberCount ?? 0,
    splicingUnitRate: assumptionState.splicing.buttSpliceUnitRate,
  });
  const ilaRegenPricing = priceIlaRegenSites({ routeInputs: args.routes, profile });
  const totalRouteMiles = routes.reduce((total, route) => total + route.routeMiles, 0);
  const totalRouteFeet = routes.reduce((total, route) => total + route.totalRouteFeet, 0);
  const totalOspCost = routes.reduce((total, route) => total + route.segmentTotal, 0);
  const totalBudgetCost = totalOspCost + ilaRegenPricing.totalBudgetCost;
  const costPlus = applyCostPlusPricing({
    budgetCost: totalBudgetCost,
    markup: profile.markup,
    traceability: [
      "Route Segment",
      "OSP Unit Costs",
      "ILA / Regen Sites",
      "Fiber Summary",
      "Budget Cost",
      "Markup / Points",
      "Sell Price / IRU",
    ],
  });
  const fiberSummary: FiberRoutePricingSummary = {
    pricingSummaryId: `FIBER-SUMMARY-${args.pricingId}`,
    totalRouteMiles,
    totalRouteFeet,
    fiberCount: args.routes[0]?.fiberCount ?? 0,
    fiberMaterialCost: lineCost(routes, "FIBER_MATERIAL"),
    conduitMaterialCost: lineCost(routes, "CONDUIT_MATERIAL"),
    innerductFuturePathCost: lineCost(routes, "INNERDUCT_FUTUREPATH"),
    placementLaborCost: lineCost(routes, "FIBER_PLACEMENT_LABOR"),
    splicingCost: lineCost(routes, "SPLICING_LABOR") + lineCost(routes, "SPLICE_CASE"),
    testingCost: args.routes.reduce((total, route) => total + Math.max(1, route.takeoff.splicePointCount) * profile.ospRates.testingAllowanceEach, 0),
    totalOspCost,
    totalIlaRegenCost: ilaRegenPricing.totalBudgetCost,
    totalBudgetCost,
    costPlus,
    averageCostPerRouteMile: safeUnit(totalBudgetCost, totalRouteMiles),
    averageSellPricePerRouteMile: safeUnit(costPlus.sellPrice, totalRouteMiles),
    averageCostPerFoot: safeUnit(totalBudgetCost, totalRouteFeet),
    averageSellPricePerFoot: safeUnit(costPlus.sellPrice, totalRouteFeet),
    materialSummary: {
      fiber: {
        routeFiberFeet: Math.round(aggregateTakeoff.routeFiberFeet),
        vaultSlackFeet,
        handholeSlackFeet,
        wasteFeet: fiberWasteFeet,
        purchasedFiberFeet: Math.round(purchasedFiberFeet),
        installedFiberFeet: Math.round(purchasedFiberFeet),
        wastePercent: assumptionState.waste.fiberWastePercent,
      },
      conduit: {
        routeConduitFeet: Math.round(aggregateTakeoff.routeConduitFeet),
        standardDuctPackageConduitCount: assumptionState.materials.standardDuctPackageConduitCount,
        standardDuctPackageFeet: Math.round(standardDuctPackageFeet),
        vaultSlackFeet: 0,
        wasteFeet: 0,
        installedConduitFeet: Math.round(standardDuctPackageFeet),
        wastePercent: assumptionState.waste.conduitWastePercent,
      },
      innerduct: {
        enabled: assumptionState.materials.futurePathEnabled,
        routeInnerductFeet,
        wasteFeet: innerductWasteFeet,
        installedInnerductFeet: Math.round(routeInnerductFeet + innerductWasteFeet),
        wastePercent: assumptionState.waste.innerductWastePercent,
      },
      splicing: {
        ...splicing,
        spliceCases: splicing.fieldSpliceLocations,
        spliceCaseMaterialCost: money(splicing.fieldSpliceLocations * profile.ospRates.spliceCaseEach),
        spliceCaseInstallationCost: money(splicing.fieldSpliceLocations * profile.ospRates.spliceCaseInstallationEach),
      },
    },
    validationReference: {
      totalRouteMiles: 445.1,
      estimatedCost: 67140000,
      iruPrice: 80570000,
      averageSellPerRouteMile: 181005,
      averageSellPerFoot: 34.28,
      referenceOnly: true,
    },
    noProductionPricing: true,
    noBudgetLock: true,
    noExecutionAuthority: true,
  };
  return {
    pricingId: args.pricingId,
    profileId: profile.profileId,
    routes,
    ilaRegenPricing,
    fiberSummary,
    diagnostics: [
      `[HYPERSCALER_PRICING_CREATED] pricingId=${args.pricingId}`,
      `assumptionStateId=${assumptionState.stateId}`,
      `budgetCost=${fiberSummary.totalBudgetCost}`,
      `markupPoints=${profile.markup.points}`,
      `sellPrice=${fiberSummary.costPlus.sellPrice}`,
      "Reference-derived development seed; not production pricing.",
    ],
    noProductionPricing: true,
    noBudgetLock: true,
    noExecutionAuthority: true,
  };
}
