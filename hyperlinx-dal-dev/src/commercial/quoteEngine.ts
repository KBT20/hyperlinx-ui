import { createId, now } from "../api/dalClient";
import type { MarketplaceQuote, OperationalEvent, ScopeVersion } from "../types/dal";

function asNumber(value: unknown, fallback = 0) {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
}

function asArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map((item) => String(item)) : [];
}

function event(type: string, entityId: string, entityType: string, payload: Record<string, unknown>): OperationalEvent {
  return {
    eventId: createId("event"),
    type,
    entityId,
    entityType,
    payload,
    createdAt: now(),
  };
}

export function scopeBuildPath(scopeVersion?: ScopeVersion | null) {
  const truth = scopeVersion?.canonicalTruth as any;
  return (scopeVersion?.buildPath as any) ?? truth?.buildPath;
}

export function scopeConstructability(scopeVersion?: ScopeVersion | null) {
  const truth = scopeVersion?.canonicalTruth as any;
  return truth?.constructabilityAssessment ?? (scopeBuildPath(scopeVersion)?.constructabilityAssessment as any);
}

export function scopeCommercialBasis(scopeVersion?: ScopeVersion | null) {
  const truth = scopeVersion?.canonicalTruth as any;
  const buildPath = scopeBuildPath(scopeVersion);
  const constructability = scopeConstructability(scopeVersion);
  const costBasis = truth?.costBasis ?? {};
  const revenueBasis = truth?.revenueBasis ?? {};
  const crossingInventory = truth?.crossingInventory ?? {};
  const permits = truth?.permitRequirements ?? constructability?.permitting;
  const buildFeet = asNumber(buildPath?.buildFeet ?? buildPath?.distanceFeet ?? truth?.buildFeet);
  const constructionType = String(buildPath?.constructionType ?? truth?.constructionBasis?.constructionType ?? "Mixed");
  const crossings = asNumber(buildPath?.estimatedCrossings ?? crossingInventory?.estimatedCrossings);
  const permitAuthorities = asArray(permits?.authorities);
  return {
    truth,
    buildPath,
    constructability,
    costBasis,
    revenueBasis,
    crossingInventory,
    permits,
    buildFeet,
    buildMiles: asNumber(buildPath?.buildMiles ?? buildFeet / 5280),
    constructionType,
    crossings,
    permitAuthorities,
    routeId: buildPath?.routeId ?? truth?.route?.routeId,
    nodeId: buildPath?.nodeId ?? truth?.node?.nodeId,
    stationId: buildPath?.stationId ?? truth?.station?.stationId,
    attachmentType: truth?.opportunitySeed?.attachmentStrategy?.attachmentType ?? buildPath?.attachmentType,
  };
}

export function generatePreliminaryQuote(scopeVersion: ScopeVersion, termMonths = 36): MarketplaceQuote {
  const basis = scopeCommercialBasis(scopeVersion);
  const riskScore = asNumber(basis.truth?.riskBasis?.compositeRisk ?? basis.buildPath?.riskScore, 45);
  const constructionNrc = Math.round(asNumber(basis.costBasis?.buildCost ?? basis.buildPath?.estimatedCost, 15000 + basis.buildFeet * 22));
  const engineeringNrc = Math.round(asNumber(basis.costBasis?.estimatedEngineeringCost ?? basis.buildPath?.estimatedEngineeringCost, constructionNrc * 0.12));
  const permitNrc = Math.round(asNumber(basis.costBasis?.estimatedPermitCost ?? basis.buildPath?.estimatedPermitCost, Math.max(1, basis.permitAuthorities.length) * 3500));
  const crossingNrc = Math.round(asNumber(basis.costBasis?.estimatedCrossingCost ?? basis.buildPath?.estimatedCrossingCost, basis.crossings * 25000));
  const subtotal = constructionNrc + engineeringNrc + permitNrc + crossingNrc;
  const nrc = Math.round(Math.max(asNumber(basis.revenueBasis?.estimatedNRC), subtotal * (1.08 + riskScore / 500)));
  const monthlyService = Math.round(asNumber(basis.revenueBasis?.estimatedMRC, 850 + basis.buildFeet * 0.65));
  const totalContractValue = nrc + monthlyService * termMonths;
  const deliveryCost = subtotal * 0.78 + monthlyService * termMonths * 0.26;
  const margin = (totalContractValue - deliveryCost) / Math.max(totalContractValue, 1);
  const paybackMonths = subtotal / Math.max(monthlyService * 0.72, 1);
  const roi = totalContractValue / Math.max(subtotal, 1);
  const quote: MarketplaceQuote = {
    quoteId: createId("quote"),
    opportunitySeedId: basis.truth?.opportunitySeedId,
    scopeVersionId: scopeVersion.scopeVersionId,
    inventoryId: scopeVersion.inventoryId,
    graphId: scopeVersion.graphId,
    nrc,
    mrc: monthlyService,
    constructionNrc,
    engineeringNrc,
    permitNrc,
    crossingNrc,
    monthlyService,
    termMonths,
    totalContractValue,
    margin,
    paybackMonths,
    roi,
    constructionType: basis.constructionType,
    riskScore,
    estimatedCost: subtotal,
    routeId: basis.routeId,
    nodeId: basis.nodeId,
    stationId: basis.stationId,
    attachmentType: basis.attachmentType,
    buildFeet: Math.round(basis.buildFeet),
    buildPath: basis.buildPath,
    estimatedPermitCost: permitNrc,
    estimatedCrossingCost: crossingNrc,
    estimatedEngineeringCost: engineeringNrc,
    constructabilityAssessment: basis.constructability,
    quoteExplanation: {
      summary: `Preliminary quote generated from ScopeVersion ${scopeVersion.scopeVersionId}: ${Math.round(basis.buildFeet).toLocaleString()} ft ${basis.constructionType} build to route ${basis.routeId ?? "n/a"}.`,
      buildLengthFeet: Math.round(basis.buildFeet),
      constructionType: basis.constructionType,
      crossings: basis.crossings,
      permits: basis.permitAuthorities,
      engineeringFactors: [
        `${basis.buildPath?.segmentCount ?? "n/a"} path segments`,
        `${basis.buildPath?.turnCount ?? "n/a"} turns`,
        `${Math.round(riskScore)} composite risk`,
      ],
      revenueFactors: [
        `${termMonths} month term`,
        `${monthlyService.toLocaleString()} monthly service`,
        `${nrc.toLocaleString()} upfront NRC`,
      ],
    },
    worksheet: {
      buildLengthFeet: basis.buildFeet,
      buildMiles: basis.buildMiles,
      constructionType: basis.constructionType,
      constructionNrc,
      engineeringNrc,
      permitNrc,
      crossingNrc,
      subtotal,
      nrc,
      monthlyService,
      termMonths,
      totalContractValue,
      margin,
      paybackMonths,
      roi,
      crossings: basis.crossings,
      permitAuthorities: basis.permitAuthorities,
      riskScore,
    },
    notes: `Generated from ScopeVersion geometry, build path, crossing inventory, permit requirements, and commercial basis. ${basis.permitAuthorities.length ? `Permits: ${basis.permitAuthorities.join(", ")}.` : "No permit authorities listed."}`,
    createdAt: now(),
  };
  return quote;
}

export function applyQuoteToScopeVersion(scopeVersion: ScopeVersion, quote: MarketplaceQuote): ScopeVersion {
  const timestamp = now();
  return {
    ...scopeVersion,
    status: "QUOTED",
    updatedAt: timestamp,
    canonicalTruth: {
      ...scopeVersion.canonicalTruth,
      quoteBasis: quote,
      commercial: {
        preliminaryQuote: quote,
        quotedAt: timestamp,
      },
    },
    events: [
      ...scopeVersion.events,
      event("scopeversion.quoted", scopeVersion.scopeVersionId, "ScopeVersion", {
        quoteId: quote.quoteId,
        nrc: quote.nrc,
        mrc: quote.mrc,
        totalContractValue: quote.totalContractValue,
      }),
    ],
  };
}
