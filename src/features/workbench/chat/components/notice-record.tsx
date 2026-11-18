import { Link } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import type { WorkbenchNoticeProject, WorkbenchNoticeRecord } from "@/api/types";
import { utcDateTime } from "@/lib/format";
import { noticeHeader } from "@/lib/workbench-notice";

function NoticeBlock({ project }: { readonly project: WorkbenchNoticeProject }) {
  const header = noticeHeader(project);
  return (
    <div
      className="grid min-w-0 max-w-full gap-1 rounded-md border border-notice bg-notice-soft px-3 py-2.5 text-sm"
      role="group"
      aria-label={header}
    >
      <p className="min-w-0 break-words font-bold">{header}</p>
      <div role="list" aria-label={`Nodes of ${project.name}`} className="grid min-w-0 gap-1">
        {project.nodes.map((node) => (
          <div
            key={node.node_id}
            role="listitem"
            className="flex min-w-0 flex-wrap items-center gap-2"
          >
            <span className="min-w-0 break-words">{node.name}</span>
            <Badge
              variant={node.state === "Completed" ? "default" : "outline"}
              className={
                node.state === "Completed"
                  ? "border-0 bg-notice-soft text-notice"
                  : "text-muted-foreground"
              }
            >
              {node.state}
            </Badge>
            <span className="text-muted-foreground">{utcDateTime(node.ended_at)}</span>
          </div>
        ))}
      </div>
      {project.project_id !== undefined && (
        <Link
          to={`/projects/${encodeURIComponent(project.project_id)}`}
          className="w-fit text-sm underline"
        >
          Open project
        </Link>
      )}
    </div>
  );
}

export function NoticeRecord({ notice }: { readonly notice: WorkbenchNoticeRecord }) {
  return (
    <div className="flex min-w-0 flex-col gap-3">
      {notice.projects.map((project, index) => (
        <NoticeBlock key={project.project_id ?? `${index}:${project.name}`} project={project} />
      ))}
    </div>
  );
}
