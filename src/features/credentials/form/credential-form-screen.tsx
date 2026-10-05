import { Link } from "react-router-dom";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import type { CredentialComponent, CredentialPlatformEntry } from "@/api/types";
import { credentialSectionPath } from "@/lib/credential-sections";
import { CredentialField } from "../components/credential-field";
import { MetadataFields } from "../components/metadata-fields";
import { PlatformCombobox } from "../components/platform-combobox";
import { SecretFields } from "../components/secret-fields";
import { LoginSession } from "./components/login-session";
import { SecretPrecheck } from "./components/secret-precheck";
import { useCredentialForm, type CredentialFormState } from "./use-credential-form";

const MODE_LABELS = {
  browser: "Browser",
  device: "Headless (device code)",
};

function platformLabel(platform: string): string {
  return platform;
}

function SignInFields({
  form,
  entry,
}: {
  form: CredentialFormState;
  entry: CredentialPlatformEntry;
}) {
  const modes = entry.loginModes;
  const items = modes.map((mode) => ({ value: mode, label: MODE_LABELS[mode] }));
  return (
    <Field className="md:col-span-2">
      {modes.length > 1 && (
        <>
          <FieldLabel htmlFor="credential-login-mode">Sign-in mode</FieldLabel>
          <Select items={items} value={form.login.mode} onValueChange={form.login.selectMode}>
            <SelectTrigger id="credential-login-mode" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {items.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </>
      )}
      <FieldDescription>
        This platform takes its credential through a sign-in. Custody stores the credential under
        the name when the sign-in completes.
      </FieldDescription>
    </Field>
  );
}

function CreateForm({
  component,
  form,
}: {
  component: CredentialComponent;
  form: CredentialFormState;
}) {
  return (
    <form
      noValidate
      aria-label="New credential"
      onSubmit={(event) => {
        event.preventDefault();
        form.submit();
      }}
    >
      <FieldGroup className="md:grid md:grid-cols-2">
        {form.submitError !== null && (
          <Alert variant="destructive" className="md:col-span-2">
            <AlertTitle>
              {form.oauth ? "The sign-in did not start." : "The credential was not created."}
            </AlertTitle>
            <AlertDescription>{form.submitError}</AlertDescription>
          </Alert>
        )}
        <CredentialField
          id="credential-name"
          label="Name"
          value={form.name}
          error={form.errors["name"]}
          description="Unique on the server. A lowercase letter, then lowercase letters, digits or hyphens. At most 63 characters."
          onChange={form.setName}
        />
        <Field data-invalid={form.errors["platform"] !== undefined}>
          <FieldLabel htmlFor="credential-platform">Platform</FieldLabel>
          <PlatformCombobox
            id="credential-platform"
            items={form.platformIds}
            value={form.platform}
            labelOf={platformLabel}
            onValueChange={form.selectPlatform}
          />
          <FieldError>{form.errors["platform"]}</FieldError>
        </Field>
        {form.entry === null ? null : form.oauth ? (
          <SignInFields form={form} entry={form.entry} />
        ) : (
          <>
            <FieldGroup className="md:col-span-2">
              <SecretFields
                shape={form.entry.secretShape}
                draft={form.secret}
                errors={form.errors}
                onEdit={form.setSecret}
              />
            </FieldGroup>
            {form.entry.metadataFields.length > 0 && (
              <FieldGroup className="md:col-span-2">
                <MetadataFields
                  fields={form.entry.metadataFields}
                  draft={form.metadata}
                  errors={form.errors}
                  baseUrlDescription="Fixed for the revision. Only a rotation sets another base URL. Add approved models after creation."
                  onEdit={form.setMetadata}
                />
              </FieldGroup>
            )}
          </>
        )}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between md:col-span-2">
          <div>
            {form.precheck.shown && (
              <SecretPrecheck platform={form.platform} precheck={form.precheck} />
            )}
          </div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <Button
              nativeButton={false}
              render={<Link to={credentialSectionPath(component)} />}
              variant="outline"
              size="lg"
            >
              Cancel
            </Button>
            <Button type="submit" size="lg" disabled={form.submitting}>
              {form.oauth ? "Start sign-in" : "Create credential"}
            </Button>
          </div>
        </div>
      </FieldGroup>
    </form>
  );
}

export function CredentialFormScreen({ component }: { component: CredentialComponent }) {
  const form = useCredentialForm(component);
  const session = form.login.session;

  return (
    <Card className="w-full">
      <CardHeader>
        <h2 className="font-semibold leading-none">
          {session === null ? "New credential" : `Sign in for ${form.name}`}
        </h2>
      </CardHeader>
      <CardContent>
        {form.platforms.loading ? (
          <Skeleton className="h-32 w-full" />
        ) : form.platforms.error !== null ? (
          <div className="flex flex-col items-start gap-2">
            <p className="text-sm text-destructive">{form.platforms.error.message}</p>
            <Button variant="outline" size="sm" onClick={form.platforms.reload}>
              Retry
            </Button>
          </div>
        ) : session === null ? (
          <CreateForm component={component} form={form} />
        ) : (
          <LoginSession login={form.login} session={session} />
        )}
      </CardContent>
    </Card>
  );
}
