import { LogOut } from "lucide-react";
import { NavLink, Outlet, useLocation } from "react-router-dom";

import logoReversed from "@/assets/logo/logo-reversed.svg";
import logo from "@/assets/logo/logo.svg";
import { useSession } from "@/features/auth/session/session-context";
import { useProject } from "@/features/projects/project-context";
import { AppBreadcrumb } from "./app-breadcrumb";
import { NAV_GROUPS, NAV_ITEMS } from "./app-nav";
import { CrumbLabelsProvider } from "./crumb-labels";
import { Alert, AlertDescription, AlertTitle } from "./ui/alert";
import { Button } from "./ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from "./ui/empty";
import { Separator } from "./ui/separator";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "./ui/sidebar";

function servesWithoutProject(pathname: string): boolean {
  return pathname === "/projects" || pathname.startsWith("/projects/");
}

function isActive(pathname: string, to: string): boolean {
  return to === "/" ? pathname === "/" : pathname.startsWith(to);
}

export function AppShell() {
  const { session, signOut } = useSession();
  const { project, loading, error } = useProject();
  const { pathname } = useLocation();

  return (
    <CrumbLabelsProvider>
      <SidebarProvider>
        <Sidebar collapsible="icon">
          <SidebarHeader>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton size="lg" render={<NavLink to="/" />} tooltip="kanthord">
                  <img src={logo} alt="" className="size-8 shrink-0 dark:hidden" />
                  <img src={logoReversed} alt="" className="hidden size-8 shrink-0 dark:block" />
                  <div className="grid text-left leading-tight">
                    <span className="truncate text-sm font-semibold">kanthord</span>
                    <span className="truncate text-xs text-muted-foreground">Control surface</span>
                  </div>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarHeader>
          <SidebarContent>
            {NAV_GROUPS.map((group) => (
              <SidebarGroup key={group}>
                <SidebarGroupLabel>{group}</SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {NAV_ITEMS.filter((item) => item.group === group).map((item) => (
                      <SidebarMenuItem key={item.to}>
                        <SidebarMenuButton
                          render={<NavLink to={item.to} end={item.to === "/"} />}
                          tooltip={item.label}
                          isActive={isActive(pathname, item.to)}
                        >
                          <item.icon />
                          <span>{item.label}</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            ))}
          </SidebarContent>
          <SidebarFooter>
            <SidebarMenu>
              {session !== null && (
                <SidebarMenuItem>
                  <div className="grid min-w-0 px-2 py-1.5 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
                    <span className="truncate font-medium">{session.identity.name}</span>
                    <span className="truncate text-xs text-muted-foreground">
                      {session.instance.name}
                    </span>
                  </div>
                </SidebarMenuItem>
              )}
              <SidebarMenuItem>
                <SidebarMenuButton onClick={signOut} tooltip="Sign out">
                  <LogOut />
                  <span>Sign out</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarFooter>
        </Sidebar>
        <SidebarInset>
          <header className="sticky top-0 z-10 flex min-h-14 shrink-0 items-center gap-2 border-b bg-background/95 px-3 py-2 backdrop-blur sm:px-4">
            <SidebarTrigger />
            <Separator orientation="vertical" className="mr-1" />
            <AppBreadcrumb />
          </header>
          <div className="min-w-0 flex-1 p-3 sm:p-4 lg:p-6">
            {project !== null || servesWithoutProject(pathname) ? (
              <Outlet />
            ) : loading ? null : error !== null ? (
              <Alert variant="destructive">
                <AlertTitle>The projects could not be read</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : (
              <Empty>
                <EmptyHeader>
                  <EmptyTitle>No projects</EmptyTitle>
                  <EmptyDescription>This instance holds no project.</EmptyDescription>
                </EmptyHeader>
                <EmptyContent>
                  <Button nativeButton={false} render={<NavLink to="/projects/new" />} size="lg">
                    New project
                  </Button>
                </EmptyContent>
              </Empty>
            )}
          </div>
        </SidebarInset>
      </SidebarProvider>
    </CrumbLabelsProvider>
  );
}
