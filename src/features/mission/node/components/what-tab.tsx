import type { MissionNode } from "@/api/types";

interface WhatTabProps {
  readonly node: MissionNode;
}

export function WhatTab({ node }: WhatTabProps) {
  return (
    <div className="space-y-6 p-4">
      <section>
        <h2 className="mb-1 text-sm font-semibold text-muted-foreground">Requirement</h2>
        <p className="text-sm">{node.goal}</p>
      </section>

      {node.validationCriteria.length > 0 && (
        <section>
          <h2 className="mb-1 text-sm font-semibold text-muted-foreground">Criterion</h2>
          <ul className="list-disc pl-5 space-y-1">
            {node.validationCriteria.map((vc) => (
              <li key={vc.id} className="text-sm">
                {vc.text}
              </li>
            ))}
          </ul>
        </section>
      )}

      {node.verificationCommand !== null && (
        <section>
          <h2 className="mb-1 text-sm font-semibold text-muted-foreground">Verifications</h2>
          <code className="rounded bg-muted px-2 py-1 text-sm font-mono break-all">
            {node.verificationCommand}
          </code>
        </section>
      )}

      {node.repositoryBindingId !== null && (
        <section>
          <h2 className="mb-1 text-sm font-semibold text-muted-foreground">Repository binding</h2>
          <p className="text-sm font-mono break-all">{node.repositoryBindingId}</p>
        </section>
      )}

      {node.steps.length > 0 && (
        <section>
          <h2 className="mb-1 text-sm font-semibold text-muted-foreground">Steps</h2>
          <ol className="list-decimal pl-5 space-y-1">
            {node.steps.map((step, i) => (
              <li key={i} className="text-sm">
                {step}
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}
