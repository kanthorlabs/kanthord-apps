import { Fragment } from "react";
import { ShieldAlertIcon } from "lucide-react";

import { RecordName } from "@/components/record-name";
import { Alert, AlertDescription } from "@/components/ui/alert";

function joined(names: readonly string[]) {
  return names.map((name, index) => (
    <Fragment key={name}>
      {index === 0 ? "" : index === names.length - 1 ? " and " : ", "}
      <RecordName>{name}</RecordName>
    </Fragment>
  ));
}

export function InstanceReachNotice({
  instance,
  projects,
}: {
  instance: string;
  projects: readonly string[];
}) {
  if (projects.length < 2) return null;
  return (
    <Alert>
      <ShieldAlertIcon aria-hidden="true" />
      <AlertDescription>
        <p>
          <RecordName>{instance}</RecordName> serves {joined(projects)}. A tool of{" "}
          {projects.length === 2 ? "either project" : "any of these projects"} can read its key and
          its workspaces.
        </p>
      </AlertDescription>
    </Alert>
  );
}
