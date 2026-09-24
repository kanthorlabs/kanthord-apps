import type { DependencyClosure } from "@/api/types";
import { stateClasses } from "@/lib/node-state";

interface DependenciesTabProps {
  readonly closure: DependencyClosure;
}

export function DependenciesTab({ closure }: DependenciesTabProps) {
  return (
    <div className="space-y-4 p-4">
      <div className="rounded-md border p-3">
        <p className="text-sm">
          The dependency closure gates the transition from{" "}
          <span className="font-semibold">Pending</span> to{" "}
          <span className="font-semibold">Available</span>. The closure holds when every member is{" "}
          <span className="font-semibold">Completed</span>.
        </p>
        <p className="mt-2 text-sm font-semibold">
          Closure status:{" "}
          <span
            className={`inline-flex items-center rounded border px-1.5 py-0 text-xs ${closure.holds ? "border-emerald-300 bg-emerald-100 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200" : "border-amber-300 bg-amber-100 text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200"}`}
          >
            {closure.holds ? "holds" : "does not hold"}
          </span>
        </p>
      </div>

      {closure.members.length === 0 ? (
        <p className="text-sm text-muted-foreground">No dependency members.</p>
      ) : (
        <div className="space-y-2">
          {closure.members.map((member) => (
            <div
              key={member.nodeId}
              className="flex flex-wrap items-center gap-2 rounded-md border p-2 text-sm"
            >
              <span className="flex-1 font-medium">{member.title}</span>
              {member.state !== null ? (
                <span
                  className={`inline-flex items-center rounded border px-1.5 py-0 text-xs font-medium ${stateClasses(member.state)}`}
                >
                  {member.state}
                </span>
              ) : (
                <span className="text-xs text-muted-foreground">task</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
