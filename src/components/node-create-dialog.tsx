import type { ReactNode } from "react";

import { TextField } from "@/components/text-field";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import type { Intent } from "@/api/types";
import type { NodeCreateState } from "@/hooks/use-node-create";

const INTENTS: readonly Intent[] = ["implement", "examine"];

export function NodeCreateDialog({
  create,
  message,
}: {
  readonly create: NodeCreateState;
  readonly message: ReactNode;
}) {
  const { draft, errors } = create;
  return (
    <Dialog open onOpenChange={(open) => !open && create.cancel()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Create node</DialogTitle>
          <DialogDescription>
            The node links to this thread. Write each field yourself. The dialog copies no text from
            the message.
          </DialogDescription>
        </DialogHeader>
        <div className="grid min-w-0 gap-4 md:grid-cols-2">
          <section aria-label="Message of the thread" className="flex min-w-0 flex-col gap-2">
            {message}
          </section>
          <form
            className="flex min-w-0 flex-col gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              create.submit();
            }}
          >
            <TextField
              id="node-create-filename"
              label="File name"
              value={draft.filename}
              error={errors.filename}
              description="The plan file of the node, for example fix-login.md."
              onChange={(text) => create.setText("filename", text)}
            />
            <TextField
              id="node-create-name"
              label="Name"
              value={draft.name}
              error={errors.name}
              description="Short title of the node."
              onChange={(text) => create.setText("name", text)}
            />
            <Field data-invalid={errors.requirement !== undefined}>
              <FieldLabel htmlFor="node-create-requirement">Requirement</FieldLabel>
              <Textarea
                id="node-create-requirement"
                value={draft.requirement}
                aria-invalid={errors.requirement !== undefined}
                onChange={(event) => create.setText("requirement", event.target.value)}
              />
              <FieldError>{errors.requirement}</FieldError>
            </Field>
            <Field data-invalid={errors.criterion !== undefined}>
              <FieldLabel htmlFor="node-create-criterion">Criterion</FieldLabel>
              <Textarea
                id="node-create-criterion"
                value={draft.criterion}
                aria-invalid={errors.criterion !== undefined}
                onChange={(event) => create.setText("criterion", event.target.value)}
              />
              <FieldError>{errors.criterion}</FieldError>
            </Field>
            <FieldSet>
              <FieldLegend variant="label">Verifications</FieldLegend>
              {draft.verifications.map((verification, index) => (
                <Field key={index} orientation="horizontal">
                  <FieldLabel className="sr-only" htmlFor={`node-create-verification-${index}`}>
                    Verification {index + 1}
                  </FieldLabel>
                  <Input
                    id={`node-create-verification-${index}`}
                    value={verification}
                    autoComplete="off"
                    spellCheck={false}
                    onChange={(event) => create.setVerification(index, event.target.value)}
                  />
                  {draft.verifications.length > 1 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      aria-label={`Remove verification ${index + 1}`}
                      onClick={() => create.removeVerification(index)}
                    >
                      Remove
                    </Button>
                  )}
                </Field>
              ))}
              <FieldError>{errors.verifications}</FieldError>
              <div>
                <Button type="button" variant="outline" size="sm" onClick={create.addVerification}>
                  Add verification
                </Button>
              </div>
            </FieldSet>
            <FieldSet>
              <FieldLegend variant="label">Intent</FieldLegend>
              <RadioGroup
                value={draft.intent}
                onValueChange={(value) => create.setIntent(value as Intent)}
              >
                {INTENTS.map((intent) => (
                  <Field key={intent} orientation="horizontal">
                    <RadioGroupItem id={`node-create-intent-${intent}`} value={intent} />
                    <FieldLabel htmlFor={`node-create-intent-${intent}`}>{intent}</FieldLabel>
                  </Field>
                ))}
              </RadioGroup>
            </FieldSet>
            <FieldSet>
              <FieldLegend variant="label">Bindings</FieldLegend>
              <FieldDescription>
                Pick the bindings of the node. The conversation binding of the thread is picked.
              </FieldDescription>
              {create.choices.map((binding) => (
                <Field key={binding.id} orientation="horizontal">
                  <Checkbox
                    id={`node-create-binding-${binding.id}`}
                    checked={draft.bindings.includes(binding.id)}
                    onCheckedChange={(picked) => create.toggleBinding(binding.id, picked)}
                  />
                  <FieldLabel htmlFor={`node-create-binding-${binding.id}`}>
                    {binding.name} ({binding.kind})
                  </FieldLabel>
                </Field>
              ))}
              {create.bindings.error !== null && (
                <p role="alert" className="text-sm text-destructive">
                  {create.bindings.error.message}
                </p>
              )}
              <FieldError>{errors.bindings}</FieldError>
            </FieldSet>
            {create.error !== null && (
              <p role="alert" className="text-sm text-destructive">
                {create.error}
              </p>
            )}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={create.creating}
                onClick={create.cancel}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={create.creating}>
                Create node
              </Button>
            </DialogFooter>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
