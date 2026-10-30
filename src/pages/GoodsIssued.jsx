import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Save } from "lucide-react";
import OutLineRow from "@/components/packaging/OutLineRow";
import { fmtQty, loadPackagingSettings, loadProductionOrders, newGroupId, submitStockUse } from "@/lib/packaging";
import { loadProducts } from "@/lib/planning";
import { todayStr } from "@/lib/warehouse";

let seq = 0;
const blankLine = () => ({
  key: `out${++seq}`,
  item_id: "",
  quantity: "",
  batch_number: "",
  production_order: "",
  production_line: "",
  product_id: "",
  product_code: "",
  product_name: "",
  remarks: "",
});

// Goods issued: stock leaving the warehouse for production, several lines at a time.
export default function GoodsIssued() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [items, setItems] = useState([]);
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [settings, setSettings] = useState({ threshold: 0 });
  const [date, setDate] = useState(todayStr());
  const [reference, setReference] = useState("");
  const [lines, setLines] = useState([blankLine()]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    const [itemPage, loadedSettings] = await Promise.all([
      base44.entities.PackagingItem.filter({ active: true }, { sort: "item_code", limit: 500 }),
      loadPackagingSettings(),
    ]);
    setItems(itemPage.items || []);
    setSettings(loadedSettings);
  };

  useEffect(() => {
    load();
    loadProductionOrders().then(setOrders).catch(() => setOrders([]));
    loadProducts().then((rows) => setProducts(rows.filter((p) => p.active !== false))).catch(() => setProducts([]));
  }, []);

  const setLine = (key, patch) => setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  // Picking a production order also links the line to its Product Master item.
  const setLineField = (key, patch) => {
    if (patch.production_order === undefined) return setLine(key, patch);
    const product = products.find((p) => p.product_name && patch.production_order.startsWith(p.product_name));
    return setLine(key, {
      ...patch,
      ...(product ? { product_id: product.id, product_code: product.product_code || "", product_name: product.product_name || "" } : {}),
    });
  };

  const save = async () => {
    for (let i = 0; i < lines.length; i += 1) {
      const l = lines[i];
      const item = items.find((x) => x.id === l.item_id);
      if (!item) return setError(`Line ${i + 1}: select an item.`);
      const qty = Number(l.quantity) || 0;
      if (!(qty > 0)) return setError(`Line ${i + 1}: quantity must be greater than zero.`);
      if (qty > Number(item.quantity || 0)) return setError(`Line ${i + 1}: only ${fmtQty(item.quantity)} ${item.unit || ""} of ${item.item_code} in stock.`);
    }
    setError("");
    setSaving(true);
    const group = newGroupId("OUT");
    let approvals = 0;
    try {
      for (const l of lines) {
        const live = await base44.entities.PackagingItem.get(l.item_id);
        const result = await submitStockUse({
          item: live,
          quantity: Number(l.quantity),
          user,
          threshold: settings.threshold,
          extras: {
            movement_date: date,
            batch_number: (l.batch_number || "").trim(),
            production_order: l.production_order || reference,
            production_line: l.production_line,
            remarks: l.remarks,
            source: "Goods Issued",
            group_id: group,
            ...(l.product_id ? { product_id: l.product_id, product_code: l.product_code } : {}),
          },
        });
        if (result?.approval) approvals += 1;
      }
      toast({
        title: "Stock issued",
        description: approvals
          ? `${lines.length - approvals} line(s) deducted, ${approvals} sent for approval.`
          : `${lines.length} line${lines.length === 1 ? "" : "s"} deducted from stock.`,
      });
      setLines([blankLine()]);
      setReference("");
      await load();
    } catch (e) {
      setError(e?.message || "Could not record the issue.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0e17] p-4 md:p-6 space-y-4">
      <div>
        <h2 className="text-white text-lg font-semibold">Goods Issued</h2>
        <p className="text-[#a0aec0] text-sm mt-1">Record packaging stock going out to production. Stock cannot go below zero.</p>
      </div>

      <div className="rounded-xl border border-[#1e2740] bg-[#0e131d] p-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-[10px] uppercase tracking-widest text-[#5f6b7f] font-semibold">Date</label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="bg-[#0a0e17] border-[#1e2740] text-white" />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] uppercase tracking-widest text-[#5f6b7f] font-semibold">Issue Reference</label>
            <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Optional (used when a line has no order)" className="bg-[#0a0e17] border-[#1e2740] text-white" />
          </div>
        </div>
      </div>

      <div className="space-y-2">
        {lines.map((line) => (
          <OutLineRow
            key={line.key}
            line={line}
            items={items}
            products={products}
            orders={orders}
            onChange={(patch) => setLineField(line.key, patch)}
            onRemove={() => setLines((prev) => prev.filter((l) => l.key !== line.key))}
            removable={lines.length > 1}
          />
        ))}
      </div>

      <Button variant="outline" onClick={() => setLines((prev) => [...prev, blankLine()])} className="w-full border-dashed border-[#1e2740] bg-transparent text-[#a0aec0] hover:bg-white/5 hover:text-white">
        <Plus className="w-4 h-4" /> Add line
      </Button>

      {error && <p className="text-sm text-[#ff4d4d]">{error}</p>}

      <div className="sticky bottom-0 -mx-4 md:-mx-6 px-4 md:px-6 py-3 bg-[#0a0e17] border-t border-[#1e2740] flex flex-wrap items-center gap-3">
        <p className="text-xs text-[#5f6b7f]">{lines.length} line{lines.length === 1 ? "" : "s"} · issued by {user?.full_name || user?.email || "—"}</p>
        <Button onClick={save} disabled={saving} className="w-full sm:w-auto sm:ml-auto bg-[#00e5ff] hover:bg-[#00c3d7] text-[#0a0e17] font-semibold h-11">
          <Save className="w-4 h-4" /> {saving ? "Saving..." : "Issue stock"}
        </Button>
      </div>
    </div>
  );
}