import { PlusIcon } from "lucide-react";

import type { CredentialPlatformEntry } from "@/api/types";
import { Button } from "@/components/ui/button";
import { FieldGroup } from "@/components/ui/field";
import { ItemGroup } from "@/components/ui/item";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { OPENAI_COMPATIBLE } from "@/lib/credential-draft";
import { CredentialField } from "./credential-field";
import { MetadataFields } from "./metadata-fields";
import type { MetadataEditState } from "../use-metadata-edit";
import { ModelFields } from "./model-fields";
import { WriteFailureAlert } from "./write-failure-alert";

interface MetadataSheetProps {
  readonly name: string;
  readonly entry: CredentialPlatformEntry;
  readonly edit: MetadataEditState;
}

function ModelsEditor({ edit }: { edit: MetadataEditState }) {
  return (
    <>
      <CredentialField
        id="credential-base-url"
        label="Base URL"
        value={edit.draft.fields["baseUrl"] ?? ""}
        error={undefined}
        readOnly
        description="A metadata edit keeps the base URL. Rotate the secret to set another one."
        onChange={() => undefined}
      />
      <section aria-label="Approved models" className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-medium">Approved models</h3>
          <Button variant="outline" size="sm" onClick={edit.addModel}>
            <PlusIcon aria-hidden="true" data-icon="inline-start" />
            Add model
          </Button>
        </div>
        {edit.draft.models.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No approved model. An agent cannot select a model of this credential.
          </p>
        ) : (
          <ItemGroup aria-label="Approved models" className="gap-2">
            {edit.draft.models.map((model, index) => (
              <ModelFields
                key={index}
                index={index}
                model={model}
                errors={edit.errors}
                onEdit={(next) => edit.editModel(index, next)}
                onRemove={() => edit.removeModel(index)}
              />
            ))}
          </ItemGroup>
        )}
      </section>
    </>
  );
}

export function MetadataSheet({ name, entry, edit }: MetadataSheetProps) {
  return (
    <Sheet open={edit.open} onOpenChange={(open) => !open && edit.close()}>
      <SheetContent className="data-[side=right]:w-full data-[side=right]:sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Edit metadata of {name}</SheetTitle>
          <SheetDescription>
            A save writes the next revision after revision {edit.expectedRevision} with the same
            secret.
          </SheetDescription>
        </SheetHeader>
        <form
          noValidate
          aria-label={`Edit metadata of ${name}`}
          className="flex min-h-0 flex-1 flex-col"
          onSubmit={(event) => {
            event.preventDefault();
            edit.submit();
          }}
        >
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4">
            {edit.failure !== null && (
              <WriteFailureAlert
                title="The metadata was not saved."
                failure={edit.failure}
                onReload={edit.readLatest}
              />
            )}
            <FieldGroup>
              {entry.platform === OPENAI_COMPATIBLE ? (
                <ModelsEditor edit={edit} />
              ) : (
                <MetadataFields
                  fields={entry.metadataFields}
                  draft={edit.draft}
                  errors={edit.errors}
                  baseUrlDescription=""
                  onEdit={edit.setDraft}
                />
              )}
            </FieldGroup>
          </div>
          <SheetFooter>
            <Button type="submit" disabled={edit.submitting}>
              Save metadata
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
