import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { AlertTriangle } from "lucide-react";
import { fmtQty } from "@/lib/packaging";

const todayStr = () => new Date().toISOString().slice(0, 10);

// Upcoming production planned on the shift logs versus packaging stock on hand.
// Only items with a linked product and a per-unit usage are considered.
export default function PackagingAtRisk() {
  const [risks, setRisks] = useState([]);

  useEffect(() => {
    const load = async () => {
      const [logsPage, itemsPage] = await Promise.all([
        base44.entities.ShiftLog.filter({ shift_date: { $gte: todayStr() } }, { limit: 500 }),
        base44.entities.PackagingItem.filter({ active: true }, { limit: 500 }),
      ]);
      const logs = logsPage.items || [];
      const items = (itemsPage.items || []).filter((i) => i.linked_product && Number(i.qty_per_unit) > 0);
      const next = [];
      items.forEach((item) => {
        const product = item.linked_product.trim().toLowerCase();
        const planned = logs
          .filter((l) => (l.product_name || "").toLowerCase().includes(product))
          .reduce((sum, l) => sum + (Number(l.planned_qty) || 0), 0);
        if (planned <= 0) return;
        const required = planned * Number(item.qty_per_unit);
        if (required > Number(item.quantity || 0)) {
          next.push({ item, required, shortfall: required - Number(item.quantity || 0) });
        }
      });
      setRisks(next);
    };
    load().catch(() => setRisks([]));
  }, []);

  if (!risks.length) return null;

  return (
    <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 mb-6">
      <div className="flex flex-wrap items-center gap-2">
        <AlertTriangle className="w-5 h-5 text-amber-600" />
        <h3 className="text-sm font-semibold text-amber-800">Packaging at risk</h3>
        <Link to="/packaging-stock" className="ml-auto text-xs font-medium text-amber-700 hover:underline">Open Packaging Stock</Link>
      </div>
      <ul className="mt-2 space-y-1">
        {risks.map(({ item, required, shortfall }) => (
          <li key={item.id} className="text-xs text-amber-800">
            <span className="font-semibold">{item.item_code}</span> · upcoming orders need {fmtQty(required)} {item.unit || ""},
            only {fmtQty(item.quantity)} in stock (short {fmtQty(shortfall)})
          </li>
        ))}
      </ul>
    </div>
  );
}