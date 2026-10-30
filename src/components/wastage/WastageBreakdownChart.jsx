import React from "react";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from "recharts";

const COLORS = [
  "#0ea5e9", "#f59e0b", "#10b981", "#ef4444", "#8b5cf6", "#ec4899",
  "#14b8a6", "#f97316", "#6366f1", "#84cc16", "#06b6d4", "#a855f7",
  "#eab308", "#64748b",
];

export default function WastageBreakdownChart({ data }) {
  const sorted = [...data].filter((d) => d.value > 0).sort((a, b) => b.value - a.value);
  return (
    <div className="h-full w-full flex flex-col">
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={sorted} dataKey="value" nameKey="name" innerRadius="55%" outerRadius="80%" paddingAngle={2}>
              {sorted.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              formatter={(v) => [`${Number(v).toLocaleString()} pcs`, "Waste"]}
              contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs mt-2">
        {sorted.map((d, i) => (
          <div key={d.name} className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
            <span className="text-slate-600 truncate">{d.name}</span>
            <span className="ml-auto font-medium text-slate-700">{d.value.toLocaleString()}</span>
          </div>
        ))}
      </div>
    </div>
  );
}