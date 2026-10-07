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
import type { CredentialPlatformEntry } from "@/api/types";
import { MetadataFields } from "./metadata-fields";
import { SecretFields } from "./secret-fields";
import type { CredentialRotateState } from "../use-credential-rotate";
import { WriteFailureAlert } from "./write-failure-alert";

interface RotateSheetProps {
  readonly name: string;
  readonly entry: CredentialPlatformEntry;
  readonly rotate: CredentialRotateState;
}

export function RotateSheet({ name, entry, rotate }: RotateSheetProps) {
  return (
    <Sheet open={rotate.open} onOpenChange={(open) => !open && rotate.close()}>
      <SheetContent className="data-[side=right]:w-full data-[side=right]:sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Rotate {name}</SheetTitle>
          <SheetDescription>
            The new secret becomes the next revision after revision {rotate.expectedRevision}. Older
            revisions stay live until no execution pins them.
          </SheetDescription>
        </SheetHeader>
        <form
          noValidate
          aria-label={`Rotate ${name}`}
          className="flex min-h-0 flex-1 flex-col"
          onSubmit={(event) => {
            event.preventDefault();
            rotate.submit();
          }}
        >
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4">
            {rotate.failure !== null && (
              <WriteFailureAlert
                title="The secret was not rotated."
                failure={rotate.failure}
                onReload={rotate.readLatest}
              />
            )}
            <FieldGroup>
              <SecretFields
                shape={entry.secret_shape}
                draft={rotate.secret}
                errors={rotate.errors}
                onEdit={rotate.setSecret}
              />
              <MetadataFields
                fields={entry.metadata_fields}
                draft={rotate.metadata}
                errors={rotate.errors}
                baseUrlDescription="A rotation can set another base URL. Leave it unchanged to keep it. The approved models stay."
                onEdit={rotate.setMetadata}
              />
            </FieldGroup>
          </div>
          <SheetFooter>
            <Button type="submit" disabled={rotate.submitting}>
              Rotate secret
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
