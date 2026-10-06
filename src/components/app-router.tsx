import { BrowserRouter, Route, Routes } from "react-router-dom";

import { LoginScreen } from "@/features/auth/login/login-screen";
import { useSession } from "@/features/auth/session/session-context";
import { CredentialFormScreen } from "@/features/credentials/form/credential-form-screen";
import { CredentialsScreen } from "@/features/credentials/list/credentials-screen";
import { CredentialScreen } from "@/features/credentials/view/credential-screen";
import { OverviewScreen } from "@/features/overview/overview-screen";
import { ProjectFormScreen } from "@/features/projects/form/project-form-screen";
import { ProjectsScreen } from "@/features/projects/list/projects-screen";
import { ProjectProvider } from "@/features/projects/project-context";
import { ProjectScreen } from "@/features/projects/view/project-screen";
import { RepositoryScreen } from "@/features/repositories/view/repository-screen";
import { ExecutionsScreen } from "@/features/scheduler/executions/executions-screen";
import { SchedulerScreen } from "@/features/scheduler/queue/scheduler-screen";
import { ChatScreen } from "@/features/workbench/chat/chat-screen";
import { SessionsScreen } from "@/features/workbench/sessions/sessions-screen";
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
            <Route path="workers" element={<WorkersScreen />} />
            <Route path="agents" element={<AgentsScreen />} />
            <Route path="agents/:agentName" element={<AgentScreen />} />
            <Route path="agents/:agentName/workbench" element={<SessionsScreen />} />
            <Route path="agents/:agentName/workbench/:sessionId" element={<ChatScreen />} />
            <Route path="llm" element={<CredentialsScreen key="llm" component="llm" />} />
            <Route path="llm/new" element={<CredentialFormScreen key="llm" component="llm" />} />
            <Route
              path="llm/:credentialName"
              element={<CredentialScreen key="llm" component="llm" />}
            />
            <Route
              path="repositories"
              element={<CredentialsScreen key="repository" component="repository" />}
            />
            <Route
              path="repositories/new"
              element={<CredentialFormScreen key="repository" component="repository" />}
            />
            <Route path="repositories/:credentialName" element={<RepositoryScreen />} />
            <Route
              path="storage"
              element={<CredentialsScreen key="storage" component="storage" />}
            />
            <Route
              path="storage/new"
              element={<CredentialFormScreen key="storage" component="storage" />}
            />
            <Route
              path="storage/:credentialName"
              element={<CredentialScreen key="storage" component="storage" />}
            />
          </Route>
        </Routes>
      </BrowserRouter>
      <Toaster />
    </ProjectProvider>
  );
}
