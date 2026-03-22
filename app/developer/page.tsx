// app/developer/page.tsx
import type { Metadata } from "next";
import { CheckoutButton } from "./CheckoutButton";

export const metadata: Metadata = {
  title: "SirenWise API — Developer Access",
  description: "Real-time missile alert analysis API for developers. Four MCP tools for daily context, sleep impact, clustering, and streak analysis.",
};

export default function DeveloperPage() {
  return (
    <div className="min-h-screen bg-bg-primary text-text-primary">
      <div className="max-w-3xl mx-auto px-6 py-16">
        {/* Hero */}
        <h1 className="text-4xl font-serif font-bold mb-4">SirenWise API</h1>
        <p className="text-lg text-text-secondary mb-2">
          Real-time missile alert analysis for Israel. Four MCP tools providing daily context,
          sleep impact assessment, alert clustering, and quiet-day streak tracking.
        </p>
        <p className="text-sm text-text-tertiary mb-12">
          Default scope: Modi&apos;in Maccabim Re&apos;ut. Pass any Israeli city or region.
        </p>

        {/* Pricing */}
        <div className="bg-bg-elevated border border-border rounded-xl p-8 mb-12">
          <h2 className="text-xl font-semibold mb-2">$0.01 per request</h2>
          <p className="text-text-secondary mb-6">Flat rate for all tools. No subscriptions.</p>

          <div className="grid gap-4 md:grid-cols-3">
            {/* Stripe */}
            <div className="bg-bg-surface border border-border rounded-lg p-5">
              <h3 className="font-mono text-sm font-semibold text-accent-blue mb-2">API Key</h3>
              <p className="text-xs text-text-tertiary mb-4">
                Buy credits via Stripe. Use your key with any MCP client.
              </p>
              <CheckoutButton />
            </div>

            {/* x402 */}
            <div className="bg-bg-surface border border-border rounded-lg p-5">
              <h3 className="font-mono text-sm font-semibold text-accent-amber mb-2">x402 (Base USDC)</h3>
              <p className="text-xs text-text-tertiary mb-4">
                Pay per request with USDC on Base. No API key needed. Permissionless.
              </p>
              <span className="text-xs text-text-tertiary italic">Coming soon — Phase 2</span>
            </div>

            {/* MPP */}
            <div className="bg-bg-surface border border-border rounded-lg p-5">
              <h3 className="font-mono text-sm font-semibold text-accent-green mb-2">MPP (Stripe / Tempo)</h3>
              <p className="text-xs text-text-tertiary mb-4">
                Machine payments via Stripe cards or Tempo stablecoins.
              </p>
              <span className="text-xs text-text-tertiary italic">Coming soon — Phase 3</span>
            </div>
          </div>
        </div>

        {/* Tools Reference */}
        <h2 className="text-xl font-semibold mb-4">Tools</h2>
        <div className="space-y-4 mb-12">
          {[
            { name: "get_daily_context", desc: "Compare today's alert count against 7-day and 30-day averages." },
            { name: "get_sleep_impact", desc: "Flag alerts during night hours (10 PM – 6 AM) with deep sleep markers." },
            { name: "get_clustering", desc: "Detect isolated alerts vs barrages within configurable time windows." },
            { name: "get_streak", desc: "Days since last alert. Flags streak-breakers." },
          ].map((tool) => (
            <div key={tool.name} className="bg-bg-elevated border border-border rounded-lg p-4">
              <code className="text-sm font-mono text-accent-blue">{tool.name}</code>
              <p className="text-sm text-text-secondary mt-1">{tool.desc}</p>
              <p className="text-xs text-text-tertiary mt-2">
                Params: <code>city</code> (optional), <code>region_id</code> (optional), <code>nationwide</code> (bool)
              </p>
            </div>
          ))}
        </div>

        {/* Quick Start */}
        <h2 className="text-xl font-semibold mb-4">Quick Start</h2>
        <div className="bg-bg-elevated border border-border rounded-lg p-4 mb-4">
          <p className="text-xs text-text-tertiary mb-2">MCP endpoint:</p>
          <code className="text-sm font-mono text-accent-blue block bg-bg-surface px-3 py-2 rounded">
            https://mcp.sirenwise.com/mcp
          </code>
        </div>
        <div className="bg-bg-elevated border border-border rounded-lg p-4">
          <p className="text-xs text-text-tertiary mb-2">Use with any MCP client — add your API key as a Bearer token:</p>
          <pre className="text-xs font-mono text-text-secondary bg-bg-surface px-3 py-2 rounded overflow-x-auto">
{`Authorization: Bearer sw_your_api_key_here`}
          </pre>
        </div>

        {/* Back link */}
        <div className="mt-12 text-center">
          <a href="/" className="text-sm text-text-tertiary hover:text-text-secondary transition-colors">
            ← Back to SirenWise
          </a>
        </div>
      </div>
    </div>
  );
}
