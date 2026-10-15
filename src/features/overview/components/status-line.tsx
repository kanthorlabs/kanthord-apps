import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Item, ItemActions, ItemContent, ItemDescription } from "@/components/ui/item";
import { statusLineText } from "@/lib/overview-summary";

interface StatusLineProps {
  readonly running: number;
  readonly waiting: number;
  readonly schedulerPath: string;
}

export function StatusLine({ running, waiting, schedulerPath }: StatusLineProps) {
  return (
    <Item variant="muted" size="sm">
      <ItemContent>
        <ItemDescription>{statusLineText(running, waiting)}</ItemDescription>
      </ItemContent>
      <ItemActions>
        <Button
          nativeButton={false}
          render={<Link to={schedulerPath} />}
          variant="outline"
          size="sm"
        >
          Open scheduler
        </Button>
      </ItemActions>
    </Item>
  );
}
