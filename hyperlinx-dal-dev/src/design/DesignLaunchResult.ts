import type { DesignLaunchBlocker, DesignLaunchDiagnostic, DesignLaunchSession, DesignLaunchStatus } from "./DesignLaunchSession";

export interface DesignLaunchResult {
  status: DesignLaunchStatus;
  session?: DesignLaunchSession;
  blockers: DesignLaunchBlocker[];
  diagnostics: DesignLaunchDiagnostic[];
  nextWorkspace: "DESIGN";
}
