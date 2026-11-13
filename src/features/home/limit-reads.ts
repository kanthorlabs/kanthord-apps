export const MAX_READS_IN_FLIGHT = 4;

let inFlight = 0;
const waiting: (() => void)[] = [];

export async function limitReads<T>(read: () => Promise<T>): Promise<T> {
  if (inFlight < MAX_READS_IN_FLIGHT) inFlight += 1;
  else await new Promise<void>((resolve) => waiting.push(resolve));
  try {
    return await read();
  } finally {
    const next = waiting.shift();
    if (next === undefined) inFlight -= 1;
    else next();
  }
}
