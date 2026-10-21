import { ChoiceField } from "@/components/choice-field";
import { TextField } from "@/components/text-field";
import { HOST_KINDS } from "@/lib/instance-host";
import type { HostAddressState } from "../use-host-address";

interface HostFieldsProps {
  readonly host: HostAddressState;
  readonly errors: Readonly<Record<string, string>>;
}

export function HostFields({ host, errors }: HostFieldsProps) {
  return (
    <>
      <ChoiceField
        id="instance-host-kind"
        label="Where does it run?"
        value={host.kind ?? ""}
        options={HOST_KINDS}
        error={errors["kind"]}
        description="The sheet shows the steps of this host kind. The server stores no host kind."
        onChange={host.selectKind}
      />
      {host.kind !== null && (
        <TextField
          id="instance-address"
          label="Address"
          value={host.address}
          error={errors["address"]}
          description={
            host.hint ??
            "The address of the server that the instance calls. The instance host must reach it."
          }
          onChange={host.setAddress}
        />
      )}
    </>
  );
}
