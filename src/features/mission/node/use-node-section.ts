import { useState } from "react";

export const NODE_SECTIONS = [
  { value: "content", label: "Content" },
  { value: "attempts", label: "Attempts" },
  { value: "revisions", label: "Revisions" },
  { value: "dependencies", label: "Dependencies" },
  { value: "why", label: "Why not running" },
] as const;

export type NodeSection = (typeof NODE_SECTIONS)[number]["value"];

export interface NodeSectionState {
  readonly section: NodeSection;
  readonly selectSection: (value: string) => void;
}

export function useNodeSection(): NodeSectionState {
  const [section, setSection] = useState<NodeSection>("content");

  const selectSection = (value: string) => {
    const known = NODE_SECTIONS.find((s) => s.value === value);
    if (known !== undefined) setSection(known.value);
  };

  return { section, selectSection };
}
