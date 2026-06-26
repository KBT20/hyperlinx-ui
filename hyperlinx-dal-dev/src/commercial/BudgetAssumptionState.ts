import { ESTIMATOR_DEFAULTS } from "./EstimatorDefaults";

export interface CivilMixAssumptions {
  hddPercent: number;
  plowPercent: number;
  openCutPercent: number;
  totalPercent: 100;
}

export interface BorePricingAssumptions {
  baseBoreLaborPerFoot: number;
  rockAdderPerFoot: number;
  rockBorePercent: number;
  dirtBorePercent: number;
  totalRockBorePerFoot: number;
}

export interface SlackAssumptions {
  vaultSlackFeet: number;
  handholeSlackFeet: number;
  applyVaultSlackToConduit: boolean;
}

export interface WasteAssumptions {
  fiberWastePercent: number;
  conduitWastePercent: number;
  innerductWastePercent: number;
}

export interface MaterialPackageAssumptions {
  standardDuctPackageConduitCount: number;
  futurePathEnabled: boolean;
  futurePathMultiplier: number;
}

export interface SplicingAssumptions {
  reelLengthFeet: number;
  buttSpliceUnitRate: number;
}

export interface BudgetAssumptionState {
  stateId: string;
  label: string;
  createdAt: string;
  source: "DEFAULT" | "SALES_SCENARIO";
  civilMix: CivilMixAssumptions;
  borePricing: BorePricingAssumptions;
  slack: SlackAssumptions;
  waste: WasteAssumptions;
  materials: MaterialPackageAssumptions;
  splicing: SplicingAssumptions;
  noPersistence: true;
  noScopeVersionCreation: true;
}

export function normalizeCivilMix(args: {
  hddPercent: number;
  plowPercent: number;
  openCutPercent: number;
}): CivilMixAssumptions {
  const hdd = Math.max(0, Math.round(args.hddPercent));
  const plow = Math.max(0, Math.round(args.plowPercent));
  const openCut = Math.max(0, Math.round(args.openCutPercent));
  const total = hdd + plow + openCut;
  if (total === 100) {
    return {
      hddPercent: hdd,
      plowPercent: plow,
      openCutPercent: openCut,
      totalPercent: 100,
    };
  }
  if (total === 0) {
    return {
      hddPercent: 0,
      plowPercent: 100,
      openCutPercent: 0,
      totalPercent: 100,
    };
  }
  const scaledHdd = Math.round((hdd / total) * 100);
  const scaledPlow = Math.round((plow / total) * 100);
  const scaledOpenCut = 100 - scaledHdd - scaledPlow;
  return {
    hddPercent: scaledHdd,
    plowPercent: scaledPlow,
    openCutPercent: scaledOpenCut,
    totalPercent: 100,
  };
}

export function rebalanceCivilMix(
  current: CivilMixAssumptions,
  changed: "hddPercent" | "plowPercent" | "openCutPercent",
  nextValue: number,
): CivilMixAssumptions {
  const locked = Math.max(0, Math.min(100, Math.round(nextValue)));
  const otherKeys = (["hddPercent", "plowPercent", "openCutPercent"] as const).filter((key) => key !== changed);
  const remaining = 100 - locked;
  const otherTotal = otherKeys.reduce((total, key) => total + current[key], 0);
  const next = { ...current, [changed]: locked };
  if (otherTotal <= 0) {
    next[otherKeys[0]] = Math.round(remaining / 2);
    next[otherKeys[1]] = remaining - next[otherKeys[0]];
    return normalizeCivilMix(next);
  }
  next[otherKeys[0]] = Math.round((current[otherKeys[0]] / otherTotal) * remaining);
  next[otherKeys[1]] = remaining - next[otherKeys[0]];
  return normalizeCivilMix(next);
}

export const normalizeConstructionStrategy = normalizeCivilMix;
export const rebalanceConstructionStrategy = rebalanceCivilMix;

export function createDefaultBudgetAssumptionState(): BudgetAssumptionState {
  return {
    stateId: "BAS-STATE-DEFAULT-LONG-HAUL",
    label: "Default long-haul sales scenario",
    createdAt: "2026-06-26T00:00:00.000Z",
    source: "DEFAULT",
    civilMix: normalizeCivilMix({
      hddPercent: ESTIMATOR_DEFAULTS.construction.defaultConstructionStrategy.dirtBorePercent,
      plowPercent: ESTIMATOR_DEFAULTS.construction.defaultConstructionStrategy.plowPercent,
      openCutPercent: ESTIMATOR_DEFAULTS.construction.defaultConstructionStrategy.openCutPercent,
    }),
    borePricing: {
      baseBoreLaborPerFoot: ESTIMATOR_DEFAULTS.construction.baseDirtBorePerFoot,
      rockAdderPerFoot: ESTIMATOR_DEFAULTS.construction.rockAdderPerFoot,
      rockBorePercent: ESTIMATOR_DEFAULTS.construction.defaultRockPercentOfDirtBore,
      dirtBorePercent: 100 - ESTIMATOR_DEFAULTS.construction.defaultRockPercentOfDirtBore,
      totalRockBorePerFoot: ESTIMATOR_DEFAULTS.construction.baseDirtBorePerFoot + ESTIMATOR_DEFAULTS.construction.rockAdderPerFoot,
    },
    slack: {
      vaultSlackFeet: ESTIMATOR_DEFAULTS.fiber.vaultSlackFeet,
      handholeSlackFeet: ESTIMATOR_DEFAULTS.fiber.handholeSlackFeet,
      applyVaultSlackToConduit: true,
    },
    waste: {
      fiberWastePercent: ESTIMATOR_DEFAULTS.materials.defaultFiberWastePercent,
      conduitWastePercent: ESTIMATOR_DEFAULTS.materials.defaultConduitWastePercent,
      innerductWastePercent: ESTIMATOR_DEFAULTS.materials.defaultInnerductWastePercent,
    },
    materials: {
      standardDuctPackageConduitCount: ESTIMATOR_DEFAULTS.materials.standardDuctPackageConduitCount,
      futurePathEnabled: ESTIMATOR_DEFAULTS.materials.futurePathEnabledByDefault,
      futurePathMultiplier: ESTIMATOR_DEFAULTS.materials.futurePathMultiplier,
    },
    splicing: {
      reelLengthFeet: ESTIMATOR_DEFAULTS.fiber.reelLengthFeet,
      buttSpliceUnitRate: 35,
    },
    noPersistence: true,
    noScopeVersionCreation: true,
  };
}

export function cloneBudgetAssumptionState(args: {
  state: BudgetAssumptionState;
  label: string;
  patch?: Partial<Pick<BudgetAssumptionState, "civilMix" | "borePricing" | "slack" | "waste" | "materials" | "splicing">>;
}): BudgetAssumptionState {
  return {
    ...args.state,
    ...args.patch,
    stateId: `BAS-STATE-${Date.now()}`,
    label: args.label,
    createdAt: new Date().toISOString(),
    source: "SALES_SCENARIO",
    noPersistence: true,
    noScopeVersionCreation: true,
  };
}
