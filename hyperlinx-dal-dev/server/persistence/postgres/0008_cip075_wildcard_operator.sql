\set ON_ERROR_STOP on

BEGIN;

SET ROLE hyperlinx_owner;
SET search_path TO hyperlinx, public;

CREATE TABLE IF NOT EXISTS wildcard_operator_grants (
  wildcard_grant_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  principal_id text NOT NULL REFERENCES principals(principal_id),
  membership_id text NOT NULL REFERENCES memberships(membership_id),
  organization_id text NOT NULL REFERENCES organizations(organization_id),
  assumed_authority text NOT NULL,
  effective_permission text NOT NULL REFERENCES permissions(permission_key),
  status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'REVOKED')),
  granted_by text NOT NULL,
  granted_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  revoked_at timestamptz,
  UNIQUE (principal_id, membership_id, organization_id, assumed_authority)
);

CREATE TABLE IF NOT EXISTS wildcard_authority_sessions (
  wildcard_session_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_session_id uuid NOT NULL REFERENCES auth_sessions(session_id),
  wildcard_grant_id uuid NOT NULL REFERENCES wildcard_operator_grants(wildcard_grant_id),
  principal_id text NOT NULL REFERENCES principals(principal_id),
  membership_id text NOT NULL REFERENCES memberships(membership_id),
  organization_id text NOT NULL REFERENCES organizations(organization_id),
  constitutional_role text NOT NULL,
  assumed_authority text NOT NULL,
  effective_permission text NOT NULL,
  authority_mode text NOT NULL DEFAULT 'ASSUMED' CHECK (authority_mode = 'ASSUMED'),
  reason_code text NOT NULL CHECK (reason_code IN ('PLATFORM_DEVELOPMENT','COMMERCIAL_CONTINUITY','AUTHORIZED_TESTING','EMERGENCY_OPERATIONS')),
  reason_detail text NOT NULL DEFAULT '',
  activated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  expires_at timestamptz NOT NULL,
  deactivated_at timestamptz,
  deactivation_reason text,
  CHECK (expires_at > activated_at)
);

CREATE UNIQUE INDEX IF NOT EXISTS wildcard_authority_one_active_session_idx
  ON wildcard_authority_sessions (auth_session_id) WHERE deactivated_at IS NULL;
CREATE INDEX IF NOT EXISTS wildcard_authority_principal_audit_idx
  ON wildcard_authority_sessions (principal_id, activated_at DESC);

GRANT SELECT ON hyperlinx.wildcard_operator_grants TO hyperlinx_app;
GRANT SELECT, INSERT, UPDATE ON hyperlinx.wildcard_authority_sessions TO hyperlinx_app;

INSERT INTO wildcard_operator_grants (
  principal_id, membership_id, organization_id, assumed_authority, effective_permission, granted_by
)
SELECT p.principal_id, m.membership_id, m.organization_id,
  'CRO_COMMERCIAL', 'commercial.lifecycle.manage', 'CIP-075'
FROM principals p
JOIN memberships m ON m.principal_id = p.principal_id
WHERE p.principal_id = 'teralinx-user-kyle'
  AND m.organization_id = 'org-teralinx'
  AND p.status = 'ACTIVE' AND m.status = 'ACTIVE'
ON CONFLICT (principal_id, membership_id, organization_id, assumed_authority)
DO UPDATE SET effective_permission = EXCLUDED.effective_permission,
  status = 'ACTIVE', revoked_at = NULL;

INSERT INTO schema_migrations (migration_id, content_hash)
VALUES ('0008_cip075_wildcard_operator', encode(digest('0008_cip075_wildcard_operator_v1', 'sha256'), 'hex'))
ON CONFLICT (migration_id) DO NOTHING;

COMMIT;
