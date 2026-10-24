import { useEffect, useRef, useState } from "react";

import type { EnvironmentSource, EnvironmentState, RepositoryBindingConfig } from "@/api/types";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/reveal";
import {
  environmentSourceText,
  environmentStatusLabel,
  environmentStatusVariant,
  storableSource,
} from "@/lib/environment-bar";
import { useBindingEnvironment } from "../use-binding-environment";
import { useEnvironmentSecret } from "../use-environment-secret";
import { EnvironmentEditSheet } from "./environment-edit-sheet";
import { EnvironmentSecretSheet } from "./environment-secret-sheet";
import { FactList, type Fact } from "./fact-list";

const DIGEST_LENGTH = 12;

interface EnvironmentSectionProps {
  readonly projectId: string;
  readonly bindingId: string;
  readonly bindingName: string;
  readonly state: EnvironmentState | null;
  readonly secrets: Readonly<Record<string, string>>;
  readonly focused: boolean;
  readonly onChanged: () => void;
  readonly onWritten: (
    patch: Pick<RepositoryBindingConfig, "environment" | "environment_secrets">,
  ) => void;
}

function factsOf(
  state: EnvironmentState,
  source: EnvironmentSource,
  commit: string | null,
): readonly Fact[] {
  return [
    {
      label: "Source",
      value: (
        <>
          {environmentSourceText(source)}
          {commit !== null && (
            <span className="font-mono"> at {commit.slice(0, DIGEST_LENGTH)}</span>
          )}
        </>
      ),
    },
    { label: "Target", value: state.target },
    {
      label: "Status",
      value: (
        <Badge variant={environmentStatusVariant(state.status)}>
          {environmentStatusLabel(state.status)}
        </Badge>
      ),
    },
    ...(state.digest === null
      ? []
      : [
          {
            label: "Digest",
            value: <span className="font-mono">{state.digest.slice(0, DIGEST_LENGTH)}</span>,
          },
        ]),
    ...(state.reason === null ? [] : [{ label: "Reason", value: state.reason }]),
  ];
}

export function EnvironmentSection({
  projectId,
  bindingId,
  bindingName,
  state,
  secrets,
  focused,
  onChanged,
  onWritten,
}: EnvironmentSectionProps) {
  const { environment, rebuilding, rebuild, copy, copyText, ...edit } = useBindingEnvironment(
    projectId,
    bindingId,
    bindingName,
    onChanged,
    (environment) => onWritten({ environment }),
  );
  const secret = useEnvironmentSecret(projectId, bindingName, secrets, (environment_secrets) =>
    onWritten({ environment_secrets }),
  );
  const secretEntries = Object.entries(secrets).sort(([left], [right]) => (left < right ? -1 : 1));
  const [documentOpen, setDocumentOpen] = useState(false);
  const read = environment.loading ? null : environment.data;
  const sectionRef = useRef<HTMLElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const failure = state?.failure ?? null;

  useEffect(() => {
    if (!focused) return;
    sectionRef.current?.scrollIntoView({ block: "start" });
    headingRef.current?.focus();
  }, [focused]);

  return (
    <section ref={sectionRef} aria-label="Environment" className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <h4 ref={headingRef} tabIndex={-1} className="font-semibold">
          Environment
        </h4>
        {state !== null && (
          <Badge variant={environmentStatusVariant(state.status)}>
            {environmentStatusLabel(state.status)}
          </Badge>
        )}
      </div>
      {state === null ? (
        <p className="text-sm text-muted-foreground">The environment state is not read yet.</p>
      ) : (
        <FactList facts={factsOf(state, read?.source ?? state.source, read?.commit ?? null)} />
      )}
      {read !== null && storableSource(read.source) && edit.documentText !== null && (
        <div className="flex flex-col gap-2">
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <Button
              type="button"
              variant="outline"
              className="w-full sm:w-auto"
              aria-expanded={documentOpen}
              onClick={() => setDocumentOpen((open) => !open)}
            >
              Show document
            </Button>
            <Button
              type="button"
              variant="outline"
              className="w-full sm:w-auto"
              onClick={edit.openStore}
            >
              Store as environment
            </Button>
          </div>
          <Reveal open={documentOpen}>
            <pre className="max-h-64 overflow-auto font-mono text-xs break-words whitespace-pre-wrap">
              {edit.documentText}
            </pre>
          </Reveal>
        </div>
      )}
      {state !== null && state.checks.length > 0 && (
        <div className="flex flex-col gap-1">
          <h5 className="text-sm font-medium">Red baseline</h5>
          <ul className="flex flex-col gap-1 text-sm">
            {state.checks.map((check) => (
              <li key={check.command} className="font-mono break-words">
                {check.command} · exit {check.exit_code}
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="flex flex-col gap-1">
        <h5 className="text-sm font-medium">Secrets</h5>
        {secretEntries.length === 0 ? (
          <p className="text-sm text-muted-foreground">No secret variable.</p>
        ) : (
          <ul className="flex flex-col gap-2 text-sm">
            {secretEntries.map(([variable, credential]) => (
              <li
                key={variable}
                className="flex flex-col items-start gap-2 md:flex-row md:items-center md:justify-between"
              >
                <span className="min-w-0 font-mono break-words">
                  {variable} → {credential}
                </span>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    aria-label={`Edit secret ${variable}`}
                    onClick={() => secret.open(variable)}
                  >
                    Edit
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    aria-label={`Remove secret ${variable}`}
                    disabled={secret.sending}
                    onClick={() => secret.remove(variable)}
                  >
                    Remove
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
      {environment.error !== null && (
        <Alert variant="destructive" className="min-w-0">
          <AlertTitle>The stored environment was not read</AlertTitle>
          <AlertDescription className="flex min-w-0 flex-col gap-2">
            <p className="break-words">
              {environment.error.message} Edit environment stays off until the read works.
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full sm:w-auto sm:self-start"
              onClick={environment.reload}
            >
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      )}
      {failure !== null && (
        <Alert variant="destructive" className="min-w-0">
          <AlertTitle>{failure.class}</AlertTitle>
          <AlertDescription className="flex min-w-0 flex-col gap-2">
            <p className="break-words">
              <span className="font-mono">{failure.command}</span> ·{" "}
              <span>
                {failure.exit_code === null ? "no exit code" : `exit ${failure.exit_code}`}
              </span>
            </p>
            <pre className="max-h-48 overflow-auto font-mono text-xs break-words whitespace-pre-wrap">
              {failure.tail}
            </pre>
            <Button
              type="button"
              variant="outline"
              size="sm"
              aria-label="Copy tail"
              className="w-full sm:w-auto sm:self-start"
              onClick={() => copyText(failure.tail, "tail")}
            >
              Copy
            </Button>
            <code className="block font-mono text-xs break-words whitespace-pre-wrap">
              {failure.reproduce}
            </code>
            <Button
              type="button"
              variant="outline"
              size="sm"
              aria-label="Copy reproduce command"
              className="w-full sm:w-auto sm:self-start"
              onClick={() => copyText(failure.reproduce, "reproduce command")}
            >
              Copy
            </Button>
          </AlertDescription>
        </Alert>
      )}
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <Button
          type="button"
          variant="outline"
          className="w-full sm:w-auto"
          disabled={rebuilding}
          onClick={rebuild}
        >
          Run onboarding again
        </Button>
        <Button
          type="button"
          variant="outline"
          className="w-full sm:w-auto"
          disabled={environment.error !== null}
          onClick={edit.openEdit}
        >
          Edit environment
        </Button>
        <Button
          type="button"
          variant="outline"
          className="w-full sm:w-auto"
          disabled={
            environment.loading ||
            environment.data === null ||
            environment.data.environment === null
          }
          onClick={copy}
        >
          Copy environment
        </Button>
        <Button
          type="button"
          variant="outline"
          className="w-full sm:w-auto"
          onClick={() => secret.open()}
        >
          Set secret
        </Button>
      </div>
      {secret.editing && (
        <EnvironmentSecretSheet
          draft={secret.draft}
          errors={secret.errors}
          sending={secret.sending}
          sendError={secret.sendError}
          onEdit={secret.edit}
          onSend={secret.send}
          onClose={secret.close}
        />
      )}
      {edit.editing && !environment.loading && environment.error === null && (
        <EnvironmentEditSheet
          initialText={edit.initialText}
          saving={edit.saving}
          saveError={edit.saveError}
          onSave={edit.save}
          onClose={edit.closeEdit}
        />
      )}
    </section>
  );
}
