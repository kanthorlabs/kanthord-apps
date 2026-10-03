import { Fragment } from "react";
import { Link, useLocation } from "react-router-dom";

import { breadcrumbTrail } from "@/lib/breadcrumb-trail";
import { ROUTE_LABELS } from "./app-nav";
import { useCrumbLabels } from "./crumb-labels";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "./ui/breadcrumb";

export function AppBreadcrumb() {
  const { pathname } = useLocation();
  const labels = useCrumbLabels();
  const trail = breadcrumbTrail(pathname, (path) => labels.get(path) ?? ROUTE_LABELS.get(path));
  const current = trail.at(-1);

  return (
    <>
      <h1 className="sr-only">{current?.label}</h1>
      <Breadcrumb className="min-w-0">
        <BreadcrumbList>
          {trail.map((crumb, index) => (
            <Fragment key={crumb.path}>
              {index > 0 && <BreadcrumbSeparator />}
              <BreadcrumbItem className="min-w-0">
                {crumb === current ? (
                  <BreadcrumbPage className="break-all">{crumb.label}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink className="break-all" render={<Link to={crumb.path} />}>
                    {crumb.label}
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
            </Fragment>
          ))}
        </BreadcrumbList>
      </Breadcrumb>
    </>
  );
}
