export interface SummaryParts {
  readonly before: string;
  readonly after: string;
}

export function summaryPartsOf(text: string, subject: string | null): SummaryParts | null {
  if (subject === null) return null;
  const marker = `: ${subject}`;
  const at = text.lastIndexOf(marker);
  if (at < 0) return null;
  return {
    before: text.slice(0, at + 2),
    after: text.slice(at + marker.length),
  };
}
