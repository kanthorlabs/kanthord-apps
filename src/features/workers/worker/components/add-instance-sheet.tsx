import { RecordName } from "@/components/record-name";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
  FieldTitle,
} from "@/components/ui/field";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { TextField } from "@/components/text-field";
import { missingHint } from "@/lib/missing-fields";
import { HostFields } from "../../components/host-fields";
import { InstanceConfiguration } from "../../components/instance-configuration";
import type { InstanceCreateState } from "../use-instance-create";

function PlacementField({ create }: { create: InstanceCreateState }) {
  const error = create.errors["placement"];
  return (
    <FieldSet data-invalid={error !== undefined}>
      <FieldLegend id="instance-placement" variant="label">
        Placement
      </FieldLegend>
      <RadioGroup
        aria-labelledby="instance-placement"
        value={create.placement}
        onValueChange={create.selectPlacement}
      >
        {create.cards.map((card) => (
          <FieldLabel key={card.value} htmlFor={`instance-placement-${card.value}`}>
            <Field orientation="horizontal" data-disabled={card.disabled}>
              <FieldContent>
                <FieldTitle id={`instance-placement-${card.value}-title`}>{card.title}</FieldTitle>
                <FieldDescription id={`instance-placement-${card.value}-description`}>
                  {card.description}
                </FieldDescription>
              </FieldContent>
              <RadioGroupItem
                id={`instance-placement-${card.value}`}
                value={card.value}
                disabled={card.disabled}
                aria-labelledby={`instance-placement-${card.value}-title`}
                aria-describedby={`instance-placement-${card.value}-description`}
              />
            </Field>
          </FieldLabel>
        ))}
      </RadioGroup>
      <FieldDescription>
        The instance keeps this choice. Add another instance to change it.
      </FieldDescription>
      <FieldError>{error}</FieldError>
    </FieldSet>
  );
}

export function AddInstanceSheet({
  workerName,
  create,
}: {
  workerName: string;
  create: InstanceCreateState;
}) {
  const result = create.result;
  const hint = missingHint(create.missing, "create the instance");
  return (
    <Sheet open={create.open} onOpenChange={(open) => !open && create.dismiss()}>
      <SheetContent
        className="data-[side=right]:w-full data-[side=right]:sm:max-w-lg"
        showCloseButton={result === null && !create.submitting}
      >
        <SheetHeader>
          <SheetTitle>Add instance</SheetTitle>
          <SheetDescription>
            An instance of <RecordName>{workerName}</RecordName> gives the worker capacity to run
            nodes.
          </SheetDescription>
        </SheetHeader>
        {result === null ? (
          <form
            noValidate
            aria-label="Add instance"
            className="flex min-h-0 flex-1 flex-col"
            onSubmit={(event) => {
              event.preventDefault();
              create.submit();
            }}
          >
            <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4">
              {create.failure !== null && (
                <Alert variant="destructive">
                  <AlertTitle>The instance was not created.</AlertTitle>
                  <AlertDescription>{create.failure}</AlertDescription>
                </Alert>
              )}
              <FieldGroup>
                <TextField
                  id="instance-name"
                  label="Name"
                  value={create.name}
                  error={create.errors["name"]}
                  description="Lowercase letters, digits and hyphens, a letter first. The name never changes."
                  onChange={create.setName}
                />
                <PlacementField create={create} />
                {create.placement === "worker" && (
                  <HostFields host={create.host} errors={create.errors} />
                )}
              </FieldGroup>
            </div>
            <SheetFooter>
              {hint !== null && <p className="text-sm text-muted-foreground">{hint}</p>}
              <Button type="submit" disabled={create.submitting || create.missing.length > 0}>
                Create instance
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={create.submitting}
                onClick={create.close}
              >
                Cancel
              </Button>
            </SheetFooter>
          </form>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 overflow-y-auto px-4">
              <InstanceConfiguration
                name={result.record.name}
                kind={result.kind}
                runtime={result.runtime}
                version={create.host.version}
                versionError={create.host.versionError}
                configuration={result.configuration}
              />
            </div>
            <SheetFooter>
              <Button type="button" onClick={create.close}>
                Done
              </Button>
            </SheetFooter>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
