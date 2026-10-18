import { useLocation } from "react-router-dom";

import type { CredentialComponent } from "@/api/types";
import { priorCheckOf } from "@/lib/prior-check";
import { useCredentialCheck, type CredentialCheck } from "../use-credential-check";

export function useDetailCheck(component: CredentialComponent, name: string): CredentialCheck {
  return useCredentialCheck(component, name, priorCheckOf(useLocation().state));
}
