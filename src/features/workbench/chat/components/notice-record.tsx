import { Link } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemFooter,
  ItemGroup,
  ItemHeader,
  ItemTitle,
} from "@/components/ui/item";
import type { WorkbenchNoticeProject, WorkbenchNoticeRecord } from "@/api/types";
import { utcDateTime } from "@/lib/format";
import { noticeHeader } from "@/lib/workbench-notice";

function NoticeBlock({ project }: { readonly project: WorkbenchNoticeProject }) {
  const header = noticeHeader(project);
  return (
    <Item
      variant="outline"
      className="min-w-0 flex-col items-stretch"
      role="group"
      aria-label={header}
    >
      <ItemHeader>
        <ItemTitle className="min-w-0 break-words">{header}</ItemTitle>
      </ItemHeader>
      <ItemGroup aria-label={`Nodes of ${project.name}`} className="min-w-0 gap-2">
        {project.nodes.map((node) => (
          <Item key={node.node_id} role="listitem" size="sm" className="min-w-0 px-0">
            <ItemContent className="min-w-0">
              <ItemTitle className="min-w-0 break-words">{node.name}</ItemTitle>
              <ItemDescription>{utcDateTime(node.ended_at)}</ItemDescription>
            </ItemContent>
            <ItemActions>
              <Badge variant="outline">{node.state}</Badge>
            </ItemActions>
          </Item>
        ))}
      </ItemGroup>
      {project.project_id !== undefined && (
        <ItemFooter>
          <Link
            to={`/projects/${encodeURIComponent(project.project_id)}`}
            className="text-sm underline"
          >
            Open project
          </Link>
        </ItemFooter>
      )}
    </Item>
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
