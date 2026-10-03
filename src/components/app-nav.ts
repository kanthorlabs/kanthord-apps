import {
  Activity,
  Bot,
  Boxes,
  FolderKanban,
  Inbox,
  LayoutDashboard,
  ListOrdered,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface NavItem {
  readonly to: string;
  readonly label: string;
  readonly icon: LucideIcon;
  readonly group: (typeof NAV_GROUPS)[number];
}

export const NAV_GROUPS = ["Work", "Runs", "Workforce"] as const;

export const NAV_ITEMS: readonly NavItem[] = [
  { to: "/", label: "Overview", icon: LayoutDashboard, group: "Work" },
  { to: "/projects", label: "Projects", icon: FolderKanban, group: "Work" },
  { to: "/deliveries", label: "Deliveries", icon: Inbox, group: "Work" },
  { to: "/scheduler", label: "Scheduler", icon: ListOrdered, group: "Runs" },
  { to: "/executions", label: "Executions", icon: Activity, group: "Runs" },
  { to: "/workers", label: "Workers", icon: Boxes, group: "Workforce" },
  { to: "/agents", label: "Agents", icon: Bot, group: "Workforce" },
];

export const ROUTE_LABELS: ReadonlyMap<string, string> = new Map([
  ...NAV_ITEMS.map((item): [string, string] => [item.to, item.label]),
  ["/mission", "Mission"],
  ["/blocked", "Blocked nodes"],
  ["/settings", "Project settings"],
]);
