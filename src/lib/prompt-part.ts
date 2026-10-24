import type { PromptPart } from "@/api/types";

export function promptPartOrigin(part: PromptPart): string {
  if (part.origin === "database") return "Binding prompt";
  if (part.origin === "file") return `Overridden by ${part.path}`;
  return part.path === null ? "Shipped" : `Shipped (override: ${part.path})`;
}
