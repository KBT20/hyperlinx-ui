import { createHash } from "node:crypto";
import JSZip from "jszip";
import { DIRS, corsHeaders, errorResponse, handleOptions, jsonResponse, listRecords, loadRecord, persistRecord, readRequestJson } from "./_shared.js";
import { requireRuntimeUser } from "./authority.js";

const BASE = "/api/marketplace/fulfillment";
const arr = (v) => Array.isArray(v) ? v : [];
const rec = (v) => v && typeof v === "object" && !Array.isArray(v) ? v : {};
const num = (v, fallback = 0) => Number.isFinite(Number(v)) ? Number(v) : fallback;
const txt = (v, fallback = "") => String(v ?? "").trim() || fallback;
const xml = (v) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const sha = (v) => createHash("sha256").update(typeof v === "string" ? v : stable(v)).digest("hex");
const fixedDate = new Date("1980-01-01T00:00:00.000Z");

function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}

function authorized(user) {
  return arr(user?.permissions).some((permission) => permission === "platform.admin" || permission === "proposal.manage");
}

function scopeAllowed(scope, user) {
  return authorized(user) && (!scope.organizationId || scope.organizationId === user.organizationId);
}

function routeInfo(scope) {
  const truth = rec(scope.canonicalTruth);
  const doctrine = rec(rec(rec(truth.productDoctrine).productDoctrineAssembly).authoritativeRoute);
  const authority = rec(scope.geometryAuthority);
  const reference = rec(scope.certifiedRouteReference);
  const geometry = arr(truth.routeGeometry).length > 1 ? truth.routeGeometry : arr(doctrine.geometry);
  return {
    routeRepositoryId: txt(authority.routeRepositoryId ?? doctrine.routeRepositoryId ?? truth.objects?.[0]?.routeRepositoryId ?? doctrine.routeId ?? reference.certifiedRouteId),
    routeRevision: txt(authority.routeRevision ?? doctrine.routeRevision, "1"),
    routeGeometryId: txt(authority.geometryId ?? truth.measuredCenterlineId ?? scope.measuredCenterlineId),
    geometryHash: txt(authority.geometryHash ?? reference.geometryHash ?? doctrine.geometryHash ?? doctrine.routeHash ?? truth.objects?.[0]?.geometryHash),
    routeFeet: num(scope.routeLengthFeet ?? doctrine.routeFeet ?? reference.routeFeet),
    routeMiles: num(scope.routeMiles ?? doctrine.routeMiles ?? reference.routeMiles),
    geometry,
  };
}

function projectDemand(scope) {
  const truth = rec(scope.canonicalTruth);
  const assembly = rec(rec(truth.productDoctrine).productDoctrineAssembly);
  const route = routeInfo(scope);
  const stations = arr(truth.stations);
  const objects = arr(truth.objects);
  const counts = Object.fromEntries([...new Set(objects.map((o) => txt(o.objectType, "OTHER")))].map((type) => [type, objects.filter((o) => txt(o.objectType) === type).length]));
  const conduit = rec(assembly.conduitAssembly);
  const fiber = rec(assembly.fiberAssembly);
  const segments = arr(assembly.routeSegments).map((segment) => ({
    segmentId: txt(segment.segmentId ?? segment.objectId),
    startStationId: txt(segment.startStationId), endStationId: txt(segment.endStationId),
    startMeasureFeet: num(segment.startMeasureFeet ?? segment.startMeasure), endMeasureFeet: num(segment.endMeasureFeet ?? segment.endMeasure),
  })).filter((segment) => segment.segmentId);
  const first = stations[0], last = stations.at(-1);
  const materialLines = [
    { demandLineId: "MAT-CONDUIT", category: "CONDUIT", description: `${num(rec(assembly.projectConfiguration).ductCount, 3)} x ${num(rec(assembly.projectConfiguration).ductDiameter, 1.25)} inch HDPE conduit`, quantity: num(conduit.conduitFeet), unit: "FT", sourceReferenceId: txt(conduit.assemblyId) },
    { demandLineId: "MAT-FIBER", category: "FIBER", description: `${num(rec(assembly.projectConfiguration).fiberCount, 864)} count fiber`, quantity: num(fiber.fiberFeet), unit: "FT", sourceReferenceId: txt(fiber.assemblyId) },
    { demandLineId: "MAT-HANDHOLE", category: "HANDHOLE", description: "Handholes", quantity: num(counts.HANDHOLE), unit: "EA", sourceReferenceIds: objects.filter((o) => o.objectType === "HANDHOLE").map((o) => o.objectId) },
    { demandLineId: "MAT-VAULT", category: "VAULT", description: "Vaults", quantity: num(counts.VAULT), unit: "EA", sourceReferenceIds: objects.filter((o) => o.objectType === "VAULT").map((o) => o.objectId) },
    { demandLineId: "MAT-SPLICE", category: "SPLICE_CASE", description: "Splice cases", quantity: num(counts.SPLICE_CASE), unit: "EA", sourceReferenceIds: objects.filter((o) => o.objectType === "SPLICE_CASE").map((o) => o.objectId) },
  ].filter((line) => line.quantity > 0);
  const projected = {
    demandProjectionId: `DEMAND-${scope.scopeVersionId}`,
    scopeVersionId: scope.scopeVersionId,
    scopeVersionHash: sha(scope),
    certifiedIofPackageId: scope.certifiedIofPackageId,
    serviceOrderId: scope.serviceOrderId,
    customerId: scope.customerId,
    opportunityId: scope.opportunityId,
    productId: scope.productId,
    engineeringPackageId: truth.engineeringTruthAuthority?.engineeringPackageId ?? scope.technicalSourcePackageId,
    engineeringRevisionId: truth.engineeringTruthAuthority?.engineeringRevisionId,
    engineeringRevisionHash: truth.engineeringTruthAuthority?.engineeringRevisionHash,
    authorizedAt: scope.createdAt,
    authorizedBy: scope.createdBy,
    route: { ...route, geometry: undefined },
    stationSummary: { count: stations.length, firstStationId: first?.stationId, lastStationId: last?.stationId, firstMeasureFeet: num(first?.stationValue ?? first?.measureFeet), lastMeasureFeet: num(last?.stationValue ?? last?.measureFeet) },
    segmentCount: segments.length,
    objectCount: objects.length,
    objectCounts: counts,
    materialLines,
    capacityRequirements: [
      { requirementId: "CAP-HDD", workType: "HDD", requiredCrews: 8, requiredEquipment: 8, unit: "RIGS", basis: "3SWR_MARKET_SCHEDULE_REQUIREMENT" },
      { requirementId: "CAP-PLOW", workType: "PLOW", requiredCrews: 4, requiredEquipment: 4, unit: "PLOWS", basis: "3SWR_MARKET_SCHEDULE_REQUIREMENT" },
      { requirementId: "CAP-SPECIAL", workType: "SPECIAL_CROSSING", requiredCrews: 3, requiredEquipment: 0, unit: "CREWS", basis: "3SWR_MARKET_SCHEDULE_REQUIREMENT" },
    ],
    conditions: arr(truth.constraints),
    stationIds: stations.map((s) => s.stationId), segmentIds: segments.map((s) => s.segmentId), objectIds: objects.map((o) => o.objectId),
    projectionAuthority: "REFERENCE_ONLY_SCOPEVERSION_DEMAND_PROJECTION",
  };
  return Object.freeze(projected);
}

function packageFixtures(scope, demand, now) {
  const stationRange = [{ startStationId: demand.stationSummary.firstStationId, endStationId: demand.stationSummary.lastStationId }];
  return [
    { marketplacePackageId: "MP-3SWR-CONSTRUCTION", packageId: "MP-3SWR-CONSTRUCTION", scopeVersionId: scope.scopeVersionId, customerId: scope.customerId, opportunityId: scope.opportunityId, packageType: "CONSTRUCTION", title: "3SWR Civil Construction Capacity", packageName: "3SWR Civil Construction Capacity", description: "HDD, plow, restoration and specialty capacity", stationRanges: stationRange, stationIds: [], segmentIds: demand.segmentIds, objectIds: demand.objectIds, quantityReferences: [{ demandLineId: "ROUTE", quantity: demand.route.routeFeet, unit: "FT" }], materialReferences: [], conditionIds: demand.conditions.map((c) => c.conditionId).filter(Boolean), requiredStartDate: "2026-09-15", requiredCompletionDate: "2026-11-30", status: "RESPONSES_RECEIVED", items: [], disciplines: ["CIVIL"], categories: ["CIVIL", "LABOR"], matchedVendorIds: ["VENDOR-A", "VENDOR-B", "VENDOR-C", "VENDOR-D"], diagnostics: [], createdAt: now, updatedAt: now, createdBy: "CIP-052-DEMO", authority: "MARKETPLACE_PACKAGE_REFERENCE" },
    { marketplacePackageId: "MP-3SWR-MATERIALS", packageId: "MP-3SWR-MATERIALS", scopeVersionId: scope.scopeVersionId, customerId: scope.customerId, opportunityId: scope.opportunityId, packageType: "MATERIAL", title: "3SWR Material Supply", packageName: "3SWR Material Supply", description: "Authorized conduit, fiber and structure material demand", stationRanges: stationRange, stationIds: [], segmentIds: demand.segmentIds, objectIds: demand.objectIds, quantityReferences: [], materialReferences: demand.materialLines, conditionIds: [], requiredStartDate: "2026-09-01", requiredCompletionDate: "2026-10-15", status: "RESPONSES_RECEIVED", items: [], disciplines: ["MATERIAL"], categories: ["MATERIAL"], matchedVendorIds: ["SUPPLIER-A", "SUPPLIER-B", "SUPPLIER-ALTERNATE"], diagnostics: [], createdAt: now, updatedAt: now, createdBy: "CIP-052-DEMO", authority: "MARKETPLACE_PACKAGE_REFERENCE" },
  ];
}

function responseFixtures(scope, demand, now) {
  const base = { scopeVersionId: scope.scopeVersionId, scopeVersionHash: demand.scopeVersionHash, status: "SUBMITTED", submittedBy: "DEMO_VENDOR_AUTHORIZED_REP", submittedAt: now, geography: ["3SWR"], qualifications: [], attachments: [] };
  const cap = (id, workType, crews, equipment, rate, from, through, constraints = []) => ({ commitmentId: id, workType, crewCount: crews, equipmentCount: equipment, productionRate: rate, productionUnit: "FT_DAY", earliestMobilizationDate: from, mobilizationLeadTimeDays: 12, availableFrom: from, availableThrough: through, estimatedDurationDays: 60, workingDaysPerWeek: 6, workingHoursPerDay: 10, maximumQuantity: rate * 60, maximumQuantityUnit: "FT", geographicPreferences: ["ANY_3SWR_SEGMENT"], constraintCapabilities: constraints, exclusions: [], assumptions: [] });
  const rows = [
    { ...base, responseSeriesId: "VR-3SWR-VENDOR-A", vendorResponseId: "VR-3SWR-VENDOR-A-V1", vendorResponseVersion: 1, vendorId: "VENDOR-A", providerType: "CONSTRUCTION_VENDOR", marketplacePackageId: "MP-3SWR-CONSTRUCTION", responseType: "CAPACITY_OFFER", pricingLines: [{ lineId: "HDD", quantity: 118400, unit: "FT", unitRate: 7.8, extendedAmount: 923520 }, { lineId: "PLOW", quantity: 62000, unit: "FT", unitRate: 2.9, extendedAmount: 179800 }], vendorAddedLines: [{ vendorLineId: "V-001", originalDescription: "HDD mobilization", quantity: 1, unit: "LS", unitRate: 18000, extendedAmount: 18000, vendorExplanation: "Required to mobilize two rigs.", teralinxClassification: "MOBILIZATION" }], capacityCommitments: [cap("A-HDD-V1", "HDD", 2, 2, 2200, "2026-09-15", "2026-11-30"), cap("A-PLOW-V1", "PLOW", 1, 1, 4200, "2026-09-15", "2026-11-30")], materialResponses: [], exceptions: [{ vendorExceptionId: "EX-A-1", vendorStatement: "Special crossings are excluded.", classification: "EXCLUSION", status: "NOTED" }] },
    { ...base, responseSeriesId: "VR-3SWR-VENDOR-A", vendorResponseId: "VR-3SWR-VENDOR-A-V2", vendorResponseVersion: 2, parentVendorResponseVersion: "VR-3SWR-VENDOR-A-V1", vendorId: "VENDOR-A", providerType: "CONSTRUCTION_VENDOR", marketplacePackageId: "MP-3SWR-CONSTRUCTION", responseType: "CAPACITY_OFFER", pricingLines: [{ lineId: "HDD", quantity: 118400, unit: "FT", unitRate: 7.55, extendedAmount: 893920 }, { lineId: "PLOW", quantity: 62000, unit: "FT", unitRate: 2.8, extendedAmount: 173600 }], vendorAddedLines: [{ vendorLineId: "V-001", originalDescription: "HDD mobilization", quantity: 1, unit: "LS", unitRate: 18000, extendedAmount: 18000, vendorExplanation: "Required to mobilize two rigs.", teralinxClassification: "MOBILIZATION" }], capacityCommitments: [cap("A-HDD-V2", "HDD", 2, 2, 2400, "2026-09-15", "2026-11-30"), cap("A-PLOW-V2", "PLOW", 1, 1, 4500, "2026-09-15", "2026-11-30")], materialResponses: [], exceptions: [{ vendorExceptionId: "EX-A-1", vendorStatement: "Special crossings are excluded.", classification: "EXCLUSION", status: "NOTED" }] },
    { ...base, responseSeriesId: "VR-3SWR-VENDOR-B", vendorResponseId: "VR-3SWR-VENDOR-B-V1", vendorResponseVersion: 1, vendorId: "VENDOR-B", providerType: "SPECIALTY_CONTRACTOR", marketplacePackageId: "MP-3SWR-CONSTRUCTION", responseType: "PARTIAL_SCOPE", pricingLines: [{ lineId: "HDD", quantity: 220000, unit: "FT", unitRate: 8.35, extendedAmount: 1837000 }], vendorAddedLines: [], capacityCommitments: [cap("B-HDD", "HDD", 5, 5, 6000, "2026-09-08", "2026-11-30", ["RIVER_CROSSING", "SPECIAL_BORE"]), cap("B-SPECIAL", "SPECIAL_CROSSING", 2, 0, 1, "2026-09-08", "2026-11-30", ["RIVER_CROSSING", "RAIL_CROSSING"])], materialResponses: [], exceptions: [] },
    { ...base, responseSeriesId: "VR-3SWR-VENDOR-C", vendorResponseId: "VR-3SWR-VENDOR-C-V1", vendorResponseVersion: 1, vendorId: "VENDOR-C", providerType: "CONSTRUCTION_VENDOR", marketplacePackageId: "MP-3SWR-CONSTRUCTION", responseType: "PARTIAL_SCOPE", pricingLines: [{ lineId: "HDD", quantity: 90000, unit: "FT", unitRate: 6.95, extendedAmount: 625500 }], vendorAddedLines: [], capacityCommitments: [cap("C-HDD", "HDD", 1, 1, 1000, "2026-10-15", "2027-01-18"), cap("C-PLOW", "PLOW", 3, 3, 7000, "2026-09-15", "2026-11-30")], materialResponses: [], exceptions: [{ vendorExceptionId: "EX-C-1", vendorStatement: "Completion date cannot be met for HDD portion.", classification: "SCOPE_EXCEPTION", status: "COMMERCIAL_REVIEW" }] },
    { ...base, responseSeriesId: "VR-3SWR-VENDOR-D", vendorResponseId: "VR-3SWR-VENDOR-D-V1", vendorResponseVersion: 1, vendorId: "VENDOR-D", providerType: "COMBINED_PROVIDER", marketplacePackageId: "MP-3SWR-CONSTRUCTION", responseType: "FULL_SCOPE", pricingLines: [{ lineId: "FULL-CIVIL", quantity: demand.route.routeFeet, unit: "FT", unitRate: 9.1, extendedAmount: demand.route.routeFeet * 9.1 }], vendorAddedLines: [], capacityCommitments: [cap("D-HDD", "HDD", 8, 8, 9600, "2026-09-15", "2026-11-30", ["RIVER_CROSSING", "RAIL_CROSSING", "SPECIAL_BORE"]), cap("D-PLOW", "PLOW", 4, 4, 12000, "2026-09-15", "2026-11-30")], materialResponses: [], exceptions: [] },
    { ...base, responseSeriesId: "VR-3SWR-VENDOR-E", vendorResponseId: "VR-3SWR-VENDOR-E-V1", vendorResponseVersion: 1, vendorId: "VENDOR-E", providerType: "CONSTRUCTION_VENDOR", marketplacePackageId: "MP-3SWR-CONSTRUCTION", responseType: "NO_BID", pricingLines: [], vendorAddedLines: [], capacityCommitments: [], materialResponses: [], exceptions: [{ vendorExceptionId: "EX-E-1", vendorStatement: "No capacity available in the required window.", classification: "NO_BID", status: "NOTED" }] },
  ];
  const conduit = demand.materialLines.find((line) => line.category === "CONDUIT");
  rows.push(
    { ...base, responseSeriesId: "VR-3SWR-SUPPLIER-A", vendorResponseId: "VR-3SWR-SUPPLIER-A-V1", vendorResponseVersion: 1, vendorId: "SUPPLIER-A", providerType: "DISTRIBUTOR", marketplacePackageId: "MP-3SWR-MATERIALS", responseType: "MATERIAL_OFFER", pricingLines: [], vendorAddedLines: [], capacityCommitments: [], materialResponses: [{ materialResponseId: "MR-A-CONDUIT", demandLineId: conduit.demandLineId, responseStatus: "PARTIAL", manufacturer: "Demo HDPE", manufacturerPartNumber: "HDPE-125", requestedQuantity: conduit.quantity, offeredQuantity: 800000, unit: "FT", unitPrice: .67, extendedPrice: 536000, quantityAvailableNow: 250000, productionCapacity: 250000, productionCapacityUnit: "FT_WEEK", leadTimeDays: 21, fabricationTimeDays: 10, shippingTimeDays: 4, deliveryCapacity: 250000, deliveryCapacityUnit: "FT_WEEK", earliestShipDate: "2026-09-01", earliestDeliveryDate: "2026-09-05", deliveryLocation: "3SWR staging", freightIncluded: true, freightAmount: 0, minimumOrderQuantity: 100000, priceValidThrough: "2026-09-30", specificationCompliance: "COMPLIANT", qualifications: [], exclusions: [] }], exceptions: [] },
    { ...base, responseSeriesId: "VR-3SWR-SUPPLIER-B", vendorResponseId: "VR-3SWR-SUPPLIER-B-V1", vendorResponseVersion: 1, vendorId: "SUPPLIER-B", providerType: "MANUFACTURER", marketplacePackageId: "MP-3SWR-MATERIALS", responseType: "MATERIAL_OFFER", pricingLines: [], vendorAddedLines: [], capacityCommitments: [], materialResponses: [{ materialResponseId: "MR-B-CONDUIT", demandLineId: conduit.demandLineId, responseStatus: "PARTIAL", manufacturer: "Demo Manufacturing", manufacturerPartNumber: "125-HDPE", requestedQuantity: conduit.quantity, offeredQuantity: Math.max(0, conduit.quantity - 800000), unit: "FT", unitPrice: .64, extendedPrice: Math.max(0, conduit.quantity - 800000) * .64, quantityAvailableNow: 0, productionCapacity: 300000, productionCapacityUnit: "FT_WEEK", leadTimeDays: 35, fabricationTimeDays: 28, shippingTimeDays: 7, deliveryCapacity: 300000, deliveryCapacityUnit: "FT_WEEK", earliestShipDate: "2026-09-20", earliestDeliveryDate: "2026-09-27", deliveryLocation: "3SWR staging", freightIncluded: false, freightAmount: 48000, minimumOrderQuantity: 500000, priceValidThrough: "2026-10-15", specificationCompliance: "COMPLIANT", qualifications: [], exclusions: [] }], exceptions: [] },
    { ...base, responseSeriesId: "VR-3SWR-SUPPLIER-ALT", vendorResponseId: "VR-3SWR-SUPPLIER-ALT-V1", vendorResponseVersion: 1, vendorId: "SUPPLIER-ALTERNATE", providerType: "MATERIAL_SUPPLIER", marketplacePackageId: "MP-3SWR-MATERIALS", responseType: "MATERIAL_OFFER", pricingLines: [], vendorAddedLines: [], capacityCommitments: [], materialResponses: [{ materialResponseId: "MR-ALT-CONDUIT", demandLineId: conduit.demandLineId, responseStatus: "ALTERNATE", manufacturer: "Alternate Demo", manufacturerPartNumber: "ALT-125", requestedQuantity: conduit.quantity, offeredQuantity: conduit.quantity, unit: "FT", unitPrice: .59, extendedPrice: conduit.quantity * .59, quantityAvailableNow: conduit.quantity, productionCapacity: conduit.quantity, productionCapacityUnit: "FT_MONTH", leadTimeDays: 14, fabricationTimeDays: 7, shippingTimeDays: 7, deliveryCapacity: conduit.quantity, deliveryCapacityUnit: "FT_MONTH", earliestShipDate: "2026-09-01", earliestDeliveryDate: "2026-09-08", deliveryLocation: "3SWR staging", freightIncluded: true, freightAmount: 0, minimumOrderQuantity: 500000, priceValidThrough: "2026-09-30", specificationCompliance: "EXCEPTION", alternateMaterial: { proposedProductOrSku: "ALT-125", reason: "Specified product has longer lead time.", specificationDifferences: ["Requires Engineering and Product Doctrine review"], reviewState: "PENDING_ENGINEERING_REVIEW" }, qualifications: ["Alternate acceptance required"], exclusions: [] }], exceptions: [{ vendorExceptionId: "EX-ALT-1", vendorStatement: "Alternate material requires technical acceptance.", classification: "ALTERNATE", status: "ENGINEERING_REVIEW_REQUIRED" }] },
  );
  return rows.map((response) => finalizeResponse({ ...response, contentHash: sha({ ...response, contentHash: undefined }) }));
}

function finalizeResponse(response) {
  const missing = [];
  if (response.responseType !== "NO_BID" && !arr(response.pricingLines).length && !arr(response.materialResponses).some((item) => num(item.unitPrice) > 0)) missing.push("PRICE");
  if (["FULL_SCOPE", "PARTIAL_SCOPE", "CAPACITY_OFFER"].includes(response.responseType) && !arr(response.capacityCommitments).length) missing.push("CAPACITY");
  if (response.responseType === "MATERIAL_OFFER" && !arr(response.materialResponses).length) missing.push("QUANTITY");
  const scheduleEvidence = arr(response.capacityCommitments).some((item) => item.availableFrom && item.availableThrough && item.mobilizationLeadTimeDays !== undefined) || arr(response.materialResponses).some((item) => item.leadTimeDays !== undefined && item.deliveryLocation);
  if (response.responseType !== "NO_BID" && !scheduleEvidence && !arr(response.exceptions).length) missing.push("AVAILABILITY_LEAD_TIME_DURATION_GEOGRAPHY");
  const pricingTotal = arr(response.pricingLines).reduce((sum, line) => sum + num(line.extendedAmount), 0) + arr(response.vendorAddedLines).reduce((sum, line) => sum + num(line.extendedAmount), 0) + arr(response.materialResponses).reduce((sum, line) => sum + num(line.extendedPrice), 0);
  return { ...response, responseId: response.vendorResponseId, bidPackageId: response.marketplacePackageId, totalCost: pricingTotal, lineItems: arr(response.lineItems), confidence: response.confidence ?? "MEDIUM", receivedAt: response.submittedAt, assumptions: arr(response.assumptions), risks: arr(response.risks), missingDimensions: missing, completenessStatus: missing.length ? "INCOMPLETE" : "COMPLETE" };
}

function latestResponses(responses) {
  const bySeries = new Map();
  for (const response of responses) if (!bySeries.has(response.responseSeriesId) || num(bySeries.get(response.responseSeriesId).vendorResponseVersion) < num(response.vendorResponseVersion)) bySeries.set(response.responseSeriesId, response);
  return [...bySeries.values()].filter((response) => response.status === "SUBMITTED");
}

function latestAllocations(allocations) {
  const bySeries = new Map();
  for (const allocation of allocations) if (!bySeries.has(allocation.allocationSeriesId) || num(bySeries.get(allocation.allocationSeriesId).allocationRevision) < num(allocation.allocationRevision)) bySeries.set(allocation.allocationSeriesId, allocation);
  return [...bySeries.values()].filter((allocation) => allocation.status !== "REJECTED");
}

function coverage(demand, responses, allocations) {
  const latest = latestResponses(responses);
  const currentAllocations = latestAllocations(allocations);
  const allocatedIds = new Set(currentAllocations.flatMap((a) => a.capacityAllocations ?? [] ).map((a) => a.commitmentId));
  const capacity = demand.capacityRequirements.map((requirement) => {
    const offers = latest.flatMap((r) => r.capacityCommitments).filter((c) => c.workType === requirement.workType);
    const offered = offers.reduce((sum, c) => sum + num(c.equipmentCount || c.crewCount), 0);
    const allocated = offers.filter((c) => allocatedIds.has(c.commitmentId)).reduce((sum, c) => sum + num(c.equipmentCount || c.crewCount), 0);
    const required = requirement.requiredEquipment || requirement.requiredCrews;
    return { ...requirement, offered, allocated, remaining: Math.max(0, required - allocated), offeredCoveragePercent: Math.min(100, 100 * offered / Math.max(1, required)), allocatedCoveragePercent: Math.min(100, 100 * allocated / Math.max(1, required)) };
  });
  const material = demand.materialLines.map((line) => {
    const offers = latest.flatMap((r) => r.materialResponses).filter((m) => m.demandLineId === line.demandLineId && m.specificationCompliance === "COMPLIANT");
    const offered = offers.reduce((sum, m) => sum + num(m.offeredQuantity), 0);
    const allocated = currentAllocations.flatMap((a) => a.materialAllocations ?? []).filter((a) => a.demandLineId === line.demandLineId).reduce((sum, a) => sum + num(a.quantity), 0);
    return { ...line, offered, allocated, remaining: Math.max(0, line.quantity - allocated), offeredCoveragePercent: Math.min(100, 100 * offered / line.quantity), allocatedCoveragePercent: Math.min(100, 100 * allocated / line.quantity) };
  });
  const scheduleConflicts = latest.filter((r) => r.exceptions.some((e) => e.classification === "SCOPE_EXCEPTION")).map((r) => r.vendorId);
  return { capacity, material, scheduleState: scheduleConflicts.length ? "AT_RISK" : "PASS", scheduleConflicts, calculatedBy: "DETERMINISTIC_MARKETPLACE_COVERAGE_ENGINE" };
}

function createObservations(response) {
  const common = { vendorId: response.vendorId, vendorResponseId: response.vendorResponseId, vendorResponseVersion: response.vendorResponseVersion, scopeVersionId: response.scopeVersionId, marketplacePackageId: response.marketplacePackageId, evidenceStrength: "QUOTED", observedAt: response.submittedAt };
  return [
    ...response.pricingLines.map((line) => ({ ...common, observationId: `PRICE-${response.vendorResponseId}-${line.lineId}`, observationType: "PRICING", ...line })),
    ...response.vendorAddedLines.map((line) => ({ ...common, observationId: `PRICE-${response.vendorResponseId}-${line.vendorLineId}`, observationType: "PRICING", originalDescription: line.originalDescription, normalizedClassification: line.teralinxClassification, quantity: line.quantity, unit: line.unit, unitRate: line.unitRate, extendedAmount: line.extendedAmount })),
    ...response.capacityCommitments.map((line) => ({ ...common, observationId: `CAPACITY-${response.vendorResponseId}-${line.commitmentId}`, observationType: "CAPACITY", ...line })),
    ...response.materialResponses.map((line) => ({ ...common, observationId: `MATERIAL-${response.vendorResponseId}-${line.materialResponseId}`, observationType: "MATERIAL", ...line })),
  ];
}

async function bootstrap(scope, user) {
  const demand = projectDemand(scope); const now = new Date().toISOString();
  const packages = packageFixtures(scope, demand, now); const responses = responseFixtures(scope, demand, now);
  for (const pkg of packages) await persistRecord(DIRS.marketplacePackages, pkg.marketplacePackageId, pkg);
  for (const response of responses) {
    const existing = await loadRecord(DIRS.marketplaceResponses, response.vendorResponseId).catch(() => null);
    if (!existing) await persistRecord(DIRS.marketplaceResponses, response.vendorResponseId, response);
    for (const observation of createObservations(response)) if (!await loadRecord(DIRS.marketplaceObservations, observation.observationId).catch(() => null)) await persistRecord(DIRS.marketplaceObservations, observation.observationId, observation);
  }
  return state(scope);
}

async function state(scope) {
  const demand = projectDemand(scope);
  const route = routeInfo(scope);
  const assembly = rec(rec(rec(scope.canonicalTruth).productDoctrine).productDoctrineAssembly);
  const all = await Promise.all([listRecords(DIRS.marketplacePackages), listRecords(DIRS.marketplaceResponses), listRecords(DIRS.marketplaceAllocations), listRecords(DIRS.marketplaceAwards), listRecords(DIRS.marketplaceObservations)]);
  const inScope = (r) => r.scopeVersionId === scope.scopeVersionId;
  const [packages, rawResponses, allocations, awards, observations] = all.map((records) => records.filter(inScope));
  const responses = rawResponses.map(finalizeResponse);
  const stationReferences = demand.stationIds.filter((id, index) => index === 0 || index === demand.stationIds.length - 1 || index % 100 === 0);
  const publicDemand = { ...demand, stationIds: undefined, segmentIds: undefined, objectIds: undefined, stationReferences };
  return { demand: publicDemand, packages, responses, latestResponses: latestResponses(responses), allocations, awards, observations, coverage: coverage(demand, responses, allocations), sourceAuthorityHash: demand.scopeVersionHash,
    sharedOpportunityMapProjection: { authority: "COMMERCIAL_ROUTE_REPOSITORY", projectionPurpose: "SHARED_OPPORTUNITY_MAP", opportunityId: scope.opportunityId, routeRepositoryId: route.routeRepositoryId, routeRevision: num(route.routeRevision, 1), routeGeometryId: route.routeGeometryId, geometryHash: route.geometryHash, routeMiles: route.routeMiles, routeFeet: route.routeFeet, orientation: "A_TO_Z", coordinates: route.geometry, endpoints: [{ role: "A", label: txt(assembly.aSite?.label, "A Endpoint"), coordinate: arr(assembly.aSite?.coordinate) }, { role: "Z", label: txt(assembly.zSite?.label, "Z Endpoint"), coordinate: arr(assembly.zSite?.coordinate) }], responseProjectionOnly: true } };
}

function validateAllocation(input, demand, responses, existing) {
  const response = responses.find((r) => r.vendorResponseId === input.vendorResponseId && num(r.vendorResponseVersion) === num(input.vendorResponseVersion));
  if (!response) return "Allocation must reference an exact submitted Vendor Response Version.";
  if (arr(input.stationRanges).some((range) => !demand.stationIds.includes(range.startStationId) || !demand.stationIds.includes(range.endStationId))) return "Allocation station identities must exist in ScopeVersion.";
  if (arr(input.segmentIds).some((id) => !demand.segmentIds.includes(id))) return "Allocation segment identities must exist in ScopeVersion.";
  if (arr(input.objectIds).some((id) => !demand.objectIds.includes(id))) return "Allocation object identities must exist in ScopeVersion.";
  const stationIndex = new Map(demand.stationIds.map((id, index) => [id, index]));
  for (const range of arr(input.stationRanges)) {
    const a0 = stationIndex.get(range.startStationId), a1 = stationIndex.get(range.endStationId);
    const lo = Math.min(a0, a1), hi = Math.max(a0, a1);
    for (const prior of existing.filter((item) => item.status !== "REJECTED")) for (const previous of arr(prior.stationRanges)) {
      const b0 = stationIndex.get(previous.startStationId), b1 = stationIndex.get(previous.endStationId);
      if (Math.max(lo, Math.min(b0, b1)) <= Math.min(hi, Math.max(b0, b1))) return "Duplicate or overlapping station allocation detected.";
    }
  }
  if (arr(input.segmentIds).some((id) => existing.some((item) => arr(item.segmentIds).includes(id)))) return "Overlapping segment responsibility detected.";
  if (arr(input.objectIds).some((id) => existing.some((item) => arr(item.objectIds).includes(id)))) return "Object double assignment detected.";
  for (const capacity of arr(input.capacityAllocations)) {
    const offer = response.capacityCommitments.find((item) => item.commitmentId === capacity.commitmentId);
    if (!offer || num(capacity.resourceCount) > num(offer.equipmentCount || offer.crewCount)) return "Capacity allocation exceeds or does not match the selected response version.";
    if (existing.some((item) => arr(item.capacityAllocations).some((prior) => prior.commitmentId === capacity.commitmentId))) return "Capacity commitment is already allocated.";
  }
  for (const material of arr(input.materialAllocations)) {
    const offer = response.materialResponses.find((m) => m.materialResponseId === material.materialResponseId);
    if (!offer || num(material.quantity) > num(offer.offeredQuantity)) return "Material allocation exceeds or does not match the selected response version.";
    const already = existing.flatMap((a) => a.materialAllocations ?? []).filter((a) => a.demandLineId === material.demandLineId).reduce((sum, a) => sum + num(a.quantity), 0);
    const required = demand.materialLines.find((d) => d.demandLineId === material.demandLineId)?.quantity ?? 0;
    if (already + num(material.quantity) > required) return "Material over-allocation detected.";
  }
  return "";
}

function simplePdf(title, lines) {
  const safe = (v) => String(v).replace(/[^\x20-\x7E]/g, " ").replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
  const content = ["BT", "/F1 18 Tf", `48 748 Td (${safe(title)}) Tj`, "/F1 9 Tf", ...lines.slice(0, 48).flatMap((line) => ["0 -14 Td", `(${safe(line)}) Tj`]), "ET"].join("\n");
  const objects = ["<< /Type /Catalog /Pages 2 0 R >>", "<< /Type /Pages /Kids [3 0 R] /Count 1 >>", "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>", "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>", `<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`];
  let out = "%PDF-1.4\n"; const offsets = [0]; objects.forEach((o, i) => { offsets.push(Buffer.byteLength(out)); out += `${i + 1} 0 obj\n${o}\nendobj\n`; }); const xref = Buffer.byteLength(out); out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map((o) => `${String(o).padStart(10,"0")} 00000 n `).join("\n")}\ntrailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`; return Buffer.from(out);
}

async function packageArtifact(scope, pkg, kind) {
  const demand = projectDemand(scope); const route = routeInfo(scope);
  if (kind === "pdf") return { body: simplePdf(`Teralinx Bid Package - ${pkg.title}`, [`ScopeVersion: ${scope.scopeVersionId}`, `Certified IOF: ${scope.certifiedIofPackageId}`, `Service Order: ${scope.serviceOrderId}`, `Package: ${pkg.marketplacePackageId}`, `Route: ${route.routeRepositoryId}`, `Geometry Hash: ${route.geometryHash}`, `Route: ${route.routeMiles.toFixed(2)} miles`, `Required: ${pkg.requiredStartDate} through ${pkg.requiredCompletionDate}`, ...pkg.quantityReferences.map((q) => `${q.demandLineId}: ${q.quantity} ${q.unit}`), ...pkg.materialReferences.map((m) => `${m.description}: ${m.quantity} ${m.unit}`)]), type: "application/pdf", ext: "pdf" };
  const coordinates = route.geometry.map((c) => `${num(c[0])},${num(c[1])},0`).join(" ");
  const kml = `<?xml version="1.0" encoding="UTF-8"?><kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>${xml(pkg.title)}</name><ExtendedData><Data name="scopeVersionId"><value>${xml(scope.scopeVersionId)}</value></Data><Data name="marketplacePackageId"><value>${xml(pkg.marketplacePackageId)}</value></Data><Data name="geometryHash"><value>${xml(route.geometryHash)}</value></Data></ExtendedData><Folder><name>Authorized Route</name><Placemark><name>3SWR</name><LineString><tessellate>1</tessellate><coordinates>${coordinates}</coordinates></LineString></Placemark></Folder><Folder><name>Requirements</name>${pkg.materialReferences.map((m) => `<Placemark><name>${xml(m.description)} - ${m.quantity} ${m.unit}</name></Placemark>`).join("")}</Folder></Document></kml>`;
  const zip = new JSZip(); zip.file("doc.kml", kml, { date: fixedDate }); return { body: await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE", compressionOptions: { level: 9 }, platform: "DOS" }), type: "application/vnd.google-earth.kmz", ext: "kmz" };
}

export async function handleMarketplaceFulfillment(req, res, pathname) {
  if (!pathname.startsWith(BASE)) return false;
  if (handleOptions(req, res)) return true;
  const user = requireRuntimeUser(req, res); if (!user) return true;
  try {
    const parts = pathname.slice(BASE.length).split("/").filter(Boolean).map(decodeURIComponent);
    const scopeId = parts[0]; if (!scopeId) return errorResponse(res, 400, "ScopeVersion is required."), true;
    const scope = await loadRecord(DIRS.scopeVersions, scopeId).catch(() => null);
    if (!scope || !scopeAllowed(scope, user)) return errorResponse(res, 404, "Authorized ScopeVersion not found."), true;
    if (!scope.isImmutable || !scope.serviceOrderId || !scope.certifiedIofPackageId) return errorResponse(res, 409, "Marketplace requires an immutable authorized ScopeVersion with Service Order and Certified IOF lineage."), true;
    if (req.method === "GET" && parts[1] === "packages" && parts[2] && ["pdf","kmz"].includes(parts[3])) {
      const pkg = await loadRecord(DIRS.marketplacePackages, parts[2]).catch(() => null); if (!pkg || pkg.scopeVersionId !== scopeId) return errorResponse(res, 404, "Marketplace Package not found."), true;
      const artifact = await packageArtifact(scope, pkg, parts[3]); const filename = `Teralinx_3SWR_${pkg.packageType}_Bid_Package.${artifact.ext}`;
      res.writeHead(200, { ...corsHeaders(), "Content-Type": artifact.type, "Content-Disposition": `attachment; filename="${filename}"`, "Content-Length": artifact.body.length, "X-Teralinx-Export-Hash": sha(artifact.body), "X-Teralinx-Authority-Hash": sha(scope), "X-Teralinx-Geometry-Hash": routeInfo(scope).geometryHash }); res.end(artifact.body); return true;
    }
    if (req.method === "GET" && parts.length === 1) return jsonResponse(res, 200, await state(scope)), true;
    if (req.method === "POST" && parts[1] === "bootstrap") return jsonResponse(res, 201, await bootstrap(scope, user)), true;
    if (req.method === "POST" && parts[1] === "responses") {
      const input = rec(await readRequestJson(req)); const records = (await listRecords(DIRS.marketplaceResponses)).filter((r) => r.scopeVersionId === scopeId && r.responseSeriesId === input.responseSeriesId);
      const version = records.length ? Math.max(...records.map((r) => num(r.vendorResponseVersion))) + 1 : 1; const id = `${txt(input.responseSeriesId)}-V${version}`;
      if (!input.responseSeriesId || !["FULL_SCOPE","PARTIAL_SCOPE","CAPACITY_OFFER","MATERIAL_OFFER","NO_BID"].includes(input.responseType)) return errorResponse(res, 400, "Valid response series and type are required."), true;
      let response = { ...input, vendorResponseId: id, vendorResponseVersion: version, parentVendorResponseVersion: records.sort((a,b) => b.vendorResponseVersion-a.vendorResponseVersion)[0]?.vendorResponseId, scopeVersionId: scopeId, scopeVersionHash: sha(scope), status: "SUBMITTED", submittedAt: new Date().toISOString(), submittedBy: user.userId, contentHash: "" }; response = finalizeResponse(response); response.contentHash = sha({ ...response, contentHash: undefined });
      await persistRecord(DIRS.marketplaceResponses, id, response); for (const observation of createObservations(response)) await persistRecord(DIRS.marketplaceObservations, observation.observationId, observation); return jsonResponse(res, 201, response), true;
    }
    if (req.method === "POST" && parts[1] === "allocations") {
      const input = rec(await readRequestJson(req)); const current = await state(scope); const authoritativeDemand = projectDemand(scope); const series = current.allocations.filter((a) => a.allocationSeriesId === input.allocationSeriesId).sort((a,b) => b.allocationRevision-a.allocationRevision); if (series.length && input.supersedesAllocationId !== series[0].allocationId) return errorResponse(res, 409, "Allocation revision must explicitly supersede the latest immutable allocation revision."), true; const comparison = input.supersedesAllocationId ? current.allocations.filter((a) => a.allocationId !== input.supersedesAllocationId) : current.allocations; const message = validateAllocation(input, authoritativeDemand, current.responses, comparison); if (message) return errorResponse(res, 409, message), true;
      const revision = series.length + 1; const id = `${input.allocationSeriesId}-R${revision}`; const allocation = { ...input, allocationId: id, allocationRevision: revision, parentAllocationId: series[0]?.allocationId, scopeVersionId: scopeId, scopeVersionHash: sha(scope), status: "APPROVED_FOR_AWARD", decidedBy: user.userId, decidedAt: new Date().toISOString(), contentHash: "" }; allocation.contentHash = sha({ ...allocation, contentHash: undefined }); await persistRecord(DIRS.marketplaceAllocations, id, allocation); return jsonResponse(res, 201, allocation), true;
    }
    if (req.method === "POST" && parts[1] === "awards") {
      const input = rec(await readRequestJson(req)); const current = await state(scope); const allocation = current.allocations.find((a) => a.allocationId === input.allocationId); if (!allocation) return errorResponse(res, 409, "Award requires an exact approved allocation."), true;
      const response = current.responses.find((r) => r.vendorResponseId === allocation.vendorResponseId && r.vendorResponseVersion === allocation.vendorResponseVersion); if (!response) return errorResponse(res, 409, "Award requires the allocation's exact Vendor Response Version."), true;
      const awardId = txt(input.awardId, `AWARD-${allocation.allocationId}`); if (await loadRecord(DIRS.marketplaceAwards, awardId).catch(() => null)) return errorResponse(res, 409, "Submitted Award is immutable; create a new governed Award identity."), true; const award = { awardId, scopeVersionId: scopeId, marketplacePackageId: response.marketplacePackageId, vendorId: response.vendorId, vendorResponseId: response.vendorResponseId, vendorResponseVersion: response.vendorResponseVersion, vendorResponseContentHash: response.contentHash, allocationId: allocation.allocationId, allocationContentHash: allocation.contentHash, awardedAmount: num(input.awardedAmount ?? allocation.allocatedValue), acceptedVendorAddedLineIds: arr(response.vendorAddedLines).map((line) => line.vendorLineId), acceptedQualificationIds: arr(response.qualifications).map((item, index) => item.qualificationId ?? `QUAL-${index + 1}`), acceptedAlternateIds: arr(response.materialResponses).filter((item) => item.responseStatus === "ALTERNATE" && item.alternateMaterial?.reviewState === "ACCEPTED").map((item) => item.materialResponseId), acceptedExclusionIds: arr(response.exceptions).filter((item) => item.classification === "EXCLUSION").map((item) => item.vendorExceptionId), acceptedCapacityCommitmentIds: arr(allocation.capacityAllocations).map((item) => item.commitmentId), acceptedMaterialCommitmentIds: arr(allocation.materialAllocations).map((item) => item.materialResponseId), scheduleCommitment: { plannedStart: allocation.plannedStart, requiredComplete: allocation.requiredComplete }, awardedAt: new Date().toISOString(), awardedBy: user.userId, status: "AWARDED", evidenceStrength: "AWARDED", createsControlWork: false, createsFieldWork: false, contentHash: "" }; award.contentHash = sha({ ...award, contentHash: undefined }); await persistRecord(DIRS.marketplaceAwards, awardId, award); return jsonResponse(res, 201, award), true;
    }
    return errorResponse(res, 404, "Marketplace fulfillment route not found."), true;
  } catch (error) { return errorResponse(res, error.status ?? 500, error.message ?? String(error)), true; }
}
