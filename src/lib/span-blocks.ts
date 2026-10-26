import type { TraceSpan } from "@/api/types";

import { attributeText, type NamedValue } from "./span-detail";
import { revocationLabel } from "./span-labels";

export type BlockItem<T> =
  | { readonly kind: "facts"; readonly facts: readonly NamedValue[] }
  | { readonly kind: "text"; readonly text: T };

export interface SpanBlock<T> {
  readonly title: string;
  readonly items: readonly BlockItem<T>[];
}

type Part =
  | { readonly kind: "attribute"; readonly name: string }
  | { readonly kind: "prefix"; readonly prefix: string }
  | { readonly kind: "text"; readonly name: string };

interface BlockLayout {
  readonly title: string;
  readonly parts: readonly Part[];
}

const ATTRIBUTE_EXECUTION_END = "kanthord.execution.end";
const REVOCATION_SEPARATOR = " - ";
const AFFECTED_PREFIX = "kanthord.affected.";

const attribute = (name: string): Part => ({ kind: "attribute", name });
const prefix = (value: string): Part => ({ kind: "prefix", prefix: value });
const text = (name: string): Part => ({ kind: "text", name });

const GIT_LAYOUT: readonly BlockLayout[] = [
  {
    title: "Failure",
    parts: [text("error"), attribute("kanthord.gate.violation")],
  },
  {
    title: "Step",
    parts: [
      attribute("kanthord.git.step"),
      attribute("kanthord.gate.mode"),
      attribute("kanthord.gate.changed"),
    ],
  },
];

const LAYOUTS: Readonly<Record<string, readonly BlockLayout[]>> = {
  "worker.verification": [
    {
      title: "Result",
      parts: [
        text("output"),
        attribute("process.exit.code"),
        attribute("kanthord.verification.timed_out"),
        attribute("kanthord.verification.kind"),
      ],
    },
    {
      title: "Affected tests",
      parts: [
        attribute(`${AFFECTED_PREFIX}verdict`),
        attribute(`${AFFECTED_PREFIX}selection`),
        attribute(`${AFFECTED_PREFIX}reason`),
        attribute(`${AFFECTED_PREFIX}changed_count`),
        attribute(`${AFFECTED_PREFIX}test_count`),
        attribute(`${AFFECTED_PREFIX}failed_count`),
        attribute(`${AFFECTED_PREFIX}flaky_count`),
        attribute(`${AFFECTED_PREFIX}excluded_e2e_count`),
        attribute(`${AFFECTED_PREFIX}failed`),
      ],
    },
    { title: "Command", parts: [text("command")] },
  ],
  "worker.git": GIT_LAYOUT,
  "worker.gate": GIT_LAYOUT,
  "worker.task": [
    { title: "Stop", parts: [prefix("kanthord.stop.")] },
    { title: "Task", parts: [attribute("kanthord.task.revision_count")] },
  ],
  "worker.evaluation": [
    {
      title: "Evaluation",
      parts: [
        attribute("kanthord.evaluation.result"),
        attribute("kanthord.evaluation.stage"),
        attribute("kanthord.evaluation.affected"),
        attribute("kanthord.evaluation.unmet_grounds"),
        text("rationale"),
      ],
    },
  ],
  "worker.release_gate": [
    {
      title: "Release gate",
      parts: [
        attribute("kanthord.release_gate.result"),
        attribute("kanthord.release_gate.unit_id"),
        attribute("kanthord.release_gate.affected"),
      ],
    },
  ],
  "scheduler.execution": [
    {
      title: "Cause and stop",
      parts: [
        prefix("kanthord.cause."),
        attribute("kanthord.stop.reason"),
        attribute("kanthord.stop.code"),
        attribute("kanthord.stop.detail"),
        attribute(ATTRIBUTE_EXECUTION_END),
      ],
    },
    { title: "Queue", parts: [attribute("kanthord.queue.wait_ms")] },
  ],
};

function factOf(span: TraceSpan, name: string): readonly NamedValue[] {
  const value = span.attributes[name];
  if (value === undefined) return [];
  const shown = attributeText(value);
  const revoked = name === ATTRIBUTE_EXECUTION_END ? revocationLabel(span) : null;
  return [{ name, value: revoked === null ? shown : `${shown}${REVOCATION_SEPARATOR}${revoked}` }];
}

function itemsOf<T extends { readonly name: string }>(
  span: TraceSpan,
  part: Part,
  texts: readonly T[],
): readonly BlockItem<T>[] {
  switch (part.kind) {
    case "text": {
      const found = texts.find((candidate) => candidate.name === part.name);
      return found === undefined ? [] : [{ kind: "text", text: found }];
    }
    case "prefix": {
      const names = Object.keys(span.attributes).filter((name) => name.startsWith(part.prefix));
      return names.map((name) => ({ kind: "facts", facts: factOf(span, name) }));
    }
    default:
      return [{ kind: "facts", facts: factOf(span, part.name) }];
  }
}

function merged<T>(items: readonly BlockItem<T>[]): readonly BlockItem<T>[] {
  const result: BlockItem<T>[] = [];
  for (const item of items) {
    const last = result[result.length - 1];
    if (item.kind === "facts" && item.facts.length === 0) continue;
    if (item.kind === "facts" && last?.kind === "facts") {
      result[result.length - 1] = { kind: "facts", facts: [...last.facts, ...item.facts] };
    } else {
      result.push(item);
    }
  }
  return result;
}

export function spanBlocks<T extends { readonly name: string }>(
  span: TraceSpan,
  texts: readonly T[],
): readonly SpanBlock<T>[] {
  const layouts = Object.hasOwn(LAYOUTS, span.operation) ? LAYOUTS[span.operation] : undefined;
  return (layouts ?? [])
    .map((layout) => ({
      title: layout.title,
      items: merged(layout.parts.flatMap((part) => itemsOf(span, part, texts))),
    }))
    .filter((block) => block.items.length > 0);
}
