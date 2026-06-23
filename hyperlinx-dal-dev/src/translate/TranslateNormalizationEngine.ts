import JSZip from "jszip";
import {
  createCorridorEvidenceBundle,
  lineGeometry,
  normalizeEndpointEvidence,
  normalizeRouteEvidence,
  pointGeometry,
} from "../corridor/CorridorNormalizationEngine";
import type { CorridorRawEvidenceInput } from "../corridor/CorridorNormalizedEvidence";
import type { CorridorCoordinate } from "../corridor/corridorTypes";
import type {
  TranslateArtifact,
  TranslateBinaryInput,
  TranslateSourceType,
  TranslateTextInput,
} from "./TranslateContract";
import { createTranslateDiagnostic } from "./TranslateDiagnostic";
import type { TranslateDiagnostic } from "./TranslateDiagnostic";
import { createTranslateJob } from "./TranslateJob";
import type { TranslateJob } from "./TranslateJob";
import type { TranslateResult } from "./TranslateResult";

type ExtractedEvidenceInputs = {
  endpointInputs: CorridorRawEvidenceInput[];
  routeInputs: CorridorRawEvidenceInput[];
  diagnostics: TranslateDiagnostic[];
};

function stableHash(value: unknown) {
  const text = JSON.stringify(value);
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
}

function safeId(text: unknown, fallback: string) {
  const source = String(text ?? fallback).trim();
  const cleaned = source.replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return cleaned || fallback;
}

function toNumber(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  if (typeof value !== "string") return undefined;
  const numeric = Number(value.trim());
  return Number.isFinite(numeric) ? numeric : undefined;
}

function validCoordinate(coord: unknown): coord is CorridorCoordinate {
  if (!Array.isArray(coord) || coord.length < 2) return false;
  const lon = toNumber(coord[0]);
  const lat = toNumber(coord[1]);
  return lon !== undefined && lat !== undefined && Math.abs(lat) <= 90 && Math.abs(lon) <= 180;
}

function normalizeCoordinate(coord: unknown): CorridorCoordinate | undefined {
  if (!validCoordinate(coord)) return undefined;
  return [Number(coord[0]), Number(coord[1])];
}

function normalizeRole(value: unknown) {
  const role = String(value ?? "").trim().toUpperCase();
  if (["A", "A_END", "A-END"].includes(role)) return "A_END";
  if (["Z", "Z_END", "Z-END"].includes(role)) return "Z_END";
  if (["REGEN", "INTERMEDIATE", "INTERCONNECT"].includes(role)) return role;
  return undefined;
}

function createDiagnostic(
  diagnostics: TranslateDiagnostic[],
  args: Parameters<typeof createTranslateDiagnostic>[0]
) {
  const diagnostic = createTranslateDiagnostic(args);
  diagnostics.push(diagnostic);
  return diagnostic;
}

function createJob(sourceType: TranslateSourceType, fileName: string) {
  const job = createTranslateJob({ sourceType, fileName });
  const diagnostic = createTranslateDiagnostic({
    code: "TRANSLATE_JOB_CREATED",
    severity: "INFO",
    message: `Translate job created for ${fileName}.`,
    sourceFile: fileName,
    sourceType,
    details: { jobId: job.jobId },
  });
  job.diagnostics.push(diagnostic);
  return job;
}

function completeResult(args: {
  job: TranslateJob;
  sourceType: TranslateSourceType;
  sourceFile: string;
  endpointInputs: CorridorRawEvidenceInput[];
  routeInputs: CorridorRawEvidenceInput[];
  diagnostics: TranslateDiagnostic[];
}): TranslateResult {
  const endpointEvidence = normalizeEndpointEvidence(args.endpointInputs);
  const routeEvidence = normalizeRouteEvidence(args.routeInputs);
  const evidence = [...endpointEvidence, ...routeEvidence];
  const evidenceBundle = createCorridorEvidenceBundle({
    bundleId: `translate-bundle-${args.sourceType.toLowerCase()}-${stableHash(args.sourceFile + evidence.length)}`,
    evidence,
  });
  const artifacts: TranslateArtifact[] = evidence.map((item) => {
    const label = String(item.normalizedPayload.name ?? item.normalizedPayload.routeName ?? item.entityId);
    return {
      artifactId: `artifact-${item.entityType.toLowerCase()}-${item.entityId}`,
      artifactType: item.entityType === "ENDPOINT" ? "ENDPOINT" : "ROUTE_CANDIDATE",
      entityId: item.entityId,
      evidenceIds: [item.evidenceId],
      label,
      summary: {
        sourceType: item.sourceType,
        confidence: item.confidence,
        geometryType: item.geometryReference?.geometryType,
      },
    };
  });

  for (const item of evidence) {
    createDiagnostic(args.diagnostics, {
      code: "TRANSLATE_EVIDENCE_CREATED",
      severity: "INFO",
      message: `Normalized evidence created for ${item.entityType}.`,
      sourceFile: args.sourceFile,
      sourceType: args.sourceType,
      entityId: item.entityId,
      evidenceId: item.evidenceId,
      details: { confidence: item.confidence },
    });
  }

  args.job.status = "NORMALIZED";
  args.job.completedAt = new Date().toISOString();
  args.job.diagnostics = [...args.job.diagnostics, ...args.diagnostics];

  return {
    job: args.job,
    sourceType: args.sourceType,
    sourceFile: args.sourceFile,
    evidenceBundle,
    artifacts,
    diagnostics: args.job.diagnostics,
  };
}

function splitCsvLine(line: string) {
  const values: string[] = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];
    if (char === "\"" && quoted && next === "\"") {
      current += "\"";
      index += 1;
      continue;
    }
    if (char === "\"") {
      quoted = !quoted;
      continue;
    }
    if (char === "," && !quoted) {
      values.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }
  values.push(current.trim());
  return values;
}

function parseCsv(text: string) {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (!lines.length) return [];
  const headers = splitCsvLine(lines[0] ?? "").map((header) => header.trim());
  return lines.slice(1).map((line, rowIndex) => {
    const values = splitCsvLine(line);
    const row: Record<string, string> = {};
    headers.forEach((header, index) => {
      row[header] = values[index] ?? "";
    });
    return { row, rowNumber: rowIndex + 2 };
  });
}

function getRowValue(row: Record<string, string>, names: string[]) {
  const normalized = new Map(Object.entries(row).map(([key, value]) => [key.toLowerCase().replace(/[^a-z0-9]/g, ""), value]));
  for (const name of names) {
    const value = normalized.get(name.toLowerCase().replace(/[^a-z0-9]/g, ""));
    if (value !== undefined && value !== "") return value;
  }
  return undefined;
}

export async function translateCsv(input: TranslateTextInput): Promise<TranslateResult> {
  const sourceType: TranslateSourceType = "CSV";
  const job = createJob(sourceType, input.fileName);
  const diagnostics: TranslateDiagnostic[] = [];
  const parsedRows = parseCsv(input.text);
  createDiagnostic(diagnostics, {
    code: "TRANSLATE_FILE_PARSED",
    severity: "INFO",
    message: `CSV parsed with ${parsedRows.length} data rows.`,
    sourceFile: input.fileName,
    sourceType,
  });

  const endpointInputs: CorridorRawEvidenceInput[] = [];
  const routeCoordinates: CorridorCoordinate[] = [];

  parsedRows.forEach(({ row, rowNumber }, index) => {
    const latitude = toNumber(getRowValue(row, ["latitude", "lat", "y"]));
    const longitude = toNumber(getRowValue(row, ["longitude", "lon", "lng", "long", "x"]));
    if (latitude === undefined || longitude === undefined) {
      createDiagnostic(diagnostics, {
        code: "TRANSLATE_WARNING",
        severity: "WARNING",
        message: `CSV row ${rowNumber} does not include valid coordinates.`,
        sourceFile: input.fileName,
        sourceType,
        details: { rowNumber },
      });
      return;
    }

    const name = getRowValue(row, ["name", "site", "siteName", "company", "facility", "endpoint"]) ?? `CSV Endpoint ${index + 1}`;
    const role = normalizeRole(getRowValue(row, ["role", "endpointRole", "end"]));
    const entityId = `END-${safeId(getRowValue(row, ["id", "endpointId", "siteId"]) ?? name, `csv-${index + 1}`)}`;
    routeCoordinates.push([longitude, latitude]);
    endpointInputs.push({
      sourceType: "CSV",
      sourceName: input.fileName,
      entityType: "ENDPOINT",
      entityId,
      rawReference: `csv:row:${rowNumber}`,
      rawPayload: row,
      normalizedPayload: {
        name,
        role,
        address: getRowValue(row, ["address", "street", "location"]),
        city: getRowValue(row, ["city"]),
        state: getRowValue(row, ["state"]),
        properties: row,
      },
      geometryReference: pointGeometry(longitude, latitude),
    });
    createDiagnostic(diagnostics, {
      code: "TRANSLATE_ENDPOINT_EXTRACTED",
      severity: "INFO",
      message: `Endpoint extracted from CSV row ${rowNumber}.`,
      sourceFile: input.fileName,
      sourceType,
      entityId,
    });
  });

  const routeInputs: CorridorRawEvidenceInput[] = [];
  if (routeCoordinates.length >= 2) {
    const entityId = `ROUTE-${safeId(input.fileName, "csv-route")}`;
    routeInputs.push({
      sourceType: "CSV",
      sourceName: input.fileName,
      entityType: "ROUTE_CANDIDATE",
      entityId,
      rawReference: "csv:coordinate-sequence",
      normalizedPayload: {
        routeName: `${input.fileName} coordinate sequence`,
        coordinateCount: routeCoordinates.length,
        source: "CSV",
      },
      geometryReference: lineGeometry(routeCoordinates),
    });
    createDiagnostic(diagnostics, {
      code: "TRANSLATE_ROUTE_EXTRACTED",
      severity: "INFO",
      message: "Route candidate evidence extracted from CSV coordinate sequence.",
      sourceFile: input.fileName,
      sourceType,
      entityId,
      details: { coordinateCount: routeCoordinates.length },
    });
  }

  return completeResult({
    job,
    sourceType,
    sourceFile: input.fileName,
    endpointInputs,
    routeInputs,
    diagnostics,
  });
}

type GeoJsonGeometry = {
  type?: string;
  coordinates?: unknown;
  geometries?: GeoJsonGeometry[];
};

function featureName(properties: Record<string, unknown>, fallback: string) {
  return String(properties.name ?? properties.title ?? properties.siteName ?? properties.facilityName ?? properties.id ?? fallback);
}

function collectGeoJsonEvidence(args: {
  geometry: GeoJsonGeometry | undefined;
  properties: Record<string, unknown>;
  fileName: string;
  featureIndex: number;
  sourceType: TranslateSourceType;
  endpointInputs: CorridorRawEvidenceInput[];
  routeInputs: CorridorRawEvidenceInput[];
  diagnostics: TranslateDiagnostic[];
}) {
  const geometry = args.geometry;
  if (!geometry?.type) return;
  const label = featureName(args.properties, `Feature ${args.featureIndex + 1}`);
  const idSeed = String(args.properties.id ?? args.properties.endpointId ?? args.properties.routeId ?? label);

  if (geometry.type === "Point") {
    const coordinate = normalizeCoordinate(geometry.coordinates);
    if (!coordinate) return;
    const entityId = `END-${safeId(idSeed, `geojson-point-${args.featureIndex + 1}`)}`;
    args.endpointInputs.push({
      sourceType: "GEOJSON",
      sourceName: args.fileName,
      entityType: "ENDPOINT",
      entityId,
      rawReference: `geojson:feature:${args.featureIndex}`,
      rawPayload: args.properties,
      normalizedPayload: {
        name: label,
        role: normalizeRole(args.properties.role),
        properties: args.properties,
      },
      geometryReference: pointGeometry(coordinate[0], coordinate[1]),
    });
    createDiagnostic(args.diagnostics, {
      code: "TRANSLATE_ENDPOINT_EXTRACTED",
      severity: "INFO",
      message: "Endpoint extracted from GeoJSON Point.",
      sourceFile: args.fileName,
      sourceType: args.sourceType,
      entityId,
    });
    return;
  }

  if (geometry.type === "MultiPoint" && Array.isArray(geometry.coordinates)) {
    geometry.coordinates.forEach((coord, index) => {
      collectGeoJsonEvidence({
        ...args,
        geometry: { type: "Point", coordinates: coord },
        properties: { ...args.properties, id: `${idSeed}-${index + 1}` },
      });
    });
    return;
  }

  if (geometry.type === "LineString" && Array.isArray(geometry.coordinates)) {
    const coordinates = geometry.coordinates.map(normalizeCoordinate).filter((coord): coord is CorridorCoordinate => Boolean(coord));
    if (coordinates.length < 2) return;
    const entityId = `ROUTE-${safeId(idSeed, `geojson-line-${args.featureIndex + 1}`)}`;
    args.routeInputs.push({
      sourceType: "GEOJSON",
      sourceName: args.fileName,
      entityType: "ROUTE_CANDIDATE",
      entityId,
      rawReference: `geojson:feature:${args.featureIndex}`,
      rawPayload: args.properties,
      normalizedPayload: {
        routeName: label,
        coordinateCount: coordinates.length,
        source: "GEOJSON",
        properties: args.properties,
      },
      geometryReference: lineGeometry(coordinates),
    });
    createDiagnostic(args.diagnostics, {
      code: "TRANSLATE_ROUTE_EXTRACTED",
      severity: "INFO",
      message: "Route candidate evidence extracted from GeoJSON LineString.",
      sourceFile: args.fileName,
      sourceType: args.sourceType,
      entityId,
      details: { coordinateCount: coordinates.length },
    });
    return;
  }

  if (geometry.type === "MultiLineString" && Array.isArray(geometry.coordinates)) {
    geometry.coordinates.forEach((line, index) => {
      collectGeoJsonEvidence({
        ...args,
        geometry: { type: "LineString", coordinates: line },
        properties: { ...args.properties, id: `${idSeed}-${index + 1}` },
      });
    });
    return;
  }

  if (geometry.type === "GeometryCollection" && Array.isArray(geometry.geometries)) {
    geometry.geometries.forEach((child) => {
      collectGeoJsonEvidence({ ...args, geometry: child });
    });
  }
}

export async function translateGeoJson(input: TranslateTextInput): Promise<TranslateResult> {
  const sourceType: TranslateSourceType = "GEOJSON";
  const job = createJob(sourceType, input.fileName);
  const diagnostics: TranslateDiagnostic[] = [];
  const endpointInputs: CorridorRawEvidenceInput[] = [];
  const routeInputs: CorridorRawEvidenceInput[] = [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(input.text);
  } catch (error) {
    createDiagnostic(diagnostics, {
      code: "TRANSLATE_ERROR",
      severity: "ERROR",
      message: `GeoJSON parse failed: ${error instanceof Error ? error.message : String(error)}`,
      sourceFile: input.fileName,
      sourceType,
    });
    return completeResult({ job, sourceType, sourceFile: input.fileName, endpointInputs, routeInputs, diagnostics });
  }

  const features = (parsed as { type?: string; features?: unknown[] }).type === "FeatureCollection"
    ? ((parsed as { features?: unknown[] }).features ?? [])
    : [(parsed as unknown)];

  createDiagnostic(diagnostics, {
    code: "TRANSLATE_FILE_PARSED",
    severity: "INFO",
    message: `GeoJSON parsed with ${features.length} feature records.`,
    sourceFile: input.fileName,
    sourceType,
  });

  features.forEach((feature, featureIndex) => {
    const maybeFeature = feature as { type?: string; geometry?: GeoJsonGeometry; properties?: Record<string, unknown> };
    const geometry = maybeFeature.type === "Feature" ? maybeFeature.geometry : (feature as GeoJsonGeometry);
    const properties = maybeFeature.type === "Feature" ? (maybeFeature.properties ?? {}) : {};
    collectGeoJsonEvidence({
      geometry,
      properties,
      fileName: input.fileName,
      featureIndex,
      sourceType,
      endpointInputs,
      routeInputs,
      diagnostics,
    });
  });

  return completeResult({
    job,
    sourceType,
    sourceFile: input.fileName,
    endpointInputs,
    routeInputs,
    diagnostics,
  });
}

function parseCoordinateText(text: string): CorridorCoordinate[] {
  return text
    .trim()
    .split(/\s+/)
    .map((token) => token.split(","))
    .map((parts) => {
      const lon = toNumber(parts[0]);
      const lat = toNumber(parts[1]);
      return lon !== undefined && lat !== undefined ? ([lon, lat] as CorridorCoordinate) : undefined;
    })
    .filter((coord): coord is CorridorCoordinate => Boolean(coord));
}

function elementsByLocalName(root: ParentNode, localName: string) {
  return Array.from(root.querySelectorAll("*")).filter((element) => element.localName === localName);
}

function firstLocalText(root: ParentNode, localName: string) {
  return elementsByLocalName(root, localName)[0]?.textContent?.trim();
}

function parseKmlWithDom(args: {
  text: string;
  fileName: string;
  sourceType: TranslateSourceType;
  endpointInputs: CorridorRawEvidenceInput[];
  routeInputs: CorridorRawEvidenceInput[];
  diagnostics: TranslateDiagnostic[];
}) {
  const dom = new DOMParser().parseFromString(args.text, "application/xml");
  const parserError = dom.querySelector("parsererror");
  if (parserError) {
    createDiagnostic(args.diagnostics, {
      code: "TRANSLATE_ERROR",
      severity: "ERROR",
      message: "KML parser reported invalid XML.",
      sourceFile: args.fileName,
      sourceType: args.sourceType,
      details: { parserError: parserError.textContent?.slice(0, 240) },
    });
    return;
  }

  const placemarks = elementsByLocalName(dom, "Placemark");
  createDiagnostic(args.diagnostics, {
    code: "TRANSLATE_FILE_PARSED",
    severity: "INFO",
    message: `KML parsed with ${placemarks.length} placemarks.`,
    sourceFile: args.fileName,
    sourceType: args.sourceType,
  });

  placemarks.forEach((placemark, index) => {
    const name = firstLocalText(placemark, "name") ?? `KML Placemark ${index + 1}`;
    const description = firstLocalText(placemark, "description");
    const points = elementsByLocalName(placemark, "Point");
    const lineStrings = elementsByLocalName(placemark, "LineString");

    points.forEach((point, pointIndex) => {
      const coordinateText = firstLocalText(point, "coordinates");
      const coordinate = coordinateText ? parseCoordinateText(coordinateText)[0] : undefined;
      if (!coordinate) return;
      const entityId = `END-${safeId(`${name}-${pointIndex + 1}`, `kml-point-${index + 1}`)}`;
      args.endpointInputs.push({
        sourceType: args.sourceType,
        sourceName: args.fileName,
        entityType: "ENDPOINT",
        entityId,
        rawReference: `kml:placemark:${index}:point:${pointIndex}`,
        normalizedPayload: { name, description },
        geometryReference: pointGeometry(coordinate[0], coordinate[1]),
      });
      createDiagnostic(args.diagnostics, {
        code: "TRANSLATE_ENDPOINT_EXTRACTED",
        severity: "INFO",
        message: "Endpoint extracted from KML Point.",
        sourceFile: args.fileName,
        sourceType: args.sourceType,
        entityId,
      });
    });

    lineStrings.forEach((lineString, lineIndex) => {
      const coordinateText = firstLocalText(lineString, "coordinates");
      const coordinates = coordinateText ? parseCoordinateText(coordinateText) : [];
      if (coordinates.length < 2) {
        createDiagnostic(args.diagnostics, {
          code: "TRANSLATE_WARNING",
          severity: "WARNING",
          message: "KML LineString has fewer than two valid coordinates.",
          sourceFile: args.fileName,
          sourceType: args.sourceType,
          details: { placemark: name, lineIndex },
        });
        return;
      }
      const entityId = `ROUTE-${safeId(`${name}-${lineIndex + 1}`, `kml-route-${index + 1}`)}`;
      args.routeInputs.push({
        sourceType: args.sourceType,
        sourceName: args.fileName,
        entityType: "ROUTE_CANDIDATE",
        entityId,
        rawReference: `kml:placemark:${index}:linestring:${lineIndex}`,
        normalizedPayload: {
          routeName: name,
          description,
          coordinateCount: coordinates.length,
          source: args.sourceType,
        },
        geometryReference: lineGeometry(coordinates),
      });
      createDiagnostic(args.diagnostics, {
        code: "TRANSLATE_ROUTE_EXTRACTED",
        severity: "INFO",
        message: "Route candidate evidence extracted from KML LineString.",
        sourceFile: args.fileName,
        sourceType: args.sourceType,
        entityId,
        details: { coordinateCount: coordinates.length },
      });
    });
  });
}

function parseKmlWithRegex(args: {
  text: string;
  fileName: string;
  sourceType: TranslateSourceType;
  endpointInputs: CorridorRawEvidenceInput[];
  routeInputs: CorridorRawEvidenceInput[];
  diagnostics: TranslateDiagnostic[];
}) {
  const placemarks = args.text.match(/<Placemark[\s\S]*?<\/Placemark>/gi) ?? [];
  createDiagnostic(args.diagnostics, {
    code: "TRANSLATE_FILE_PARSED",
    severity: "INFO",
    message: `KML parsed with regex fallback and ${placemarks.length} placemarks.`,
    sourceFile: args.fileName,
    sourceType: args.sourceType,
  });
  placemarks.forEach((placemark, index) => {
    const name = placemark.match(/<name[^>]*>([\s\S]*?)<\/name>/i)?.[1]?.trim() ?? `KML Placemark ${index + 1}`;
    const lineMatches = Array.from(placemark.matchAll(/<LineString[\s\S]*?<coordinates[^>]*>([\s\S]*?)<\/coordinates>[\s\S]*?<\/LineString>/gi));
    const pointMatches = Array.from(placemark.matchAll(/<Point[\s\S]*?<coordinates[^>]*>([\s\S]*?)<\/coordinates>[\s\S]*?<\/Point>/gi));
    pointMatches.forEach((match, pointIndex) => {
      const coordinate = parseCoordinateText(match[1] ?? "")[0];
      if (!coordinate) return;
      const entityId = `END-${safeId(`${name}-${pointIndex + 1}`, `kml-point-${index + 1}`)}`;
      args.endpointInputs.push({
        sourceType: args.sourceType,
        sourceName: args.fileName,
        entityType: "ENDPOINT",
        entityId,
        rawReference: `kml-regex:placemark:${index}:point:${pointIndex}`,
        normalizedPayload: { name },
        geometryReference: pointGeometry(coordinate[0], coordinate[1]),
      });
    });
    lineMatches.forEach((match, lineIndex) => {
      const coordinates = parseCoordinateText(match[1] ?? "");
      if (coordinates.length < 2) return;
      const entityId = `ROUTE-${safeId(`${name}-${lineIndex + 1}`, `kml-route-${index + 1}`)}`;
      args.routeInputs.push({
        sourceType: args.sourceType,
        sourceName: args.fileName,
        entityType: "ROUTE_CANDIDATE",
        entityId,
        rawReference: `kml-regex:placemark:${index}:linestring:${lineIndex}`,
        normalizedPayload: { routeName: name, coordinateCount: coordinates.length, source: args.sourceType },
        geometryReference: lineGeometry(coordinates),
      });
    });
  });
}

export async function translateKml(input: TranslateTextInput): Promise<TranslateResult> {
  const sourceType = input.sourceType === "KMZ" ? "KMZ" : "KML";
  const job = createJob(sourceType, input.fileName);
  const diagnostics: TranslateDiagnostic[] = [];
  const endpointInputs: CorridorRawEvidenceInput[] = [];
  const routeInputs: CorridorRawEvidenceInput[] = [];

  if (typeof DOMParser !== "undefined") {
    parseKmlWithDom({ text: input.text, fileName: input.fileName, sourceType, endpointInputs, routeInputs, diagnostics });
  } else {
    parseKmlWithRegex({ text: input.text, fileName: input.fileName, sourceType, endpointInputs, routeInputs, diagnostics });
  }

  return completeResult({
    job,
    sourceType,
    sourceFile: input.fileName,
    endpointInputs,
    routeInputs,
    diagnostics,
  });
}

export async function translateKmz(input: TranslateBinaryInput): Promise<TranslateResult> {
  const sourceType: TranslateSourceType = "KMZ";
  const job = createJob(sourceType, input.fileName);
  const diagnostics: TranslateDiagnostic[] = [];
  let kmlText = "";
  try {
    const zip = await JSZip.loadAsync(input.data);
    const kmlEntry = Object.values(zip.files).find((entry) => !entry.dir && entry.name.toLowerCase().endsWith(".kml"));
    if (!kmlEntry) {
      createDiagnostic(diagnostics, {
        code: "TRANSLATE_ERROR",
        severity: "ERROR",
        message: "KMZ archive did not contain a KML file.",
        sourceFile: input.fileName,
        sourceType,
      });
      return completeResult({ job, sourceType, sourceFile: input.fileName, endpointInputs: [], routeInputs: [], diagnostics });
    }
    kmlText = await kmlEntry.async("text");
    createDiagnostic(diagnostics, {
      code: "TRANSLATE_FILE_PARSED",
      severity: "INFO",
      message: `KMZ archive parsed and selected ${kmlEntry.name}.`,
      sourceFile: input.fileName,
      sourceType,
      details: { kmlEntry: kmlEntry.name },
    });
  } catch (error) {
    createDiagnostic(diagnostics, {
      code: "TRANSLATE_ERROR",
      severity: "ERROR",
      message: `KMZ parse failed: ${error instanceof Error ? error.message : String(error)}`,
      sourceFile: input.fileName,
      sourceType,
    });
    return completeResult({ job, sourceType, sourceFile: input.fileName, endpointInputs: [], routeInputs: [], diagnostics });
  }

  const nestedResult = await translateKml({
    sourceType,
    fileName: input.fileName,
    mimeType: input.mimeType,
    text: kmlText,
  });
  return {
    ...nestedResult,
    job: {
      ...nestedResult.job,
      diagnostics: [...job.diagnostics, ...diagnostics, ...nestedResult.job.diagnostics],
    },
    diagnostics: [...job.diagnostics, ...diagnostics, ...nestedResult.diagnostics],
  };
}

