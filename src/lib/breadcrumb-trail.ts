export interface Crumb {
  readonly path: string;
  readonly label: string;
}

const SEGMENT_LABELS: Readonly<Record<string, string>> = {
  new: "New",
  edit: "Edit",
  workbench: "Workbench",
};

function segmentLabel(segment: string): string {
  const fixed = SEGMENT_LABELS[segment];
  if (fixed !== undefined) return fixed;
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

export function breadcrumbTrail(
  pathname: string,
  labelOf: (path: string) => string | undefined,
): readonly Crumb[] {
  const segments = pathname.split("/").filter((segment) => segment.length > 0);
  if (segments.length === 0) return [{ path: "/", label: labelOf("/") ?? "Overview" }];
  return segments.map((segment, index) => {
    const path = `/${segments.slice(0, index + 1).join("/")}`;
    return { path, label: labelOf(path) ?? segmentLabel(segment) };
  });
}
