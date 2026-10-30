import React, { useEffect, useState } from "react";
import { productService } from "@/services/productService";
import { useAuth } from "@/lib/AuthContext";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import DatasheetFields from "@/components/productmaster/DatasheetFields";
import PackagingPerCartonEditor from "@/components/planning/PackagingPerCartonEditor";
import Field from "@/components/planning/Field";
import {
  auditFieldChanges, barcodeKey, blankProduct, itemCodeKey, logProductAudit, productPayload, productToForm,
} from "@/lib/productMaster";
import { ensureRecipeLinks } from "@/lib/recipeMaster";
import { dialogClass, primaryButton, subtleButton, inputClass, labelClass } from "@/components/planning/styles";

// Add or edit one product on the master datasheet.
export default function ProductDatasheetDialog({
  open, onClose, product, products = [], machines = [], brands = [], customers = [], recipes = [], packagingItems = [], onSaved,
}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [form, setForm] = useState(blankProduct());
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError("");
    setForm(product ? productToForm(product) : blankProduct());
  }, [open, product]);

  const set = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const save = async () => {
    const payload = productPayload(form);
    if (!payload.product_code) { setError("Item Code is required."); return; }
    if (!payload.product_name) { setError("Carton Description is required."); return; }
    const others = products.filter((row) => row.id !== product?.id);
    if (others.some((row) => itemCodeKey(row.product_code) === itemCodeKey(payload.product_code))) {
      setError(`Item Code ${payload.product_code} is already used by another product.`);
      return;
    }
    const scanned = [payload.barcode, payload.carton_barcode].filter(Boolean).map(barcodeKey);
    const clash = others.find((row) =>
      [row.barcode, row.carton_barcode, ...(row.carton_skus || []).map((sku) => sku.barcode)]
        .filter(Boolean)
        .some((code) => scanned.includes(barcodeKey(code)))
    );
    if (clash) { setError(`That barcode is already used by ${clash.product_code} · ${clash.product_name}.`); return; }

    setSaving(true);
    try {
      const saved = product
        ? await productService.updateProduct(product.id, payload)
        : await productService.createProduct(payload);
      if (payload.recipe_name) {
        await ensureRecipeLinks({ products: [{ ...payload, id: saved.id }], recipes, user });
      }
      if (product) {
        await auditFieldChanges({ user, recordId: payload.product_code, before: product, after: payload });
      } else {
        await logProductAudit({
          user, action: "Created", recordId: payload.product_code,
          details: `${payload.product_code} added to the master`, newValue: payload.product_name,
        });
      }
      toast({ title: product ? "Product updated" : "Product added", description: `${payload.product_code} · ${payload.product_name}` });
      onSaved?.();
    } catch (e) {
      setError(e?.message || "Could not save this product.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && !saving && onClose()}>
      <DialogContent className={cn(dialogClass, "max-w-4xl")}>
        <DialogHeader>
          <DialogTitle className="text-white">{product ? `Edit ${product.product_code}` : "Add Product"}</DialogTitle>
          <p className="text-xs text-[#5f6b7f]">Item Code is the key every module uses. Net filling and cartons per batch are calculated.</p>
        </DialogHeader>

        <DatasheetFields
          form={form}
          set={set}
          brands={brands}
          customers={customers}
          machines={machines}
          recipeNames={[...new Set(recipes.map((row) => row.recipe_name).filter(Boolean))]}
        />

        <div className="space-y-2">
          <p className={labelClass}>Packaging per carton</p>
          <PackagingPerCartonEditor value={form.packaging_per_carton || []} onChange={(v) => set("packaging_per_carton", v)} items={packagingItems} />
        </div>

        <Field label="Notes">
          <Input value={form.notes} onChange={(e) => set("notes", e.target.value)} className={inputClass} placeholder="Optional internal note" />
        </Field>

        {error && <p className="text-sm text-[#ff4d4d]">{error}</p>}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} className={subtleButton} disabled={saving}>Cancel</Button>
          <Button onClick={save} className={primaryButton} disabled={saving}>{saving ? "Saving..." : product ? "Save changes" : "Add product"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}