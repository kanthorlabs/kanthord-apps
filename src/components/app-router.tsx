import { BrowserRouter, Route, Routes } from "react-router-dom";

import { LoginScreen } from "@/features/auth/login/login-screen";
import { useSession } from "@/features/auth/session/session-context";
import { DeliveriesScreen } from "@/features/deliveries/inbox/deliveries-screen";
import { ObservationsScreen } from "@/features/deliveries/observations/observations-screen";
import { BlockedScreen } from "@/features/mission/blocked/blocked-screen";
import { MissionScreen } from "@/features/mission/graph/mission-screen";
import { NodeScreen } from "@/features/mission/node/node-screen";
import { OverviewScreen } from "@/features/overview/overview-screen";
import { ProjectProvider } from "@/features/projects/project-context";
import { ExecutionsScreen } from "@/features/scheduler/executions/executions-screen";
import { SchedulerScreen } from "@/features/scheduler/queue/scheduler-screen";
import { SettingsScreen } from "@/features/settings/project/settings-screen";
import { WorkersScreen } from "@/features/workers/catalogue/workers-screen";
import { AppShell } from "./app-shell";
import { Toaster } from "./ui/sonner";

export function AppRouter() {
  const { session } = useSession();

  if (session === null) return <LoginScreen />;

  return (
    <ProjectProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<AppShell />}>
            <Route index element={<OverviewScreen />} />
            <Route path="mission" element={<MissionScreen />} />
            <Route path="mission/:nodeId" element={<NodeScreen />} />
            <Route path="blocked" element={<BlockedScreen />} />
            <Route path="scheduler" element={<SchedulerScreen />} />
            <Route path="executions" element={<ExecutionsScreen />} />
            <Route path="deliveries" element={<DeliveriesScreen />} />
            <Route path="observations" element={<ObservationsScreen />} />
            <Route path="workers" element={<WorkersScreen />} />
            <Route path="settings" element={<SettingsScreen />} />
          </Route>
        </Routes>
      </BrowserRouter>
      <Toaster />
    </ProjectProvider>
  );
}
