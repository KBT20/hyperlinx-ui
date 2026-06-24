import type { CustomerOpportunitySummary, CustomerWorkspace } from "./CustomerWorkspace";

export type CustomerNavigationGroup = "BUSINESS" | "DELIVERY" | "OPERATIONS" | "PLATFORM";

export interface CustomerNavigationItem {
  itemId: string;
  label: string;
  group: CustomerNavigationGroup;
  targetWorkspace: string;
  visibleInDalDev: boolean;
  customerFacingReady: boolean;
}

export interface CustomerOpportunityNavigationModel {
  modelId: "CUSTOMER_OPPORTUNITY_NAVIGATION";
  flow: readonly [
    "Customer Workspace",
    "Opportunity Detail",
    "Opportunity Intake",
    "Launch Translate",
    "Translate Workspace",
    "Scope Review",
    "Prism",
    "Marketplace",
  ];
  noRoutes: true;
  configurationOnly: true;
}

export interface CustomerWorkspaceView {
  workspace: CustomerWorkspace;
  selectedOpportunity?: CustomerOpportunitySummary;
  navigation: CustomerOpportunityNavigationModel;
  navigationGroups: CustomerNavigationItem[];
  noReactImplementation: true;
  noRoutes: true;
}

export const CUSTOMER_WORKSPACE_NAVIGATION: CustomerOpportunityNavigationModel = Object.freeze({
  modelId: "CUSTOMER_OPPORTUNITY_NAVIGATION",
  flow: [
    "Customer Workspace",
    "Opportunity Detail",
    "Opportunity Intake",
    "Launch Translate",
    "Translate Workspace",
    "Scope Review",
    "Prism",
    "Marketplace",
  ] as const,
  noRoutes: true,
  configurationOnly: true,
});

export const CUSTOMER_NAVIGATION_GROUPS: readonly CustomerNavigationItem[] = Object.freeze([
  { itemId: "NAV-CUSTOMERS", label: "Customers", group: "BUSINESS", targetWorkspace: "Customer Workspace", visibleInDalDev: true, customerFacingReady: true },
  { itemId: "NAV-OPPORTUNITIES", label: "Opportunities", group: "BUSINESS", targetWorkspace: "Opportunity Detail", visibleInDalDev: true, customerFacingReady: true },
  { itemId: "NAV-PORTFOLIO", label: "Portfolio", group: "BUSINESS", targetWorkspace: "Portfolio", visibleInDalDev: true, customerFacingReady: false },
  { itemId: "NAV-MARKETPLACE", label: "Marketplace", group: "BUSINESS", targetWorkspace: "Marketplace", visibleInDalDev: true, customerFacingReady: false },
  { itemId: "NAV-TRANSLATE", label: "Translate", group: "DELIVERY", targetWorkspace: "Translate", visibleInDalDev: true, customerFacingReady: false },
  { itemId: "NAV-SCOPE-REVIEW", label: "Scope Review", group: "DELIVERY", targetWorkspace: "Scope Review", visibleInDalDev: true, customerFacingReady: false },
  { itemId: "NAV-PRISM", label: "Prism", group: "DELIVERY", targetWorkspace: "Prism", visibleInDalDev: true, customerFacingReady: false },
  { itemId: "NAV-ROUTE-ENGINEERING", label: "Route Engineering", group: "DELIVERY", targetWorkspace: "Route Engineering", visibleInDalDev: true, customerFacingReady: false },
  { itemId: "NAV-EXECUTION", label: "Execution", group: "DELIVERY", targetWorkspace: "Execution", visibleInDalDev: true, customerFacingReady: false },
  { itemId: "NAV-TWIN", label: "Twin", group: "OPERATIONS", targetWorkspace: "Twin", visibleInDalDev: true, customerFacingReady: false },
  { itemId: "NAV-OI", label: "Operational Intelligence", group: "OPERATIONS", targetWorkspace: "Operational Intelligence", visibleInDalDev: true, customerFacingReady: false },
  { itemId: "NAV-GRAPH", label: "Graph", group: "PLATFORM", targetWorkspace: "Graph", visibleInDalDev: true, customerFacingReady: false },
]);
