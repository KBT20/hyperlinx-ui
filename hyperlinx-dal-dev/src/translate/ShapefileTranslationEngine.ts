import {
  createCorridorEvidenceBundle,
  lineGeometry,
  normalizeConstraintEvidence,
  normalizeCrossingEvidence,
  normalizeEndpointEvidence,
  normalizeInterconnectionEvidence,
  normalizeJurisdictionEvidence,
  normalizeMonetizationEvidence,
  normalizePowerEvidence,
  normalizeRegenEvidence,
  normalizeRouteEvidence,
  pointGeometry,
} from "../corridor/CorridorNormalizationEngine";
import type {
  CorridorGeometryReference,
  CorridorRawEvidenceInput,
} from "../corridor/CorridorNormalizedEvidence";
import type { CorridorCoordinate } from "../corridor/corridorTypes";
import { detectCoordinateSystem } from "./CoordinateNormalization";
import type {
  NormalizedAttributeSet,
  ShapefileAttribute,
  ShapefileDiagnostic,
  ShapefileFeature,
  ShapefileGeometry,
  ShapefileGeometryType,
  ShapefileLayer,
  ShapefilePackage,
  ShapefileTranslationResult,
} from "./ShapefileContract";

type DbfField = {
  name: string;
  normalizedName: string;
  type: string;
  length: number;
  decimals: number;
  offset: number;
};

type FeatureClassification =
  | "ENDPOINT"
  | "ROUTE_CANDIDATE"
  | "CONSTRAINT"
  | "CROSSING"
  | "JURISDICTION"
  | "POWER_ASSET"
  | "INTERCONNECTION_NODE"
  | "REGEN_SITE"
  | "MONETIZATION_OPPORTUNITY";

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

function createShapefileDiagnostic(
  diagnostics: ShapefileDiagnostic[],
  args: Omit<ShapefileDiagnostic, "diagnosticId">
) {
  const diagnostic = {
    diagnosticId: `shapefile-${args.code.toLowerCase()}-${args.featureId ?? args.layerName ?? Date.now()}`,
    ...args,
  };
  if (args.severity === "ERROR") {
    console.error(`[${args.code}]`, diagnostic);
  } else if (args.severity === "WARNING") {
    console.warn(`[${args.code}]`, diagnostic);
  } else {
    console.log(`[${args.code}]`, diagnostic);
  }
  diagnostics.push(diagnostic);
  return diagnostic;
}

function shapeTypeToGeometryType(shapeType: number): ShapefileGeometryType {
  if ([1, 11, 21].includes(shapeType)) return "POINT";
  if ([8, 18, 28].includes(shapeType)) return "MULTIPOINT";
  if ([3, 13, 23].includes(shapeType)) return "MULTILINESTRING";
  if ([5, 15, 25].includes(shapeType)) return "POLYGON";
  return "UNKNOWN";
}

function readPoint(view: DataView, offset: number): CorridorCoordinate {
  return [view.getFloat64(offset, true), view.getFloat64(offset + 8, true)];
}

function readBbox(view: DataView, offset: number): [number, number, number, number] {
  return [
    view.getFloat64(offset, true),
    view.getFloat64(offset + 8, true),
    view.getFloat64(offset + 16, true),
    view.getFloat64(offset + 24, true),
  ];
}

function parseParts(view: DataView, offset: number) {
  const bbox = readBbox(view, offset + 4);
  const numParts = view.getInt32(offset + 36, true);
  const numPoints = view.getInt32(offset + 40, true);
  const partOffsets: number[] = [];
  let cursor = offset + 44;
  for (let index = 0; index < numParts; index += 1) {
    partOffsets.push(view.getInt32(cursor, true));
    cursor += 4;
  }
  const points: CorridorCoordinate[] = [];
  for (let index = 0; index < numPoints; index += 1) {
    points.push(readPoint(view, cursor));
    cursor += 16;
  }
  const parts: CorridorCoordinate[][] = [];
  for (let index = 0; index < partOffsets.length; index += 1) {
    const start = partOffsets[index] ?? 0;
    const end = partOffsets[index + 1] ?? points.length;
    parts.push(points.slice(start, end));
  }
  return { bbox, parts };
}

function parseShpFeatures(packageName: string, shp: ArrayBuffer, diagnostics: ShapefileDiagnostic[]): {
  shapeType?: number;
  features: Array<Omit<ShapefileFeature, "attributes">>;
} {
  const view = new DataView(shp);
  if (view.byteLength < 100) {
    createShapefileDiagnostic(diagnostics, {
      code: "SHAPEFILE_ERROR",
      severity: "ERROR",
      message: "SHP file is shorter than the required 100-byte header.",
      layerName: packageName,
    });
    return { features: [] };
  }

  const fileCode = view.getInt32(0, false);
  const shapeType = view.getInt32(32, true);
  if (fileCode !== 9994) {
    createShapefileDiagnostic(diagnostics, {
      code: "SHAPEFILE_WARNING",
      severity: "WARNING",
      message: "SHP header does not contain the expected file code 9994.",
      layerName: packageName,
      details: { fileCode },
    });
  }

  const features: Array<Omit<ShapefileFeature, "attributes">> = [];
  let cursor = 100;
  while (cursor + 8 <= view.byteLength) {
    const recordNumber = view.getInt32(cursor, false);
    const contentLengthBytes = view.getInt32(cursor + 4, false) * 2;
    const contentOffset = cursor + 8;
    if (contentOffset + contentLengthBytes > view.byteLength || contentLengthBytes < 4) {
      createShapefileDiagnostic(diagnostics, {
        code: "SHAPEFILE_WARNING",
        severity: "WARNING",
        message: "SHP record length is invalid; stopping parse at last valid record.",
        layerName: packageName,
        details: { recordNumber, contentLengthBytes },
      });
      break;
    }

    const recordShapeType = view.getInt32(contentOffset, true);
    let geometry: ShapefileGeometry | undefined;
    try {
      if ([1, 11, 21].includes(recordShapeType)) {
        geometry = {
          geometryType: "POINT",
          coordinates: readPoint(view, contentOffset + 4),
          sourceShapeType: recordShapeType,
        };
      } else if ([8, 18, 28].includes(recordShapeType)) {
        const bbox = readBbox(view, contentOffset + 4);
        const numPoints = view.getInt32(contentOffset + 36, true);
        const points: CorridorCoordinate[] = [];
        let pointCursor = contentOffset + 40;
        for (let index = 0; index < numPoints; index += 1) {
          points.push(readPoint(view, pointCursor));
          pointCursor += 16;
        }
        geometry = {
          geometryType: "MULTIPOINT",
          coordinates: points,
          bbox,
          sourceShapeType: recordShapeType,
        };
      } else if ([3, 13, 23].includes(recordShapeType)) {
        const parsed = parseParts(view, contentOffset);
        geometry = {
          geometryType: parsed.parts.length > 1 ? "MULTILINESTRING" : "LINESTRING",
          coordinates: parsed.parts.length > 1 ? parsed.parts : (parsed.parts[0] ?? []),
          bbox: parsed.bbox,
          sourceShapeType: recordShapeType,
        };
      } else if ([5, 15, 25].includes(recordShapeType)) {
        const parsed = parseParts(view, contentOffset);
        geometry = {
          geometryType: parsed.parts.length > 1 ? "MULTIPOLYGON" : "POLYGON",
          coordinates: parsed.parts.length > 1 ? parsed.parts.map((ring) => [ring]) : [parsed.parts[0] ?? []],
          bbox: parsed.bbox,
          sourceShapeType: recordShapeType,
        };
      } else {
        geometry = {
          geometryType: "UNKNOWN",
          coordinates: [],
          sourceShapeType: recordShapeType,
        };
      }
    } catch (error) {
      createShapefileDiagnostic(diagnostics, {
        code: "SHAPEFILE_WARNING",
        severity: "WARNING",
        message: `Failed to parse SHP record ${recordNumber}: ${error instanceof Error ? error.message : String(error)}`,
        layerName: packageName,
        details: { recordNumber },
      });
    }

    if (geometry) {
      const featureId = `shp-feature-${recordNumber}`;
      features.push({
        featureId,
        recordNumber,
        geometry,
      });
      createShapefileDiagnostic(diagnostics, {
        code: "SHAPEFILE_FEATURE_EXTRACTED",
        severity: "INFO",
        message: `Extracted shapefile feature ${recordNumber}.`,
        layerName: packageName,
        featureId,
        details: { geometryType: geometry.geometryType },
      });
    }

    cursor = contentOffset + contentLengthBytes;
  }

  return { shapeType, features };
}

function decodeBytes(bytes: Uint8Array, encoding: string) {
  try {
    return new TextDecoder(encoding).decode(bytes).replace(/\0/g, "").trim();
  } catch {
    return new TextDecoder("utf-8").decode(bytes).replace(/\0/g, "").trim();
  }
}

function normalizeFieldName(name: string) {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function parseDbf(dbf: ArrayBuffer, cpg: string | undefined, diagnostics: ShapefileDiagnostic[], layerName: string): NormalizedAttributeSet[] {
  const view = new DataView(dbf);
  if (view.byteLength < 33) {
    createShapefileDiagnostic(diagnostics, {
      code: "SHAPEFILE_WARNING",
      severity: "WARNING",
      message: "DBF file is too short to parse attributes.",
      layerName,
    });
    return [];
  }

  const encoding = cpg?.trim() || "utf-8";
  const recordCount = view.getUint32(4, true);
  const headerLength = view.getUint16(8, true);
  const recordLength = view.getUint16(10, true);
  const fields: DbfField[] = [];
  const fieldNames = new Set<string>();
  const duplicateFieldNames: string[] = [];
  let cursor = 32;
  let fieldOffset = 1;
  while (cursor + 32 <= headerLength && view.getUint8(cursor) !== 0x0d) {
    const nameBytes = new Uint8Array(dbf, cursor, 11);
    const name = decodeBytes(nameBytes, encoding);
    const normalizedName = normalizeFieldName(name);
    const type = String.fromCharCode(view.getUint8(cursor + 11));
    const length = view.getUint8(cursor + 16);
    const decimals = view.getUint8(cursor + 17);
    if (fieldNames.has(normalizedName)) duplicateFieldNames.push(name);
    fieldNames.add(normalizedName);
    fields.push({ name, normalizedName, type, length, decimals, offset: fieldOffset });
    fieldOffset += length;
    cursor += 32;
  }

  const attributeSets: NormalizedAttributeSet[] = [];
  for (let recordIndex = 0; recordIndex < recordCount; recordIndex += 1) {
    const recordOffset = headerLength + recordIndex * recordLength;
    if (recordOffset + recordLength > view.byteLength) break;
    const deleted = String.fromCharCode(view.getUint8(recordOffset)) === "*";
    if (deleted) continue;
    const attributes: ShapefileAttribute[] = [];
    const rawProperties: Record<string, string | number | boolean | null> = {};
    for (const field of fields) {
      const raw = decodeBytes(new Uint8Array(dbf, recordOffset + field.offset, field.length), encoding);
      let value: string | number | boolean | null = raw || null;
      if (raw && ["N", "F", "B", "O"].includes(field.type)) {
        const numeric = Number(raw);
        value = Number.isFinite(numeric) ? numeric : raw;
      } else if (raw && field.type === "L") {
        value = ["Y", "T", "1"].includes(raw.toUpperCase());
      }
      rawProperties[field.name] = value;
      attributes.push({
        sourceFieldName: field.name,
        normalizedFieldName: field.normalizedName,
        value,
        fieldType: field.type,
      });
    }
    attributeSets.push({
      attributes,
      originalFieldNames: fields.map((field) => field.name),
      unknownFieldNames: fields.map((field) => field.name),
      duplicateFieldNames,
      missingFieldNames: [],
      rawProperties,
    });
  }

  if (duplicateFieldNames.length > 0) {
    createShapefileDiagnostic(diagnostics, {
      code: "SHAPEFILE_WARNING",
      severity: "WARNING",
      message: "DBF contains duplicate normalized field names.",
      layerName,
      details: { duplicateFieldNames },
    });
  }
  if (fields.length > 0) {
    createShapefileDiagnostic(diagnostics, {
      code: "SHAPEFILE_WARNING",
      severity: "INFO",
      message: "DBF source attributes are preserved as unknown source fields until source-specific mapper rules exist.",
      layerName,
      details: { unknownFieldNames: fields.map((field) => field.name) },
    });
  } else {
    createShapefileDiagnostic(diagnostics, {
      code: "SHAPEFILE_WARNING",
      severity: "WARNING",
      message: "DBF contains no attribute fields.",
      layerName,
    });
  }

  return attributeSets;
}

function emptyAttributes(): NormalizedAttributeSet {
  return {
    attributes: [],
    originalFieldNames: [],
    unknownFieldNames: [],
    duplicateFieldNames: [],
    missingFieldNames: ["DBF"],
    rawProperties: {},
  };
}

function textForClassification(layerName: string, attributes: NormalizedAttributeSet) {
  return `${layerName} ${Object.values(attributes.rawProperties).join(" ")}`.toLowerCase();
}

function classifyFeature(layerName: string, feature: ShapefileFeature): FeatureClassification {
  const text = textForClassification(layerName, feature.attributes);
  const geometryType = feature.geometry.geometryType;
  if (/(substation|transmission|power|electric|utility)/.test(text)) return "POWER_ASSET";
  if (/(carrier hotel|cloud|onramp|ix|internet exchange|meet.?me|interconnect)/.test(text)) return "INTERCONNECTION_NODE";
  if (/(regen|regeneration|amplifier|hut)/.test(text)) return "REGEN_SITE";
  if (/(municipal|municipality|county|city|jurisdiction|boundary|territory)/.test(text)) return "JURISDICTION";
  if (/(crossing|bridge|rail|river|canal|highway|road crossing|pipeline)/.test(text)) return "CROSSING";
  if (/(constraint|environment|wetland|parcel|row|right.?of.?way|easement)/.test(text)) return "CONSTRAINT";
  if (/(tower|enterprise|school|government|opportunity|monetization)/.test(text)) return "MONETIZATION_OPPORTUNITY";

  if (["POINT", "MULTIPOINT"].includes(geometryType)) {
    if (/(data center|campus|site|facility|endpoint|customer)/.test(text)) return "ENDPOINT";
    return "ENDPOINT";
  }
  if (["LINESTRING", "MULTILINESTRING"].includes(geometryType)) {
    if (/(fiber|conduit|route|corridor|backbone|transport)/.test(text)) return "ROUTE_CANDIDATE";
    return "ROUTE_CANDIDATE";
  }
  if (["POLYGON", "MULTIPOLYGON"].includes(geometryType)) {
    if (/(data center|campus|development|site)/.test(text)) return "ENDPOINT";
    return "CONSTRAINT";
  }
  return "CONSTRAINT";
}

function flattenLineCoordinates(geometry: ShapefileGeometry): CorridorCoordinate[] {
  if (geometry.geometryType === "LINESTRING") return geometry.coordinates as CorridorCoordinate[];
  if (geometry.geometryType === "MULTILINESTRING") return (geometry.coordinates as CorridorCoordinate[][]).flat();
  return [];
}

function polygonRings(geometry: ShapefileGeometry): CorridorCoordinate[][] {
  if (geometry.geometryType === "POLYGON") return geometry.coordinates as CorridorCoordinate[][];
  if (geometry.geometryType === "MULTIPOLYGON") return (geometry.coordinates as CorridorCoordinate[][][]).flat();
  return [];
}

function geometryReferenceFor(feature: ShapefileFeature): CorridorGeometryReference | undefined {
  const geometry = feature.geometry;
  if (geometry.geometryType === "POINT") {
    const coordinate = geometry.coordinates as CorridorCoordinate;
    return pointGeometry(coordinate[0], coordinate[1]);
  }
  if (geometry.geometryType === "LINESTRING" || geometry.geometryType === "MULTILINESTRING") {
    const coordinates = flattenLineCoordinates(geometry);
    return coordinates.length >= 2 ? lineGeometry(coordinates) : undefined;
  }
  if (geometry.geometryType === "POLYGON" || geometry.geometryType === "MULTIPOLYGON") {
    const rings = polygonRings(geometry).filter((ring) => ring.length >= 3);
    return rings.length
      ? {
          geometryType: "POLYGON",
          rings,
          geometryHash: stableHash(rings),
        }
      : undefined;
  }
  return undefined;
}

function featureName(feature: ShapefileFeature, fallback: string) {
  const raw = feature.attributes.rawProperties;
  return String(raw.NAME ?? raw.Name ?? raw.name ?? raw.LABEL ?? raw.Label ?? raw.id ?? raw.ID ?? fallback);
}

export function translateShapefileFeature(args: {
  layerName: string;
  feature: ShapefileFeature;
  coordinateSystem: ShapefileLayer["coordinateSystem"];
  projection?: string;
  confidenceAdjustment: number;
}): CorridorRawEvidenceInput {
  const classification = classifyFeature(args.layerName, args.feature);
  const name = featureName(args.feature, `${args.layerName} feature ${args.feature.recordNumber}`);
  const entityPrefix = classification === "ROUTE_CANDIDATE" ? "ROUTE" : classification;
  const entityId = `${entityPrefix}-${safeId(name, args.feature.featureId)}`;
  const geometryReference = geometryReferenceFor(args.feature);
  return {
    sourceType: "SHAPEFILE",
    sourceName: args.layerName,
    entityType: classification,
    entityId,
    rawReference: `shapefile:${args.layerName}:record:${args.feature.recordNumber}`,
    rawPayload: args.feature.attributes.rawProperties,
    normalizedPayload: {
      name,
      shapefileClassification: classification,
      shapefileGeometryType: args.feature.geometry.geometryType,
      shapefileGeometry: args.feature.geometry,
      attributes: args.feature.attributes,
      coordinateSystem: args.coordinateSystem,
      projection: args.projection,
    },
    geometryReference,
    confidence: Math.max(0, Math.min(100, 80 + args.confidenceAdjustment)),
    notes: geometryReference ? undefined : "Geometry preserved in normalizedPayload because the current evidence model has no direct geometryReference for this shapefile geometry.",
  };
}

export function translateShapefileLayer(layer: ShapefileLayer): CorridorRawEvidenceInput[] {
  const projectionConfidenceAdjustment = layer.coordinateSystem === "UNKNOWN" ? -18 : layer.coordinateSystem === "NAD83" ? -4 : 0;
  return layer.features.map((feature) =>
    translateShapefileFeature({
      layerName: layer.layerName,
      feature,
      coordinateSystem: layer.coordinateSystem,
      projection: layer.projection,
      confidenceAdjustment: projectionConfidenceAdjustment,
    })
  );
}

function normalizeInputs(inputs: CorridorRawEvidenceInput[]) {
  return [
    ...normalizeEndpointEvidence(inputs.filter((input) => input.entityType === "ENDPOINT")),
    ...normalizeRouteEvidence(inputs.filter((input) => input.entityType === "ROUTE_CANDIDATE")),
    ...normalizeConstraintEvidence(inputs.filter((input) => input.entityType === "CONSTRAINT")),
    ...normalizeCrossingEvidence(inputs.filter((input) => input.entityType === "CROSSING")),
    ...normalizeJurisdictionEvidence(inputs.filter((input) => input.entityType === "JURISDICTION")),
    ...normalizePowerEvidence(inputs.filter((input) => input.entityType === "POWER_ASSET")),
    ...normalizeInterconnectionEvidence(inputs.filter((input) => input.entityType === "INTERCONNECTION_NODE")),
    ...normalizeRegenEvidence(inputs.filter((input) => input.entityType === "REGEN_SITE")),
    ...normalizeMonetizationEvidence(inputs.filter((input) => input.entityType === "MONETIZATION_OPPORTUNITY")),
  ];
}

export function translateShapefilePackage(shapefilePackage: ShapefilePackage): ShapefileTranslationResult {
  const diagnostics: ShapefileDiagnostic[] = [];
  createShapefileDiagnostic(diagnostics, {
    code: "SHAPEFILE_PACKAGE_LOADED",
    severity: "INFO",
    message: `Shapefile package loaded: ${shapefilePackage.packageName}.`,
    details: { components: shapefilePackage.components },
  });

  for (const component of ["shx", "dbf", "prj", "cpg"] as const) {
    if (!shapefilePackage.components[component]) {
      createShapefileDiagnostic(diagnostics, {
        code: "SHAPEFILE_MISSING_COMPONENT",
        severity: "WARNING",
        message: `Shapefile package is missing optional .${component} component.`,
        details: { component },
      });
    }
  }

  if (!shapefilePackage.shp) {
    createShapefileDiagnostic(diagnostics, {
      code: "SHAPEFILE_ERROR",
      severity: "ERROR",
      message: "Shapefile package is missing required .shp component.",
    });
    return {
      packageId: shapefilePackage.packageId,
      packageName: shapefilePackage.packageName,
      layers: [],
      evidenceBundle: createCorridorEvidenceBundle({
        bundleId: `shapefile-bundle-${shapefilePackage.packageId}`,
        evidence: [],
      }),
      diagnostics,
    };
  }

  const coordinateResult = detectCoordinateSystem(shapefilePackage.prj);
  diagnostics.push(...coordinateResult.diagnostics);
  const layerDiagnostics: ShapefileDiagnostic[] = [];
  const parsed = parseShpFeatures(shapefilePackage.packageName, shapefilePackage.shp, layerDiagnostics);
  const dbfAttributes = shapefilePackage.dbf
    ? parseDbf(shapefilePackage.dbf, shapefilePackage.cpg, layerDiagnostics, shapefilePackage.packageName)
    : [];

  if (!shapefilePackage.dbf) {
    createShapefileDiagnostic(layerDiagnostics, {
      code: "SHAPEFILE_MISSING_COMPONENT",
      severity: "WARNING",
      message: "DBF attributes are missing. Features will retain geometry only.",
      layerName: shapefilePackage.packageName,
    });
  }

  const features: ShapefileFeature[] = parsed.features.map((feature, index) => ({
    ...feature,
    attributes: dbfAttributes[index] ?? emptyAttributes(),
  }));
  const layer: ShapefileLayer = {
    layerId: `layer-${safeId(shapefilePackage.packageName, shapefilePackage.packageId)}`,
    layerName: shapefilePackage.packageName,
    shapeType: parsed.shapeType,
    projection: shapefilePackage.prj,
    coordinateSystem: coordinateResult.coordinateSystem,
    features,
    diagnostics: layerDiagnostics,
  };
  createShapefileDiagnostic(diagnostics, {
    code: "SHAPEFILE_LAYER_DISCOVERED",
    severity: "INFO",
    message: `Discovered shapefile layer ${layer.layerName}.`,
    layerName: layer.layerName,
    details: {
      shapeType: layer.shapeType,
      geometryType: shapeTypeToGeometryType(layer.shapeType ?? 0),
      featureCount: layer.features.length,
      coordinateSystem: layer.coordinateSystem,
    },
  });

  diagnostics.push(...layerDiagnostics);
  const rawInputs = translateShapefileLayer(layer);
  const evidence = normalizeInputs(rawInputs);
  const evidenceBundle = createCorridorEvidenceBundle({
    bundleId: `shapefile-bundle-${shapefilePackage.packageId}-${stableHash(evidence.map((item) => item.evidenceId))}`,
    evidence,
  });

  return {
    packageId: shapefilePackage.packageId,
    packageName: shapefilePackage.packageName,
    layers: [layer],
    evidenceBundle,
    diagnostics,
  };
}
