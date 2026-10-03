import { Link, useParams } from "react-router-dom";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useProjectForm } from "./use-project-form";

export function ProjectFormScreen() {
  const { projectId } = useParams<{ projectId: string }>();
  const form = useProjectForm(projectId ?? null);
  const creating = form.mode === "create";

  if (form.loading) {
    return <Skeleton className="h-40 w-full max-w-xl" />;
  }

  if (form.loadError !== null) {
    return (
      <div className="flex flex-col items-start gap-2">
        <p className="text-sm text-destructive">{form.loadError.message}</p>
        <Button variant="outline" size="sm" onClick={form.reloadCurrent}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <Card className="w-full max-w-xl">
      <CardHeader>
        <h2 className="font-semibold leading-none">
          {creating ? "New project" : `Edit ${form.current?.name ?? ""}`}
        </h2>
      </CardHeader>
      <CardContent>
        <form
          noValidate
          aria-label={creating ? "New project" : "Edit project"}
          onSubmit={(event) => {
            event.preventDefault();
            form.submit();
          }}
        >
          <FieldGroup>
            {form.submitError !== null && (
              <Alert variant="destructive">
                <AlertTitle>
                  {creating ? "The project was not created." : "The project was not saved."}
                </AlertTitle>
                <AlertDescription>{form.submitError.message}</AlertDescription>
              </Alert>
            )}
            <Field data-invalid={form.nameError !== null}>
              <FieldLabel htmlFor="project-name">Name</FieldLabel>
              <Input
                id="project-name"
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                value={form.name}
                aria-invalid={form.nameError !== null}
                onChange={(event) => form.setName(event.target.value)}
              />
              <FieldDescription>
                Unique on the server. A lowercase letter, then lowercase letters, digits or hyphens.
                At most 63 characters.
              </FieldDescription>
              <FieldError>{form.nameError}</FieldError>
            </Field>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                nativeButton={false}
                render={<Link to={form.cancelPath} />}
                variant="outline"
                size="lg"
              >
                Cancel
              </Button>
              <Button type="submit" size="lg" disabled={form.submitting}>
                {creating ? "Create project" : "Save project"}
              </Button>
            </div>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  );
}
