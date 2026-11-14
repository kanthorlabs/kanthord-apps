import { useCallback, useEffect, useRef } from "react";

import { BoardRotateSheet } from "@/features/home/components/board-rotate-sheet";
import { type RotatedCopies, useNamedRotate } from "@/features/home/use-board-rotate";
import { ACT_DONE } from "@/hooks/act-result";
import { revisionChangeLineOf } from "@/lib/workbench-action";
import { useActLine } from "../use-act-line";
import { useDialogClosed } from "../use-dialog-closed";
import type { ActionActProps } from "./action-act-props";
import { StatusLine } from "./status-line";

const NOTHING = () => undefined;

export function CredentialAct({ offer, onSettled, onLine, onDialogClosed }: ActionActProps) {
  const onActed = useCallback(
    (rotated: RotatedCopies) => {
      if (rotated.server) onSettled(ACT_DONE);
    },
    [onSettled],
  );
  const rotate = useNamedRotate(offer.target_id, {
    reload: NOTHING,
    onActed,
    onOpenChange: NOTHING,
  });
  const available = !rotate.loading && rotate.missing === null;
  const line = available ? revisionChangeLineOf(offer, rotate.revision) : null;
  const ready = available && line === null;
  const started = useRef(false);
  useActLine(line, onLine);
  useDialogClosed(rotate.open, onDialogClosed);

  useEffect(() => {
    if (!ready || started.current) return;
    started.current = true;
    rotate.start();
  });

  if (rotate.loading) return <StatusLine text={`Reading ${offer.target_id}.`} />;
  if (rotate.missing !== null) {
    return (
      <StatusLine text={`Not available: ${offer.target_id} cannot rotate in the dashboard.`} />
    );
  }
  if (!ready) return null;
  return <BoardRotateSheet rotate={rotate} />;
}
