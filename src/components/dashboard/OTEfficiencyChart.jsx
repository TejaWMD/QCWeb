import React from "react";
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

export default function OTEfficiencyChart({ data }) {
  return (
    <div className="bg-slate-50 rounded-xl border border-slate-200 p-5 flex flex-col">
      <h3 className="font-semibold text-slate-800 [font-family:'Bungee',_system-ui]">OT Man-Hours vs Output</h3>
      <p className="text-sm text-slate-500 mb-3">Labor Efficiency</p>
      <div className="flex-1 min-h-[180px]">
        <ResponsiveContainer width="100%" height={180}>
          <ComposedChart data={data}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
            <XAxis dataKey="line" tick={{ fontSize: 12, fill: "#64748b" }} axisLine={false} tickLine={false} />
            <YAxis yAxisId="left" domain={[0, 1]} tick={{ fontSize: 12, fill: "#64748b" }} axisLine={false} tickLine={false} />
            <YAxis yAxisId="right" orientation="right" domain={[0, 100]} tick={{ fontSize: 12, fill: "#64748b" }} axisLine={false} tickLine={false} unit="%" />
            <Tooltip />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar yAxisId="left" dataKey="otHours" name="OT Man-Hours" fill="#f97316" radius={[4, 4, 0, 0]} />
            <Line yAxisId="right" type="monotone" dataKey="achieve" name="Achievement %" stroke="#22c55e" strokeWidth={2} dot={{ r: 3 }} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-200 text-sm">
        <span className="font-semibold text-slate-700">Correlation: OT Efficiency Index</span>
        <span className="text-green-600 font-medium">Optimal</span>
      </div>
    </div>);

}