import { useCallback, useState } from "react";
import { toast } from "sonner";

import { acknowledgeFootprintAlert } from "@/api/resources/footprint";
import type { FootprintAlert } from "@/api/types";
import { useFootprintAlerts } from "@/hooks/use-footprint-alerts";
import { asApiError } from "@/hooks/use-resource";
import {
  acknowledgeFailureText,
  acknowledgementHolds,
  type AlertNotice,
  alertNotice,
} from "@/features/footprint/alert-facts";

export interface ShownFootprintAlert {
  readonly alert: FootprintAlert;
  readonly notice: AlertNotice;
}

export interface FootprintAlertState {
  readonly shown: readonly ShownFootprintAlert[];
  readonly acknowledging: string | null;
  readonly acknowledge: (alertId: string) => void;
}

export function useFootprintAlert(): FootprintAlertState {
  const { stats, openAlerts, refresh } = useFootprintAlerts();
  const [acknowledging, setAcknowledging] = useState<string | null>(null);

  const acknowledge = useCallback(
    (alertId: string) => {
      setAcknowledging(alertId);
      acknowledgeFootprintAlert(alertId).then(
        () => {
          setAcknowledging(null);
          toast.success("Acknowledged the alert.");
          refresh();
        },
        (cause: unknown) => {
          setAcknowledging(null);
          toast.error("The acknowledgement failed.", {
            description: acknowledgeFailureText(asApiError(cause)),
          });
          refresh();
        },
      );
    },
    [refresh],
  );

  return {
    shown: openAlerts
      .filter((alert) => !acknowledgementHolds(alert, stats))
      .map((alert) => ({ alert, notice: alertNotice(alert, stats) })),
    acknowledging,
    acknowledge,
  };
}
