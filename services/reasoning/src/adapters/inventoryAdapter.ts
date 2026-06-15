import { summarizeGraphContext } from "../tools/graphTools.js";
import { summarizeValidation } from "../tools/validationTools.js";

export function inventoryAdapter(context: any) {
  return {
    graph: summarizeGraphContext(context),
    validation: summarizeValidation(context),
  };
}

