import { errorResponse } from "./_shared.js";

export const DUTY_PERMISSIONS = Object.freeze({
  commercial: "commercial.lifecycle.manage",
  engineering: "engineering.lifecycle.manage",
  customerSignature: "service_order.sign_customer",
  teralinxCountersignature: "service_order.countersign",
});

export const DEMO_PERSONA_PERMISSIONS = Object.freeze({
  SALES: new Set(["commercial.lifecycle.manage"]),
  ENGINEERING: new Set(["engineering.lifecycle.manage"]),
  CUSTOMER_VIEWER: new Set([]),
  CUSTOMER_COMMERCIAL_REVIEWER: new Set([]),
  CUSTOMER_AUTHORIZED_SIGNER: new Set(["service_order.sign_customer"]),
  EXECUTIVE: new Set(["service_order.countersign"]),
});

const MUTATION_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export function hasExactPermission(user, permission) {
  const direct = Array.isArray(user?.permissions) && user.permissions.includes(permission);
  const assumed = user?.wildcard?.active?.effectivePermission === permission
    && user?.wildcard?.active?.authorityMode === "ASSUMED"
    && user?.organizationId === "org-teralinx"
    && user?.authorityClass !== "DEMO";
  if (!direct && !assumed) return false;
  if (user?.organizationId === "org-demo" && user?.principalId === "demo-principal" && user?.demoPersona) {
    if (["demo.tenant", "demo.reset"].includes(permission)) return true;
    const personaPermissions = DEMO_PERSONA_PERMISSIONS[user.demoPersona];
    if (!personaPermissions) return false;
    if (["commercial.lifecycle.manage", "engineering.lifecycle.manage", "service_order.sign_customer", "service_order.countersign"].includes(permission)) {
      return personaPermissions.has(permission);
    }
  }
  return true;
}

export function governedActorAuthority(user) {
  const active = user?.wildcard?.active;
  return {
    principalId: user?.principalId ?? user?.userId ?? "",
    membershipId: user?.membershipId ?? "",
    organizationId: user?.organizationId ?? "",
    authSessionId: user?.sessionId ?? "",
    actorDisplayNameAtAction: user?.displayName ?? user?.name ?? "",
    constitutionalRole: user?.role ?? "MEMBER",
    wildcard: Boolean(active),
    ...(active ? {
      assumedAuthority: active.assumedAuthority,
      authorityMode: "ASSUMED",
      activationReason: active.reasonCode,
      wildcardActivatedAt: active.activatedAt,
      effectivePermission: active.effectivePermission,
      wildcardSessionId: active.wildcardSessionId,
    } : { authorityMode: "DIRECT" }),
  };
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
  const demoTenant = req.authUser?.organizationId === "org-demo";
  const demoPermission = hasExactPermission(req.authUser, "demo.tenant");
  if (demoTenant !== demoPermission) {
    return deny(res, "Tenant authority configuration is invalid; access is denied closed.");
  }
  const externalCustomer = String(req.authUser?.organizationId ?? "").startsWith("org-demo-customer-");
  const demoCustomerLens = demoTenant && String(req.authUser?.demoPersona ?? "").startsWith("CUSTOMER_");
  if (externalCustomer || demoCustomerLens) {
    const allowed = pathname === "/api/runtime" || pathname.startsWith("/api/auth/") ||
      pathname === "/api/customer-portal" || pathname.startsWith("/api/customer-portal/") ||
      pathname === "/api/exports" || pathname.startsWith("/api/exports/");
    if (!allowed) return deny(res, "This resource is outside the bounded Customer lens.");
  }
  if (!MUTATION_METHODS.has(String(req.method ?? "").toUpperCase())) return false;

  if (/^\/api\/proposals\/[^/]+\/(approve|reject|request-changes)\/?$/.test(pathname)) {
    return deny(res, "Customer Proposal decisions are accepted only through the authenticated Customer Portal lens.");
  }
  if (/^\/api\/service-orders\/[^/]+\/record-signature\/?$/.test(pathname)) {
    return deny(res, "Customer Service Order signatures are accepted only through the authenticated Customer Portal lens.");
  }

  if (demoTenant) {
    const demoExecutionDuty = [
      ["/api/marketplace/", "marketplace.lifecycle.manage"],
      ["/api/control/", "control.lifecycle.manage"],
      ["/api/field/", "field.lifecycle.manage"],
      ["/api/close-events", "close.lifecycle.manage"],
    ].find(([prefix]) => pathname === prefix.replace(/\/$/, "") || pathname.startsWith(prefix));
    if (demoExecutionDuty) {
      return requireDuty(req, res, demoExecutionDuty[1], `Demo capability ${demoExecutionDuty[1]} is required.`);
    }
  }

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
