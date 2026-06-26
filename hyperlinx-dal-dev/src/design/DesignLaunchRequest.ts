import type { TeralinxDesignIntent, TeralinxNetworkType, TeralinxPrimaryProduct, TeralinxProtection } from "../teralinx/TeralinxDesignIntent";
import type { TeralinxCustomer, TeralinxOpportunity } from "../teralinx/TeralinxOpportunity";
import type { TeralinxSite } from "../teralinx/TeralinxRouteRequest";

export interface DesignLaunchRequest {
  launchRequestId: string;
  customer: TeralinxCustomer;
  opportunity: TeralinxOpportunity;
  siteList: TeralinxSite[];
  networkIntent: TeralinxDesignIntent;
  protection?: TeralinxProtection;
  primaryProduct?: TeralinxPrimaryProduct;
  requestedAt: string;
}

export type DesignLaunchSupportedNetworkType = TeralinxNetworkType;
export type DesignLaunchSupportedProtection = TeralinxProtection;
export type DesignLaunchSupportedProduct = TeralinxPrimaryProduct;
