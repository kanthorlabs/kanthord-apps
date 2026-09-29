import type { Assessment, Attempt, CurrencyCheck } from "@/api/types";
import { relativeTime } from "@/lib/format";
import { basisAssessment, basisKind } from "@/lib/outcome-basis";

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
    return (
      <span className="inline-flex items-center rounded border border-emerald-300 bg-emerald-100 px-1.5 py-0 text-xs font-semibold text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200">
        CURRENT
      </span>
    );
  }

  return (
    <span
      className="inline-flex items-center rounded border border-red-300 bg-red-100 px-1.5 py-0 text-xs font-semibold text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-200"
      aria-label={`NOT CURRENT — failing: ${failing.join(", ")}`}
    >
      NOT CURRENT — failing: {failing.join(", ")}
    </span>
  );
}

function AssessmentSection({ assessment }: { assessment: Assessment }) {
  return (
    <div className="rounded-md border p-3 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium">Assessment</span>
        <span
          className={`inline-flex items-center rounded border px-1.5 py-0 text-xs font-medium ${assessment.verdict === "meets" ? "border-emerald-300 bg-emerald-100 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200" : "border-red-300 bg-red-100 text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-200"}`}
        >
          {assessment.verdict}
        </span>
        <CurrencyBadge assessment={assessment} />
      </div>
      <dl className="grid grid-cols-1 gap-y-1 text-xs text-muted-foreground sm:grid-cols-2">
        <div className="flex gap-1">
          <dt>Method:</dt>
          <dd className="text-foreground">{assessment.method}</dd>
        </div>
        <div className="flex gap-1">
          <dt>Actor:</dt>
          <dd className="text-foreground">{assessment.actor.name}</dd>
        </div>
        <div className="flex gap-1">
          <dt>Node revision:</dt>
          <dd className="font-mono text-foreground">{assessment.nodeRevisionId}</dd>
        </div>
        <div className="flex gap-1">
          <dt>Time:</dt>
          <dd className="text-foreground">{relativeTime(assessment.time)}</dd>
        </div>
      </dl>
    </div>
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
    <div className="rounded-md border p-3 space-y-2">
      <p className="text-sm font-medium">Outcome</p>
      {externalFailedWithPassingBasis && (
        <p className="rounded bg-amber-50 px-2 py-1 text-xs font-medium text-amber-800 dark:bg-amber-950 dark:text-amber-200">
          This outcome is non-success. The basis assessment passes — the assessment itself did not
          fail.
        </p>
      )}
      <dl className="grid grid-cols-1 gap-y-1 text-xs text-muted-foreground sm:grid-cols-2">
        <div className="flex gap-1">
          <dt>Basis:</dt>
          <dd className="text-foreground">{basisKind(assessment)}</dd>
        </div>
        <div className="flex gap-1">
          <dt>Asserted result:</dt>
          <dd className="text-foreground">{outcome.assertedResult}</dd>
        </div>
        <div className="flex gap-1">
          <dt>Closing event:</dt>
          <dd className="text-foreground">{outcome.closingEvent}</dd>
        </div>
        <div className="flex gap-1">
          <dt>Stopping reason:</dt>
          <dd className="text-foreground">{outcome.stoppingReason}</dd>
        </div>
        <div className="flex gap-1">
          <dt>Assessment:</dt>
          <dd className="font-mono text-foreground">{outcome.assessmentId}</dd>
        </div>
      </dl>
    </div>
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
            <span
              className={`inline-flex items-center rounded border px-1.5 py-0 text-xs font-medium ${attempt.open ? "border-sky-300 bg-sky-100 text-sky-900 dark:border-sky-900 dark:bg-sky-950 dark:text-sky-200" : "border-border bg-muted text-muted-foreground"}`}
            >
              {attempt.open ? "open" : "closed"}
            </span>
            <span className="text-xs text-muted-foreground font-mono">
              pins {attempt.pinnedRevisionId}
            </span>
          </div>

          {attempt.evidence.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Evidence
              </p>
              {attempt.evidence.map((ev) => (
                <div key={ev.id} className="rounded-md border p-3 space-y-1 text-xs">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-foreground">{ev.contentAddress}</span>
                    {ev.redacted && (
                      <span className="rounded border border-red-300 bg-red-100 px-1.5 py-0 font-semibold text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
                        REDACTED
                      </span>
                    )}
                  </div>
                  <p className="text-muted-foreground">
                    Subject: <span className="text-foreground">{ev.subject}</span>
                  </p>
                  <p className="text-muted-foreground">
                    Provenance: <span className="text-foreground">{ev.provenance}</span>
                  </p>
                  <p className="text-muted-foreground">
                    Scope: <span className="text-foreground">{ev.scope}</span>
                  </p>
                </div>
              ))}
            </div>
          )}

          {attempt.assessments.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Assessments
              </p>
              {attempt.assessments.map((a) => (
                <AssessmentSection key={a.id} assessment={a} />
              ))}
            </div>
          )}

          {attempt.externalObjects.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                External objects
              </p>
              {attempt.externalObjects.map((eo) => (
                <div key={eo.id} className="rounded-md border p-3 space-y-1 text-xs">
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
                      Expected: <span className="text-foreground">{eo.expectedEndState}</span>
                    </p>
                  )}
                  {eo.observedState !== null && (
                    <p className="text-muted-foreground">
                      Observed: <span className="text-foreground">{eo.observedState}</span>
                    </p>
                  )}
                  <p className="text-muted-foreground">
                    Resolved: <span className="text-foreground">{eo.resolved ? "yes" : "no"}</span>
                  </p>
                </div>
              ))}
            </div>
          )}

          <OutcomeSection attempt={attempt} />
        </section>
      ))}
    </div>
  );
}
