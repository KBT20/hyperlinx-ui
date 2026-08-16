const DEMO_PERSONA_KEY = "hyperlinx:demo-persona:v1";
const DEMO_CUSTOMER_ORGANIZATION_KEY = "hyperlinx:demo-customer-organization:v1";

export type DemoPersona = "SALES" | "ENGINEERING" | "CUSTOMER_VIEWER" | "CUSTOMER_COMMERCIAL_REVIEWER" | "CUSTOMER_AUTHORIZED_SIGNER" | "EXECUTIVE";

export function getDemoPersona(): DemoPersona {
  try { return (window.localStorage.getItem(DEMO_PERSONA_KEY) as DemoPersona) || "SALES"; }
  catch { return "SALES"; }
}

export function setDemoPersona(value: DemoPersona) {
  try { window.localStorage.setItem(DEMO_PERSONA_KEY, value); } catch { /* Cookie authority remains intact. */ }
}

export function getDemoCustomerOrganization() {
  try { return window.localStorage.getItem(DEMO_CUSTOMER_ORGANIZATION_KEY) || "org-demo-customer-a"; }
  catch { return "org-demo-customer-a"; }
}

export function setDemoCustomerOrganization(value: string) {
  try { window.localStorage.setItem(DEMO_CUSTOMER_ORGANIZATION_KEY, value); } catch { /* Cookie authority remains intact. */ }
}

export function withStoredAuthHeaders(headers: HeadersInit = {}) {
  return {
    ...headers,
    "X-Hyperlinx-Demo-Persona": getDemoPersona(),
    "X-Hyperlinx-Demo-Customer-Organization": getDemoCustomerOrganization(),
  };
}

export function withStoredAuth(init: RequestInit = {}) {
  return {
    ...init,
    credentials: init.credentials ?? "same-origin",
    headers: withStoredAuthHeaders(init.headers),
  };
}
