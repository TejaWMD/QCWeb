import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, CheckCircle2, History, Printer, Settings, Star } from "lucide-react";
import ProductPicker from "@/components/labels/ProductPicker";
import LayoutPicker from "@/components/labels/LayoutPicker";
import LabelPreview from "@/components/labels/LabelPreview";
import LabelPrintSheet from "@/components/labels/LabelPrintSheet";
import LabelSettingsDialog from "@/components/labels/LabelSettingsDialog";
import { loadMachines, loadProducts, loadRecipes, num } from "@/lib/planning";
import { recipeOf } from "@/lib/productLinks";
import { labelBlock } from "@/lib/productMaster";
import { fmtQty, loadOrders } from "@/lib/production";
import { todayStr } from "@/lib/warehouse";
import { actingUserName, isAdminUser } from "@/lib/permissions";
import {
  canEditLabelSettings, duplicateOf, expiryFor, fmtDay, loadBatchRecords, loadLabelSettings, logLabelAudit, normalizeBatch,
  resolveLayout, saveDefaultLayoutForProduct, scheduledBatches, traceUrlFor,
} from "@/lib/labels";
import { recordBatchOnOrder } from "@/lib/batchTrace";
import { inputClass, selectClass, primaryButton, subtleButton, panelClass, labelClass } from "@/components/planning/styles";

const EMPTY_SETTINGS = { id: "", layouts: [], default_layout_id: "" };

export default function CreateBatch() {
  const { user } = useAuth();
  const { toast } = useToast();
  const admin = isAdminUser(user);

  const [products, setProducts] = useState([]);
  const [recipes, setRecipes] = useState([]);
  const [orders, setOrders] = useState([]);
  const [machines, setMachines] = useState([]);
  const [records, setRecords] = useState([]);
  const [settings, setSettings] = useState(EMPTY_SETTINGS);
  const [loading, setLoading] = useState(true);

  const [productId, setProductId] = useState("");
  const [batchSource, setBatchSource] = useState("scheduled");
  const [batchNumber, setBatchNumber] = useState("");
  const [productionDate, setProductionDate] = useState(todayStr());
  const [quantity, setQuantity] = useState("");
  const [machine, setMachine] = useState("");
  const [orderId, setOrderId] = useState("");
  const [orderNumber, setOrderNumber] = useState("");
  const [layoutId, setLayoutId] = useState("");
  const [custom, setCustom] = useState({ width_mm: 70, height_mm: 50, font_size: 7, qr_mm: 14, qr_ecc: "M" });
  const [copies, setCopies] = useState(1);
  const [overrideOpen, setOverrideOpen] = useState(false);
  const [overrideDate, setOverrideDate] = useState("");
  const [overrideReason, setOverrideReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [job, setJob] = useState(null);

  const reload = useCallback(async () => {
    const [productRows, orderRows, machineRows, recordRows, labelSettings, recipeRows] = await Promise.all([
      loadProducts(), loadOrders(), loadMachines(), loadBatchRecords(), loadLabelSettings(), loadRecipes(),
    ]);
    setProducts(productRows.filter((p) => p.active !== false && !p.hidden));
    setRecipes(recipeRows);
    setOrders(orderRows);
    setMachines(machineRows);
    setRecords(recordRows);
    setSettings(labelSettings);
    setLayoutId((prev) => prev || labelSettings.default_layout_id);
    setLoading(false);
  }, []);

  useEffect(() => { reload(); }, [reload]);

  const product = products.find((p) => p.id === productId) || null;
  const recipe = product ? recipeOf(recipes, product) : null;

  const selectProduct = (next) => {
    setProductId(next?.id || "");
    setBatchNumber("");
    setOrderId("");
    setOrderNumber("");
    setLayoutId(next?.default_label_layout || settings.default_layout_id);
    setMachine(next?.default_machine || "");
  };

  const batches = useMemo(
    () => scheduledBatches(orders, records.map((r) => `${r.product_id}|${normalizeBatch(r.batch_number)}`))
      .filter((entry) => entry.order.product_id === productId),
    [orders, records, productId]
  );

  const pickScheduled = (code) => {
    const entry = batches.find((b) => b.code === code);
    setBatchNumber(entry?.code || "");
    setOrderId(entry?.order.id || "");
    setOrderNumber(entry?.order.order_number || "");
    setMachine((prev) => entry?.order.machine || prev);
  };

  const computedExpiry = expiryFor(productionDate, product?.shelf_life_days);
  const expiryDate = overrideOpen && overrideDate ? overrideDate : computedExpiry;
  const duplicate = duplicateOf(records, productId, batchNumber);

  const baseLayout = resolveLayout(settings, layoutId);
  const layout = layoutId === "custom"
    ? {
        ...baseLayout,
        id: "custom",
        name: "Custom Manual",
        width_mm: num(custom.width_mm) || 70,
        height_mm: num(custom.height_mm) || 50,
        font_size: num(custom.font_size) || 7,
        qr_mm: num(custom.qr_mm) || 14,
        qr_ecc: custom.qr_ecc || "M",
      }
    : baseLayout;

  const labelData = {
    productName: product?.product_name || "",
    productCode: product?.product_code || "",
    batchNumber,
    productionDate,
    expiryDate,
  };

  const savedLayout = product?.default_label_layout || "";
  const layoutIsDefault = product ? savedLayout === layoutId : false;

  const saveAsDefault = async () => {
    if (!product) return;
    await saveDefaultLayoutForProduct(product.id, layoutId);
    toast({ title: "Layout saved", description: `${layout.name} is now the default for ${product.product_name}.` });
    await reload();
  };

  const saveAndPrint = async () => {
    const batch = normalizeBatch(batchNumber);
    if (!product) return toast({ title: "Pick a product", description: "The batch must belong to a product.", variant: "destructive" });
    const blocked = labelBlock(product);
    if (blocked) return toast({ title: "Product cannot be labelled", description: `${product.product_name}: ${blocked}. Fix it in Product Master.`, variant: "destructive" });
    if (!batch) return toast({ title: "Batch number missing", description: "Pick a scheduled batch or type one in.", variant: "destructive" });
    if (duplicate) return toast({ title: "Duplicate batch number", description: `${batch} is already recorded for ${product.product_name}.`, variant: "destructive" });
    if (!expiryDate) return toast({ title: "Expiry date missing", description: "Set the product shelf life, or override the expiry date.", variant: "destructive" });
    if (overrideOpen && !overrideReason.trim()) return toast({ title: "Reason required", description: "Give a reason for overriding the expiry date.", variant: "destructive" });

    setSaving(true);
    try {
      const count = Math.max(1, Math.round(num(copies) || 1));
      const payload = {
        product_id: product.id,
        product_code: product.product_code || "",
        product_name: product.product_name || "",
        batch_number: batch,
        production_date: productionDate,
        expiry_date: expiryDate,
        shelf_life_days: num(product.shelf_life_days),
        expiry_overridden: overrideOpen,
        expiry_override_reason: overrideOpen ? overrideReason.trim() : "",
        expiry_override_by: overrideOpen ? actingUserName(user) : "",
        quantity_cartons: num(quantity),
        machine,
        order_id: orderId,
        order_number: orderNumber,
        label_layout: layout.id,
        label_layout_name: layout.name,
        label_width_mm: layout.width_mm,
        label_height_mm: layout.height_mm,
        label_font_size: layout.font_size,
        qr_mm: layout.qr_mm,
        qr_ecc: layout.qr_ecc,
        trace_url: traceUrlFor(batch),
        created_by_name: actingUserName(user),
        created_by_id: user?.id || "",
        print_count: count,
        reprints: [],
      };
      const created = await base44.entities.BatchRecord.create(payload);
      await logLabelAudit({
        user,
        action: "Created",
        recordId: created?.id || "",
        details: `Batch ${batch} for ${product.product_name} · ${count} label(s) printed`,
      });
      setRecords((list) => [created || payload, ...list]);

      // Mark the batch on its production order and add its cartons to the produced total.
      const linkedOrder = orders.find((o) => o.id === orderId) || null;
      if (linkedOrder) {
        const updatedOrder = await recordBatchOnOrder({
          order: linkedOrder,
          batchNumber: batch,
          cartons: num(quantity),
          recordId: created?.id || "",
          user,
        });
        if (updatedOrder?.id) setOrders((list) => list.map((o) => (o.id === updatedOrder.id ? updatedOrder : o)));
      }

      setJob({ layout, copies: count, data: { ...labelData, batchNumber: batch } });
      toast({
        title: "Batch saved",
        description: linkedOrder
          ? `${batch} · ${linkedOrder.order_number || "order"} updated · printing ${count} label(s)`
          : `${batch} · printing ${count} label(s)`,
      });
      setBatchNumber("");
      setQuantity("");
      setOrderId("");
      setOrderNumber("");
      setOverrideOpen(false);
      setOverrideDate("");
      setOverrideReason("");
    } catch (e) {
      toast({ title: "Could not save the batch", description: e?.message || "Please try again.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0e17] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#1e2740] border-t-[#00e5ff] rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0e17] p-4 md:p-6 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-white text-lg font-semibold">Create Batch / Labels</h2>
          <p className="text-[#a0aec0] text-sm mt-1">Record a batch and print its labels with a traceability QR code.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canEditLabelSettings(user) && (
            <Button variant="outline" onClick={() => setSettingsOpen(true)} className={subtleButton}>
              <Settings className="w-4 h-4 mr-1.5" /> Label Settings
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.25fr_0.75fr] gap-4 items-start">
        <div className={`${panelClass} p-4 space-y-4`}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className={labelClass}>Product</label>
              <ProductPicker products={products} value={productId} onChange={selectProduct} />
              {product && (
                <p className="text-[11px] text-[#5f6b7f]">Shelf life {num(product.shelf_life_days) || 0} days · {product.product_code}</p>
              )}
              {product && labelBlock(product) && (
                <p className="text-[11px] text-[#ff4d4d] flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" /> {labelBlock(product)} — labels are blocked until this is fixed in Product Master.
                </p>
              )}
            </div>

            <div className="space-y-1">
              <label className={labelClass}>Batch number</label>
              <div className="flex gap-1 mb-1">
                {[["scheduled", "From schedule"], ["manual", "Manual entry"]].map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => { setBatchSource(key); setBatchNumber(""); setOrderId(""); setOrderNumber(""); }}
                    className={`text-[11px] px-2 py-1 rounded border ${
                      batchSource === key
                        ? "border-[#00e5ff] bg-[#00e5ff]/10 text-[#00e5ff]"
                        : "border-[#1e2740] text-[#a0aec0] hover:text-white"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {batchSource === "scheduled" ? (
                <Select value={batchNumber} onValueChange={pickScheduled}>
                  <SelectTrigger className={selectClass}>
                    <SelectValue placeholder={productId ? "Pick a scheduled batch" : "Select a product first"} />
                  </SelectTrigger>
                  <SelectContent>
                    {batches.length === 0 ? (
                      <div className="px-2 py-2 text-xs text-[#5f6b7f]">No scheduled batches left for this product.</div>
                    ) : (
                      batches.map((entry) => (
                        <SelectItem key={`${entry.order.id}-${entry.code}`} value={entry.code} disabled={entry.recorded}>
                          {entry.code} · {entry.order.order_number}{entry.recorded ? " (recorded)" : ""}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              ) : (
                <Input value={batchNumber} onChange={(e) => setBatchNumber(e.target.value.toUpperCase())} placeholder="e.g. RCE28102026A" className={inputClass} />
              )}
              {duplicate && (
                <p className="text-[11px] text-[#ff4d4d] flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" /> Already recorded for this product.
                </p>
              )}
              {orderNumber && <p className="text-[11px] text-[#5f6b7f]">From order {orderNumber}</p>}
            </div>

            <div className="space-y-1">
              <label className={labelClass}>Production date</label>
              <Input type="date" value={productionDate} onChange={(e) => setProductionDate(e.target.value)} className={inputClass} />
            </div>

            <div className="space-y-1">
              <label className={labelClass}>Expiry date</label>
              <Input type="date" value={expiryDate} readOnly disabled className={`${inputClass} opacity-80`} />
              <p className="text-[11px] text-[#5f6b7f]">
                {computedExpiry ? `${num(product?.shelf_life_days)} day shelf life → ${fmtDay(computedExpiry)}` : "This product has no shelf life set."}
              </p>
              {admin && (
                <button
                  type="button"
                  onClick={() => { setOverrideOpen((v) => !v); setOverrideDate(overrideOpen ? "" : (computedExpiry || productionDate)); }}
                  className="text-[11px] text-[#00e5ff] hover:underline"
                >
                  {overrideOpen ? "Cancel override" : "Admin: override expiry date"}
                </button>
              )}
              {overrideOpen && (
                <div className="space-y-1 pt-1">
                  <Input type="date" value={overrideDate} onChange={(e) => setOverrideDate(e.target.value)} className={inputClass} />
                  <Input value={overrideReason} onChange={(e) => setOverrideReason(e.target.value)} placeholder="Reason for the override (required)" className={inputClass} />
                </div>
              )}
            </div>

            <div className="space-y-1">
              <label className={labelClass}>Quantity produced (cartons)</label>
              <Input type="number" min="0" step="1" value={quantity} onChange={(e) => setQuantity(e.target.value)} className={inputClass} />
            </div>

            <div className="space-y-1">
              <label className={labelClass}>Machine</label>
              <Select value={machine || "none"} onValueChange={(v) => setMachine(v === "none" ? "" : v)}>
                <SelectTrigger className={selectClass}><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Not set</SelectItem>
                  {machines.map((m) => <SelectItem key={m.id} value={m.name}>{m.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {product && (
            <div className="rounded-lg border border-[#1e2740] bg-[#0e131d] p-3 space-y-1">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[10px] uppercase tracking-widest text-[#5f6b7f] font-semibold">Recipe</p>
                <Link to="/recipe-master" className="text-[11px] text-[#00e5ff] hover:underline">Recipe Master</Link>
              </div>
              {recipe ? (
                <>
                  <p className="text-sm text-white">
                    {recipe.recipe_name || "Recipe"} <span className="text-[#5f6b7f]">· v{recipe.version}</span>
                  </p>
                  <p className="text-[11px] text-[#5f6b7f]">
                    {(recipe.ingredients || []).length} ingredient(s) · {fmtQty(recipe.batch_cartons)} cartons per batch
                    {recipe.standard_yield_pct ? ` · standard yield ${fmtQty(recipe.standard_yield_pct)}%` : ""}
                  </p>
                </>
              ) : (
                <p className="text-[11px] text-[#ff9f43]">No recipe linked to this item yet — add one in Recipe Master.</p>
              )}
            </div>
          )}

          <div className="space-y-2 border-t border-[#1e2740] pt-3">
            <div className="flex items-center justify-between gap-2">
              <label className={labelClass}>Label layout</label>
              {product && (
                <button
                  type="button"
                  onClick={saveAsDefault}
                  disabled={layoutIsDefault}
                  className={`text-[11px] inline-flex items-center gap-1 ${layoutIsDefault ? "text-[#5f6b7f]" : "text-[#00e5ff] hover:underline"}`}
                >
                  <Star className="w-3 h-3" /> {layoutIsDefault ? "Saved as this product's default" : "Save as this product's default"}
                </button>
              )}
            </div>
            <LayoutPicker
              layouts={settings.layouts}
              value={layoutId}
              custom={custom}
              onSelect={setLayoutId}
              onCustomChange={setCustom}
            />
          </div>

          <div className="flex flex-wrap items-end justify-between gap-3 border-t border-[#1e2740] pt-3">
            <div className="space-y-1 w-32">
              <label className={labelClass}>Label copies</label>
              <Input type="number" min="1" max="200" value={copies} onChange={(e) => setCopies(e.target.value)} className={inputClass} />
            </div>
            <Button onClick={saveAndPrint} disabled={saving || !!duplicate} className={`${primaryButton} h-10 px-5`}>
              <Printer className="w-4 h-4 mr-1.5" />
              {saving ? "Saving..." : "Save & Print Labels"}
            </Button>
          </div>
        </div>

        <div className={`${panelClass} p-4 space-y-3 xl:sticky xl:top-4`}>
          <div className="flex items-center justify-between gap-2">
            <p className="text-[10px] uppercase tracking-widest text-[#5f6b7f] font-semibold">Label preview</p>
            <span className="text-[10px] text-[#5f6b7f]">{layout.name} · {layout.width_mm} × {layout.height_mm} mm</span>
          </div>

          <div className="overflow-x-auto pb-1">
            <div className="inline-block shadow-lg">
              <LabelPreview layout={layout} data={labelData} />
            </div>
          </div>

          <div className="text-[11px] text-[#5f6b7f] space-y-1">
            <p className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-[#00ff9d]" /> QR opens the traceability page for this batch.</p>
            <p className="flex items-center gap-1"><History className="w-3 h-3" /> {records.length} batch record(s) saved so far.</p>
            {quantity ? <p>Quantity: {fmtQty(quantity)} cartons</p> : null}
          </div>
        </div>
      </div>

      <LabelSettingsDialog
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        settings={settings}
        user={user}
        onSaved={reload}
      />

      <LabelPrintSheet job={job} />
    </div>
  );
}