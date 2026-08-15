import JSZip from "jszip";
import type { TenantArtifactScope } from "./CommercialWorkbookEvidenceAdapter";
import type { DALCoordinate } from "../types/dal";

export interface CommercialRouteGeometryEvidence extends TenantArtifactScope {
  routeEvidenceId: string;
  sourceFile: string;
  sourceHash: string;
  sourceAuthority: "CUSTOMER_PROVIDED_GEOMETRY_EVIDENCE";
  authorityMode: "MEASURED";
  geometryType: "LINESTRING";
  geometry: DALCoordinate[];
  pointCount: number;
  routeMeters: number;
  routeFeet: number;
  routeMiles: number;
  aCoordinate: DALCoordinate;
  zCoordinate: DALCoordinate;
  measuredCenterlineId: string;
  extractedAt: string;
  noScopeVersionCreation: true;
}

async function sha256(bytes: Uint8Array) {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const digest = await crypto.subtle.digest("SHA-256", copy.buffer);
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join("");
}

function parseCoordinateBlock(block: string): DALCoordinate[] {
  return block.trim().split(/\s+/).flatMap((token) => {
    const [longitude, latitude] = token.split(",").map(Number);
    return Number.isFinite(longitude) && Number.isFinite(latitude) ? [[longitude, latitude] as DALCoordinate] : [];
  });
}

function geodesicMeters(geometry: DALCoordinate[]) {
  const earthRadiusMeters = 6_371_008.8;
  let distance = 0;
  for (let index = 1; index < geometry.length; index += 1) {
    const [longitudeA, latitudeA] = geometry[index - 1];
    const [longitudeB, latitudeB] = geometry[index];
    const latitudeARadians = latitudeA * Math.PI / 180;
    const latitudeBRadians = latitudeB * Math.PI / 180;
    const latitudeDelta = (latitudeB - latitudeA) * Math.PI / 180;
    const longitudeDelta = (longitudeB - longitudeA) * Math.PI / 180;
    const haversine = Math.sin(latitudeDelta / 2) ** 2
      + Math.cos(latitudeARadians) * Math.cos(latitudeBRadians) * Math.sin(longitudeDelta / 2) ** 2;
    distance += 2 * earthRadiusMeters * Math.asin(Math.sqrt(haversine));
  }
  return distance;
}

export class CommercialKmzRouteEvidenceAdapter {
  async normalize(args: {
    kmz: ArrayBuffer | Uint8Array;
    sourceFile: string;
    scope: TenantArtifactScope;
    extractedAt?: string;
  }): Promise<CommercialRouteGeometryEvidence> {
    const bytes = args.kmz instanceof Uint8Array ? args.kmz : new Uint8Array(args.kmz);
    const [sourceHash, zip] = await Promise.all([sha256(bytes), JSZip.loadAsync(bytes)]);
    const kmlFiles = Object.values(zip.files).filter((entry) => !entry.dir && entry.name.toLowerCase().endsWith(".kml"));
    if (!kmlFiles.length) throw new Error("KMZ route evidence does not contain KML.");
    const geometryCandidates: DALCoordinate[][] = [];
    for (const file of kmlFiles) {
      const kml = await file.async("string");
      for (const match of kml.matchAll(/<LineString[\s\S]*?<coordinates>([\s\S]*?)<\/coordinates>[\s\S]*?<\/LineString>/gi)) {
        const geometry = parseCoordinateBlock(match[1]);
        if (geometry.length > 1) geometryCandidates.push(geometry);
      }
    }
    const geometry = geometryCandidates.sort((a, b) => geodesicMeters(b) - geodesicMeters(a))[0];
    if (!geometry) throw new Error("KMZ route evidence does not contain a measurable LineString.");
    const routeMeters = geodesicMeters(geometry);
    const routeFeet = routeMeters * 3.280839895013123;
    const routeMiles = routeMeters / 1609.344;
    const extractedAt = args.extractedAt ?? new Date().toISOString();
    return {
      ...args.scope,
      routeEvidenceId: `${args.scope.opportunityId}:ROUTE:${sourceHash.slice(0, 12)}`,
      sourceFile: args.sourceFile,
      sourceHash,
      sourceAuthority: "CUSTOMER_PROVIDED_GEOMETRY_EVIDENCE",
      authorityMode: "MEASURED",
      geometryType: "LINESTRING",
      geometry,
      pointCount: geometry.length,
      routeMeters,
      routeFeet,
      routeMiles,
      aCoordinate: geometry[0],
      zCoordinate: geometry[geometry.length - 1],
      measuredCenterlineId: `${args.scope.opportunityId}:MEASURED-CENTERLINE:${sourceHash.slice(0, 12)}`,
      extractedAt,
      noScopeVersionCreation: true,
    };
  }
}

export const commercialKmzRouteEvidenceAdapter = new CommercialKmzRouteEvidenceAdapter();
