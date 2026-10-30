import React from "react";
import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ReferenceArea, ResponsiveContainer, ZAxis,
} from "recharts";
import { format } from "date-fns";

const MANPOWER_SPLIT = 35;
const OT_HIGH = 60;
const OT_LOW = 30;

const zoneOf = (manpower, otHrs) => {
  if (otHrs > OT_HIGH) return "High Overtime — Burnout & High Cost Risk";
  if (otHrs < OT_LOW) return "Low Overtime — Normal Baseline";
  return "Normal Zone";
};

const colorOf = (manpower, otHrs) => {
  if (otHrs > OT_HIGH) return "#ef4444";
  if (otHrs < OT_LOW) return "#22c55e";
  return "#f59e0b";
};

export default function WorkforceQuadrantChart({ data }) {
  const points = (data || [])
    .map((d) => ({
      ...d,
      x: d.manpower || 0,
      y: Number(d.hours.toFixed(1)),
      dateLabel: format(d.day, "MMM d"),
    }))
    .sort((a, b) => b.y - a.y);

  const maxX = Math.max(MANPOWER_SPLIT + 15, ...points.map((p) => p.x)) + 5;
  const maxY = Math.max(OT_HIGH + 20, ...points.map((p) => p.y)) + 10;

  const zoneLabel = (x, y, text, color) => (
    <text x={x} y={y} fontSize={11} fontWeight={600} fill={color} textAnchor="middle">
      {text}
    </text>
  );

  return (
    <ResponsiveContainer width="100%" height="100%">
      <ScatterChart margin={{ top: 30, right: 30, bottom: 30, left: 10 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis
          type="number" dataKey="x" name="Manpower"
          domain={[0, maxX]}
          label={{ value: "Manpower (staff/day)", position: "insideBottom", offset: -20, fontSize: 12, fill: "#64748b" }}
          tick={{ fontSize: 11, fill: "#64748b" }}
        />
        <YAxis
          type="number" dataKey="y" name="OT Hrs"
          domain={[0, maxY]}
          label={{ value: "OT Hours / day", angle: -90, position: "insideLeft", offset: 15, fontSize: 12, fill: "#64748b" }}
          tick={{ fontSize: 11, fill: "#64748b" }}
        />
        <ZAxis range={[90, 90]} />

        {/* Quadrant shading */}
        <ReferenceArea x1={MANPOWER_SPLIT} x2={maxX} y1={OT_HIGH} y2={maxY} fill="#fee2e2" fillOpacity={0.45} stroke="none" />
        <ReferenceArea x1={0} x2={maxX} y1={0} y2={OT_LOW} fill="#dcfce7" fillOpacity={0.35} stroke="none" />

        {/* Split lines */}
        <ReferenceLine x={MANPOWER_SPLIT} stroke="#94a3b8" strokeDasharray="6 4" label={{ value: "<35 | >40+", position: "bottom", fontSize: 10, fill: "#94a3b8", offset: 10 }} />
        <ReferenceLine y={OT_HIGH} stroke="#ef4444" strokeDasharray="6 4" label={{ value: ">60 hrs: High OT Risk", position: "right", fontSize: 10, fill: "#ef4444" }} />
        <ReferenceLine y={OT_LOW} stroke="#22c55e" strokeDasharray="6 4" label={{ value: "<30 hrs: Low OT", position: "right", fontSize: 10, fill: "#16a34a" }} />

        {/* Zone labels */}
        {zoneLabel((maxX + MANPOWER_SPLIT) / 2, OT_HIGH + 12, "HIGH OVERTIME — Burnout & Cost Risk", "#dc2626")}
        {zoneLabel((maxX + MANPOWER_SPLIT) / 2, 8, "LOW OVERTIME — Normal Baseline", "#16a34a")}

        <Tooltip
          cursor={{ strokeDasharray: "3 3" }}
          content={({ active, payload }) => {
            if (!active || !payload || !payload.length) return null;
            const p = payload[0].payload;
            return (
              <div className="bg-white border border-slate-200 rounded-lg shadow-lg px-3 py-2 text-xs">
                <p className="font-semibold text-slate-800 mb-1">{p.dateLabel}</p>
                <p className="text-slate-600">Manpower: <span className="font-medium text-slate-800">{p.manpower}</span></p>
                <p className="text-slate-600">OT Hours: <span className="font-medium text-amber-700">{p.y} hrs</span></p>
                <p className="text-slate-600">Sessions: <span className="font-medium text-slate-800">{p.count}</span></p>
                <p className={`mt-1 font-medium ${p.y > OT_HIGH ? "text-red-600" : p.y < OT_LOW ? "text-green-600" : "text-amber-600"}`}>{zoneOf(p.x, p.y)}</p>
              </div>
            );
          }}
        />

        <Scatter
          name="Daily OT"
          data={points}
          fill="#f59e0b"
          shape={(props) => {
            const { cx, cy, payload } = props;
            const color = colorOf(payload.x, payload.y);
            return (
              <g>
                <circle cx={cx} cy={cy} r={8} fill={color} fillOpacity={0.85} stroke="#fff" strokeWidth={1.5} />
                <text x={cx} y={cy - 12} textAnchor="middle" fontSize={9} fontWeight={600} fill="#334155">
                  {payload.dateLabel}
                </text>
              </g>
            );
          }}
        />
      </ScatterChart>
    </ResponsiveContainer>
  );
}