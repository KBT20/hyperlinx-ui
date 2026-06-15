import { closureCompleteness } from "../tools/fieldTools.js";

export function fieldAdapter(context: any) {
  return closureCompleteness(context);
}

