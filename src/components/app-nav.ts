import {
  Activity,
  Bot,
  Boxes,
  Inbox,
  LayoutDashboard,
  ListOrdered,
  Network,
  Settings,
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
  { to: "/settings", label: "Project", icon: Settings, group: "Work" },
  { to: "/mission", label: "Mission", icon: Network, group: "Work" },
  { to: "/deliveries", label: "Deliveries", icon: Inbox, group: "Work" },
  { to: "/scheduler", label: "Scheduler", icon: ListOrdered, group: "Runs" },
  { to: "/executions", label: "Executions", icon: Activity, group: "Runs" },
  { to: "/workers", label: "Workers", icon: Boxes, group: "Workforce" },
  { to: "/agents", label: "Agents", icon: Bot, group: "Workforce" },
];
