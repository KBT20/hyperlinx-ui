import { currentRepositoryAuthority, DIRS, errorResponse, handleOptions, jsonResponse, loadRecord } from "./_shared.js";
import { requireRuntimeUser } from "./authority.js";

export const CUSTOMER_IDENTITY_AUTHORITY_REQUIRED = "CUSTOMER_IDENTITY_AUTHORITY_REQUIRED";
export const CUSTOMER_IDENTITY_LINEAGE_MISMATCH = "CUSTOMER_IDENTITY_LINEAGE_MISMATCH";

const text = (value) => typeof value === "string" ? value.trim() : "";
const same = (left, right) => text(left).toLocaleLowerCase("en-US") === text(right).toLocaleLowerCase("en-US");

export class CustomerIdentityAuthorityError extends Error {
  constructor(code, detail) {
    super(`${code}: ${detail}`);
    this.name = "CustomerIdentityAuthorityError";
    this.code = code;
    this.status = 409;
  }
}

function required(detail) {
  throw new CustomerIdentityAuthorityError(CUSTOMER_IDENTITY_AUTHORITY_REQUIRED, detail);
}

function mismatch(detail) {
  throw new CustomerIdentityAuthorityError(CUSTOMER_IDENTITY_LINEAGE_MISMATCH, detail);
}

/**
 * The sole server-side authority for customer identity on governed lifecycle
 * artifacts. Descriptive names are integrity assertions only; they never
 * establish identity.
 */
export async function resolveCanonicalCustomerIdentity(input = {}, options = {}) {
  const repository = currentRepositoryAuthority();
  const environment = text(input.environment ?? repository.authorityClass).toUpperCase();
  const organizationId = text(input.organizationId ?? repository.organizationId);
  const accountId = text(input.accountId);
  const opportunityId = text(input.opportunityId);

  if (!environment || !organizationId || !accountId || !opportunityId) {
    required("environment, organization/tenant, accountId, and opportunityId are required.");
  }
  if (environment !== text(repository.authorityClass).toUpperCase()) {
    mismatch(`environment ${environment} does not match repository authority ${repository.authorityClass}.`);
  }
  if (organizationId !== text(repository.organizationId)) {
    mismatch(`organization ${organizationId} does not match authenticated repository tenant ${repository.organizationId}.`);
  }

  const account = await loadRecord(DIRS.accounts, accountId, { projectRepositoryAuthority: false }).catch(() => null);
  if (!account || text(account.accountId) !== accountId) required(`exact governed Account not found: ${accountId}.`);

  const accountName = text(account.name);
  const customerId = text(account.customerId);
  if (!accountName || !customerId) required(`Account ${accountId} lacks governed name or customerId authority.`);

  const submittedCustomerId = text(input.customerId);
  if (submittedCustomerId && submittedCustomerId !== customerId) {
    mismatch(`customerId ${submittedCustomerId} does not match Account authority ${customerId}.`);
  }

  let opportunity = null;
  if (!options.allowOpportunityCreate) {
    opportunity = await loadRecord(DIRS.commercialOpportunities, opportunityId, { projectRepositoryAuthority: false }).catch(() => null);
    if (!opportunity || text(opportunity.opportunityId) !== opportunityId) {
      required(`exact governed Opportunity not found: ${opportunityId}.`);
    }
    if (text(opportunity.accountId) !== accountId) {
      mismatch(`Opportunity ${opportunityId} accountId ${text(opportunity.accountId)} does not match ${accountId}.`);
    }
    if (text(opportunity.customerId) && text(opportunity.customerId) !== customerId) {
      mismatch(`Opportunity ${opportunityId} customerId ${text(opportunity.customerId)} does not match ${customerId}.`);
    }
  }

  const accountCustomerOrganizationId = text(account.customerOrganizationId);
  const opportunityCustomerOrganizationId = text(opportunity?.customerOrganizationId);
  const submittedCustomerOrganizationId = text(input.customerOrganizationId);
  const governedCustomerOrganizationId = accountCustomerOrganizationId || opportunityCustomerOrganizationId;
  if (accountCustomerOrganizationId && opportunityCustomerOrganizationId && accountCustomerOrganizationId !== opportunityCustomerOrganizationId) {
    mismatch(`Opportunity ${opportunityId} customerOrganizationId ${opportunityCustomerOrganizationId} does not match Account authority ${accountCustomerOrganizationId}.`);
  }
  if (submittedCustomerOrganizationId && governedCustomerOrganizationId && submittedCustomerOrganizationId !== governedCustomerOrganizationId) {
    mismatch(`customerOrganizationId ${submittedCustomerOrganizationId} does not match governed Account/Opportunity authority ${governedCustomerOrganizationId}.`);
  }

  const assertedNames = [
    input.customerName,
    input.accountName,
    input.customerOrganizationName,
    ...(Array.isArray(input.assertedCustomerNames) ? input.assertedCustomerNames : []),
  ].map(text).filter(Boolean);
  const conflictingName = assertedNames.find((name) => !same(name, accountName));
  if (conflictingName) {
    mismatch(`submitted customer name ${JSON.stringify(conflictingName)} does not match governed Account name ${JSON.stringify(accountName)}.`);
  }

  const customerOrganizationId = text(
    governedCustomerOrganizationId || submittedCustomerOrganizationId || customerId,
  );
  if (!customerOrganizationId) required(`Account ${accountId} lacks governed customer organization authority.`);

  return Object.freeze({
    environment,
    organizationId,
    accountId,
    accountName,
    customerId,
    customerOrganizationId,
    customerOrganizationName: accountName,
    opportunityId,
    provenance: Object.freeze({
      resolver: "CANONICAL_CUSTOMER_IDENTITY_AUTHORITY",
      repositoryAuthorityClass: repository.authorityClass,
      repositoryOrganizationId: repository.organizationId,
      accountArtifactId: accountId,
      opportunityArtifactId: opportunityId,
      descriptiveNamesAreAuthority: false,
    }),
    integrityState: "VERIFIED",
  });
}

export function canonicalCustomerFields(identity) {
  return {
    accountId: identity.accountId,
    accountName: identity.accountName,
    customerId: identity.customerId,
    customerName: identity.customerOrganizationName,
    customerOrganizationId: identity.customerOrganizationId,
    customerOrganizationName: identity.customerOrganizationName,
    customerIdentity: identity,
  };
}

export async function handleCustomerIdentityAuthority(req, res, pathname) {
  if (pathname !== "/api/customer-identity" && pathname !== "/api/customer-identity/") return false;
  if (handleOptions(req, res)) return true;
  const user = requireRuntimeUser(req, res);
  if (!user) return true;
  if (req.method !== "GET") {
    errorResponse(res, 405, "Canonical Customer Identity authority is read-only.");
    return true;
  }
  const url = new URL(req.url ?? "/", `https://${req.headers.host ?? "runtime.invalid"}`);
  try {
    const identity = await resolveCanonicalCustomerIdentity({
      environment: currentRepositoryAuthority().authorityClass,
      organizationId: currentRepositoryAuthority().organizationId,
      accountId: url.searchParams.get("accountId"),
      customerId: url.searchParams.get("customerId"),
      opportunityId: url.searchParams.get("opportunityId"),
    });
    jsonResponse(res, 200, { customerIdentity: identity });
  } catch (error) {
    errorResponse(res, error?.status ?? 409, error instanceof Error ? error.message : String(error));
  }
  return true;
}
