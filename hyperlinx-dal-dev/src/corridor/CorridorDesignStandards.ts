import type { CorridorNetworkRole } from "./corridorTypes";
import type { CorridorLensObjectType, CorridorLensType } from "./CorridorLens";

export type DesignStandardSeverity = "ADVISORY" | "REVIEW_REQUIRED" | "CONDITIONAL" | "BLOCKING";

export type DesignReviewStatus =
  | "NOT_REVIEWED"
  | "IN_REVIEW"
  | "APPROVED"
  | "REJECTED"
  | "EXCEPTION_REQUESTED"
  | "EXCEPTION_APPROVED";

export type DesignStandardSource =
  | "TERALINX_DOCTRINE"
  | "ROUTE_ENGINEERING"
  | "CUSTOMER_REQUIREMENT"
  | "PROVIDER_EVIDENCE"
  | "HUMAN_ENGINEER";

export interface CorridorDesignStandard {
  standardId: string;
  objectType?: CorridorLensObjectType;
  lensTypes: CorridorLensType[];
  corridorRoles: CorridorNetworkRole[];
  designRequirement: string;
  placementGuidance: string;
  spacingGuidance: string;
  capacityGuidance: string;
  redundancyGuidance: string;
  maintenanceGuidance: string;
  restorationGuidance: string;
  evidenceRequirements: string[];
  engineeringReviewRequired: boolean;
  salesEditable: boolean;
  routeEngineeringAuthority: boolean;
  severity: DesignStandardSeverity;
  source: DesignStandardSource;
  notes: string;
}

export interface CorridorObjectDesignStandard extends CorridorDesignStandard {
  objectType: CorridorLensObjectType;
}

export interface CorridorLensDesignStandard extends CorridorDesignStandard {
  lensType: CorridorLensType;
  objectTypes: CorridorLensObjectType[];
}

export interface DesignStandardException {
  exceptionId: string;
  standardId: string;
  objectId: string;
  reason: string;
  requestedBy: string;
  reviewedBy?: string;
  status: "REQUESTED" | "APPROVED" | "REJECTED" | "SUPERSEDED";
  evidenceIds: string[];
  notes?: string;
}

const ALL_LENSES: CorridorLensType[] = [
  "HYPERSCALER",
  "NEOCLOUD",
  "ENTERPRISE",
  "DUCT_MONETIZATION",
  "DARK_FIBER_IRU",
  "TRANSPORT",
  "INTERCONNECTION",
  "POWER_AI_EXPANSION",
  "MUNICIPAL",
  "UTILITY",
  "CARRIER_WHOLESALE",
];

const TRANSPORT_ROLES: CorridorNetworkRole[] = ["MSA_INTERCONNECT", "BACKBONE_INTERCONNECT", "REGIONAL_AGGREGATION", "AI_FABRIC"];
const METRO_ROLES: CorridorNetworkRole[] = ["CAMPUS", "METRO_AGGREGATION", "INTERCONNECTION"];
const AI_ROLES: CorridorNetworkRole[] = ["AI_FABRIC", "BACKBONE_INTERCONNECT"];

function objectStandard(input: CorridorObjectDesignStandard): CorridorObjectDesignStandard {
  return Object.freeze(input);
}

function lensStandard(input: CorridorLensDesignStandard): CorridorLensDesignStandard {
  return Object.freeze(input);
}

export const CORRIDOR_OBJECT_DESIGN_STANDARDS: readonly CorridorObjectDesignStandard[] = Object.freeze([
  objectStandard({
    standardId: "STANDARD-REGEN-SITE-001",
    objectType: "REGEN_SITE",
    lensTypes: ["HYPERSCALER", "NEOCLOUD", "TRANSPORT", "POWER_AI_EXPANSION"],
    corridorRoles: TRANSPORT_ROLES,
    designRequirement:
      "Regen placement depends on optical design, fiber type, wavelength platform, latency objective, and SLA; sales may not set regen spacing.",
    placementGuidance: "Review power, access, security, route diversity, shelter, generator backup, and maintenance access before placement.",
    spacingGuidance: "Spacing is optical-design dependent and must be set or approved by Route Engineering.",
    capacityGuidance: "Capacity planning must include optical platform limits and future wavelength growth.",
    redundancyGuidance: "Diversity and restoration design must be reviewed where the corridor supports critical transport or AI workloads.",
    maintenanceGuidance: "Maintenance access, security, and generator serviceability must be evidence-backed.",
    restorationGuidance: "Restoration expectations must align with SLA and available diverse path evidence.",
    evidenceRequirements: ["optical design basis", "fiber type", "wavelength platform", "power availability", "access and security evidence"],
    engineeringReviewRequired: true,
    salesEditable: false,
    routeEngineeringAuthority: true,
    severity: "REVIEW_REQUIRED",
    source: "TERALINX_DOCTRINE",
    notes: "Regen objects are never commercial assumptions alone; they require engineering review.",
  }),
  objectStandard({
    standardId: "STANDARD-ADM-SITE-001",
    objectType: "ADM_SITE",
    lensTypes: ["TRANSPORT", "HYPERSCALER", "NEOCLOUD", "INTERCONNECTION", "CARRIER_WHOLESALE"],
    corridorRoles: TRANSPORT_ROLES,
    designRequirement: "ADM placement depends on aggregation, add/drop requirements, topology, and service model.",
    placementGuidance: "Validate power, space, access, protection, and handoff requirements.",
    spacingGuidance: "Spacing follows topology and service design, not sales preference.",
    capacityGuidance: "ADM capacity must reflect add/drop demand, protection requirements, and expansion headroom.",
    redundancyGuidance: "Protection model and route diversity must be reviewed before approval.",
    maintenanceGuidance: "Access windows, spares, and maintenance ownership must be documented.",
    restorationGuidance: "Restoration behavior must match topology and SLA assumptions.",
    evidenceRequirements: ["aggregation model", "add/drop demand", "topology plan", "power and space evidence"],
    engineeringReviewRequired: true,
    salesEditable: false,
    routeEngineeringAuthority: true,
    severity: "REVIEW_REQUIRED",
    source: "TERALINX_DOCTRINE",
    notes: "ADM placement is a Route Engineering decision.",
  }),
  objectStandard({
    standardId: "STANDARD-CONDUIT-001",
    objectType: "CONDUIT",
    lensTypes: ["DUCT_MONETIZATION", "HYPERSCALER", "DARK_FIBER_IRU", "TRANSPORT", "ENTERPRISE", "CARRIER_WHOLESALE"],
    corridorRoles: ["CAMPUS", "METRO_AGGREGATION", "MSA_INTERCONNECT", "BACKBONE_INTERCONNECT", "REGIONAL_AGGREGATION", "INTERCONNECTION"],
    designRequirement: "Conduit standards must track duct count, duct size, spare duct, occupied duct, sale-eligible duct, and maintenance requirements.",
    placementGuidance: "Placement must respect ROW, access, construction method, and future maintenance needs.",
    spacingGuidance: "Handhole and access spacing must be reviewed against route class and maintenance model.",
    capacityGuidance: "Residual capacity must be tracked separately from committed capacity.",
    redundancyGuidance: "Diverse conduit paths require independent evidence and may not be inferred from proximity.",
    maintenanceGuidance: "Maintenance and access obligations must be retained with capacity claims.",
    restorationGuidance: "Restoration costs and obligations must be evaluated with construction method and jurisdiction.",
    evidenceRequirements: ["duct count", "duct size", "occupied capacity", "spare capacity", "sale eligibility", "maintenance model"],
    engineeringReviewRequired: true,
    salesEditable: false,
    routeEngineeringAuthority: true,
    severity: "REVIEW_REQUIRED",
    source: "TERALINX_DOCTRINE",
    notes: "Commercial duct opportunity depends on approved residual capacity.",
  }),
  objectStandard({
    standardId: "STANDARD-FIBER-001",
    objectType: "FIBER",
    lensTypes: ["DARK_FIBER_IRU", "TRANSPORT", "HYPERSCALER", "NEOCLOUD", "ENTERPRISE", "CARRIER_WHOLESALE"],
    corridorRoles: ["CAMPUS", "METRO_AGGREGATION", "MSA_INTERCONNECT", "BACKBONE_INTERCONNECT", "REGIONAL_AGGREGATION", "INTERCONNECTION", "AI_FABRIC"],
    designRequirement: "Fiber standards must track fiber count, strand reservation, IRU eligibility, transport eligibility, and future growth.",
    placementGuidance: "Fiber placement must follow certified route geometry and approved construction method.",
    spacingGuidance: "Splice, handoff, and test points must be reviewed for operations and product intent.",
    capacityGuidance: "Sales may sell only approved capacity; reserved, committed, spare, and IRU-eligible strands must remain distinct.",
    redundancyGuidance: "Diverse fiber claims require separate path evidence and Route Engineering approval.",
    maintenanceGuidance: "Maintenance windows, splice access, and repair procedures must be documented.",
    restorationGuidance: "Restoration assumptions must be tied to physical diversity and operational plan.",
    evidenceRequirements: ["fiber count", "strand reservation", "IRU eligibility", "transport eligibility", "spare capacity"],
    engineeringReviewRequired: true,
    salesEditable: false,
    routeEngineeringAuthority: true,
    severity: "REVIEW_REQUIRED",
    source: "TERALINX_DOCTRINE",
    notes: "Fiber capacity is not a sales-editable truth field.",
  }),
  objectStandard({
    standardId: "STANDARD-DATA-CENTER-001",
    objectType: "DATA_CENTER",
    lensTypes: ["HYPERSCALER", "NEOCLOUD", "TRANSPORT", "INTERCONNECTION", "DARK_FIBER_IRU"],
    corridorRoles: ["CAMPUS", "METRO_AGGREGATION", "MSA_INTERCONNECT", "BACKBONE_INTERCONNECT", "AI_FABRIC", "INTERCONNECTION"],
    designRequirement: "Data center standards must consider entry diversity, meet-me access, handoff point, cross-connect feasibility, and latency target.",
    placementGuidance: "Validate entrance options, meet-me room access, demarcation, and building constraints.",
    spacingGuidance: "N/A for site object; route handoff geometry and internal path must be reviewed.",
    capacityGuidance: "Capacity assumptions must be tied to available handoff and product design.",
    redundancyGuidance: "Entry diversity must be evidence-backed, not inferred from campus size.",
    maintenanceGuidance: "Handoff and access processes must be documented.",
    restorationGuidance: "Restoration design must respect entry diversity and service SLA.",
    evidenceRequirements: ["meet-me access", "handoff point", "cross-connect feasibility", "entry diversity", "latency target"],
    engineeringReviewRequired: true,
    salesEditable: false,
    routeEngineeringAuthority: true,
    severity: "REVIEW_REQUIRED",
    source: "TERALINX_DOCTRINE",
    notes: "Data center proximity is evidence; serviceability requires engineering validation.",
  }),
  objectStandard({
    standardId: "STANDARD-GPU-ARRAY-001",
    objectType: "GPU_ARRAY",
    lensTypes: ["HYPERSCALER", "NEOCLOUD", "POWER_AI_EXPANSION"],
    corridorRoles: AI_ROLES,
    designRequirement: "GPU array standards must evaluate power dependency, low-latency transport, data center proximity, expansion land, and high-capacity fiber.",
    placementGuidance: "Review proximity to power, campuses, carrier hotels, and expansion parcels.",
    spacingGuidance: "N/A for demand object; supporting transport and regen design must be reviewed.",
    capacityGuidance: "High-capacity fiber and transport requirements must be evidence-backed.",
    redundancyGuidance: "AI workloads may require redundant transport and power-adjacent route options.",
    maintenanceGuidance: "Maintenance model must consider high-availability service expectations.",
    restorationGuidance: "Restoration expectations must be tied to SLA and diverse route evidence.",
    evidenceRequirements: ["power dependency", "latency objective", "data center proximity", "expansion land", "fiber capacity"],
    engineeringReviewRequired: true,
    salesEditable: false,
    routeEngineeringAuthority: true,
    severity: "REVIEW_REQUIRED",
    source: "TERALINX_DOCTRINE",
    notes: "GPU arrays are lens-defined future objects and do not create network authority.",
  }),
  objectStandard({
    standardId: "STANDARD-SUBSTATION-001",
    objectType: "SUBSTATION",
    lensTypes: ["HYPERSCALER", "NEOCLOUD", "POWER_AI_EXPANSION", "UTILITY"],
    corridorRoles: AI_ROLES,
    designRequirement: "Substation proximity matters, but available capacity must be evidence-backed; power availability is not assumed from location alone.",
    placementGuidance: "Use as power context until capacity and interconnection facts are supplied.",
    spacingGuidance: "N/A for power evidence object.",
    capacityGuidance: "Available capacity must be sourced from utility or qualified evidence.",
    redundancyGuidance: "Redundant power claims require explicit evidence.",
    maintenanceGuidance: "Utility access and operational constraints must be documented when relevant.",
    restorationGuidance: "Power restoration assumptions must not be inferred without evidence.",
    evidenceRequirements: ["substation identity", "utility owner", "capacity evidence", "interconnection evidence"],
    engineeringReviewRequired: true,
    salesEditable: false,
    routeEngineeringAuthority: true,
    severity: "CONDITIONAL",
    source: "TERALINX_DOCTRINE",
    notes: "Substation objects influence power scoring but do not prove power availability.",
  }),
  objectStandard({
    standardId: "STANDARD-TRANSMISSION-001",
    objectType: "TRANSMISSION_LINE",
    lensTypes: ["HYPERSCALER", "NEOCLOUD", "POWER_AI_EXPANSION", "UTILITY"],
    corridorRoles: AI_ROLES,
    designRequirement: "Transmission lines are evidence only and do not imply serviceability or capacity.",
    placementGuidance: "Use transmission proximity as contextual power evidence.",
    spacingGuidance: "N/A for power evidence object.",
    capacityGuidance: "Capacity must be independently verified.",
    redundancyGuidance: "Redundancy must not be inferred from nearby transmission geometry.",
    maintenanceGuidance: "Owner and access constraints should be documented if used in analysis.",
    restorationGuidance: "Transmission restoration assumptions are outside route authority unless evidence is supplied.",
    evidenceRequirements: ["transmission owner", "voltage where available", "capacity evidence if claimed"],
    engineeringReviewRequired: true,
    salesEditable: false,
    routeEngineeringAuthority: true,
    severity: "ADVISORY",
    source: "TERALINX_DOCTRINE",
    notes: "Transmission geometry is contextual evidence.",
  }),
  objectStandard({
    standardId: "STANDARD-CARRIER-HOTEL-001",
    objectType: "CARRIER_HOTEL",
    lensTypes: ["HYPERSCALER", "NEOCLOUD", "TRANSPORT", "INTERCONNECTION", "DARK_FIBER_IRU", "CARRIER_WHOLESALE"],
    corridorRoles: ["METRO_AGGREGATION", "MSA_INTERCONNECT", "BACKBONE_INTERCONNECT", "INTERCONNECTION"],
    designRequirement: "Carrier hotels must be evaluated for interconnection value, cross-connect availability, and cloud on-ramp proximity.",
    placementGuidance: "Validate building access, meet-me room, handoff, and cross-connect options.",
    spacingGuidance: "N/A for interconnection object.",
    capacityGuidance: "Interconnection claims must map to product and facility evidence.",
    redundancyGuidance: "Diverse handoff claims require independent entry or route evidence.",
    maintenanceGuidance: "Access and ticketing processes should be documented.",
    restorationGuidance: "Restoration depends on route diversity and facility handoff design.",
    evidenceRequirements: ["cross-connect availability", "meet-me access", "cloud proximity", "facility handoff details"],
    engineeringReviewRequired: true,
    salesEditable: false,
    routeEngineeringAuthority: true,
    severity: "REVIEW_REQUIRED",
    source: "TERALINX_DOCTRINE",
    notes: "Carrier hotel value is interconnection evidence until engineered into a design.",
  }),
  objectStandard({
    standardId: "STANDARD-CLOUD-ONRAMP-001",
    objectType: "CLOUD_ONRAMP",
    lensTypes: ["HYPERSCALER", "NEOCLOUD", "TRANSPORT", "INTERCONNECTION", "ENTERPRISE"],
    corridorRoles: ["METRO_AGGREGATION", "MSA_INTERCONNECT", "BACKBONE_INTERCONNECT", "AI_FABRIC", "INTERCONNECTION"],
    designRequirement: "Cloud on-ramps influence hyperscaler relevance, interconnection value, and transport design impact.",
    placementGuidance: "Use on-ramp location and facility context as evidence for service model design.",
    spacingGuidance: "N/A for interconnection object.",
    capacityGuidance: "Cloud access capacity must be verified by provider/facility evidence.",
    redundancyGuidance: "Cloud diversity requires independent facility and route evidence.",
    maintenanceGuidance: "Operational support model should be identified when used for service claims.",
    restorationGuidance: "Cloud restoration depends on route, facility, and provider diversity.",
    evidenceRequirements: ["cloud provider", "facility", "handoff model", "available capacity if claimed"],
    engineeringReviewRequired: true,
    salesEditable: false,
    routeEngineeringAuthority: true,
    severity: "ADVISORY",
    source: "TERALINX_DOCTRINE",
    notes: "Cloud on-ramp relevance is advisory until engineered into product truth.",
  }),
  objectStandard({
    standardId: "STANDARD-IX-001",
    objectType: "IX",
    lensTypes: ["TRANSPORT", "INTERCONNECTION", "HYPERSCALER", "NEOCLOUD", "CARRIER_WHOLESALE"],
    corridorRoles: ["INTERCONNECTION", "MSA_INTERCONNECT", "BACKBONE_INTERCONNECT"],
    designRequirement: "Internet exchanges provide peering and interconnection value.",
    placementGuidance: "Validate facility access, participant relevance, and handoff feasibility.",
    spacingGuidance: "N/A for interconnection object.",
    capacityGuidance: "Peering and transport capacity must be verified.",
    redundancyGuidance: "Interconnection diversity requires facility and route evidence.",
    maintenanceGuidance: "Facility access and support model should be captured.",
    restorationGuidance: "Restoration depends on service topology and alternate paths.",
    evidenceRequirements: ["IX identity", "facility", "handoff feasibility", "participant relevance"],
    engineeringReviewRequired: true,
    salesEditable: false,
    routeEngineeringAuthority: true,
    severity: "ADVISORY",
    source: "TERALINX_DOCTRINE",
    notes: "IX value is scoring evidence, not design authority.",
  }),
  objectStandard({
    standardId: "STANDARD-PARCEL-DEVELOPMENT-001",
    objectType: "PARCEL",
    lensTypes: ["HYPERSCALER", "NEOCLOUD", "ENTERPRISE", "POWER_AI_EXPANSION", "DUCT_MONETIZATION", "MUNICIPAL"],
    corridorRoles: ["CAMPUS", "METRO_AGGREGATION", "AI_FABRIC", "REGIONAL_AGGREGATION"],
    designRequirement: "Parcel and development-site standards must evaluate usable land, zoning, power proximity, road access, fiber proximity, and ownership confidence.",
    placementGuidance: "Use parcel evidence to support constructability and campus suitability analysis.",
    spacingGuidance: "N/A for property object.",
    capacityGuidance: "Land capacity and expansion claims require parcel and zoning evidence.",
    redundancyGuidance: "Expansion or campus diversity requires multiple evidence-backed sites or entry paths.",
    maintenanceGuidance: "Access, ownership, and maintenance rights must be understood.",
    restorationGuidance: "Restoration obligations may depend on ownership and ROW terms.",
    evidenceRequirements: ["parcel id", "ownership confidence", "zoning", "road access", "fiber proximity", "power proximity"],
    engineeringReviewRequired: true,
    salesEditable: false,
    routeEngineeringAuthority: true,
    severity: "CONDITIONAL",
    source: "TERALINX_DOCTRINE",
    notes: "Development site suitability remains advisory until reviewed.",
  }),
  objectStandard({
    standardId: "STANDARD-JURISDICTION-001",
    objectType: "JURISDICTION",
    lensTypes: ALL_LENSES,
    corridorRoles: ["CAMPUS", "METRO_AGGREGATION", "MSA_INTERCONNECT", "BACKBONE_INTERCONNECT", "AI_FABRIC", "REGIONAL_AGGREGATION", "INTERCONNECTION"],
    designRequirement: "Jurisdiction standards must identify permit owner, lead time, complexity, risk, and authority.",
    placementGuidance: "Every affected segment should retain jurisdiction evidence where available.",
    spacingGuidance: "N/A for jurisdiction object.",
    capacityGuidance: "N/A for jurisdiction object.",
    redundancyGuidance: "Jurisdiction diversity may reduce or increase permitting risk depending on project context.",
    maintenanceGuidance: "Maintenance permit requirements should be captured where relevant.",
    restorationGuidance: "Restoration standards and pavement requirements are jurisdiction dependent.",
    evidenceRequirements: ["permit owner", "lead time", "jurisdiction boundary", "authority", "known complexity"],
    engineeringReviewRequired: true,
    salesEditable: false,
    routeEngineeringAuthority: true,
    severity: "REVIEW_REQUIRED",
    source: "TERALINX_DOCTRINE",
    notes: "Jurisdiction evidence informs risk and schedule but does not approve construction.",
  }),
  objectStandard({
    standardId: "STANDARD-CROSSING-001",
    objectType: "CROSSING",
    lensTypes: ALL_LENSES,
    corridorRoles: ["CAMPUS", "METRO_AGGREGATION", "MSA_INTERCONNECT", "BACKBONE_INTERCONNECT", "AI_FABRIC", "REGIONAL_AGGREGATION", "INTERCONNECTION"],
    designRequirement: "Crossing standards must capture crossing type, owner, method, cost, permit, and schedule risk.",
    placementGuidance: "Crossing method must be reviewed by Route Engineering.",
    spacingGuidance: "N/A for crossing object.",
    capacityGuidance: "Crossing design may constrain conduit/fiber capacity and future expansion.",
    redundancyGuidance: "Diverse crossings require separate evidence and owner review.",
    maintenanceGuidance: "Maintenance access and owner constraints must be captured.",
    restorationGuidance: "Restoration requirements may drive construction cost and schedule.",
    evidenceRequirements: ["crossing type", "owner", "method", "permit", "cost basis", "schedule risk"],
    engineeringReviewRequired: true,
    salesEditable: false,
    routeEngineeringAuthority: true,
    severity: "REVIEW_REQUIRED",
    source: "TERALINX_DOCTRINE",
    notes: "Crossings are high-sensitivity engineering and schedule objects.",
  }),
  objectStandard({
    standardId: "STANDARD-CONSTRAINT-001",
    objectType: "CONSTRAINT",
    lensTypes: ALL_LENSES,
    corridorRoles: ["CAMPUS", "METRO_AGGREGATION", "MSA_INTERCONNECT", "BACKBONE_INTERCONNECT", "AI_FABRIC", "REGIONAL_AGGREGATION", "INTERCONNECTION"],
    designRequirement: "Constraints must record severity, mitigation, affected segments, and review requirement.",
    placementGuidance: "Constraint geometry must be preserved as evidence and mapped to affected candidate segments.",
    spacingGuidance: "N/A for constraint object.",
    capacityGuidance: "Constraints may affect construction method and available network capacity.",
    redundancyGuidance: "Avoidance or diverse routing may be required depending on severity.",
    maintenanceGuidance: "Maintenance constraints must be documented if they affect operations.",
    restorationGuidance: "Restoration obligations must be captured for affected segments.",
    evidenceRequirements: ["constraint type", "severity", "mitigation", "affected segments", "review status"],
    engineeringReviewRequired: true,
    salesEditable: false,
    routeEngineeringAuthority: true,
    severity: "REVIEW_REQUIRED",
    source: "TERALINX_DOCTRINE",
    notes: "Constraint evidence influences Prism and Route Engineering review.",
  }),
]);

export const CORRIDOR_LENS_DESIGN_STANDARDS: readonly CorridorLensDesignStandard[] = Object.freeze([
  lensStandard({
    standardId: "LENS-STANDARD-HYPERSCALER-001",
    lensType: "HYPERSCALER",
    objectTypes: ["DATA_CENTER", "SUBSTATION", "TRANSMISSION_LINE", "GENERATION_SITE", "CLOUD_ONRAMP", "CARRIER_HOTEL", "IX", "REGEN_SITE", "CONDUIT", "FIBER", "PARCEL"],
    lensTypes: ["HYPERSCALER"],
    corridorRoles: ["AI_FABRIC", "BACKBONE_INTERCONNECT", "MSA_INTERCONNECT"],
    designRequirement: "Hyperscaler corridors require power proximity, route diversity, data center handoff, regen/optical review, high fiber count, future conduit capacity, security, and restoration context.",
    placementGuidance: "Prioritize routes and objects with evidence-backed power, handoff, and expansion context.",
    spacingGuidance: "Regen spacing and optical reach are Route Engineering decisions.",
    capacityGuidance: "High fiber count and future conduit capacity must be approved before commercial claims.",
    redundancyGuidance: "Route diversity must be reviewed against shared ROW, shared structures, and restoration objectives.",
    maintenanceGuidance: "Security, access, and high-availability maintenance expectations must be documented.",
    restorationGuidance: "Restoration assumptions must be SLA-backed and evidence-based.",
    evidenceRequirements: ["power evidence", "handoff evidence", "diversity evidence", "capacity evidence", "security and restoration evidence"],
    engineeringReviewRequired: true,
    salesEditable: false,
    routeEngineeringAuthority: true,
    severity: "REVIEW_REQUIRED",
    source: "TERALINX_DOCTRINE",
    notes: "Hyperscaler lens elevates power, interconnection, AI, and strategic standards.",
  }),
  lensStandard({
    standardId: "LENS-STANDARD-NEOCLOUD-001",
    lensType: "NEOCLOUD",
    objectTypes: ["GPU_ARRAY", "DATA_CENTER", "POWER_FEED", "SUBSTATION", "TRANSMISSION_LINE", "CLOUD_ONRAMP", "CARRIER_HOTEL", "IX", "FIBER", "TRANSPORT_OPPORTUNITY"],
    lensTypes: ["NEOCLOUD"],
    corridorRoles: ["AI_FABRIC", "BACKBONE_INTERCONNECT", "INTERCONNECTION"],
    designRequirement: "Neocloud corridors require GPU array support, high-capacity transport, power evidence, carrier hotel/cloud access, and dark fiber or transport optionality.",
    placementGuidance: "Prioritize dense interconnection, power-adjacent sites, and expansion corridors.",
    spacingGuidance: "Optical and regen standards must be reviewed for low-latency transport.",
    capacityGuidance: "Capacity must support high-bandwidth AI workloads and optionality.",
    redundancyGuidance: "Resilience expectations should be reviewed for critical AI traffic.",
    maintenanceGuidance: "Maintenance assumptions must match service availability claims.",
    restorationGuidance: "Restoration must align with transport and dark fiber commitments.",
    evidenceRequirements: ["GPU demand evidence", "power evidence", "interconnection evidence", "fiber capacity evidence"],
    engineeringReviewRequired: true,
    salesEditable: false,
    routeEngineeringAuthority: true,
    severity: "REVIEW_REQUIRED",
    source: "TERALINX_DOCTRINE",
    notes: "Neocloud lens values high-capacity optionality before recommendations.",
  }),
  lensStandard({
    standardId: "LENS-STANDARD-DUCT-MONETIZATION-001",
    lensType: "DUCT_MONETIZATION",
    objectTypes: ["CONDUIT", "INNERDUCT", "RIGHT_OF_WAY", "PARCEL", "DUCT_OPPORTUNITY", "WIRELESS_SITE"],
    lensTypes: ["DUCT_MONETIZATION"],
    corridorRoles: ["METRO_AGGREGATION", "REGIONAL_AGGREGATION", "INTERCONNECTION"],
    designRequirement: "Duct monetization requires spare duct accounting, sale-eligible duct, maintenance model, and ISP/WISP/utility opportunity proximity.",
    placementGuidance: "Use duct and ROW evidence to identify commercial availability, not to declare sellable capacity.",
    spacingGuidance: "Access spacing and handhole availability must be reviewed for operational use.",
    capacityGuidance: "Sale-eligible duct must be separated from occupied, reserved, and maintenance duct.",
    redundancyGuidance: "Duct diversity must be evidence-backed.",
    maintenanceGuidance: "Maintenance rights and physical access must be documented.",
    restorationGuidance: "Restoration obligations affect duct economics and must be preserved.",
    evidenceRequirements: ["duct count", "spare duct", "sale eligibility", "maintenance rights", "ROW evidence"],
    engineeringReviewRequired: true,
    salesEditable: false,
    routeEngineeringAuthority: true,
    severity: "REVIEW_REQUIRED",
    source: "TERALINX_DOCTRINE",
    notes: "Duct monetization remains advisory until Route Engineering validates residual capacity.",
  }),
  lensStandard({
    standardId: "LENS-STANDARD-DARK-FIBER-IRU-001",
    lensType: "DARK_FIBER_IRU",
    objectTypes: ["FIBER", "FIBER_PAIR", "SPLICE", "DATA_CENTER", "CARRIER_HOTEL", "BACKBONE_NODE"],
    lensTypes: ["DARK_FIBER_IRU"],
    corridorRoles: ["MSA_INTERCONNECT", "BACKBONE_INTERCONNECT", "INTERCONNECTION"],
    designRequirement: "Dark fiber IRU corridors require strand reservation, route diversity, splice points, handoff design, and IRU boundary definition.",
    placementGuidance: "Preserve splice, handoff, and boundary evidence for engineering review.",
    spacingGuidance: "Splice and access spacing must support the IRU service model.",
    capacityGuidance: "IRU-eligible strands must be approved and separated from reserved or committed capacity.",
    redundancyGuidance: "Diversity claims must be reviewed against shared facilities and ROW.",
    maintenanceGuidance: "Maintenance boundaries and access rights must be explicit.",
    restorationGuidance: "Restoration obligations must be aligned to IRU terms.",
    evidenceRequirements: ["strand count", "strand reservation", "handoff design", "IRU boundary", "diversity evidence"],
    engineeringReviewRequired: true,
    salesEditable: false,
    routeEngineeringAuthority: true,
    severity: "REVIEW_REQUIRED",
    source: "TERALINX_DOCTRINE",
    notes: "IRU product intent cannot override engineering capacity truth.",
  }),
  lensStandard({
    standardId: "LENS-STANDARD-TRANSPORT-001",
    lensType: "TRANSPORT",
    objectTypes: ["REGEN_SITE", "ADM_SITE", "POP", "BACKBONE_NODE", "DATA_CENTER", "CARRIER_HOTEL", "IX", "CLOUD_ONRAMP"],
    lensTypes: ["TRANSPORT"],
    corridorRoles: TRANSPORT_ROLES,
    designRequirement: "Transport corridors require topology, optical design, regen/ADM placement, SLA, and restoration review.",
    placementGuidance: "Review add/drop, regen, POP, and facility placement as a transport topology.",
    spacingGuidance: "Regen and ADM spacing must follow optical and service model review.",
    capacityGuidance: "Transport capacity must be tied to platform and product assumptions.",
    redundancyGuidance: "Protected path or restoration claims require topology evidence.",
    maintenanceGuidance: "Operational and maintenance model must support SLA assumptions.",
    restorationGuidance: "Restoration design is a Route Engineering authority decision.",
    evidenceRequirements: ["topology", "optical design", "SLA", "regen review", "ADM review", "restoration plan"],
    engineeringReviewRequired: true,
    salesEditable: false,
    routeEngineeringAuthority: true,
    severity: "REVIEW_REQUIRED",
    source: "TERALINX_DOCTRINE",
    notes: "Transport lens makes optical and topology standards primary.",
  }),
  lensStandard({
    standardId: "LENS-STANDARD-ENTERPRISE-001",
    lensType: "ENTERPRISE",
    objectTypes: ["ENTERPRISE_BUILDING", "DATA_CENTER", "CARRIER_HOTEL", "CLOUD_ONRAMP", "CONDUIT", "FIBER", "PARCEL"],
    lensTypes: ["ENTERPRISE"],
    corridorRoles: METRO_ROLES,
    designRequirement: "Enterprise corridors require lateral access, construction feasibility, service availability, building entry, and commercial serviceability review.",
    placementGuidance: "Review building entry, route laterals, and access construction before service claims.",
    spacingGuidance: "Access point spacing is driven by building entry and lateral route engineering.",
    capacityGuidance: "Enterprise service capacity must be tied to approved fiber and product design.",
    redundancyGuidance: "Diversity is product-specific and must be reviewed.",
    maintenanceGuidance: "Building access and maintenance windows must be captured.",
    restorationGuidance: "Restoration obligations must align with product and building access terms.",
    evidenceRequirements: ["building entry", "lateral constructability", "service availability", "fiber capacity", "commercial serviceability"],
    engineeringReviewRequired: true,
    salesEditable: false,
    routeEngineeringAuthority: true,
    severity: "REVIEW_REQUIRED",
    source: "TERALINX_DOCTRINE",
    notes: "Enterprise serviceability is not equivalent to route proximity.",
  }),
  lensStandard({
    standardId: "LENS-STANDARD-POWER-AI-EXPANSION-001",
    lensType: "POWER_AI_EXPANSION",
    objectTypes: ["SUBSTATION", "TRANSMISSION_LINE", "GENERATION_SITE", "PARCEL", "DEVELOPMENT_SITE", "DATA_CENTER", "GPU_ARRAY"],
    lensTypes: ["POWER_AI_EXPANSION"],
    corridorRoles: AI_ROLES,
    designRequirement: "Power AI expansion corridors require substation, transmission, generation, parcel, and future campus suitability context.",
    placementGuidance: "Power-adjacent and expansion parcels must remain evidence-backed until engineering review.",
    spacingGuidance: "N/A for expansion lens, except supporting transport design.",
    capacityGuidance: "Power and fiber capacity are not assumed from proximity.",
    redundancyGuidance: "AI expansion diversity requires power and network evidence.",
    maintenanceGuidance: "Long-term access, utility, and route maintenance should be preserved as evidence.",
    restorationGuidance: "Restoration assumptions require power and network continuity evidence.",
    evidenceRequirements: ["substation evidence", "transmission evidence", "generation evidence", "parcel evidence", "fiber proximity"],
    engineeringReviewRequired: true,
    salesEditable: false,
    routeEngineeringAuthority: true,
    severity: "CONDITIONAL",
    source: "TERALINX_DOCTRINE",
    notes: "Power AI expansion lens is strategic evidence, not power availability truth.",
  }),
]);

export function getObjectDesignStandards(objectType: CorridorLensObjectType): CorridorObjectDesignStandard[] {
  return CORRIDOR_OBJECT_DESIGN_STANDARDS.filter((standard) => standard.objectType === objectType);
}

export function getLensDesignStandards(lensType: CorridorLensType): CorridorLensDesignStandard[] {
  return CORRIDOR_LENS_DESIGN_STANDARDS.filter((standard) => standard.lensType === lensType);
}
