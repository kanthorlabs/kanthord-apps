import { AppRouter } from "@/components/app-router";
import { SessionProvider } from "@/features/auth/session/session-context";

export function App() {
  return (
    <SessionProvider>
      <AppRouter />
    </SessionProvider>
  );
}
