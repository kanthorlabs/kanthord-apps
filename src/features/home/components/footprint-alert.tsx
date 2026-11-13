import { CheckIcon } from "lucide-react";
import { Link } from "react-router-dom";

import { RecordName } from "@/components/record-name";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { alertTitle } from "@/features/footprint/alert-facts";

import { useFootprintAlert } from "../use-footprint-alert";

export function FootprintAlert() {
  const { shown, acknowledging, acknowledge } = useFootprintAlert();
  return shown.map(({ alert, notice }) => (
    <Alert key={alert.alert_id}>
      <AlertTitle>Footprint alert: {alertTitle(alert)}</AlertTitle>
      <AlertDescription className="break-words">
        <p>
          {notice.subject} <RecordName>{notice.host}</RecordName> {notice.claim}
          {notice.growth !== null && ` ${notice.growth}`}{" "}
          <Link to={notice.path}>{notice.linkText}</Link>
        </p>
      </AlertDescription>
      <div className="mt-2 flex md:justify-end">
        <Button
          variant="outline"
          size="sm"
          aria-label={`Acknowledge ${alertTitle(alert)}`}
          disabled={acknowledging === alert.alert_id}
          onClick={() => acknowledge(alert.alert_id)}
        >
          <CheckIcon aria-hidden="true" data-icon="inline-start" />
          Acknowledge
        </Button>
      </div>
    </Alert>
  ));
}
