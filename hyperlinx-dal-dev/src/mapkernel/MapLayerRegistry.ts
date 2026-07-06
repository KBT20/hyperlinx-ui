import {
  DEFAULT_MAP_LAYERS,
  isPrimitiveVisible,
  type MapFeatureKind,
  type MapKernelPrimitive,
  type MapLayerId,
  type MapLayerVisibility,
} from "./MapLayerManager";

export type ConstitutionalMapLayerId =
  | "spineObjects"
  | "stations"
  | "handholes"
  | "manholes"
  | "vaults"
  | "spliceCases"
  | "ilas"
  | "regens"
  | "pops"
  | "conduit"
  | "fiber"
  | "constructionSegments"
  | "paymentSegments"
  | "reviewObjects"
  | "engineeringDeltas";

export type ConstitutionalMapLayerDefinition = {
  layerId: ConstitutionalMapLayerId;
  label: string;
  primitiveLayerId: MapLayerId;
  featureKinds: MapFeatureKind[];
  objectTypes?: string[];
  sourceRevisionKeys: string[];
  viewportGated: boolean;
  projectionCost: "LOW" | "MEDIUM" | "HIGH";
};

export const CONSTITUTIONAL_MAP_LAYER_REGISTRY: ConstitutionalMapLayerDefinition[] = [
  {
    layerId: "spineObjects",
    label: "Spine Objects",
    primitiveLayerId: "object",
    featureKinds: ["Object", "ProductionUnit"],
    sourceRevisionKeys: ["spineObjectCatalogSummary", "instantiationSummary"],
    viewportGated: true,
    projectionCost: "HIGH",
  },
  {
    layerId: "stations",
    label: "Stations",
    primitiveLayerId: "station",
    featureKinds: ["Station"],
    sourceRevisionKeys: ["stationAuthority", "stationIndex"],
    viewportGated: true,
    projectionCost: "MEDIUM",
  },
  {
    layerId: "handholes",
    label: "Handholes",
    primitiveLayerId: "object",
    featureKinds: ["Object"],
    objectTypes: ["HANDHOLE"],
    sourceRevisionKeys: ["objectAddresses", "instantiatedSpineObjects"],
    viewportGated: true,
    projectionCost: "MEDIUM",
  },
  {
    layerId: "manholes",
    label: "Manholes",
    primitiveLayerId: "object",
    featureKinds: ["Object"],
    objectTypes: ["MANHOLE"],
    sourceRevisionKeys: ["objectAddresses", "instantiatedSpineObjects"],
    viewportGated: true,
    projectionCost: "MEDIUM",
  },
  {
    layerId: "vaults",
    label: "Vaults",
    primitiveLayerId: "object",
    featureKinds: ["Object"],
    objectTypes: ["VAULT"],
    sourceRevisionKeys: ["objectAddresses", "instantiatedSpineObjects"],
    viewportGated: true,
    projectionCost: "MEDIUM",
  },
  {
    layerId: "spliceCases",
    label: "Splice Cases",
    primitiveLayerId: "object",
    featureKinds: ["Object"],
    objectTypes: ["SPLICE_CASE", "SPLICE"],
    sourceRevisionKeys: ["spineObjectCatalogSummary", "productionProjectionSummary"],
    viewportGated: true,
    projectionCost: "MEDIUM",
  },
  {
    layerId: "ilas",
    label: "ILAs",
    primitiveLayerId: "object",
    featureKinds: ["Object"],
    objectTypes: ["ILA", "INLINE_AMPLIFIER"],
    sourceRevisionKeys: ["productDoctrineAssembly", "spineObjectCatalogSummary"],
    viewportGated: true,
    projectionCost: "MEDIUM",
  },
  {
    layerId: "regens",
    label: "Regens",
    primitiveLayerId: "object",
    featureKinds: ["Object"],
    objectTypes: ["REGEN", "REGENERATION"],
    sourceRevisionKeys: ["productDoctrineAssembly", "spineObjectCatalogSummary"],
    viewportGated: true,
    projectionCost: "MEDIUM",
  },
  {
    layerId: "pops",
    label: "POPs",
    primitiveLayerId: "site",
    featureKinds: ["Site", "Object"],
    objectTypes: ["POP", "POINT_OF_PRESENCE"],
    sourceRevisionKeys: ["productDoctrineAssembly", "spineObjectCatalogSummary"],
    viewportGated: true,
    projectionCost: "MEDIUM",
  },
  {
    layerId: "conduit",
    label: "Conduit",
    primitiveLayerId: "object",
    featureKinds: ["Object", "ProductionUnit"],
    objectTypes: ["CONDUIT", "DUCT"],
    sourceRevisionKeys: ["productionProjectionSummary", "instantiationSummary"],
    viewportGated: true,
    projectionCost: "HIGH",
  },
  {
    layerId: "fiber",
    label: "Fiber",
    primitiveLayerId: "object",
    featureKinds: ["Object", "ProductionUnit"],
    objectTypes: ["FIBER", "FIBER_CABLE"],
    sourceRevisionKeys: ["productionProjectionSummary", "instantiationSummary"],
    viewportGated: true,
    projectionCost: "HIGH",
  },
  {
    layerId: "constructionSegments",
    label: "Construction Segments",
    primitiveLayerId: "lateral",
    featureKinds: ["Lateral", "ProductionUnit"],
    sourceRevisionKeys: ["constructionSegments", "kernelExecutionGraph"],
    viewportGated: true,
    projectionCost: "HIGH",
  },
  {
    layerId: "paymentSegments",
    label: "Payment Segments",
    primitiveLayerId: "iofPackage",
    featureKinds: ["IOFPackage", "ProductionUnit"],
    sourceRevisionKeys: ["paymentSegments", "productionPaymentProjection"],
    viewportGated: true,
    projectionCost: "MEDIUM",
  },
  {
    layerId: "reviewObjects",
    label: "Review Objects",
    primitiveLayerId: "object",
    featureKinds: ["Object"],
    sourceRevisionKeys: ["spineReviewObjects", "auditObjectManifestSummary"],
    viewportGated: true,
    projectionCost: "MEDIUM",
  },
  {
    layerId: "engineeringDeltas",
    label: "Engineering Deltas",
    primitiveLayerId: "object",
    featureKinds: ["Object", "Constraint"],
    sourceRevisionKeys: ["commercialImpactSummary", "auditProjectionRedlines"],
    viewportGated: true,
    projectionCost: "MEDIUM",
  },
];

export function mapLayerDefinitionForPrimitive(primitive: MapKernelPrimitive) {
  const payloadRecord = primitive.payload && typeof primitive.payload === "object" && !Array.isArray(primitive.payload)
    ? primitive.payload as Record<string, unknown>
    : {};
  const normalizedObjectType = String(
    primitive.metadata?.objectType ??
      primitive.metadata?.type ??
      payloadRecord.objectType ??
      "",
  ).toUpperCase();

  return CONSTITUTIONAL_MAP_LAYER_REGISTRY.filter((definition) => definition.primitiveLayerId === primitive.layerId)
    .find((definition) => {
      if (!definition.featureKinds.includes(primitive.ref.kind)) return false;
      if (!definition.objectTypes?.length) return true;
      return definition.objectTypes.includes(normalizedObjectType);
    });
}

export function shouldProjectMapLayer(primitive: MapKernelPrimitive, visibility: MapLayerVisibility = {}) {
  if (!isPrimitiveVisible(primitive, visibility)) return false;
  const layer = DEFAULT_MAP_LAYERS[primitive.layerId];
  return Boolean(layer);
}
