import { DownloadIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PLAN_FILES_DOC_URL, samplePlanFile, samplePlanHref } from "@/lib/mission-plan-sample";

export function PlanFormatHelp() {
  const sample = samplePlanFile();

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        nativeButton={false}
        render={
          <a href={samplePlanHref(sample)} download={sample.filename}>
            <DownloadIcon aria-hidden="true" data-icon="inline-start" />
            Download a sample plan
          </a>
        }
      />
      <a
        href={PLAN_FILES_DOC_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="text-sm underline underline-offset-4"
      >
        Plan file format
      </a>
    </div>
  );
}
