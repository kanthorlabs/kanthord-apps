import { type MouseEvent, type ReactNode, useState } from "react";

import { TouchTarget } from "@/components/touch-target";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

interface BoardMoreSheetProps {
  readonly subject: string;
  readonly count: number;
  readonly children: ReactNode;
  readonly last: ReactNode;
}

function pressedAct(event: MouseEvent<HTMLElement>): boolean {
  return (
    event.target instanceof Element &&
    event.target.closest("button:enabled:not([aria-disabled=true]), a") !== null
  );
}

export function BoardMoreSheet({ subject, count, children, last }: BoardMoreSheetProps) {
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <TouchTarget>
        <SheetTrigger render={<Button variant="outline" size="sm" />}>More ({count})</SheetTrigger>
      </TouchTarget>
      <SheetContent side="bottom" showCloseButton={false}>
        <div
          role="presentation"
          className="flex flex-col gap-4 pb-[env(safe-area-inset-bottom)]"
          onClick={(event) => pressedAct(event) && setOpen(false)}
        >
          <SheetHeader>
            <SheetTitle>More acts on {subject}</SheetTitle>
          </SheetHeader>
          <div className="flex flex-col gap-2 px-4">{children}</div>
          {last !== null && (
            <div className="flex flex-col gap-4 px-4">
              <Separator />
              {last}
            </div>
          )}
          <SheetFooter>
            <TouchTarget>
              <SheetClose render={<Button variant="outline" size="sm" />}>Cancel</SheetClose>
            </TouchTarget>
          </SheetFooter>
        </div>
      </SheetContent>
    </Sheet>
  );
}
