import { ChoiceField } from "@/components/choice-field";
import { CONTAINER_RUNTIMES, HOST_KINDS, isContainerKind } from "@/lib/instance-host";
import type { MachineHostState } from "../use-machine-host";

interface MachineHostFieldsProps {
  readonly host: MachineHostState;
  readonly error: string | undefined;
}

export function MachineHostFields({ host, error }: MachineHostFieldsProps) {
  return (
    <>
      <ChoiceField
        id="machine-host-kind"
        label="Where does it run?"
        value={host.kind ?? ""}
        options={HOST_KINDS}
        error={error}
        description="The page shows the machine copy block of this host kind. The server stores no host kind."
        onChange={host.selectKind}
      />
      {isContainerKind(host.kind) && (
        <ChoiceField
          id="machine-container-runtime"
          label="Container runtime"
          value={host.runtime}
          options={CONTAINER_RUNTIMES}
          error={undefined}
          description="The page shows the commands of this runtime. Podman is the default."
          onChange={host.selectRuntime}
        />
      )}
    </>
  );
}
