import { Fragment, type ReactElement } from "react";

import type { FlowBands as Bands, FlowColumn } from "@/lib/flow-stages";
import type { FlowSeverity } from "@/lib/flow-status";

type BandName = keyof Bands;

interface BandCellProps {
  readonly column: FlowColumn;
  readonly band: BandName;
}

interface BandsProps {
  readonly column: FlowColumn;
}

interface FlowBandRowsProps {
  readonly columns: readonly FlowColumn[];
  readonly gridClassName: string;
}

const BAND_TITLES: Readonly<Record<BandName, string>> = {
  exits: "Exits",
  time: "Time p50 / p90",
  signals: "Signals (previous)",
  notInRates: "Not in rates",
};
const BAND_NAMES = Object.keys(BAND_TITLES) as readonly BandName[];
const TEXT_TONE: Readonly<Record<FlowSeverity, string>> = {
  ok: "",
  warn: "text-flow-warn",
  bad: "text-flow-bad",
};
const GLYPH_TONE: Readonly<Record<FlowSeverity, string>> = {
  ok: "",
  warn: "text-flow-warn-glyph",
  bad: "text-flow-bad",
};
const LIST = "flex flex-col gap-0.5 text-xs break-words";

function ExitsBand({ column }: BandsProps) {
  const { header, lines } = column.bands.exits;
  return (
    <div className="flex flex-col gap-0.5 text-xs break-words">
      <p className="font-medium">{header}</p>
      <ul className={LIST}>
        {lines.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </div>
  );
}

function TimeBand({ column }: BandsProps) {
  const { name, range, previous, glyph, severity } = column.bands.time;
  return (
    <div className={`flex flex-col gap-0.5 text-xs break-words ${TEXT_TONE[severity]}`}>
      <p>
        {glyph !== null && (
          <span aria-hidden="true" className={GLYPH_TONE[severity]}>
            {`${glyph} `}
          </span>
        )}
        <span className="text-muted-foreground">{name}</span>
      </p>
      <p>{range}</p>
      <p className="text-muted-foreground">{previous}</p>
      {glyph !== null && <span className="sr-only">{severity}</span>}
    </div>
  );
}

function SignalsBand({ column }: BandsProps) {
  const { lines, context } = column.bands.signals;
  return (
    <ul className={LIST}>
      {lines.map((line) => (
        <li
          key={line.text}
          className={line.state === "ended" ? "text-muted-foreground" : TEXT_TONE[line.severity]}
        >
          {line.glyph !== null && (
            <span aria-hidden="true" className={GLYPH_TONE[line.severity]}>
              {`${line.glyph} `}
            </span>
          )}
          <span>{line.text}</span>
          <span className="sr-only">{`, ${line.reader}`}</span>
        </li>
      ))}
      {context.map((line) => (
        <li key={line} className="text-muted-foreground">
          {line}
        </li>
      ))}
    </ul>
  );
}

function NotInRatesBand({ column }: BandsProps) {
  return (
    <ul className={LIST}>
      {column.bands.notInRates.map((line) => (
        <li key={line}>{line}</li>
      ))}
    </ul>
  );
}

const BAND_VIEWS: Readonly<Record<BandName, (props: BandsProps) => ReactElement>> = {
  exits: ExitsBand,
  time: TimeBand,
  signals: SignalsBand,
  notInRates: NotInRatesBand,
};

function BandCell({ column, band }: BandCellProps) {
  const View = BAND_VIEWS[band];
  return (
    <div role="group" aria-label={`${column.name} ${BAND_TITLES[band]}`} className="min-w-0">
      <View column={column} />
    </div>
  );
}

export function StageBands({ column }: BandsProps) {
  return (
    <div className="flex flex-col gap-3 pt-3">
      {BAND_NAMES.map((band) => (
        <div key={band} className="flex flex-col gap-1">
          <h5 className="text-xs font-medium text-muted-foreground">{BAND_TITLES[band]}</h5>
          <BandCell column={column} band={band} />
        </div>
      ))}
    </div>
  );
}

export function FlowBandRows({ columns, gridClassName }: FlowBandRowsProps) {
  return (
    <div className="flex flex-col gap-4 pt-2">
      {BAND_NAMES.map((band) => (
        <div key={band} className="flex flex-col gap-1">
          <h4 className="text-xs font-medium text-muted-foreground">{BAND_TITLES[band]}</h4>
          <div className={gridClassName}>
            {columns.map((column, index) => (
              <Fragment key={column.stage}>
                {index > 0 && <div aria-hidden="true" />}
                <BandCell column={column} band={band} />
              </Fragment>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
