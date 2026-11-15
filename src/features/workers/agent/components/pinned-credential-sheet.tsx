import type { AgentEnablement } from "@/api/types";
import { SearchChoiceField } from "@/components/search-choice-field";
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
import { usePinnedCredentialEdit } from "../use-pinned-credential-edit";

interface PinnedCredentialFormProps {
  readonly agentName: string;
  readonly enablement: AgentEnablement;
  readonly pinnedModelIdentifier: string;
  readonly onSaved: () => void;
}

function PinnedCredentialForm({
  agentName,
  enablement,
  pinnedModelIdentifier,
  onSaved,
}: PinnedCredentialFormProps) {
  const edit = usePinnedCredentialEdit(agentName, enablement, pinnedModelIdentifier, onSaved);
  const credentialOf = (name: string) =>
    enablement.agent_providers.find((provider) => provider.name === name)?.credential ?? name;
  return (
    <form
      noValidate
      aria-label={`Change credential of ${agentName}`}
      className="flex min-h-0 flex-1 flex-col"
      onSubmit={(event) => {
        event.preventDefault();
        edit.submit();
      }}
    >
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4">
        {edit.failure !== null && (
          <Alert variant="destructive">
            <AlertTitle>The credential was not saved.</AlertTitle>
            <AlertDescription>{edit.failure}</AlertDescription>
          </Alert>
        )}
        <FieldGroup>
          <SearchChoiceField
            id="pinned-agent-provider"
            label="Agent Provider"
            value={edit.agentProvider}
            options={enablement.agent_providers.map((provider) => provider.name)}
            error={undefined}
            placeholder="Search agent providers"
            emptyText="No agent provider matches."
            labelOf={(name) => `${name} · ${credentialOf(name)}`}
            onChange={edit.selectAgentProvider}
          />
        </FieldGroup>
      </div>
      <SheetFooter>
        <Button type="submit" disabled={edit.submitting || edit.agentProvider === ""}>
          Save credential
        </Button>
      </SheetFooter>
    </form>
  );
}

interface PinnedCredentialSheetProps extends PinnedCredentialFormProps {
  readonly open: boolean;
  readonly onClose: () => void;
}

export function PinnedCredentialSheet({ open, onClose, ...form }: PinnedCredentialSheetProps) {
  return (
    <Sheet open={open} onOpenChange={(next) => !next && onClose()}>
      <SheetContent className="data-[side=right]:w-full data-[side=right]:sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Change credential of {form.agentName}</SheetTitle>
          <SheetDescription>
            The model is pinned to {form.pinnedModelIdentifier}. Only the agent provider, and so its
            credential, changes. A save writes the next revision after revision{" "}
            {form.enablement.revision}.
          </SheetDescription>
        </SheetHeader>
        {open && <PinnedCredentialForm key={form.enablement.revision} {...form} />}
      </SheetContent>
    </Sheet>
  );
}
