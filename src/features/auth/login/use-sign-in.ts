import { useCallback, useState } from "react";

import { ApiError } from "@/api/errors";
import { useSession } from "@/features/auth/session/session-context";

export function useSignIn() {
  const { signIn } = useSession();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const submit = useCallback(
    async (username: string, password: string) => {
      if (username.trim() === "" || password === "") {
        setError("Type the username and the password.");
        return;
      }
      setPending(true);
      setError(null);
      try {
        await signIn(username, password);
      } catch (cause) {
        setError(
          cause instanceof ApiError && cause.code === "unreachable"
            ? "The daemon did not answer. Start it and try again."
            : cause instanceof ApiError
              ? cause.message
              : "The sign in failed.",
        );
      } finally {
        setPending(false);
      }
    },
    [signIn],
  );

  return { submit, error, pending };
}
