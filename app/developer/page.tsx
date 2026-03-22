"use client";

import Link from "next/link";
import { useState } from "react";
import { CheckoutButton } from "./CheckoutButton";

type ModalId = "x402" | "mpp" | null;

function PaymentModal({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-xl bg-bg-elevated border border-border rounded-2xl p-6 shadow-xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

const X402_CODE = `import { wrapFetchWithPayment, x402Client } from "@x402/fetch";
import { registerExactEvmScheme } from "@x402/evm/exact/client";
import { privateKeyToAccount } from "viem/accounts";

const signer = privateKeyToAccount(process.env.EVM_PRIVATE_KEY);
const client = new x402Client();
registerExactEvmScheme(client, { signer });

const paidFetch = wrapFetchWithPayment(fetch, client);

const response = await paidFetch("https://mcp.sirenwise.com/mcp", {
  method: "POST",
  headers: { "Content-Type": "application/json", "Accept": "application/json, text/event-stream" },
  body: JSON.stringify({
    jsonrpc: "2.0",
    method: "tools/call",
    params: { name: "get_daily_context", arguments: { city: "Tel Aviv" } },
    id: 1,
  }),
});`;

const MPP_CODE = `import Mppx from "mppx";

const client = Mppx.create({
  methods: [{
    name: "tempo",
    privateKey: process.env.TEMPO_PRIVATE_KEY,
    chainId: 4217,
    rpcUrl: "https://rpc.tempo.xyz",
  }],
});

const response = await client.fetch("https://mcp.sirenwise.com/mcp", {
  method: "POST",
  headers: { "Content-Type": "application/json", "Accept": "application/json, text/event-stream" },
  body: JSON.stringify({
    jsonrpc: "2.0",
    method: "tools/call",
    params: { name: "get_streak", arguments: { city: "Beer Sheva" } },
    id: 1,
  }),
});`;

export default function DeveloperPage() {
  const [openModal, setOpenModal] = useState<ModalId>(null);

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
            {/* Stripe / API Key */}
            <div className="bg-bg-surface border border-border rounded-xl p-5 flex flex-col gap-3">
              <div>
                <span className="inline-block text-xs font-mono font-semibold text-accent-blue bg-accent-blue/10 px-2 py-0.5 rounded mb-2">
                  API Key
                </span>
                <h3 className="font-semibold text-sm text-text-primary">Pay with Stripe</h3>
                <p className="text-xs text-text-tertiary mt-1">
                  Buy credits via Stripe. Use your key with any MCP client.
                </p>
              </div>
              <div className="mt-auto">
                <CheckoutButton />
              </div>
            </div>

            {/* x402 */}
            <div className="bg-bg-surface border border-border rounded-xl p-5 flex flex-col gap-3">
              <div>
                <span className="inline-block text-xs font-mono font-semibold text-accent-amber bg-accent-amber/10 px-2 py-0.5 rounded mb-2">
                  x402
                </span>
                <h3 className="font-semibold text-sm text-text-primary">Pay with USDC</h3>
                <p className="text-xs text-text-tertiary mt-1">
                  Pay per request with USDC on Arbitrum One. No API key needed.
                </p>
              </div>
              <div className="mt-auto">
                <button
                  onClick={() => setOpenModal("x402")}
                  className="w-full text-sm font-medium text-accent-amber border border-accent-amber/40 bg-accent-amber/5 hover:bg-accent-amber/10 rounded-lg px-4 py-2 transition-colors"
                >
                  View Integration Guide
                </button>
              </div>
            </div>

            {/* MPP */}
            <div className="bg-bg-surface border border-border rounded-xl p-5 flex flex-col gap-3">
              <div>
                <span className="inline-block text-xs font-mono font-semibold text-accent-green bg-accent-green/10 px-2 py-0.5 rounded mb-2">
                  MPP
                </span>
                <h3 className="font-semibold text-sm text-text-primary">Pay via Tempo</h3>
                <p className="text-xs text-text-tertiary mt-1">
                  Machine payments via Tempo stablecoins. Built on MPP by Stripe &amp; Tempo.
                </p>
              </div>
              <div className="mt-auto">
                <button
                  onClick={() => setOpenModal("mpp")}
                  className="w-full text-sm font-medium text-accent-green border border-accent-green/40 bg-accent-green/5 hover:bg-accent-green/10 rounded-lg px-4 py-2 transition-colors"
                >
                  View Integration Guide
                </button>
              </div>
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
        <div className="bg-bg-elevated border border-border rounded-lg p-4 space-y-3">
          <div>
            <p className="text-xs text-text-tertiary mb-1">API Key (Stripe):</p>
            <pre className="text-xs font-mono text-text-secondary bg-bg-surface px-3 py-2 rounded overflow-x-auto">
{`Authorization: Bearer sw_your_api_key_here`}
            </pre>
          </div>
          <div>
            <p className="text-xs text-text-tertiary mb-1">x402 (Arbitrum USDC):</p>
            <p className="text-xs text-text-secondary">No API key needed — <code className="text-accent-amber">@x402/fetch</code> handles payment automatically via the 402 protocol.</p>
          </div>
          <div>
            <p className="text-xs text-text-tertiary mb-1">MPP (Tempo):</p>
            <p className="text-xs text-text-secondary">No API key needed — <code className="text-accent-green">mppx</code> handles payment via the Machine Payments Protocol.</p>
          </div>
        </div>
      </div>

      {/* Simple footer */}
      <footer className="border-t border-border mt-8 px-6 py-4 text-center text-xs text-text-tertiary">
        © {new Date().getFullYear()} SirenWise — Real-time missile alert intelligence
      </footer>

      {/* x402 Modal */}
      <PaymentModal open={openModal === "x402"} onClose={() => setOpenModal(null)}>
        <div className="flex items-start justify-between mb-4">
          <div>
            <span className="inline-block text-xs font-mono font-semibold text-accent-amber bg-accent-amber/10 px-2 py-0.5 rounded mb-2">
              x402
            </span>
            <h2 className="text-lg font-semibold text-text-primary">Pay with USDC on Arbitrum</h2>
          </div>
          <button
            onClick={() => setOpenModal(null)}
            className="text-text-tertiary hover:text-text-secondary transition-colors ml-4 mt-0.5"
            aria-label="Close modal"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <p className="text-sm text-text-secondary mb-5">
          The x402 protocol uses HTTP 402 Payment Required responses to enable per-request payments. When your client
          hits the SirenWise endpoint, it receives a payment challenge, settles the payment on Arbitrum using USDC,
          and retries the request automatically. No API key or account needed — just a funded wallet. The{" "}
          <code className="text-accent-amber">@x402/fetch</code> library handles the entire challenge–pay–retry
          flow for you.
        </p>

        <div className="mb-4">
          <p className="text-xs text-text-tertiary mb-1.5">Install</p>
          <pre className="text-xs font-mono text-text-secondary bg-bg-primary px-3 py-2.5 rounded-lg overflow-x-auto">
            npm install @x402/fetch @x402/evm viem
          </pre>
        </div>

        <div className="mb-5">
          <p className="text-xs text-text-tertiary mb-1.5">Integration example</p>
          <pre className="text-xs font-mono text-text-secondary bg-bg-primary px-3 py-3 rounded-lg overflow-x-auto leading-relaxed">
            {X402_CODE}
          </pre>
        </div>

        <div className="mb-5 bg-bg-primary rounded-lg px-4 py-3 text-xs space-y-1">
          <p className="text-text-tertiary font-medium mb-1.5">Network</p>
          <p className="text-text-secondary">
            <span className="text-text-tertiary">Chain:</span> Arbitrum One (Chain ID: 42161)
          </p>
          <p className="text-text-secondary">
            <span className="text-text-tertiary">USDC contract:</span>{" "}
            <code className="text-accent-amber text-[11px]">0xaf88d065e77c8cC2239327C5EDb3A432268e5831</code>
          </p>
        </div>

        <div className="flex gap-3">
          <a
            href="https://docs.x402.org"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium text-accent-amber hover:underline"
          >
            x402 Documentation →
          </a>
          <a
            href="https://arbiscan.io/token/0xaf88d065e77c8cC2239327C5EDb3A432268e5831"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium text-accent-amber hover:underline"
          >
            Arbitrum USDC →
          </a>
        </div>
      </PaymentModal>

      {/* MPP Modal */}
      <PaymentModal open={openModal === "mpp"} onClose={() => setOpenModal(null)}>
        <div className="flex items-start justify-between mb-4">
          <div>
            <span className="inline-block text-xs font-mono font-semibold text-accent-green bg-accent-green/10 px-2 py-0.5 rounded mb-2">
              MPP
            </span>
            <h2 className="text-lg font-semibold text-text-primary">Machine Payments via Tempo</h2>
          </div>
          <button
            onClick={() => setOpenModal(null)}
            className="text-text-tertiary hover:text-text-secondary transition-colors ml-4 mt-0.5"
            aria-label="Close modal"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <p className="text-sm text-text-secondary mb-5">
          The Machine Payments Protocol (MPP), developed by Stripe and Tempo, is an open standard for autonomous
          agent-to-service payments. Tempo provides a stablecoin network optimised for machine-speed settlement.
          The <code className="text-accent-green">mppx</code> client library handles the full 402 challenge flow,
          letting your agent pay for each SirenWise request without any pre-registration or API keys.
        </p>

        <div className="mb-4">
          <p className="text-xs text-text-tertiary mb-1.5">Install</p>
          <pre className="text-xs font-mono text-text-secondary bg-bg-primary px-3 py-2.5 rounded-lg overflow-x-auto">
            npm install mppx
          </pre>
        </div>

        <div className="mb-5">
          <p className="text-xs text-text-tertiary mb-1.5">Integration example</p>
          <pre className="text-xs font-mono text-text-secondary bg-bg-primary px-3 py-3 rounded-lg overflow-x-auto leading-relaxed">
            {MPP_CODE}
          </pre>
        </div>

        <div className="mb-5 bg-bg-primary rounded-lg px-4 py-3 text-xs space-y-1">
          <p className="text-text-tertiary font-medium mb-1.5">Network</p>
          <p className="text-text-secondary">
            <span className="text-text-tertiary">Chain:</span> Tempo Mainnet (Chain ID: 4217)
          </p>
          <p className="text-text-secondary">
            <span className="text-text-tertiary">RPC:</span>{" "}
            <code className="text-accent-green text-[11px]">https://rpc.tempo.xyz</code>
          </p>
        </div>

        <div className="flex gap-3">
          <a
            href="https://mpp.dev"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium text-accent-green hover:underline"
          >
            MPP Documentation →
          </a>
          <a
            href="https://tempo.xyz"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium text-accent-green hover:underline"
          >
            Tempo →
          </a>
        </div>
      </PaymentModal>
    </div>
  );
}
