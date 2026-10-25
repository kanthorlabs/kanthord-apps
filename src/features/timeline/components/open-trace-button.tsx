import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";

interface OpenTraceButtonProps {
  readonly traceId: string;
}

export function OpenTraceButton({ traceId }: OpenTraceButtonProps) {
  return (
    <Button
      nativeButton={false}
      render={<Link to={`/traces/${encodeURIComponent(traceId)}`} />}
      variant="outline"
      size="sm"
    >
      Open trace
    </Button>
  );
}
