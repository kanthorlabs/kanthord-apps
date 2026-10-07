import { Link } from "react-router-dom";

import type { AgentEnablement, WorkbenchSession } from "@/api/types";
import { ConfigurationFields } from "@/components/configuration-fields";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FieldDescription, FieldGroup } from "@/components/ui/field";
import { agentPath, agentProviderCountText } from "@/lib/workbench-sessions";
import { useSessionCreate } from "../use-session-create";

interface SessionConfigurationFormProps {
  readonly agentName: string;
  readonly enablement: AgentEnablement;
  readonly onClose: () => void;
  readonly onCreated: (session: WorkbenchSession) => void;
}

export function SessionConfigurationForm({
  agentName,
  enablement,
  onClose,
  onCreated,
}: SessionConfigurationFormProps) {
  const form = useSessionCreate(agentName, enablement, onCreated);
  const { errors } = form;

  return (
    <form
      noValidate
      aria-label={`New session with ${agentName}`}
      onSubmit={(event) => {
        event.preventDefault();
        form.submit();
      }}
    >
      <FieldGroup className="md:grid md:grid-cols-2">
        {form.failure !== null && (
          <Alert variant="destructive" className="md:col-span-2">
            <AlertTitle>The session was not created.</AlertTitle>
            <AlertDescription>{form.failure}</AlertDescription>
          </Alert>
        )}
        {form.modelsFailure !== null && (
          <Alert variant="destructive" className="md:col-span-2">
            <AlertTitle>The models were not loaded.</AlertTitle>
            <AlertDescription>{form.modelsFailure}</AlertDescription>
          </Alert>
        )}
        <ConfigurationFields
          idPrefix="new-session"
          agentProviderNames={enablement.agent_providers.map((provider) => provider.name)}
          configuration={form}
          errors={errors}
        />
        <FieldDescription className="md:col-span-2">
          {agentProviderCountText(agentName, enablement.agent_providers.length)}{" "}
          <Link to={agentPath(agentName)}>Add an agent provider on the agent page.</Link>
        </FieldDescription>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end md:col-span-2 [&>button]:max-sm:w-full">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={form.submitting}>
            Start Session
          </Button>
        </div>
      </FieldGroup>
    </form>
  );
}
