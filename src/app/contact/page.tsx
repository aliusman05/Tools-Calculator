import type { Metadata } from "next";
import { ContactForm } from "@/components/contact/ContactForm";
import { LegalPage } from "@/components/legal/LegalPage";
import { infoPages } from "@/lib/pages";
import { pageMetadata } from "@/lib/seo";
import { siteConfig } from "@/lib/site-config";

const page = infoPages.contact;

export const metadata: Metadata = pageMetadata({
  title: page.title,
  description: page.description,
  path: page.path,
  image: "/opengraph-image",
});

export default function ContactPage() {
  const { contactEmail } = siteConfig.legal;
  return (
    <LegalPage page={page} showUpdated={false}>
      <div className="mb-8 max-w-2xl space-y-3 leading-7">
        <p>
          Found a mistake, have a question about a calculation, or want to suggest a new calculator?
          Send us a message and we will get back to you within a few business days.
        </p>
        <p>
          We can explain how a calculator works, but we cannot give personal financial, tax or legal
          advice. You can also email us directly at{" "}
          <a href={`mailto:${contactEmail}`} className="text-accent underline underline-offset-2">
            {contactEmail}
          </a>
          .
        </p>
      </div>
      <ContactForm email={contactEmail} />
    </LegalPage>
  );
}
