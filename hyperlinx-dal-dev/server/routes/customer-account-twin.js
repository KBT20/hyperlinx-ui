import { DIRS, listRecords, sortedByUpdated } from "./_shared.js";

export const CUSTOMER_DEAL_STATES = [
  "DRAFT", "PROPOSED", "CUSTOMER_REVIEW", "ACCEPTED", "ENGINEERING", "CERTIFIED",
  "SERVICE_ORDER", "CUSTOMER_SIGNED", "COUNTERSIGNED", "AUTHORIZED",
];

const text = (value, fallback = "") => String(value ?? fallback).trim() || String(fallback).trim();
const array = (value) => Array.isArray(value) ? value : value == null || value === "" ? [] : [value];
const record = (value) => value && typeof value === "object" && !Array.isArray(value) ? value : {};
const number = (value) => Number.isFinite(Number(value)) ? Number(value) : null;
const newest = (records) => sortedByUpdated(records)[0] ?? null;

function hasPermission(user, permission) {
  return Array.isArray(user?.permissions) && user.permissions.includes(permission);
}

function deriveState({ proposal, reviewPackage, engineeringPackage, certifiedPackage, serviceOrder, scopeVersion }) {
  if (scopeVersion?.scopeVersionId) return "AUTHORIZED";
  if (serviceOrder?.status === "COUNTERSIGNED" || serviceOrder?.countersignedAt) return "COUNTERSIGNED";
  if (serviceOrder?.status === "CUSTOMER_ACCEPTED" || serviceOrder?.customerSignedAt || serviceOrder?.customerSignatureId) return "CUSTOMER_SIGNED";
  if (serviceOrder?.serviceOrderId) return "SERVICE_ORDER";
  if (certifiedPackage?.certifiedPackageId) return "CERTIFIED";
  if (engineeringPackage?.engineeringPackageId) return "ENGINEERING";
  if (proposal?.approvalState === "APPROVED") return "ACCEPTED";
  if (reviewPackage?.customerReviewPackageId) return "CUSTOMER_REVIEW";
  if (proposal?.proposalId && !["DRAFT", "SAVED"].includes(text(proposal.status).toUpperCase())) return "PROPOSED";
  return "DRAFT";
}

function permittedActions(state, { lens, persona, user, serviceOrder }) {
  const actions = [
    { action: "INSPECT_DEAL", label: "Open deal", authority: "READ_PROJECTION", mutation: false },
    { action: "VIEW_GOVERNED_MAP", label: "View map", authority: "READ_PROJECTION", mutation: false },
    { action: "VIEW_GOVERNED_DOCUMENTS", label: "View documents", authority: "READ_PROJECTION", mutation: false },
  ];
  if (lens === "CUSTOMER") {
    const mayReview = persona === "CUSTOMER_COMMERCIAL_REVIEWER" || persona === "CUSTOMER_AUTHORIZED_SIGNER";
    if (state === "CUSTOMER_REVIEW" && mayReview) actions.push(
      { action: "ACCEPT_PROPOSAL_REVISION", label: "Accept exact revision", authority: persona, mutation: true },
      { action: "REQUEST_PROPOSAL_CHANGE", label: "Request change", authority: persona, mutation: true },
      { action: "DECLINE_PROPOSAL_REVISION", label: "Decline exact revision", authority: persona, mutation: true },
    );
    if (state === "SERVICE_ORDER" && serviceOrder?.status === "ISSUED" && persona === "CUSTOMER_AUTHORIZED_SIGNER") {
      actions.push({ action: "SIGN_SERVICE_ORDER", label: "Sign exact Service Order", authority: persona, mutation: true });
    }
    return actions;
  }
  if (state === "DRAFT" && hasPermission(user, "opportunity.manage")) {
    actions.push({ action: "CONTINUE_COMMERCIAL_DRAFT", label: "Continue Commercial draft", authority: "opportunity.manage", mutation: true });
  }
  if (["DRAFT", "PROPOSED"].includes(state) && hasPermission(user, "proposal.manage")) {
    actions.push({ action: "OPEN_PROPOSAL", label: "Open Proposal", authority: "proposal.manage", mutation: true });
  }
  if (["ACCEPTED", "ENGINEERING"].includes(state) && hasPermission(user, "engineering.lifecycle.manage")) {
    actions.push({ action: "OPEN_ENGINEERING", label: "Open Engineering", authority: "engineering.lifecycle.manage", mutation: true });
  }
  if (state === "CUSTOMER_SIGNED" && hasPermission(user, "service_order.countersign")) {
    actions.push({ action: "OPEN_COUNTERSIGNATURE", label: "Review countersignature", authority: "service_order.countersign", mutation: true });
  }
  return actions;
}

function dealTimestamp(...records) {
  return records.filter(Boolean).map((item) => item.updatedAt ?? item.createdAt ?? item.submittedAt ?? "").sort().at(-1) ?? null;
}

function customerSafeProjection({ proposal, reviewPackage, route, serviceOrder }) {
  const configuration = record(proposal?.projectConfiguration ?? reviewPackage?.product?.configuration);
  const quantities = record(proposal?.constructionQuantities ?? reviewPackage?.majorQuantities);
  const pricing = record(proposal?.commercialTerms ?? reviewPackage?.commercialTerms);
  const facingPricing = record(record(proposal?.proposalContent).customerFacingPricing);
  const schedule = record(proposal?.scheduleSummary ?? proposal?.deliverySummary ?? reviewPackage?.schedule);
  const routeFeet = number(route?.routeFeet ?? quantities.routeFeet);
  const routeMiles = number(route?.routeMiles ?? quantities.routeMiles ?? (routeFeet != null ? routeFeet / 5280 : null));
  const assumptions = array(proposal?.commercialAssumptions ?? reviewPackage?.assumptions).map(text).filter(Boolean);
  const exclusions = array(proposal?.exclusions ?? reviewPackage?.exclusions).map(text).filter(Boolean);
  const expectedRouteId = text(proposal?.routeRepositoryId ?? proposal?.routeSnapshot?.routeRepositoryId ?? reviewPackage?.route?.routeRepositoryId);
  const expectedRevision = number(proposal?.routeRevision ?? proposal?.routeSnapshot?.routeRevision ?? reviewPackage?.route?.routeRevision);
  const expectedGeometryId = text(proposal?.routeGeometryId ?? proposal?.routeSnapshot?.routeGeometryId ?? reviewPackage?.route?.routeGeometryId);
  const expectedGeometryHash = text(proposal?.routeGeometryHash ?? proposal?.routeSnapshot?.geometryHash ?? reviewPackage?.route?.geometryHash);
  const lineageChecks = {
    routeRepositoryId: Boolean(expectedRouteId && expectedRouteId === text(route?.routeRepositoryId)),
    routeRevision: Boolean(expectedRevision != null && expectedRevision === number(route?.routeRevision)),
    routeGeometryId: Boolean(expectedGeometryId && expectedGeometryId === text(route?.routeGeometryId)),
    geometryHash: Boolean(expectedGeometryHash && expectedGeometryHash === text(route?.geometryHash)),
    proposalRevisionId: Boolean(proposal?.proposalRevisionId && (!reviewPackage || proposal.proposalRevisionId === reviewPackage.proposalRevisionId)),
    proposalHash: Boolean(proposal?.proposalHash && (!reviewPackage || proposal.proposalHash === reviewPackage.proposalHash)),
  };
  const exactSpine = Object.values(lineageChecks).every(Boolean);
  return {
    product: {
      productId: text(proposal?.productId ?? reviewPackage?.product?.productId) || null,
      name: text(proposal?.productName ?? reviewPackage?.product?.name, "Product not specified"),
      description: text(proposal?.productDescription ?? reviewPackage?.product?.description ?? proposal?.summary) || null,
    },
    route: {
      routeRepositoryId: route?.routeRepositoryId ?? reviewPackage?.route?.routeRepositoryId ?? null,
      routeRevision: route?.routeRevision ?? reviewPackage?.route?.routeRevision ?? null,
      routeRevisionId: route?.routeRevisionId ?? null,
      routeGeometryId: route?.routeGeometryId ?? reviewPackage?.route?.routeGeometryId ?? null,
      geometryHash: route?.geometryHash ?? reviewPackage?.route?.geometryHash ?? null,
      routeMiles, routeFeet,
      endpointA: route?.endpointA ?? route?.endpointAuthority?.aSite ?? route?.aLocation ?? null,
      endpointZ: route?.endpointZ ?? route?.endpointAuthority?.zSite ?? route?.zLocation ?? null,
      coordinates: exactSpine ? array(route?.commercialGeometry) : [],
    },
    economics: {
      currency: text(facingPricing.currency ?? pricing.currency, "USD"),
      nrc: number(facingPricing.nrc ?? pricing.nrc), mrc: number(facingPricing.monthlyOm ?? pricing.monthlyOm ?? pricing.mrc),
      termMonths: number(facingPricing.termMonths ?? pricing.termMonths),
      tcv: number(pricing.tcv ?? pricing.totalContractValue),
      unitPricePerFoot: number(pricing.unitPricePerFoot),
    },
    delivery: {
      targetDate: schedule.targetDate ?? schedule.requestedServiceDate ?? null,
      durationMonths: number(schedule.durationMonths), durationDays: number(schedule.estimatedConstructionDurationDays),
      facilityCount: number(quantities.facilityCount),
    },
    specifications: {
      fiberCount: number(configuration.fiberCount ?? quantities.fiberCount), ductCount: number(configuration.ductCount),
      ductDiameter: number(configuration.ductDiameter), ductMaterial: text(configuration.ductMaterialSpec) || null,
      conduitConfiguration: text(configuration.conduitConfiguration) || null, diversity: text(configuration.diversity ?? proposal?.diversity) || null,
      demarcation: text(configuration.demarcation ?? proposal?.demarcation) || null,
      deliveryConfiguration: text(configuration.deliveryConfiguration) || null,
      maintenanceAssumptions: array(proposal?.maintenanceAssumptions).map(text).filter(Boolean),
    },
    dealPoints: {
      paymentStructure: text(pricing.paymentStructure ?? serviceOrder?.commercialTerms?.paymentTerms) || null,
      customerResponsibilities: array(proposal?.customerResponsibilities).map(text).filter(Boolean),
      teralinxResponsibilities: array(proposal?.teralinxResponsibilities).map(text).filter(Boolean),
      assumptions, exclusions,
      specialConditions: array(proposal?.specialConditions).map(text).filter(Boolean),
    },
    doctrineLineage: {
      productDoctrineId: proposal?.productDoctrineId ?? null, productDoctrineVersion: proposal?.productDoctrineVersion ?? null,
      productDoctrineHash: proposal?.productDoctrineHash ?? null,
    },
    contracting: {
      mode: text(serviceOrder?.contractingMode ?? serviceOrder?.documentBasis?.contractingMode, "TERALINX_PAPER"),
      supportedModes: ["TERALINX_PAPER", "CUSTOMER_PAPER"],
      governingTermsReference: serviceOrder?.commercialTerms?.governingTerms ?? null,
      customerPaperReferences: array(reviewPackage?.customerSafeDocumentReferences).filter((item) => /CUSTOMER|MSA|ORDER_FORM|PURCHASE|SOW/i.test(text(item?.documentType ?? item?.type))),
      demoLegalClassification: proposal?.environment === "DEMO" || serviceOrder?.environment === "DEMO" ? "DEMO_PLACEHOLDER_NOT_APPROVED_LEGAL_TERMS" : null,
    },
    lineage: { status: exactSpine ? "PASS" : "FAIL_CLOSED", checks: lineageChecks, expected: { routeRepositoryId: expectedRouteId, routeRevision: expectedRevision, routeGeometryId: expectedGeometryId, geometryHash: expectedGeometryHash, proposalRevisionId: proposal?.proposalRevisionId ?? null, proposalHash: proposal?.proposalHash ?? null } },
  };
}

function aggregateTasks(deals, portalActions, lens, persona, user) {
  const groups = new Map();
  const add = (taskType, label, dealId) => {
    const current = groups.get(taskType) ?? { taskType, label, dealIds: [] };
    if (!current.dealIds.includes(dealId)) current.dealIds.push(dealId);
    groups.set(taskType, current);
  };
  for (const deal of deals) {
    if (deal.currentState === "AUTHORIZED") add("AUTHORIZED_PROJECT", "Authorized projects", deal.dealId);
    if (lens === "CUSTOMER") {
      if (deal.currentState === "CUSTOMER_REVIEW" && ["CUSTOMER_COMMERCIAL_REVIEWER", "CUSTOMER_AUTHORIZED_SIGNER"].includes(persona)) add("CUSTOMER_PROPOSAL_REVIEW", "Proposals awaiting your review", deal.dealId);
      if (deal.currentState === "SERVICE_ORDER" && persona === "CUSTOMER_AUTHORIZED_SIGNER") add("CUSTOMER_SIGNATURE", "Service Orders awaiting your signature", deal.dealId);
    } else {
      if (deal.currentState === "CUSTOMER_REVIEW" && hasPermission(user, "proposal.manage")) add("COMMERCIAL_CUSTOMER_REVIEW", "Proposals awaiting customer review", deal.dealId);
      if (["ACCEPTED", "ENGINEERING"].includes(deal.currentState) && hasPermission(user, "engineering.lifecycle.manage")) add("ENGINEERING_WORK", "Deals requiring Engineering", deal.dealId);
      if (deal.currentState === "CUSTOMER_SIGNED" && hasPermission(user, "service_order.countersign")) add("TERALINX_COUNTERSIGNATURE", "Service Orders awaiting Teralinx countersignature", deal.dealId);
    }
  }
  for (const action of portalActions.filter((item) => item.action === "REQUEST_CHANGE")) add("CUSTOMER_CHANGE_REQUEST", "Customer change requests", action.opportunityId);
  return [...groups.values()].map((item) => ({ ...item, count: item.dealIds.length }));
}

export async function buildAccountCustomerTwin({ account, user, lens = "INTERNAL", persona = "", allowedOpportunityIds = null }) {
  const [opportunities, proposals, reviewPackages, engineeringPackages, certifiedPackages, serviceOrders, scopeVersions, routes, portalActions] = await Promise.all([
    listRecords(DIRS.commercialOpportunities), listRecords(DIRS.proposalDrafts), listRecords(DIRS.customerReviewPackages),
    listRecords(DIRS.engineeringPackages), listRecords(DIRS.certifiedIofPackages), listRecords(DIRS.serviceOrders), listRecords(DIRS.scopeVersions),
    listRecords(DIRS.commercialRoutes), listRecords(DIRS.customerPortalActions),
  ]);
  const accountId = text(account.accountId);
  const customerId = text(account.customerId);
  const allowed = allowedOpportunityIds ? new Set(allowedOpportunityIds) : null;
  const belongs = (item) => text(item?.accountId) === accountId || (customerId && text(item?.customerId) === customerId);
  const opportunityIds = new Set(opportunities.filter(belongs).map((item) => text(item.opportunityId)).filter(Boolean));
  for (const collection of [proposals, reviewPackages, engineeringPackages, certifiedPackages, serviceOrders]) {
    for (const item of collection) if (belongs(item) && item.opportunityId) opportunityIds.add(text(item.opportunityId));
  }
  if (allowed) {
    for (const opportunityId of [...opportunityIds]) if (!allowed.has(opportunityId)) opportunityIds.delete(opportunityId);
    for (const opportunityId of allowed) opportunityIds.add(opportunityId);
  }
  const deals = [...opportunityIds].map((opportunityId) => {
    const opportunity = newest(opportunities.filter((item) => text(item.opportunityId) === opportunityId));
    const proposal = newest(proposals.filter((item) => text(item.opportunityId) === opportunityId));
    const opportunityReviewPackages = reviewPackages.filter((item) => text(item.opportunityId) === opportunityId);
    const lineageAwareReviewPackages = opportunityReviewPackages.filter((item) => item.proposalRevisionId && item.proposalHash);
    const reviewPackage = proposal?.proposalRevisionId && proposal?.proposalHash && lineageAwareReviewPackages.length
      ? newest(opportunityReviewPackages.filter((item) => (
          text(item.proposalRevisionId) === text(proposal.proposalRevisionId)
          && text(item.proposalHash) === text(proposal.proposalHash)
        )))
      : newest(opportunityReviewPackages);
    const engineeringPackage = newest(engineeringPackages.filter((item) => text(item.opportunityId) === opportunityId || (proposal && text(item.proposalId) === text(proposal.proposalId))));
    const certifiedPackage = newest(certifiedPackages.filter((item) => text(item.opportunityId) === opportunityId || (proposal && text(item.proposalId) === text(proposal.proposalId))));
    const serviceOrder = newest(serviceOrders.filter((item) => text(item.opportunityId) === opportunityId || (proposal && text(item.proposalId) === text(proposal.proposalId))));
    const scopeVersion = serviceOrder?.scopeVersionId
      ? scopeVersions.find((item) => text(item.scopeVersionId) === text(serviceOrder.scopeVersionId)) ?? null
      : newest(scopeVersions.filter((item) => text(item.opportunityId ?? item.canonicalTruth?.opportunityId) === opportunityId));
    const routeId = text(reviewPackage?.route?.routeRepositoryId ?? proposal?.routeRepositoryId ?? opportunity?.routeRepositoryId);
    const route = routes.find((item) => text(item.routeRepositoryId) === routeId) ?? null;
    const state = deriveState({ proposal, reviewPackage, engineeringPackage, certifiedPackage, serviceOrder, scopeVersion });
    const currentStateIndex = CUSTOMER_DEAL_STATES.indexOf(state);
    return {
      dealId: opportunityId,
      opportunityId,
      accountId,
      customerId,
      title: text(opportunity?.name || reviewPackage?.title || proposal?.name || opportunityId),
      summary: text(reviewPackage?.summary || proposal?.summary || opportunity?.description),
      currentState: state,
      currentStateIndex,
      lifecycle: CUSTOMER_DEAL_STATES.map((name, index) => ({ name, status: index < currentStateIndex ? "COMPLETE" : index === currentStateIndex ? "CURRENT" : "PENDING" })),
      permittedActions: permittedActions(state, { lens, persona, user, serviceOrder }),
      commercial: {
        opportunityStateVersion: opportunity?.commercialStateVersion ?? null,
        opportunityStateHash: opportunity?.commercialStateHash ?? null,
        proposalId: proposal?.proposalId ?? reviewPackage?.proposalId ?? null,
        proposalRevisionId: proposal?.proposalRevisionId ?? reviewPackage?.proposalRevisionId ?? null,
        proposalRevisionNumber: proposal?.proposalRevisionNumber ?? reviewPackage?.proposalRevisionNumber ?? null,
        proposalHash: proposal?.proposalHash ?? reviewPackage?.proposalHash ?? null,
      },
      workingOpportunity: {
        stateVersion: opportunity?.commercialStateVersion ?? null,
        stateHash: opportunity?.commercialStateHash ?? null,
        productId: opportunity?.productId ?? null,
        productName: opportunity?.productName ?? null,
        productDoctrineId: opportunity?.productDoctrineId ?? null,
        routeRepositoryId: opportunity?.routeRepositoryId ?? opportunity?.routeRepositoryRef?.routeRepositoryId ?? null,
        routeRevision: opportunity?.routeRevision ?? null,
        routeGeometryId: opportunity?.routeGeometryId ?? null,
        geometryHash: opportunity?.geometryHash ?? null,
        civilMixCalibration: opportunity?.commercialWorkingState?.civilMixCalibration ?? opportunity?.constructionMixSnapshot ?? null,
        economics: opportunity?.commercialWorkingState?.economics ?? opportunity?.estimate ?? null,
        modifiedBy: opportunity?.modifiedBy ?? opportunity?.owner ?? null,
        modifiedAt: opportunity?.updatedAt ?? null,
      },
      spatial: {
        routeRepositoryId: reviewPackage?.route?.routeRepositoryId ?? opportunity?.routeRepositoryId ?? null,
        routeRevision: reviewPackage?.route?.routeRevision ?? opportunity?.routeRevision ?? null,
        geometryHash: reviewPackage?.route?.geometryHash ?? opportunity?.geometryHash ?? null,
      },
      engineering: {
        engineeringPackageId: engineeringPackage?.engineeringPackageId ?? null,
        certifiedPackageId: certifiedPackage?.certifiedPackageId ?? null,
        certificationHash: certifiedPackage?.certificationHash ?? null,
      },
      contractual: {
        serviceOrderId: serviceOrder?.serviceOrderId ?? null,
        serviceOrderStatus: serviceOrder?.status ?? null,
        documentHash: serviceOrder?.documentHash ?? null,
        scopeVersionId: scopeVersion?.scopeVersionId ?? serviceOrder?.scopeVersionId ?? null,
      },
      customerSafe: customerSafeProjection({ proposal, reviewPackage, route, serviceOrder }),
      documentHistory: [
        ...array(proposal?.proposalRevisions).map((revision) => ({ documentType: "PROPOSAL", documentId: revision.proposalRevisionId, revision: revision.revisionNumber, status: revision.proposalRevisionId === proposal?.proposalRevisionId ? (proposal?.approvalState === "APPROVED" ? "ACCEPTED" : "CURRENT") : "SUPERSEDED", authorityHash: revision.proposalHash, createdAt: revision.createdAt })),
        ...(serviceOrder ? [{ documentType: "SERVICE_ORDER", documentId: serviceOrder.serviceOrderId, revision: serviceOrder.documentRevision, status: serviceOrder.status, authorityHash: serviceOrder.documentHash, createdAt: serviceOrder.createdAt }] : []),
      ],
      updatedAt: dealTimestamp(opportunity, proposal, reviewPackage, engineeringPackage, certifiedPackage, serviceOrder, scopeVersion),
    };
  }).sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
  const stateCounts = Object.fromEntries(CUSTOMER_DEAL_STATES.map((state) => [state, deals.filter((deal) => deal.currentState === state).length]));
  const tasks = aggregateTasks(deals, portalActions.filter((item) => opportunityIds.has(text(item.opportunityId))), lens, persona, user);
  return {
    customerTwinId: `CUSTOMER-TWIN-${accountId}`,
    projectionType: "ACCOUNT_CUSTOMER_TWIN",
    projectionAuthority: "READ_ONLY_GOVERNED_PROJECTION",
    account: {
      accountId, accountNumber: account.accountNumber ?? null, customerId, customerOrganizationId: account.customerOrganizationId ?? null,
      name: account.name, status: account.status, organizationId: account.organizationId,
    },
    lens,
    persona: persona || null,
    dealCount: deals.length,
    stateCounts,
    tasks,
    deals,
    lifecycleStates: CUSTOMER_DEAL_STATES,
    generatedAt: new Date().toISOString(),
    createsAuthority: false,
  };
}
