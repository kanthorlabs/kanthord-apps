import type { ReactNode } from "react";

export interface Fact {
  readonly label: string;
  readonly value: ReactNode;
}

interface FactListProps {
  readonly facts: readonly Fact[];
}

export function FactList({ facts }: FactListProps) {
  return (
    <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1.5 text-sm">
      {facts.map((fact) => (
        <div key={fact.label} className="contents">
          <dt className="text-muted-foreground">{fact.label}</dt>
          <dd className="min-w-0 break-words">{fact.value}</dd>
        </div>
      ))}
    </dl>
  );
}
