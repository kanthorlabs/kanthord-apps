import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { InlineError } from "@/features/workbench/chat/components/inline-error";
import { VARIANT_NAME_RULE, VARIANT_REVISION_CONFLICT } from "@/lib/agent-variant";
import type { VariantUpdateState } from "./use-variant-update";

export function VariantEditSheet({ edit }: { readonly edit: VariantUpdateState }) {
  const { failure, conflict } = edit;
  const nameLine = failure?.field === "name" ? failure.line : null;
  const instructionLine = failure?.field === "instruction" ? failure.line : null;
  const formLine = failure?.field === "form" ? failure.line : null;

  return (
    <Sheet open={edit.open} onOpenChange={(next) => !next && edit.cancel()}>
      <SheetContent className="data-[side=right]:w-full data-[side=right]:sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>Edit variant</SheetTitle>
          <SheetDescription>
            A variant changes only its display name and its instruction. A change takes effect at
            the next agent session.
          </SheetDescription>
        </SheetHeader>
        <form
          noValidate
          aria-label="Edit variant"
          className="flex min-h-0 flex-1 flex-col"
          onSubmit={(event) => {
            event.preventDefault();
            void edit.submit();
          }}
        >
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4">
            <FieldGroup>
              <Field data-invalid={nameLine !== null}>
                <FieldLabel htmlFor="variant-edit-name">Display name</FieldLabel>
                <Input
                  id="variant-edit-name"
                  autoComplete="off"
                  aria-invalid={nameLine !== null}
                  aria-describedby={
                    nameLine === null
                      ? "variant-edit-name-rule"
                      : "variant-edit-name-rule variant-edit-name-error"
                  }
                  value={edit.name}
                  onChange={(event) => edit.setName(event.target.value)}
                />
                <FieldDescription id="variant-edit-name-rule">{VARIANT_NAME_RULE}</FieldDescription>
                {nameLine !== null && (
                  <InlineError
                    id="variant-edit-name-error"
                    code={nameLine.code}
                    message={nameLine.message}
                  />
                )}
              </Field>
              <Field data-invalid={instructionLine !== null}>
                <FieldLabel htmlFor="variant-edit-instruction">Instruction</FieldLabel>
                <Textarea
                  id="variant-edit-instruction"
                  aria-invalid={instructionLine !== null}
                  aria-describedby={
                    instructionLine === null ? undefined : "variant-edit-instruction-error"
                  }
                  className="max-h-[50dvh] min-h-60"
                  value={edit.instruction}
                  onChange={(event) => edit.setInstruction(event.target.value)}
                />
                {instructionLine !== null && (
                  <InlineError
                    id="variant-edit-instruction-error"
                    code={instructionLine.code}
                    message={instructionLine.message}
                  />
                )}
              </Field>
              {formLine !== null && <InlineError code={formLine.code} message={formLine.message} />}
              {conflict !== null && (
                <div className="flex min-w-0 flex-col gap-2">
                  <InlineError code={VARIANT_REVISION_CONFLICT} message={conflict.message} />
                  <section
                    aria-label="Current variant"
                    className="flex min-w-0 flex-col gap-1 rounded-md border p-3 text-sm"
                  >
                    <p className="font-medium break-words">
                      {conflict.current.display_name} (v{conflict.current.revision})
                    </p>
                    <p className="break-words whitespace-pre-wrap text-muted-foreground">
                      {conflict.current.instruction}
                    </p>
                  </section>
                  <FieldDescription>
                    Your draft stays. Save again to write it over revision{" "}
                    {conflict.current.revision}.
                  </FieldDescription>
                </div>
              )}
            </FieldGroup>
          </div>
          <SheetFooter className="flex-row flex-wrap justify-start md:justify-end">
            <Button type="button" variant="outline" onClick={edit.cancel}>
              Cancel
            </Button>
            <Button type="submit" disabled={edit.pending}>
              Save variant
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
