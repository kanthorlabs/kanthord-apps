import type { WorkbenchActionOffer } from "@/api/types";
import type { ActResult } from "@/hooks/act-result";

export interface ActionActProps {
  readonly offer: WorkbenchActionOffer;
  readonly onSettled: (result: ActResult) => void;
  readonly onLine: (line: string) => void;
  readonly onDialogClosed: () => void;
}
