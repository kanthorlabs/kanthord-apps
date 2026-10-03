import { LogOut } from "lucide-react";
import { NavLink, Outlet, useLocation } from "react-router-dom";

import { useSession } from "@/features/auth/session/session-context";
import { useProject } from "@/features/projects/project-context";
import { NAV_GROUPS, NAV_ITEMS } from "./app-nav";
import { Button } from "./ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
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

function currentLabel(pathname: string): string {
  const exact = NAV_ITEMS.find((item) => item.to === pathname);
  if (exact) return exact.label;
  const prefix = NAV_ITEMS.filter((item) => item.to !== "/").find((item) =>
    pathname.startsWith(item.to),
  );
  return prefix?.label ?? "Overview";
}

function isActive(pathname: string, to: string): boolean {
  return to === "/" ? pathname === "/" : pathname.startsWith(to);
}

export function AppShell() {
  const { session, signOut } = useSession();
  const { projects, project, select } = useProject();
  const { pathname } = useLocation();

  return (
    <SidebarProvider>
      <Sidebar collapsible="icon">
        <SidebarHeader>
          <div className="flex items-center gap-2 px-2 py-1.5">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary text-sm font-semibold text-primary-foreground">
              kd
            </div>
            <div className="grid text-left leading-tight group-data-[collapsible=icon]:hidden">
              <span className="truncate text-sm font-semibold">kanthord</span>
              <span className="truncate text-xs text-muted-foreground">Control surface</span>
            </div>
          </div>
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
                        asChild
                        tooltip={item.label}
                        isActive={isActive(pathname, item.to)}
                      >
                        <NavLink to={item.to} end={item.to === "/"}>
                          <item.icon />
                          <span>{item.label}</span>
                        </NavLink>
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
            <SidebarMenuItem>
              <SidebarMenuButton onClick={signOut} tooltip="Sign out">
                <LogOut />
                <span className="truncate">{session?.username ?? "Sign out"}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b bg-background/95 px-3 backdrop-blur sm:px-4">
          <SidebarTrigger />
          <Separator orientation="vertical" className="mr-1" />
          <h1 className="truncate text-sm font-semibold sm:text-base">{currentLabel(pathname)}</h1>
          <div className="ml-auto flex items-center gap-2">
            {project !== null && (
              <Select value={project.id} onValueChange={select}>
                <SelectTrigger className="w-[9rem] sm:w-[12rem]" aria-label="Project">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((candidate) => (
                    <SelectItem key={candidate.id} value={candidate.id}>
                      {candidate.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={signOut}
              aria-label="Sign out"
              className="hidden sm:inline-flex"
            >
              <LogOut />
            </Button>
          </div>
        </header>
        <div className="min-w-0 flex-1 p-3 sm:p-4 lg:p-6">
          <Outlet />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
