import { Link } from "react-router-dom";

import { ChoiceField } from "@/components/choice-field";
import { SearchChoiceField } from "@/components/search-choice-field";
import { TextField } from "@/components/text-field";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FieldGroup } from "@/components/ui/field";
import { UnhealthyCredentialDialog } from "@/components/unhealthy-credential-dialog";
import { CredentialCreateSheet } from "@/features/credentials/components/credential-create-sheet";
import { useEnablementCreate } from "../use-enablement-create";

interface EnablementFormProps {
  readonly agentName: string;
  readonly reload: () => void;
  readonly onEnabled?: () => void;
}

export function EnablementForm({ agentName, reload, onEnabled }: EnablementFormProps) {
  const form = useEnablementCreate(agentName, reload, onEnabled);
  const { draft, errors } = form;
  const nested = onEnabled !== undefined;

  return (
    <>
      <form
        noValidate
        aria-label={`Enable ${agentName}`}
        onSubmit={(event) => {
          event.preventDefault();
          form.submit();
        }}
      >
        <FieldGroup className="md:grid md:grid-cols-2">
          <p className="text-sm text-muted-foreground md:col-span-2">
            An agent provider joins an LLM credential and a model to an agent.
          </p>
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
            description="A name that you choose for this agent provider. The default configuration selects it by this name. Reuse the name of an agent provider that has the same LLM credential."
            inputRef={form.nameInput}
            onChange={form.setName}
          />
          <SearchChoiceField
            id="enablement-credential"
            label="LLM credential"
            value={draft.credential}
            options={form.credentialNames}
            error={errors["credential"] ?? form.credentialsError ?? undefined}
            placeholder="Search LLM credentials"
            emptyText="No LLM credential matches."
            labelOf={form.credentialLabelOf}
            onChange={form.selectCredential}
          />
          {form.credentialsMissing && (
            <p className="text-sm text-muted-foreground md:col-span-2">
              No LLM credential of an agent provider platform exists.{" "}
              {nested ? (
                "Add an LLM credential first."
              ) : (
                <>
                  <Link to="/llm/new" className="underline underline-offset-4">
                    Add an LLM credential
                  </Link>{" "}
                  first.
                </>
              )}
            </p>
          )}
          {form.credentialsMissing && nested && (
            <Button
              type="button"
              variant="outline"
              className="md:col-span-2 md:justify-self-start"
              onClick={form.openCredentialCreate}
            >
              New LLM credential
            </Button>
          )}
          <SearchChoiceField
            id="enablement-model"
            label="Model identifier"
            value={draft.modelIdentifier}
            options={form.models}
            error={errors["modelIdentifier"] ?? form.modelsFailure ?? undefined}
            placeholder="Search models"
            emptyText="No model matches."
            onChange={form.selectModel}
          />
          <ChoiceField
            id="enablement-effort"
            label="Reasoning effort"
            value={draft.reasoningEffort}
            options={form.reasoningEfforts}
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
        <UnhealthyCredentialDialog
          agentNames={[agentName]}
          credential={form.unhealthyCredential}
          saferPath={
            <>
              Rotate the secret on the{" "}
              <Link
                to={`/llm/${encodeURIComponent(form.unhealthyCredential ?? "")}`}
                className="underline underline-offset-4"
              >
                page of {form.unhealthyCredential}
              </Link>{" "}
              first, then enable the agent.
            </>
          }
          onConfirm={form.confirmUnhealthy}
          onCancel={form.cancelUnhealthy}
        />
      </form>
      {form.credentialCreateOpen && (
        <CredentialCreateSheet
          component="llm"
          open
          onClose={form.closeCredentialCreate}
          onCreated={form.credentialCreated}
        />
      )}
    </>
  );
}
