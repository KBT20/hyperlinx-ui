import process from "node:process";
import { hashPassword } from "../server/auth/password.js";
import { authQuery, closeAuthPool, verifyAuthDatabase, withAuthTransaction } from "../server/auth/postgres.js";

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) throw new Error("Provisioning JSON is required on stdin.");
  return JSON.parse(raw);
}

function cleanProfile(input = {}) {
  return {
    ...(input.workspaceId ? { workspaceId: String(input.workspaceId) } : {}),
    ...(input.title ? { title: String(input.title) } : {}),
    ...(input.participantType ? { participantType: String(input.participantType) } : {}),
  };
}

async function main() {
  await verifyAuthDatabase();
  const input = await readStdin();
  const users = Array.isArray(input.users) ? input.users : [];
  if (!users.length) throw new Error("At least one user must be provisioned.");
  const provisioned = [];
  for (const item of users) {
    const username = String(item.username ?? "").trim().toLowerCase();
    const password = String(item.password ?? "");
    if (!username) throw new Error("Each provisioned user requires a username.");
    const passwordDigest = await hashPassword(password);
    const result = await withAuthTransaction(async (client) => {
      const identity = await client.query({
        text: `SELECT p.principal_id, p.display_name, m.membership_id, m.organization_id
          FROM hyperlinx.principals p
          JOIN hyperlinx.memberships m USING (principal_id)
          JOIN hyperlinx.organizations o USING (organization_id)
          WHERE lower(p.username) = lower($1) AND p.status = 'ACTIVE' AND m.status = 'ACTIVE' AND o.status = 'ACTIVE'`,
        values: [username],
      });
      if (identity.rowCount !== 1) throw new Error(`Active durable identity not found for username: ${username}`);
      const row = identity.rows[0];
      await client.query({
        text: `UPDATE hyperlinx.principal_credentials
          SET password_digest = $2, digest_scheme = 'SCRYPT', credential_version = credential_version + 1,
            rotated_at = clock_timestamp(), password_change_required = $3,
            failed_attempt_count = 0, last_failed_at = NULL
          WHERE principal_id = $1`,
        values: [row.principal_id, passwordDigest, item.passwordChangeRequired !== false],
      });
      await client.query({
        text: "UPDATE hyperlinx.auth_sessions SET revoked_at = clock_timestamp(), revoked_reason = 'ADMIN_CREDENTIAL_PROVISION' WHERE principal_id = $1 AND revoked_at IS NULL",
        values: [row.principal_id],
      });
      const profile = cleanProfile(item.profile);
      if (Object.keys(profile).length) {
        await client.query({
          text: `INSERT INTO hyperlinx.personal_state (membership_id,state_key,state_value)
            VALUES ($1,'identity.profile',$2) ON CONFLICT (membership_id,state_key) DO UPDATE
            SET state_value = hyperlinx.personal_state.state_value || EXCLUDED.state_value,
              updated_at = clock_timestamp()`,
          values: [row.membership_id, profile],
        });
      }
      await client.query({
        text: `INSERT INTO hyperlinx.auth_audit_events (
          event_type,principal_id,membership_id,organization_id,outcome,reason
        ) VALUES ('ADMIN_CREDENTIAL_PROVISION',$1,$2,$3,'SUCCESS','BOUNDED_SERVER_BOOTSTRAP')`,
        values: [row.principal_id, row.membership_id, row.organization_id],
      });
      return row;
    });
    provisioned.push({
      username,
      principalId: result.principal_id,
      membershipId: result.membership_id,
      organizationId: result.organization_id,
      passwordChangeRequired: item.passwordChangeRequired !== false,
    });
  }
  console.log(JSON.stringify({ provisioned }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}).finally(() => closeAuthPool());
