import { useId } from "react";

import { DataList } from "@/components/data-list";
import { DataListItem } from "@/components/data-list-item";
import { TouchTarget } from "@/components/touch-target";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Kbd } from "@/components/ui/kbd";
import { Switch } from "@/components/ui/switch";
import { BOARD_SHORTCUTS } from "@/lib/board-keys";

import { useShortcutSetting } from "../use-shortcut-setting";

interface BoardShortcutsDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
}

export function BoardShortcutsDialog({ open, onOpenChange }: BoardShortcutsDialogProps) {
  const switchId = useId();
  const { enabled, setEnabled } = useShortcutSetting();

  return (
    <>
      <div className="[@media(hover:none)]:hidden">
        <TouchTarget>
          <Button
            variant="outline"
            size="icon"
            aria-label="Keyboard shortcuts"
            onClick={() => onOpenChange(true)}
          >
            <span aria-hidden="true">?</span>
          </Button>
        </TouchTarget>
      </div>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[calc(100svh-2rem)] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Keyboard shortcuts</DialogTitle>
            <DialogDescription>
              The arrows, Home, End, Enter and Esc stay on when you turn the shortcuts off.
            </DialogDescription>
          </DialogHeader>
          <Field orientation="horizontal">
            <Switch id={switchId} checked={enabled} onCheckedChange={setEnabled} />
            <FieldLabel htmlFor={switchId}>Single-key shortcuts</FieldLabel>
          </Field>
          <DataList
            label="Shortcuts"
            items={BOARD_SHORTCUTS}
            getKey={(shortcut) => shortcut.id}
            renderItem={(shortcut) => (
              <DataListItem title={shortcut.meaning} status={<Kbd>{shortcut.keys}</Kbd>} />
            )}
            status="ready"
            error={null}
            pending={false}
            emptyText="No shortcut."
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
