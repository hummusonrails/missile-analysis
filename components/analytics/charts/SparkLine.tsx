"use client";

import { ResponsiveContainer, LineChart, Line } from "recharts";

interface SparkLineProps {
  data: { value: number }[];
  color?: string;
}

export function SparkLine({ data, color = "#3B82F6" }: SparkLineProps) {
  return (
    <ResponsiveContainer width="100%" height={48}>
      <LineChart data={data} margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
        <Line
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 3, fill: color }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
