import { Link } from "react-router-dom";

import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { RecordName } from "@/components/record-name";
import { TouchTarget } from "@/components/touch-target";
import { SecretFields } from "@/features/credentials/components/secret-fields";
import { HolderToggle } from "@/features/workers/instance/components/holder-toggle";

import type { BoardRotate } from "../use-board-rotate";

export function BoardRotateSheet({ rotate }: { readonly rotate: BoardRotate }) {
  const alsoRotate = rotate.shape !== "oauth";
  return (
    <Sheet open={rotate.open} onOpenChange={(open) => !open && rotate.close()}>
      <SheetContent
        side="right"
        showCloseButton={false}
        className="data-[side=right]:w-full data-[side=right]:sm:max-w-lg"
      >
        <SheetHeader>
          <SheetTitle>Rotate {rotate.name}</SheetTitle>
          <SheetDescription>
            The new secret becomes the next revision of the server copy.
            {alsoRotate && " The server seals it to the current key of each holder."}
          </SheetDescription>
        </SheetHeader>
        <form
          noValidate
          aria-label={`Rotate ${rotate.name}`}
          className="flex min-h-0 flex-1 flex-col"
          onSubmit={(event) => {
            event.preventDefault();
            rotate.submit();
          }}
        >
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4">
            {rotate.failure !== null && (
              <Alert variant="destructive">
                <AlertTitle>The secret was not rotated.</AlertTitle>
                <AlertDescription>{rotate.failure.message}</AlertDescription>
                {rotate.failure.conflict && (
                  <AlertAction>
                    <TouchTarget>
                      <Button type="button" variant="outline" size="sm" onClick={rotate.readLatest}>
                        Read the latest
                      </Button>
                    </TouchTarget>
                  </AlertAction>
                )}
              </Alert>
            )}
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
              {rotate.shape !== null && (
                <SecretFields
                  shape={rotate.shape}
                  draft={rotate.secret}
                  errors={rotate.errors}
                  onEdit={rotate.setSecret}
                />
              )}
              {alsoRotate && (
                <HolderToggle
                  id="board-rotate-also-rotate-on"
                  label="Also rotate on"
                  description="Each selected holder gets the same new secret in its own rotation."
                  groups={
                    rotate.choices.length === 0
                      ? []
                      : [{ label: "Other holders", names: rotate.choices }]
                  }
                  value={rotate.chosen}
                  onChange={rotate.choose}
                />
              )}
            </FieldGroup>
            {rotate.keptHolders.length > 0 && (
              <div className="flex flex-col items-start gap-2">
                {rotate.keptHolders.map((holder) => (
                  <p key={holder} className="text-sm">
                    <RecordName>{holder}</RecordName> keeps its own secret. Sign in again on its
                    machine page or its worker instance page.
                  </p>
                ))}
                <div className="flex flex-wrap gap-2">
                  <TouchTarget>
                    <Button
                      nativeButton={false}
                      variant="outline"
                      size="sm"
                      render={<Link to="/machines" />}
                    >
                      Open machines
                    </Button>
                  </TouchTarget>
                  <TouchTarget>
                    <Button
                      nativeButton={false}
                      variant="outline"
                      size="sm"
                      render={<Link to="/workers" />}
                    >
                      Open workers
                    </Button>
                  </TouchTarget>
                </div>
              </div>
            )}
          </div>
          <SheetFooter>
            <TouchTarget>
              <Button type="submit" disabled={rotate.submitting}>
                Rotate secret
              </Button>
            </TouchTarget>
            <TouchTarget>
              <Button
                type="button"
                variant="outline"
                disabled={rotate.submitting}
                onClick={rotate.close}
              >
                Cancel
              </Button>
            </TouchTarget>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
