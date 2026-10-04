import { BrowserRouter, Route, Routes } from "react-router-dom";

import { LoginScreen } from "@/features/auth/login/login-screen";
import { useSession } from "@/features/auth/session/session-context";
import { DeliveriesScreen } from "@/features/deliveries/inbox/deliveries-screen";
import { OverviewScreen } from "@/features/overview/overview-screen";
import { ProjectFormScreen } from "@/features/projects/form/project-form-screen";
import { ProjectsScreen } from "@/features/projects/list/projects-screen";
import { ProjectProvider } from "@/features/projects/project-context";
import { ProjectScreen } from "@/features/projects/view/project-screen";
import { ExecutionsScreen } from "@/features/scheduler/executions/executions-screen";
import { SchedulerScreen } from "@/features/scheduler/queue/scheduler-screen";
import { AgentScreen } from "@/features/workers/agent/agent-screen";
import { AgentsScreen } from "@/features/workers/agents/agents-screen";
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
            <Route path="projects" element={<ProjectsScreen />} />
            <Route path="projects/new" element={<ProjectFormScreen />} />
            <Route path="projects/:projectId" element={<ProjectScreen />} />
            <Route path="projects/:projectId/edit" element={<ProjectFormScreen />} />
            <Route path="scheduler" element={<SchedulerScreen />} />
            <Route path="executions" element={<ExecutionsScreen />} />
            <Route path="deliveries" element={<DeliveriesScreen />} />
            <Route path="workers" element={<WorkersScreen />} />
            <Route path="agents" element={<AgentsScreen />} />
            <Route path="agents/:agentName" element={<AgentScreen />} />
          </Route>
        </Routes>
      </BrowserRouter>
      <Toaster />
    </ProjectProvider>
  );
}
