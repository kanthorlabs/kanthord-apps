import type {
  ExternalLink,
  Intent,
  MissionNodeCreateBody,
  ProjectBindingRecord,
} from "@/api/types";

export interface NodeCreateDraft {
  readonly filename: string;
  readonly name: string;
  readonly requirement: string;
  readonly criterion: string;
  readonly verifications: readonly string[];
  readonly intent: Intent;
  readonly bindings: readonly string[];
}

export type NodeCreateField =
  "filename" | "name" | "requirement" | "criterion" | "verifications" | "bindings";

export type NodeCreateErrors = Partial<Record<NodeCreateField, string>>;

const FILENAME = /^[^/\\\s]+\.md$/;
const FILENAME_LIMIT = 255;

export function emptyNodeCreateDraft(): NodeCreateDraft {
  return {
    filename: "",
    name: "",
    requirement: "",
    criterion: "",
    verifications: [""],
    intent: "implement",
    bindings: [],
  };
}

export function conversationBindingIdsOf(
  bindings: readonly ProjectBindingRecord[],
  link: ExternalLink,
): readonly string[] {
  return bindings
    .filter(
      (binding) =>
        binding.kind === "conversation" &&
        binding.removed_at === null &&
        binding.resource_identity === link.resource_identity,
    )
    .map((binding) => binding.id);
}

export function nodeCreateErrorsOf(
  draft: NodeCreateDraft,
  bindings: readonly ProjectBindingRecord[],
): NodeCreateErrors {
  const errors: Record<string, string> = {};
  const filename = draft.filename.trim();
  if (!FILENAME.test(filename) || filename.length > FILENAME_LIMIT) {
    errors["filename"] = "Enter a plan file name that ends with .md, for example fix-login.md.";
  }
  if (draft.name.trim() === "") errors["name"] = "Enter a name.";
  if (draft.requirement.trim() === "") errors["requirement"] = "Enter the requirement.";
  if (draft.criterion.trim() === "") errors["criterion"] = "Enter the criterion.";
  if (!draft.verifications.some((verification) => verification.trim() !== "")) {
    errors["verifications"] = "Add at least one verification.";
  }
  const repository = bindings.some(
    (binding) => binding.kind === "repository" && draft.bindings.includes(binding.id),
  );
  if (draft.intent === "implement" && !repository) {
    errors["bindings"] = "An implement node needs a repository binding. Pick one.";
  }
  return errors;
}

export function nodeCreateBodyOf(
  draft: NodeCreateDraft,
  link: ExternalLink,
  reason: string,
): MissionNodeCreateBody {
  return {
    filename: draft.filename.trim(),
    content: {
      name: draft.name.trim(),
      requirement: draft.requirement.trim(),
      criterion: draft.criterion.trim(),
      verifications: draft.verifications
        .map((entry) => entry.trim())
        .filter((entry) => entry !== ""),
      bindings: draft.bindings,
      intent: draft.intent,
      external_links: [link],
    },
    tasks: [],
    reason,
  };
}
