"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { parseParams, serializeParams, type StateRecord } from "@/lib/url-state";

/**
 * Holds calculator inputs and keeps them in sync with the URL query string so results can be
 * shared. The first render always uses the defaults (so server and client markup match). If the
 * address carries saved values they are applied right after mount; a plain visit changes nothing
 * and causes no extra render, which matters because every render recomputes the whole result.
 * URL writes are debounced and use replaceState, so they do not add history entries.
 */
export function useCalculatorState<T extends StateRecord>(defaults: T, debounceMs = 400) {
  const defaultsRef = useRef(defaults);
  const [values, setValues] = useState<T>(defaults);
  const skipFirstWrite = useRef(true);

  useEffect(() => {
    const search = window.location.search;
    if (search) setValues(parseParams(search, defaultsRef.current));
  }, []);

  useEffect(() => {
    // The first run is the initial render (or the render that restored the URL): nothing changed.
    if (skipFirstWrite.current) {
      skipFirstWrite.current = false;
      return;
    }
    const timer = window.setTimeout(() => {
      const query = serializeParams(values, defaultsRef.current);
      const url = `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`;
      window.history.replaceState(window.history.state, "", url);
    }, debounceMs);
    return () => window.clearTimeout(timer);
  }, [values, debounceMs]);

  const setValue = useCallback(<K extends keyof T>(key: K, value: T[K]) => {
    setValues((prev) => ({ ...prev, [key]: value }));
  }, []);

  const reset = useCallback(() => setValues(defaultsRef.current), []);

  return { values, setValue, setValues, reset };
}
