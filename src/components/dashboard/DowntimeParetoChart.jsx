import React from "react";
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Cell } from "recharts";

const COLORS = ["#3b82f6", "#14b8a6", "#22c55e", "#eab308", "#f97316", "#a855f7", "#ef4444", "#64748b"];

export default function DowntimeParetoChart({ data }) {
  const total = data.reduce((s, d) => s + d.minutes, 0);
  const top = data[0];

  return (
    <div className="bg-slate-50 rounded-xl border border-slate-200 p-5 flex flex-col">
      <h3 className="font-semibold text-slate-800 [font-family:'Bungee',_system-ui]">Downtime Reasons Pareto</h3>
      <p className="text-sm text-slate-500 mb-3">Minutes by cause &amp; cumulative %</p>
      <div className="flex-1 min-h-[200px]">
        {data.length === 0 ? (
          <div className="h-[200px] flex items-center justify-center text-slate-400 text-sm">No downtime reasons recorded yet</div>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <ComposedChart data={data} margin={{ top: 8, right: 4, left: -18 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="reason" interval={0} tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
              <YAxis yAxisId="left" tick={{ fontSize: 12, fill: "#64748b" }} axisLine={false} tickLine={false} />
              <YAxis yAxisId="right" orientation="right" domain={[0, 100]} unit="%" tick={{ fontSize: 12, fill: "#64748b" }} axisLine={false} tickLine={false} />
              <Tooltip formatter={(v, name) => (name === "Cumulative %" ? [`${v}%`, name] : [`${v} min`, name])} />
              <ReferenceLine
                yAxisId="right"
                y={80}
                stroke="#f97316"
                strokeDasharray="4 4"
                label={{ value: "80% LINE", position: "insideTopRight", fill: "#f97316", fontSize: 11 }} />
              <Bar yAxisId="left" dataKey="minutes" name="Downtime" radius={[4, 4, 0, 0]}>
                {data.map((d, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Bar>
              <Line yAxisId="right" type="monotone" dataKey="cumulative" name="Cumulative %" stroke="#ea580c" strokeWidth={2} dot={{ r: 3 }} />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>
      <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-200 text-sm">
        <span className="text-slate-600">Total downtime: <span className="font-semibold text-amber-600">{total} min</span></span>
        {top && <span className="text-red-500 font-medium">Top cause: {top.reason}</span>}
      </div>
    </div>
  );
}