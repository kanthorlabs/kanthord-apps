export type LineChange = "same" | "added" | "removed";

export interface DiffLine {
  readonly change: LineChange;
  readonly text: string;
}

const LINE_BREAK = "\n";

function commonLengths(before: readonly string[], after: readonly string[]): number[][] {
  const lengths = Array.from({ length: before.length + 1 }, () =>
    new Array<number>(after.length + 1).fill(0),
  );
  for (let i = before.length - 1; i >= 0; i -= 1) {
    for (let j = after.length - 1; j >= 0; j -= 1) {
      const row = lengths[i] ?? [];
      row[j] =
        before[i] === after[j]
          ? (lengths[i + 1]?.[j + 1] ?? 0) + 1
          : Math.max(lengths[i + 1]?.[j] ?? 0, row[j + 1] ?? 0);
    }
  }
  return lengths;
}

export function lineDiff(beforeText: string, afterText: string): readonly DiffLine[] {
  const before = beforeText.split(LINE_BREAK);
  const after = afterText.split(LINE_BREAK);
  const lengths = commonLengths(before, after);
  const lines: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < before.length && j < after.length) {
    if (before[i] === after[j]) {
      lines.push({ change: "same", text: before[i] ?? "" });
      i += 1;
      j += 1;
    } else if ((lengths[i + 1]?.[j] ?? 0) >= (lengths[i]?.[j + 1] ?? 0)) {
      lines.push({ change: "removed", text: before[i] ?? "" });
      i += 1;
    } else {
      lines.push({ change: "added", text: after[j] ?? "" });
      j += 1;
    }
  }
  for (; i < before.length; i += 1) lines.push({ change: "removed", text: before[i] ?? "" });
  for (; j < after.length; j += 1) lines.push({ change: "added", text: after[j] ?? "" });
  return lines;
}
