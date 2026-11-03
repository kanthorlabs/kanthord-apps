import { TouchTarget } from "@/components/touch-target";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

import { type PromptSource, useResolvedPrompt } from "../use-resolved-prompt";

const UNRESOLVED_TEXT =
  "A part of this system prompt does not resolve. The prompt block of the Summary tab states each part.";

export function PinnedPromptText({ source }: { readonly source: PromptSource }) {
  const prompt = useResolvedPrompt(source);
  if (prompt.loading)
    return <Skeleton role="status" aria-label="Loading system prompt" className="h-16 w-full" />;
  if (prompt.error !== null)
    return (
      <Alert variant="destructive" className="flex flex-wrap items-center gap-2">
        <AlertDescription>{prompt.error.message}</AlertDescription>
        <TouchTarget>
          <Button variant="outline" size="sm" onClick={prompt.retry}>
            Retry
          </Button>
        </TouchTarget>
      </Alert>
    );
  if (prompt.final === null)
    return <p className="text-sm text-muted-foreground">{UNRESOLVED_TEXT}</p>;
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="text-sm text-muted-foreground">
        {prompt.final.length} {prompt.final.length === 1 ? "character" : "characters"}
      </span>
      <pre className="min-w-0 rounded-md bg-muted p-2 text-xs break-words whitespace-pre-wrap">
        {prompt.final}
      </pre>
    </div>
  );
}
