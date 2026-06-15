import type { ReasoningWorkspace } from "../schemas.js";
import { controlPrompt } from "./control.js";
import { designPrompt } from "./design.js";
import { fieldPrompt } from "./field.js";
import { graphPrompt } from "./graph.js";
import { marketplacePrompt } from "./marketplace.js";
import { operationalIntelligencePrompt } from "./operationalIntelligence.js";
import { prismPrompt } from "./prism.js";
import { translatePrompt } from "./translate.js";
import { twinPrompt } from "./twin.js";

export function workspacePrompt(workspace: ReasoningWorkspace) {
  if (workspace === "translate") return translatePrompt;
  if (workspace === "inventory" || workspace === "graph-viewer") return graphPrompt;
  if (workspace === "design") return designPrompt;
  if (workspace === "prism" || workspace === "portfolio") return prismPrompt;
  if (workspace === "marketplace") return marketplacePrompt;
  if (workspace === "control") return controlPrompt;
  if (workspace === "field") return fieldPrompt;
  if (workspace === "twin") return twinPrompt;
  return operationalIntelligencePrompt;
}
