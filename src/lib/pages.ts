/**
 * Indexable static pages (everything except calculators and category hubs, which come from the
 * registry). Used by the sitemap. Add a page here when it is created.
 */
export type StaticPage = {
  path: string;
  changeFrequency: "daily" | "weekly" | "monthly" | "yearly";
  priority: number;
};

export const staticPages: readonly StaticPage[] = [
  { path: "/", changeFrequency: "weekly", priority: 1 },
];
