import { GuestChat } from "./guest-chat";
import { useGuestSession } from "./use-guest-session";

export function GuestScreen() {
  const { connection } = useGuestSession();

  if (connection === null) {
    return (
      <main className="flex min-h-svh justify-center bg-muted/40 px-4 py-10">
        <p>Open your invite link again.</p>
      </main>
    );
  }

  return <GuestChat connection={connection} />;
}
