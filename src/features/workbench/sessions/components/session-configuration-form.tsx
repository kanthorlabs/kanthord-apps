import { Link } from "react-router-dom";

import type { AgentEnablement, WorkbenchConfiguration } from "@/api/types";
import { ConfigurationFields } from "@/components/configuration-fields";
import { RecordName } from "@/components/record-name";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FieldDescription, FieldGroup } from "@/components/ui/field";
import { agentPath, agentProviderCountText } from "@/lib/workbench-sessions";
import { useSessionStart } from "../use-session-start";

interface SessionConfigurationFormProps {
  readonly agentName: string;
  readonly enablement: AgentEnablement;
  readonly onClose: () => void;
  readonly onStart: (configuration: WorkbenchConfiguration) => void;
}

export function SessionConfigurationForm({
  agentName,
  enablement,
  onClose,
  onStart,
}: SessionConfigurationFormProps) {
  const form = useSessionStart(agentName, enablement, onStart);
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
        {form.switchFailure !== null && (
          <Alert variant="destructive" className="md:col-span-2">
            <AlertTitle>The agent provider was not switched.</AlertTitle>
            <AlertDescription>{form.switchFailure}</AlertDescription>
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
          The enablement of <RecordName>{agentName}</RecordName> names{" "}
          {agentProviderCountText(enablement.agent_providers.length)}.{" "}
          <Link to={agentPath(agentName)}>Add an agent provider on the agent page.</Link>
        </FieldDescription>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end md:col-span-2 [&>button]:max-sm:w-full">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">Start Session</Button>
        </div>
      </FieldGroup>
    </form>
  );
}
