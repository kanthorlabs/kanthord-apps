import type { AgentSummary, WorkbenchSession } from "@/api/types";
import { ChoiceField } from "@/components/choice-field";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FieldDescription, FieldGroup } from "@/components/ui/field";
import { useNewSession } from "../use-new-session";
import { SessionConfigurationForm } from "./session-configuration-form";

interface NewSessionDialogProps {
  readonly agents: readonly AgentSummary[];
  readonly initialAgentName: string | null;
  readonly onClose: () => void;
  readonly onCreated: (session: WorkbenchSession) => void;
}

export function NewSessionDialog({
  agents,
  initialAgentName,
  onClose,
  onCreated,
}: NewSessionDialogProps) {
  const choice = useNewSession(agents, initialAgentName);

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>New Session</DialogTitle>
          <DialogDescription>
            Pick an agent. The session starts with the default configuration of that agent. Confirm
            it or change it.
          </DialogDescription>
        </DialogHeader>
        <FieldGroup className="md:grid md:grid-cols-2">
          <ChoiceField
            id="new-session-agent"
            label="Agent"
            value={choice.agentName ?? ""}
            options={choice.agentOptions}
            error={undefined}
            onChange={choice.selectAgent}
          />
          {choice.agentOptions.length === 0 && (
            <FieldDescription className="md:col-span-2">
              No agent is enabled. Enable an agent on the Agents page.
            </FieldDescription>
          )}
        </FieldGroup>
        {choice.agentName !== null && choice.enablement !== null ? (
          <SessionConfigurationForm
            key={choice.agentName}
            agentName={choice.agentName}
            enablement={choice.enablement}
            onClose={onClose}
            onCreated={onCreated}
          />
        ) : (
          <FieldGroup className="md:grid md:grid-cols-2">
            <FieldDescription className="md:col-span-2">
              Pick an agent to start a session.
            </FieldDescription>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end md:col-span-2 [&>button]:max-sm:w-full">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="button" disabled>
                Start Session
              </Button>
            </div>
          </FieldGroup>
        )}
      </DialogContent>
    </Dialog>
  );
}
