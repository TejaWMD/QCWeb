import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { useToast } from "@/components/ui/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import Field from "@/components/planning/Field";
import PackagingPerCartonEditor from "@/components/planning/PackagingPerCartonEditor";
import { PRODUCT_CATEGORIES, codeExists, logPlanningAudit, num } from "@/lib/planning";
import { dialogClass, inputClass, selectClass, primaryButton, subtleButton } from "@/components/planning/styles";

const blank = () => ({
  product_code: "", product_name: "", category: "", carton_size: "", shelf_life_days: "",
  target_net_weight_g: "", lower_tolerance_g: "", cost_per_kg: "",
  default_machine: "", standard_batch_cartons: "", packaging_per_carton: [], active: true, notes: "",
});

export default function ProductDialog({ open, onClose, product, products = [], machines = [], packagingItems = [], onSaved }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [form, setForm] = useState(blank());
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError("");
    setForm(product ? { ...blank(), ...product, packaging_per_carton: product.packaging_per_carton || [] } : blank());
  }, [open, product]);

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const save = async () => {
    const code = (form.product_code || "").trim().toUpperCase();
    if (!code) return setError("Product code is required.");
    if (!(form.product_name || "").trim()) return setError("Product name is required.");
    if (codeExists(code, products, product?.id)) return setError(`Product code ${code} already exists on another product.`);
    const payload = {
      product_code: code,
      product_name: form.product_name.trim(),
      category: form.category || "",
      carton_size: num(form.carton_size),
      target_net_weight_g: num(form.target_net_weight_g),
      lower_tolerance_g: num(form.lower_tolerance_g),
      cost_per_kg: num(form.cost_per_kg),
      shelf_life_days: num(form.shelf_life_days),
      default_machine: form.default_machine || "",
      standard_batch_cartons: num(form.standard_batch_cartons),
      packaging_per_carton: (form.packaging_per_carton || []).filter((r) => r.item_id && num(r.quantity) > 0),
      active: form.active !== false,
      notes: form.notes || "",
    };
    setSaving(true);
    setError("");
    try {
      if (product) await base44.entities.Product.update(product.id, payload);
      else await base44.entities.Product.create(payload);
      await logPlanningAudit({
        user,
        module: "Product Master",
        action: product ? "Updated" : "Created",
        recordId: code,
        details: `Product ${code} — ${payload.product_name}`,
        newValue: payload.active ? "Active" : "Inactive",
      });
      toast({ title: product ? "Product updated" : "Product added", description: `${code} — ${payload.product_name}` });
      onSaved?.();
    } catch (e) {
      setError(e?.message || "Could not save the product.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className={dialogClass}>
        <DialogHeader>
          <DialogTitle className="text-white">{product ? `Edit ${product.product_code}` : "Add Product"}</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Product Code" hint="Short code used in batch numbers, e.g. RCE">
            <Input value={form.product_code} onChange={(e) => set("product_code", e.target.value.toUpperCase())} className={inputClass} placeholder="RCE" />
          </Field>
          <Field label="Product Name">
            <Input value={form.product_name} onChange={(e) => set("product_name", e.target.value)} className={inputClass} placeholder="Full product name" />
          </Field>
          <Field label="Category">
            <Select value={form.category || undefined} onValueChange={(v) => set("category", v)}>
              <SelectTrigger className={selectClass}><SelectValue placeholder="Select category" /></SelectTrigger>
              <SelectContent>
                {PRODUCT_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Carton Size (units per carton)">
            <Input type="number" min="0" value={form.carton_size} onChange={(e) => set("carton_size", e.target.value)} className={inputClass} placeholder="24" />
          </Field>
          <Field label="Shelf Life (days)">
            <Input type="number" min="0" value={form.shelf_life_days} onChange={(e) => set("shelf_life_days", e.target.value)} className={inputClass} placeholder="365" />
          </Field>
          <Field label="Target Net Weight (g)" hint="Used for yield output and giveaway">
            <Input type="number" min="0" step="0.1" value={form.target_net_weight_g} onChange={(e) => set("target_net_weight_g", e.target.value)} className={inputClass} placeholder="200" />
          </Field>
          <Field label="Underweight Limit (g)" hint="A sample below this is a compliance risk">
            <Input type="number" min="0" step="0.1" value={form.lower_tolerance_g} onChange={(e) => set("lower_tolerance_g", e.target.value)} className={inputClass} placeholder="195" />
          </Field>
          <Field label="Cost per kg" hint="Optional, values the giveaway">
            <Input type="number" min="0" step="0.01" value={form.cost_per_kg} onChange={(e) => set("cost_per_kg", e.target.value)} className={inputClass} placeholder="8.50" />
          </Field>
          <Field label="Default Machine" hint={machines.length ? "From the Machines list" : "No machines yet — add them on the Machines page"}>
            <Select value={form.default_machine || undefined} onValueChange={(v) => set("default_machine", v)}>
              <SelectTrigger className={selectClass}><SelectValue placeholder="Select machine" /></SelectTrigger>
              <SelectContent>
                {machines.map((m) => <SelectItem key={m.id} value={m.name}>{m.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Standard Batch Size (cartons)">
            <Input type="number" min="0" value={form.standard_batch_cartons} onChange={(e) => set("standard_batch_cartons", e.target.value)} className={inputClass} placeholder="100" />
          </Field>
          <Field label="Status" className="sm:col-span-2">
            <label className="flex items-center gap-2 text-sm text-[#a0aec0] pt-1">
              <Checkbox checked={form.active !== false} onCheckedChange={(v) => set("active", !!v)} />
              Active product
            </label>
          </Field>
        </div>

        <Field label="Packaging Items Used per Carton">
          <PackagingPerCartonEditor value={form.packaging_per_carton} onChange={(v) => set("packaging_per_carton", v)} items={packagingItems} />
        </Field>

        <Field label="Notes">
          <Textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} className={`${inputClass} min-h-[70px]`} placeholder="Optional" />
        </Field>

        {error && <p className="text-sm text-[#ff4d4d]">{error}</p>}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} className={subtleButton}>Cancel</Button>
          <Button onClick={save} disabled={saving} className={primaryButton}>{saving ? "Saving..." : "Save product"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}