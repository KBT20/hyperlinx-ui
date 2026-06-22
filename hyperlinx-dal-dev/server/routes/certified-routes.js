import {
  DIRS,
  createId,
  errorResponse,
  handleOptions,
  jsonResponse,
  listRecords,
  loadRecord,
  nowIso,
  persistRecord,
  readRequestJson,
  routeMatch,
  sortedByUpdated,
  unwrapBody,
} from "./_shared.js";

function numeric(value, fallback = 0) {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
}

function coordinate(value, fallback = [0, 0]) {
  if (!Array.isArray(value) || value.length < 2) return fallback;
  return [numeric(value[0]), numeric(value[1])];
}

function geometry(value, fallback = []) {
  return Array.isArray(value) ? value.map((item) => coordinate(item)).filter(([lon, lat]) => Number.isFinite(lon) && Number.isFinite(lat)) : fallback;
}

function normalizeRouteAuthorityState(value) {
  const upper = typeof value === "string" ? value.trim().toUpperCase() : "";
  const normalized = upper === "DRAFT_ROUTE" ? "DRAFT" : upper === "REJECTED_ROUTE" ? "REJECTED" : upper;
  if (upper && normalized !== upper) {
    console.log("[KERNEL_ALIAS_NORMALIZED]", {
      domain: "routeAuthority",
      from: upper,
      to: normalized,
    });
  }
  return normalized || undefined;
}

function normalizeAuthority(route) {
  const routeAuthorityState = normalizeRouteAuthorityState(route.routeAuthorityState);
  const directFallback = route.routeMode === "DIRECT_FALLBACK" || routeAuthorityState === "DIRECT_FALLBACK";
  const certified = routeAuthorityState === "CERTIFIED_ROUTE";
  const requiredActions = Array.isArray(route.authority?.requiredActions) ? route.authority.requiredActions : [];
  const warnings = Array.isArray(route.authority?.warnings) ? route.authority.warnings : [];
  return {
    canGenerateAuthoritativeQuote: certified && !directFallback,
    canCreateIOFPackage: certified && !directFallback,
    canCreateControlWork: certified && !directFallback,
    canCreateFieldWork: certified && !directFallback,
    canMutateTwinPlannedState: certified && !directFallback,
    requiredActions,
    warnings: directFallback && !warnings.includes("DIRECT_FALLBACK routes are advisory only.") ? [...warnings, "DIRECT_FALLBACK routes are advisory only."] : warnings,
  };
}

function normalizeCertifiedRoute(input) {
  const route = unwrapBody(input, "certifiedRoute");
  const timestamp = nowIso();
  const candidateCoordinate = coordinate(route?.candidateCoordinate);
  const attachmentCoordinate = coordinate(route?.attachmentCoordinate, candidateCoordinate);
  const routeGeometry = geometry(route?.geometry, [candidateCoordinate, attachmentCoordinate]);
  const routeAuthorityState = normalizeRouteAuthorityState(route?.routeAuthorityState) ?? (route?.routeMode === "DIRECT_FALLBACK" ? "DIRECT_FALLBACK" : "DRAFT");
  const normalized = {
    certifiedRouteId: String(route?.certifiedRouteId ?? createId("CR")),
    routeAuthorityState,
    routeMode: route?.routeMode ?? (routeGeometry.length <= 2 ? "DIRECT_FALLBACK" : "ENGINEER_DEFINED"),
    corridorBasis: route?.corridorBasis ?? "UNKNOWN",
    inventoryId: String(route?.inventoryId ?? ""),
    graphId: String(route?.graphId ?? ""),
    parentScopeVersionId: route?.parentScopeVersionId,
    scopeVersionId: route?.scopeVersionId,
    opportunitySeedId: route?.opportunitySeedId,
    candidateSiteId: route?.candidateSiteId,
    candidateCoordinate,
    attachmentCoordinate,
    attachmentAuthorityId: route?.attachmentAuthorityId,
    nearestRouteId: route?.nearestRouteId,
    nearestNodeId: route?.nearestNodeId,
    nearestStationId: route?.nearestStationId,
    geometry: routeGeometry,
    geometryHash: String(route?.geometryHash ?? "missing"),
    routeFeet: numeric(route?.routeFeet),
    routeMiles: numeric(route?.routeMiles),
    crowFlyFeet: numeric(route?.crowFlyFeet),
    routeToCrowFlyRatio: numeric(route?.routeToCrowFlyRatio),
    constraintEvidenceId: route?.constraintEvidenceId,
    constraintEvidenceHash: route?.constraintEvidenceHash,
    constraintEvidenceStatus: route?.constraintEvidenceStatus ?? "MISSING",
    crossingSummary: {
      roadCrossings: route?.crossingSummary?.roadCrossings ?? "UNKNOWN",
      railCrossings: route?.crossingSummary?.railCrossings ?? "UNKNOWN",
      waterCrossings: route?.crossingSummary?.waterCrossings ?? "UNKNOWN",
      parcelCrossings: route?.crossingSummary?.parcelCrossings ?? "UNKNOWN",
      buildingConflicts: route?.crossingSummary?.buildingConflicts ?? "UNKNOWN",
    },
    constructabilityScore: numeric(route?.constructabilityScore),
    riskScore: numeric(route?.riskScore, 100),
    permitAuthorities: Array.isArray(route?.permitAuthorities) ? route.permitAuthorities : [],
    certification: route?.certification && typeof route.certification === "object" ? route.certification : {},
    authority: route?.authority && typeof route.authority === "object" ? route.authority : {},
    createdAt: String(route?.createdAt ?? timestamp),
    updatedAt: String(route?.updatedAt ?? timestamp),
  };
  return {
    ...normalized,
    authority: normalizeAuthority(normalized),
  };
}

export async function handleCertifiedRoutes(req, res, pathname) {
  const match = routeMatch(pathname, "/api/certified-routes");
  if (!match) return false;
  if (handleOptions(req, res)) return true;

  if (match.base && req.method === "GET") {
    jsonResponse(res, 200, { certifiedRoutes: sortedByUpdated((await listRecords(DIRS.certifiedRoutes)).map(normalizeCertifiedRoute)) });
    return true;
  }

  if (!match.base && req.method === "GET") {
    try {
      jsonResponse(res, 200, { certifiedRoute: normalizeCertifiedRoute(await loadRecord(DIRS.certifiedRoutes, match.id)) });
    } catch {
      errorResponse(res, 404, `certifiedRoute not found: ${match.id}`);
    }
    return true;
  }

  if (match.base && req.method === "POST") {
    const body = await readRequestJson(req);
    const route = normalizeCertifiedRoute(body);
    jsonResponse(res, 201, { certifiedRoute: await persistRecord(DIRS.certifiedRoutes, route.certifiedRouteId, route) });
    return true;
  }

  if (!match.base && req.method === "PUT") {
    const body = await readRequestJson(req);
    const route = normalizeCertifiedRoute({ ...unwrapBody(body, "certifiedRoute"), certifiedRouteId: match.id, updatedAt: nowIso() });
    jsonResponse(res, 200, { certifiedRoute: await persistRecord(DIRS.certifiedRoutes, route.certifiedRouteId, route) });
    return true;
  }

  if (!match.base && match.action === "certify" && req.method === "POST") {
    try {
      const existing = await loadRecord(DIRS.certifiedRoutes, match.id);
      if (existing.routeMode === "DIRECT_FALLBACK") {
        errorResponse(res, 409, "DIRECT_FALLBACK routes cannot be certified.");
        return true;
      }
      if (existing.constraintEvidenceStatus !== "CURRENT") {
        errorResponse(res, 409, "Current constraint evidence is required before route certification.");
        return true;
      }
      const body = await readRequestJson(req);
      const name = String(body?.engineerName ?? body?.certifiedBy ?? "").trim();
      if (!name) {
        errorResponse(res, 400, "Engineer name is required.");
        return true;
      }
      const certifiedRoute = normalizeCertifiedRoute({
        ...existing,
        routeAuthorityState: body?.provisionalReason ? "PROVISIONALLY_CERTIFIED" : "CERTIFIED_ROUTE",
        certification: {
          ...existing.certification,
          certifiedBy: name,
          certifiedAt: nowIso(),
          certificationNotes: body?.certificationNotes,
          provisionalReason: body?.provisionalReason,
        },
        updatedAt: nowIso(),
      });
      jsonResponse(res, 200, { certifiedRoute: await persistRecord(DIRS.certifiedRoutes, certifiedRoute.certifiedRouteId, certifiedRoute) });
    } catch {
      errorResponse(res, 404, `certifiedRoute not found: ${match.id}`);
    }
    return true;
  }

  if (!match.base && match.action === "reject" && req.method === "POST") {
    try {
      const existing = await loadRecord(DIRS.certifiedRoutes, match.id);
      const body = await readRequestJson(req);
      const certifiedRoute = normalizeCertifiedRoute({
        ...existing,
        routeAuthorityState: "REJECTED",
        certification: {
          ...existing.certification,
          rejectionReason: body?.reason ?? body?.rejectionReason ?? "Rejected during route authority review.",
        },
        updatedAt: nowIso(),
      });
      jsonResponse(res, 200, { certifiedRoute: await persistRecord(DIRS.certifiedRoutes, certifiedRoute.certifiedRouteId, certifiedRoute) });
    } catch {
      errorResponse(res, 404, `certifiedRoute not found: ${match.id}`);
    }
    return true;
  }

  return false;
}
