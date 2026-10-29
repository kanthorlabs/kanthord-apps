import { Link } from "react-router-dom";

import { ChoiceField } from "@/components/choice-field";
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
import { workerPagePath } from "@/lib/worker-paths";
import { ADD_PLACEMENTS, type AddPlacement, type InstanceAddState } from "../use-instance-add";

interface InstanceAddSheetProps {
  readonly projectId: string;
  readonly worker: string;
  readonly add: InstanceAddState;
}

function isAddPlacement(value: string | null): value is AddPlacement {
  return ADD_PLACEMENTS.some((placement) => placement === value);
}

export function InstanceAddSheet({ projectId, worker, add }: InstanceAddSheetProps) {
  return (
    <Sheet open={add.open} onOpenChange={(next) => !next && add.close()}>
      <SheetContent className="data-[side=right]:w-full data-[side=right]:sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Add instance</SheetTitle>
          <SheetDescription>
            The instance joins the selection of this binding. The binding keeps its draft.
          </SheetDescription>
        </SheetHeader>
        <form
          noValidate
          aria-label="Add instance"
          className="flex min-h-0 flex-1 flex-col"
          onSubmit={(event) => {
            event.preventDefault();
            add.submit();
          }}
        >
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4">
            {add.failure !== null && (
              <Alert variant="destructive">
                <AlertTitle>The instance was not added.</AlertTitle>
                <AlertDescription>{add.failure}</AlertDescription>
              </Alert>
            )}
            <FieldGroup>
              <TextField
                id="instance-add-name"
                label="Name"
                value={add.name}
                error={add.nameError}
                description="Lowercase letters, digits and hyphens."
                onChange={add.setName}
              />
              <ChoiceField
                id="instance-add-placement"
                label="Placement"
                value={add.placement}
                options={ADD_PLACEMENTS}
                error={undefined}
                description="Server runs on the server of kanthord. Container runs in a container that the server starts."
                onChange={(placement) => isAddPlacement(placement) && add.setPlacement(placement)}
              />
            </FieldGroup>
            {add.needsWorkerPage && (
              <p className="text-sm">
                <Link to={workerPagePath(worker, projectId)}>
                  Add a worker instance on the worker page
                </Link>
              </p>
            )}
          </div>
          <SheetFooter>
            {!add.needsWorkerPage && (
              <Button type="submit" disabled={add.submitting}>
                {add.submitting ? "Adding…" : "Add instance"}
              </Button>
            )}
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
