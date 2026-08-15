import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { DIRS, persistRecord, stripIofProjectionArtifacts } from "../server/routes/_shared.js";

const packageId = "DRAFT-IOF-PROP-DEMO-OPPORTUNITY-3SWR-v2";
const path = `server/data/iof-packages/${encodeURIComponent(packageId)}.json`;
const existing = JSON.parse(await readFile(path, "utf8"));
const normalized = stripIofProjectionArtifacts(existing, existing.iofArtifactRepositoryReferences);
const { packageHash: _packageHash, updatedAt: _updatedAt, ...identity } = normalized;
normalized.packageHash = createHash("sha256").update(JSON.stringify(identity)).digest("hex");
await persistRecord(DIRS.iofPackages, packageId, normalized);
console.log(JSON.stringify({
  packageId,
  status: normalized.status,
  referenceOnly: normalized.referenceOnly,
  bytes: Buffer.byteLength(JSON.stringify(normalized), "utf8"),
  packageHash: normalized.packageHash,
}, null, 2));
