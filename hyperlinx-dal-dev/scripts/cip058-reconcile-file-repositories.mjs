import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { getMigrationPool, closePostgresPools } from "../server/persistence/postgres/client.js";

function argsFor(argv) {
  const result = {};
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (!value.startsWith("--")) continue;
    result[value.slice(2)] = argv[index + 1];
    index += 1;
  }
  return result;
}

async function loadEnvironment(filename) {
  const content = await readFile(filename, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const separator = line.indexOf("=");
    if (separator <= 0 || line.trimStart().startsWith("#")) continue;
    const key = line.slice(0, separator).trim();
    if (process.env[key] === undefined) process.env[key] = line.slice(separator + 1).trim();
  }
}

async function filesUnder(root) {
  const result = [];
  async function walk(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) await walk(absolute);
      else if (entry.isFile() && entry.name.endsWith(".json")) result.push(absolute);
    }
  }
  await walk(root);
  return result.sort();
}

async function main() {
  const args = argsFor(process.argv.slice(2));
  if (args["env-file"]) await loadEnvironment(args["env-file"]);
  const dataRoot = path.resolve(args["data-root"] ?? path.join(process.cwd(), "server", "data"));
  const files = await filesUnder(dataRoot);
  const expected = new Map();
  for (const filename of files) {
    const relative = path.relative(dataRoot, filename).split(path.sep).join("/");
    const raw = await readFile(filename);
    expected.set(relative, {
      byteSize: raw.length,
      fileHash: createHash("sha256").update(raw).digest("hex"),
    });
  }
  const pool = getMigrationPool();
  try {
    const database = await pool.query(`
      SELECT source_file_path, byte_size, source_file_hash
      FROM hyperlinx.repository_records
      ORDER BY source_file_path
    `);
    const actual = new Map(database.rows.map((row) => [row.source_file_path, {
      byteSize: Number(row.byte_size),
      fileHash: row.source_file_hash,
    }]));
    const missing = [];
    const unexpected = [];
    const mismatched = [];
    for (const [relative, source] of expected) {
      const migrated = actual.get(relative);
      if (!migrated) missing.push(relative);
      else if (source.byteSize !== migrated.byteSize || source.fileHash !== migrated.fileHash) {
        mismatched.push({ relative, source, migrated });
      }
    }
    for (const relative of actual.keys()) if (!expected.has(relative)) unexpected.push(relative);
    const repositoryCounts = await pool.query(`
      SELECT repository_name, count(*)::bigint AS record_count,
             count(DISTINCT source_file_hash)::bigint AS distinct_hash_count
      FROM hyperlinx.repository_records
      GROUP BY repository_name ORDER BY repository_name
    `);
    const result = {
      status: missing.length || unexpected.length || mismatched.length ? "FAIL" : "PASS",
      sourceFileCount: expected.size,
      databaseRecordCount: actual.size,
      missing,
      unexpected,
      mismatched,
      repositoryCounts: repositoryCounts.rows,
    };
    console.log(JSON.stringify(result, null, 2));
    if (result.status !== "PASS") process.exitCode = 1;
  } finally {
    await closePostgresPools();
  }
}

await main();
