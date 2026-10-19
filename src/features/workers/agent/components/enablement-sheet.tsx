import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { EnablementForm } from "./enablement-form";

interface EnablementSheetProps {
  readonly agentName: string;
  readonly reload: () => void;
  readonly onClose: () => void;
}

export function EnablementSheet({ agentName, reload, onClose }: EnablementSheetProps) {
  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="data-[side=right]:w-full data-[side=right]:sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Enable {agentName}</SheetTitle>
          <SheetDescription>
            The binding sheet stays open behind this sheet. Its input stays.
          </SheetDescription>
        </SheetHeader>
        <div className="overflow-y-auto px-4 pb-4">
          <EnablementForm agentName={agentName} reload={reload} onEnabled={onClose} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
