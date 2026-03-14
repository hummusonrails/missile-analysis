"use client";

import { useAnalytics } from "../lib/hooks/use-analytics";
import { useI18n } from "../lib/i18n";

interface SystemStatus {
  status: string;
  consecutive_failures: number;
  last_success: number;
}

export function StatusBanner() {
  const { data } = useAnalytics<SystemStatus>("system_status", null);
  const { t } = useI18n();

  if (!data || data.status === "ok") return null;

  const minutesAgo = Math.round((Date.now() - data.last_success) / 60000);

  return (
    <div className="mx-4 mb-2 px-3 py-2 bg-accent-amber/10 border border-accent-amber/20 rounded-lg text-[11px] text-accent-amber">
      {t("status.stale")} — {minutesAgo}m ago
    </div>
  );
}
