import React from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
} from "recharts";

export default function OTSpendByLineChart({ data }) {
  const maxSpend = Math.max(...data.map((d) => d.spend), 0);

  return (
    <div className="h-full w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
          <XAxis
            dataKey="line"
            tick={{ fontSize: 10, fill: "#94a3b8" }}
            tickLine={false}
            axisLine={{ stroke: "#e2e8f0" }}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "#94a3b8" }}
            tickLine={false}
            axisLine={false}
            width={48}
            tickFormatter={(v) => `RM${v}`}
          />
          <Tooltip
            contentStyle={{
              borderRadius: 8,
              border: "1px solid #e2e8f0",
              fontSize: 12,
              boxShadow: "0 4px 12px rgba(0,0,0,0.06)",
            }}
            labelStyle={{ color: "#475569", fontWeight: 600 }}
            formatter={(value) => [`RM ${Number(value).toFixed(2)}`, "OT Spend"]}
          />
          <Bar dataKey="spend" radius={[4, 4, 0, 0]}>
            {data.map((d, i) => (
              <Cell key={i} fill={d.spend === maxSpend && maxSpend > 0 ? "#ef4444" : "#f59e0b"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}