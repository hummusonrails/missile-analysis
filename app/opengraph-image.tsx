import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "SirenWise — Israel Alert Intelligence";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: "#0B0E14",
          padding: "60px 80px",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Subtle grid background */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage:
              "linear-gradient(rgba(59,130,246,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(59,130,246,0.05) 1px, transparent 1px)",
            backgroundSize: "60px 60px",
          }}
        />

        {/* Glow effects */}
        <div
          style={{
            position: "absolute",
            top: "15%",
            right: "20%",
            width: 300,
            height: 300,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(239,68,68,0.15) 0%, transparent 70%)",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: "20%",
            left: "10%",
            width: 200,
            height: 200,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(59,130,246,0.1) 0%, transparent 70%)",
          }}
        />

        {/* Content */}
        <div style={{ display: "flex", flexDirection: "column", flex: 1, justifyContent: "center", position: "relative" }}>
          {/* Alert dot */}
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24 }}>
            <div
              style={{
                width: 12,
                height: 12,
                borderRadius: "50%",
                background: "#EF4444",
                boxShadow: "0 0 20px rgba(239,68,68,0.6)",
              }}
            />
            <span style={{ fontFamily: "monospace", fontSize: 18, color: "#6B7A90", letterSpacing: "0.1em", textTransform: "uppercase" as const }}>
              Live Alert Intelligence
            </span>
          </div>

          {/* Title */}
          <div style={{ fontSize: 72, fontWeight: 700, color: "#E8ECF4", letterSpacing: "-0.03em", lineHeight: 1.1, marginBottom: 20, fontFamily: "Georgia, serif" }}>
            SirenWise
          </div>

          {/* Subtitle */}
          <div style={{ fontSize: 28, color: "#6B7A90", lineHeight: 1.4, maxWidth: 700 }}>
            Interactive missile alert map, analytics, and historical data for Israel
          </div>

          {/* Stats row */}
          <div style={{ display: "flex", gap: 40, marginTop: 48 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ fontFamily: "monospace", fontSize: 36, fontWeight: 700, color: "#EF4444" }}>3,700+</span>
              <span style={{ fontSize: 14, color: "#3D4B5F", textTransform: "uppercase" as const, letterSpacing: "0.08em" }}>Alerts Tracked</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ fontFamily: "monospace", fontSize: 36, fontWeight: 700, color: "#F59E0B" }}>15</span>
              <span style={{ fontSize: 14, color: "#3D4B5F", textTransform: "uppercase" as const, letterSpacing: "0.08em" }}>Regions</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ fontFamily: "monospace", fontSize: 36, fontWeight: 700, color: "#3B82F6" }}>11</span>
              <span style={{ fontSize: 14, color: "#3D4B5F", textTransform: "uppercase" as const, letterSpacing: "0.08em" }}>Analytics</span>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 20 }}>
          <span style={{ fontFamily: "monospace", fontSize: 16, color: "#3D4B5F" }}>sirenwise.com</span>
          <span style={{ fontFamily: "monospace", fontSize: 14, color: "#3D4B5F" }}>EN / עב</span>
        </div>
      </div>
    ),
    { ...size }
  );
}
