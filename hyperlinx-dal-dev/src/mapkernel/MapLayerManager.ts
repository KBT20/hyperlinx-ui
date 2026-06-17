import type { DALCoordinate } from "../types/dal";

export type MapLayerId =
  | "streetReference"
  | "buildingReference"
  | "parcelReference"
  | "railroadReference"
  | "waterReference"
  | "terrainReference"
  | "inventory"
  | "routeAuthorityDraft"
  | "routeAuthorityCertified"
  | "routeAuthorityDirectFallback"
  | "routeAuthorityRejected"
  | "scopeVersion"
  | "iofPackage"
  | "streetCenterline"
  | "station"
  | "node"
  | "edge"
  | "object"
  | "site"
  | "attachment"
  | "lateral";

export type MapFeatureKind =
  | "IOFPackage"
  | "ScopeVersion"
  | "Route"
  | "StreetReference"
  | "BuildingReference"
  | "ParcelReference"
  | "RailroadReference"
  | "WaterReference"
  | "TerrainReference"
  | "StreetCenterline"
  | "StreetSnap"
  | "Station"
  | "Node"
  | "Edge"
  | "Object"
  | "Site"
  | "Attachment"
  | "Lateral"
  | "Constraint"
  | "ProductionUnit";

export type MapPrimitiveKind = "line" | "point" | "label" | "polygon";

export type MapFeatureRef = {
  kind: MapFeatureKind;
  id: string;
  scopeVersionId?: string;
  rootScopeVersionId?: string;
  parentScopeVersionId?: string;
  sourceLayer?: string;
  renderKey?: string;
  routeId?: string;
  stationId?: string;
  nodeId?: string;
  edgeId?: string;
  objectId?: string;
};

export type MapPrimitiveStyle = {
  stroke?: string;
  fill?: string;
  strokeWidth?: number;
  radius?: number;
  opacity?: number;
  dasharray?: string;
  fontSize?: number;
  fontWeight?: number | string;
};

export type MapKernelPrimitive = {
  id: string;
  layerId: MapLayerId;
  kind: MapPrimitiveKind;
  ref: MapFeatureRef;
  renderIdentity?: MapRenderIdentity;
  coordinate?: DALCoordinate;
  coordinates?: DALCoordinate[];
  rings?: DALCoordinate[][];
  label?: string;
  payload?: unknown;
  style?: MapPrimitiveStyle;
  metadata?: {
    stationFeet?: number;
    selectable?: boolean;
    source?: string;
    sourceLayer?: string;
    rootScopeVersionId?: string;
    parentScopeVersionId?: string;
    renderAuthority?: "Inventory Geometry" | "Child Geometry" | "Certified Geometry" | "Editable Geometry" | string;
    [key: string]: unknown;
  };
};

export type MapKernelRenderSpec = {
  specId: string;
  sourceType: "ScopeVersion" | "IOFPackage" | "InventoryGraph" | "GraphExtension" | "Manual";
  sourceId: string;
  name?: string;
  primitives: MapKernelPrimitive[];
  metadata?: Record<string, unknown>;
};

export type MapRenderIdentity = {
  key: string;
  renderType: MapPrimitiveKind;
  sourceLayer: string;
  sourceType: MapKernelRenderSpec["sourceType"] | "Unknown";
  sourceId: string;
  sourceSpecId: string;
  scopeVersionId: string;
  rootScopeVersionId: string;
  parentScopeVersionId?: string;
  objectType: MapFeatureKind;
  objectId: string;
  sourceObjectId: string;
};

export type MapLayerState = {
  layerId: MapLayerId;
  label: string;
  visible: boolean;
  selectable: boolean;
  zIndex: number;
};

export type MapLayerVisibility = Partial<Record<MapLayerId, boolean>>;

export const MAP_LAYER_ORDER: MapLayerId[] = [
  "terrainReference",
  "parcelReference",
  "buildingReference",
  "waterReference",
  "railroadReference",
  "streetReference",
  "inventory",
  "routeAuthorityDirectFallback",
  "routeAuthorityDraft",
  "routeAuthorityRejected",
  "routeAuthorityCertified",
  "streetCenterline",
  "scopeVersion",
  "iofPackage",
  "edge",
  "lateral",
  "attachment",
  "node",
  "station",
  "object",
  "site",
];

export const DEFAULT_MAP_LAYERS: Record<MapLayerId, MapLayerState> = {
  terrainReference: { layerId: "terrainReference", label: "Terrain Reference", visible: false, selectable: false, zIndex: 2 },
  parcelReference: { layerId: "parcelReference", label: "Parcel Reference", visible: false, selectable: true, zIndex: 3 },
  buildingReference: { layerId: "buildingReference", label: "Building Reference", visible: false, selectable: true, zIndex: 4 },
  waterReference: { layerId: "waterReference", label: "Water Reference", visible: true, selectable: true, zIndex: 5 },
  railroadReference: { layerId: "railroadReference", label: "Railroad Reference", visible: true, selectable: true, zIndex: 6 },
  streetReference: { layerId: "streetReference", label: "Street Reference", visible: true, selectable: true, zIndex: 7 },
  inventory: { layerId: "inventory", label: "Inventory Layer", visible: true, selectable: true, zIndex: 10 },
  routeAuthorityDirectFallback: { layerId: "routeAuthorityDirectFallback", label: "ROUTE_AUTHORITY_DIRECT_FALLBACK", visible: true, selectable: true, zIndex: 32 },
  routeAuthorityDraft: { layerId: "routeAuthorityDraft", label: "ROUTE_AUTHORITY_DRAFT", visible: true, selectable: true, zIndex: 34 },
  routeAuthorityRejected: { layerId: "routeAuthorityRejected", label: "ROUTE_AUTHORITY_REJECTED", visible: true, selectable: true, zIndex: 36 },
  routeAuthorityCertified: { layerId: "routeAuthorityCertified", label: "ROUTE_AUTHORITY_CERTIFIED", visible: true, selectable: true, zIndex: 38 },
  streetCenterline: { layerId: "streetCenterline", label: "Street Centerlines", visible: true, selectable: true, zIndex: 15 },
  scopeVersion: { layerId: "scopeVersion", label: "ScopeVersion Layer", visible: true, selectable: true, zIndex: 20 },
  iofPackage: { layerId: "iofPackage", label: "IOF Package Overlay", visible: true, selectable: true, zIndex: 25 },
  station: { layerId: "station", label: "Station Layer", visible: true, selectable: true, zIndex: 70 },
  node: { layerId: "node", label: "Node Layer", visible: true, selectable: true, zIndex: 60 },
  edge: { layerId: "edge", label: "Edge Layer", visible: false, selectable: true, zIndex: 30 },
  object: { layerId: "object", label: "Object Layer", visible: true, selectable: true, zIndex: 80 },
  site: { layerId: "site", label: "Site Layer", visible: true, selectable: true, zIndex: 90 },
  attachment: { layerId: "attachment", label: "Attachment Layer", visible: true, selectable: true, zIndex: 85 },
  lateral: { layerId: "lateral", label: "Lateral Layer", visible: true, selectable: true, zIndex: 40 },
};

export function resolveLayerStates(visibility: MapLayerVisibility = {}) {
  return MAP_LAYER_ORDER.map((layerId) => ({
    ...DEFAULT_MAP_LAYERS[layerId],
    visible: visibility[layerId] ?? DEFAULT_MAP_LAYERS[layerId].visible,
  }));
}

export function isPrimitiveVisible(primitive: MapKernelPrimitive, visibility: MapLayerVisibility = {}) {
  const layer = DEFAULT_MAP_LAYERS[primitive.layerId];
  return visibility[primitive.layerId] ?? layer?.visible ?? true;
}

export function sortPrimitivesForRendering(primitives: MapKernelPrimitive[]) {
  return [...primitives].sort((a, b) => DEFAULT_MAP_LAYERS[a.layerId].zIndex - DEFAULT_MAP_LAYERS[b.layerId].zIndex);
}

function token(value: unknown, fallback: string) {
  const text = String(value ?? "").trim();
  return text ? text.replaceAll(/\s+/g, "_") : fallback;
}

function metadataString(primitive: MapKernelPrimitive, key: string) {
  const value = primitive.metadata?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function specMetadataString(spec: MapKernelRenderSpec | undefined, key: string) {
  const value = spec?.metadata?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function objectIdForPrimitive(primitive: MapKernelPrimitive) {
  return token(
    primitive.ref.stationId ??
      primitive.ref.nodeId ??
      primitive.ref.edgeId ??
      primitive.ref.objectId ??
      primitive.ref.routeId ??
      primitive.ref.id ??
      primitive.id,
    "unknown-object"
  );
}

export function normalizePrimitiveRenderIdentity(
  primitive: MapKernelPrimitive,
  spec?: MapKernelRenderSpec,
  index = 0
): MapRenderIdentity {
  const scopeVersionId = token(
    primitive.ref.scopeVersionId ??
      metadataString(primitive, "scopeVersionId") ??
      specMetadataString(spec, "scopeVersionId") ??
      (spec?.sourceType === "ScopeVersion" ? spec.sourceId : undefined),
    "no-scope"
  );
  const sourceLayer = token(
    metadataString(primitive, "sourceLayer") ??
      metadataString(primitive, "renderAuthority") ??
      metadataString(primitive, "source") ??
      primitive.layerId,
    "unknown-layer"
  );
  const sourceSpecId = token(spec?.specId, "direct-render");
  const sourceId = token(spec?.sourceId, primitive.ref.scopeVersionId ?? primitive.ref.id ?? `primitive-${index}`);
  const rootScopeVersionId = token(
    primitive.ref.rootScopeVersionId ?? metadataString(primitive, "rootScopeVersionId") ?? specMetadataString(spec, "rootScopeVersionId"),
    scopeVersionId
  );
  const parentScopeVersionId =
    primitive.ref.parentScopeVersionId ?? metadataString(primitive, "parentScopeVersionId") ?? specMetadataString(spec, "parentScopeVersionId");
  const objectType = primitive.ref.kind;
  const objectId = objectIdForPrimitive(primitive);
  const sourceObjectId = token(primitive.id, `${objectType}:${index}`);
  const renderType = primitive.kind;
  const key = [
    objectType,
    sourceLayer,
    scopeVersionId,
    objectId,
    renderType,
    sourceSpecId,
    sourceObjectId,
  ].join(":");

  return {
    key,
    renderType,
    sourceLayer,
    sourceType: spec?.sourceType ?? "Unknown",
    sourceId,
    sourceSpecId,
    scopeVersionId,
    rootScopeVersionId,
    parentScopeVersionId,
    objectType,
    objectId,
    sourceObjectId,
  };
}

export function withPrimitiveRenderIdentity(primitive: MapKernelPrimitive, spec?: MapKernelRenderSpec, index = 0): MapKernelPrimitive {
  const renderIdentity = primitive.renderIdentity ?? normalizePrimitiveRenderIdentity(primitive, spec, index);
  return {
    ...primitive,
    renderIdentity,
    ref: {
      ...primitive.ref,
      scopeVersionId: primitive.ref.scopeVersionId ?? renderIdentity.scopeVersionId,
      rootScopeVersionId: primitive.ref.rootScopeVersionId ?? renderIdentity.rootScopeVersionId,
      parentScopeVersionId: primitive.ref.parentScopeVersionId ?? renderIdentity.parentScopeVersionId,
      sourceLayer: primitive.ref.sourceLayer ?? renderIdentity.sourceLayer,
      renderKey: primitive.ref.renderKey ?? renderIdentity.key,
    },
  };
}

export function primitiveRenderKey(primitive: MapKernelPrimitive) {
  return (primitive.renderIdentity ?? normalizePrimitiveRenderIdentity(primitive)).key;
}
