import { useCallback, useEffect, useRef, useState } from "react";

import {
  detailKeyOf,
  refreshedDetailOf,
  type AttentionDetails,
  type DetailTarget,
} from "@/lib/attention";

import { readAttentionDetail } from "./read-attention-detail";

export interface AttentionDetailReads {
  readonly details: AttentionDetails;
  readonly refresh: (nodeId: string) => void;
}

const NO_DETAILS: AttentionDetails = new Map();

export function useAttentionDetails(
  targets: readonly DetailTarget[],
  cycleAt: number | null,
): AttentionDetailReads {
  const [details, setDetails] = useState<AttentionDetails>(NO_DETAILS);
  const reading = useRef(new Map<string, string>());
  const targetsRef = useRef(targets);
  const live = useRef(false);

  useEffect(() => {
    targetsRef.current = targets;
  });

  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
    };
  }, []);

  const read = useCallback((target: DetailTarget) => {
    const nodeId = target.node.id;
    const key = detailKeyOf(target.node);
    if (reading.current.get(nodeId) === key) return;
    reading.current.set(nodeId, key);
    readAttentionDetail(target).then((detail) => {
      if (reading.current.get(nodeId) !== key) return;
      reading.current.delete(nodeId);
      if (live.current) {
        setDetails((current) =>
          new Map(current).set(nodeId, refreshedDetailOf(current.get(nodeId), detail)),
        );
      }
    });
  }, []);

  useEffect(() => {
    for (const target of targets) {
      if (details.get(target.node.id)?.key !== detailKeyOf(target.node)) read(target);
    }
  }, [targets, details, read]);

  useEffect(() => {
    for (const target of targetsRef.current) if (target.kind === "external") read(target);
  }, [cycleAt, read]);

  const refresh = useCallback(
    (nodeId: string) => {
      const target = targetsRef.current.find((candidate) => candidate.node.id === nodeId);
      if (target !== undefined) read(target);
    },
    [read],
  );

  return { details, refresh };
}
