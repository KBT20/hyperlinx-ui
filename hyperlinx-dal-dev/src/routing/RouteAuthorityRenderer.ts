import type { MapKernelPrimitive, MapKernelRenderSpec } from "../mapkernel";
import type { CertifiedRoute, RouteAuthorityState } from "./CertifiedRouteAuthority";

function routeStyle(state: RouteAuthorityState): MapKernelPrimitive["style"] {
  if (state === "CERTIFIED_ROUTE" || state === "PROVISIONALLY_CERTIFIED") {
    return { stroke: "#16a34a", strokeWidth: 5, opacity: 0.96, dasharray: "" };
  }
  if (state === "DIRECT_FALLBACK") {
    return { stroke: "#f97316", strokeWidth: 4, opacity: 0.9, dasharray: "12 8" };
  }
  if (state === "REJECTED_ROUTE" || state === "BLOCKED") {
    return { stroke: "#991b1b", strokeWidth: 4, opacity: 0.78, dasharray: "5 5" };
  }
  return { stroke: "#dc2626", strokeWidth: 4, opacity: 0.9, dasharray: "8 6" };
}

function stateLabel(state: RouteAuthorityState) {
  if (state === "CERTIFIED_ROUTE") return "CERTIFIED";
  if (state === "PROVISIONALLY_CERTIFIED") return "PROVISIONAL";
  if (state === "DIRECT_FALLBACK") return "DIRECT FALLBACK";
  if (state === "ENGINEER_REVIEW_REQUIRED") return "ENGINEER REVIEW REQUIRED";
  if (state === "REJECTED_ROUTE") return "REJECTED";
  if (state === "BLOCKED") return "BLOCKED";
  return "DRAFT";
}

export function renderCertifiedRouteAuthority(route: CertifiedRoute): MapKernelRenderSpec {
  const routeLabelCoordinate = route.geometry[Math.max(0, Math.floor(route.geometry.length / 2))] ?? route.attachmentCoordinate;
  const primitives: MapKernelPrimitive[] = [
    {
      id: `${route.certifiedRouteId}:candidate`,
      layerId: "site",
      kind: "point",
      coordinate: route.candidateCoordinate,
      label: "Candidate",
      payload: route,
      metadata: { sourceLayer: "routeAuthority", renderAuthority: "CertifiedRoute Candidate" },
      ref: { kind: "Site", id: `${route.certifiedRouteId}:candidate`, scopeVersionId: route.scopeVersionId },
    },
    {
      id: `${route.certifiedRouteId}:attachment`,
      layerId: "attachment",
      kind: "point",
      coordinate: route.attachmentCoordinate,
      label: "Attachment",
      payload: route,
      metadata: { sourceLayer: "routeAuthority", renderAuthority: "CertifiedRoute Attachment" },
      ref: { kind: "Attachment", id: `${route.certifiedRouteId}:attachment`, scopeVersionId: route.scopeVersionId },
    },
    {
      id: `${route.certifiedRouteId}:route`,
      layerId: "lateral",
      kind: "line",
      coordinates: route.geometry,
      label: stateLabel(route.routeAuthorityState),
      payload: route,
      style: routeStyle(route.routeAuthorityState),
      metadata: {
        sourceLayer: "routeAuthority",
        renderAuthority: route.routeAuthorityState === "CERTIFIED_ROUTE" ? "Certified Geometry" : "Editable Geometry",
      },
      ref: { kind: "Lateral", id: route.certifiedRouteId, scopeVersionId: route.scopeVersionId, routeId: route.certifiedRouteId },
    },
    {
      id: `${route.certifiedRouteId}:route-label`,
      layerId: "object",
      kind: "label",
      coordinate: routeLabelCoordinate,
      label: stateLabel(route.routeAuthorityState),
      payload: route,
      style: { fill: route.routeAuthorityState === "CERTIFIED_ROUTE" ? "#16a34a" : "#f97316", fontSize: 13, fontWeight: 800 },
      metadata: { sourceLayer: "routeAuthority", renderAuthority: "CertifiedRoute Label" },
      ref: { kind: "Object", id: `${route.certifiedRouteId}:label`, scopeVersionId: route.scopeVersionId },
    },
  ];

  return {
    specId: `certified-route:${route.certifiedRouteId}`,
    sourceType: "Manual",
    sourceId: route.certifiedRouteId,
    name: `CertifiedRoute ${route.certifiedRouteId}`,
    primitives,
    metadata: {
      certifiedRouteId: route.certifiedRouteId,
      scopeVersionId: route.scopeVersionId,
      routeAuthorityState: route.routeAuthorityState,
      routeMode: route.routeMode,
      geometryHash: route.geometryHash,
    },
  };
}
