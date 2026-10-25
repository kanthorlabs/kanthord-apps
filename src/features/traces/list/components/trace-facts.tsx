import type { TraceFact } from "@/lib/trace-facts";

interface TraceFactsProps {
  readonly facts: readonly TraceFact[];
}

export function TraceFacts({ facts }: TraceFactsProps) {
  return (
    <dl className="flex min-w-0 flex-wrap gap-x-3 gap-y-0.5 text-xs md:flex-nowrap">
      {facts.map((fact) => (
        <div key={fact.label} className="flex min-w-0 items-baseline gap-1">
          <dt className="sr-only text-muted-foreground md:not-sr-only">{fact.label}</dt>
          <dd className="min-w-0 break-words">
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
