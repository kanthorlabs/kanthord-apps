import type { BindingPromptAgent } from "@/api/types";
import { TouchTarget } from "@/components/touch-target";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import type { PromptTarget } from "@/lib/binding-draft";
import type { PreviewPart } from "@/lib/prompt-preview";
import {
  isDefaultStandard,
  promptLayerLabel,
  promptPartStateLabel,
  promptPartStateNote,
} from "@/lib/prompt-part";
import { type PromptPreviewScope, usePromptPreview } from "../use-prompt-preview";

const NEW_PART_NOTE = "The server adds the heading of this new part when you save the binding.";

function PreviewItem({ part }: { readonly part: PreviewPart }) {
  const note = promptPartStateNote(part.state);
  return (
    <li className="flex min-w-0 flex-col gap-1 rounded-md border p-3">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <span className="text-sm font-medium break-all">
          {promptLayerLabel(part.layer)} · {part.part} {part.name}
        </span>
        {part.draft && <Badge>Draft</Badge>}
        {isDefaultStandard(part.layer) && <Badge variant="outline">Default standard</Badge>}
        {part.state !== "resolved" && (
          <Badge variant="destructive">{promptPartStateLabel(part.state)}</Badge>
        )}
      </div>
      {part.heading !== null && (
        <p className="text-sm break-words text-muted-foreground">{part.heading}</p>
      )}
      {part.draft && part.heading === null && (
        <p className="text-sm text-muted-foreground">{NEW_PART_NOTE}</p>
      )}
      {note !== null && <p className="text-sm text-muted-foreground">{note}</p>}
      {part.text !== null && (
        <pre className="min-w-0 rounded-md bg-muted p-2 text-xs break-words whitespace-pre-wrap">
          {part.text}
        </pre>
      )}
    </li>
  );
}

interface PromptPreviewPanelProps {
  readonly scope: PromptPreviewScope;
  readonly target: PromptTarget;
  readonly text: string;
}

export function PromptPreviewPanel({ scope, target, text }: PromptPreviewPanelProps) {
  const preview = usePromptPreview(scope, target, text);
  const items = preview.agents.map((agent) => ({ value: agent, label: agent }));
  return (
    <div className="flex min-w-0 flex-col gap-3">
      {preview.agents.length > 1 && (
        <Field>
          <FieldLabel htmlFor={`prompt-preview-agent-${target}`}>Agent</FieldLabel>
          <Select
            items={items}
            value={preview.agent}
            onValueChange={(value) => {
              if (value !== null) preview.selectAgent(value as BindingPromptAgent);
            }}
          >
            <SelectTrigger id={`prompt-preview-agent-${target}`} className="w-full">
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
        </Field>
      )}
      {preview.loading ? (
        <Skeleton role="status" aria-label="Loading preview" className="h-32 w-full" />
      ) : preview.error !== null ? (
        <Alert variant="destructive" className="flex flex-wrap items-center gap-2">
          <AlertDescription>{preview.error}</AlertDescription>
          <TouchTarget>
            <Button type="button" variant="outline" size="sm" onClick={preview.retry}>
              Retry
            </Button>
          </TouchTarget>
        </Alert>
      ) : (
        <ol
          aria-label={`System prompt of ${preview.agent}`}
          className="flex min-w-0 flex-col gap-2"
        >
          {preview.parts.map((part) => (
            <PreviewItem key={`${part.part}:${part.name}`} part={part} />
          ))}
        </ol>
      )}
    </div>
  );
}
