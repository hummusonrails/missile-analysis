// app/api/developer/webhook/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { generateApiKey, storeApiKey } from "@/lib/api-keys";

export async function POST(request: NextRequest) {
  const stripe = getStripe();
  const body = await request.text();
  const sig = request.headers.get("stripe-signature");

  if (!sig) return NextResponse.json({ error: "No signature" }, { status: 400 });

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });

  let event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const email = session.customer_details?.email || "unknown";
    const apiKey = generateApiKey();

    try {
      await storeApiKey(apiKey, email, session.id);
    } catch {
      // Key already created for this session (success page beat us) — skip
      return NextResponse.json({ received: true });
    }

    // Store key in session metadata for retrieval on success page
    await stripe.checkout.sessions.update(session.id, {
      metadata: { api_key: apiKey },
    });
  }

  return NextResponse.json({ received: true });
}
