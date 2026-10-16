/**
 * Indexable static pages (everything except calculators and category hubs, which come from the
 * registry). The sitemap and the legal pages' metadata read from here. Add a page when created.
 */
export type StaticPage = {
  path: string;
  changeFrequency: "daily" | "weekly" | "monthly" | "yearly";
  priority: number;
};

export type InfoPage = StaticPage & {
  /** Title without the site name (the layout template appends it). */
  title: string;
  /** 150-160 characters. Avoid the brand name so renaming the site cannot break the length. */
  description: string;
};

export const infoPages = {
  about: {
    path: "/about",
    title: "About Us and Our Methodology",
    description:
      "Who runs this site, how our free personal finance calculators work, how every formula is tested against reference values, and how we keep the data up to date.",
    changeFrequency: "yearly",
    priority: 0.5,
  },
  contact: {
    path: "/contact",
    title: "Contact Us",
    description:
      "Questions, corrections or feedback about our free finance calculators? Send us a message or email us. We read every note and reply within a few business days.",
    changeFrequency: "yearly",
    priority: 0.4,
  },
  privacy: {
    path: "/privacy-policy",
    title: "Privacy Policy",
    description:
      "How we handle your data: calculations run in your browser, inputs are not stored on our servers, and optional analytics and ad cookies need your consent.",
    changeFrequency: "yearly",
    priority: 0.3,
  },
  terms: {
    path: "/terms",
    title: "Terms of Use",
    description:
      "Terms for using our free finance calculators: educational use only, no professional advice, accuracy limits, third-party links and ads, and liability limits.",
    changeFrequency: "yearly",
    priority: 0.3,
  },
  disclaimer: {
    path: "/disclaimer",
    title: "Financial Disclaimer",
    description:
      "Our calculators are for education only. Results are estimates, not financial, tax or legal advice. See how assumptions, data and affiliate links affect them.",
    changeFrequency: "yearly",
    priority: 0.3,
  },
} as const satisfies Record<string, InfoPage>;

export const staticPages: readonly StaticPage[] = [
  { path: "/", changeFrequency: "weekly", priority: 1 },
  ...Object.values(infoPages),
];
