import type { MDXComponents } from "mdx/types";

/** Global styling for MDX content. Calculator pages pass their calculator in through `components`. */
export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    h2: (props) => <h2 className="mt-10 mb-3 text-2xl font-bold" {...props} />,
    h3: (props) => <h3 className="mt-6 mb-2 text-xl font-semibold" {...props} />,
    p: (props) => <p className="my-4 max-w-3xl leading-7" {...props} />,
    ul: (props) => <ul className="my-4 max-w-3xl list-disc space-y-2 pl-6 leading-7" {...props} />,
    ol: (props) => (
      <ol className="my-4 max-w-3xl list-decimal space-y-2 pl-6 leading-7" {...props} />
    ),
    a: (props) => <a className="text-accent underline underline-offset-2" {...props} />,
    strong: (props) => <strong className="font-semibold" {...props} />,
    code: (props) => (
      <code className="bg-surface-muted rounded px-1.5 py-0.5 font-mono text-[0.9em]" {...props} />
    ),
    pre: (props) => (
      <pre
        tabIndex={0}
        className="rounded-card border-border bg-surface-muted my-4 max-w-3xl overflow-x-auto border p-4 font-mono text-sm [&_code]:bg-transparent [&_code]:p-0"
        {...props}
      />
    ),
    ...components,
  };
}
