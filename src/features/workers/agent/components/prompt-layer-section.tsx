import { EyeIcon } from "lucide-react";
import { Link } from "react-router-dom";

import type { PromptLayer, PromptLayerKind, SystemLayerOverride } from "@/api/types";
import { SYSTEM_LAYER_OVERRIDES } from "@/api/types";
import { RecordName } from "@/components/record-name";
import { Reveal } from "@/components/reveal";
import { SourceSwitch } from "@/components/source-switch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { PromptSettingsState } from "@/hooks/use-prompt-settings";
import { promptSourceTitle } from "@/lib/prompt-source-title";
import { CustomPromptEditor } from "@/components/custom-prompt-editor";
import {
  OVERRIDE_LABELS,
  overrideOf,
  sourceLockOf,
  SYSTEM_LAYER_SWITCH,
  type SourceLock,
} from "@/lib/prompt-switches";
import { hiddenSourcesLabel } from "@/lib/prompt-visibility";
import type { InactiveSourcesState } from "../use-inactive-sources";
import { PromptItem } from "@/components/prompt-item";

const LAYER_TITLES: Readonly<Record<PromptLayerKind, string>> = {
  system: "System layer",
  agent: "Agent layer",
  working: "Working layer",
};

function SystemLayerSummary({
  override,
  serverOn,
  agentName,
}: {
  override: SystemLayerOverride;
  serverOn: boolean;
  agentName: string;
}) {
  const server = serverOn ? "on" : "off";
  if (override === "inherit") return <>Follows the server switch, which is {server}.</>;
  return (
    <>
      Turned {override} for <RecordName>{agentName}</RecordName> only. The server switch is {server}
      .
    </>
  );
}

function SourceLockReason({ lock, title }: { lock: SourceLock; title: string }) {
  if (lock === "last-source") return <>The agent layer needs one source that is on.</>;
  return (
    <>
      <RecordName>{title}</RecordName> does not exist.
    </>
  );
}

interface PromptLayerSectionProps {
  readonly agentName: string;
  readonly layer: PromptLayer;
  readonly server: PromptSettingsState;
  readonly scope: PromptSettingsState;
  readonly visibility: InactiveSourcesState;
}

function SystemLayerControl({
  agentName,
  server,
  scope,
}: Omit<PromptLayerSectionProps, "layer" | "visibility">) {
  const override = scope.settings?.system_layer ?? "inherit";
  const serverOn = server.settings?.switches[SYSTEM_LAYER_SWITCH] ?? true;
  return (
    <div className="flex flex-col gap-2 sm:items-end">
      <ToggleGroup
        variant="outline"
        size="sm"
        spacing={0}
        aria-label={`System layer of ${agentName}`}
        value={[override]}
        disabled={scope.pending || scope.settings === null}
        onValueChange={(value: string[]) => {
          const next = overrideOf(value[0]);
          if (next !== null && next !== override) scope.setOverride(next);
        }}
      >
        {SYSTEM_LAYER_OVERRIDES.map((value: SystemLayerOverride) => (
          <ToggleGroupItem key={value} value={value}>
            {OVERRIDE_LABELS[value]}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      <p className="text-sm text-muted-foreground">
        <SystemLayerSummary override={override} serverOn={serverOn} agentName={agentName} />{" "}
        <Link to="/settings/prompts" className="underline underline-offset-4">
          Server settings
        </Link>
      </p>
    </div>
  );
}

export function PromptLayerSection({
  agentName,
  layer,
  server,
  scope,
  visibility,
}: PromptLayerSectionProps) {
  const title = LAYER_TITLES[layer.layer];
  const hiddenCount = layer.sources.filter((source) =>
    visibility.hides(layer.layer, source),
  ).length;
  const system = layer.layer === "system";
  const switches = scope.settings?.switches ?? {};
  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <h2 className="font-semibold leading-none">{title}</h2>
            <Badge variant={layer.enabled ? "default" : "secondary"}>
              {layer.enabled ? "on" : "off"}
            </Badge>
          </div>
          {system && (
            <CardDescription>
              The server owns the source switches of this layer. The control decides whether{" "}
              <RecordName>{agentName}</RecordName> receives the layer.
            </CardDescription>
          )}
        </div>
        {system && <SystemLayerControl agentName={agentName} server={server} scope={scope} />}
      </CardHeader>
      <CardContent className="grid grid-cols-[minmax(0,1fr)] gap-2">
        {!layer.enabled && (
          <p className="text-sm text-muted-foreground">
            The system layer is off for <RecordName>{agentName}</RecordName>. Each source keeps its
            switch for when the layer turns on.
          </p>
        )}
        <div className="-mb-2 grid grid-cols-[minmax(0,1fr)]">
          <div role="list" aria-label={title} className="grid grid-cols-[minmax(0,1fr)]">
            {layer.sources.map((source) => {
              const sourceTitle = promptSourceTitle(layer.layer, source);
              const checked = switches[source.source] ?? source.enabled;
              const lock = sourceLockOf(layer.layer, source, switches);
              return (
                <Reveal key={source.source} open={!visibility.hides(layer.layer, source)}>
                  <div className="pb-2">
                    <PromptItem
                      title={sourceTitle}
                      path={source.path !== null}
                      text={source.state === "present" ? source.text : null}
                      dimmed={!layer.enabled}
                      badges={
                        <>
                          <Badge variant="outline">{source.origin}</Badge>
                          <Badge variant={source.state === "present" ? "default" : "secondary"}>
                            {source.state}
                          </Badge>
                        </>
                      }
                      control={
                        system ? undefined : (
                          <>
                            {source.source === "custom" && (
                              <CustomPromptEditor
                                title={sourceTitle}
                                description={
                                  <>
                                    Markdown that the {title.toLowerCase()} of{" "}
                                    <RecordName>{agentName}</RecordName> joins after its other
                                    sources.
                                  </>
                                }
                                settings={scope}
                              />
                            )}
                            <SourceSwitch
                              title={sourceTitle}
                              checked={checked}
                              disabled={scope.pending || scope.settings === null}
                              lockedReason={
                                lock === null ? null : (
                                  <SourceLockReason lock={lock} title={sourceTitle} />
                                )
                              }
                              onChange={(enabled) =>
                                scope.switchSource(source.source, enabled, sourceTitle)
                              }
                            />
                          </>
                        )
                      }
                    />
                  </div>
                </Reveal>
              );
            })}
          </div>
          <Reveal open={hiddenCount > 0}>
            <div className="pb-2">
              <Button variant="ghost" size="sm" onClick={() => visibility.showLayer(layer.layer)}>
                <EyeIcon aria-hidden="true" data-icon="inline-start" />
                {hiddenSourcesLabel(hiddenCount)}
              </Button>
            </div>
          </Reveal>
        </div>
      </CardContent>
    </Card>
  );
}
