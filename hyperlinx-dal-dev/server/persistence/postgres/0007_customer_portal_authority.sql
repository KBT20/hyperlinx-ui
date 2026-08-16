\set ON_ERROR_STOP on

BEGIN;

SET ROLE hyperlinx_owner;
SET search_path TO hyperlinx, public;

INSERT INTO organizations (organization_id, slug, name, status) VALUES
  ('org-demo-customer-a', 'demo-customer-a', 'Northstar Cloud Infrastructure', 'ACTIVE'),
  ('org-demo-customer-b', 'demo-customer-b', 'Blue Mesa Digital Systems', 'ACTIVE')
ON CONFLICT (organization_id) DO UPDATE SET name = EXCLUDED.name, status = 'ACTIVE', updated_at = clock_timestamp();

INSERT INTO customers (customer_id, organization_id, account_number, name, status, source_record) VALUES
  ('customer-demo-a', 'org-demo-customer-a', 1, 'Northstar Cloud Infrastructure', 'ACTIVE', '{"environment":"DEMO","productionEligible":false}'::jsonb),
  ('customer-demo-b', 'org-demo-customer-b', 2, 'Blue Mesa Digital Systems', 'ACTIVE', '{"environment":"DEMO","productionEligible":false}'::jsonb)
ON CONFLICT (customer_id) DO UPDATE SET name = EXCLUDED.name, status = 'ACTIVE', source_record = EXCLUDED.source_record, updated_at = clock_timestamp();

INSERT INTO permissions (permission_id, permission_key, description) VALUES
  ('permission-customer-portal-access', 'customer.portal.access', 'Open the bounded Customer Portal lens.'),
  ('permission-customer-project-read', 'customer.project.read', 'Read explicitly assigned customer projects.'),
  ('permission-customer-proposal-comment', 'customer.proposal.comment', 'Comment or ask a question on an assigned Proposal Revision.'),
  ('permission-customer-proposal-change', 'customer.proposal.request_change', 'Request Commercial review without mutating the Proposal Revision.'),
  ('permission-customer-proposal-decision', 'customer.proposal.decision', 'Accept or decline an exact assigned Proposal Revision.'),
  ('permission-customer-document-read', 'customer.document.read', 'Read authorized customer-safe project documents.')
ON CONFLICT (permission_key) DO UPDATE SET description = EXCLUDED.description;

INSERT INTO roles (role_id, organization_id, role_key, name) VALUES
  ('role-demo-customer-a-viewer', 'org-demo-customer-a', 'CUSTOMER_VIEWER', 'Customer Viewer'),
  ('role-demo-customer-a-reviewer', 'org-demo-customer-a', 'CUSTOMER_COMMERCIAL_REVIEWER', 'Customer Commercial Reviewer'),
  ('role-demo-customer-a-signer', 'org-demo-customer-a', 'CUSTOMER_AUTHORIZED_SIGNER', 'Customer Authorized Signer'),
  ('role-demo-customer-b-viewer', 'org-demo-customer-b', 'CUSTOMER_VIEWER', 'Customer Viewer'),
  ('role-demo-customer-b-reviewer', 'org-demo-customer-b', 'CUSTOMER_COMMERCIAL_REVIEWER', 'Customer Commercial Reviewer'),
  ('role-demo-customer-b-signer', 'org-demo-customer-b', 'CUSTOMER_AUTHORIZED_SIGNER', 'Customer Authorized Signer')
ON CONFLICT (role_id) DO UPDATE SET role_key = EXCLUDED.role_key, name = EXCLUDED.name;

INSERT INTO role_permissions (role_id, permission_id)
SELECT role.role_id, permission.permission_id
FROM roles role
CROSS JOIN permissions permission
WHERE role.organization_id IN ('org-demo-customer-a', 'org-demo-customer-b')
  AND permission.permission_key IN ('customer.portal.access', 'customer.project.read', 'customer.document.read')
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT role.role_id, permission.permission_id
FROM roles role
CROSS JOIN permissions permission
WHERE role.organization_id IN ('org-demo-customer-a', 'org-demo-customer-b')
  AND role.role_key IN ('CUSTOMER_COMMERCIAL_REVIEWER', 'CUSTOMER_AUTHORIZED_SIGNER')
  AND permission.permission_key IN ('proposal.read', 'proposal.review', 'customer.proposal.comment', 'customer.proposal.request_change', 'customer.proposal.decision')
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT role.role_id, permission.permission_id
FROM roles role
JOIN permissions permission ON permission.permission_key = 'service_order.sign_customer'
WHERE role.organization_id IN ('org-demo-customer-a', 'org-demo-customer-b')
  AND role.role_key = 'CUSTOMER_AUTHORIZED_SIGNER'
ON CONFLICT DO NOTHING;

INSERT INTO principals (principal_id, subject, username, display_name, email, title, principal_type, status) VALUES
  ('demo-customer-a-viewer', 'customer:demo-a:viewer', 'northstar-viewer', 'Avery Stone', 'avery.stone@example.invalid', 'Project Viewer', 'HUMAN', 'ACTIVE'),
  ('demo-customer-a-reviewer', 'customer:demo-a:reviewer', 'northstar-reviewer', 'Jordan Lee', 'jordan.lee@example.invalid', 'Commercial Reviewer', 'HUMAN', 'ACTIVE'),
  ('demo-customer-a-signer', 'customer:demo-a:signer', 'northstar-signer', 'Morgan Reed', 'morgan.reed@example.invalid', 'Authorized Signer', 'HUMAN', 'ACTIVE'),
  ('demo-customer-b-viewer', 'customer:demo-b:viewer', 'bluemesa-viewer', 'Taylor Brooks', 'taylor.brooks@example.invalid', 'Project Viewer', 'HUMAN', 'ACTIVE'),
  ('demo-customer-b-reviewer', 'customer:demo-b:reviewer', 'bluemesa-reviewer', 'Casey Quinn', 'casey.quinn@example.invalid', 'Commercial Reviewer', 'HUMAN', 'ACTIVE'),
  ('demo-customer-b-signer', 'customer:demo-b:signer', 'bluemesa-signer', 'Riley Chen', 'riley.chen@example.invalid', 'Authorized Signer', 'HUMAN', 'ACTIVE')
ON CONFLICT (principal_id) DO UPDATE SET display_name = EXCLUDED.display_name, email = EXCLUDED.email, title = EXCLUDED.title, status = 'ACTIVE', updated_at = clock_timestamp();

INSERT INTO principal_credentials (principal_id, password_digest, digest_scheme, password_change_required)
SELECT principal_id, '!INVITATION_ENROLLMENT_REQUIRED!', 'DISABLED', true
FROM principals WHERE principal_id LIKE 'demo-customer-%'
ON CONFLICT (principal_id) DO NOTHING;

INSERT INTO memberships (membership_id, organization_id, principal_id, status)
SELECT 'membership-' || principal_id,
  CASE WHEN principal_id LIKE 'demo-customer-a-%' THEN 'org-demo-customer-a' ELSE 'org-demo-customer-b' END,
  principal_id, 'ACTIVE'
FROM principals WHERE principal_id LIKE 'demo-customer-%'
ON CONFLICT (membership_id) DO UPDATE SET organization_id = EXCLUDED.organization_id, principal_id = EXCLUDED.principal_id, status = 'ACTIVE', updated_at = clock_timestamp();

INSERT INTO assignments (assignment_id, membership_id, role_id, scope_type, scope_id)
SELECT 'assignment-' || principal.principal_id,
  'membership-' || principal.principal_id,
  'role-' || replace(principal.principal_id, 'demo-', 'demo-'),
  'ORGANIZATION',
  CASE WHEN principal.principal_id LIKE 'demo-customer-a-%' THEN 'org-demo-customer-a' ELSE 'org-demo-customer-b' END
FROM principals principal WHERE principal.principal_id LIKE 'demo-customer-%'
ON CONFLICT (assignment_id) DO UPDATE SET membership_id = EXCLUDED.membership_id, role_id = EXCLUDED.role_id, scope_type = EXCLUDED.scope_type, scope_id = EXCLUDED.scope_id, expires_at = NULL;

INSERT INTO personal_state (membership_id, state_key, state_value)
SELECT 'membership-' || principal_id, 'identity.profile', jsonb_build_object(
  'authorityClass', 'DEMO',
  'participantType', 'CUSTOMER',
  'customerId', CASE WHEN principal_id LIKE 'demo-customer-a-%' THEN 'customer-demo-a' ELSE 'customer-demo-b' END,
  'workspaceId', 'workspace-' || principal_id,
  'title', title
)
FROM principals WHERE principal_id LIKE 'demo-customer-%'
ON CONFLICT (membership_id, state_key) DO UPDATE SET state_value = EXCLUDED.state_value, updated_at = clock_timestamp();

GRANT UPDATE (password_digest, digest_scheme, credential_version, rotated_at,
  password_change_required, failed_attempt_count, last_failed_at)
  ON hyperlinx.principal_credentials TO hyperlinx_app;

INSERT INTO schema_migrations (migration_id, content_hash)
VALUES ('0007_cip062_customer_portal_authority', encode(digest('0007_cip062_customer_portal_authority_v1', 'sha256'), 'hex'))
ON CONFLICT (migration_id) DO NOTHING;

COMMIT;
