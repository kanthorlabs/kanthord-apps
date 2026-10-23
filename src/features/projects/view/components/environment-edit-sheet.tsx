import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";

interface EnvironmentEditSheetProps {
  readonly initialText: string;
  readonly saving: boolean;
  readonly saveError: string | null;
  readonly onSave: (text: string) => void;
  readonly onClose: () => void;
}

export function EnvironmentEditSheet({
  initialText,
  saving,
  saveError,
  onSave,
  onClose,
}: EnvironmentEditSheetProps) {
  const [text, setText] = useState(initialText);

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="data-[side=right]:w-full data-[side=right]:sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>Edit environment</SheetTitle>
          <SheetDescription>
            The environment is one devcontainer.json document. KanthorD stores it on the binding and
            runs the onboarding again.
          </SheetDescription>
        </SheetHeader>
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4">
          <Field data-invalid={saveError !== null}>
            <FieldLabel htmlFor="binding-environment-text">Environment</FieldLabel>
            <Textarea
              id="binding-environment-text"
              rows={18}
              className="font-mono"
              spellCheck={false}
              value={text}
              aria-invalid={saveError !== null}
              onChange={(event) => setText(event.target.value)}
            />
            <FieldError>{saveError}</FieldError>
          </Field>
        </div>
        <SheetFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            className="w-full sm:w-auto"
            disabled={saving}
            onClick={() => onSave(text)}
          >
            Save environment
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
