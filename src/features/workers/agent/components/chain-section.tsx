import type { AgentChainEntry, AgentCooling } from "@/api/types";
import { RecordName } from "@/components/record-name";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Item, ItemContent, ItemGroup, ItemTitle } from "@/components/ui/item";
import { utcDateTime } from "@/lib/format";
import { type ChainRow, useAgentChain } from "../use-agent-chain";

interface ChainSectionProps {
  readonly chain: readonly AgentChainEntry[];
  readonly activePosition: number | null;
  readonly cooling: AgentCooling | null;
  readonly readAt: number;
}

function CooldownText({ row }: { row: ChainRow }) {
  const cooldown = row.entry.cooldown;
  if (row.cooldown === "none" || cooldown === null) return <>No cooldown.</>;
  if (row.cooldown === "expired") {
    return (
      <>
        No live cooldown. Strike {cooldown.strikes} ended at {utcDateTime(cooldown.available_at)}.
      </>
    );
  }
  return (
    <>
      Strike {cooldown.strikes}. Claims skip this credential until{" "}
      {utcDateTime(cooldown.available_at)}.
    </>
  );
}

export function ChainSection({ chain, activePosition, cooling, readAt }: ChainSectionProps) {
  const rows = useAgentChain(chain, activePosition, readAt);
  return (
    <Card role="region" aria-labelledby="agent-chain">
      <CardHeader>
        <h2 id="agent-chain" className="font-semibold leading-none">
          Fallback chain
        </h2>
      </CardHeader>
      <CardContent className="grid gap-4">
        <p className="text-sm text-muted-foreground">
          A claim at the server uses the first entry whose credential has no live cooldown on the
          server copy.
        </p>
        {cooling !== null && (
          <Alert>
            <AlertTitle>The chain of this agent cools down.</AlertTitle>
            <AlertDescription>
              Every credential of the chain cools down until {utcDateTime(cooling.available_at)}. A
              claim that needs this agent waits until then.
            </AlertDescription>
          </Alert>
        )}
        {rows.length === 0 ? (
          <p className="text-sm">No chain. The enablement is absent, disabled or invalid.</p>
        ) : (
          <ItemGroup aria-label="Fallback chain" className="gap-2">
            {rows.map((row) => (
              <Item key={row.entry.position} variant="outline" size="sm" role="listitem">
                <ItemContent className="min-w-0">
                  <ItemTitle className="flex flex-wrap items-center gap-2">
                    <span className="tabular-nums">#{row.entry.position}</span>
                    <span className="font-mono break-all">{row.entry.model_identifier}</span>
                    <Badge variant="outline">{row.entry.level}</Badge>
                    {row.active && <Badge>active</Badge>}
                  </ItemTitle>
                  <p className="text-sm break-words text-muted-foreground">
                    <RecordName>{row.entry.agent_provider}</RecordName> ·{" "}
                    <RecordName>{row.entry.provider}</RecordName> · credential{" "}
                    <RecordName>{row.entry.credential}</RecordName> · effort{" "}
                    <span className="font-mono">{row.entry.reasoning_effort}</span>
                  </p>
                  <p className="text-sm">
                    <CooldownText row={row} />
                  </p>
                </ItemContent>
              </Item>
            ))}
          </ItemGroup>
        )}
      </CardContent>
    </Card>
  );
}
