import { ChoiceField } from "@/components/choice-field";
import { RecordName } from "@/components/record-name";
import { SearchChoiceField } from "@/components/search-choice-field";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { UnhealthyCredentialDialog } from "@/components/unhealthy-credential-dialog";
import type { AgentEnableOutcome, AgentEnableState } from "../use-agent-enable";

function OutcomeLine({ outcome }: { outcome: AgentEnableOutcome }) {
  const name = <RecordName>{outcome.agentName}</RecordName>;
  if (outcome.result === "enabled") {
    return (
      <p>
        Enabled: {name} at revision {outcome.revision}.
      </p>
    );
  }
  if (outcome.result === "saved") {
    return (
      <p>
        Not enabled: {name}. The configuration is saved at revision {outcome.revision}, but the
        agent stays disabled. {outcome.reason}
      </p>
    );
  }
  return (
    <p>
      Not enabled: {name}. {outcome.reason}
    </p>
  );
}

interface AgentEnableSheetProps {
  readonly name: string;
  readonly enable: AgentEnableState;
}

export function AgentEnableSheet({ name, enable }: AgentEnableSheetProps) {
  return (
    <Sheet open={enable.open} onOpenChange={(open) => !open && enable.close()}>
      <SheetContent className="data-[side=right]:w-full data-[side=right]:sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Enable agents with {name}</SheetTitle>
          <SheetDescription>
            Each agent that you switch on gets the agent provider{" "}
            <RecordName>{enable.providerName}</RecordName> for this credential and a default
            configuration with the model and the effort below. A task needs every agent of its
            worker bindings.
          </SheetDescription>
        </SheetHeader>
        <form
          noValidate
          aria-label={`Enable agents with ${name}`}
          className="flex min-h-0 flex-1 flex-col"
          onSubmit={(event) => {
            event.preventDefault();
            enable.submit();
          }}
        >
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4">
            {enable.outcomes.length > 0 && (
              <Alert>
                <AlertTitle>Some agents were not enabled.</AlertTitle>
                <AlertDescription>
                  {enable.outcomes.map((outcome) => (
                    <OutcomeLine key={outcome.agentName} outcome={outcome} />
                  ))}
                </AlertDescription>
              </Alert>
            )}
            <FieldGroup>
              <FieldSet>
                <FieldLegend variant="label">Agents</FieldLegend>
                {enable.rows.map((row) => (
                  <Field key={row.agentName} orientation="horizontal">
                    <Switch
                      id={`agent-enable-${row.agentName}`}
                      checked={row.on}
                      onCheckedChange={(on) => enable.toggleAgent(row.agentName, on)}
                    />
                    <FieldContent>
                      <FieldLabel htmlFor={`agent-enable-${row.agentName}`}>
                        {row.agentName}
                      </FieldLabel>
                      {row.replaces !== null && (
                        <FieldDescription>
                          Switch it on to replace the disabled enablement at revision {row.replaces}
                          . Its agent providers and fallback configurations are replaced by this
                          configuration, and then the agent is enabled.
                        </FieldDescription>
                      )}
                    </FieldContent>
                  </Field>
                ))}
              </FieldSet>
              <SearchChoiceField
                id="agent-enable-model"
                label="Model identifier"
                value={enable.modelIdentifier}
                options={enable.models}
                error={enable.modelsFailure ?? undefined}
                placeholder="Search models"
                emptyText="No model matches."
                onChange={enable.selectModel}
              />
              <ChoiceField
                id="agent-enable-effort"
                label="Reasoning effort"
                value={enable.reasoningEffort}
                options={enable.reasoningEfforts}
                error={undefined}
                onChange={enable.selectReasoningEffort}
              />
            </FieldGroup>
          </div>
          <UnhealthyCredentialDialog
            action={{ kind: "enable", agentNames: enable.chosenNames }}
            credential={enable.unhealthyCredential}
            hint={enable.unhealthyHint}
            saferPath="Close this sheet, rotate the secret with Rotate secret, then enable the agents."
            onConfirm={enable.confirmUnhealthy}
            onCancel={enable.cancelUnhealthy}
          />
          <SheetFooter>
            {enable.chosenNames.length === 0 && (
              <FieldDescription>Switch on at least one agent.</FieldDescription>
            )}
            {enable.missing.length > 0 && (
              <FieldDescription>
                Fill {enable.missing.join(" and ")} to enable the agents.
              </FieldDescription>
            )}
            <Button
              type="submit"
              disabled={
                enable.submitting || enable.missing.length > 0 || enable.chosenNames.length === 0
              }
            >
              Enable agents
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
