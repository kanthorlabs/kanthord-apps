import { RecordName } from "@/components/record-name";
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
import { SecretFields } from "@/features/credentials/components/secret-fields";
import type { InstanceCredentialRotateState } from "../use-instance-credential-rotate";
import { HolderToggle } from "./holder-toggle";

export function CredentialRotateSheet({
  instanceName,
  rotate,
}: {
  instanceName: string;
  rotate: InstanceCredentialRotateState;
}) {
  const copy = rotate.copy;
  return (
    <Sheet open={copy !== null} onOpenChange={(open) => !open && rotate.close()}>
      <SheetContent className="data-[side=right]:w-full data-[side=right]:sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Rotate {copy?.name}</SheetTitle>
          <SheetDescription>
            The new secret becomes the next revision of the copy held by{" "}
            <RecordName>{instanceName}</RecordName>. The server seals it to the current key of each
            holder.
          </SheetDescription>
        </SheetHeader>
        <form
          noValidate
          aria-label={`Rotate ${copy?.name ?? ""}`}
          className="flex min-h-0 flex-1 flex-col"
          onSubmit={(event) => {
            event.preventDefault();
            rotate.submit();
          }}
        >
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4">
            {rotate.outcome.length > 0 && (
              <Alert variant="destructive">
                <AlertTitle>Not every copy was rotated.</AlertTitle>
                <AlertDescription>
                  {rotate.outcome.map((line) => (
                    <p key={line} className="break-words">
                      {line}
                    </p>
                  ))}
                </AlertDescription>
              </Alert>
            )}
            <FieldGroup>
              <SecretFields
                shape="api_key"
                draft={rotate.secret}
                errors={rotate.errors}
                onEdit={rotate.setSecret}
              />
              <HolderToggle
                id="credential-also-rotate-on"
                label="Also rotate on"
                description="Each selected holder gets the same new secret in its own rotation."
                groups={
                  (rotate.others.data ?? []).length === 0
                    ? []
                    : [
                        {
                          label: "Other holders",
                          names: (rotate.others.data ?? []).map((target) => target.holder),
                        },
                      ]
                }
                value={rotate.alsoRotateOn}
                onChange={rotate.setAlsoRotateOn}
              />
            </FieldGroup>
          </div>
          <SheetFooter>
            <Button type="submit" disabled={rotate.submitting || rotate.secret.key.length === 0}>
              Rotate secret
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={rotate.submitting}
              onClick={rotate.close}
            >
              Cancel
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
