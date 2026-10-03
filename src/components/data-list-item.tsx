import type { ReactNode } from "react";

import { Item, ItemActions, ItemContent, ItemDescription, ItemTitle } from "@/components/ui/item";

export interface DataListField {
  readonly label: string;
  readonly value: ReactNode;
}

export interface DataListItemProps {
  readonly title: ReactNode;
  readonly status?: ReactNode;
  readonly description?: ReactNode;
  readonly fields?: readonly DataListField[];
  readonly actions?: ReactNode;
}

export function DataListItem({ title, status, description, fields, actions }: DataListItemProps) {
  return (
    <Item variant="outline" role="listitem">
      <ItemContent className="min-w-0">
        <ItemTitle className="w-full flex-wrap">
          <span className="min-w-0 break-words">{title}</span>
          {status}
        </ItemTitle>
        {description !== undefined && <ItemDescription>{description}</ItemDescription>}
        {fields !== undefined && fields.length > 0 && (
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            {fields.map((field) => (
              <div key={field.label} className="min-w-0">
                <dt className="min-w-0 break-words text-muted-foreground">{field.label}</dt>
                <dd className="min-w-0 break-words">{field.value}</dd>
              </div>
            ))}
          </dl>
        )}
      </ItemContent>
      {actions !== undefined && (
        <ItemActions className="basis-full flex-wrap md:basis-auto">{actions}</ItemActions>
      )}
    </Item>
  );
}
