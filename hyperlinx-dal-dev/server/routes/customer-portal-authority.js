import { createHash, randomBytes } from "node:crypto";
import {
  DIRS, createId, listRecords, nowIso, persistRecord,
} from "./_shared.js";
import { authQuery } from "../auth/postgres.js";

const array = (value) => Array.isArray(value) ? value : value == null || value === "" ? [] : [value];
const record = (value) => value && typeof value === "object" && !Array.isArray(value) ? value : {};
const text = (...values) => values.map((value) => String(value ?? "").trim()).find(Boolean) ?? "";
const unique = (values) => [...new Set(values.filter(Boolean).map(String))];
const digest = (value) => createHash("sha256").update(String(value ?? "")).digest("hex");
const idPart = (value) => String(value ?? "UNKNOWN").replace(/[^A-Za-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 120);

export const CUSTOMER_ORGANIZATIONS = Object.freeze({
  "org-demo-customer-a": { customerId: "customer-demo-a", name: "Northstar Cloud Infrastructure" },
  "org-demo-customer-b": { customerId: "customer-demo-b", name: "Blue Mesa Digital Systems" },
});

export function exactProposalRevision(proposal = {}) {
  const proposalRevisionId = text(proposal.proposalRevisionId);
  const proposalHash = text(proposal.proposalHash);
  const revision = array(proposal.proposalRevisions).find((item) =>
    text(item?.proposalRevisionId) === proposalRevisionId && text(item?.proposalHash) === proposalHash
  );
  if (!proposalRevisionId || !proposalHash || !revision || revision.revisionStatus !== "SAVED") {
    const error = new Error("An exact immutable saved Proposal Revision ID/hash is required for customer submission.");
    error.status = 409;
    error.code = "EXACT_PROPOSAL_REVISION_REQUIRED";
    throw error;
  }
  return {
    proposalId: text(proposal.proposalId, proposal.proposalRecordId),
    proposalRevisionId,
    proposalRevisionNumber: Number(revision.revisionNumber ?? proposal.revisionNumber ?? proposal.version ?? 0),
    proposalHash,
    revision,
  };
}

function customerSafeCommercialTerms(proposal = {}) {
  const pricing = record(proposal.pricingSummary);
  const terms = record(proposal.commercialTerms);
  return {
    currency: text(terms.currency, pricing.currency, "USD"),
    nrc: Number(terms.nrc ?? pricing.nrcRevenue ?? pricing.sellPriceIru ?? 0),
    mrc: Number(terms.mrc ?? pricing.mrcRevenue ?? 0),
    termMonths: Number(terms.termMonths ?? pricing.termMonths ?? 0),
    tcv: Number(terms.tcv ?? pricing.tcv ?? 0),
  };
}

export async function createCustomerReviewAuthority(proposal = {}, input = {}, user = {}) {
  const lineage = exactProposalRevision(proposal);
  const customerOrganizationId = text(input.customerOrganizationId);
  const customerOrganization = CUSTOMER_ORGANIZATIONS[customerOrganizationId];
  if (!customerOrganization) {
    const error = new Error("A governed Demo customer organization is required for Customer Portal submission.");
    error.status = 409;
    error.code = "CUSTOMER_ORGANIZATION_REQUIRED";
    throw error;
  }
  if (text(proposal.customerId) && text(proposal.customerId) !== customerOrganization.customerId) {
    const error = new Error("Proposal customer scope does not match the selected customer organization.");
    error.status = 409;
    error.code = "CUSTOMER_ORGANIZATION_SCOPE_MISMATCH";
    throw error;
  }
  const recipientPrincipalIds = unique(array(input.recipientPrincipalIds ?? input.assignedCustomerUsers));
  if (!recipientPrincipalIds.length) {
    const error = new Error("At least one named customer recipient is required.");
    error.status = 400;
    error.code = "NAMED_CUSTOMER_RECIPIENT_REQUIRED";
    throw error;
  }
  const recipientAuthority = await authQuery({
    text: `SELECT p.principal_id, p.username, p.email, m.organization_id, r.role_key
      FROM hyperlinx.principals p
      JOIN hyperlinx.memberships m USING (principal_id)
      JOIN hyperlinx.assignments a USING (membership_id)
      JOIN hyperlinx.roles r USING (role_id)
      WHERE p.principal_id = ANY($1::text[]) AND p.status = 'ACTIVE' AND m.status = 'ACTIVE'`,
    values: [recipientPrincipalIds],
  });
  const recipientRows = new Map(recipientAuthority.rows.map((item) => [item.principal_id, item]));
  const invalidRecipient = recipientPrincipalIds.find((principalId) => {
    const recipient = recipientRows.get(principalId);
    return !recipient || recipient.organization_id !== customerOrganizationId ||
      !["CUSTOMER_VIEWER", "CUSTOMER_COMMERCIAL_REVIEWER", "CUSTOMER_AUTHORIZED_SIGNER"].includes(recipient.role_key);
  });
  if (invalidRecipient) {
    const error = new Error("Every customer recipient must be a named active member of the selected customer organization.");
    error.status = 403;
    error.code = "CUSTOMER_RECIPIENT_SCOPE_MISMATCH";
    throw error;
  }
  const timestamp = nowIso();
  const opportunityId = text(proposal.opportunityId);
  const reviewPackageId = `CUSTOMER-REVIEW-DEMO-${idPart(lineage.proposalRevisionId)}`;
  const priorPackages = (await listRecords(DIRS.customerReviewPackages)).filter((item) =>
    item.opportunityId === opportunityId && item.customerOrganizationId === customerOrganizationId &&
    item.customerReviewPackageId !== reviewPackageId && item.status !== "SUPERSEDED"
  );
  for (const prior of priorPackages) {
    await persistRecord(DIRS.customerReviewPackages, prior.customerReviewPackageId, {
      ...prior, status: "SUPERSEDED", supersededByCustomerReviewPackageId: reviewPackageId,
      supersededByProposalRevisionId: lineage.proposalRevisionId, supersededAt: timestamp, updatedAt: timestamp,
    });
  }
  const priorRevisionIds = new Set(priorPackages.map((item) => item.proposalRevisionId));
  const priorInvitations = (await listRecords(DIRS.customerPortalInvitations)).filter((item) =>
    item.opportunityId === opportunityId && item.customerOrganizationId === customerOrganizationId &&
    priorRevisionIds.has(item.proposalRevisionId) && item.status === "ACTIVE"
  );
  for (const invitation of priorInvitations) {
    await persistRecord(DIRS.customerPortalInvitations, invitation.customerInvitationId, {
      ...invitation, status: "REVOKED", revokedAt: timestamp, revocationReason: "PROPOSAL_REVISION_SUPERSEDED", updatedAt: timestamp,
    });
  }
  const reviewPackage = {
    customerReviewPackageId: reviewPackageId,
    artifactType: "CUSTOMER_REVIEW_PACKAGE",
    authority: "BOUNDED_CUSTOMER_PROJECTION",
    sourceAuthority: "PROPOSAL_REPOSITORY",
    ...lineage,
    opportunityId,
    customerId: customerOrganization.customerId,
    customerOrganizationId,
    recipientPrincipalIds,
    product: {
      productId: text(proposal.productId),
      name: text(proposal.productName),
      description: text(proposal.productDescription, proposal.summary),
    },
    route: {
      routeRepositoryId: text(proposal.routeRepositoryId, record(proposal.routeSnapshot).routeRepositoryId),
      routeRevision: Number(proposal.routeRevision ?? record(proposal.routeSnapshot).routeRevision ?? 1),
      routeGeometryId: text(proposal.routeGeometryId, record(proposal.routeSnapshot).routeGeometryId),
      geometryHash: text(proposal.routeGeometryHash, record(proposal.routeSnapshot).geometryHash),
      routeMiles: Number(proposal.routeMiles ?? record(proposal.pricingSummary).routeMiles ?? 0),
    },
    commercialTerms: customerSafeCommercialTerms(proposal),
    schedule: record(proposal.scheduleSummary ?? proposal.deliverySummary),
    majorQuantities: (() => {
      const quantities = record(proposal.constructionQuantities ?? record(proposal.transparentEstimate).physicalQuantities);
      return {
        routeFeet: Number(quantities.routeFeet ?? proposal.routeFeet ?? 0),
        conduitFeet: Number(quantities.conduitFeet ?? 0),
        fiberCount: Number(quantities.fiberCount ?? record(proposal.productConfiguration).fiberCount ?? 0),
        handholeCount: Number(quantities.handholeCount ?? 0),
        vaultCount: Number(quantities.vaultCount ?? 0),
      };
    })(),
    title: text(proposal.title, proposal.proposalNumber),
    summary: text(proposal.executiveSummary, proposal.summary),
    expiration: proposal.expiration ?? proposal.expiresAt ?? null,
    customerSafeDocumentReferences: array(proposal.proposalDocumentReferences),
    status: "AWAITING_CUSTOMER_REVIEW",
    submittedBy: user.name,
    submittedByPrincipalId: user.principalId ?? user.userId,
    submittedByMembershipId: user.membershipId,
    submittedBySessionId: user.sessionId,
    submittedAt: timestamp,
    environment: "DEMO",
    securityDomain: "DEMO",
    productionEligible: false,
    immutableSourceRevision: true,
    directAuthorityMutation: false,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  await persistRecord(DIRS.customerReviewPackages, reviewPackageId, reviewPackage);

  const invitations = [];
  for (const principalId of recipientPrincipalIds) {
    const recipient = recipientRows.get(principalId);
    const role = recipient.role_key;
    const accessId = `CUSTOMER-ACCESS-DEMO-${idPart(customerOrganizationId)}-${idPart(opportunityId)}-${idPart(principalId)}`;
    await persistRecord(DIRS.customerProjectAccess, accessId, {
      customerProjectAccessId: accessId,
      customerOrganizationId,
      customerId: customerOrganization.customerId,
      principalId,
      membershipId: `membership-${principalId}`,
      opportunityId,
      proposalId: lineage.proposalId,
      customerReviewPackageId: reviewPackageId,
      role,
      status: "PENDING_ENROLLMENT",
      grantedByPrincipalId: user.principalId ?? user.userId,
      grantedAt: timestamp,
      environment: "DEMO",
      productionEligible: false,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
    const token = randomBytes(32).toString("base64url");
    const invitationId = `CUSTOMER-INVITATION-DEMO-${idPart(opportunityId)}-${idPart(principalId)}-${createId("invite").slice(-12)}`;
    const expiresAt = new Date(Date.now() + Math.max(5, Number(input.invitationTtlMinutes ?? 1440)) * 60_000).toISOString();
    await persistRecord(DIRS.customerPortalInvitations, invitationId, {
      customerInvitationId: invitationId,
      tokenHash: digest(token),
      purpose: "CUSTOMER_PORTAL_ENROLLMENT",
      customerOrganizationId,
      customerId: customerOrganization.customerId,
      opportunityId,
      proposalId: lineage.proposalId,
      proposalRevisionId: lineage.proposalRevisionId,
      proposalHash: lineage.proposalHash,
      intendedPrincipalId: principalId,
      intendedUsername: recipient.username,
      intendedEmail: recipient.email,
      projectAccessId: accessId,
      status: "ACTIVE",
      singleUse: true,
      issuedAt: timestamp,
      expiresAt,
      revokedAt: null,
      consumedAt: null,
      environment: "DEMO",
      productionEligible: false,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
    invitations.push({
      customerInvitationId: invitationId,
      principalId,
      expiresAt,
      enrollmentToken: token,
      enrollmentPath: `/customer/enroll?token=${encodeURIComponent(token)}&opportunityId=${encodeURIComponent(opportunityId)}`,
    });
  }
  return { reviewPackage, invitations };
}

export async function invitationByToken(token) {
  const tokenHash = digest(token);
  return (await listRecords(DIRS.customerPortalInvitations)).find((item) => item.tokenHash === tokenHash) ?? null;
}

export async function customerProjectAccessRecords() {
  return listRecords(DIRS.customerProjectAccess);
}
