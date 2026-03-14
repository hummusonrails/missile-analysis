"use client";

import { ResponsiveContainer, BarChart, Bar, Cell } from "recharts";

interface MiniBarChartProps {
  data: { name: string; value: number }[];
  highlightIndices?: number[];
  color?: string;
  highlightColor?: string;
}

export function MiniBarChart({
  data,
  highlightIndices = [],
  color = "#3B82F6",
  highlightColor = "#F59E0B",
}: MiniBarChartProps) {
  return (
    <ResponsiveContainer width="100%" height={56}>
      <BarChart data={data} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
        <Bar dataKey="value" radius={[3, 3, 0, 0]}>
          {data.map((_, index) => (
            <Cell
              key={index}
              fill={highlightIndices.includes(index) ? highlightColor : color}
              fillOpacity={highlightIndices.length > 0 && !highlightIndices.includes(index) ? 0.4 : 0.9}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
