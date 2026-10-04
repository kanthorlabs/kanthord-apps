import { Link } from "react-router-dom";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CREATABLE_PLATFORMS } from "@/lib/credential-draft";
import { CredentialField } from "../components/credential-field";
import { MetadataFields } from "../components/metadata-fields";
import { SecretFields } from "../components/secret-fields";
import { useCredentialForm } from "./use-credential-form";

const PLATFORM_ITEMS = CREATABLE_PLATFORMS.map((platform) => ({
  value: platform,
  label: platform,
}));

export function CredentialFormScreen() {
  const form = useCredentialForm();

  return (
    <Card className="w-full max-w-xl">
      <CardHeader>
        <h2 className="font-semibold leading-none">New credential</h2>
      </CardHeader>
      <CardContent>
        <form
          noValidate
          aria-label="New credential"
          onSubmit={(event) => {
            event.preventDefault();
            form.submit();
          }}
        >
          <FieldGroup>
            {form.submitError !== null && (
              <Alert variant="destructive">
                <AlertTitle>The credential was not created.</AlertTitle>
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
            <Field>
              <FieldLabel htmlFor="credential-platform">Platform</FieldLabel>
              <Select
                items={PLATFORM_ITEMS}
                value={form.platform}
                onValueChange={form.selectPlatform}
              >
                <SelectTrigger id="credential-platform" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PLATFORM_ITEMS.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldDescription>
                GitHub Copilot takes its credential through{" "}
                <Link to="/credentials/login">Sign in to GitHub Copilot</Link>.
              </FieldDescription>
            </Field>
            <SecretFields
              shape={form.shape}
              draft={form.secret}
              errors={form.errors}
              onEdit={form.setSecret}
            />
            <MetadataFields
              platform={form.platform}
              draft={form.metadata}
              errors={form.errors}
              baseUrlDescription="Fixed for the revision. Only a rotation sets another base URL. Add approved models after creation."
              onEdit={form.setMetadata}
            />
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                nativeButton={false}
                render={<Link to="/credentials" />}
                variant="outline"
                size="lg"
              >
                Cancel
              </Button>
              <Button type="submit" size="lg" disabled={form.submitting}>
                Create credential
              </Button>
            </div>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  );
}
