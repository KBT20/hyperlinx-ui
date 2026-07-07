import {
  archiveCommercialOpportunity,
  listEngineeringPackages,
  listCommercialRoutes,
  listCommercialOpportunities,
  loadCommercialRoute,
  openEngineeringPackage,
  listProposalDrafts,
  openCommercialOpportunity,
  saveEngineeringPackage,
  saveCommercialRoute,
  saveCommercialOpportunity,
  saveProposalDraft,
  verifyCommercialRoute,
  type EngineeringPackageRuntime,
  type ProposalRuntimeObject,
  type TeralinxAuthSession,
} from "../api/teralinxRuntime";
import {
  listGovernedAccounts,
  listGovernedContacts,
  listRuntimeHistory,
  saveGovernedAccount,
  saveGovernedContact,
  type GovernedAccount,
  type GovernedContact,
  type RuntimeHistoryEvent,
} from "../api/accountLibrary";
import { commitRuntimeTranslation } from "../api/runtimeFoundation";
import { loadCustomerInventoryForAccount, type CustomerInventoryLoadResult } from "../customerInventory/CustomerNetworkInventory";
import { buildRuntimeCommitFromExistingInventoryImport, type RuntimeTranslationCommitRequest } from "../runtime/RuntimeObjectModel";
import {
  attachPricedDraftToImportedRoute,
  markImportedRoutePromoted,
  parseCustomerDesignFile,
} from "../translate/CustomerDesignImportEngine";
import type { CustomerDesignImport, ImportedCustomerRoute } from "../translate/CustomerDesignImport";
import type { CommercialCorridorDraft } from "../commercial/CommercialCorridorDraftEngine";
import type { DALCoordinate } from "../types/dal";

export type ExistingNetworkImportInput = {
  file: File;
  accountId: string;
  customerName: string;
  uploadedBy: string;
  currentUserName: string;
  currentUserId: string;
  currentOrganizationId: string;
  currentWorkspaceId: string;
  session?: TeralinxAuthSession | null;
};

export type ExistingNetworkImportResult = {
  commit: Awaited<ReturnType<typeof commitRuntimeTranslation>>;
  runtimeCommit: RuntimeTranslationCommitRequest;
};

export type RouteImportInput = {
  file: File;
  accountId: string;
  customerName: string;
  uploadedBy: string;
};

export type CommercialRouteEvidence = {
  evidenceId: string;
  fileName: string;
  type: string;
  source: string;
  repositoryLocation: string;
  originalImportDate: string;
  sizeBytes?: number;
  checksum?: string;
  immutable: true;
};

export type CommercialRouteRepositoryRecord = {
  routeRepositoryId: string;
  routeSnapshotId: string;
  routeGeometryId?: string;
  geometryHash?: string;
  opportunityId: string;
  accountId: string;
  customerId: string;
  productId?: string;
  productName?: string;
  routeId: string;
  routeName: string;
  sourceImportId?: string;
  sourceRouteId?: string;
  sourceFileName?: string;
  importedEvidence: CommercialRouteEvidence[];
  immutableImportedEvidence: true;
  commercialGeometry: DALCoordinate[];
  convertedRuntimeGeometry: DALCoordinate[];
  simplifiedGeometry: DALCoordinate[];
  renderedGeometryCache: DALCoordinate[];
  boundingBox: { west: number; south: number; east: number; north: number } | null;
  routeFeet: number;
  routeMiles: number;
  length: { feet: number; miles: number };
  aLocation: { label: string; coordinate: DALCoordinate | null };
  zLocation: { label: string; coordinate: DALCoordinate | null };
  commercialDraftSnapshot?: CommercialCorridorDraft | null;
  selectedRouteSnapshot?: ImportedCustomerRoute | null;
  sourceImportSnapshot?: CustomerDesignImport | null;
  routeSource: "IMPORTED_EVIDENCE" | "COMMERCIAL_DRAFT" | "MANUAL" | "NONE";
  authority: "COMMERCIAL_ROUTE_REPOSITORY";
  noScopeVersionCreation: true;
  noInventoryMutation: true;
  createdAt: string;
  updatedAt: string;
};

export interface RouteRepository {
  listRoutes(session?: TeralinxAuthSession | null): Promise<CommercialRouteRepositoryRecord[]>;
  loadRoute(routeRepositoryId: string, session?: TeralinxAuthSession | null): Promise<CommercialRouteRepositoryRecord>;
  saveRoute(record: CommercialRouteRepositoryRecord, session?: TeralinxAuthSession | null): Promise<CommercialRouteRepositoryRecord>;
  verifyRoute(routeRepositoryId: string, expected?: { geometryHash?: string }, session?: TeralinxAuthSession | null): Promise<CommercialRouteRepositoryRecord>;
}

export interface CustomerRepository {
  listCustomers(): Promise<GovernedAccount[]>;
  listContacts(): Promise<GovernedContact[]>;
  listHistory(): Promise<RuntimeHistoryEvent[]>;
  saveCustomer(record: Partial<GovernedAccount>): Promise<GovernedAccount>;
  saveContact(record: Partial<GovernedContact>): Promise<GovernedContact>;
}

export interface CustomerTwinRepository {
  loadCustomerTwin(accountId: string): Promise<CustomerInventoryLoadResult>;
  importExistingNetwork(input: ExistingNetworkImportInput): Promise<ExistingNetworkImportResult>;
}

export interface OpportunityRepository {
  listOpportunities<T>(session?: TeralinxAuthSession | null): Promise<T[]>;
  saveOpportunity<T extends { opportunityId: string }>(record: T, session?: TeralinxAuthSession | null): Promise<T>;
  openOpportunity<T>(opportunityId: string, session?: TeralinxAuthSession | null): Promise<T>;
  archiveOpportunity<T>(opportunityId: string, session?: TeralinxAuthSession | null): Promise<T>;
}

export interface EngineeringRepository {
  listPackages(session?: TeralinxAuthSession | null): Promise<EngineeringPackageRuntime[]>;
  openPackage(engineeringPackageId: string, session?: TeralinxAuthSession | null): Promise<EngineeringPackageRuntime>;
  savePackage(record: Partial<EngineeringPackageRuntime>, session?: TeralinxAuthSession | null): Promise<EngineeringPackageRuntime>;
}

export const RouteRepository: RouteRepository = {
  listRoutes: listCommercialRoutes,
  loadRoute: loadCommercialRoute,
  saveRoute: saveCommercialRoute,
  verifyRoute: verifyCommercialRoute,
};

export const EngineeringRepository: EngineeringRepository = {
  listPackages: listEngineeringPackages,
  openPackage: openEngineeringPackage,
  savePackage: saveEngineeringPackage,
};

export interface ProposalRepository {
  listProposals<T>(session?: TeralinxAuthSession | null): Promise<T[]>;
  saveProposal<T extends ProposalRuntimeObject>(record: T, session?: TeralinxAuthSession | null): Promise<T>;
}

export interface RevisionRepository {
  appendRevision<T extends { revisionHistory?: Array<Record<string, unknown>> }>(
    record: T,
    revision: Record<string, unknown>,
  ): T;
}

export interface TemplateRepository {
  proposalTemplateId(): string;
  serviceOrderTemplateId(): string;
}

export interface ImportRepository {
  parseRouteImport(input: RouteImportInput): Promise<CustomerDesignImport>;
  attachPricedDraft(record: CustomerDesignImport, routeId: string, draft: ImportedCustomerRoute["pricedDraft"], actor: string): CustomerDesignImport;
  markRoutePromoted(
    record: CustomerDesignImport,
    routeId: string,
    eventType: "ROUTE_PROMOTED_TO_COMMERCIAL_DRAFT" | "ROUTE_OPENED_IN_ENGINEERING",
    actor: string,
  ): CustomerDesignImport;
}

export const CustomerRepository: CustomerRepository = {
  listCustomers: listGovernedAccounts,
  listContacts: listGovernedContacts,
  listHistory: listRuntimeHistory,
  saveCustomer: saveGovernedAccount,
  saveContact: saveGovernedContact,
};

function existingInventoryJsonCommit(input: any, context: ExistingNetworkImportInput): RuntimeTranslationCommitRequest {
  const timestamp = new Date().toISOString();
  const sourceEvidenceId = `EVIDENCE-RUNTIME-INVENTORY-${context.accountId}-${Date.now()}`;
  const sourceEvidence = {
    evidenceId: sourceEvidenceId,
    sourceType: "JSON_RUNTIME_INVENTORY",
    sourceName: context.file.name,
    sourceSystem: "Commercial Repository Existing Inventory",
    authority: "CUSTOMER_EVIDENCE" as const,
    validationStatus: "PENDING" as const,
    collectedAt: timestamp,
    ingestedAt: timestamp,
    lineage: {
      accountId: context.accountId,
      customerName: context.customerName,
      sourceFileName: context.file.name,
    },
    metadata: {
      accountId: context.accountId,
      customerName: context.customerName,
      owner: context.customerName,
      organizationId: context.currentOrganizationId,
      workspaceId: context.currentWorkspaceId,
    },
  };
  const inputInventoryRecords = input.inventories ?? input.runtimeInventories ?? input.inventory;
  const firstInputInventory = Array.isArray(inputInventoryRecords) ? inputInventoryRecords[0] : inputInventoryRecords;
  const inventoryId = String(input.inventoryId ?? firstInputInventory?.inventoryId ?? `RUNTIME-INVENTORY-CUSTOMER-${context.accountId}-${Date.now()}`);
  const runtimeObjects = ((input.runtimeObjects ?? input.objects ?? []) as any[]).map((object, index) => {
    const runtimeId = String(object.runtimeId ?? object.objectId ?? `RUNTIME-OBJECT-${context.accountId}-${Date.now()}-${index + 1}`);
    const evidenceIds = Array.isArray(object.evidenceIds) ? object.evidenceIds : [sourceEvidenceId];
    const relationshipIds = Array.isArray(object.relationshipIds) ? object.relationshipIds : [];
    return {
      ...object,
      runtimeId,
      objectId: String(object.objectId ?? runtimeId),
      objectType: object.objectType ?? "UNKNOWN",
      name: object.name ?? runtimeId,
      owner: object.owner ?? context.customerName,
      createdBy: object.createdBy ?? context.currentUserName,
      assignedTo: Array.isArray(object.assignedTo) ? object.assignedTo : [],
      organization: object.organization ?? context.currentOrganizationId,
      organizationId: object.organizationId ?? context.currentOrganizationId,
      workspace: object.workspace ?? context.currentWorkspaceId,
      workspaceId: object.workspaceId ?? context.currentWorkspaceId,
      inventoryId: object.inventoryId ?? inventoryId,
      inventoryAuthorityType: object.inventoryAuthorityType ?? "EXISTING_CUSTOMER_INVENTORY",
      sourceType: object.sourceType ?? "JSON_RUNTIME_INVENTORY",
      sourceFilename: object.sourceFilename ?? context.file.name,
      customerId: object.customerId ?? context.accountId,
      ownerUserId: object.ownerUserId ?? context.currentUserId,
      validationStatus: object.validationStatus ?? "PENDING",
      scopeVersion: object.scopeVersion ?? "NO_SCOPEVERSION",
      customer: object.customer ?? context.customerName,
      source: object.source ?? context.file.name,
      classification: object.classification ?? object.objectType ?? "UNKNOWN",
      confidence: Number(object.confidence ?? object.metadata?.confidence ?? 72),
      visibility: object.visibility ?? "ORGANIZATION",
      authority: object.authority ?? "CUSTOMER_EVIDENCE",
      lifecycleState: object.lifecycleState ?? "ACTIVE",
      version: Number(object.version ?? 1),
      evidenceIds,
      evidenceLinks: Array.isArray(object.evidenceLinks) ? object.evidenceLinks : evidenceIds,
      relationshipIds,
      relationshipLinks: Array.isArray(object.relationshipLinks) ? object.relationshipLinks : relationshipIds,
      createdAt: object.createdAt ?? timestamp,
      updatedAt: timestamp,
      metadata: {
        ...(object.metadata ?? {}),
        lane: "EXISTING_INVENTORY",
        inventoryId,
        inventoryAuthorityType: "EXISTING_CUSTOMER_INVENTORY",
        accountId: context.accountId,
        customerName: context.customerName,
        sourceFileName: context.file.name,
      },
    };
  });
  const inventories = (inputInventoryRecords ? (Array.isArray(inputInventoryRecords) ? inputInventoryRecords : [inputInventoryRecords]) : []) as any[];
  const normalizedInventories = inventories.length ? inventories.map((inventory) => ({
    ...inventory,
    inventoryId: String(inventory.inventoryId ?? inventoryId),
    inventoryType: inventory.inventoryType ?? "CUSTOMER",
    owner: inventory.owner ?? context.customerName,
    name: inventory.name ?? `${context.customerName} Customer Inventory`,
    organization: inventory.organization ?? context.currentOrganizationId,
    workspace: inventory.workspace ?? context.currentWorkspaceId,
    visibility: inventory.visibility ?? "ORGANIZATION",
    authority: inventory.authority ?? "CUSTOMER_EVIDENCE",
    lifecycleState: inventory.lifecycleState ?? inventory.status ?? "ACTIVE",
    customer: inventory.customer ?? context.customerName,
    customerId: inventory.customerId ?? context.accountId,
    source: inventory.source ?? context.file.name,
    sourceType: inventory.sourceType ?? "JSON_RUNTIME_INVENTORY",
    sourceFilename: inventory.sourceFilename ?? context.file.name,
    inventoryAuthorityType: inventory.inventoryAuthorityType ?? "EXISTING_CUSTOMER_INVENTORY",
    ownerUserId: inventory.ownerUserId ?? context.currentUserId,
    validationStatus: inventory.validationStatus ?? "PENDING",
    runtimeObjectIds: Array.isArray(inventory.runtimeObjectIds) ? inventory.runtimeObjectIds : runtimeObjects.map((object) => object.runtimeId),
    version: Number(inventory.version ?? 1),
    status: inventory.status ?? "ACTIVE",
    evidenceIds: Array.isArray(inventory.evidenceIds) ? inventory.evidenceIds : [sourceEvidenceId],
    objectIds: Array.isArray(inventory.objectIds) ? inventory.objectIds : runtimeObjects.map((object) => object.runtimeId),
    relationshipIds: Array.isArray(inventory.relationshipIds) ? inventory.relationshipIds : [],
    createdAt: inventory.createdAt ?? timestamp,
    updatedAt: timestamp,
    metadata: {
      ...(inventory.metadata ?? {}),
      lane: "EXISTING_INVENTORY",
      inventoryAuthorityType: "EXISTING_CUSTOMER_INVENTORY",
      accountId: context.accountId,
      customerName: context.customerName,
      sourceFileName: context.file.name,
      organizationId: context.currentOrganizationId,
      workspaceId: context.currentWorkspaceId,
    },
  })) : [{
    inventoryId,
    inventoryType: "CUSTOMER" as const,
    owner: context.customerName,
    name: `${context.customerName} Customer Inventory`,
    organization: context.currentOrganizationId,
    workspace: context.currentWorkspaceId,
    visibility: "ORGANIZATION" as const,
    authority: "CUSTOMER_EVIDENCE" as const,
    lifecycleState: "ACTIVE" as const,
    customer: context.customerName,
    customerId: context.accountId,
    source: context.file.name,
    sourceType: "JSON_RUNTIME_INVENTORY",
    sourceFilename: context.file.name,
    inventoryAuthorityType: "EXISTING_CUSTOMER_INVENTORY",
    ownerUserId: context.currentUserId,
    validationStatus: "PENDING",
    runtimeObjectIds: runtimeObjects.map((object) => object.runtimeId),
    version: 1,
    status: "ACTIVE" as const,
    evidenceIds: [sourceEvidenceId],
    objectIds: runtimeObjects.map((object) => object.runtimeId),
    relationshipIds: [],
    createdAt: timestamp,
    updatedAt: timestamp,
    metadata: {
      lane: "EXISTING_INVENTORY",
      inventoryAuthorityType: "EXISTING_CUSTOMER_INVENTORY",
      accountId: context.accountId,
      customerName: context.customerName,
      sourceFileName: context.file.name,
      organizationId: context.currentOrganizationId,
      workspaceId: context.currentWorkspaceId,
    },
  }];
  return {
    commitId: String(input.commitId ?? `RUNTIME-COMMIT-${context.accountId}-${Date.now()}`),
    sourceWorkspace: "CommercialPlanning",
    sourceImportId: String(input.sourceImportId ?? inventoryId),
    actor: context.currentUserName,
    committedAt: timestamp,
    evidence: [sourceEvidence, ...((input.evidence ?? input.evidenceRecords ?? []) as any[])],
    inventories: normalizedInventories,
    runtimeObjects,
    relationships: Array.isArray(input.relationships) ? input.relationships : [],
    validationReports: Array.isArray(input.validationReports) ? input.validationReports : [],
    history: Array.isArray(input.history) ? input.history : [],
    connectors: Array.isArray(input.connectors) ? input.connectors : [],
    metadata: {
      ...(input.metadata ?? {}),
      lane: "EXISTING_INVENTORY",
      accountId: context.accountId,
      customerName: context.customerName,
      sourceFileName: context.file.name,
      organizationId: context.currentOrganizationId,
      workspaceId: context.currentWorkspaceId,
    },
  };
}

export const CustomerTwinRepository: CustomerTwinRepository = {
  loadCustomerTwin: loadCustomerInventoryForAccount,
  async importExistingNetwork(input) {
    const lowerName = input.file.name.toLowerCase();
    let runtimeCommit: RuntimeTranslationCommitRequest;
    if (lowerName.endsWith(".json")) {
      const jsonText = await input.file.text();
      const parsed = JSON.parse(jsonText);
      if (parsed?.type === "FeatureCollection" || parsed?.type === "Feature" || parsed?.type === "GeometryCollection") {
        const geoJsonFile = new File([jsonText], input.file.name.replace(/\.json$/i, ".geojson"), { type: "application/geo+json" });
        const imported = await ImportRepository.parseRouteImport({
          file: geoJsonFile,
          accountId: input.accountId,
          customerName: input.customerName,
          uploadedBy: input.uploadedBy,
        });
        runtimeCommit = buildRuntimeCommitFromExistingInventoryImport({
          ...imported,
          owner: input.customerName,
          organizationId: input.currentOrganizationId,
          workspaceId: input.currentWorkspaceId,
          ownerUserId: input.currentUserId,
        } as CustomerDesignImport & Record<string, unknown>, null, input.currentUserName);
      } else {
        runtimeCommit = parsed?.runtimeCommit ?? parsed?.commit ?? existingInventoryJsonCommit(parsed, input);
        runtimeCommit = {
          ...runtimeCommit,
          sourceWorkspace: runtimeCommit.sourceWorkspace ?? "CommercialPlanning",
          actor: runtimeCommit.actor ?? input.currentUserName,
          metadata: {
            ...(runtimeCommit.metadata ?? {}),
            lane: "EXISTING_INVENTORY",
            accountId: input.accountId,
            customerName: input.customerName,
            organizationId: input.currentOrganizationId,
            workspaceId: input.currentWorkspaceId,
          },
        };
      }
    } else {
      const imported = await ImportRepository.parseRouteImport({
        file: input.file,
        accountId: input.accountId,
        customerName: input.customerName,
        uploadedBy: input.uploadedBy,
      });
      runtimeCommit = buildRuntimeCommitFromExistingInventoryImport({
        ...imported,
        owner: input.customerName,
        organizationId: input.currentOrganizationId,
        workspaceId: input.currentWorkspaceId,
        ownerUserId: input.currentUserId,
      } as CustomerDesignImport & Record<string, unknown>, null, input.currentUserName);
    }
    const commit = await commitRuntimeTranslation(runtimeCommit, input.session);
    return { commit, runtimeCommit };
  },
};

export const OpportunityRepository: OpportunityRepository = {
  listOpportunities: listCommercialOpportunities,
  saveOpportunity: saveCommercialOpportunity,
  openOpportunity: openCommercialOpportunity,
  archiveOpportunity: archiveCommercialOpportunity,
};

export const ProposalRepository: ProposalRepository = {
  listProposals: listProposalDrafts,
  saveProposal: saveProposalDraft,
};

export const RevisionRepository: RevisionRepository = {
  appendRevision(record, revision) {
    return {
      ...record,
      revisionHistory: [...(record.revisionHistory ?? []), revision],
    };
  },
};

export const TemplateRepository: TemplateRepository = {
  proposalTemplateId: () => "TEMPLATE-PROPOSAL-POINT-TO-POINT-DUCT-DARK-FIBER",
  serviceOrderTemplateId: () => "TEMPLATE-SERVICE-ORDER-POINT-TO-POINT-DUCT-DARK-FIBER",
};

export const ImportRepository: ImportRepository = {
  parseRouteImport: parseCustomerDesignFile,
  attachPricedDraft: attachPricedDraftToImportedRoute,
  markRoutePromoted: markImportedRoutePromoted,
};
