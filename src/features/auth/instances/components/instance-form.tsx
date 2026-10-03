import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { InstanceFormState } from "../use-instance-form";
import type { VerifyState } from "../use-instance-verify";
import { VerifyStatus } from "./verify-status";

interface InstanceFormProps {
  readonly form: InstanceFormState;
  readonly verifyState: VerifyState | undefined;
}

export function InstanceForm({ form, verifyState }: InstanceFormProps) {
  const { draft, errors } = form;

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        form.submit();
      }}
    >
      <FieldGroup>
        <Field data-invalid={errors.name !== undefined}>
          <FieldLabel htmlFor="instance-name">Name</FieldLabel>
          <Input
            id="instance-name"
            autoComplete="off"
            value={draft.name}
            aria-invalid={errors.name !== undefined}
            onChange={(event) => form.setName(event.target.value)}
          />
          <FieldError>{errors.name}</FieldError>
        </Field>
        <Field data-invalid={errors.baseUrl !== undefined}>
          <FieldLabel htmlFor="instance-base-url">Base URL</FieldLabel>
          <Input
            id="instance-base-url"
            type="url"
            inputMode="url"
            autoComplete="off"
            placeholder="http://localhost:31415"
            value={draft.baseUrl}
            aria-invalid={errors.baseUrl !== undefined}
            onChange={(event) => form.setBaseUrl(event.target.value)}
          />
          <FieldError>{errors.baseUrl}</FieldError>
          <VerifyStatus state={verifyState} />
        </Field>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={form.close}>
            Cancel
          </Button>
          <Button type="button" variant="outline" onClick={form.verifyDraft}>
            Verify
          </Button>
          <Button type="submit">Save</Button>
        </div>
      </FieldGroup>
    </form>
  );
}
