import type { MapLayerId, MapPrimitiveKind, MapPrimitiveStyle } from "./MapLayerManager";

export type MapKernelStyleProfile = "truth" | "planning" | "field" | "twin";

const LAYER_STYLES: Record<MapLayerId, MapPrimitiveStyle> = {
  terrainReference: { stroke: "#a3a3a3", fill: "#d4d4d4", strokeWidth: 1, radius: 2, opacity: 0.18 },
  parcelReference: { stroke: "#fbbf24", fill: "#fef3c7", strokeWidth: 1, radius: 2, opacity: 0.32, dasharray: "4 4" },
  buildingReference: { stroke: "#475569", fill: "#cbd5e1", strokeWidth: 1, radius: 2, opacity: 0.36 },
  waterReference: { stroke: "#38bdf8", fill: "#bae6fd", strokeWidth: 2, radius: 2, opacity: 0.42 },
  railroadReference: { stroke: "#1f2937", fill: "#1f2937", strokeWidth: 2, radius: 2, opacity: 0.5, dasharray: "8 6" },
  streetReference: { stroke: "#f8fafc", fill: "#f8fafc", strokeWidth: 2, radius: 2, opacity: 0.72, dasharray: "5 5" },
  inventory: { stroke: "#16a34a", fill: "#16a34a", strokeWidth: 3, radius: 3, opacity: 0.86 },
  routeAuthorityDirectFallback: { stroke: "#f97316", fill: "none", strokeWidth: 4, opacity: 0.92, dasharray: "12 8" },
  routeAuthorityDraft: { stroke: "#dc2626", fill: "none", strokeWidth: 4, opacity: 0.92, dasharray: "8 6" },
  routeAuthorityRejected: { stroke: "#991b1b", fill: "none", strokeWidth: 4, opacity: 0.78, dasharray: "5 5" },
  routeAuthorityCertified: { stroke: "#16a34a", fill: "none", strokeWidth: 5, opacity: 0.96 },
  streetCenterline: { stroke: "#f8fafc", fill: "#f8fafc", strokeWidth: 2, radius: 3, opacity: 0.82, dasharray: "5 5" },
  scopeVersion: { stroke: "#0f766e", fill: "#0f766e", strokeWidth: 4, radius: 4, opacity: 0.9 },
  iofPackage: { stroke: "#9333ea", fill: "#c084fc", strokeWidth: 3, radius: 4, opacity: 0.82, dasharray: "10 4" },
  station: { stroke: "#f59e0b", fill: "#f59e0b", strokeWidth: 1, radius: 3, opacity: 0.95, fontSize: 11, fontWeight: 700 },
  node: { stroke: "#1d4ed8", fill: "#2563eb", strokeWidth: 1, radius: 4, opacity: 0.9 },
  edge: { stroke: "#94a3b8", fill: "none", strokeWidth: 1, opacity: 0.55 },
  object: { stroke: "#7c3aed", fill: "#a78bfa", strokeWidth: 1, radius: 4, opacity: 0.9 },
  site: { stroke: "#1d4ed8", fill: "#2563eb", strokeWidth: 2, radius: 6, opacity: 0.95 },
  attachment: { stroke: "#c2410c", fill: "#f97316", strokeWidth: 2, radius: 5, opacity: 0.95 },
  lateral: { stroke: "#facc15", fill: "none", strokeWidth: 4, opacity: 0.94, dasharray: "8 6" },
};

export function defaultStyleForLayer(layerId: MapLayerId, kind: MapPrimitiveKind): MapPrimitiveStyle {
  const base = LAYER_STYLES[layerId];
  if (kind === "label") return { ...base, fill: base.fill ?? base.stroke, stroke: "none", opacity: 1 };
  if (kind === "polygon") return { ...base, fill: base.fill ?? base.stroke, opacity: Math.min(base.opacity ?? 0.8, 0.25) };
  return base;
}

export function resolvePrimitiveStyle(layerId: MapLayerId, kind: MapPrimitiveKind, style?: MapPrimitiveStyle): Required<MapPrimitiveStyle> {
  const next = { ...defaultStyleForLayer(layerId, kind), ...style };
  return {
    stroke: next.stroke ?? "none",
    fill: next.fill ?? "none",
    strokeWidth: next.strokeWidth ?? 1,
    radius: next.radius ?? 3,
    opacity: next.opacity ?? 1,
    dasharray: next.dasharray ?? "",
    fontSize: next.fontSize ?? 11,
    fontWeight: next.fontWeight ?? 500,
  };
}
