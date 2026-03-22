"use client";

export function CheckoutButton() {
  async function handleCheckout() {
    const res = await fetch("/api/developer/checkout", { method: "POST" });
    const data = await res.json();
    if (data.url) window.location.href = data.url;
  }

  return (
    <button
      onClick={handleCheckout}
      className="px-6 py-3 bg-accent-blue text-white rounded-lg font-medium hover:bg-accent-blue/90 transition-colors"
    >
      Buy 1,000 requests — $10
    </button>
  );
}
