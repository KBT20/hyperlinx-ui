import { createHash } from "node:crypto";
import path from "node:path";
import { getApplicationPool, persistenceMode } from "./client.js";
import { repositoryMetadata, repositoryNameForDirectory } from "../repositoryCatalog.js";

function serialized(record) {
  return JSON.stringify(record, null, 2);
}

function sourcePathFor(directory, id) {
  return `server/data/${repositoryNameForDirectory(directory)}/${encodeURIComponent(String(id))}.json`;
}

export function postgresReadsEnabled() {
  return persistenceMode() === "postgres";
}

export function postgresShadowEnabled() {
  return persistenceMode() === "shadow";
}

export async function mirrorRecord(directory, id, record) {
  const repositoryName = repositoryNameForDirectory(directory);
  const raw = serialized(record);
  const metadata = repositoryMetadata(repositoryName, record, String(id));
  const values = [
    repositoryName,
    String(id),
    sourcePathFor(directory, id),
    metadata.classification,
    metadata.organizationId || null,
    metadata.customerId || null,
    metadata.opportunityId || null,
    metadata.revision || null,
    metadata.parentId || null,
    metadata.status || null,
    metadata.isCurrent,
    metadata.embeddedHash || null,
    createHash("sha256").update(raw).digest("hex"),
    Buffer.byteLength(raw, "utf8"),
    record,
  ];
  await getApplicationPool().query({
    name: "mirror-repository-record-v1",
    text: `
      INSERT INTO hyperlinx.repository_records (
        repository_name, record_id, source_file_path, classification, organization_id,
        customer_id, opportunity_id, revision, parent_id, status, is_current,
        embedded_hash, source_file_hash, byte_size, payload
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15
      )
      ON CONFLICT (repository_name, record_id) DO UPDATE SET
        source_file_path = EXCLUDED.source_file_path,
        classification = EXCLUDED.classification,
        organization_id = EXCLUDED.organization_id,
        customer_id = EXCLUDED.customer_id,
        opportunity_id = EXCLUDED.opportunity_id,
        revision = EXCLUDED.revision,
        parent_id = EXCLUDED.parent_id,
        status = EXCLUDED.status,
        is_current = EXCLUDED.is_current,
        embedded_hash = EXCLUDED.embedded_hash,
        source_file_hash = EXCLUDED.source_file_hash,
        byte_size = EXCLUDED.byte_size,
        payload = EXCLUDED.payload,
        imported_at = clock_timestamp()
    `,
    values,
  });
  return record;
}

export async function mirrorRecordBestEffort(directory, id, record) {
  try {
    return await mirrorRecord(directory, id, record);
  } catch (error) {
    if (process.env.DAL_POSTGRES_SHADOW_STRICT === "1") throw error;
    console.error("[cip058-shadow-write]", error instanceof Error ? error.message : error);
    return record;
  }
}

export async function loadPostgresRecord(directory, id) {
  const result = await getApplicationPool().query({
    name: "load-repository-record-v1",
    text: `SELECT payload FROM hyperlinx.repository_records WHERE repository_name = $1 AND record_id = $2`,
    values: [repositoryNameForDirectory(directory), String(id)],
  });
  if (!result.rowCount) {
    const error = new Error(`PostgreSQL repository record not found: ${path.basename(directory)}/${id}`);
    error.code = "ENOENT";
    throw error;
  }
  return result.rows[0].payload;
}

export async function listPostgresRecords(directory) {
  const result = await getApplicationPool().query({
    name: "list-repository-records-v1",
    text: `SELECT payload FROM hyperlinx.repository_records WHERE repository_name = $1 ORDER BY imported_at DESC`,
    values: [repositoryNameForDirectory(directory)],
  });
  return result.rows.map((row) => row.payload);
}
