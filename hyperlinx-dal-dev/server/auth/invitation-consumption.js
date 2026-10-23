import { createHmac } from 'node:crypto';
import { lockInvitationTenant } from './invitation-administration.js';

const fail = (code, status = 409) => { throw Object.assign(new Error(code), { code, status }); };
const binding = invitation => JSON.stringify([
  invitation.customerInvitationId, invitation.tokenHash, invitation.customerOrganizationId,
  invitation.intendedPrincipalId, invitation.intendedMembershipId || null,
  invitation.purpose, invitation.projectAccessId || null,
  invitation.opportunityId || null, invitation.proposalRevisionId || null,
  invitation.requestedRole || null, invitation.issuedAt || null, invitation.expiresAt,
]);

// PostgreSQL is the consumption authority; repository files are retryable projections.
// Dependencies make failure boundaries testable without a database or live credentials.
export async function consumeInvitation({ token, password, suppliedIdentity = '' }, deps) {
  const initial = await deps.findInvitation(token);
  if (!initial) fail('INVITATION_UNAVAILABLE', 410);
  const requestHash = createHmac('sha256', token).update(JSON.stringify([password, suppliedIdentity])).digest('hex');
  const transact = operation => deps.transaction(async client => {
    await lockInvitationTenant(client, initial.customerOrganizationId);
    // Serialize different invitations for the same principal as well as same-token retries.
    await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [`enrollment:${initial.intendedPrincipalId}`]);
    return operation(client);
  });
  const receipt = await transact(async client => {
    const prior = (await client.query('SELECT * FROM hyperlinx.invitation_consumption_receipts WHERE invitation_id=$1 FOR UPDATE', [initial.customerInvitationId])).rows[0];
    if (prior) {
      if (prior.request_hash !== requestHash || prior.binding !== binding(initial)) fail('INVITATION_REPLAY_CONFLICT');
      return prior;
    }
    const invitation = await deps.findInvitation(token);
    if (!invitation || binding(invitation) !== binding(initial) || invitation.status !== 'ACTIVE' ||
        invitation.revokedAt || invitation.consumedAt || !Number.isFinite(Date.parse(invitation.expiresAt)) ||
        Date.parse(invitation.expiresAt) <= Date.now()) fail('INVITATION_UNAVAILABLE', 410);
    const principal = await deps.validateIdentity(client, invitation, suppliedIdentity);
    await deps.preflight?.(invitation, principal);
    const digest = await deps.hashPassword(password);
    await deps.activate(client, invitation, principal, digest);
    const result = { enrolled: true, username: principal.username, customerOrganizationId: invitation.customerOrganizationId };
    return (await client.query(`INSERT INTO hyperlinx.invitation_consumption_receipts
      (invitation_id, principal_id, organization_id, membership_id, request_hash, binding, result, token_hash)
      VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8) RETURNING *`,
    [invitation.customerInvitationId, principal.principal_id, invitation.customerOrganizationId,
      principal.membership_id, requestHash, binding(invitation), JSON.stringify(result), invitation.tokenHash])).rows[0];
  });
  // A committed receipt prevents rotation even if this projection or the response fails.
  await transact(async client => {
    const current = (await client.query('SELECT * FROM hyperlinx.invitation_consumption_receipts WHERE invitation_id=$1 FOR UPDATE', [initial.customerInvitationId])).rows[0];
    if (!current.projected_at) {
      await deps.project(initial, current);
      await client.query('UPDATE hyperlinx.invitation_consumption_receipts SET projected_at=clock_timestamp() WHERE invitation_id=$1', [initial.customerInvitationId]);
    }
  });
  return receipt.result;
}

export async function validateEnrollmentIdentity(client, invitation, suppliedIdentity) {
  const rows = (await client.query(`SELECT p.principal_id,p.username,p.email,m.organization_id,m.membership_id,
      c.password_change_required,c.rotated_at
    FROM hyperlinx.principals p JOIN hyperlinx.memberships m USING (principal_id)
    JOIN hyperlinx.principal_credentials c USING (principal_id)
    WHERE p.principal_id=$1 AND m.organization_id=$2 AND p.status='ACTIVE'
      AND ($3::text IS NULL OR m.membership_id=$3)
      AND (m.status='ACTIVE' OR ($4='CUSTOMER_PLANNER_ENROLLMENT' AND m.status='PENDING_ENROLLMENT'))
    FOR UPDATE OF p`, [invitation.intendedPrincipalId, invitation.customerOrganizationId,
    invitation.intendedMembershipId || null, invitation.purpose])).rows;
  if (rows.length !== 1 || rows[0].organization_id !== invitation.customerOrganizationId ||
      (invitation.intendedMembershipId && rows[0].membership_id !== invitation.intendedMembershipId)) fail('INVITATION_MEMBERSHIP_MISMATCH');
  const principal = rows[0];
  if (suppliedIdentity && ![principal.username, principal.email].map(value => String(value || '').trim().toLowerCase()).includes(suppliedIdentity)) fail('INVITATION_IDENTITY_MISMATCH', 403);
  // No receipt means we cannot infer whether an earlier credential write consumed
  // this historical invitation. Never repeat a possibly completed enrollment.
  if (principal.password_change_required === false &&
      (!Number.isFinite(Date.parse(invitation.issuedAt)) || !Number.isFinite(new Date(principal.rotated_at).getTime()) ||
       new Date(principal.rotated_at).getTime() >= Date.parse(invitation.issuedAt))) {
    fail('ENROLLMENT_HISTORICAL_PARTIAL_REVIEW_REQUIRED');
  }
  return principal;
}

export async function projectEnrollment(invitation, receipt, store) {
  const timestamp = new Date(receipt.consumed_at).toISOString();
  const current = await store.loadInvitation(invitation.customerInvitationId);
  if (binding(current) !== receipt.binding || !['ACTIVE','CONSUMED'].includes(current.status) || current.revokedAt) fail('ENROLLMENT_PROJECTION_CONFLICT');
  if (current.status === 'CONSUMED' && (current.consumedByPrincipalId !== receipt.principal_id || current.consumedAt !== timestamp)) fail('ENROLLMENT_PROJECTION_CONFLICT');
  if (current.status !== 'CONSUMED') await store.saveInvitation(invitation.customerInvitationId, {
    ...current, status: 'CONSUMED', consumedAt: timestamp, consumedByPrincipalId: receipt.principal_id,
    resultingPrincipalId: receipt.principal_id, resultingMembershipId: receipt.membership_id, updatedAt: timestamp,
  });
  if (!invitation.projectAccessId) return;
  const access = await store.loadAccess(invitation.projectAccessId);
  validateEnrollmentAccess(access, receipt);
  if (access.enrolledAt) return;
  const reviewPackage = await store.loadReviewPackage(access.customerReviewPackageId);
  // Preserve the existing grant and signer projection; create no new role or grant.
  await store.saveAccess(invitation.projectAccessId, { ...access,
    accountId: reviewPackage?.accountId ?? access.accountId,
    authorityType: access.role === 'CUSTOMER_AUTHORIZED_SIGNER' ? 'CUSTOMER_SERVICE_ORDER_SIGNER' : undefined,
    authoritySchemaVersion: access.role === 'CUSTOMER_AUTHORIZED_SIGNER' ? 'CIP-106-CUSTOMER-SIGNER-AUTHORITY-V1' : undefined,
    effectiveAt: timestamp, expiresAt: null, revokedAt: null, status: 'ACTIVE', enrolledAt: timestamp, updatedAt: timestamp,
  });
}

export function validateEnrollmentAccess(access, identity) {
  if (!access || access.customerOrganizationId !== identity.organization_id || access.principalId !== identity.principal_id ||
      access.membershipId !== identity.membership_id || access.revokedAt ||
      !['PENDING_ENROLLMENT','ACTIVE'].includes(access.status)) fail('ENROLLMENT_ACCESS_CONFLICT');
}
