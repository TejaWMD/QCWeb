import React from "react";
import { format } from "date-fns";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";

export default function OTSpendTrendChart({ data }) {
  // data is sorted desc (latest first); chart reads oldest -> newest
  const chartData = [...data].reverse().map((d) => ({
    label: format(d.day, "MMM d"),
    spend: Number(d.spend.toFixed(2)),
  }));

  return (
    <div className="h-full w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="otSpendGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.35} />
              <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: "#94a3b8" }}
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
            formatter={(value) => [`RM ${value}`, "OT Spend"]}
          />
          <Area
            type="monotone"
            dataKey="spend"
            stroke="#f59e0b"
            strokeWidth={2}
            fill="url(#otSpendGradient)"
            dot={{ r: 3, fill: "#f59e0b", strokeWidth: 0 }}
            activeDot={{ r: 5 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}