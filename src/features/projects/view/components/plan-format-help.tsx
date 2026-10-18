import { DownloadIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PLAN_FILES_DOC_URL, samplePlanHref, type SamplePlan } from "@/lib/mission-plan-sample";

interface PlanFormatHelpProps {
  readonly sample: SamplePlan;
  readonly align: "start" | "center";
}

export function PlanFormatHelp({ sample, align }: PlanFormatHelpProps) {
  const { file, hint } = sample;

  return (
    <div
      className={align === "center" ? "flex flex-col items-center gap-2" : "flex flex-col gap-2"}
    >
      <div
        className={
          align === "center"
            ? "flex flex-wrap items-center justify-center gap-2"
            : "flex flex-wrap items-center gap-2"
        }
      >
        <Button
          variant="outline"
          size="sm"
          nativeButton={false}
          render={
            <a href={samplePlanHref(file)} download={file.filename}>
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
      {hint !== null && <p className="text-sm text-muted-foreground">{hint}</p>}
    </div>
  );
}
