import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Database } from "lucide-react";
import { loadProducts } from "@/lib/planning";
import { completenessSummary } from "@/lib/productMaster";

// Compact product data health strip for the Attention Dashboard.
export default function ProductDataHealth() {
  const navigate = useNavigate();
  const [summary, setSummary] = useState(null);

  useEffect(() => {
    let alive = true;
    loadProducts()
      .then((rows) => { if (alive) setSummary(completenessSummary(rows)); })
      .catch(() => { if (alive) setSummary({ total: 0, complete: 0, incomplete: 0, percent: 0 }); });
    return () => { alive = false; };
  }, []);

  if (!summary || summary.total === 0) return null;

  const tone = summary.percent >= 90 ? "#00ff9d" : summary.percent >= 60 ? "#ff9f43" : "#ff4d4d";

  return (
    <div className="bg-[#101828] rounded-xl border border-[#1e2740] px-4 py-3 flex flex-wrap items-center gap-3">
      <Database className="w-5 h-5 shrink-0" style={{ color: tone }} />
      <div className="min-w-[180px]">
        <h3 className="text-white text-sm font-semibold">Product Data Health</h3>
        <p className="text-[#a0aec0] text-xs mt-0.5">
          {summary.incomplete} of {summary.total} product(s) incomplete for labels, scheduling, yield or traceability
        </p>
      </div>
      <div className="flex-1 min-w-[140px] h-1.5 rounded-full bg-[#1e2740] overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${summary.percent}%`, backgroundColor: tone }} />
      </div>
      <span className="text-sm font-semibold" style={{ color: tone }}>{summary.percent}% complete</span>
      <button type="button" onClick={() => navigate("/product-master?tab=completeness")} className="text-xs text-[#00e5ff] hover:underline">
        Review data
      </button>
    </div>
  );
}