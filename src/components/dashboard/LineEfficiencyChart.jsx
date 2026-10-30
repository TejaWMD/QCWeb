import React from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, LabelList } from "recharts";
import { EFFICIENCY_TARGET } from "@/lib/dashboardMetrics";

export default function LineEfficiencyChart({ data }) {
  const lowest = data.length ? data.reduce((min, d) => d.actual < min.actual ? d : min, data[0]) : null;
  const met = data.filter((d) => d.actual >= EFFICIENCY_TARGET).length;

  const renderLabel = ({ x, y, width, value, index }) => {
    const pass = value >= EFFICIENCY_TARGET;
    const cx = x + width / 2;
    return (
      <g key={index}>
        <text x={cx} y={y - 17} textAnchor="middle" fontSize={11} fontWeight={700} fill={pass ? "#16a34a" : "#dc2626"}>
          {value}%
        </text>
        <text x={cx} y={y - 5} textAnchor="middle" fontSize={12} fill={pass ? "#16a34a" : "#dc2626"}>
          {pass ? "✓" : "!"}
        </text>
      </g>
    );
  };

  return (
    <div className="bg-slate-50 rounded-xl border border-slate-200 p-5 flex flex-col">
      <h3 className="font-semibold text-slate-800 [font-family:'Bungee',_system-ui]">Line Efficiency Rate</h3>
      <p className="text-sm text-slate-500 mb-3">Actual vs target (%)</p>
      <div className="flex-1 min-h-[180px]">
        {data.length === 0 ? (
          <div className="h-[180px] flex items-center justify-center text-slate-400 text-sm">No output recorded yet</div>
        ) : (
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={data} barGap={4} margin={{ top: 22, right: 8, left: -18 }}>
              <defs>
                <linearGradient id="effGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#38bdf8" />
                  <stop offset="100%" stopColor="#0d9488" />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="line" tick={{ fontSize: 12, fill: "#64748b" }} axisLine={false} tickLine={false} />
              <YAxis domain={[0, 100]} unit="%" tick={{ fontSize: 12, fill: "#64748b" }} axisLine={false} tickLine={false} />
              <Tooltip formatter={(v) => `${v}%`} />
              <ReferenceLine
                y={EFFICIENCY_TARGET}
                stroke="#dc2626"
                strokeDasharray="4 4"
                label={{ value: `TARGET LINE (${EFFICIENCY_TARGET}%)`, position: "insideTopRight", fill: "#dc2626", fontSize: 11 }} />
              <Bar dataKey="target" name="Target" fill="#cbd5e1" radius={[4, 4, 0, 0]} />
              <Bar dataKey="actual" name="Actual" fill="url(#effGradient)" radius={[4, 4, 0, 0]}>
                <LabelList dataKey="actual" content={renderLabel} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
      <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-200 text-sm">
        <span className="text-slate-600">Met target: <span className="font-semibold text-green-600">{met}/{data.length} lines</span></span>
        {lowest && <span className="text-red-500 font-medium">Lowest: {lowest.line} ({lowest.actual}%)</span>}
      </div>
    </div>
  );
}