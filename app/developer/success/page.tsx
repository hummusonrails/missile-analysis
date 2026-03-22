// app/developer/success/page.tsx
import type { Metadata } from "next";
import { getStripe } from "@/lib/stripe";
import { generateApiKey, storeApiKey } from "@/lib/api-keys";

export const metadata: Metadata = {
  title: "API Key Created — SirenWise",
};

async function getOrCreateKey(sessionId: string) {
  const stripe = getStripe();
  const session = await stripe.checkout.sessions.retrieve(sessionId);

  if (session.payment_status !== "paid") {
    return null;
  }

  // Check if key already exists in metadata (from webhook)
  if (session.metadata?.api_key) {
    return session.metadata.api_key;
  }

  // Generate key synchronously (webhook may not have fired yet)
  // storeApiKey uses stripe_session_id UNIQUE constraint for idempotency —
  // if webhook already created a key for this session, the INSERT will fail
  // and we retrieve the existing key from metadata instead
  const apiKey = generateApiKey();
  const email = session.customer_details?.email || "unknown";
  try {
    await storeApiKey(apiKey, email, sessionId);
    await stripe.checkout.sessions.update(sessionId, {
      metadata: { api_key: apiKey },
    });
  } catch {
    // Key already exists for this session (webhook beat us) — re-fetch
    const updated = await stripe.checkout.sessions.retrieve(sessionId);
    return updated.metadata?.api_key || null;
  }

  return apiKey;
}

export default async function SuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  const params = await searchParams;
  const sessionId = params.session_id;

  if (!sessionId) {
    return (
      <div className="min-h-screen bg-bg-primary text-text-primary flex items-center justify-center">
        <p className="text-text-secondary">Invalid session.</p>
      </div>
    );
  }

  const apiKey = await getOrCreateKey(sessionId);

  if (!apiKey) {
    return (
      <div className="min-h-screen bg-bg-primary text-text-primary flex items-center justify-center">
        <p className="text-text-secondary">Payment not confirmed yet. Please refresh in a moment.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg-primary text-text-primary">
      <div className="max-w-xl mx-auto px-6 py-16">
        <h1 className="text-2xl font-serif font-bold mb-4 text-accent-green">API Key Created</h1>
        <p className="text-text-secondary mb-6">
          Copy your API key below. This is the only time it will be displayed.
        </p>

        <div className="bg-bg-elevated border border-accent-green/30 rounded-lg p-4 mb-8">
          <p className="text-xs text-text-tertiary mb-2">Your API key (1,000 requests):</p>
          <code className="text-sm font-mono text-accent-green break-all block bg-bg-surface px-3 py-2 rounded select-all">
            {apiKey}
          </code>
        </div>

        <div className="bg-bg-elevated border border-border rounded-lg p-4 mb-8">
          <p className="text-xs text-text-tertiary mb-2">MCP endpoint:</p>
          <code className="text-sm font-mono text-accent-blue block">
            https://mcp.sirenwise.com/mcp
          </code>
          <p className="text-xs text-text-tertiary mt-3 mb-2">Authorization header:</p>
          <code className="text-sm font-mono text-text-secondary block">
            Bearer {apiKey.slice(0, 8)}...
          </code>
        </div>

        <a href="/developer" className="text-sm text-text-tertiary hover:text-text-secondary transition-colors">
          ← Back to Developer docs
        </a>
      </div>
    </div>
  );
}
