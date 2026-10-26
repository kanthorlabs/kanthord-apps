import { useEffect, useRef, useState } from "react";

import { readNodeNames } from "./read-node-names";

const NO_NAMES: ReadonlyMap<string, string> = new Map();

export function useNodeNames(nodeIds: readonly string[]): ReadonlyMap<string, string> {
  const [names, setNames] = useState(NO_NAMES);
  const requested = useRef(new Set<string>());
  const key = nodeIds.join(",");

  useEffect(() => {
    const ids = key === "" ? [] : key.split(",");
    const missing = [...new Set(ids)].filter((id) => !requested.current.has(id));
    if (missing.length === 0) return;
    missing.forEach((id) => requested.current.add(id));
    void readNodeNames(missing).then((read) => {
      if (read.size > 0) setNames((current) => new Map([...current, ...read]));
    });
  }, [key]);

  return names;
}
