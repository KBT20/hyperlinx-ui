import { DIRS, handleJsonCollection, nowIso, routeMatch } from "./_shared.js";
import { requireAnyPermission } from "./authority.js";

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
  const match = routeMatch(pathname, "/api/customer-design-imports");
  if (!match) return false;
  if (req.method === "GET") {
    if (!requireAnyPermission(req, res, ["customerDesign.read", "customerDesign.manage"], "You do not have authority to read Customer Design Requests.")) return true;
  } else if (["POST", "PUT"].includes(String(req.method))) {
    if (!requireAnyPermission(req, res, ["customerDesign.manage"], "You do not have authority to create or update Customer Design Requests.")) return true;
  }
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
