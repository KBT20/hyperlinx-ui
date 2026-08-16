BEGIN;

SET search_path TO hyperlinx, public;

INSERT INTO permissions (permission_id, permission_key, description) VALUES
  ('permission-commercial-lifecycle-manage', 'commercial.lifecycle.manage', 'Own Opportunity, Commercial, Proposal, and Commercial-to-Engineering submission mutations.'),
  ('permission-engineering-lifecycle-manage', 'engineering.lifecycle.manage', 'Own Engineering review, approval, and IOF certification mutations.'),
  ('permission-service-order-countersign', 'service_order.countersign', 'Provide the independent Teralinx executive Service Order countersignature.'),
  ('permission-service-order-sign-customer', 'service_order.sign_customer', 'Provide an independently authenticated external customer signature.')
ON CONFLICT (permission_key) DO UPDATE SET description = EXCLUDED.description;

-- These duties are intentionally exact. platform.admin does not imply them.
DELETE FROM role_permissions
WHERE permission_id IN (
  SELECT permission_id FROM permissions WHERE permission_key IN (
    'commercial.lifecycle.manage',
    'engineering.lifecycle.manage',
    'service_order.countersign',
    'service_order.sign_customer',
    'scopeversion.authority'
  )
);

INSERT INTO role_permissions (role_id, permission_id)
SELECT role.role_id, permission.permission_id
FROM roles role
JOIN permissions permission ON permission.permission_key = 'commercial.lifecycle.manage'
WHERE role.organization_id = 'org-teralinx' AND role.role_key = 'CRO'
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT role.role_id, permission.permission_id
FROM roles role
JOIN permissions permission ON permission.permission_key = 'engineering.lifecycle.manage'
WHERE role.organization_id = 'org-teralinx' AND role.role_key = 'ADMINISTRATOR_COO'
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT role.role_id, permission.permission_id
FROM roles role
JOIN permissions permission ON permission.permission_key = 'service_order.countersign'
WHERE role.organization_id = 'org-teralinx' AND role.role_key = 'CEO'
ON CONFLICT DO NOTHING;

-- Customer signature authority is deliberately not assigned here. It requires
-- a separately verified, named external customer principal and membership.

UPDATE principals
SET display_name = 'Francisco', title = 'Chief Executive Officer', updated_at = clock_timestamp()
WHERE principal_id = 'teralinx-user-fran';

INSERT INTO schema_migrations (migration_id, content_hash)
VALUES ('0005_cip060_phase2c_separation_of_duties', encode(digest('0005_cip060_phase2c_separation_of_duties_v1', 'sha256'), 'hex'))
ON CONFLICT (migration_id) DO NOTHING;

COMMIT;
