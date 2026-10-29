function projectQuery(projectId: string | undefined): string {
  return projectId === undefined || projectId === ""
    ? ""
    : `?project=${encodeURIComponent(projectId)}`;
}

export function workersPath(projectId?: string): string {
  return `/workers${projectQuery(projectId)}`;
}

export function workerPagePath(workerName: string, projectId?: string): string {
  return `/workers/${encodeURIComponent(workerName)}${projectQuery(projectId)}`;
}

export function instancePagePath(
  workerName: string,
  instanceName: string,
  projectId?: string,
): string {
  return `/workers/${encodeURIComponent(workerName)}/instances/${encodeURIComponent(instanceName)}${projectQuery(projectId)}`;
}
