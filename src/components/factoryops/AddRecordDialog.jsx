import React, { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import EvidenceUpload from "@/components/factoryops/EvidenceUpload";
import ProductPicker from "@/components/labels/ProductPicker";
import { batchesForProduct, loadProductLinkData } from "@/lib/productLinks";

const initialValues = (fields) => {
  const values = {};
  fields.forEach((f) => {
    if (f.type === "file") {
      values[`${f.key}_uri`] = "";
      values[`${f.key}_name`] = "";
      return;
    }
    if (f.type === "product") {
      values.product_id = "";
      values.product_code = "";
      values.product_name = "";
    }
    values[f.key] = f.type === "checkbox" ? false : f.default !== undefined ? f.default : "";
  });
  return values;
};

// Generic add-record form driven by a field config: { key, label, type, options, required, showIf }
// type: text | number | date | select | textarea | checkbox | file | product | batch
// "product" picks an item from the Product Master and stores product_id / product_code /
// product_name; "batch" suggests the batches already recorded for that product.
export default function AddRecordDialog({ open, onOpenChange, title, fields, onSubmit }) {
  const [values, setValues] = useState(() => initialValues(fields));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [link, setLink] = useState({ products: [], records: [] });
  const needsLink = fields.some((f) => f.type === "product" || f.type === "batch");

  useEffect(() => {
    if (open) {
      setValues(initialValues(fields));
      setError("");
    }
  }, [open]);

  useEffect(() => {
    if (!open || !needsLink || link.products.length) return;
    loadProductLinkData()
      .then((data) => setLink({ products: data.products, records: data.records }))
      .catch(() => setLink({ products: [], records: [] }));
  }, [open, needsLink, link.products.length]);

  const set = (key, value) => setValues((v) => ({ ...v, [key]: value }));

  // Picking a product also clears any batch typed for the previous product.
  const pickProduct = (product) => {
    setValues((v) => {
      const next = {
        ...v,
        product_id: product?.id || "",
        product_code: product?.product_code || "",
        product_name: product?.product_name || "",
      };
      fields.filter((f) => f.type === "batch").forEach((f) => { next[f.key] = ""; });
      return next;
    });
  };

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await onSubmit(values);
      onOpenChange(false);
    } catch (err) {
      setError(err?.message || "Could not save the record. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#131926] border-[#1e2740] text-white max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-white">{title}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          {fields.filter((f) => (f.showIf ? f.showIf(values) : true)).map((f) => (
            <div key={f.key} className="space-y-1.5">
              {f.type === "checkbox" ? (
                <div className="flex items-center gap-2 pt-1">
                  <Checkbox id={f.key} checked={!!values[f.key]} onCheckedChange={(c) => set(f.key, c === true)} />
                  <Label htmlFor={f.key} className="text-sm text-[#a0aec0] font-normal">{f.label}</Label>
                </div>
              ) : f.type === "file" ? (
                <div className="space-y-1.5">
                  <Label className="text-xs text-[#a0aec0]">{f.label}</Label>
                  <EvidenceUpload
                    value={{ uri: values[`${f.key}_uri`], name: values[`${f.key}_name`] }}
                    onChange={(v) => { set(`${f.key}_uri`, v.uri || ""); set(`${f.key}_name`, v.name || ""); }}
                  />
                </div>
              ) : (
                <>
                  <Label htmlFor={f.key} className="text-xs text-[#a0aec0]">{f.label}</Label>
                  {f.type === "product" ? (
                    <ProductPicker products={link.products} value={values.product_id} onChange={pickProduct} />
                  ) : f.type === "batch" ? (
                    <>
                      <Input
                        id={f.key}
                        list={`batches-${f.key}`}
                        value={values[f.key]}
                        onChange={(e) => set(f.key, e.target.value.toUpperCase())}
                        placeholder={values.product_id ? "Pick a recorded batch or type one" : "Choose a product first"}
                        className="bg-[#0e131d] border-[#1e2740] text-white"
                      />
                      <datalist id={`batches-${f.key}`}>
                        {batchesForProduct(link.records, values.product_id).map((b) => <option key={b} value={b} />)}
                      </datalist>
                    </>
                  ) : f.type === "select" ? (
                    <Select value={values[f.key] || undefined} onValueChange={(v) => set(f.key, v)}>
                      <SelectTrigger id={f.key} className="bg-[#0e131d] border-[#1e2740] text-white">
                        <SelectValue placeholder={`Select ${f.label}`} />
                      </SelectTrigger>
                      <SelectContent>
                        {f.options.map((opt) => {
                          const value = typeof opt === "string" ? opt : opt.value;
                          const label = typeof opt === "string" ? opt : opt.label;
                          return <SelectItem key={value} value={value}>{label}</SelectItem>;
                        })}
                      </SelectContent>
                    </Select>
                  ) : f.type === "textarea" ? (
                    <Textarea
                      id={f.key}
                      value={values[f.key]}
                      onChange={(e) => set(f.key, e.target.value)}
                      required={f.required}
                      className="bg-[#0e131d] border-[#1e2740] text-white min-h-[70px]"
                    />
                  ) : (
                    <Input
                      id={f.key}
                      type={f.type === "number" ? "number" : f.type === "date" ? "date" : "text"}
                      value={values[f.key]}
                      onChange={(e) => set(f.key, f.type === "number" ? (e.target.value === "" ? "" : Number(e.target.value)) : e.target.value)}
                      required={f.required}
                      className="bg-[#0e131d] border-[#1e2740] text-white"
                    />
                  )}
                </>
              )}
            </div>
          ))}
          {error && <p className="text-xs text-[#ff4d4d]">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} className="text-[#a0aec0] hover:text-white hover:bg-white/5">
              Cancel
            </Button>
            <Button type="submit" disabled={saving} className="bg-[#00e5ff] hover:bg-[#00c3d7] text-[#0a0e17]">
              {saving ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}