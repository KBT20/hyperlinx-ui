export const ESTIMATOR_DEFAULTS = {
  construction: {
    baseDirtBorePerFoot: 15,
    rockAdderPerFoot: 30,
    defaultConstructionStrategy: {
      dirtBorePercent: 12,
      plowPercent: 82,
      openCutPercent: 6,
    },
    defaultRockPercentOfDirtBore: 12,
  },
  fiber: {
    reelLengthFeet: 26000,
    vaultSlackFeet: 150,
    handholeSlackFeet: 50,
  },
  materials: {
    standardDuctPackageConduitCount: 3,
    futurePathEnabledByDefault: false,
    futurePathMultiplier: 1,
    defaultFiberWastePercent: 5,
    defaultConduitWastePercent: 3,
    defaultInnerductWastePercent: 3,
  },
  commercial: {
    defaultMarkupPoints: 20,
    defaultContingencyPercent: 7.5,
  },
  developmentOnly: true,
  productionConfiguration: false,
} as const;

export type EstimatorDefaults = typeof ESTIMATOR_DEFAULTS;
