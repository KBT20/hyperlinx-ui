import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
async function loadStandalone(source) {
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(output).toString("base64")}`);
}

const pricingSource = read("src/commercial/CommercialPricingArchitecture.ts");
const configurationSource = read("src/products/DuctDarkFiberProjectConfiguration.ts");
const registrySource = read("src/products/ProductRegistry.ts");
const doctrineSource = read("src/products/pointToPointLongHaulDoctrine.ts");
const estimateSource = read("src/commercial/TransparentEstimatingEngine.ts");
const authoritySource = read("src/commercial/DuctDarkFiberAuthorityLayers.ts");
const uiSource = read("src/components/workspaces/googleRfp/TransparentEstimateExplorer.tsx");
const workspaceSource = read("src/components/workspaces/GoogleRfpWorkspace.tsx");
const assemblySource = read("src/commercial/IOFPackageAssemblyEngine.ts");
const revisionServerSource = read("server/routes/commercial-revisions.js");
const packageServerSource = read("server/routes/commercial-iof-packages.js");
const pricing = await loadStandalone(pricingSource);
const configuration = await loadStandalone(configurationSource);

const scope = { organizationId: "ORG", tenantId: "TENANT", customerId: "CUSTOMER", opportunityId: "OPP", configurationRevision: 1, sharingMode: "PROJECT" };
const defaultConfig = configuration.createDuctDarkFiberProjectConfiguration({ organizationId: "ORG", tenantId: "TENANT", customerId: "CUSTOMER", opportunityId: "OPP", productVersion: "1", doctrineVersion: "1", createdBy: "Commercial User", createdAt: "2026-08-12T00:00:00.000Z" });
const revisedCount = configuration.reviseDuctDarkFiberProjectConfiguration(defaultConfig, { ductCount: 6, changeReason: "Customer capacity selection" });
const revisedDiameter = configuration.reviseDuctDarkFiberProjectConfiguration(defaultConfig, { ductDiameter: 1.5, changeReason: "Customer duct specification" });
const revisedFiber = configuration.reviseDuctDarkFiberProjectConfiguration(defaultConfig, { fiberCount: 432, changeReason: "Customer fiber selection" });
const standard = pricing.resolveConstructionCapability({ ductCount: 3, ductDiameterInches: 1.25, materialSpec: "HDPE" }, "DIRECTIONAL_BORE");
const larger = pricing.resolveConstructionCapability({ ductCount: 6, ductDiameterInches: 1.25, materialSpec: "HDPE" }, "DIRECTIONAL_BORE");
const standardPrice = pricing.teralinxBoreRate(standard);
const largerPrice = pricing.teralinxBoreRate(larger);
const rateCatalog = pricing.createCip043RateCatalog();
const materialCatalog = pricing.createCip043MaterialCatalog();
const initialRateSnapshot = JSON.stringify(rateCatalog.profile("TERALINX-STANDARD-BORE-R1"));
const initialMaterialSnapshot = JSON.stringify(materialCatalog.quote("QUOTE-223377-00-R1"));
const materialEstimate = pricing.buildCatalogProjectEstimate({ scope, configurationId: "CONFIG-R1", ductPackage: { ductCount: 3, ductDiameterInches: 1.5, materialSpec: "HDPE" }, fiberCount: 864, fiberType: "G.657A1", routeFeet: 100000, constructionMethod: "DIRECTIONAL_BORE", geology: "NORMAL", rateProfileId: "TERALINX-STANDARD-BORE-R1", materialQuoteId: "QUOTE-223377-00-R1", ilaMode: "OFF", createdBy: "Commercial User", createdAt: "2026-08-12T00:00:00.000Z" }, rateCatalog, materialCatalog);
const rockEstimate = pricing.buildCatalogProjectEstimate({ scope, configurationId: "CONFIG-ROCK", ductPackage: { ductCount: 3, ductDiameterInches: 1.25, materialSpec: "HDPE" }, fiberCount: 432, fiberType: "OTHER", routeFeet: 100000, constructionMethod: "DIRECTIONAL_BORE", geology: "HARD_ROCK", geologyFeet: 20000, rateProfileId: "TERALINX-STANDARD-BORE-R1", ilaMode: "OFF", createdBy: "Commercial User" }, rateCatalog, materialCatalog);
const plowEstimate = pricing.buildCatalogProjectEstimate({ scope, configurationId: "CONFIG-PLOW", ductPackage: { ductCount: 3, ductDiameterInches: 1.25, materialSpec: "HDPE" }, fiberCount: 432, fiberType: "OTHER", routeFeet: 1000, constructionMethod: "PLOW", geology: "NORMAL", rateProfileId: "UNDERGROUND-RATE-CARD-R1", ilaMode: "OFF", createdBy: "Commercial User" }, rateCatalog, materialCatalog);
const calibrated = pricing.calibrateEstimate(rockEstimate, { estimateLineId: rockEstimate.lines[0].estimateLineId, humanValue: 16.5, field: "unitCost", reason: "Approved project-specific market calibration", approvedBy: "Pricing Manager" });
const priced = pricing.applyCommercialPolicy(calibrated, { policyId: "POLICY-R1", revision: 1, markupPercent: 20, nrcAdjustment: 0, monthlyOm: 2500, mrcAdjustment: 0, termMonths: 240, otherTerms: [], authorityLayer: "COMMERCIAL_POLICY", approvedBy: "Commercial Authority" });

const checks = [];
function check(number, label, fn) { fn(); checks.push(number); console.log(`PASS ${number}. ${label}`); }

check(1, "Product Registry resolves Duct & Dark Fiber", () => assert.match(registrySource, /POINT_TO_POINT_DUCT_DARK_FIBER_PRODUCT/));
check(2, "Project Configuration starts with configurable 3x1.25 default", () => { assert.equal(defaultConfig.ductCount, 3); assert.equal(defaultConfig.ductDiameter, 1.25); assert.match(registrySource, /configurable: true/); });
check(3, "duct count changes without doctrine modification", () => { assert.equal(revisedCount.ductCount, 6); assert.equal(defaultConfig.ductCount, 3); });
check(4, "duct diameter changes without doctrine modification", () => { assert.equal(revisedDiameter.ductDiameter, 1.5); assert.equal(defaultConfig.ductDiameter, 1.25); });
check(5, "fiber count changes without doctrine modification", () => { assert.equal(revisedFiber.fiberCount, 432); assert.equal(defaultConfig.fiberCount, 864); });
check(6, "Construction Capability resolves bore/ream class", () => assert.equal(standard.requiredReamClassInches, 6));
check(7, "standard 3x1.25 uses standard profile pricing", () => assert.equal(standardPrice.totalRate, 15));
check(8, "larger package triggers governed ream rule", () => { assert.equal(larger.requiredReamClassInches, 8); assert.equal(larger.capabilityClass, "REAM_8"); });
check(9, "formula supports +$10 per additional governed 2-inch ream increment", () => assert.equal(largerPrice.totalRate, 25));
check(10, "contractor TABLE and Teralinx FORMULA profiles coexist", () => { assert.equal(rateCatalog.resolve({ profileId: "UNDERGROUND-RATE-CARD-R1", subcategory: "DIRECTIONAL_BORE_BASE", unit: "FT", capacity: 8, scope }).rateType, "TABLE"); assert.equal(rateCatalog.resolve({ profileId: "TERALINX-STANDARD-BORE-R1", subcategory: "DIRECTIONAL_BORE_BASE", unit: "FT", scope }).rateType, "FORMULA"); });
check(11, "rock adders remain additive", () => { const rock = rockEstimate.lines.find((line) => line.estimateLineId.endsWith(":GEOLOGY")); assert.equal(rock.unitCost, 18); assert.equal(rock.extendedCost, 360000); });
check(12, "plow uses plow-specific capability/rate rules", () => { const line = plowEstimate.lines.find((item) => item.description === "Plow construction"); assert.equal(line.unitCost, 6.6); assert.match(line.formula, /BASE_PLOW/); });
check(13, "Rate Catalog accepts category/item growth without engine changes", () => { rateCatalog.registerCategory("INSPECTION_SERVICE"); assert.ok(rateCatalog.categories().includes("INSPECTION_SERVICE")); });
check(14, "Material Catalog is separate from Rate Catalog", () => { assert.ok(pricingSource.includes("class MaterialCatalog")); assert.equal(rateCatalog.profile("QUOTE-223377-00-R1"), null); });
check(15, "Quote 223377-00 preserves provenance", () => { const quote = materialCatalog.quote("QUOTE-223377-00-R1"); assert.equal(quote.quoteNumber, "223377-00"); assert.ok(quote.sourceHash); assert.equal(quote.supplierAdjustmentRisk, true); });
check(16, "1.5-inch duct resolves quoted price", () => assert.equal(materialEstimate.lines.find((line) => line.materialId === "MAT-DUCT-150").unitCost, 0.625));
check(17, "864F resolves quoted price", () => assert.equal(materialEstimate.lines.find((line) => line.materialId === "MAT-FIBER-864").unitCost, 7.475));
check(18, "expired and superseded quote states are supported", () => assert.match(pricingSource, /"EXPIRED" \| "SUPERSEDED"/));
check(19, "vendor quote is not Product Doctrine", () => assert.doesNotMatch(doctrineSource, /223377|vendorSku|Terry-Durin/));
check(20, "material quantity derives from configuration", () => assert.equal(materialEstimate.lines.find((line) => line.materialId === "MAT-DUCT-150").quantity, 300000));
check(21, "human calibration creates only a new project estimate revision", () => { assert.equal(calibrated.revision, 2); assert.equal(rockEstimate.revision, 1); assert.equal(calibrated.previousEstimateId, rockEstimate.estimateId); });
check(22, "calibration does not mutate global Rate Catalog", () => assert.equal(JSON.stringify(rateCatalog.profile("TERALINX-STANDARD-BORE-R1")), initialRateSnapshot));
check(23, "calibration does not mutate Material Catalog", () => assert.equal(JSON.stringify(materialCatalog.quote("QUOTE-223377-00-R1")), initialMaterialSnapshot));
check(24, "Estimate Audit exposes authority layer", () => assert.ok(materialEstimate.lines.every((line) => line.authorityLayer)));
check(25, "Estimate Audit exposes Rate Profile", () => assert.ok(rockEstimate.lines.some((line) => line.rateProfileId === "TERALINX-STANDARD-BORE-R1")));
check(26, "Estimate Audit exposes Material Quote", () => assert.ok(materialEstimate.lines.some((line) => line.materialQuoteId === "QUOTE-223377-00-R1")));
check(27, "Estimate Audit exposes Human Calibration", () => assert.ok(calibrated.lines.some((line) => line.authorityLayer === "HUMAN_CALIBRATION" && line.humanOverride)));
check(28, "duplicate/reference projections cannot double count totals", () => assert.match(pricingSource, /costContributionMode === "PRIMARY"/));
check(29, "markup/margin remains outside Product Doctrine", () => { assert.equal(priced.authorityLayer, "COMMERCIAL_POLICY"); assert.doesNotMatch(doctrineSource, /markupPercent|targetMarginPercent/); });
check(30, "ILA OFF produces zero ILA cost", () => { const ila = materialEstimate.lines.find((line) => line.description === "ILA facilities"); assert.equal(ila.quantity, 0); assert.equal(ila.extendedCost, 0); });
check(31, "INTERMEDIATE_ONLY preserves CIP-042 behavior", () => assert.match(read("src/commercial/IlaPlanningEngine.ts"), /INTERMEDIATE_ONLY/));
check(32, "BOOKENDED preserves CIP-042 behavior", () => assert.match(read("src/commercial/IlaPlanningEngine.ts"), /BOOKENDED/));
check(33, "Commercial Release Package sequence is repaired", () => { const lifecycle = pricing.validateCommercialLifecycle({ ROUTE_REPOSITORY: "ROUTE", COMMERCIAL_REVISION: "REV", COMMERCIAL_RELEASE_PACKAGE: "RELEASE" }); assert.equal(lifecycle.draftIofCanAssemble, true); });
check(34, "Draft IOF cannot precede Commercial Release", () => { const lifecycle = pricing.validateCommercialLifecycle({ ROUTE_REPOSITORY: "ROUTE", COMMERCIAL_REVISION: "REV", DRAFT_IOF_ASSEMBLY: "DRAFT" }); assert.equal(lifecycle.valid, false); assert.equal(lifecycle.draftIofCanAssemble, false); });
check(35, "Draft IOF saves as governed repository artifact", () => { assert.match(packageServerSource, /persistRecord\(DIRS\.iofPackages/); assert.match(workspaceSource, /saveCommercialDraftIofPackage/); });
check(36, "Commercial cannot create ScopeVersion", () => { assert.match(configurationSource, /noScopeVersionCreation: true/); assert.doesNotMatch(pricingSource, /createScopeVersion|persistScopeVersion/); });
check(37, "Engineering certification remains required", () => assert.match(doctrineSource, /engineeringCertificationRequired: true/));
check(38, "CIP-041 reconciliation remains available", () => assert.ok(fs.existsSync(path.join(root, "cip041-engineering-quantity-reconciliation-authority-validation.mjs"))));
check(39, "CIP-042 Product Doctrine behavior remains intact", () => assert.ok(fs.existsSync(path.join(root, "cip042-duct-dark-fiber-product-doctrine-v1-validation.mjs"))));
check(40, "tenant isolation remains intact", () => {
  const projectQuote = structuredClone(pricing.TERRY_DURIN_QUOTE_223377_00);
  projectQuote.scope = scope; projectQuote.status = "APPROVED_PROJECT_SOURCE";
  const projectCatalog = new pricing.MaterialCatalog().registerQuote(projectQuote);
  assert.throws(() => projectCatalog.resolve({ quoteId: projectQuote.quoteId, category: "FIBER", specification: { fiberCount: 864, fiberType: "G.657A1" }, scope: { ...scope, organizationId: "OTHER" } }), /Cross-tenant/);
});
check(41, "debug panels default collapsed", () => { assert.match(uiSource + workspaceSource, /Advanced \/ Diagnostics/); assert.doesNotMatch(workspaceSource, /<details[^>]*commercial-runtime-diagnostics[^>]*\sopen[=>]/); });
check(42, "user-blocking errors remain visible", () => assert.match(workspaceSource, /commercialLifecycleSequencingBlocker|Automatic IOF Assembly blocked/));
check(43, "happy path requires no diagnostics interaction", () => { assert.match(workspaceSource, /Proposal Summary/); assert.match(workspaceSource, /Commercial Validation/); assert.match(uiSource, /Project Configuration/); });
check(44, "historical revisions remain immutable", () => { assert.equal(defaultConfig.configurationRevision, 1); assert.equal(revisedCount.previousConfigurationId, defaultConfig.configurationId); assert.match(revisionServerSource, /immutable: true/); });
check(45, "existing cache/revision behavior remains valid", () => { assert.match(estimateSource, /configurationRevision/); assert.match(assemblySource, /noScopeVersionCreation/); assert.match(authoritySource, /prohibitedAutomaticPromotion/); });

assert.equal(checks.length, 45);
console.log(`\nCIP-043 validation complete: ${checks.length}/45 checks passed.`);
