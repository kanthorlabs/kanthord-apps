import type { AgentEnablement } from "@/api/types";
import { ConfigurationFields } from "@/components/configuration-fields";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FieldGroup } from "@/components/ui/field";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useDefaultEdit } from "../use-default-edit";

interface DefaultConfigurationFormProps {
  readonly agentName: string;
  readonly enablement: AgentEnablement;
  readonly onSaved: () => void;
}

function DefaultConfigurationForm({
  agentName,
  enablement,
  onSaved,
}: DefaultConfigurationFormProps) {
  const edit = useDefaultEdit(agentName, enablement, onSaved);
  return (
    <form
      noValidate
      aria-label={`Edit default of ${agentName}`}
      className="flex min-h-0 flex-1 flex-col"
      onSubmit={(event) => {
        event.preventDefault();
        edit.submit();
      }}
    >
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4">
        {edit.failure !== null && (
          <Alert variant="destructive">
            <AlertTitle>The default was not saved.</AlertTitle>
            <AlertDescription>{edit.failure}</AlertDescription>
          </Alert>
        )}
        {edit.modelsFailure !== null && (
          <Alert variant="destructive">
            <AlertTitle>The models were not loaded.</AlertTitle>
            <AlertDescription>{edit.modelsFailure}</AlertDescription>
          </Alert>
        )}
        <FieldGroup>
          <ConfigurationFields
            idPrefix="default"
            agentProviderNames={enablement.agent_providers.map((provider) => provider.name)}
            configuration={edit}
            errors={edit.errors}
          />
        </FieldGroup>
      </div>
      <SheetFooter>
        <Button type="submit" disabled={edit.submitting || edit.switching}>
          Save default
        </Button>
      </SheetFooter>
    </form>
  );
}

interface DefaultConfigurationSheetProps {
  readonly agentName: string;
  readonly enablement: AgentEnablement;
  readonly open: boolean;
  readonly onClose: () => void;
  readonly onSaved: () => void;
}

export function DefaultConfigurationSheet({
  agentName,
  enablement,
  open,
  onClose,
  onSaved,
}: DefaultConfigurationSheetProps) {
  return (
    <Sheet open={open} onOpenChange={(next) => !next && onClose()}>
      <SheetContent className="data-[side=right]:w-full data-[side=right]:sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Edit default of {agentName}</SheetTitle>
          <SheetDescription>
            A save writes the next revision after revision {enablement.revision}. The agent
            providers stay unchanged.
          </SheetDescription>
        </SheetHeader>
        {open && (
          <DefaultConfigurationForm
            key={enablement.revision}
            agentName={agentName}
            enablement={enablement}
            onSaved={onSaved}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}
