import {
  createCorridorEvidenceBundle,
  lineGeometry,
  normalizeEndpointEvidence,
  normalizeRouteEvidence,
  pointGeometry,
} from "../CorridorNormalizationEngine";
import { detectEvidenceConflicts } from "../CorridorConfidenceEngine";
import type {
  CorridorEvidenceBundle,
  CorridorRawEvidenceInput,
} from "../CorridorNormalizedEvidence";

const collectedAt = "2026-06-23T00:00:00.000Z";

export const endpointPairOnlyInputs: CorridorRawEvidenceInput[] = [
  {
    sourceType: "CUSTOMER_ENDPOINT",
    sourceName: "Hyperscaler endpoint intake",
    entityType: "ENDPOINT",
    entityId: "END-A",
    collectedAt,
    rawReference: "row:1",
    normalizedPayload: {
      name: "AI Campus A",
      role: "A_END",
      address: "100 Compute Dr, Dallas, TX",
      owner: "Hyperscaler",
    },
    geometryReference: pointGeometry(-96.797, 32.7767),
  },
  {
    sourceType: "CUSTOMER_ENDPOINT",
    sourceName: "Hyperscaler endpoint intake",
    entityType: "ENDPOINT",
    entityId: "END-Z",
    collectedAt,
    rawReference: "row:2",
    normalizedPayload: {
      name: "Cloud Onramp Z",
      role: "Z_END",
      address: "200 Onramp Ave, Dallas, TX",
      owner: "Cloud Partner",
    },
    geometryReference: pointGeometry(-96.754, 32.812),
  },
];

export const customerSuppliedRouteInputs: CorridorRawEvidenceInput[] = [
  {
    sourceType: "CUSTOMER_ROUTE",
    sourceName: "Customer supplied route GeoJSON",
    entityType: "ROUTE_CANDIDATE",
    entityId: "ROUTE-CUSTOMER-001",
    collectedAt,
    rawReference: "customer-route.geojson",
    normalizedPayload: {
      routeClass: "PRIMARY",
      distanceMiles: 4.8,
      source: "CUSTOMER_SUPPLIED",
    },
    geometryReference: lineGeometry([
      [-96.797, 32.7767],
      [-96.783, 32.786],
      [-96.767, 32.798],
      [-96.754, 32.812],
    ]),
  },
];

export const customerRoutePlusKmlInputs: CorridorRawEvidenceInput[] = [
  ...customerSuppliedRouteInputs,
  {
    sourceType: "KML",
    sourceName: "Engineer reference KML",
    entityType: "ROUTE_CANDIDATE",
    entityId: "ROUTE-CUSTOMER-001",
    collectedAt,
    rawReference: "reference-route.kml",
    normalizedPayload: {
      routeClass: "PRIMARY",
      distanceMiles: 4.82,
      source: "KML",
    },
    geometryReference: lineGeometry([
      [-96.797, 32.7767],
      [-96.784, 32.7865],
      [-96.768, 32.799],
      [-96.754, 32.812],
    ]),
  },
];

export const conflictingEndpointCoordinateInputs: CorridorRawEvidenceInput[] = [
  {
    ...endpointPairOnlyInputs[0],
    sourceType: "CUSTOMER_ENDPOINT",
    sourceName: "Customer endpoint CSV",
    geometryReference: pointGeometry(-96.797, 32.7767),
  },
  {
    ...endpointPairOnlyInputs[0],
    sourceType: "DATA_CENTER_DATASET",
    sourceName: "Data center dataset",
    rawReference: "dataset:ai-campus-a",
    geometryReference: pointGeometry(-96.802, 32.779),
  },
];

export const conflictingRouteGeometryInputs: CorridorRawEvidenceInput[] = [
  ...customerRoutePlusKmlInputs,
];

export const missingEvidenceInputs: CorridorRawEvidenceInput[] = [];

export function buildEndpointPairOnlyBundle(): CorridorEvidenceBundle {
  const endpoints = normalizeEndpointEvidence(endpointPairOnlyInputs);
  return createCorridorEvidenceBundle({
    bundleId: "BUNDLE-ENDPOINT-PAIR-ONLY",
    corridorId: "CORR-FIXTURE-ENDPOINTS",
    evidence: endpoints,
    createdAt: collectedAt,
  });
}

export function buildCustomerSuppliedRouteBundle(): CorridorEvidenceBundle {
  const endpoints = normalizeEndpointEvidence(endpointPairOnlyInputs);
  const routes = normalizeRouteEvidence(customerSuppliedRouteInputs);
  return createCorridorEvidenceBundle({
    bundleId: "BUNDLE-CUSTOMER-ROUTE",
    corridorId: "CORR-FIXTURE-ROUTE",
    evidence: [...endpoints, ...routes],
    createdAt: collectedAt,
  });
}

export function buildCustomerRoutePlusKmlBundle(): CorridorEvidenceBundle {
  const endpoints = normalizeEndpointEvidence(endpointPairOnlyInputs);
  const routes = normalizeRouteEvidence(customerRoutePlusKmlInputs);
  const evidence = [...endpoints, ...routes];
  return createCorridorEvidenceBundle({
    bundleId: "BUNDLE-CUSTOMER-ROUTE-KML",
    corridorId: "CORR-FIXTURE-ROUTE-KML",
    evidence,
    conflicts: detectEvidenceConflicts(evidence),
    createdAt: collectedAt,
  });
}

export function buildConflictingEndpointBundle(): CorridorEvidenceBundle {
  const evidence = normalizeEndpointEvidence(conflictingEndpointCoordinateInputs);
  return createCorridorEvidenceBundle({
    bundleId: "BUNDLE-CONFLICT-ENDPOINT",
    corridorId: "CORR-FIXTURE-CONFLICT-ENDPOINT",
    evidence,
    conflicts: detectEvidenceConflicts(evidence),
    createdAt: collectedAt,
  });
}

export function buildConflictingRouteBundle(): CorridorEvidenceBundle {
  const evidence = normalizeRouteEvidence(conflictingRouteGeometryInputs);
  return createCorridorEvidenceBundle({
    bundleId: "BUNDLE-CONFLICT-ROUTE",
    corridorId: "CORR-FIXTURE-CONFLICT-ROUTE",
    evidence,
    conflicts: detectEvidenceConflicts(evidence),
    createdAt: collectedAt,
  });
}

export function buildMissingEvidenceBundle(): CorridorEvidenceBundle {
  return createCorridorEvidenceBundle({
    bundleId: "BUNDLE-MISSING-EVIDENCE",
    corridorId: "CORR-FIXTURE-MISSING",
    evidence: [],
    createdAt: collectedAt,
  });
}

export function evaluateNormalizationFixtures() {
  return {
    endpointPairOnly: buildEndpointPairOnlyBundle(),
    customerSuppliedRoute: buildCustomerSuppliedRouteBundle(),
    customerRoutePlusKml: buildCustomerRoutePlusKmlBundle(),
    conflictingEndpointCoordinates: buildConflictingEndpointBundle(),
    conflictingRouteGeometry: buildConflictingRouteBundle(),
    missingEvidencePackage: buildMissingEvidenceBundle(),
  };
}

