import { TouchTarget } from "@/components/touch-target";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { DiffLine } from "@/lib/line-diff";

import type { AgentPromptPart } from "../use-agent-prompt";
import { usePromptDiff } from "../use-prompt-diff";

const PREFIXES = { same: "  ", added: "+ ", removed: "- " } as const;

function Line({ line }: { readonly line: DiffLine }) {
  const text = `${PREFIXES[line.change]}${line.text}`;
  if (line.change === "added") return <ins className="block no-underline">{text}</ins>;
  if (line.change === "removed")
    return <del className="block text-destructive no-underline">{text}</del>;
  return <span className="block text-muted-foreground">{text}</span>;
}

interface PromptPartDiffProps {
  readonly executionId: string;
  readonly agentName: string;
  readonly part: AgentPromptPart;
}

export function PromptPartDiff({ executionId, agentName, part }: PromptPartDiffProps) {
  const diff = usePromptDiff(executionId, agentName, part);
  if (diff.loading)
    return <Skeleton role="status" aria-label="Loading diff" className="h-16 w-full" />;
  if (diff.error !== null)
    return (
      <Alert variant="destructive" className="flex flex-wrap items-center gap-2">
        <AlertDescription>{diff.error.message}</AlertDescription>
        <TouchTarget>
          <Button variant="outline" size="sm" onClick={diff.retry}>
            Retry
          </Button>
        </TouchTarget>
      </Alert>
    );
  return (
    <div className="flex min-w-0 flex-col gap-2">
      {diff.note !== null && <p className="text-sm text-muted-foreground">{diff.note}</p>}
      {diff.lines !== null && (
        <pre
          aria-label={`Diff of ${part.part} ${part.name}`}
          className="min-w-0 rounded-md bg-muted p-2 text-xs break-words whitespace-pre-wrap"
        >
          {diff.lines.map((line, index) => (
            <Line key={index} line={line} />
          ))}
        </pre>
      )}
    </div>
  );
}
