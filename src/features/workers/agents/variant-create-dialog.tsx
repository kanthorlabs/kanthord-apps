import type { AgentVariant } from "@/api/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { InlineError } from "@/features/workbench/chat/components/inline-error";
import { VARIANT_NAME_RULE } from "@/lib/agent-variant";
import { useVariantCreate } from "./use-variant-create";

interface VariantCreateDialogProps {
  readonly agentName: string;
  readonly onClose: () => void;
  readonly onCreated: (variant: AgentVariant) => void;
}

export function VariantCreateDialog({ agentName, onClose, onCreated }: VariantCreateDialogProps) {
  const create = useVariantCreate(agentName, onCreated);
  const { failure } = create;
  const nameLine = failure?.field === "name" ? failure.line : null;
  const instructionLine = failure?.field === "instruction" ? failure.line : null;
  const formLine = failure?.field === "form" ? failure.line : null;

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>New variant of {agentName}</DialogTitle>
          <DialogDescription>
            A variant adds its instruction to the prompt of {agentName}. A change takes effect at
            the next session of the agent.
          </DialogDescription>
        </DialogHeader>
        <form
          noValidate
          aria-label="New variant"
          className="flex min-w-0 flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            void create.submit();
          }}
        >
          <FieldGroup>
            <Field data-invalid={nameLine !== null}>
              <FieldLabel htmlFor="variant-name">Display name</FieldLabel>
              <Input
                id="variant-name"
                autoComplete="off"
                aria-invalid={nameLine !== null}
                aria-describedby="variant-name-rule"
                value={create.name}
                onChange={(event) => create.setName(event.target.value)}
              />
              <FieldDescription id="variant-name-rule">{VARIANT_NAME_RULE}</FieldDescription>
              {nameLine !== null && <InlineError code={nameLine.code} message={nameLine.message} />}
            </Field>
            <Field data-invalid={instructionLine !== null}>
              <FieldLabel htmlFor="variant-instruction">Instruction</FieldLabel>
              <Textarea
                id="variant-instruction"
                aria-invalid={instructionLine !== null}
                className="max-h-[40dvh] min-h-40"
                value={create.instruction}
                onChange={(event) => create.setInstruction(event.target.value)}
              />
              {instructionLine !== null && (
                <InlineError code={instructionLine.code} message={instructionLine.message} />
              )}
            </Field>
            {formLine !== null && <InlineError code={formLine.code} message={formLine.message} />}
          </FieldGroup>
          <DialogFooter className="flex-row flex-wrap justify-start sm:justify-start md:justify-end">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={create.pending}>
              Create variant
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
