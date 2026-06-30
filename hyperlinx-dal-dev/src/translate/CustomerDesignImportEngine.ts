import JSZip from "jszip";
import { haversineFeet } from "../affinity/geo";
import type { DALCoordinate, InventoryGraph } from "../types/dal";
import type {
  CustomerDesignImport,
  CustomerDesignLayerVisibility,
  CustomerDesignLineageStage,
  CustomerDesignSourceType,
  ImportAuditEvent,
  ImportAuditEventType,
  ImportDiagnostic,
  ImportDiagnosticSeverity,
  ImportProvenance,
  ImportedCustomerFolder,
  ImportedCustomerObject,
  ImportedCustomerObjectType,
  ImportedCustomerPolygon,
  ImportedCustomerRoute,
  ImportedCustomerRouteState,
} from "./CustomerDesignImport";

type ParseContext = {
  importId: string;
  accountId: string;
  customerName: string;
  sourceFileName: string;
  sourceType: CustomerDesignSourceType;
  uploadedAt: string;
  uploadedBy: string;
  kmlEntryName?: string;
};

type KmlPlacemarkContext = {
  name: string;
  description?: string;
  style?: string;
  folderPath: string[];
  placemarkIndex: number;
};

type ParsedKmlContent = {
  routes: ImportedCustomerRoute[];
  objects: ImportedCustomerObject[];
  polygons: ImportedCustomerPolygon[];
  folders: ImportedCustomerFolder[];
  diagnostics: ImportDiagnostic[];
  auditEvents: ImportAuditEvent[];
};

type CsvRow = {
  rowNumber: number;
  values: Record<string, string>;
  cells: string[];
};

function createId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return `${prefix}-${crypto.randomUUID()}`;
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function safeId(value: string, fallback: string) {
  const normalized = value.trim().replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "");
  return normalized || fallback;
}

function sourceBaseName(fileName: string) {
  return fileName.replace(/\.[^.]+$/, "") || fileName;
}

function numberOrNull(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;
  const parsed = Number(value.trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function validCoordinate(coordinate: DALCoordinate | null | undefined): coordinate is DALCoordinate {
  return Boolean(
    coordinate &&
      Number.isFinite(coordinate[0]) &&
      Number.isFinite(coordinate[1]) &&
      Math.abs(coordinate[0]) <= 180 &&
      Math.abs(coordinate[1]) <= 90
  );
}

function cloneCoordinate(coordinate: DALCoordinate): DALCoordinate {
  return [Number(coordinate[0]), Number(coordinate[1])];
}

function toLatLonGeometry(geometry: DALCoordinate[]) {
  return geometry.map((coordinate) => ({
    latitude: Number(coordinate[1].toFixed(7)),
    longitude: Number(coordinate[0].toFixed(7)),
  }));
}

function routeFeet(geometry: DALCoordinate[]) {
  let feet = 0;
  for (let index = 1; index < geometry.length; index += 1) feet += haversineFeet(geometry[index - 1], geometry[index]);
  return feet;
}

function diagnostic(ctx: ParseContext, args: {
  severity: ImportDiagnosticSeverity;
  code: string;
  message: string;
  folderPath?: string[];
  placemarkName?: string;
  details?: Record<string, unknown>;
}): ImportDiagnostic {
  return {
    diagnosticId: createId("IMPORT-DIAG"),
    severity: args.severity,
    code: args.code,
    message: args.message,
    sourceFileName: ctx.sourceFileName,
    kmlEntryName: ctx.kmlEntryName,
    folderPath: args.folderPath,
    placemarkName: args.placemarkName,
    createdAt: new Date().toISOString(),
    details: args.details,
  };
}

function audit(ctx: ParseContext, eventType: ImportAuditEventType, message: string, routeId?: string, objectId?: string): ImportAuditEvent {
  return {
    eventId: createId("IMPORT-AUDIT"),
    eventType,
    message,
    routeId,
    objectId,
    createdAt: new Date().toISOString(),
    actor: ctx.uploadedBy,
  };
}

function lineageEvent(stage: CustomerDesignLineageStage, label: string, actor: string, routeId?: string, relatedId?: string) {
  return {
    lineageEventId: createId("CUSTOMER-DESIGN-LINEAGE"),
    stage,
    label,
    routeId,
    relatedId,
    createdAt: new Date().toISOString(),
    actor,
  };
}

const DEFAULT_LAYER_VISIBILITY: CustomerDesignLayerVisibility = {
  customerDesign: true,
  commercialDraft: false,
  engineeringRevision: false,
  acceptedRevision: false,
  inventory: true,
  stations: true,
  fiber: true,
  routes: true,
};

function libraryPathForImport(ctx: ParseContext, output: ParsedKmlContent) {
  const firstRoutePath = output.routes[0]?.folderPath.filter(Boolean) ?? [];
  const sourceLabel = sourceBaseName(ctx.sourceFileName);
  return [ctx.customerName, ...(firstRoutePath.length ? firstRoutePath : [sourceLabel])];
}

function provenance(ctx: ParseContext, args: {
  folderPath?: string[];
  placemarkName?: string;
  description?: string;
  style?: string;
  geometryType?: ImportProvenance["geometryType"];
  parseConfidence?: number;
}): ImportProvenance {
  const folderPath = args.folderPath ?? [];
  const originalKmlPath = [
    ctx.kmlEntryName ?? ctx.sourceFileName,
    ...folderPath,
    args.placemarkName,
  ].filter(Boolean).join(" / ");
  return {
    sourceFileName: ctx.sourceFileName,
    sourceType: ctx.sourceType,
    kmlEntryName: ctx.kmlEntryName,
    originalKmlPath,
    folderPath,
    placemarkName: args.placemarkName,
    description: args.description,
    style: args.style,
    geometryType: args.geometryType,
    parseConfidence: args.parseConfidence ?? 80,
    importedAt: ctx.uploadedAt,
    accountId: ctx.accountId,
    authoritySource: "CUSTOMER_FILE",
    authorityMode: "CUSTOMER",
  };
}

function classifyObject(name: string, description = ""): { objectType: ImportedCustomerObjectType; confidence: number } {
  const text = `${name} ${description}`.toLowerCase();
  if (/\bpop\b|point of presence/.test(text)) return { objectType: "POP", confidence: 90 };
  if (/\bila\b/.test(text)) return { objectType: "ILA", confidence: 88 };
  if (/regen|regeneration/.test(text)) return { objectType: "REGEN", confidence: 86 };
  if (/splice/.test(text)) return { objectType: "SPLICE_CASE", confidence: 86 };
  if (/\bhh\b|handhole/.test(text)) return { objectType: "HANDHOLE", confidence: 84 };
  if (/vault/.test(text)) return { objectType: "VAULT", confidence: 84 };
  if (/building|\bbldg\b|facility/.test(text)) return { objectType: "BUILDING", confidence: 82 };
  if (/campus|\bsite\b|\bdc\b|data center/.test(text)) return { objectType: "CUSTOMER_SITE", confidence: 80 };
  if (/anchor|endpoint|a location|z location/.test(text)) return { objectType: "ANCHOR", confidence: 76 };
  return { objectType: "UNKNOWN_PLACEMARK", confidence: 55 };
}

function classifyRouteState(name: string, description: string | undefined, folderPath: string[]): { designState: ImportedCustomerRouteState; confidence: number } {
  const text = `${folderPath.join(" ")} ${name} ${description ?? ""}`.toLowerCase();
  if (/existing|backbone|as built|in service|customer inventory/.test(text)) return { designState: "CUSTOMER_EXISTING", confidence: 84 };
  if (/draft|redline|review/.test(text)) return { designState: "CUSTOMER_DRAFT", confidence: 78 };
  if (/proposed|proposal|vendor|planned|candidate|new route|route option/.test(text)) return { designState: "CUSTOMER_PROPOSED", confidence: 82 };
  return { designState: "UNKNOWN", confidence: 60 };
}

function parseCoordinateText(text: string): { coordinates: DALCoordinate[]; invalidTokenCount: number } {
  let invalidTokenCount = 0;
  const coordinates = text
    .trim()
    .split(/\s+/)
    .map((token) => {
      const [lonRaw, latRaw] = token.split(",");
      const lon = numberOrNull(lonRaw);
      const lat = numberOrNull(latRaw);
      const coordinate = lon === null || lat === null ? null : ([lon, lat] as DALCoordinate);
      if (!validCoordinate(coordinate)) {
        invalidTokenCount += token.trim() ? 1 : 0;
        return null;
      }
      return coordinate;
    })
    .filter(validCoordinate)
    .map(cloneCoordinate);
  return { coordinates, invalidTokenCount };
}

function repairKmlNamespaces(xml: string) {
  let repaired = xml;
  const repairs: Array<[RegExp, string]> = [
    [/\bxsi:/, 'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"'],
    [/\bgx:/, 'xmlns:gx="http://www.google.com/kml/ext/2.2"'],
    [/\bkml:/, 'xmlns:kml="http://www.opengis.net/kml/2.2"'],
  ];
  for (const [prefixPattern, declaration] of repairs) {
    const attrName = declaration.split("=")[0];
    if (prefixPattern.test(repaired) && !repaired.includes(attrName)) {
      repaired = repaired.replace(/<([A-Za-z_][\w.-]*(?::[A-Za-z_][\w.-]*)?)([^<>]*)>/, `<$1$2 ${declaration}>`);
    }
  }
  return repaired;
}

function localName(element: Element) {
  return element.localName || element.nodeName.split(":").pop() || element.nodeName;
}

function childElements(element: ParentNode) {
  return Array.from(element.childNodes).filter((node): node is Element => node.nodeType === 1);
}

function directChildrenByLocalName(element: ParentNode, name: string) {
  return childElements(element).filter((child) => localName(child) === name);
}

function descendantsByLocalName(element: ParentNode, name: string) {
  return Array.from(element.querySelectorAll("*")).filter((child) => localName(child) === name);
}

function firstDirectText(element: ParentNode, name: string) {
  return directChildrenByLocalName(element, name)[0]?.textContent?.trim();
}

function firstDescendantText(element: ParentNode, name: string) {
  return descendantsByLocalName(element, name)[0]?.textContent?.trim();
}

function folderKey(path: string[]) {
  return path.join(" / ") || "ROOT";
}

function upsertFolder(folders: Map<string, ImportedCustomerFolder>, path: string[]) {
  const key = folderKey(path);
  if (folders.has(key)) return folders.get(key)!;
  const folder: ImportedCustomerFolder = {
    folderId: `FOLDER-${safeId(key, "ROOT")}`,
    name: path.at(-1) ?? "ROOT",
    folderPath: path,
    parentPath: path.slice(0, -1),
    placemarkCount: 0,
    routeCount: 0,
    objectCount: 0,
    polygonCount: 0,
  };
  folders.set(key, folder);
  return folder;
}

function addNearestRouteData(object: ImportedCustomerObject, routes: ImportedCustomerRoute[]) {
  let bestRouteId = "";
  let bestFeet = Number.POSITIVE_INFINITY;
  let bestStationFeet = 0;
  routes.forEach((route) => {
    let cursor = 0;
    route.dalGeometry.forEach((coordinate, index) => {
      const distance = haversineFeet([object.longitude, object.latitude], coordinate);
      if (distance < bestFeet) {
        bestRouteId = route.routeId;
        bestFeet = distance;
        bestStationFeet = cursor;
      }
      if (index > 0) cursor += haversineFeet(route.dalGeometry[index - 1], coordinate);
    });
  });
  if (bestRouteId) {
    object.nearestRouteId = bestRouteId;
    object.nearestStationFeet = Math.round(bestStationFeet);
  }
}

function parsePlacemark(ctx: ParseContext, placemark: Element, item: KmlPlacemarkContext, output: ParsedKmlContent, folders: Map<string, ImportedCustomerFolder>) {
  const folder = upsertFolder(folders, item.folderPath);
  folder.placemarkCount += 1;
  const lineStrings = descendantsByLocalName(placemark, "LineString");
  const points = descendantsByLocalName(placemark, "Point");
  const polygons = descendantsByLocalName(placemark, "Polygon");
  const unsupportedCount = descendantsByLocalName(placemark, "MultiTrack").length + descendantsByLocalName(placemark, "Track").length;

  lineStrings.forEach((lineString, lineIndex) => {
    const coordinateText = firstDescendantText(lineString, "coordinates") ?? "";
    const { coordinates, invalidTokenCount } = parseCoordinateText(coordinateText);
    if (invalidTokenCount) {
      output.diagnostics.push(diagnostic(ctx, {
        severity: "WARNING",
        code: "KML_COORDINATE_TUPLE_SKIPPED",
        message: `${item.name} LineString ${lineIndex + 1} skipped ${invalidTokenCount.toLocaleString()} invalid coordinate tuple(s).`,
        folderPath: item.folderPath,
        placemarkName: item.name,
      }));
    }
    if (coordinates.length < 2) {
      output.diagnostics.push(diagnostic(ctx, {
        severity: "ERROR",
        code: "KML_LINESTRING_TOO_SHORT",
        message: `${item.name} LineString ${lineIndex + 1} has fewer than two valid coordinates.`,
        folderPath: item.folderPath,
        placemarkName: item.name,
        details: { validCoordinateCount: coordinates.length },
      }));
      return;
    }
    const feet = routeFeet(coordinates);
    const state = classifyRouteState(item.name, item.description, item.folderPath);
    const routeId = `IMPORT-ROUTE-${safeId(item.name, `route-${item.placemarkIndex + 1}`)}-${lineIndex + 1}`;
    const route: ImportedCustomerRoute = {
      routeId,
      name: lineStrings.length > 1 ? `${item.name} ${lineIndex + 1}` : item.name,
      folderPath: item.folderPath,
      geometry: toLatLonGeometry(coordinates),
      dalGeometry: coordinates,
      routeFeet: Math.round(feet),
      routeMiles: Number((feet / 5280).toFixed(3)),
      sourceStyle: item.style,
      sourceDescription: item.description,
      designState: state.designState,
      pricingEligible: state.designState !== "CUSTOMER_EXISTING",
      confidence: Math.min(95, state.confidence + (invalidTokenCount ? -8 : 8)),
      provenance: provenance(ctx, {
        folderPath: item.folderPath,
        placemarkName: item.name,
        description: item.description,
        style: item.style,
        geometryType: "LineString",
        parseConfidence: Math.min(95, state.confidence + (invalidTokenCount ? -8 : 8)),
      }),
    };
    output.routes.push(route);
    folder.routeCount += 1;
    output.auditEvents.push(audit(ctx, "ROUTE_CLASSIFIED", `${route.name} classified as ${route.designState}.`, route.routeId));
  });

  points.forEach((point, pointIndex) => {
    const coordinateText = firstDescendantText(point, "coordinates") ?? "";
    const { coordinates, invalidTokenCount } = parseCoordinateText(coordinateText);
    if (invalidTokenCount || !coordinates[0]) {
      output.diagnostics.push(diagnostic(ctx, {
        severity: "WARNING",
        code: "KML_POINT_COORDINATE_MISSING",
        message: `${item.name} Point ${pointIndex + 1} does not include a valid coordinate.`,
        folderPath: item.folderPath,
        placemarkName: item.name,
      }));
      return;
    }
    const coordinate = coordinates[0];
    const classification = classifyObject(item.name, item.description);
    const objectId = `IMPORT-OBJECT-${safeId(item.name, `point-${item.placemarkIndex + 1}`)}-${pointIndex + 1}`;
    output.objects.push({
      objectId,
      name: points.length > 1 ? `${item.name} ${pointIndex + 1}` : item.name,
      folderPath: item.folderPath,
      latitude: Number(coordinate[1].toFixed(7)),
      longitude: Number(coordinate[0].toFixed(7)),
      objectType: classification.objectType,
      sourceDescription: item.description,
      confidence: classification.confidence,
      provenance: provenance(ctx, {
        folderPath: item.folderPath,
        placemarkName: item.name,
        description: item.description,
        style: item.style,
        geometryType: "Point",
        parseConfidence: classification.confidence,
      }),
    });
    folder.objectCount += 1;
  });

  polygons.forEach((polygon, polygonIndex) => {
    const rings = descendantsByLocalName(polygon, "coordinates")
      .map((coordinateNode) => parseCoordinateText(coordinateNode.textContent ?? "").coordinates)
      .filter((coordinates) => coordinates.length >= 3);
    if (!rings.length) {
      output.diagnostics.push(diagnostic(ctx, {
        severity: "WARNING",
        code: "KML_POLYGON_EMPTY",
        message: `${item.name} Polygon ${polygonIndex + 1} has no valid rings.`,
        folderPath: item.folderPath,
        placemarkName: item.name,
      }));
      return;
    }
    output.polygons.push({
      polygonId: `IMPORT-POLYGON-${safeId(item.name, `polygon-${item.placemarkIndex + 1}`)}-${polygonIndex + 1}`,
      name: polygons.length > 1 ? `${item.name} ${polygonIndex + 1}` : item.name,
      folderPath: item.folderPath,
      rings,
      sourceDescription: item.description,
      sourceStyle: item.style,
      confidence: 72,
      provenance: provenance(ctx, {
        folderPath: item.folderPath,
        placemarkName: item.name,
        description: item.description,
        style: item.style,
        geometryType: "Polygon",
        parseConfidence: 72,
      }),
    });
    folder.polygonCount += 1;
  });

  if (!lineStrings.length && !points.length && !polygons.length) {
    output.diagnostics.push(diagnostic(ctx, {
      severity: unsupportedCount ? "WARNING" : "INFO",
      code: unsupportedCount ? "KML_UNSUPPORTED_GEOMETRY" : "KML_PLACEMARK_NO_GEOMETRY",
      message: unsupportedCount
        ? `${item.name} contains unsupported KML geometry in this phase.`
        : `${item.name} has no LineString, Point, or Polygon geometry.`,
      folderPath: item.folderPath,
      placemarkName: item.name,
    }));
  }
}

function parseKmlText(ctx: ParseContext, text: string): ParsedKmlContent {
  const output: ParsedKmlContent = { routes: [], objects: [], polygons: [], folders: [], diagnostics: [], auditEvents: [] };
  const folders = new Map<string, ImportedCustomerFolder>();
  const parser = new DOMParser();
  const doc = parser.parseFromString(repairKmlNamespaces(text), "application/xml");
  const parserError = doc.querySelector("parsererror");
  if (parserError) {
    output.diagnostics.push(diagnostic(ctx, {
      severity: "ERROR",
      code: "KML_PARSE_FAILED",
      message: "KML parser reported invalid XML.",
      details: { parserError: parserError.textContent?.slice(0, 400) },
    }));
    return output;
  }

  let placemarkCount = 0;
  function walk(element: Element, path: string[]) {
    const elementName = localName(element);
    const namedContainer = elementName === "Document" || elementName === "Folder";
    const label = namedContainer ? firstDirectText(element, "name") : undefined;
    const nextPath = namedContainer && label ? [...path, label] : path;
    if (namedContainer) upsertFolder(folders, nextPath);
    directChildrenByLocalName(element, "Placemark").forEach((placemark) => {
      const name = firstDirectText(placemark, "name") ?? `KML Placemark ${placemarkCount + 1}`;
      parsePlacemark(ctx, placemark, {
        name,
        description: firstDirectText(placemark, "description"),
        style: firstDirectText(placemark, "styleUrl") ?? directChildrenByLocalName(placemark, "Style")[0]?.getAttribute("id") ?? undefined,
        folderPath: nextPath,
        placemarkIndex: placemarkCount,
      }, output, folders);
      placemarkCount += 1;
    });
    childElements(element)
      .filter((child) => localName(child) === "Document" || localName(child) === "Folder")
      .forEach((child) => walk(child, nextPath));
  }

  childElements(doc).forEach((element) => walk(element, []));
  if (!placemarkCount) {
    output.diagnostics.push(diagnostic(ctx, {
      severity: "WARNING",
      code: "KML_NO_PLACEMARKS",
      message: "KML parsed but no Placemark records were found.",
    }));
  }
  output.diagnostics.push(diagnostic(ctx, {
    severity: "INFO",
    code: "KML_PARSED",
    message: `Parsed ${output.routes.length.toLocaleString()} LineStrings, ${output.objects.length.toLocaleString()} Points, and ${output.polygons.length.toLocaleString()} Polygons.`,
    details: { placemarkCount, folderCount: folders.size },
  }));
  output.folders = Array.from(folders.values());
  output.objects.forEach((object) => addNearestRouteData(object, output.routes));
  return output;
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (char === '"' && quoted && next === '"') {
      field += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(field);
      field = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(field);
      if (row.some((cell) => cell.trim())) rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }
  row.push(field);
  if (row.some((cell) => cell.trim())) rows.push(row);
  return rows;
}

function normalizedHeader(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

function findHeader(headers: string[], candidates: string[]) {
  const normalized = headers.map(normalizedHeader);
  return candidates.map(normalizedHeader).map((candidate) => normalized.indexOf(candidate)).find((index) => index >= 0) ?? -1;
}

function rowValue(row: CsvRow, headers: string[], candidates: string[]) {
  const index = findHeader(headers, candidates);
  return index >= 0 ? row.cells[index] : undefined;
}

function parseCsvRows(ctx: ParseContext, text: string): ParsedKmlContent {
  const rows = parseCsv(text);
  const output: ParsedKmlContent = { routes: [], objects: [], polygons: [], folders: [], diagnostics: [], auditEvents: [] };
  const [headers = [], ...body] = rows;
  const routeIndex = findHeader(headers, ["route", "routeId", "route_id", "segment", "name"]);
  const sequenceIndex = findHeader(headers, ["sequence", "seq", "order", "index"]);
  const latIndex = findHeader(headers, ["lat", "latitude", "y"]);
  const lonIndex = findHeader(headers, ["lon", "lng", "longitude", "x"]);
  const aLatIndex = findHeader(headers, ["aLat", "aLatitude", "fromLat", "fromLatitude", "originLat"]);
  const aLonIndex = findHeader(headers, ["aLon", "aLng", "aLongitude", "fromLon", "fromLng", "fromLongitude", "originLon", "originLng"]);
  const zLatIndex = findHeader(headers, ["zLat", "zLatitude", "toLat", "toLatitude", "destinationLat"]);
  const zLonIndex = findHeader(headers, ["zLon", "zLng", "zLongitude", "toLon", "toLng", "toLongitude", "destinationLon", "destinationLng"]);
  const designStateIndex = findHeader(headers, ["state", "designState", "routeState", "status"]);
  const groups = new Map<string, Array<{ order: number; coordinate: DALCoordinate; rowNumber: number }>>();

  if (!headers.length) {
    output.diagnostics.push(diagnostic(ctx, { severity: "ERROR", code: "CSV_EMPTY", message: "CSV is empty or has no header row." }));
    return output;
  }

  const csvRows: CsvRow[] = body.map((cells, index) => ({
    rowNumber: index + 2,
    cells,
    values: Object.fromEntries(headers.map((header, headerIndex) => [header, cells[headerIndex] ?? ""])),
  }));

  if (aLatIndex >= 0 && aLonIndex >= 0 && zLatIndex >= 0 && zLonIndex >= 0) {
    csvRows.forEach((row, index) => {
      const aLat = numberOrNull(row.cells[aLatIndex]);
      const aLon = numberOrNull(row.cells[aLonIndex]);
      const zLat = numberOrNull(row.cells[zLatIndex]);
      const zLon = numberOrNull(row.cells[zLonIndex]);
      const a = aLon === null || aLat === null ? null : ([aLon, aLat] as DALCoordinate);
      const z = zLon === null || zLat === null ? null : ([zLon, zLat] as DALCoordinate);
      if (!validCoordinate(a) || !validCoordinate(z)) {
        output.diagnostics.push(diagnostic(ctx, { severity: "ERROR", code: "CSV_AZ_INVALID", message: `CSV row ${row.rowNumber} has invalid A/Z coordinates.` }));
        return;
      }
      const name = (routeIndex >= 0 ? row.cells[routeIndex] : "")?.trim() || `CSV A/Z Route ${index + 1}`;
      const state = classifyRouteState(name, row.cells[designStateIndex] ?? undefined, ["CSV"]);
      const feet = routeFeet([a, z]);
      const routeId = `IMPORT-ROUTE-${safeId(name, `csv-az-${index + 1}`)}`;
      output.routes.push({
        routeId,
        name,
        folderPath: ["CSV"],
        geometry: toLatLonGeometry([a, z]),
        dalGeometry: [a, z],
        routeFeet: Math.round(feet),
        routeMiles: Number((feet / 5280).toFixed(3)),
        sourceDescription: JSON.stringify(row.values),
        designState: state.designState === "UNKNOWN" ? "CUSTOMER_PROPOSED" : state.designState,
        pricingEligible: state.designState !== "CUSTOMER_EXISTING",
        confidence: Math.max(68, state.confidence),
        provenance: provenance(ctx, { folderPath: ["CSV"], placemarkName: name, description: JSON.stringify(row.values), geometryType: "CSV_AZ", parseConfidence: Math.max(68, state.confidence) }),
      });
      output.auditEvents.push(audit(ctx, "ROUTE_CLASSIFIED", `${name} classified from CSV A/Z row.`, routeId));
    });
  } else if (latIndex >= 0 && lonIndex >= 0) {
    csvRows.forEach((row, index) => {
      const lat = numberOrNull(row.cells[latIndex]);
      const lon = numberOrNull(row.cells[lonIndex]);
      const coordinate = lon === null || lat === null ? null : ([lon, lat] as DALCoordinate);
      if (!validCoordinate(coordinate)) {
        output.diagnostics.push(diagnostic(ctx, { severity: "ERROR", code: "CSV_COORDINATE_INVALID", message: `CSV row ${row.rowNumber} has missing or invalid coordinates.` }));
        return;
      }
      const routeName = (routeIndex >= 0 ? row.cells[routeIndex] : "")?.trim() || ctx.sourceFileName.replace(/\.[^.]+$/, "") || "CSV Route";
      const order = sequenceIndex >= 0 ? Number(row.cells[sequenceIndex]) : index;
      const list = groups.get(routeName) ?? [];
      list.push({ order: Number.isFinite(order) ? order : index, coordinate, rowNumber: row.rowNumber });
      groups.set(routeName, list);
    });
    Array.from(groups.entries()).forEach(([name, records], index) => {
      const coordinates = records.sort((a, b) => a.order - b.order).map((record) => record.coordinate);
      if (coordinates.length < 2) {
        output.diagnostics.push(diagnostic(ctx, { severity: "ERROR", code: "CSV_ROUTE_TOO_SHORT", message: `${name} has fewer than two valid route points.` }));
        return;
      }
      const state = classifyRouteState(name, undefined, ["CSV"]);
      const feet = routeFeet(coordinates);
      const routeId = `IMPORT-ROUTE-${safeId(name, `csv-route-${index + 1}`)}`;
      output.routes.push({
        routeId,
        name,
        folderPath: ["CSV"],
        geometry: toLatLonGeometry(coordinates),
        dalGeometry: coordinates,
        routeFeet: Math.round(feet),
        routeMiles: Number((feet / 5280).toFixed(3)),
        designState: state.designState === "UNKNOWN" ? "CUSTOMER_PROPOSED" : state.designState,
        pricingEligible: state.designState !== "CUSTOMER_EXISTING",
        confidence: Math.max(70, state.confidence),
        provenance: provenance(ctx, { folderPath: ["CSV"], placemarkName: name, geometryType: "CSV_ROUTE", parseConfidence: Math.max(70, state.confidence) }),
      });
      output.auditEvents.push(audit(ctx, "ROUTE_CLASSIFIED", `${name} classified from CSV route points.`, routeId));
    });
  } else {
    output.diagnostics.push(diagnostic(ctx, { severity: "ERROR", code: "CSV_COORDINATE_COLUMNS_MISSING", message: "CSV does not include latitude/longitude columns or A/Z coordinate columns." }));
  }

  output.folders = [{
    folderId: "FOLDER-CSV",
    name: "CSV",
    folderPath: ["CSV"],
    parentPath: [],
    placemarkCount: body.length,
    routeCount: output.routes.length,
    objectCount: output.objects.length,
    polygonCount: 0,
  }];
  output.diagnostics.push(diagnostic(ctx, {
    severity: "INFO",
    code: "CSV_PARSED",
    message: `CSV parsed with ${body.length.toLocaleString()} data rows and ${output.routes.length.toLocaleString()} imported route(s).`,
  }));
  return output;
}

function geoJsonFeatures(value: any): any[] {
  if (!value || typeof value !== "object") return [];
  if (value.type === "FeatureCollection" && Array.isArray(value.features)) return value.features;
  if (value.type === "Feature") return [value];
  if (value.type === "GeometryCollection" && Array.isArray(value.geometries)) {
    return value.geometries.map((geometry: any, index: number) => ({
      type: "Feature",
      properties: { name: `Geometry ${index + 1}` },
      geometry,
    }));
  }
  if (value.type && value.coordinates) return [{ type: "Feature", properties: {}, geometry: value }];
  return [];
}

function geoJsonName(feature: any, index: number) {
  const properties = feature?.properties && typeof feature.properties === "object" ? feature.properties : {};
  return String(properties.name ?? properties.Name ?? properties.title ?? properties.id ?? feature.id ?? `GeoJSON Feature ${index + 1}`);
}

function geoJsonCoordinates(value: unknown): DALCoordinate[] {
  if (!Array.isArray(value)) return [];
  const maybeCoordinate = value as DALCoordinate;
  if (validCoordinate(maybeCoordinate)) return [cloneCoordinate(maybeCoordinate)];
  return value.flatMap((item) => geoJsonCoordinates(item));
}

function parseGeoJsonText(ctx: ParseContext, jsonText: string): ParsedKmlContent {
  const output: ParsedKmlContent = { routes: [], objects: [], polygons: [], folders: [], diagnostics: [], auditEvents: [] };
  let parsed: any;
  try {
    parsed = JSON.parse(jsonText);
  } catch (error) {
    output.diagnostics.push(diagnostic(ctx, {
      severity: "ERROR",
      code: "GEOJSON_PARSE_FAILED",
      message: `GeoJSON parse failed: ${error instanceof Error ? error.message : String(error)}`,
    }));
    return output;
  }

  const features = geoJsonFeatures(parsed);
  features.forEach((feature, index) => {
    const geometry = feature?.geometry ?? feature;
    const geometryType = String(geometry?.type ?? "");
    const name = geoJsonName(feature, index);
    if (geometryType === "LineString" || geometryType === "MultiLineString") {
      const lineGroups = geometryType === "LineString" ? [geometry.coordinates] : geometry.coordinates;
      lineGroups.forEach((coordinates: unknown, lineIndex: number) => {
        const dalGeometry = geoJsonCoordinates(coordinates);
        if (dalGeometry.length < 2) return;
        const feet = routeFeet(dalGeometry);
        const routeId = `IMPORT-ROUTE-${safeId(name, `geojson-line-${index + 1}`)}-${lineIndex + 1}`;
        const state = classifyRouteState(name, undefined, ["GeoJSON"]);
        output.routes.push({
          routeId,
          name,
          folderPath: ["GeoJSON"],
          geometry: dalGeometry.map((coordinate) => ({ longitude: coordinate[0], latitude: coordinate[1] })),
          dalGeometry,
          routeFeet: Math.round(feet),
          routeMiles: Number((feet / 5280).toFixed(3)),
          designState: state.designState === "UNKNOWN" ? "CUSTOMER_EXISTING" : state.designState,
          pricingEligible: state.designState !== "CUSTOMER_EXISTING",
          confidence: Math.max(72, state.confidence),
          provenance: provenance(ctx, { folderPath: ["GeoJSON"], placemarkName: name, geometryType: "GEOJSON", parseConfidence: Math.max(72, state.confidence) }),
        });
        output.auditEvents.push(audit(ctx, "ROUTE_CLASSIFIED", `${name} classified from GeoJSON linework.`, routeId));
      });
      return;
    }
    if (geometryType === "Point" || geometryType === "MultiPoint") {
      const points = geometryType === "Point" ? [geometry.coordinates] : geometry.coordinates;
      points.forEach((coordinates: unknown, pointIndex: number) => {
        const coordinate = geoJsonCoordinates(coordinates)[0];
        if (!coordinate) return;
        const classification = classifyObject(name);
        output.objects.push({
          objectId: `IMPORT-OBJECT-${safeId(name, `geojson-point-${index + 1}`)}-${pointIndex + 1}`,
          name,
          folderPath: ["GeoJSON"],
          latitude: coordinate[1],
          longitude: coordinate[0],
          objectType: classification.objectType,
          confidence: classification.confidence,
          provenance: provenance(ctx, { folderPath: ["GeoJSON"], placemarkName: name, geometryType: "Point", parseConfidence: classification.confidence }),
        });
      });
      return;
    }
    if (geometryType === "Polygon" || geometryType === "MultiPolygon") {
      const polygons = geometryType === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
      polygons.forEach((coordinates: unknown, polygonIndex: number) => {
        const rings = Array.isArray(coordinates)
          ? coordinates.map((ring) => geoJsonCoordinates(ring)).filter((ring) => ring.length >= 3)
          : [];
        if (!rings.length) return;
        output.polygons.push({
          polygonId: `IMPORT-POLYGON-${safeId(name, `geojson-polygon-${index + 1}`)}-${polygonIndex + 1}`,
          name,
          folderPath: ["GeoJSON"],
          rings,
          confidence: 74,
          provenance: provenance(ctx, { folderPath: ["GeoJSON"], placemarkName: name, geometryType: "Polygon", parseConfidence: 74 }),
        });
      });
    }
  });

  output.objects.forEach((object) => addNearestRouteData(object, output.routes));
  output.folders = [{
    folderId: "FOLDER-GEOJSON",
    name: "GeoJSON",
    folderPath: ["GeoJSON"],
    parentPath: [],
    placemarkCount: features.length,
    routeCount: output.routes.length,
    objectCount: output.objects.length,
    polygonCount: output.polygons.length,
  }];
  output.diagnostics.push(diagnostic(ctx, {
    severity: output.routes.length || output.objects.length || output.polygons.length ? "INFO" : "WARNING",
    code: "GEOJSON_PARSED",
    message: `GeoJSON parsed with ${output.routes.length.toLocaleString()} route(s), ${output.objects.length.toLocaleString()} object(s), and ${output.polygons.length.toLocaleString()} polygon(s).`,
  }));
  return output;
}

function sourceTypeFromName(fileName: string): CustomerDesignSourceType {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".kmz")) return "KMZ";
  if (lower.endsWith(".kml")) return "KML";
  if (lower.endsWith(".geojson")) return "GEOJSON";
  if (lower.endsWith(".csv")) return "CSV";
  if (lower.endsWith(".zip") || lower.endsWith(".shp")) return "SHAPEFILE";
  if (lower.endsWith(".json")) return "JSON_RUNTIME_INVENTORY";
  return "API";
}

function mergeOutputs(outputs: ParsedKmlContent[]): ParsedKmlContent {
  return {
    routes: outputs.flatMap((output) => output.routes),
    objects: outputs.flatMap((output) => output.objects),
    polygons: outputs.flatMap((output) => output.polygons),
    folders: outputs.flatMap((output) => output.folders),
    diagnostics: outputs.flatMap((output) => output.diagnostics),
    auditEvents: outputs.flatMap((output) => output.auditEvents),
  };
}

function importStatus(output: ParsedKmlContent) {
  const hasErrors = output.diagnostics.some((item) => item.severity === "ERROR");
  const hasRecords = output.routes.length || output.objects.length || output.polygons.length;
  if (!hasRecords && hasErrors) return "FAILED" as const;
  if (hasErrors) return "PARTIAL" as const;
  return "PARSED" as const;
}

export async function parseCustomerDesignFile(args: {
  file: File;
  accountId?: string;
  customerName?: string;
  uploadedBy?: string;
}): Promise<CustomerDesignImport> {
  const sourceType = sourceTypeFromName(args.file.name);
  const uploadedAt = new Date().toISOString();
  const baseContext: ParseContext = {
    importId: createId("CUSTOMER-DESIGN-IMPORT"),
    accountId: args.accountId ?? "google",
    customerName: args.customerName ?? "Google",
    sourceFileName: args.file.name,
    sourceType,
    uploadedAt,
    uploadedBy: args.uploadedBy ?? "Ryan",
  };
  let output: ParsedKmlContent;

  if (sourceType === "KMZ") {
    try {
      const zip = await JSZip.loadAsync(await args.file.arrayBuffer());
      const kmlEntries = Object.values(zip.files).filter((entry) => !entry.dir && entry.name.toLowerCase().endsWith(".kml"));
      if (!kmlEntries.length) {
        output = { routes: [], objects: [], polygons: [], folders: [], auditEvents: [], diagnostics: [
          diagnostic(baseContext, { severity: "ERROR", code: "KMZ_NO_KML", message: "KMZ archive did not contain a KML file." }),
        ] };
      } else {
        const parsedEntries = await Promise.all(kmlEntries.map(async (entry) => {
          const ctx = { ...baseContext, kmlEntryName: entry.name };
          return parseKmlText(ctx, await entry.async("text"));
        }));
        output = mergeOutputs(parsedEntries);
        output.diagnostics.unshift(diagnostic(baseContext, {
          severity: kmlEntries.length > 1 ? "WARNING" : "INFO",
          code: "KMZ_KML_ENTRIES_EXTRACTED",
          message: `KMZ contained ${kmlEntries.length.toLocaleString()} KML file(s); all were parsed.`,
          details: { entries: kmlEntries.map((entry) => entry.name) },
        }));
      }
    } catch (error) {
      output = { routes: [], objects: [], polygons: [], folders: [], auditEvents: [], diagnostics: [
        diagnostic(baseContext, { severity: "ERROR", code: "KMZ_PARSE_FAILED", message: `KMZ parse failed: ${error instanceof Error ? error.message : String(error)}` }),
      ] };
    }
  } else if (sourceType === "KML") {
    output = parseKmlText(baseContext, await args.file.text());
  } else if (sourceType === "GEOJSON") {
    output = parseGeoJsonText(baseContext, await args.file.text());
  } else if (sourceType === "CSV") {
    output = parseCsvRows(baseContext, await args.file.text());
  } else if (sourceType === "SHAPEFILE") {
    output = { routes: [], objects: [], polygons: [], folders: [], auditEvents: [], diagnostics: [
      diagnostic(baseContext, { severity: "ERROR", code: "SHAPEFILE_FUTURE_READY", message: "Shapefile inventory import is present as a future-ready interface; convert to GeoJSON or Runtime Inventory JSON for this sprint." }),
    ] };
  } else if (sourceType === "JSON_RUNTIME_INVENTORY") {
    output = { routes: [], objects: [], polygons: [], folders: [], auditEvents: [], diagnostics: [
      diagnostic(baseContext, { severity: "ERROR", code: "RUNTIME_JSON_DIRECT_COMMIT", message: "Runtime Inventory JSON should be committed directly through the Existing Inventory runtime import path." }),
    ] };
  } else {
    output = { routes: [], objects: [], polygons: [], folders: [], auditEvents: [], diagnostics: [
      diagnostic(baseContext, { severity: "ERROR", code: "UNSUPPORTED_SOURCE_TYPE", message: "Translate 2.0 supports KMZ, KML, GeoJSON, CSV, and Runtime Inventory JSON in this phase." }),
    ] };
  }

  const rootProvenance = provenance(baseContext, { parseConfidence: output.diagnostics.some((item) => item.severity === "ERROR") ? 50 : 82 });
  const designId = `CUSTOMER-DESIGN-${safeId(baseContext.customerName, "CUSTOMER")}-${safeId(sourceBaseName(baseContext.sourceFileName), "DESIGN")}-${baseContext.importId.slice(-8)}`;
  const record: CustomerDesignImport = {
    designId,
    importId: baseContext.importId,
    accountId: baseContext.accountId,
    customerName: baseContext.customerName,
    libraryPath: libraryPathForImport(baseContext, output),
    sourceFileName: baseContext.sourceFileName,
    sourceType,
    uploadedAt,
    uploadedBy: baseContext.uploadedBy,
    status: importStatus(output),
    routes: output.routes,
    objects: output.objects,
    polygons: output.polygons,
    folders: output.folders,
    activeRouteId: output.routes[0]?.routeId,
    previewGeometry: output.routes[0]?.dalGeometry ?? [],
    layerVisibility: DEFAULT_LAYER_VISIBILITY,
    lineage: [
      lineageEvent("IMPORTED", `${baseContext.sourceFileName} imported as customer design evidence.`, baseContext.uploadedBy, output.routes[0]?.routeId, designId),
    ],
    diagnostics: output.diagnostics,
    auditEvents: [
      audit(baseContext, "FILE_UPLOADED", `${args.file.name} uploaded for staged customer design ingestion.`),
      audit(baseContext, "FILE_PARSED", `${output.routes.length.toLocaleString()} route(s), ${output.objects.length.toLocaleString()} object(s), and ${output.polygons.length.toLocaleString()} polygon(s) parsed.`),
      ...output.auditEvents,
    ],
    provenance: rootProvenance,
    noScopeVersionCreation: true,
    noInventoryMutation: true,
    noCertifiedRouteAuthority: true,
  };
  return record;
}

export function attachInventoryGraphToCustomerDesignImport(
  record: CustomerDesignImport,
  inventoryGraph: InventoryGraph,
): CustomerDesignImport {
  return {
    ...record,
    inventoryGraphId: inventoryGraph.inventoryId,
    graphId: inventoryGraph.graphId,
    inventoryGraph,
    validation: inventoryGraph.validation,
    previewGeometry: record.previewGeometry.length
      ? record.previewGeometry
      : record.routes.find((route) => route.routeId === record.activeRouteId)?.dalGeometry ?? record.routes[0]?.dalGeometry ?? [],
  };
}

export function updateImportedRouteState(
  record: CustomerDesignImport,
  routeId: string,
  designState: ImportedCustomerRouteState,
  actor = "Ryan",
): CustomerDesignImport {
  const timestamp = new Date().toISOString();
  const routes = record.routes ?? [];
  return {
    ...record,
    activeRouteId: routeId,
    routes: routes.map((route) => route.routeId === routeId
      ? {
          ...route,
          designState,
          pricingEligible: designState !== "CUSTOMER_EXISTING",
          confidence: Math.max(route.confidence, 76),
        }
      : route),
    auditEvents: [
      {
        eventId: createId("IMPORT-AUDIT"),
        eventType: "HUMAN_STATE_OVERRIDE",
        message: `${routeId} marked as ${designState}.`,
        routeId,
        actor,
        createdAt: timestamp,
      },
      ...(record.auditEvents ?? []),
    ],
  };
}

export function stageCustomerDesignImport(record: CustomerDesignImport, actor = "Ryan"): CustomerDesignImport {
  const routes = record.routes ?? [];
  return {
    ...record,
    status: "STAGED",
    layerVisibility: {
      ...DEFAULT_LAYER_VISIBILITY,
      ...(record.layerVisibility ?? {}),
      customerDesign: true,
      commercialDraft: Boolean(routes.some((route) => route.pricedDraft)),
    },
    auditEvents: [
      {
        eventId: createId("IMPORT-AUDIT"),
        eventType: "IMPORT_STAGED",
        message: `${record.sourceFileName} staged as customer design evidence. No production inventory mutation.`,
        actor,
        createdAt: new Date().toISOString(),
      },
      ...(record.auditEvents ?? []),
    ],
    lineage: [
      lineageEvent("IMPORTED", `${record.sourceFileName} staged in the Customer Design Library.`, actor, record.activeRouteId, record.designId),
      ...(record.lineage ?? []),
    ],
  };
}

export function attachPricedDraftToImportedRoute(
  record: CustomerDesignImport,
  routeId: string,
  pricedDraft: ImportedCustomerRoute["pricedDraft"],
  actor = "Ryan",
): CustomerDesignImport {
  const routes = record.routes ?? [];
  return {
    ...record,
    status: "PRICED",
    activeRouteId: routeId,
    layerVisibility: {
      ...DEFAULT_LAYER_VISIBILITY,
      ...(record.layerVisibility ?? {}),
      commercialDraft: true,
    },
    routes: routes.map((route) => route.routeId === routeId ? { ...route, pricedDraft } : route),
    auditEvents: [
      {
        eventId: createId("IMPORT-AUDIT"),
        eventType: "ROUTE_PRICED",
        message: `${routeId} priced through Transparent Estimating Engine.`,
        routeId,
        actor,
        createdAt: new Date().toISOString(),
      },
      ...(record.auditEvents ?? []),
    ],
    lineage: [
      lineageEvent("PRICED", `${routeId} priced with Transparent Estimating Engine.`, actor, routeId, pricedDraft?.routeId),
      ...(record.lineage ?? []),
    ],
  };
}

export function markImportedRoutePromoted(
  record: CustomerDesignImport,
  routeId: string,
  eventType: "ROUTE_PROMOTED_TO_COMMERCIAL_DRAFT" | "ROUTE_OPENED_IN_ENGINEERING",
  actor = "Ryan",
): CustomerDesignImport {
  const routes = record.routes ?? [];
  const layerVisibility = {
    ...DEFAULT_LAYER_VISIBILITY,
    ...(record.layerVisibility ?? {}),
  };
  return {
    ...record,
    status: eventType === "ROUTE_OPENED_IN_ENGINEERING" ? "OPENED_IN_ENGINEERING" : "PROMOTED_TO_COMMERCIAL_DRAFT",
    activeRouteId: routeId,
    layerVisibility: {
      ...layerVisibility,
      commercialDraft: true,
      engineeringRevision: eventType === "ROUTE_OPENED_IN_ENGINEERING" ? true : layerVisibility.engineeringRevision,
    },
    auditEvents: [
      {
        eventId: createId("IMPORT-AUDIT"),
        eventType,
        message: `${routeId} ${eventType === "ROUTE_OPENED_IN_ENGINEERING" ? "opened in Engineering" : "promoted to Commercial Draft"}.`,
        routeId,
        actor,
        createdAt: new Date().toISOString(),
      },
      ...(record.auditEvents ?? []),
    ],
    lineage: [
      lineageEvent(
        eventType === "ROUTE_OPENED_IN_ENGINEERING" ? "ENGINEERING_REVISION" : "COMMERCIAL_DRAFT",
        `${routeId} ${eventType === "ROUTE_OPENED_IN_ENGINEERING" ? "opened in Engineering" : "promoted to Commercial Draft"}.`,
        actor,
        routeId,
        routes.find((route) => route.routeId === routeId)?.pricedDraft?.routeId,
      ),
      ...(record.lineage ?? []),
    ],
  };
}
