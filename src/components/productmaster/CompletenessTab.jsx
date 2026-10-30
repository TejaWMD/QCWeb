import React, { useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, Check, Download } from "lucide-react";
import InlineCell from "@/components/productmaster/InlineCell";
import {
  auditFieldChanges, canEditProductField, downloadCsv, num, productCompleteness, productPayload, productStatus, productToForm,
} from "@/lib/productMaster";
import { inputClass, selectClass, subtleButton, panelClass } from "@/components/planning/styles";

const Cell = ({ filled, children }) => (
  <span className={filled ? "text-[#a0aec0]" : "text-[#ff9f43]"}>{children}</span>
);

// Finds what is still missing on each product and lets it be fixed in place.
export default function CompletenessTab({ products = [], brands = [], user, onReload }) {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [brand, setBrand] = useState("all");
  const [status, setStatus] = useState("all");
  const [onlyGaps, setOnlyGaps] = useState(true);

  const saveField = async (product, field, value) => {
    const form = { ...productToForm(product), [field]: value };
    const payload = productPayload(form);
    await base44.entities.Product.update(product.id, payload);
    await auditFieldChanges({ user, recordId: product.product_code, before: product, after: payload });
    toast({ title: "Saved", description: `${product.product_code} updated` });
    await onReload?.();
  };

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return products
      .filter((p) => brand === "all" || (p.brand || "") === brand)
      .filter((p) => status === "all" || productStatus(p) === status)
      .filter((p) => (onlyGaps ? productCompleteness(p).incomplete : true))
      .filter((p) => !needle || `${p.product_code} ${p.product_name} ${p.brand}`.toLowerCase().includes(needle));
  }, [products, search, brand, status, onlyGaps]);

  const exportGaps = () =>
    downloadCsv(
      "product-data-gaps.csv",
      ["Item Code", "Carton Description", "Brand", "Missing"],
      filtered.map((p) => [p.product_code || "", p.product_name || "", p.brand || "", productCompleteness(p).core.join("; ")])
    );

  return (
    <div className="space-y-3">
      <div className={`${panelClass} p-3`}>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search code or description" className={`${inputClass} xl:col-span-2`} />
          <Select value={brand} onValueChange={setBrand}>
            <SelectTrigger className={selectClass}><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All brands</SelectItem>
              {brands.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className={selectClass}><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="Active">Active</SelectItem>
              <SelectItem value="Inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setOnlyGaps((v) => !v)} className={`${subtleButton} flex-1 ${onlyGaps ? "text-[#ff9f43] border-[#ff9f43]/40" : ""}`}>
              <AlertTriangle className="w-4 h-4 mr-1.5" /> {onlyGaps ? "Gaps only" : "All rows"}
            </Button>
            <Button variant="outline" onClick={exportGaps} className={subtleButton} title="Export gaps"><Download className="w-4 h-4" /></Button>
          </div>
        </div>
      </div>

      <div className={`${panelClass} overflow-x-auto`}>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[10px] uppercase tracking-widest text-[#5f6b7f] border-b border-[#1e2740]">
              <th className="text-left font-semibold px-3 py-2">Item Code</th>
              <th className="text-left font-semibold px-3 py-2">Carton Description</th>
              <th className="text-left font-semibold px-3 py-2">Batch Code</th>
              <th className="text-left font-semibold px-3 py-2">Shelf Life</th>
              <th className="text-left font-semibold px-3 py-2">Net Wt (kg)</th>
              <th className="text-left font-semibold px-3 py-2">SKU Barcode</th>
              <th className="text-left font-semibold px-3 py-2">Carton Barcode</th>
              <th className="text-left font-semibold px-3 py-2">Line Type</th>
              <th className="text-left font-semibold px-3 py-2">Customer</th>
              <th className="text-left font-semibold px-3 py-2">Missing</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={10} className="px-3 py-8 text-center text-[#a0aec0]">Nothing to show.</td></tr>
            ) : filtered.map((p) => {
              const completeness = productCompleteness(p);
              return (
                <tr key={p.id} className="border-b border-[#131926] hover:bg-white/5">
                  <td className="px-3 py-2 text-white font-semibold whitespace-nowrap">{p.product_code}</td>
                  <td className="px-3 py-2 text-[#a0aec0] max-w-[240px] truncate" title={p.product_name}>{p.product_name}</td>
                  <td className="px-3 py-2">
                    <Cell filled={!!p.batch_prefix}>
                      <InlineCell value={p.batch_prefix || ""} onSave={(v) => saveField(p, "batch_prefix", v)} canEdit={canEditProductField(user, "batch_prefix")} />
                    </Cell>
                  </td>
                  <td className="px-3 py-2">
                    <Cell filled={num(p.shelf_life_months) > 0}>
                      <InlineCell type="number" value={num(p.shelf_life_months)} onSave={(v) => saveField(p, "shelf_life_months", v)} canEdit={canEditProductField(user, "shelf_life_months")} />
                    </Cell>
                  </td>
                  <td className="px-3 py-2">
                    <Cell filled={num(p.net_weight_kg) > 0}>
                      <InlineCell type="number" value={num(p.net_weight_kg)} onSave={(v) => saveField(p, "net_weight_kg", v)} canEdit={canEditProductField(user, "net_weight_kg")} />
                    </Cell>
                  </td>
                  <td className="px-3 py-2">
                    <Cell filled={!!p.barcode}>
                      <InlineCell value={p.barcode || ""} onSave={(v) => saveField(p, "barcode", v)} canEdit={canEditProductField(user, "barcode")} />
                    </Cell>
                  </td>
                  <td className="px-3 py-2">
                    <Cell filled={!!p.carton_barcode}>
                      <InlineCell value={p.carton_barcode || ""} onSave={(v) => saveField(p, "carton_barcode", v)} canEdit={canEditProductField(user, "carton_barcode")} />
                    </Cell>
                  </td>
                  <td className="px-3 py-2">
                    <Cell filled={!!p.line_type}>
                      <InlineCell value={p.line_type || ""} onSave={(v) => saveField(p, "line_type", v)} canEdit={canEditProductField(user, "line_type")} />
                    </Cell>
                  </td>
                  <td className="px-3 py-2">
                    <Cell filled={!!p.customer}>
                      <InlineCell value={p.customer || ""} onSave={(v) => saveField(p, "customer", v)} canEdit={canEditProductField(user, "customer")} />
                    </Cell>
                  </td>
                  <td className="px-3 py-2">
                    {completeness.incomplete ? (
                      <span className="text-[#ff9f43] text-xs">{completeness.core.join(", ")}</span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[#00ff9d] text-xs"><Check className="w-3.5 h-3.5" /> Ready</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-[#5f6b7f]">{filtered.length} product(s). QA may edit shelf life and barcodes; other fields are Admin only.</p>
    </div>
  );
}