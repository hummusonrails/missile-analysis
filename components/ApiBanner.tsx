"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";
import Link from "next/link";

const DISMISSED_KEY = "sirenwise-api-banner-dismissed";

export function ApiBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const dismissed = localStorage.getItem(DISMISSED_KEY);
    if (!dismissed) {
      setVisible(true);
    }
  }, []);

  function dismiss() {
    localStorage.setItem(DISMISSED_KEY, "1");
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="mx-4 mb-2 px-3 py-2 bg-bg-surface border-l-2 border-accent-blue rounded-lg text-[11px] flex items-center justify-between gap-2">
      <span className="text-text-secondary">
        SirenWise API now available — programmatic access to alert data.{" "}
        <Link href="/developer" className="text-accent-blue hover:underline">
          Learn more →
        </Link>
      </span>
      <button
        onClick={dismiss}
        className="text-text-tertiary hover:text-text-secondary transition-colors flex-shrink-0"
        aria-label="Dismiss"
      >
        <X size={12} />
      </button>
    </div>
  );
}
