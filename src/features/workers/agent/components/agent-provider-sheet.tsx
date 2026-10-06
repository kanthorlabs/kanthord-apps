import { Link } from "react-router-dom";

import { ChoiceField } from "@/components/choice-field";
import { TextField } from "@/components/text-field";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { FieldDescription, FieldGroup } from "@/components/ui/field";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { AgentProviderAddState } from "../use-agent-provider-add";

interface AgentProviderSheetProps {
  readonly agentName: string;
  readonly revision: number;
  readonly add: AgentProviderAddState;
}

export function AgentProviderSheet({ agentName, revision, add }: AgentProviderSheetProps) {
  return (
    <Sheet open={add.open} onOpenChange={(open) => !open && add.close()}>
      <SheetContent className="data-[side=right]:w-full data-[side=right]:sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Add agent provider to {agentName}</SheetTitle>
          <SheetDescription>
            A save writes the next revision after revision {revision}. The provider is the platform
            of the credential.
          </SheetDescription>
        </SheetHeader>
        {add.credentialsExhausted ? (
          <Empty>
            <EmptyHeader>
              <EmptyTitle>No credential is left.</EmptyTitle>
            </EmptyHeader>
            <EmptyContent>
              <Button nativeButton={false} render={<Link to="/llm/new" />}>
                Add a credential
              </Button>
            </EmptyContent>
          </Empty>
        ) : (
          <form
            noValidate
            aria-label={`Add agent provider to ${agentName}`}
            className="flex min-h-0 flex-1 flex-col"
            onSubmit={(event) => {
              event.preventDefault();
              add.submit();
            }}
          >
            <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4">
              {add.failure !== null && (
                <Alert variant="destructive">
                  <AlertTitle>The agent provider was not added.</AlertTitle>
                  <AlertDescription>{add.failure}</AlertDescription>
                </Alert>
              )}
              <FieldGroup>
                <TextField
                  id="agent-provider-name"
                  label="Name"
                  value={add.draft.name}
                  error={add.errors.name}
                  description="A session configuration selects the agent provider by this name."
                  onChange={add.setName}
                />
                <ChoiceField
                  id="agent-provider-credential"
                  label="Credential"
                  value={add.draft.credential}
                  options={add.credentialNames}
                  error={add.errors.credential}
                  onChange={add.selectCredential}
                />
                {add.provider !== null && (
                  <FieldDescription>Provider: {add.provider}</FieldDescription>
                )}
                {add.credentialsError !== null && (
                  <FieldDescription>{add.credentialsError}</FieldDescription>
                )}
                <FieldDescription>
                  <Link to="/llm/new">Add a credential</Link> when the one that you need is absent.
                </FieldDescription>
              </FieldGroup>
            </div>
            <SheetFooter>
              {add.missing.length > 0 && (
                <FieldDescription>
                  Fill {add.missing.join(" and ")} to add the agent provider.
                </FieldDescription>
              )}
              <Button type="submit" disabled={add.submitting || add.missing.length > 0}>
                Add agent provider
              </Button>
            </SheetFooter>
          </form>
        )}
      </SheetContent>
    </Sheet>
  );
}
