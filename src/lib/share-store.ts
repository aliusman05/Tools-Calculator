/**
 * Lets the "Copy link" button (rendered by the shared calculator layout) reach the current inputs of
 * the calculator on the page without every calculator wiring it up. A page shows one calculator, so a
 * single slot is enough. The slot holds a function that is called only when the button is pressed, so
 * typing never re-renders anything.
 */
let getUrl: (() => string) | null = null;

export function registerShareSource(source: () => string): () => void {
  getUrl = source;
  return () => {
    if (getUrl === source) getUrl = null;
  };
}

/** The link for the calculator on this page; the plain page address when none has registered. */
export function currentShareUrl(): string {
  return getUrl ? getUrl() : `${window.location.origin}${window.location.pathname}`;
}
