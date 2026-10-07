import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { Item, ItemActions, ItemContent, ItemDescription, ItemTitle } from "@/components/ui/item";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { CustomPromptEditor } from "@/components/custom-prompt-editor";
import { usePromptSettings } from "@/hooks/use-prompt-settings";
import { SYSTEM_LAYER_SWITCH } from "@/lib/prompt-switches";

const SYSTEM_SOURCES = [
  {
    source: "host_file",
    title: "Host agent file",
    description:
      "The configured system file, else the first of ~/.agents/AGENTS.md and ~/.claude/CLAUDE.md.",
  },
  {
    source: "base",
    title: "Shipped base prompt",
    description: "base.md, embedded in the binary.",
  },
  {
    source: "custom",
    title: "Custom system prompt",
    description: "The custom text that the database stores.",
  },
] as const;

const NO_CHANGE = () => {};

export function PromptsScreen() {
  const system = usePromptSettings({ scope: "system" }, NO_CHANGE);
  const settings = system.settings;

  if (settings === null) {
    return system.failure === null ? (
      <Skeleton className="h-48 w-full" />
    ) : (
      <p className="text-sm text-destructive">{system.failure}</p>
    );
  }

  const layerOn = settings.switches[SYSTEM_LAYER_SWITCH] ?? true;
  return (
    <div className="grid max-w-3xl gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold">Prompts</h2>
        <p className="text-sm text-muted-foreground">
          The server owns the system layer. Each agent page owns its agent layer, its working layer
          and its system layer override.
        </p>
      </div>
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <h3 id="system-layer-title" className="font-semibold leading-none">
                System layer
              </h3>
              <Badge variant={layerOn ? "default" : "secondary"}>{layerOn ? "on" : "off"}</Badge>
            </div>
            <CardDescription>
              Off turns the system layer off for every agent that follows the server. An agent page
              can turn it on or off for that agent only.
            </CardDescription>
          </div>
          <Switch
            aria-labelledby="system-layer-title"
            checked={layerOn}
            disabled={system.pending}
            onCheckedChange={(enabled) =>
              system.switchSource(SYSTEM_LAYER_SWITCH, enabled, "the system layer")
            }
          />
        </CardHeader>
        <CardContent>
          <div role="list" aria-label="System layer sources" className="grid gap-2">
            {SYSTEM_SOURCES.map(({ source, title, description }) => (
              <Item key={source} role="listitem" variant="outline" size="sm">
                <ItemContent>
                  <ItemTitle>{title}</ItemTitle>
                  <ItemDescription>{description}</ItemDescription>
                </ItemContent>
                <ItemActions>
                  {source === "custom" && (
                    <CustomPromptEditor
                      title={title}
                      description="Markdown that the system layer of every agent joins after its other sources."
                      settings={system}
                    />
                  )}
                  <Switch
                    aria-label={`${title} switch`}
                    checked={settings.switches[source] ?? true}
                    disabled={system.pending}
                    onCheckedChange={(enabled) => system.switchSource(source, enabled, title)}
                  />
                </ItemActions>
              </Item>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
