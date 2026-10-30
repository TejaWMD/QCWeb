import React from "react";
import { format } from "date-fns";
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

export default function WastageTrendChart({ data }) {
  const chartData = [...data].reverse().map((d) => ({
    label: format(d.day, "MMM d"),
    total: d.total,
  }));
  const max = Math.max(...chartData.map((d) => d.total), 0);

  return (
    <div className="h-full w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#94a3b8" }} tickLine={false} axisLine={{ stroke: "#e2e8f0" }} />
          <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} tickLine={false} axisLine={false} width={40} />
          <Tooltip
            formatter={(v) => [`${Number(v).toLocaleString()} pcs`, "Waste"]}
            contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }}
          />
          <Bar dataKey="total" radius={[4, 4, 0, 0]}>
            {chartData.map((d, i) => (
              <Cell key={i} fill={d.total === max && max > 0 ? "#ef4444" : "#0ea5e9"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}