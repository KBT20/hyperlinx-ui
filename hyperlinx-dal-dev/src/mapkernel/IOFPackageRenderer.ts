import type { DALCoordinate, IOFPackage, IOFPackageStatus } from "../types/dal";
import { isValidCoordinate } from "./MapViewportManager";
import type { MapKernelPrimitive, MapKernelRenderSpec } from "./MapLayerManager";

// IOF Packages describe execution work. Rendering an IOF Package is a work lens,
// not a replacement for ScopeVersion constitutional truth.

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function coordinateFrom(value: unknown): DALCoordinate | undefined {
  if (isValidCoordinate(value)) return value;
  const record = asRecord(value);
  const lon = Number(record.lon ?? record.lng ?? record.longitude);
  const lat = Number(record.lat ?? record.latitude);
  return isValidCoordinate([lon, lat]) ? [lon, lat] : undefined;
}

function coordinatesFrom(value: unknown): DALCoordinate[] {
  if (!Array.isArray(value)) return [];
  if (value.every(isValidCoordinate)) return value as DALCoordinate[];
  return value.map(coordinateFrom).filter((coord): coord is DALCoordinate => Boolean(coord));
}

function packageId(iofPackage: IOFPackage) {
  return String(iofPackage.packageId ?? `iof-${Date.now()}`);
}

function packageStyle(status: IOFPackageStatus) {
  if (status === "CLOSED") return { stroke: "#581c87", opacity: 0.95, dasharray: "" };
  if (status === "COMPLETE") return { stroke: "#7e22ce", opacity: 0.9, dasharray: "4 3" };
  if (status === "ACTIVE") return { stroke: "#c026d3", opacity: 0.9, dasharray: "10 4" };
  if (status === "APPROVED") return { stroke: "#9333ea", opacity: 0.82, dasharray: "10 4" };
  return { stroke: "#a855f7", opacity: 0.72, dasharray: "2 5" };
}

function stationLabel(station: Record<string, unknown>) {
  const explicit = station.label ?? station.stationLabel ?? station.stationId;
  if (explicit) return String(explicit);
  const feet = Number(station.feet ?? station.stationFeet ?? station.measureFeet ?? 0);
  if (!Number.isFinite(feet)) return "Station";
  return `${Math.floor(feet / 100)}+${Math.round(feet % 100).toString().padStart(2, "0")}`;
}

export function renderIOFPackage(iofPackage: IOFPackage): MapKernelRenderSpec {
  const id = packageId(iofPackage);
  const style = packageStyle(iofPackage.status);
  const primitives: MapKernelPrimitive[] = [];
  const scopeVersionId = String(iofPackage.scopeVersionId ?? "no-scope");
  const truth = asRecord((iofPackage as unknown as Record<string, unknown>).canonicalTruth);
  const routeSources = [
    ...asArray(iofPackage.route),
    ...asArray((iofPackage as unknown as Record<string, unknown>).routes),
    ...asArray(truth.routes),
    asRecord(truth.route),
  ].filter((route) => Object.keys(asRecord(route)).length);

  routeSources.forEach((routeValue, index) => {
    const route = asRecord(routeValue);
    const coordinates = coordinatesFrom(route.coordinates ?? route.geometry ?? route.routeGeometry);
    if (coordinates.length < 2) return;
    const routeId = String(route.routeId ?? route.id ?? `${id}:route:${index}`);
    primitives.push({
      id: routeId,
      layerId: "iofPackage",
      kind: "line",
      coordinates,
      label: `${iofPackage.packageType} ${iofPackage.status}`,
      payload: routeValue,
      style,
      metadata: {
        source: "IOFPackage",
        sourceLayer: "iofPackage",
        rootScopeVersionId: scopeVersionId,
        renderAuthority: "IOF Package Work",
        packageId: id,
        packageType: iofPackage.packageType,
        packageStatus: iofPackage.status,
        progress: iofPackage.progress,
      },
      ref: { kind: "Route", id: routeId, scopeVersionId, routeId },
    });
  });

  const loosePackage = iofPackage as unknown as Record<string, unknown>;
  const stations = [...asArray(iofPackage.stations), ...asArray(truth.stations), ...asArray(loosePackage.stationing)];
  const renderedStationAuthority = new Set<string>();
  stations.forEach((stationValue, index) => {
    const station = asRecord(stationValue);
    const coordinate = coordinateFrom(station.coordinate ?? station.geometry ?? station);
    if (!coordinate) return;
    const stationId = String(station.stationId ?? station.id ?? `${id}:station:${index}`);
    const label = stationLabel(station);
    const stationFeet = Number(station.feet ?? station.stationFeet ?? station.measureFeet ?? 0);
    const stationAuthorityKey = `${id}:${scopeVersionId}:${stationId}:${coordinate[0]}:${coordinate[1]}:${label}`;
    if (renderedStationAuthority.has(stationAuthorityKey)) return;
    renderedStationAuthority.add(stationAuthorityKey);
    primitives.push({
      id: `${stationId}:point`,
      layerId: "station",
      kind: "point",
      coordinate,
      label,
      payload: stationValue,
      metadata: { stationFeet, source: "IOFPackage", sourceLayer: "iofPackage", rootScopeVersionId: scopeVersionId, renderAuthority: "IOF Package Work", packageId: id },
      ref: { kind: "Station", id: stationId, scopeVersionId, stationId, routeId: String(station.routeId ?? "") },
    });
    primitives.push({
      id: `${stationId}:label`,
      layerId: "station",
      kind: "label",
      coordinate,
      label,
      payload: stationValue,
      metadata: { stationFeet, source: "IOFPackage", sourceLayer: "iofPackage", rootScopeVersionId: scopeVersionId, renderAuthority: "IOF Package Work", packageId: id },
      ref: { kind: "Station", id: stationId, scopeVersionId, stationId, routeId: String(station.routeId ?? "") },
    });
  });

  const objects = [
    ...asArray(iofPackage.objects),
    ...asArray(truth.objects),
    ...asArray(loosePackage.productionUnits),
    ...asArray(truth.productionUnits),
  ];
  objects.forEach((objectValue, index) => {
    const object = asRecord(objectValue);
    const coordinate = coordinateFrom(object.coordinate ?? object.geometry ?? object);
    if (!coordinate) return;
    const objectId = String(object.objectId ?? object.id ?? object.productionUnitId ?? `${id}:object:${index}`);
    const kind = object.productionUnitId ? "ProductionUnit" : "Object";
    primitives.push({
      id: objectId,
      layerId: "object",
      kind: "point",
      coordinate,
      label: String(object.name ?? object.type ?? kind),
      payload: objectValue,
      metadata: {
        source: "IOFPackage",
        sourceLayer: "iofPackage",
        rootScopeVersionId: scopeVersionId,
        renderAuthority: "IOF Package Work",
        packageId: id,
        packageType: iofPackage.packageType,
        packageStatus: iofPackage.status,
        progress: iofPackage.progress,
      },
      ref: { kind, id: objectId, scopeVersionId, objectId },
    });
  });

  return {
    specId: `iof:${id}`,
    sourceType: "IOFPackage",
    sourceId: id,
    name: `${iofPackage.packageType} / ${iofPackage.status}`,
    primitives,
    metadata: {
      packageId: id,
      scopeVersionId: iofPackage.scopeVersionId,
      packageType: iofPackage.packageType,
      packageStatus: iofPackage.status,
      packageProgress: iofPackage.progress,
    },
  };
}
