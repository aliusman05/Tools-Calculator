import { ImageResponse } from "next/og";
import { siteConfig } from "@/lib/site-config";

/** The site icon: the brand's first letter, white on the accent blue. Generated, so renaming the site renames the icon. */
export function renderBrandIcon(size: number) {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#1d4ed8",
        color: "#ffffff",
        fontSize: Math.round(size * 0.62),
        fontWeight: 800,
        borderRadius: Math.round(size * 0.22),
      }}
    >
      {siteConfig.name.charAt(0).toUpperCase()}
    </div>,
    { width: size, height: size },
  );
}
