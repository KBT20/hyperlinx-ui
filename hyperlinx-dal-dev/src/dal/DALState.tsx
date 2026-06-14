import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

export type DALWorkspace = "inventory" | "design" | "prism" | "translate";

type DALState = {
  workspace: DALWorkspace;
  setWorkspace: (workspace: DALWorkspace) => void;
  selectedInventoryId: string;
  setSelectedInventoryId: (inventoryId: string) => void;
};

const DALStateContext = createContext<DALState | null>(null);

export function DALStateProvider({ children }: { children: ReactNode }) {
  const [workspace, setWorkspace] = useState<DALWorkspace>("inventory");
  const [selectedInventoryId, setSelectedInventoryId] = useState("");
  const value = useMemo(
    () => ({ workspace, setWorkspace, selectedInventoryId, setSelectedInventoryId }),
    [workspace, selectedInventoryId]
  );

  return <DALStateContext.Provider value={value}>{children}</DALStateContext.Provider>;
}

export function useDALState() {
  const context = useContext(DALStateContext);
  if (!context) throw new Error("useDALState must be used inside DALStateProvider");
  return context;
}
