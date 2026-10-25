import { Link } from "react-router-dom";

import { TouchTarget } from "@/components/touch-target";
import { Button } from "@/components/ui/button";

export function TracesLink({ path }: { readonly path: string }) {
  return (
    <TouchTarget>
      <Button nativeButton={false} variant="outline" size="sm" render={<Link to={path} />}>
        Traces
      </Button>
    </TouchTarget>
  );
}
