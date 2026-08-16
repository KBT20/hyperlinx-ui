import { errorResponse } from "./_shared.js";

export const DUTY_PERMISSIONS = Object.freeze({
  commercial: "commercial.lifecycle.manage",
  engineering: "engineering.lifecycle.manage",
  customerSignature: "service_order.sign_customer",
  teralinxCountersignature: "service_order.countersign",
});

const MUTATION_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export function hasExactPermission(user, permission) {
  return Array.isArray(user?.permissions) && user.permissions.includes(permission);
}

function deny(res, message) {
  errorResponse(res, 403, message);
  return true;
}

function requireDuty(req, res, permission, message) {
  return hasExactPermission(req.authUser, permission) ? false : deny(res, message);
}

function serviceOrderAction(pathname) {
  if (/\/record-signature\/?$/.test(pathname)) return "CUSTOMER_SIGNATURE";
  if (/\/countersign\/?$/.test(pathname)) return "TERALINX_COUNTERSIGNATURE";
  return "COMMERCIAL";
}

export function enforceLifecycleSeparationOfDuties(req, res, pathname) {
  if (!MUTATION_METHODS.has(String(req.method ?? "").toUpperCase())) return false;

  if ((pathname === "/api/scopeversions" && req.method === "POST") ||
      (pathname.startsWith("/api/scopeversions/") && req.method === "PUT")) {
    return deny(res, "Direct human ScopeVersion mutation is prohibited. ScopeVersion may be created only by the system after the complete authorized Service Order signature chain.");
  }

  if (pathname === "/api/service-orders" || pathname.startsWith("/api/service-orders/")) {
    const action = serviceOrderAction(pathname);
    if (action === "CUSTOMER_SIGNATURE") {
      return requireDuty(req, res, DUTY_PERMISSIONS.customerSignature, "Independent external customer signer authority is required.");
    }
    if (action === "TERALINX_COUNTERSIGNATURE") {
      return requireDuty(req, res, DUTY_PERMISSIONS.teralinxCountersignature, "Only the designated Teralinx CEO countersignature authority may authorize execution.");
    }
    return requireDuty(req, res, DUTY_PERMISSIONS.commercial, "Only Commercial lifecycle authority may create or issue a Service Order.");
  }

  const commercialMutation = [
    "/api/accounts",
    "/api/customer-design-imports",
    "/api/commercial/",
    "/api/proposals",
    "/api/runtime/lifecycle",
    "/api/candidate-sites",
    "/api/opportunity-seeds",
  ].some((prefix) => pathname === prefix.replace(/\/$/, "") || pathname.startsWith(prefix));
  if (commercialMutation) {
    return requireDuty(req, res, DUTY_PERMISSIONS.commercial, "Only the CRO Commercial lifecycle authority may mutate Opportunity, Commercial, Proposal, or Engineering submission state.");
  }

  const engineeringMutation = [
    "/api/engineering/",
    "/api/certified-routes",
    "/api/iof-packages",
  ].some((prefix) => pathname === prefix.replace(/\/$/, "") || pathname.startsWith(prefix));
  if (engineeringMutation) {
    return requireDuty(req, res, DUTY_PERMISSIONS.engineering, "Only the designated Engineering lifecycle authority may mutate Engineering, Approval, or Certification state.");
  }

  return false;
}
