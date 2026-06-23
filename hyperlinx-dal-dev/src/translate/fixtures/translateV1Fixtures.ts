import JSZip from "jszip";
import type { TranslateBinaryInput, TranslateTextInput } from "../TranslateContract";
import {
  translateCsv,
  translateGeoJson,
  translateKml,
  translateKmz,
} from "../TranslateNormalizationEngine";

export const csvEndpointPairFixture = `id,name,role,latitude,longitude,address,city,state
END-A,AI Campus A,A_END,32.7767,-96.7970,100 Compute Dr,Dallas,TX
END-Z,Cloud Onramp Z,Z_END,32.8120,-96.7540,200 Onramp Ave,Dallas,TX`;

export const geoJsonRouteFixture = JSON.stringify({
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: {
        id: "route-geojson-001",
        name: "Dallas AI Corridor Primary",
        routeClass: "PRIMARY",
      },
      geometry: {
        type: "LineString",
        coordinates: [
          [-96.797, 32.7767],
          [-96.783, 32.786],
          [-96.767, 32.798],
          [-96.754, 32.812],
        ],
      },
    },
  ],
});

export const kmlRouteFixture = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <Placemark>
      <name>Dallas AI Corridor KML</name>
      <LineString>
        <coordinates>
          -96.797,32.7767,0 -96.783,32.786,0 -96.767,32.798,0 -96.754,32.812,0
        </coordinates>
      </LineString>
    </Placemark>
  </Document>
</kml>`;

export const mixedEndpointRouteGeoJsonFixture = JSON.stringify({
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: { id: "END-A", name: "AI Campus A", role: "A_END" },
      geometry: { type: "Point", coordinates: [-96.797, 32.7767] },
    },
    {
      type: "Feature",
      properties: { id: "END-Z", name: "Cloud Onramp Z", role: "Z_END" },
      geometry: { type: "Point", coordinates: [-96.754, 32.812] },
    },
    {
      type: "Feature",
      properties: { id: "ROUTE-MIXED-001", name: "Mixed Package Route" },
      geometry: {
        type: "LineString",
        coordinates: [
          [-96.797, 32.7767],
          [-96.782, 32.789],
          [-96.754, 32.812],
        ],
      },
    },
  ],
});

export async function createKmzRouteFixture(): Promise<ArrayBuffer> {
  const zip = new JSZip();
  zip.file("doc.kml", kmlRouteFixture);
  return zip.generateAsync({ type: "arraybuffer" });
}

export const csvEndpointPairInput: TranslateTextInput = {
  sourceType: "CSV",
  fileName: "endpoint-pair.csv",
  text: csvEndpointPairFixture,
};

export const geoJsonRouteInput: TranslateTextInput = {
  sourceType: "GEOJSON",
  fileName: "route.geojson",
  text: geoJsonRouteFixture,
};

export const kmlRouteInput: TranslateTextInput = {
  sourceType: "KML",
  fileName: "route.kml",
  text: kmlRouteFixture,
};

export async function kmzRouteInput(): Promise<TranslateBinaryInput> {
  return {
    sourceType: "KMZ",
    fileName: "route.kmz",
    data: await createKmzRouteFixture(),
  };
}

export async function evaluateTranslateV1Fixtures() {
  const kmzInput = await kmzRouteInput();
  return {
    csvEndpointPair: await translateCsv(csvEndpointPairInput),
    geoJsonRoute: await translateGeoJson(geoJsonRouteInput),
    kmlRoute: await translateKml(kmlRouteInput),
    kmzRoute: await translateKmz(kmzInput),
    mixedEndpointRoutePackage: await translateGeoJson({
      sourceType: "GEOJSON",
      fileName: "mixed-endpoint-route.geojson",
      text: mixedEndpointRouteGeoJsonFixture,
    }),
  };
}

