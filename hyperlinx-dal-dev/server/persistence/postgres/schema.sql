BEGIN;

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

SET ROLE hyperlinx_owner;
CREATE SCHEMA IF NOT EXISTS hyperlinx;
SET search_path TO hyperlinx, public;

CREATE TABLE IF NOT EXISTS schema_migrations (
  migration_id text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  content_hash text NOT NULL
);

CREATE TABLE IF NOT EXISTS organizations (
  organization_id text PRIMARY KEY,
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  status text NOT NULL DEFAULT 'ACTIVE',
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE IF NOT EXISTS principals (
  principal_id text PRIMARY KEY,
  subject text NOT NULL UNIQUE,
  username text NOT NULL UNIQUE,
  display_name text NOT NULL,
  principal_type text NOT NULL DEFAULT 'HUMAN',
  status text NOT NULL DEFAULT 'ACTIVE',
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE IF NOT EXISTS principal_credentials (
  principal_id text PRIMARY KEY REFERENCES principals(principal_id) ON DELETE CASCADE,
  password_digest text NOT NULL,
  digest_scheme text NOT NULL DEFAULT 'SCRYPT',
  credential_version integer NOT NULL DEFAULT 1 CHECK (credential_version > 0),
  rotated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE IF NOT EXISTS memberships (
  membership_id text PRIMARY KEY,
  organization_id text NOT NULL REFERENCES organizations(organization_id),
  principal_id text NOT NULL REFERENCES principals(principal_id),
  status text NOT NULL DEFAULT 'ACTIVE',
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (organization_id, principal_id)
);

CREATE TABLE IF NOT EXISTS roles (
  role_id text PRIMARY KEY,
  organization_id text REFERENCES organizations(organization_id),
  role_key text NOT NULL,
  name text NOT NULL,
  UNIQUE (organization_id, role_key)
);

CREATE TABLE IF NOT EXISTS permissions (
  permission_id text PRIMARY KEY,
  permission_key text NOT NULL UNIQUE,
  description text NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS role_permissions (
  role_id text NOT NULL REFERENCES roles(role_id) ON DELETE CASCADE,
  permission_id text NOT NULL REFERENCES permissions(permission_id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE IF NOT EXISTS assignments (
  assignment_id text PRIMARY KEY,
  membership_id text NOT NULL REFERENCES memberships(membership_id),
  role_id text NOT NULL REFERENCES roles(role_id),
  scope_type text NOT NULL DEFAULT 'ORGANIZATION',
  scope_id text NOT NULL,
  effective_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  expires_at timestamptz,
  CHECK (expires_at IS NULL OR expires_at > effective_at)
);

CREATE TABLE IF NOT EXISTS personal_state (
  membership_id text NOT NULL REFERENCES memberships(membership_id) ON DELETE CASCADE,
  state_key text NOT NULL,
  state_value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (membership_id, state_key)
);

CREATE TABLE IF NOT EXISTS customers (
  customer_id text PRIMARY KEY,
  organization_id text NOT NULL REFERENCES organizations(organization_id),
  account_number bigint,
  name text NOT NULL,
  status text NOT NULL DEFAULT 'ACTIVE',
  source_record jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (organization_id, account_number)
);

CREATE TABLE IF NOT EXISTS opportunities (
  opportunity_id text PRIMARY KEY,
  organization_id text NOT NULL REFERENCES organizations(organization_id),
  customer_id text REFERENCES customers(customer_id),
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  product_reference jsonb NOT NULL DEFAULT '{}'::jsonb,
  current_lifecycle_state text NOT NULL DEFAULT 'PROPOSED',
  current_artifact_type text,
  current_artifact_id text,
  status text NOT NULL DEFAULT 'ACTIVE',
  commercial_state jsonb NOT NULL DEFAULT '{}'::jsonb,
  row_version bigint NOT NULL DEFAULT 1 CHECK (row_version > 0),
  created_by text REFERENCES principals(principal_id),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE IF NOT EXISTS proposals (
  proposal_id text PRIMARY KEY,
  opportunity_id text NOT NULL REFERENCES opportunities(opportunity_id),
  organization_id text NOT NULL REFERENCES organizations(organization_id),
  created_by text REFERENCES principals(principal_id),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE IF NOT EXISTS proposal_revisions (
  proposal_revision_id text PRIMARY KEY,
  proposal_id text NOT NULL REFERENCES proposals(proposal_id),
  opportunity_id text NOT NULL REFERENCES opportunities(opportunity_id),
  organization_id text NOT NULL REFERENCES organizations(organization_id),
  revision_number integer NOT NULL CHECK (revision_number > 0),
  parent_revision_id text REFERENCES proposal_revisions(proposal_revision_id),
  status text NOT NULL,
  commercial_state jsonb NOT NULL,
  content_hash text NOT NULL,
  created_by text REFERENCES principals(principal_id),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  superseded_by text REFERENCES proposal_revisions(proposal_revision_id),
  source_file_path text,
  UNIQUE (proposal_id, revision_number)
);

CREATE TABLE IF NOT EXISTS proposal_current_pointers (
  proposal_id text PRIMARY KEY REFERENCES proposals(proposal_id),
  proposal_revision_id text NOT NULL UNIQUE REFERENCES proposal_revisions(proposal_revision_id),
  pointer_version bigint NOT NULL DEFAULT 1 CHECK (pointer_version > 0),
  updated_by text REFERENCES principals(principal_id),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE IF NOT EXISTS governed_artifacts (
  artifact_id text NOT NULL,
  artifact_type text NOT NULL,
  revision text NOT NULL DEFAULT '1',
  organization_id text NOT NULL REFERENCES organizations(organization_id),
  customer_id text REFERENCES customers(customer_id),
  opportunity_id text REFERENCES opportunities(opportunity_id),
  parent_artifact_id text,
  authority text NOT NULL,
  status text NOT NULL,
  payload jsonb NOT NULL,
  content_hash text NOT NULL,
  source_file_path text,
  created_by text REFERENCES principals(principal_id),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (artifact_type, artifact_id, revision)
);

CREATE TABLE IF NOT EXISTS artifact_current_pointers (
  organization_id text NOT NULL REFERENCES organizations(organization_id),
  artifact_type text NOT NULL,
  scope_id text NOT NULL,
  artifact_id text NOT NULL,
  revision text NOT NULL,
  pointer_version bigint NOT NULL DEFAULT 1 CHECK (pointer_version > 0),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (organization_id, artifact_type, scope_id),
  FOREIGN KEY (artifact_type, artifact_id, revision)
    REFERENCES governed_artifacts(artifact_type, artifact_id, revision)
);

CREATE TABLE IF NOT EXISTS scope_versions (
  scope_version_id text PRIMARY KEY,
  organization_id text NOT NULL REFERENCES organizations(organization_id),
  customer_id text REFERENCES customers(customer_id),
  opportunity_id text NOT NULL REFERENCES opportunities(opportunity_id),
  proposal_revision_id text REFERENCES proposal_revisions(proposal_revision_id),
  engineering_package_id text,
  engineering_revision_id text,
  engineering_approval_id text,
  certified_iof_id text,
  certification_ledger_id text,
  service_order_revision_id text,
  customer_signature_id text,
  countersignature_id text,
  status text NOT NULL,
  payload jsonb NOT NULL,
  content_hash text NOT NULL,
  created_by text REFERENCES principals(principal_id),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE IF NOT EXISTS redline_revisions (
  redline_revision_id text PRIMARY KEY,
  redline_id text NOT NULL,
  scope_version_id text NOT NULL REFERENCES scope_versions(scope_version_id),
  organization_id text NOT NULL REFERENCES organizations(organization_id),
  revision_number integer NOT NULL CHECK (revision_number > 0),
  parent_revision_id text REFERENCES redline_revisions(redline_revision_id),
  status text NOT NULL,
  payload jsonb NOT NULL,
  content_hash text NOT NULL,
  created_by text REFERENCES principals(principal_id),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (redline_id, revision_number)
);

CREATE TABLE IF NOT EXISTS evidence_references (
  evidence_id text PRIMARY KEY,
  organization_id text NOT NULL REFERENCES organizations(organization_id),
  artifact_id text,
  artifact_type text,
  content_hash text NOT NULL,
  media_type text NOT NULL,
  byte_size bigint NOT NULL CHECK (byte_size >= 0),
  storage_reference text NOT NULL,
  scope jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by text REFERENCES principals(principal_id),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE IF NOT EXISTS places (
  place_id text PRIMARY KEY,
  organization_id text NOT NULL REFERENCES organizations(organization_id),
  place_type text NOT NULL,
  name text NOT NULL DEFAULT '',
  logical_reference text,
  geometry geometry(Geometry, 4326),
  properties jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CHECK (place_type IN ('ROUTE','SPINE','STATION','STATION_RANGE','SEGMENT','COORDINATE','POINT','SITE','FACILITY','BUILDING','PARCEL','POLYGON','REGION','NODE','EDGE','LOGICAL_LOCATION'))
);

CREATE TABLE IF NOT EXISTS object_place_relationships (
  relationship_id text PRIMARY KEY,
  organization_id text NOT NULL REFERENCES organizations(organization_id),
  object_id text NOT NULL,
  place_id text NOT NULL REFERENCES places(place_id),
  relationship_type text NOT NULL,
  effective_from timestamptz NOT NULL DEFAULT clock_timestamp(),
  effective_to timestamptz,
  source_authority text NOT NULL,
  source_artifact_id text,
  CHECK (effective_to IS NULL OR effective_to > effective_from)
);

CREATE TABLE IF NOT EXISTS governed_events (
  event_id text PRIMARY KEY,
  event_type text NOT NULL,
  organization_id text NOT NULL REFERENCES organizations(organization_id),
  principal_id text NOT NULL REFERENCES principals(principal_id),
  membership_id text NOT NULL REFERENCES memberships(membership_id),
  aggregate_type text NOT NULL,
  aggregate_id text NOT NULL,
  aggregate_version bigint NOT NULL CHECK (aggregate_version > 0),
  scope_version_id text REFERENCES scope_versions(scope_version_id),
  redline_revision_id text REFERENCES redline_revisions(redline_revision_id),
  object_id text,
  discipline text NOT NULL,
  action text NOT NULL,
  from_state text,
  to_state text NOT NULL,
  place_reference jsonb NOT NULL DEFAULT '{}'::jsonb,
  source_authority text NOT NULL,
  source_artifact_id text,
  source_revision text,
  source_hash text,
  preceding_event_id text REFERENCES governed_events(event_id),
  effective_at timestamptz NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  evidence_reference jsonb NOT NULL DEFAULT '{}'::jsonb,
  event_hash text NOT NULL UNIQUE,
  idempotency_key text NOT NULL,
  UNIQUE (organization_id, aggregate_type, aggregate_id, aggregate_version),
  UNIQUE (organization_id, principal_id, idempotency_key),
  CHECK (redline_revision_id IS NULL OR scope_version_id IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS object_current_state (
  organization_id text NOT NULL REFERENCES organizations(organization_id),
  object_id text NOT NULL,
  scope_version_id text REFERENCES scope_versions(scope_version_id),
  current_state text NOT NULL,
  current_event_id text NOT NULL REFERENCES governed_events(event_id),
  effective_at timestamptz NOT NULL,
  projection_version bigint NOT NULL CHECK (projection_version > 0),
  PRIMARY KEY (organization_id, object_id)
);

CREATE TABLE IF NOT EXISTS command_idempotency (
  organization_id text NOT NULL REFERENCES organizations(organization_id),
  principal_id text NOT NULL REFERENCES principals(principal_id),
  command_type text NOT NULL,
  idempotency_key text NOT NULL,
  request_hash text NOT NULL,
  response_status integer NOT NULL,
  response_body jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (organization_id, principal_id, command_type, idempotency_key)
);

CREATE TABLE IF NOT EXISTS repository_import_runs (
  import_run_id text PRIMARY KEY,
  source_root text NOT NULL,
  source_manifest_hash text NOT NULL,
  status text NOT NULL,
  started_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  completed_at timestamptz,
  source_file_count bigint NOT NULL DEFAULT 0,
  imported_file_count bigint NOT NULL DEFAULT 0,
  error_count bigint NOT NULL DEFAULT 0,
  details jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS repository_records (
  repository_name text NOT NULL,
  record_id text NOT NULL,
  source_file_path text NOT NULL,
  classification text NOT NULL,
  organization_id text REFERENCES organizations(organization_id),
  customer_id text,
  opportunity_id text,
  revision text,
  parent_id text,
  status text,
  is_current boolean,
  embedded_hash text,
  source_file_hash text NOT NULL,
  byte_size bigint NOT NULL CHECK (byte_size >= 0),
  payload jsonb NOT NULL,
  imported_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  import_run_id text REFERENCES repository_import_runs(import_run_id),
  PRIMARY KEY (repository_name, record_id),
  UNIQUE (source_file_path)
);

CREATE INDEX IF NOT EXISTS opportunities_org_customer_idx ON opportunities (organization_id, customer_id);
CREATE INDEX IF NOT EXISTS opportunities_lifecycle_idx ON opportunities (organization_id, current_lifecycle_state);
CREATE INDEX IF NOT EXISTS proposal_revisions_lineage_idx ON proposal_revisions (proposal_id, parent_revision_id);
CREATE INDEX IF NOT EXISTS governed_artifacts_scope_idx ON governed_artifacts (organization_id, opportunity_id, artifact_type);
CREATE INDEX IF NOT EXISTS governed_events_replay_idx ON governed_events (organization_id, aggregate_type, aggregate_id, aggregate_version);
CREATE INDEX IF NOT EXISTS governed_events_object_idx ON governed_events (organization_id, object_id, recorded_at);
CREATE INDEX IF NOT EXISTS places_geometry_gix ON places USING gist (geometry);
CREATE INDEX IF NOT EXISTS object_place_time_idx ON object_place_relationships (organization_id, object_id, effective_from, effective_to);
CREATE INDEX IF NOT EXISTS repository_records_scope_idx ON repository_records (organization_id, customer_id, opportunity_id, repository_name);
CREATE INDEX IF NOT EXISTS repository_records_file_hash_idx ON repository_records (source_file_hash);

CREATE OR REPLACE FUNCTION reject_immutable_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'IMMUTABLE_ARTIFACT: % rows cannot be updated or deleted', TG_TABLE_NAME
    USING ERRCODE = '55000';
END;
$$;

DROP TRIGGER IF EXISTS proposal_revisions_immutable ON proposal_revisions;
CREATE TRIGGER proposal_revisions_immutable BEFORE UPDATE OR DELETE ON proposal_revisions
FOR EACH ROW EXECUTE FUNCTION reject_immutable_mutation();
DROP TRIGGER IF EXISTS governed_artifacts_immutable ON governed_artifacts;
CREATE TRIGGER governed_artifacts_immutable BEFORE UPDATE OR DELETE ON governed_artifacts
FOR EACH ROW EXECUTE FUNCTION reject_immutable_mutation();
DROP TRIGGER IF EXISTS scope_versions_immutable ON scope_versions;
CREATE TRIGGER scope_versions_immutable BEFORE UPDATE OR DELETE ON scope_versions
FOR EACH ROW EXECUTE FUNCTION reject_immutable_mutation();
DROP TRIGGER IF EXISTS redline_revisions_immutable ON redline_revisions;
CREATE TRIGGER redline_revisions_immutable BEFORE UPDATE OR DELETE ON redline_revisions
FOR EACH ROW EXECUTE FUNCTION reject_immutable_mutation();
DROP TRIGGER IF EXISTS governed_events_append_only ON governed_events;
CREATE TRIGGER governed_events_append_only BEFORE UPDATE OR DELETE ON governed_events
FOR EACH ROW EXECUTE FUNCTION reject_immutable_mutation();
DROP TRIGGER IF EXISTS evidence_references_immutable ON evidence_references;
CREATE TRIGGER evidence_references_immutable BEFORE UPDATE OR DELETE ON evidence_references
FOR EACH ROW EXECUTE FUNCTION reject_immutable_mutation();

CREATE OR REPLACE FUNCTION proposal_revision_diff(p_left_id text, p_right_id text)
RETURNS jsonb LANGUAGE sql STABLE AS $$
  WITH revisions AS (
    SELECT proposal_revision_id, commercial_state
    FROM hyperlinx.proposal_revisions
    WHERE proposal_revision_id IN (p_left_id, p_right_id)
  ), left_values AS (
    SELECT key, value FROM jsonb_each((SELECT commercial_state FROM revisions WHERE proposal_revision_id = p_left_id))
  ), right_values AS (
    SELECT key, value FROM jsonb_each((SELECT commercial_state FROM revisions WHERE proposal_revision_id = p_right_id))
  ), keys AS (
    SELECT key FROM left_values UNION SELECT key FROM right_values
  )
  SELECT COALESCE(jsonb_object_agg(keys.key, jsonb_build_object('before', left_values.value, 'after', right_values.value)), '{}'::jsonb)
  FROM keys
  LEFT JOIN left_values USING (key)
  LEFT JOIN right_values USING (key)
  WHERE left_values.value IS DISTINCT FROM right_values.value;
$$;

CREATE OR REPLACE FUNCTION append_governed_event(
  p_event_id text,
  p_event_type text,
  p_organization_id text,
  p_principal_id text,
  p_membership_id text,
  p_aggregate_type text,
  p_aggregate_id text,
  p_expected_version bigint,
  p_scope_version_id text,
  p_redline_revision_id text,
  p_object_id text,
  p_discipline text,
  p_action text,
  p_from_state text,
  p_to_state text,
  p_place_reference jsonb,
  p_source_authority text,
  p_source_artifact_id text,
  p_source_revision text,
  p_source_hash text,
  p_preceding_event_id text,
  p_effective_at timestamptz,
  p_evidence_reference jsonb,
  p_idempotency_key text
) RETURNS governed_events
LANGUAGE plpgsql
AS $$
DECLARE
  v_existing governed_events;
  v_current object_current_state;
  v_next_version bigint;
  v_hash text;
  v_event governed_events;
BEGIN
  SELECT * INTO v_existing
  FROM governed_events
  WHERE organization_id = p_organization_id
    AND principal_id = p_principal_id
    AND idempotency_key = p_idempotency_key;
  IF FOUND THEN RETURN v_existing; END IF;

  IF p_redline_revision_id IS NOT NULL AND p_scope_version_id IS NULL THEN
    RAISE EXCEPTION 'REDLINE_REQUIRES_SCOPEVERSION' USING ERRCODE = '23514';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_organization_id || ':' || p_aggregate_type || ':' || p_aggregate_id, 0));
  IF p_object_id IS NOT NULL THEN
    SELECT * INTO v_current FROM object_current_state
    WHERE organization_id = p_organization_id AND object_id = p_object_id
    FOR UPDATE;
  END IF;

  v_next_version := COALESCE(v_current.projection_version, 0) + 1;
  IF p_expected_version IS DISTINCT FROM COALESCE(v_current.projection_version, 0) THEN
    RAISE EXCEPTION 'STALE_CONTEXT: expected %, current %', p_expected_version, COALESCE(v_current.projection_version, 0)
      USING ERRCODE = '40001';
  END IF;
  IF p_preceding_event_id IS DISTINCT FROM v_current.current_event_id THEN
    RAISE EXCEPTION 'STALE_CONTEXT: preceding event mismatch' USING ERRCODE = '40001';
  END IF;
  IF v_current.current_state IS NOT NULL AND p_from_state IS DISTINCT FROM v_current.current_state THEN
    RAISE EXCEPTION 'INVALID_TRANSITION: from_state mismatch' USING ERRCODE = '23514';
  END IF;

  v_hash := encode(public.digest(concat_ws('|', p_event_id, p_event_type, p_organization_id, p_principal_id,
    p_aggregate_type, p_aggregate_id, v_next_version, p_scope_version_id, p_redline_revision_id,
    p_object_id, p_discipline, p_action, p_from_state, p_to_state, p_source_authority,
    p_source_artifact_id, p_source_revision, p_source_hash, p_preceding_event_id,
    p_effective_at::text, COALESCE(p_place_reference, '{}'::jsonb)::text,
    COALESCE(p_evidence_reference, '{}'::jsonb)::text), 'sha256'), 'hex');

  INSERT INTO governed_events (
    event_id, event_type, organization_id, principal_id, membership_id, aggregate_type,
    aggregate_id, aggregate_version, scope_version_id, redline_revision_id, object_id,
    discipline, action, from_state, to_state, place_reference, source_authority,
    source_artifact_id, source_revision, source_hash, preceding_event_id, effective_at,
    evidence_reference, event_hash, idempotency_key
  ) VALUES (
    p_event_id, p_event_type, p_organization_id, p_principal_id, p_membership_id, p_aggregate_type,
    p_aggregate_id, v_next_version, p_scope_version_id, p_redline_revision_id, p_object_id,
    p_discipline, p_action, p_from_state, p_to_state, COALESCE(p_place_reference, '{}'::jsonb),
    p_source_authority, p_source_artifact_id, p_source_revision, p_source_hash,
    p_preceding_event_id, p_effective_at, COALESCE(p_evidence_reference, '{}'::jsonb),
    v_hash, p_idempotency_key
  ) RETURNING * INTO v_event;

  IF p_object_id IS NOT NULL THEN
    INSERT INTO object_current_state (
      organization_id, object_id, scope_version_id, current_state, current_event_id,
      effective_at, projection_version
    ) VALUES (
      p_organization_id, p_object_id, p_scope_version_id, p_to_state, p_event_id,
      p_effective_at, v_next_version
    ) ON CONFLICT (organization_id, object_id) DO UPDATE SET
      scope_version_id = EXCLUDED.scope_version_id,
      current_state = EXCLUDED.current_state,
      current_event_id = EXCLUDED.current_event_id,
      effective_at = EXCLUDED.effective_at,
      projection_version = EXCLUDED.projection_version;
  END IF;

  RETURN v_event;
END;
$$;

CREATE OR REPLACE VIEW replay_integrity AS
WITH latest AS (
  SELECT DISTINCT ON (organization_id, object_id)
    organization_id, object_id, event_id, to_state, effective_at, aggregate_version
  FROM governed_events
  WHERE object_id IS NOT NULL
  ORDER BY organization_id, object_id, aggregate_version DESC
)
SELECT
  current_state.organization_id,
  current_state.object_id,
  current_state.current_event_id,
  latest.event_id AS replay_event_id,
  current_state.current_state,
  latest.to_state AS replay_state,
  current_state.projection_version,
  latest.aggregate_version AS replay_version,
  (current_state.current_event_id = latest.event_id
    AND current_state.current_state = latest.to_state
    AND current_state.projection_version = latest.aggregate_version) AS integrity_ok
FROM object_current_state current_state
JOIN latest USING (organization_id, object_id);

INSERT INTO schema_migrations (migration_id, content_hash)
VALUES ('0001_cip058_foundation', encode(digest('CIP-058 PostgreSQL/PostGIS foundation v1', 'sha256'), 'hex'))
ON CONFLICT (migration_id) DO NOTHING;

COMMIT;
