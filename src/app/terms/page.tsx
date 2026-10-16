import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/LegalPage";
import Content from "@/content/legal/terms.mdx";
import { infoPages } from "@/lib/pages";
import { pageMetadata } from "@/lib/seo";

const page = infoPages.terms;

export const metadata: Metadata = pageMetadata({
  title: page.title,
  description: page.description,
  path: page.path,
  image: "/opengraph-image",
});

export default function TermsPage() {
  return (
    <LegalPage page={page}>
      <Content />
    </LegalPage>
  );
}
