import type { ScopeVersion } from "../types/dal";
import type { MapKernelPrimitive, MapKernelRenderSpec } from "./MapLayerManager";
import { auditMapKernelRenderAuthority, renderMapKernelPrimitives, summarizeMapKernelMetrics } from "./MapRenderer";
import { boundsFromPrimitives } from "./MapViewportManager";

function refsByKind(primitives: MapKernelPrimitive[], kind: MapKernelPrimitive["ref"]["kind"]) {
  return new Set(primitives.filter((primitive) => primitive.ref.kind === kind).map((primitive) => primitive.ref.id));
}

function stationLabels(primitives: MapKernelPrimitive[]) {
  return primitives
    .filter((primitive) => primitive.ref.kind === "Station" && primitive.kind === "label" && primitive.label)
    .map((primitive) => String(primitive.label));
}

export function buildMapKernelDiagnostics(scopeVersion: ScopeVersion | null | undefined, spec: MapKernelRenderSpec | MapKernelRenderSpec[] | null | undefined) {
  const specs = Array.isArray(spec) ? spec : spec ? [spec] : [];
  const renderOptions = {
    layerVisibility: {
      edge: true,
      terrainReference: true,
      parcelReference: true,
      buildingReference: true,
      waterReference: true,
      railroadReference: true,
      streetReference: true,
      inventory: true,
      node: true,
      station: true,
      streetCenterline: true,
      scopeVersion: true,
      object: true,
      site: true,
      attachment: true,
      lateral: true,
    },
    showStationLabels: true,
    stationDensityFeet: 300,
  };
  const primitives = renderMapKernelPrimitives(specs, renderOptions);
  const renderAuthorityAudit = auditMapKernelRenderAuthority(specs, renderOptions);
  const routeRefs = refsByKind(primitives, "Route");
  const stationRefs = refsByKind(primitives, "Station");
  const nodeRefs = refsByKind(primitives, "Node");
  const edgeRefs = refsByKind(primitives, "Edge");
  const objectRefs = new Set([...refsByKind(primitives, "Object"), ...refsByKind(primitives, "ProductionUnit")]);
  const siteRefs = refsByKind(primitives, "Site");
  const attachmentRefs = refsByKind(primitives, "Attachment");
  const lateralRefs = refsByKind(primitives, "Lateral");
  const routeAuthorityRefs = new Set(
    primitives
      .filter((primitive) => primitive.metadata?.isRouteAuthority === true || String(primitive.metadata?.sourceLayer ?? "").startsWith("ROUTE_AUTHORITY_"))
      .map((primitive) => primitive.ref.id)
  );
  const labels = stationLabels(primitives);
  const bounds = boundsFromPrimitives(primitives);
  const routableBounds = boundsFromPrimitives(
    primitives.filter(
      (primitive) =>
        primitive.ref.kind === "Route" ||
        primitive.ref.kind === "Lateral" ||
        primitive.layerId === "lateral" ||
        primitive.metadata?.isRouteAuthority === true ||
        String(primitive.metadata?.sourceLayer ?? "").startsWith("ROUTE_AUTHORITY_")
    )
  );
  const selectableKinds = Array.from(
    new Set(primitives.filter((primitive) => primitive.metadata?.selectable !== false).map((primitive) => primitive.ref.kind))
  ).sort();

  return {
    scopeVersionId: scopeVersion?.scopeVersionId ?? "none",
    source: scopeVersion?.source ?? "none",
    routeCount: routeRefs.size,
    stationCount: stationRefs.size,
    nodeCount: nodeRefs.size,
    edgeCount: edgeRefs.size,
    objectCount: objectRefs.size,
    siteCount: siteRefs.size,
    attachmentCount: attachmentRefs.size,
    lateralCount: lateralRefs.size,
    routeAuthorityCount: routeAuthorityRefs.size,
    primitiveCount: primitives.length,
    metrics: summarizeMapKernelMetrics(specs, renderOptions),
    renderAuthority: {
      status: renderAuthorityAudit.status,
      duplicateKeyCount: renderAuthorityAudit.duplicateKeyCount,
      duplicateObjectCount: renderAuthorityAudit.duplicateObjectCount,
      duplicateRenderAuthorityCount: renderAuthorityAudit.duplicateRenderAuthorityCount,
      suppressedPrimitiveCount: renderAuthorityAudit.suppressedPrimitiveCount,
      duplicateKeys: renderAuthorityAudit.duplicateKeys.slice(0, 8),
      duplicateObjects: renderAuthorityAudit.duplicateObjects.slice(0, 8),
      duplicateRenderAuthorities: renderAuthorityAudit.duplicateRenderAuthorities.slice(0, 8),
      renderRows: renderAuthorityAudit.rows.slice(0, 24),
      rule: "Source Layer + ScopeVersion + Object Type + Object Identifier + Render Type",
    },
    stationing: {
      labelCount: labels.length,
      firstLabels: labels.slice(0, 8),
      hasStationingLabels: labels.some((label) => /^\d+\+\d{2}$/.test(label)),
      source: "ScopeVersion/IOF package only",
    },
    selection: {
      stationSelection: stationRefs.size > 0,
      nodeSelection: nodeRefs.size > 0,
      edgeSelection: edgeRefs.size > 0,
      objectSelection: objectRefs.size > 0,
      selectableKinds,
      source: "MapSelectionContext",
    },
    viewport: {
      fitScopeVersion: Boolean(bounds && primitives.length),
      fitRoute: Boolean(routableBounds && (routeRefs.size || lateralRefs.size || routeAuthorityRefs.size)),
      fitSelection: selectableKinds.length > 0,
      bounds,
      routableBounds,
      source: "MapViewportContext",
    },
    extensionHooks: {
      nearestNodeReady: nodeRefs.size > 0,
      nearestEdgeReady: edgeRefs.size > 0,
      nearestStationReady: stationRefs.size > 0,
      status: nodeRefs.size && edgeRefs.size && stationRefs.size ? "READY" : "PARTIAL",
    },
  };
}
