import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, TrendingDown } from "lucide-react";
import { todayStr } from "@/lib/warehouse";
import { loadBatchYields, loadReworks } from "@/lib/yieldLoss";

// Small dashboard tile: today's loss in kg from batch yield shortfall plus rework.
export default function LossTodayTile() {
  const [state, setState] = useState({ loading: true, yieldLoss: 0, rework: 0 });

  useEffect(() => {
    (async () => {
      const today = todayStr();
      const [yields, reworks] = await Promise.all([loadBatchYields(), loadReworks()]);
      const yieldLoss = yields
        .filter((r) => r.shift_date === today)
        .reduce((sum, r) => sum + Math.max(0, (r.input_kg || 0) - (r.output_kg || 0)), 0);
      const rework = reworks.filter((r) => r.rework_date === today).reduce((sum, r) => sum + (r.quantity_kg || 0), 0);
      setState({ loading: false, yieldLoss: Math.round(yieldLoss * 10) / 10, rework: Math.round(rework * 10) / 10 });
    })();
  }, []);

  const total = Math.round((state.yieldLoss + state.rework) * 10) / 10;

  return (
    <Link to="/yield-loss" className="block rounded-xl border border-[#1e2740] bg-[#0e131d] px-4 py-3 hover:border-[#00e5ff]/40">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] uppercase tracking-widest text-[#5f6b7f] font-semibold">Loss today</p>
        <TrendingDown className="w-4 h-4 text-[#ff9f43]" />
      </div>
      <p className="text-xl font-bold text-white leading-tight mt-0.5">
        {state.loading ? "…" : `${total.toLocaleString("en-US")} kg`}
      </p>
      <p className="text-[10px] text-[#5f6b7f] mt-0.5">
        {state.loading ? "" : `${state.yieldLoss} kg yield · ${state.rework} kg rework`}
      </p>
      <span className="inline-flex items-center gap-1 text-[11px] text-[#00e5ff] mt-1">
        Open Yield &amp; Loss <ArrowRight className="w-3 h-3" />
      </span>
    </Link>
  );
}