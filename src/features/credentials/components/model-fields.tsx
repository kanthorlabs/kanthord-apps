import { Trash2Icon } from "lucide-react";

import type { ReasoningEffort } from "@/api/types";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Item, ItemActions, ItemContent } from "@/components/ui/item";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { REASONING_EFFORTS } from "@/lib/binding-draft";
import {
  MODEL_DEFAULT_CONTEXT_WINDOW,
  MODEL_DEFAULT_MAX_TOKENS,
  type DraftErrors,
  type ModelDraft,
} from "@/lib/credential-draft";
import { CredentialField } from "./credential-field";

interface ModelFieldsProps {
  readonly index: number;
  readonly model: ModelDraft;
  readonly errors: DraftErrors;
  readonly onEdit: (model: ModelDraft) => void;
  readonly onRemove: () => void;
}

export function ModelFields({ index, model, errors, onEdit, onRemove }: ModelFieldsProps) {
  const prefix = `models.${index}`;
  const label = model.id.trim().length === 0 ? `model ${index + 1}` : model.id;

  return (
    <Item variant="outline" role="listitem" className="items-start">
      <ItemContent className="min-w-0 gap-3">
        <CredentialField
          id={`credential-model-${index}-id`}
          label="Model ID"
          value={model.id}
          error={errors[`${prefix}.id`]}
          onChange={(id) => onEdit({ ...model, id })}
        />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <CredentialField
            id={`credential-model-${index}-context-window`}
            label="Context window"
            inputMode="numeric"
            value={model.contextWindow}
            error={errors[`${prefix}.contextWindow`]}
            description={`Empty uses ${MODEL_DEFAULT_CONTEXT_WINDOW}.`}
            onChange={(contextWindow) => onEdit({ ...model, contextWindow })}
          />
          <CredentialField
            id={`credential-model-${index}-max-tokens`}
            label="Max tokens"
            inputMode="numeric"
            value={model.maxTokens}
            error={errors[`${prefix}.maxTokens`]}
            description={`Empty uses ${MODEL_DEFAULT_MAX_TOKENS}.`}
            onChange={(maxTokens) => onEdit({ ...model, maxTokens })}
          />
        </div>
        <Field>
          <FieldLabel id={`credential-model-${index}-reasoning`}>Reasoning levels</FieldLabel>
          <ToggleGroup
            variant="outline"
            size="sm"
            multiple
            aria-labelledby={`credential-model-${index}-reasoning`}
            className="flex-wrap"
            value={[...model.reasoningLevels]}
            onValueChange={(value: string[]) =>
              onEdit({
                ...model,
                reasoningLevels: REASONING_EFFORTS.filter((level: ReasoningEffort) =>
                  value.includes(level),
                ),
              })
            }
          >
            {REASONING_EFFORTS.map((level) => (
              <ToggleGroupItem key={level} value={level}>
                {level}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          <FieldDescription>None selected uses off only.</FieldDescription>
        </Field>
      </ItemContent>
      <ItemActions>
        <Button variant="ghost" size="icon" aria-label={`Remove ${label}`} onClick={onRemove}>
          <Trash2Icon />
        </Button>
      </ItemActions>
    </Item>
  );
}
