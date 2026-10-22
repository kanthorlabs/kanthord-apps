import { ChevronDownIcon } from "lucide-react";
import type { ReactNode } from "react";

import type { SpanStatus, TraceSpan } from "@/api/types";
import { MarkdownText } from "@/components/markdown-text";
import { RevealPanel } from "@/components/reveal";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleTrigger } from "@/components/ui/collapsible";
import type { NamedValue } from "@/lib/span-detail";
import { spanLabel } from "@/lib/span-labels";

import {
  useSpanDetail,
  type Loadable,
  type ModelReply,
  type SpanDetailState,
  type ToolResult,
} from "../use-span-detail";

const STATUS_BADGES: Readonly<
  Record<
    SpanStatus,
    { readonly label: string; readonly variant: "secondary" | "outline" | "destructive" }
  >
> = {
  Unset: { label: "Unset", variant: "secondary" },
  Ok: { label: "OK", variant: "outline" },
  Error: { label: "Error", variant: "destructive" },
};

function NameValueList({ items }: { readonly items: readonly NamedValue[] }) {
  return (
    <dl className="flex min-w-0 flex-wrap gap-x-4 gap-y-1 text-sm">
      {items.map((item) => (
        <div key={item.name} className="flex max-w-full min-w-0 items-baseline gap-1.5">
          <dt className="min-w-0 text-muted-foreground break-all">{item.name}</dt>
          <dd className="min-w-0 break-words">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function Section({ title, children }: { readonly title: string; readonly children: ReactNode }) {
  return (
    <section aria-label={title} className="flex min-w-0 flex-col gap-2">
      <h4 className="text-sm font-semibold">{title}</h4>
      {children}
    </section>
  );
}

function TextBlock({ children }: { readonly children: string }) {
  return (
    <pre className="min-w-0 rounded-md bg-muted p-2 text-xs break-words whitespace-pre-wrap">
      {children}
    </pre>
  );
}

interface LoadedProps<T> {
  readonly state: Loadable<T>;
  readonly children: (value: T) => ReactNode;
}

function Loaded<T>({ state, children }: LoadedProps<T>) {
  switch (state.status) {
    case "loading":
      return <p className="text-muted-foreground">Loading.</p>;
    case "absent":
      return <p className="text-muted-foreground">The entry is not stored.</p>;
    case "failed":
      return (
        <Alert variant="destructive">
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      );
    default:
      return children(state.value);
  }
}

function EventsSection({ events }: Pick<SpanDetailState, "events">) {
  if (events.length === 0) return null;
  return (
    <Section title="Events">
      <ul className="flex flex-col gap-2">
        {events.map((event, index) => (
          <li key={`${index}-${event.name}`} className="flex min-w-0 flex-col gap-1">
            <div className="flex min-w-0 flex-wrap items-baseline gap-x-2">
              <span className="font-medium break-all">{event.name}</span>
              <span className="text-sm text-muted-foreground">{event.time}</span>
            </div>
            {event.attributes.length > 0 && <NameValueList items={event.attributes} />}
          </li>
        ))}
      </ul>
    </Section>
  );
}

function LinksSection({ links }: Pick<SpanDetailState, "links">) {
  if (links.length === 0) return null;
  return (
    <Section title="Links">
      <ul className="flex flex-col gap-2">
        {links.map((link) => (
          <li key={`${link.trace_id}/${link.span_id}`}>
            <NameValueList
              items={[
                { name: "Trace", value: link.trace_id },
                { name: "Span", value: link.span_id },
              ]}
            />
          </li>
        ))}
      </ul>
    </Section>
  );
}

function TextsSection({ texts }: Pick<SpanDetailState, "texts">) {
  if (texts.length === 0) return null;
  return (
    <Section title="Texts">
      {texts.map((text) => (
        <div key={text.name} className="flex min-w-0 flex-col gap-1">
          <span className="text-sm text-muted-foreground">{text.name}</span>
          <Loaded state={text.state}>{(content) => <TextBlock>{content}</TextBlock>}</Loaded>
        </div>
      ))}
    </Section>
  );
}

interface ReplyProps {
  readonly reply: ModelReply;
  readonly onSelect: (spanId: string) => void;
}

function ReplyBody({ reply, onSelect }: ReplyProps) {
  return (
    <div className="flex min-w-0 flex-col gap-3">
      {reply.text !== "" && <MarkdownText text={reply.text} />}
      {reply.thinking.length > 0 && (
        <Collapsible className="flex flex-col gap-2">
          <CollapsibleTrigger
            render={<Button variant="outline" size="sm" className="self-start" />}
          >
            <ChevronDownIcon aria-hidden="true" data-icon="inline-start" />
            Show thinking
          </CollapsibleTrigger>
          <RevealPanel>
            <div className="flex flex-col gap-2">
              {reply.thinking.map((thought, index) => (
                <TextBlock key={`${index}-${thought}`}>{thought}</TextBlock>
              ))}
            </div>
          </RevealPanel>
        </Collapsible>
      )}
      {reply.toolCalls.length > 0 && (
        <ul aria-label="Tool calls" className="flex flex-col gap-2">
          {reply.toolCalls.map((call) => (
            <li key={call.id} className="flex min-w-0 flex-wrap items-center gap-2">
              <span className="font-medium break-all">{call.name}</span>
              {call.toolSpan === null ? (
                <span className="text-sm text-muted-foreground">Tool span not stored.</span>
              ) : (
                <ToolSpanButton span={call.toolSpan} onSelect={onSelect} />
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ToolSpanButton({
  span,
  onSelect,
}: {
  readonly span: TraceSpan;
  readonly onSelect: (spanId: string) => void;
}) {
  return (
    <Button variant="outline" size="sm" onClick={() => onSelect(span.span_id)}>
      Open tool span
    </Button>
  );
}

function ResultBody({ result }: { readonly result: ToolResult }) {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <Badge variant={result.isError ? "destructive" : "outline"} className="self-start">
        {result.isError ? "Error" : "OK"}
      </Badge>
      <TextBlock>{result.text}</TextBlock>
    </div>
  );
}

interface SpanDetailProps {
  readonly traceId: string;
  readonly span: TraceSpan;
  readonly spans: readonly TraceSpan[];
  readonly onSelect: (spanId: string) => void;
}

export function SpanDetail({ traceId, span, spans, onSelect }: SpanDetailProps) {
  const detail = useSpanDetail(traceId, span, spans);
  const badge = STATUS_BADGES[span.status];
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <h3 className="min-w-0 text-base font-semibold break-all">{spanLabel(span)}</h3>
        <Badge variant={badge.variant}>{badge.label}</Badge>
      </div>
      <NameValueList items={detail.facts} />
      {detail.attributes.length > 0 && (
        <Section title="Attributes">
          <NameValueList items={detail.attributes} />
        </Section>
      )}
      <EventsSection events={detail.events} />
      <LinksSection links={detail.links} />
      <TextsSection texts={detail.texts} />
      {detail.modelReply !== null && (
        <Section title="Model reply">
          <Loaded state={detail.modelReply}>
            {(reply) => <ReplyBody reply={reply} onSelect={onSelect} />}
          </Loaded>
        </Section>
      )}
      {detail.toolArguments !== null && (
        <Section title="Arguments">
          <Loaded state={detail.toolArguments}>{(json) => <TextBlock>{json}</TextBlock>}</Loaded>
        </Section>
      )}
      {detail.toolResult !== null && (
        <Section title="Result">
          <Loaded state={detail.toolResult}>{(result) => <ResultBody result={result} />}</Loaded>
        </Section>
      )}
    </div>
  );
}
