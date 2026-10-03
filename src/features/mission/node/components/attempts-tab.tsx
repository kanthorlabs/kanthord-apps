import type { Assessment, Attempt, CurrencyCheck } from "@/api/types";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Item, ItemContent, ItemGroup, ItemTitle } from "@/components/ui/item";
import { relativeTime } from "@/lib/format";
import { basisAssessment, basisKind } from "@/lib/outcome-basis";

import { assertedResult, verdictResult } from "../result-label";

type Currency = Readonly<Record<CurrencyCheck, boolean>>;

function isCurrent(currency: Currency): boolean {
  return currency.context && currency.authority && currency.order;
}

function failingChecks(currency: Currency): readonly CurrencyCheck[] {
  const failing: CurrencyCheck[] = [];
  if (!currency.context) failing.push("context");
  if (!currency.authority) failing.push("authority");
  if (!currency.order) failing.push("order");
  return failing;
}

function CurrencyBadge({ assessment }: { assessment: Assessment }) {
  if (assessment.currency === null) return null;

  const current = isCurrent(assessment.currency);
  const failing = failingChecks(assessment.currency);

  if (current) {
    return <Badge variant="secondary">CURRENT</Badge>;
  }

  return (
    <>
      <Badge variant="destructive">NOT CURRENT</Badge>
      <span className="text-xs">failing: {failing.join(", ")}</span>
    </>
  );
}

function AssessmentSection({ assessment }: { assessment: Assessment }) {
  return (
    <Item role="listitem" variant="outline" size="sm">
      <ItemContent className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <ItemTitle>Assessment</ItemTitle>
          <Badge variant={assessment.verdict === "meets" ? "secondary" : "destructive"}>
            {verdictResult(assessment.verdict)}
          </Badge>
          <CurrencyBadge assessment={assessment} />
        </div>
        <dl className="grid grid-cols-1 gap-y-1 text-xs text-muted-foreground sm:grid-cols-2">
          <div className="flex gap-1">
            <dt>Node revision:</dt>
            <dd className="font-mono break-all text-foreground">{assessment.nodeRevisionId}</dd>
          </div>
          <div className="flex gap-1">
            <dt>Actor:</dt>
            <dd className="text-foreground">{assessment.actor.name}</dd>
          </div>
          <div className="flex gap-1">
            <dt>Created:</dt>
            <dd className="text-foreground">{relativeTime(assessment.time)}</dd>
          </div>
        </dl>
      </ItemContent>
    </Item>
  );
}

function OutcomeSection({ attempt }: { attempt: Attempt }) {
  const { outcome } = attempt;
  if (outcome === null) return null;

  const assessment = basisAssessment(attempt, outcome);
  const basisPasses = assessment.verdict === "meets";
  const isNonSuccess = outcome.assertedResult !== "success";
  const externalFailedWithPassingBasis = isNonSuccess && basisPasses;

  return (
    <Item variant="outline" size="sm">
      <ItemContent className="min-w-0">
        <ItemTitle>Outcome</ItemTitle>
        {externalFailedWithPassingBasis && (
          <Alert>
            <AlertDescription>
              This outcome is not success. The basis assessment passes; a requested external action
              that ended in another state is the cause.
            </AlertDescription>
          </Alert>
        )}
        <dl className="grid grid-cols-1 gap-y-1 text-xs text-muted-foreground sm:grid-cols-2">
          <div className="flex gap-1">
            <dt>Closing event:</dt>
            <dd className="text-foreground">{outcome.closingEvent}</dd>
          </div>
          <div className="flex gap-1">
            <dt>Result:</dt>
            <dd className="text-foreground">{assertedResult(outcome.assertedResult)}</dd>
          </div>
          <div className="flex gap-1">
            <dt>Assessment:</dt>
            <dd className="font-mono break-all text-foreground">{outcome.assessmentId}</dd>
          </div>
          <div className="flex gap-1">
            <dt>Basis:</dt>
            <dd className="text-foreground">{basisKind(assessment)}</dd>
          </div>
          <div className="flex gap-1">
            <dt>Stopping reason:</dt>
            <dd className="text-foreground">{outcome.stoppingReason}</dd>
          </div>
          <div className="flex gap-1">
            <dt>Created:</dt>
            <dd className="text-foreground">{relativeTime(outcome.time)}</dd>
          </div>
        </dl>
      </ItemContent>
    </Item>
  );
}

interface AttemptsTabProps {
  readonly attempts: readonly Attempt[];
}

export function AttemptsTab({ attempts }: AttemptsTabProps) {
  if (attempts.length === 0) {
    return <p className="p-4 text-sm text-muted-foreground">No attempts yet.</p>;
  }

  const sorted = [...attempts].sort((a, b) => b.ordinal - a.ordinal);

  return (
    <div className="space-y-6 p-4">
      {sorted.map((attempt) => (
        <section key={attempt.id} className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-semibold">Attempt {attempt.ordinal}</h2>
            <Badge variant={attempt.open ? "default" : "outline"}>
              {attempt.open ? "open" : "closed"}
            </Badge>
            <span className="font-mono text-xs break-all text-muted-foreground">
              pinned revision {attempt.pinnedRevisionId}
            </span>
          </div>
          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
            <span>Opened {relativeTime(attempt.openedAt)}</span>
            {attempt.closedAt !== null && <span>Closed {relativeTime(attempt.closedAt)}</span>}
          </div>

          {attempt.evidence.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Evidence
              </p>
              <ItemGroup aria-label="Evidence" className="gap-2">
                {attempt.evidence.map((ev) => (
                  <Item key={ev.id} role="listitem" variant="outline" size="sm">
                    <ItemContent className="min-w-0">
                      <div className="space-y-1 text-xs">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium text-foreground">{ev.subject}</span>
                          {ev.redacted && <Badge variant="destructive">REDACTED</Badge>}
                        </div>
                        <p className="text-muted-foreground">
                          Address:{" "}
                          <span className="font-mono break-all text-foreground">
                            {ev.contentAddress}
                          </span>
                        </p>
                        <p className="text-muted-foreground">
                          Provenance: <span className="text-foreground">{ev.provenance}</span>
                        </p>
                        <p className="text-muted-foreground">
                          Scope: <span className="text-foreground">{ev.scope}</span>
                        </p>
                        <p className="text-muted-foreground">
                          Created: <span className="text-foreground">{relativeTime(ev.time)}</span>
                        </p>
                      </div>
                    </ItemContent>
                  </Item>
                ))}
              </ItemGroup>
            </div>
          )}

          {attempt.assessments.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Assessments
              </p>
              <ItemGroup aria-label="Assessments" className="gap-2">
                {attempt.assessments.map((a) => (
                  <AssessmentSection key={a.id} assessment={a} />
                ))}
              </ItemGroup>
            </div>
          )}

          <OutcomeSection attempt={attempt} />

          {attempt.externalObjects.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                External actions
              </p>
              <ItemGroup aria-label="External actions" className="gap-2">
                {attempt.externalObjects.map((eo) => (
                  <Item key={eo.id} role="listitem" variant="outline" size="sm">
                    <ItemContent className="min-w-0">
                      <div className="space-y-1 text-xs">
                        <p className="font-medium text-foreground">{eo.action}</p>
                        <p className="text-muted-foreground">
                          Label: <span className="text-foreground">{eo.label}</span>
                        </p>
                        <a
                          href={eo.address}
                          target="_blank"
                          rel="noreferrer"
                          className="break-all text-primary underline-offset-4 hover:underline"
                        >
                          {eo.address}
                        </a>
                        {eo.expectedEndState !== null && (
                          <p className="text-muted-foreground">
                            Expected end state:{" "}
                            <span className="text-foreground">{eo.expectedEndState}</span>
                          </p>
                        )}
                        {eo.observedState !== null && (
                          <p className="text-muted-foreground">
                            Observed state:{" "}
                            <span className="text-foreground">{eo.observedState}</span>
                          </p>
                        )}
                        <p className="text-muted-foreground">
                          Resolved:{" "}
                          <span className="text-foreground">{eo.resolved ? "yes" : "no"}</span>
                        </p>
                      </div>
                    </ItemContent>
                  </Item>
                ))}
              </ItemGroup>
            </div>
          )}
        </section>
      ))}
    </div>
  );
}
