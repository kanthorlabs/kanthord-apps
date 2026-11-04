import { ChevronDownIcon } from "lucide-react";
import { type ReactNode, useEffect, useRef, useState } from "react";

import type { EntryRebuildFailure } from "@/api/entry-rebuild-failure";
import type { TraceSessionEntry, TraceSpan } from "@/api/types";
import { MarkdownText } from "@/components/markdown-text";
import { RecordName } from "@/components/record-name";
import { RevealPanel } from "@/components/reveal";
import { TouchTarget } from "@/components/touch-target";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Item, ItemContent, ItemTitle } from "@/components/ui/item";
import { Spinner } from "@/components/ui/spinner";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { noteLine, systemLabel, systemSize, usageLine } from "@/lib/entry-blocks";
import { byteText } from "@/lib/format";
import { type EntryToolCall, type EntryView, entryView } from "@/lib/session-entries";

import { type FullEntry, useFullEntry } from "../use-full-entry";
import type { PromptSource } from "../use-resolved-prompt";
import { PinnedPromptText } from "./pinned-prompt-text";

const NO_SOURCE_TEXT = "This trace names no execution, so the server rebuilds no system prompt.";

const ENTRY_BOUND_BYTES = 61_440;

const CUT_HINT = `The worker cut this entry to fit the entry bound of ${byteText(ENTRY_BOUND_BYTES)}.`;

function TextBlock({ children }: { readonly children: string }) {
  return (
    <pre className="min-w-0 rounded-md bg-muted p-2 text-xs break-words whitespace-pre-wrap">
      {children}
    </pre>
  );
}

function Disclosure({ label, children }: { readonly label: string; readonly children: ReactNode }) {
  return (
    <Collapsible className="flex min-w-0 flex-col gap-2">
      <TouchTarget>
        <CollapsibleTrigger render={<Button variant="outline" size="sm" className="self-start" />}>
          <ChevronDownIcon aria-hidden="true" data-icon="inline-start" />
          {label}
        </CollapsibleTrigger>
      </TouchTarget>
      <RevealPanel>{children}</RevealPanel>
    </Collapsible>
  );
}

function CutBadge() {
  const [open, setOpen] = useState(false);
  return (
    <Tooltip open={open} onOpenChange={setOpen}>
      <TooltipTrigger
        render={<Badge variant="outline" tabIndex={0} />}
        closeOnClick={false}
        onPointerUp={() => setOpen(true)}
      >
        Cut
      </TooltipTrigger>
      <TooltipContent>{CUT_HINT}</TooltipContent>
    </Tooltip>
  );
}

function FullEntryAction({ full }: { readonly full: FullEntry }) {
  return (
    <TouchTarget>
      <Button
        variant="outline"
        size="sm"
        className="self-start"
        disabled={full.loading}
        onClick={full.load}
      >
        {full.loading && (
          <Spinner aria-hidden="true" role="presentation" data-icon="inline-start" />
        )}
        Load full entry
      </Button>
    </TouchTarget>
  );
}

function FullEntryFailure({ failure }: { readonly failure: EntryRebuildFailure }) {
  return (
    <p role="alert" className="text-sm break-words text-destructive">
      {failure.lead}
      {failure.instance !== null && <RecordName>{failure.instance}</RecordName>}
      {failure.tail}
    </p>
  );
}

function ToolCall({ call }: { readonly call: EntryToolCall }) {
  return (
    <li className="flex min-w-0 flex-col gap-2">
      <span className="font-medium break-all">{call.name}</span>
      <Disclosure label="Show arguments">
        <TextBlock>{JSON.stringify(call.arguments ?? null, null, 2)}</TextBlock>
      </Disclosure>
    </li>
  );
}

type Of<K extends EntryView["kind"]> = Extract<EntryView, { kind: K }>;

function AssistantBody({ view }: { readonly view: Of<"assistant"> }) {
  const usage = usageLine(view);
  return (
    <>
      {view.text !== "" && (
        <div className="min-w-0 break-words">
          <MarkdownText text={view.text} />
        </div>
      )}
      {view.thinking.length > 0 && (
        <Disclosure label="Show thinking">
          <div className="flex flex-col gap-2">
            {view.thinking.map((thought, index) => (
              <TextBlock key={`${index}-${thought}`}>{thought}</TextBlock>
            ))}
          </div>
        </Disclosure>
      )}
      {view.toolCalls.length > 0 && (
        <ul aria-label="Tool calls" className="flex flex-col gap-3">
          {view.toolCalls.map((call) => (
            <ToolCall key={call.id} call={call} />
          ))}
        </ul>
      )}
      {usage !== null && <p className="text-sm text-muted-foreground">{usage}</p>}
    </>
  );
}

function ToolResultBody({ view }: { readonly view: Of<"tool_result"> }) {
  return (
    <>
      <p className="min-w-0 break-words">{view.firstLine}</p>
      <Disclosure label="Show result">
        <TextBlock>{view.text}</TextBlock>
      </Disclosure>
    </>
  );
}

function SystemBody({ view }: { readonly view: Of<"system"> }) {
  return (
    <>
      <p className="text-sm text-muted-foreground">{systemSize(view)}</p>
      <Disclosure label="Show prompt">
        <div className="flex flex-col gap-2">
          {view.text !== "" && <TextBlock>{view.text}</TextBlock>}
          {view.sections.map((section) => (
            <div key={section.name} className="flex min-w-0 flex-col gap-1">
              <span className="text-sm text-muted-foreground">{section.name}</span>
              <TextBlock>{section.text}</TextBlock>
            </div>
          ))}
        </div>
      </Disclosure>
    </>
  );
}

function PinnedBody({ source }: { readonly source: PromptSource | null }) {
  return (
    <Disclosure label="Show prompt">
      {source === null ? (
        <p className="text-sm text-muted-foreground">{NO_SOURCE_TEXT}</p>
      ) : (
        <PinnedPromptText source={source} />
      )}
    </Disclosure>
  );
}

function PromptBody({ text }: { readonly text: string }) {
  return (
    <Disclosure label="Show prompt">
      <TextBlock>{text}</TextBlock>
    </Disclosure>
  );
}

function titleOf(view: EntryView): ReactNode {
  switch (view.kind) {
    case "user":
      return "User";
    case "assistant":
      return "Model";
    case "tool_result":
      return (
        <>
          <span className="break-all">{view.toolName === "" ? "Tool result" : view.toolName}</span>
          <Badge variant={view.isError ? "destructive" : "outline"}>
            {view.isError ? "Error" : "OK"}
          </Badge>
        </>
      );
    case "system":
      return systemLabel(view);
    default:
      return null;
  }
}

function bodyOf(view: EntryView, labelled: boolean, promptSource: PromptSource | null): ReactNode {
  switch (view.kind) {
    case "user":
      if (labelled) return <PromptBody text={view.text} />;
      return <p className="min-w-0 break-words whitespace-pre-wrap">{view.text}</p>;
    case "assistant":
      return <AssistantBody view={view} />;
    case "tool_result":
      return <ToolResultBody view={view} />;
    case "system":
      if (view.source === "pinned") return <PinnedBody source={promptSource} />;
      return <SystemBody view={view} />;
    default:
      return <p className="min-w-0 break-words">{noteLine(view)}</p>;
  }
}

interface EntryBlockProps {
  readonly entry: TraceSessionEntry;
  readonly current: boolean;
  readonly turn: TraceSpan | null;
  readonly promptLabel: string | null;
  readonly promptSource: PromptSource | null;
  readonly onShowInTimeline: (spanId: string) => void;
}

export function EntryBlock({
  entry,
  current,
  turn,
  promptLabel,
  promptSource,
  onShowInTimeline,
}: EntryBlockProps) {
  const ref = useRef<HTMLDivElement>(null);
  const full = useFullEntry(entry);
  const view = entryView(full.entry ?? entry);
  const title = promptLabel ?? titleOf(view);

  useEffect(() => {
    if (current) ref.current?.scrollIntoView({ block: "center" });
  }, [current]);

  return (
    <Item
      ref={ref}
      variant="outline"
      role="listitem"
      aria-current={current ? "true" : undefined}
      className="min-w-0"
    >
      <ItemContent className="min-w-0">
        {(title !== null || entry.truncated) && (
          <ItemTitle className="w-full min-w-0 flex-wrap break-words">
            {title}
            {entry.truncated &&
              (full.entry === null ? <CutBadge /> : <Badge variant="outline">Full</Badge>)}
          </ItemTitle>
        )}
        {bodyOf(view, promptLabel !== null, promptSource)}
        {entry.truncated && full.entry === null && <FullEntryAction full={full} />}
        {view.kind === "assistant" && turn !== null && (
          <TouchTarget>
            <Button
              variant="outline"
              size="sm"
              className="self-start"
              onClick={() => onShowInTimeline(turn.span_id)}
            >
              Show in steps
            </Button>
          </TouchTarget>
        )}
        {full.failure !== null && <FullEntryFailure failure={full.failure} />}
      </ItemContent>
    </Item>
  );
}
