"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

interface DonutChartProps {
  data: { name: string; value: number; fill: string }[];
}

export function DonutChart({ data }: DonutChartProps) {
  return (
    <ResponsiveContainer width="100%" height={140}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={40}
          outerRadius={60}
          dataKey="value"
          strokeWidth={0}
        >
          {data.map((entry, index) => (
            <Cell key={index} fill={entry.fill} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            background: "#181D28",
            border: "1px solid rgba(255,255,255,0.06)",
            borderRadius: 8,
            fontSize: 11,
            color: "#E8ECF4",
          }}
          formatter={(value: number, name: string) => [value, name]}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
