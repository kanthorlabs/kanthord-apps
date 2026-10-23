import { useEffect, useRef } from "react";

import type { EnvironmentState } from "@/api/types";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { environmentStatusLabel, environmentStatusVariant } from "@/lib/environment-bar";
import { useBindingEnvironment } from "../use-binding-environment";
import { FactList, type Fact } from "./fact-list";

const DIGEST_LENGTH = 12;

interface EnvironmentSectionProps {
  readonly projectId: string;
  readonly bindingId: string;
  readonly bindingName: string;
  readonly state: EnvironmentState | null;
  readonly focused: boolean;
  readonly onChanged: () => void;
  readonly onEdit: () => void;
}

function factsOf(state: EnvironmentState): readonly Fact[] {
  return [
    { label: "Source", value: state.source },
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
  focused,
  onChanged,
  onEdit,
}: EnvironmentSectionProps) {
  const { environment, rebuilding, rebuild, copy, copyText } = useBindingEnvironment(
    projectId,
    bindingId,
    bindingName,
    onChanged,
  );
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
        <FactList facts={factsOf(state)} />
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
        <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={onEdit}>
          Edit environment
        </Button>
        <Button
          type="button"
          variant="outline"
          className="w-full sm:w-auto"
          disabled={environment.loading || environment.data === null}
          onClick={copy}
        >
          Copy environment
        </Button>
      </div>
    </section>
  );
}
