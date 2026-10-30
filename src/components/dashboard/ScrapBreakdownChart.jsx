import React from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

const COLORS = {
  Caps: "#ef4444",
  Bottles: "#f97316",
  Labels: "#0284c7",
  Cartons: "#8b5cf6"
};

export default function ScrapBreakdownChart({ data }) {
  const chartData = [
  { name: "Caps", value: data.caps },
  { name: "Bottles", value: data.bottles },
  { name: "Labels", value: data.labels },
  { name: "Cartons", value: data.cartons }];

  const total = chartData.reduce((s, d) => s + d.value, 0);
  const topSource = chartData.reduce((max, d) => d.value > max.value ? d : max, chartData[0]);

  return (
    <div className="bg-slate-50 rounded-xl border border-slate-200 p-5 flex flex-col">
      <h3 className="font-semibold text-slate-800 [font-family:'Bungee',_system-ui]">Packaging Scrap Breakdown</h3>
      <p className="text-sm text-slate-500 mb-3">By Component Type</p>
      <div className="flex-1 flex items-center justify-center min-h-[180px]">
        <ResponsiveContainer width="100%" height={180}>
          <PieChart>
            <Pie data={chartData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={45} outerRadius={75} paddingAngle={2}>
              {chartData.map((entry) =>
              <Cell key={entry.name} fill={COLORS[entry.name]} />
              )}
            </Pie>
            <Tooltip formatter={(v) => `${v} Pcs`} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 justify-center text-xs">
        {chartData.map((d) =>
        <span key={d.name} className="flex items-center gap-1.5 text-slate-600">
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: COLORS[d.name] }} />
            {d.name}
          </span>
        )}
      </div>
      <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-200 text-sm">
        <span className="font-semibold text-slate-700">Top Waste Source: {topSource.name}</span>
        <span className="text-sky-600 font-medium cursor-pointer">Scrap Advisory</span>
      </div>
    </div>);

}