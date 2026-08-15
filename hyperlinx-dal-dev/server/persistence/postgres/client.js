import pg from "pg";

const { Pool } = pg;
let applicationPool;
let migrationPool;

function poolOptions(connectionString) {
  if (!connectionString) return null;
  return {
    connectionString,
    max: Number(process.env.DAL_POSTGRES_POOL_MAX ?? 10),
    idleTimeoutMillis: Number(process.env.DAL_POSTGRES_IDLE_TIMEOUT_MS ?? 30_000),
    connectionTimeoutMillis: Number(process.env.DAL_POSTGRES_CONNECT_TIMEOUT_MS ?? 5_000),
    statement_timeout: Number(process.env.DAL_POSTGRES_STATEMENT_TIMEOUT_MS ?? 30_000),
    application_name: process.env.DAL_POSTGRES_APPLICATION_NAME ?? "hyperlinx-dal",
    ssl: process.env.DAL_POSTGRES_SSL === "require" ? { rejectUnauthorized: true } : undefined,
  };
}

export function persistenceMode() {
  const mode = String(process.env.DAL_PERSISTENCE_MODE ?? "file").trim().toLowerCase();
  return ["file", "shadow", "postgres"].includes(mode) ? mode : "file";
}

export function applicationDatabaseConfigured() {
  return Boolean(process.env.DATABASE_URL);
}

export function getApplicationPool() {
  if (!applicationPool) {
    const options = poolOptions(process.env.DATABASE_URL);
    if (!options) throw new Error("DATABASE_URL is required for PostgreSQL persistence.");
    applicationPool = new Pool(options);
  }
  return applicationPool;
}

export function getMigrationPool() {
  if (!migrationPool) {
    const options = poolOptions(process.env.HYPERLINX_MIGRATION_DATABASE_URL ?? process.env.DATABASE_URL);
    if (!options) throw new Error("HYPERLINX_MIGRATION_DATABASE_URL is required for migration.");
    migrationPool = new Pool({ ...options, max: 2, application_name: "hyperlinx-cip058-migration" });
  }
  return migrationPool;
}

export async function withTransaction(pool, operation) {
  const client = await pool.connect();
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

export async function closePostgresPools() {
  await Promise.all([
    applicationPool?.end(),
    migrationPool?.end(),
  ].filter(Boolean));
  applicationPool = undefined;
  migrationPool = undefined;
}
