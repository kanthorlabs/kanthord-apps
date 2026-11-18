import { useCallback, useState } from "react";
import { toast } from "sonner";

import { createInvite, revokeInvite } from "@/api/resources/workbench";
import { WORKBENCH_INVITE_PROJECT_INVALID, WORKBENCH_INVITE_SCOPE_MISMATCH } from "@/api/types";
import { basePath } from "@/components/base-path";
import { useClipboard } from "@/hooks/use-clipboard";
import { asApiError } from "@/hooks/use-resource";
import { type GuestLine, guestLineOf } from "@/lib/guest-chat";
import { inviteeNameValid, inviteLinkOf } from "@/lib/share-invite";

const PROJECT_FAILURE_CODES: readonly string[] = [
  WORKBENCH_INVITE_PROJECT_INVALID,
  WORKBENCH_INVITE_SCOPE_MISMATCH,
];

export interface ShareInviteState {
  readonly name: string;
  readonly projectIds: readonly string[];
  readonly valid: boolean;
  readonly link: string | null;
  readonly pending: boolean;
  readonly createFailure: GuestLine | null;
  readonly projectFailure: GuestLine | null;
  readonly revokingId: string | null;
  readonly revokeFailure: { readonly inviteId: string; readonly line: GuestLine } | null;
  readonly setName: (value: string) => void;
  readonly setProjectIds: (value: readonly string[]) => void;
  readonly create: () => Promise<void>;
  readonly revoke: (inviteId: string) => Promise<void>;
  readonly copy: () => void;
  readonly reset: () => void;
}

export function useShareInvite(
  sessionId: string,
  onChanged: () => void,
  lockedProjectIds: readonly string[] | null,
): ShareInviteState {
  const [name, setNameValue] = useState("");
  const [chosenIds, setChosenIds] = useState<readonly string[]>([]);
  const [link, setLink] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<GuestLine | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [revokeFailure, setRevokeFailure] = useState<ShareInviteState["revokeFailure"]>(null);
  const write = useClipboard();
  const projectIds = lockedProjectIds ?? chosenIds;
  const valid = inviteeNameValid(name) && projectIds.length > 0;
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

  const create = useCallback(async () => {
    if (!valid || pending) return;
    const inviteeName = name.trim();
    setPending(true);
    setFailure(null);
    try {
      const created = await createInvite(sessionId, {
        invitee_name: inviteeName,
        project_ids: [...projectIds].sort(),
      });
      setLink(inviteLinkOf(window.location.origin, basePath(), created.invite_token, inviteeName));
      setNameValue("");
      setChosenIds([]);
      onChanged();
    } catch (cause) {
      setFailure(guestLineOf(asApiError(cause)));
    } finally {
      setPending(false);
    }
  }, [valid, pending, name, projectIds, sessionId, onChanged]);

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
    setLink(null);
    setFailure(null);
    setRevokeFailure(null);
  }, []);

  return {
    name,
    projectIds,
    valid,
    link,
    pending,
    createFailure,
    projectFailure,
    revokingId,
    revokeFailure,
    setName,
    setProjectIds,
    create,
    revoke,
    copy,
    reset,
  };
}
