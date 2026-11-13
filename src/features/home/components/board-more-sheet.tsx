import type { ReactNode } from "react";

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

export function BoardMoreSheet({ subject, count, children, last }: BoardMoreSheetProps) {
  return (
    <Sheet>
      <TouchTarget>
        <SheetTrigger render={<Button variant="outline" size="sm" />}>More ({count})</SheetTrigger>
      </TouchTarget>
      <SheetContent side="bottom" showCloseButton={false}>
        <div className="flex flex-col gap-4 pb-[env(safe-area-inset-bottom)]">
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
