\set ON_ERROR_STOP on

BEGIN;

SET ROLE hyperlinx_owner;
SET search_path TO hyperlinx, public;

ALTER TABLE principals
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS title text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS last_authenticated_at timestamptz;

ALTER TABLE principal_credentials
  ADD COLUMN IF NOT EXISTS password_change_required boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS failed_attempt_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_failed_at timestamptz;

ALTER TABLE memberships
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT clock_timestamp();

CREATE TABLE IF NOT EXISTS auth_sessions (
  session_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash text NOT NULL UNIQUE,
  principal_id text NOT NULL REFERENCES principals(principal_id),
  membership_id text NOT NULL REFERENCES memberships(membership_id),
  organization_id text NOT NULL REFERENCES organizations(organization_id),
  credential_version integer NOT NULL CHECK (credential_version > 0),
  issued_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  last_seen_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  idle_expires_at timestamptz NOT NULL,
  absolute_expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  revoked_reason text,
  user_agent_hash text,
  network_address_hash text,
  CHECK (idle_expires_at > issued_at),
  CHECK (absolute_expires_at > issued_at)
);

CREATE INDEX IF NOT EXISTS auth_sessions_principal_active_idx
  ON auth_sessions (principal_id, revoked_at, absolute_expires_at);
CREATE INDEX IF NOT EXISTS auth_sessions_token_hash_idx
  ON auth_sessions (token_hash);

CREATE TABLE IF NOT EXISTS auth_audit_events (
  auth_event_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  principal_id text REFERENCES principals(principal_id),
  membership_id text REFERENCES memberships(membership_id),
  organization_id text REFERENCES organizations(organization_id),
  session_id uuid REFERENCES auth_sessions(session_id),
  login_identifier_hash text,
  network_address_hash text,
  user_agent_hash text,
  outcome text NOT NULL,
  reason text NOT NULL DEFAULT '',
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS auth_audit_login_rate_idx
  ON auth_audit_events (login_identifier_hash, network_address_hash, event_type, outcome, recorded_at DESC);
CREATE INDEX IF NOT EXISTS auth_audit_principal_idx
  ON auth_audit_events (principal_id, recorded_at DESC);

GRANT SELECT ON hyperlinx.organizations, hyperlinx.principals, hyperlinx.principal_credentials,
  hyperlinx.memberships, hyperlinx.roles, hyperlinx.permissions,
  hyperlinx.role_permissions, hyperlinx.assignments TO hyperlinx_app;
GRANT SELECT, INSERT, UPDATE ON hyperlinx.auth_sessions TO hyperlinx_app;
GRANT SELECT, INSERT ON hyperlinx.auth_audit_events TO hyperlinx_app;
GRANT SELECT, INSERT, UPDATE ON hyperlinx.personal_state TO hyperlinx_app;
GRANT UPDATE (last_authenticated_at) ON hyperlinx.principals TO hyperlinx_app;
GRANT UPDATE (password_digest, digest_scheme, credential_version, rotated_at,
  password_change_required, failed_attempt_count, last_failed_at)
  ON hyperlinx.principal_credentials TO hyperlinx_app;

INSERT INTO schema_migrations (migration_id, content_hash)
VALUES ('0004_cip060_phase2b_durable_auth', encode(digest('CIP-060 Phase 2B durable authentication authority v1', 'sha256'), 'hex'))
ON CONFLICT (migration_id) DO NOTHING;

COMMIT;
