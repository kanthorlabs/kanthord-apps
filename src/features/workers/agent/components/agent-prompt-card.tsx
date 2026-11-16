import type { PromptPart } from "@/api/types";
import { PromptItem } from "@/components/prompt-item";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { promptLayerLabel, promptPartOrigin, promptPartPathNote } from "@/lib/prompt-part";

const DEFAULT_TITLE = "KanthorD prompt (layer 1)";
const DEFAULT_LIST_LABEL = "KanthorD prompt";
const DEFAULT_DESCRIPTION =
  "Read-only. The server reads these files for every agent. Then it joins the Repository prompt and the Binding prompt of each repository, and closes with the framing. Change a file in the agent directory on the server host.";

interface AgentPromptCardProps {
  readonly parts: readonly PromptPart[];
  readonly title?: string;
  readonly listLabel?: string;
  readonly description?: string;
  readonly pathNote?: boolean;
}

function PartFacts({ part, pathNote }: { readonly part: PromptPart; readonly pathNote: boolean }) {
  const note = pathNote ? promptPartPathNote(part) : null;
  return (
    <>
      <Badge variant={part.origin === "file" ? "default" : "secondary"}>
        {promptPartOrigin(part)}
      </Badge>
      {note !== null && (
        <span>
          {note.lead} <span className="font-mono break-all">{note.path}</span>.
        </span>
      )}
      {part.digest !== null && (
        <span>
          Digest <span className="font-mono break-all">{part.digest}</span>
        </span>
      )}
    </>
  );
}

export function AgentPromptCard({
  parts,
  title = DEFAULT_TITLE,
  listLabel = DEFAULT_LIST_LABEL,
  description = DEFAULT_DESCRIPTION,
  pathNote = true,
}: AgentPromptCardProps) {
  return (
    <Card>
      <CardHeader>
        <h2 className="font-semibold leading-none">{title}</h2>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div role="list" aria-label={listLabel} className="grid grid-cols-[minmax(0,1fr)] gap-2">
          {parts.map((part) => (
            <PromptItem
              key={`${part.part}:${part.name}`}
              title={part.name}
              path
              text={part.text}
              dimmed={part.state !== "resolved"}
              badges={<Badge variant="outline">{promptLayerLabel(part.layer)}</Badge>}
              facts={<PartFacts part={part} pathNote={pathNote} />}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
