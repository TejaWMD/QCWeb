import React from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

export default function OutputByLineChart({ data }) {
  const topLine = data.reduce((max, d) => d.good > max.good ? d : max, data[0] || { line: "—" });

  return (
    <div className="bg-slate-50 rounded-xl border border-slate-200 p-5 flex flex-col">
      <h3 className="font-semibold text-slate-800 [font-family:'Bungee',_system-ui]">Output by Line</h3>
      <p className="text-sm text-slate-500 mb-3">Good Output vs Rejected</p>
      <div className="flex-1 min-h-[180px]">
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={data} barGap={4}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
            <XAxis dataKey="line" tick={{ fontSize: 12, fill: "#64748b" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 12, fill: "#64748b" }} axisLine={false} tickLine={false} />
            <Tooltip />
            <Bar dataKey="good" name="Good Output" fill="#22c55e" radius={[4, 4, 0, 0]} />
            <Bar dataKey="rejected" name="Rejected" fill="#ef4444" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-200 text-sm">
        <span className="text-slate-500 font-medium">Top Producer</span>
        <span className="text-green-600 font-medium">{topLine.line}</span>
      </div>
    </div>
  );
}