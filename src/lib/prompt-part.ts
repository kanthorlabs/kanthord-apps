import type { PromptLayer, PromptOrigin, PromptPartState, PromptReference } from "@/api/types";

export interface PromptPartPathNote {
  readonly lead: string;
  readonly path: string;
}

type PartSource = Pick<PromptReference, "origin" | "path">;

const ORIGIN_LABELS: Readonly<Record<PromptOrigin, string>> = {
  binary: "Shipped",
  file: "Overridden",
  database: "Set in KanthorD",
  repository: "Repository file",
};

const LAYER_LABELS: Readonly<Record<PromptLayer, string>> = {
  1: "KanthorD prompt",
  2: "Repository prompt",
  3: "Binding prompt",
};

const FRAMING_LABEL = "Framing";

const STATE_LABELS: Readonly<Record<PromptPartState, string>> = {
  resolved: "Resolved",
  changed: "Changed",
  invalid: "Invalid",
  unreachable: "Unreachable",
};

const STATE_NOTES: Readonly<Record<Exclude<PromptPartState, "resolved">, string>> = {
  changed: "The current source no longer holds the text of the digest.",
  invalid:
    "The file is too large, not UTF-8, unreadable or holds a control character at this commit.",
  unreachable: "The server cannot read the repository within the deadline.",
};

export function promptPartOrigin(part: PartSource): string {
  return ORIGIN_LABELS[part.origin];
}

export function promptPartPathNote(part: PartSource): PromptPartPathNote | null {
  if (part.path === null) return null;
  if (part.origin === "file") return { lead: "Override file", path: part.path };
  if (part.origin === "repository") return { lead: "Repository file", path: part.path };
  return part.origin === "binary" ? { lead: "No override file at", path: part.path } : null;
}

export function promptLayerLabel(layer: PromptLayer | null): string {
  return layer === null ? FRAMING_LABEL : LAYER_LABELS[layer];
}

export function isDefaultStandard(layer: PromptLayer | null): boolean {
  return layer === 2 || layer === 3;
}

export function promptPartStateLabel(state: PromptPartState): string {
  return STATE_LABELS[state];
}

export function promptPartStateNote(state: PromptPartState): string | null {
  return state === "resolved" ? null : STATE_NOTES[state];
}
