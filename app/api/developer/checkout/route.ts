// app/api/developer/checkout/route.ts
import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";

export async function POST() {
  const stripe = getStripe();

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        price_data: {
          currency: "usd",
          unit_amount: 1000, // $10.00
          product_data: {
            name: "SirenWise API — 1,000 requests",
            description: "Access to all 4 SirenWise MCP tools. $0.01 per request.",
          },
        },
        quantity: 1,
      },
    ],
    success_url: `${process.env.NEXT_PUBLIC_SITE_URL || "https://sirenwise.com"}/developer/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL || "https://sirenwise.com"}/developer`,
  });

  return NextResponse.json({ url: session.url });
}
