import type { PromptPart } from "@/api/types";

export interface PromptPartPathNote {
  readonly lead: string;
  readonly path: string;
}

export function promptPartOrigin(part: PromptPart): string {
  if (part.origin === "database") return "Binding prompt";
  return part.origin === "file" ? "Overridden" : "Shipped";
}

export function promptPartPathNote(part: PromptPart): PromptPartPathNote | null {
  if (part.path === null) return null;
  if (part.origin === "file") return { lead: "Override file", path: part.path };
  return part.origin === "binary" ? { lead: "No override file at", path: part.path } : null;
}
