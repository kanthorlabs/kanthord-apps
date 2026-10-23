import { ChevronRightIcon } from "lucide-react";
import { Link } from "react-router-dom";

import { RecordName } from "@/components/record-name";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  environmentStatusLabel,
  environmentStatusVariant,
  stepElapsedOf,
  stepLineOf,
  stepProgressOf,
} from "@/lib/environment-bar";
import type { EnvironmentBar as EnvironmentBarState } from "../use-environment-bar";
import { projectTabPath } from "../use-project-tab";

interface EnvironmentBarProps {
  readonly projectId: string;
  readonly bar: EnvironmentBarState;
  readonly now: number;
}

export function EnvironmentBar({ projectId, bar, now }: EnvironmentBarProps) {
  const isMobile = useIsMobile();
  const { state, more, ready } = bar;
  const status = ready ? "ready" : state.status;
  const progress = stepProgressOf(state);
  const elapsed = stepElapsedOf(state, now);
  const path = `${projectTabPath(projectId, "bindings")}&environment=${encodeURIComponent(state.binding_name)}`;

  return (
    <div className="sticky top-[var(--app-header-height,3.5rem)] z-10">
      <Alert
        aria-label="Environment"
        variant={state.status === "failed" ? "destructive" : "default"}
        className="flex items-center gap-2"
      >
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div aria-live="polite" className="flex min-w-0 items-center gap-2">
            <Badge variant={environmentStatusVariant(status)}>
              {environmentStatusLabel(status)}
            </Badge>
            <span className="min-w-0 truncate">
              <RecordName>{state.binding_name}</RecordName> · {stepLineOf(state)}
              {elapsed !== null && <span className="hidden md:inline"> · {elapsed}</span>}
            </span>
            {more > 0 && <span className="shrink-0 text-xs">and {more} more</span>}
          </div>
          {progress !== null && (
            <Progress
              value={(progress.step / progress.of) * 100}
              aria-label={`Environment step ${progress.step} of ${progress.of}`}
            />
          )}
        </div>
        {isMobile ? (
          <Button
            nativeButton={false}
            render={<Link to={path} />}
            variant="outline"
            size="icon"
            aria-label="Details"
          >
            <ChevronRightIcon aria-hidden="true" />
          </Button>
        ) : (
          <Button nativeButton={false} render={<Link to={path} />} variant="outline" size="sm">
            Details
          </Button>
        )}
      </Alert>
    </div>
  );
}
