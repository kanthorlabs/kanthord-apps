export function workerPagePath(workerName: string): string {
  return `/workers/${encodeURIComponent(workerName)}`;
}

export function instancePagePath(workerName: string, instanceName: string): string {
  return `${workerPagePath(workerName)}/instances/${encodeURIComponent(instanceName)}`;
}
