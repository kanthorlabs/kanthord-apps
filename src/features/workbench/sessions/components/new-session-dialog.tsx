import type { AgentEnablement, WorkbenchSession } from "@/api/types";
import { ChoiceField } from "@/components/choice-field";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FieldGroup } from "@/components/ui/field";
import { useSessionCreate } from "../use-session-create";

interface NewSessionDialogProps {
  readonly agentName: string;
  readonly enablement: AgentEnablement;
  readonly onClose: () => void;
  readonly onCreated: (session: WorkbenchSession) => void;
}

export function NewSessionDialog({
  agentName,
  enablement,
  onClose,
  onCreated,
}: NewSessionDialogProps) {
  const form = useSessionCreate(agentName, enablement, onCreated);
  const { draft, errors } = form;

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>New Session</DialogTitle>
          <DialogDescription>
            The session starts with the default configuration of {agentName}. Confirm it or change
            it.
          </DialogDescription>
        </DialogHeader>
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
            <ChoiceField
              id="new-session-agent-provider"
              label="Agent Provider"
              value={draft.agentProvider}
              options={enablement.agentProviders.map((provider) => provider.name)}
              error={errors["agentProvider"]}
              onChange={form.selectAgentProvider}
            />
            <ChoiceField
              id="new-session-model"
              label="Model Identifier"
              value={draft.modelIdentifier}
              options={form.models}
              error={errors["modelIdentifier"]}
              onChange={form.selectModel}
            />
            <ChoiceField
              id="new-session-reasoning-effort"
              label="Reasoning Effort"
              value={draft.reasoningEffort}
              options={form.reasoningEfforts}
              error={errors["reasoningEffort"]}
              onChange={form.selectReasoningEffort}
            />
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
      </DialogContent>
    </Dialog>
  );
}
