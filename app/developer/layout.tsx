import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "SirenWise API — Developer Access",
  description:
    "Programmatic access to Israel's missile alert intelligence. Four MCP tools for daily context, sleep impact, clustering, and streak analysis.",
};

export default function DeveloperLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
