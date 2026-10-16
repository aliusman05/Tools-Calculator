"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { parseParams, serializeParams, type StateRecord } from "@/lib/url-state";

/**
 * Holds calculator inputs and keeps them in sync with the URL query string so results can be
 * shared. The first render always uses the defaults (so server and client markup match); saved
 * values are applied right after mount. URL writes are debounced and use replaceState, so they
 * do not add history entries.
 */
export function useCalculatorState<T extends StateRecord>(defaults: T, debounceMs = 400) {
  const defaultsRef = useRef(defaults);
  const [values, setValues] = useState<T>(defaults);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const fromUrl = parseParams(window.location.search, defaultsRef.current);
    setValues(fromUrl);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const timer = window.setTimeout(() => {
      const query = serializeParams(values, defaultsRef.current);
      const url = `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`;
      window.history.replaceState(window.history.state, "", url);
    }, debounceMs);
    return () => window.clearTimeout(timer);
  }, [values, hydrated, debounceMs]);

  const setValue = useCallback(<K extends keyof T>(key: K, value: T[K]) => {
    setValues((prev) => ({ ...prev, [key]: value }));
  }, []);

  const reset = useCallback(() => setValues(defaultsRef.current), []);

  return { values, setValue, setValues, reset };
}
