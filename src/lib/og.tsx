import { ImageResponse } from "next/og";
import { siteConfig } from "@/lib/site-config";

const ogSize = { width: 1200, height: 630 } as const;

/** Social share image: site brand, page title and a one-line subtitle. */
export function renderOgImage({ title, subtitle }: { title: string; subtitle: string }) {
  const fontSize = title.length > 40 ? 64 : title.length > 28 ? 76 : 88;
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "72px 80px",
        background: "linear-gradient(135deg, #1e3a8a 0%, #1d4ed8 100%)",
        color: "#ffffff",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", fontSize: 40, fontWeight: 700 }}>
        <div
          style={{
            width: 18,
            height: 18,
            borderRadius: 9,
            background: "#93c5fd",
            marginRight: 16,
          }}
        />
        {siteConfig.name}
      </div>
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ fontSize, fontWeight: 800, lineHeight: 1.08, letterSpacing: -2 }}>
          {title}
        </div>
        <div style={{ fontSize: 34, marginTop: 28, color: "#dbeafe" }}>{subtitle}</div>
      </div>
      <div style={{ display: "flex", fontSize: 28, color: "#bfdbfe" }}>
        Free calculator · Runs in your browser
      </div>
    </div>,
    { ...ogSize },
  );
}
