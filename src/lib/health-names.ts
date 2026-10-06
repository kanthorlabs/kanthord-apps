const HEALTH_TOOL = "gateway--healthcheck";
const REPORT_SECTIONS = ["services", "shared"] as const;
const NAME_SEPARATOR = "/";

type Json = Readonly<Record<string, unknown>>;

function isRecord(value: unknown): value is Json {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function decodedSegment(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

export function healthNameLabel(name: string): string {
  return name.split(NAME_SEPARATOR).map(decodedSegment).join(NAME_SEPARATOR);
}

function labelledResources(resources: unknown): unknown {
  if (!isRecord(resources)) return resources;
  const labels = Object.keys(resources).map(healthNameLabel);
  if (new Set(labels).size !== labels.length) return resources;
  return Object.fromEntries(
    Object.entries(resources).map(([name, entry]) => [healthNameLabel(name), entry]),
  );
}

function labelledComponent(component: unknown): unknown {
  if (!isRecord(component)) return component;
  const projects = component["projects"];
  return {
    ...component,
    global: labelledResources(component["global"]),
    projects: isRecord(projects)
      ? Object.fromEntries(
          Object.entries(projects).map(([project, resources]) => [
            project,
            labelledResources(resources),
          ]),
        )
      : projects,
  };
}

function labelledSection(section: unknown): unknown {
  if (!isRecord(section)) return section;
  return Object.fromEntries(
    Object.entries(section).map(([name, component]) => [name, labelledComponent(component)]),
  );
}

export function decodedHealthReport(report: unknown): unknown {
  if (!isRecord(report)) return report;
  const decoded: Record<string, unknown> = { ...report };
  for (const section of REPORT_SECTIONS) {
    if (section in report) decoded[section] = labelledSection(report[section]);
  }
  return decoded;
}

export function toolResultText(toolName: string, text: string): string {
  if (toolName !== HEALTH_TOOL) return text;
  try {
    return JSON.stringify(decodedHealthReport(JSON.parse(text)));
  } catch {
    return text;
  }
}
