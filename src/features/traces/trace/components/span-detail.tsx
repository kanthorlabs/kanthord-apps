import type { ReactNode } from "react";

import type { TraceSpan } from "@/api/types";
import { MarkdownText } from "@/components/markdown-text";
import { TouchTarget } from "@/components/touch-target";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { NamedValue } from "@/lib/span-detail";
import type { SpanBlock } from "@/lib/span-blocks";

import {
  type Loadable,
  type ModelReply,
  type SpanDetailState,
  type SpanText,
  type ToolResult,
  useSpanDetail,
} from "../use-span-detail";
import { useTraceSelection } from "../use-trace-selection";
import { IdentityValue } from "./identity-value";
import { SpanDisclosure } from "./span-disclosure";
import { SpanFooter } from "./span-footer";
import { TurnTokensChart } from "./turn-tokens-chart";

function NameValueList({ items }: { readonly items: readonly NamedValue[] }) {
  return (
    <dl className="flex min-w-0 flex-wrap gap-x-4 gap-y-1 text-sm">
      {items.map((item) => (
        <div key={item.name} className="flex max-w-full min-w-0 items-baseline gap-1.5">
          <dt className="min-w-0 text-muted-foreground break-all">{item.name}</dt>
          <dd className="min-w-0 break-words">
            {item.identity === true ? (
              <IdentityValue label={item.name} value={item.value} />
            ) : (
              item.value
            )}
          </dd>
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

function EventsDisclosure({ events }: Pick<SpanDetailState, "events">) {
  if (events.length === 0) return null;
  return (
    <SpanDisclosure title="Events">
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
    </SpanDisclosure>
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
                { name: "Trace", value: link.trace_id, identity: true },
                { name: "Span", value: link.span_id, identity: true },
              ]}
            />
          </li>
        ))}
      </ul>
    </Section>
  );
}

function TextEntry({ text }: { readonly text: SpanText }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="text-sm text-muted-foreground">{text.name}</span>
      <Loaded state={text.state}>{(content) => <TextBlock>{content}</TextBlock>}</Loaded>
    </div>
  );
}

function TextsDisclosure({ texts }: Pick<SpanDetailState, "texts">) {
  if (texts.length === 0) return null;
  return (
    <SpanDisclosure title="Texts">
      {texts.map((text) => (
        <TextEntry key={text.name} text={text} />
      ))}
    </SpanDisclosure>
  );
}

function BlockSection({ block }: { readonly block: SpanBlock<SpanText> }) {
  return (
    <Section title={block.title}>
      {block.items.map((item) =>
        item.kind === "text" ? (
          <TextEntry key={item.text.name} text={item.text} />
        ) : (
          <NameValueList key={item.facts[0]?.name} items={item.facts} />
        ),
      )}
    </Section>
  );
}

function WhySection({ lines }: { readonly lines: readonly string[] }) {
  if (lines.length === 0) return null;
  return (
    <Section title="Why this span">
      {lines.map((line) => (
        <p key={line} className="min-w-0 text-sm break-words">
          {line}
        </p>
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
      {reply.error !== null && (
        <Alert variant="destructive">
          <AlertDescription className="min-w-0">
            <p className="min-w-0 break-words whitespace-pre-wrap">{reply.error}</p>
          </AlertDescription>
        </Alert>
      )}
      {reply.error === null && reply.text !== "" && <MarkdownText text={reply.text} />}
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
      {reply.thinking.length > 0 && (
        <SpanDisclosure title="Show thinking">
          {reply.thinking.map((thought, index) => (
            <TextBlock key={`${index}-${thought}`}>{thought}</TextBlock>
          ))}
        </SpanDisclosure>
      )}
    </div>
  );
}

function replyTitleOf(state: Loadable<ModelReply>): string {
  return state.status === "ready" && state.value.error !== null ? "Provider error" : "Model reply";
}

function ToolSpanButton({
  span,
  onSelect,
}: {
  readonly span: TraceSpan;
  readonly onSelect: (spanId: string) => void;
}) {
  return (
    <TouchTarget>
      <Button variant="outline" size="sm" onClick={() => onSelect(span.span_id)}>
        Open tool span
      </Button>
    </TouchTarget>
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
  const selection = useTraceSelection();
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <WhySection lines={detail.why} />
      {detail.modelReply !== null && (
        <Section title={replyTitleOf(detail.modelReply)}>
          <Loaded state={detail.modelReply}>
            {(reply) => <ReplyBody reply={reply} onSelect={onSelect} />}
          </Loaded>
        </Section>
      )}
      {detail.toolResult !== null && (
        <Section title="Result">
          <Loaded state={detail.toolResult}>{(result) => <ResultBody result={result} />}</Loaded>
        </Section>
      )}
      {detail.toolArguments !== null && (
        <Section title="Arguments">
          <Loaded state={detail.toolArguments}>{(json) => <TextBlock>{json}</TextBlock>}</Loaded>
        </Section>
      )}
      {detail.blocks.map((block) => (
        <BlockSection key={block.title} block={block} />
      ))}
      {detail.tokenRows.length > 0 && (
        <Section title="Input tokens per turn">
          <TurnTokensChart rows={detail.tokenRows} />
        </Section>
      )}
      <Section title="Facts">
        <NameValueList items={detail.facts} />
      </Section>
      <LinksSection links={detail.links} />
      {detail.attributes.length > 0 && (
        <SpanDisclosure title="All attributes">
          <NameValueList items={detail.attributes} />
        </SpanDisclosure>
      )}
      <EventsDisclosure events={detail.events} />
      <TextsDisclosure texts={detail.texts} />
      <SpanFooter
        errors={detail.errors}
        conversationLink={detail.conversationLink}
        onSelect={onSelect}
        onOpenConversation={(link) => selection.openInConversation(link.sessionId, link.entryId)}
      />
    </div>
  );
}
