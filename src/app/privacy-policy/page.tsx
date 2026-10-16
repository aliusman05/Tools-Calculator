import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/LegalPage";
import Content from "@/content/legal/privacy-policy.mdx";
import { infoPages } from "@/lib/pages";
import { pageMetadata } from "@/lib/seo";

const page = infoPages.privacy;

export const metadata: Metadata = pageMetadata({
  title: page.title,
  description: page.description,
  path: page.path,
  image: "/opengraph-image",
});

export default function PrivacyPolicyPage() {
  return (
    <LegalPage page={page}>
      <Content />
    </LegalPage>
  );
}
