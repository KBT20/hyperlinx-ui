import { DIRS, handleJsonCollection, nowIso } from "./_shared.js";

function normalizeCustomerDesignImport(record = {}) {
  const uploadedAt = record.uploadedAt ?? record.createdAt ?? nowIso();
  return {
    ...record,
    importId: String(record.importId),
    uploadedAt,
    createdAt: record.createdAt ?? uploadedAt,
    updatedAt: record.updatedAt ?? nowIso(),
    noScopeVersionCreation: true,
    noInventoryMutation: true,
    noCertifiedRouteAuthority: true,
  };
}

export async function handleCustomerDesignImports(req, res, pathname) {
  return handleJsonCollection(req, res, pathname, {
    basePath: "/api/customer-design-imports",
    dir: DIRS.customerDesignImports,
    idKey: "importId",
    listKey: "customerDesignImports",
    itemKey: "customerDesignImport",
    pluralBodyKeys: ["customerDesignImports", "imports", "items", "data"],
    idPrefix: "customer-design-import",
    normalize: normalizeCustomerDesignImport,
  });
}
