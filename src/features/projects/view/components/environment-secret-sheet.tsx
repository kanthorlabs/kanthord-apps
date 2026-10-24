import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { EnvironmentSecretDraft, EnvironmentSecretErrors } from "../use-environment-secret";

interface EnvironmentSecretSheetProps {
  readonly draft: EnvironmentSecretDraft;
  readonly errors: EnvironmentSecretErrors;
  readonly sending: boolean;
  readonly sendError: string | null;
  readonly onEdit: (patch: Partial<EnvironmentSecretDraft>) => void;
  readonly onSend: () => void;
  readonly onClose: () => void;
}

export function EnvironmentSecretSheet({
  draft,
  errors,
  sending,
  sendError,
  onEdit,
  onSend,
  onClose,
}: EnvironmentSecretSheetProps) {
  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="data-[side=right]:w-full data-[side=right]:sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Set secret</SheetTitle>
          <SheetDescription>
            The onCreateCommand steps of the image build read the secret as an environment variable.
            No slot, proof or log holds it.
          </SheetDescription>
        </SheetHeader>
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4">
          {sendError !== null && (
            <Alert variant="destructive" className="min-w-0">
              <AlertDescription className="break-words">{sendError}</AlertDescription>
            </Alert>
          )}
          <FieldGroup>
            <Field data-invalid={errors.variable !== undefined}>
              <FieldLabel htmlFor="environment-secret-variable">Variable</FieldLabel>
              <Input
                id="environment-secret-variable"
                className="font-mono"
                autoComplete="off"
                spellCheck={false}
                value={draft.variable}
                aria-invalid={errors.variable !== undefined}
                onChange={(event) => onEdit({ variable: event.target.value })}
              />
              <FieldError>{errors.variable}</FieldError>
            </Field>
            <Field data-invalid={errors.credential !== undefined}>
              <FieldLabel htmlFor="environment-secret-credential">Credential</FieldLabel>
              <Input
                id="environment-secret-credential"
                autoComplete="off"
                spellCheck={false}
                value={draft.credential}
                aria-invalid={errors.credential !== undefined}
                onChange={(event) => onEdit({ credential: event.target.value })}
              />
              <FieldError>{errors.credential}</FieldError>
            </Field>
            <Field data-invalid={errors.value !== undefined}>
              <FieldLabel htmlFor="environment-secret-value">Secret value</FieldLabel>
              <Input
                id="environment-secret-value"
                type="password"
                autoComplete="off"
                value={draft.value}
                aria-invalid={errors.value !== undefined}
                onChange={(event) => onEdit({ value: event.target.value })}
              />
              <FieldError>{errors.value}</FieldError>
            </Field>
          </FieldGroup>
        </div>
        <SheetFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" className="w-full sm:w-auto" disabled={sending} onClick={onSend}>
            Set secret
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
