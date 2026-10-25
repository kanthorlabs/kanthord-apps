import {
  Activity,
  Bot,
  Boxes,
  BrainCircuit,
  ChartColumn,
  Database,
  FolderGit2,
  FolderKanban,
  History,
  LayoutDashboard,
  ListOrdered,
  MessagesSquare,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface NavItem {
  readonly to: string;
  readonly label: string;
  readonly icon: LucideIcon;
  readonly group: (typeof NAV_GROUPS)[number];
}

export const NAV_GROUPS = ["Work", "Workforce", "Credentials"] as const;

export const NAV_ITEMS: readonly NavItem[] = [
  { to: "/", label: "Overview", icon: LayoutDashboard, group: "Work" },
  { to: "/projects", label: "Projects", icon: FolderKanban, group: "Work" },
  { to: "/scheduler", label: "Scheduler", icon: ListOrdered, group: "Work" },
  { to: "/traces", label: "Traces", icon: Activity, group: "Work" },
  { to: "/timeline", label: "Timeline", icon: History, group: "Work" },
  { to: "/analytics", label: "Analytics", icon: ChartColumn, group: "Work" },
  { to: "/workers", label: "Workers", icon: Boxes, group: "Workforce" },
  { to: "/agents", label: "Agents", icon: Bot, group: "Workforce" },
  { to: "/workbench", label: "Workbench", icon: MessagesSquare, group: "Workforce" },
  { to: "/llm", label: "LLM", icon: BrainCircuit, group: "Credentials" },
  { to: "/repositories", label: "Git", icon: FolderGit2, group: "Credentials" },
  { to: "/storage", label: "Storage", icon: Database, group: "Credentials" },
];

export const ROUTE_LABELS: ReadonlyMap<string, string> = new Map([
  ...NAV_ITEMS.map((item): [string, string] => [item.to, item.label]),
]);
