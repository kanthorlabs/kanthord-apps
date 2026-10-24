import { BINDING_PROMPT_AGENTS } from "@/api/types";
import { FieldDescription, FieldLegend, FieldSet } from "@/components/ui/field";
import type { RepositoryDraft } from "@/lib/binding-draft";
import { BindingPromptRow } from "./binding-prompt-row";

interface BindingPromptsFieldsetProps {
  readonly draft: RepositoryDraft;
  readonly onEdit: (draft: RepositoryDraft) => void;
}

export function BindingPromptsFieldset({ draft, onEdit }: BindingPromptsFieldsetProps) {
  return (
    <FieldSet>
      <FieldLegend>Binding prompts</FieldLegend>
      <FieldDescription>
        A Binding prompt joins the Agent prompt of one agent when it works on this repository. An
        edit creates a new binding revision, so an existing node keeps the old text until{" "}
        <code>mission node rebind</code>. Onboarding treats the new revision as a changed binding
        and clears <code>environment_from_agent</code>. A rule that relaxes the standard of the
        Agent prompt goes into both swe@1 and re@1.
      </FieldDescription>
      <div
        role="list"
        aria-label="Binding prompts"
        className="grid grid-cols-[minmax(0,1fr)] gap-2"
      >
        {BINDING_PROMPT_AGENTS.map((agent) => (
          <BindingPromptRow key={agent} agent={agent} draft={draft} onEdit={onEdit} />
        ))}
      </div>
    </FieldSet>
  );
}
