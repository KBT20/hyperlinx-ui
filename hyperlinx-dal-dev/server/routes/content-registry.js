import { authQuery } from "../auth/postgres.js";
import { errorResponse, jsonResponse } from "./_shared.js";
import { requireRuntimeUser } from "./authority.js";
import {
  assertContentAccess, boundedLimit, contentDatasetProjection, contentFeatureProjection,
  contentLayerProjection, contentRevisionProjection, isInternalContentReader, parseBbox, parseNearest,
} from "../content/content-registry-authority.js";

const BASE = "/api/content-registry";
const text = (value) => String(value ?? "").trim();
const camel = (row = {}) => Object.fromEntries(Object.entries(row).map(([key, value]) => [key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase()), value]));

function actorFor(req, user) {
  return { ...user, sessionId: user.sessionId || req.authSession?.session_id || req.authSession?.sessionId };
}

async function grantsFor(actor, datasetId, purpose, query = authQuery) {
  const result = await query({
    text: `SELECT grant_id, dataset_id, dataset_revision_id, grantee_organization_id,
      grantee_principal_id, grantee_membership_id, purpose, project_id, geometry_access,
      permitted_properties, export_allowed, effective_from, expires_at, status, revoked_at
      FROM hyperlinx.content_access_grants
      WHERE dataset_id=$1 AND grantee_organization_id=$2
        AND (grantee_principal_id IS NULL OR grantee_principal_id=$3)
        AND (grantee_membership_id IS NULL OR grantee_membership_id=$4)
        AND purpose=$5`,
    values: [datasetId, actor.organizationId, actor.principalId, actor.membershipId, purpose],
  });
  return result.rows.map(camel);
}

async function contexts({ actor, datasetId = null, revisionId = null, purpose, query = authQuery }) {
  const internal = isInternalContentReader(actor);
  const conditions = [];
  const values = [];
  if (datasetId) { values.push(datasetId); conditions.push(`dataset.dataset_id=$${values.length}`); }
  if (revisionId) { values.push(revisionId); conditions.push(`revision.revision_id=$${values.length}`); }
  if (!internal) {
    values.push(actor.organizationId, actor.principalId, actor.membershipId, purpose);
    conditions.push(`EXISTS (SELECT 1 FROM hyperlinx.content_access_grants visible_grant
      WHERE visible_grant.dataset_id=dataset.dataset_id
        AND visible_grant.grantee_organization_id=$${values.length - 3}
        AND (visible_grant.grantee_principal_id IS NULL OR visible_grant.grantee_principal_id=$${values.length - 2})
        AND (visible_grant.grantee_membership_id IS NULL OR visible_grant.grantee_membership_id=$${values.length - 1})
        AND visible_grant.purpose=$${values.length}
        AND visible_grant.status='ACTIVE' AND visible_grant.revoked_at IS NULL
        AND visible_grant.effective_from <= clock_timestamp()
        AND (visible_grant.expires_at IS NULL OR visible_grant.expires_at > clock_timestamp()))`);
  }
  const result = await query({
    text: `SELECT
      source.source_id, source.source_type, source.display_name AS source_display_name,
      source.owner_organization_id AS source_owner_organization_id, source.source_classification,
      source.rights_classification, source.rights_policy, source.acquisition_method, source.license_reference,
      dataset.dataset_id, dataset.source_id AS dataset_source_id, dataset.dataset_type, dataset.category,
      dataset.display_name AS dataset_display_name, dataset.owner_organization_id AS dataset_owner_organization_id,
      dataset.status AS dataset_status,
      revision.revision_id, revision.dataset_id AS revision_dataset_id, revision.revision_number,
      revision.revision_label, revision.source_hash, revision.normalized_hash, revision.effective_from,
      revision.effective_to, revision.observed_at, revision.imported_at, revision.coordinate_reference_system,
      revision.schema_version, revision.feature_count, revision.geometry_types,
      ST_AsGeoJSON(revision.geographic_extent)::jsonb AS geographic_extent,
      revision.validation_status, revision.verification_class, revision.registry_status,
      revision.supersedes_revision_id, revision.provenance, revision.transformations,
      revision.canonical_hash AS revision_canonical_hash,
      layer.layer_id, layer.display_name AS layer_display_name, layer.style_class
      FROM hyperlinx.content_datasets dataset
      JOIN hyperlinx.content_sources source ON source.source_id=dataset.source_id
      ${revisionId
        ? "JOIN hyperlinx.content_dataset_revisions revision ON revision.dataset_id=dataset.dataset_id"
        : "JOIN hyperlinx.content_dataset_current_pointers pointer ON pointer.dataset_id=dataset.dataset_id JOIN hyperlinx.content_dataset_revisions revision ON revision.revision_id=pointer.revision_id"}
      LEFT JOIN hyperlinx.content_layers layer ON layer.dataset_id=dataset.dataset_id
      ${conditions.length ? `WHERE ${conditions.join(" AND ")}` : ""}
      ORDER BY dataset.dataset_id, layer.layer_id NULLS LAST`,
    values,
  });
  return result.rows.map((raw) => {
    const row = camel(raw);
    return {
      source: { sourceId: row.sourceId, sourceType: row.sourceType, displayName: row.sourceDisplayName,
        ownerOrganizationId: row.sourceOwnerOrganizationId, sourceClassification: row.sourceClassification,
        rightsClassification: row.rightsClassification, rightsPolicy: row.rightsPolicy, acquisitionMethod: row.acquisitionMethod,
        licenseReference: row.licenseReference },
      dataset: { datasetId: row.datasetId, sourceId: row.datasetSourceId, datasetType: row.datasetType, category: row.category,
        displayName: row.datasetDisplayName, ownerOrganizationId: row.datasetOwnerOrganizationId, status: row.datasetStatus },
      revision: { revisionId: row.revisionId, datasetId: row.revisionDatasetId, revisionNumber: row.revisionNumber,
        revisionLabel: row.revisionLabel, sourceHash: row.sourceHash, normalizedHash: row.normalizedHash,
        effectiveFrom: row.effectiveFrom, effectiveTo: row.effectiveTo, observedAt: row.observedAt, importedAt: row.importedAt,
        coordinateReferenceSystem: row.coordinateReferenceSystem, schemaVersion: row.schemaVersion,
        featureCount: row.featureCount, geometryTypes: row.geometryTypes,
        geographicExtent: row.geographicExtent, validationStatus: row.validationStatus,
        verificationClass: row.verificationClass, registryStatus: row.registryStatus,
        supersedesRevisionId: row.supersedesRevisionId, provenance: row.provenance,
        transformations: row.transformations, canonicalHash: row.revisionCanonicalHash },
      layer: row.layerId ? { layerId: row.layerId, displayName: row.layerDisplayName, styleClass: row.styleClass } : null,
    };
  });
}

async function authorizedContext(req, datasetId, revisionId, purpose, projectId, query = authQuery) {
  const actor = actorFor(req, req.authUser);
  const [context] = await contexts({ actor, datasetId, revisionId, purpose, query });
  if (!context) throw Object.assign(new Error("CONTENT_NOT_FOUND"), { status: 404, code: "CONTENT_NOT_FOUND" });
  const grants = isInternalContentReader(actor) ? [] : await grantsFor(actor, context.dataset.datasetId, purpose, query);
  const decision = assertContentAccess({ user: actor, ...context, grants, purpose, projectId });
  return { actor, context: { ...context, actorId: actor.principalId, purpose }, decision };
}

function routeError(res, error) {
  errorResponse(res, Number(error?.status) || 500, error?.code || "CONTENT_REGISTRY_READ_FAILED");
}

export async function handleContentRegistry(req, res, pathname, dependencies = {}) {
  if (pathname !== BASE && !pathname.startsWith(`${BASE}/`)) return false;
  const user = requireRuntimeUser(req, res);
  if (!user) return true;
  if (req.method !== "GET") { errorResponse(res, 405, "Content Registry mutation is not exposed by CIP-115B."); return true; }
  const query = dependencies.query || authQuery;
  const url = new URL(req.url, "https://runtime.invalid");
  const purpose = text(url.searchParams.get("purpose"));
  const projectId = text(url.searchParams.get("projectId")) || null;
  try {
    if (!purpose) throw Object.assign(new Error("CONTENT_PURPOSE_REQUIRED"), { status: 400, code: "CONTENT_PURPOSE_REQUIRED" });
    const actor = actorFor(req, user);
    if (pathname === `${BASE}/datasets` || pathname === `${BASE}/layers`) {
      const rows = await contexts({ actor, purpose, query });
      const projections = [];
      const seen = new Set();
      for (const context of rows) {
        const grants = isInternalContentReader(actor) ? [] : await grantsFor(actor, context.dataset.datasetId, purpose, query);
        let decision;
        try { decision = assertContentAccess({ user: actor, ...context, grants, purpose, projectId }); } catch { continue; }
        const key = pathname.endsWith("/layers") ? context.layer?.layerId : context.dataset.datasetId;
        if (!key || seen.has(key)) continue;
        seen.add(key);
        projections.push(pathname.endsWith("/layers")
          ? contentLayerProjection({ ...context, actorId: actor.principalId, purpose }, decision)
          : contentDatasetProjection({ ...context, actorOrganizationId: actor.organizationId }, decision));
      }
      jsonResponse(res, 200, pathname.endsWith("/layers") ? { layers: projections } : { datasets: projections });
      return true;
    }
    let match = pathname.match(/^\/api\/content-registry\/datasets\/([^/]+)$/);
    if (match) {
      const resolved = await authorizedContext(req, decodeURIComponent(match[1]), null, purpose, projectId, query);
      jsonResponse(res, 200, contentDatasetProjection({ ...resolved.context, actorOrganizationId: resolved.actor.organizationId }, resolved.decision)); return true;
    }
    match = pathname.match(/^\/api\/content-registry\/datasets\/([^/]+)\/revisions$/);
    if (match) {
      const resolved = await authorizedContext(req, decodeURIComponent(match[1]), null, purpose, projectId, query);
      const result = await query({ text: `SELECT * FROM hyperlinx.content_dataset_revisions WHERE dataset_id=$1 ORDER BY revision_number DESC`, values: [resolved.context.dataset.datasetId] });
      const revisions = [];
      for (const row of result.rows.map(camel)) {
        let decision = resolved.decision;
        if (!isInternalContentReader(resolved.actor)) {
          const grants = await grantsFor(resolved.actor, resolved.context.dataset.datasetId, purpose, query);
          try { decision = assertContentAccess({ user: resolved.actor, source: resolved.context.source,
            dataset: resolved.context.dataset, revision: row, grants, purpose, projectId }); } catch { continue; }
        }
        revisions.push(contentRevisionProjection({ ...resolved.context, revision: row }, decision));
      }
      jsonResponse(res, 200, { revisions }); return true;
    }
    match = pathname.match(/^\/api\/content-registry\/revisions\/([^/]+)(\/provenance|\/features)?$/);
    if (match) {
      const revisionId = decodeURIComponent(match[1]);
      const resolved = await authorizedContext(req, null, revisionId, purpose, projectId, query);
      if (match[2] === "/provenance") { jsonResponse(res, 200, contentRevisionProjection(resolved.context, resolved.decision, { provenance: true })); return true; }
      if (!match[2]) { jsonResponse(res, 200, contentRevisionProjection(resolved.context, resolved.decision)); return true; }
      if (resolved.decision.geometryAccess === "NONE") throw Object.assign(new Error("CONTENT_NOT_FOUND"), { status: 404, code: "CONTENT_NOT_FOUND" });
      const limit = boundedLimit(url.searchParams.get("limit"));
      const bbox = url.searchParams.has("bbox") ? parseBbox(url.searchParams.get("bbox")) : null;
      const intersects = url.searchParams.has("intersects") ? parseBbox(url.searchParams.get("intersects")) : null;
      const nearest = url.searchParams.has("nearest") ? parseNearest(url.searchParams.get("nearest")) : null;
      if ([bbox, intersects, nearest].filter(Boolean).length !== 1) throw Object.assign(new Error("CONTENT_SPATIAL_QUERY_EXACTLY_ONE_REQUIRED"), { status: 400, code: "CONTENT_SPATIAL_QUERY_EXACTLY_ONE_REQUIRED" });
      const values = [revisionId];
      let spatial;
      let ordering = "feature.source_feature_key";
      if (nearest) {
        values.push(nearest.longitude, nearest.latitude);
        spatial = `TRUE`; ordering = `place.geometry <-> ST_SetSRID(ST_MakePoint($2,$3),4326)`;
      } else {
        const box = bbox || intersects; values.push(box.west, box.south, box.east, box.north);
        spatial = `ST_Intersects(place.geometry, ST_MakeEnvelope($2,$3,$4,$5,4326))`;
      }
      let grantScope = "TRUE";
      if (resolved.decision.actorClass !== "INTERNAL") {
        values.push(resolved.decision.grantId);
        grantScope = `EXISTS (SELECT 1 FROM hyperlinx.content_access_grants scoped_grant
          WHERE scoped_grant.grant_id=$${values.length}
            AND (scoped_grant.geographic_scope IS NULL OR ST_Intersects(place.geometry,scoped_grant.geographic_scope)))`;
      }
      values.push(limit);
      const limitParameter = values.length;
      const geometryExpression = resolved.decision.geometryAccess === "BOUNDS" ? "ST_Envelope(place.geometry)"
        : resolved.decision.geometryAccess === "GENERALIZED" ? "ST_SimplifyPreserveTopology(place.geometry, 0.001)" : "place.geometry";
      const result = await query({
        text: `SELECT feature.*, ST_AsGeoJSON(${geometryExpression})::jsonb AS geometry
          FROM hyperlinx.content_features feature JOIN hyperlinx.places place ON place.place_id=feature.place_id
          WHERE feature.dataset_revision_id=$1 AND ${spatial} AND ${grantScope}
          ORDER BY ${ordering}, feature.feature_id LIMIT $${limitParameter}`,
        values,
      });
      jsonResponse(res, 200, { datasetRevisionId: revisionId, geometryPrecision: resolved.decision.geometryAccess,
        features: result.rows.map((row) => contentFeatureProjection(camel(row), resolved.decision)) }); return true;
    }
    errorResponse(res, 404, "Content Registry resource not found."); return true;
  } catch (error) { routeError(res, error); return true; }
}
