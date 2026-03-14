"use client";

interface StatRowProps {
  label: string;
  sublabel?: string;
  value: string | number;
  color?: string;
}

export function StatRow({ label, sublabel, value, color }: StatRowProps) {
  return (
    <div className="flex items-center justify-between px-4 py-2.5 border-t border-border">
      <div className="flex flex-col">
        <span className="text-[12px] text-text-primary font-medium">{label}</span>
        {sublabel && (
          <span className="text-[10px] text-text-tertiary font-mono mt-0.5">{sublabel}</span>
        )}
      </div>
      <span
        className="text-[13px] font-mono font-semibold"
        style={{ color: color ?? "#E8ECF4" }}
      >
        {value}
      </span>
    </div>
  );
}
