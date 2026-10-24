import type { PromptPart } from "@/api/types";
import { PromptItem } from "@/components/prompt-item";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { promptPartOrigin } from "@/lib/prompt-part";

interface AgentPromptCardProps {
  readonly parts: readonly PromptPart[];
}

function PartFacts({ part }: { readonly part: PromptPart }) {
  return (
    <>
      <Badge
        variant={part.origin === "file" ? "default" : "secondary"}
        className="h-auto max-w-full text-left break-all whitespace-normal"
      >
        {promptPartOrigin(part)}
      </Badge>
      <span>
        Digest <span className="font-mono break-all">{part.digest}</span>
      </span>
    </>
  );
}

export function AgentPromptCard({ parts }: AgentPromptCardProps) {
  return (
    <Card>
      <CardHeader>
        <h2 className="font-semibold leading-none">Agent prompt</h2>
        <CardDescription>
          Read-only. The server reads these files, then joins the Binding prompts of a repository.
          Change a file in the agent directory on the server host.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div role="list" aria-label="Agent prompt" className="grid grid-cols-[minmax(0,1fr)] gap-2">
          {parts.map((part) => (
            <PromptItem
              key={`${part.part}:${part.name}`}
              title={part.name}
              path
              text={part.text}
              badges={<Badge variant="outline">{part.part}</Badge>}
              facts={<PartFacts part={part} />}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
