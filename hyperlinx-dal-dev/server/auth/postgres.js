import pg from "pg";

const { Pool } = pg;
let authPool;

function authDatabaseUrl() {
  return String(process.env.AUTH_DATABASE_URL ?? "").trim();
}

export function authDatabaseConfigured() {
  return Boolean(authDatabaseUrl());
}

export function getAuthPool() {
  if (!authPool) {
    const connectionString = authDatabaseUrl();
    if (!connectionString) throw new Error("AUTH_DATABASE_URL is required for durable authentication authority.");
    authPool = new Pool({
      connectionString,
      max: Number(process.env.AUTH_POSTGRES_POOL_MAX ?? 8),
      idleTimeoutMillis: Number(process.env.AUTH_POSTGRES_IDLE_TIMEOUT_MS ?? 30_000),
      connectionTimeoutMillis: Number(process.env.AUTH_POSTGRES_CONNECT_TIMEOUT_MS ?? 5_000),
      statement_timeout: Number(process.env.AUTH_POSTGRES_STATEMENT_TIMEOUT_MS ?? 10_000),
      application_name: "hyperlinx-auth-authority",
      ssl: process.env.AUTH_POSTGRES_SSL === "require" ? { rejectUnauthorized: true } : undefined,
    });
    authPool.on("error", (error) => {
      console.error("[auth-postgres-pool]", error instanceof Error ? error.message : String(error));
    });
  }
  return authPool;
}

export async function authQuery(config, values) {
  return getAuthPool().query(config, values);
}

export async function withAuthTransaction(operation) {
  const client = await getAuthPool().connect();
  try {
    await client.query("BEGIN");
    const result = await operation(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function verifyAuthDatabase() {
  const result = await authQuery("SELECT to_regclass('hyperlinx.auth_sessions') AS sessions, to_regclass('hyperlinx.principals') AS principals");
  if (!result.rows[0]?.sessions || !result.rows[0]?.principals) {
    throw new Error("CIP-060 Phase 2B authentication schema is not initialized.");
  }
  return true;
}

export async function closeAuthPool() {
  await authPool?.end();
  authPool = undefined;
}
