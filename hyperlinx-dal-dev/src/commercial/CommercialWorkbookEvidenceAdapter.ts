import JSZip from "jszip";

export interface TenantArtifactScope {
  organizationId: string;
  tenantId: string;
  customerId: string;
  opportunityId: string;
  productId: string;
  productVersion: string;
  doctrineId: string;
  doctrineVersion: string;
}

export type EvidenceAuthorityMode =
  | "MEASURED"
  | "HUMAN_APPROVED"
  | "SCREEN_EXTRACTED"
  | "SOURCE_WORKBOOK"
  | "FORMULA_DERIVED"
  | "ALGORITHM"
  | "PENDING_HUMAN"
  | "REFERENCE_ONLY";

export interface WorkbookValueProvenance {
  sourceFile: string;
  worksheet: string;
  sourceLocation: string;
  sourceHash: string;
  sourceAuthority: string;
  authorityMode: EvidenceAuthorityMode;
  extractedAt: string;
  normalizedField: string;
}

export interface NormalizedEvidenceValue<T = unknown> {
  value: T;
  provenance: WorkbookValueProvenance;
}

export interface CommercialWorkbookEvidence extends TenantArtifactScope {
  evidencePackageId: string;
  adapterId: "COMMERCIAL_WORKBOOK_EVIDENCE_ADAPTER";
  adapterVersion: "1.0.0";
  sourceFile: string;
  sourceHash: string;
  sourceAuthority: "PROJECT_EVIDENCE_NOT_CONSTITUTIONAL_AUTHORITY";
  sourceRevision: string;
  extractedAt: string;
  routeMiles?: number;
  routeFeet?: number;
  conduitCount?: number;
  conduitSize?: string;
  conduitFeet?: number;
  fiberCount?: number;
  fiberFeet?: number;
  fiberType?: string;
  handholeCount?: number;
  spliceCaseCount?: number;
  civilMix?: Record<string, { routeMiles: number; routeFeet: number; percentage: number }>;
  constructionMethods?: string[];
  crewProfiles?: Array<Record<string, unknown>>;
  productionRates?: Array<Record<string, unknown>>;
  unitRates?: Array<Record<string, unknown>>;
  rateAuthority?: Array<Record<string, unknown>>;
  ILACount?: number;
  ILAStations?: number[];
  ILAMileposts?: number[];
  ILASpanLengths?: number[];
  opticalLoss?: number[];
  opticalBudget?: number[];
  facilityClass?: string;
  facilityCapital?: number;
  constructionCost?: number;
  NRC?: number;
  MRC?: number;
  schedule?: { days?: number; productionCrews?: number };
  constraints?: { unknownCount?: number; validationExceptions: string[] };
  confidence?: number;
  values: Record<string, NormalizedEvidenceValue>;
  workbookValidation: Array<{ item: string; status: string; difference?: number; outcome?: string }>;
  worksheetPriority: string[];
  warnings: string[];
  noScopeVersionCreation: true;
}

type CellValue = string | number | boolean;
type WorkbookCell = {
  reference: string;
  column: string;
  row: number;
  value: CellValue;
  formula?: string;
};
type WorkbookSheet = { name: string; cells: WorkbookCell[]; rows: Map<number, Map<string, WorkbookCell>> };

const WORKSHEET_PRIORITY = [
  "Assumptions",
  "Materials_Labor_Units",
  "Route_ILA",
  "Rates_Authority",
  "Cost_Rollup",
  "Validation",
  "Executive_Dashboard",
  "Investor_One_Page",
];

function xmlText(value: string) {
  return value
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'");
}

function attribute(source: string, name: string) {
  return new RegExp(`(?:^|\\s)${name}="([^"]*)"`).exec(source)?.[1] ?? "";
}

function normalizeLabel(value: unknown) {
  return String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function numeric(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const parsed = Number(String(value ?? "").replaceAll(",", "").replaceAll("$", "").replaceAll("%", ""));
  return Number.isFinite(parsed) ? parsed : undefined;
}

async function sha256(bytes: Uint8Array) {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const digest = await crypto.subtle.digest("SHA-256", copy.buffer);
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join("");
}

function parseSharedStrings(xml: string) {
  return [...xml.matchAll(/<si>([\s\S]*?)<\/si>/g)].map((item) =>
    [...item[1].matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((text) => xmlText(text[1])).join(""),
  );
}

function cellValue(body: string, type: string, sharedStrings: string[]): CellValue | undefined {
  const raw = /<v>([\s\S]*?)<\/v>/.exec(body)?.[1];
  if (type === "inlineStr") {
    const text = [...body.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((item) => xmlText(item[1])).join("");
    return text || undefined;
  }
  if (raw === undefined) return undefined;
  if (type === "s") return sharedStrings[Number(raw)] ?? "";
  if (type === "b") return raw === "1";
  if (type === "str") return xmlText(raw);
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : xmlText(raw);
}

function parseSheet(name: string, xml: string, sharedStrings: string[]): WorkbookSheet {
  const cells: WorkbookCell[] = [];
  const rows = new Map<number, Map<string, WorkbookCell>>();
  for (const match of xml.matchAll(/<c\s+([^>]*)>([\s\S]*?)<\/c>/g)) {
    const reference = attribute(match[1], "r");
    const address = /^([A-Z]+)(\d+)$/.exec(reference);
    if (!address) continue;
    const value = cellValue(match[2], attribute(match[1], "t"), sharedStrings);
    if (value === undefined) continue;
    const formula = /<f(?:\s[^>]*)?>([\s\S]*?)<\/f>/.exec(match[2])?.[1];
    const cell: WorkbookCell = {
      reference,
      column: address[1],
      row: Number(address[2]),
      value,
      ...(formula ? { formula: xmlText(formula) } : {}),
    };
    cells.push(cell);
    const row = rows.get(cell.row) ?? new Map<string, WorkbookCell>();
    row.set(cell.column, cell);
    rows.set(cell.row, row);
  }
  return { name, cells, rows };
}

async function parseWorkbook(bytes: Uint8Array) {
  const zip = await JSZip.loadAsync(bytes);
  const read = async (path: string) => zip.file(path)?.async("string") ?? "";
  const workbookXml = await read("xl/workbook.xml");
  const relationshipsXml = await read("xl/_rels/workbook.xml.rels");
  const sharedStrings = parseSharedStrings(await read("xl/sharedStrings.xml"));
  const relationships = new Map(
    [...relationshipsXml.matchAll(/<Relationship\s+([^>]*)\/?\s*>/g)].map((match) => [
      attribute(match[1], "Id"),
      attribute(match[1], "Target"),
    ]),
  );
  const sheets = new Map<string, WorkbookSheet>();
  for (const match of workbookXml.matchAll(/<sheet\s+([^>]*)\/?\s*>/g)) {
    const name = xmlText(attribute(match[1], "name"));
    const target = relationships.get(attribute(match[1], "r:id"));
    if (!name || !target) continue;
    const normalizedTarget = target.startsWith("/") ? target.slice(1) : `xl/${target.replace(/^\.\//, "")}`;
    sheets.set(name, parseSheet(name, await read(normalizedTarget), sharedStrings));
  }
  return sheets;
}

function findRow(sheet: WorkbookSheet | undefined, label: string) {
  if (!sheet) return undefined;
  const wanted = normalizeLabel(label);
  return [...sheet.rows.values()].find((row) => [...row.values()].some((cell) => normalizeLabel(cell.value) === wanted));
}

function findCell(sheet: WorkbookSheet | undefined, label: string, valueColumn = "B") {
  return findRow(sheet, label)?.get(valueColumn);
}

function authorityMode(source: unknown, formula?: string): EvidenceAuthorityMode {
  if (formula) return "FORMULA_DERIVED";
  const value = normalizeLabel(source);
  if (value.includes("human approved")) return "HUMAN_APPROVED";
  if (value.includes("pending human")) return "PENDING_HUMAN";
  if (value.includes("algorithm")) return "ALGORITHM";
  if (value.includes("screen")) return "SCREEN_EXTRACTED";
  return "SOURCE_WORKBOOK";
}

export class CommercialWorkbookEvidenceAdapter {
  readonly adapterId = "COMMERCIAL_WORKBOOK_EVIDENCE_ADAPTER" as const;

  async normalize(args: {
    workbook: ArrayBuffer | Uint8Array;
    sourceFile: string;
    sourceRevision?: string;
    scope: TenantArtifactScope;
    extractedAt?: string;
  }): Promise<CommercialWorkbookEvidence> {
    const bytes = args.workbook instanceof Uint8Array ? args.workbook : new Uint8Array(args.workbook);
    const [sourceHash, sheets] = await Promise.all([sha256(bytes), parseWorkbook(bytes)]);
    const extractedAt = args.extractedAt ?? new Date().toISOString();
    const values: Record<string, NormalizedEvidenceValue> = {};
    const warnings: string[] = [];

    const add = (normalizedField: string, sheetName: string, label: string, column = "B", explicitValue?: unknown) => {
      const sheet = sheets.get(sheetName);
      const row = findRow(sheet, label);
      const cell = row?.get(column);
      const value = explicitValue ?? cell?.value;
      if (value === undefined) return undefined;
      const sourceCell = cell ?? [...(row?.values() ?? [])][0];
      const authorityCell = row?.get("E") ?? row?.get("D") ?? row?.get("F");
      values[normalizedField] = {
        value,
        provenance: {
          sourceFile: args.sourceFile,
          worksheet: sheetName,
          sourceLocation: sourceCell?.reference ?? `ROW:${label}`,
          sourceHash,
          sourceAuthority: String(authorityCell?.value ?? "workbook project evidence"),
          authorityMode: authorityMode(authorityCell?.value, sourceCell?.formula),
          extractedAt,
          normalizedField,
        },
      };
      return value;
    };

    const routeMiles = numeric(add("routeMiles", "Assumptions", "Route Miles"));
    const routeFeet = numeric(add("routeFeet", "Assumptions", "Route Feet"));
    const conduitFeet = numeric(add("conduitFeet", "Materials_Labor_Units", "1 1/2 inch conduit material"));
    const conduitLabel = findCell(sheets.get("Materials_Labor_Units"), "1 1/2 inch conduit material", "A")?.value;
    const conduitSize = /([\d\s/]+)\s*inch/i.exec(String(conduitLabel ?? ""))?.[1]?.trim();
    if (conduitSize) add("conduitSize", "Materials_Labor_Units", "1 1/2 inch conduit material", "A", `${conduitSize} inch`);
    const conduitCount = routeFeet && conduitFeet ? Math.round(conduitFeet / routeFeet) : undefined;
    if (conduitCount) add("conduitCount", "Materials_Labor_Units", "1 1/2 inch conduit material", "B", conduitCount);

    const fiberRow = findRow(sheets.get("Materials_Labor_Units"), "864-count shielded fiber material");
    const fiberLabel = String(fiberRow?.get("A")?.value ?? "");
    const fiberCount = numeric(/(\d+)\s*-?count/i.exec(fiberLabel)?.[1]);
    const fiberFeet = numeric(add("fiberFeet", "Materials_Labor_Units", "864-count shielded fiber material"));
    if (fiberCount) add("fiberCount", "Materials_Labor_Units", "864-count shielded fiber material", "A", fiberCount);
    if (fiberLabel) add("fiberType", "Materials_Labor_Units", "864-count shielded fiber material", "A", fiberLabel);
    const handholeCount = numeric(add("handholeCount", "Materials_Labor_Units", "Handhole material"));
    const spliceCaseCount = numeric(add("spliceCaseCount", "Materials_Labor_Units", "Splice case materials (34 Butt Splices @26k' reel length)"));

    const civilMix: Record<string, { routeMiles: number; routeFeet: number; percentage: number }> = {};
    for (const method of ["Plow", "Dirt Bore", "Rock Bore", "Open Trench"]) {
      const row = findRow(sheets.get("Route_ILA"), method);
      if (!row) continue;
      civilMix[method.toUpperCase().replaceAll(" ", "_")] = {
        routeMiles: numeric(row.get("F")?.value) ?? 0,
        routeFeet: numeric(row.get("G")?.value) ?? 0,
        percentage: numeric(row.get("H")?.value) ?? 0,
      };
      add(`civilMix.${method}`, "Route_ILA", method, "H", civilMix[method.toUpperCase().replaceAll(" ", "_")]);
    }

    const productionRows = ["Plowing", "Directional bore - dirt", "Directional bore - rock", "Fiber placement - blowing", "Splicing by fiber terminations", "Project management"];
    const productionRates = productionRows.flatMap((label) => {
      const row = findRow(sheets.get("Materials_Labor_Units"), label);
      if (!row) return [];
      return [{ method: label, quantity: numeric(row.get("B")?.value), unit: row.get("C")?.value, production: numeric(row.get("D")?.value), productionUnit: row.get("E")?.value, crewCount: numeric(row.get("F")?.value), durationDays: numeric(row.get("G")?.value) }];
    });
    const unitRates = [...(sheets.get("Rates_Authority")?.rows.values() ?? [])].flatMap((row) => {
      const label = row.get("A")?.value;
      const rate = numeric(row.get("B")?.value);
      if (!label || rate === undefined || normalizeLabel(label).includes("authority")) return [];
      return [{ label, rate, unit: row.get("C")?.value, confidence: numeric(row.get("D")?.value), authority: row.get("E")?.value, source: row.get("F")?.value }];
    });

    const ILACount = numeric(add("ILACount", "Route_ILA", "ILA stations"));
    const ILAStations = [numeric(add("ILAStations.1", "Route_ILA", "Station 1 milepost")), numeric(add("ILAStations.2", "Route_ILA", "Station 2 milepost"))].filter((value): value is number => value !== undefined);
    const spanRows = ["A to ILA 1", "ILA 1 to ILA 2", "ILA 2 to Z"].map((label) => findRow(sheets.get("Route_ILA"), label));
    const ILASpanLengths = spanRows.map((row) => numeric(row?.get("F")?.value)).filter((value): value is number => value !== undefined);
    const opticalLoss = spanRows.map((row) => numeric(row?.get("G")?.value)).filter((value): value is number => value !== undefined);
    const opticalBudget = spanRows.map((row) => numeric(row?.get("H")?.value)).filter((value): value is number => value !== undefined);
    const facilityClass = String(add("facilityClass", "Route_ILA", "Facility class mix") ?? "") || undefined;
    const facilityCapital = numeric(add("facilityCapital", "Route_ILA", "Facility capital"));
    const constructionCost = numeric(add("constructionCost", "Cost_Rollup", "Total Construction Cost"));
    const NRC = numeric(add("NRC", "Assumptions", "Sell Price / NRC"));
    const MRC = numeric(add("MRC", "Assumptions", "MRC"));
    const scheduleDays = numeric(add("schedule.days", "Assumptions", "Schedule"));
    const productionCrews = numeric(add("schedule.productionCrews", "Assumptions", "Production Crews"));
    const unknownCount = numeric(add("constraints.unknownCount", "Assumptions", "Unknown Constraints"));
    const confidence = numeric(add("confidence", "Assumptions", "Confidence"));

    const workbookValidation = [...(sheets.get("Validation")?.rows.values() ?? [])].flatMap((row) => {
      const item = row.get("A")?.value;
      const status = row.get("E")?.value;
      if (!item || !status || normalizeLabel(item).includes("validation")) return [];
      return [{ item: String(item), status: String(status), difference: numeric(row.get("D")?.value), outcome: String(row.get("F")?.value ?? "") }];
    });
    const validationExceptions = workbookValidation.filter((item) => item.status.toUpperCase() !== "OK").map((item) => `${item.item}: ${item.outcome || item.status}`);
    if (validationExceptions.length) warnings.push(...validationExceptions);
    if (routeFeet && conduitFeet && Math.abs(conduitFeet / routeFeet - Math.round(conduitFeet / routeFeet)) > 0.01) {
      warnings.push("Conduit footage does not equal an exact route-feet multiple; approved quantity authority is required.");
    }

    return {
      ...args.scope,
      evidencePackageId: `${args.scope.opportunityId}:WORKBOOK:${sourceHash.slice(0, 12)}`,
      adapterId: this.adapterId,
      adapterVersion: "1.0.0",
      sourceFile: args.sourceFile,
      sourceHash,
      sourceAuthority: "PROJECT_EVIDENCE_NOT_CONSTITUTIONAL_AUTHORITY",
      sourceRevision: args.sourceRevision ?? sourceHash.slice(0, 12),
      extractedAt,
      routeMiles,
      routeFeet,
      conduitCount,
      conduitSize,
      conduitFeet,
      fiberCount,
      fiberFeet,
      fiberType: fiberLabel || undefined,
      handholeCount,
      spliceCaseCount,
      civilMix,
      constructionMethods: Object.keys(civilMix),
      crewProfiles: productionRates.map(({ method, crewCount, durationDays }) => ({ method, crewCount, durationDays })),
      productionRates,
      unitRates,
      rateAuthority: unitRates.map(({ label, authority, confidence, source }) => ({ label, authority, confidence, source })),
      ILACount,
      ILAStations,
      ILAMileposts: ILAStations,
      ILASpanLengths,
      opticalLoss,
      opticalBudget,
      facilityClass,
      facilityCapital,
      constructionCost,
      NRC,
      MRC,
      schedule: { days: scheduleDays, productionCrews },
      constraints: { unknownCount, validationExceptions },
      confidence,
      values,
      workbookValidation,
      worksheetPriority: WORKSHEET_PRIORITY,
      warnings,
      noScopeVersionCreation: true,
    };
  }
}

export const commercialWorkbookEvidenceAdapter = new CommercialWorkbookEvidenceAdapter();
