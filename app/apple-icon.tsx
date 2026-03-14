import { ImageResponse } from "next/og";

export const runtime = "edge";
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 180,
          height: 180,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0B0E14",
          borderRadius: 40,
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 4,
          }}
        >
          {/* Alert pulse rings */}
          <div
            style={{
              width: 80,
              height: 80,
              borderRadius: 40,
              background: "radial-gradient(circle, #EF4444 30%, rgba(239,68,68,0.3) 60%, transparent 70%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                background: "#EF4444",
                boxShadow: "0 0 20px rgba(239,68,68,0.6)",
              }}
            />
          </div>
          {/* Map chevrons */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 2,
              marginTop: 4,
            }}
          >
            <div
              style={{
                width: 60,
                height: 3,
                background: "linear-gradient(90deg, transparent, #3B82F6, transparent)",
                borderRadius: 2,
              }}
            />
            <div
              style={{
                width: 40,
                height: 3,
                background: "linear-gradient(90deg, transparent, rgba(59,130,246,0.5), transparent)",
                borderRadius: 2,
              }}
            />
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
