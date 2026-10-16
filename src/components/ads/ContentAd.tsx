import { AdSlot } from "./AdSlot";

/**
 * The in-content ad. Calculator MDX files place `<ContentAd />` once, right after the
 * "How it works" section (a test enforces this), so it always sits between paragraphs of text.
 */
export function ContentAd() {
  return <AdSlot placement="inContent" minHeight={250} />;
}
