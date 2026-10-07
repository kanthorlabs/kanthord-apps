import { Link } from "react-router-dom";

import type { PromptLayer, PromptLayerKind, SystemLayerOverride } from "@/api/types";
import { SYSTEM_LAYER_OVERRIDES } from "@/api/types";
import { SourceSwitch } from "@/components/source-switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { PromptSettingsState } from "@/hooks/use-prompt-settings";
import { promptSourceTitle } from "@/lib/prompt-source-title";
import { CustomPromptEditor } from "@/components/custom-prompt-editor";
import {
  OVERRIDE_LABELS,
  overrideOf,
  sourceLockReason,
  SYSTEM_LAYER_SWITCH,
  systemLayerSummary,
} from "@/lib/prompt-switches";
import { PromptItem } from "./prompt-item";

const LAYER_TITLES: Readonly<Record<PromptLayerKind, string>> = {
  system: "System layer",
  agent: "Agent layer",
  working: "Working layer",
};

interface PromptLayerSectionProps {
  readonly agentName: string;
  readonly layer: PromptLayer;
  readonly server: PromptSettingsState;
  readonly scope: PromptSettingsState;
}

function SystemLayerControl({ agentName, server, scope }: Omit<PromptLayerSectionProps, "layer">) {
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
        {systemLayerSummary(override, serverOn, agentName)}{" "}
        <Link to="/settings/prompts" className="underline underline-offset-4">
          Server settings
        </Link>
      </p>
    </div>
  );
}

export function PromptLayerSection({ agentName, layer, server, scope }: PromptLayerSectionProps) {
  const title = LAYER_TITLES[layer.layer];
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
              {agentName} receives the layer.
            </CardDescription>
          )}
        </div>
        {system && <SystemLayerControl agentName={agentName} server={server} scope={scope} />}
      </CardHeader>
      <CardContent className="grid grid-cols-[minmax(0,1fr)] gap-2">
        {!layer.enabled && (
          <p className="text-sm text-muted-foreground">
            The system layer is off for {agentName}. Each source keeps its switch for when the layer
            turns on.
          </p>
        )}
        <div role="list" aria-label={title} className="grid grid-cols-[minmax(0,1fr)] gap-2">
          {layer.sources.map((source) => {
            const sourceTitle = promptSourceTitle(layer.layer, source);
            const checked = switches[source.source] ?? source.enabled;
            return (
              <PromptItem
                key={source.source}
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
                          description={`Markdown that the ${title.toLowerCase()} of ${agentName} joins after its other sources.`}
                          settings={scope}
                        />
                      )}
                      <SourceSwitch
                        title={sourceTitle}
                        checked={checked}
                        disabled={scope.pending || scope.settings === null}
                        lockedReason={sourceLockReason(layer.layer, source, sourceTitle, switches)}
                        onChange={(enabled) =>
                          scope.switchSource(source.source, enabled, sourceTitle)
                        }
                      />
                    </>
                  )
                }
              />
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
