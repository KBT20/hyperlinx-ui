import { withAuthTransaction, withLockedAuthClient } from './postgres.js';

export async function lockInvitationTenant(client, organizationId) {
  if (!organizationId) throw Object.assign(new Error('INVITATION_TENANT_REQUIRED'), { status: 409 });
  await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [`enrollment-tenant:${organizationId}`]);
}

// Synchronization only: callers retain all existing role, scope and state checks.
// Never let an administrative writer overwrite a committed but unprojected enrollment.
export async function withInvitationAdministration(organizationId, operation) {
  return withAuthTransaction(async client => {
    await lockInvitationTenant(client, organizationId);
    const pending = await client.query(`SELECT invitation_id FROM hyperlinx.invitation_consumption_receipts
      WHERE organization_id=$1 AND projected_at IS NULL LIMIT 1`, [organizationId]);
    if (pending.rowCount) throw Object.assign(new Error('ENROLLMENT_RECOVERY_REQUIRED'), { status: 409 });
    return withLockedAuthClient(client, operation);
  });
}
