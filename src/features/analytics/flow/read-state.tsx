import type { ReactNode } from "react";

import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

import type { FlowReadView } from "./use-flow";

interface ReadStateProps {
  readonly view: Pick<FlowReadView, "read" | "error" | "refresh">;
  readonly skeleton: ReactNode;
  readonly children: ReactNode;
}

export function ReadState({ view, skeleton, children }: ReadStateProps) {
  if (view.read !== null) return children;
  if (view.error === null) return skeleton;
  return (
    <Alert variant="destructive">
      <AlertTitle>The flow could not be read.</AlertTitle>
      <AlertDescription>{view.error.message}</AlertDescription>
      <AlertAction>
        <Button variant="outline" size="sm" onClick={view.refresh}>
          Retry
        </Button>
      </AlertAction>
    </Alert>
  );
}
