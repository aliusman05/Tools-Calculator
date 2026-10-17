/**
 * Which kind of deployment is this? Vercel exposes the environment as VERCEL_ENV; enable "Automatically
 * expose System Environment Variables" in the project settings so it is also available here as
 * NEXT_PUBLIC_VERCEL_ENV. Anywhere else (local builds, CI, another host) the variable is unset and the
 * build counts as production.
 */
export function isProductionDeploy(env: { NEXT_PUBLIC_VERCEL_ENV?: string }): boolean {
  const v = env.NEXT_PUBLIC_VERCEL_ENV?.trim();
  return !v || v === "production";
}

/** Preview and development deployments must never be indexed by search engines. */
export const productionDeploy = isProductionDeploy({
  NEXT_PUBLIC_VERCEL_ENV: process.env.NEXT_PUBLIC_VERCEL_ENV,
});
