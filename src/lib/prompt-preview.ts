import type { PromptPart, PromptPartKind } from "@/api/types";

export type DraftPartKind = Extract<PromptPartKind, "repository" | "binding">;

export interface PreviewPart extends PromptPart {
  readonly draft: boolean;
}

export interface DraftPart {
  readonly kind: DraftPartKind;
  readonly bindingId: string;
  readonly bindingName: string;
  readonly text: string;
}

const BINDING_RANKS: Readonly<Partial<Record<PromptPartKind, number>>> = {
  instruction_file: 0,
  repository: 1,
  binding: 2,
};
const DRAFT_LAYERS = { repository: 2, binding: 3 } as const;

function rankOf(part: PromptPart): number | null {
  return BINDING_RANKS[part.part] ?? null;
}

function insertionIndex(parts: readonly PromptPart[], draft: DraftPart): number {
  const rank = BINDING_RANKS[draft.kind] ?? 0;
  const later = parts.findIndex((part) => {
    const partRank = rankOf(part);
    return part.binding_id === draft.bindingId && partRank !== null && partRank > rank;
  });
  if (later !== -1) return later;
  const earlier = parts.reduce(
    (last, part, position) => (part.binding_id === draft.bindingId ? position : last),
    -1,
  );
  if (earlier !== -1) return earlier + 1;
  const framing = parts.findIndex((part) => part.part === "framing");
  return framing === -1 ? parts.length : framing;
}

function draftPartOf(draft: DraftPart): PreviewPart {
  return {
    layer: DRAFT_LAYERS[draft.kind],
    part: draft.kind,
    name: draft.bindingName,
    origin: "database",
    path: null,
    binding_id: draft.bindingId,
    commit: null,
    digest: null,
    heading: null,
    state: "resolved",
    text: draft.text,
    draft: true,
  };
}

export function previewParts(
  parts: readonly PromptPart[],
  draft: DraftPart,
): readonly PreviewPart[] {
  const stored = parts.map((part) => ({ ...part, draft: false }));
  const index = parts.findIndex(
    (part) => part.part === draft.kind && part.binding_id === draft.bindingId,
  );
  const blank = draft.text.trim() === "";
  if (index !== -1) {
    const current = stored[index];
    if (current === undefined) return stored;
    if (blank) return stored.filter((_part, position) => position !== index);
    return stored.map((part, position) =>
      position === index
        ? { ...current, text: draft.text, digest: null, state: "resolved", draft: true }
        : part,
    );
  }
  if (blank) return stored;
  const at = insertionIndex(parts, draft);
  return [...stored.slice(0, at), draftPartOf(draft), ...stored.slice(at)];
}
