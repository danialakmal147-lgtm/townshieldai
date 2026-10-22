import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { faultMap, reducer, type Action } from "./engine";
import { scoreGroup, type GroupScore } from "./scoring";
import { createSeed } from "./seed";
import type { SiteId, TownState } from "./types";

/** Fixed clock for the first (server + hydration) render so markup matches. */
export const SEED_BASE = Date.UTC(2026, 9, 22, 2, 0, 0);
const STORAGE_KEY = "townshield-state-v1";

interface TownContextValue {
  state: TownState;
  now: number;
  hydrated: boolean;
  dispatch: (a: Action) => void;
  reset: () => void;
}

const TownContext = createContext<TownContextValue | null>(null);

export function TownProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, () => createSeed(SEED_BASE));
  const [now, setNow] = useState(SEED_BASE);
  const [hydrated, setHydrated] = useState(false);
  const loaded = useRef(false);

  useEffect(() => {
    const t = Date.now();
    let next: TownState | null = null;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) next = JSON.parse(raw) as TownState;
    } catch {
      next = null;
    }
    dispatch({ type: "replace", state: next ?? createSeed(t) });
    setNow(t);
    loaded.current = true;
    setHydrated(true);
    const id = window.setInterval(() => setNow(Date.now()), 15_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!loaded.current) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Storage full (e.g. many photos) — keep working in memory.
    }
  }, [state]);

  const value = useMemo<TownContextValue>(
    () => ({
      state,
      now,
      hydrated,
      dispatch: (a) => {
        dispatch(a);
        setNow(Date.now());
      },
      reset: () => {
        const t = Date.now();
        dispatch({ type: "replace", state: createSeed(t) });
        setNow(t);
      },
    }),
    [state, now, hydrated],
  );

  return <TownContext.Provider value={value}>{children}</TownContext.Provider>;
}

export function useTown() {
  const ctx = useContext(TownContext);
  if (!ctx) throw new Error("useTown must be used inside TownProvider");
  return ctx;
}

export interface Scores {
  township: GroupScore;
  sites: Record<SiteId, GroupScore>;
  byAsset: Map<string, GroupScore["assetScores"][number]>;
}

export function useScores(): Scores {
  const { state, now } = useTown();
  return useMemo(() => {
    const fm = faultMap(state);
    const township = scoreGroup(state.assets, fm, now);
    const sites = Object.fromEntries(
      state.sites.map((s) => [s.id, scoreGroup(state.assets.filter((a) => a.site === s.id), fm, now)]),
    ) as Record<SiteId, GroupScore>;
    const byAsset = new Map(township.assetScores.map((a) => [a.assetId, a]));
    return { township, sites, byAsset };
  }, [state, now]);
}
