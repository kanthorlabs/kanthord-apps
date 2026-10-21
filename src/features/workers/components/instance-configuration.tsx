import { CopyIcon, TriangleAlertIcon } from "lucide-react";
import { toast } from "sonner";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useClipboard } from "@/hooks/use-clipboard";
import {
  copyStepsOf,
  isContainerKind,
  RELEASES,
  type ContainerRuntime,
  type HostKind,
} from "@/lib/instance-host";

const VERSION_PLACEHOLDER = "<version>";

interface InstanceConfigurationProps {
  readonly name: string;
  readonly kind: HostKind;
  readonly runtime: ContainerRuntime;
  readonly version: string | null;
  readonly versionError: string | null;
  readonly configuration: string;
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const write = useClipboard();
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      aria-label={`Copy ${label}`}
      onClick={() =>
        write(text).then(
          () => toast.success(`Copied ${label}.`),
          () => toast.error("The browser refused the clipboard."),
        )
      }
    >
      <CopyIcon aria-hidden="true" data-icon="inline-start" />
      Copy
    </Button>
  );
}

export function InstanceConfiguration({
  name,
  kind,
  runtime,
  version,
  versionError,
  configuration,
}: InstanceConfigurationProps) {
  const steps = copyStepsOf(kind, name, version ?? VERSION_PLACEHOLDER, runtime);
  return (
    <div className="flex min-w-0 flex-col gap-4">
      {versionError !== null && (
        <Alert variant="destructive">
          <TriangleAlertIcon aria-hidden="true" />
          <AlertTitle>The server version was not read.</AlertTitle>
          <AlertDescription>
            {versionError} The steps show {VERSION_PLACEHOLDER} in its place. Run kanthord --version
            on the server host, and use that release from{" "}
            <a href={RELEASES} target="_blank" rel="noreferrer">
              {RELEASES}
            </a>
            .
          </AlertDescription>
        </Alert>
      )}
      <Alert>
        <TriangleAlertIcon aria-hidden="true" />
        <AlertTitle>The instance configuration shows only once.</AlertTitle>
        <AlertDescription>
          Copy it now. It holds the private key of the instance. The dashboard keeps no copy after
          this sheet closes. A lost configuration needs Reset key.
        </AlertDescription>
      </Alert>
      <section aria-labelledby="instance-configuration" className="flex min-w-0 flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 id="instance-configuration" className="font-semibold">
            Instance configuration
          </h3>
          <CopyButton text={configuration} label="the instance configuration" />
        </div>
        <pre className="max-h-32 overflow-y-auto rounded-md bg-muted p-2 font-mono text-xs break-all whitespace-pre-wrap">
          {configuration}
        </pre>
      </section>
      <section aria-labelledby="instance-steps" className="flex min-w-0 flex-col gap-2">
        <h3 id="instance-steps" className="font-semibold">
          Run the instance: {kind}
          {isContainerKind(kind) && ` with ${runtime}`}
        </h3>
        <ol className="flex list-decimal flex-col gap-3 pl-5 text-sm">
          {steps.map((step) => (
            <li key={step.text} className="min-w-0">
              <p className="break-words">{step.text}</p>
              {step.command !== null && (
                <div className="mt-1 flex min-w-0 flex-col gap-1">
                  <pre className="max-h-48 overflow-auto rounded-md bg-muted p-2 font-mono text-xs break-all whitespace-pre-wrap">
                    {step.command}
                  </pre>
                  <div className="flex justify-end">
                    <CopyButton text={step.command} label="the command" />
                  </div>
                </div>
              )}
            </li>
          ))}
        </ol>
        <p className="text-sm text-muted-foreground">
          The instance page shows Connected when the instance reaches the server.
        </p>
      </section>
    </div>
  );
}
