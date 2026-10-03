import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { diagnosticText, type GraphModel } from "@/lib/mission-graph";

interface GraphDiagnosticsProps {
  readonly model: GraphModel;
  readonly changedDuringRead: boolean;
  readonly onReload: () => void;
}

export function GraphDiagnostics({ model, changedDuringRead, onReload }: GraphDiagnosticsProps) {
  if (!changedDuringRead && model.diagnostics.length === 0) return null;

  return (
    <Alert>
      <AlertTitle>The graph can be incomplete.</AlertTitle>
      <AlertDescription className="flex flex-col items-start gap-2">
        <ul className="flex list-disc flex-col gap-1 pl-4">
          {changedDuringRead && (
            <li>The mission changed during the read. A dependency state can be out of date.</li>
          )}
          {model.diagnostics.map((diagnostic) => (
            <li key={diagnosticText(model, diagnostic)}>{diagnosticText(model, diagnostic)}</li>
          ))}
        </ul>
        <Button variant="outline" size="sm" onClick={onReload}>
          Reload the graph
        </Button>
      </AlertDescription>
    </Alert>
  );
}
