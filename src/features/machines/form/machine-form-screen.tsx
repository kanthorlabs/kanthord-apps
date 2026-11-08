import { Link } from "react-router-dom";

import { TextField } from "@/components/text-field";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { FieldGroup } from "@/components/ui/field";
import { missingHint } from "@/lib/missing-fields";
import { InstanceConfiguration } from "@/features/workers/components/instance-configuration";
import { MachineHostFields } from "../components/machine-host-fields";
import { type MachineFormState, useMachineForm } from "./use-machine-form";

function CreateForm({ form }: { form: MachineFormState }) {
  const hint = missingHint(form.missing, "create the machine");
  return (
    <form
      noValidate
      aria-label="Add machine"
      onSubmit={(event) => {
        event.preventDefault();
        form.submit();
      }}
    >
      <FieldGroup>
        {form.failure !== null && (
          <Alert variant="destructive">
            <AlertTitle>The machine was not created.</AlertTitle>
            <AlertDescription>{form.failure}</AlertDescription>
          </Alert>
        )}
        <TextField
          id="machine-name"
          label="Name"
          value={form.name}
          error={form.errors["name"]}
          description="Lowercase letters, digits and hyphens, a letter first. The name never changes. A machine and an instance never share a name."
          onChange={form.setName}
        />
        <MachineHostFields host={form.host} error={form.errors["kind"]} />
        <div className="flex flex-col gap-3">
          {hint !== null && <p className="text-sm text-muted-foreground">{hint}</p>}
          <div className="flex flex-col-reverse gap-2 sm:ml-auto sm:flex-row">
            <Button
              nativeButton={false}
              render={<Link to="/machines" />}
              variant="outline"
              size="lg"
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="lg"
              className="w-full sm:w-auto"
              disabled={form.submitting || form.missing.length > 0}
            >
              Create machine
            </Button>
          </div>
        </div>
      </FieldGroup>
    </form>
  );
}

export function MachineFormScreen() {
  const form = useMachineForm();
  const result = form.result;
  return (
    <Card className="w-full">
      <CardHeader>
        <h2 className="font-semibold leading-none">
          {result === null ? "Add machine" : `Machine ${result.name}`}
        </h2>
      </CardHeader>
      <CardContent className="flex min-w-0 flex-col gap-4">
        {result === null ? (
          <CreateForm form={form} />
        ) : (
          <>
            <InstanceConfiguration
              target={{ subject: "machine", name: result.name, stage: "create" }}
              kind={result.kind}
              runtime={result.runtime}
              version={form.host.version}
              versionError={form.host.versionError}
              configuration={result.configuration}
            />
            <Button size="lg" className="w-full sm:ml-auto sm:w-auto" onClick={form.done}>
              Done
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
