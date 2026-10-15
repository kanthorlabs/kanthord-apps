export function nodePath(projectId: string, nodeId: string): string {
  return `/projects/${encodeURIComponent(projectId)}?node=${encodeURIComponent(nodeId)}`;
}
