import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Item, ItemActions, ItemContent, ItemDescription, ItemTitle } from "@/components/ui/item";

export interface DataListField {
  readonly label: string;
  readonly value: ReactNode;
}

export interface DataListSelect {
  readonly label: string;
  readonly disabled: boolean;
  readonly onSelect: () => void;
}

export interface DataListItemProps {
  readonly title: ReactNode;
  readonly status?: ReactNode;
  readonly description?: ReactNode;
  readonly fields?: readonly DataListField[];
  readonly notice?: ReactNode;
  readonly actions?: ReactNode;
  readonly select?: DataListSelect;
}

export function DataListItem({
  title,
  status,
  description,
  fields,
  notice,
  actions,
  select,
}: DataListItemProps) {
  return (
    <Item variant="outline" role="listitem" className="relative">
      <ItemContent className="min-w-0">
        <ItemTitle className="w-full flex-wrap">
          {select === undefined ? (
            <span className="min-w-0 break-words">{title}</span>
          ) : (
            <Button
              variant="link"
              aria-label={select.label}
              disabled={select.disabled}
              onClick={select.onSelect}
              className="-mx-2.5 max-w-full min-w-0 after:absolute after:inset-0 active:translate-none!"
            >
              <span className="truncate">{title}</span>
            </Button>
          )}
          {status}
        </ItemTitle>
        {description !== undefined && (
          <ItemDescription>
            <span className="break-words">{description}</span>
          </ItemDescription>
        )}
        {fields !== undefined && fields.length > 0 && (
          <dl className="flex min-w-0 flex-wrap gap-x-4 gap-y-1 text-sm">
            {fields.map((field) => (
              <div key={field.label} className="flex max-w-full min-w-0 items-baseline gap-1.5">
                <dt className="shrink-0 text-muted-foreground">{field.label}</dt>
                <dd className="min-w-0 break-words">{field.value}</dd>
              </div>
            ))}
          </dl>
        )}
        {notice !== undefined && <div className="min-w-0">{notice}</div>}
      </ItemContent>
      {actions !== undefined && (
        <ItemActions className="relative basis-full flex-wrap md:basis-auto">{actions}</ItemActions>
      )}
    </Item>
  );
}
