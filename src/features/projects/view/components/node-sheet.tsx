import { useState } from "react";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useIsMobile } from "@/hooks/use-mobile";
import type { GraphModel } from "@/lib/mission-graph";
import { NodeAttemptsTab } from "./node-attempts-tab";
import { NodeDetailsTab } from "./node-details-tab";
import { NodeRevisionsTab } from "./node-revisions-tab";

type NodeSheetTab = "details" | "attempts" | "revisions";

interface NodeSheetProps {
  readonly projectId: string;
  readonly model: GraphModel;
  readonly selectedId: string | null;
  readonly onSelect: (nodeId: string | null) => void;
}

export function NodeSheet({ projectId, model, selectedId, onSelect }: NodeSheetProps) {
  const mobile = useIsMobile();
  const [tab, setTab] = useState<NodeSheetTab>("details");
  const node = selectedId === null ? undefined : model.nodeById.get(selectedId);
  const attemptOwner = node?.kind === "task" ? node.parent_id : (node?.id ?? null);
  const owner = attemptOwner === null ? undefined : model.nodeById.get(attemptOwner);

  return (
    <Sheet open={selectedId !== null} onOpenChange={(open) => !open && onSelect(null)}>
      <SheetContent
        side={mobile ? "bottom" : "right"}
        className="data-[side=bottom]:max-h-[85svh] data-[side=right]:w-full data-[side=right]:sm:max-w-xl"
      >
        <SheetHeader>
          <SheetTitle className="mr-8 break-words">
            {node?.content.name ?? "Node not found"}
          </SheetTitle>
          <SheetDescription className="break-all">
            {node === undefined
              ? `The mission graph holds no node ${selectedId ?? ""}.`
              : `${node.kind} · ${node.filename}`}
          </SheetDescription>
        </SheetHeader>
        {node !== undefined && (
          <Tabs
            value={tab}
            onValueChange={(value) => setTab(value as NodeSheetTab)}
            className="flex min-h-0 flex-1 flex-col gap-3 px-4 pb-4"
          >
            <TabsList>
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="attempts">Attempts</TabsTrigger>
              <TabsTrigger value="revisions">Revisions</TabsTrigger>
            </TabsList>
            <div className="min-h-0 flex-1 overflow-y-auto">
              <TabsContent value="details">
                <NodeDetailsTab
                  projectId={projectId}
                  model={model}
                  nodeId={node.id}
                  onSelect={onSelect}
                />
              </TabsContent>
              <TabsContent value="attempts" className="flex flex-col gap-3">
                {node.kind === "task" && owner !== undefined && (
                  <p className="text-sm">
                    A task holds no attempt. The attempts below belong to its objective{" "}
                    {owner.content.name}.
                  </p>
                )}
                {owner !== undefined && (
                  <NodeAttemptsTab
                    projectId={projectId}
                    model={model}
                    nodeId={owner.id}
                    currentRevision={owner.visible_revision}
                  />
                )}
              </TabsContent>
              <TabsContent value="revisions">
                <NodeRevisionsTab nodeId={node.id} currentRevision={node.visible_revision} />
              </TabsContent>
            </div>
          </Tabs>
        )}
      </SheetContent>
    </Sheet>
  );
}
