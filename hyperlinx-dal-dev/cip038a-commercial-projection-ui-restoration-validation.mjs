import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const root = process.cwd().endsWith("hyperlinx-dal-dev")
  ? process.cwd()
  : path.join(process.cwd(), "hyperlinx-dal-dev");

const baseValidation = path.join(root, "cip037-commercial-projection-surface-validation.mjs");
const geometryValidation = path.join(root, "cip037-single-geometry-authority-validation.mjs");

for (const filePath of [baseValidation, geometryValidation]) {
  if (!existsSync(filePath)) {
    console.error(`FAIL missing required validation dependency: ${path.relative(root, filePath)}`);
    process.exit(1);
  }
}

const source = readFileSync(baseValidation, "utf8");

const coverageChecks = [
  "All Commercial projection layer toggles are present",
  "Projected Objects layer renders independently",
  "Projected Spans layer renders by measured-spine clipping",
  "Station Graph layer renders",
  "Object Address layer renders",
  "Doctrine Diagnostics panel renders in full",
  "Projection Diagnostics panel renders",
  "Hover cards include required object payload",
  "Hover cards include required span payload",
  "Geometry Authority functionality remains visible",
  "Doctrine",
  "Quantity Source",
  "Station",
  "Measure",
  "Lifecycle State",
  "Execution Sequence",
  "Labor Template",
  "Material Template",
  "Evidence Template",
  "Dependencies",
  "Payment Sequence",
  "Close Sequence",
];

const missingCoverage = coverageChecks.filter((term) => !source.includes(term));

for (const term of coverageChecks) {
  console.log(`${missingCoverage.includes(term) ? "FAIL" : "PASS"} CIP-038A validation covers ${term}`);
}

if (missingCoverage.length) {
  console.error(`\n${missingCoverage.length} CIP-038A coverage check(s) failed.`);
  process.exit(1);
}

await import(pathToFileURL(baseValidation).href);

console.log("\nCIP-038A Commercial Projection UI Restoration validation passed.");
