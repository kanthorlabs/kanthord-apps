import { RecordName } from "@/components/record-name";
import { PlusIcon } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { ItemGroup } from "@/components/ui/item";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { CredentialField } from "@/features/credentials/components/credential-field";
import { MetadataFields } from "@/features/credentials/components/metadata-fields";
import { ModelFields } from "@/features/credentials/components/model-fields";
import { PlatformCombobox } from "@/features/credentials/components/platform-combobox";
import { SecretFields } from "@/features/credentials/components/secret-fields";
import { LoginSession } from "@/features/credentials/form/components/login-session";
import { missingHint } from "@/lib/missing-fields";
import { OPENAI_COMPATIBLE } from "@/lib/credential-draft";
import type { InstanceCredentialAddState } from "../use-instance-credential-add";
import { HolderToggle } from "./holder-toggle";

function CopyFields({ add }: { add: InstanceCredentialAddState }) {
  const entry = add.entry;
  if (entry === null) return null;
  if (add.signIn) {
    return (
      <FieldDescription className="md:col-span-2">
        The instance runs this sign-in in{" "}
        {entry.login_modes.includes("copy_code") ? "copy-code" : "device-code"} mode and seals the
        result to its own key. The instance must be connected.
      </FieldDescription>
    );
  }
  return (
    <>
      <SecretFields
        shape={entry.secret_shape}
        draft={add.secret}
        errors={add.errors}
        onEdit={add.setSecret}
      />
      <MetadataFields
        fields={entry.metadata_fields}
        draft={add.metadata}
        errors={add.errors}
        baseUrlDescription="The address of the OpenAI-compatible API."
        onEdit={add.setMetadata}
      />
      {entry.platform === OPENAI_COMPATIBLE && (
        <Field className="md:col-span-2" data-invalid={add.errors["models"] !== undefined}>
          <FieldLabel>Models</FieldLabel>
          <FieldDescription>
            Type the model ids. A copy of a worker instance gets no model list from the provider.
          </FieldDescription>
          <ItemGroup aria-label="Models" className="gap-2">
            {add.metadata.models.map((model, index) => (
              <ModelFields
                key={index}
                index={index}
                model={model}
                errors={add.errors}
                onEdit={(next) => add.editModel(index, next)}
                onRemove={() => add.removeModel(index)}
              />
            ))}
          </ItemGroup>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="self-start"
            onClick={add.addModel}
          >
            <PlusIcon aria-hidden="true" data-icon="inline-start" />
            Add model
          </Button>
          <FieldError>{add.errors["models"]}</FieldError>
        </Field>
      )}
      <HolderToggle
        id="credential-also-seal-to"
        label="Also seal to"
        description="The server seals one copy for each selected instance and keeps no plaintext."
        groups={(add.groups.data ?? []).map((group) => ({
          label: group.worker,
          names: group.names,
        }))}
        value={add.alsoSealTo}
        onChange={add.setAlsoSealTo}
      />
    </>
  );
}

export function CredentialAddSheet({
  instanceName,
  add,
}: {
  instanceName: string;
  add: InstanceCredentialAddState;
}) {
  const session = add.login.session;
  const hint = missingHint(add.missing, add.signIn ? "start the sign-in" : "create the credential");
  return (
    <Sheet open={add.open} onOpenChange={(open) => !open && add.close()}>
      <SheetContent
        className="data-[side=right]:w-full data-[side=right]:sm:max-w-lg"
        showCloseButton={!add.login.inProgress}
      >
        <SheetHeader>
          <SheetTitle>Add credential</SheetTitle>
          <SheetDescription>
            An LLM credential copy held by <RecordName>{instanceName}</RecordName>. The server
            stores only the copy sealed to the key of the instance.
          </SheetDescription>
        </SheetHeader>
        {session !== null ? (
          <div className="min-h-0 flex-1 overflow-y-auto px-4">
            <LoginSession login={add.login} session={session} />
          </div>
        ) : (
          <form
            noValidate
            aria-label="Add credential"
            className="flex min-h-0 flex-1 flex-col"
            onSubmit={(event) => {
              event.preventDefault();
              add.submit();
            }}
          >
            <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4">
              {(add.failure ?? add.login.startError) !== null && (
                <Alert variant="destructive">
                  <AlertTitle>
                    {add.signIn ? "The sign-in did not start." : "The credential was not created."}
                  </AlertTitle>
                  <AlertDescription>{add.failure ?? add.login.startError}</AlertDescription>
                </Alert>
              )}
              <FieldGroup>
                <CredentialField
                  id="instance-credential-name"
                  label="Name"
                  value={add.name}
                  error={add.errors["name"]}
                  description="The name that the agent providers use. A name holds one platform over every holder."
                  onChange={add.setName}
                />
                <Field>
                  <FieldLabel htmlFor="instance-credential-platform">Platform</FieldLabel>
                  <PlatformCombobox
                    id="instance-credential-platform"
                    items={add.platforms}
                    value={add.entry?.platform ?? ""}
                    onValueChange={add.selectPlatform}
                  />
                </Field>
                <CopyFields add={add} />
              </FieldGroup>
            </div>
            <SheetFooter>
              {hint !== null && <p className="text-sm text-muted-foreground">{hint}</p>}
              <Button
                type="submit"
                disabled={add.submitting || add.login.starting || add.missing.length > 0}
              >
                {add.signIn ? "Start sign-in" : "Create credential"}
              </Button>
              <Button type="button" variant="outline" disabled={add.submitting} onClick={add.close}>
                Cancel
              </Button>
            </SheetFooter>
          </form>
        )}
      </SheetContent>
    </Sheet>
  );
}
