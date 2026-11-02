import { costText } from "./flow-format";

export function dayBarsNameOf(values: readonly number[], label: string): string {
  if (values.length === 0) return `Daily cost of ${label} has no values`;
  const range = `from ${costText(Math.min(...values))} to ${costText(Math.max(...values))}`;
  return `Daily cost of ${label} ${range}`;
}

export function sparklineNameOf(
  label: string,
  numbers: readonly number[],
  bounds: readonly (readonly [string, number])[],
  format: (value: number) => string,
): string {
  if (numbers.length === 0) return `Daily ${label} has no values`;
  const range = `Daily ${label} from ${format(Math.min(...numbers))} to ${format(Math.max(...numbers))}`;
  return [range, ...bounds.map(([name, value]) => `${name} line ${format(value)}`)].join(", ");
}
