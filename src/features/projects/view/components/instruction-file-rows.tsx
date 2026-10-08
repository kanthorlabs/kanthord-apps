import { EyeIcon } from "lucide-react";

import type { InstructionFile, WorkingLayerKey, WorkingLayerSwitches } from "@/api/types";
import { Reveal } from "@/components/reveal";
import { Button } from "@/components/ui/button";
import { absentFilesLabel } from "@/lib/instruction-files";
import { InstructionRow } from "./instruction-row";

interface InstructionFileRowsProps {
  readonly files: readonly InstructionFile[];
  readonly switches: WorkingLayerSwitches;
  readonly absentShown: boolean;
  readonly onShowAbsent: () => void;
  readonly onToggle: (key: WorkingLayerKey, enabled: boolean) => void;
}

export function InstructionFileRows({
  files,
  switches,
  absentShown,
  onShowAbsent,
  onToggle,
}: InstructionFileRowsProps) {
  const absentCount = files.filter((file) => file.state === "absent").length;
  return (
    <>
      {files.map((file) => (
        <Reveal key={file.source} open={file.state !== "absent" || absentShown}>
          <div className="pb-2">
            <InstructionRow
              title={file.path}
              path
              text={file.text}
              state={file.state}
              reason={file.reason}
              enabled={switches[file.source]}
              onToggle={(enabled) => onToggle(file.source, enabled)}
            />
          </div>
        </Reveal>
      ))}
      <Reveal open={!absentShown && absentCount > 0}>
        <div className="pb-2">
          <Button type="button" variant="ghost" size="sm" onClick={onShowAbsent}>
            <EyeIcon aria-hidden="true" data-icon="inline-start" />
            {absentFilesLabel(absentCount)}
          </Button>
        </div>
      </Reveal>
    </>
  );
}
