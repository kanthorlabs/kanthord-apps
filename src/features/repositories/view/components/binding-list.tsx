import { ExternalLinkIcon } from "lucide-react";
import { Link } from "react-router-dom";

import type { CredentialBinding } from "@/api/types";
import { DataListItem } from "@/components/data-list-item";
import { RecordName } from "@/components/record-name";
import { Button } from "@/components/ui/button";
import { Empty, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { ItemGroup } from "@/components/ui/item";
import { projectTabPath } from "@/features/projects/view/use-project-tab";

export function BindingList({ bindings }: { bindings: readonly CredentialBinding[] }) {
  return (
    <section aria-labelledby="credential-bindings" className="flex flex-col gap-2">
      <h3 id="credential-bindings" className="font-semibold">
        Bindings
      </h3>
      {bindings.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>No binding names this credential.</EmptyTitle>
          </EmptyHeader>
        </Empty>
      ) : (
        <ItemGroup aria-label="Bindings" className="gap-2">
          {bindings.map((binding) => (
            <DataListItem
              key={binding.binding_id}
              title={binding.name}
              fields={[
                { label: "Project", value: <RecordName>{binding.project_name}</RecordName> },
              ]}
              actions={
                <Button
                  nativeButton={false}
                  render={<Link to={projectTabPath(binding.project_id, "bindings")} />}
                  variant="outline"
                  size="sm"
                  aria-label={`Bindings of ${binding.project_name}`}
                >
                  <ExternalLinkIcon aria-hidden="true" data-icon="inline-start" />
                  Open bindings
                </Button>
              }
            />
          ))}
        </ItemGroup>
      )}
    </section>
  );
}
