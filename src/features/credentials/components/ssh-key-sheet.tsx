import { InfoIcon } from "lucide-react";

import { TextField } from "@/components/text-field";
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
import { useSshKeyCreate } from "../use-ssh-key-create";
import { SshKeyFacts } from "./ssh-key-facts";

interface SshKeySheetProps {
  readonly onClose: () => void;
  readonly onDone: (name: string) => void;
}

function DeployKeyHint() {
  return (
    <Alert>
      <InfoIcon aria-hidden="true" />
      <AlertTitle>One deploy key per repository</AlertTitle>
      <AlertDescription>
        One deploy key serves one repository. Create one SSH key for each repository. An account SSH
        key serves every repository of the account and gives the server write access to all of them.
      </AlertDescription>
    </Alert>
  );
}

export function SshKeySheet({ onClose, onDone }: SshKeySheetProps) {
  const create = useSshKeyCreate();
  const created = create.created;
  const blank = create.name.trim().length === 0;

  return (
    <Sheet
      open
      onOpenChange={(next) => {
        if (next) return;
        if (created === null) onClose();
        else onDone(created.name);
      }}
    >
      <SheetContent className="data-[side=right]:w-full data-[side=right]:sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{created === null ? "Create SSH key" : `SSH key ${created.name}`}</SheetTitle>
          <SheetDescription>
            The server generates an ed25519 key and keeps the private key. Only the public key
            leaves the server.
          </SheetDescription>
        </SheetHeader>
        {created === null ? (
          <form
            noValidate
            aria-label="Create SSH key"
            className="flex min-h-0 flex-1 flex-col"
            onSubmit={(event) => {
              event.preventDefault();
              create.submit();
            }}
          >
            <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4">
              {create.failure !== null && (
                <Alert variant="destructive">
                  <AlertTitle>The SSH key was not created.</AlertTitle>
                  <AlertDescription>{create.failure}</AlertDescription>
                </Alert>
              )}
              <FieldGroup>
                <TextField
                  id="ssh-key-name"
                  label="Name"
                  value={create.name}
                  error={create.nameError}
                  description="Lowercase letters, digits and hyphens. The public key ends with kanthord-<name>."
                  onChange={create.setName}
                />
              </FieldGroup>
              <DeployKeyHint />
            </div>
            <SheetFooter>
              {blank && <p className="text-sm text-muted-foreground">Fill Name to create.</p>}
              <Button type="submit" disabled={blank || create.submitting}>
                Create SSH key
              </Button>
            </SheetFooter>
          </form>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4">
              {created.key === null ? (
                <p className="text-sm text-muted-foreground">
                  The answer holds no public key. Open the credential to read it.
                </p>
              ) : (
                <SshKeyFacts sshKey={created.key} />
              )}
              <section aria-labelledby="ssh-key-deploy" className="flex flex-col gap-2">
                <h3 id="ssh-key-deploy" className="text-sm font-medium">
                  Add the key as a deploy key
                </h3>
                <ol className="list-decimal space-y-1 pl-5 text-sm">
                  <li>In the repository, open Settings &gt; Deploy keys &gt; Add deploy key.</li>
                  <li>Paste the key.</li>
                  <li>Select Allow write access.</li>
                </ol>
              </section>
              <DeployKeyHint />
            </div>
            <SheetFooter>
              <Button onClick={() => onDone(created.name)}>Done</Button>
            </SheetFooter>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
