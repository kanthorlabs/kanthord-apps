import { useIsMobile } from "@/hooks/use-mobile";
import { Toaster } from "./ui/sonner";

const MOBILE_OFFSET = { top: 64 };

export function AppToaster() {
  const isMobile = useIsMobile();
  return (
    <Toaster position={isMobile ? "top-center" : "bottom-right"} mobileOffset={MOBILE_OFFSET} />
  );
}
