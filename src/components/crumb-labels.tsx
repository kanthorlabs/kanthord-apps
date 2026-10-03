import {
  createContext,
  use,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

interface CrumbLabelsValue {
  readonly labels: ReadonlyMap<string, string>;
  readonly put: (path: string, label: string) => void;
  readonly drop: (path: string) => void;
}

const CrumbLabelsContext = createContext<CrumbLabelsValue | null>(null);

export function CrumbLabelsProvider({ children }: { children: ReactNode }) {
  const [labels, setLabels] = useState<ReadonlyMap<string, string>>(new Map());

  const put = useCallback((path: string, label: string) => {
    setLabels((current) =>
      current.get(path) === label ? current : new Map(current).set(path, label),
    );
  }, []);

  const drop = useCallback((path: string) => {
    setLabels((current) => {
      if (!current.has(path)) return current;
      const next = new Map(current);
      next.delete(path);
      return next;
    });
  }, []);

  const value = useMemo(() => ({ labels, put, drop }), [labels, put, drop]);

  return <CrumbLabelsContext value={value}>{children}</CrumbLabelsContext>;
}

const NO_LABELS: ReadonlyMap<string, string> = new Map();

export function useCrumbLabels(): ReadonlyMap<string, string> {
  return use(CrumbLabelsContext)?.labels ?? NO_LABELS;
}

export function useCrumbLabel(path: string, label: string | undefined): void {
  const context = use(CrumbLabelsContext);
  const put = context?.put;
  const drop = context?.drop;

  useEffect(() => {
    if (put === undefined || drop === undefined || label === undefined) return;
    put(path, label);
    return () => drop(path);
  }, [put, drop, path, label]);
}
