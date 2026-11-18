import { useCallback, useState } from "react";
import { toast } from "sonner";

import { createInvite, revokeInvite } from "@/api/resources/workbench";
import {
  type GrantableOperation,
  type GrantedOperation,
  WORKBENCH_INVITE_GRANT_INVALID,
  WORKBENCH_INVITE_PROJECT_INVALID,
  WORKBENCH_INVITE_SCOPE_MISMATCH,
} from "@/api/types";
import { basePath } from "@/components/base-path";
import { useClipboard } from "@/hooks/use-clipboard";
import { asApiError } from "@/hooks/use-resource";
import { type GuestLine, guestLineOf } from "@/lib/guest-chat";
import {
  grantedOperationsOf,
  inviteeNameValid,
  inviteLinkOf,
  MAX_INVITE_PROJECTS,
  projectCountValid,
  withRefusedIds,
} from "@/lib/share-invite";

const PROJECT_FAILURE_CODES: readonly string[] = [
  WORKBENCH_INVITE_PROJECT_INVALID,
  WORKBENCH_INVITE_SCOPE_MISMATCH,
];

export interface ShareInviteState {
  readonly name: string;
  readonly projectIds: readonly string[];
  readonly grantedIds: readonly string[];
  readonly createdGrant: readonly GrantedOperation[];
  readonly valid: boolean;
  readonly projectsExceeded: boolean;
  readonly link: string | null;
  readonly pending: boolean;
  readonly createFailure: GuestLine | null;
  readonly projectFailure: GuestLine | null;
  readonly revokingId: string | null;
  readonly revokeFailure: { readonly inviteId: string; readonly line: GuestLine } | null;
  readonly setName: (value: string) => void;
  readonly setProjectIds: (value: readonly string[]) => void;
  readonly setGrantedIds: (value: readonly string[]) => void;
  readonly create: () => Promise<void>;
  readonly revoke: (inviteId: string) => Promise<void>;
  readonly copy: () => void;
  readonly reset: () => void;
}

export function useShareInvite(
  sessionId: string,
  onChanged: () => void,
  lockedProjectIds: readonly string[] | null,
  grantable: readonly GrantableOperation[],
): ShareInviteState {
  const [name, setNameValue] = useState("");
  const [chosenIds, setChosenIds] = useState<readonly string[]>([]);
  const [grantedIds, setGrantedIdsValue] = useState<readonly string[]>([]);
  const [createdGrant, setCreatedGrant] = useState<readonly GrantedOperation[]>([]);
  const [link, setLink] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<GuestLine | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [revokeFailure, setRevokeFailure] = useState<ShareInviteState["revokeFailure"]>(null);
  const write = useClipboard();
  const projectIds = lockedProjectIds ?? chosenIds;
  const valid = inviteeNameValid(name) && projectCountValid(projectIds.length);
  const projectsExceeded = projectIds.length > MAX_INVITE_PROJECTS;
  const projectFailure =
    failure?.code != null && PROJECT_FAILURE_CODES.includes(failure.code) ? failure : null;
  const createFailure = projectFailure === null ? failure : null;

  const setName = useCallback((value: string) => {
    setNameValue(value);
    setFailure(null);
  }, []);

  const setProjectIds = useCallback((value: readonly string[]) => {
    setChosenIds(value);
    setFailure(null);
  }, []);

  const setGrantedIds = useCallback((value: readonly string[]) => {
    setGrantedIdsValue(value);
    setFailure(null);
  }, []);

  const create = useCallback(async () => {
    if (!valid || pending) return;
    const inviteeName = name.trim();
    setPending(true);
    setFailure(null);
    try {
      const created = await createInvite(sessionId, {
        invitee_name: inviteeName,
        project_ids: [...projectIds].sort(),
        granted_operations: [...grantedIds].sort(),
      });
      setLink(inviteLinkOf(window.location.origin, basePath(), created.invite_token, inviteeName));
      setCreatedGrant(grantedOperationsOf(created.granted_operations, grantable));
      setNameValue("");
      setChosenIds([]);
      setGrantedIdsValue([]);
      onChanged();
    } catch (cause) {
      const error = asApiError(cause);
      const line = guestLineOf(error);
      setFailure(
        error.detail === WORKBENCH_INVITE_GRANT_INVALID
          ? withRefusedIds(line, error.details)
          : line,
      );
    } finally {
      setPending(false);
    }
  }, [valid, pending, name, projectIds, grantedIds, grantable, sessionId, onChanged]);

  const revoke = useCallback(
    async (inviteId: string) => {
      setRevokingId(inviteId);
      setRevokeFailure(null);
      try {
        await revokeInvite(inviteId);
        onChanged();
      } catch (cause) {
        setRevokeFailure({ inviteId, line: guestLineOf(asApiError(cause)) });
      } finally {
        setRevokingId(null);
      }
    },
    [onChanged],
  );

  const copy = useCallback(() => {
    if (link === null) return;
    write(link).then(
      () => toast.success("Copied the invite link."),
      () => toast.error("The browser refused the clipboard. Copy the link from the field."),
    );
  }, [link, write]);

  const reset = useCallback(() => {
    setNameValue("");
    setChosenIds([]);
    setGrantedIdsValue([]);
    setCreatedGrant([]);
    setLink(null);
    setFailure(null);
    setRevokeFailure(null);
  }, []);

  return {
    name,
    projectIds,
    grantedIds,
    createdGrant,
    valid,
    projectsExceeded,
    link,
    pending,
    createFailure,
    projectFailure,
    revokingId,
    revokeFailure,
    setName,
    setProjectIds,
    setGrantedIds,
    create,
    revoke,
    copy,
    reset,
  };
}
