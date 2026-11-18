import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import type { HomeNotice } from "@/lib/home-notice";
import { workbenchSessionPath } from "@/lib/workbench-sessions";

interface NoticeLineProps {
  readonly notice: HomeNotice;
}

export function NoticeLine({ notice }: NoticeLineProps) {
  return (
    <p className="flex min-w-0 flex-wrap items-center gap-1 text-sm text-muted-foreground">
      <span className="min-w-0 break-words">{notice.text}</span>{" "}
      <Button
        nativeButton={false}
        variant="link"
        size="sm"
        render={<Link to={workbenchSessionPath(notice.sessionId)} />}
      >
        Open chat
      </Button>
    </p>
  );
}
