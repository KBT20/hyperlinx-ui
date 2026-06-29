import type { DALCoordinate } from "../types/dal";
import { GOOGLE_DOBSON_REFERENCE_PRICING_PROFILE } from "./fixtures/googleDobsonReferencePricingProfile";
import type { IlaRegenLineItem } from "./IlaRegenPricing";

export type IlaPlacementMethod = "MAX_SPAN" | "MAX_OPTICAL_LOSS" | "MAX_ATTENUATION" | "INTERMEDIATE_COUNT";
export type IlaFacilityProfileId =
  | "ILA_36_RACK_DOUBLE_WIDE"
  | "ILA_72_RACK_COMPOUND"
  | "ILA_144_RACK_COMPOUND"
  | "ILA_CUSTOM";

export interface IlaStationOverride {
  milepost?: number;
  facilityProfileId?: IlaFacilityProfileId;
}

export interface IlaPlanningControls {
  useBookendIlas: boolean;
  placementMethod: IlaPlacementMethod;
  maxSpanMiles: number;
  maxOpticalLossDb: number;
  maxAttenuationDb: number;
  desiredIntermediateIlas: number;
  defaultFacilityProfileId: IlaFacilityProfileId;
  attenuationDbPerKm: number;
  connectorLossDb: number;
  spliceLossDb: number;
  opticalBudgetDb: number;
  customFacilityCost: number;
  selectedStationId?: string | null;
  stationOverrides?: Record<string, IlaStationOverride>;
}

export interface IlaFacilityCostProfile {
  profileId: IlaFacilityProfileId;
  label: string;
  facilityType: string;
  rackCount: number;
  buildingProfile: string;
  powerProfile: string;
  hvacProfile: string;
  generatorProfile: string;
  civilProfile: string;
  laborProfile: string;
  equipmentProfile: string;
  materialProfile: string;
  siteLandCost: number;
  civilCost: number;
  laborCost: number;
  equipmentCost: number;
  materialCost: number;
  totalCost: number;
  workbook: string;
  lineItems: IlaRegenLineItem[];
}

export interface IlaStationObject {
  stationId: string;
  graphNodeId: string;
  stationType: "START_BOOKEND" | "INTERMEDIATE" | "END_BOOKEND";
  label: string;
  station: string;
  ordinal: number;
  milepost: number;
  ratio: number;
  gps: string;
  coordinate: DALCoordinate;
  routeId: string;
  scopeVersionLineage: string;
  facilityProfileId: IlaFacilityProfileId;
  facilityProfile: IlaFacilityCostProfile;
  facilityType: string;
  powerProfile: string;
  hvacProfile: string;
  generatorProfile: string;
  rackProfile: string;
  costProfile: string;
  segmentFromPreviousMiles: number;
  attenuationLossDb: number;
  connectorLossDb: number;
  spliceLossDb: number;
  spanLossDb: number;
  remainingBudgetDb: number;
  recommendedRegen: boolean;
  canMove: boolean;
  totalCost: number;
}

export interface IlaOpticalSpan {
  spanId: string;
  fromStationId: string;
  toStationId: string;
  fromLabel: string;
  toLabel: string;
  segmentLengthMiles: number;
  attenuationLossDb: number;
  connectorLossDb: number;
  spliceLossDb: number;
  spanLossDb: number;
  remainingBudgetDb: number;
  recommendedRegen: boolean;
}

export interface IlaPlanningRecommendation {
  recommendedIntermediateIlas: number;
  addedStations: number;
  removedStations: number;
  movedStations: number;
  costDifference: number;
  opticalDifferenceDb: number;
  lifecycleDifference: number;
  constructionDifference: number;
  requiresApproval: boolean;
  reason: string;
}

export interface IlaPlanningResult {
  routeId: string;
  scopeVersionLineage: string;
  routeMiles: number;
  routeFeet: number;
  method: IlaPlacementMethod;
  controls: IlaPlanningControls;
  stationObjects: IlaStationObject[];
  spans: IlaOpticalSpan[];
  availableProfiles: IlaFacilityCostProfile[];
  recommendedIntermediateIlas: number;
  recommendation: IlaPlanningRecommendation;
  totalCost: number;
  averageSpanMiles: number;
  maxSpanMiles: number;
  maxSpanLossDb: number;
  remainingBudgetDb: number;
  graphObjectCount: number;
}

const EARTH_RADIUS_MILES = 3958.7613;
const DOBSON_ILA_WORKBOOK = "Dobson ILA Cost Summary 27 vs 36 Racks.xlsx / 27 vs 36 ILA Rack Costs";
const PER_ILA_COST_WORKBOOK = "Google Fiber Project - 20251121.xlsx / Per ILA Cost";

export const DEFAULT_ILA_PLANNING_CONTROLS: IlaPlanningControls = {
  useBookendIlas: true,
  placementMethod: "MAX_SPAN",
  maxSpanMiles: 45,
  maxOpticalLossDb: 13.5,
  maxAttenuationDb: 11.25,
  desiredIntermediateIlas: 0,
  defaultFacilityProfileId: "ILA_36_RACK_DOUBLE_WIDE",
  attenuationDbPerKm: 0.25,
  connectorLossDb: 1,
  spliceLossDb: 0.05,
  opticalBudgetDb: 24,
  customFacilityCost: 1872600,
  selectedStationId: null,
  stationOverrides: {},
};

function round(value: number, places = 2) {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function normalizeIlaPlanningControls(controls?: Partial<IlaPlanningControls>): IlaPlanningControls {
  return {
    ...DEFAULT_ILA_PLANNING_CONTROLS,
    ...(controls ?? {}),
    desiredIntermediateIlas: Math.max(0, Math.round(controls?.desiredIntermediateIlas ?? DEFAULT_ILA_PLANNING_CONTROLS.desiredIntermediateIlas)),
    maxSpanMiles: Math.max(1, controls?.maxSpanMiles ?? DEFAULT_ILA_PLANNING_CONTROLS.maxSpanMiles),
    maxOpticalLossDb: Math.max(1, controls?.maxOpticalLossDb ?? DEFAULT_ILA_PLANNING_CONTROLS.maxOpticalLossDb),
    maxAttenuationDb: Math.max(1, controls?.maxAttenuationDb ?? DEFAULT_ILA_PLANNING_CONTROLS.maxAttenuationDb),
    attenuationDbPerKm: Math.max(0.01, controls?.attenuationDbPerKm ?? DEFAULT_ILA_PLANNING_CONTROLS.attenuationDbPerKm),
    connectorLossDb: Math.max(0, controls?.connectorLossDb ?? DEFAULT_ILA_PLANNING_CONTROLS.connectorLossDb),
    spliceLossDb: Math.max(0, controls?.spliceLossDb ?? DEFAULT_ILA_PLANNING_CONTROLS.spliceLossDb),
    opticalBudgetDb: Math.max(1, controls?.opticalBudgetDb ?? DEFAULT_ILA_PLANNING_CONTROLS.opticalBudgetDb),
    customFacilityCost: Math.max(0, controls?.customFacilityCost ?? DEFAULT_ILA_PLANNING_CONTROLS.customFacilityCost),
    stationOverrides: { ...(controls?.stationOverrides ?? {}) },
  };
}

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

function distanceMiles(a: DALCoordinate, b: DALCoordinate) {
  const lon1 = toRadians(a[0]);
  const lat1 = toRadians(a[1]);
  const lon2 = toRadians(b[0]);
  const lat2 = toRadians(b[1]);
  const dLat = lat2 - lat1;
  const dLon = lon2 - lon1;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_MILES * Math.asin(Math.min(1, Math.sqrt(h)));
}

function routeMeasures(geometry: DALCoordinate[]) {
  const measures = [0];
  for (let index = 1; index < geometry.length; index += 1) {
    measures[index] = measures[index - 1] + distanceMiles(geometry[index - 1], geometry[index]);
  }
  return measures;
}

function pointAtMilepost(geometry: DALCoordinate[], measures: number[], milepost: number): DALCoordinate {
  if (!geometry.length) return [0, 0];
  if (geometry.length === 1) return geometry[0];
  const routeMiles = measures.at(-1) ?? 0;
  const target = clamp(milepost, 0, routeMiles);
  for (let index = 1; index < measures.length; index += 1) {
    if (measures[index] < target) continue;
    const start = measures[index - 1];
    const end = measures[index];
    const ratio = end > start ? (target - start) / (end - start) : 0;
    const a = geometry[index - 1];
    const b = geometry[index];
    return [
      a[0] + (b[0] - a[0]) * ratio,
      a[1] + (b[1] - a[1]) * ratio,
    ];
  }
  return geometry.at(-1) ?? geometry[0];
}

function lineItemWithScale(item: IlaRegenLineItem, profileId: IlaFacilityProfileId, scale: number): IlaRegenLineItem {
  const unitCost = round(item.unitCost * scale, 0);
  return {
    ...item,
    lineItemId: `${profileId}:${item.description.replaceAll(/[^A-Za-z0-9]+/g, "_")}`,
    unitCost,
    extendedCost: unitCost * item.quantity,
  };
}

function customLineItem(cost: number): IlaRegenLineItem {
  return {
    lineItemId: "ILA_CUSTOM:ESTIMATOR_CUSTOM_COST_PROFILE",
    category: "SITE_CONSTRUCTION",
    description: "Estimator custom facility profile",
    quantity: 1,
    unit: "ALLOWANCE",
    unitCost: Math.round(cost),
    extendedCost: Math.round(cost),
    source: "DOBSON_REFERENCE_WORKBOOK",
    referenceDerived: true,
    developmentSeed: true,
    productionApproved: false,
  };
}

function lineItemCategoryCost(lineItems: IlaRegenLineItem[], category: IlaRegenLineItem["category"]) {
  return lineItems.filter((item) => item.category === category).reduce((total, item) => total + item.extendedCost, 0);
}

function keywordCost(lineItems: IlaRegenLineItem[], keywords: string[]) {
  return lineItems
    .filter((item) => keywords.some((keyword) => item.description.toLowerCase().includes(keyword)))
    .reduce((total, item) => total + item.extendedCost, 0);
}

function costProfile(args: {
  profileId: IlaFacilityProfileId;
  label: string;
  facilityType: string;
  rackCount: number;
  buildingProfile: string;
  powerProfile: string;
  hvacProfile: string;
  generatorProfile: string;
  lineItems: IlaRegenLineItem[];
}): IlaFacilityCostProfile {
  const siteLandCost = lineItemCategoryCost(args.lineItems, "SITE_LAND");
  const siteConstructionCost = lineItemCategoryCost(args.lineItems, "SITE_CONSTRUCTION");
  const fitOutCost = lineItemCategoryCost(args.lineItems, "TELECOM_FIT_OUT");
  const laborCost = keywordCost(args.lineItems, ["labor", "commissioning", "testing", "survey"]);
  const equipmentCost = keywordCost(args.lineItems, ["generator", "hvac", "rack", "rectifier", "battery", "fdu", "ats", "fiber guide", "splice enclosure", "power"]);
  const materialCost = Math.max(0, fitOutCost - laborCost);
  const civilCost = Math.max(0, siteLandCost + siteConstructionCost - equipmentCost);
  const totalCost = args.lineItems.reduce((total, item) => total + item.extendedCost, 0);
  return {
    profileId: args.profileId,
    label: args.label,
    facilityType: args.facilityType,
    rackCount: args.rackCount,
    buildingProfile: args.buildingProfile,
    powerProfile: args.powerProfile,
    hvacProfile: args.hvacProfile,
    generatorProfile: args.generatorProfile,
    civilProfile: `${args.buildingProfile} civil/site package`,
    laborProfile: "Workbook installation, testing, survey, and commissioning labor",
    equipmentProfile: "Workbook power, generator, HVAC, rack, FDU, battery, and optical equipment",
    materialProfile: "Workbook telecom fit-out and site material allowances",
    siteLandCost,
    civilCost,
    laborCost,
    equipmentCost,
    materialCost,
    totalCost,
    workbook: `${DOBSON_ILA_WORKBOOK}; ${PER_ILA_COST_WORKBOOK}`,
    lineItems: args.lineItems,
  };
}

export function buildIlaFacilityProfiles(customFacilityCost = DEFAULT_ILA_PLANNING_CONTROLS.customFacilityCost): IlaFacilityCostProfile[] {
  const profile36 = GOOGLE_DOBSON_REFERENCE_PRICING_PROFILE.ilaProfiles.find((profile) => profile.profileId === "ILA_36_RACK_DOUBLE_WIDE");
  const base36 = profile36?.lineItems ?? [];
  const profile36Cost = costProfile({
    profileId: "ILA_36_RACK_DOUBLE_WIDE",
    label: "36 Rack",
    facilityType: "36 Rack",
    rackCount: 36,
    buildingProfile: "Double-wide prefab shelter",
    powerProfile: "Commercial service, ATS, DC power, battery plant",
    hvacProfile: "Dual HVAC wall-pack profile",
    generatorProfile: "300KW generator profile",
    lineItems: base36.map((item) => lineItemWithScale(item, "ILA_36_RACK_DOUBLE_WIDE", 1)),
  });
  const profile72 = costProfile({
    profileId: "ILA_72_RACK_COMPOUND",
    label: "72 Rack",
    facilityType: "72 Rack",
    rackCount: 72,
    buildingProfile: "Dual double-wide compound",
    powerProfile: "Expanded commercial service, dual ATS, larger DC plant",
    hvacProfile: "Four HVAC wall-pack profile",
    generatorProfile: "Dual 300KW generator profile",
    lineItems: base36.map((item) => lineItemWithScale(item, "ILA_72_RACK_COMPOUND", item.category === "TELECOM_FIT_OUT" ? 2 : 1.55)),
  });
  const profile144 = costProfile({
    profileId: "ILA_144_RACK_COMPOUND",
    label: "144 Rack",
    facilityType: "144 Rack",
    rackCount: 144,
    buildingProfile: "Multi-building ILA compound",
    powerProfile: "High-capacity commercial service, redundant ATS and DC plant",
    hvacProfile: "Eight HVAC wall-pack profile",
    generatorProfile: "Redundant multi-generator profile",
    lineItems: base36.map((item) => lineItemWithScale(item, "ILA_144_RACK_COMPOUND", item.category === "TELECOM_FIT_OUT" ? 4 : 2.65)),
  });
  const custom = costProfile({
    profileId: "ILA_CUSTOM",
    label: "Custom",
    facilityType: "Custom",
    rackCount: 0,
    buildingProfile: "Estimator-defined custom profile",
    powerProfile: "Estimator-defined power profile",
    hvacProfile: "Estimator-defined HVAC profile",
    generatorProfile: "Estimator-defined generator profile",
    lineItems: [customLineItem(customFacilityCost)],
  });
  return [profile36Cost, profile72, profile144, custom];
}

function spanLimitFromControls(controls: IlaPlanningControls) {
  const attenuationDbPerMile = controls.attenuationDbPerKm * 1.609344;
  if (controls.placementMethod === "MAX_OPTICAL_LOSS") {
    return Math.max(1, (controls.maxOpticalLossDb - controls.connectorLossDb - controls.spliceLossDb) / attenuationDbPerMile);
  }
  if (controls.placementMethod === "MAX_ATTENUATION") {
    return Math.max(1, controls.maxAttenuationDb / attenuationDbPerMile);
  }
  return Math.max(1, controls.maxSpanMiles);
}

function recommendedIntermediateCount(routeMiles: number, controls: IlaPlanningControls) {
  const spanLimit = spanLimitFromControls(controls);
  return Math.max(0, Math.ceil(routeMiles / spanLimit) - 1);
}

function stationSeed(id: string, stationType: IlaStationObject["stationType"], milepost: number) {
  return { id, stationType, milepost };
}

function gpsLabel(coordinate: DALCoordinate) {
  return `${coordinate[1]?.toFixed(6) ?? "0.000000"}, ${coordinate[0]?.toFixed(6) ?? "0.000000"}`;
}

function spanLoss(lengthMiles: number, controls: IlaPlanningControls) {
  const attenuationLossDb = lengthMiles * controls.attenuationDbPerKm * 1.609344;
  const connectorLossDb = controls.connectorLossDb;
  const spliceLossDb = controls.spliceLossDb;
  const total = attenuationLossDb + connectorLossDb + spliceLossDb;
  return {
    attenuationLossDb: round(attenuationLossDb, 2),
    connectorLossDb: round(connectorLossDb, 2),
    spliceLossDb: round(spliceLossDb, 2),
    spanLossDb: round(total, 2),
    remainingBudgetDb: round(controls.opticalBudgetDb - total, 2),
    recommendedRegen: total > controls.opticalBudgetDb,
  };
}

export function buildIlaPlanningResult(args: {
  estimateId: string;
  routeId?: string;
  scopeVersionLineage?: string;
  aLabel: string;
  zLabel: string;
  geometry: DALCoordinate[];
  routeMiles: number;
  controls?: Partial<IlaPlanningControls>;
}): IlaPlanningResult {
  const controls = normalizeIlaPlanningControls(args.controls);
  const routeId = args.routeId ?? `${args.estimateId}:COMMERCIAL-CORRIDOR`;
  const scopeVersionLineage = args.scopeVersionLineage ?? "Commercial Draft / no ScopeVersion";
  const routeMiles = Math.max(0, round(args.routeMiles, 4));
  const routeFeet = Math.round(routeMiles * 5280);
  const geometry: DALCoordinate[] = args.geometry.length ? args.geometry : [[0, 0], [routeMiles / 69, 0]];
  const measures = routeMeasures(geometry);
  const measuredRouteMiles = measures.at(-1) ?? routeMiles;
  const stationRouteMiles = measuredRouteMiles > 0 ? measuredRouteMiles : routeMiles;
  const availableProfiles = buildIlaFacilityProfiles(controls.customFacilityCost);
  const profileById = new Map(availableProfiles.map((profile) => [profile.profileId, profile]));
  const recommendedIntermediateIlas = recommendedIntermediateCount(routeMiles, controls);
  const intermediateCount = controls.placementMethod === "INTERMEDIATE_COUNT"
    ? controls.desiredIntermediateIlas
    : recommendedIntermediateIlas;
  const seeds = [
    ...(controls.useBookendIlas ? [stationSeed("ILA-BOOKEND-START", "START_BOOKEND" as const, 0)] : []),
    ...Array.from({ length: intermediateCount }, (_, index) => {
      const ratio = (index + 1) / (intermediateCount + 1);
      return stationSeed(`ILA-INT-${String(index + 1).padStart(3, "0")}`, "INTERMEDIATE" as const, round(routeMiles * ratio, 2));
    }),
    ...(controls.useBookendIlas ? [stationSeed("ILA-BOOKEND-END", "END_BOOKEND" as const, routeMiles)] : []),
  ];
  const sortedSeeds = seeds
    .map((seed) => {
      const override = controls.stationOverrides?.[seed.id];
      const canMove = seed.stationType === "INTERMEDIATE";
      return {
        ...seed,
        milepost: canMove && typeof override?.milepost === "number" ? clamp(override.milepost, 0, routeMiles) : seed.milepost,
        facilityProfileId: override?.facilityProfileId ?? controls.defaultFacilityProfileId,
      };
    })
    .sort((a, b) => a.milepost - b.milepost);
  const stations = sortedSeeds.map((seed, index) => {
    const previousMilepost = index === 0 ? 0 : sortedSeeds[index - 1].milepost;
    const segmentFromPreviousMiles = Math.max(0, seed.milepost - previousMilepost);
    const coordinate = pointAtMilepost(geometry, measures, stationRouteMiles > 0 ? (seed.milepost / Math.max(routeMiles, 0.0001)) * stationRouteMiles : 0);
    const profile = profileById.get(seed.facilityProfileId) ?? availableProfiles[0];
    const stationNumber = seed.stationType === "START_BOOKEND"
      ? "Station 0"
      : seed.stationType === "END_BOOKEND"
        ? `Station ${round(routeMiles, 1)}`
        : `Station ${round(seed.milepost, 1)}`;
    const label = seed.stationType === "START_BOOKEND"
      ? "Start Bookend"
      : seed.stationType === "END_BOOKEND"
        ? "End Bookend"
        : `Intermediate ILA ${sortedSeeds.filter((candidate) => candidate.stationType === "INTERMEDIATE" && candidate.milepost <= seed.milepost).length}`;
    const optical = spanLoss(segmentFromPreviousMiles, controls);
    return {
      stationId: seed.id,
      graphNodeId: `${routeId}:${seed.id}`,
      stationType: seed.stationType,
      label,
      station: stationNumber,
      ordinal: index + 1,
      milepost: round(seed.milepost, 2),
      ratio: routeMiles > 0 ? round(seed.milepost / routeMiles, 4) : 0,
      gps: gpsLabel(coordinate),
      coordinate,
      routeId,
      scopeVersionLineage,
      facilityProfileId: profile.profileId,
      facilityProfile: profile,
      facilityType: profile.facilityType,
      powerProfile: profile.powerProfile,
      hvacProfile: profile.hvacProfile,
      generatorProfile: profile.generatorProfile,
      rackProfile: `${profile.rackCount || "Custom"} racks`,
      costProfile: profile.label,
      segmentFromPreviousMiles: round(segmentFromPreviousMiles, 2),
      ...optical,
      canMove: seed.stationType === "INTERMEDIATE",
      totalCost: profile.totalCost,
    };
  });
  const terminalSpan = spanLoss(Math.max(0, routeMiles - (stations.at(-1)?.milepost ?? 0)), controls);
  const spans: IlaOpticalSpan[] = [
    ...stations.map((station, index) => ({
      spanId: `${routeId}:SPAN:${index}`,
      fromStationId: index === 0 ? "ROUTE-START" : stations[index - 1].stationId,
      toStationId: station.stationId,
      fromLabel: index === 0 ? args.aLabel : stations[index - 1].label,
      toLabel: station.label,
      segmentLengthMiles: station.segmentFromPreviousMiles,
      attenuationLossDb: station.attenuationLossDb,
      connectorLossDb: station.connectorLossDb,
      spliceLossDb: station.spliceLossDb,
      spanLossDb: station.spanLossDb,
      remainingBudgetDb: station.remainingBudgetDb,
      recommendedRegen: station.recommendedRegen,
    })),
    {
      spanId: `${routeId}:SPAN:TERMINAL`,
      fromStationId: stations.at(-1)?.stationId ?? "ROUTE-START",
      toStationId: "ROUTE-END",
      fromLabel: stations.at(-1)?.label ?? args.aLabel,
      toLabel: args.zLabel,
      segmentLengthMiles: round(Math.max(0, routeMiles - (stations.at(-1)?.milepost ?? 0)), 2),
      ...terminalSpan,
    },
  ];
  const totalCost = stations.reduce((total, station) => total + station.totalCost, 0);
  const currentIntermediateCount = stations.filter((station) => station.stationType === "INTERMEDIATE").length;
  const recommendedStationCount = recommendedIntermediateIlas + (controls.useBookendIlas ? 2 : 0);
  const recommendedTotalCost = recommendedStationCount * (profileById.get(controls.defaultFacilityProfileId) ?? availableProfiles[0]).totalCost;
  const currentMaxSpanLoss = Math.max(0, ...spans.map((span) => span.spanLossDb));
  const recommendedSpanLoss = spanLoss(routeMiles / Math.max(1, recommendedIntermediateIlas + 1), controls).spanLossDb;
  const recommendation: IlaPlanningRecommendation = {
    recommendedIntermediateIlas,
    addedStations: Math.max(0, recommendedIntermediateIlas - currentIntermediateCount),
    removedStations: Math.max(0, currentIntermediateCount - recommendedIntermediateIlas),
    movedStations: Object.values(controls.stationOverrides ?? {}).filter((override) => typeof override.milepost === "number").length,
    costDifference: Math.round(recommendedTotalCost - totalCost),
    opticalDifferenceDb: round(recommendedSpanLoss - currentMaxSpanLoss, 2),
    lifecycleDifference: Math.round((recommendedStationCount - stations.length) * 12 * 1200),
    constructionDifference: Math.round(recommendedTotalCost - totalCost),
    requiresApproval: recommendedIntermediateIlas !== currentIntermediateCount,
    reason: recommendedIntermediateIlas > currentIntermediateCount
      ? "Active route or optical settings recommend additional ILA stations."
      : recommendedIntermediateIlas < currentIntermediateCount
        ? "Active route or optical settings recommend fewer ILA stations; removal requires approval."
        : "Current intermediate station count matches the active route recommendation.",
  };
  return {
    routeId,
    scopeVersionLineage,
    routeMiles,
    routeFeet,
    method: controls.placementMethod,
    controls,
    stationObjects: stations,
    spans,
    availableProfiles,
    recommendedIntermediateIlas,
    recommendation,
    totalCost,
    averageSpanMiles: round(spans.reduce((total, span) => total + span.segmentLengthMiles, 0) / Math.max(1, spans.length), 2),
    maxSpanMiles: Math.max(0, ...spans.map((span) => span.segmentLengthMiles)),
    maxSpanLossDb: currentMaxSpanLoss,
    remainingBudgetDb: Math.min(...spans.map((span) => span.remainingBudgetDb)),
    graphObjectCount: stations.length,
  };
}
