import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import JSZip from "jszip";

const root = process.cwd().endsWith("hyperlinx-dal-dev")
  ? process.cwd()
  : path.join(process.cwd(), "hyperlinx-dal-dev");

const paths = {
  registry: path.join(root, "src", "products", "ProductRegistry.ts"),
  doctrine: path.join(root, "src", "products", "pointToPointLongHaulDoctrine.ts"),
  doctrineContracts: path.join(root, "src", "products", "ProductDoctrineContracts.ts"),
  workbookAdapter: path.join(root, "src", "commercial", "CommercialWorkbookEvidenceAdapter.ts"),
  kmzAdapter: path.join(root, "src", "commercial", "CommercialKmzRouteEvidenceAdapter.ts"),
  referenceAssembly: path.join(root, "src", "reference", "helium", "HeliumReferenceAssembly.ts"),
  commercialWorkspace: path.join(root, "src", "components", "workspaces", "GoogleRfpWorkspace.tsx"),
  constitutionalReview: path.join(root, "src", "components", "commercial", "ConstitutionalAssemblyReviewPanel.tsx"),
  instantiation: path.join(root, "src", "products", "DoctrineObjectInstantiationEngine.ts"),
  closure: path.join(root, "src", "kernel", "closure", "ClosureEngine.ts"),
  geometry: path.join(root, "src", "products", "DoctrineProjectionEngine.ts"),
  runtimeCache: path.join(root, "src", "runtime", "ConstitutionalProjectionCache.ts"),
  commercialRevisions: path.join(root, "src", "repositories", "commercialRepositories.ts"),
};

for (const requiredPath of Object.values(paths)) {
  if (!existsSync(requiredPath)) {
    console.error(`FAIL missing required file: ${path.relative(root, requiredPath)}`);
    process.exit(1);
  }
}

const sources = Object.fromEntries(Object.entries(paths).map(([key, filePath]) => [key, readFileSync(filePath, "utf8")]));
const checks = [];
const check = (name, condition, detail = "") => checks.push({ name, condition: Boolean(condition), detail });
const includesAll = (source, terms) => terms.every((term) => source.includes(term));

const sourceDirectory = process.env.CIP040_PRODUCT_SOURCE_DIR
  ?? "C:\\Users\\kbt20\\OneDrive\\Estella\\Business\\Desktop\\Product";
const workbookPath = path.join(sourceDirectory, "HLI_SWR_Investor_Presentation_Workbook.v.4.xlsx");
const kmzPath = path.join(sourceDirectory, "HelSWR_Revised_71526.kmz");

if (!existsSync(workbookPath) || !existsSync(kmzPath)) {
  console.error(`FAIL CIP-040 reference inputs are missing under ${sourceDirectory}. Set CIP040_PRODUCT_SOURCE_DIR to validate another source directory.`);
  process.exit(1);
}

function attr(source, name) {
  return new RegExp(`(?:^|\\s)${name}="([^"]*)"`).exec(source)?.[1] ?? "";
}

async function referenceWorkbookValues(filePath) {
  const zip = await JSZip.loadAsync(readFileSync(filePath));
  const read = async (name) => zip.file(name)?.async("string") ?? "";
  const workbookXml = await read("xl/workbook.xml");
  const relationshipsXml = await read("xl/_rels/workbook.xml.rels");
  const sharedXml = await read("xl/sharedStrings.xml");
  const shared = [...sharedXml.matchAll(/<si>([\s\S]*?)<\/si>/g)].map((item) => [...item[1].matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((text) => text[1]).join(""));
  const relationships = new Map([...relationshipsXml.matchAll(/<Relationship\s+([^>]*)\/?\s*>/g)].map((item) => [attr(item[1], "Id"), attr(item[1], "Target")]));
  const sheets = new Map();
  for (const item of workbookXml.matchAll(/<sheet\s+([^>]*)\/?\s*>/g)) {
    const name = attr(item[1], "name");
    const target = relationships.get(attr(item[1], "r:id"));
    const xml = await read(`xl/${target}`);
    const cells = new Map();
    for (const cell of xml.matchAll(/<c\s+([^>]*)>([\s\S]*?)<\/c>/g)) {
      const reference = attr(cell[1], "r");
      const raw = /<v>([\s\S]*?)<\/v>/.exec(cell[2])?.[1];
      if (raw === undefined) continue;
      const value = attr(cell[1], "t") === "s" ? shared[Number(raw)] : Number.isFinite(Number(raw)) ? Number(raw) : raw;
      cells.set(reference, value);
    }
    sheets.set(name, cells);
  }
  const cell = (sheet, reference) => sheets.get(sheet)?.get(reference);
  return {
    routeMiles: cell("Assumptions", "B4"),
    routeFeet: cell("Assumptions", "B5"),
    conduitFeet: cell("Materials_Labor_Units", "B4"),
    fiberFeet: cell("Materials_Labor_Units", "B5"),
    handholeCount: cell("Materials_Labor_Units", "B7"),
    spliceCaseCount: cell("Materials_Labor_Units", "B8"),
    ILACount: cell("Route_ILA", "B5"),
    NRC: cell("Assumptions", "B8"),
    MRC: cell("Assumptions", "B9"),
    sheetNames: [...sheets.keys()],
  };
}

function geodesicMeters(geometry) {
  const radius = 6_371_008.8;
  let distance = 0;
  for (let index = 1; index < geometry.length; index += 1) {
    const [longitudeA, latitudeA] = geometry[index - 1];
    const [longitudeB, latitudeB] = geometry[index];
    const a = latitudeA * Math.PI / 180;
    const b = latitudeB * Math.PI / 180;
    const latitudeDelta = (latitudeB - latitudeA) * Math.PI / 180;
    const longitudeDelta = (longitudeB - longitudeA) * Math.PI / 180;
    const haversine = Math.sin(latitudeDelta / 2) ** 2 + Math.cos(a) * Math.cos(b) * Math.sin(longitudeDelta / 2) ** 2;
    distance += 2 * radius * Math.asin(Math.sqrt(haversine));
  }
  return distance;
}

async function referenceRouteValues(filePath) {
  const zip = await JSZip.loadAsync(readFileSync(filePath));
  const kmlFile = Object.values(zip.files).find((entry) => entry.name.toLowerCase().endsWith(".kml"));
  const kml = await kmlFile.async("string");
  const geometry = [...kml.matchAll(/<LineString[\s\S]*?<coordinates>([\s\S]*?)<\/coordinates>[\s\S]*?<\/LineString>/gi)]
    .flatMap((item) => item[1].trim().split(/\s+/).map((token) => token.split(",").slice(0, 2).map(Number)));
  const routeMeters = geodesicMeters(geometry);
  return { pointCount: geometry.length, routeMeters, routeFeet: routeMeters * 3.280839895013123, routeMiles: routeMeters / 1609.344 };
}

const workbook = await referenceWorkbookValues(workbookPath);
const route = await referenceRouteValues(kmzPath);
const objectClasses = ["SPINE", "ROUTE_SEGMENT", "CONDUIT", "FIBER", "HANDHOLE", "SPLICE_CASE", "TERMINATION_POINT", "ILA_SITE", "DEMARCATION_POINT"];
const lowerLevelSheets = ["Assumptions", "Materials_Labor_Units", "Route_ILA", "Rates_Authority", "Cost_Rollup", "Validation"];
const hasQuantityMismatch = Math.abs(workbook.routeFeet - route.routeFeet) > route.routeFeet * 0.005;

check("1. Product Registry resolves Point-to-Point Duct & Dark Fiber", includesAll(sources.registry + sources.doctrine + sources.referenceAssembly, ["POINT_TO_POINT_LONG_HAUL_CONDUIT_FIBER", "Point-to-Point Duct & Dark Fiber", "status: \"ACTIVE\"", "PRODUCT_REGISTRY.require"]));
check("2. Commercial Planning obtains product options from Product Registry", includesAll(sources.commercialWorkspace, [
  "PRODUCT_REGISTRY.commercialOptions()",
  "PRODUCT_REGISTRY.resolve(selectedProductOption.productId)",
  "data-product-registry-resolution=\"resolved\"",
]));
check("3. Doctrine resolves without UI hardcoding", includesAll(sources.registry, ["doctrineId: POINT_TO_POINT_LONG_HAUL_DOCTRINE_ID", "doctrine: POINT_TO_POINT_LONG_HAUL_DOCTRINE"]) && !sources.commercialWorkspace.includes("selectedProductOption.productId === POINT_TO_POINT_LONG_HAUL_PRODUCT_ID ?"));
check("4. Workbook evidence normalizes recognized lower-level sheets", lowerLevelSheets.every((sheet) => workbook.sheetNames.includes(sheet)) && workbook.routeMiles === 157.76 && workbook.conduitFeet === 2573942 && workbook.fiberFeet === 895326 && workbook.handholeCount === 334 && workbook.spliceCaseCount === 34, JSON.stringify({ routeMiles: workbook.routeMiles, conduitFeet: workbook.conduitFeet, fiberFeet: workbook.fiberFeet }));
check("5. Every normalized workbook value retains provenance", includesAll(sources.workbookAdapter, ["sourceFile", "worksheet", "sourceLocation", "sourceHash", "sourceAuthority", "authorityMode", "extractedAt", "normalizedField"]) && sources.workbookAdapter.includes("values[normalizedField]"));
check("6. Reference package builds a measured KMZ spine", route.pointCount === 340 && route.routeMiles > 151 && route.routeMiles < 152 && route.routeFeet > 800000 && sources.referenceAssembly.includes("measuredSpine: doctrineAssembly.spine"), JSON.stringify({ pointCount: route.pointCount, routeMiles: route.routeMiles }));
check("7. Required and evidenced conditional objects instantiate", objectClasses.every((objectClass) => sources.referenceAssembly.includes(`objectClass: \"${objectClass}\"`)) && sources.referenceAssembly.includes("count: workbookEvidence.handholeCount"));
check("8. Quantity reconciliation runs without silent overwrite", hasQuantityMismatch && includesAll(sources.referenceAssembly + sources.registry, ["quantityReconciliation", "SOURCE_OVERRIDE_REQUIRES_AUTHORITY", "sourceEvidence", "resolution"]));
check("9. Dependencies are explicit", includesAll(sources.referenceAssembly, ["dependencies: string[]", "object.dependencies.length > 0", "dependencies: productObjects.every"]));
check("10. Object-class legal close sequences exist", objectClasses.every((objectClass) => sources.registry.includes(`objectClass: \"${objectClass}\"`)) && includesAll(sources.referenceAssembly, ["object.closeSequence.length", "closeSequences"]));
check("11. Configurable acceptance evidence exists", includesAll(sources.registry, ["BIDIRECTIONAL_OTDR_1550NM", "END_TO_END_POWER_LOSS", "SYSTEM_ACCEPTANCE_NOTICE", "TERMINATION_TEST_AND_LABEL", "ILA_SITE_COMMISSIONING"]));
check("12. Payment policy preserves NO CLOSE / NO VALIDATION / NO PAYMENT", includesAll(sources.registry + sources.referenceAssembly, ["NO_CLOSE_NO_VALIDATION_NO_PAYMENT", "contractMilestonesRequired: true"]));
check("13. Constitutional PASS is earned, not forced", hasQuantityMismatch && includesAll(sources.referenceAssembly, ["Object.values(gates).every", "quantityReconciliation.every((item) => item.status === \"MATCH\")", "draftIofReadiness: constitutionalAssemblyStatus === \"PASS\" ? \"READY\" : \"BLOCKED\""]));
check("14. Commercial cannot create ScopeVersion", includesAll(sources.registry + sources.referenceAssembly, ["createsScopeVersion: false", "commercialScopeVersionCreationAllowed: false", "noScopeVersionCreation: true"]));
check("15. Engineering certification remains required for Draft IOF", includesAll(sources.registry + sources.referenceAssembly, ["certificationTarget: \"DRAFT_IOF_PACKAGE\"", "engineeringCertificationRequired: true", "engineeringCertificationTarget: \"DRAFT_IOF_PACKAGE\""]));
check("16. Google/Helium data is isolated from generic registry, doctrine, and adapters", !/Google|Helium|Stillwater/i.test(sources.registry + sources.doctrine + sources.workbookAdapter + sources.kmzAdapter) && /Helium|GOOGLE_STILLWATER/i.test(sources.referenceAssembly));
check("17. CIP-038/CIP-039 state and closure authorities remain present", includesAll(sources.closure, ["NO_CLOSE_NO_VALIDATION_NO_PAYMENT", "createConstitutionalClose", "validateConstitutionalAssembly"]) && includesAll(sources.instantiation, ["currentLifecycleState", "closeSequence"]));
check("18. Existing geometry authority remains intact", includesAll(sources.geometry, ["MEASURED_CENTERLINE", "stationAddress", "geometryAuthorityDiagnostics"]));
check("19. Commercial Revision / Release sequencing remains intact", includesAll(sources.commercialWorkspace, ["ensureCommercialLifecycleAuthorityForDraft", "CommercialRevisionRepository", "CommercialReleasePackageRepository"]) && includesAll(sources.commercialRevisions, ["saveCommercialReleasePackage", "saveRevision"]));
check("20. Existing runtime cache behavior remains intact", includesAll(sources.runtimeCache, ["cacheKey", "invalidateConstitutionalArtifact", "records"]));
check("Tenant boundary fields exist on every new project artifact", ["organizationId", "tenantId", "customerId", "opportunityId", "productId", "productVersion", "doctrineId", "doctrineVersion"].every((field) => sources.workbookAdapter.includes(`${field}: string`)) && includesAll(sources.referenceAssembly + sources.kmzAdapter, ["TenantArtifactScope", "...scope", "sourceAuthority", "sourceHash"]));
check("CIP-040 does not authorize execution or downstream stages", sources.referenceAssembly.includes("noExecutionAuthorization: true") && !["/api/marketplace", "/api/control", "/api/field", "createScopeVersion"].some((token) => sources.referenceAssembly.includes(token)));

const failed = checks.filter((item) => !item.condition);
for (const item of checks) console.log(`${item.condition ? "PASS" : "FAIL"} ${item.name}${item.detail ? ` - ${item.detail}` : ""}`);
if (failed.length) {
  console.error(`\n${failed.length} CIP-040 validation check(s) failed.`);
  process.exit(1);
}
console.log("\nCIP-040 Formal Product Registry + Helium Reference validation passed.");
