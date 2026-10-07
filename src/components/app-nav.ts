import {
  Activity,
  Bot,
  Boxes,
  BrainCircuit,
  Database,
  FolderGit2,
  FolderKanban,
  LayoutDashboard,
  ListOrdered,
  MessagesSquare,
  ScrollText,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface NavItem {
  readonly to: string;
  readonly label: string;
  readonly icon: LucideIcon;
  readonly group: (typeof NAV_GROUPS)[number];
}

export const NAV_GROUPS = ["Work", "Workforce", "Connections", "Settings"] as const;

export const NAV_ITEMS: readonly NavItem[] = [
  { to: "/", label: "Overview", icon: LayoutDashboard, group: "Work" },
  { to: "/projects", label: "Projects", icon: FolderKanban, group: "Work" },
  { to: "/scheduler", label: "Scheduler", icon: ListOrdered, group: "Work" },
  { to: "/executions", label: "Executions", icon: Activity, group: "Work" },
  { to: "/workers", label: "Workers", icon: Boxes, group: "Workforce" },
  { to: "/agents", label: "Agents", icon: Bot, group: "Workforce" },
  { to: "/workbench", label: "Workbench", icon: MessagesSquare, group: "Workforce" },
  { to: "/llm", label: "LLM", icon: BrainCircuit, group: "Connections" },
  { to: "/repositories", label: "Repositories", icon: FolderGit2, group: "Connections" },
  { to: "/storage", label: "Storage", icon: Database, group: "Connections" },
  { to: "/settings/prompts", label: "Prompts", icon: ScrollText, group: "Settings" },
];

export const ROUTE_LABELS: ReadonlyMap<string, string> = new Map([
  ...NAV_ITEMS.map((item): [string, string] => [item.to, item.label]),
]);
