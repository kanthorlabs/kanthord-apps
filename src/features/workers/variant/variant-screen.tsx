import { useCallback } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import type { AgentVariant, PromptPart } from "@/api/types";
import { useCrumbLabel } from "@/components/crumb-labels";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { NEXT_SESSION_NOTICE, variantMissing } from "@/lib/agent-variant";
import { AgentPromptCard } from "../agent/components/agent-prompt-card";
import { useVariant } from "./use-variant";
import { useVariantDelete } from "./use-variant-delete";
import { useVariantUpdate } from "./use-variant-update";
import { VariantDeleteDialog } from "./variant-delete-dialog";
import { VariantEditSheet } from "./variant-edit-sheet";

const PROMPT_DESCRIPTION =
  "Read-only. The parts join in this order. The variant part is the instruction of this variant.";

interface VariantViewProps {
  readonly variant: AgentVariant;
  readonly parts: readonly PromptPart[];
  readonly reload: () => void;
}

function VariantView({ variant, parts, reload }: VariantViewProps) {
  const navigate = useNavigate();
  const edit = useVariantUpdate(variant, reload);
  const goToAgents = useCallback(() => navigate("/agents"), [navigate]);
  const remove = useVariantDelete(variant.id, variant.revision, goToAgents);

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-1">
          <h2 className="text-lg font-semibold break-words">
            {variant.display_name} (v{variant.revision})
          </h2>
          <p className="text-sm text-muted-foreground">
            Variant of{" "}
            <Link
              to={`/agents/${encodeURIComponent(variant.agent_name)}`}
              className="font-mono underline-offset-4 hover:underline"
            >
              {variant.agent_name}
            </Link>
          </p>
        </div>
        <div className="flex flex-wrap justify-start gap-2 md:justify-end">
          <Button variant="outline" size="sm" onClick={edit.start}>
            Edit
          </Button>
          <Button variant="outline" size="sm" onClick={remove.request}>
            Delete
          </Button>
        </div>
      </div>
      {edit.saved && (
        <p role="status" className="text-sm text-muted-foreground">
          {NEXT_SESSION_NOTICE}
        </p>
      )}
      <Card>
        <CardHeader>
          <h2 className="font-semibold leading-none">Instruction</h2>
        </CardHeader>
        <CardContent>
          <p className="break-words whitespace-pre-wrap text-sm">{variant.instruction}</p>
        </CardContent>
      </Card>
      <AgentPromptCard
        parts={parts}
        title="Prompt parts"
        listLabel="Prompt parts"
        description={PROMPT_DESCRIPTION}
      />
      <VariantEditSheet edit={edit} />
      <VariantDeleteDialog name={variant.display_name} remove={remove} />
    </div>
  );
}

export function VariantScreen() {
  const { agentName = "", variantId = "" } = useParams<{
    agentName: string;
    variantId: string;
  }>();
  const { data, error, loading, reload } = useVariant(agentName, variantId);
  useCrumbLabel(
    `/agents/${encodeURIComponent(agentName)}/variants/${encodeURIComponent(variantId)}`,
    data?.variant.display_name,
  );

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (error !== null && variantMissing(error)) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>Variant not found.</EmptyTitle>
          <EmptyDescription>
            The variant does not exist or belongs to another agent.
          </EmptyDescription>
        </EmptyHeader>
        <Button variant="outline" size="sm" nativeButton={false} render={<Link to="/agents" />}>
          Back to agents
        </Button>
      </Empty>
    );
  }

  if (error !== null || data === null) {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-sm text-destructive">{error === null ? "" : error.message}</p>
        <Button variant="outline" size="sm" onClick={reload}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <VariantView
      variant={data.variant}
      parts={data.declaration.prompt.parts ?? []}
      reload={reload}
    />
  );
}
