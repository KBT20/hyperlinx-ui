import {
  primitiveRenderKey,
  sortPrimitivesForRendering,
  withPrimitiveRenderIdentity,
  type MapKernelPrimitive,
  type MapKernelRenderSpec,
  type MapLayerVisibility,
  type MapRenderIdentity,
} from "./MapLayerManager";
import { ConstitutionalRuntimeKernel } from "../runtime/ConstitutionalRuntimeKernel";
import { constitutionalInputHash } from "../runtime/ProjectionCache";
import { markRuntimeDiagnostic, measureRuntime } from "../runtime/RuntimeDiagnostics";
import { shouldProjectMapLayer } from "./MapLayerRegistry";

export type MapKernelRenderOptions = {
  layerVisibility?: MapLayerVisibility;
  showStationLabels?: boolean;
  stationDensityFeet?: number;
};

export type MapKernelMetrics = {
  visibleScopeVersions: number;
  visibleIofPackages: number;
  visibleRoutes: number;
  visibleInventoryRoutes: number;
  visibleRouteAuthorityRoutes: number;
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

export type MapKernelRenderProjection = {
  primitives: MapKernelPrimitive[];
  metrics: MapKernelMetrics;
  audit: MapRenderAuthorityAudit;
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

function visibleFlattenedMapRenderSpecs(specs: MapKernelRenderSpec[], options: MapKernelRenderOptions = {}) {
  return flattenMapRenderSpecs(specs).filter(
    (primitive) => shouldProjectMapLayer(primitive, options.layerVisibility) && stationLabelAllowed(primitive, options)
  );
}

function renderMapKernelPrimitivesUncached(specs: MapKernelRenderSpec[], options: MapKernelRenderOptions = {}) {
  const primitives = visibleFlattenedMapRenderSpecs(specs, options);
  const seenKeys = new Set<string>();
  const deduped = primitives.filter((primitive) => {
    const key = primitiveRenderKey(primitive);
    if (seenKeys.has(key)) return false;
    seenKeys.add(key);
    return true;
  });
  return sortPrimitivesForRendering(deduped);
}

export function renderMapKernelPrimitives(specs: MapKernelRenderSpec[], options: MapKernelRenderOptions = {}) {
  return buildCachedMapRenderProjection(specs, options).primitives;
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

function auditMapKernelRenderAuthorityUncached(specs: MapKernelRenderSpec[], options: MapKernelRenderOptions = {}): MapRenderAuthorityAudit {
  const rows = visibleFlattenedMapRenderSpecs(specs, options).map((primitive) => rowForIdentity(primitive.renderIdentity!));
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

export function auditMapKernelRenderAuthority(specs: MapKernelRenderSpec[], options: MapKernelRenderOptions = {}): MapRenderAuthorityAudit {
  return buildCachedMapRenderProjection(specs, options).audit;
}

function summarizeMapKernelMetricsUncached(specs: MapKernelRenderSpec[], primitives: MapKernelPrimitive[], audit: MapRenderAuthorityAudit): MapKernelMetrics {
  const countRefs = (kind: string) => new Set(primitives.filter((primitive) => primitive.ref.kind === kind).map((primitive) => primitive.ref.id)).size;
  const routeAuthorityRoutes = primitives.filter(
    (primitive) =>
      primitive.ref.kind === "Route" &&
      (primitive.metadata?.isRouteAuthority === true || String(primitive.metadata?.sourceLayer ?? "").startsWith("ROUTE_AUTHORITY_"))
  );
  const inventoryRoutes = primitives.filter((primitive) => primitive.ref.kind === "Route" && primitive.layerId === "inventory");
  return {
    visibleScopeVersions: specs.filter((spec) => spec.sourceType === "ScopeVersion").length,
    visibleIofPackages: specs.filter((spec) => spec.sourceType === "IOFPackage").length,
    visibleRoutes: countRefs("Route"),
    visibleInventoryRoutes: new Set(inventoryRoutes.map((primitive) => primitive.ref.id)).size,
    visibleRouteAuthorityRoutes: new Set(routeAuthorityRoutes.map((primitive) => primitive.ref.id)).size,
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

function mapProjectionInput(specs: MapKernelRenderSpec[], options: MapKernelRenderOptions = {}) {
  return {
    specs: specs.map((spec) => ({
      specId: spec.specId,
      sourceType: spec.sourceType,
      sourceId: spec.sourceId,
      sourceRevision: spec.metadata?.sourceRevision ?? spec.metadata?.revision ?? spec.metadata?.updatedAt ?? spec.metadata?.packageRevision,
      primitives: spec.primitives.map((primitive) => ({
        id: primitive.id,
        layerId: primitive.layerId,
        kind: primitive.kind,
        ref: primitive.ref,
        coordinate: primitive.coordinate,
        coordinates: primitive.coordinates,
        rings: primitive.rings,
        label: primitive.label,
        metadata: primitive.metadata,
      })),
    })),
    layerVisibility: options.layerVisibility ?? {},
    showStationLabels: options.showStationLabels ?? true,
    stationDensityFeet: options.stationDensityFeet ?? 300,
  };
}

function mapProjectionArtifactId(specs: MapKernelRenderSpec[], options: MapKernelRenderOptions = {}) {
  const sourceKey = specs.map((spec) => [
    spec.sourceType,
    spec.sourceId,
    spec.metadata?.sourceRevision ?? spec.metadata?.revision ?? spec.metadata?.updatedAt ?? spec.metadata?.packageRevision ?? spec.specId,
  ].join(":"));
  return `MAP-LAYER-PROJECTION-${constitutionalInputHash({
    sources: sourceKey,
    layers: options.layerVisibility ?? {},
    showStationLabels: options.showStationLabels ?? true,
    stationDensityFeet: options.stationDensityFeet ?? 300,
  })}`;
}

export function buildCachedMapRenderProjection(specs: MapKernelRenderSpec[], options: MapKernelRenderOptions = {}): MapKernelRenderProjection {
  const input = mapProjectionInput(specs, options);
  const record = ConstitutionalRuntimeKernel.requestArtifact({
    artifactId: mapProjectionArtifactId(specs, options),
    artifactType: "MapLayerProjection",
    input,
    doctrineVersions: specs.map((spec) => String(spec.metadata?.doctrineVersion ?? spec.metadata?.productDoctrineVersion ?? "MAP-LAYER")),
    producedFrom: specs.map((spec) => ({
      artifactType: spec.sourceType === "IOFPackage" ? "DraftIofPackage" : `${spec.sourceType}Artifact`,
      artifactId: spec.sourceId,
      revision: Number(spec.metadata?.sourceRevision ?? spec.metadata?.revision ?? spec.metadata?.packageRevision ?? 1),
    })),
    dependencies: specs.map((spec) => `${spec.sourceType}:${spec.sourceId}:${spec.specId}`),
    producer: "MapKernel.buildCachedMapRenderProjection",
    create: () => {
      markRuntimeDiagnostic("projectionExecutions");
      return measureRuntime("MapLayerProjection", "mapRebuilds", () => {
        const primitives = renderMapKernelPrimitivesUncached(specs, options);
        const audit = auditMapKernelRenderAuthorityUncached(specs, options);
        return {
          primitives,
          audit,
          metrics: summarizeMapKernelMetricsUncached(specs, primitives, audit),
        };
      });
    },
  });
  return record.value;
}

export function summarizeMapKernelMetrics(specs: MapKernelRenderSpec[], options: MapKernelRenderOptions = {}): MapKernelMetrics {
  return buildCachedMapRenderProjection(specs, options).metrics;
}
