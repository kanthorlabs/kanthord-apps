import {
  Activity,
  Boxes,
  GitPullRequestArrow,
  Inbox,
  LayoutDashboard,
  ListOrdered,
  Network,
  Settings,
  ShieldAlert,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface NavItem {
  readonly to: string;
  readonly label: string;
  readonly icon: LucideIcon;
  readonly group: "Operate" | "Observe" | "Configure";
}

export const NAV_ITEMS: readonly NavItem[] = [
  { to: "/", label: "Overview", icon: LayoutDashboard, group: "Operate" },
  { to: "/mission", label: "Mission", icon: Network, group: "Operate" },
  { to: "/blocked", label: "Blocked", icon: ShieldAlert, group: "Operate" },
  { to: "/scheduler", label: "Scheduler", icon: ListOrdered, group: "Observe" },
  { to: "/executions", label: "Executions", icon: Activity, group: "Observe" },
  { to: "/deliveries", label: "Deliveries", icon: Inbox, group: "Observe" },
  { to: "/observations", label: "Observations", icon: GitPullRequestArrow, group: "Observe" },
  { to: "/workers", label: "Workers", icon: Boxes, group: "Configure" },
  { to: "/settings", label: "Project", icon: Settings, group: "Configure" },
];

export const NAV_GROUPS = ["Operate", "Observe", "Configure"] as const;
