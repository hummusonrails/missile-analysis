"use client";

interface ComparisonBarProps {
  leftValue: number;
  rightValue: number;
  leftLabel: string;
  rightLabel: string;
  leftColor?: string;
  rightColor?: string;
}

export function ComparisonBar({
  leftValue,
  rightValue,
  leftLabel,
  rightLabel,
  leftColor = "#3B82F6",
  rightColor = "#F59E0B",
}: ComparisonBarProps) {
  const total = leftValue + rightValue;
  const leftPct = total > 0 ? Math.round((leftValue / total) * 100) : 50;
  const rightPct = 100 - leftPct;

  return (
    <div className="px-4 pb-4">
      <div className="flex rounded-full overflow-hidden h-3 mb-3">
        <div
          style={{ width: `${leftPct}%`, background: leftColor, opacity: 0.85 }}
          className="transition-all duration-500"
        />
        <div
          style={{ width: `${rightPct}%`, background: rightColor, opacity: 0.85 }}
          className="transition-all duration-500"
        />
      </div>
      <div className="flex justify-between">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-sm flex-shrink-0" style={{ background: leftColor }} />
          <span className="text-[11px] text-text-secondary font-mono">{leftLabel}</span>
          <span className="text-[11px] text-text-primary font-mono font-semibold">{leftPct}%</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] text-text-primary font-mono font-semibold">{rightPct}%</span>
          <span className="text-[11px] text-text-secondary font-mono">{rightLabel}</span>
          <span className="w-2 h-2 rounded-sm flex-shrink-0" style={{ background: rightColor }} />
        </div>
      </div>
    </div>
  );
}
