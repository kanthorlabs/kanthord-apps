import { useCallback, useState } from "react";
import { toast } from "sonner";

import { createInvite, revokeInvite } from "@/api/resources/workbench";
import { basePath } from "@/components/base-path";
import { useClipboard } from "@/hooks/use-clipboard";
import { asApiError } from "@/hooks/use-resource";
import { type GuestLine, guestLineOf } from "@/lib/guest-chat";
import { inviteeNameValid, inviteLinkOf } from "@/lib/share-invite";

export interface ShareInviteState {
  readonly name: string;
  readonly valid: boolean;
  readonly link: string | null;
  readonly pending: boolean;
  readonly createFailure: GuestLine | null;
  readonly revokingId: string | null;
  readonly revokeFailure: { readonly inviteId: string; readonly line: GuestLine } | null;
  readonly setName: (value: string) => void;
  readonly create: () => Promise<void>;
  readonly revoke: (inviteId: string) => Promise<void>;
  readonly copy: () => void;
  readonly reset: () => void;
}

export function useShareInvite(sessionId: string, onChanged: () => void): ShareInviteState {
  const [name, setNameValue] = useState("");
  const [link, setLink] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [createFailure, setCreateFailure] = useState<GuestLine | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [revokeFailure, setRevokeFailure] = useState<ShareInviteState["revokeFailure"]>(null);
  const write = useClipboard();
  const valid = inviteeNameValid(name);

  const setName = useCallback((value: string) => {
    setNameValue(value);
    setCreateFailure(null);
  }, []);

  const create = useCallback(async () => {
    if (!valid || pending) return;
    const inviteeName = name.trim();
    setPending(true);
    setCreateFailure(null);
    try {
      const created = await createInvite(sessionId, { invitee_name: inviteeName });
      setLink(inviteLinkOf(window.location.origin, basePath(), created.invite_token, inviteeName));
      setNameValue("");
      onChanged();
    } catch (cause) {
      setCreateFailure(guestLineOf(asApiError(cause)));
    } finally {
      setPending(false);
    }
  }, [valid, pending, name, sessionId, onChanged]);

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
    setLink(null);
    setCreateFailure(null);
    setRevokeFailure(null);
  }, []);

  return {
    name,
    valid,
    link,
    pending,
    createFailure,
    revokingId,
    revokeFailure,
    setName,
    create,
    revoke,
    copy,
    reset,
  };
}
