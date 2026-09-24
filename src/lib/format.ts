export function relativeTime(iso: string, from: number = Date.now()): string {
  const seconds = Math.round((from - new Date(iso).getTime()) / 1000);
  const ahead = seconds < 0;
  const value = Math.abs(seconds);
  const label = pick(value);
  return ahead ? `in ${label}` : `${label} ago`;
}

function pick(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  if (seconds < 86_400) return `${Math.round(seconds / 3600)}h`;
  return `${Math.round(seconds / 86_400)}d`;
}

export function duration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);
  return hours === 0 ? `${minutes}m` : `${hours}h ${minutes}m`;
}

export function percent(used: number, budget: number): number {
  if (budget <= 0) return 0;
  return Math.min(100, Math.round((used / budget) * 100));
}
