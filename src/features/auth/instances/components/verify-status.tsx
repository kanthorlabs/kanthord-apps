import { RecordName } from "@/components/record-name";
import { Badge } from "@/components/ui/badge";
import type { VerifyState } from "../use-instance-verify";

const LABEL: Record<VerifyState["status"], string> = {
  checking: "Checking…",
  reachable: "Reachable",
  unhealthy: "Unhealthy",
  unreachable: "Unreachable",
  failed: "Failed",
};

const VARIANT: Record<VerifyState["status"], "outline" | "secondary" | "destructive"> = {
  checking: "outline",
  reachable: "secondary",
  unhealthy: "destructive",
  unreachable: "destructive",
  failed: "destructive",
};

function Detail({ state }: { state: VerifyState }) {
  switch (state.status) {
    case "unhealthy":
      return state.failing.length === 0 ? (
        <p>The instance answered that it is unhealthy.</p>
      ) : (
        <div>
          <p>Failing components:</p>
          <ul className="list-disc pl-5 break-all">
            {state.failing.map((component) => (
              <li key={component}>
                <RecordName>{component}</RecordName>
              </li>
            ))}
          </ul>
        </div>
      );
    case "unreachable":
      return (
        <p className="break-words">
          The instance did not answer. Its configured origins may not include this dashboard origin,{" "}
          {state.origin}.
        </p>
      );
    case "failed":
      return <p>{state.message}</p>;
    default:
      return null;
  }
}

export function VerifyStatus({ state }: { state: VerifyState | undefined }) {
  if (state === undefined || state.status === "checking") return null;
  return (
    <div role="status" className="flex min-w-0 flex-col gap-1 text-sm text-muted-foreground">
      <Badge variant={VARIANT[state.status]}>{LABEL[state.status]}</Badge>
      <Detail state={state} />
    </div>
  );
}
