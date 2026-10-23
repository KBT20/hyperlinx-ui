-- REVIEW ARTIFACT ONLY. DO NOT APPLY as part of P1-A local implementation.
-- Apply separately as the governed auth schema owner after human acceptance.
BEGIN;
SET ROLE hyperlinx_owner;
CREATE TABLE hyperlinx.invitation_consumption_receipts (
  invitation_id text PRIMARY KEY,
  token_hash text NOT NULL UNIQUE,
  principal_id text NOT NULL REFERENCES hyperlinx.principals(principal_id),
  organization_id text NOT NULL REFERENCES hyperlinx.organizations(organization_id),
  membership_id text NOT NULL REFERENCES hyperlinx.memberships(membership_id),
  request_hash text NOT NULL CHECK (request_hash ~ '^[0-9a-f]{64}$'),
  binding text NOT NULL,
  result jsonb NOT NULL CHECK (jsonb_typeof(result) = 'object'),
  consumed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  projected_at timestamptz
);
REVOKE ALL ON hyperlinx.invitation_consumption_receipts FROM PUBLIC;
GRANT SELECT, INSERT ON hyperlinx.invitation_consumption_receipts TO hyperlinx_app;
GRANT UPDATE (projected_at) ON hyperlinx.invitation_consumption_receipts TO hyperlinx_app;
-- No UPDATE of consumption identity/result, DELETE, customer role or membership grant.
INSERT INTO hyperlinx.schema_migrations (migration_id, content_hash)
VALUES ('0024_p1a_invitation_consumption', encode(public.digest('0024_p1a_invitation_consumption_v1','sha256'),'hex'));
COMMIT;
