import type { DALCoordinate } from "../types/dal";
import type { IlaRegenLineItem } from "./IlaRegenPricing";

export type IlaPlacementMethod = "MAX_SPAN" | "MAX_OPTICAL_LOSS" | "MAX_ATTENUATION" | "INTERMEDIATE_COUNT";
export type IlaFacilityProfileId =
  | "ILA_18_RACK"
  | "ILA_27_RACK"
  | "ILA_36_RACK"
  | "ILA_CUSTOM";
export type IlaFacilityClass = "18 Rack" | "27 Rack" | "36 Rack" | "Custom";

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
  customFacilityDisplayName: string;
  customFacilityDescription: string;
  customBuildingCapital: number;
  customTelecomCapital: number;
  customTotalCapital: number;
  selectedStationId?: string | null;
  stationOverrides?: Record<string, IlaStationOverride>;
}

export interface IlaFacilityCostProfile {
  profileId: IlaFacilityProfileId;
  facilityClass: IlaFacilityClass;
  displayName: string;
  commercialDescription: string;
  buildingCapital: number;
  telecomCapital: number;
  totalCapital: number;
  discountPercentage?: number;
  netCapital?: number;
  proposalNotes?: string;
  isCustomOverride?: boolean;
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
const PROPOSAL_PROFILE_SOURCE = "ILA Facility Profile Catalog / Proposal Capital";

export type IlaFacilityProfileCatalogEntry = {
  profileId: IlaFacilityProfileId;
  facilityClass: IlaFacilityClass;
  displayName: string;
  commercialDescription: string;
  buildingCapital: number;
  telecomCapital: number;
  totalCapital: number;
  discountPercentage?: number;
  netCapital?: number;
  proposalNotes?: string;
};

export const ILA_FACILITY_PROFILE_CATALOG: IlaFacilityProfileCatalogEntry[] = [
  {
    profileId: "ILA_18_RACK",
    facilityClass: "18 Rack",
    displayName: "18 Rack",
    buildingCapital: 724100,
    telecomCapital: 375500,
    totalCapital: 1099600,
    discountPercentage: 7,
    netCapital: 1022628,
    commercialDescription: "Compact regeneration facility for rural, regional, and lower-density transport corridors. Optimized for reduced capital deployment while preserving expansion capability.",
  },
  {
    profileId: "ILA_27_RACK",
    facilityClass: "27 Rack",
    displayName: "27 Rack",
    buildingCapital: 1121600,
    telecomCapital: 563250,
    totalCapital: 1684850,
    discountPercentage: 7,
    netCapital: 1566910.5,
    commercialDescription: "Regional backbone regeneration facility with expanded optical and equipment capacity. Suitable for carrier aggregation, regional transport, and moderate hyperscaler growth.",
  },
  {
    profileId: "ILA_36_RACK",
    facilityClass: "36 Rack",
    displayName: "36 Rack",
    buildingCapital: 1121600,
    telecomCapital: 751000,
    totalCapital: 1872600,
    discountPercentage: 7,
    netCapital: 1741518,
    commercialDescription: "High-capacity regeneration facility for hyperscaler, AI infrastructure, and long-haul backbone corridors. Designed for maximum capacity, growth, and transport interconnection.",
  },
];

export const DEFAULT_ILA_PLANNING_CONTROLS: IlaPlanningControls = {
  useBookendIlas: true,
  placementMethod: "MAX_SPAN",
  maxSpanMiles: 45,
  maxOpticalLossDb: 13.5,
  maxAttenuationDb: 11.25,
  desiredIntermediateIlas: 0,
  defaultFacilityProfileId: "ILA_36_RACK",
  attenuationDbPerKm: 0.25,
  connectorLossDb: 1,
  spliceLossDb: 0.05,
  opticalBudgetDb: 24,
  customFacilityCost: 1872600,
  customFacilityDisplayName: "Custom",
  customFacilityDescription: "Manual proposal override facility profile. Commercial capital and description require review before customer presentation.",
  customBuildingCapital: 1121600,
  customTelecomCapital: 751000,
  customTotalCapital: 1872600,
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
  const normalizedOverrides = Object.fromEntries(
    Object.entries(controls?.stationOverrides ?? {}).map(([stationId, override]) => [
      stationId,
      {
        ...override,
        facilityProfileId: normalizeIlaFacilityProfileId(override.facilityProfileId),
      },
    ]),
  );
  return {
    ...DEFAULT_ILA_PLANNING_CONTROLS,
    ...(controls ?? {}),
    defaultFacilityProfileId: normalizeIlaFacilityProfileId(controls?.defaultFacilityProfileId),
    desiredIntermediateIlas: Math.max(0, Math.round(controls?.desiredIntermediateIlas ?? DEFAULT_ILA_PLANNING_CONTROLS.desiredIntermediateIlas)),
    maxSpanMiles: Math.max(1, controls?.maxSpanMiles ?? DEFAULT_ILA_PLANNING_CONTROLS.maxSpanMiles),
    maxOpticalLossDb: Math.max(1, controls?.maxOpticalLossDb ?? DEFAULT_ILA_PLANNING_CONTROLS.maxOpticalLossDb),
    maxAttenuationDb: Math.max(1, controls?.maxAttenuationDb ?? DEFAULT_ILA_PLANNING_CONTROLS.maxAttenuationDb),
    attenuationDbPerKm: Math.max(0.01, controls?.attenuationDbPerKm ?? DEFAULT_ILA_PLANNING_CONTROLS.attenuationDbPerKm),
    connectorLossDb: Math.max(0, controls?.connectorLossDb ?? DEFAULT_ILA_PLANNING_CONTROLS.connectorLossDb),
    spliceLossDb: Math.max(0, controls?.spliceLossDb ?? DEFAULT_ILA_PLANNING_CONTROLS.spliceLossDb),
    opticalBudgetDb: Math.max(1, controls?.opticalBudgetDb ?? DEFAULT_ILA_PLANNING_CONTROLS.opticalBudgetDb),
    customFacilityCost: Math.max(0, controls?.customFacilityCost ?? DEFAULT_ILA_PLANNING_CONTROLS.customFacilityCost),
    customFacilityDisplayName: controls?.customFacilityDisplayName?.trim() || DEFAULT_ILA_PLANNING_CONTROLS.customFacilityDisplayName,
    customFacilityDescription: controls?.customFacilityDescription?.trim() || DEFAULT_ILA_PLANNING_CONTROLS.customFacilityDescription,
    customBuildingCapital: Math.max(0, controls?.customBuildingCapital ?? DEFAULT_ILA_PLANNING_CONTROLS.customBuildingCapital),
    customTelecomCapital: Math.max(0, controls?.customTelecomCapital ?? DEFAULT_ILA_PLANNING_CONTROLS.customTelecomCapital),
    customTotalCapital: Math.max(0, controls?.customTotalCapital ?? controls?.customFacilityCost ?? DEFAULT_ILA_PLANNING_CONTROLS.customTotalCapital),
    stationOverrides: normalizedOverrides,
  };
}

export function normalizeIlaFacilityProfileId(value?: string | null): IlaFacilityProfileId {
  if (value === "ILA_18_RACK") return "ILA_18_RACK";
  if (value === "ILA_27_RACK") return "ILA_27_RACK";
  if (value === "ILA_36_RACK" || value === "ILA_36_RACK_DOUBLE_WIDE") return "ILA_36_RACK";
  if (value === "ILA_CUSTOM") return "ILA_CUSTOM";
  return DEFAULT_ILA_PLANNING_CONTROLS.defaultFacilityProfileId;
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

function proposalCapitalLineItem(profileId: IlaFacilityProfileId, category: IlaRegenLineItem["category"], description: string, cost: number): IlaRegenLineItem {
  const unitCost = Math.round(cost);
  return {
    lineItemId: `${profileId}:${description.replaceAll(/[^A-Za-z0-9]+/g, "_").toUpperCase()}`,
    category,
    description,
    quantity: 1,
    unit: "EACH",
    unitCost,
    extendedCost: unitCost,
    source: "PROPOSAL_PROFILE_CATALOG",
    referenceDerived: true,
    developmentSeed: true,
    productionApproved: false,
  };
}

function rackCountForFacilityClass(facilityClass: IlaFacilityClass) {
  return facilityClass === "18 Rack" ? 18 : facilityClass === "27 Rack" ? 27 : facilityClass === "36 Rack" ? 36 : 0;
}

function profileFromCatalog(entry: IlaFacilityProfileCatalogEntry, custom = false): IlaFacilityCostProfile {
  const totalCapital = Math.max(0, Math.round(entry.totalCapital));
  const buildingCapital = Math.max(0, Math.round(entry.buildingCapital));
  const telecomCapital = Math.max(0, Math.round(entry.telecomCapital));
  const lineItems = [
    proposalCapitalLineItem(entry.profileId, "SITE_CONSTRUCTION", "Building capital", buildingCapital),
    proposalCapitalLineItem(entry.profileId, "TELECOM_FIT_OUT", "Telecom capital", telecomCapital),
  ];
  return {
    profileId: entry.profileId,
    facilityClass: entry.facilityClass,
    displayName: entry.displayName,
    commercialDescription: entry.commercialDescription,
    buildingCapital,
    telecomCapital,
    totalCapital,
    discountPercentage: entry.discountPercentage,
    netCapital: entry.netCapital,
    proposalNotes: entry.proposalNotes,
    isCustomOverride: custom,
    label: entry.displayName,
    facilityType: entry.facilityClass,
    rackCount: rackCountForFacilityClass(entry.facilityClass),
    buildingProfile: "Proposal facility profile; engineering design details pending after customer acceptance",
    powerProfile: "Engineering scope after customer acceptance",
    hvacProfile: "Engineering scope after customer acceptance",
    generatorProfile: "Engineering scope after customer acceptance",
    civilProfile: "Proposal building capital allowance",
    laborProfile: "Proposal capital summary only",
    equipmentProfile: "Proposal telecom capital allowance",
    materialProfile: "Proposal capital summary only",
    siteLandCost: 0,
    civilCost: buildingCapital,
    laborCost: 0,
    equipmentCost: telecomCapital,
    materialCost: telecomCapital,
    totalCost: totalCapital,
    workbook: PROPOSAL_PROFILE_SOURCE,
    lineItems,
  };
}

export function buildIlaFacilityProfiles(custom: Partial<Pick<
  IlaPlanningControls,
  "customFacilityCost" | "customFacilityDisplayName" | "customFacilityDescription" | "customBuildingCapital" | "customTelecomCapital" | "customTotalCapital"
>> | number = DEFAULT_ILA_PLANNING_CONTROLS.customFacilityCost): IlaFacilityCostProfile[] {
  const customControls = typeof custom === "number"
    ? {
        ...DEFAULT_ILA_PLANNING_CONTROLS,
        customFacilityCost: custom,
        customTotalCapital: custom,
      }
    : { ...DEFAULT_ILA_PLANNING_CONTROLS, ...custom };
  const customTotal = Math.max(0, customControls.customTotalCapital ?? customControls.customFacilityCost ?? customControls.customBuildingCapital + customControls.customTelecomCapital);
  const customProfile = profileFromCatalog({
    profileId: "ILA_CUSTOM",
    facilityClass: "Custom",
    displayName: customControls.customFacilityDisplayName || "Custom",
    buildingCapital: customControls.customBuildingCapital,
    telecomCapital: customControls.customTelecomCapital,
    totalCapital: customTotal,
    commercialDescription: customControls.customFacilityDescription || DEFAULT_ILA_PLANNING_CONTROLS.customFacilityDescription,
    proposalNotes: "Manual proposal override. Engineering details remain pending after customer acceptance.",
  }, true);
  return [
    ...ILA_FACILITY_PROFILE_CATALOG.map((entry) => profileFromCatalog(entry)),
    customProfile,
  ];
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
  const availableProfiles = buildIlaFacilityProfiles(controls);
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
        facilityProfileId: normalizeIlaFacilityProfileId(override?.facilityProfileId ?? controls.defaultFacilityProfileId),
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
