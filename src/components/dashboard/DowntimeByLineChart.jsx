import React from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList } from "recharts";

export default function DowntimeByLineChart({ data }) {
  const total = data.reduce((s, d) => s + d.total, 0);

  return (
    <div className="bg-slate-50 rounded-xl border border-slate-200 p-5 flex flex-col">
      <h3 className="font-semibold text-slate-800 [font-family:'Bungee',_system-ui]">Downtime Breakdown by Line</h3>
      <p className="text-sm text-slate-500 mb-3">Planned vs unplanned minutes</p>
      <div className="flex-1 min-h-[200px]">
        {data.length === 0 ? (
          <div className="h-[200px] flex items-center justify-center text-slate-400 text-sm">No downtime recorded yet</div>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={data} layout="vertical" margin={{ top: 4, right: 56, left: 4 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
              <XAxis type="number" tick={{ fontSize: 12, fill: "#64748b" }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="line" width={60} tick={{ fontSize: 12, fill: "#64748b" }} axisLine={false} tickLine={false} />
              <Tooltip formatter={(v, name) => [`${v} min`, name]} />
              <Bar dataKey="unplanned" name="Unplanned" stackId="a" fill="#ef4444" />
              <Bar dataKey="planned" name="Planned" stackId="a" fill="#22c55e" radius={[0, 4, 4, 0]}>
                <LabelList dataKey="total" position="right" formatter={(v) => `${v} min`} style={{ fontSize: 11, fill: "#64748b" }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
      <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-200 text-sm">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5 text-slate-600">
            <span className="w-3 h-3 rounded-sm bg-red-500" /> Unplanned
          </span>
          <span className="flex items-center gap-1.5 text-slate-600">
            <span className="w-3 h-3 rounded-sm bg-green-500" /> Planned
          </span>
        </div>
        <span className="text-slate-600">Total: <span className="font-semibold text-amber-600">{total} min</span></span>
      </div>
    </div>
  );
}