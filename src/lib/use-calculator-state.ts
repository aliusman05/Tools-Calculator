"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { registerShareSource } from "@/lib/share-store";
import {
  buildShareUrl,
  hasCalculatorParams,
  parseParams,
  stripParams,
  type StateRecord,
} from "@/lib/url-state";

/**
 * Holds calculator inputs.
 *
 * - The first render always uses the defaults, so server and client markup match.
 * - The address bar is never updated while the visitor types. Values travel in a URL only when the
 *   visitor presses "Copy link" (the button asks this hook, through the share store, for the link).
 * - If the visitor opened a shared link, its values are read once after mount, validated and clamped
 *   (see parseParams), applied, and then removed from the address with replaceState. Unrelated
 *   parameters such as utm_source are left alone, and a plain visit causes no extra render.
 */
export function useCalculatorState<T extends StateRecord>(defaults: T) {
  const defaultsRef = useRef(defaults);
  const [values, setValues] = useState<T>(defaults);
  const valuesRef = useRef(values);
  // Layout effect: it runs as soon as the change is committed, so a very quick press of "Copy link"
  // right after typing still sees the latest inputs.
  useLayoutEffect(() => {
    valuesRef.current = values;
  }, [values]);

  useEffect(() => {
    const { search, pathname, hash } = window.location;
    if (!hasCalculatorParams(search, defaultsRef.current)) return;
    setValues(parseParams(search, defaultsRef.current));
    const rest = stripParams(search, defaultsRef.current);
    window.history.replaceState(
      window.history.state,
      "",
      `${pathname}${rest ? `?${rest}` : ""}${hash}`,
    );
  }, []);

  useEffect(
    () =>
      registerShareSource(() =>
        buildShareUrl(
          window.location.origin,
          window.location.pathname,
          valuesRef.current,
          defaultsRef.current,
        ),
      ),
    [],
  );

  const setValue = useCallback(<K extends keyof T>(key: K, value: T[K]) => {
    setValues((prev) => ({ ...prev, [key]: value }));
  }, []);

  const reset = useCallback(() => setValues(defaultsRef.current), []);

  return { values, setValue, setValues, reset };
}
