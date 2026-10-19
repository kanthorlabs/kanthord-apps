import { useIsMobile } from "@/hooks/use-mobile";
import { Toaster } from "./ui/sonner";

const TOP_OFFSET = { top: 64 };

export function AppToaster() {
  const isMobile = useIsMobile();
  return (
    <Toaster
      position={isMobile ? "top-center" : "top-right"}
      offset={TOP_OFFSET}
      mobileOffset={TOP_OFFSET}
    />
  );
}
