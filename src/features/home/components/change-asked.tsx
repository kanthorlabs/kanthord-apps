import { RecordName } from "@/components/record-name";
import { changeAskedOf } from "@/lib/board-change";

import type { BoardReadsValue } from "../use-board-reads";
import { BoardReadBlock } from "./board-read-block";

const TEXT_WIDTH = "max-w-[80ch] break-words";
const LOG_BLOCK =
  "min-w-0 rounded-md bg-muted p-2 font-mono text-xs break-words whitespace-pre-wrap";

export function ChangeAskedSection({ reads }: { readonly reads: BoardReadsValue }) {
  return (
    <div className="flex flex-col gap-2">
      <h4 className="text-sm font-semibold">Change asked</h4>
      <BoardReadBlock name="the session" read={reads.session} onRetry={reads.retry.session}>
        {(pending) => {
          const change = changeAskedOf(pending);
          if (change === null)
            return <p className={`text-sm ${TEXT_WIDTH}`}>The call no longer waits.</p>;
          return (
            <div className="flex flex-col gap-2">
              <p className={`text-sm ${TEXT_WIDTH}`}>
                Operation <RecordName>{change.operationId}</RecordName>
              </p>
              {change.rows.map((row) => (
                <div key={row.field} className="flex flex-col gap-1">
                  <p className="text-sm font-medium break-words">{row.label}</p>
                  {row.json ? (
                    <pre className={LOG_BLOCK}>{row.text}</pre>
                  ) : (
                    <p className={`text-sm ${TEXT_WIDTH}`}>{row.text}</p>
                  )}
                </div>
              ))}
            </div>
          );
        }}
      </BoardReadBlock>
    </div>
  );
}
