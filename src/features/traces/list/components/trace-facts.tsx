import type { TraceFact } from "@/lib/trace-facts";

const WORKER_LABEL = "Worker";

interface TraceFactsProps {
  readonly facts: readonly TraceFact[];
}

export function TraceFacts({ facts }: TraceFactsProps) {
  return (
    <dl className="flex min-w-0 flex-nowrap gap-x-2 text-xs md:gap-x-3">
      {facts.map((fact) => (
        <div
          key={fact.label}
          className={`flex items-baseline gap-1 ${fact.label === WORKER_LABEL ? "min-w-0" : "shrink-0"}`}
        >
          <dt className="sr-only text-muted-foreground md:not-sr-only">{fact.label}</dt>
          <dd className="min-w-0 truncate">
            {fact.compact === fact.value ? (
              fact.value
            ) : (
              <>
                <span className="md:hidden">{fact.compact}</span>
                <span className="hidden md:inline">{fact.value}</span>
              </>
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}
