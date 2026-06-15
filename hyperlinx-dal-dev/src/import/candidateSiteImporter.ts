import { createId, now } from "../api/dalClient";
import { classifyCandidateSites } from "../classification/facilityClassifier";
import type { CandidateSite } from "../types/candidateSite";

function parseCsvLine(line: string) {
  const cells: string[] = [];
  let current = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];
    if (char === '"' && quoted && next === '"') {
      current += '"';
      i += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      cells.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  cells.push(current.trim());
  return cells;
}

function normalizeHeader(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, "_");
}

function get(row: Record<string, string>, keys: string[]) {
  return keys.map((key) => row[key]).find((value) => value?.trim())?.trim() ?? "";
}

export function importCandidateSitesFromCsv(csvText: string): CandidateSite[] {
  const lines = csvText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (!lines.length) return [];
  const headers = parseCsvLine(lines[0]).map(normalizeHeader);
  const rows = lines.slice(1).map((line) => {
    const cells = parseCsvLine(line);
    return headers.reduce<Record<string, string>>((row, header, index) => {
      row[header] = cells[index] ?? "";
      return row;
    }, {});
  });

  const imported = rows
    .map((row) => {
      const companyName = get(row, ["company_name", "company", "name", "site_name"]);
      const address = get(row, ["location_address", "address", "street_address"]);
      const city = get(row, ["location_city", "city"]);
      const state = get(row, ["location_state", "state"]) || "TX";
      const zipCode = get(row, ["location_zip_code__5", "zip", "zipcode", "zip_code"]);
      if (!companyName && !address && !city) return null;
      return {
        candidateId: createId("candidate-site"),
        companyName: companyName || "Unnamed Candidate",
        address,
        city,
        state,
        zipCode,
        county: get(row, ["county", "location_county"]) || undefined,
        status: "IMPORTED",
        createdAt: now(),
      } satisfies CandidateSite;
    })
    .filter(Boolean) as CandidateSite[];

  return classifyCandidateSites(imported);
}

