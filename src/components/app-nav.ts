import {
  Activity,
  Archive,
  ArrowLeftRight,
  Bot,
  Boxes,
  FolderKanban,
  GitBranch,
  HeartPulse,
  KeyRound,
  LayoutDashboard,
  ListOrdered,
  ShieldCheck,
  Waypoints,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface NavItem {
  readonly to: string;
  readonly label: string;
  readonly icon: LucideIcon;
  readonly group: (typeof NAV_GROUPS)[number];
}

export const NAV_GROUPS = ["Work", "Workforce", "Connections", "System"] as const;

export const NAV_ITEMS: readonly NavItem[] = [
  { to: "/", label: "Overview", icon: LayoutDashboard, group: "Work" },
  { to: "/projects", label: "Projects", icon: FolderKanban, group: "Work" },
  { to: "/scheduler", label: "Scheduler", icon: ListOrdered, group: "Work" },
  { to: "/executions", label: "Executions", icon: Activity, group: "Work" },
  { to: "/traces", label: "Traces", icon: Waypoints, group: "Work" },
  { to: "/workers", label: "Workers", icon: Boxes, group: "Workforce" },
  { to: "/agents", label: "Agents", icon: Bot, group: "Workforce" },
  { to: "/credentials", label: "Credentials", icon: KeyRound, group: "Connections" },
  { to: "/repositories", label: "Repositories", icon: GitBranch, group: "Connections" },
  { to: "/storage", label: "Evidence storage", icon: Archive, group: "Connections" },
  { to: "/intake", label: "Intake", icon: ArrowLeftRight, group: "Connections" },
  { to: "/health", label: "Health", icon: HeartPulse, group: "System" },
  { to: "/access", label: "Access", icon: ShieldCheck, group: "System" },
];

export const ROUTE_LABELS: ReadonlyMap<string, string> = new Map([
  ...NAV_ITEMS.map((item): [string, string] => [item.to, item.label]),
  ["/settings", "Project settings"],
]);
