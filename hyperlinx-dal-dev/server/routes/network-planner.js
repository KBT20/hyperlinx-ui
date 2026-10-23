import { contentCanonicalHash } from "../content/content-registry-authority.js";
import { authQuery } from "../auth/postgres.js";
import { buildFluidstackCommercialPlanning, DEFAULT_ASSUMED_PROGRAM_START_DATE } from "../network-planning/fluidstack-commercial-planning.js";
import { authorizeFluidstackWorkingPlanner, readFluidstackWorkingPlanner } from "../network-planning/fluidstack-working-analysis-authority.js";
import { authorizeNetworkPlanning, openNetworkPlanningContext } from "../network-planning/multi-customer-planning-authority.js";
import { readFluidstackWhatIf } from "../network-planning/fluidstack-network-universe-authority.js";
import { LAYER1_PLANNER_DOCTRINE, productCapability, resolveLayer1PlannerDoctrine } from "../network-planning/layer1-product-doctrine.js";
import { listNetworkPlans, networkPlanMatchesContext, openNetworkPlan, saveNetworkPlan, reanalyzeNetworkPlanLayer1 } from "../network-planning/network-plan-authority.js";
import { denyCustomerNetworkExport, readCustomerSafeNetworkDisplay } from "../network-planning/customer-network-disclosure-authority.js";
import { createFluidstackPlanningAccount, createFluidstackPlanningOpportunity, plannerContext as planningIdentityContext, promotePlanningIdentity, resolvePlanningIdentity } from "../network-planning/planner-vnext-authority.js";
import {
  acceptPlanningRecommendations,
  createPortfolioExport,
  listPortfolioPlanning,
  openPortfolioExport,
  openPortfolioPlanning,
  preparePortfolioPlanning,
  reconcilePortfolioExport,
  renderPortfolioExport,
  selectPortfolioRoute,
} from "../network-planning/portfolio-commercial-export-authority.js";
import {
  approveSitePlanningRecipe,
  listSitePlanningRecipes,
  saveSitePlanningRecipe,
  SITE_RECIPE_APPROVAL_ACKNOWLEDGEMENT,
} from "../network-planning/site-planning-recipe-authority.js";
import {
  buildPlannerArtifact,
  commercialPlanningReceipt,
  PLANNER_SUBMIT_ACKNOWLEDGEMENT,
  submittedPlannerArtifact,
} from "../network-planning/planner-artifact-authority.js";
import { attachPlannerArtifactToOpportunity, requirePlannerArtifactOpportunity } from "./commercial-opportunities.js";
import { persistPlanningHandoff, validateHandoffBinding } from '../network-planning/commercial-handoff-store.js';
import { sharedCanonicalProductProjection } from "./product-fulfillment.js";
import { PRODUCT_DOCTRINE_AUTHORITY } from "../generated/product-doctrine-runtime.js";
import {
  currentRepositoryAuthority,
  corsHeaders,
  DIRS,
  errorResponse,
  jsonResponse,
  listRecords,
  loadRecord,
  nowIso,
  persistRecord,
  readRequestJson,
} from "./_shared.js";
import { requireRuntimeUser } from "./authority.js";
import { userHasPermission } from './auth.js';
import { planningRequestScope, assertPlanningReferences, assertPlanningResourceScope } from '../network-planning/planning-account-request-scope.js';
import { authoritativePlanningContext } from '../network-planning/planning-account-activation.js';
import { accountPlanningNetworkDisplay } from '../network-planning/account-planning-network-display.js';
import { handlePlannerIof } from './planner-iof.js';

const BASE = "/api/network-planning/planner";
const P05_PORTFOLIO_SUBMIT_ACKNOWLEDGEMENT = "I submit this exact portfolio planning revision and export package to Commercial Planning as planning evidence only. It creates no governed Estimate, Commercial Route, Proposal, Engineering Acceptance, Service Order, or ScopeVersion.";
const P05A_PROMOTION_ACKNOWLEDGEMENT = "I promote this exact Planning Account and Planning Opportunity through the governed Commercial Account and Opportunity authorities. Planning lineage is preserved and no downstream authority is created.";
const DOCTRINE = Object.freeze({
  productId: PRODUCT_DOCTRINE_AUTHORITY.productId,
  productDoctrineId: PRODUCT_DOCTRINE_AUTHORITY.productDoctrineId,
  productDoctrineVersion: PRODUCT_DOCTRINE_AUTHORITY.productDoctrineVersion,
  productDoctrineHash: PRODUCT_DOCTRINE_AUTHORITY.productDoctrineHash,
});
const text = (value) => String(value ?? "").trim();
const fail = (code, status = 422) => { throw Object.assign(new Error(code), { code, status }); };
const safeAccounts = (rows) => rows.map((item) => ({ accountId: item.accountId, accountNumber: item.accountNumber, name: item.name, customerId: item.customerId, customerOrganizationId: item.customerOrganizationId, status: item.status, lifecycleStatus: item.lifecycleStatus || item.lifecycleState || "GOVERNED_ACCOUNT", planningContextOnly: false, originatingPlanningAccountId: item.planningPromotionLineage?.planningAccountId || null }));
const safeOpportunities = (rows) => rows.map((item) => ({ opportunityId: item.opportunityId, accountId: item.accountId, customerId: item.customerId, name: item.name, status: item.status, lifecycleStatus: item.lifecycleStatus || item.lifecycleState || "GOVERNED_OPPORTUNITY", planningContextOnly: false, productId: item.productId, productDoctrineId: item.productDoctrineId, originatingPlanningOpportunityId: item.planningPromotionLineage?.planningOpportunityId || null }));
const planningAccountProjection = (item) => ({ accountId: item.plannerAccountId, accountNumber: 0, name: item.displayName, customerId: item.customerId || null, customerOrganizationId: item.customerOrganizationId || null, status: item.promotionState, lifecycleStatus: "PLANNING_ACCOUNT", planningContextOnly: true, canonicalAccountId: item.canonicalAccountId || null, promotionEventId: item.promotionEventId || null, originatingCreationIntentId: item.originatingCreationIntentId || null });
const planningOpportunityProjection = (item) => ({ opportunityId: item.plannerOpportunityId, accountId: item.plannerAccountId, customerId: item.customerId || null, name: item.opportunityName, status: item.promotionState, lifecycleStatus: "PLANNING_OPPORTUNITY", planningContextOnly: true, canonicalOpportunityId: item.canonicalOpportunityId || null, canonicalAccountId: item.canonicalAccountId || null, promotionEventId: item.promotionEventId || null, productId: item.selectedProductId, productDoctrineId: item.productDoctrineId || DOCTRINE.productDoctrineId });
const safeProducts = (rows) => rows.map((item) => ({
  productId: item.productId,
  productName: item.productName,
  productFamily: item.productFamily,
  productVersion: item.productVersion,
  lifecycleStatus: item.lifecycleStatus,
  doctrineId: item.productId === DOCTRINE.productId ? DOCTRINE.productDoctrineId : null,
  doctrineVersion: item.productId === DOCTRINE.productId ? DOCTRINE.productDoctrineVersion : null,
  doctrineHash: item.productId === DOCTRINE.productId ? DOCTRINE.productDoctrineHash : null,
  plannerCapability: item.productId === DOCTRINE.productId ? "SITE_ACCESS_MULTI_SITE_ADAPTER" : "UNSUPPORTED_IN_CIP_117",
  synthesisStatus: item.productId === DOCTRINE.productId ? "SUPPORTED_BY_EXISTING_ENGINE" : "EXPLICITLY_NOT_IMPLEMENTED",
  capability: productCapability(item.productId),
}));
async function loadPlanningProjection(user, query, start = DEFAULT_ASSUMED_PROGRAM_START_DATE, context = null) {
  if (!context) fail("NETWORK_PLANNING_CONTEXT_REQUIRED", 400);
  const opened = await openNetworkPlanningContext({ user, planningContextId: text(context.planningContextId), expectedOpportunityId: text(context.customerPlanningOpportunityId), expectedPlanId: text(context.networkPlanId) });
  if (!opened.universeAuthorization.planningUseAuthorized) fail("NETWORK_UNIVERSE_AUTHORIZATION_REQUIRED", 409);
  fail("NETWORK_PLANNING_CONTEXT_ADAPTER_NOT_IMPLEMENTED", 422);
}

async function persistedRecipeOperation(input,user,approve=false,accountScope) {
  const opened=await openNetworkPlan(text(input.networkPlanId));
  if(opened.revision.planRevisionHash!==text(input.networkPlanRevisionHash)||opened.plan.accountId!==text(input.accountId)||opened.plan.opportunityId!==text(input.opportunityId))fail('SITE_RECIPE_PLAN_LINEAGE_MISMATCH',409);
  let routes=opened.revision.scenarios||[];
  const directory=await listPortfolioPlanning({accountId:opened.plan.accountId,opportunityId:opened.plan.opportunityId}),pointer=directory.items.find(p=>p.networkPlanId===opened.plan.planId);
  if(pointer){const portfolio=await openPortfolioPlanning(pointer.portfolioPlanningPackageId);if(portfolio.revision.sourceNetworkPlanRevisionHash===opened.revision.planRevisionHash)routes=portfolio.revision.sites.flatMap(s=>s.routes);}
  const saved=routes.find(s=>s.siteRevisionId===text(input.siteRevisionId)&&s.candidateId===text(input.candidateId)&&s.routeId===text(input.routeOptionId)&&s.carrier===text(input.carrierId));
  if(!saved?.geometry?.coordinates?.length||!saved.geometryHash)fail('SITE_RECIPE_SAVED_ROUTE_REQUIRED',409);
  const scenario={siteRevisionId:saved.siteRevisionId,scenarioId:saved.scenarioId||saved.routeId,candidateId:saved.candidateId,carrier:saved.carrier,sourceLayerId:saved.sourceLayerId,evidenceClassification:saved.evidenceClassification,intercept:saved.geometry.coordinates.at(-1),route:{routeRevisionId:saved.routeId,geometryHash:saved.geometryHash,geometry:saved.geometry,feet:saved.routeFeet,miles:saved.routeMiles}};
  const r=opened.revision,context={accountId:r.accountId,customerId:accountScope.customerId,customerOrganizationId:accountScope.customerOrganizationId,portfolioId:pointer?.portfolioPlanningPackageId,sourcePlanRevisionId:r.planRevisionId,opportunityId:r.opportunityId,productId:r.productId,productDoctrineId:r.productDoctrineId,productDoctrineVersion:r.productDoctrineVersion,productDoctrineHash:r.productDoctrineHash};
  const result=await (approve?approveSitePlanningRecipe:saveSitePlanningRecipe)({input,context,scenario,user});
  const currentScenarioByKey=new Map(routes.map(s=>[`${s.siteRevisionId}|${s.candidateId}`,{routeGeometryHash:s.geometryHash,routeRevisionId:s.routeId,routeFeet:s.routeFeet}]));
  const projected=await listSitePlanningRecipes({accountId:r.accountId,opportunityId:r.opportunityId,currentScenarioByKey,totalSites:new Set(routes.map(s=>s.siteRevisionId)).size});
  return {...result,projection:projected.items.find(p=>p.sitePlanningRecipeId===result.recipe.sitePlanningRecipeId),commercialMutation:false,engineeringMutation:false,universeMutation:false,downstreamAuthorityCreated:false};
}

function siteRecipeContext(account, opportunity, input = {}) {
  return {
    accountId: account.accountId, customerId: account.customerId, opportunityId: opportunity.opportunityId,
    productId: text(input.productId) || DOCTRINE.productId,
    productDoctrineId: text(input.productDoctrineId) || DOCTRINE.productDoctrineId,
    productDoctrineVersion: text(input.productDoctrineVersion) || DOCTRINE.productDoctrineVersion,
    productDoctrineHash: text(input.productDoctrineHash) || DOCTRINE.productDoctrineHash,
    governedCreationIntent: Boolean(account.governedCreationIntent || opportunity.governedCreationIntent),
  };
}

async function exactSiteScenario({ user, query, planner, commercial, siteRevisionId, candidateId, programStart }) {
  const plan = commercial.plans.find((item) => item.siteRevisionId === text(siteRevisionId));
  if (!plan) fail("SITE_RECIPE_SITE_NOT_FOUND", 404);
  if (plan.networkUniverseIntercept.candidateId === text(candidateId)) return {
    siteRevisionId: plan.siteRevisionId, scenarioId: "PRIMARY", candidateId: plan.networkUniverseIntercept.candidateId,
    carrier: plan.carrier, sourceLayerId: plan.networkUniverseIntercept.sourceLayerId,
    evidenceClassification: text(planner.candidates.find((item) => item.candidate_id === plan.networkUniverseIntercept.candidateId)?.evidence_classification) || "UNKNOWN",
    intercept: plan.networkUniverseIntercept.coordinates,
    route: plan.route,
  };
  const whatIfUrl = new URL("http://localhost/api/network-planning/fluidstack/what-if");
  whatIfUrl.searchParams.set("site", text(siteRevisionId)); whatIfUrl.searchParams.set("candidate", text(candidateId)); whatIfUrl.searchParams.set("start", text(programStart) || DEFAULT_ASSUMED_PROGRAM_START_DATE);
  const alternative = await readFluidstackWhatIf({ user, url: whatIfUrl, query });
  return {
    siteRevisionId: alternative.site.siteRevisionId, scenarioId: alternative.scenarioId, candidateId: alternative.candidate.candidateId,
    carrier: alternative.candidate.provider, sourceLayerId: alternative.candidate.layerId, evidenceClassification: alternative.candidate.evidenceClassification,
    intercept: alternative.candidate.interceptCoordinates,
    route: {
      routeRevisionId: alternative.whatIf.route.routeRevisionId, geometryHash: alternative.whatIf.route.geometryHash,
      feet: alternative.whatIf.route.proposedRouteFeet, miles: alternative.whatIf.route.proposedRouteMiles, geometry: alternative.whatIf.route.geometry,
    },
  };
}

async function completeFluidstackScenarioInventory({ inputScenarios, selectedSolution, user, query, planner, commercial, programStart }) {
  const requested = Array.isArray(inputScenarios) ? inputScenarios : [];
  const selectedSiteRevisionId = text(selectedSolution?.siteRevisionId);
  const requestedAlternatives = requested
    .filter((item) => item?.scenarioId !== "PRIMARY" && text(item?.candidateId))
    .map((item) => ({ ...item, siteRevisionId: text(item.siteRevisionId) || selectedSiteRevisionId, sourceAuthority: text(item.sourceAuthority) || "HUMAN_COMPARE_SCENARIO" }));
  const protectedAlternatives = planner.access.access.flatMap((access) => {
    const nearestCandidateId = text(access.nearestPhysicalIntercept?.candidateId);
    const recommendedCandidateId = text(access.recommendedNetworkIntercept?.candidateId);
    if (!nearestCandidateId || nearestCandidateId === recommendedCandidateId || access.nearestRoute?.status !== "ROUTED") return [];
    return [{ siteRevisionId: access.siteRevisionId, candidateId: nearestCandidateId, sourceAuthority: "PROTECTED_FLUIDSTACK_NEAREST_ROUTE" }];
  });
  const alternativesByKey = new Map();
  for (const item of [...protectedAlternatives, ...requestedAlternatives]) alternativesByKey.set(`${item.siteRevisionId}|${item.candidateId}`, item);
  const alternatives = await Promise.all([...alternativesByKey.values()].map(async (item) => {
    const sitePlan = commercial.plans.find((plan) => plan.siteRevisionId === item.siteRevisionId);
    const candidate = planner.candidates.find((row) => row.site_revision_id === item.siteRevisionId && row.candidate_id === item.candidateId && row.evidence_type === "PHYSICAL_CARRIER_ROUTE");
    if (!sitePlan || !candidate) fail("NETWORK_PLAN_SCENARIO_LINEAGE_INVALID", 409);
    if (sitePlan.networkUniverseIntercept.candidateId === item.candidateId) return null;
    const whatIfUrl = new URL("http://dal.local/api/network-planning/fluidstack/what-if");
    whatIfUrl.searchParams.set("site", item.siteRevisionId);
    whatIfUrl.searchParams.set("candidate", item.candidateId);
    whatIfUrl.searchParams.set("start", text(programStart) || DEFAULT_ASSUMED_PROGRAM_START_DATE);
    const alternative = await readFluidstackWhatIf({ user, url: whatIfUrl, query });
    if (alternative.whatIf.route.status !== "ROUTED" || !alternative.whatIf.route.geometryHash) fail("NETWORK_PLAN_SCENARIO_NOT_VIABLE", 409);
    if (text(item.scenarioId) && text(item.scenarioId) !== alternative.scenarioId) fail("NETWORK_PLAN_SCENARIO_LINEAGE_MISMATCH", 409);
    return {
      scenarioId: alternative.scenarioId,
      scenarioRole: "VIABLE_ALTERNATIVE",
      siteRevisionId: item.siteRevisionId,
      candidateId: alternative.candidate.candidateId,
      carrier: alternative.candidate.provider,
      routeRevisionId: alternative.whatIf.route.routeRevisionId,
      routeGeometryHash: alternative.whatIf.route.geometryHash,
      routeMiles: alternative.whatIf.route.proposedRouteMiles,
      sourceAuthority: item.sourceAuthority,
      sourceFingerprint: alternative.fingerprint,
      viability: "ROUTED",
    };
  }));
  const primaries = commercial.plans.map((plan) => ({
    scenarioId: "PRIMARY",
    scenarioRole: "RECOMMENDED",
    siteRevisionId: plan.siteRevisionId,
    candidateId: plan.networkUniverseIntercept.candidateId,
    carrier: plan.carrier,
    routeRevisionId: plan.route.routeRevisionId,
    routeGeometryHash: plan.route.geometryHash,
    routeMiles: plan.route.miles,
    sourceAuthority: "PROTECTED_FLUIDSTACK_RECOMMENDATION",
    viability: plan.route.status,
  }));
  const sourceRow = new Map(commercial.plans.map((plan) => [plan.siteRevisionId, plan.sourceRow]));
  return [...primaries, ...alternatives.filter(Boolean)].sort((a, b) => Number(sourceRow.get(a.siteRevisionId)) - Number(sourceRow.get(b.siteRevisionId)) || (a.scenarioRole === "RECOMMENDED" ? -1 : b.scenarioRole === "RECOMMENDED" ? 1 : a.candidateId.localeCompare(b.candidateId)));
}

async function siteRecipePortfolio({ user, query, account, opportunity, planner, commercial, programStart }) {
  if (account.governedCreationIntent || opportunity.governedCreationIntent) return { items: [], summary: { totalSites: commercial.plans.length, reviewedSites: 0, approvedSites: 0, reviewedPercent: 0, approvedPercent: 0, outstandingSites: commercial.plans.length, approvedRecipeRevisions: [] }, mutationPerformed: false, canonicalContextRequired: true };
  const stored = await listSitePlanningRecipes({ accountId: account.accountId, opportunityId: opportunity.opportunityId, totalSites: commercial.plans.length });
  const currentScenarioByKey = new Map();
  for (const item of stored.items) {
    const scenario = await exactSiteScenario({ user, query, planner, commercial, siteRevisionId: item.siteRevisionId, candidateId: item.candidateId, programStart });
    currentScenarioByKey.set(`${item.siteRevisionId}|${item.candidateId}`, { routeGeometryHash: scenario.route.geometryHash, routeRevisionId: scenario.route.routeRevisionId, routeFeet: scenario.route.feet });
  }
  return listSitePlanningRecipes({ accountId: account.accountId, opportunityId: opportunity.opportunityId, currentScenarioByKey, totalSites: commercial.plans.length });
}

async function exactContext(input) {
  const planning = await resolvePlanningIdentity(text(input.accountId), text(input.opportunityId)).catch(() => null);
  if (!planning) fail('PLANNING_RESOURCE_NOT_FOUND', 404);
  const account = { ...planningAccountProjection(planning.account), planningAdapter: 'GOVERNED_MULTI_CUSTOMER' };
  const opportunity = { ...planningOpportunityProjection(planning.opportunity), customerId: account.customerId };
  if (text(input.customerId) && text(input.customerId) !== account.customerId) fail('PLANNING_RESOURCE_NOT_FOUND', 404);
  return { account, opportunity };
}
async function handoffAssociation(account, opportunity, user) {
  if (!account.canonicalAccountId && !opportunity.canonicalOpportunityId) return async () => {};
  if (!account.canonicalAccountId || !opportunity.canonicalOpportunityId || opportunity.canonicalAccountId !== account.canonicalAccountId) fail('PLANNER_PROMOTION_LINEAGE_INVALID', 409);
  const canonical = await requirePlannerArtifactOpportunity(opportunity.canonicalOpportunityId, account.canonicalAccountId, user);
  if (canonical.customerId !== account.customerId || canonical.planningPromotionLineage?.planningOpportunityId !== opportunity.opportunityId || canonical.planningPromotionLineage?.planningAccountId !== account.accountId) fail('PLANNER_PROMOTION_LINEAGE_INVALID', 409);
  return (receipt, artifact) => attachPlannerArtifactToOpportunity({ opportunityId: opportunity.canonicalOpportunityId, accountId: account.canonicalAccountId, plannerArtifactId: artifact.plannerArtifactId, plannerArtifactHash: artifact.artifactHash, commercialPlanningIntakeId: receipt.commercialPlanningIntakeId }, user);
}
async function assertNetworkPlanReference(body, account, opportunity) {
  if (!text(body.networkPlanId)) return null;
  const opened = await openNetworkPlan(body.networkPlanId);
  if (!networkPlanMatchesContext(opened.plan, account.accountId, opportunity.opportunityId)) fail("PLANNER_NETWORK_PLAN_CONTEXT_MISMATCH", 409);
  if (text(body.networkPlanRevisionId) !== opened.revision.planRevisionId || text(body.networkPlanRevisionHash) !== opened.revision.planRevisionHash) fail("PLANNER_NETWORK_PLAN_REVISION_MISMATCH", 409);
  if (opened.revision.selectedSolution?.siteRevisionId !== text(body.siteRevisionId) || opened.revision.selectedSolution?.candidateId !== text(body.selectedCandidateId)) fail("PLANNER_NETWORK_PLAN_SELECTION_MISMATCH", 409);
  return opened;
}

function plannerSession({ user, account, opportunity, planner, acceptedPlanningStateAt }) {
  const authority = currentRepositoryAuthority();
  const basis = {
    schemaVersion: "CIP-116-PLANNER-SESSION-V1",
    environment: authority.authorityClass,
    organizationId: authority.organizationId,
    tenantId: planner.scope.tenantId,
    engagementId: planner.scope.engagementId,
    purpose: planner.scope.purpose,
    accountId: account.accountId,
    customerId: account.customerId,
    customerOrganizationId: account.customerOrganizationId || null,
    opportunityId: opportunity.opportunityId,
    commercialContextType: opportunity.governedCreationIntent ? "GOVERNED_CREATION_INTENT" : "EXISTING_GOVERNED_OPPORTUNITY",
    ...DOCTRINE,
    sourceFingerprint: planner.analysis.sourceFingerprint,
    rightsRevision: planner.rights.rightsRevision,
    acceptedPlanningStateAt: text(acceptedPlanningStateAt),
    createdByPrincipalId: user.principalId,
    createdByMembershipId: user.membershipId,
    authority: "WORKING_PLANNING_ONLY",
  };
  if (!basis.acceptedPlanningStateAt) fail("PLANNER_ACCEPTED_STATE_TIMESTAMP_REQUIRED");
  const sessionHash = contentCanonicalHash(basis);
  return Object.freeze({ plannerSessionId: `PLANNER-SESSION-${authority.authorityClass === "DEMO" ? "DEMO-" : ""}${sessionHash.slice(0, 32)}`, sessionHash, immutable: true, ...basis });
}

async function artifactFromProjection({ user, body, planner, commercial, account, opportunity, query, networkPlan = null }) {
  const plan = commercial.plans.find((item) => item.siteRevisionId === text(body.siteRevisionId));
  if (!plan) fail("PLANNER_SITE_NOT_FOUND", 404);
  const site = planner.sites.find((item) => item.site_revision_id === plan.siteRevisionId);
  const selectedCandidateId = text(body.selectedCandidateId) || plan.networkUniverseIntercept.candidateId;
  const candidate = planner.candidates.find((item) => item.candidate_id === selectedCandidateId && item.site_revision_id === plan.siteRevisionId);
  const layer = planner.layers.find((item) => item.layer_id === candidate?.layer_id);
  if (!site || !candidate || !layer) fail("PLANNER_SELECTED_SOLUTION_LINEAGE_INCOMPLETE", 409);
  let selected = {
    scenarioId: "PRIMARY",
    scenarioType: "RECOMMENDED_PRIMARY",
    carrier: plan.carrier,
    candidateId: plan.networkUniverseIntercept.candidateId,
    intercept: plan.networkUniverseIntercept,
    route: plan.route,
    cost: plan.cost,
    schedule: plan.schedule,
    backboneProximityMiles: plan.backboneProximityMiles,
    qualification: plan.qualification,
  };
  if (selectedCandidateId !== plan.networkUniverseIntercept.candidateId) {
    const whatIfUrl = new URL("http://dal.local/api/network-planning/fluidstack/what-if");
    whatIfUrl.searchParams.set("site", plan.siteRevisionId);
    whatIfUrl.searchParams.set("candidate", selectedCandidateId);
    whatIfUrl.searchParams.set("start", text(body.programStart) || DEFAULT_ASSUMED_PROGRAM_START_DATE);
    const scenario = await readFluidstackWhatIf({ user, url: whatIfUrl, query });
    if (text(body.selectedScenarioId) && text(body.selectedScenarioId) !== scenario.scenarioId) fail("PLANNER_SELECTED_SCENARIO_MISMATCH", 409);
    selected = {
      scenarioId: scenario.scenarioId,
      scenarioType: "ALTERNATIVE_SELECTED_FOR_PLAN",
      carrier: scenario.candidate.provider,
      candidateId: scenario.candidate.candidateId,
      intercept: {
        type: "NETWORK_UNIVERSE_INTERCEPT",
        candidateId: scenario.candidate.candidateId,
        sourceLayerId: scenario.candidate.layerId,
        coordinates: scenario.candidate.interceptCoordinates,
        serviceability: "UNKNOWN",
        qualificationState: "QUALIFICATION_REQUIRED",
      },
      route: {
        routeRevisionId: scenario.whatIf.route.routeRevisionId,
        status: scenario.whatIf.route.status,
        miles: scenario.whatIf.route.proposedRouteMiles,
        feet: scenario.whatIf.route.proposedRouteFeet,
        geometryHash: scenario.whatIf.route.geometryHash,
        geometry: scenario.whatIf.route.geometry,
      },
      cost: scenario.commercial.alternative.cost,
      schedule: scenario.commercial.alternative.schedule,
      backboneProximityMiles: Number(candidate.distance_meters) / 1609.344,
      qualification: "REQUIRED",
    };
  }
  const session = plannerSession({ user, account, opportunity, planner, acceptedPlanningStateAt: body.acceptedPlanningStateAt });
  const sourceArtifactId = `SOURCE-ARTIFACT-FLUIDSTACK-XLSX-${FLUIDSTACK_SOURCE_HASH.slice(0, 20)}`;
  const plannerInputBasis = {
    schemaVersion: "CIP-116-CANONICAL-PLANNER-INPUT-V1",
    plannerInputId: `PLANNER-INPUT-${currentRepositoryAuthority().authorityClass === "DEMO" ? "DEMO-" : ""}${contentCanonicalHash({ session: session.sessionHash, site: site.site_revision_id }).slice(0, 32)}`,
    plannerSessionId: session.plannerSessionId,
    sourceArtifactId,
    sourceHash: site.source_sha256 || FLUIDSTACK_SOURCE_HASH,
    sourceLocator: { workbook: "Fluidstack Sites.xlsx", worksheet: "Sheet1", row: Number(site.source_row), column: "Coordinates" },
    siteRevisionId: site.site_revision_id,
    siteReference: site.site_reference,
    geometry: site.geometry,
    geometryHash: site.geometry_hash,
    validationState: site.validation_state,
    validationIssues: site.validation_issues,
    extractionMethod: "DETERMINISTIC_XLSX_ROW_MAPPING",
    normalizationVersion: "CIP-116-PLANNER-NORMALIZATION-V1",
    authority: "ACCEPTED_PLANNER_INPUT_NOT_NETWORK_UNIVERSE_OR_COMMERCIAL_TRUTH",
  };
  const plannerInput = Object.freeze({ ...plannerInputBasis, canonicalHash: contentCanonicalHash(plannerInputBasis), immutable: true });
  const artifact = buildPlannerArtifact({
    context: {
      environment: currentRepositoryAuthority().authorityClass,
      accountId: account.accountId,
      customerId: account.customerId,
      customerOrganizationId: account.customerOrganizationId || null,
      opportunityId: opportunity.opportunityId,
      commercialContextType: opportunity.governedCreationIntent ? "GOVERNED_CREATION_INTENT" : "EXISTING_GOVERNED_OPPORTUNITY",
      governedCreationIntent: opportunity.governedCreationIntent ? {
        state: FLUIDSTACK_CREATION_INTENT.state,
        accountName: account.name,
        customerName: "Fluidstack",
        opportunityName: opportunity.name,
        authority: "COMMERCIAL_PLANNING_MUST_USE_EXISTING_GOVERNED_CREATION_AUTHORITY",
      } : null,
      plannerSessionId: session.plannerSessionId,
      plannerSessionHash: session.sessionHash,
      ...DOCTRINE,
      acceptedPlanningStateAt: session.acceptedPlanningStateAt,
      ...(text(body.networkPlanId) ? { networkPlanId: text(body.networkPlanId), networkPlanRevisionId: text(body.networkPlanRevisionId), networkPlanRevisionHash: text(body.networkPlanRevisionHash) } : {}),
      ...(networkPlan?.revision?.doctrineResolution?.binding ? {
        plannerDoctrineBindingId: networkPlan.revision.doctrineResolution.binding.bindingId,
        plannerDoctrineBindingVersion: networkPlan.revision.doctrineResolution.binding.bindingVersion,
        plannerDoctrineBindingHash: networkPlan.revision.doctrineResolution.binding.bindingHash,
      } : {}),
    },
    sourceLineage: [{
      sourceArtifactId, sourceObjectId: "CONTENT-OBJECT-ca6c42e9-ab3e-4571-ad1f-6673facacbaa", sourceReceiptId: "WORKING-RECEIPT-CONTENT-OBJECT-ca6c42e9-ab3e-4571-ad1f-6673facacbaa",
      sourceHash: site.source_sha256 || FLUIDSTACK_SOURCE_HASH, sourceFilename: "Fluidstack Sites.xlsx", sourceType: "XLSX", originalPreserved: true,
      sourceLocator: `workbook:Fluidstack Sites.xlsx/worksheet:Sheet1/row:${site.source_row}`, extractionMethod: "DETERMINISTIC_XLSX_ROW_MAPPING",
    }],
    normalizedInputReferences: [{ plannerInputId: plannerInput.plannerInputId, plannerInputHash: plannerInput.canonicalHash, siteRevisionId: site.site_revision_id, validationState: site.validation_state }],
    universeReferences: [{
      layerId: layer.layer_id, provider: layer.provider, evidenceFamily: layer.evidence_family, evidenceType: layer.evidence_type,
      evidenceClassification: layer.evidence_classification, sourceHash: layer.source_sha256, geometrySetHash: layer.geometry_set_hash,
      featureReference: candidate.candidate_id, selectedFeatureGeometryHash: candidate.geometry_hash, rightsRevision: layer.rights_revision,
      temporalLimitation: layer.temporal_limitation, tenureStatus: layer.tenure_status,
    }],
    rightsProjection: { rightsRevision: planner.rights.rightsRevision, grants: planner.rights.grants, disclosureCeiling: planner.rights.disclosureCeiling, exportAllowed: false, customerExactGeometry: false },
    selectedSolution: {
      selectedSiteRevisionId: plan.siteRevisionId, selectedSiteReference: site.site_reference, siteGeometry: site.geometry,
      selectedCarrier: selected.carrier, selectedCandidateId: selected.candidateId, selectedScenarioId: selected.scenarioId, selectedScenarioType: selected.scenarioType,
      selectedNetworkFeatureReferences: [{ layerId: candidate.layer_id, candidateId: candidate.candidate_id, geometryHash: candidate.geometry_hash }],
      selectedIntercept: { type: "NETWORK_UNIVERSE_INTERCEPT", coordinates: selected.intercept.coordinates, serviceability: "UNKNOWN", interconnectionAuthority: false },
      physicalAccessRoute: { routeRevisionId: selected.route.routeRevisionId, status: selected.route.status, geometry: selected.route.geometry, geometryHash: selected.route.geometryHash, miles: selected.route.miles, feet: selected.route.feet, engineered: false },
      topology: planner.intent.topology, programRelationships: ["FLUIDSTACK_1TBPS_PORTFOLIO", "SINGLE_SITE_GOLDEN_HANDOFF"],
    },
    alternatives: Array.isArray(body.alternatives) ? body.alternatives : [],
    preliminaryCommercialInputs: {
      routeLengthMiles: selected.route.miles, routeLengthFeet: selected.route.feet, planningQuantities: selected.cost.trace,
      preliminaryCost: selected.cost.knownTotal, costStatus: selected.cost.status, costBasisVersion: selected.cost.rateSetVersion,
      developmentRateVersion: selected.cost.rateSetVersion, constructionDurationKnownDays: selected.schedule.knownConstructionDays,
      constructionDuration: selected.schedule.constructionDurationLabel, deliveryForecast: selected.schedule.forecast,
      estimateAuthority: false, commercialRouteAuthority: false,
    },
    planningAssumptions: ["DEVELOPMENT_RATESET_NOT_PRODUCTION_PRICING", "OSRM_ROUTE_NOT_ENGINEERED_ROUTE", "FORECAST_LOWER_BOUND_NOT_COMMITMENT", "CARRIER_QUALIFICATION_REQUIRED"],
    unresolvedItems: ["SERVICEABILITY_UNKNOWN", "CAPACITY_UNKNOWN", "AVAILABILITY_UNKNOWN", "TENURE_UNKNOWN", "CONSTRUCTIBILITY_UNKNOWN", "INTERCONNECTION_AUTHORITY_UNKNOWN", ...selected.cost.unresolved, ...selected.schedule.unresolved],
  });
  return { artifact, plannerInput, session, plan, selected, candidate, layer };
}

function intakeProjection(receipt, artifact) {
  return {
    commercialPlanningIntakeId: receipt.commercialPlanningIntakeId,
    receiptHash: receipt.receiptHash,
    plannerArtifactId: receipt.plannerArtifactId,
    plannerArtifactHash: receipt.plannerArtifactHash,
    accountId: receipt.accountId,
    customerId: receipt.customerId,
    opportunityId: receipt.opportunityId,
    receivedAt: receipt.receivedAt,
    disposition: receipt.disposition,
    selectedSiteRevisionId: artifact?.selectedSolution?.selectedSiteRevisionId,
    selectedCarrier: artifact?.selectedSolution?.selectedCarrier,
    routeMiles: artifact?.preliminaryCommercialInputs?.routeLengthMiles,
    preliminaryCost: artifact?.preliminaryCommercialInputs?.preliminaryCost,
    unresolvedItems: artifact?.unresolvedItems ?? [],
    authority: "PLANNING_INPUT_NOT_COMMERCIAL_TRUTH",
    ...(artifact?.iofPackage?.viewData ? {iofPackage:artifact.iofPackage} : {}),
  };
}

function p05RouteFromCommercial(plan, candidate) {
  return {
    siteRevisionId: plan.siteRevisionId, siteName: plan.siteName, scenarioId: "PRIMARY", candidateId: plan.networkUniverseIntercept.candidateId,
    carrier: plan.carrier, sourceLayerId: plan.networkUniverseIntercept.sourceLayerId, routeRole: "RECOMMENDED", routeStatus: plan.route.status,
    routeRevisionId: plan.route.routeRevisionId, geometry: plan.route.geometry, geometryHash: plan.route.geometryHash, routeMiles: plan.route.miles, routeFeet: plan.route.feet,
    physicalConstructionMiles: plan.route.miles, preliminaryCost: plan.cost.knownTotal, costCategories: plan.cost.categories,
    forecast: plan.schedule.forecast, knownConstructionDays: plan.schedule.knownConstructionDays,
    evidenceStatus: "QUALIFICATION_REQUIRED", evidenceClassification: candidate?.evidence_classification || "UNKNOWN",
    unresolvedConditions: [...(plan.cost.unresolved || []), ...(plan.schedule.unresolved || []), "SERVICEABILITY_UNKNOWN", "CONSTRUCTIBILITY_UNKNOWN"],
  };
}

function p05RouteFromRecipe(recipe, plan) {
  const revision = recipe.revision;
  return {
    siteRevisionId: recipe.siteRevisionId, siteName: plan.siteName, scenarioId: recipe.scenarioId, candidateId: recipe.candidateId,
    carrier: recipe.carrier, sourceLayerId: revision.sourceLayerId, routeRole: "ALTERNATIVE", routeStatus: "ROUTED",
    routeRevisionId: revision.routeRevisionId, geometry: revision.routeGeometry, geometryHash: revision.routeGeometryHash, routeMiles: revision.routeMiles, routeFeet: revision.routeFeet,
    physicalConstructionMiles: revision.routeMiles, preliminaryCost: null, costCategories: [], forecast: {}, knownConstructionDays: null,
    evidenceStatus: "QUALIFICATION_REQUIRED", evidenceClassification: revision.evidenceClassification,
    unresolvedConditions: ["ALTERNATIVE_COMMERCIAL_PROJECTION_NOT_PERSISTED", "SERVICEABILITY_UNKNOWN", "CONSTRUCTIBILITY_UNKNOWN"],
  };
}

function p05RouteFromSavedScenario(alternative, plan) {
  return {
    siteRevisionId: plan.siteRevisionId, siteName: plan.siteName, scenarioId: alternative.scenarioId, candidateId: alternative.candidate.candidateId,
    carrier: alternative.candidate.provider, sourceLayerId: alternative.candidate.layerId, routeRole: "ALTERNATIVE", routeStatus: alternative.whatIf.route.status,
    routeRevisionId: alternative.whatIf.route.routeRevisionId, geometry: alternative.whatIf.route.geometry, geometryHash: alternative.whatIf.route.geometryHash,
    routeMiles: alternative.whatIf.route.proposedRouteMiles, routeFeet: alternative.whatIf.route.proposedRouteFeet,
    physicalConstructionMiles: alternative.whatIf.route.proposedRouteMiles, preliminaryCost: alternative.commercial.alternative.cost.knownTotal,
    costCategories: alternative.commercial.alternative.cost.categories, forecast: alternative.commercial.alternative.schedule.forecast,
    knownConstructionDays: alternative.commercial.alternative.schedule.knownConstructionDays,
    evidenceStatus: "QUALIFICATION_REQUIRED", evidenceClassification: alternative.candidate.evidenceClassification,
    unresolvedConditions: [...(alternative.commercial.alternative.cost.unresolved || []), ...(alternative.commercial.alternative.schedule.unresolved || []), "SERVICEABILITY_UNKNOWN", "CONSTRUCTIBILITY_UNKNOWN"],
  };
}

async function p05SiteInputs(planner, commercial, recipes, networkPlan, { user, query, programStart }) {
  const selectedSiteRevisionId = networkPlan.revision.selectedSolution?.siteRevisionId;
  const savedAlternatives = await Promise.all((networkPlan.revision.scenarios || []).filter((scenario) => scenario.scenarioRole !== "RECOMMENDED" && scenario.scenarioId !== "PRIMARY" && scenario.candidateId).map(async (scenario) => {
    const scenarioSiteRevisionId = text(scenario.siteRevisionId) || selectedSiteRevisionId;
    if (!scenarioSiteRevisionId) fail("P05_SAVED_SCENARIO_SITE_LINEAGE_REQUIRED", 409);
    const whatIfUrl = new URL("http://dal.local/api/network-planning/fluidstack/what-if");
    whatIfUrl.searchParams.set("site", scenarioSiteRevisionId);
    whatIfUrl.searchParams.set("candidate", scenario.candidateId);
    whatIfUrl.searchParams.set("start", text(programStart) || DEFAULT_ASSUMED_PROGRAM_START_DATE);
    const alternative = await readFluidstackWhatIf({ user, url: whatIfUrl, query });
    if (scenario.scenarioId && scenario.scenarioId !== alternative.scenarioId) fail("P05_SAVED_SCENARIO_LINEAGE_MISMATCH", 409);
    if (scenario.routeGeometryHash && scenario.routeGeometryHash !== alternative.whatIf.route.geometryHash) fail("P05_SAVED_SCENARIO_GEOMETRY_MISMATCH", 409);
    return alternative;
  }));
  return commercial.plans.map((plan) => {
    const candidate = planner.candidates.find((item) => item.candidate_id === plan.networkUniverseIntercept.candidateId);
    const site = planner.sites.find((item) => item.site_revision_id === plan.siteRevisionId);
    const siteRecipes = recipes.items.filter((item) => item.siteRevisionId === plan.siteRevisionId);
    const planAlternatives = savedAlternatives.filter((item) => item.site.siteRevisionId === plan.siteRevisionId).map((item) => p05RouteFromSavedScenario(item, plan));
    const representedCandidates = new Set([plan.networkUniverseIntercept.candidateId, ...planAlternatives.map((item) => item.candidateId)]);
    const routes = [p05RouteFromCommercial(plan, candidate), ...planAlternatives, ...siteRecipes.filter((item) => !representedCandidates.has(item.candidateId)).map((item) => p05RouteFromRecipe(item, plan))];
    const approved = siteRecipes.find((item) => item.approvalCurrent);
    const graphHash = contentCanonicalHash({ authority: "PROTECTED_FLUIDSTACK_PORTFOLIO_PROJECTION", workingProjectionFingerprint: planner.projectionFingerprint, networkPlanRevisionHash: networkPlan.revision.planRevisionHash, siteRevisionId: plan.siteRevisionId, routeHashes: routes.map((item) => item.geometryHash).sort() });
    routes.forEach((route) => { route.solutionGraphIdentity = { solutionGraphId: `FLUIDSTACK-SOLUTION-GRAPH-${graphHash.slice(0,24)}`, solutionGraphHash: graphHash, authority: "DETERMINISTIC_COMPATIBILITY_PROJECTION_OVER_PROTECTED_FLUIDSTACK_RESULTS", routingAuthorityChanged: false }; });
    return { siteRevisionId: plan.siteRevisionId, siteName: plan.siteName, siteGeometry: site?.geometry || null, routes, approvedCandidateId: approved?.candidateId || null, approvedAt: approved?.revision?.approval?.approvedAt || null, approvedByPrincipalId: approved?.revision?.approval?.approvedByPrincipalId || null };
  });
}

function p05Source({ account, opportunity, networkPlan, planner }) {
  return {
    name: `${account.name} 26-Site DCI Portfolio`, accountId: account.accountId, customerId: account.customerId, opportunityId: opportunity.opportunityId,
    productId: networkPlan.revision.productId, productDoctrineId: networkPlan.revision.productDoctrineId, productDoctrineVersion: networkPlan.revision.productDoctrineVersion,
    productDoctrineHash: networkPlan.revision.productDoctrineHash, networkPlanId: networkPlan.plan.planId,
    networkPlanRevisionId: networkPlan.revision.planRevisionId, networkPlanRevisionHash: networkPlan.revision.planRevisionHash,
    solutionGraphIdentity: { authority: "PER_SITE_DETERMINISTIC_COMPATIBILITY_PROJECTIONS", workingProjectionFingerprint: planner.projectionFingerprint },
    analysisVersion: planner.analysis.algorithmVersion, analyzedUniverseRevision: planner.analysis.sourceFingerprint, analyzedRightsRevision: planner.rights.rightsRevision,
  };
}

export async function handleNetworkPlanner(req, res, pathname, dependencies = {}) {
  if (pathname !== BASE && !pathname.startsWith(`${BASE}/`)) return false;
  const user = requireRuntimeUser(req, res);
  if (!user) return true;
  authorizeNetworkPlanning(user);
  res.setHeader("Cache-Control", "private, no-store, max-age=0");
  try {
    const query = dependencies.query || authQuery;
    const url = new URL(req.url, "http://dal.local");
    const accountScope=await planningRequestScope(req,user,{required:pathname!==`${BASE}/context`});
    if(accountScope)await assertPlanningReferences(accountScope,Object.fromEntries(url.searchParams));
    const readScopedBody=async()=>{const body=await readRequestJson(req);await assertPlanningReferences(accountScope,body);return body;};
    if(await handlePlannerIof(req,res,pathname,{scope:accountScope,user,readBody:readScopedBody,exactContext,handoffAssociation}))return true;
    if (pathname === `${BASE}/context` && req.method === "GET") {

      const tenantProducts = await listRecords(DIRS.products, { projectRepositoryAuthority: false });
      const products = tenantProducts.some((item) => item.productId === DOCTRINE.productId)
        ? tenantProducts
        : [...tenantProducts, sharedCanonicalProductProjection()];
      const includeArchived = url.searchParams.get("includeArchived") === "true";
      const planningIdentities = await planningIdentityContext({ includeArchived, requestingOrganizationId: user.organizationId });
      const durablePlanningAccounts = planningIdentities.accounts.filter((item) => item.lifecycleStatus === "PLANNING_ACCOUNT").map(planningAccountProjection);
      const durablePlanningOpportunities = planningIdentities.opportunities.filter((item) => item.lifecycleStatus === "PLANNING_OPPORTUNITY").map(planningOpportunityProjection);
      jsonResponse(res, 200, {
        schemaVersion: "CIP-117-PLANNER-OPERATING-CONTEXT-V1",
        adapter: "GOVERNED_PLANNER_OPERATING_CONTEXT",
        contextRequired: true,
        planningContext: accountScope?authoritativePlanningContext(accountScope):null,
        accounts: accountScope?durablePlanningAccounts.filter(item=>item.accountId===accountScope.subjectAccountId):durablePlanningAccounts,
        opportunities: accountScope?durablePlanningOpportunities.filter(item=>item.accountId===accountScope.subjectAccountId):[], accountDirectory: accountScope?undefined:planningIdentities.accountDirectory, doctrine: DOCTRINE,
        products: safeProducts(products),
        doctrineBinding: LAYER1_PLANNER_DOCTRINE,
        siteRecipeApprovalAcknowledgement: SITE_RECIPE_APPROVAL_ACKNOWLEDGEMENT,
        portfolioSubmitAcknowledgement: P05_PORTFOLIO_SUBMIT_ACKNOWLEDGEMENT,
        promotionAcknowledgement: P05A_PROMOTION_ACKNOWLEDGEMENT,
        planningInputs: { sourceHash: null, validatedSites: 0, humanReviewRequired: 0 },
        universe: { revision: null, rightsRevision: null, layerCount: 0, featureCount: 0, persistentGlobalRegistry: false, engagementProjection: false },
      });
      return true;
    }
    if (pathname === `${BASE}/promotions` && req.method === "POST") {
      const body = await readScopedBody();
      if (body.acknowledgement !== true || text(body.acknowledgementText) !== P05A_PROMOTION_ACKNOWLEDGEMENT) fail("PLANNING_PROMOTION_ACKNOWLEDGEMENT_REQUIRED", 400);
      const promoted = await promotePlanningIdentity({ plannerAccountId: text(body.planningAccountId), plannerOpportunityId: text(body.planningOpportunityId) }, user);
      jsonResponse(res, promoted.idempotent ? 200 : 201, { ...promoted, authorizedIdentityMutation: !promoted.idempotent, downstreamAuthorityCreated: false });
      return true;
    }
    if (pathname === `${BASE}/plans` && req.method === "GET") {
      const accountId = accountScope.subjectAccountId;
      const opportunityId = text(url.searchParams.get("opportunityId"));
      const items = await listNetworkPlans({ accountId, opportunityId });
      jsonResponse(res, 200, { schemaVersion: "CIP-117-NETWORK-PLAN-DIRECTORY-V1", items, count: items.length });
      return true;
    }
    const networkDisplayMatch = pathname.match(new RegExp(`^${BASE}/plans/([^/]+)/network-display$`));
    if (networkDisplayMatch && req.method === "GET") {
      assertPlanningResourceScope(accountScope,(await openNetworkPlan(decodeURIComponent(networkDisplayMatch[1]))).plan);
      const planId=decodeURIComponent(networkDisplayMatch[1]);
      let display;try{display=await readCustomerSafeNetworkDisplay({planId,query});}catch(error){if(error.code!=='CUSTOMER_NETWORK_MAP_DISPLAY_NOT_AUTHORIZED')throw error;display=await accountPlanningNetworkDisplay({actor:accountScope,planId,query});}
      jsonResponse(res, 200, display);
      return true;
    }
    const networkExportMatch = pathname.match(new RegExp(`^${BASE}/plans/([^/]+)/network-display/export$`));
    if (networkExportMatch && req.method === "GET") {
      denyCustomerNetworkExport();
    }
    const reanalysisMatch=pathname.match(new RegExp(`^${BASE}/plans/([^/]+)/reanalyze-layer1$`));
    if(reanalysisMatch&&req.method==='POST'){
      const opened=await openNetworkPlan(decodeURIComponent(reanalysisMatch[1]));assertPlanningResourceScope(accountScope,opened.plan);
      const body=await readScopedBody();
      if(Object.keys(body).some(key=>!['expectedRevisionHash','networkClass'].includes(key)))fail('LAYER1_REANALYSIS_FIELDS_FORBIDDEN',400);
      const result=await reanalyzeNetworkPlanLayer1({opened,expectedRevisionHash:text(body.expectedRevisionHash),networkClass:text(body.networkClass),user});
      jsonResponse(res,result.idempotent?200:201,{...result,commercialMutation:false,engineeringMutation:false,universeMutation:false});return true;
    }
    const planMatch = pathname.match(new RegExp(`^${BASE}/plans/([^/]+)$`));
    if (planMatch && req.method === "GET") {
      let opened=await openNetworkPlan(decodeURIComponent(planMatch[1]));assertPlanningResourceScope(accountScope,opened.plan);
      if(url.searchParams.get('revisionId'))opened=await openNetworkPlan(opened.plan.planId,url.searchParams.get('revisionId'));
      const revisions=(await listRecords(DIRS.networkPlanRevisions,{projectRepositoryAuthority:false})).filter(r=>r.planId===opened.plan.planId&&r.accountId===opened.plan.accountId&&r.customerOrganizationId===opened.plan.customerOrganizationId).map(r=>({planRevisionId:r.planRevisionId,revisionNumber:r.revisionNumber})).sort((a,b)=>b.revisionNumber-a.revisionNumber);
      jsonResponse(res, 200, { ...opened, revisions, planningContext:authoritativePlanningContext(accountScope,{opportunity_id:opened.plan.customerPlanningOpportunityId||opened.plan.opportunityId,product_id:opened.plan.productId,plan_id:opened.plan.planId,revision_id:opened.revision?.planRevisionId}), mutationPerformed: false });
      return true;
    }
    if (pathname === `${BASE}/plans/save` && req.method === "POST") {
      const body = await readScopedBody();
      const { account, opportunity } = await exactContext(body);
      const { planner, commercial } = await loadPlanningProjection(user, query, text(body.programStart) || DEFAULT_ASSUMED_PROGRAM_START_DATE, { ...body, planningAdapter: account.planningAdapter });
      const recipes = await siteRecipePortfolio({ user, query, account, opportunity, planner, commercial, programStart: text(body.programStart) });
      const scenarios = await completeFluidstackScenarioInventory({ inputScenarios: body.scenarios, selectedSolution: body.selectedSolution, user, query, planner, commercial, programStart: text(body.programStart) });
      const saved = await saveNetworkPlan({ input: { ...body, scenarios, siteRecipeSummary: recipes.summary, calculationReferences: { ...(body.calculationReferences || {}), scenarioInventoryAuthority: "PROTECTED_FLUIDSTACK_ROUTES_PLUS_HUMAN_COMPARE_SELECTIONS", scenarioInventoryRouteCount: scenarios.length, scenarioInventorySiteCount: new Set(scenarios.map((item) => item.siteRevisionId)).size } }, account, opportunity, user });
      jsonResponse(res, saved.idempotent ? 200 : 201, { ...saved, commercialMutation: false, universeMutation: false, downstreamAuthorityCreated: false });
      return true;
    }
    if (pathname === `${BASE}/site-recipes` && req.method === 'GET' && url.searchParams.has('networkPlanId')) {
      const input=Object.fromEntries(url.searchParams),opened=await openNetworkPlan(input.networkPlanId);
      if(opened.revision.planRevisionHash!==input.networkPlanRevisionHash||opened.plan.accountId!==input.accountId||opened.plan.opportunityId!==input.opportunityId)fail('SITE_RECIPE_PLAN_LINEAGE_MISMATCH',409);
      const scenarios=opened.revision.scenarios||[];
      const currentScenarioByKey=new Map(scenarios.map(s=>[`${s.siteRevisionId}|${s.candidateId}`,{routeGeometryHash:s.geometryHash||s.routeGeometryHash,routeRevisionId:s.routeId||s.routeRevisionId,routeFeet:s.routeFeet}]));
      jsonResponse(res,200,{...(await listSitePlanningRecipes({accountId:input.accountId,opportunityId:input.opportunityId,currentScenarioByKey,totalSites:Number(opened.revision.siteRecipeSummary?.totalSites||new Set(scenarios.map(s=>s.siteRevisionId)).size)})),approvalAcknowledgementText:SITE_RECIPE_APPROVAL_ACKNOWLEDGEMENT});return true;
    }
    if (pathname === `${BASE}/site-recipes` && req.method === "GET") {
      const input = { accountId: text(url.searchParams.get("accountId")), opportunityId: text(url.searchParams.get("opportunityId")), programStart: text(url.searchParams.get("start")) };
      const { account, opportunity } = await exactContext(input);
      const { planner, commercial } = await loadPlanningProjection(user, query, input.programStart || DEFAULT_ASSUMED_PROGRAM_START_DATE, { ...input, planningAdapter: account.planningAdapter });
      const portfolio = await siteRecipePortfolio({ user, query, account, opportunity, planner, commercial, programStart: input.programStart });
      jsonResponse(res, 200, { schemaVersion: "CIP-117D-SITE-RECIPE-PORTFOLIO-V1", ...portfolio, approvalAcknowledgementText: SITE_RECIPE_APPROVAL_ACKNOWLEDGEMENT, commercialMutation: false, engineeringMutation: false, universeMutation: false, downstreamAuthorityCreated: false });
      return true;
    }
    if (pathname === `${BASE}/site-recipes/save` && req.method === "POST") {
      const body = await readScopedBody();
      if(body.networkPlanId){const saved=await persistedRecipeOperation(body,user,false,accountScope);jsonResponse(res,saved.idempotent?200:201,saved);return true;}
      const { account, opportunity } = await exactContext(body);
      const { planner, commercial } = await loadPlanningProjection(user, query, text(body.programStart) || DEFAULT_ASSUMED_PROGRAM_START_DATE, { ...body, planningAdapter: account.planningAdapter });
      const scenario = await exactSiteScenario({ user, query, planner, commercial, siteRevisionId: body.siteRevisionId, candidateId: body.candidateId, programStart: body.programStart });
      const saved = await saveSitePlanningRecipe({ input: body, context: siteRecipeContext(account, opportunity, body), scenario, user });
      jsonResponse(res, saved.idempotent ? 200 : 201, { ...saved, projection: (await siteRecipePortfolio({ user, query, account, opportunity, planner, commercial, programStart: body.programStart })).items.find((item) => item.sitePlanningRecipeId === saved.recipe.sitePlanningRecipeId), commercialMutation: false, engineeringMutation: false, universeMutation: false, downstreamAuthorityCreated: false });
      return true;
    }
    if (pathname === `${BASE}/site-recipes/approve` && req.method === "POST") {
      const body = await readScopedBody();
      if(body.networkPlanId){const approved=await persistedRecipeOperation(body,user,true,accountScope);jsonResponse(res,200,approved);return true;}
      const { account, opportunity } = await exactContext(body);
      const { planner, commercial } = await loadPlanningProjection(user, query, text(body.programStart) || DEFAULT_ASSUMED_PROGRAM_START_DATE, { ...body, planningAdapter: account.planningAdapter });
      const scenario = await exactSiteScenario({ user, query, planner, commercial, siteRevisionId: body.siteRevisionId, candidateId: body.candidateId, programStart: body.programStart });
      const approved = await approveSitePlanningRecipe({ input: body, context: siteRecipeContext(account, opportunity, body), scenario, user });
      jsonResponse(res, approved.idempotent ? 200 : 201, { ...approved, projection: (await siteRecipePortfolio({ user, query, account, opportunity, planner, commercial, programStart: body.programStart })).items.find((item) => item.sitePlanningRecipeId === approved.recipe.sitePlanningRecipeId), commercialMutation: false, engineeringMutation: false, universeMutation: false, downstreamAuthorityCreated: false });
      return true;
    }
    if (pathname === `${BASE}/synthesize` && req.method === "POST") {
      const body = await readScopedBody();
      const { account, opportunity } = await exactContext(body);
      if (text(body.productId) !== DOCTRINE.productId || text(body.productDoctrineId) !== DOCTRINE.productDoctrineId) fail("PLANNER_PRODUCT_SYNTHESIS_NOT_IMPLEMENTED", 422);
      const { planner, commercial } = await loadPlanningProjection(user, query, text(body.programStart) || DEFAULT_ASSUMED_PROGRAM_START_DATE, { ...body, planningAdapter: account.planningAdapter });
      const doctrineResolution = resolveLayer1PlannerDoctrine({ ...body, routeFeet: commercial.rollup.totalAccessConstructionMiles * 5280, topology: planner.intent.topology });
      jsonResponse(res, 200, { schemaVersion: "CIP-117BC-SYNTHESIS-ORCHESTRATION-V1", orchestration: "CANONICAL_PRODUCT_DOCTRINE_ADAPTER_TO_EXISTING_FLUIDSTACK_MULTI_SITE_ENGINE", protectedEngineModified: false, context: { accountId: account.accountId, opportunityId: opportunity.opportunityId, productId: DOCTRINE.productId, productDoctrineId: DOCTRINE.productDoctrineId, productDoctrineVersion: DOCTRINE.productDoctrineVersion }, doctrineResolution, result: { planningProjectionFingerprint: planner.projectionFingerprint, commercialProjectionFingerprint: commercial.fingerprint, siteCount: planner.sites.filter((item) => item.validation_state === "VALIDATED").length, routedSiteCount: commercial.rollup.sitesWithPhysicalCarrierAccess, accessMiles: commercial.rollup.totalAccessConstructionMiles, preliminaryCost: commercial.rollup.knownPreliminaryConstructionCost, earliestForecast: commercial.rollup.earliestForecastDelivery, layerCount: planner.layers.length }, authority: "NON_AUTHORITATIVE_DETERMINISTIC_PLANNING", commercialMutation: false, universeMutation: false, downstreamAuthorityCreated: false });
      return true;
    }
    if (pathname === `${BASE}/universe-impact` && req.method === "POST") {
      const body = await readScopedBody();
      const { account } = await exactContext(body);
      const { planner } = await loadPlanningProjection(user, query, DEFAULT_ASSUMED_PROGRAM_START_DATE, { ...body, planningAdapter: account.planningAdapter });
      const siteIds = new Set(Array.isArray(body.siteRevisionIds) ? body.siteRevisionIds.map(text) : []);
      const relationships = planner.candidates.filter((item) => !siteIds.size || siteIds.has(item.site_revision_id)).map((item) => ({ siteRevisionId: item.site_revision_id, candidateId: item.candidate_id, provider: item.provider, layerId: item.layer_id, relationship: "PROXIMITY_AND_CANDIDATE_INTERCEPT", distanceMeters: item.distance_meters, evidenceClassification: item.evidence_classification, ownershipInferred: false, serviceability: "UNKNOWN" }));
      jsonResponse(res, 200, { schemaVersion: "CIP-117-PROPOSED-NETWORK-UNIVERSE-IMPACT-V1", analysisMode: "EXISTING_SITE_TO_NETWORK_SPATIAL_RELATIONSHIPS", relationships, supportedRelationships: ["APPROACHES", "CAN_INTERCEPT"], deferredRelationships: ["INTERSECTS_CUSTOM_GEOMETRY", "OVERLAPS", "PARALLELS", "COULD_REUSE", "SHARED_CORRIDOR", "DIVERSITY_CONFLICT", "DIVERSITY_OPPORTUNITY"], customerGeometryAdmittedToUniverse: false, authority: "PLANNING_RELATIONSHIP_ONLY", mutationPerformed: false });
      return true;
    }
    if (pathname === `${BASE}/portfolio` && req.method === "GET") {
      const result = await listPortfolioPlanning({ accountId: accountScope.subjectAccountId, opportunityId: text(url.searchParams.get("opportunityId")) });
      jsonResponse(res, 200, { schemaVersion: "CIP-P05-PORTFOLIO-DIRECTORY-V1", ...result });
      return true;
    }
    const portfolioMatch = pathname.match(new RegExp(`^${BASE}/portfolio/([^/]+)$`));
    if (portfolioMatch && req.method === "GET") {
      const opened=await openPortfolioPlanning(decodeURIComponent(portfolioMatch[1]));assertPlanningResourceScope(accountScope,opened.package);
      jsonResponse(res, 200, opened);
      return true;
    }
    if (pathname === `${BASE}/portfolio/prepare` && req.method === "POST") {
      const body = await readScopedBody(), { account, opportunity } = await exactContext(body);
      if (account.governedCreationIntent || opportunity.governedCreationIntent) fail("P05_GOVERNED_ACCOUNT_OPPORTUNITY_REQUIRED", 409);
      const networkPlan = await openNetworkPlan(text(body.networkPlanId));
      if (!networkPlanMatchesContext(networkPlan.plan, account.accountId, opportunity.opportunityId)) fail("P05_NETWORK_PLAN_CONTEXT_MISMATCH", 409);
      if (text(body.networkPlanRevisionId) !== networkPlan.revision.planRevisionId || text(body.networkPlanRevisionHash) !== networkPlan.revision.planRevisionHash) fail("P05_NETWORK_PLAN_REVISION_MISMATCH", 409);
      const { planner, commercial } = await loadPlanningProjection(user, query, text(body.programStart) || DEFAULT_ASSUMED_PROGRAM_START_DATE, { ...body, planningAdapter: account.planningAdapter });
      const recipes = await siteRecipePortfolio({ user, query, account, opportunity, planner, commercial, programStart: text(body.programStart) });
      const siteInputs = await p05SiteInputs(planner, commercial, recipes, networkPlan, { user, query, programStart: text(body.programStart) });
      const prepared = await preparePortfolioPlanning({ openedNetworkPlan: networkPlan, source: p05Source({ account, opportunity, networkPlan, planner }), siteInputs, user });
      jsonResponse(res, prepared.idempotent ? 200 : 201, { ...prepared, summary: (await openPortfolioPlanning(prepared.package.portfolioPlanningPackageId)).summary, engineeringAcceptanceCreated: false, governedMutationPerformed: false });
      return true;
    }
    if (pathname === `${BASE}/portfolio/accept-recommendations` && req.method === "POST") {
      const body = await readScopedBody();
      const accepted = await acceptPlanningRecommendations({ packageId: body.portfolioPlanningPackageId, expectedRevisionHash: body.expectedRevisionHash, user });
      jsonResponse(res, accepted.idempotent ? 200 : 201, { ...accepted, summary: (await openPortfolioPlanning(accepted.package.portfolioPlanningPackageId)).summary, engineeringAcceptanceCreated: false, governedMutationPerformed: false });
      return true;
    }
    if (pathname === `${BASE}/portfolio/select-route` && req.method === "POST") {
      const body = await readScopedBody();
      const selected = await selectPortfolioRoute({ packageId: body.portfolioPlanningPackageId, expectedRevisionHash: body.expectedRevisionHash, siteRevisionId: body.siteRevisionId, routeId: body.routeId, reason: body.reason, user });
      jsonResponse(res, selected.idempotent ? 200 : 201, { ...selected, summary: (await openPortfolioPlanning(selected.package.portfolioPlanningPackageId)).summary, engineeringAcceptanceCreated: false, governedMutationPerformed: false });
      return true;
    }
    if (pathname === `${BASE}/portfolio/export` && req.method === "POST") {
      const body = await readScopedBody(), { account, opportunity } = await exactContext(body);
      const created = await createPortfolioExport({ packageId: body.portfolioPlanningPackageId, expectedRevisionHash: body.expectedRevisionHash, accountName: account.name, opportunityName: opportunity.name, user });
      const exportId = created.export.exportId;
      jsonResponse(res, created.idempotent ? 200 : 201, { export: { ...created.export, snapshot: undefined, downloads: { customerKmz: `${BASE}/portfolio/exports/${encodeURIComponent(exportId)}/customer.kmz?planningAccountId=${encodeURIComponent(accountScope.subjectAccountId)}`, customerWorkbook: `${BASE}/portfolio/exports/${encodeURIComponent(exportId)}/customer.xlsx?planningAccountId=${encodeURIComponent(accountScope.subjectAccountId)}`, internalKmz: `${BASE}/portfolio/exports/${encodeURIComponent(exportId)}/internal.kmz?planningAccountId=${encodeURIComponent(accountScope.subjectAccountId)}`, internalWorkbook: `${BASE}/portfolio/exports/${encodeURIComponent(exportId)}/internal.xlsx?planningAccountId=${encodeURIComponent(accountScope.subjectAccountId)}` }, reconciliation: `${BASE}/portfolio/exports/${encodeURIComponent(exportId)}/reconciliation?planningAccountId=${encodeURIComponent(accountScope.subjectAccountId)}` }, idempotent: created.idempotent, engineeringAcceptanceCreated: false, governedMutationPerformed: false });
      return true;
    }
    const exportMatch = pathname.match(new RegExp(`^${BASE}/portfolio/exports/([^/]+)/(customer\\.kmz|customer\\.xlsx|internal\\.kmz|internal\\.xlsx|reconciliation)$`));
    if (exportMatch && req.method === "GET") {
      const record = await openPortfolioExport(decodeURIComponent(exportMatch[1])), kind = exportMatch[2];
      assertPlanningResourceScope(accountScope,(await openPortfolioPlanning(record.sourcePortfolioPlanningPackageId)).package);
      if (kind === "reconciliation") { jsonResponse(res, 200, reconcilePortfolioExport(record)); return true; }
      const body = await renderPortfolioExport(record, kind), workbook = kind.endsWith(".xlsx"), expectedHash = kind === "customer.kmz" ? record.customerKmzHash : kind === "customer.xlsx" ? record.customerWorkbookHash : kind === "internal.kmz" ? record.internalKmzHash : record.internalWorkbookHash;
      res.writeHead(200, { "Content-Type": workbook ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" : "application/vnd.google-earth.kmz", "Content-Disposition": `attachment; filename="${record.exportId}-${kind}"`, "Content-Length": body.length, "X-Teralinx-Export-Hash": expectedHash, "Cache-Control": "private, no-store", ...corsHeaders() });
      res.end(body);
      return true;
    }
    if (pathname === `${BASE}/portfolio/submit` && req.method === "POST") {
      if (!userHasPermission(user, 'opportunity.manage')) fail('PLANNER_COMMERCIAL_HANDOFF_NOT_AUTHORIZED', 403);
      const body = await readScopedBody();
      if (body.acknowledgement !== true || text(body.acknowledgementText) !== P05_PORTFOLIO_SUBMIT_ACKNOWLEDGEMENT) fail("P05_PORTFOLIO_SUBMIT_ACKNOWLEDGEMENT_REQUIRED", 400);
      const { account, opportunity } = await exactContext(body);
      if (account.governedCreationIntent || opportunity.governedCreationIntent) fail("P05_GOVERNED_ACCOUNT_OPPORTUNITY_REQUIRED", 409);
      const associate = await handoffAssociation(account, opportunity, user);
      const exported = await openPortfolioExport(text(body.exportId));
      const portfolio = await openPortfolioPlanning(exported.sourcePortfolioPlanningPackageId);
      if (portfolio.revision.portfolioPlanningRevisionId !== exported.sourcePortfolioRevisionId || portfolio.revision.portfolioRevisionHash !== exported.sourcePortfolioRevisionHash) fail("P05_EXPORT_NOT_CURRENT_PORTFOLIO_REVISION", 409);
      if (!((portfolio.package.accountId === account.accountId || portfolio.package.canonicalAccountId === account.accountId) && (portfolio.package.opportunityId === opportunity.opportunityId || portfolio.package.canonicalOpportunityId === opportunity.opportunityId))) fail("P05_PORTFOLIO_COMMERCIAL_CONTEXT_MISMATCH", 409);
      const artifactBasis = {
        schemaVersion: "CIP-P05-PORTFOLIO-PLANNER-ARTIFACT-V1", status: "SUBMITTED_TO_COMMERCIAL_PLANNING",
        context: { environment: currentRepositoryAuthority().authorityClass, accountId: account.accountId, customerId: account.customerId, customerOrganizationId: account.customerOrganizationId || null, opportunityId: opportunity.opportunityId, productId: portfolio.revision.productId, productDoctrineId: portfolio.revision.productDoctrineId, productDoctrineVersion: portfolio.revision.productDoctrineVersion, productDoctrineHash: portfolio.revision.productDoctrineHash, networkPlanId: portfolio.revision.sourceNetworkPlanId, networkPlanRevisionId: portfolio.revision.sourceNetworkPlanRevisionId, networkPlanRevisionHash: portfolio.revision.sourceNetworkPlanRevisionHash, portfolioPlanningPackageId: portfolio.package.portfolioPlanningPackageId, portfolioPlanningRevisionId: portfolio.revision.portfolioPlanningRevisionId, portfolioPlanningRevisionHash: portfolio.revision.portfolioRevisionHash, portfolioExportId: exported.exportId, portfolioExportHash: exported.exportRecordHash },
        selectedSolution: { selectedSiteRevisionId: portfolio.package.portfolioPlanningPackageId, selectedCarrier: "PORTFOLIO", selectedCandidateId: exported.exportId, selectedRouteCount: exported.routeManifest.length },
        preliminaryCommercialInputs: { routeLengthMiles: exported.routeManifest.reduce((sum, item) => sum + Number(item.routeMiles || 0), 0), preliminaryCost: portfolio.revision.sites.reduce((sum, site) => { const route = site.routes.find((item) => item.routeId === site.decision.selectedRouteId); return sum + Number(route?.preliminaryCost || 0); }, 0), estimateAuthority: false, commercialRouteAuthority: false },
        alternatives: exported.routeManifest, unresolvedItems: [...new Set(portfolio.revision.sites.flatMap((site) => site.evidenceGaps || []))].sort(),
        submissionEvidence: { submittedAt: nowIso(), submittingPrincipalId: user.principalId, submittingMembershipId: user.membershipId, acknowledgementText: P05_PORTFOLIO_SUBMIT_ACKNOWLEDGEMENT },
        authority: { planningOnly: true, governedEstimate: false, commercialRoute: false, proposal: false, engineeringAcceptance: false, serviceOrder: false, scopeVersion: false, downstreamAuthorityCreated: false }, immutable: true,
      };
      const artifactHash = contentCanonicalHash({ ...artifactBasis, submissionEvidence: { ...artifactBasis.submissionEvidence, submittedAt: null } }), plannerArtifactId = `PLANNER-ARTIFACT-${currentRepositoryAuthority().authorityClass === "DEMO" ? "DEMO-" : ""}${artifactHash.slice(0,32)}`;
      const artifact = { plannerArtifactId, artifactHash, submittedArtifactHash: contentCanonicalHash({ plannerArtifactId, artifactHash, submissionEvidence: artifactBasis.submissionEvidence }), ...artifactBasis };
      const receiptBasis = { schemaVersion: "CIP-P05-COMMERCIAL-PLANNING-PORTFOLIO-INTAKE-V1", plannerArtifactId, plannerArtifactHash: artifactHash, accountId: account.accountId, customerId: account.customerId, opportunityId: opportunity.opportunityId, productDoctrineId: portfolio.revision.productDoctrineId, productDoctrineVersion: portfolio.revision.productDoctrineVersion, portfolioPlanningRevisionId: portfolio.revision.portfolioPlanningRevisionId, portfolioPlanningRevisionHash: portfolio.revision.portfolioRevisionHash, portfolioExportId: exported.exportId, receivedAt: artifactBasis.submissionEvidence.submittedAt, receivedByPrincipalId: user.principalId, receivedByMembershipId: user.membershipId, disposition: "AVAILABLE_TO_EXISTING_COMMERCIAL_PLANNING", commercialObjectsCreated: [], commercialObjectsMutated: [opportunity.opportunityId], downstreamAuthorityCreated: false };
      const saved = await persistPlanningHandoff(accountScope, artifact, stored => {
        const basis = { ...receiptBasis, receivedAt: stored.submissionEvidence.submittedAt, receivedByPrincipalId: stored.submissionEvidence.submittingPrincipalId, receivedByMembershipId: stored.submissionEvidence.submittingMembershipId, commercialObjectsMutated: opportunity.canonicalOpportunityId ? [opportunity.canonicalOpportunityId] : [] };
        const hash = contentCanonicalHash(basis);
        return { ...basis, commercialPlanningIntakeId: `COMMERCIAL-PLANNING-INTAKE-${currentRepositoryAuthority().authorityClass === 'DEMO' ? 'DEMO-' : ''}${hash.slice(0,32)}`, receiptHash: hash, immutable: true };
      }, associate);
      jsonResponse(res, saved.idempotent ? 200 : 201, { ...saved, receipt: intakeProjection(saved.receipt, saved.artifact), navigation: { workspace: "googleRfp", label: "Open Commercial Planning" }, downstreamAuthorityCreated: false });
      return true;
    }
    if (pathname === `${BASE}/commercial-intakes` && req.method === "GET") {
      const opportunityId = text(url.searchParams.get("opportunityId"));
      const intakeId = text(url.searchParams.get('intakeId'));
      const receipts = (await listRecords(DIRS.commercialPlanningIntakes, { projectRepositoryAuthority: false, readOnly: true })).filter((item) => item.accountId===accountScope.subjectAccountId&&(!opportunityId || item.opportunityId === opportunityId)&&(!intakeId || item.commercialPlanningIntakeId === intakeId));
      if (intakeId && receipts.length !== 1) fail('PLANNING_RESOURCE_NOT_FOUND', 404);
      const items = await Promise.all(receipts.map(async receipt => {
        const artifact = await loadRecord(DIRS.plannerArtifacts, receipt.plannerArtifactId, { projectRepositoryAuthority: false, readOnly: true });
        validateHandoffBinding(accountScope, receipt, artifact);
        if(artifact.schemaVersion==='IOF-PLANNER-ARTIFACT-V2'){
          const {validateIofIntake}=await import('../network-planning/iof-package-outputs.js');
          await validateIofIntake(accountScope,receipt,artifact);
        }
        return intakeProjection(receipt, artifact);
      }));
      jsonResponse(res, 200, { schemaVersion: "CIP-116-COMMERCIAL-PLANNING-INTAKE-DIRECTORY-V1", items, count: items.length });
      return true;
    }
    if (pathname === `${BASE}/artifacts/preview` && req.method === "POST") {
      const body = await readScopedBody();
      const { account, opportunity } = await exactContext(body);
      const { planner, commercial } = await loadPlanningProjection(user, query, text(body.programStart) || DEFAULT_ASSUMED_PROGRAM_START_DATE, { ...body, planningAdapter: account.planningAdapter });
      const networkPlan = await assertNetworkPlanReference(body, account, opportunity);
      const built = await artifactFromProjection({ user, body, planner, commercial, account, opportunity, query, networkPlan });
      jsonResponse(res, 200, { artifact: built.artifact, review: { account: { accountId: account.accountId, name: account.name }, customer: { customerId: account.customerId, organizationId: account.customerOrganizationId }, opportunity: { opportunityId: opportunity.opportunityId, name: opportunity.name }, site: built.plan.siteName, carrier: built.selected.carrier, routeMiles: built.selected.route.miles, preliminaryCost: built.selected.cost.knownTotal, forecast: built.selected.schedule.forecast, unresolvedItems: built.artifact.unresolvedItems }, acknowledgementText: PLANNER_SUBMIT_ACKNOWLEDGEMENT, mutationPerformed: false });
      return true;
    }
    if (pathname === `${BASE}/artifacts/submit` && req.method === "POST") {
      if (!userHasPermission(user, 'opportunity.manage')) fail('PLANNER_COMMERCIAL_HANDOFF_NOT_AUTHORIZED', 403);
      const body = await readScopedBody();
      if (body.acknowledgement !== true || text(body.acknowledgementText) !== PLANNER_SUBMIT_ACKNOWLEDGEMENT) fail("PLANNER_SUBMIT_ACKNOWLEDGEMENT_REQUIRED", 400);
      const { account, opportunity } = await exactContext(body);
      const { planner, commercial } = await loadPlanningProjection(user, query, text(body.programStart) || DEFAULT_ASSUMED_PROGRAM_START_DATE, { ...body, planningAdapter: account.planningAdapter });
      const networkPlan = await assertNetworkPlanReference(body, account, opportunity);
      const built = await artifactFromProjection({ user, body, planner, commercial, account, opportunity, query, networkPlan });
      if (text(body.expectedArtifactHash) !== built.artifact.artifactHash) fail("PLANNER_ARTIFACT_PREVIEW_CHANGED", 409);
      const associate = await handoffAssociation(account, opportunity, user);
      const submittedAt = nowIso();
      const artifact = submittedPlannerArtifact(built.artifact, user, submittedAt);
      await persistRecord(DIRS.plannerSessions, built.session.plannerSessionId, built.session);
      await persistRecord(DIRS.plannerInputs, built.plannerInput.plannerInputId, built.plannerInput);
      const saved = await persistPlanningHandoff(accountScope, artifact, stored => commercialPlanningReceipt(stored, opportunity, { principalId: stored.submissionEvidence.submittingPrincipalId, membershipId: stored.submissionEvidence.submittingMembershipId }, stored.submissionEvidence.submittedAt), associate);
      jsonResponse(res, saved.idempotent ? 200 : 201, { ...saved, receipt: intakeProjection(saved.receipt, saved.artifact), opportunityReferenceAdded: Boolean(opportunity.canonicalOpportunityId), navigation: { workspace: "googleRfp", label: "Open Commercial Planning" }, downstreamAuthorityCreated: false });
      return true;
    }
    errorResponse(res, 405, "Network Planner intake method not allowed.");
  } catch (error) {
    errorResponse(res, Number(error?.status) || 500, error?.code || error?.message || "NETWORK_PLANNER_FAILED");
  }
  return true;
}
