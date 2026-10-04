import { Link } from "react-router-dom";

import { AGENT_PROVIDER_KINDS } from "@/api/types";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { REASONING_EFFORTS } from "@/lib/binding-draft";
import { useEnablementCreate } from "../use-enablement-create";

interface ChoiceFieldProps {
  readonly id: string;
  readonly label: string;
  readonly value: string;
  readonly options: readonly string[];
  readonly error: string | undefined;
  readonly onChange: (value: string | null) => void;
}

function ChoiceField({ id, label, value, options, error, onChange }: ChoiceFieldProps) {
  const items = options.map((option) => ({ value: option, label: option }));
  return (
    <Field data-invalid={error !== undefined}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Select items={items} value={value === "" ? null : value} onValueChange={onChange}>
        <SelectTrigger id={id} className="w-full" aria-invalid={error !== undefined}>
          <SelectValue placeholder="Choose" />
        </SelectTrigger>
        <SelectContent>
          {items.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <FieldError>{error}</FieldError>
    </Field>
  );
}

interface TextFieldProps {
  readonly id: string;
  readonly label: string;
  readonly value: string;
  readonly error: string | undefined;
  readonly description: string;
  readonly onChange: (value: string) => void;
}

function TextField({ id, label, value, error, description, onChange }: TextFieldProps) {
  return (
    <Field data-invalid={error !== undefined}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input
        id={id}
        value={value}
        autoComplete="off"
        autoCapitalize="none"
        spellCheck={false}
        aria-invalid={error !== undefined}
        onChange={(event) => onChange(event.target.value)}
      />
      <FieldDescription>{description}</FieldDescription>
      <FieldError>{error}</FieldError>
    </Field>
  );
}

interface EnablementFormProps {
  readonly agentName: string;
  readonly reload: () => void;
}

export function EnablementForm({ agentName, reload }: EnablementFormProps) {
  const form = useEnablementCreate(agentName, reload);
  const { draft, errors } = form;

  return (
    <form
      noValidate
      aria-label={`Enable ${agentName}`}
      onSubmit={(event) => {
        event.preventDefault();
        form.submit();
      }}
    >
      <FieldGroup className="md:grid md:grid-cols-2">
        {form.failure !== null && (
          <Alert variant="destructive" className="md:col-span-2">
            <AlertTitle>The agent was not enabled.</AlertTitle>
            <AlertDescription>{form.failure}</AlertDescription>
          </Alert>
        )}
        <TextField
          id="enablement-provider-name"
          label="Agent provider name"
          value={draft.name}
          error={errors["name"]}
          description="The default configuration selects this agent provider."
          onChange={form.setName}
        />
        <ChoiceField
          id="enablement-provider"
          label="Provider"
          value={draft.provider}
          options={AGENT_PROVIDER_KINDS}
          error={errors["provider"]}
          onChange={form.selectProvider}
        />
        <ChoiceField
          id="enablement-credential"
          label="Credential"
          value={draft.credential}
          options={form.credentialNames}
          error={errors["credential"]}
          onChange={form.selectCredential}
        />
        {form.credentialsError !== null && (
          <p className="text-sm text-destructive md:col-span-2">{form.credentialsError}</p>
        )}
        {form.credentialsMissing && (
          <p className="text-sm text-muted-foreground md:col-span-2">
            No credential of platform {draft.provider} exists.{" "}
            <Link to="/credentials/new" className="underline underline-offset-4">
              Add a credential
            </Link>{" "}
            first.
          </p>
        )}
        <TextField
          id="enablement-model"
          label="Model identifier"
          value={draft.modelIdentifier}
          error={errors["modelIdentifier"]}
          description="A model of the provider catalog or of the credential metadata."
          onChange={form.setModelIdentifier}
        />
        <ChoiceField
          id="enablement-effort"
          label="Reasoning effort"
          value={draft.reasoningEffort}
          options={REASONING_EFFORTS}
          error={errors["reasoningEffort"]}
          onChange={form.selectReasoningEffort}
        />
        <Button
          type="submit"
          disabled={form.submitting}
          className="md:col-span-2 md:justify-self-end"
        >
          Enable agent
        </Button>
      </FieldGroup>
    </form>
  );
}
