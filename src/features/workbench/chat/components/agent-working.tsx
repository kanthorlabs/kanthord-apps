import { Spinner } from "@/components/ui/spinner";

export function AgentWorking({ seconds }: { seconds: number }) {
  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <Spinner aria-hidden="true" />
      <span role="status">The agent is working</span>
      <span aria-hidden="true" className="tabular-nums">
        {seconds}s
      </span>
    </div>
  );
}
