"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { applyParams, parseParams, serializeParams, type StateRecord } from "@/lib/url-state";

/**
 * Holds calculator inputs and keeps them in sync with the URL query string so results can be
 * shared.
 *
 * - The first render always uses the defaults, so server and client markup match.
 * - If the address carries saved values they are applied right after mount. A plain visit changes
 *   nothing and causes no extra render, which matters because every render recomputes the result.
 * - The address is rewritten only when the calculator's own state differs from what the address
 *   already says (so a visit, or a restore, never touches it), and unrelated parameters such as
 *   utm_source are kept. Writes are debounced and use replaceState, so no history entries are added.
 */
export function useCalculatorState<T extends StateRecord>(defaults: T, debounceMs = 400) {
  const defaultsRef = useRef(defaults);
  const [values, setValues] = useState<T>(defaults);
  // The serialized calculator state that the address currently represents.
  const inAddress = useRef(serializeParams(defaults, defaults));

  useEffect(() => {
    const search = window.location.search;
    if (!search) return;
    const restored = parseParams(search, defaultsRef.current);
    const query = serializeParams(restored, defaultsRef.current);
    if (query === inAddress.current) return; // only unrelated parameters: nothing to restore
    inAddress.current = query;
    setValues(restored);
  }, []);

  useEffect(() => {
    const query = serializeParams(values, defaultsRef.current);
    if (query === inAddress.current) return;
    const timer = window.setTimeout(() => {
      const next = applyParams(window.location.search, values, defaultsRef.current);
      const url = `${window.location.pathname}${next ? `?${next}` : ""}${window.location.hash}`;
      window.history.replaceState(window.history.state, "", url);
      inAddress.current = query;
    }, debounceMs);
    return () => window.clearTimeout(timer);
  }, [values, debounceMs]);

  const setValue = useCallback(<K extends keyof T>(key: K, value: T[K]) => {
    setValues((prev) => ({ ...prev, [key]: value }));
  }, []);

  const reset = useCallback(() => setValues(defaultsRef.current), []);

  return { values, setValue, setValues, reset };
}
