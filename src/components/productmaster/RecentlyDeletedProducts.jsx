import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { RotateCcw } from "lucide-react";
import { restoreProduct } from "@/lib/productLifecycle";
import { subtleButton, panelClass } from "@/components/planning/styles";
import { useToast } from "@/components/ui/use-toast";

const when = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
};

// Deleted products wait here; nothing is ever removed for good.
export default function RecentlyDeletedProducts({ products = [], user, onReload }) {
  const { toast } = useToast();
  const [busy, setBusy] = useState("");

  const restore = async (product) => {
    setBusy(product.id);
    try {
      await restoreProduct({ product, user });
      toast({ title: "Product restored", description: `${product.product_code} is back on the master.` });
      await onReload?.();
    } catch (e) {
      toast({ title: "Could not restore", description: e?.message || "Please try again.", variant: "destructive" });
    } finally {
      setBusy("");
    }
  };

  return (
    <div className={`${panelClass} overflow-x-auto`}>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-[10px] uppercase tracking-widest text-[#5f6b7f] border-b border-[#1e2740]">
            <th className="text-left font-semibold px-3 py-2">Item Code</th>
            <th className="text-left font-semibold px-3 py-2">Carton Description</th>
            <th className="text-left font-semibold px-3 py-2">Brand</th>
            <th className="text-left font-semibold px-3 py-2">Deleted by</th>
            <th className="text-left font-semibold px-3 py-2">Deleted</th>
            <th className="px-3 py-2" />
          </tr>
        </thead>
        <tbody>
          {products.length === 0 ? (
            <tr><td colSpan={6} className="px-3 py-8 text-center text-[#a0aec0]">Nothing in Recently Deleted.</td></tr>
          ) : products.map((p) => (
            <tr key={p.id} className="border-b border-[#131926]">
              <td className="px-3 py-2 text-white font-semibold whitespace-nowrap">{p.product_code}</td>
              <td className="px-3 py-2 text-[#a0aec0] max-w-[280px] truncate" title={p.product_name}>{p.product_name}</td>
              <td className="px-3 py-2 text-[#a0aec0]">{p.brand || "—"}</td>
              <td className="px-3 py-2 text-[#a0aec0]">{p.deleted_by || "—"}</td>
              <td className="px-3 py-2 text-[#a0aec0] whitespace-nowrap">{when(p.deleted_date)}</td>
              <td className="px-3 py-2 text-right">
                <Button variant="outline" onClick={() => restore(p)} disabled={busy === p.id} className={subtleButton}>
                  <RotateCcw className="w-3.5 h-3.5 mr-1.5" /> Restore
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}