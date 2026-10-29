import { ChevronDownIcon, ChevronRightIcon } from "lucide-react";

import { RevealPanel } from "@/components/reveal";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { type DraftErrors, tagsInvalid, type WorkerDraft } from "@/lib/binding-draft";
import type { AdvancedSettings } from "../use-advanced-settings";
import { DraftField } from "./draft-field";

interface WorkerAdvancedSettingsProps {
  readonly draft: WorkerDraft;
  readonly errors: DraftErrors;
  readonly settings: AdvancedSettings;
  readonly onEdit: (draft: WorkerDraft) => void;
}

export function WorkerAdvancedSettings({
  draft,
  errors,
  settings,
  onEdit,
}: WorkerAdvancedSettingsProps) {
  return (
    <Collapsible open={settings.open} onOpenChange={settings.setOpen}>
      <CollapsibleTrigger render={<Button type="button" variant="ghost" size="sm" />}>
        {settings.open ? (
          <ChevronDownIcon aria-hidden="true" data-icon="inline-start" />
        ) : (
          <ChevronRightIcon aria-hidden="true" data-icon="inline-start" />
        )}
        Advanced settings
      </CollapsibleTrigger>
      <RevealPanel>
        <FieldGroup className="pt-4">
          <DraftField
            id="binding-turns"
            label="Turn budget"
            value={draft.turns}
            error={errors["turns"]}
            inputMode="numeric"
            description="Optional. Give both budget values or neither."
            onChange={(turns) => onEdit({ ...draft, turns })}
          />
          <DraftField
            id="binding-wall-time"
            label="Wall-time budget (ms)"
            value={draft.wallTimeMs}
            error={errors["wallTimeMs"]}
            inputMode="numeric"
            onChange={(wallTimeMs) => onEdit({ ...draft, wallTimeMs })}
          />
          <Field>
            <FieldLabel htmlFor="binding-tags">Tags</FieldLabel>
            <Textarea
              id="binding-tags"
              value={draft.tags}
              aria-invalid={tagsInvalid(draft.tags)}
              autoComplete="off"
              spellCheck={false}
              onChange={(event) => onEdit({ ...draft, tags: event.target.value })}
            />
            <FieldDescription>
              One tag per line, for example platform.macos. Use lower-case dotted tags, each at most
              64 bytes, each once. A node runs only on a binding whose tags include every tag of the
              node.
            </FieldDescription>
          </Field>
        </FieldGroup>
      </RevealPanel>
    </Collapsible>
  );
}
