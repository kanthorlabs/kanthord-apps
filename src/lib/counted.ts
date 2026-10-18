export function counted(count: number, noun: string, plural: string): string {
  return `${count} ${count === 1 ? noun : plural}`;
}
