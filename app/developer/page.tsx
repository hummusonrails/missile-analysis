"use client";

import Link from "next/link";
import { CheckoutButton } from "./CheckoutButton";

export default function DeveloperPage() {
  return (
    <div className="min-h-screen bg-bg-primary text-text-primary">
      {/* Branded header */}
      <header className="flex items-center justify-between px-5 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 bg-accent-red rounded-full shadow-[0_0_8px_theme(colors.accent-red/40)] animate-pulse" />
          <span className="font-serif text-[17px] tracking-tight text-text-primary">SirenWise</span>
        </div>
        <Link
          href="/"
          className="text-sm text-text-tertiary hover:text-text-secondary transition-colors"
        >
          ← Back
        </Link>
      </header>

      <div className="max-w-2xl mx-auto px-6 py-8">
        {/* Hero */}
        <h1 className="text-3xl font-serif font-bold mb-3">SirenWise API</h1>
        <p className="text-base text-text-secondary mb-8">
          Programmatic access to Israel&apos;s missile alert intelligence. Analyze alerts for any city or region.
        </p>

        {/* Pricing */}
        <div className="bg-bg-elevated border border-border rounded-xl p-6 mb-8">
          <h2 className="text-xl font-semibold mb-1">$0.01 per request</h2>
          <p className="text-text-secondary mb-5 text-sm">Flat rate for all tools. No subscriptions.</p>

          <div className="grid gap-4 md:grid-cols-3">
            {/* Stripe */}
            <div className="bg-bg-surface border border-border rounded-lg p-4">
              <h3 className="font-mono text-sm font-semibold text-accent-blue mb-2">API Key</h3>
              <p className="text-xs text-text-tertiary mb-4">
                Buy credits via Stripe. Use your key with any MCP client.
              </p>
              <CheckoutButton />
            </div>

            {/* x402 */}
            <div className="bg-bg-surface border border-border rounded-lg p-4">
              <h3 className="font-mono text-sm font-semibold text-accent-amber mb-2">x402 (Base USDC)</h3>
              <p className="text-xs text-text-tertiary mb-4">
                Pay per request with USDC on Base. No API key needed. Permissionless.
              </p>
              <span className="text-xs text-text-tertiary italic">Coming soon — Phase 2</span>
            </div>

            {/* MPP */}
            <div className="bg-bg-surface border border-border rounded-lg p-4">
              <h3 className="font-mono text-sm font-semibold text-accent-green mb-2">MPP (Stripe / Tempo)</h3>
              <p className="text-xs text-text-tertiary mb-4">
                Machine payments via Stripe cards or Tempo stablecoins.
              </p>
              <span className="text-xs text-text-tertiary italic">Coming soon — Phase 3</span>
            </div>
          </div>
        </div>

        {/* Tools Reference */}
        <h2 className="text-lg font-semibold mb-3">Tools</h2>
        <div className="space-y-3 mb-8">
          {[
            {
              name: "get_daily_context",
              desc: "Compare today's alert count against 7-day and 30-day averages.",
              example: 'get_daily_context(city="Tel Aviv")',
            },
            {
              name: "get_sleep_impact",
              desc: "Flag alerts during night hours (10 PM – 6 AM) with deep sleep markers.",
              example: 'get_sleep_impact(city="Haifa")',
            },
            {
              name: "get_clustering",
              desc: "Detect isolated alerts vs barrages within configurable time windows.",
              example: 'get_clustering(nationwide=true)',
            },
            {
              name: "get_streak",
              desc: "Days since last alert. Flags streak-breakers.",
              example: 'get_streak(city="Jerusalem")',
            },
          ].map((tool) => (
            <div key={tool.name} className="bg-bg-elevated border border-border rounded-lg p-4">
              <code className="text-sm font-mono text-accent-blue">{tool.name}</code>
              <p className="text-sm text-text-secondary mt-1">{tool.desc}</p>
              <p className="text-xs text-text-tertiary mt-2">
                Params: <code>city</code> (optional), <code>region_id</code> (optional), <code>nationwide</code> (bool)
              </p>
              <pre className="text-xs font-mono text-text-secondary bg-bg-surface px-3 py-1.5 rounded mt-2 overflow-x-auto">
                {tool.example}
              </pre>
            </div>
          ))}
        </div>

        {/* Quick Start */}
        <h2 className="text-lg font-semibold mb-3">Quick Start</h2>
        <div className="bg-bg-elevated border border-border rounded-lg p-4 mb-3">
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
      </div>

      {/* Simple footer */}
      <footer className="border-t border-border mt-8 px-6 py-4 text-center text-xs text-text-tertiary">
        © {new Date().getFullYear()} SirenWise — Real-time missile alert intelligence
      </footer>
    </div>
  );
}
