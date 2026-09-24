import { useCallback, useState } from "react";
import { toast } from "sonner";

import { ApiError } from "@/api/errors";
import {
  block,
  discard,
  overrideSuccess,
  pause,
  resume,
  setPriority,
  unblock,
} from "@/api/resources/mission";
import type { MissionNode } from "@/api/types";

export interface Dependent {
  readonly id: string;
  readonly title: string;
}

export interface NodeActionsHook {
  terminal: boolean;
  canPause: boolean;
  isPausing: boolean;
  handlePause: () => void;
  canResume: boolean;
  isResuming: boolean;
  handleResume: () => void;
  canBlock: boolean;
  blockOpen: boolean;
  setBlockOpen: (open: boolean) => void;
  blockReason: string;
  setBlockReason: (r: string) => void;
  isBlocking: boolean;
  blockError: string | null;
  blockErrorDetail: string | null;
  handleBlock: () => void;
  canUnblock: boolean;
  unblockOpen: boolean;
  setUnblockOpen: (open: boolean) => void;
  isUnblocking: boolean;
  unblockError: string | null;
  unblockErrorDetail: string | null;
  handleUnblock: () => void;
  canOverride: boolean;
  overrideOpen: boolean;
  setOverrideOpen: (open: boolean) => void;
  overrideReason: string;
  setOverrideReason: (r: string) => void;
  overrideLandedCommitId: string;
  setOverrideLandedCommitId: (id: string) => void;
  isOverriding: boolean;
  handleOverride: () => void;
  canDiscard: boolean;
  discardOpen: boolean;
  setDiscardOpen: (open: boolean) => void;
  discardReason: string;
  setDiscardReason: (r: string) => void;
  isDiscarding: boolean;
  handleDiscard: () => void;
  canSetPriority: boolean;
  priorityValue: string;
  setPriorityValue: (v: string) => void;
  isSettingPriority: boolean;
  handleSetPriority: () => void;
  dependents: readonly Dependent[];
}

export function useNodeActions(
  projectId: string,
  node: MissionNode,
  dependents: readonly Dependent[],
  clearedAttemptId: string | undefined,
  onSuccess: (() => void) | undefined,
): NodeActionsHook {
  const { state, id: nodeId, currentRevisionId } = node;
  const nodeIsTerminal = state === "Completed" || state === "Discarded";
  const hasState = state !== null;

  const canPause = hasState && !nodeIsTerminal && state !== "Blocked" && state !== "Paused";
  const canResume = state === "Paused";
  const canBlock = state === "Paused";
  const canUnblock = state === "Blocked";
  const canOverride =
    hasState && !nodeIsTerminal && state !== "Evaluating" && state !== "External.Requested";
  const canDiscard = hasState && !nodeIsTerminal && state !== "External.Requested";
  const canSetPriority =
    hasState && !nodeIsTerminal && state !== "Executing" && state !== "Evaluating";

  const [isPausing, setIsPausing] = useState(false);
  const [isResuming, setIsResuming] = useState(false);

  const [blockOpen, _setBlockOpen] = useState(false);
  const [blockReason, setBlockReason] = useState("");
  const [isBlocking, setIsBlocking] = useState(false);
  const [blockError, setBlockError] = useState<string | null>(null);
  const [blockErrorDetail, setBlockErrorDetail] = useState<string | null>(null);

  const [unblockOpen, _setUnblockOpen] = useState(false);
  const [isUnblocking, setIsUnblocking] = useState(false);
  const [unblockError, setUnblockError] = useState<string | null>(null);
  const [unblockErrorDetail, setUnblockErrorDetail] = useState<string | null>(null);

  const [overrideOpen, _setOverrideOpen] = useState(false);
  const [overrideReason, setOverrideReason] = useState("");
  const [overrideLandedCommitId, setOverrideLandedCommitId] = useState("");
  const [isOverriding, setIsOverriding] = useState(false);

  const [discardOpen, _setDiscardOpen] = useState(false);
  const [discardReason, setDiscardReason] = useState("");
  const [isDiscarding, setIsDiscarding] = useState(false);

  const [priorityValue, setPriorityValue] = useState(String(node.priority));
  const [isSettingPriority, setIsSettingPriority] = useState(false);

  const setBlockOpen = useCallback((open: boolean) => {
    _setBlockOpen(open);
    if (!open) {
      setBlockReason("");
      setBlockError(null);
      setBlockErrorDetail(null);
    }
  }, []);

  const setUnblockOpen = useCallback((open: boolean) => {
    _setUnblockOpen(open);
    if (!open) {
      setUnblockError(null);
      setUnblockErrorDetail(null);
    }
  }, []);

  const setOverrideOpen = useCallback((open: boolean) => {
    _setOverrideOpen(open);
    if (!open) {
      setOverrideReason("");
      setOverrideLandedCommitId("");
    }
  }, []);

  const setDiscardOpen = useCallback((open: boolean) => {
    _setDiscardOpen(open);
    if (!open) {
      setDiscardReason("");
    }
  }, []);

  const handlePause = useCallback(() => {
    setIsPausing(true);
    pause(projectId, nodeId).then(
      () => {
        setIsPausing(false);
        toast.success("The node is paused.");
        onSuccess?.();
      },
      (cause: unknown) => {
        setIsPausing(false);
        const err =
          cause instanceof ApiError ? cause : new ApiError("malformed", "The request failed.", 0);
        toast.error(err.message, { description: err.detail || undefined });
      },
    );
  }, [projectId, nodeId, onSuccess]);

  const handleResume = useCallback(() => {
    setIsResuming(true);
    resume(projectId, nodeId).then(
      () => {
        setIsResuming(false);
        toast.success("The node is resumed.");
        onSuccess?.();
      },
      (cause: unknown) => {
        setIsResuming(false);
        const err =
          cause instanceof ApiError ? cause : new ApiError("malformed", "The request failed.", 0);
        toast.error(err.message, { description: err.detail || undefined });
      },
    );
  }, [projectId, nodeId, onSuccess]);

  const handleBlock = useCallback(() => {
    if (!blockReason.trim()) return;
    setIsBlocking(true);
    block(projectId, nodeId, blockReason.trim()).then(
      () => {
        setIsBlocking(false);
        _setBlockOpen(false);
        setBlockReason("");
        setBlockError(null);
        setBlockErrorDetail(null);
        toast.success("The node is blocked.");
        onSuccess?.();
      },
      (cause: unknown) => {
        setIsBlocking(false);
        const err =
          cause instanceof ApiError ? cause : new ApiError("malformed", "The request failed.", 0);
        setBlockError(err.message);
        setBlockErrorDetail(err.detail || null);
      },
    );
  }, [projectId, nodeId, blockReason, onSuccess]);

  const handleUnblock = useCallback(() => {
    if (!clearedAttemptId) return;
    setIsUnblocking(true);
    const requestIdentifier = crypto.randomUUID();
    unblock(projectId, nodeId, {
      clearedAttemptId,
      expectedRevisionId: currentRevisionId,
      requestIdentifier,
    }).then(
      () => {
        setIsUnblocking(false);
        _setUnblockOpen(false);
        setUnblockError(null);
        setUnblockErrorDetail(null);
        toast.success("The node is unblocked. A new attempt is opening.");
        onSuccess?.();
      },
      (cause: unknown) => {
        setIsUnblocking(false);
        if (cause instanceof ApiError && cause.code === "conflict") {
          setUnblockError(
            "Your view is stale. Reload the page to see the current state before you unblock.",
          );
          setUnblockErrorDetail(null);
        } else {
          const err =
            cause instanceof ApiError ? cause : new ApiError("malformed", "The request failed.", 0);
          setUnblockError(err.message);
          setUnblockErrorDetail(err.detail || null);
        }
      },
    );
  }, [projectId, nodeId, clearedAttemptId, currentRevisionId, onSuccess]);

  const handleOverride = useCallback(() => {
    if (!overrideReason.trim()) return;
    setIsOverriding(true);
    overrideSuccess(projectId, nodeId, {
      reason: overrideReason.trim(),
      landedCommitId: overrideLandedCommitId.trim() || undefined,
    }).then(
      () => {
        setIsOverriding(false);
        setOverrideReason("");
        setOverrideLandedCommitId("");
        toast.success("The node is marked Completed by override.");
        onSuccess?.();
      },
      (cause: unknown) => {
        setIsOverriding(false);
        const err =
          cause instanceof ApiError ? cause : new ApiError("malformed", "The request failed.", 0);
        toast.error(err.message, { description: err.detail || undefined });
      },
    );
  }, [projectId, nodeId, overrideReason, overrideLandedCommitId, onSuccess]);

  const handleDiscard = useCallback(() => {
    if (!discardReason.trim()) return;
    setIsDiscarding(true);
    discard(projectId, nodeId, discardReason.trim()).then(
      () => {
        setIsDiscarding(false);
        setDiscardReason("");
        toast.success("The node is discarded.");
        onSuccess?.();
      },
      (cause: unknown) => {
        setIsDiscarding(false);
        const err =
          cause instanceof ApiError ? cause : new ApiError("malformed", "The request failed.", 0);
        toast.error(err.message, { description: err.detail || undefined });
      },
    );
  }, [projectId, nodeId, discardReason, onSuccess]);

  const handleSetPriority = useCallback(() => {
    const parsed = parseInt(priorityValue, 10);
    if (isNaN(parsed)) {
      toast.error("Priority must be a whole number.");
      return;
    }
    setIsSettingPriority(true);
    setPriority(projectId, nodeId, parsed).then(
      () => {
        setIsSettingPriority(false);
        toast.success("Priority updated.");
        onSuccess?.();
      },
      (cause: unknown) => {
        setIsSettingPriority(false);
        const err =
          cause instanceof ApiError ? cause : new ApiError("malformed", "The request failed.", 0);
        toast.error(err.message, { description: err.detail || undefined });
      },
    );
  }, [projectId, nodeId, priorityValue, onSuccess]);

  return {
    terminal: nodeIsTerminal,
    canPause,
    isPausing,
    handlePause,
    canResume,
    isResuming,
    handleResume,
    canBlock,
    blockOpen,
    setBlockOpen,
    blockReason,
    setBlockReason,
    isBlocking,
    blockError,
    blockErrorDetail,
    handleBlock,
    canUnblock,
    unblockOpen,
    setUnblockOpen,
    isUnblocking,
    unblockError,
    unblockErrorDetail,
    handleUnblock,
    canOverride,
    overrideOpen,
    setOverrideOpen,
    overrideReason,
    setOverrideReason,
    overrideLandedCommitId,
    setOverrideLandedCommitId,
    isOverriding,
    handleOverride,
    canDiscard,
    discardOpen,
    setDiscardOpen,
    discardReason,
    setDiscardReason,
    isDiscarding,
    handleDiscard,
    canSetPriority,
    priorityValue,
    setPriorityValue,
    isSettingPriority,
    handleSetPriority,
    dependents,
  };
}
