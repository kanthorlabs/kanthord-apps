import { CheckIcon, ChevronRightIcon, CopyIcon } from "lucide-react";
import type { ReactNode } from "react";

import { MarkdownText } from "@/components/markdown-text";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "cn";
import { useCopyText } from "../use-copy-text";

interface PromptItemProps {
  readonly title: string;
  readonly path?: boolean;
  readonly text: string | null;
  readonly badges?: ReactNode;
}

function CopyMarkdownButton({ title, text }: { readonly title: string; readonly text: string }) {
  const { copied, copy } = useCopyText(text, title);
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Copy markdown of ${title}`}
            onClick={copy}
          />
        }
      >
        {copied ? <CheckIcon aria-hidden="true" /> : <CopyIcon aria-hidden="true" />}
      </TooltipTrigger>
      <TooltipContent>{copied ? "Copied" : "Copy markdown"}</TooltipContent>
    </Tooltip>
  );
}

export function PromptItem({ title, path = false, text, badges }: PromptItemProps) {
  const titleClass = cn("min-w-0 flex-1 truncate text-sm", path && "font-mono");
  if (text === null) {
    return (
      <div
        role="listitem"
        className="flex min-h-10 items-center gap-2 rounded-md border border-dashed px-3 py-2 text-muted-foreground"
      >
        <span aria-hidden="true" className="size-4 shrink-0" />
        <span className={titleClass}>{title}</span>
        {badges}
      </div>
    );
  }
  return (
    <Collapsible role="listitem" className="min-w-0 rounded-md border">
      <div className="flex min-h-10 items-center gap-2 pr-2">
        <CollapsibleTrigger
          className="group flex min-w-0 flex-1 items-center gap-2 rounded-md py-2 pl-3 text-left outline-none hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={title}
        >
          <ChevronRightIcon
            aria-hidden="true"
            className="size-4 shrink-0 text-muted-foreground transition-transform group-data-[panel-open]:rotate-90"
          />
          <span className={titleClass}>{title}</span>
          {badges}
        </CollapsibleTrigger>
        <CopyMarkdownButton title={title} text={text} />
      </div>
      <CollapsibleContent>
        <div className="max-h-[32rem] overflow-y-auto border-t px-4 py-3">
          <MarkdownText text={text} />
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
