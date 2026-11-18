import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import type { HomeNotice } from "@/lib/home-notice";
import { workbenchSessionPath } from "@/lib/workbench-sessions";

interface NoticeLineProps {
  readonly notice: HomeNotice;
}

export function NoticeLine({ notice }: NoticeLineProps) {
  return (
    <p className="flex min-w-0 flex-wrap items-center justify-between gap-2 rounded-md border border-l-[3px] border-l-notice px-2.5 py-2 text-sm">
      <span className="min-w-0 break-words font-semibold text-foreground">{notice.text}</span>{" "}
      <Button
        nativeButton={false}
        variant="outline"
        size="sm"
        render={<Link to={workbenchSessionPath(notice.sessionId)} />}
      >
        Open chat
      </Button>
    </p>
  );
}
