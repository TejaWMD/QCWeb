import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Package, AlertTriangle } from "lucide-react";
import { fmtQty, isLowStock } from "@/lib/packaging";

// Low-stock packaging materials on the main factory dashboard.
export default function PackagingLowStock() {
  const [low, setLow] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const page = await base44.entities.PackagingItem.filter({ active: true }, { limit: 500 });
      setLow((page.items || []).filter(isLowStock).sort((a, b) => Number(a.quantity) - Number(b.quantity)));
      setLoading(false);
    };
    load().catch(() => setLoading(false));
    const unsubscribe = base44.entities.PackagingItem.subscribe(() => load().catch(() => {}));
    return () => { if (typeof unsubscribe === "function") unsubscribe(); };
  }, []);

  if (loading) return null;

  return (
    <div className={`rounded-xl border px-4 py-3 ${low.length ? "border-[#ff9f43]/50 bg-[#ff9f43]/10" : "border-[#1e2740] bg-[#101828]"}`}>
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          {low.length ? <AlertTriangle className="w-5 h-5 text-[#ff9f43]" /> : <Package className="w-5 h-5 text-[#00e5ff]" />}
          <h3 className="text-white text-sm font-semibold">Packaging stock</h3>
        </div>
        <p className={`text-xs ${low.length ? "text-[#ff9f43]" : "text-[#a0aec0]"}`}>
          {low.length
            ? `${low.length} item${low.length === 1 ? "" : "s"} at or below minimum level`
            : "All packaging materials are above their minimum level"}
        </p>
        <Link to="/packaging-stock" className="ml-auto text-xs text-[#00e5ff] hover:underline">Open Packaging Stock</Link>
      </div>
      {low.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {low.slice(0, 6).map((item) => (
            <span key={item.id} className="text-[11px] rounded-full border border-[#ff9f43]/40 bg-[#0a0e17] px-2.5 py-1 text-[#e2e8f0]">
              {item.item_code} · {fmtQty(item.quantity)} / min {fmtQty(item.min_level)} {item.unit || ""}
            </span>
          ))}
          {low.length > 6 && <span className="text-[11px] text-[#5f6b7f] self-center">+{low.length - 6} more</span>}
        </div>
      )}
    </div>
  );
}