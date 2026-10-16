import { Accordion } from "@/components/ui/Accordion";
import type { Faq } from "@/lib/seo";

export function FAQ({ faqs }: { faqs: readonly Faq[] }) {
  return (
    <section aria-labelledby="faq-heading" className="mt-12">
      <h2 id="faq-heading" className="mb-4 text-2xl font-bold">
        Frequently asked questions
      </h2>
      <Accordion items={faqs.map((f) => ({ question: f.question, answer: f.answer }))} />
    </section>
  );
}
