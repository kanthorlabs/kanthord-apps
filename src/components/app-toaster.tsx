import { useIsMobile } from "@/hooks/use-mobile";
import { Toaster } from "./ui/sonner";

const TOP_OFFSET = { top: 64 };

const TOAST_CLASS_NAMES = {
  toast: "cn-toast max-[699px]:pointer-events-none",
  actionButton: "pointer-events-auto",
};

export function AppToaster() {
  const isMobile = useIsMobile();
  return (
    <Toaster
      position={isMobile ? "top-center" : "top-right"}
      offset={TOP_OFFSET}
      mobileOffset={TOP_OFFSET}
      toastOptions={{ classNames: TOAST_CLASS_NAMES }}
    />
  );
}
