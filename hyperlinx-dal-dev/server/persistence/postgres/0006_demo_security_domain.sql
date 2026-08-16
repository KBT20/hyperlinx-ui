BEGIN;

SET search_path TO hyperlinx, public;

INSERT INTO organizations (organization_id, slug, name, status)
VALUES ('org-demo', 'demo', 'Teralinx Demo', 'ACTIVE')
ON CONFLICT (organization_id) DO UPDATE SET name = EXCLUDED.name, status = 'ACTIVE', updated_at = clock_timestamp();

INSERT INTO principals (principal_id, subject, username, display_name, email, title, principal_type, status)
VALUES ('demo-principal', 'internal:demo-principal', 'demo', 'Demo User', 'demo@teralinx.net', 'Demo Lifecycle Operator', 'HUMAN', 'ACTIVE')
ON CONFLICT (principal_id) DO UPDATE SET
  username = EXCLUDED.username,
  display_name = EXCLUDED.display_name,
  email = EXCLUDED.email,
  title = EXCLUDED.title,
  status = 'ACTIVE',
  updated_at = clock_timestamp();

INSERT INTO principal_credentials (principal_id, password_digest, digest_scheme, password_change_required)
VALUES ('demo-principal', '!UNPROVISIONED!', 'DISABLED', true)
ON CONFLICT (principal_id) DO NOTHING;

INSERT INTO memberships (membership_id, organization_id, principal_id, status)
VALUES ('membership-demo-principal', 'org-demo', 'demo-principal', 'ACTIVE')
ON CONFLICT (membership_id) DO UPDATE SET organization_id = 'org-demo', principal_id = 'demo-principal', status = 'ACTIVE', updated_at = clock_timestamp();

INSERT INTO roles (role_id, organization_id, role_key, name)
VALUES ('role-org-demo-superuser', 'org-demo', 'DEMO_SUPERUSER', 'Demo Superuser')
ON CONFLICT (role_id) DO UPDATE SET role_key = 'DEMO_SUPERUSER', name = 'Demo Superuser';

INSERT INTO permissions (permission_id, permission_key, description) VALUES
  ('permission-demo-tenant', 'demo.tenant', 'Resolve repositories exclusively inside the org-demo data boundary.'),
  ('permission-demo-reset', 'demo.reset', 'Reset only the org-demo repository root to the approved seed state.'),
  ('permission-marketplace-lifecycle-manage', 'marketplace.lifecycle.manage', 'Exercise Marketplace lifecycle capability.'),
  ('permission-control-lifecycle-manage', 'control.lifecycle.manage', 'Exercise Control lifecycle capability.'),
  ('permission-field-lifecycle-manage', 'field.lifecycle.manage', 'Exercise Field lifecycle capability.'),
  ('permission-close-lifecycle-manage', 'close.lifecycle.manage', 'Exercise Close lifecycle capability.'),
  ('permission-twin-read', 'twin.read', 'Inspect governed Twin state.')
ON CONFLICT (permission_key) DO UPDATE SET description = EXCLUDED.description;

DELETE FROM role_permissions WHERE role_id = 'role-org-demo-superuser';

INSERT INTO role_permissions (role_id, permission_id)
SELECT 'role-org-demo-superuser', permission_id
FROM permissions
WHERE permission_key NOT IN ('platform.admin', 'runtime.deploy', 'users.manage', 'scopeversion.authority')
ON CONFLICT DO NOTHING;

INSERT INTO assignments (assignment_id, membership_id, role_id, scope_type, scope_id)
VALUES ('assignment-demo-principal-superuser', 'membership-demo-principal', 'role-org-demo-superuser', 'ORGANIZATION', 'org-demo')
ON CONFLICT (assignment_id) DO UPDATE SET membership_id = EXCLUDED.membership_id, role_id = EXCLUDED.role_id, scope_type = 'ORGANIZATION', scope_id = 'org-demo', expires_at = NULL;

INSERT INTO personal_state (membership_id, state_key, state_value)
VALUES ('membership-demo-principal', 'identity.profile', '{"authorityClass":"DEMO","participantType":"DEMO","workspaceId":"workspace-org-demo","title":"Demo Lifecycle Operator"}'::jsonb)
ON CONFLICT (membership_id, state_key) DO UPDATE SET state_value = EXCLUDED.state_value, updated_at = clock_timestamp();

INSERT INTO schema_migrations (migration_id, content_hash)
VALUES ('0006_cip060_demo_security_domain', encode(digest('0006_cip060_demo_security_domain_v1', 'sha256'), 'hex'))
ON CONFLICT (migration_id) DO NOTHING;

COMMIT;
