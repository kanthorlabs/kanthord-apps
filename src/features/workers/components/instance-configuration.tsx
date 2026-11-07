import { CopyIcon, TriangleAlertIcon } from "lucide-react";
import { toast } from "sonner";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useClipboard } from "@/hooks/use-clipboard";
import {
  type ContainerRuntime,
  type CopyStep,
  copyStepsOf,
  type HostKind,
  isContainerKind,
  machineCopyStepsOf,
  type MachineStage,
  RELEASES,
} from "@/lib/instance-host";

const VERSION_PLACEHOLDER = "<version>";

export type ConfigurationTarget =
  | { readonly subject: "instance"; readonly name: string; readonly machine: string | null }
  | { readonly subject: "machine"; readonly name: string; readonly stage: MachineStage };

interface SubjectTexts {
  readonly title: string;
  readonly detail: string;
  readonly heading: string;
  readonly stepsHeading: string;
  readonly footer: string | null;
}

const SUBJECT_TEXTS: Readonly<Record<ConfigurationTarget["subject"], SubjectTexts>> = {
  instance: {
    title: "The instance configuration shows only once.",
    detail:
      "Copy it now. It holds the private key of the instance. The dashboard keeps no copy after this sheet closes. A lost configuration needs Reset key.",
    heading: "Instance configuration",
    stepsHeading: "Run the instance",
    footer: "The instance page shows Connected when the instance reaches the server.",
  },
  machine: {
    title: "The machine configuration shows only once.",
    detail:
      "Copy it now. It holds the private key of the machine. The dashboard keeps no copy after this screen closes. A lost configuration needs Reset key.",
    heading: "Machine configuration",
    stepsHeading: "Deliver the machine configuration",
    footer: null,
  },
};

function stepsOf(
  target: ConfigurationTarget,
  kind: HostKind,
  version: string,
  runtime: ContainerRuntime,
): readonly CopyStep[] {
  return target.subject === "instance"
    ? copyStepsOf(kind, target.name, version, runtime, target.machine)
    : machineCopyStepsOf(kind, target.name, version, runtime, target.stage);
}

interface InstanceConfigurationProps {
  readonly target: ConfigurationTarget;
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
  target,
  kind,
  runtime,
  version,
  versionError,
  configuration,
}: InstanceConfigurationProps) {
  const steps = stepsOf(target, kind, version ?? VERSION_PLACEHOLDER, runtime);
  const texts = SUBJECT_TEXTS[target.subject];
  const configurationId = `${target.subject}-configuration`;
  const stepsId = `${target.subject}-steps`;
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
        <AlertTitle>{texts.title}</AlertTitle>
        <AlertDescription>{texts.detail}</AlertDescription>
      </Alert>
      <section aria-labelledby={configurationId} className="flex min-w-0 flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 id={configurationId} className="font-semibold">
            {texts.heading}
          </h3>
          <CopyButton text={configuration} label={`the ${target.subject} configuration`} />
        </div>
        <pre className="max-h-32 overflow-y-auto rounded-md bg-muted p-2 font-mono text-xs break-all whitespace-pre-wrap">
          {configuration}
        </pre>
      </section>
      <section aria-labelledby={stepsId} className="flex min-w-0 flex-col gap-2">
        <h3 id={stepsId} className="font-semibold">
          {texts.stepsHeading}: {kind}
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
        {texts.footer !== null && <p className="text-sm text-muted-foreground">{texts.footer}</p>}
      </section>
    </div>
  );
}
