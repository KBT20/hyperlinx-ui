import { createId, now } from "../api/dalClient";
import { deriveRouteCertificationState } from "../certification/CertificationAuthority";
import { DEFAULT_CONSTRUCTION_TYPE } from "../engineering/constructionModel";
import { getAuthoritativeLifecycleState, transitionScopeVersionLifecycle } from "../scopeversion/ScopeVersionLifecycleGuard";
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
  return truth?.geographicBasis?.buildPath ?? (scopeVersion?.buildPath as any) ?? truth?.buildPath;
}

export function scopeConstructability(scopeVersion?: ScopeVersion | null) {
  const truth = scopeVersion?.canonicalTruth as any;
  return truth?.constructabilityAssessment ?? truth?.engineeringBasis?.constructabilityAssessment ?? (scopeBuildPath(scopeVersion)?.constructabilityAssessment as any);
}

export function scopeCommercialBasis(scopeVersion?: ScopeVersion | null) {
  const truth = scopeVersion?.canonicalTruth as any;
  const networkBasis = truth?.networkBasis ?? {};
  const engineeringBasis = truth?.engineeringBasis ?? {};
  const financialBasis = truth?.financialBasis ?? {};
  const riskBasis = truth?.riskBasis ?? {};
  const buildPath = scopeBuildPath(scopeVersion);
  const constructability = scopeConstructability(scopeVersion);
  const costBasis = truth?.costBasis ?? {};
  const revenueBasis = truth?.revenueBasis ?? {};
  const crossingInventory = truth?.crossingInventory ?? {};
  const constraintEvidencePackage = engineeringBasis?.constraintEvidencePackage ?? truth?.constraintEvidencePackage ?? truth?.routeCertification?.constraintEvidencePackage;
  const routeCertification = engineeringBasis?.routeCertification ?? truth?.routeCertification;
  const routeGeometryHash = routeCertification?.certifiedGeometryHash ?? engineeringBasis?.certifiedGeometryHash ?? truth?.certifiedGeometryHash ?? constraintEvidencePackage?.routeGeometryHash ?? "";
  const certificationAuthority = engineeringBasis?.certificationAuthority ?? truth?.certificationAuthority ?? routeCertification?.certificationAuthority;
  const constraintSummary = constraintEvidencePackage?.summary ?? engineeringBasis?.constraintSummary ?? {};
  const permits = engineeringBasis?.permits ?? truth?.permitRequirements ?? constructability?.permitting;
  const buildFeet = asNumber(engineeringBasis?.buildFeet ?? buildPath?.buildFeet ?? buildPath?.distanceFeet ?? truth?.buildFeet);
  const constructionType = String(engineeringBasis?.constructionType ?? buildPath?.constructionType ?? truth?.constructionBasis?.constructionType ?? DEFAULT_CONSTRUCTION_TYPE);
  const engineeringCrossings =
    asNumber(constraintSummary?.roadCrossings ?? engineeringBasis?.roadCrossings) +
    asNumber(constraintSummary?.railroadCrossings ?? engineeringBasis?.railCrossings) +
    asNumber(constraintSummary?.waterCrossings ?? engineeringBasis?.waterCrossings);
  const crossings = asNumber(crossingInventory?.estimatedCrossings ?? (engineeringCrossings || undefined) ?? buildPath?.estimatedCrossings);
  const permitAuthorities = asArray(engineeringBasis?.permitAuthorities?.length ? engineeringBasis.permitAuthorities : permits?.authorities);
  return {
    truth,
    networkBasis,
    engineeringBasis,
    financialBasis,
    riskBasis,
    buildPath,
    constructability,
    costBasis,
    revenueBasis,
    crossingInventory,
    constraintEvidencePackage,
    routeCertification,
    routeGeometryHash,
    certificationAuthority,
    constraintSummary,
    permits,
    buildFeet,
    buildMiles: asNumber(buildPath?.buildMiles ?? buildFeet / 5280),
    constructionType,
    crossings,
    permitAuthorities,
    routeId: networkBasis?.routeId ?? buildPath?.routeId ?? truth?.route?.routeId,
    nodeId: networkBasis?.nodeId ?? buildPath?.nodeId ?? truth?.node?.nodeId,
    stationId: networkBasis?.stationId ?? buildPath?.stationId ?? truth?.station?.stationId,
    attachmentType: networkBasis?.attachmentStrategy ?? buildPath?.attachmentType,
  };
}

export function generatePreliminaryQuote(scopeVersion: ScopeVersion, termMonths = 36): MarketplaceQuote {
  const basis = scopeCommercialBasis(scopeVersion);
  const certificationAuthority =
    basis.certificationAuthority ??
    deriveRouteCertificationState({
      routeGeometryHash: basis.routeGeometryHash,
      constraintEvidencePackage: basis.constraintEvidencePackage,
      engineerApproval: {
        approved: basis.routeCertification?.status === "CERTIFIED_ROUTE" || basis.routeCertification?.status === "PROVISIONALLY_CERTIFIED",
        rejected: basis.routeCertification?.status === "REJECTED_ROUTE",
        notes: basis.routeCertification?.certificationNotes ?? basis.engineeringBasis?.engineerNotes,
        certifiedBy: basis.routeCertification?.engineerName,
        certifiedAt: basis.routeCertification?.certifiedAt,
      },
    });
  const quoteStatus =
    certificationAuthority.state === "CERTIFIED_ROUTE" && certificationAuthority.evidenceGrade === "COMPLETE_CONSTRAINT_EVIDENCE"
      ? "PRELIMINARY_QUOTE_CERTIFIED_EVIDENCE"
      : certificationAuthority.evidenceStatus === "CURRENT" && certificationAuthority.evidenceGrade === "INCOMPLETE_CONSTRAINT_EVIDENCE"
        ? "PRELIMINARY_QUOTE_INCOMPLETE_EVIDENCE"
        : "PRELIMINARY_QUOTE_REVIEW_REQUIRED";
  const confidenceLevel =
    certificationAuthority.state === "CERTIFIED_ROUTE"
      ? "HIGH"
      : certificationAuthority.state === "PROVISIONALLY_CERTIFIED"
        ? "MEDIUM"
        : certificationAuthority.evidenceStatus === "CURRENT"
          ? "LOW"
          : "REVIEW_REQUIRED";
  const riskScore = asNumber(basis.riskBasis?.compositeRisk ?? basis.buildPath?.riskScore, 45);
  const constructionNrc = Math.round(asNumber(basis.financialBasis?.estimatedConstructionCost ?? basis.costBasis?.buildCost ?? basis.buildPath?.estimatedCost, 15000 + basis.buildFeet * 22));
  const engineeringNrc = Math.round(asNumber(basis.financialBasis?.estimatedEngineeringCost ?? basis.costBasis?.estimatedEngineeringCost ?? basis.buildPath?.estimatedEngineeringCost, constructionNrc * 0.12));
  const permitNrc = Math.round(asNumber(basis.financialBasis?.estimatedPermitCost ?? basis.costBasis?.estimatedPermitCost ?? basis.buildPath?.estimatedPermitCost, Math.max(1, basis.permitAuthorities.length) * 3500));
  const crossingNrc = Math.round(asNumber(basis.financialBasis?.estimatedCrossingCost ?? basis.costBasis?.estimatedCrossingCost ?? basis.buildPath?.estimatedCrossingCost, basis.crossings * 25000));
  const subtotal = constructionNrc + engineeringNrc + permitNrc + crossingNrc;
  const nrc = Math.round(Math.max(asNumber(basis.financialBasis?.NRC ?? basis.revenueBasis?.estimatedNRC), subtotal * (1.08 + riskScore / 500)));
  const monthlyService = Math.round(asNumber(basis.financialBasis?.MRC ?? basis.revenueBasis?.estimatedMRC, 850 + basis.buildFeet * 0.65));
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
    constraintEvidenceId: basis.constraintEvidencePackage?.evidenceId,
    routeGeometryHash: basis.routeGeometryHash || basis.constraintEvidencePackage?.routeGeometryHash,
    quoteStatus,
    evidenceGrade: certificationAuthority.evidenceGrade,
    certificationAuthority,
    missingConstraintLayers: certificationAuthority.missingConstraintLayers,
    constraintCompletenessPercent: certificationAuthority.constraintCompletenessPercent,
    confidenceLevel,
    quoteExplanation: {
      summary: `${quoteStatus} generated from ScopeVersion ${scopeVersion.scopeVersionId}: ${Math.round(basis.buildFeet).toLocaleString()} ft ${basis.constructionType} build to route ${basis.routeId ?? "n/a"} using ${certificationAuthority.evidenceGrade}.`,
      buildLengthFeet: Math.round(basis.buildFeet),
      constructionType: basis.constructionType,
      crossings: basis.crossings,
      permits: basis.permitAuthorities,
      engineeringFactors: [
        `Certification Authority ${certificationAuthority.state}`,
        `Evidence ${certificationAuthority.evidenceGrade}`,
        `${Math.round(certificationAuthority.constraintCompletenessPercent)}% constraint completeness`,
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
      constraintEvidenceId: basis.constraintEvidencePackage?.evidenceId,
      routeGeometryHash: basis.routeGeometryHash || basis.constraintEvidencePackage?.routeGeometryHash,
      constraintSummary: basis.constraintSummary,
      quoteStatus,
      evidenceGrade: certificationAuthority.evidenceGrade,
      certificationAuthority,
      missingConstraintLayers: certificationAuthority.missingConstraintLayers,
      constraintCompletenessPercent: certificationAuthority.constraintCompletenessPercent,
      confidenceLevel,
    },
    notes: `Generated from ScopeVersion geometry, build path, crossing inventory, permit requirements, and commercial basis. Certification Authority: ${certificationAuthority.state}; Evidence: ${certificationAuthority.evidenceGrade}. ${basis.permitAuthorities.length ? `Permits: ${basis.permitAuthorities.join(", ")}.` : "No permit authorities listed."}`,
    createdAt: now(),
  };
  return quote;
}

export function applyQuoteToScopeVersion(scopeVersion: ScopeVersion, quote: MarketplaceQuote): ScopeVersion {
  const timestamp = now();
  const lifecycleState = getAuthoritativeLifecycleState(scopeVersion);
  const nextStatus = ["ANALYZED", "CERTIFIED", "PROVISIONALLY_CERTIFIED"].includes(lifecycleState) ? "QUOTED" : lifecycleState;
  return transitionScopeVersionLifecycle({
    ...scopeVersion,
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
  }, nextStatus, timestamp);
}
