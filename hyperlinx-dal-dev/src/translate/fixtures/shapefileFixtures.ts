import type { CorridorCoordinate } from "../../corridor/corridorTypes";
import type { ShapefilePackage } from "../ShapefileContract";
import { translateShapefilePackage } from "../ShapefileTranslationEngine";

type ShpRecord =
  | { shapeType: 1; point: CorridorCoordinate }
  | { shapeType: 3 | 5; parts: CorridorCoordinate[][] };

const WGS84_PRJ = `GEOGCS["WGS 84",DATUM["WGS_1984",SPHEROID["WGS 84",6378137,298.257223563]],PRIMEM["Greenwich",0],UNIT["degree",0.0174532925199433],AUTHORITY["EPSG","4326"]]`;

function bboxFor(records: ShpRecord[]): [number, number, number, number] {
  const coords = records.flatMap((record) => record.shapeType === 1 ? [record.point] : record.parts.flat());
  const lons = coords.map((coord) => coord[0]);
  const lats = coords.map((coord) => coord[1]);
  return [Math.min(...lons), Math.min(...lats), Math.max(...lons), Math.max(...lats)];
}

function recordContentLength(record: ShpRecord) {
  if (record.shapeType === 1) return 20;
  const pointCount = record.parts.reduce((sum, part) => sum + part.length, 0);
  return 4 + 32 + 4 + 4 + record.parts.length * 4 + pointCount * 16;
}

function writeBbox(view: DataView, offset: number, bbox: [number, number, number, number]) {
  view.setFloat64(offset, bbox[0], true);
  view.setFloat64(offset + 8, bbox[1], true);
  view.setFloat64(offset + 16, bbox[2], true);
  view.setFloat64(offset + 24, bbox[3], true);
}

function createShp(shapeType: 1 | 3 | 5, records: ShpRecord[]) {
  const recordBytes = records.reduce((sum, record) => sum + 8 + recordContentLength(record), 0);
  const buffer = new ArrayBuffer(100 + recordBytes);
  const view = new DataView(buffer);
  const bbox = bboxFor(records);
  view.setInt32(0, 9994, false);
  view.setInt32(24, buffer.byteLength / 2, false);
  view.setInt32(28, 1000, true);
  view.setInt32(32, shapeType, true);
  writeBbox(view, 36, bbox);

  let offset = 100;
  records.forEach((record, index) => {
    const contentLength = recordContentLength(record);
    view.setInt32(offset, index + 1, false);
    view.setInt32(offset + 4, contentLength / 2, false);
    const contentOffset = offset + 8;
    view.setInt32(contentOffset, record.shapeType, true);
    if (record.shapeType === 1) {
      view.setFloat64(contentOffset + 4, record.point[0], true);
      view.setFloat64(contentOffset + 12, record.point[1], true);
    } else {
      const partBbox = bboxFor([record]);
      const pointCount = record.parts.reduce((sum, part) => sum + part.length, 0);
      writeBbox(view, contentOffset + 4, partBbox);
      view.setInt32(contentOffset + 36, record.parts.length, true);
      view.setInt32(contentOffset + 40, pointCount, true);
      let cursor = contentOffset + 44;
      let pointOffset = 0;
      for (const part of record.parts) {
        view.setInt32(cursor, pointOffset, true);
        cursor += 4;
        pointOffset += part.length;
      }
      for (const coord of record.parts.flat()) {
        view.setFloat64(cursor, coord[0], true);
        view.setFloat64(cursor + 8, coord[1], true);
        cursor += 16;
      }
    }
    offset += 8 + contentLength;
  });

  return buffer;
}

function asciiBytes(text: string, length: number) {
  const bytes = new Uint8Array(length);
  const encoded = new TextEncoder().encode(text.slice(0, length));
  bytes.set(encoded);
  return bytes;
}

function createDbf(records: Record<string, string | number | boolean | null>[]) {
  const fieldNames = Array.from(new Set(records.flatMap((record) => Object.keys(record)))).slice(0, 12);
  const fieldLength = 40;
  const headerLength = 32 + fieldNames.length * 32 + 1;
  const recordLength = 1 + fieldNames.length * fieldLength;
  const buffer = new ArrayBuffer(headerLength + records.length * recordLength + 1);
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);
  view.setUint8(0, 0x03);
  view.setUint8(1, 126);
  view.setUint8(2, 6);
  view.setUint8(3, 23);
  view.setUint32(4, records.length, true);
  view.setUint16(8, headerLength, true);
  view.setUint16(10, recordLength, true);
  fieldNames.forEach((name, index) => {
    const offset = 32 + index * 32;
    bytes.set(asciiBytes(name, 11), offset);
    view.setUint8(offset + 11, "C".charCodeAt(0));
    view.setUint8(offset + 16, fieldLength);
  });
  bytes[32 + fieldNames.length * 32] = 0x0d;
  records.forEach((record, rowIndex) => {
    const rowOffset = headerLength + rowIndex * recordLength;
    bytes[rowOffset] = 0x20;
    fieldNames.forEach((fieldName, fieldIndex) => {
      const value = String(record[fieldName] ?? "").slice(0, fieldLength).padEnd(fieldLength, " ");
      bytes.set(asciiBytes(value, fieldLength), rowOffset + 1 + fieldIndex * fieldLength);
    });
  });
  bytes[buffer.byteLength - 1] = 0x1a;
  return buffer;
}

function packageFor(args: {
  packageId: string;
  packageName: string;
  shapeType: 1 | 3 | 5;
  records: ShpRecord[];
  attributes: Record<string, string | number | boolean | null>[];
  prj?: string;
  cpg?: string;
}): ShapefilePackage {
  return {
    packageId: args.packageId,
    packageName: args.packageName,
    shp: createShp(args.shapeType, args.records),
    shx: new ArrayBuffer(100),
    dbf: createDbf(args.attributes),
    prj: args.prj ?? WGS84_PRJ,
    cpg: args.cpg ?? "UTF-8",
    components: {
      shp: true,
      shx: true,
      dbf: true,
      prj: Boolean(args.prj ?? WGS84_PRJ),
      cpg: Boolean(args.cpg ?? "UTF-8"),
    },
  };
}

export const fiberRouteShapefileFixture = packageFor({
  packageId: "SHP-FIBER-ROUTE",
  packageName: "fiber-route",
  shapeType: 3,
  records: [{ shapeType: 3, parts: [[[-96.797, 32.7767], [-96.783, 32.786], [-96.754, 32.812]]] }],
  attributes: [{ NAME: "Fiber Route A", TYPE: "fiber route", OWNER: "Teralinx" }],
});

export const conduitRouteShapefileFixture = packageFor({
  packageId: "SHP-CONDUIT-ROUTE",
  packageName: "conduit-route",
  shapeType: 3,
  records: [{ shapeType: 3, parts: [[[-97.1, 32.6], [-97.0, 32.7], [-96.9, 32.82]]] }],
  attributes: [{ NAME: "Conduit Route A", TYPE: "conduit route", DUCTS: "4" }],
});

export const utilityTerritoryShapefileFixture = packageFor({
  packageId: "SHP-UTILITY-TERRITORY",
  packageName: "utility-territory",
  shapeType: 5,
  records: [{ shapeType: 5, parts: [[[-96.9, 32.7], [-96.7, 32.7], [-96.7, 32.9], [-96.9, 32.9], [-96.9, 32.7]]] }],
  attributes: [{ NAME: "Utility Territory", TYPE: "utility territory", OWNER: "Utility Co" }],
});

export const dataCenterCampusPolygonFixture = packageFor({
  packageId: "SHP-DATA-CENTER-CAMPUS",
  packageName: "data-center-campus",
  shapeType: 5,
  records: [{ shapeType: 5, parts: [[[-96.8, 32.77], [-96.79, 32.77], [-96.79, 32.78], [-96.8, 32.78], [-96.8, 32.77]]] }],
  attributes: [{ NAME: "AI Campus", TYPE: "data center campus", OWNER: "Hyperscaler" }],
});

export const transmissionLineRouteFixture = packageFor({
  packageId: "SHP-TRANSMISSION-LINE",
  packageName: "transmission-line",
  shapeType: 3,
  records: [{ shapeType: 3, parts: [[[-96.84, 32.75], [-96.8, 32.8], [-96.76, 32.84]]] }],
  attributes: [{ NAME: "Transmission Line", TYPE: "transmission route", OWNER: "Utility Co" }],
});

export const mixedEngineeringPackageFixture = packageFor({
  packageId: "SHP-MIXED-ENGINEERING",
  packageName: "mixed-engineering-package",
  shapeType: 1,
  records: [
    { shapeType: 1, point: [-96.797, 32.7767] },
    { shapeType: 1, point: [-96.754, 32.812] },
  ],
  attributes: [
    { NAME: "AI Campus A", TYPE: "endpoint", ROLE: "A_END" },
    { NAME: "Cloud Onramp Z", TYPE: "interconnection node", ROLE: "Z_END" },
  ],
});

export function evaluateShapefileFixtures() {
  return {
    fiberRoute: translateShapefilePackage(fiberRouteShapefileFixture),
    conduitRoute: translateShapefilePackage(conduitRouteShapefileFixture),
    utilityTerritory: translateShapefilePackage(utilityTerritoryShapefileFixture),
    dataCenterCampus: translateShapefilePackage(dataCenterCampusPolygonFixture),
    transmissionLine: translateShapefilePackage(transmissionLineRouteFixture),
    mixedEngineeringPackage: translateShapefilePackage(mixedEngineeringPackageFixture),
  };
}

