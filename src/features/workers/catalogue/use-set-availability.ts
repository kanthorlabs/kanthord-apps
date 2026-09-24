import { useCallback, useState } from "react";

import { setBindingAvailability } from "@/api/resources/projects";

export interface SetAvailabilityState {
  readonly executing: boolean;
  readonly toggle: (
    projectId: string,
    bindingId: string,
    available: boolean,
    onSuccess: () => void,
  ) => void;
}

export function useSetAvailability(): SetAvailabilityState {
  const [executing, setExecuting] = useState(false);

  const toggle = useCallback(
    (projectId: string, bindingId: string, available: boolean, onSuccess: () => void) => {
      setExecuting(true);
      void setBindingAvailability(projectId, bindingId, available).then(
        () => {
          setExecuting(false);
          onSuccess();
        },
        () => {
          setExecuting(false);
        },
      );
    },
    [],
  );

  return { executing, toggle };
}
