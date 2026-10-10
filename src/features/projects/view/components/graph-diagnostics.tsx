import { Fragment } from "react";

import { RecordName } from "@/components/record-name";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { diagnosticKey, nameOf, type GraphDiagnostic, type GraphModel } from "@/lib/mission-graph";

interface GraphDiagnosticsProps {
  readonly model: GraphModel;
  readonly changedDuringRead: boolean;
  readonly onReload: () => void;
}

function DiagnosticLine({ model, diagnostic }: { model: GraphModel; diagnostic: GraphDiagnostic }) {
  if (diagnostic.kind === "unresolved-dependency") {
    const { dependentId, dependsOnId } = diagnostic.link;
    return (
      <>
        A dependency of <RecordName>{nameOf(model, dependentId)}</RecordName> names{" "}
        <RecordName>{nameOf(model, dependsOnId)}</RecordName>, and the read does not hold that node.
      </>
    );
  }
  if (diagnostic.kind === "unplaced-node") {
    return (
      <>
        The node <RecordName>{nameOf(model, diagnostic.nodeId)}</RecordName> has no place under an
        initiative, so the graph does not show it.
      </>
    );
  }
  return (
    <>
      The dependencies of{" "}
      {diagnostic.nodeIds.map((id, index) => (
        <Fragment key={id}>
          {index > 0 && ", "}
          <RecordName>{nameOf(model, id)}</RecordName>
        </Fragment>
      ))}{" "}
      form a cycle, so each of these nodes waits for another node of the cycle.
    </>
  );
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
            <li key={diagnosticKey(diagnostic)}>
              <DiagnosticLine model={model} diagnostic={diagnostic} />
            </li>
          ))}
        </ul>
        <Button variant="outline" size="sm" onClick={onReload}>
          Reload the graph
        </Button>
      </AlertDescription>
    </Alert>
  );
}
