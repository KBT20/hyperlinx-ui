import {
  isPrimitiveVisible,
  primitiveRenderKey,
  sortPrimitivesForRendering,
  withPrimitiveRenderIdentity,
  type MapKernelPrimitive,
  type MapKernelRenderSpec,
  type MapLayerVisibility,
  type MapRenderIdentity,
} from "./MapLayerManager";

export type MapKernelRenderOptions = {
  layerVisibility?: MapLayerVisibility;
  showStationLabels?: boolean;
  stationDensityFeet?: number;
};

export type MapKernelMetrics = {
  visibleScopeVersions: number;
  visibleIofPackages: number;
  visibleRoutes: number;
  visibleStations: number;
  visibleNodes: number;
  visibleEdges: number;
  visibleObjects: number;
  visibleSites: number;
  visibleAttachments: number;
  visibleLaterals: number;
  visiblePrimitiveCount: number;
  duplicateKeyCount: number;
  duplicateObjectCount: number;
  duplicateRenderAuthorityCount: number;
  suppressedPrimitiveCount: number;
  renderAuthorityStatus: "PASS" | "FAIL";
};

export type MapRenderDiagnosticRow = {
  renderType: string;
  key: string;
  scopeVersionId: string;
  rootScopeVersionId: string;
  parentScopeVersionId?: string;
  sourceLayer: string;
  sourceType: string;
  sourceId: string;
  sourceSpecId: string;
  sourceObjectId: string;
  objectType: string;
  objectId: string;
};

export type MapDuplicateRenderGroup = {
  objectType: string;
  objectId: string;
  renderType?: string;
  key: string;
  occurrences: number;
  sourceLayers: string[];
  scopeVersionIds: string[];
  sourceObjectIds: string[];
};

export type MapRenderAuthorityAudit = {
  status: "PASS" | "FAIL";
  rows: MapRenderDiagnosticRow[];
  duplicateKeys: MapDuplicateRenderGroup[];
  duplicateObjects: MapDuplicateRenderGroup[];
  duplicateRenderAuthorities: MapDuplicateRenderGroup[];
  duplicateKeyCount: number;
  duplicateObjectCount: number;
  duplicateRenderAuthorityCount: number;
  suppressedPrimitiveCount: number;
};

function stationLabelAllowed(primitive: MapKernelPrimitive, options: MapKernelRenderOptions) {
  if (primitive.layerId !== "station" || primitive.kind !== "label") return true;
  if (options.showStationLabels === false) return false;
  const density = Number(options.stationDensityFeet ?? 300);
  const stationFeet = Number(primitive.metadata?.stationFeet ?? 0);
  if (!Number.isFinite(stationFeet) || density <= 0) return true;
  return Math.round(stationFeet) % density === 0;
}

export function flattenMapRenderSpecs(specs: MapKernelRenderSpec[]) {
  return specs.flatMap((spec) => spec.primitives.map((primitive, index) => withPrimitiveRenderIdentity(primitive, spec, index)));
}

export function renderMapKernelPrimitives(specs: MapKernelRenderSpec[], options: MapKernelRenderOptions = {}) {
  const primitives = flattenMapRenderSpecs(specs).filter(
    (primitive) => isPrimitiveVisible(primitive, options.layerVisibility) && stationLabelAllowed(primitive, options)
  );
  const seenKeys = new Set<string>();
  const deduped = primitives.filter((primitive) => {
    const key = primitiveRenderKey(primitive);
    if (seenKeys.has(key)) return false;
    seenKeys.add(key);
    return true;
  });
  return sortPrimitivesForRendering(deduped);
}

function rowForIdentity(identity: MapRenderIdentity): MapRenderDiagnosticRow {
  return {
    renderType: identity.renderType,
    key: identity.key,
    scopeVersionId: identity.scopeVersionId,
    rootScopeVersionId: identity.rootScopeVersionId,
    parentScopeVersionId: identity.parentScopeVersionId,
    sourceLayer: identity.sourceLayer,
    sourceType: identity.sourceType,
    sourceId: identity.sourceId,
    sourceSpecId: identity.sourceSpecId,
    sourceObjectId: identity.sourceObjectId,
    objectType: identity.objectType,
    objectId: identity.objectId,
  };
}

function groupRows(rows: MapRenderDiagnosticRow[], keyFor: (row: MapRenderDiagnosticRow) => string) {
  const groups = new Map<string, MapRenderDiagnosticRow[]>();
  rows.forEach((row) => {
    const key = keyFor(row);
    groups.set(key, [...(groups.get(key) ?? []), row]);
  });
  return Array.from(groups.entries())
    .filter(([, items]) => items.length > 1)
    .map(([key, items]) => ({
      key,
      objectType: items[0]?.objectType ?? "Unknown",
      objectId: items[0]?.objectId ?? "unknown",
      renderType: items[0]?.renderType,
      occurrences: items.length,
      sourceLayers: Array.from(new Set(items.map((item) => item.sourceLayer))).sort(),
      scopeVersionIds: Array.from(new Set(items.map((item) => item.scopeVersionId))).sort(),
      sourceObjectIds: Array.from(new Set(items.map((item) => item.sourceObjectId))).sort().slice(0, 8),
    }));
}

export function auditMapKernelRenderAuthority(specs: MapKernelRenderSpec[], options: MapKernelRenderOptions = {}): MapRenderAuthorityAudit {
  const rows = flattenMapRenderSpecs(specs)
    .filter((primitive) => isPrimitiveVisible(primitive, options.layerVisibility) && stationLabelAllowed(primitive, options))
    .map((primitive) => rowForIdentity(primitive.renderIdentity!));
  const duplicateKeys = groupRows(rows, (row) => row.key);
  const duplicateRenderAuthorities = groupRows(
    rows,
    (row) => `${row.sourceLayer}:${row.scopeVersionId}:${row.objectType}:${row.objectId}:${row.renderType}:${row.sourceSpecId}`
  );
  const duplicateObjects = groupRows(rows, (row) => `${row.sourceLayer}:${row.scopeVersionId}:${row.objectType}:${row.objectId}:${row.renderType}`);
  const duplicateKeyCount = duplicateKeys.length;
  const duplicateRenderAuthorityCount = duplicateRenderAuthorities.length;
  const duplicateObjectCount = duplicateObjects.length;
  const suppressedPrimitiveCount = duplicateKeys.reduce((total, group) => total + group.occurrences - 1, 0);
  const status = duplicateKeyCount || duplicateRenderAuthorityCount ? "FAIL" : "PASS";
  return {
    status,
    rows,
    duplicateKeys,
    duplicateObjects,
    duplicateRenderAuthorities,
    duplicateKeyCount,
    duplicateObjectCount,
    duplicateRenderAuthorityCount,
    suppressedPrimitiveCount,
  };
}

export function summarizeMapKernelMetrics(specs: MapKernelRenderSpec[], options: MapKernelRenderOptions = {}): MapKernelMetrics {
  const primitives = renderMapKernelPrimitives(specs, options);
  const audit = auditMapKernelRenderAuthority(specs, options);
  const countRefs = (kind: string) => new Set(primitives.filter((primitive) => primitive.ref.kind === kind).map((primitive) => primitive.ref.id)).size;
  return {
    visibleScopeVersions: specs.filter((spec) => spec.sourceType === "ScopeVersion").length,
    visibleIofPackages: specs.filter((spec) => spec.sourceType === "IOFPackage").length,
    visibleRoutes: countRefs("Route"),
    visibleStations: countRefs("Station"),
    visibleNodes: countRefs("Node"),
    visibleEdges: countRefs("Edge"),
    visibleObjects: countRefs("Object") + countRefs("ProductionUnit"),
    visibleSites: countRefs("Site"),
    visibleAttachments: countRefs("Attachment"),
    visibleLaterals: countRefs("Lateral"),
    visiblePrimitiveCount: primitives.length,
    duplicateKeyCount: audit.duplicateKeyCount,
    duplicateObjectCount: audit.duplicateObjectCount,
    duplicateRenderAuthorityCount: audit.duplicateRenderAuthorityCount,
    suppressedPrimitiveCount: audit.suppressedPrimitiveCount,
    renderAuthorityStatus: audit.status,
  };
}
